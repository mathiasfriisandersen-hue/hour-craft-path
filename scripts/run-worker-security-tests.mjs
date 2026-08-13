import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  server: { hmr: false, middlewareMode: true },
});

const auth = await server.ssrLoadModule("/workers/shared/auth.ts");
const timesheetWorker = await server.ssrLoadModule("/timesheet-worker/src/index.ts");
const mailWorker = await server.ssrLoadModule("/mail-worker/src/index.ts");

const allowedOrigin = "https://app.example.test";
const demoSecret = "test-only-demo-secret-that-is-longer-than-32-bytes";
const demoAccessCode = "0000";
const now = Math.floor(Date.now() / 1000);
const issuer = "https://security-auth.example.test";
const audience = "authenticated";
const jwksUrl = "https://security-auth.example.test/.well-known/jwks.json";
const keys = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
  kid: "security-test-key",
  alg: "RS256",
  use: "sig",
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  if (String(input) !== jwksUrl) throw new Error(`Unexpected test fetch: ${String(input)}`);
  return new Response(JSON.stringify({ keys: [publicJwk] }), {
    headers: { "content-type": "application/json" },
  });
};

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function productionToken(claimPatch = {}) {
  const header = { alg: "RS256", typ: "JWT", kid: "security-test-key" };
  const claims = {
    sub: "provider-user-a",
    iss: issuer,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + 600,
    jti: "security-session-a",
    organization_id: "organization-a",
    ...claimPatch,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keys.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function securityDatabase({
  role = "vikar",
  consumeInvitation = false,
  timesheetFound = true,
  organizationFound = true,
  organizationIsDemo = false,
  outboundMailEnabled = true,
  snapshotFound = true,
  snapshotStatus = "completed",
  snapshotManualReviewReasons = [],
  snapshotResult = { exportBlocked: false, invoiceTotalOre: 67_890 },
} = {}) {
  let invitationConsumed = false;
  return {
    prepare(query) {
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          if (/FROM revoked_sessions/u.test(query)) {
            assert.match(values[0], /^[a-f0-9]{64}$/u);
            return null;
          }
          if (/FROM organizations/u.test(query)) {
            assert.equal(values[0], "organization-a");
            if (!organizationFound) return null;
            return {
              is_demo: organizationIsDemo ? 1 : 0,
              outbound_mail_enabled: outboundMailEnabled ? 1 : 0,
            };
          }
          if (/FROM invitation_tokens AS invitation/u.test(query)) {
            assert.equal(values[1], "organization-a");
            return {
              id: "invitation-a",
              organization_id: "organization-a",
              invitation_purpose: "worker",
              project_id: "project-a",
              role_key: role,
            };
          }
          if (/INNER JOIN calculation_snapshots AS snapshot/u.test(query)) {
            assert.equal(values[0], "timesheet-a");
            assert.equal(values[1], "organization-a");
            if (!snapshotFound) return null;
            return {
              calculation_id: "calculation-a",
              status: snapshotStatus,
              gross_pay_cents: 12_345,
              result_sha256: "a".repeat(64),
              result_snapshot_json: JSON.stringify(snapshotResult),
              manual_review_reasons_json: JSON.stringify(snapshotManualReviewReasons),
            };
          }
          if (/FROM timesheets/u.test(query)) {
            if (!timesheetFound) return null;
            assert.equal(values[1], "organization-a");
            return {
              id: "timesheet-a",
              organization_id: "organization-a",
              project_record_id: "project-a",
              worker_record_id: "worker-a",
              owner_membership_id: "membership-a",
              week_start: "2026-07-20",
              status: "sent",
            };
          }
          if (/FROM idempotency_keys/u.test(query)) {
            return { request_count: 0 };
          }
          if (/FROM workers/u.test(query)) {
            assert.equal(values[0], "worker-a");
            assert.equal(values[1], "organization-a");
            return {
              recipient_id: "worker-a",
              email_lookup_hmac: "a".repeat(64),
              email_ciphertext: "encrypted-placeholder",
              encryption_key_version: 1,
            };
          }
          throw new Error(`Unexpected first query: ${query}`);
        },
        async all() {
          if (/FROM identities AS identity/u.test(query)) {
            assert.equal(values[0], "provider-user-a");
            return {
              success: true,
              results: [
                {
                  id: "membership-a",
                  organization_id: "organization-a",
                  identity_id: "identity-a",
                  role,
                },
              ],
            };
          }
          throw new Error(`Unexpected all query: ${query}`);
        },
        async run() {
          if (/INSERT INTO audit_events/u.test(query)) {
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE invitation_tokens\s+SET consumed_at/u.test(query)) {
            const changes = consumeInvitation && !invitationConsumed ? 1 : 0;
            invitationConsumed = true;
            return { success: true, meta: { changes } };
          }
          throw new Error(`Unexpected run query: ${query}`);
        },
      };
    },
  };
}

const unusedDatabase = {
  prepare() {
    throw new Error("Isolated demo and rejected requests must not query D1.");
  },
  batch() {
    throw new Error("Isolated demo and rejected requests must not query D1.");
  },
};

