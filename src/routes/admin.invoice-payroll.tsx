import { createFileRoute } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import subzLogo from "@/assets/sub-z-logo.png";
import { addDaysToISODate } from "@/lib/danishHolidays";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  calculateTimesheet,
  formatDkk,
  formatWeekRange,
  listCompanies,
  totalHours,
  upsert,
  weekNumber,
  type Company,
  type CompanyProject,
  type Timesheet,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/invoice-payroll")({
  head: () => ({ meta: [{ title: "Admin — Faktura & løn" }] }),
  component: InvoicePayrollPage,
});

type StatusTone = "red" | "orange" | "green";

type WorkContext = {
  timesheet: Timesheet;
  company?: Company;
  project?: CompanyProject;
  approvedHours: number;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceDueDate: string;
  payrollDeadline: string;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  payrollBasisHours: number;
  payrollBasisAmount: number;
  payrollApprovalStatus: string;
  billingMultiplier: number;
  billingRate: number;
  invoiceBaseExVat: number;
  invoiceAllowanceRows: PayrollAllowanceRow[];
  invoiceAllowanceExVat: number;
  invoiceExVat: number;
  vat: number;
  invoiceIncVat: number;
  invoiceTone: StatusTone;
  payrollTone: StatusTone;
};

type PayrollAllowanceRow = {
  label: string;
  hours: number;
  amount: number;
};

const SELLER = {
  name: "Sub-Z ApS",
  address: "Vesterballevej 5, 7000 Fredericia",
  cvr: "44514109",
  email: "info@sub-z.dk",
  phone: "40601253",
};

const PAYMENT = {
  bank: "Bankoplysninger",
  registrationNumber: "",
  accountNumber: "",
  iban: "",
  swift: "",
};
const PAYROLL_SOCIAL_COST_RATE = 0.3888;

