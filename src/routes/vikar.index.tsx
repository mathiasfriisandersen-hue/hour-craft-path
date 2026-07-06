import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  MoreHorizontal,
  Send,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DEMO_PASSWORD, useAuth } from "@/lib/auth";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  formatWeekRange,
  remove,
  STATUS_LABEL,
  totalHours,
  weekNumber,
  type Status,
  type Timesheet,
} from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vikar/")({
  head: () => ({ meta: [{ title: "Vikar — Mine timesedler" }] }),
  component: VikarList,
});

type VikarStatus = Status | "all";
type KpiTone = "blue" | "amber" | "green" | "red" | "slate";

function VikarList() {
  const all = useTimesheets();
  const { workerIdentity } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VikarStatus>("all");
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const workerNameKey = personKey(workerIdentity?.name ?? "");
  const workerEmailKey = personKey(workerIdentity?.email ?? "");

  const workerMatchedList = useMemo(
    () =>
      workerNameKey || workerEmailKey
        ? all.filter((timesheet) => {
            const timesheetNameKey = personKey(timesheet.vikar);
            const timesheetEmailKey = personKey(timesheet.vikarEmail);
            if (workerNameKey) return timesheetNameKey === workerNameKey;
            return Boolean(
              workerEmailKey && timesheetEmailKey && timesheetEmailKey === workerEmailKey,
            );
          })
        : all,
    [all, workerEmailKey, workerNameKey],
  );
  const demoWorkerIdentity =
    Boolean(workerNameKey || workerEmailKey) &&
    workerMatchedList.some((timesheet) => timesheet.workerAccessCode === DEMO_PASSWORD);
  const workerScopedList =
    workerNameKey || workerEmailKey ? (demoWorkerIdentity ? all : workerMatchedList) : all;

  const list = useMemo(() => {
    const needle = query.toLocaleLowerCase("da-DK");
    return workerScopedList.filter((timesheet) => {
      const text =
        `${timesheet.vikar} ${timesheet.brugervirksomhed} ${timesheet.kontaktperson}`.toLocaleLowerCase(
          "da-DK",
        );
      return (
        (!needle || text.includes(needle)) && (status === "all" || timesheet.status === status)
      );
    });
  }, [query, status, workerScopedList]);

  useEffect(() => {
    if (!list.length) {
      if (selectedTimesheetId) setSelectedTimesheetId(null);
      return;
    }

    if (!selectedTimesheetId || !list.some((timesheet) => timesheet.id === selectedTimesheetId)) {
      setSelectedTimesheetId(list[0].id);
    }
  }, [list, selectedTimesheetId]);

  const selectedTimesheet = useMemo(
    () => list.find((timesheet) => timesheet.id === selectedTimesheetId) ?? list[0] ?? null,
    [list, selectedTimesheetId],
  );

  const counts = (value: Status) =>
    workerScopedList.filter((timesheet) => timesheet.status === value).length;
  const kpis = [
    {
      key: "all" as VikarStatus,
      label: "Alle timesedler",
      value: workerScopedList.length,
      meta: "Synlige i vikar-overblikket",
      icon: FileText,
      tone: "blue" as KpiTone,
    },
    {
      key: "draft" as VikarStatus,
      label: STATUS_LABEL.draft,
      value: counts("draft"),
      meta: "Kan redigeres",
      icon: Archive,
      tone: "slate" as KpiTone,
    },
    {
      key: "sent" as VikarStatus,
      label: STATUS_LABEL.sent,
      value: counts("sent"),
      meta: "Afventer godkendelse",
      icon: Send,
      tone: "amber" as KpiTone,
    },
    {
      key: "approved" as VikarStatus,
      label: STATUS_LABEL.approved,
      value: counts("approved"),
      meta: "Godkendt af kontaktperson",
      icon: CheckCircle2,
      tone: "green" as KpiTone,
    },
    {
      key: "rejected" as VikarStatus,
      label: STATUS_LABEL.rejected,
      value: counts("rejected"),
      meta: "Kræver rettelse",
      icon: XCircle,
      tone: "red" as KpiTone,
    },
  ];

  const deleteDraft = (timesheet: Timesheet) => {
    if (window.confirm("Slet denne kladde?")) {
      remove(timesheet.id);
    }
  };

  return (
    <AppShell
      allow={["vikar"]}
      dashboard={{
        title: "Mine timesedler",
        subtitle: "Timesedler oprettes af admin. Åbn din timeseddel fra invitationsmailen.",
        search: {
          value: query,
          onChange: setQuery,
          placeholder: "Søg efter vikar eller virksomhed...",
        },
      }}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {kpis.map((card) => (
            <VikarKpiCard
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Filtre</h2>
              <p className="mt-1 text-xs text-slate-500">
                Viser {list.length} af {workerScopedList.length} timesedler.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusFilterButton active={status === "all"} onClick={() => setStatus("all")}>
                Alle {workerScopedList.length}
              </StatusFilterButton>
              <StatusFilterButton active={status === "draft"} onClick={() => setStatus("draft")}>
                {STATUS_LABEL.draft} {counts("draft")}
              </StatusFilterButton>
              <StatusFilterButton active={status === "sent"} onClick={() => setStatus("sent")}>
                {STATUS_LABEL.sent} {counts("sent")}
              </StatusFilterButton>
              <StatusFilterButton
                active={status === "approved"}
                onClick={() => setStatus("approved")}
              >
                {STATUS_LABEL.approved} {counts("approved")}
              </StatusFilterButton>
              <StatusFilterButton
                active={status === "rejected"}
                onClick={() => setStatus("rejected")}
              >
                {STATUS_LABEL.rejected} {counts("rejected")}
              </StatusFilterButton>
            </div>
          </div>
        </section>

        {list.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
            {workerScopedList.length === 0
              ? "Ingen timesedler endnu. Brug linket i invitationsmailen fra Sub-Z."
              : "Ingen timesedler matcher filtrene."}
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="min-w-0 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Timesedler</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vælg en række for at se detaljer i panelet til højre.
                </p>
              </div>

              <div className="space-y-3 md:hidden">
                {list.map((timesheet) => (
                  <article
                    key={timesheet.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-950">
                          Uge {weekNumber(timesheet.weekStart)}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {formatWeekRange(timesheet.weekStart)}
                        </p>
                      </div>
                      <StatusBadge status={timesheet.status} />
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Vikar</dt>
                        <dd>{timesheet.vikar || <em className="text-slate-400">—</em>}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Timer</dt>
                        <dd className="tabular-nums">{totalHours(timesheet.days).toFixed(2)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Brugervirksomhed</dt>
                        <dd className="break-words">
                          {timesheet.brugervirksomhed || <em className="text-slate-400">—</em>}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
                      {timesheet.status === "draft" && (
                        <button
                          onClick={() => deleteDraft(timesheet)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Slet
                        </button>
                      )}
                      <Link
                        to="/vikar/$id"
                        params={{ id: timesheet.id }}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Åbn →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Uge</th>
                      <th className="px-4 py-3 font-semibold">Periode</th>
                      <th className="px-4 py-3 font-semibold">Vikar</th>
                      <th className="px-4 py-3 font-semibold">Brugervirksomhed</th>
                      <th className="px-4 py-3 font-semibold">Timer</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((timesheet) => (
                      <tr
                        key={timesheet.id}
                        onClick={() => setSelectedTimesheetId(timesheet.id)}
                        className={cn(
                          "cursor-pointer border-t border-slate-100 transition-colors hover:bg-blue-50/40",
                          selectedTimesheet?.id === timesheet.id && "bg-blue-50/70",
                        )}
                      >
                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-950">
                          Uge {weekNumber(timesheet.weekStart)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {formatWeekRange(timesheet.weekStart)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                              {initialsFor(timesheet.vikar)}
                            </span>
                            <span className="min-w-0 truncate font-semibold text-slate-900">
                              {timesheet.vikar || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          {timesheet.brugervirksomhed || <em className="text-slate-400">—</em>}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-950">
                          {totalHours(timesheet.days).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={timesheet.status} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            to="/vikar/$id"
                            params={{ id: timesheet.id }}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Åbn
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Link>
                          {timesheet.status === "draft" && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteDraft(timesheet);
                              }}
                              className="ml-3 text-sm font-medium text-red-600 hover:underline"
                            >
                              Slet
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <VikarDetailPanel timesheet={selectedTimesheet} onDeleteDraft={deleteDraft} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function VikarDetailPanel({
  timesheet,
  onDeleteDraft,
}: {
  timesheet: Timesheet | null;
  onDeleteDraft: (timesheet: Timesheet) => void;
}) {
  if (!timesheet) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Vælg en timeseddel i tabellen for at se detaljer.
      </aside>
    );
  }

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
            Uge {weekNumber(timesheet.weekStart)} · {formatWeekRange(timesheet.weekStart)}
          </p>
        </div>
        <Link
          to="/vikar/$id"
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
          label="Brugervirksomhed"
          title={timesheet.brugervirksomhed || "—"}
          description={timesheet.kontaktperson || "—"}
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
          title={`${totalHours(timesheet.days).toFixed(2)} timer`}
          description="Detaljeret tidsregistrering"
        />
        <DetailRow
          icon={CheckCircle2}
          label="Status"
          title={STATUS_LABEL[timesheet.status]}
          description={`Senest opdateret ${formatDateLabel(timesheet.updatedAt)}`}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
        <Button asChild size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
          <Link to="/vikar/$id" params={{ id: timesheet.id }}>
            <FileText className="h-4 w-4" />
            Åbn
          </Link>
        </Button>
        {timesheet.status === "draft" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDeleteDraft(timesheet)}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <XCircle className="h-4 w-4" />
            Slet
          </Button>
        )}
      </div>
    </aside>
  );
}

function DetailRow({
  icon: Icon,
  label,
  title,
  description,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 py-4">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
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

function VikarKpiCard({
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
  tone: KpiTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", toneIconClass(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="mt-2 h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none text-slate-950 tabular-nums">
        {value}
      </div>
      <div className={cn("mt-2 text-xs font-medium", toneTextClass(tone))}>{meta}</div>
    </button>
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

function toneIconClass(tone: KpiTone): string {
  if (tone === "blue") return "bg-blue-50 text-blue-600";
  if (tone === "amber") return "bg-amber-50 text-amber-600";
  if (tone === "green") return "bg-emerald-50 text-emerald-600";
  if (tone === "red") return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-500";
}

function toneTextClass(tone: KpiTone): string {
  if (tone === "blue") return "text-blue-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "green") return "text-emerald-600";
  if (tone === "red") return "text-red-600";
  return "text-slate-500";
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

function personKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
