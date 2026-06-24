import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import { clearAll, formatWeekRange, totalHours, weekNumber } from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overblik" }] }),
  component: AdminList,
});

function AdminList() {
  const list = useTimesheets();
  const [notice, setNotice] = useState<string | null>(null);

  const handleClear = () => {
    if (window.confirm("Er du sikker på, at du vil rydde alle demooplysninger?")) {
      clearAll();
      setNotice("Demooplysninger er ryddet.");
      window.setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin-overblik</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alle timesedler i systemet. Åbn en timeseddel for at se vejledende tillæg.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Demooplysninger gemmes ikke permanent og kan ryddes af admin.
          </p>
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-1.5 rounded-md text-sm font-medium border border-status-rejected-fg/40 text-status-rejected-fg bg-status-rejected/30 hover:bg-status-rejected/50 transition-colors"
        >
          Ryd demooplysninger
        </button>
      </div>

      {notice && (
        <div className="mb-4 rounded-md border border-status-approved-fg/30 bg-status-approved/40 text-status-approved-fg px-4 py-3 text-sm">
          {notice}
        </div>
      )}


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
