export type MembershipRole =
  | "vikar"
  | "kontaktperson"
  | "konsulent"
  | "organisationsadministrator"
  | "platformsadministrator";

export type AuthSession = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
  tokenId: string;
  expiresAt: number;
  demo: boolean;
};

export type AuthEnvironment = {
  AUTH_ISSUER?: string;
  AUTH_AUDIENCE?: string;
  SUPABASE_JWKS_URL?: string;
  DEMO_SESSION_SECRET?: string;
};

export type AuthDatabase = {
  prepare(query: string): AuthPreparedStatement;
};

export type AuthPreparedStatement = {
  bind(...values: unknown[]): AuthPreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  identity_id: string;
  role: MembershipRole;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  session_id?: string;
  organization_id?: string;
  org_id?: string;
  demo?: boolean;
  role?: MembershipRole;
};

type JsonWebKeyWithKid = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type JsonWebKeySet = {
  keys?: JsonWebKeyWithKid[];
};

const ALLOWED_ROLES = new Set<MembershipRole>([
  "vikar",
  "kontaktperson",
  "konsulent",
  "organisationsadministrator",
  "platformsadministrator",
]);

const DEMO_ROLES = new Set<MembershipRole>([
  "vikar",
  "kontaktperson",
  "konsulent",
  "organisationsadministrator",
]);

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, { expiresAt: number; keys: JsonWebKeyWithKid[] }>();

export class AuthenticationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.status = status;
  }
}

