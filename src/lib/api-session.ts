export type ApiMembershipRole =
  | "vikar"
  | "kontaktperson"
  | "konsulent"
  | "organisationsadministrator"
  | "platformsadministrator";

export type ApiSession = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: ApiMembershipRole;
  expiresAt: number;
  demo: boolean;
  workerIdentity?: {
    name: string;
    email: string;
  };
};

export type ApiAgreementSource = {
  id: string;
  sourceType: string;
  documentTitle: string;
  officialUrl: string;
  verificationStatus: string;
};

export type ApiAgreementVersion = {
  id: string;
  versionLabel: string;
  validFrom: string;
  validTo: string | null;
  implementationStatus: string;
  verificationStatus: string;
  approvedOverrideCount: number;
  sources: ApiAgreementSource[];
};

export type ApiAgreementCatalogEntry = {
  id: string;
  catalogKey: string;
  exactTitle: string;
  agreementParties: string;
  employerOrganization: string;
  coveredWorkAreas: string;
  employeeCategory: string;
  geographyScope: string;
  catalogStatus: string;
  versions: ApiAgreementVersion[];
};

export type ApiCalculationSnapshot = {
  source: "d1";
  calculationId: string;
  status: "completed" | "manual_review_required" | "source_conflict" | "failed";
  exportBlocked: boolean;
  manualReviewReasons: string[];
  resultHash: string;
  grossPayOre: number;
  invoiceTotalOre: number | null;
};

type ApiConfig = {
  timesheetApiUrl: string;
};

type SessionEnvelope = {
  ok?: unknown;
  token?: unknown;
  session?: unknown;
  error?: {
    code?: unknown;
  };
};

const LEGACY_BROWSER_CREDENTIAL_KEYS = [
  "timeseddel.demo-session-token",
  "timeseddel.session-token",
  "timesheet-api-token",
] as const;
const ALLOWED_ROLES = new Set<ApiMembershipRole>([
  "vikar",
  "kontaktperson",
  "konsulent",
  "organisationsadministrator",
  "platformsadministrator",
]);

let apiConfigPromise: Promise<ApiConfig> | undefined;
let inMemoryBearerToken: string | null = null;
let inMemoryVerifiedSession: ApiSession | null = null;

export class SessionApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SessionApiError";
    this.code = code;
  }
}

export async function getVerifiedSession(): Promise<ApiSession> {
  const session = await requestVerifiedSession(inMemoryBearerToken);
  inMemoryVerifiedSession = session;
  return session;
}

