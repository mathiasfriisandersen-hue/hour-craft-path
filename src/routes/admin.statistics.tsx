import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { useTimesheets } from "@/lib/use-timesheets";
import { listCompanies, type Company, type Timesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/statistics")({
  head: () => ({ meta: [{ title: "Admin — Statistik" }] }),
  component: StatisticsPage,
});

type UserRole = "bruger" | "bruger2";
type UserKey = "bruger1" | "bruger2";
type MetricKey = "companies" | "workers" | "tasks" | "sent" | "approved";

type MetricDefinition = {
  key: MetricKey;
  label: string;
};

type UserDefinition = {
  role: UserRole;
  key: UserKey;
  label: string;
};

const USERS: UserDefinition[] = [
  { role: "bruger", key: "bruger1", label: "Bruger 1" },
  { role: "bruger2", key: "bruger2", label: "Bruger 2" },
];

const METRICS: MetricDefinition[] = [
  { key: "companies", label: "Virksomheder oprettet" },
  { key: "workers", label: "Vikarer oprettet" },
  { key: "tasks", label: "Opgaver løst" },
  { key: "sent", label: "Timesedler sendt" },
  { key: "approved", label: "Timesedler godkendt" },
];

const USER_COLORS: Record<UserKey, string> = {
  bruger1: "#2563eb",
  bruger2: "#dc2626",
};

type StatusOverview = {
  soon: number;
  now: number;
  done: number;
};

type StatusTone = "neutral" | "warning" | "done";
type DateRange = {
  from: string;
  to: string;
};

