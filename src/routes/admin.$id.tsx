import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  dayHours,
  formatWeekRange,
  getById,
  overtimeHours,
  totalHours,
  upsert,
  WEEKDAYS,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/$id")({
  head: () => ({ meta: [{ title: "Admin — Detaljer" }] }),
  component: AdminDetail,
});

function AdminDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Timesheet | null>(null);

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/admin" });
    else setT(found);
  }, [id, navigate]);

  if (!t) return <AppShell allow={["admin"]}><div>Indlæser…</div></AppShell>;

  const total = totalHours(t.days);
  const overtime = overtimeHours(t.days);

  const markReviewed = () => {
    const saved = upsert({ ...t, status: "reviewed" });
    setT(saved);
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin-overblik
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {t.vikar || "Timeseddel"} · Uge {weekNumber(t.weekStart)}
          </h1>
          <StatusBadge status={t.status} />
        </div>
      </div>

      <InfoBanner tone="warning">
        Beregninger er vejledende og skal kontrolleres mod gældende overenskomst, lokalaftaler og
        konkrete aftaler.
      </InfoBanner>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Oplysninger</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Vikar" value={t.vikar} />
            <Row label="Brugervirksomhed" value={t.brugervirksomhed} />
            <Row label="Kontaktperson" value={t.kontaktperson} />
            <Row label="Mail" value={t.kontaktpersonEmail} />
            <Row label="Arbejdssted" value={t.arbejdssted} />
            <Row label="Periode" value={formatWeekRange(t.weekStart)} />
            <Row label="Overenskomst" value={t.overenskomst} />
            <Row label="Lokalaftale" value={t.lokalaftale ? "Ja" : "Nej"} />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Beregning</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Samlede timer" value={`${total.toFixed(2)} timer`} />
            <Row label="Mulige overarbejdstimer" value={`${overtime.toFixed(2)} timer`} />
            <Row label="Tærskel" value="37 timer pr. uge (demo)" />
          </dl>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            {t.lokalaftale && (
              <div className="rounded-md border border-status-sent-fg/30 bg-status-sent/30 text-status-sent-fg px-3 py-2">
                Lokalaftale er markeret. Beregning skal kontrolleres manuelt af admin.
              </div>
            )}
            {!t.overenskomst && (
              <div className="rounded-md border border-status-sent-fg/30 bg-status-sent/30 text-status-sent-fg px-3 py-2">
                Regler mangler eller er ikke udfyldt. Beregning skal kontrolleres manuelt af admin.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card overflow-hidden">
        <h2 className="font-semibold p-6 pb-3">Timer for ugen</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Dag</th>
              <th className="px-4 py-2 font-medium">Start</th>
              <th className="px-4 py-2 font-medium">Slut</th>
              <th className="px-4 py-2 font-medium">Pause</th>
              <th className="px-4 py-2 font-medium">Kommentar</th>
              <th className="px-4 py-2 font-medium text-right">Timer</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((n, i) => {
              const d = t.days[i];
              return (
                <tr key={n} className="border-t">
                  <td className="px-4 py-2 font-medium">{n}</td>
                  <td className="px-4 py-2 tabular-nums">{d.start || "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{d.end || "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{d.pause ? `${d.pause} min` : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.comment || ""}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{dayHours(d).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-3">Vejledende tillæg</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Kun synligt for admin. Systemet beregner ikke konkrete satser; følgende er en vejledende
          opstilling, der skal kontrolleres mod overenskomst og lokalaftale.
        </p>
        <div className="rounded-md border divide-y text-sm">
          <TillaegRow label="Mulige overarbejdstimer" value={`${overtime.toFixed(2)} timer`} note="Timer over 37 pr. uge (demo)" />
          <TillaegRow label="Weekendtimer (lør/søn)" value={`${weekendHours(t).toFixed(2)} timer`} note="Vejledende — kontrollér tillægssats" />
          <TillaegRow label="Aften/nat-tillæg" value="Skal vurderes manuelt" note="Afhænger af overenskomst og vagttype" />
        </div>
      </section>

      {t.rejectionComment && (
        <div className="mt-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 text-status-rejected-fg px-4 py-3 text-sm">
          <div className="font-medium">Kommentar ved afvisning</div>
          <div className="mt-1">{t.rejectionComment}</div>
        </div>
      )}

      {t.status === "approved" && (
        <div className="mt-6 flex justify-end">
          <Button onClick={markReviewed}>Marker som kontrolleret</Button>
        </div>
      )}
    </AppShell>
  );
}

function weekendHours(t: Timesheet): number {
  // index 5 = lør, 6 = søn
  return Math.round((dayHours(t.days[5]) + dayHours(t.days[6])) * 100) / 100;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value || "—"}</dd>
    </div>
  );
}

function TillaegRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
      </div>
      <div className="font-semibold tabular-nums whitespace-nowrap">{value}</div>
    </div>
  );
}