export async function listVerifiedAgreementCatalog(): Promise<ApiAgreementCatalogEntry[]> {
  const apiUrl = await getApiUrl();
  const token = inMemoryBearerToken;
  const response = await safeFetch(`${apiUrl}/api/agreements`, {
    method: "GET",
    credentials: token ? "omit" : "include",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw responseError(response.status, isRecord(payload) ? (payload as SessionEnvelope) : {});
  }
  if (!isRecord(payload) || !Array.isArray(payload.agreements)) {
    throw new SessionApiError(
      "invalid_catalog_response",
      "Overenskomstkataloget kunne ikke verificeres.",
    );
  }
  return payload.agreements.map(parseAgreementCatalogEntry);
}

export async function getLatestCalculationSnapshot(
  timesheetId: string,
): Promise<ApiCalculationSnapshot | null> {
  const apiUrl = await getApiUrl();
  const token = inMemoryBearerToken;
  const response = await safeFetch(
    `${apiUrl}/api/timesheets/${encodeURIComponent(timesheetId)}/calculations/latest`,
    {
      method: "GET",
      credentials: token ? "omit" : "include",
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw responseError(response.status, isRecord(payload) ? (payload as SessionEnvelope) : {});
  }
  if (!isRecord(payload) || payload.source !== "d1") {
    throw new SessionApiError(
      "invalid_calculation_snapshot",
      "Beregningssnapshottet kunne ikke verificeres.",
    );
  }
  return parseCalculationSnapshot(payload.snapshot);
}

export function verifiedSnapshotAmountDkk(
  snapshot: ApiCalculationSnapshot | null,
  amount: "grossPayOre" | "invoiceTotalOre",
): number | null {
  if (
    !snapshot ||
    snapshot.source !== "d1" ||
    snapshot.status !== "completed" ||
    snapshot.exportBlocked ||
    snapshot.manualReviewReasons.length > 0 ||
    !/^[a-f0-9]{64}$/iu.test(snapshot.resultHash)
  ) {
    return null;
  }
  const ore = snapshot[amount];
  return typeof ore === "number" && Number.isSafeInteger(ore) && ore >= 0 ? ore / 100 : null;
}

export async function createVerifiedDemoSession(
  role: Exclude<ApiMembershipRole, "platformsadministrator">,
  accessCode: string,
): Promise<ApiSession> {
  const apiUrl = await getApiUrl();
  const response = await safeFetch(`${apiUrl}/api/demo/session`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ role, accessCode }),
  });
  const payload = await readEnvelope(response);

  if (!response.ok) {
    throw responseError(response.status, payload);
  }
  if (typeof payload.token !== "string" || !payload.token || payload.token.length > 8192) {
    throw new SessionApiError(
      "invalid_demo_session",
      "Demosessionen kunne ikke verificeres sikkert.",
    );
  }

  const issuedSession = parseSession(payload.session);
  if (
    !issuedSession.demo ||
    issuedSession.organizationId !== "demo" ||
    issuedSession.role !== role
  ) {
    throw new SessionApiError(
      "invalid_demo_session",
      "Demosessionen kunne ikke verificeres sikkert.",
    );
  }

  inMemoryBearerToken = payload.token;
  try {
    const verifiedSession = await requestVerifiedSession(payload.token);
    if (
      !verifiedSession.demo ||
      verifiedSession.organizationId !== "demo" ||
      verifiedSession.role !== role
    ) {
      throw new SessionApiError(
        "invalid_demo_session",
        "Demosessionen kunne ikke verificeres sikkert.",
      );
    }
    inMemoryVerifiedSession = verifiedSession;
    return verifiedSession;
  } catch (error) {
    clearSessionCredential();
    throw error;
  }
}

export function clearSessionCredential(): void {
  inMemoryBearerToken = null;
  inMemoryVerifiedSession = null;
  clearLegacyBrowserCredentials();
}

export type MailSessionAvailability = {
  available: boolean;
  reason: string;
};

export function getMailSessionAvailability(): MailSessionAvailability {
  if (!inMemoryBearerToken || !inMemoryVerifiedSession) {
    return {
      available: false,
      reason:
        "Mail er blokeret, indtil produktionslogin leverer en serververificerbar bearer-session.",
    };
  }
  if (inMemoryVerifiedSession.demo || inMemoryVerifiedSession.organizationId === "demo") {
    return {
      available: false,
      reason: "Demoorganisationen må ikke sende rigtige mails.",
    };
  }
  if (inMemoryVerifiedSession.expiresAt <= Math.floor(Date.now() / 1000)) {
    return {
      available: false,
      reason: "Mail er blokeret, fordi den verificerede session er udløbet.",
    };
  }
  return {
    available: false,
    reason: "Mail er blokeret, fordi sikker modtagerbestemmelse ikke er konfigureret.",
  };
}

export async function requireVerifiedMailBearer(): Promise<{
  accessToken: string;
  session: ApiSession;
}> {
  const availability = getMailSessionAvailability();
  if (!availability.available || !inMemoryBearerToken) {
    throw new SessionApiError("mail_session_blocked", availability.reason);
  }
  const session = await requestVerifiedSession(inMemoryBearerToken);
  if (session.demo || session.organizationId === "demo") {
    clearSessionCredential();
    throw new SessionApiError(
      "demo_mail_blocked",
      "Demoorganisationen må ikke sende rigtige mails.",
    );
  }
  inMemoryVerifiedSession = session;
  return { accessToken: inMemoryBearerToken, session };
}

export function safeSessionErrorMessage(error: unknown): string {
  if (error instanceof SessionApiError) return error.message;
  return "Login kunne ikke gennemføres sikkert. Prøv igen senere.";
}

