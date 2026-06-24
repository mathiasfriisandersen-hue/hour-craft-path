import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  ABSENCE_LABEL,
  calculateTimesheet,
  dayHours,
  formatWeekRange,
  getById,
  getRule,
  mailtoUrl,
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
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/admin" });
    else setT(found);
  }, [id, navigate]);

  if (!t)
    return (
      <AppShell allow={["admin"]}>
        <div>Indlæser…</div>
      </AppShell>
    );
  const calc = calculateTimesheet(t);
  const rule = getRule(t.overenskomst);

  const changeStatus = (status: Timesheet["status"], rejectionComment?: string) => {
    const saved = upsert({ ...t, status, rejectionComment });
    setT(saved);
    setRejecting(false);
    setComment("");
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin-overblik
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {t.vikar || "Timeseddel"} · uge {weekNumber(t.weekStart)}
          </h1>
          <StatusBadge status={t.status} />
        </div>
      </div>

      <InfoBanner tone="warning">
        Beregninger er vejledende og skal kontrolleres mod gældende overenskomst, lokalaftaler og
        konkrete aftaler.
      </InfoBanner>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 md:p-6">
          <h2 className="mb-4 font-semibold">Oplysninger</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Vikar" value={t.vikar} />
            <Row label="Brugervirksomhed" value={t.brugervirksomhed} />
            <Row label="Kontaktperson" value={t.kontaktperson} />
            <Row label="Mail" value={t.kontaktpersonEmail} />
            <Row label="Reference" value={t.referenceNo} />
            <Row label="Arbejdssted" value={t.arbejdssted} />
            <Row label="Periode" value={formatWeekRange(t.weekStart)} />
            <Row label="Overenskomst" value={t.overenskomst} />
            <Row label="Lokalaftale" value={t.lokalaftale ? "Ja" : "Nej"} />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Vejledende beregning</h2>
            <Link to="/admin/rules" className="text-xs font-medium text-primary hover:underline">
              Redigér regler
            </Link>
          </div>
          <dl className="space-y-1 text-sm">
            <Row label="Samlede timer" value={`${calc.total.toFixed(2)} t`} />
            <Row label="Normaltimer" value={`${calc.normal.toFixed(2)} t`} />
            <Row label="Mulige overarbejdstimer" value={`${calc.overtime.toFixed(2)} t`} />
            <Row
              label="Lørdag / søndag"
              value={`${calc.saturday.toFixed(2)} / ${calc.sunday.toFixed(2)} t`}
            />
            <Row
              label="Aften / nat"
              value={`${calc.evening.toFixed(2)} / ${calc.night.toFixed(2)} t`}
            />
            <Row label="Skiftehold" value={`${calc.shift.toFixed(2)} t`} />
            <Row label="Omfattet af lokalaftale" value={`${calc.localAgreement.toFixed(2)} t`} />
          </dl>
          {calc.missingRules.length > 0 && (
            <div className="mt-4 rounded-md border border-status-sent-fg/30 bg-status-sent/30 px-3 py-2 text-xs text-status-sent-fg">
              <strong>Manuel kontrol kræves:</strong> {calc.missingRules.join(", ")}.
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border bg-card">
        <h2 className="p-5 pb-3 font-semibold md:p-6 md:pb-3">Registreringer</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {[
                  "Dag",
                  "Type",
                  "Start",
                  "Slut",
                  "Pause",
                  "Opgave",
                  "Skiftehold",
                  "Kommentar",
                  "Timer",
                ].map((head) => (
                  <th key={head} className="px-3 py-2 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((name, index) => {
                const day = t.days[index];
                return (
                  <tr key={name} className="border-t">
                    <td className="px-3 py-3 font-medium">{name}</td>
                    <td className="px-3 py-3">{ABSENCE_LABEL[day.absence]}</td>
                    <td className="px-3 py-3 tabular-nums">{day.start || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{day.end || "—"}</td>
                    <td className="px-3 py-3">{day.pause ? `${day.pause} min` : "—"}</td>
                    <td className="px-3 py-3">{day.taskType || "—"}</td>
                    <td className="px-3 py-3">{day.shiftWork ? "Ja" : "Nej"}</td>
                    <td className="max-w-64 px-3 py-3 text-muted-foreground">
                      {day.comment || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {dayHours(day).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 md:p-6">
        <h2 className="mb-3 font-semibold">Regelgrundlag og tillæg</h2>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Rule label="Overarbejde" value={rule?.overtimeRule} />
          <Rule label="Lørdag" value={rule?.saturdayRule} />
          <Rule label="Søndag" value={rule?.sundayRule} />
          <Rule label="Aften" value={rule?.eveningRule} />
          <Rule label="Nat" value={rule?.nightRule} />
          <Rule label="Skiftehold" value={rule?.shiftRule} />
          <Rule label="Særlige tillæg" value={rule?.specialRule} />
        </div>
      </section>

      {t.rejectionComment && (
        <div className="mt-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 px-4 py-3 text-sm text-status-rejected-fg">
          <strong>Kommentar ved afvisning:</strong> {t.rejectionComment}
        </div>
      )}

      {rejecting && (
        <div className="mt-6 rounded-lg border bg-card p-4">
          <label className="mb-1.5 block text-sm font-medium">Begrundelse for afvisning</label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              disabled={!comment.trim()}
              onClick={() => changeStatus("rejected", comment.trim())}
            >
              Bekræft afvisning
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = mailtoUrl(t);
          }}
        >
          Åbn mailkladde
        </Button>
        {t.status !== "draft" && (
          <Button variant="outline" onClick={() => changeStatus("draft")}>
            Genåbn som kladde
          </Button>
        )}
        {!rejecting && t.status !== "rejected" && (
          <Button variant="outline" onClick={() => setRejecting(true)}>
            Afvis
          </Button>
        )}
        {t.status !== "approved" && (
          <Button onClick={() => changeStatus("approved")}>Godkend</Button>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}
function Rule({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">
        {value || <span className="text-status-sent-fg">Ikke udfyldt</span>}
      </div>
    </div>
  );
}
