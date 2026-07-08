import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Mail,
  Phone,
  RotateCcw,
  Search,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/auth";
import { useTimesheets } from "@/lib/use-timesheets";
import { cn } from "@/lib/utils";
import {
  knownWorkersFromTimesheets,
  knownWorkersIncludingInactiveFromTimesheets,
  listCompanies,
  setKnownWorkerInactive,
  deleteKnownWorker,
  TRADE_SKILLS,
  updateKnownWorker,
  WORKER_LANGUAGES,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
  type TradeSkill,
  type WorkerLanguage,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/workers")({
  head: () => ({ meta: [{ title: "Admin — Vikaroversigt" }] }),
  component: WorkerOverview,
});

export type Assignment = {
  companyName: string;
  projectName: string;
  startDate: string;
  endDate: string;
};

export type WorkerRow = {
  worker: KnownWorker;
  assignments: Assignment[];
  futureAssignments: Assignment[];
  currentTimesheets: Timesheet[];
  nextTimesheet: Timesheet | null;
  hasActiveBooking: boolean;
  nextBookingStart: string;
  bookingStart: string;
  bookingEnd: string;
};

function WorkerOverview() {
  const [search, setSearch] = useState("");

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Vikaroversigt",
        subtitle: "Overblik over aktive, ledige og inaktive vikarer.",
        search: {
          value: search,
          onChange: setSearch,
          placeholder: "Søg efter vikar, virksomhed, overenskomst...",
        },
      }}
    >
      <WorkerOverviewContent
        role="admin"
        showBackLink
        dashboardShell
        searchQuery={search}
        onSearchQueryChange={setSearch}
      />
    </AppShell>
  );
}

type WorkerTab = "working" | "available" | "inactive";
type WorkerTone = "blue" | "green" | "orange" | "purple";

