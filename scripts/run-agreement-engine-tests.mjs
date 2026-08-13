import { strict as assert } from "node:assert";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  server: { hmr: false, middlewareMode: true },
});

const engine = await server.ssrLoadModule("/shared/agreement-engine.ts");
const serverCalculation = await server.ssrLoadModule("/workers/shared/agreement-calculation.ts");

const SOURCE = {
  sourceId: "synthetic-golden-source",
  title: "Syntetisk testkilde - ikke en juridisk sats",
  officialUrl: "https://example.test/official-fixture",
  paragraph: "Testafsnit 1",
  page: "1",
  sha256: "a".repeat(64),
};

const VERSION = {
  id: "agreement-version-test-2026",
  agreementId: "agreement-test",
  title: "Syntetisk testoverenskomst",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  verificationStatus: "verified_and_active",
  rulesetComplete: true,
};

function baseInput(patch = {}) {
  return {
    calculationId: "calc-test",
    asOf: "2026-07-26T10:00:00+02:00",
    timeZone: "Europe/Copenhagen",
    agreementVersion: VERSION,
    employment: {
      employmentId: "employment-test",
      baseRateOrePerHour: 20_000,
      sourceLabel: "Syntetisk ansættelsesvilkår",
      sourceReference: "Fixture 1",
    },
    shifts: [],
    rules: [],
    overrides: [],
    ...patch,
  };
}

function rule(id, patch = {}) {
  return {
    id,
    schemaVersion: 1,
    agreementVersionId: VERSION.id,
    type: "allowance",
    validFrom: VERSION.validFrom,
    validTo: VERSION.validTo,
    conditions: {},
    rate: { kind: "ore_per_hour", value: 1_000 },
    priority: 1,
    professionalScope: "synthetic",
    geographicScope: "DK",
    source: SOURCE,
    verificationStatus: "verified_and_active",
    explanation: "Syntetisk testregel.",
    ...patch,
  };
}

async function calculate(patch) {
  return engine.calculateAgreementSnapshot(baseInput(patch));
}

function persistenceBoundaryDatabase(storedTimesheet) {
  let batchCalls = 0;
  return {
    database: {
      prepare(query) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (/FROM timesheets AS timesheet/u.test(query)) {
              return {
                id: "timesheet-persistence-test",
                data: JSON.stringify(storedTimesheet),
                row_version: 1,
                calculation_revision: 0,
                worker_record_id: "worker-test",
                employment_term_id: "employment-test",
                agreement_assignment_id: "assignment-test",
                base_hourly_rate_cents: 20_000,
                employment_source_reference: "Syntetisk fixture",
                employment_source_sha256: "b".repeat(64),
                agreement_version_id: VERSION.id,
                agreement_id: VERSION.agreementId,
                agreement_title: VERSION.title,
                version_valid_from: VERSION.validFrom,
                version_valid_to: VERSION.validTo,
                implementation_status: "implemented",
                version_verification_status: "verified_and_active",
                assignment_status: "active",
              };
            }
            throw new Error(`Unexpected first query: ${query}`);
          },
          async all() {
            if (
              /FROM agreement_rules AS rule/u.test(query) ||
              /FROM local_overrides/u.test(query)
            ) {
              return { success: true, results: [] };
            }
            throw new Error(`Unexpected all query: ${query}`);
          },
          async run() {
            throw new Error(`Persistence must not run for hard-blocked input: ${query}`);
          },
        };
      },
      async batch() {
        batchCalls += 1;
        throw new Error("Persistence batch must not run for hard-blocked input.");
      },
    },
    batchCalls: () => batchCalls,
  };
}

