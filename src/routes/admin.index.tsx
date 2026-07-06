import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  calculateTimesheet,
  formatWeekRange,
  setArchived,
  STATUS_LABEL,
  timesheetRetentionWarning,
  timesheetsToCodeCsv,
  timesheetsToCsv,
  totalHours,
  weekNumber,
  type Status,
  type Timesheet,
} from "@/lib/timesheet-store";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import { timesheetsVisibleForRole } from "@/lib/company-access";
import type { Role } from "@/lib/auth";
import { listCompanies } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Timesedler" }] }),
  component: AdminList,
});

type DashboardStatus = Status | "all" | "archived" | "inactive";
type DashboardTone = "blue" | "amber" | "green" | "red" | "slate";

function AdminList() {
  return <AdminOverviewContent role="admin" dashboardShell />;
}

export function AdminOverviewContent({
  role,
  previewUserId,
  dashboardShell = false,
  dashboardAllow,
}: {
  role: Role;
  previewUserId?: string;
  dashboardShell?: boolean;
  dashboardAllow?: Role[];
}) {
  const canManageArchive = role === "admin";
  const dashboardMode = dashboardShell;
  const sectionBase = role === "bruger" ? "/bruger1" : role === "bruger2" ? "/bruger2" : "/admin";
  const all = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DashboardStatus>("all");
  const [agreement, setAgreement] = useState("all");
  const [week, setWeek] = useState("");
  const [archiveMode, setArchiveMode] = useState(false);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  useEffect(() => {
    if (!canManageArchive && (status === "archived" || status === "inactive")) {
      setStatus("all");
    }
  }, [canManageArchive, status]);

  const visibleTimesheets = useMemo(
    () => timesheetsVisibleForRole(all, role, companies),
    [all, role, companies],
  );
  const submitted = useMemo(
    () => visibleTimesheets.filter((item) => item.status !== "draft"),
    [visibleTimesheets],
  );
  const visibleSubmitted = useMemo(
    () =>
      submitted.filter(
        (item) =>
          (canManageArchive && (status === "archived" || status === "inactive")) ||
          (!item.archived && !item.workerConsentInactive),
      ),
    [canManageArchive, submitted, status],
  );

  const list = useMemo(() => {
    const needle = query.toLocaleLowerCase("da-DK");
    return visibleSubmitted.filter((item) => {
      const text = `${item.vikar} ${item.brugervirksomhed} ${item.kontaktperson}`.toLocaleLowerCase(
        "da-DK",
      );
      return (
        (!needle || text.includes(needle)) &&
        (status === "all" ||
          (status === "archived"
            ? canManageArchive && item.archived
            : status === "inactive"
              ? canManageArchive && item.workerConsentInactive
              : item.status === status)) &&
        (agreement === "all" || item.selectedAgreementId === agreement) &&
        (!week || String(weekNumber(item.weekStart)) === week)
      );
    });
  }, [canManageArchive, visibleSubmitted, query, status, agreement, week]);

  useEffect(() => {
    if (!list.length) {
      if (selectedTimesheetId) setSelectedTimesheetId(null);
      return;
    }

    if (!selectedTimesheetId || !list.some((item) => item.id === selectedTimesheetId)) {
      setSelectedTimesheetId(list[0].id);
    }
  }, [list, selectedTimesheetId]);

  const selectedTimesheet = useMemo(
    () => list.find((item) => item.id === selectedTimesheetId) ?? list[0] ?? null,
    [list, selectedTimesheetId],
  );

  const exportCsv = () => {
    const blob = new Blob([timesheetsToCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesedler-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCodeCsv = () => {
    const blob = new Blob([timesheetsToCodeCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesedler-med-kode-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const counts = (value: Status) =>
    submitted.filter((item) => !item.archived && item.status === value).length;
  const archivedCount = submitted.filter((item) => item.archived).length;
  const inactiveCount = submitted.filter((item) => item.workerConsentInactive).length;

  const toggleArchiveMode = () => {
    setArchiveMode((current) => {
      if (current) setSelectedArchiveIds([]);
      return !current;
    });
  };

  const toggleArchiveSelection = (id: string, checked: boolean) => {
    setSelectedArchiveIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  };

  const archiveSelected = () => {
    selectedArchiveIds.forEach((id) => setArchived(id, true));
    setSelectedArchiveIds([]);
    setArchiveMode(false);
  };

  const statusCards = [
    {
      key: "sent" as DashboardStatus,
      label: STATUS_LABEL.sent,
      value: counts("sent"),
      meta: "Afventer godkendelse",
      icon: Send,
      tone: "amber" as DashboardTone,
    },
    {
      key: "approved" as DashboardStatus,
      label: STATUS_LABEL.approved,
      value: counts("approved"),
      meta: "Klar til videre håndtering",
      icon: CheckCircle2,
      tone: "green" as DashboardTone,
    },
    {
      key: "rejected" as DashboardStatus,
      label: STATUS_LABEL.rejected,
      value: counts("rejected"),
      meta: "Kræver opfølgning",
      icon: XCircle,
      tone: "red" as DashboardTone,
    },
    {
      key: "archived" as DashboardStatus,
      label: "Arkiveret",
      value: archivedCount,
      meta: "Flyttet til arkiv",
      icon: Archive,
      tone: "slate" as DashboardTone,
    },
    {
      key: "inactive" as DashboardStatus,
      label: "Inaktive",
      value: inactiveCount,
      meta: "Samtykke eller adgang inaktiv",
      icon: UsersRound,
      tone: "slate" as DashboardTone,
    },
  ];

  const renderActionButtons = (stacked = false) => (
    <div className={cn("flex flex-wrap gap-2", stacked && "flex-col")}>
      {canManageArchive && (
        <Button
          variant={archiveMode ? "default" : "outline"}
          onClick={archiveMode && selectedArchiveIds.length ? archiveSelected : toggleArchiveMode}
          disabled={!submitted.length}
          className={cn(stacked && "w-full justify-start")}
        >
          <Archive className="h-4 w-4" />
          {archiveMode && selectedArchiveIds.length
            ? `Arkivér valgte (${selectedArchiveIds.length})`
            : "Arkiver"}
        </Button>
      )}
      {canManageArchive && archiveMode && (
        <Button
          type="button"
          variant="outline"
          onClick={toggleArchiveMode}
          className={cn(stacked && "w-full justify-start")}
        >
          <XCircle className="h-4 w-4" />
          Annullér
        </Button>
      )}
      <Button
        variant="outline"
        onClick={exportCsv}
        disabled={!list.length}
        className={cn(stacked && "w-full justify-start")}
      >
        <Download className="h-4 w-4" />
        Eksportér CSV
      </Button>
      <Button
        variant="outline"
        onClick={exportCodeCsv}
        disabled={!list.length}
        className={cn(stacked && "w-full justify-start")}
      >
        <Download className="h-4 w-4" />
        Eksportér CSV med kode
      </Button>
    </div>
  );

  const filterControlClass = cn(
    "h-10 w-full min-w-0 rounded-lg border px-3 text-sm outline-none transition-colors",
    dashboardMode
      ? "border-slate-200 bg-white text-slate-900 shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      : "border-input bg-background",
  );

  const filters = (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:grid-cols-2",
        dashboardMode
          ? "xl:grid-cols-[minmax(16rem,1.4fr)_minmax(10rem,1fr)_minmax(13rem,1fr)_8rem]"
          : "lg:grid-cols-4",
      )}
    >
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Søg vikar eller virksomhed…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(filterControlClass, "pl-9")}
        />
      </label>
      <select
        className={filterControlClass}
        value={status}
        onChange={(e) => setStatus(e.target.value as DashboardStatus)}
      >
        <option value="all">Alle statusser</option>
        {Object.entries(STATUS_LABEL)
          .filter(([value]) => value !== "draft")
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        {canManageArchive && (
          <>
            <option value="archived">Arkiverede</option>
            <option value="inactive">Inaktive timesedler</option>
          </>
        )}
      </select>
      <select
        className={filterControlClass}
        value={agreement}
        onChange={(e) => setAgreement(e.target.value)}
      >
        <option value="all">Alle overenskomster</option>
        {activeCollectiveAgreements.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <Input
        type="number"
        min={1}
        max={53}
        placeholder="Ugenummer"
        value={week}
        onChange={(e) => setWeek(e.target.value)}
        className={filterControlClass}
      />
    </div>
  );

  const listContent =
    list.length === 0 ? (
      <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Ingen timesedler matcher filtrene.
      </div>
    ) : (
      <>
        <div className="space-y-3 md:hidden">
          {list.map((item) => {
            const calc = calculateTimesheet(item);
            const retentionWarning = timesheetRetentionWarning(item);
            return (
              <article key={item.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{item.vikar || "—"}</h2>
                    <p className="text-sm text-muted-foreground">{item.brugervirksomhed || "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uge {weekNumber(item.weekStart)} · {formatWeekRange(item.weekStart)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.archived && (
                      <span className="text-xs text-muted-foreground">Arkiveret</span>
                    )}
                    {item.workerConsentInactive && (
                      <span className="text-xs text-muted-foreground">Inaktiv</span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Kode</dt>
                    <dd>{item.vikarCode || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Timer</dt>
                    <dd className="tabular-nums">{totalHours(item.days).toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Kontakt</dt>
                    <dd>{item.kontaktperson || "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Overenskomst</dt>
                    <dd className="truncate">{calc.agreementName || "—"}</dd>
                    <dd className="text-xs text-muted-foreground">{calc.rateValidationStatus}</dd>
                  </div>
                </dl>

                {retentionWarning && (
                  <div
                    className={
                      retentionWarning.level === "critical"
                        ? "mt-3 text-xs text-status-rejected-fg"
                        : "mt-3 text-xs text-status-sent-fg"
                    }
                  >
                    {retentionWarning.text}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  {canManageArchive && archiveMode ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedArchiveIds.includes(item.id)}
                        disabled={Boolean(item.archived)}
                        onChange={(event) => toggleArchiveSelection(item.id, event.target.checked)}
                      />
                      Arkiver
                    </label>
                  ) : (
                    <span />
                  )}
                  <Link
                    to="/admin/$id"
                    params={{ id: item.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    Åbn →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div
          className={cn(
            "hidden overflow-x-auto rounded-lg border bg-card md:block",
            dashboardMode && "rounded-xl border-slate-200 bg-white shadow-sm",
          )}
        >
          <table className="w-full min-w-[980px] text-sm">
            <thead
              className={cn(
                "bg-muted/50 text-left text-muted-foreground",
                dashboardMode && "bg-slate-50 text-xs uppercase tracking-normal text-slate-500",
              )}
            >
              <tr>
                {[
                  canManageArchive && archiveMode ? "Arkiver" : "",
                  "Vikar",
                  "Kode",
                  "Virksomhed",
                  "Uge",
                  "Overenskomst",
                  "Timer",
                  "Status",
                  "",
                ].map((head, i) => (
                  <th key={`${head}-${i}`} className="px-4 py-3 font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const calc = calculateTimesheet(item);
                const retentionWarning = timesheetRetentionWarning(item);
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedTimesheetId(item.id)}
                    className={cn(
                      "cursor-pointer border-t transition-colors hover:bg-muted/20",
                      dashboardMode && "border-slate-100 hover:bg-blue-50/40",
                      dashboardMode && selectedTimesheet?.id === item.id && "bg-blue-50/70",
                    )}
                  >
                    <td className="px-4 py-3">
                      {canManageArchive && archiveMode && (
                        <input
                          type="checkbox"
                          checked={selectedArchiveIds.includes(item.id)}
                          disabled={Boolean(item.archived)}
                          onChange={(event) =>
                            toggleArchiveSelection(item.id, event.target.checked)
                          }
                          aria-label={`Vælg timeseddel for ${item.vikar || "vikar"} til arkiv`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {dashboardMode && (
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                            {initialsFor(item.vikar)}
                          </span>
                        )}
                        <span className="min-w-0 truncate font-semibold text-slate-900">
                          {item.vikar || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.vikarCode || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {item.brugervirksomhed || "—"}
                      </div>
                      <div className="text-xs text-slate-500">{item.kontaktperson || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        Uge {weekNumber(item.weekStart)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatWeekRange(item.weekStart)}
                      </div>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3" title={calc.agreementName}>
                      <div className="font-medium text-slate-900">{calc.agreementName || "—"}</div>
                      <div className="text-xs text-slate-500">{calc.rateValidationStatus}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                      {totalHours(item.days).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                      {item.archived && (
                        <div className="mt-1 text-xs text-slate-500">Arkiveret</div>
                      )}
                      {item.workerConsentInactive && (
                        <div className="mt-1 text-xs text-slate-500">Inaktiv</div>
                      )}
                      {retentionWarning && (
                        <div
                          className={
                            retentionWarning.level === "critical"
                              ? "mt-1 text-xs text-status-rejected-fg"
                              : "mt-1 text-xs text-status-sent-fg"
                          }
                        >
                          {retentionWarning.text}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/$id"
                        params={{ id: item.id }}
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          "font-medium text-primary hover:underline",
                          dashboardMode &&
                            "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50 hover:no-underline",
                        )}
                      >
                        Åbn
                        {dashboardMode ? <MoreHorizontal className="h-3.5 w-3.5" /> : " →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );

  const standardContent = (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-x-16 gap-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Timesedler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "admin"
                ? "Administrér indsendelser, kontrol og regelgrundlag."
                : "Administrér indsendelser og kontrol."}
            </p>
          </div>
          <Link
            to={previewUserId ? "/admin/users/$id" : `${sectionBase}/workers`}
            params={previewUserId ? { id: previewUserId } : undefined}
            search={previewUserId ? { view: "workers" } : undefined}
            className="group block"
          >
            <h2 className="text-2xl font-semibold text-primary group-hover:underline">
              Vikaroversigt
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overblik over ledige vikarer og aktive vikarer
            </p>
          </Link>
          {previewUserId && (
            <a href={`/admin/users/${previewUserId}?view=companies`} className="group block">
              <h2 className="text-2xl font-semibold text-primary group-hover:underline">
                Virksomheder
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Oversigt over brugerens virksomheder
              </p>
            </a>
          )}
        </div>
        {renderActionButtons()}
      </div>

      <div
        className={`mb-6 grid grid-cols-2 gap-3 ${canManageArchive ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}
      >
        {(["sent", "approved", "rejected"] as Status[]).map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="text-2xl font-semibold tabular-nums">{counts(value)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{STATUS_LABEL[value]}</div>
          </button>
        ))}
        {canManageArchive && (
          <>
            <button
              onClick={() => setStatus("archived")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30"
            >
              <div className="text-2xl font-semibold tabular-nums">{archivedCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Arkiverede</div>
            </button>
            <button
              onClick={() => setStatus("inactive")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30"
            >
              <div className="text-2xl font-semibold tabular-nums">{inactiveCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Inaktive timesedler</div>
            </button>
          </>
        )}
      </div>

      <section className="mb-5 rounded-lg border bg-card p-4">{filters}</section>
      {listContent}
    </>
  );

  const dashboardContent = (
    <div className="space-y-5">
      {previewUserId && (
        <section className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/users/$id" params={{ id: previewUserId }} search={{ view: "workers" }}>
              Vikaroversigt
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              to="/admin/users/$id"
              params={{ id: previewUserId }}
              search={{ view: "companies" }}
            >
              Virksomheder
            </Link>
          </Button>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((card) => (
          <DashboardKpiCard
            key={card.key}
            label={card.label}
            value={card.value}
            meta={card.meta}
            icon={card.icon}
            tone={card.tone}
            onClick={() => setStatus(card.key)}
          />
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Filtre</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Søg og filtrér i de eksisterende timesedler.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Viser {list.length} af {submitted.length}
              </span>
            </div>
            {filters}
          </div>
          <div className="shrink-0">{renderActionButtons()}</div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Timeseddel-tabel</h2>
              <p className="mt-1 text-sm text-slate-500">
                Vælg en række for at se detaljer i panelet til højre.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusFilterButton active={status === "all"} onClick={() => setStatus("all")}>
                Alle {submitted.length}
              </StatusFilterButton>
              <StatusFilterButton active={status === "sent"} onClick={() => setStatus("sent")}>
                Sendt {counts("sent")}
              </StatusFilterButton>
              <StatusFilterButton
                active={status === "approved"}
                onClick={() => setStatus("approved")}
              >
                Godkendt {counts("approved")}
              </StatusFilterButton>
              <StatusFilterButton
                active={status === "rejected"}
                onClick={() => setStatus("rejected")}
              >
                Afvist {counts("rejected")}
              </StatusFilterButton>
            </div>
          </div>
          {listContent}
        </section>

        <TimesheetDetailPanel timesheet={selectedTimesheet} />
      </div>
    </div>
  );

  if (dashboardMode) {
    return (
      <AppShell
        allow={dashboardAllow ?? [role]}
        dashboard={{
          title: "Timesedler",
          subtitle: "Håndtering af indsendelser og godkendelser.",
          search: {
            value: query,
            onChange: setQuery,
            placeholder: "Søg efter vikar eller virksomhed...",
          },
        }}
      >
        {dashboardContent}
      </AppShell>
    );
  }

  return standardContent;
}

function TimesheetDetailPanel({ timesheet }: { timesheet: Timesheet | null }) {
  if (!timesheet) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Vælg en timeseddel i tabellen for at se detaljer.
      </aside>
    );
  }

  const calc = calculateTimesheet(timesheet);
  const hours = totalHours(timesheet.days).toFixed(2);
  const invoiceStatus = timesheet.invoiceSentDate ? "Afsendt" : "Ikke afsendt";
  const payrollStatus = timesheet.payrollSentDate ? "Sendt til bogholderi" : "Ikke sendt";

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-950">
            {timesheet.vikar || "—"}
          </h2>
          <div className="mt-2">
            <StatusBadge status={timesheet.status} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Timeseddel: {timesheet.vikarCode || "—"} · Oprettet{" "}
            {formatDateLabel(timesheet.createdAt)}
          </p>
        </div>
        <Link
          to="/admin/$id"
          params={{ id: timesheet.id }}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Åbn timeseddel"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100 px-5">
        <DetailRow
          icon={UserRound}
          label="Vikar"
          title={timesheet.vikar || "—"}
          description={timesheet.vikarEmail || timesheet.vikarPhone || "—"}
        />
        <DetailRow
          icon={Building2}
          label="Virksomhed / Projekt"
          title={timesheet.brugervirksomhed || "—"}
          description={timesheet.projectName || timesheet.kontaktperson || "—"}
        />
        <DetailRow
          icon={CalendarDays}
          label="Periode"
          title={`Uge ${weekNumber(timesheet.weekStart)}`}
          description={formatWeekRange(timesheet.weekStart)}
        />
        <DetailRow
          icon={Clock3}
          label="Timer"
          title={`${hours} timer`}
          description="Detaljeret tidsregistrering"
        />
        <DetailRow
          icon={ShieldCheck}
          label="Overenskomst"
          title={calc.agreementName || "—"}
          description={calc.rateValidationStatus}
        />
        <DetailRow
          icon={ClipboardCheck}
          label="Godkendelsesstatus"
          title={STATUS_LABEL[timesheet.status]}
          description={`Opdateret ${formatDateLabel(timesheet.updatedAt)}`}
        />
        <DetailRow
          icon={FileSpreadsheet}
          label="Fakturastatus"
          title={invoiceStatus}
          description={
            timesheet.invoiceSentDate
              ? `${timesheet.invoiceNumber || "Faktura"} · ${formatDateLabel(timesheet.invoiceSentDate)}`
              : timesheet.invoiceDueDate
                ? `Frist ${formatDateLabel(timesheet.invoiceDueDate)}`
                : "Ingen fakturadato registreret"
          }
          tone={timesheet.invoiceSentDate ? "green" : "amber"}
        />
        <DetailRow
          icon={WalletCards}
          label="Lønstatus"
          title={payrollStatus}
          description={
            timesheet.payrollSentDate
              ? formatDateLabel(timesheet.payrollSentDate)
              : timesheet.payrollDeadline
                ? `Frist ${formatDateLabel(timesheet.payrollDeadline)}`
                : "Ingen løndato registreret"
          }
          tone={timesheet.payrollSentDate ? "green" : "amber"}
        />
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Note</div>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {timesheet.notes || "Ingen note registreret."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to="/admin/$id" params={{ id: timesheet.id }}>
            <Eye className="h-4 w-4" />
            Preview
          </Link>
        </Button>
        <Button asChild size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          <Link to="/admin/$id" params={{ id: timesheet.id }}>
            <FileText className="h-4 w-4" />
            Åbn
          </Link>
        </Button>
      </div>
    </aside>
  );
}

function DetailRow({
  icon: Icon,
  label,
  title,
  description,
  tone = "slate",
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  tone?: "slate" | "amber" | "green";
}) {
  return (
    <div className="flex gap-3 py-4">
      <div
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          detailToneClass(tone),
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-slate-950">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-slate-500">{description}</div>
      </div>
    </div>
  );
}

function DashboardKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  meta: string;
  icon: LucideIcon;
  tone: DashboardTone;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors",
        onClick && "hover:border-blue-200 hover:bg-blue-50/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", toneIconClass(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        {onClick && <ChevronRight className="mt-2 h-4 w-4 text-slate-400" />}
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none text-slate-950 tabular-nums">
        {value}
      </div>
      <div className={cn("mt-2 text-xs font-medium", toneTextClass(tone))}>{meta}</div>
    </Comp>
  );
}

function StatusFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function toneIconClass(tone: DashboardTone): string {
  if (tone === "blue") return "bg-blue-50 text-blue-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  if (tone === "red") return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-500";
}

function toneTextClass(tone: DashboardTone): string {
  if (tone === "blue") return "text-blue-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "green") return "text-emerald-600";
  if (tone === "red") return "text-red-600";
  return "text-slate-500";
}

function detailToneClass(tone: "slate" | "amber" | "green"): string {
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  return "bg-slate-100 text-slate-500";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("da-DK") ?? "")
    .join("");
}

function formatDateLabel(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
