import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  dayHours,
  formatWeekRange,
  getById,
  totalHours,
  upsert,
  WEEKDAYS,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/kontaktperson/$id")({
  head: () => ({ meta: [{ title: "Kontaktperson — Timeseddel" }] }),
  component: KontaktDetail,
});

function KontaktDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Timesheet | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/kontaktperson" });
    else setT(found);
  }, [id, navigate]);

  if (!t) return <AppShell><div>Indlæser…</div></AppShell>;

  const canAct = t.status === "sent";

  const approve = () => {
    upsert({ ...t, status: "approved", rejectionComment: undefined });
    navigate({ to: "/kontaktperson" });
  };
  const reject = () => {
    if (!comment.trim()) return;
    upsert({ ...t, status: "rejected", rejectionComment: comment.trim() });
    navigate({ to: "/kontaktperson" });
  };

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/kontaktperson" className="text-sm text-muted-foreground hover:text-foreground">
          ← Tilbage
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Timeseddel · Uge {weekNumber(t.weekStart)}
          </h1>
          <StatusBadge status={t.status} />
        </div>
      </div>

      <InfoBanner>
        Når kontaktpersonen godkender timesedlen, registreres godkendelsen som dokumentation for,
        at brugervirksomheden har modtaget og accepteret de indsendte timer.
      </InfoBanner>

      <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Oplysninger</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Vikar" value={t.vikar} />
          <Row label="Brugervirksomhed" value={t.brugervirksomhed} />
          <Row label="Kontaktperson" value={t.kontaktperson} />
          <Row label="Mail" value={t.kontaktpersonEmail} />
          <Row label="Arbejdssted" value={t.arbejdssted} />
          <Row label="Periode" value={formatWeekRange(t.weekStart)} />
        </dl>
      </section>

      <section className="mt-6 rounded-lg border bg-card overflow-hidden">
        <h2 className="font-semibold p-6 pb-3">Registrerede timer</h2>
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
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td colSpan={5} className="px-4 py-3 text-right font-medium">Samlede timer</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{totalHours(t.days).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {t.status === "rejected" && t.rejectionComment && (
        <div className="mt-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 text-status-rejected-fg px-4 py-3 text-sm">
          <div className="font-medium">Afvist</div>
          <div className="mt-1">{t.rejectionComment}</div>
        </div>
      )}

      {canAct && (
        <div className="mt-6 flex flex-col gap-4">
          {showReject ? (
            <div className="rounded-lg border bg-card p-4">
              <label className="block text-sm font-medium mb-1.5">Kommentar ved afvisning</label>
              <textarea
                className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beskriv kort hvorfor timesedlen afvises…"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReject(false)}>Annullér</Button>
                <Button variant="destructive" onClick={reject} disabled={!comment.trim()}>
                  Bekræft afvisning
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReject(true)}>Afvis timer</Button>
              <Button onClick={approve}>Godkend timer</Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0 md:border-0 md:py-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value || "—"}</dd>
    </div>
  );
}