const tests = [
  {
    id: "whole-minute-base-and-rounding",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T08:01+02:00" }],
      });
      assert.equal(result.totalWorkedMinutes, 1);
      assert.equal(result.basePayOre, 333);
      assert.equal(result.exportBlocked, false);
    },
  },
  {
    id: "shift-over-midnight",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T23:00+02:00", end: "2026-07-21T02:00+02:00" }],
        rules: [
          rule("night", {
            conditions: { localStartMinute: 0, localEndMinute: 6 * 60 },
          }),
        ],
      });
      assert.equal(result.totalWorkedMinutes, 180);
      assert.equal(result.lines.find((line) => line.ruleId === "night")?.minutes, 120);
    },
  },
  {
    id: "evening-to-night-split",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T20:00+02:00", end: "2026-07-21T02:00+02:00" }],
        rules: [
          rule("evening", {
            conditions: { localStartMinute: 18 * 60, localEndMinute: 23 * 60 },
          }),
          rule("night", {
            conditions: { localStartMinute: 23 * 60, localEndMinute: 6 * 60 },
          }),
        ],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "evening")?.minutes, 180);
      assert.equal(result.lines.find((line) => line.ruleId === "night")?.minutes, 180);
    },
  },
  {
    id: "friday-to-saturday",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-24T22:00+02:00", end: "2026-07-25T02:00+02:00" }],
        rules: [rule("saturday", { conditions: { weekdays: [6] } })],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "saturday")?.minutes, 120);
    },
  },
  {
    id: "saturday-to-sunday",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-25T22:00+02:00", end: "2026-07-26T02:00+02:00" }],
        rules: [rule("sunday", { conditions: { weekdays: [7] } })],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "sunday")?.minutes, 120);
    },
  },
  {
    id: "public-holiday",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-12-25T08:00+01:00", end: "2026-12-25T10:00+01:00" }],
        rules: [rule("holiday", { conditions: { publicHoliday: true } })],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "holiday")?.minutes, 120);
    },
  },
  {
    id: "spring-dst",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-03-29T00:00+01:00", end: "2026-03-29T04:00+02:00" }],
      });
      assert.equal(result.totalWorkedMinutes, 180);
    },
  },
  {
    id: "autumn-dst",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-10-25T00:00+02:00", end: "2026-10-25T04:00+01:00" }],
      });
      assert.equal(result.totalWorkedMinutes, 300);
    },
  },
  {
    id: "daily-overtime-boundary",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T18:00+02:00" }],
        rules: [
          rule("daily-overtime", { type: "overtime", conditions: { afterDailyMinutes: 8 * 60 } }),
        ],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "daily-overtime")?.minutes, 120);
    },
  },
  {
    id: "weekly-overtime-boundary",
    async run() {
      const shifts = Array.from({ length: 5 }, (_, index) => {
        const day = String(20 + index).padStart(2, "0");
        return {
          id: `s${index}`,
          start: `2026-07-${day}T08:00+02:00`,
          end: `2026-07-${day}T16:00+02:00`,
        };
      });
      const result = await calculate({
        shifts,
        rules: [
          rule("weekly-overtime", {
            type: "overtime",
            conditions: { afterWeeklyMinutes: 37 * 60 },
          }),
        ],
      });
      assert.equal(result.lines.find((line) => line.ruleId === "weekly-overtime")?.minutes, 180);
    },
  },
  {
    id: "break-subtraction",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "s1",
            start: "2026-07-20T08:00+02:00",
            end: "2026-07-20T16:00+02:00",
            breaks: [{ start: "2026-07-20T12:00+02:00", end: "2026-07-20T12:30+02:00" }],
          },
        ],
      });
      assert.equal(result.totalWorkedMinutes, 450);
    },
  },
  {
    id: "approved-local-replacement",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" }],
        rules: [rule("allowance")],
        overrides: [
          {
            id: "override-1",
            version: 1,
            baseRuleId: "allowance",
            scopeKey: "project:test",
            validFrom: "2026-07-01",
            validTo: "2026-07-31",
            changeType: "replace",
            rate: { kind: "ore_per_hour", value: 2_000 },
            status: "approved",
            documentation: SOURCE,
            approvedBy: "test-approver",
          },
        ],
      });
      const line = result.lines.find((item) => item.localOverrideId === "override-1");
      assert.equal(line?.amountOre, 2_000);
      assert.equal(result.exportBlocked, false);
    },
  },
  {
    id: "overlapping-overrides-block",
    async run() {
      const first = {
        id: "override-1",
        version: 1,
        baseRuleId: "allowance",
        scopeKey: "project:test",
        validFrom: "2026-07-01",
        validTo: "2026-07-31",
        changeType: "replace",
        rate: { kind: "ore_per_hour", value: 2_000 },
        status: "approved",
        documentation: SOURCE,
        approvedBy: "test-approver",
      };
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" }],
        rules: [rule("allowance")],
        overrides: [first, { ...first, id: "override-2", validFrom: "2026-07-15" }],
      });
      assert.equal(result.exportBlocked, true);
      assert.match(result.manualReviewReasons.join(" "), /overlapper/);
    },
  },
  {
    id: "rate-validity-boundary",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T10:00+02:00" }],
        rules: [
          rule("old-rate", { validFrom: "2026-01-01", validTo: "2026-07-19" }),
          rule("new-rate", {
            validFrom: "2026-07-20",
            validTo: "2026-12-31",
            rate: { kind: "ore_per_hour", value: 1_500 },
          }),
        ],
      });
      assert.equal(
        result.lines.some((line) => line.ruleId === "old-rate"),
        false,
      );
      assert.equal(result.lines.find((line) => line.ruleId === "new-rate")?.amountOre, 3_000);
    },
  },
  {
    id: "unverified-rule-blocks-and-does-not-pay-zero",
    async run() {
      const result = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" }],
        rules: [rule("pending", { verificationStatus: "manual_review_required" })],
      });
      assert.equal(result.exportBlocked, true);
      assert.equal(
        result.lines.some((line) => line.ruleId === "pending"),
        false,
      );
      assert.match(result.manualReviewReasons[0], /Kræver manuel afklaring/);
    },
  },
  {
    id: "invalid-source-rule-is-not-applied",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "s1",
            start: "2026-07-20T08:00+02:00",
            end: "2026-07-20T09:00+02:00",
          },
        ],
        rules: [
          rule("invalid-source", {
            source: { ...SOURCE, paragraph: "", page: "" },
          }),
        ],
      });
      assert.equal(result.exportBlocked, true);
      assert.equal(
        result.lines.some((line) => line.ruleId === "invalid-source"),
        false,
      );
      assert.match(result.manualReviewReasons.join(" "), /kildehenvisning/);
    },
  },
  {
    id: "undocumented-override-is-not-applied",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "s1",
            start: "2026-07-20T08:00+02:00",
            end: "2026-07-20T09:00+02:00",
          },
        ],
        rules: [rule("allowance")],
        overrides: [
          {
            id: "override-undocumented",
            version: 1,
            baseRuleId: "allowance",
            scopeKey: "project:test",
            validFrom: "2026-07-01",
            validTo: "2026-07-31",
            changeType: "replace",
            rate: { kind: "ore_per_hour", value: 9_999 },
            status: "approved",
            documentation: { ...SOURCE, sha256: "" },
            approvedBy: "test-approver",
          },
        ],
      });
      const allowance = result.lines.find((line) => line.ruleId === "allowance");
      assert.equal(result.exportBlocked, true);
      assert.equal(allowance?.amountOre, 1_000);
      assert.equal(allowance?.localOverrideId, undefined);
      assert.match(result.manualReviewReasons.join(" "), /dokumentation/);
    },
  },
  {
    id: "overlapping-shifts-block",
    async run() {
      const result = await calculate({
        shifts: [
          { id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T10:00+02:00" },
          { id: "s2", start: "2026-07-20T09:00+02:00", end: "2026-07-20T11:00+02:00" },
        ],
      });
      assert.equal(result.exportBlocked, true);
      assert.match(result.manualReviewReasons.join(" "), /overlapper/);
    },
  },
  {
    id: "invalid-february-30-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "invalid-date",
            start: "2026-02-30T08:00+01:00",
            end: "2026-02-30T09:00+01:00",
          },
        ],
      });
      assert.equal(result.status, "manual_review_required");
      assert.deepEqual(result.manualReviewCodes, ["INVALID_WORK_DATE"]);
      assert.equal(result.totalWorkedMinutes, 0);
      assert.equal(result.grossPayOre, 0);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "invalid-non-leap-day-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "invalid-non-leap",
            start: "2025-02-29T08:00+01:00",
            end: "2025-02-29T09:00+01:00",
          },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), true);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "valid-leap-day-is-accepted",
    async run() {
      const result = await calculate({
        agreementVersion: {
          ...VERSION,
          validFrom: "2024-01-01",
          validTo: "2024-12-31",
        },
        shifts: [
          {
            id: "valid-leap",
            start: "2024-02-29T08:00+01:00",
            end: "2024-02-29T09:00+01:00",
          },
        ],
      });
      assert.equal(result.status, "completed");
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), false);
      assert.equal(result.totalWorkedMinutes, 60);
    },
  },
  {
    id: "invalid-month-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "invalid-month",
            start: "2026-13-01T08:00+01:00",
            end: "2026-13-01T09:00+01:00",
          },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), true);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "invalid-day-zero-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "invalid-day",
            start: "2026-07-00T08:00+02:00",
            end: "2026-07-00T09:00+02:00",
          },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), true);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "incorrect-date-format-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "invalid-format",
            start: "2026-7-20T08:00+02:00",
            end: "2026-7-20T09:00+02:00",
          },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), true);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "valid-midnight-near-dst-remains-valid",
    async run() {
      const result = await calculate({
        shifts: [
          {
            id: "valid-dst-midnight",
            start: "2026-03-28T23:30+01:00",
            end: "2026-03-29T03:30+02:00",
          },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("INVALID_WORK_DATE"), false);
      assert.equal(result.status, "completed");
      assert.equal(result.totalWorkedMinutes, 180);
    },
  },
  {
    id: "duplicate-shift-id-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          { id: "duplicate", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" },
          { id: "duplicate", start: "2026-07-20T10:00+02:00", end: "2026-07-20T11:00+02:00" },
        ],
        rules: [rule("one-time", { rate: { kind: "ore_per_occurrence", value: 5_000 } })],
      });
      assert.equal(result.status, "manual_review_required");
      assert.deepEqual(result.manualReviewCodes, ["DUPLICATE_SHIFT_ID"]);
      assert.equal(result.grossPayOre, 0);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "invalid-work-date-is-rejected-before-persistence",
    async run() {
      const boundary = persistenceBoundaryDatabase({
        weekStart: "2026-02-30",
        days: [{ id: "day-invalid", start: "08:00", end: "09:00" }],
      });
      await assert.rejects(
        () =>
          serverCalculation.calculateAndPersistTimesheet(
            boundary.database,
            {
              userId: "identity-test",
              organizationId: "organization-test",
              membershipId: "membership-test",
              role: "konsulent",
              expiresAt: Math.floor(Date.now() / 1000) + 60,
              demo: false,
            },
            "timesheet-persistence-test",
            1,
            "2026-07-26T10:00:00+02:00",
          ),
        (error) => error?.code === "INVALID_WORK_DATE" && error?.status === 422,
      );
      assert.equal(boundary.batchCalls(), 0);
    },
  },
  {
    id: "duplicate-shift-id-is-rejected-before-persistence",
    async run() {
      const boundary = persistenceBoundaryDatabase({
        weekStart: "2026-07-20",
        days: [
          { id: "same-id", start: "08:00", end: "09:00" },
          { id: "same-id", start: "08:00", end: "09:00" },
        ],
      });
      await assert.rejects(
        () =>
          serverCalculation.calculateAndPersistTimesheet(
            boundary.database,
            {
              userId: "identity-test",
              organizationId: "organization-test",
              membershipId: "membership-test",
              role: "konsulent",
              expiresAt: Math.floor(Date.now() / 1000) + 60,
              demo: false,
            },
            "timesheet-persistence-test",
            1,
            "2026-07-26T10:00:00+02:00",
          ),
        (error) => error?.code === "DUPLICATE_SHIFT_ID" && error?.status === 422,
      );
      assert.equal(boundary.batchCalls(), 0);
    },
  },
  {
    id: "same-time-with-distinct-ids-is-not-a-duplicate-id",
    async run() {
      const result = await calculate({
        shifts: [
          { id: "first", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" },
          { id: "second", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" },
        ],
      });
      assert.equal(result.manualReviewCodes.includes("DUPLICATE_SHIFT_ID"), false);
      assert.match(result.manualReviewReasons.join(" "), /overlapper/u);
    },
  },
  {
    id: "duplicate-id-across-non-adjacent-input-segments-is-hard-blocked",
    async run() {
      const result = await calculate({
        shifts: [
          { id: "reused", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" },
          { id: "unique", start: "2026-07-21T08:00+02:00", end: "2026-07-21T09:00+02:00" },
          { id: "reused", start: "2026-07-22T08:00+02:00", end: "2026-07-22T09:00+02:00" },
        ],
      });
      assert.deepEqual(result.manualReviewCodes, ["DUPLICATE_SHIFT_ID"]);
      assert.deepEqual(result.lines, []);
    },
  },
  {
    id: "unique-shift-ids-complete-normally",
    async run() {
      const result = await calculate({
        shifts: [
          { id: "first", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" },
          { id: "second", start: "2026-07-21T08:00+02:00", end: "2026-07-21T09:00+02:00" },
        ],
      });
      assert.equal(result.status, "completed");
      assert.deepEqual(result.manualReviewCodes, []);
      assert.equal(result.totalWorkedMinutes, 120);
    },
  },
  {
    id: "snapshot-hash-is-stable",
    async run() {
      const input = {
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:00+02:00" }],
      };
      const first = await calculate(input);
      const second = await calculate(input);
      assert.equal(first.inputHash, second.inputHash);
      assert.equal(first.resultHash, second.resultHash);
      const changed = await calculate({
        shifts: [{ id: "s1", start: "2026-07-20T08:00+02:00", end: "2026-07-20T09:01+02:00" }],
      });
      assert.notEqual(first.resultHash, changed.resultHash);
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
  await server.close();
}

if (failed > 0) process.exitCode = 1;
else console.log(`Agreement engine tests passed: ${tests.length}/${tests.length}.`);