async function requestVerifiedSession(token: string | null): Promise<ApiSession> {
  const apiUrl = await getApiUrl();
  const response = await safeFetch(`${apiUrl}/api/session`, {
    method: "GET",
    credentials: token ? "omit" : "include",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await readEnvelope(response);

  if (!response.ok) {
    throw responseError(response.status, payload);
  }
  return parseSession(payload.session);
}

async function getApiUrl(): Promise<string> {
  apiConfigPromise ??= loadApiConfig();
  try {
    return (await apiConfigPromise).timesheetApiUrl;
  } catch (error) {
    apiConfigPromise = undefined;
    throw error;
  }
}

async function loadApiConfig(): Promise<ApiConfig> {
  const basePath = import.meta.env.BASE_URL || "/";
  const response = await safeFetch(`${basePath}timesheet-api-config.json`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new SessionApiError("auth_not_configured", "Login-tjenesten er ikke konfigureret.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SessionApiError("auth_not_configured", "Login-tjenesten er ikke konfigureret.");
  }

  const timesheetApiUrl =
    isRecord(payload) && typeof payload.timesheetApiUrl === "string"
      ? payload.timesheetApiUrl.trim()
      : "";
  if (!timesheetApiUrl) {
    throw new SessionApiError("auth_not_configured", "Login-tjenesten er ikke konfigureret.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(timesheetApiUrl);
  } catch {
    throw new SessionApiError("auth_not_configured", "Login-tjenesten er ikke konfigureret.");
  }
  const localDevelopment =
    parsedUrl.protocol === "http:" &&
    (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1");
  if (parsedUrl.protocol !== "https:" && !localDevelopment) {
    throw new SessionApiError(
      "auth_not_configured",
      "Login-tjenesten er ikke konfigureret sikkert.",
    );
  }

  return { timesheetApiUrl: parsedUrl.href.replace(/\/$/, "") };
}

async function safeFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new SessionApiError(
      "auth_unavailable",
      "Login-tjenesten kunne ikke kontaktes. Prøv igen senere.",
    );
  }
}

async function readEnvelope(response: Response): Promise<SessionEnvelope> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? (payload as SessionEnvelope) : {};
  } catch {
    return {};
  }
}

function responseError(status: number, payload: SessionEnvelope): SessionApiError {
  const code =
    isRecord(payload.error) && typeof payload.error.code === "string"
      ? payload.error.code
      : "session_rejected";

  if (code === "auth_not_configured" || code === "demo_not_configured" || status === 503) {
    return new SessionApiError(code, "Login-tjenesten er ikke konfigureret.");
  }
  if (code === "invalid_demo_access_code") {
    return new SessionApiError(code, "Koden er forkert.");
  }
  if (status === 401 || status === 403) {
    return new SessionApiError(code, "Sessionen kunne ikke verificeres.");
  }
  return new SessionApiError(code, "Login kunne ikke gennemføres sikkert.");
}

function parseSession(value: unknown): ApiSession {
  if (!isRecord(value)) {
    throw new SessionApiError("invalid_session", "Sessionen kunne ikke verificeres.");
  }

  const role = value.role;
  const workerIdentity = parseWorkerIdentity(value.workerIdentity);
  if (
    typeof value.userId !== "string" ||
    !value.userId ||
    typeof value.organizationId !== "string" ||
    !value.organizationId ||
    typeof value.membershipId !== "string" ||
    !value.membershipId ||
    typeof role !== "string" ||
    !ALLOWED_ROLES.has(role as ApiMembershipRole) ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt) ||
    typeof value.demo !== "boolean"
  ) {
    throw new SessionApiError("invalid_session", "Sessionen kunne ikke verificeres.");
  }

  return {
    userId: value.userId,
    organizationId: value.organizationId,
    membershipId: value.membershipId,
    role: role as ApiMembershipRole,
    expiresAt: value.expiresAt,
    demo: value.demo,
    ...(workerIdentity ? { workerIdentity } : {}),
  };
}

function parseWorkerIdentity(value: unknown): ApiSession["workerIdentity"] {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.email !== "string") {
    return undefined;
  }
  return { name: value.name, email: value.email };
}

