export type InvoicePeriodTone = "red" | "orange" | "green";

export type InvoicePeriodStatusInput = {
  status: string;
  startDate?: string;
  endDate?: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function invoicePeriodTone(
  input: InvoicePeriodStatusInput,
  referenceDate: Date | string = new Date(),
): InvoicePeriodTone | null {
  if (input.status === "approved") return "red";

  const today = referenceISODate(referenceDate);
  const startDate = isoDateOrNull(input.startDate);
  const endDate = isoDateOrNull(input.endDate);
  if (!today || !startDate || !endDate) return null;

  if (endDate <= today) return "red";
  if (startDate > today) return "green";
  return "orange";
}

export function isoDateOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const candidate = value.slice(0, 10);
  return ISO_DATE_PATTERN.test(candidate) ? candidate : null;
}

function referenceISODate(referenceDate: Date | string): string | null {
  if (typeof referenceDate === "string") return isoDateOrNull(referenceDate);
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
