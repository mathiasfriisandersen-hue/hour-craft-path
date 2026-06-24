import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useTimesheets } from "@/lib/use-timesheets";
import { createBlank, formatWeekRange, totalHours, upsert, weekNumber } from "@/lib/timesheet-store";

export const Route = createFileRoute("/vikar/")({
  head: () => ({ meta: [{ title: "Vikar — Mine timesedler" }] }),
  component: VikarList,
});

function VikarList() {
  const list = useTimesheets();
  const navigate = useNavigate();

  const create = () => {
    const t = upsert(createBlank());
    navigate({ to: "/vikar/$id", params: { id: t.id } });
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Mine timesedler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registrér timer for én uge ad gangen og send til godkendelse.
          </p>
        </div>
        <Button onClick={create}>Ny timeseddel</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
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
                  Ingen timesedler endnu. Opret en for at komme i gang.
                </td>
              </tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">Uge {weekNumber(t.weekStart)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatWeekRange(t.weekStart)}</td>
                <td className="px-4 py-3">{t.brugervirksomhed || <em className="text-muted-foreground">—</em>}</td>
                <td className="px-4 py-3 tabular-nums">{totalHours(t.days).toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/vikar/$id"
                    params={{ id: t.id }}
                    className="text-primary font-medium hover:underline"
                  >
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
