import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import { formatWeekRange, remove, totalHours, weekNumber } from "@/lib/timesheet-store";

export const Route = createFileRoute("/vikar/")({
  head: () => ({ meta: [{ title: "Vikar — Mine timesedler" }] }),
  component: VikarList,
});

function VikarList() {
  const list = useTimesheets();

  return (
    <AppShell allow={["vikar"]}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Mine timesedler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Timesedler oprettes af admin. Åbn din timeseddel fra invitationsmailen.
          </p>
        </div>
      </div>

      {list.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen timesedler endnu. Brug linket i invitationsmailen fra Sub-Z.
        </div>
      )}

      {list.length > 0 && (
        <div className="space-y-3 md:hidden">
          {list.map((t) => (
            <article key={t.id} className="rounded-lg border bg-card p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-semibold">Uge {weekNumber(t.weekStart)}</h2>
                  <p className="text-sm text-muted-foreground">{formatWeekRange(t.weekStart)}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Vikar</dt>
                  <dd>{t.vikar || <em className="text-muted-foreground">—</em>}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Timer</dt>
                  <dd className="tabular-nums">{totalHours(t.days).toFixed(2)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Brugervirksomhed</dt>
                  <dd className="break-words">
                    {t.brugervirksomhed || <em className="text-muted-foreground">—</em>}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
                {t.status === "draft" && (
                  <button
                    onClick={() => {
                      if (window.confirm("Slet denne kladde?")) remove(t.id);
                    }}
                    className="text-sm font-medium text-status-rejected-fg hover:underline"
                  >
                    Slet
                  </button>
                )}
                <Link
                  to="/vikar/$id"
                  params={{ id: t.id }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Åbn →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Uge</th>
              <th className="px-4 py-3 font-medium">Periode</th>
              <th className="px-4 py-3 font-medium">Vikar</th>
              <th className="px-4 py-3 font-medium">Brugervirksomhed</th>
              <th className="px-4 py-3 font-medium">Timer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  Uge {weekNumber(t.weekStart)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatWeekRange(t.weekStart)}
                </td>
                <td className="px-4 py-3">
                  {t.vikar || <em className="text-muted-foreground">—</em>}
                </td>
                <td className="px-4 py-3">
                  {t.brugervirksomhed || <em className="text-muted-foreground">—</em>}
                </td>
                <td className="px-4 py-3 tabular-nums">{totalHours(t.days).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    to="/vikar/$id"
                    params={{ id: t.id }}
                    className="text-primary font-medium hover:underline"
                  >
                    Åbn →
                  </Link>
                  {t.status === "draft" && (
                    <button
                      onClick={() => {
                        if (window.confirm("Slet denne kladde?")) remove(t.id);
                      }}
                      className="ml-3 text-status-rejected-fg font-medium hover:underline"
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
    </AppShell>
  );
}
