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
const errorReporting = await server.ssrLoadModule("/src/lib/lovable-error-reporting.ts");

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

function memoryStorage(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
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
    id: "browser-storage-scrubs-sensitive-fields-and-credentials-in-both-stores",
    run() {
      const sensitiveFixture = {
        id: "timesheet-safe",
        notes: "bevar sikker note",
        vikarCpr: "0101901234",
        vikarCode: "VIKAR-42",
        kontaktpersonCode: "KONTAKT-24",
        accessToken: "secret-token",
        nested: { workerAccessCode: "0000", note: "bevar-også" },
      };
      const localStorage = memoryStorage({
        "timesheets-v1": JSON.stringify([sensitiveFixture]),
        "timesheet-api-token": "legacy-local-token",
      });
      const sessionStorage = memoryStorage({
        "timesheets-v1": JSON.stringify([sensitiveFixture]),
        "timeseddel.demo-session-token": "legacy-session-token",
      });
      const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
      };
      const capturedLogs = [];

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          localStorage,
          sessionStorage,
          dispatchEvent() {},
        },
      });
      console.log = (...values) => capturedLogs.push(["log", ...values]);
      console.warn = (...values) => capturedLogs.push(["warn", ...values]);
      console.error = (...values) => capturedLogs.push(["error", ...values]);

      try {
        store.scrubSensitiveBrowserStorage();
        apiSession.clearSessionCredential();
        store.upsert(
          sheet([], {
            id: "written-timesheet",
            notes: "bevar faktisk write",
            vikarCpr: "0202905678",
            vikarCode: "WRITE-CODE",
          }),
        );

        const persisted = JSON.stringify({
          local: localStorage.snapshot(),
          session: sessionStorage.snapshot(),
        });
        for (const forbidden of [
          "vikarCpr",
          "0101901234",
          "0202905678",
          "vikarCode",
          "VIKAR-42",
          "WRITE-CODE",
          "kontaktpersonCode",
          "KONTAKT-24",
          "workerAccessCode",
          "0000",
          "accessToken",
          "secret-token",
          "legacy-local-token",
          "legacy-session-token",
        ]) {
          if (persisted.includes(forbidden)) {
            throw new Error(`browser storage retained forbidden field or value ${forbidden}`);
          }
        }
        if (
          !persisted.includes("bevar sikker note") ||
          !persisted.includes("bevar faktisk write")
        ) {
          throw new Error("browser storage cleanup must retain non-sensitive business data");
        }
        assertEqual(capturedLogs.length, 0, "storage cleanup and write must not log stored values");
      } finally {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        if (originalWindow) {
          Object.defineProperty(globalThis, "window", originalWindow);
        } else {
          delete globalThis.window;
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
    id: "error-reporting-redacts-sensitive-error-values",
    run() {
      const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
      let capturedError;

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: { pathname: "/safe-test-route" },
          __lovableEvents: {
            captureException(error) {
              capturedError = error;
            },
          },
        },
      });

      try {
        const sensitiveError = new Error("CPR 0101901234, token secret-token og adgangskode 0000");
        sensitiveError.name = "0101901234";
        errorReporting.reportLovableError(sensitiveError, { boundary: "test" });

        if (!(capturedError instanceof Error)) {
          throw new Error("error reporting must emit a sanitized Error");
        }
        const reported = [
          capturedError.name,
          capturedError.message,
          capturedError.stack ?? "",
        ].join("\n");
        for (const forbidden of ["0101901234", "secret-token", "0000"]) {
          if (reported.includes(forbidden)) {
            throw new Error(`error reporting leaked sensitive value ${forbidden}`);
          }
        }
        assertEqual(capturedError.name, "UnknownError", "unsafe error name");
        assertEqual(capturedError.message, "Application error", "safe error message");
      } finally {
        if (originalWindow) {
          Object.defineProperty(globalThis, "window", originalWindow);
        } else {
          delete globalThis.window;
        }
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
      const requiredCopy =
        "Denne demo bruger syntetiske testdata. Ikke-følsomme demodata kan gemmes lokalt i browseren. Brug ikke rigtige personoplysninger.";
      if (!source.replace(/\s+/gu, " ").includes(requiredCopy)) {
        throw new Error("demo copy must disclose local storage and prohibit real personal data");
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
      const verifiedSnapshot = {
        source: "d1",
        calculationId: "server-snapshot",
        status: "completed",
        exportBlocked: false,
        manualReviewReasons: [],
        resultHash: "b".repeat(64),
        grossPayOre: 12_345,
        invoiceTotalOre: 67_890,
      };
      assertEqual(
        apiSession.verifiedSnapshotAmountDkk(verifiedSnapshot, "grossPayOre"),
        123.45,
        "verified server gross pay",
      );
      assertEqual(
        apiSession.verifiedSnapshotAmountDkk(verifiedSnapshot, "invoiceTotalOre"),
        678.9,
        "verified server invoice total",
      );
      for (const [patch, label] of [
        [{ status: "manual_review_required" }, "manual review status"],
        [{ exportBlocked: true }, "export blocked"],
        [{ manualReviewReasons: ["Kræver manuel validering"] }, "manual review reason"],
        [{ resultHash: "invalid" }, "invalid hash"],
      ]) {
        assertEqual(
          apiSession.verifiedSnapshotAmountDkk({ ...verifiedSnapshot, ...patch }, "grossPayOre"),
          null,
          `${label} must block client display`,
        );
      }

      const repositoryRoot = resolve(import.meta.dirname, "..");
      const financeSource = readFileSync(
        resolve(repositoryRoot, "src/routes/admin.invoice-payroll.tsx"),
        "utf8",
      );
      const detailSource = readFileSync(
        resolve(repositoryRoot, "src/routes/admin.$id.tsx"),
        "utf8",
      );
      const companySource = readFileSync(
        resolve(repositoryRoot, "src/routes/admin.companies.tsx"),
        "utf8",
      );
      if (
        /invoiceBaseHours\s*\*\s*billingRate|payrollBasisHours\s*\*|function\s+(?:allowanceRowsForCalculation|invoiceAllowanceRowsForCalculation|payrollAllowanceRowsForCalculation)\b/u.test(
          financeSource,
        )
      ) {
        throw new Error("invoice page still contains a client-side financial calculation helper");
      }
      for (const blockedFinancialMarker of [
        "invoiceBaseExVat: Number.NaN",
        "allowanceRows: []",
        "payrollTotal: Number.NaN",
      ]) {
        if (!financeSource.includes(blockedFinancialMarker)) {
          throw new Error(`invoice page must retain blocked marker ${blockedFinancialMarker}`);
        }
      }
      if (/\.saturday\s*\+\s*[^;\n]*\.sunday\s*\+\s*[^;\n]*\.weekend/u.test(financeSource)) {
        throw new Error("overlapping weekend categories are still summed in client finance code");
      }
      if (!detailSource.includes("getLatestCalculationSnapshot")) {
        throw new Error("admin detail must obtain financial totals from the server endpoint");
      }
      if (/customerBillingTotal|employeeBaseCost|totalAllowanceHours/u.test(detailSource)) {
        throw new Error("admin detail still contains a client-computed economic total");
      }
      if (
        /formatProjectBilling|billingHourlyWage\s*\*\s*(?:project\.)?billingFactor/u.test(
          companySource,
        )
      ) {
        throw new Error("company page still contains a client-computed customer total");
      }
      if (!companySource.includes("Blokeret: serverbaseret beregningssnapshot mangler")) {
        throw new Error("company page must block customer totals without a server snapshot");
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
