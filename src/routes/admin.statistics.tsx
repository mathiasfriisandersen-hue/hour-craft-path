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
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Send,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { useTimesheets } from "@/lib/use-timesheets";
import { listCompanies, seedIfEmpty, type Company, type Timesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

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
  waiting: number;
  done: number;
};

type StatusTone = "neutral" | "warning" | "done";
type DashboardTone = "blue" | "red" | "green" | "violet" | "amber";
type DateRange = {
  from: string;
  to: string;
};

const METRIC_ICONS: Record<MetricKey, LucideIcon> = {
  companies: Building2,
  workers: UsersRound,
  tasks: ClipboardCheck,
  sent: Send,
  approved: CheckCircle2,
};

const METRIC_TONES: Record<MetricKey, DashboardTone> = {
  companies: "blue",
  workers: "green",
  tasks: "violet",
  sent: "amber",
  approved: "green",
};

function StatisticsPage() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(() => {
    seedIfEmpty();
    return listCompanies();
  });
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
  const metricTotals = useMemo(
    () =>
      METRICS.map((metric) => {
        const bruger1Value = metricValue(metric.key, "bruger", timesheets, companies);
        const bruger2Value = metricValue(metric.key, "bruger2", timesheets, companies);
        return {
          ...metric,
          value: bruger1Value + bruger2Value,
          bruger1Value,
          bruger2Value,
        };
      }),
    [companies, timesheets],
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
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Statistik",
        subtitle: "Overblik over aktivitet fordelt på brugere.",
      }}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metricTotals.map((metric) => (
            <StatisticKpiCard
              key={metric.key}
              label={kpiLabel(metric.label)}
              value={metric.value}
              bruger1Value={metric.bruger1Value}
              bruger2Value={metric.bruger2Value}
              icon={METRIC_ICONS[metric.key]}
              tone={METRIC_TONES[metric.key]}
              active={visibleMetrics[metric.key]}
              onClick={() => toggleMetric(metric.key)}
            />
          ))}
          <UserScopeCard visibleUsers={visibleUsers} onToggleUser={toggleUser} />
        </section>

        <div className="grid gap-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Aktivitet fordelt på brugere
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Eksisterende målinger fordelt på Bruger 1 og Bruger 2.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <LegendPill color={USER_COLORS.bruger1} label="Bruger 1" />
                <LegendPill color={USER_COLORS.bruger2} label="Bruger 2" />
              </div>
            </div>

            <div className="h-[480px] min-w-0 px-3 py-5 sm:px-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 32, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    interval={0}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e2e8f0",
                      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 16 }} />
                  {visibleUsers.bruger1 && (
                    <Bar
                      dataKey="bruger1"
                      name="Blå = Bruger 1"
                      fill={USER_COLORS.bruger1}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={58}
                    >
                      <LabelList dataKey="bruger1" position="top" fill="#0f172a" fontSize={13} />
                    </Bar>
                  )}
                  {visibleUsers.bruger2 && (
                    <Bar
                      dataKey="bruger2"
                      name="Rød = Bruger 2"
                      fill={USER_COLORS.bruger2}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={58}
                    >
                      <LabelList dataKey="bruger2" position="top" fill="#0f172a" fontSize={13} />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              <span>Data opdateres fra eksisterende timesedler og virksomhedsregister.</span>
              <span>Fordelt på synlige brugere og valgte metrikker.</span>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
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
                label: "Kræver ikke handling endnu",
                value: invoiceOverview.waiting,
                help: "Godkendte timesedler med senere fakturafrist.",
                tone: "neutral",
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
      </div>
    </AppShell>
  );
}

function StatisticKpiCard({
  label,
  value,
  bruger1Value,
  bruger2Value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  bruger1Value: number;
  bruger2Value: number;
  icon: LucideIcon;
  tone: DashboardTone;
  active: boolean;
  onClick: () => void;
}) {
  const total = bruger1Value + bruger2Value;
  const bruger1Width = total > 0 ? (bruger1Value / total) * 100 : 50;
  const bruger2Width = 100 - bruger1Width;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active ? "border-slate-200" : "border-slate-200 opacity-55",
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("grid h-12 w-12 place-items-center rounded-full", toneIconClass(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-slate-950 tabular-nums">
            {value}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
          <span className="bg-blue-600" style={{ width: `${bruger1Width}%` }} aria-hidden="true" />
          <span className="bg-red-600" style={{ width: `${bruger2Width}%` }} aria-hidden="true" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Bruger 1 {bruger1Value}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            Bruger 2 {bruger2Value}
          </span>
        </div>
      </div>
    </button>
  );
}

function UserScopeCard({
  visibleUsers,
  onToggleUser,
}: {
  visibleUsers: Record<UserKey, boolean>;
  onToggleUser: (key: UserKey) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-sm font-semibold text-slate-900">Visning</div>
        <div className="mt-2 text-3xl font-semibold leading-none text-slate-950 tabular-nums">
          Brugere
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          aria-pressed={visibleUsers.bruger1}
          onClick={() => onToggleUser("bruger1")}
          className={cn(
            "rounded-md px-2.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            visibleUsers.bruger1
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-white",
          )}
        >
          Bruger 1
        </button>
        <button
          type="button"
          aria-pressed={visibleUsers.bruger2}
          onClick={() => onToggleUser("bruger2")}
          className={cn(
            "rounded-md px-2.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
            visibleUsers.bruger2
              ? "bg-red-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-white",
          )}
        >
          Bruger 2
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Slå en bruger fra for at ekskludere ved visning.
      </p>
    </article>
  );
}

function kpiLabel(label: string): string {
  if (label === "Virksomheder oprettet") return "Virksomheder";
  if (label === "Vikarer oprettet") return "Vikarer";
  if (label === "Timesedler godkendt") return "Godkendte timesedler";
  return label;
}

function toneIconClass(tone: DashboardTone): string {
  if (tone === "blue") return "bg-blue-50 text-blue-600";
  if (tone === "red") return "bg-red-50 text-red-600";
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  if (tone === "violet") return "bg-violet-50 text-violet-600";
  return "bg-amber-50 text-amber-600";
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-500">{rangeLabel} fra</span>
            <Input
              type="date"
              value={range.from}
              onChange={(event) => onRangeChange({ ...range, from: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-500">Til</span>
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
            className={`rounded-lg border p-4 ${statusToneClass(card.tone)}`}
          >
            <div className="text-sm font-semibold text-slate-900">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950 tabular-nums">
              {card.value}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{card.help}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusToneClass(tone: StatusTone): string {
  if (tone === "warning") return "border-amber-200 bg-amber-50/70";
  if (tone === "done") return "border-emerald-200 bg-emerald-50/70";
  return "border-slate-200 bg-slate-50";
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
    return roleTimesheets.filter((timesheet) => timesheet.status !== "draft").length;
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
  const overview: StatusOverview = { soon: 0, now: 0, waiting: 0, done: 0 };
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
    else if (tone === "soon") overview.soon += 1;
    else overview.waiting += 1;
  }
  return overview;
}

function buildPayrollOverview(timesheets: Timesheet[], sentRange: DateRange): StatusOverview {
  const overview: StatusOverview = { soon: 0, now: 0, waiting: 0, done: 0 };
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

function deadlineTone(deadline: string): "waiting" | "soon" | "now" {
  const days = calendarDaysUntil(deadline);
  if (days <= 0) return "now";
  if (days <= 3) return "soon";
  return "waiting";
}

function calendarDaysUntil(isoDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
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