async function body(response) {
  return response.json();
}

function request(path, init = {}) {
  return new Request(`https://worker.example.test${path}`, {
    ...init,
    headers: {
      origin: allowedOrigin,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  });
}

const tests = [
  {
    id: "cors-does-not-authenticate",
    async run() {
      const response = await timesheetWorker.default.fetch(request("/api/timesheets"), {
        TIMESHEET_DB: unusedDatabase,
        ALLOWED_ORIGIN: allowedOrigin,
        DEMO_SESSION_SECRET: demoSecret,
      });
      assert.equal(response.status, 401);
      assert.equal((await body(response)).error.code, "missing_session");
    },
  },
  {
    id: "disallowed-origin-has-no-cors-grant",
    async run() {
      const response = await timesheetWorker.default.fetch(
        new Request("https://worker.example.test/api/timesheets", {
          headers: { origin: "https://evil.example.test" },
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
        },
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    },
  },
  {
    id: "preflight-does-not-grant-evil-origin",
    async run() {
      const response = await timesheetWorker.default.fetch(
        new Request("https://worker.example.test/api/timesheets", {
          method: "OPTIONS",
          headers: { origin: "https://evil.example.test" },
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
        },
      );
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    },
  },
  {
    id: "demo-session-requires-server-access-code",
    async run() {
      const missingCode = await timesheetWorker.default.fetch(
        request("/api/demo/session", {
          method: "POST",
          body: JSON.stringify({ role: "vikar" }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
          DEMO_ACCESS_CODE: demoAccessCode,
        },
      );
      assert.equal(missingCode.status, 401);
      assert.equal((await body(missingCode)).error.code, "invalid_demo_access_code");

      const wrongCode = await timesheetWorker.default.fetch(
        request("/api/demo/session", {
          method: "POST",
          body: JSON.stringify({ role: "vikar", accessCode: "1234" }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
          DEMO_ACCESS_CODE: demoAccessCode,
        },
      );
      assert.equal(wrongCode.status, 401);
      assert.equal((await body(wrongCode)).error.code, "invalid_demo_access_code");

      const correctCode = await timesheetWorker.default.fetch(
        request("/api/demo/session", {
          method: "POST",
          body: JSON.stringify({ role: "vikar", accessCode: demoAccessCode }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
          DEMO_ACCESS_CODE: demoAccessCode,
        },
      );
      assert.equal(correctCode.status, 200);
      const correctBody = await body(correctCode);
      assert.equal(correctBody.session.role, "vikar");
      assert.equal(correctBody.session.demo, true);
      assert.equal(typeof correctBody.token, "string");
    },
  },
  {
    id: "demo-is-read-only-and-d1-isolated",
    async run() {
      const issued = await auth.issueDemoSession(demoSecret, "vikar", now);
      const headers = { authorization: `Bearer ${issued.token}` };
      const readResponse = await timesheetWorker.default.fetch(
        request("/api/timesheets", { headers }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
        },
      );
      assert.equal(readResponse.status, 200);
      const readBody = await body(readResponse);
      assert.equal(readBody.source, "synthetic-demo");
      assert.deepEqual(readBody.timesheets, []);

      const writeResponse = await timesheetWorker.default.fetch(
        request("/api/timesheets", {
          method: "POST",
          headers,
          body: JSON.stringify({ id: "attempted-write" }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
        },
      );
      assert.equal(writeResponse.status, 403);
      assert.equal((await body(writeResponse)).error.code, "demo_read_only");
    },
  },
  {
    id: "demo-cannot-use-mail-worker",
    async run() {
      const issued = await auth.issueDemoSession(demoSecret, "vikar", now);
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${issued.token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          DEMO_SESSION_SECRET: demoSecret,
        },
      );
      assert.equal(response.status, 403);
      assert.equal((await body(response)).error.code, "demo_mail_disabled");
    },
  },
  {
    id: "production-token-cannot-send-from-demo-organization",
    async run() {
      const token = await productionToken();
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: securityDatabase({
            organizationIsDemo: true,
            outboundMailEnabled: false,
          }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 403);
      assert.equal((await body(response)).error.code, "demo_mail_disabled");
    },
  },
  {
    id: "production-organization-with-disabled-outbound-mail-cannot-send",
    async run() {
      const token = await productionToken();
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: securityDatabase({ outboundMailEnabled: false }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 403);
      assert.equal((await body(response)).error.code, "organization_mail_disabled");
    },
  },
  {
    id: "mail-requires-bearer-session",
    async run() {
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
        },
      );
      assert.equal(response.status, 401);
      assert.equal((await body(response)).error.code, "missing_session");
    },
  },
  {
    id: "mail-rejects-invalid-bearer",
    async run() {
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: "Bearer invalid-token" },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: unusedDatabase,
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 401);
    },
  },
  {
    id: "mail-cannot-cross-organization-boundary",
    async run() {
      const token = await productionToken();
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-other-organization",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: securityDatabase({ timesheetFound: false }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 404);
      assert.equal((await body(response)).error.code, "timesheet_not_found");
    },
  },
  {
    id: "valid-authenticated-mail-fails-closed-without-recipient-resolver",
    async run() {
      const token = await productionToken();
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-key-a",
          }),
        }),
        {
          TIMESHEET_DB: securityDatabase(),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 503);
      assert.equal((await body(response)).error.code, "recipient_decryption_not_configured");
    },
  },
  {
    id: "arbitrary-mail-recipient-is-rejected",
    async run() {
      const token = await productionToken();
      const response = await mailWorker.default.fetch(
        request("/send-timesheet", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({
            template: "worker_submission_receipt",
            timesheetId: "timesheet-a",
            idempotencyKey: "idempotency-a",
            recipient: "attacker@example.test",
          }),
        }),
        {
          TIMESHEET_DB: securityDatabase(),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 400);
      assert.equal((await body(response)).error.code, "unexpected_fields");
    },
  },
  {
    id: "runtime-mail-flow-has-no-mailto-fallback-or-recipient-payload",
    async run() {
      const repositoryRoot = resolve(import.meta.dirname, "..");
      const frontendRoot = resolve(repositoryRoot, "src");
      const runtimeFiles = [
        ...sourceFiles(frontendRoot),
        ...sourceFiles(resolve(repositoryRoot, "mail-worker/src")),
        ...sourceFiles(resolve(repositoryRoot, "timesheet-worker/src")),
        resolve(repositoryRoot, "public/privacy-timesheet-gpt.html"),
        resolve(repositoryRoot, "public/privacy-timesheet-gpt/index.html"),
      ];
      const combinedSource = runtimeFiles.map((path) => readFileSync(path, "utf8")).join("\n");
      assert.doesNotMatch(combinedSource, /mailto:|mailtoUrl/iu);
      const mailSource = readFileSync(join(frontendRoot, "lib", "timesheet-mail.ts"), "utf8");
      assert.doesNotMatch(mailSource, /\brecipient\s*:/iu);
      assert.match(mailSource, /requireVerifiedMailBearer/u);
    },
  },
  {
    id: "latest-calculation-snapshot-is-server-scoped-and-verified",
    async run() {
      const token = await productionToken();
      const response = await timesheetWorker.default.fetch(
        request("/api/timesheets/timesheet-a/calculations/latest", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {
          TIMESHEET_DB: securityDatabase({ role: "konsulent" }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 200);
      const payload = await body(response);
      assert.equal(payload.source, "d1");
      assert.deepEqual(payload.snapshot, {
        source: "d1",
        calculationId: "calculation-a",
        status: "completed",
        exportBlocked: false,
        manualReviewReasons: [],
        resultHash: "a".repeat(64),
        grossPayOre: 12_345,
        invoiceTotalOre: 67_890,
      });
    },
  },
  {
    id: "latest-calculation-snapshot-blocks-manual-review",
    async run() {
      const token = await productionToken();
      const response = await timesheetWorker.default.fetch(
        request("/api/timesheets/timesheet-a/calculations/latest", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {
          TIMESHEET_DB: securityDatabase({
            role: "konsulent",
            snapshotStatus: "manual_review_required",
            snapshotManualReviewReasons: ["Kræver manuel validering"],
          }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 200);
      const payload = await body(response);
      assert.equal(payload.snapshot.status, "manual_review_required");
      assert.equal(payload.snapshot.exportBlocked, true);
      assert.deepEqual(payload.snapshot.manualReviewReasons, ["Kræver manuel validering"]);
    },
  },
  {
    id: "latest-calculation-snapshot-cannot-cross-organization-boundary",
    async run() {
      const token = await productionToken();
      const response = await timesheetWorker.default.fetch(
        request("/api/timesheets/timesheet-a/calculations/latest", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {
          TIMESHEET_DB: securityDatabase({ role: "konsulent", snapshotFound: false }),
          ALLOWED_ORIGIN: allowedOrigin,
          AUTH_ISSUER: issuer,
          AUTH_AUDIENCE: audience,
          SUPABASE_JWKS_URL: jwksUrl,
        },
      );
      assert.equal(response.status, 404);
      assert.equal((await body(response)).error.code, "calculation_snapshot_not_found");
    },
  },
  {
    id: "invitation-token-is-one-time",
    async run() {
      const token = await productionToken();
      const database = securityDatabase({ consumeInvitation: true });
      const invitationToken = "a".repeat(43);
      const environment = {
        TIMESHEET_DB: database,
        ALLOWED_ORIGIN: allowedOrigin,
        AUTH_ISSUER: issuer,
        AUTH_AUDIENCE: audience,
        SUPABASE_JWKS_URL: jwksUrl,
      };
      const redeem = () =>
        mailWorker.default.fetch(
          request("/worker-invite", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            body: JSON.stringify({ token: invitationToken }),
          }),
          environment,
        );

      const first = await redeem();
      assert.equal(first.status, 200);
      assert.equal((await body(first)).ok, true);
      const second = await redeem();
      assert.equal(second.status, 410);
      assert.equal((await body(second)).error.code, "invitation_already_consumed");
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
else console.log(`Worker security tests passed: ${tests.length}/${tests.length}.`);