function InvoicePayrollPage() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [preview, setPreview] = useState<WorkContext | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<WorkContext | null>(null);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const rows = useMemo(
    () =>
      timesheets
        .filter((timesheet) => !timesheet.archived)
        .map((timesheet) => buildWorkContext(timesheet, companies)),
    [companies, timesheets],
  );

  const invoiceRows = rows
    .filter((row) => row.timesheet.status === "approved" && row.approvedHours > 0)
    .sort((a, b) => compareByUrgency(a, b, "invoice"));
  const payrollRows = rows
    .filter(
      (row) =>
        (row.timesheet.status === "sent" || row.timesheet.status === "approved") &&
        totalHours(row.timesheet.days) > 0,
    )
    .sort(comparePayrollRows);

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Faktura & løn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrativt overblik over godkendte timer til fakturering og bogholderi.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Fakturaoverblik</h2>
          </div>
          {invoiceRows.length === 0 ? (
            <EmptyState text="Ingen godkendte timesedler klar til faktura." />
          ) : (
            <div className="divide-y">
              {invoiceRows.map((row) => (
                <article key={`invoice-${row.timesheet.id}`} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusDot tone={row.invoiceTone} />
                        <h3 className="font-medium">
                          {row.company?.name || row.timesheet.brugervirksomhed}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.timesheet.vikar} · Uge {weekNumber(row.timesheet.weekStart)} ·{" "}
                        {formatWeekRange(row.timesheet.weekStart)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreview(row)}
                    >
                      Preview
                    </Button>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Fact label="Godkendte timer" value={`${row.approvedHours.toFixed(2)} t`} />
                    <Fact label="Gangefaktor" value={formatMultiplier(row)} />
                    <Fact label="Ekskl. moms" value={formatDkk(row.invoiceExVat)} />
                    <Fact label="Inkl. moms" value={formatDkk(row.invoiceIncVat)} />
                    <Fact label="Forfaldsdato" value={formatDate(row.invoiceDueDate)} />
                    <Fact label="Status" value={statusLabel(row.invoiceTone)} />
                    <StatusDateInput
                      label="Faktura sendt"
                      value={row.timesheet.invoiceSentDate ?? ""}
                      onChange={(value) =>
                        updateTimesheetDate(row.timesheet, "invoiceSentDate", value)
                      }
                    />
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Lønoverblik</h2>
          </div>
          {payrollRows.length === 0 ? (
            <EmptyState text="Ingen godkendte timesedler klar til bogholder." />
          ) : (
            <div className="divide-y">
              {payrollRows.map((row) => (
                <article key={`payroll-${row.timesheet.id}`} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <StatusDot tone={row.payrollTone} />
                      <div>
                        <h3 className="font-medium">{row.timesheet.vikar}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.company?.name || row.timesheet.brugervirksomhed}
                          {row.project?.name ? ` / ${row.project.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPayrollPreview(row)}
                    >
                      Preview
                    </Button>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Fact
                      label="Lønperiode"
                      value={formatDateRange(row.payrollPeriodStart, row.payrollPeriodEnd)}
                    />
                    <Fact label="Godkendte timer" value={`${row.payrollBasisHours.toFixed(2)} t`} />
                    <Fact label="Godkendelsesstatus" value={row.payrollApprovalStatus} />
                    <Fact label="Frist bogholder" value={formatDate(row.payrollDeadline)} />
                    <Fact label="Status" value={payrollStatusLabel(row)} />
                    <StatusDateInput
                      label="Sendt til bogholderi"
                      value={row.timesheet.payrollSentDate ?? ""}
                      onChange={(value) =>
                        updateTimesheetDate(row.timesheet, "payrollSentDate", value)
                      }
                    />
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {preview && <InvoicePreview row={preview} onClose={() => setPreview(null)} />}
      {payrollPreview && (
        <PayrollPreview
          row={payrollPreview}
          timesheets={timesheets}
          onClose={() => setPayrollPreview(null)}
        />
      )}
    </AppShell>
  );
}

function updateTimesheetDate(
  timesheet: Timesheet,
  field: "invoiceSentDate" | "payrollSentDate",
  value: string,
) {
  upsert({ ...timesheet, [field]: value });
}

function buildWorkContext(timesheet: Timesheet, companies: Company[]): WorkContext {
  const company = findCompany(timesheet, companies);
  const project = company?.projects.find((item) =>
    timesheet.projectId ? item.id === timesheet.projectId : item.name === timesheet.projectName,
  );
  const approvedHours = totalHours(timesheet.days);
  const invoiceDate = invoiceDateForTimesheet(timesheet.weekStart);
  const invoiceDueDate = invoiceDueDateForInvoiceDate(invoiceDate);
  const payrollPeriod = payrollPeriodForWeek(timesheet.weekStart);
  const fallbackPayrollDeadline = addDaysToISODate(payrollPeriod.end, 2);
  const isApprovedForPayroll = isTimesheetApprovedForPayroll(timesheet, payrollPeriod.end);
  const payrollBasisHours = isApprovedForPayroll ? approvedHours : 0;
  const billingMultiplier = project?.billingFactor ?? 0;
  const billingRate =
    project && project.billingHourlyWage > 0 && project.billingFactor > 0
      ? project.billingHourlyWage * project.billingFactor
      : billingMultiplier;
  const calculation = calculateTimesheet(timesheet);
  const invoiceBaseExVat = approvedHours * billingRate;
  const invoiceAllowanceRows = allowanceRowsForCalculation(calculation).map((item) => ({
    ...item,
    amount: item.hours * billingRate,
  }));
  const invoiceAllowanceExVat = invoiceAllowanceRows.reduce((sum, item) => sum + item.amount, 0);
  const invoiceExVat = invoiceBaseExVat + invoiceAllowanceExVat;
  const vat = invoiceExVat * 0.25;
  const payrollDeadline = timesheet.payrollDeadline || fallbackPayrollDeadline;

  return {
    timesheet,
    company,
    project,
    approvedHours,
    invoiceNumber: timesheet.invoiceNumber || `F-${timesheet.id.slice(0, 8).toUpperCase()}`,
    invoiceDate,
    invoiceDueDate,
    payrollDeadline,
    payrollPeriodStart: payrollPeriod.start,
    payrollPeriodEnd: payrollPeriod.end,
    payrollBasisHours,
    payrollBasisAmount: payrollBasisHours * (timesheet.hourlyWage || 0),
    payrollApprovalStatus: payrollApprovalStatus(timesheet, payrollPeriod.end),
    billingMultiplier,
    billingRate,
    invoiceBaseExVat,
    invoiceAllowanceRows,
    invoiceAllowanceExVat,
    invoiceExVat,
    vat,
    invoiceIncVat: invoiceExVat + vat,
    invoiceTone: urgencyTone(invoiceDueDate),
    payrollTone: payrollTone(timesheet, payrollPeriod.end),
  };
}

function findCompany(timesheet: Timesheet, companies: Company[]) {
  return companies.find((company) =>
    timesheet.companyId
      ? company.id === timesheet.companyId
      : company.name.trim().toLowerCase() === timesheet.brugervirksomhed.trim().toLowerCase(),
  );
}

function compareByUrgency(a: WorkContext, b: WorkContext, type: "invoice" | "payroll") {
  const aTone = type === "invoice" ? a.invoiceTone : a.payrollTone;
  const bTone = type === "invoice" ? b.invoiceTone : b.payrollTone;
  const aDeadline = type === "invoice" ? a.invoiceDueDate : a.payrollDeadline;
  const bDeadline = type === "invoice" ? b.invoiceDueDate : b.payrollDeadline;
  const toneDiff = toneRank(aTone) - toneRank(bTone);
  if (toneDiff !== 0) return toneDiff;
  return aDeadline.localeCompare(bDeadline);
}

function comparePayrollRows(a: WorkContext, b: WorkContext) {
  const toneDiff = toneRank(a.payrollTone) - toneRank(b.payrollTone);
  if (toneDiff !== 0) return toneDiff;
  return a.payrollPeriodStart.localeCompare(b.payrollPeriodStart);
}

function toneRank(tone: StatusTone) {
  if (tone === "red") return 0;
  if (tone === "orange") return 1;
  return 2;
}

function urgencyTone(deadline: string): StatusTone {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T12:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days <= 0) return "red";
  if (days <= 3) return "orange";
  return "green";
}

function formatMultiplier(row: WorkContext) {
  const wage = row.project?.billingHourlyWage ?? 0;
  if (wage > 0 && row.billingMultiplier > 0) {
    return `${formatDecimal(wage)} x ${formatDecimal(row.billingMultiplier)} = ${formatDkk(row.billingRate)}`;
  }
  if (row.billingMultiplier > 0) return formatDecimal(row.billingMultiplier);
  return "Ikke sat";
}

function invoiceDateForTimesheet(weekStart: string): string {
  return addDaysToISODate(weekStart, 8);
}

function invoiceDueDateForInvoiceDate(invoiceDate: string): string {
  return addDaysToISODate(invoiceDate, 8);
}

function formatDecimal(value: number) {
  return value.toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusLabel(tone: StatusTone) {
  if (tone === "red") return "Skal håndteres nu";
  if (tone === "orange") return "Skal snart håndteres";
  return "Kræver ikke handling endnu";
}

function payrollPeriodForWeek(weekStart: string) {
  const week = weekNumber(weekStart);
  const start = addDaysToISODate(weekStart, week % 2 === 0 ? -7 : 0);
  return { start, end: addDaysToISODate(start, 13) };
}

function payrollTone(timesheet: Timesheet, periodEnd: string): StatusTone {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${periodEnd}T12:00:00`);
  const autoApprovalDate = new Date(`${addDaysToISODate(periodEnd, 2)}T12:00:00`);

  if (end.getTime() >= today.getTime()) return "green";
  if (isTimesheetApprovedForPayroll(timesheet, periodEnd)) return "red";
  if (autoApprovalDate.getTime() <= today.getTime()) return "red";
  return "orange";
}

function isTimesheetApprovedForPayroll(timesheet: Timesheet, periodEnd: string) {
  if (timesheet.status === "approved") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const autoApprovalDate = new Date(`${addDaysToISODate(periodEnd, 2)}T12:00:00`);
  return timesheet.status === "sent" && autoApprovalDate.getTime() <= today.getTime();
}

function payrollApprovalStatus(timesheet: Timesheet, periodEnd: string) {
  if (timesheet.status === "approved") return "Godkendt";
  if (isTimesheetApprovedForPayroll(timesheet, periodEnd)) return "Autogodkendt";
  if (timesheet.status === "sent") return "Afventer godkendelse/autogodkendelse";
  if (timesheet.status === "rejected") return "Afvist";
  return "Kladde";
}

function payrollStatusLabel(row: WorkContext) {
  if (row.payrollTone === "red") return "Klar til bogholder";
  if (row.payrollTone === "orange") return "Afventer godkendelse/autogodkendelse";
  return "Kræver ikke handling endnu";
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function sicknessBasis(timesheet: Timesheet, timesheets: Timesheet[]) {
  const workerKey = workerLookupKey(timesheet);
  const workerTimesheets = timesheets
    .filter((item) => workerLookupKey(item) === workerKey && item.status !== "draft")
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const sickIsoDates = timesheet.days
    .map((day, index) =>
      day.absence === "sick" ? addDaysToISODate(timesheet.weekStart, index) : "",
    )
    .filter(Boolean)
    .sort();
  const sickDates = sickIsoDates.map(formatDate);
  const employmentStart =
    workerTimesheets
      .map((item) => item.weekStart || item.createdAt.slice(0, 10))
      .filter(Boolean)
      .sort()[0] || timesheet.weekStart;
  const sicknessDate = sickIsoDates[0] || timesheet.weekStart;
  const qualificationStart = addDaysToISODate(sicknessDate, -56);
  const qualificationHours = workerTimesheets
    .filter((item) => item.weekStart >= qualificationStart && item.weekStart <= sicknessDate)
    .reduce((sum, item) => sum + totalHours(item.days), 0);
  const employmentWeeks = daysBetween(employmentStart, sicknessDate) / 7;

  return {
    hasSickAbsence: sickDates.length > 0,
    sickDates,
    employmentStart,
    employmentWeeks,
    qualificationHours,
    eligible: employmentWeeks >= 8 && qualificationHours >= 74,
  };
}

function workerLookupKey(timesheet: Timesheet) {
  return (timesheet.vikarEmail || timesheet.vikar).trim().toLowerCase();
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T12:00:00`).getTime();
  const endTime = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.floor((endTime - startTime) / 86400000));
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-sm text-muted-foreground">{text}</div>;
}

function StatusDot({ tone }: { tone: StatusTone }) {
  const color =
    tone === "red" ? "bg-red-500" : tone === "orange" ? "bg-orange-400" : "bg-emerald-500";
  return <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${color}`} aria-hidden="true" />;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function StatusDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function payrollFinancials(row: WorkContext) {
  const calculation = calculateTimesheet(row.timesheet);
  const hourlyWage = row.timesheet.hourlyWage || 0;
  const hourlyWageWithSocial = hourlyWage * (1 + PAYROLL_SOCIAL_COST_RATE);
  const basePayrollAmount = row.payrollBasisHours * hourlyWageWithSocial;
  const allowanceRows = allowanceRowsForCalculation(calculation).map((item) => ({
    ...item,
    amount: item.hours * hourlyWageWithSocial,
  }));
  const allowanceTotal = allowanceRows.reduce((sum, item) => sum + item.amount, 0);
  const projectName = [row.company?.name || row.timesheet.brugervirksomhed, row.project?.name]
    .filter(Boolean)
    .join(" / ");

  return {
    agreementName: row.timesheet.overenskomst || row.timesheet.selectedAgreementId || "—",
    hourlyWage,
    hourlyWageWithSocial,
    basePayrollAmount,
    allowanceRows,
    allowanceTotal,
    payrollTotal: basePayrollAmount + allowanceTotal,
    projectName,
  };
}

function allowanceRowsForCalculation(
  calculation: ReturnType<typeof calculateTimesheet>,
): Omit<PayrollAllowanceRow, "amount">[] {
  return [
    { label: "Overarbejdstillæg", hours: calculation.overtime },
    {
      label: "Weekend-/søndagstillæg",
      hours: calculation.saturday + calculation.sunday + calculation.weekend,
    },
    { label: "Helligdagstillæg", hours: calculation.publicHoliday },
    { label: "Aftentillæg", hours: calculation.evening },
    { label: "Nattillæg", hours: calculation.night },
    { label: "Skifteholdstillæg", hours: calculation.shift },
  ].filter((item) => item.hours > 0);
}

function PayrollPreview({
  row,
  timesheets,
  onClose,
}: {
  row: WorkContext;
  timesheets: Timesheet[];
  onClose: () => void;
}) {
  const sickness = sicknessBasis(row.timesheet, timesheets);
  const financials = payrollFinancials(row);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <section className="mx-auto max-w-5xl rounded-lg border bg-card p-5 shadow-lg">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Løngrundlag-preview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Internt overblik til bogholder. Sendes ikke automatisk.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => downloadPayrollPdf(row)}>
              Hent løngrundlag som PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Luk preview
            </Button>
          </div>
        </div>

        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <PreviewRow label="Vikar" value={row.timesheet.vikar || "—"} />
          <PreviewRow
            label="Lønperiode"
            value={formatDateRange(row.payrollPeriodStart, row.payrollPeriodEnd)}
          />
          <PreviewRow label="Virksomhed/projekt" value={financials.projectName || "—"} />
          <PreviewRow label="Godkendte timer" value={`${row.payrollBasisHours.toFixed(2)} t`} />
          <PreviewRow label="Godkendelsesstatus" value={row.payrollApprovalStatus} />
          <PreviewRow label="Frist bogholder" value={formatDate(row.payrollDeadline)} />
          <PreviewRow label="Overenskomst" value={financials.agreementName} />
        </dl>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <h3 className="mb-3 font-medium">Løngrundlag</h3>
          <dl className="grid gap-2 md:grid-cols-2">
            <PreviewRow label="Overenskomst" value={financials.agreementName} />
            <PreviewRow label="Registreret timeløn" value={formatDkk(financials.hourlyWage)} />
            <PreviewRow label="Sociale omkostninger" value="38,88 %" />
            <PreviewRow
              label="Timeløn inkl. sociale omkostninger"
              value={formatDkk(financials.hourlyWageWithSocial)}
            />
          </dl>
        </div>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <h3 className="mb-3 font-medium">Grundløn</h3>
          <dl className="grid gap-2 md:grid-cols-2">
            <PreviewRow label="Godkendte timer" value={`${row.payrollBasisHours.toFixed(2)} t`} />
            <PreviewRow
              label="Grundløn inkl. sociale omkostninger"
              value={formatDkk(financials.basePayrollAmount)}
            />
          </dl>
        </div>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <h3 className="mb-3 font-medium">Tillæg</h3>
          {financials.allowanceRows.length === 0 ? (
            <p className="text-muted-foreground">Ingen registrerede tillæg i perioden.</p>
          ) : (
            <dl className="grid gap-2">
              {financials.allowanceRows.map((item) => (
                <PreviewRow key={item.label} label={item.label} value={formatDkk(item.amount)} />
              ))}
            </dl>
          )}
        </div>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <h3 className="mb-3 font-medium">Samlet løngrundlag</h3>
          <PreviewRow label="Total" value={formatDkk(financials.payrollTotal)} strong />
        </div>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <h3 className="mb-3 font-medium">Sygdom</h3>
          {sickness.hasSickAbsence ? (
            <dl className="grid gap-2 md:grid-cols-2">
              <PreviewRow label="Syg registreret" value={sickness.sickDates.join(", ")} />
              <PreviewRow
                label="Første registrerede uge"
                value={formatDate(sickness.employmentStart)}
              />
              <PreviewRow
                label="Anciennitet"
                value={`${sickness.employmentWeeks.toFixed(1)} uger`}
              />
              <PreviewRow
                label="Registrerede arbejdstimer seneste 8 uger"
                value={`${sickness.qualificationHours.toFixed(2)} t`}
              />
              <PreviewRow
                label="Berettiget efter 8 uger / 74 timer"
                value={sickness.eligible ? "Ja" : "Nej"}
              />
              <PreviewRow label="Maks. sygedagpengesats 2026" value="137,43 DKK pr. time" />
            </dl>
          ) : (
            <p className="text-muted-foreground">Ingen sygdom registreret i perioden.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function InvoicePreview({ row, onClose }: { row: WorkContext; onClose: () => void }) {
  const t = row.timesheet;
  const customerName = row.company?.name || t.brugervirksomhed || "—";
  const contactName = t.kontaktperson || row.company?.contactName || "";
  const contactEmail = t.kontaktpersonEmail || row.company?.contactEmail || "";
  const contactPhone = t.kontaktpersonPhone || row.company?.contactPhone || "";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <section className="mx-auto max-w-6xl rounded-lg border bg-card p-5 shadow-lg md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Faktura-preview</h2>
            <p className="mt-1 text-sm text-muted-foreground">Preview sendes ikke automatisk.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => downloadInvoicePdf(row)}>
              Hent faktura som PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Luk preview
            </Button>
          </div>
        </div>
        <div className="grid gap-4 text-sm lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">Sælger</h3>
            <dl className="grid gap-2">
              <PreviewRow label="Navn" value={SELLER.name} />
              <PreviewRow label="Adresse" value={SELLER.address} />
              <PreviewRow label="CVR-nr." value={SELLER.cvr} />
              {SELLER.email && <PreviewRow label="Mail" value={SELLER.email} />}
              {SELLER.phone && <PreviewRow label="Telefon" value={SELLER.phone} />}
            </dl>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">Kunde</h3>
            <dl className="grid gap-2">
              <PreviewRow label="Virksomhed" value={customerName} />
              {row.company?.address && <PreviewRow label="Adresse" value={row.company.address} />}
              {row.company?.cvrNumber && (
                <PreviewRow label="CVR-nr." value={row.company.cvrNumber} />
              )}
              {contactName && <PreviewRow label="Kontaktperson" value={contactName} />}
              {contactEmail && <PreviewRow label="Kontaktpersonens mail" value={contactEmail} />}
              {contactPhone && <PreviewRow label="Kontaktpersonens telefon" value={contactPhone} />}
            </dl>
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-4 text-sm">
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <PreviewRow label="Fakturanummer" value={row.invoiceNumber} />
            <PreviewRow label="Fakturadato" value={formatDate(row.invoiceDate)} />
            <PreviewRow label="Forfaldsdato" value={formatDate(row.invoiceDueDate)} />
          </div>
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <PreviewRow label="Vikar" value={t.vikar || "—"} />
            <PreviewRow
              label="Virksomhed/projekt"
              value={[customerName, row.project?.name].filter(Boolean).join(" / ")}
            />
            <PreviewRow
              label="Uge/periode"
              value={`Uge ${weekNumber(t.weekStart)} · ${formatWeekRange(t.weekStart)}`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="border-b px-3 py-2 font-medium">Beskrivelse</th>
                  <th className="border-b px-3 py-2 text-right font-medium">Antal timer</th>
                  <th className="border-b px-3 py-2 text-right font-medium">Enhedspris</th>
                  <th className="border-b px-3 py-2 text-right font-medium">Beløb ekskl. moms</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b px-3 py-3">Godkendte vikartimer</td>
                  <td className="border-b px-3 py-3 text-right">
                    {row.approvedHours.toFixed(2)} t
                  </td>
                  <td className="border-b px-3 py-3 text-right">{formatDkk(row.billingRate)}</td>
                  <td className="border-b px-3 py-3 text-right">
                    {formatDkk(row.invoiceBaseExVat)}
                  </td>
                </tr>
                {row.invoiceAllowanceRows.map((item) => (
                  <tr key={item.label}>
                    <td className="border-b px-3 py-3">{item.label}</td>
                    <td className="border-b px-3 py-3 text-right">{item.hours.toFixed(2)} t</td>
                    <td className="border-b px-3 py-3 text-right">{formatDkk(row.billingRate)}</td>
                    <td className="border-b px-3 py-3 text-right">{formatDkk(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-4 grid max-w-sm gap-2">
            <PreviewRow label="Subtotal ekskl. moms" value={formatDkk(row.invoiceExVat)} />
            <PreviewRow label="Moms 25 %" value={formatDkk(row.vat)} />
            <PreviewRow label="Total inkl. moms" value={formatDkk(row.invoiceIncVat)} strong />
          </dl>
        </div>
      </section>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="border-b pb-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={strong ? "mt-1 text-lg font-semibold" : "mt-1 font-medium"}>{value}</dd>
    </div>
  );
}

async function downloadInvoicePdf(row: WorkContext) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const t = row.timesheet;
  const customerName = row.company?.name || t.brugervirksomhed || "—";
  const projectName = [customerName, row.project?.name].filter(Boolean).join(" / ");
  const period = `Uge ${weekNumber(t.weekStart)} · ${formatWeekRange(t.weekStart)}`;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");

  try {
    const logoDataUrl = await imageUrlToDataUrl(subzLogo);
    doc.addImage(logoDataUrl, "PNG", 16, 14, 44, 14);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(SELLER.name, 16, 24);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Faktura", 194, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fakturanummer: ${row.invoiceNumber}`, 194, 33, { align: "right" });
  doc.text(`Fakturadato: ${formatDate(row.invoiceDate)}`, 194, 39, { align: "right" });
  doc.text(`Forfaldsdato: ${formatDate(row.invoiceDueDate)}`, 194, 45, { align: "right" });
  doc.text("Betalingsbetingelse: 8 dage netto", 194, 51, { align: "right" });

  const sellerBottom = drawInfoBox(doc, 16, 62, 84, "Sælger", [
    SELLER.name,
    SELLER.address,
    `CVR-nr.: ${SELLER.cvr}`,
    SELLER.email ? `Mail: ${SELLER.email}` : "",
    SELLER.phone ? `Telefon: ${SELLER.phone}` : "",
  ]);
  const customerBottom = drawInfoBox(doc, 110, 62, 84, "Kunde", [
    customerName,
    row.company?.address || "",
    row.company?.cvrNumber ? `CVR-nr.: ${row.company.cvrNumber}` : "",
    t.kontaktperson || row.company?.contactName
      ? `Kontaktperson: ${t.kontaktperson || row.company?.contactName}`
      : "",
    t.kontaktpersonEmail || row.company?.contactEmail
      ? `Mail: ${t.kontaktpersonEmail || row.company?.contactEmail}`
      : "",
    t.kontaktpersonPhone || row.company?.contactPhone
      ? `Telefon: ${t.kontaktpersonPhone || row.company?.contactPhone}`
      : "",
  ]);

  const taskTop = Math.max(sellerBottom, customerBottom) + 10;
  const taskBottom = drawInfoBox(doc, 16, taskTop, 178, "Opgave/periode", [
    `Vikar: ${t.vikar || "—"}`,
    `Virksomhed/projekt: ${projectName || "—"}`,
    `Uge/periode: ${period}`,
    "Beskrivelse: Vikartimer for perioden",
  ]);

  const tableTop = taskBottom + 12;
  const invoiceLineHeight = 10;
  const invoiceTableHeight = 10 + invoiceLineHeight * (1 + row.invoiceAllowanceRows.length);
  doc.setFillColor(245, 247, 250);
  doc.rect(16, tableTop, 178, 10, "F");
  doc.setDrawColor(214, 222, 232);
  doc.rect(16, tableTop, 178, invoiceTableHeight);
  doc.line(16, tableTop + 10, 194, tableTop + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Beskrivelse", 20, tableTop + 7);
  doc.text("Antal timer", 118, tableTop + 7, { align: "right" });
  doc.text("Enhedspris", 153, tableTop + 7, { align: "right" });
  doc.text("Beløb ekskl. moms", 190, tableTop + 7, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Godkendte vikartimer", 20, tableTop + 20);
  doc.text(`${row.approvedHours.toFixed(2)} t`, 118, tableTop + 20, { align: "right" });
  doc.text(formatDkk(row.billingRate), 153, tableTop + 20, { align: "right" });
  doc.text(formatDkk(row.invoiceBaseExVat), 190, tableTop + 20, { align: "right" });

  let invoiceLineY = tableTop + 20;
  row.invoiceAllowanceRows.forEach((item) => {
    invoiceLineY += invoiceLineHeight;
    doc.text(item.label, 20, invoiceLineY);
    doc.text(`${item.hours.toFixed(2)} t`, 118, invoiceLineY, { align: "right" });
    doc.text(formatDkk(row.billingRate), 153, invoiceLineY, { align: "right" });
    doc.text(formatDkk(item.amount), 190, invoiceLineY, { align: "right" });
  });

  const totalsTop = tableTop + invoiceTableHeight + 12;
  drawAmountRow(doc, totalsTop, "Subtotal ekskl. moms", row.invoiceExVat, false);
  drawAmountRow(doc, totalsTop + 8, "Moms 25 %", row.vat, false);
  drawAmountRow(doc, totalsTop + 18, "Total inkl. moms", row.invoiceIncVat, true);

  const paymentLines = [
    PAYMENT.bank ? `Bank: ${PAYMENT.bank}` : "",
    PAYMENT.registrationNumber ? `Reg.nr.: ${PAYMENT.registrationNumber}` : "",
    PAYMENT.accountNumber ? `Kontonr.: ${PAYMENT.accountNumber}` : "",
    PAYMENT.iban ? `IBAN: ${PAYMENT.iban}` : "",
    PAYMENT.swift ? `SWIFT/BIC: ${PAYMENT.swift}` : "",
  ].filter(Boolean);

  if (paymentLines.length > 0) {
    drawInfoBox(doc, 16, totalsTop + 36, 178, "Betalingsoplysninger", [
      ...paymentLines,
      "Betaling bedes mærket med fakturanummer.",
    ]);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Betaling bedes mærket med fakturanummer.", 16, totalsTop + 42);
  }

  doc.save(`faktura-${safeFileName(row.invoiceNumber)}.pdf`);
}

async function downloadPayrollPdf(row: WorkContext) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const financials = payrollFinancials(row);
  const generatedDate = new Date().toISOString().slice(0, 10);
  const period = formatDateRange(row.payrollPeriodStart, row.payrollPeriodEnd);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");

  try {
    const logoDataUrl = await imageUrlToDataUrl(subzLogo);
    doc.addImage(logoDataUrl, "PNG", 16, 14, 44, 14);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(SELLER.name, 16, 24);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Løngrundlag", 194, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Dato: ${formatDate(generatedDate)}`, 194, 34, { align: "right" });
  doc.text("Internt grundlag til bogholder", 194, 41, { align: "right" });

  const workerBottom = drawInfoBox(doc, 16, 56, 84, "Vikar og periode", [
    `Vikar: ${row.timesheet.vikar || "—"}`,
    `Lønperiode: ${period}`,
    `Virksomhed/projekt: ${financials.projectName || "—"}`,
    `Godkendte timer: ${row.payrollBasisHours.toFixed(2)} t`,
  ]);
  const statusBottom = drawInfoBox(doc, 110, 56, 84, "Status", [
    `Godkendelse: ${row.payrollApprovalStatus}`,
    `Frist bogholder: ${formatDate(row.payrollDeadline)}`,
    `Status: ${payrollStatusLabel(row)}`,
  ]);

  const basisTop = Math.max(workerBottom, statusBottom) + 10;
  const basisBottom = drawInfoBox(doc, 16, basisTop, 178, "Løngrundlag", [
    `Overenskomst: ${financials.agreementName}`,
    `Registreret timeløn: ${formatDkk(financials.hourlyWage)}`,
    "Sociale omkostninger: 38,88 %",
    `Timeløn inkl. sociale omkostninger: ${formatDkk(financials.hourlyWageWithSocial)}`,
    `Grundløn inkl. sociale omkostninger: ${formatDkk(financials.basePayrollAmount)}`,
  ]);

  const tableTop = basisBottom + 12;
  doc.setFillColor(245, 247, 250);
  doc.rect(16, tableTop, 178, 10, "F");
  doc.setDrawColor(214, 222, 232);
  doc.rect(16, tableTop, 178, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Tillæg", 20, tableTop + 7);
  doc.text("Timer", 145, tableTop + 7, { align: "right" });
  doc.text("Beløb", 190, tableTop + 7, { align: "right" });

  let cursorY = tableTop + 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (financials.allowanceRows.length === 0) {
    doc.text("Ingen registrerede tillæg i perioden.", 20, cursorY);
    cursorY += 8;
  } else {
    financials.allowanceRows.forEach((item) => {
      doc.text(item.label, 20, cursorY);
      doc.text(`${item.hours.toFixed(2)} t`, 145, cursorY, { align: "right" });
      doc.text(formatDkk(item.amount), 190, cursorY, { align: "right" });
      cursorY += 8;
    });
  }

  doc.setDrawColor(214, 222, 232);
  doc.line(16, cursorY, 194, cursorY);
  cursorY += 10;
  drawAmountRow(doc, cursorY, "Grundløn", financials.basePayrollAmount, false);
  drawAmountRow(doc, cursorY + 8, "Tillæg i alt", financials.allowanceTotal, false);
  drawAmountRow(doc, cursorY + 18, "Samlet løngrundlag", financials.payrollTotal, true);

  doc.save(
    `loengrundlag-${safeFileName(row.timesheet.vikar || row.timesheet.id)}-${row.payrollPeriodStart}.pdf`,
  );
}

function drawInfoBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[],
) {
  const cleanLines = lines.filter((line) => line.trim());
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const wrappedLines = cleanLines.flatMap((line) => doc.splitTextToSize(line, width - 8));
  const height = Math.max(30, 16 + wrappedLines.length * 5);
  doc.setDrawColor(214, 222, 232);
  doc.roundedRect(x, y, width, height, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, x + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  wrappedLines.forEach((line, index) => {
    doc.text(line, x + 4, y + 14 + index * 5);
  });
  return y + height;
}

function drawAmountRow(doc: jsPDF, y: number, label: string, value: number, total: boolean) {
  if (total) {
    doc.setFillColor(31, 78, 121);
    doc.roundedRect(112, y - 5, 82, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
  } else {
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "normal");
  }
  doc.setFontSize(total ? 11 : 10);
  doc.text(label, 116, y + 1);
  doc.text(formatDkk(value), 190, y + 1, { align: "right" });
  doc.setTextColor(17, 24, 39);
}

async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");
}
