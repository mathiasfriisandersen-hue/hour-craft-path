import { strict as assert } from "node:assert";
import { invoicePeriodTone } from "../src/lib/invoice-period-status.js";

const today = "2026-07-17";

assert.equal(
  invoicePeriodTone({ status: "sent", startDate: "2026-07-18", endDate: "2026-07-24" }, today),
  "green",
);
assert.equal(
  invoicePeriodTone({ status: "sent", startDate: "2026-07-17", endDate: "2026-07-24" }, today),
  "orange",
);
assert.equal(
  invoicePeriodTone({ status: "sent", startDate: "2026-07-13", endDate: "2026-07-17" }, today),
  "red",
);
assert.equal(
  invoicePeriodTone({ status: "sent", startDate: "2026-07-13", endDate: "2026-07-16" }, today),
  "red",
);
assert.equal(
  invoicePeriodTone({ status: "approved", startDate: "2026-07-18", endDate: "2026-07-24" }, today),
  "red",
);
assert.equal(invoicePeriodTone({ status: "sent" }, today), null);

console.log("invoicePeriodTone deterministic tests passed");