function StatisticsPage() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [visibleUsers, setVisibleUsers] = useState<Record<UserKey, boolean>>({
    bruger1: true,
    bruger2: true,
  });
  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>({
    companies: true,
    workers: true,
    tasks: true,
    sent: true,
    approved: true,
  });
  const [invoiceSentRange, setInvoiceSentRange] = useState<DateRange>({ from: "", to: "" });
  const [payrollSentRange, setPayrollSentRange] = useState<DateRange>({ from: "", to: "" });

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const chartData = useMemo(
    () =>
      METRICS.filter((metric) => visibleMetrics[metric.key]).map((metric) => {
        const row: { metric: string; bruger1?: number; bruger2?: number } = {
          metric: metric.label,
        };
        for (const user of USERS) {
          if (visibleUsers[user.key]) {
            row[user.key] = metricValue(metric.key, user.role, timesheets, companies);
          }
        }
        return row;
      }),
    [companies, timesheets, visibleMetrics, visibleUsers],
  );
  const invoiceOverview = useMemo(
    () => buildInvoiceOverview(timesheets, invoiceSentRange),
    [invoiceSentRange, timesheets],
  );
  const payrollOverview = useMemo(
    () => buildPayrollOverview(timesheets, payrollSentRange),
    [payrollSentRange, timesheets],
  );

  const toggleUser = (key: UserKey) => {
    setVisibleUsers((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Statistik</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overblik over aktivitet fordelt på brugere
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-lg border bg-card p-4">
          <div className="h-[420px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 44, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="metric"
                  interval={0}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 16 }} />
                {visibleUsers.bruger1 && (
                  <Bar dataKey="bruger1" name="Blå = Bruger 1" fill={USER_COLORS.bruger1}>
                    <LabelList dataKey="bruger1" position="top" fill="#111827" fontSize={13} />
                  </Bar>
                )}
                {visibleUsers.bruger2 && (
                  <Bar dataKey="bruger2" name="Rød = Bruger 2" fill={USER_COLORS.bruger2}>
                    <LabelList dataKey="bruger2" position="top" fill="#111827" fontSize={13} />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Filtre</h2>
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">Brugere</div>
              <div className="space-y-2">
                {USERS.map((user) => (
                  <FilterCheckbox
                    key={user.key}
                    label={`Vis ${user.label}`}
                    checked={visibleUsers[user.key]}
                    onChange={() => toggleUser(user.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">Målinger</div>
              <div className="space-y-2">
                {METRICS.map((metric) => (
                  <FilterCheckbox
                    key={metric.key}
                    label={metric.label}
                    checked={visibleMetrics[metric.key]}
                    onChange={() => toggleMetric(metric.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <OverviewSection
          title="Fakturaoverblik"
          rangeLabel="Periode for faktura sendt"
          range={invoiceSentRange}
          onRangeChange={setInvoiceSentRange}
          cards={[
            {
              label: "Skal snart håndteres",
              value: invoiceOverview.soon,
              help: "Godkendte timesedler med kommende fakturafrist.",
              tone: "neutral",
            },
            {
              label: "Skal håndteres nu",
              value: invoiceOverview.now,
              help: "Godkendte timesedler hvor fakturafristen er nået.",
              tone: "warning",
            },
            {
              label: "Faktura sendt",
              value: invoiceOverview.done,
              help: "Timesedler markeret med eksisterende fakturastatus.",
              tone: "done",
            },
          ]}
        />
        <OverviewSection
          title="Lønoverblik"
          rangeLabel="Periode for sendt til bogholderi"
          range={payrollSentRange}
          onRangeChange={setPayrollSentRange}
          cards={[
            {
              label: "Klar til bogholderi",
              value: payrollOverview.now,
              help: "Timesedler der er godkendt eller autogodkendt til løn.",
              tone: "warning",
            },
            {
              label: "Kræver ikke handling endnu",
              value: payrollOverview.soon,
              help: "Timesedler der afventer godkendelse eller lønperiode.",
              tone: "neutral",
            },
            {
              label: "Sendt til bogholderi",
              value: payrollOverview.done,
              help: "Timesedler markeret med eksisterende lønstatus.",
              tone: "done",
            },
          ]}
        />
      </div>
    </AppShell>
  );
}

function OverviewSection({
  title,
  rangeLabel,
  range,
  onRangeChange,
  cards,
}: {
  title: string;
  rangeLabel: string;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  cards: Array<{ label: string; value: number; help: string; tone: StatusTone }>;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">{rangeLabel} fra</span>
            <Input
              type="date"
              value={range.from}
              onChange={(event) => onRangeChange({ ...range, from: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Til</span>
            <Input
              type="date"
              value={range.to}
              onChange={(event) => onRangeChange({ ...range, to: event.target.value })}
            />
          </label>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rounded-md border p-4 ${statusToneClass(card.tone)}`}
          >
            <div className="text-sm font-medium">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold">{card.value}</div>
            <p className="mt-2 text-xs text-muted-foreground">{card.help}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusToneClass(tone: StatusTone): string {
  if (tone === "warning") return "border-amber-200 bg-amber-50/60";
  if (tone === "done") return "border-emerald-200 bg-emerald-50/60";
  return "border-border bg-background";
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}

function metricValue(
  metric: MetricKey,
  role: UserRole,
  timesheets: Timesheet[],
  companies: Company[],
): number {
  const roleCompanies = companies.filter((company) => company.ownerRole === role);
  const roleTimesheets = timesheets.filter((timesheet) =>
    timesheetBelongsToRole(timesheet, role, companies),
  );

  if (metric === "companies") return roleCompanies.length;
  if (metric === "workers") return countWorkersByCodeNamePhone(roleTimesheets);
  if (metric === "tasks") return countProjectsByContactOrCompany(roleCompanies, roleTimesheets);
  if (metric === "sent")
    return roleTimesheets.filter((timesheet) => timesheet.status === "sent").length;
  return roleTimesheets.filter((timesheet) => timesheet.status === "approved").length;
}

function timesheetBelongsToRole(
  timesheet: Timesheet,
  role: UserRole,
  companies: Company[],
): boolean {
  const company = companies.find((item) => item.id === timesheet.companyId);
  if (company?.ownerRole) return company.ownerRole === role;

  const companyByName = companies.find(
    (item) => statsKey(item.name) === statsKey(timesheet.brugervirksomhed),
  );
  if (companyByName?.ownerRole) return companyByName.ownerRole === role;

  return timesheet.ownerRole === role;
}

function statsKey(...values: string[]): string {
  return values
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(":");
}

function workerStatsKey(timesheet: Timesheet): string {
  return (
    statsKey(timesheet.vikarCode ?? "") ||
    statsKey(timesheet.vikar, timesheet.vikarPhone ?? "") ||
    statsKey(timesheet.vikar) ||
    statsKey(timesheet.vikarPhone ?? "")
  );
}

function countWorkersByCodeNamePhone(timesheets: Timesheet[]): number {
  const workerKeys = new Set<string>();
  for (const timesheet of timesheets) {
    const key = workerStatsKey(timesheet);
    if (key) workerKeys.add(key);
  }
  return workerKeys.size;
}

function projectStatsKeyFromTimesheet(timesheet: Timesheet): string {
  return (
    statsKey(timesheet.kontaktperson, timesheet.kontaktpersonPhone) ||
    statsKey(timesheet.companyId ?? "") ||
    statsKey(timesheet.brugervirksomhed)
  );
}

function countProjectsByContactOrCompany(companies: Company[], timesheets: Timesheet[]): number {
  const projectKeys = new Set<string>();
  for (const company of companies) {
    for (const project of company.projects) {
      const key =
        statsKey(project.contactName, project.contactPhone) ||
        statsKey(company.id) ||
        statsKey(company.name);
      if (key) projectKeys.add(key);
    }
  }
  for (const timesheet of timesheets) {
    const key = projectStatsKeyFromTimesheet(timesheet);
    if (key) projectKeys.add(key);
  }
  return projectKeys.size;
}

function buildInvoiceOverview(timesheets: Timesheet[], sentRange: DateRange): StatusOverview {
  const overview: StatusOverview = { soon: 0, now: 0, done: 0 };
  const seen = new Set<string>();
  for (const timesheet of timesheets) {
    if (seen.has(timesheet.id) || timesheet.archived) continue;
    seen.add(timesheet.id);

    if (
      dateInRange(timesheet.invoiceSentDate ?? "", sentRange) ||
      (dateRangeIsEmpty(sentRange) &&
        hasDoneStatus(timesheet, ["invoiceStatus", "invoiceState", "billingStatus"]))
    ) {
      overview.done += 1;
      continue;
    }
    if (timesheet.status !== "approved" || !hasRegisteredHours(timesheet)) continue;

    const tone = deadlineTone(invoiceDueDateForTimesheet(timesheet.weekStart));
    if (tone === "now") overview.now += 1;
    else overview.soon += 1;
  }
  return overview;
}

function buildPayrollOverview(timesheets: Timesheet[], sentRange: DateRange): StatusOverview {
  const overview: StatusOverview = { soon: 0, now: 0, done: 0 };
  const seen = new Set<string>();
  for (const timesheet of timesheets) {
    if (seen.has(timesheet.id) || timesheet.archived) continue;
    seen.add(timesheet.id);

    if (
      dateInRange(timesheet.payrollSentDate ?? "", sentRange) ||
      (dateRangeIsEmpty(sentRange) &&
        hasDoneStatus(timesheet, ["payrollStatus", "payrollState", "bookkeepingStatus"]))
    ) {
      overview.done += 1;
      continue;
    }
    if (
      (timesheet.status !== "sent" && timesheet.status !== "approved") ||
      !hasRegisteredHours(timesheet)
    ) {
      continue;
    }

    const period = payrollPeriodForWeek(timesheet.weekStart);
    if (payrollReady(timesheet, period.end)) overview.now += 1;
    else overview.soon += 1;
  }
  return overview;
}

function hasRegisteredHours(timesheet: Timesheet): boolean {
  return timesheet.days.some((day) => day.start && day.end);
}

function dateInRange(value: string, range: DateRange): boolean {
  if (!value) return false;
  if (range.from && value < range.from) return false;
  if (range.to && value > range.to) return false;
  return true;
}

function dateRangeIsEmpty(range: DateRange): boolean {
  return !range.from && !range.to;
}

function hasDoneStatus(timesheet: Timesheet, fields: string[]): boolean {
  const record = timesheet as unknown as Record<string, unknown>;
  return fields.some((field) => {
    const value = record[field];
    return (
      value === "sent" || value === "done" || value === "completed" || value === "bookkeeping_sent"
    );
  });
}

function deadlineTone(deadline: string): "soon" | "now" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T12:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return days <= 0 ? "now" : "soon";
}

function invoiceDueDateForTimesheet(weekStart: string): string {
  return addDaysToISODate(addDaysToISODate(weekStart, 8), 8);
}

function payrollPeriodForWeek(weekStart: string): { start: string; end: string } {
  const monday = new Date(`${weekStart}T12:00:00`);
  const oneJan = new Date(`${monday.getFullYear()}-01-01T12:00:00`);
  const week = Math.ceil(
    ((monday.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
  );
  const start = addDaysToISODate(weekStart, week % 2 === 0 ? -7 : 0);
  return { start, end: addDaysToISODate(start, 13) };
}

function payrollReady(timesheet: Timesheet, periodEnd: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${periodEnd}T12:00:00`);
  if (end.getTime() >= today.getTime()) return false;

  if (timesheet.status === "approved") return true;
  const autoApprovalDate = new Date(`${addDaysToISODate(periodEnd, 2)}T12:00:00`);
  return timesheet.status === "sent" && autoApprovalDate.getTime() <= today.getTime();
}

function addDaysToISODate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
