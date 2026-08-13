import { strict as assert } from "node:assert";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  server: { hmr: false, middlewareMode: true },
});

const auth = await server.ssrLoadModule("/workers/shared/auth.ts");
const now = 1_785_062_400;
const secret = "test-only-demo-secret-that-is-longer-than-32-bytes";
const productionIssuer = "https://auth.example.test";
const productionAudience = "authenticated";
const productionJwksUrl = "https://auth.example.test/.well-known/jwks.json";
const productionKeys = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const productionJwk = {
  ...(await crypto.subtle.exportKey("jwk", productionKeys.publicKey)),
  kid: "test-rs256",
  alg: "RS256",
  use: "sig",
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  if (String(input) !== productionJwksUrl) {
    throw new Error(`Unexpected test fetch: ${String(input)}`);
  }
  return new Response(JSON.stringify({ keys: [productionJwk] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const unusedDatabase = {
  prepare() {
    throw new Error("Database must not be used by demo-token tests.");
  },
};

async function expectAuthError(promise, code, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

function productionDatabase({
  revoked = false,
  memberships = [
    {
      id: "membership-a",
      organization_id: "organization-a",
      identity_id: "identity-a",
      role: "vikar",
    },
  ],
} = {}) {
  return {
    prepare(query) {
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          assert.match(query, /FROM revoked_sessions/);
          assert.match(values[0], /^[a-f0-9]{64}$/);
          return revoked ? { session_token_hash: values[0] } : null;
        },
        async all() {
          assert.match(query, /FROM identities AS identity/);
          assert.equal(values[0], "provider-user-a");
          return { success: true, results: memberships };
        },
      };
    },
  };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function productionToken(claimPatch = {}, headerPatch = {}) {
  const header = { alg: "RS256", typ: "JWT", kid: "test-rs256", ...headerPatch };
  const claims = {
    sub: "provider-user-a",
    iss: productionIssuer,
    aud: productionAudience,
    iat: now,
    nbf: now,
    exp: now + 600,
    jti: "production-session-a",
    ...claimPatch,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    productionKeys.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function productionRequest(token) {
  return new Request("https://example.test/api", {
    headers: { authorization: `Bearer ${token}` },
  });
}

const productionEnvironment = {
  AUTH_ISSUER: productionIssuer,
  AUTH_AUDIENCE: productionAudience,
  SUPABASE_JWKS_URL: productionJwksUrl,
};

const tests = [
  {
    id: "missing-session",
    async run() {
      await expectAuthError(
        auth.authenticateRequest(new Request("https://example.test/api"), {}, unusedDatabase, now),
        "missing_session",
        401,
      );
    },
  },
  {
    id: "server-issued-demo-session",
    async run() {
      const issued = await auth.issueDemoSession(secret, "vikar", now);
      const request = new Request("https://example.test/api", {
        headers: { authorization: `Bearer ${issued.token}` },
      });
      const session = await auth.authenticateRequest(
        request,
        { DEMO_SESSION_SECRET: secret },
        unusedDatabase,
        now + 1,
      );
      assert.equal(session.demo, true);
      assert.equal(session.organizationId, "demo");
      assert.equal(session.role, "vikar");
    },
  },
  {
    id: "tampered-demo-session",
    async run() {
      const issued = await auth.issueDemoSession(secret, "kontaktperson", now);
      const parts = issued.token.split(".");
      parts[1] = `${parts[1].slice(0, -1)}${parts[1].endsWith("a") ? "b" : "a"}`;
      const request = new Request("https://example.test/api", {
        headers: { authorization: `Bearer ${parts.join(".")}` },
      });
      await expectAuthError(
        auth.authenticateRequest(request, { DEMO_SESSION_SECRET: secret }, unusedDatabase, now + 1),
        "invalid_session",
        401,
      );
    },
  },
  {
    id: "expired-demo-session",
    async run() {
      const issued = await auth.issueDemoSession(secret, "konsulent", now, 60);
      const request = new Request("https://example.test/api", {
        headers: { authorization: `Bearer ${issued.token}` },
      });
      await expectAuthError(
        auth.authenticateRequest(
          request,
          { DEMO_SESSION_SECRET: secret },
          unusedDatabase,
          now + 61,
        ),
        "expired_session",
        401,
      );
    },
  },
  {
    id: "platform-admin-demo-rejected",
    async run() {
      await expectAuthError(
        auth.issueDemoSession(secret, "platformsadministrator", now),
        "invalid_demo_role",
        400,
      );
    },
  },
  {
    id: "role-enforcement",
    async run() {
      const issued = await auth.issueDemoSession(secret, "vikar", now);
      assert.throws(
        () => auth.requireRole(issued.session, ["organisationsadministrator"]),
        (error) => error.code === "forbidden" && error.status === 403,
      );
    },
  },
  {
    id: "opaque-token-hash",
    async run() {
      const first = await auth.hashOpaqueToken("one-time-token");
      const second = await auth.hashOpaqueToken("one-time-token");
      const changed = await auth.hashOpaqueToken("other-token");
      assert.match(first, /^[a-f0-9]{64}$/);
      assert.equal(first, second);
      assert.notEqual(first, changed);
    },
  },
  {
    id: "production-jwt-uses-server-membership",
    async run() {
      const token = await productionToken({
        role: "organisationsadministrator",
        organization_id: "organization-a",
      });
      const session = await auth.authenticateRequest(
        productionRequest(token),
        productionEnvironment,
        productionDatabase(),
        now + 1,
      );
      assert.equal(session.userId, "identity-a");
      assert.equal(session.organizationId, "organization-a");
      assert.equal(session.membershipId, "membership-a");
      assert.equal(session.role, "vikar");
      assert.equal(session.demo, false);
    },
  },
  {
    id: "production-revoked-session",
    async run() {
      const token = await productionToken();
      await expectAuthError(
        auth.authenticateRequest(
          productionRequest(token),
          productionEnvironment,
          productionDatabase({ revoked: true }),
          now + 1,
        ),
        "revoked_session",
        401,
      );
    },
  },
  {
    id: "production-ambiguous-membership-blocked",
    async run() {
      const token = await productionToken();
      await expectAuthError(
        auth.authenticateRequest(
          productionRequest(token),
          productionEnvironment,
          productionDatabase({
            memberships: [
              {
                id: "membership-a",
                organization_id: "organization-a",
                identity_id: "identity-a",
                role: "vikar",
              },
              {
                id: "membership-b",
                organization_id: "organization-b",
                identity_id: "identity-a",
                role: "kontaktperson",
              },
            ],
          }),
          now + 1,
        ),
        "membership_required",
        403,
      );
    },
  },
  {
    id: "production-unrelated-organization-claim-blocked",
    async run() {
      const token = await productionToken({ organization_id: "organization-b" });
      await expectAuthError(
        auth.authenticateRequest(
          productionRequest(token),
          productionEnvironment,
          productionDatabase(),
          now + 1,
        ),
        "membership_required",
        403,
      );
    },
  },
  {
    id: "production-wrong-audience-blocked",
    async run() {
      const token = await productionToken({ aud: "other-audience" });
      await expectAuthError(
        auth.authenticateRequest(
          productionRequest(token),
          productionEnvironment,
          productionDatabase(),
          now + 1,
        ),
        "invalid_session",
        401,
      );
    },
  },
];

let failed = 0;
try {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.id}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${test.id}`);
      console.error(error);
    }
  }
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}

if (failed > 0) process.exitCode = 1;
else console.log(`Worker auth tests passed: ${tests.length}/${tests.length}.`);
