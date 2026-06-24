import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import { formatWeekRange, totalHours, weekNumber } from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overblik" }] }),
  component: AdminList,
});

function AdminList() {
  const list = useTimesheets();
  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin-overblik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle timesedler i systemet. Åbn en timeseddel for at se vejledende tillæg.
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vikar</th>
              <th className="px-4 py-3 font-medium">Brugervirksomhed</th>
              <th className="px-4 py-3 font-medium">Kontaktperson</th>
              <th className="px-4 py-3 font-medium">Uge</th>
              <th className="px-4 py-3 font-medium">Timer</th>
              <th className="px-4 py-3 font-medium">Overenskomst</th>
              <th className="px-4 py-3 font-medium">Lokalaftale</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                Ingen timesedler endnu.
              </td></tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{t.vikar || "—"}</td>
                <td className="px-4 py-3">{t.brugervirksomhed || "—"}</td>
                <td className="px-4 py-3">{t.kontaktperson || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                </td>
                <td className="px-4 py-3 tabular-nums">{totalHours(t.days).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.overenskomst || "—"}</td>
                <td className="px-4 py-3">{t.lokalaftale ? "Ja" : "Nej"}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to="/admin/$id" params={{ id: t.id }} className="text-primary font-medium hover:underline">
                    Detaljer →
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
