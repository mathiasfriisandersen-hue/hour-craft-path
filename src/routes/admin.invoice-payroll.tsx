import { createFileRoute, Link } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Send,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import subzLogo from "@/assets/sub-z-logo.png";
import {
  getAgreementValidationReport,
  type AgreementRuleCategory,
} from "@/lib/agreementValidation";
import { addDaysToISODate } from "@/lib/danishHolidays";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  calculateTimesheet,
  formatDkk,
  formatWeekRange,
  getRule,
  listCompanies,
  overtimeHours,
  totalHours,
  upsert,
  weekNumber,
  type Company,
  type CompanyProject,
  type Timesheet,
} from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/invoice-payroll")({
  head: () => ({ meta: [{ title: "Admin — Faktura & løn" }] }),
  component: InvoicePayrollPage,
});

type StatusTone = "red" | "orange" | "green";
type DashboardTone = "blue" | "amber" | "green" | "slate";
type StatusFilter =
  | "all"
  | "invoice-soon"
  | "invoice-now"
  | "invoice-sent"
  | "payroll-ready"
  | "payroll-waiting"
  | "payroll-sent";

type WorkContext = {
  timesheet: Timesheet;
  company?: Company;
  project?: CompanyProject;
  approvedHours: number;
  invoiceBaseHours: number;
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
  unitPrice?: number;
  hourlyWageLabel?: string;
  quantityLabel?: string;
  amountLabel?: string;
  breakdown?: Array<{ label: string; value: string }>;
  ruleKeys?: AgreementRuleCategory[];
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

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statusser" },
  { value: "invoice-soon", label: "Skal snart håndteres" },
  { value: "invoice-now", label: "Skal håndteres nu" },
  { value: "invoice-sent", label: "Faktura sendt" },
  { value: "payroll-ready", label: "Klar til bogholderi" },
  { value: "payroll-waiting", label: "Kræver ikke handling endnu" },
  { value: "payroll-sent", label: "Sendt til bogholderi" },
];

function InvoicePayrollPage() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [preview, setPreview] = useState<WorkContext | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<WorkContext | null>(null);
  const [view, setView] = useState<"invoice" | "payroll" | "archive">("invoice");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showArchivedInvoices, setShowArchivedInvoices] = useState(false);

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
  const periodOptions = useMemo(() => buildPeriodOptions(rows), [rows]);
  const companyOptions = useMemo(() => buildCompanyOptions(rows), [rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (periodFilter !== "all" && row.timesheet.weekStart !== periodFilter) return false;
        if (companyFilter !== "all" && companyFilterKey(row) !== companyFilter) return false;
        return true;
      }),
    [companyFilter, periodFilter, rows],
  );
const invoiceRows = filteredRows
  .filter(
    (row) =>
      row.timesheet.status === "approved" &&
      row.approvedHours > 0 &&
      !row.timesheet.invoiceArchivedAt,
  )
  .sort((a, b) => compareByUrgency(a, b, "invoice"));

