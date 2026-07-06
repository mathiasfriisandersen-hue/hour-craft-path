import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Send,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  formatWeekRange,
  listCompanies,
  totalHours,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";
import { buildWorkerRows } from "@/routes/admin.workers";

type DashboardActionKind = "timesheet" | "invoice" | "payroll";
type DashboardTone = "blue" | "amber" | "green" | "red" | "slate";

type DashboardActionRow = {
  id: string;
  timesheetId: string;
  kind: DashboardActionKind;
  icon: typeof Clock3;
  title: string;
  description: string;
  company: string;
  period: string;
  amount: string;
  deadline: string;
  status: string;
  statusTone: DashboardTone;
  workerCode: string;
  csvDescription: string;
};

type DashboardWorkContext = {
  timesheet: Timesheet;
  approvedHours: number;
  invoiceDueDate: string;
  payrollDeadline: string;
  invoiceTone: DashboardTone;
  payrollTone: DashboardTone;
};

export function AdminDashboard() {
  const timesheets = useTimesheets();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<DashboardActionKind | "all">("all");
  const [actionPage, setActionPage] = useState(1);
  const [companies, setCompanies] = useState(listCompanies);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const submitted = useMemo(
    () => timesheets.filter((item) => item.status !== "draft" && !item.archived),
    [timesheets],
  );
  const pendingApproval = useMemo(
    () =>
      submitted.filter((item) => item.status === "sent" && isTimesheetReadyForApprovalAction(item)),
    [submitted],
  );
  const workerRows = useMemo(() => buildWorkerRows(timesheets, companies), [companies, timesheets]);
  const inactiveWorkerRows = useMemo(
    () => buildWorkerRows(timesheets, companies, { inactive: true }),
    [companies, timesheets],
  );
  const workingWorkerRows = useMemo(
    () => workerRows.filter((row) => row.hasActiveBooking),
    [workerRows],
  );
  const availableWorkerRows = useMemo(
    () => workerRows.filter((row) => !row.hasActiveBooking),
    [workerRows],
  );
  const workRows = useMemo(
    () => timesheets.filter((timesheet) => !timesheet.archived).map(buildDashboardWorkContext),
    [timesheets],
  );
  const invoiceRows = useMemo(
    () => workRows.filter((row) => row.timesheet.status === "approved" && row.approvedHours > 0),
    [workRows],
  );
  const invoiceSentRows = invoiceRows.filter((row) => row.timesheet.invoiceSentDate);
  const invoiceNowRows = invoiceRows.filter(
    (row) => !row.timesheet.invoiceSentDate && row.invoiceTone === "red",
  );
  const invoiceSoonRows = invoiceRows.filter(
    (row) => !row.timesheet.invoiceSentDate && row.invoiceTone !== "red",
  );
  const payrollRows = useMemo(
    () =>
      workRows.filter(
        (row) =>
          (row.timesheet.status === "sent" || row.timesheet.status === "approved") &&
          totalHours(row.timesheet.days) > 0,
      ),
    [workRows],
  );
  const payrollSentRows = payrollRows.filter((row) => row.timesheet.payrollSentDate);
  const payrollReadyRows = payrollRows.filter(
    (row) => !row.timesheet.payrollSentDate && row.payrollTone === "red",
  );
  const payrollWaitingRows = payrollRows.filter(
    (row) => !row.timesheet.payrollSentDate && row.payrollTone !== "red",
  );
  const invoiceNow = invoiceNowRows.map((row) => ({
    ...row.timesheet,
    invoiceDueDate: row.invoiceDueDate,
  }));
  const payrollReady = payrollReadyRows.map((row) => ({
    ...row.timesheet,
    payrollDeadline: row.payrollDeadline,
  }));
  const dashboardRows = useMemo(
    () => buildDashboardRows({ pendingApproval, invoiceNow, payrollReady }),
    [pendingApproval, invoiceNow, payrollReady],
  );
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("da-DK");
    return dashboardRows.filter((row) => {
      if (actionFilter !== "all" && row.kind !== actionFilter) return false;
      if (!needle) return true;
      return [
        row.title,
        row.description,
        row.company,
        row.period,
        row.amount,
        row.deadline,
        row.status,
        row.workerCode,
      ]
        .join(" ")
        .toLocaleLowerCase("da-DK")
        .includes(needle);
    });
  }, [actionFilter, dashboardRows, search]);

  const dashboardCsvRows = visibleRows.map((row) => ({
    vikarkode: row.workerCode,
    kategori: actionKindLabel(row.kind),
    titel: row.csvDescription,
    virksomhed_projekt: row.company,
    periode: row.period,
    timer_eller_beloeb: row.amount,
    frist: row.deadline,
    status: row.status,
  }));

  const pageSize = 5;
  const pageCount = Math.max(Math.ceil(visibleRows.length / pageSize), 1);
  const currentPage = Math.min(actionPage, pageCount);
  const pagedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setActionPage(1);
  }, [actionFilter, search]);

  useEffect(() => {
    if (actionPage > pageCount) setActionPage(pageCount);
  }, [actionPage, pageCount]);

  const exportDashboardCsv = () => {
    const csv = toCsv(dashboardCsvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dashboard-overblik.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const weekStats = getWeekStats(submitted);

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Dashboard",
        subtitle: "Velkommen tilbage, Admin. Her er dit overblik.",
        search: {
          value: search,
          onChange: setSearch,
          placeholder: "Søg efter vikar, virksomhed, timeseddel...",
        },
      }}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DashboardKpiCard
            label="Timesedler til godkendelse"
            value={pendingApproval.length}
            meta={`${pendingApproval.length} afventer`}
            icon={FileText}
            tone="blue"
            active={actionFilter === "timesheet"}
            onClick={() => setActionFilter("timesheet")}
          />
          <DashboardKpiCard
            label="Faktura skal håndteres"
            value={invoiceNow.length}
            meta={invoiceNow.length ? "Kræver handling" : "Uændret"}
            icon={FileSpreadsheet}
            tone="amber"
            active={actionFilter === "invoice"}
            onClick={() => setActionFilter("invoice")}
          />
          <DashboardKpiCard
            label="Klar til løn"
            value={payrollReadyRows.length}
            meta={`${payrollReadyRows.length} klar`}
            icon={WalletCards}
            tone="green"
            active={actionFilter === "payroll"}
            onClick={() => setActionFilter("payroll")}
          />
          <DashboardKpiCard
            label="Vikarer i arbejde"
            value={workingWorkerRows.length}
            meta="Aktive nu"
            icon={UserRoundCheck}
            tone="blue"
            to="/admin/workers"
          />
          <DashboardKpiCard
            label="Ledige vikarer"
            value={availableWorkerRows.length}
            meta={`Inaktive: ${inactiveWorkerRows.length}`}
            icon={UsersRound}
            tone="slate"
            to="/admin/workers"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">Handling kræves nu</h2>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {dashboardRows.length}
                </span>
              </div>
              <Link
                to="/admin/timesheets"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Se alle
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 border-b border-slate-200 px-5 pt-3 text-sm">
              <DashboardTab active={actionFilter === "all"} onClick={() => setActionFilter("all")}>
                Alle {dashboardRows.length}
              </DashboardTab>
              <DashboardTab
                active={actionFilter === "timesheet"}
                onClick={() => setActionFilter("timesheet")}
              >
                Timesedler {pendingApproval.length}
              </DashboardTab>
              <DashboardTab
                active={actionFilter === "invoice"}
                onClick={() => setActionFilter("invoice")}
              >
                Faktura {invoiceNow.length}
              </DashboardTab>
              <DashboardTab
                active={actionFilter === "payroll"}
                onClick={() => setActionFilter("payroll")}
              >
                Løn {payrollReadyRows.length}
              </DashboardTab>
            </div>

            <DashboardActionTable rows={pagedRows} />

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
              <span>
                Viser {visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0}-
                {Math.min(currentPage * pageSize, visibleRows.length)} af {visibleRows.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActionPage((page) => Math.max(page - 1, 1))}
                  disabled={currentPage === 1}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Forrige"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setActionPage((page) => Math.min(page + 1, pageCount))}
                  disabled={currentPage === pageCount}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Næste"
                >
                  ›
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <DashboardPanel title="Hurtige handlinger">
              <QuickAction
                icon={Plus}
                title="Opret vikar"
                description="Tilføj en ny vikar til systemet"
                to="/admin/create-worker"
              />
              <QuickAction
                icon={Building2}
                title="Ny virksomhed"
                description="Tilføj virksomhed / projekt"
                to="/admin/companies"
              />
              <QuickAction
                icon={Download}
                title="Eksportér CSV"
                description="Download dashboard-overblik"
                onClick={exportDashboardCsv}
              />
              <QuickAction
                icon={Send}
                title="Eksportér til CSV med kode"
                description="Eksportér uden personoplysninger"
                onClick={exportDashboardCsv}
              />
              <QuickAction
                icon={FolderOpen}
                title="Gå til faktura & løn"
                description="Opret eller håndtér fakturaer"
                to="/admin/invoice-payroll"
              />
            </DashboardPanel>

            <DashboardPanel
              title="Seneste aktiviteter"
              action={
                <Link to="/admin/timesheets" className="text-sm font-semibold text-blue-600">
                  Se alle
                </Link>
              }
            >
              <ActivityList timesheets={submitted.slice(0, 5)} />
            </DashboardPanel>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Denne uge</h2>
            <span className="text-sm text-slate-500">Overblik over aktuelle aktiviteter</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <WeekMetricCard
              label="Planlagte vagter"
              value={weekStats.plannedShifts}
              meta="+8 siden sidste uge"
              tone="blue"
              bars={[42, 70, 88, 76, 58, 62, 72]}
            />
            <WeekMetricCard
              label="Godkendelser"
              value={weekStats.approvals}
              meta="+6 siden sidste uge"
              tone="green"
              bars={[40, 78, 66, 62, 70, 78, 72]}
            />
            <WeekMetricCard
              label="Fravær / aflyste vagter"
              value={weekStats.absence}
              meta="-2 siden sidste uge"
              tone="red"
              bars={[0, 38, 60, 48, 34, 22, 10]}
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <OverviewBlock title="Fakturaoverblik">
            <OverviewStatusCard
              label="Skal snart håndteres"
              value={invoiceSoonRows.length}
              description="Godkendte timesedler med kommende fakturafrist."
              tone="blue"
            />
            <OverviewStatusCard
              label="Skal håndteres nu"
              value={invoiceNowRows.length}
              description="Godkendte timesedler hvor fakturafristen er nær."
              tone="amber"
            />
            <OverviewStatusCard
              label="Faktura sendt"
              value={invoiceSentRows.length}
              description="Timesedler markeret med eksisterende fakturastatus."
              tone="green"
            />
          </OverviewBlock>

          <OverviewBlock title="Lønoverblik">
            <OverviewStatusCard
              label="Klar til bogholderi"
              value={payrollReadyRows.length}
              description="Timesedler der er godkendt eller autogodkendt til løn."
              tone="amber"
            />
            <OverviewStatusCard
              label="Kræver ikke handling endnu"
              value={payrollWaitingRows.length}
              description="Timesedler der afventer godkendelse eller lønperiode."
              tone="slate"
            />
            <OverviewStatusCard
              label="Sendt til bogholderi"
              value={payrollSentRows.length}
              description="Timesedler markeret med eksisterende lønstatus."
              tone="green"
            />
          </OverviewBlock>
        </div>
      </div>
    </AppShell>
  );
}

function DashboardKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
  active = false,
  onClick,
  to,
}: {
  label: string;
  value: number;
  meta: string;
  icon: typeof FileText;
  tone: DashboardTone;
  active?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-4">
        <div className={cn("grid h-12 w-12 place-items-center rounded-xl", toneIconClass(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-700">{label}</div>
          <div className="mt-1 text-3xl font-semibold leading-none text-slate-950">{value}</div>
          <div className={cn("mt-2 text-xs font-semibold", toneTextClass(tone))}>{meta}</div>
        </div>
        <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
      </div>
    </>
  );
  const className = cn(
    "block w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30",
    active && "border-blue-300 ring-2 ring-blue-100",
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function DashboardTab({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 pb-3 font-semibold transition-colors hover:text-blue-600",
        active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500",
      )}
    >
      {children}
    </button>
  );
}

function DashboardActionTable({ rows }: { rows: DashboardActionRow[] }) {
  if (!rows.length) {
    return (
      <div className="px-5 py-12 text-center text-sm text-slate-500">Ingen handlinger lige nu.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] table-fixed text-sm">
        <colgroup>
          <col className="w-14" />
          <col className="w-[18rem]" />
          <col className="w-[20rem]" />
          <col className="w-40" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-44" />
          <col className="w-14" />
        </colgroup>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Beskrivelse</th>
            <th className="px-4 py-3 font-semibold">Virksomhed / Projekt</th>
            <th className="px-4 py-3 font-semibold">Periode</th>
            <th className="px-4 py-3 font-semibold">Beløb</th>
            <th className="px-4 py-3 font-semibold">Frist</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full",
                      toneSoftClass(row.statusTone),
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{row.title}</div>
                  <div className="text-xs text-slate-500">{row.description}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="break-words font-semibold text-slate-900">{row.company}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.period}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.amount}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-900">{row.deadline}</td>
                <td className="px-4 py-3 align-middle">
                  <span
                    className={cn(
                      "inline-flex min-w-[7.75rem] items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
                      badgeToneClass(row.statusTone),
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/$id"
                    params={{ id: row.timesheetId }}
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Åbn timeseddel"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DashboardPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  to,
  onClick,
}: {
  icon: typeof Plus;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="font-semibold text-slate-950">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition-colors hover:bg-slate-50";

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function ActivityList({ timesheets }: { timesheets: Timesheet[] }) {
  if (!timesheets.length) {
    return <div className="text-sm text-slate-500">Ingen aktiviteter endnu.</div>;
  }

  return (
    <div className="space-y-4">
      {timesheets.map((timesheet) => (
        <div key={timesheet.id} className="flex gap-3 text-sm">
          <span className={cn("mt-1.5 h-2 w-2 rounded-full", activityDotClass(timesheet.status))} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-950">{activityTitle(timesheet)}</div>
            <div className="truncate text-xs text-slate-500">
              {timesheet.vikar || timesheet.vikarCode || "Vikar"} ·{" "}
              {timesheet.brugervirksomhed || "—"}
            </div>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-500">
            {formatDateShort(timesheet.updatedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

function WeekMetricCard({
  label,
  value,
  meta,
  tone,
  bars,
}: {
  label: string;
  value: number;
  meta: string;
  tone: "blue" | "green" | "red";
  bars: number[];
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
          <div
            className={cn(
              "mt-2 text-xs font-semibold",
              tone === "red" ? "text-emerald-600" : "text-blue-600",
            )}
          >
            {meta}
          </div>
        </div>
        <div className="flex h-16 items-end gap-2">
          {bars.map((height, index) => (
            <span
              key={`${label}-${index}`}
              className={cn(
                "w-3 rounded-t",
                tone === "blue" && "bg-blue-500",
                tone === "green" && "bg-emerald-500",
                tone === "red" && "bg-rose-400",
              )}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function OverviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-950">{title}</h2>
      <div className="grid gap-3 md:grid-cols-3">{children}</div>
    </section>
  );
}

function OverviewStatusCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: DashboardTone;
}) {
  return (
    <article className={cn("rounded-lg border p-4", overviewToneClass(tone))}>
      <div className="text-sm font-semibold text-slate-950">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

function buildDashboardRows({
  pendingApproval,
  invoiceNow,
  payrollReady,
}: {
  pendingApproval: Timesheet[];
  invoiceNow: Timesheet[];
  payrollReady: Timesheet[];
}): DashboardActionRow[] {
  return [
    ...pendingApproval.map((timesheet) =>
      actionRow(timesheet, {
        kind: "timesheet",
        icon: Clock3,
        title: "Timeseddel venter på godkendelse",
        status: "Skal godkendes",
        statusTone: "red",
        csvDescription: "Timeseddel venter på godkendelse",
      }),
    ),
    ...invoiceNow.map((timesheet) =>
      actionRow(timesheet, {
        kind: "invoice",
        icon: FileSpreadsheet,
        title: "Faktura skal håndteres",
        status: "Fakturafrist",
        statusTone: "amber",
        csvDescription: "Faktura skal håndteres",
      }),
    ),
    ...payrollReady.map((timesheet) =>
      actionRow(timesheet, {
        kind: "payroll",
        icon: WalletCards,
        title: "Klar til bogholderi",
        status: "Klar",
        statusTone: "green",
        csvDescription: "Klar til bogholderi",
      }),
    ),
  ];
}

function actionRow(
  timesheet: Timesheet,
  options: {
    kind: DashboardActionKind;
    icon: typeof Clock3;
    title: string;
    status: string;
    statusTone: DashboardTone;
    csvDescription: string;
  },
): DashboardActionRow {
  const hours = totalHours(timesheet.days);
  return {
    id: `${options.kind}-${timesheet.id}`,
    timesheetId: timesheet.id,
    kind: options.kind,
    icon: options.icon,
    title: options.title,
    description: `${timesheet.vikar || timesheet.vikarCode || "Vikar"} · Uge ${weekNumber(timesheet.weekStart)}`,
    company: timesheet.projectName
      ? `${timesheet.brugervirksomhed || "—"} / ${timesheet.projectName}`
      : timesheet.brugervirksomhed || "—",
    period: formatWeekRange(timesheet.weekStart),
    amount: `${formatNumber(hours)} t`,
    deadline: formatDateShort(
      timesheet.invoiceDueDate || timesheet.payrollDeadline || timesheet.updatedAt,
    ),
    status: options.status,
    statusTone: options.statusTone,
    workerCode: anonymizedWorkerCode(timesheet),
    csvDescription: options.csvDescription,
  };
}

function buildDashboardWorkContext(timesheet: Timesheet): DashboardWorkContext {
  const approvedHours = totalHours(timesheet.days);
  const invoiceDate = invoiceDateForTimesheet(timesheet.weekStart);
  const invoiceDueDate = invoiceDueDateForInvoiceDate(invoiceDate);
  const payrollPeriod = payrollPeriodForWeek(timesheet.weekStart);
  const payrollDeadline = timesheet.payrollDeadline || addDays(payrollPeriod.end, 2);

  return {
    timesheet,
    approvedHours,
    invoiceDueDate,
    payrollDeadline,
    invoiceTone: urgencyTone(invoiceDueDate),
    payrollTone: dashboardPayrollTone(timesheet, payrollPeriod.end),
  };
}

function invoiceDateForTimesheet(weekStart: string): string {
  return addDays(weekStart, 8);
}

function invoiceDueDateForInvoiceDate(invoiceDate: string): string {
  return addDays(invoiceDate, 8);
}

function payrollPeriodForWeek(weekStart: string) {
  const week = weekNumber(weekStart);
  const start = addDays(weekStart, week % 2 === 0 ? -7 : 0);
  return { start, end: addDays(start, 13) };
}

function urgencyTone(deadline: string): DashboardTone {
  const today = new Date(`${localISODate(new Date())}T12:00:00`);
  const due = new Date(`${deadline}T12:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "red";
  if (days <= 3) return "amber";
  return "green";
}

function dashboardPayrollTone(timesheet: Timesheet, periodEnd: string): DashboardTone {
  const today = new Date(`${localISODate(new Date())}T12:00:00`);
  const periodEndDate = new Date(`${periodEnd}T12:00:00`);
  const autoApprovalDate = new Date(`${addDays(periodEnd, 2)}T12:00:00`);

  if (periodEndDate.getTime() >= today.getTime()) return "green";
  if (timesheet.status === "approved") return "red";
  if (timesheet.status === "sent" && autoApprovalDate.getTime() <= today.getTime()) return "red";
  return "amber";
}

function getWeekStats(timesheets: Timesheet[]) {
  const currentWeek = weekNumber(new Date().toISOString().slice(0, 10));
  const thisWeek = timesheets.filter((item) => weekNumber(item.weekStart) === currentWeek);
  return {
    plannedShifts: thisWeek.reduce(
      (sum, item) => sum + item.days.filter((day) => day.start && day.end).length,
      0,
    ),
    approvals: thisWeek.filter((item) => item.status === "approved").length,
    absence: thisWeek.reduce(
      (sum, item) => sum + item.days.filter((day) => day.absence !== "none").length,
      0,
    ),
  };
}

function anonymizedWorkerCode(timesheet: Timesheet): string {
  if (timesheet.vikarCode?.trim()) return timesheet.vikarCode.trim();
  const stableNumber =
    Math.abs(hashString(timesheet.id || timesheet.vikar || timesheet.vikarEmail)) % 999;
  return `VIKAR-${String(stableNumber + 1).padStart(3, "0")}`;
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (!rows.length)
    return "vikarkode,kategori,titel,virksomhed_projekt,periode,timer_eller_beloeb,frist,status\n";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function actionKindLabel(kind: DashboardActionKind): string {
  if (kind === "invoice") return "Faktura";
  if (kind === "payroll") return "Løn";
  return "Timeseddel";
}

function activityTitle(timesheet: Timesheet): string {
  if (timesheet.status === "approved") return "Timeseddel godkendt";
  if (timesheet.status === "rejected") return "Timeseddel afvist";
  return "Timeseddel oprettet";
}

function isTimesheetReadyForApprovalAction(timesheet: Timesheet): boolean {
  return isTimesheetPeriodEnded(timesheet);
}

function isTimesheetPeriodEnded(timesheet: Timesheet): boolean {
  const periodEnd = timesheet.projectEndDate || addDays(timesheet.weekStart, 6);
  return Boolean(periodEnd && periodEnd < localISODate(new Date()));
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  return value.split("").reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateShort(value: string | undefined): string {
  if (!value) return "—";
  const [date] = value.split("T");
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function toneIconClass(tone: DashboardTone): string {
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "red") return "bg-rose-50 text-rose-600";
  if (tone === "slate") return "bg-slate-100 text-slate-500";
  return "bg-blue-50 text-blue-600";
}

function toneTextClass(tone: DashboardTone): string {
  if (tone === "green") return "text-emerald-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "red") return "text-rose-600";
  if (tone === "slate") return "text-slate-500";
  return "text-blue-600";
}

function toneSoftClass(tone: DashboardTone): string {
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "red") return "bg-blue-50 text-blue-600";
  return "bg-slate-100 text-slate-500";
}

function badgeToneClass(tone: DashboardTone): string {
  if (tone === "green") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "red") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function overviewToneClass(tone: DashboardTone): string {
  if (tone === "green") return "border-emerald-200 bg-emerald-50/40";
  if (tone === "amber") return "border-amber-200 bg-amber-50/40";
  if (tone === "blue") return "border-blue-200 bg-blue-50/40";
  return "border-slate-200 bg-slate-50";
}

function activityDotClass(status: Timesheet["status"]): string {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-rose-500";
  return "bg-blue-500";
}
