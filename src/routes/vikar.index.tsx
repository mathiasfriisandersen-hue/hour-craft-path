import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
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
  const workerNameKey = personKey(workerIdentity?.name ?? "");
  const workerEmailKey = personKey(workerIdentity?.email ?? "");

  const workerScopedList = useMemo(
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
        : [],
    [all, workerEmailKey, workerNameKey],
  );

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

        {list.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
            {workerScopedList.length === 0
              ? "Ingen timesedler endnu. Brug linket i invitationsmailen fra Sub-Z."
              : "Ingen timesedler matcher filtrene."}
          </div>
        ) : (
          <div>
            <section className="min-w-0 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Timesedler</h2>
                <p className="mt-1 text-sm text-slate-500">Åbn en timeseddel fra rækken.</p>
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
                        className="border-t border-slate-100 transition-colors hover:bg-blue-50/40"
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
          </div>
        )}
      </div>
    </AppShell>
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