const archivedInvoiceRows = filteredRows
  .filter(
    (row) =>
      row.timesheet.status === "approved" &&
      row.approvedHours > 0 &&
      row.timesheet.invoiceArchivedAt,
  )
  .sort((a, b) =>
    (b.timesheet.invoiceArchivedAt ?? "").localeCompare(a.timesheet.invoiceArchivedAt ?? ""),
  );
  const payrollRows = filteredRows
  .filter((row) => {
    const timesheet = row.timesheet as any;

    const workerIsDeleted =
      timesheet.workerDeleted === true ||
      timesheet.deleted === true ||
      timesheet.workerStatus === "deleted" ||
      timesheet.workerStatus === "inactive" ||
      timesheet.workerActive === false;

    return (
      (timesheet.status === "sent" || timesheet.status === "approved") &&
      totalHours(timesheet.days) > 0 &&
      !workerIsDeleted
    );
  })
  .sort(comparePayrollRows);
  const invoiceSentRows = invoiceRows.filter(
    (row) => statusFilterMatches(statusFilter, "invoice-sent") && row.timesheet.invoiceSentDate,
  );
  const invoiceNowRows = invoiceRows.filter(
    (row) =>
      statusFilterMatches(statusFilter, "invoice-now") &&
      !row.timesheet.invoiceSentDate &&
      row.invoiceTone === "red",
  );
  const invoiceSoonRows = invoiceRows.filter(
    (row) =>
      statusFilterMatches(statusFilter, "invoice-soon") &&
      !row.timesheet.invoiceSentDate &&
      row.invoiceTone !== "red",
  );
  const payrollSentRows = payrollRows.filter(
    (row) => statusFilterMatches(statusFilter, "payroll-sent") && row.timesheet.payrollSentDate,
  );
  const payrollReadyRows = payrollRows.filter(
    (row) =>
      statusFilterMatches(statusFilter, "payroll-ready") &&
      !row.timesheet.payrollSentDate &&
      row.payrollTone === "red",
  );
  const payrollWaitingRows = payrollRows.filter(
    (row) =>
      statusFilterMatches(statusFilter, "payroll-waiting") &&
      !row.timesheet.payrollSentDate &&
      row.payrollTone !== "red",
  );
  const visibleInvoiceCount =
    invoiceSoonRows.length + invoiceNowRows.length + invoiceSentRows.length;
  const visiblePayrollCount =
    payrollReadyRows.length + payrollWaitingRows.length + payrollSentRows.length;
  const sentCount = invoiceSentRows.length + payrollSentRows.length;
  const actionCount = invoiceNowRows.length + payrollReadyRows.length;
  const activeFilterCount = [periodFilter, companyFilter, statusFilter].filter(
    (value) => value !== "all",
  ).length;
  const resetFilters = () => {
    setPeriodFilter("all");
    setCompanyFilter("all");
    setStatusFilter("all");
  };

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Faktura & løn",
        subtitle: "Administrativt overblik over godkendte timer til fakturering og bogholderi.",
      }}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceKpiCard
            label="Samlede fakturaer"
            value={visibleInvoiceCount}
            meta="Godkendte timesedler klar til faktura"
            icon={FileText}
            tone="blue"
          />
          <FinanceKpiCard
            label="Klar til bogholderi"
            value={payrollReadyRows.length}
            meta="Eksisterende lønstatus kræver handling"
            icon={WalletCards}
            tone="amber"
          />
          <FinanceKpiCard
            label="Sendt"
            value={sentCount}
            meta="Faktura eller løn markeret sendt"
            icon={Send}
            tone="green"
          />
          <FinanceKpiCard
            label="Kræver handling"
            value={actionCount}
            meta="Faktura eller løn skal håndteres nu"
            icon={Clock3}
            tone="slate"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Datagrundlag</h2>
              <p className="mt-1 text-sm text-slate-500">
                Siden viser alle ikke-arkiverede timesedler fra eksisterende faktura- og lønlogik.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Til dashboard</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ScopeSelect
              icon={CalendarDays}
              label="Periode"
              value={periodFilter}
              onChange={setPeriodFilter}
              options={[{ value: "all", label: "Alle eksisterende perioder" }, ...periodOptions]}
            />
            <ScopeSelect
              icon={Building2}
              label="Virksomhed"
              value={companyFilter}
              onChange={setCompanyFilter}
              options={[{ value: "all", label: "Alle virksomheder" }, ...companyOptions]}
            />
            <ScopeSelect
              icon={CheckCircle2}
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={STATUS_FILTER_OPTIONS}
            />
            <ScopeResetButton activeFilterCount={activeFilterCount} onClick={resetFilters} />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
  <div className="flex flex-wrap gap-2">
    <ViewToggleButton
      active={view === "invoice"}
      onClick={() => setView("invoice")}
      label="Fakturaoverblik"
      count={visibleInvoiceCount}
    />
    <ViewToggleButton
      active={view === "payroll"}
      onClick={() => setView("payroll")}
      label="Lønoverblik"
      count={visiblePayrollCount}
    />
  </div>

  <button
    type="button"
    onClick={() => setView("archive")}
    className={cn(
      "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
      view === "archive"
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950",
    )}
  >
    <span>Arkiverede dokumenter</span>
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        view === "archive" ? "bg-white/20 text-white" : "bg-white text-slate-500",
      )}
    >
      {archivedInvoiceRows.length}
    </span>
  </button>