export function WorkerOverviewContent({
  role,
  showBackLink = false,
  backHref = "/admin",
  dashboardShell = false,
  searchQuery,
  onSearchQueryChange,
}: {
  role: Role;
  showBackLink?: boolean;
  backHref?: string;
  dashboardShell?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}) {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [activeTab, setActiveTab] = useState<WorkerTab>("working");
  const [localSearch, setLocalSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkerTab | "all">("all");
  const [selectedWorkerKey, setSelectedWorkerKey] = useState("");
  const searchValue = searchQuery ?? localSearch;
  const updateSearch = onSearchQueryChange ?? setLocalSearch;

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const rows = useMemo(() => buildWorkerRows(timesheets, companies), [timesheets, companies]);
  const inactiveRows = useMemo(
    () => buildWorkerRows(timesheets, companies, { inactive: true }),
    [timesheets, companies],
  );

  const working = useMemo(() => rows.filter((row) => row.hasActiveBooking), [rows]);
  const available = useMemo(
    () => rows.filter((row) => !row.hasActiveBooking).sort(compareAvailableWorkerRows),
    [rows],
  );
  const rowsByTab = useMemo<Record<WorkerTab, WorkerRow[]>>(
    () => ({
      working,
      available,
      inactive: inactiveRows,
    }),
    [available, inactiveRows, working],
  );
  const activeTimesheetWeeks = rows.reduce((total, row) => total + row.currentTimesheets.length, 0);
  const allRows = useMemo(() => [...rows, ...inactiveRows], [inactiveRows, rows]);
  const tradeOptions = useMemo(() => uniqueTradeOptions(allRows), [allRows]);
  const companyOptions = useMemo(() => uniqueCompanyOptions(allRows), [allRows]);
  const filteredRows = useMemo(
    () =>
      filterWorkerRows(rowsByTab[activeTab], {
        query: searchValue,
        trade: tradeFilter,
        company: companyFilter,
        status: statusFilter,
        currentTab: activeTab,
      }),
    [activeTab, rowsByTab, searchValue, tradeFilter, companyFilter, statusFilter],
  );

  useEffect(() => {
    if (filteredRows.some((row) => row.worker.key === selectedWorkerKey)) return;
    setSelectedWorkerKey(filteredRows[0]?.worker.key ?? "");
  }, [filteredRows, selectedWorkerKey]);

  const selectedRow =
    filteredRows.find((row) => row.worker.key === selectedWorkerKey) ?? filteredRows[0] ?? null;

  const restoreWorker = (worker: KnownWorker) => {
    setKnownWorkerInactive(worker, false);
    setActiveTab("available");
    setStatusFilter("all");
  };

  const inactivateWorker = (worker: KnownWorker) => {
    setKnownWorkerInactive(worker, true);
    setActiveTab("inactive");
    setStatusFilter("all");
  };

  const deleteWorker = (worker: KnownWorker) => {
  deleteKnownWorker(worker);
  setSelectedWorkerKey("");
  setActiveTab("inactive");
  setStatusFilter("all");
};

  const selectTab = (tab: WorkerTab) => {
    setActiveTab(tab);
    setStatusFilter("all");
  };

  const selectStatusFilter = (value: WorkerTab | "all") => {
    setStatusFilter(value);
    if (value !== "all") setActiveTab(value);
  };

  return (
    <div className="space-y-5">
      {!dashboardShell && (
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Vikaroversigt</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overblik over aktive, ledige og inaktive vikarer.
          </p>
        </div>
      )}

      {showBackLink && (
        <div>
          <a href={backHref} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            ← Timesedler
          </a>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkerKpiCard
          label="I arbejde"
          value={working.length}
          helper="Se alle i arbejde"
          icon={UsersRound}
          tone="blue"
          active={activeTab === "working"}
          onClick={() => selectTab("working")}
        />
        <WorkerKpiCard
          label="Ledige"
          value={available.length}
          helper="Se alle ledige"
          icon={UserRoundCheck}
          tone="green"
          active={activeTab === "available"}
          onClick={() => selectTab("available")}
        />
        <WorkerKpiCard
          label="Inaktive"
          value={inactiveRows.length}
          helper="Se alle inaktive"
          icon={UserRoundX}
          tone="orange"
          active={activeTab === "inactive"}
          onClick={() => selectTab("inactive")}
        />
        <WorkerKpiCard
          label="Aktive timeseddeluger"
          value={activeTimesheetWeeks}
          helper="Aktive ugeforløb"
          icon={CalendarDays}
          tone="purple"
        />
      </section>

      <div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <WorkerTabButton
                label="I arbejde"
                count={working.length}
                active={activeTab === "working"}
                onClick={() => selectTab("working")}
              />
              <WorkerTabButton
                label="Ledige"
                count={available.length}
                active={activeTab === "available"}
                onClick={() => selectTab("available")}
              />
              <WorkerTabButton
                label="Inaktive"
                count={inactiveRows.length}
                active={activeTab === "inactive"}
                onClick={() => selectTab("inactive")}
              />
            </div>

            <div className="mt-4 grid min-w-0 gap-3 border-t border-slate-100 py-4 lg:grid-cols-2 xl:grid-cols-[minmax(14rem,1.3fr)_minmax(9rem,0.8fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)]">
              <label className="grid gap-1">
                <span className="invisible text-xs font-medium text-slate-500">Søgning</span>
                <span className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchValue}
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="Søg efter navn, email eller tlf."
                    className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-10 text-sm shadow-sm"
                  />
                </span>
              </label>

              <FilterSelect
                label="Fag"
                value={tradeFilter}
                onChange={setTradeFilter}
                options={tradeOptions}
                allLabel="Alle fag"
              />
              <FilterSelect
                label="Virksomhed"
                value={companyFilter}
                onChange={setCompanyFilter}
                options={companyOptions}
                allLabel="Alle virksomheder"
              />
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => selectStatusFilter(event.target.value as WorkerTab | "all")}
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">Alle statusser</option>
                  <option value="working">I arbejde</option>
                  <option value="available">Ledig</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </label>
            </div>
          </div>

          <WorkerTable
            rows={filteredRows}
            activeTab={activeTab}
            selectedWorkerKey={selectedRow?.worker.key ?? ""}
            onSelectWorker={setSelectedWorkerKey}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
            <span>
              Viser {filteredRows.length === 0 ? 0 : 1}-{filteredRows.length} af{" "}
              {rowsByTab[activeTab].length}
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {activeTabLabel(activeTab)}
            </span>
          </div>
        </section>

        <WorkerDetailPanel
  row={selectedRow}
  activeTab={activeTab}
  inactiveMode={activeTab === "inactive"}
  onInactivate={inactivateWorker}
  onRestore={restoreWorker}
  onDelete={deleteWorker}
/>
      </div>
    </div>
  );
}

function WorkerKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof UsersRound;
  tone: WorkerTone;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30",
        active && "border-blue-300 ring-2 ring-blue-100",
        !onClick && "cursor-default hover:border-slate-200 hover:bg-white",
      )}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full",
            tone === "blue" && "bg-blue-100 text-blue-700",
            tone === "green" && "bg-emerald-100 text-emerald-700",
            tone === "orange" && "bg-orange-100 text-orange-700",
            tone === "purple" && "bg-violet-100 text-violet-700",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-700">{label}</span>
          <span className="mt-1 block text-3xl font-semibold leading-none text-slate-950">
            {value}
          </span>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
            {helper}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </div>
    </button>
  );
}

function WorkerTabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-3 pb-3 text-sm font-semibold transition-colors",
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorkerTable({
  rows,
  activeTab,
  selectedWorkerKey,
  onSelectWorker,
}: {
  rows: WorkerRow[];
  activeTab: WorkerTab;
  selectedWorkerKey: string;
  onSelectWorker: (workerKey: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-14 text-center text-sm text-slate-500">
        Ingen vikarer matcher den valgte visning.
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[57rem] table-fixed text-sm">
        <colgroup>
          <col className="w-[9rem]" />
          <col className="w-[10rem]" />
          <col className="w-[6rem]" />
          <col className="w-[7rem]" />
          <col className="w-[7rem]" />
          <col className="w-[5.75rem]" />
          <col className="w-[5.75rem]" />
          <col className="w-[4.5rem]" />
          <col className="w-[4.5rem]" />
        </colgroup>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Navn</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Telefon</th>
            <th className="px-4 py-3 font-semibold">Fag</th>
            <th className="px-4 py-3 font-semibold">Virksomhed</th>
            <th className="px-4 py-3 font-semibold">Start dato</th>
            <th className="px-4 py-3 font-semibold">Slut dato</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="sticky right-0 z-10 bg-slate-50 px-1 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedWorkerKey === row.worker.key;
            return (
              <tr
                key={row.worker.key}
                className={cn(
                  "border-t border-slate-100 transition-colors hover:bg-blue-50/40",
                  selected && "bg-blue-50/70",
                )}
              >
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onSelectWorker(row.worker.key)}
                    className="flex w-full min-w-0 items-center gap-3 text-left"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {workerInitials(row.worker)}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-slate-950">
                      {row.worker.name || "—"}
                    </span>
                  </button>
                </td>
                <td className="truncate px-4 py-4 text-slate-600">{row.worker.email || "—"}</td>
                <td className="truncate px-4 py-4 text-slate-600">{row.worker.phone || "—"}</td>
                <td className="truncate px-4 py-4 text-slate-600">
                  {formatTradeSkills(row.worker)}
                </td>
                <td className="truncate px-4 py-4 font-medium text-slate-700">
                  {displayCompanyName(row)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                  {formatDate(row.bookingStart)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                  {formatDate(row.bookingEnd)}
                </td>
                <td className="px-4 py-4">
                  <WorkerStatusBadge status={workerStatus(row, activeTab)} />
                </td>
                <td
                  className={cn(
                    "sticky right-0 z-10 px-1 py-4 text-right",
                    selected ? "bg-blue-50" : "bg-white",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectWorker(row.worker.key)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-[#164a82] hover:bg-blue-50 hover:text-blue-700"
                  >
                    Åbn
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkerDetailPanel({
  row,
  activeTab,
  inactiveMode,
  onInactivate,
  onRestore,
  onDelete,
}: {
  row: WorkerRow | null;
  activeTab: WorkerTab;
  inactiveMode: boolean;
  onInactivate?: (worker: KnownWorker) => void;
  onRestore?: (worker: KnownWorker) => void;
  onDelete?: (worker: KnownWorker) => void;
}) {
  if (!row) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Vælg en vikar for at se oplysninger.
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
          {workerInitials(row.worker)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{row.worker.name || "—"}</h2>
              <p className="mt-1 text-sm text-slate-500">{row.worker.email || "—"}</p>
              <p className="mt-1 text-sm text-slate-500">{row.worker.phone || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <PanelMetric label="Status" value={workerStatusLabel(workerStatus(row, activeTab))} />
        <PanelMetric label="Startdato" value={formatDate(row.bookingStart)} />
        <PanelMetric label="Slutdato" value={formatDate(row.bookingEnd)} />
        <PanelMetric label="Aktive timeseddeluger" value={String(row.currentTimesheets.length)} />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Kontaktinformation</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="break-all">{row.worker.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-400" />
            <span>{row.worker.phone || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
            <span>{displayCompanyName(row)}</span>
          </div>
        </div>
      </div>

      <WorkerDetails
  row={row}
  inactiveMode={inactiveMode}
  onInactivate={onInactivate}
  onRestore={onRestore}
  onDelete={onDelete}
  variant="panel"
/>
    </aside>
  );
}

function PanelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function WorkerStatusBadge({ status }: { status: WorkerTab }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "working" && "bg-emerald-100 text-emerald-700",
        status === "available" && "bg-blue-100 text-blue-700",
        status === "inactive" && "bg-orange-100 text-orange-700",
      )}
    >
      {workerStatusLabel(status)}
    </span>
  );
}

function workerStatus(row: WorkerRow, tab: WorkerTab): WorkerTab {
  if (row.worker.inactive || tab === "inactive") return "inactive";
  if (row.hasActiveBooking || tab === "working") return "working";
  return "available";
}

function workerStatusLabel(status: WorkerTab): string {
  if (status === "working") return "I arbejde";
  if (status === "inactive") return "Inaktiv";
  return "Ledig";
}

function activeTabLabel(tab: WorkerTab): string {
  if (tab === "working") return "I arbejde";
  if (tab === "inactive") return "Inaktive";
  return "Ledige";
}

function workerInitials(worker: KnownWorker): string {
  const source = worker.name || worker.email || worker.key;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTradeSkills(worker: KnownWorker): string {
  return worker.tradeSkills.length ? worker.tradeSkills.join(", ") : "—";
}

function displayCompanyName(row: WorkerRow): string {
  return (
    row.assignments[0]?.companyName ||
    row.futureAssignments[0]?.companyName ||
    row.nextTimesheet?.brugervirksomhed ||
    "—"
  );
}

function uniqueTradeOptions(rows: WorkerRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.worker.tradeSkills))].sort((a, b) =>
    a.localeCompare(b, "da-DK"),
  );
}

function uniqueCompanyOptions(rows: WorkerRow[]): string[] {
  return [...new Set(rows.map(displayCompanyName).filter((value) => value !== "—"))].sort((a, b) =>
    a.localeCompare(b, "da-DK"),
  );
}

function filterWorkerRows(
  rows: WorkerRow[],
  filters: {
    query: string;
    trade: string;
    company: string;
    status: WorkerTab | "all";
    currentTab: WorkerTab;
  },
): WorkerRow[] {
  const query = filters.query.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.status !== "all" && filters.status !== filters.currentTab) return false;
    if (
  filters.trade !== "all" &&
  !row.worker.tradeSkills.some((skill) => skill === filters.trade)
) {
  return false;
}
    if (filters.company !== "all" && displayCompanyName(row) !== filters.company) return false;

    if (!query) return true;

    const haystack = [
      row.worker.name,
      row.worker.email,
      row.worker.phone,
      row.worker.code,
      row.worker.competencies,
      displayCompanyName(row),
      formatTradeSkills(row.worker),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function WorkerDetails({
  row,
  inactiveMode,
  onInactivate,
  onRestore,
  onDelete,
  variant = "inline",
}: {
  row: WorkerRow;
  inactiveMode: boolean;
  onInactivate?: (worker: KnownWorker) => void;
  onRestore?: (worker: KnownWorker) => void;
  onDelete?: (worker: KnownWorker) => void;
  variant?: "inline" | "panel";
}) {
  const [editing, setEditing] = useState(false);
  const timesheet = row.currentTimesheets[0];
  const assignment = row.assignments[0];
  const plannedAssignment = row.futureAssignments[0];
  const nextTimesheet = row.nextTimesheet;
  const hasActiveBooking = Boolean(timesheet || assignment);
  const hasFutureBooking = Boolean(plannedAssignment || nextTimesheet);
  const tradeSkills = row.worker.tradeSkills.length ? row.worker.tradeSkills.join(", ") : "—";
  const period =
    row.bookingStart || row.bookingEnd
      ? `${formatDate(row.bookingStart)} – ${formatDate(row.bookingEnd)}`
      : "—";

  return (
    <div
      className={cn(variant === "panel" ? "border-t border-slate-200 pt-3" : "mt-4 border-t pt-3")}
    >
      {editing ? (
        <WorkerEditForm worker={row.worker} onClose={() => setEditing(false)} />
      ) : (
        <>
          <dl className="text-sm">
            <DetailRow label="Vikar" value={row.worker.name || "—"} />
            <DetailRow label="Kode" value={row.worker.code || "—"} />
            <DetailRow label="Vikarens e-mail" value={row.worker.email || "—"} />
            <DetailRow label="Vikarens telefon" value={row.worker.phone || "—"} />
            <DetailRow label="Adresse" value={row.worker.address || "—"} />
            <DetailRow label="CPR-nr." value={row.worker.cpr || "—"} />
            <DetailRow
              label="Sprog"
              value={
                WORKER_LANGUAGES.find((item) => item.value === row.worker.language)?.label ||
                "Dansk"
              }
            />
            {hasActiveBooking ? (
              <>
                <DetailRow
                  label="Brugervirksomhed"
                  value={timesheet?.brugervirksomhed || assignment?.companyName || "—"}
                />
                <DetailRow
                  label="Projekt"
                  value={timesheet?.projectName || assignment?.projectName || "—"}
                />
                <DetailRow label="Kontaktperson" value={timesheet?.kontaktperson || "—"} />
                <DetailRow
                  label="Kontaktperson telefon"
                  value={timesheet?.kontaktpersonPhone || "—"}
                />
                <DetailRow label="Mail" value={timesheet?.kontaktpersonEmail || "—"} />
                <DetailRow label="Reference" value={timesheet?.referenceNo || "—"} />
                <DetailRow label="Arbejdssted" value={timesheet?.arbejdssted || "—"} />
                <DetailRow label="Periode" value={period} />
                <DetailRow label="Overenskomst" value={timesheet?.overenskomst || "—"} />
              </>
            ) : hasFutureBooking ? (
              <>
                <DetailRow label="Booking" value="Ikke aktiv endnu" />
                <DetailRow
                  label="Brugervirksomhed"
                  value={plannedAssignment?.companyName || nextTimesheet?.brugervirksomhed || "—"}
                />
                <DetailRow
                  label="Projekt"
                  value={plannedAssignment?.projectName || nextTimesheet?.projectName || "—"}
                />
                <DetailRow label="Periode" value={period} />
                <DetailRow label="Overenskomst" value={nextTimesheet?.overenskomst || "—"} />
              </>
            ) : (
              <DetailRow label="Booking" value="Ingen aktiv booking" />
            )}
            <DetailRow label="Fag" value={tradeSkills} />
            <DetailRow label="Kompetencer" value={row.worker.competencies || "—"} />
          </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
            {!inactiveMode && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Rediger vikar
              </Button>
            )}

            {inactiveMode ? (
  <>
    <Button size="sm" onClick={() => onRestore?.(row.worker)}>
      <RotateCcw className="mr-1.5 h-4 w-4" />
      Læg tilbage i ledige vikarer
    </Button>

    <Button variant="destructive" size="sm" onClick={() => onDelete?.(row.worker)}>
      Slet vikar
    </Button>
  </>
) : (
  <Button variant="destructive" size="sm" onClick={() => onInactivate?.(row.worker)}>
    Gør inaktiv
  </Button>
)}
          </div>
        </>
      )}
    </div>
  );
}

type WorkerEditState = Pick<
  KnownWorker,
  | "name"
  | "code"
  | "email"
  | "phone"
  | "address"
  | "cpr"
  | "language"
  | "tradeSkills"
  | "competencies"
>;

function WorkerEditForm({ worker, onClose }: { worker: KnownWorker; onClose: () => void }) {
  const [form, setForm] = useState<WorkerEditState>({
    name: worker.name,
    code: worker.code,
    email: worker.email,
    phone: worker.phone,
    address: worker.address,
    cpr: worker.cpr,
    language: worker.language,
    tradeSkills: worker.tradeSkills,
    competencies: worker.competencies,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const update = (patch: Partial<WorkerEditState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const toggleSkill = (skill: TradeSkill, checked: boolean) => {
    update({
      tradeSkills: checked
        ? [...new Set([...form.tradeSkills, skill])]
        : form.tradeSkills.filter((item) => item !== skill),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push("Vikarnavn mangler");
    if (!form.code.trim()) nextErrors.push("Kode mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      nextErrors.push("Vikarens mail mangler eller er ugyldig");
    if (!form.phone.trim()) nextErrors.push("Vikarens telefon mangler");
    if (!form.address.trim()) nextErrors.push("Adresse mangler");
    if (!form.cpr.trim()) nextErrors.push("CPR-nr. mangler");
    if (!form.tradeSkills.length) nextErrors.push("Vælg mindst ét fag for vikaren");
    if (!form.competencies.trim()) nextErrors.push("Kompetencer mangler");
    setErrors(nextErrors);
    if (nextErrors.length) return;

    updateKnownWorker(worker, form);
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          <div className="font-medium">Ret følgende:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <EditField label="Vikarnavn *">
          <Input
            required
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </EditField>
        <EditField label="Kode *">
          <Input
            required
            value={form.code}
            onChange={(event) => update({ code: event.target.value })}
          />
        </EditField>
        <EditField label="Vikarens mail *">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(event) => update({ email: event.target.value })}
          />
        </EditField>
        <EditField label="Vikarens telefon *">
          <Input
            required
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </EditField>
        <EditField label="Adresse *">
          <Input
            required
            value={form.address}
            onChange={(event) => update({ address: event.target.value })}
          />
        </EditField>
        <EditField label="CPR-nr. *">
          <Input
            required
            value={form.cpr}
            onChange={(event) => update({ cpr: event.target.value })}
          />
        </EditField>
        <EditField label="Sprog *">
          <select
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2"
            value={form.language}
            onChange={(event) => update({ language: event.target.value as WorkerLanguage })}
          >
            {WORKER_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </EditField>
        <div>
          <span className="mb-1.5 block font-medium">Vikarens fag *</span>
          <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3">
            {TRADE_SKILLS.map((skill) => (
              <label key={skill} className="inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={form.tradeSkills.includes(skill)}
                  onChange={(event) => toggleSkill(skill, event.target.checked)}
                />
                {skill}
              </label>
            ))}
          </div>
        </div>
        <EditField label="Kompetencer *" className="md:col-span-2">
          <textarea
            required
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2"
            value={form.competencies}
            onChange={(event) => update({ competencies: event.target.value })}
          />
        </EditField>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Annullér
        </Button>
        <Button type="submit" size="sm">
          Gem vikar
        </Button>
      </div>
    </form>
  );
}

function EditField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildWorkerRows(
  timesheets: Timesheet[],
  companies: Company[],
  options: { inactive?: boolean } = {},
): WorkerRow[] {
  const today = localISODate(new Date());
  const activeTimesheets = timesheets.filter(
    (item) =>
      !item.archived &&
      !item.workerInactive &&
      !item.workerConsentInactive &&
      (item.status !== "draft" || hasPlannedBooking(item)),
  );
  const knownWorkers = knownWorkersForOverview(timesheets, companies, options);

  return knownWorkers
    .map((worker) => {
      const assignments = currentProjectAssignments(worker, companies, today);
      const futureAssignments = futureProjectAssignments(worker, companies, today);
      const displayAssignments = [...assignments, ...futureAssignments];
      const workerTimesheets = activeTimesheets.filter((timesheet) =>
        workerMatchesTimesheet(worker, timesheet),
      );
      const currentTimesheets = workerTimesheets.filter((timesheet) =>
        isTimesheetBookingActiveToday(today, timesheet),
      );
      const nextTimesheet = nextFutureTimesheet(workerTimesheets, today);
      const nextBookingDate = nextBookingStartForWorker(futureAssignments, workerTimesheets, today);
      const booking = currentOrNextBooking(displayAssignments, workerTimesheets, today);
      const hasActiveBooking = assignments.length > 0 || currentTimesheets.length > 0;
      return {
        worker,
        assignments,
        futureAssignments,
        currentTimesheets,
        nextTimesheet,
        hasActiveBooking,
        nextBookingStart: nextBookingDate,
        bookingStart: booking.startDate,
        bookingEnd: booking.endDate,
      };
    })
    .sort(compareWorkerRowsByBookingStart);
}

function knownWorkersForOverview(
  timesheets: Timesheet[],
  _companies: Company[],
  options: { inactive?: boolean } = {},
): KnownWorker[] {
  if (options.inactive) {
    return knownWorkersIncludingInactiveFromTimesheets(timesheets).filter(
      (worker) => worker.inactive,
    );
  }
  return knownWorkersFromTimesheets(timesheets).filter((worker) => !worker.inactive);
}

function currentProjectAssignments(
  worker: KnownWorker,
  companies: Company[],
  today: string,
): Assignment[] {
  const assignments: Assignment[] = [];
  for (const company of companies) {
    for (const project of company.projects) {
      if (!isProjectBookingActiveToday(project, today)) continue;
      if (!projectHasWorker(project, worker)) continue;
      assignments.push({
        companyName: company.name,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
      });
    }
  }
  return assignments;
}

function futureProjectAssignments(
  worker: KnownWorker,
  companies: Company[],
  today: string,
): Assignment[] {
  const assignments: Assignment[] = [];

  for (const company of companies) {
    for (const project of company.projects) {
      if (!project.startDate || project.startDate <= today) continue;
      if (!projectHasWorker(project, worker)) continue;

      assignments.push({
        companyName: company.name,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
      });
    }
  }

  return assignments;
}

function nextFutureTimesheet(timesheets: Timesheet[], today: string): Timesheet | null {
  return (
    timesheets
      .filter((timesheet) => timesheet.weekStart && timesheet.weekStart > today)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0] ?? null
  );
}

function nextBookingStartForWorker(
  futureAssignments: Assignment[],
  timesheets: Timesheet[],
  today: string,
): string {
  const futureStarts = [
    ...futureAssignments.map((assignment) => assignment.startDate),
    ...futureTimesheetShiftDates(timesheets, today),
  ].filter(Boolean);

  return futureStarts.sort((a, b) => a.localeCompare(b))[0] ?? "";
}

function workerMatchesTimesheet(worker: KnownWorker, timesheet: Timesheet): boolean {
  const workerNameKey = normalizeReference(worker.name || worker.key);
  const timesheetNameKey = normalizeReference(timesheet.vikar);
  if (workerNameKey && timesheetNameKey) return workerNameKey === timesheetNameKey;

  const workerCodeKey = normalizeReference(worker.code);
  const timesheetCodeKey = normalizeReference(timesheet.vikarCode ?? "");
  if (workerCodeKey && timesheetCodeKey) return workerCodeKey === timesheetCodeKey;

  const workerEmailKey = normalizeReference(worker.email);
  const timesheetEmailKey = normalizeReference(timesheet.vikarEmail);
  return Boolean(workerEmailKey && timesheetEmailKey && workerEmailKey === timesheetEmailKey);
}

function hasPlannedBooking(timesheet: Timesheet): boolean {
  return Boolean(
    (timesheet.brugervirksomhed || timesheet.projectId || timesheet.projectName) &&
    timesheet.weekStart &&
    (timesheet.projectEndDate || timesheet.days.some((day) => day.start && day.end)),
  );
}

function isProjectBookingActiveToday(project: CompanyProject, today: string): boolean {
  return Boolean(
    project.startDate && project.endDate && project.startDate <= today && today <= project.endDate,
  );
}

function projectHasWorker(project: CompanyProject, worker: KnownWorker): boolean {
  const projectReferences = project.workerEmails.map((item) => normalizeReference(item));
  const workerNameKey = normalizeReference(worker.name || worker.key);
  const workerCodeKey = normalizeReference(worker.code);

  if (workerNameKey && projectReferences.includes(workerNameKey)) return true;
  if (workerCodeKey && projectReferences.includes(workerCodeKey)) return true;

  const workerEmailKey = normalizeReference(worker.email);
  return Boolean(
    !workerNameKey &&
    !workerCodeKey &&
    workerEmailKey &&
    projectReferences.includes(workerEmailKey),
  );
}

function normalizeReference(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTimesheetBookingActiveToday(today: string, timesheet: Timesheet): boolean {
  if (!timesheet.weekStart) return false;
  const endDate = timesheet.projectEndDate || addDays(timesheet.weekStart, 6);
  return timesheet.weekStart <= today && today <= endDate;
}

function futureTimesheetShiftDates(timesheets: Timesheet[], today: string): string[] {
  return timesheets.flatMap((timesheet) => {
    if (!timesheet.weekStart) return [];

    return timesheet.days
      .map((day, index) => ({
        date: addDays(timesheet.weekStart, index),
        hasShift: Boolean(day?.start && day?.end),
      }))
      .filter((item) => item.hasShift && item.date > today)
      .map((item) => item.date);
  });
}

function daysBetween(startIsoDate: string, endIsoDate: string): number {
  const start = new Date(`${startIsoDate}T12:00:00`);
  const end = new Date(`${endIsoDate}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentOrNextBooking(
  assignments: Assignment[],
  timesheets: Timesheet[],
  today: string,
): { startDate: string; endDate: string } {
  const periods = [
    ...assignments.map((assignment) => ({
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    })),
    ...timesheets.map((timesheet) => ({
      startDate: timesheet.weekStart,
      endDate: timesheet.projectEndDate || addDays(timesheet.weekStart, 6),
    })),
  ].filter((period) => period.startDate && period.endDate);

  const currentPeriod = periods
    .filter((period) => period.startDate <= today && today <= period.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .at(0);
  if (currentPeriod) return currentPeriod;

  const nextPeriod = periods
    .filter((period) => period.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(0);
  if (nextPeriod) return nextPeriod;

  return (
    periods
      .filter((period) => period.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .at(0) ?? {
      startDate: "",
      endDate: "",
    }
  );
}

function compareWorkerRowsByBookingStart(a: WorkerRow, b: WorkerRow): number {
  if (!a.bookingStart && b.bookingStart) return -1;
  if (a.bookingStart && !b.bookingStart) return 1;
  if (a.bookingStart && b.bookingStart && a.bookingStart !== b.bookingStart) {
    return b.bookingStart.localeCompare(a.bookingStart);
  }
  return a.worker.name.localeCompare(b.worker.name, "da-DK");
}

function compareAvailableWorkerRows(a: WorkerRow, b: WorkerRow): number {
  if (!a.nextBookingStart && b.nextBookingStart) return -1;
  if (a.nextBookingStart && !b.nextBookingStart) return 1;

  if (a.nextBookingStart && b.nextBookingStart && a.nextBookingStart !== b.nextBookingStart) {
    return b.nextBookingStart.localeCompare(a.nextBookingStart);
  }

  return a.worker.name.localeCompare(b.worker.name, "da-DK");
}

function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
