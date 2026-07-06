import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  calculateTimesheet,
  dayHours,
  delayedMealBreakCalculationText,
  formatWeekRange,
  getById,
  isIndustriensAgreement,
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

  if (!t)
    return (
      <AppShell
        allow={["kontaktperson"]}
        dashboard={{
          title: "Timeseddel",
          subtitle: "Indlæser…",
        }}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Indlæser…
        </div>
      </AppShell>
    );

  const canAct = t.status === "sent";
  const calc = calculateTimesheet(t);
  const showDelayedMealBreak = isIndustriensAgreement(t.selectedAgreementId);

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
    <AppShell
      allow={["kontaktperson"]}
      dashboard={{
        title: `Timeseddel · Uge ${weekNumber(t.weekStart)}`,
        subtitle: `${t.vikar || "—"} · ${t.brugervirksomhed || "—"} · ${formatWeekRange(t.weekStart)}`,
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/kontaktperson"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-700"
        >
          ← Tilbage
        </Link>
        <StatusBadge status={t.status} />
      </div>

      <InfoBanner>
        Når kontaktpersonen godkender timesedlen, registreres godkendelsen som dokumentation for, at
        brugervirksomheden har modtaget og accepteret de indsendte timer.
      </InfoBanner>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-950">Oplysninger</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          <Row label="Vikar" value={t.vikar} />
          <Row label="Brugervirksomhed" value={t.brugervirksomhed} />
          <Row label="Kontaktperson" value={t.kontaktperson} />
          <Row label="Mail" value={t.kontaktpersonEmail} />
          <Row label="Arbejdssted" value={t.arbejdssted} />
          <Row label="Periode" value={formatWeekRange(t.weekStart)} />
          <Row label="Overenskomst" value={calc.agreementName} />
          <Row label="PDF-status" value={calc.rateValidationStatus} />
          <Row label="Lokalaftale" value={t.localAgreementApplies ? "Ja" : "Nej"} />
          {showDelayedMealBreak && (
            <Row
              label="Udsat spisepause"
              value={delayedMealBreakCalculationText(calc.delayedMealBreakDays)}
            />
          )}
        </dl>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="p-6 pb-3 font-semibold text-slate-950">Registrerede timer</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Dag</th>
                <th className="px-4 py-2 font-medium">Start</th>
                <th className="px-4 py-2 font-medium">Slut</th>
                <th className="px-4 py-2 font-medium">Pause</th>
                {showDelayedMealBreak && (
                  <th className="px-4 py-2 font-medium">Udsat spisepause</th>
                )}
                <th className="px-4 py-2 font-medium">Kommentar</th>
                <th className="px-4 py-2 font-medium text-right">Timer</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((n, i) => {
                const d = t.days[i];
                const marker = calc.dayRuleMarkers[i];
                return (
                  <tr key={n} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-950">{n}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{d.start || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{d.end || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {d.pause ? `${d.pause} min` : "—"}
                    </td>
                    {showDelayedMealBreak && (
                      <td className="px-4 py-3 text-slate-700">
                        {marker?.delayedMealBreakStatus ?? "Nej"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500">{d.comment || ""}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-950">
                      {dayHours(d).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td
                  colSpan={showDelayedMealBreak ? 6 : 5}
                  className="px-4 py-3 text-right font-medium text-slate-700"
                >
                  Samlede timer
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">
                  {totalHours(t.days).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {t.status === "rejected" && t.rejectionComment && (
        <div className="mt-6 rounded-xl border border-status-rejected-fg/30 bg-status-rejected/40 px-4 py-3 text-sm text-status-rejected-fg shadow-sm">
          <div className="font-medium">Afvist</div>
          <div className="mt-1">{t.rejectionComment}</div>
        </div>
      )}

      {canAct && (
        <div className="mt-6 flex flex-col gap-4">
          {showReject ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Kommentar ved afvisning
              </label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beskriv kort hvorfor timesedlen afvises…"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReject(false)}>
                  Annullér
                </Button>
                <Button variant="destructive" onClick={reject} disabled={!comment.trim()}>
                  Bekræft afvisning
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReject(true)}>
                Afvis timer
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={approve}>
                Godkend timer
              </Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-3 last:border-0 md:border-0 md:py-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-950">{value || "—"}</dd>
    </div>
  );
}