</div>

        {view === "invoice" ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Fakturaoverblik"
              count={visibleInvoiceCount}
              actionLabel="Se alle fakturaer"
            />
            <div className="grid gap-4 p-4 xl:grid-cols-3">
              <StatusColumn
                title="Skal håndteres nu"
                count={invoiceSoonRows.length}
                tone="orange"
                empty="Ingen fakturaer i denne status."
              >
                {invoiceSoonRows.map((row) => (
                  <InvoiceCaseCard
                    key={`invoice-soon-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPreview(row)}
                  />
                ))}
              </StatusColumn>
              <StatusColumn
                title="Skal snart håndteres"
                count={invoiceNowRows.length}
                tone="red"
                empty="Ingen fakturaer kræver handling lige nu."
              >
                {invoiceNowRows.map((row) => (
                  <InvoiceCaseCard
                    key={`invoice-now-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPreview(row)}
                  />
                ))}
              </StatusColumn>
              <StatusColumn
                title="Faktura sendt"
                count={invoiceSentRows.length}
                tone="green"
                empty="Ingen fakturaer er markeret sendt."
              >
                {invoiceSentRows.map((row) => (
                  <InvoiceCaseCard
                    key={`invoice-sent-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPreview(row)}
                  />
                ))}
              </StatusColumn>
              <StatusColumn
  title="Arkiverede dokumenter"
  count={archivedInvoiceRows.length}
  tone="slate"
  empty="Ingen arkiverede fakturaer."
>
  {archivedInvoiceRows.map((row) => (
    <InvoiceCaseCard
      key={`invoice-archived-${row.timesheet.id}`}
      row={row}
      onPreview={() => setPreview(row)}
    />
  ))}
</StatusColumn>
            </div>
          </section>
        ) : view === "payroll" ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Lønoverblik"
              count={visiblePayrollCount}
              actionLabel="Se alle lønoplysninger"
            />
            <div className="grid gap-4 p-4 xl:grid-cols-3">
              <StatusColumn
                title="Klar til bogholderi"
                count={payrollReadyRows.length}
                tone="orange"
                empty="Ingen lønsager er klar til bogholderi."
              >
                {payrollReadyRows.map((row) => (
                  <PayrollCaseCard
                    key={`payroll-ready-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPayrollPreview(row)}
                  />
                ))}
              </StatusColumn>
              <StatusColumn
                title="Kræver ikke handling endnu"
                count={payrollWaitingRows.length}
                tone="slate"
                empty="Ingen lønsager afventer."
              >
                {payrollWaitingRows.map((row) => (
                  <PayrollCaseCard
                    key={`payroll-waiting-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPayrollPreview(row)}
                  />
                ))}
              </StatusColumn>
              <StatusColumn
                title="Sendt til bogholderi"
                count={payrollSentRows.length}
                tone="green"
                empty="Ingen lønsager er markeret sendt."
              >
                {payrollSentRows.map((row) => (
                  <PayrollCaseCard
                    key={`payroll-sent-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPayrollPreview(row)}
                  />
                ))}
              </StatusColumn>
            </div>
          </section>
                ) : (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Arkiverede dokumenter"
              count={archivedInvoiceRows.length}
              actionLabel="Arkiverede fakturaer"
            />

            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {archivedInvoiceRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                  Ingen arkiverede fakturaer.
                </div>
              ) : (
                archivedInvoiceRows.map((row) => (
                  <InvoiceCaseCard
                    key={`invoice-archived-${row.timesheet.id}`}
                    row={row}
                    onPreview={() => setPreview(row)}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {showArchivedInvoices && (
  <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowArchivedInvoices(false)}>
    <aside
      className="ml-auto h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Arkiverede dokumenter</h2>
          <p className="mt-1 text-sm text-slate-500">Arkiverede fakturaer.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowArchivedInvoices(false)}
        >
          Luk
        </Button>
      </div>

      {archivedInvoiceRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Ingen arkiverede fakturaer.
        </div>
      ) : (
        <div className="space-y-3">
          {archivedInvoiceRows.map((row) => (
            <article
              key={`archived-invoice-panel-${row.timesheet.id}`}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="text-sm font-semibold text-slate-950">{row.invoiceNumber}</div>
              <div className="mt-1 text-xs text-slate-500">
                {row.company?.name || row.timesheet.brugervirksomhed} · {row.timesheet.vikar}
              </div>

              <dl className="mt-3 grid gap-2 text-sm">
                <Fact label="Fakturadato" value={formatDate(row.invoiceDate)} />
                <Fact label="Total inkl. moms" value={formatDkk(row.invoiceIncVat)} />
              </dl>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowArchivedInvoices(false);
                    setPreview(row);
                  }}
                >
                  Preview
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  </div>
)}

      {preview && (
  <InvoicePreview
    row={preview}
    onArchive={() => {
      archiveInvoice(preview);
      setPreview(null);
    }}
    onClose={() => setPreview(null)}
  />
)}
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

function FinanceKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  meta: string;
  icon: LucideIcon;
  tone: DashboardTone;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-11 w-11 place-items-center rounded-lg", toneIconClass(tone))}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none text-slate-950 tabular-nums">
        {value}
      </div>
      <div className={cn("mt-2 text-xs font-medium", toneTextClass(tone))}>{meta}</div>
    </article>
  );
}

function ScopeSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-slate-500 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-0.5 w-full truncate bg-transparent text-sm font-semibold text-slate-900 outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ScopeResetButton({
  activeFilterCount,
  onClick,
}: {
  activeFilterCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={activeFilterCount === 0}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-slate-500 shadow-sm">
        <Clock3 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">Filtre</div>
        <div className="truncate text-sm font-semibold text-slate-900">
          {activeFilterCount > 0 ? `Nulstil ${activeFilterCount} filter` : "Ingen aktive filtre"}
        </div>
      </div>
    </button>
  );
}

function SectionHeader({
  title,
  count,
  actionLabel,
}: {
  title: string;
  count: number;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {count}
        </span>
      </div>
      <span className="text-sm font-medium text-blue-600">{actionLabel}</span>
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-44 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          active ? "bg-white/20 text-white" : "bg-white text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatusColumn({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: StatusTone | "slate";
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="min-h-64 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ColumnDot tone={tone} />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {empty}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function statusFilterMatches(current: StatusFilter, target: Exclude<StatusFilter, "all">): boolean {
  return current === "all" || current === target;
}

function companyFilterKey(row: WorkContext): string {
  return row.company?.id || row.timesheet.companyId || row.timesheet.brugervirksomhed || "unknown";
}

function buildCompanyOptions(rows: WorkContext[]): Array<{ value: string; label: string }> {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = companyFilterKey(row);
    const label = row.company?.name || row.timesheet.brugervirksomhed || "Ukendt virksomhed";
    if (!byKey.has(key)) byKey.set(key, label);
  }
  return [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "da-DK"));
}

function buildPeriodOptions(rows: WorkContext[]): Array<{ value: string; label: string }> {
  const periods = new Set(rows.map((row) => row.timesheet.weekStart).filter(Boolean));
  return [...periods]
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({
      value,
      label: `Uge ${weekNumber(value)} · ${formatWeekRange(value)}`,
    }));
}

