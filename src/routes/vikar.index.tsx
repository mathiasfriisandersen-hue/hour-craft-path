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

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Uge</th>
              <th className="px-4 py-3 font-medium">Periode</th>
              <th className="px-4 py-3 font-medium">Brugervirksomhed</th>
              <th className="px-4 py-3 font-medium">Timer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Ingen timesedler endnu. Brug linket i invitationsmailen fra Sub-Z.
                </td>
              </tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  Uge {weekNumber(t.weekStart)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatWeekRange(t.weekStart)}
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
