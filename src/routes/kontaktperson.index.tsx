import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import { formatWeekRange, totalHours, weekNumber } from "@/lib/timesheet-store";

export const Route = createFileRoute("/kontaktperson/")({
  head: () => ({ meta: [{ title: "Kontaktperson — Timesedler" }] }),
  component: KontaktList,
});

function KontaktList() {
  const all = useTimesheets();
  const list = all.filter((t) => t.status === "sent" || t.status === "approved" || t.status === "rejected" || t.status === "reviewed");

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Timesedler til godkendelse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modtagne timesedler fra vikarer. Godkend eller afvis de indsendte timer.
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vikar</th>
              <th className="px-4 py-3 font-medium">Brugervirksomhed</th>
              <th className="px-4 py-3 font-medium">Uge</th>
              <th className="px-4 py-3 font-medium">Timer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                Ingen timesedler at vise.
              </td></tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{t.vikar}</td>
                <td className="px-4 py-3">{t.brugervirksomhed}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                </td>
                <td className="px-4 py-3 tabular-nums">{totalHours(t.days).toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to="/kontaktperson/$id" params={{ id: t.id }} className="text-primary font-medium hover:underline">
                    Åbn →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