function InvoiceCaseCard({ row, onPreview }: { row: WorkContext; onPreview: () => void }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">
            {row.company?.name || row.timesheet.brugervirksomhed}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {row.timesheet.vikar} · Uge {weekNumber(row.timesheet.weekStart)}
          </div>
        </div>
        <div className="text-right text-sm font-semibold text-slate-950">
          {row.approvedHours.toFixed(2)} t
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Periode" value={formatWeekRange(row.timesheet.weekStart)} />
          <Fact label="Forfaldsdato" value={formatDate(row.invoiceDueDate)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Ekskl. moms" value={formatDkk(row.invoiceExVat)} />
          <Fact label="Inkl. moms" value={formatDkk(row.invoiceIncVat)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Gangefaktor" value={formatMultiplier(row)} />
          <Fact label="Status" value={statusLabel(row.invoiceTone)} />
        </div>
        <StatusDateInput
          label="Faktura sendt"
          value={row.timesheet.invoiceSentDate ?? ""}
          onChange={(value) => updateTimesheetDate(row.timesheet, "invoiceSentDate", value)}
        />
      </dl>

      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onPreview}>
          Preview
        </Button>
      </div>
    </article>
  );
}

function PayrollCaseCard({ row, onPreview }: { row: WorkContext; onPreview: () => void }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{row.timesheet.vikar}</div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {row.company?.name || row.timesheet.brugervirksomhed}
            {row.project?.name ? ` / ${row.project.name}` : ""}
          </div>
        </div>
        <div className="text-right text-sm font-semibold text-slate-950">
          {row.approvedHours.toFixed(2)} t
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Fact label="Godkendelse" value={row.payrollApprovalStatus} />
        <Fact label="Frist bogholder" value={formatDate(row.payrollDeadline)} />
      </dl>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <StatusDateInput
          label="Sendt til bogholderi"
          value={row.timesheet.payrollSentDate ?? ""}
          onChange={(value) => updateTimesheetDate(row.timesheet, "payrollSentDate", value)}
        />
        <Button type="button" variant="outline" size="sm" onClick={onPreview}>
          Preview
        </Button>
      </div>
    </article>
  );
}

function ColumnDot({ tone }: { tone: StatusTone | "slate" }) {
  const color =
    tone === "red"
      ? "bg-red-500"
      : tone === "orange"
        ? "bg-amber-400"
        : tone === "green"
          ? "bg-emerald-500"
          : "bg-slate-300";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />;
}

function toneIconClass(tone: DashboardTone): string {
  if (tone === "blue") return "bg-blue-50 text-blue-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  return "bg-slate-100 text-slate-500";
}

function toneTextClass(tone: DashboardTone): string {
  if (tone === "blue") return "text-blue-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "green") return "text-emerald-600";
  return "text-slate-500";
}

function updateTimesheetDate(
  timesheet: Timesheet,
  field: "invoiceSentDate" | "payrollSentDate",
  value: string,
) {
  upsert({ ...timesheet, [field]: value });
}

