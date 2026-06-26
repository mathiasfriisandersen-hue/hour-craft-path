import { createServer } from "vite";

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

function makeDays(entries) {
  const days = Array.from({ length: 7 }, () => store.emptyDay());
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
      assertEqual(result.evening, 3, "after-18 evening");
      assertGuarded(result, "after-18");
    },
  },
  {
    id: "night-work",
    run() {
      const result = store.calculateTimesheet(sheet([[0, { start: "21:00", end: "02:00" }]]));
      assertEqual(result.total, 5, "night total");
      assertEqual(result.night, 4, "night hours");
      assertGuarded(result, "night");
    },
  },
  {
    id: "saturday-work",
    run() {
      const result = store.calculateTimesheet(sheet([[5, { start: "08:00", end: "14:00" }]]));
      assertEqual(result.total, 6, "saturday total");
      assertEqual(result.saturday, 6, "saturday hours");
      assertGuarded(result, "saturday");
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
      assertEqual(result.overtime, 3, "weekly overtime");
      assertGuarded(result, "weekly");
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
      assertEqual(result.overtime, 0.5, "multi-day overtime");
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
          [0, { start: "07:00", end: "15:30", pause: 30, delayedMealBreakCompensation: true }],
          [1, { start: "07:00", end: "15:30", pause: 30, delayedMealBreakCompensation: true }],
        ]),
      );
      assertEqual(result.delayedMealBreakDays, 2, "delayed meal break days");
      assertEqual(result.delayedMealBreakAmount, 68.1, "delayed meal break amount");
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
          [[0, { start: "07:00", end: "15:30", pause: 30, delayedMealBreakCompensation: true }]],
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
