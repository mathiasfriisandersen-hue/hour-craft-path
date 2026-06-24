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


      {list.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen timesedler endnu.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <Link
              key={t.id}
              to="/admin/$id"
              params={{ id: t.id }}
              className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{t.vikar || "—"}</div>
                  <div className="text-sm text-muted-foreground">{t.brugervirksomhed || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Kontaktperson: {t.kontaktperson || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={t.status} />
                  <div className="text-sm tabular-nums font-medium">
                    {totalHours(t.days).toFixed(2)} timer
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Overenskomst: <span className="text-foreground">{t.overenskomst || "—"}</span></span>
                <span>Lokalaftale: <span className="text-foreground">{t.lokalaftale ? "Ja" : "Nej"}</span></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