export async function authenticateRequest(
  request: Request,
  env: AuthEnvironment,
  database: AuthDatabase,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<AuthSession> {
  const token = bearerToken(request);
  if (!token) {
    throw new AuthenticationError("missing_session", "En gyldig session er påkrævet.");
  }
  const parsed = parseJwt(token);
  if (parsed.claims.demo === true) {
    return verifyDemoSession(token, env, nowEpochSeconds);
  }

  await verifySupabaseJwt(token, parsed.header, parsed.claims, env, nowEpochSeconds);
  const userId = requiredString(parsed.claims.sub, "JWT mangler bruger-ID.");
  const tokenId = parsed.claims.jti || parsed.claims.session_id || "";
  if (!tokenId) {
    throw new AuthenticationError("invalid_session", "Sessionen mangler et tilbagekaldelses-ID.");
  }
  const sessionTokenHash = await hashOpaqueToken(token);
  const revoked = await database
    .prepare(
      `SELECT session_token_hash
       FROM revoked_sessions
       WHERE session_token_hash = ?
         AND expires_at > ?
       LIMIT 1`,
    )
    .bind(sessionTokenHash, new Date(nowEpochSeconds * 1000).toISOString())
    .first<{ session_token_hash: string }>();
  if (revoked) {
    throw new AuthenticationError("revoked_session", "Sessionen er tilbagekaldt.");
  }

  const requestedOrganizationId =
    parsed.claims.organization_id || parsed.claims.org_id || undefined;
  const memberships = await database
    .prepare(
      `SELECT
         membership.id AS id,
         membership.organization_id AS organization_id,
         identity.id AS identity_id,
         role.role_key AS role
       FROM identities AS identity
       INNER JOIN organization_memberships AS membership
         ON membership.identity_id = identity.id
       INNER JOIN membership_roles AS membership_role
         ON membership_role.organization_id = membership.organization_id
        AND membership_role.membership_id = membership.id
        AND membership_role.revoked_at IS NULL
       INNER JOIN roles AS role
         ON role.id = membership_role.role_id
        AND role.role_scope = 'organization'
       INNER JOIN organizations AS organization
         ON organization.id = membership.organization_id
        AND organization.status = 'active'
       WHERE identity.provider_subject = ?
         AND identity.status = 'active'
         AND membership.status = 'active'
       ORDER BY membership.created_at ASC, role.role_key ASC`,
    )
    .bind(userId)
    .all<MembershipRow>();
  const activeMemberships = (memberships.results ?? []).filter((membership) =>
    ALLOWED_ROLES.has(membership.role),
  );
  const eligibleMemberships = requestedOrganizationId
    ? activeMemberships.filter((candidate) => candidate.organization_id === requestedOrganizationId)
    : activeMemberships;
  const membership = eligibleMemberships.length === 1 ? eligibleMemberships[0] : undefined;

  if (!membership) {
    throw new AuthenticationError(
      "membership_required",
      requestedOrganizationId
        ? "Brugeren har ikke et aktivt medlemskab i organisationen."
        : "Sessionen har ingen entydig aktiv organisation og rolle.",
      403,
    );
  }

  return {
    userId: membership.identity_id,
    organizationId: membership.organization_id,
    membershipId: membership.id,
    role: membership.role,
    tokenId,
    expiresAt: parsed.claims.exp ?? 0,
    demo: false,
  };
}

export function requireRole(session: AuthSession, allowedRoles: readonly MembershipRole[]): void {
  if (!allowedRoles.includes(session.role)) {
    throw new AuthenticationError("forbidden", "Sessionen har ikke rettighed til handlingen.", 403);
  }
}

export async function issueDemoSession(
  secret: string,
  role: MembershipRole,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 60 * 60,
): Promise<{ token: string; session: AuthSession }> {
  if (!secret || secret.length < 32) {
    throw new AuthenticationError(
      "demo_not_configured",
      "Den isolerede demosession er ikke konfigureret.",
      503,
    );
  }
  if (!DEMO_ROLES.has(role)) {
    throw new AuthenticationError("invalid_demo_role", "Rollen kan ikke bruges i demo.", 400);
  }
  const tokenId = crypto.randomUUID();
  const expiresAt = nowEpochSeconds + Math.min(Math.max(ttlSeconds, 60), 60 * 60);
  const claims: JwtClaims = {
    sub: `demo:${tokenId}`,
    iss: "hour-craft-demo",
    aud: "hour-craft-demo",
    iat: nowEpochSeconds,
    nbf: nowEpochSeconds,
    exp: expiresAt,
    jti: tokenId,
    organization_id: "demo",
    demo: true,
    role,
  };
  const header: JwtHeader = { alg: "HS256", typ: "JWT", kid: "demo-v1" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await signHmac(signingInput, secret);
  const token = `${signingInput}.${signature}`;
  return {
    token,
    session: {
      userId: claims.sub ?? "",
      organizationId: "demo",
      membershipId: `demo:${role}`,
      role,
      tokenId,
      expiresAt,
      demo: true,
    },
  };
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

async function verifyDemoSession(
  token: string,
  env: AuthEnvironment,
  nowEpochSeconds: number,
): Promise<AuthSession> {
  const secret = env.DEMO_SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new AuthenticationError(
      "demo_not_configured",
      "Den isolerede demosession er ikke konfigureret.",
      503,
    );
  }
  const parsed = parseJwt(token);
  if (parsed.header.alg !== "HS256") {
    throw new AuthenticationError("invalid_session", "Demosessionen har forkert algoritme.");
  }
  const validSignature = await verifyHmac(parsed.signingInput, parsed.signature, secret);
  if (!validSignature) {
    throw new AuthenticationError("invalid_session", "Demosessionens signatur er ugyldig.");
  }
  validateTemporalClaims(parsed.claims, nowEpochSeconds);
  if (
    parsed.claims.iss !== "hour-craft-demo" ||
    !audienceIncludes(parsed.claims.aud, "hour-craft-demo") ||
    parsed.claims.organization_id !== "demo" ||
    parsed.claims.demo !== true ||
    !parsed.claims.role ||
    !DEMO_ROLES.has(parsed.claims.role)
  ) {
    throw new AuthenticationError("invalid_session", "Demosessionens claims er ugyldige.");
  }
  return {
    userId: requiredString(parsed.claims.sub, "Demosessionen mangler bruger-ID."),
    organizationId: "demo",
    membershipId: `demo:${parsed.claims.role}`,
    role: parsed.claims.role,
    tokenId: requiredString(parsed.claims.jti, "Demosessionen mangler token-ID."),
    expiresAt: parsed.claims.exp ?? 0,
    demo: true,
  };
}

async function verifySupabaseJwt(
  token: string,
  header: JwtHeader,
  claims: JwtClaims,
  env: AuthEnvironment,
  nowEpochSeconds: number,
): Promise<void> {
  const issuer = env.AUTH_ISSUER?.trim();
  const audience = env.AUTH_AUDIENCE?.trim();
  const jwksUrl = env.SUPABASE_JWKS_URL?.trim();
  if (!issuer || !audience || !jwksUrl) {
    throw new AuthenticationError(
      "auth_not_configured",
      "Supabase issuer, audience og JWKS URL skal konfigureres server-side.",
      503,
    );
  }
  if (!header.kid || (header.alg !== "RS256" && header.alg !== "ES256")) {
    throw new AuthenticationError("invalid_session", "JWT-algoritmen er ikke tilladt.");
  }
  const keys = await loadJwks(jwksUrl);
  const jwk = keys.find(
    (candidate) =>
      candidate.kid === header.kid &&
      (!candidate.alg || candidate.alg === header.alg) &&
      (!candidate.use || candidate.use === "sig"),
  );
  if (!jwk)
    throw new AuthenticationError("invalid_session", "JWT-signaturnøglen blev ikke fundet.");
  const algorithm =
    header.alg === "RS256"
      ? ({ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const)
      : ({ name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const);
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
  const parsed = parseJwt(token);
  const valid = await crypto.subtle.verify(
    algorithm,
    key,
    ownedArrayBuffer(base64UrlDecode(parsed.signature)),
    new TextEncoder().encode(parsed.signingInput),
  );
  if (!valid) throw new AuthenticationError("invalid_session", "JWT-signaturen er ugyldig.");
  validateTemporalClaims(claims, nowEpochSeconds);
  if (claims.iss !== issuer || !audienceIncludes(claims.aud, audience)) {
    throw new AuthenticationError("invalid_session", "JWT issuer eller audience er ugyldig.");
  }
  requiredString(claims.sub, "JWT mangler bruger-ID.");
}

async function loadJwks(url: string): Promise<JsonWebKeyWithKid[]> {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) {
    throw new AuthenticationError(
      "auth_unavailable",
      "JWKS kunne ikke hentes fra den konfigurerede identitetsudbyder.",
      503,
    );
  }
  const body = (await response.json()) as JsonWebKeySet;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) {
    throw new AuthenticationError("auth_unavailable", "JWKS indeholder ingen signaturnøgler.", 503);
  }
  jwksCache.set(url, { expiresAt: Date.now() + JWKS_CACHE_TTL_MS, keys });
  return keys;
}

function validateTemporalClaims(claims: JwtClaims, nowEpochSeconds: number): void {
  if (!Number.isInteger(claims.exp) || (claims.exp ?? 0) <= nowEpochSeconds) {
    throw new AuthenticationError("expired_session", "Sessionen er udløbet.");
  }
  if (claims.nbf !== undefined && claims.nbf > nowEpochSeconds + 30) {
    throw new AuthenticationError("invalid_session", "Sessionen er endnu ikke gyldig.");
  }
}

function parseJwt(token: string): {
  header: JwtHeader;
  claims: JwtClaims;
  signingInput: string;
  signature: string;
} {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new AuthenticationError("invalid_session", "Sessionstoken er ugyldigt.");
  }
  try {
    return {
      header: JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as JwtHeader,
      claims: JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as JwtClaims,
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: parts[2],
    };
  } catch {
    throw new AuthenticationError("invalid_session", "Sessionstoken kunne ikke læses.");
  }
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  return match?.[1] ?? "";
}

function audienceIncludes(value: string | string[] | undefined, expected: string): boolean {
  return typeof value === "string"
    ? value === expected
    : Array.isArray(value) && value.includes(expected);
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthenticationError("invalid_session", message);
  }
  return value;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signHmac(signingInput: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyHmac(
  signingInput: string,
  encodedSignature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    ownedArrayBuffer(base64UrlDecode(encodedSignature)),
    new TextEncoder().encode(signingInput),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
