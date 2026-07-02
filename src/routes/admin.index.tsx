import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  timesheetsToCsv,
  totalHours,
  weekNumber,
  type Status,
} from "@/lib/timesheet-store";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overblik" }] }),
  component: AdminList,
});

function AdminList() {
  const all = useTimesheets();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "all" | "archived" | "inactive">("all");
  const [agreement, setAgreement] = useState("all");
  const [week, setWeek] = useState("");
  const [archiveMode, setArchiveMode] = useState(false);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);

  const submitted = useMemo(() => all.filter((item) => item.status !== "draft"), [all]);
  const visibleSubmitted = useMemo(
    () =>
      submitted.filter(
        (item) =>
          status === "archived" ||
          status === "inactive" ||
          (!item.archived && !item.workerConsentInactive),
      ),
    [submitted, status],
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
            ? item.archived
            : status === "inactive"
              ? item.workerConsentInactive
              : item.status === status)) &&
        (agreement === "all" || item.selectedAgreementId === agreement) &&
        (!week || String(weekNumber(item.weekStart)) === week)
      );
    });
  }, [visibleSubmitted, query, status, agreement, week]);

  const exportCsv = () => {
    const blob = new Blob([timesheetsToCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesedler-${new Date().toISOString().slice(0, 10)}.csv`;
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

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Timesedler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrér indsendelser, kontrol og regelgrundlag.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={archiveMode ? "default" : "outline"}
            onClick={archiveMode && selectedArchiveIds.length ? archiveSelected : toggleArchiveMode}
            disabled={!submitted.length}
          >
            {archiveMode && selectedArchiveIds.length
              ? `Arkivér valgte (${selectedArchiveIds.length})`
              : "Arkiver"}
          </Button>
          {archiveMode && (
            <Button type="button" variant="outline" onClick={toggleArchiveMode}>
              Annullér
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={!list.length}>
            Eksportér CSV
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
      </div>

      <section className="mb-5 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Søg vikar eller virksomhed…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "all" | "archived" | "inactive")}
          >
            <option value="all">Alle statusser</option>
            {Object.entries(STATUS_LABEL)
              .filter(([value]) => value !== "draft")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            <option value="archived">Arkiverede</option>
            <option value="inactive">Inaktive timesedler</option>
          </select>
          <select
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
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
          />
        </div>
      </section>

      {list.length === 0 ? (
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
                <article key={item.id} className="rounded-lg border bg-card p-4">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold">{item.vikar || "—"}</h2>
                      <p className="text-sm text-muted-foreground">
                        {item.brugervirksomhed || "—"}
                      </p>
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
                      <dd className="text-xs text-muted-foreground">
                        {calc.rateValidationStatus}
                      </dd>
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
                    {archiveMode ? (
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedArchiveIds.includes(item.id)}
                          disabled={Boolean(item.archived)}
                          onChange={(event) =>
                            toggleArchiveSelection(item.id, event.target.checked)
                          }
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

          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {[
                  archiveMode ? "Arkiver" : "",
                  "Vikar",
                  "Virksomhed",
                  "Uge",
                  "Overenskomst",
                  "Timer",
                  "Status",
                  "",
                ].map((head, i) => (
                  <th key={`${head}-${i}`} className="px-4 py-3 font-medium">
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
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">
                      {archiveMode && (
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
                    <td className="px-4 py-3 font-medium">{item.vikar || "—"}</td>
                    <td className="px-4 py-3">
                      <div>{item.brugervirksomhed || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.kontaktperson || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>Uge {weekNumber(item.weekStart)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatWeekRange(item.weekStart)}
                      </div>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3" title={calc.agreementName}>
                      <div>{calc.agreementName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {calc.rateValidationStatus}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{totalHours(item.days).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                      {item.archived && (
                        <div className="mt-1 text-xs text-muted-foreground">Arkiveret</div>
                      )}
                      {item.workerConsentInactive && (
                        <div className="mt-1 text-xs text-muted-foreground">Inaktiv</div>
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
                        className="font-medium text-primary hover:underline"
                      >
                        Åbn →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