function parseAgreementCatalogEntry(value: unknown): ApiAgreementCatalogEntry {
  if (!isRecord(value) || !Array.isArray(value.versions)) {
    throw new SessionApiError(
      "invalid_catalog_response",
      "Overenskomstkataloget kunne ikke verificeres.",
    );
  }
  return {
    id: requiredCatalogString(value.id),
    catalogKey: requiredCatalogString(value.catalogKey),
    exactTitle: requiredCatalogString(value.exactTitle),
    agreementParties: requiredCatalogString(value.agreementParties),
    employerOrganization: optionalCatalogString(value.employerOrganization),
    coveredWorkAreas: requiredCatalogString(value.coveredWorkAreas),
    employeeCategory: requiredCatalogString(value.employeeCategory),
    geographyScope: requiredCatalogString(value.geographyScope),
    catalogStatus: requiredCatalogString(value.catalogStatus),
    versions: value.versions.map(parseAgreementVersion),
  };
}

function parseCalculationSnapshot(value: unknown): ApiCalculationSnapshot {
  if (
    !isRecord(value) ||
    value.source !== "d1" ||
    typeof value.calculationId !== "string" ||
    !value.calculationId ||
    !["completed", "manual_review_required", "source_conflict", "failed"].includes(
      String(value.status),
    ) ||
    typeof value.exportBlocked !== "boolean" ||
    !Array.isArray(value.manualReviewReasons) ||
    !value.manualReviewReasons.every((reason) => typeof reason === "string") ||
    typeof value.resultHash !== "string" ||
    typeof value.grossPayOre !== "number" ||
    !Number.isSafeInteger(value.grossPayOre) ||
    value.grossPayOre < 0 ||
    !(
      value.invoiceTotalOre === null ||
      (typeof value.invoiceTotalOre === "number" &&
        Number.isSafeInteger(value.invoiceTotalOre) &&
        value.invoiceTotalOre >= 0)
    )
  ) {
    throw new SessionApiError(
      "invalid_calculation_snapshot",
      "Beregningssnapshottet kunne ikke verificeres.",
    );
  }
  return {
    source: "d1",
    calculationId: value.calculationId,
    status: value.status as ApiCalculationSnapshot["status"],
    exportBlocked: value.exportBlocked,
    manualReviewReasons: value.manualReviewReasons as string[],
    resultHash: value.resultHash,
    grossPayOre: value.grossPayOre,
    invoiceTotalOre: value.invoiceTotalOre as number | null,
  };
}

function parseAgreementVersion(value: unknown): ApiAgreementVersion {
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    throw new SessionApiError(
      "invalid_catalog_response",
      "Overenskomstkataloget kunne ikke verificeres.",
    );
  }
  return {
    id: requiredCatalogString(value.id),
    versionLabel: requiredCatalogString(value.versionLabel),
    validFrom: requiredCatalogString(value.validFrom),
    validTo: value.validTo === null ? null : requiredCatalogString(value.validTo),
    implementationStatus: requiredCatalogString(value.implementationStatus),
    verificationStatus: requiredCatalogString(value.verificationStatus),
    approvedOverrideCount:
      typeof value.approvedOverrideCount === "number" &&
      Number.isSafeInteger(value.approvedOverrideCount) &&
      value.approvedOverrideCount >= 0
        ? value.approvedOverrideCount
        : 0,
    sources: value.sources.map(parseAgreementSource),
  };
}

function parseAgreementSource(value: unknown): ApiAgreementSource {
  if (!isRecord(value)) {
    throw new SessionApiError(
      "invalid_catalog_response",
      "Overenskomstkataloget kunne ikke verificeres.",
    );
  }
  return {
    id: requiredCatalogString(value.id),
    sourceType: requiredCatalogString(value.sourceType),
    documentTitle: requiredCatalogString(value.documentTitle),
    officialUrl: requiredCatalogString(value.officialUrl),
    verificationStatus: requiredCatalogString(value.verificationStatus),
  };
}

function requiredCatalogString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SessionApiError(
      "invalid_catalog_response",
      "Overenskomstkataloget kunne ikke verificeres.",
    );
  }
  return value;
}

function optionalCatalogString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clearLegacyBrowserCredentials(): void {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of LEGACY_BROWSER_CREDENTIAL_KEYS) storage.removeItem(key);
    } catch {
      // Credential cleanup is best-effort; no value is copied or logged.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

clearLegacyBrowserCredentials();
