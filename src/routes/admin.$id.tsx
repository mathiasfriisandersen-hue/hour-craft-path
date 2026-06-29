import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ABSENCE_LABEL,
  calculateTimesheet,
  DAY_TYPE_LABEL,
  dayHours,
  delayedMealBreakCalculationText,
  formatWeekRange,
  getById,
  getRule,
  isIndustriensAgreement,
  mailtoUrl,
  upsert,
  WEEKDAYS,
  weekNumber,
  type Timesheet,
  WORK_TYPE_LABEL,
} from "@/lib/timesheet-store";
import { publicAgreementPdfHref } from "@/lib/collectiveAgreements";
import {
  agreementRuleSourceHref,
  formatAgreementRulePages,
  type AgreementRuleSource,
  type AgreementRuleSourceKey,
} from "@/lib/agreementRules";
import { sendTimesheetEmail } from "@/lib/timesheet-mail";

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
  const [mailMessage, setMailMessage] = useState("");
  const [sendingMail, setSendingMail] = useState(false);

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
  const rule = getRule(t.selectedAgreementId);
  const showDelayedMealBreak = isIndustriensAgreement(t.selectedAgreementId);

  const changeStatus = (status: Timesheet["status"], rejectionComment?: string) => {
    const saved = upsert({ ...t, status, rejectionComment });
    setT(saved);
    setRejecting(false);
    setComment("");
  };

  const updateDay = (index: number, patch: Partial<Timesheet["days"][number]>) => {
    const days = t.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day));
    const saved = upsert({ ...t, days });
    setT(saved);
  };

  const updateShiftWork = (index: number, checked: boolean) => {
    const day = t.days[index];
    updateDay(index, {
      shiftWork: checked,
      workType: checked ? "shift_work" : day.workType === "shift_work" ? "normal" : day.workType,
    });
  };

  const handleMail = async () => {
    setSendingMail(true);
    setMailMessage("Sender mail via mailsystemet…");
    try {
      const result = await sendTimesheetEmail(t);
      setMailMessage(
        result === "api"
          ? "Mail sendt via mailsystemet."
          : "Mailsystemet er ikke konfigureret endnu. Mailkladde åbnes som fallback.",
      );
    } catch {
      setMailMessage("Mailsystemet kunne ikke sende lige nu. Mailkladde åbnes som fallback.");
      window.location.href = mailtoUrl(t);
    } finally {
      setSendingMail(false);
    }
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
        Systemet beregner kun samlet timetal, indtil overenskomstens PDF-kilde og satser er manuelt
        valideret i regelgrundlaget.
      </InfoBanner>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 md:p-6">
          <h2 className="mb-4 font-semibold">Oplysninger</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Vikar" value={t.vikar} />
            <Row label="Vikarens e-mail" value={t.vikarEmail} />
            <Row label="Brugervirksomhed" value={t.brugervirksomhed} />
            <Row label="Kontaktperson" value={t.kontaktperson} />
            <Row label="Kontaktperson telefon" value={t.kontaktpersonPhone} />
            <Row label="Mail" value={t.kontaktpersonEmail} />
            <Row label="Reference" value={t.referenceNo} />
            <Row label="Arbejdssted" value={t.arbejdssted} />
            <Row label="Timeløn" value={t.hourlyWage ? `${t.hourlyWage.toFixed(2)} DKK` : "—"} />
            <Row label="Periode" value={formatWeekRange(t.weekStart)} />
            <Row label="Overenskomst" value={calc.agreementName} />
            <Row label="Kategori" value={calc.agreementCategory} />
            <Row label="Brancheområde" value={calc.industryArea} />
            <Row label="Lokalaftale" value={t.localAgreementApplies ? "Ja" : "Nej"} />
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
            <Row label="PDF-kilde" value={calc.pdfFileName || "PDF mangler"} />
            <Row label="Valideringsstatus" value={calc.rateValidationStatus} />
            <Row
              label="Automatisk satsberegning"
              value={calc.canCalculateRatesAutomatically ? "Tilladt" : "Ikke tilladt"}
            />
          </dl>
          {calc.pdfUrl && (
            <a
              href={publicAgreementPdfHref(calc.pdfUrl)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Åbn PDF-kilde →
            </a>
          )}
          <div className="mt-4 rounded-md border border-status-sent-fg/30 bg-status-sent/30 px-3 py-2 text-xs text-status-sent-fg">
            {calc.validationNote}
          </div>
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 text-sm font-medium">Mulige tillægstimer</h3>
            <dl className="space-y-1 text-sm">
              <Row label="Mulige overarbejdstimer" value={`${calc.overtime.toFixed(2)} t`} />
              <Row
                label="Lørdag / søndag"
                value={`${calc.saturday.toFixed(2)} / ${calc.sunday.toFixed(2)} t`}
              />
              <Row label="Helligdage" value={`${calc.publicHoliday.toFixed(2)} t`} />
              <Row label="Weekendarbejde lokalaftale" value={`${calc.weekend.toFixed(2)} t`} />
              <Row
                label="Aften / nat"
                value={`${calc.evening.toFixed(2)} / ${calc.night.toFixed(2)} t`}
              />
              <Row label="Skiftehold" value={`${calc.shift.toFixed(2)} t`} />
            </dl>
          </div>
          {showDelayedMealBreak && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-medium">Manuelle tillæg</h3>
              <dl className="space-y-1 text-sm">
                <Row
                  label="Udsat spisepause"
                  value={delayedMealBreakCalculationText(calc.delayedMealBreakDays)}
                />
              </dl>
            </div>
          )}
          {calc.canCalculateRatesAutomatically && calc.missingRules.length > 0 && (
            <div className="mt-4 rounded-md border border-status-sent-fg/30 bg-status-sent/30 px-3 py-2 text-xs text-status-sent-fg">
              <strong>Manuel kontrol kræves:</strong> {calc.missingRules.join(", ")}.
            </div>
          )}
          {calc.manualValidationMessages.length > 0 && (
            <div className="mt-4 rounded-md border border-status-sent-fg/30 bg-status-sent/30 px-3 py-2 text-xs text-status-sent-fg">
              <strong>Regelmarkeringer:</strong> {calc.manualValidationMessages.join(" ")}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border bg-card">
        <h2 className="p-5 pb-3 font-semibold md:p-6 md:pb-3">Registreringer</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1520px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {[
                  "Dag",
                  "Type",
                  "Start",
                  "Slut",
                  "Pause",
                  "Pause 1",
                  "Pause 2",
                  "Dagarbejde",
                  "Aftenarbejde",
                  "Natarbejde",
                  "Skiftehold",
                  ...(showDelayedMealBreak ? ["Udsat spisepause"] : []),
                  "Opgave",
                  "Dagstype",
                  "Arbejdstype",
                  "Validering",
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
                const marker = calc.dayRuleMarkers[index];
                return (
                  <tr key={name} className="border-t">
                    <td className="px-3 py-3 font-medium">{name}</td>
                    <td className="px-3 py-3">{ABSENCE_LABEL[day.absence]}</td>
                    <td className="px-3 py-3 tabular-nums">{day.start || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{day.end || "—"}</td>
                    <td className="px-3 py-3">{day.pause ? `${day.pause} min` : "—"}</td>
                    <td className="px-3 py-3">
                      <AdminTimeRange
                        dayName={name}
                        label="pause 1"
                        start={day.pauseStart}
                        end={day.pauseEnd}
                        onStartChange={(value) => updateDay(index, { pauseStart: value })}
                        onEndChange={(value) => updateDay(index, { pauseEnd: value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <AdminTimeRange
                        dayName={name}
                        label="pause 2"
                        start={day.pause2Start}
                        end={day.pause2End}
                        onStartChange={(value) => updateDay(index, { pause2Start: value })}
                        onEndChange={(value) => updateDay(index, { pause2End: value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <AdminTimeRange
                        dayName={name}
                        label="dagarbejde"
                        start={day.dayWorkStart}
                        end={day.dayWorkEnd}
                        onStartChange={(value) => updateDay(index, { dayWorkStart: value })}
                        onEndChange={(value) => updateDay(index, { dayWorkEnd: value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <AdminTimeRange
                        dayName={name}
                        label="aftenarbejde"
                        start={day.eveningWorkStart}
                        end={day.eveningWorkEnd}
                        onStartChange={(value) => updateDay(index, { eveningWorkStart: value })}
                        onEndChange={(value) => updateDay(index, { eveningWorkEnd: value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <AdminTimeRange
                        dayName={name}
                        label="natarbejde"
                        start={day.nightWorkStart}
                        end={day.nightWorkEnd}
                        onStartChange={(value) => updateDay(index, { nightWorkStart: value })}
                        onEndChange={(value) => updateDay(index, { nightWorkEnd: value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={day.shiftWork || day.workType === "shift_work"}
                          onChange={(e) => updateShiftWork(index, e.target.checked)}
                          className="h-4 w-4 rounded border-input"
                        />
                        Skiftehold
                      </label>
                    </td>
                    {showDelayedMealBreak && (
                      <td className="px-3 py-3">{marker?.delayedMealBreakStatus ?? "—"}</td>
                    )}
                    <td className="px-3 py-3">{day.taskType || "—"}</td>
                    <td className="px-3 py-3">{marker ? DAY_TYPE_LABEL[marker.dayType] : "—"}</td>
                    <td className="px-3 py-3">{marker ? WORK_TYPE_LABEL[marker.workType] : "—"}</td>
                    <td className="max-w-72 px-3 py-3 text-xs text-muted-foreground">
                      {marker ? (
                        <div className="space-y-1">
                          <div>{marker.crossesMidnight ? "Vagt over midnat" : "Samme dag"}</div>
                          <div>{marker.shiftStatus}</div>
                          <div>{marker.weekendAgreementStatus}</div>
                          {marker.warnings.map((warning) => (
                            <div key={warning} className="text-status-sent-fg">
                              {warning}
                            </div>
                          ))}
                          {marker.requiresManualValidation.map((item) => (
                            <div key={item} className="text-status-sent-fg">
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
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
        {!calc.canCalculateRatesAutomatically && (
          <p className="mb-4 text-sm text-muted-foreground">
            Tillæg og satser vises ikke som beregning, før overenskomsten er markeret som valideret.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Rule
            label="Overarbejde"
            value={rule?.overtimeRule}
            sources={sourcesFor(rule?.sources, "overtimeRule")}
          />
          <Rule
            label="Lørdag"
            value={rule?.saturdayRule}
            sources={sourcesFor(rule?.sources, "saturdayRule")}
          />
          <Rule
            label="Søndag"
            value={rule?.sundayRule}
            sources={sourcesFor(rule?.sources, "sundayRule")}
          />
          <Rule
            label="Aften"
            value={rule?.eveningRule}
            sources={sourcesFor(rule?.sources, "eveningRule")}
          />
          <Rule
            label="Nat"
            value={rule?.nightRule}
            sources={sourcesFor(rule?.sources, "nightRule")}
          />
          <Rule
            label="Skiftehold"
            value={rule?.shiftRule}
            sources={sourcesFor(rule?.sources, "shiftRule")}
          />
          <Rule
            label="Særlige tillæg"
            value={rule?.specialRule}
            sources={sourcesFor(rule?.sources, "specialRule")}
          />
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{mailMessage}</div>
        <Button variant="outline" onClick={handleMail} disabled={sendingMail}>
          {sendingMail ? "Sender…" : "Send mail"}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
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

function AdminTimeRange({
  dayName,
  label,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  dayName: string;
  label: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        step="300"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        aria-label={`${dayName} ${label} start`}
        className="h-9 w-28"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="time"
        step="300"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        aria-label={`${dayName} ${label} slut`}
        className="h-9 w-28"
      />
    </div>
  );
}

function sourcesFor(sources: AgreementRuleSource[] | undefined, field: AgreementRuleSourceKey) {
  return sources?.filter((source) => source.field === field) ?? [];
}

function Rule({
  label,
  value,
  sources,
}: {
  label: string;
  value?: string;
  sources?: AgreementRuleSource[];
}) {
  const sourcePages = sources?.map((source) => source.page) ?? [];
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">
        {value || <span className="text-status-sent-fg">Ikke udfyldt</span>}
      </div>
      {sources && sources.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-muted-foreground">
            Kildesider: {formatAgreementRulePages(sourcePages)}
          </div>
          {sources.map((source) => (
            <a
              key={`${source.pdfUrl}-${source.page}`}
              href={agreementRuleSourceHref(source)}
              target="_blank"
              rel="noreferrer"
              className="block text-xs font-medium text-primary hover:underline"
            >
              {source.pdfFileName || source.pdfUrl}, side {source.page} →
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