function archiveInvoice(row: WorkContext) {
  upsert({
    ...row.timesheet,
    invoiceArchivedAt: new Date().toISOString(),
  });
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
  const invoiceAllowanceRows = invoiceAllowanceRowsForCalculation(
    timesheet,
    calculation,
    project,
    billingRate,
    payrollPeriod.end,
  );
  const invoiceOvertimeHours = invoiceAllowanceRows.reduce(
    (sum, item) => sum + (item.ruleKeys?.includes("overtime") ? item.hours : 0),
    0,
  );
  const invoiceBaseHours = Math.max(0, approvedHours - invoiceOvertimeHours);
  const invoiceBaseExVat = invoiceBaseHours * billingRate;
  const invoiceAllowanceExVat = invoiceAllowanceRows.reduce((sum, item) => sum + item.amount, 0);
  const invoiceExVat = invoiceBaseExVat + invoiceAllowanceExVat;
  const vat = invoiceExVat * 0.25;
  const payrollDeadline = timesheet.payrollDeadline || fallbackPayrollDeadline;

  return {
    timesheet,
    company,
    project,
    approvedHours,
    invoiceBaseHours,
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

  if (isTimesheetApprovedForPayroll(timesheet, periodEnd)) return "red";
  if (autoApprovalDate.getTime() <= today.getTime()) return "red";
  if (end.getTime() >= today.getTime()) return "green";
  return "orange";
}

function isTimesheetApprovedForPayroll(timesheet: Timesheet, periodEnd: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${periodEnd}T12:00:00`);
  const autoApprovalDate = new Date(`${addDaysToISODate(periodEnd, 2)}T12:00:00`);

  if (end.getTime() >= today.getTime()) return false;
  if (timesheet.status === "approved") return true;
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

function workDateRange(timesheet: Timesheet) {
  const workDates = timesheet.days
    .map((day, index) =>
      day.absence === "none" && day.start && day.end ? addDaysToISODate(timesheet.weekStart, index) : "",
    )
    .filter(Boolean);
  if (!workDates.length) return "—";
  const sortedDates = workDates.sort();
  return `Start ${formatDate(sortedDates[0])} · Slut ${formatDate(sortedDates.at(-1) ?? sortedDates[0])}`;
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

function payrollHourlyWage(row: WorkContext) {
  return row.timesheet.hourlyWage || row.project?.billingHourlyWage || 0;
}

function payrollFinancials(row: WorkContext) {
  const calculation = calculateTimesheet(row.timesheet);
  const hourlyWage = payrollHourlyWage(row);
  const hourlyWageWithSocial = hourlyWage * (1 + PAYROLL_SOCIAL_COST_RATE);
  const payrollOvertime = payrollOvertimeHoursForCalculation(row, calculation);
  const basePayrollHours = Math.max(0, row.approvedHours - payrollOvertime);
  const basePayrollAmount = basePayrollHours * hourlyWageWithSocial;
  const allowanceRows = payrollAllowanceRowsForCalculation(
    row,
    calculation,
    hourlyWage,
    payrollOvertime,
  );
  const allowanceTotal = allowanceRows.reduce((sum, item) => sum + item.amount, 0);
  const projectName = [row.company?.name || row.timesheet.brugervirksomhed, row.project?.name]
    .filter(Boolean)
    .join(" / ");

  return {
    agreementName: row.timesheet.overenskomst || row.timesheet.selectedAgreementId || "—",
    hourlyWage,
    hourlyWageWithSocial,
    basePayrollHours,
    basePayrollAmount,
    allowanceRows,
    allowanceTotal,
    payrollTotal: basePayrollAmount + allowanceTotal,
    projectName,
  };
}

function payrollOvertimeHoursForCalculation(
  row: WorkContext,
  calculation: ReturnType<typeof calculateTimesheet>,
) {
  return effectiveOvertimeHours(row.timesheet, calculation);
}

function effectiveOvertimeHours(
  timesheet: Timesheet,
  calculation: ReturnType<typeof calculateTimesheet>,
) {
  const normalWeekHours = getRule(timesheet.selectedAgreementId)?.normalWeekHours;
  const weeklyLimit = normalWeekHours && normalWeekHours > 0 ? normalWeekHours : 37;
  return Math.max(calculation.overtime, overtimeHours(timesheet.days, weeklyLimit));
}

function invoiceAllowanceLabel(label: string) {
  return label === "Overarbejdsløn" ? "Overarbejdstillæg" : label;
}

function invoiceBaseLineLabel(row: WorkContext) {
  return row.invoiceBaseHours < row.approvedHours
    ? "Almindelige vikartimer"
    : "Godkendte vikartimer";
}

function invoiceAllowanceRowsForCalculation(
  timesheet: Timesheet,
  calculation: ReturnType<typeof calculateTimesheet>,
  project: CompanyProject | undefined,
  billingRate: number,
  periodEnd: string,
): PayrollAllowanceRow[] {
  const validationReport = getAgreementValidationReport(timesheet.selectedAgreementId);
  const projectFactor = project?.billingFactor ?? 0;
  const baseHourlyWage = project?.billingHourlyWage ?? 0;

  return allowanceRowsForCalculation(calculation, {
    overtime: effectiveOvertimeHours(timesheet, calculation),
  }).flatMap((item) => {
    if (item.ruleKeys?.includes("overtime")) {
      const overtimeRows = invoiceOvertimeAllowanceRows(
        validationReport,
        item.hours,
        baseHourlyWage,
        projectFactor,
        periodEnd,
      );
      if (overtimeRows.length) return overtimeRows;
      const rate = allowanceRateForRule(validationReport, item.ruleKeys);
      if (rate && baseHourlyWage > 0 && projectFactor > 0) {
        const unitPrice = (baseHourlyWage + rate) * projectFactor;
        return [
          {
            ...item,
            label: "Overarbejde inkl. tillæg",
            unitPrice,
            amount: item.hours * unitPrice,
          },
        ];
      }
      return [];
    }

    return [
      {
        ...item,
        label: invoiceAllowanceLabel(item.label),
        unitPrice: billingRate,
        amount: item.hours * billingRate,
      },
    ];
  });
}

function invoiceOvertimeAllowanceRows(
  validationReport: ReturnType<typeof getAgreementValidationReport>,
  hours: number,
  baseHourlyWage: number,
  projectFactor: number,
  periodEnd: string,
): PayrollAllowanceRow[] {
  if (
    !validationReport?.validatedForCalculation ||
    hours <= 0 ||
    baseHourlyWage <= 0 ||
    projectFactor <= 0
  ) {
    return [];
  }
  const overtimeRule = validationReport.rules.find((rule) => rule.ruleKey === "overtime");
  const tiers = overtimeRateTiersForDate(overtimeRule?.possibleRates ?? [], periodEnd);
  if (tiers.length < 3) return [];

  return allocateOvertimeHoursToTiers(hours, tiers).map((tier) => {
    const unitPrice = (baseHourlyWage + tier.rate) * projectFactor;
    return {
      label: `Overarbejde ${tier.label}`,
      hours: tier.hours,
      unitPrice,
      amount: tier.hours * unitPrice,
      ruleKeys: ["overtime", "outside_normal_time"],
    };
  });
}

function payrollAllowanceRowsForCalculation(
  row: WorkContext,
  calculation: ReturnType<typeof calculateTimesheet>,
  hourlyWage: number,
  payrollOvertime = payrollOvertimeHoursForCalculation(row, calculation),
): PayrollAllowanceRow[] {
  const validationReport = getAgreementValidationReport(row.timesheet.selectedAgreementId);
  const rows: PayrollAllowanceRow[] = allowanceRowsForCalculation(calculation, {
    overtime: payrollOvertime,
  }).map((item) => {
    const overtimeRatePlan = item.ruleKeys?.includes("overtime")
      ? overtimeAllowanceRatePlan(row, validationReport, item.hours, hourlyWage)
      : undefined;
    const rate = overtimeRatePlan ? undefined : allowanceRateForRule(validationReport, item.ruleKeys);
    const amount =
      overtimeRatePlan?.amount ?? (rate ? item.hours * rate * (1 + PAYROLL_SOCIAL_COST_RATE) : 0);
    return {
      ...item,
      amount,
      hourlyWageLabel: `Timeløn i perioden: ${formatDkk(hourlyWage)}`,
      amountLabel:
        overtimeRatePlan?.label ??
        (rate
          ? `${formatDkk(rate)}/t + sociale omkostninger = ${formatDkk(amount)}`
          : allowanceRateStatusLabel(validationReport, item.ruleKeys)),
      breakdown: overtimeRatePlan?.breakdown,
    };
  });

  if (calculation.delayedMealBreakDays > 0) {
    const delayedMealBreakAmount =
      calculation.delayedMealBreakAmount * (1 + PAYROLL_SOCIAL_COST_RATE);
    rows.push({
      label: "Udsat spisepause",
      hours: 0,
      quantityLabel: `${calculation.delayedMealBreakDays} ${
        calculation.delayedMealBreakDays === 1 ? "dag" : "dage"
      }`,
      amount: delayedMealBreakAmount,
      amountLabel: `${formatDkk(
        calculation.delayedMealBreakAmount,
      )} + sociale omkostninger = ${formatDkk(delayedMealBreakAmount)}`,
    });
  }

  if (calculation.localAgreement > 0) {
    rows.push({
      label: "Lokalaftale",
      hours: calculation.localAgreement,
      amount: 0,
      amountLabel: allowanceRateStatusLabel(validationReport, ["local_agreements"]),
      ruleKeys: ["local_agreements"],
    });
  }

  return rows;
}

type OvertimeRateTier = {
  label: string;
  hours: number;
  rate: number;
};

type AppliedOvertimeRateTier = OvertimeRateTier & {
  hours: number;
};

function overtimeAllowanceRatePlan(
  row: WorkContext,
  validationReport: ReturnType<typeof getAgreementValidationReport>,
  hours: number,
  hourlyWage: number,
) {
  if (!validationReport?.validatedForCalculation || hours <= 0) return undefined;
  const overtimeRule = validationReport.rules.find((rule) => rule.ruleKey === "overtime");
  const tiers = overtimeRateTiersForDate(overtimeRule?.possibleRates ?? [], row.payrollPeriodEnd);
  if (tiers.length < 3) return undefined;

  const appliedTiers = allocateOvertimeHoursToTiers(hours, tiers);
  if (!appliedTiers.length) return undefined;

  const overtimePayrollAmount = appliedTiers.reduce(
    (sum, tier) => sum + tier.hours * (hourlyWage + tier.rate),
    0,
  );
  const amount = overtimePayrollAmount * (1 + PAYROLL_SOCIAL_COST_RATE);
  return {
    amount,
    label: formatDkk(amount),
    breakdown: [
      { label: "Timer", value: `${hours.toFixed(2)} t` },
      { label: "Grundtimeløn", value: `${formatDkk(hourlyWage)}/t` },
      ...appliedTiers.map((tier) => ({
        label: tier.label,
        value: `${tier.hours.toFixed(2)} t x ${formatDkk(hourlyWage + tier.rate)}/t = ${formatDkk(
          tier.hours * (hourlyWage + tier.rate),
        )}`,
      })),
      { label: "Før sociale omkostninger", value: formatDkk(overtimePayrollAmount) },
      { label: "Inkl. sociale omkostninger", value: formatDkk(amount) },
    ],
  };
}

function overtimeRateTiersForDate(possibleRates: string[], isoDate: string): OvertimeRateTier[] {
  const tierMatchers: Array<{ label: string; pattern: RegExp; hours: number }> = [
    { label: "1.-2. klokketime", pattern: /første(?:\/|\s+og\s+)anden/i, hours: 2 },
    { label: "3.-4. klokketime", pattern: /tredje(?:\/|\s+og\s+)fjerde/i, hours: 2 },
    { label: "5.+ klokketime", pattern: /femte/i, hours: Number.POSITIVE_INFINITY },
  ];
  return tierMatchers.flatMap((tier) => {
    const line = possibleRates.find((rateText) => tier.pattern.test(rateText));
    const rate = line ? rateForDate(line, isoDate) : undefined;
    return rate ? [{ label: tier.label, hours: tier.hours, rate }] : [];
  });
}

function allocateOvertimeHoursToTiers(
  hours: number,
  tiers: OvertimeRateTier[],
): AppliedOvertimeRateTier[] {
  let remainingHours = hours;
  return tiers.flatMap((tier) => {
    if (remainingHours <= 0) return [];
    const tierHours = Math.min(remainingHours, tier.hours);
    remainingHours -= tierHours;
    return [{ ...tier, hours: tierHours }];
  });
}

function rateForDate(rateText: string, isoDate: string) {
  const target = new Date(`${isoDate}T12:00:00`).getTime();
  const matches = [
    ...rateText.matchAll(
      /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(?:kr\.\s*)?(\d+(?:,\d+)?)(?:\s*kr\.)?/gi,
    ),
  ];
  const rates = matches
    .map((match) => {
      const [, day, month, year, amount] = match;
      const effectiveDate = new Date(
        `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T12:00:00`,
      ).getTime();
      return {
        effectiveDate,
        amount: Number(amount.replace(",", ".")),
      };
    })
    .filter((item) => Number.isFinite(item.effectiveDate) && Number.isFinite(item.amount))
    .sort((a, b) => a.effectiveDate - b.effectiveDate);
  const currentRate = rates.filter((item) => item.effectiveDate <= target).at(-1) ?? rates[0];
  return currentRate?.amount;
}

function allowanceRateForRule(
  validationReport: ReturnType<typeof getAgreementValidationReport>,
  ruleKeys: AgreementRuleCategory[] | undefined,
) {
  if (!validationReport || !ruleKeys?.length) return undefined;
  const matchingRates = validationReport.rules
    .filter(
      (rule) =>
        ruleKeys.includes(rule.ruleKey) &&
        rule.reviewStatus === "approved" &&
        rule.calculationType === "fixed_rate" &&
        typeof rule.rate === "number" &&
        Number.isFinite(rule.rate) &&
        rule.rate > 0 &&
        (rule.unit || "").toLowerCase().includes("kr"),
    )
    .map((rule) => rule.rate as number);
  const uniqueRates = [...new Set(matchingRates)];
  return uniqueRates.length === 1 ? uniqueRates[0] : undefined;
}

function allowanceRateStatusLabel(
  validationReport: ReturnType<typeof getAgreementValidationReport>,
  ruleKeys: AgreementRuleCategory[] | undefined,
) {
  if (!validationReport?.validatedForCalculation) return "Tillægssats kræver validering";
  const matchingRules = validationReport.rules.filter((rule) => ruleKeys?.includes(rule.ruleKey));
  if (matchingRules.some((rule) => rule.possibleRates.length > 1)) {
    return "Valideret: flere satstrin i regelgrundlag";
  }
  return "Valideret: sats ikke struktureret som én timesats";
}

function allowanceRowsForCalculation(
  calculation: ReturnType<typeof calculateTimesheet>,
  overrides: { overtime?: number } = {},
): Omit<PayrollAllowanceRow, "amount">[] {
  return [
    {
      label: "Overarbejdsløn",
      hours: overrides.overtime ?? calculation.overtime,
      ruleKeys: ["overtime", "outside_normal_time"],
    },
    {
      label: "Weekend-/søndagstillæg",
      hours: calculation.saturday + calculation.sunday + calculation.weekend,
      ruleKeys: ["saturday_allowance", "sunday_allowance", "local_agreements"],
    },
    {
      label: "Helligdagstillæg",
      hours: calculation.publicHoliday,
      ruleKeys: ["public_holiday", "sunday_allowance"],
    },
    {
      label: "Aftentillæg",
      hours: calculation.evening,
      ruleKeys: ["evening_allowance", "staggered_time"],
    },
    { label: "Nattillæg", hours: calculation.night, ruleKeys: ["night_allowance"] },
    { label: "Skifteholdstillæg", hours: calculation.shift, ruleKeys: ["shift_work"] },
  ].filter((item) => item.hours > 0);
}

function allowanceQuantityLabel(item: PayrollAllowanceRow) {
  return item.quantityLabel ?? `${item.hours.toFixed(2)} t`;
}

function allowanceAmountLabel(item: PayrollAllowanceRow) {
  return item.amountLabel ?? formatDkk(item.amount);
}

function allowancePdfAmountLabel(item: PayrollAllowanceRow) {
  if (item.hourlyWageLabel) return `${item.hourlyWageLabel}; ${allowanceAmountLabel(item)}`;
  return allowanceAmountLabel(item);
}

function PayrollAllowancePreviewItem({ item }: { item: PayrollAllowanceRow }) {
  return (
    <div className="border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{item.label}</div>
          <div className="mt-1 font-medium">{allowanceQuantityLabel(item)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Beløb</div>
          <div className="mt-1 font-semibold">{allowanceAmountLabel(item)}</div>
        </div>
      </div>
      {item.breakdown?.length ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
          {item.breakdown.map((line) => (
            <div key={`${item.label}-${line.label}`} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{line.label}</dt>
              <dd className="mt-0.5 break-words font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : item.hourlyWageLabel ? (
        <div className="mt-2 text-sm text-muted-foreground">{item.hourlyWageLabel}</div>
      ) : null}
    </div>
  );
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

        <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <PreviewRow label="Vikar" value={row.timesheet.vikar || "—"} />
          <PreviewRow
            label="Lønperiode"
            value={formatDateRange(row.payrollPeriodStart, row.payrollPeriodEnd)}
          />
          <PreviewRow label="Arbejdet" value={workDateRange(row.timesheet)} />
          <PreviewRow label="Virksomhed/projekt" value={financials.projectName || "—"} />
          <PreviewRow label="Godkendte timer" value={`${row.approvedHours.toFixed(2)} t`} />
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
            <PreviewRow label="Grundtimer" value={`${financials.basePayrollHours.toFixed(2)} t`} />
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
            <div className="grid gap-4">
              {financials.allowanceRows.map((item) => (
                <PayrollAllowancePreviewItem key={item.label} item={item} />
              ))}
            </div>
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

function InvoicePreview({
  row,
  onArchive,
  onClose,
}: {
  row: WorkContext;
  onArchive: () => void;
  onClose: () => void;
}) {
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
<Button type="button" variant="outline" size="sm" onClick={onArchive}>
  Arkiver
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
                  <td className="border-b px-3 py-3">{invoiceBaseLineLabel(row)}</td>
                  <td className="border-b px-3 py-3 text-right">
                    {row.invoiceBaseHours.toFixed(2)} t
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
                    <td className="border-b px-3 py-3 text-right">
                      {formatDkk(item.unitPrice ?? row.billingRate)}
                    </td>
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
  doc.text(invoiceBaseLineLabel(row), 20, tableTop + 20);
  doc.text(`${row.invoiceBaseHours.toFixed(2)} t`, 118, tableTop + 20, { align: "right" });
  doc.text(formatDkk(row.billingRate), 153, tableTop + 20, { align: "right" });
  doc.text(formatDkk(row.invoiceBaseExVat), 190, tableTop + 20, { align: "right" });

  let invoiceLineY = tableTop + 20;
  row.invoiceAllowanceRows.forEach((item) => {
    invoiceLineY += invoiceLineHeight;
    doc.text(item.label, 20, invoiceLineY);
    doc.text(`${item.hours.toFixed(2)} t`, 118, invoiceLineY, { align: "right" });
    doc.text(formatDkk(item.unitPrice ?? row.billingRate), 153, invoiceLineY, {
      align: "right",
    });
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
    `Arbejdet: ${workDateRange(row.timesheet)}`,
    `Virksomhed/projekt: ${financials.projectName || "—"}`,
    `Godkendte timer: ${row.approvedHours.toFixed(2)} t`,
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
    `Grundtimer: ${financials.basePayrollHours.toFixed(2)} t`,
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
      doc.text(allowanceQuantityLabel(item), 145, cursorY, { align: "right" });
      doc.text(allowancePdfAmountLabel(item), 190, cursorY, { align: "right" });
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
