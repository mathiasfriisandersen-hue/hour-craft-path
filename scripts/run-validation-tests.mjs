import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function createSsrLoader() {
  const originalWrite = process.stderr.write.bind(process.stderr);
  let startupStderr = "";

  process.stderr.write = (chunk, encoding, callback) => {
    startupStderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };

  try {
    return await createServer({
      appType: "custom",
      logLevel: "error",
      server: { hmr: false, middlewareMode: true },
    });
  } catch (error) {
    if (startupStderr) {
      originalWrite(startupStderr);
    }
    throw error;
  } finally {
    process.stderr.write = originalWrite;
    if (startupStderr && !startupStderr.includes("WebSocket server error")) {
      originalWrite(startupStderr);
    }
  }
}

const server = await createSsrLoader();

const store = await server.ssrLoadModule("/src/lib/timesheet-store.ts");
const apiSession = await server.ssrLoadModule("/src/lib/api-session.ts");

function makeDays(entries) {
  const days = Array.from({ length: 7 }, (_, index) => store.emptyDay(index));
  for (const [index, patch] of entries) {
    days[index] = { ...days[index], ...patch };
  }
  return days;
}

function sheet(entries, patch = {}) {
  return {
    ...store.createBlank(),
    vikar: "Test Vikar",
    vikarEmail: "vikar@example.test",
    brugervirksomhed: "Test Virksomhed",
    kontaktperson: "Test Kontakt",
    kontaktpersonEmail: "kontakt@example.test",
    arbejdssted: "Testvej 1",
    selectedAgreementId: "industriens-overenskomst",
    overenskomst: "Industriens Overenskomst",
    weekStart: "2026-06-22",
    days: makeDays(entries),
    ...patch,
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: forventede ${expected}, fik ${actual}`);
  }
}

function assertGuarded(result, label) {
  assertEqual(result.canCalculateRatesAutomatically, false, `${label} guardrail`);
  if (!result.missingRules.length) {
    throw new Error(`${label}: forventede mindst en valideringsblokering`);
  }
}

const tests = [
  {
    id: "week-start-local-date",
    run() {
      assertEqual(
        store.getMondayISO(new Date("2026-06-29T12:00:00")),
        "2026-06-29",
        "monday must stay monday",
      );
      assertEqual(
        store.getMondayISO(new Date("2026-06-28T12:00:00")),
        "2026-06-22",
        "sunday must resolve to previous monday",
      );
    },
  },
  {
    id: "weekday-no-allowance",
    run() {
      const result = store.calculateTimesheet(
        sheet([[0, { start: "08:00", end: "16:00", pause: 30 }]]),
      );
      assertEqual(result.total, 7.5, "weekday total");
      assertEqual(result.evening, 0, "weekday evening");
      assertEqual(result.night, 0, "weekday night");
      assertGuarded(result, "weekday");
    },
  },
  {
    id: "after-18-evening",
    run() {
      const result = store.calculateTimesheet(sheet([[0, { start: "16:00", end: "21:00" }]]));
      assertEqual(result.total, 5, "after-18 total");
      assertEqual(result.evening, 0, "after-18 normal work must not auto-trigger evening");
      assertGuarded(result, "after-18");
    },
  },
  {
    id: "explicit-displaced-evening",
    run() {
      const result = store.calculateTimesheet(
        sheet([
          [
            0,
            {
              start: "16:00",
              end: "21:00",
              workType: "displaced_work_time",
              eveningWorkStart: "18:00",
              eveningWorkEnd: "21:00",
            },
          ],
        ]),
      );
      assertEqual(result.total, 5, "explicit displaced total");
      assertEqual(result.evening, 3, "explicit displaced evening");
      assertGuarded(result, "explicit displaced");
    },
  },
  {
    id: "night-work",
    run() {
      const result = store.calculateTimesheet(sheet([[0, { start: "21:00", end: "02:00" }]]));
      assertEqual(result.total, 5, "night total");
      assertEqual(result.night, 0, "night normal work must not auto-trigger night");
      assertGuarded(result, "night");
    },
  },
  {
    id: "explicit-displaced-night",
    run() {
      const result = store.calculateTimesheet(
        sheet([
          [
            0,
            {
              start: "21:00",
              end: "02:00",
              workType: "displaced_work_time",
              nightWorkStart: "22:00",
              nightWorkEnd: "02:00",
            },
          ],
        ]),
      );
      assertEqual(result.total, 5, "explicit night total");
      assertEqual(result.night, 4, "explicit night hours");
      assertGuarded(result, "explicit night");
    },
  },
  {
    id: "saturday-work",
    run() {
      const result = store.calculateTimesheet(sheet([[5, { start: "08:00", end: "14:00" }]]));
      assertEqual(result.total, 6, "saturday total");
      assertEqual(result.saturday, 6, "saturday hours");
      assertEqual(result.weekend, 0, "saturday must not auto-trigger weekend agreement");
      assertGuarded(result, "saturday");
    },
  },
  {
    id: "explicit-weekend-agreement",
    run() {
      const result = store.calculateTimesheet(
        sheet([[5, { start: "08:00", end: "14:00", workType: "weekend_work_agreement" }]]),
      );
      assertEqual(result.total, 6, "explicit weekend agreement total");
      assertEqual(result.saturday, 6, "explicit weekend agreement saturday");
      assertEqual(result.weekend, 6, "explicit weekend agreement");
      assertGuarded(result, "explicit weekend agreement");
    },
  },
  {
    id: "sunday-work",
    run() {
      const result = store.calculateTimesheet(sheet([[6, { start: "08:00", end: "14:00" }]]));
      assertEqual(result.total, 6, "sunday total");
      assertEqual(result.sunday, 6, "sunday hours");
      assertGuarded(result, "sunday");
    },
  },
  {
    id: "weekly-overtime",
    run() {
      const result = store.calculateTimesheet(
        sheet([
          [0, { start: "08:00", end: "16:00" }],
          [1, { start: "08:00", end: "16:00" }],
          [2, { start: "08:00", end: "16:00" }],
          [3, { start: "08:00", end: "16:00" }],
          [4, { start: "08:00", end: "16:00" }],
        ]),
      );
      assertEqual(result.total, 40, "weekly total");
      assertEqual(result.overtime, 0, "weekly overtime must not be guessed");
      assertGuarded(result, "weekly");
    },
  },
  {
    id: "explicit-overtime",
    run() {
      const result = store.calculateTimesheet(
        sheet([[0, { start: "07:00", end: "15:30", pause: 30, workType: "overtime" }]]),
      );
      assertEqual(result.total, 8, "explicit overtime total");
      assertEqual(result.overtime, 8, "explicit overtime");
      assertGuarded(result, "explicit overtime");
    },
  },
  {
    id: "multiple-workdays",
    run() {
      const result = store.calculateTimesheet(
        sheet([
          [0, { start: "07:00", end: "15:00", pause: 30 }],
          [1, { start: "07:00", end: "15:00", pause: 30 }],
          [2, { start: "07:00", end: "15:00", pause: 30 }],
          [3, { start: "07:00", end: "15:00", pause: 30 }],
          [4, { start: "07:00", end: "15:00", pause: 30 }],
        ]),
      );
      assertEqual(result.total, 37.5, "multi-day total");
      assertEqual(result.overtime, 0, "multi-day overtime must not be guessed");
      assertGuarded(result, "multi-day");
    },
  },
  {
    id: "local-agreement-combination",
    run() {
      const result = store.calculateTimesheet(
        sheet([[0, { start: "08:00", end: "16:00", pause: 30 }]], {
          localAgreementApplies: true,
          lokalaftale: true,
        }),
      );
      assertEqual(result.total, 7.5, "local total");
      assertEqual(result.localAgreement, 7.5, "local agreement hours");
      assertGuarded(result, "local");
    },
  },
  {
    id: "delayed-meal-break-industriens",
    run() {
      const result = store.calculateTimesheet(
        sheet([
          [
            0,
            {
              start: "07:00",
              end: "15:30",
              pause: 30,
              wasInstructedToWorkDuringMealBreak: true,
              mealBreakPostponedMoreThan30Min: true,
            },
          ],
          [
            1,
            {
              start: "07:00",
              end: "15:30",
              pause: 30,
              wasInstructedToWorkDuringMealBreak: true,
              mealBreakPostponedMoreThan30Min: true,
            },
          ],
        ]),
      );
      assertEqual(result.delayedMealBreakDays, 2, "delayed meal break days");
      assertEqual(result.delayedMealBreakAmount, 0, "unverified delayed meal break amount");
      if (!store.delayedMealBreakCalculationText(2).includes("Kræver manuel validering")) {
        throw new Error("delayed meal break must remain manually blocked without a verified rate");
      }
      assertGuarded(result, "delayed meal break");
    },
  },
  {
    id: "delayed-meal-break-not-automatic-from-pause",
    run() {
      const result = store.calculateTimesheet(
        sheet([[0, { start: "07:00", end: "15:30", pause: 60 }]]),
      );
      assertEqual(result.delayedMealBreakDays, 0, "delayed meal break days without flag");
      assertEqual(result.delayedMealBreakAmount, 0, "delayed meal break amount without flag");
      assertGuarded(result, "delayed meal break without flag");
    },
  },
  {
    id: "delayed-meal-break-only-industriens",
    run() {
      const result = store.calculateTimesheet(
        sheet(
          [
            [
              0,
              {
                start: "07:00",
                end: "15:30",
                pause: 30,
                wasInstructedToWorkDuringMealBreak: true,
                mealBreakPostponedMoreThan30Min: true,
              },
            ],
          ],
          {
            selectedAgreementId: "bygningsoverenskomsten",
            overenskomst: "Bygningsoverenskomsten",
          },
        ),
      );
      assertEqual(result.delayedMealBreakDays, 0, "delayed meal break wrong agreement days");
      assertEqual(result.delayedMealBreakAmount, 0, "delayed meal break wrong agreement amount");
      assertGuarded(result, "delayed meal break wrong agreement");
    },
  },
  {
    id: "public-holiday-calendar",
    run() {
      const result = store.calculateTimesheet(
        sheet([[4, { start: "08:00", end: "14:00" }]], {
          weekStart: "2026-12-21",
        }),
      );
      assertEqual(result.total, 6, "public holiday total");
      assertEqual(result.publicHoliday, 6, "public holiday hours");
      assertGuarded(result, "public holiday");
    },
  },
  {
    id: "artificial-holiday-test",
    run() {
      const result = store.calculateTimesheet(
        sheet([[3, { start: "07:00", end: "15:30", pause: 60, isArtificialHolidayTest: true }]]),
      );
      assertEqual(result.total, 7.5, "artificial holiday total");
      assertEqual(result.publicHoliday, 7.5, "artificial holiday hours");
      assertGuarded(result, "artificial holiday");
    },
  },
  {
    id: "pause-placement-warning",
    run() {
      const result = store.calculateTimesheet(
        sheet([[0, { start: "07:00", end: "15:30", pause: 60, workType: "displaced_work_time" }]]),
      );
      if (
        !result.manualValidationMessages.includes(
          "Pauseplacering mangler. Tillæg kan ikke fordeles præcist.",
        )
      ) {
        throw new Error("pause placement warning: forventede advarsel om manglende pauseplacering");
      }
      assertGuarded(result, "pause placement warning");
    },
  },
  {
    id: "browser-storage-scrubs-sensitive-fields-recursively",
    run() {
      const sanitized = store.sanitizeSensitiveBrowserData({
        id: "timesheet-safe",
        vikarCpr: "0101901234",
        nested: {
          workerAccessCode: "0000",
          accessToken: "secret-token",
          note: "bevar",
        },
        list: [{ refreshToken: "refresh-secret", value: "bevar-også" }],
      });
      assertEqual(sanitized.id, "timesheet-safe", "safe id must remain");
      assertEqual(sanitized.nested.note, "bevar", "safe nested value must remain");
      assertEqual(sanitized.list[0].value, "bevar-også", "safe array value must remain");
      const serialized = JSON.stringify(sanitized);
      for (const forbidden of [
        "vikarCpr",
        "0101901234",
        "workerAccessCode",
        "0000",
        "accessToken",
        "secret-token",
        "refreshToken",
        "refresh-secret",
      ]) {
        if (serialized.includes(forbidden)) {
          throw new Error(`browser storage sanitizer retained forbidden value ${forbidden}`);
        }
      }
    },
  },
  {
    id: "auth-runtime-does-not-persist-session-credentials",
    run() {
      const repositoryRoot = resolve(import.meta.dirname, "..");
      const sources = [
        readFileSync(resolve(repositoryRoot, "src/lib/api-session.ts"), "utf8"),
        readFileSync(resolve(repositoryRoot, "src/lib/auth.tsx"), "utf8"),
      ].join("\n");
      if (/(?:localStorage|sessionStorage)\.setItem\s*\(/u.test(sources)) {
        throw new Error("auth runtime must not persist tokens or session data in browser storage");
      }
    },
  },
  {
    id: "demo-copy-discloses-local-browser-storage",
    run() {
      const source = readFileSync(
        resolve(import.meta.dirname, "../src/components/login-screen.tsx"),
        "utf8",
      );
      if (!source.includes("Syntetiske demodata kan blive gemt lokalt i denne browser")) {
        throw new Error("demo copy must disclose local browser storage");
      }
      if (source.includes("gemmes ikke permanent")) {
        throw new Error("demo copy must not claim that local demo data is never persisted");
      }
    },
  },
  {
    id: "overlapping-time-categories-cannot-create-client-financial-total",
    run() {
      const calculation = store.calculateTimesheet(
        sheet([[5, { start: "08:00", end: "14:00", workType: "weekend_work_agreement" }]]),
      );
      assertEqual(calculation.saturday, 6, "overlap fixture saturday hours");
      assertEqual(calculation.weekend, 6, "overlap fixture weekend hours");
      assertEqual(
        apiSession.verifiedSnapshotAmountDkk(null, "invoiceTotalOre"),
        null,
        "raw overlapping categories must not yield invoice amount",
      );
      assertEqual(
        apiSession.verifiedSnapshotAmountDkk(
          {
            source: "d1",
            calculationId: "server-snapshot",
            status: "completed",
            exportBlocked: false,
            manualReviewReasons: [],
            resultHash: "a".repeat(64),
            grossPayOre: 12_345,
            invoiceTotalOre: null,
          },
          "invoiceTotalOre",
        ),
        null,
        "server snapshot without invoice total must remain blocked",
      );

      const repositoryRoot = resolve(import.meta.dirname, "..");
      const financeSource = readFileSync(
        resolve(repositoryRoot, "src/routes/admin.invoice-payroll.tsx"),
        "utf8",
      );
      const detailSource = readFileSync(
        resolve(repositoryRoot, "src/routes/admin.$id.tsx"),
        "utf8",
      );
      if (/invoiceBaseHours\s*\*\s*billingRate/u.test(financeSource)) {
        throw new Error("invoice page still computes a client-side base total");
      }
      if (/payrollBasisHours\s*\*/u.test(financeSource)) {
        throw new Error("invoice page still computes a client-side payroll total");
      }
      if ((financeSource.match(/invoiceAllowanceRowsForCalculation\s*\(/gu) ?? []).length !== 1) {
        throw new Error("legacy client invoice calculation helper is still called");
      }
      if ((financeSource.match(/payrollAllowanceRowsForCalculation\s*\(/gu) ?? []).length !== 1) {
        throw new Error("legacy client payroll calculation helper is still called");
      }
      if (!detailSource.includes("getLatestCalculationSnapshot")) {
        throw new Error("admin detail must obtain financial totals from the server endpoint");
      }
      if (/customerBillingTotal|employeeBaseCost|totalAllowanceHours/u.test(detailSource)) {
        throw new Error("admin detail still contains a client-computed economic total");
      }
    },
  },
];

let failed = 0;
let pending = 0;

for (const test of tests) {
  if (test.pending) {
    pending += 1;
    console.log(`PENDING ${test.id}: ${test.reason}`);
    continue;
  }
  try {
    test.run();
    console.log(`PASS ${test.id}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.id}: ${error.message}`);
  }
}

await server.close();

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`Validation tests passed with ${pending} pending legal/model case.`);
}
