import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  delayedMealBreakDaysForTimesheet,
  delayedMealBreakSummaryText,
  formatWeekRange,
  getById,
  isIndustriensAgreement,
  mailtoUrl,
  listCompanies,
  upsert,
  validate,
  WEEKDAYS,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";
import { getCollectiveAgreementById } from "@/lib/collectiveAgreements";
import { addDaysToISODate, getDanishAgreementHolidayName } from "@/lib/danishHolidays";
import { sendTimesheetEmail } from "@/lib/timesheet-mail";
import { cn } from "@/lib/utils";

const DEFAULT_PAUSE_1_START = "09:00";
const DEFAULT_PAUSE_1_END = "09:30";
const DEFAULT_PAUSE_2_START = "12:00";
const DEFAULT_PAUSE_2_END = "12:30";

export const Route = createFileRoute("/vikar/$id")({
  head: () => ({ meta: [{ title: "Vikar — Timeseddel" }] }),
  component: VikarEdit,
});

function VikarEdit() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Timesheet | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sendingMail, setSendingMail] = useState(false);
  const companies = listCompanies();

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/vikar" });
    else setT(withDefaultPausePlacement(found));
  }, [id, navigate]);

  if (!t)
    return (
      <AppShell allow={["vikar"]}>
        <div>Indlæser…</div>
      </AppShell>
    );

  const locked = t.status === "sent" || t.status === "approved";
  const update = (patch: Partial<Timesheet>) => setT({ ...t, ...patch });
  const updateDay = (index: number, patch: Partial<Timesheet["days"][number]>) => {
    const days = t.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
    setT({ ...t, days });
  };
  const updateDayPauseRange = (
    index: number,
    patch: Pick<
      Partial<Timesheet["days"][number]>,
      "pauseStart" | "pauseEnd" | "pause2Start" | "pause2End"
    >,
  ) => {
    const day = { ...t.days[index], ...patch };
    updateDay(index, {
      ...patch,
      pause: totalPauseMinutes([day.pauseStart, day.pauseEnd], [day.pause2Start, day.pause2End]),
    });
  };
  const selectedAgreement = getCollectiveAgreementById(t.selectedAgreementId);
  const showDelayedMealBreak =
    !t.localAgreementApplies && isIndustriensAgreement(t.selectedAgreementId);
  const delayedMealBreakDays = delayedMealBreakDaysForTimesheet(t);

  const selectCompany = (name: string) => {
    const company = companies.find((item) => item.name === name);
    update({
      brugervirksomhed: name,
      ...(company
        ? {
            kontaktperson: company.contactName,
            kontaktpersonEmail: company.contactEmail,
            arbejdssted: company.address,
          }
        : {}),
    });
  };

  const handleSave = () => {
    setT(upsert(t));
    setMessage("Kladde gemt midlertidigt i denne browsersession.");
  };

  const handleSend = async () => {
    const validationErrors = validate(t);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    const saved = upsert({ ...t, status: "sent", rejectionComment: undefined });
    setT(saved);

    setSendingMail(true);
    setMessage("Sender timesedlen via mailsystemet…");
    try {
      const result = await sendTimesheetEmail(saved);
      setMessage(
        result === "api"
          ? "Timesedlen er sendt via mailsystemet."
          : "Timesedlen er markeret som sendt. Mailsystemet er ikke konfigureret endnu, så din mailapp åbnes som fallback.",
      );
    } catch {
      setMessage(
        "Mailsystemet kunne ikke sende lige nu. Timesedlen er markeret som sendt, og mailkladde åbnes som fallback.",
      );
      window.location.href = mailtoUrl(saved);
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <AppShell allow={["vikar"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/vikar" className="text-sm text-muted-foreground hover:text-foreground">
            ← Mine timesedler
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
          </h1>
        </div>
        <StatusBadge status={t.status} />
      </div>

      {locked && <Notice>Denne timeseddel er låst. Admin kan genåbne den.</Notice>}
      {t.status === "rejected" && t.rejectionComment && (
        <div className="mb-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 px-4 py-3 text-sm text-status-rejected-fg">
          <strong>Afvist:</strong> {t.rejectionComment}
        </div>
      )}
      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="font-medium">Ret følgende før afsendelse:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6 rounded-lg border bg-card p-5 md:p-6">
        <h2 className="mb-4 font-semibold">Opgave og virksomhed</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vikarnavn *">
            <Input
              value={t.vikar}
              disabled={locked}
              onChange={(e) => update({ vikar: e.target.value })}
            />
          </Field>
          <Field label="Vikarens e-mail *">
            <Input
              type="email"
              value={t.vikarEmail}
              disabled={locked}
              onChange={(e) => update({ vikarEmail: e.target.value })}
            />
          </Field>
          <Field label="Brugervirksomhed *">
            <Input
              list="company-list"
              value={t.brugervirksomhed}
              disabled={locked}
              onChange={(e) => selectCompany(e.target.value)}
            />
            <datalist id="company-list">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Kontaktperson *">
            <Input
              value={t.kontaktperson}
              disabled={locked}
              onChange={(e) => update({ kontaktperson: e.target.value })}
            />
          </Field>
          <Field label="Kontaktpersonens mail *">
            <Input
              type="email"
              value={t.kontaktpersonEmail}
              disabled={locked}
              onChange={(e) => update({ kontaktpersonEmail: e.target.value })}
            />
          </Field>
          <Field label="Reference / rekvisitionsnummer">
            <Input
              value={t.referenceNo}
              disabled={locked}
              onChange={(e) => update({ referenceNo: e.target.value })}
            />
          </Field>
          <Field label="Arbejdssted / adresse *">
            <Input
              value={t.arbejdssted}
              disabled={locked}
              onChange={(e) => update({ arbejdssted: e.target.value })}
            />
          </Field>
          <Field label="Ugestart (mandag)">
            <Input
              type="date"
              value={t.weekStart}
              disabled={locked}
              onChange={(e) => update({ weekStart: e.target.value })}
            />
          </Field>
          <Field label="Gælder der en lokalaftale?" className="md:col-span-2">
            <div className="flex gap-2">
              {[
                { value: false, label: "Nej" },
                { value: true, label: "Ja" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    update({
                      localAgreementApplies: option.value,
                      lokalaftale: option.value,
                      localAgreementId: undefined,
                    })
                  }
                  className={cn(
                    "h-9 rounded-md border px-4 text-sm font-medium",
                    t.localAgreementApplies === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                    locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Noter" className="md:col-span-2">
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={t.notes}
              disabled={locked}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-lg border bg-card">
        <div className="p-5 pb-3 md:p-6 md:pb-3">
          <h2 className="font-semibold">Registrering for ugen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Udfyld start, slut og pause for de dage, du har arbejdet. Lørdag, søndag og helligdage
            markeres automatisk ud fra datoen.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Arbejdstiderne er forudfyldt på baggrund af de oplysninger, vi har modtaget fra den
            virksomhed, du arbejder hos. Hvis du har arbejdet mere eller mindre end angivet, skal du
            rette registreringen i skemaet nedenfor, før du sender timesedlen. Ved indsendelse
            bekræfter du, at oplysningerne er korrekte efter din bedste viden. Bevidst afgivelse af
            urigtige oplysninger kan efter omstændighederne få ansættelsesmæssige konsekvenser.
          </p>
          <RegistrationRuleNotice
            agreementName={selectedAgreement?.name ?? t.overenskomst ?? ""}
            localAgreementApplies={t.localAgreementApplies}
            showDelayedMealBreak={showDelayedMealBreak}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {[
                  "Dag",
                  "Start",
                  "Slut",
                  "Pause 1",
                  "Pause 2",
                  ...(showDelayedMealBreak ? ["Udskudt spisepause"] : []),
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
                const absent = day.absence !== "none";
                const date = addDaysToISODate(t.weekStart, index);
                return (
                  <tr key={name} className="border-t align-top">
                    <td className="px-3 py-3 font-medium">
                      <div>
                        {name} {formatShortDate(date)}
                      </div>
                      <HolidayBadges isoDate={date} />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        className="h-8 w-28"
                        step={300}
                        value={day.start}
                        disabled={locked || absent}
                        onFocus={() => {
                          if (!day.start) updateDay(index, { start: "07:00" });
                        }}
                        onChange={(e) => updateDay(index, { start: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        className="h-8 w-28"
                        step={300}
                        value={day.end}
                        disabled={locked || absent}
                        onFocus={() => {
                          if (!day.end) updateDay(index, { end: "15:30" });
                        }}
                        onChange={(e) => updateDay(index, { end: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TimeRangeInputs
                        start={day.pauseStart}
                        end={day.pauseEnd}
                        disabled={locked || absent}
                        defaultStart={DEFAULT_PAUSE_1_START}
                        defaultEnd={DEFAULT_PAUSE_1_END}
                        onStartChange={(value) => updateDayPauseRange(index, { pauseStart: value })}
                        onEndChange={(value) => updateDayPauseRange(index, { pauseEnd: value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TimeRangeInputs
                        start={day.pause2Start}
                        end={day.pause2End}
                        disabled={locked || absent}
                        defaultStart={DEFAULT_PAUSE_2_START}
                        defaultEnd={DEFAULT_PAUSE_2_END}
                        onStartChange={(value) =>
                          updateDayPauseRange(index, { pause2Start: value })
                        }
                        onEndChange={(value) => updateDayPauseRange(index, { pause2End: value })}
                      />
                    </td>
                    {showDelayedMealBreak && (
                      <td className="px-3 py-2">
                        <label
                          className={cn(
                            "inline-flex min-h-8 max-w-xs items-center gap-2 rounded-md border border-input px-2 text-xs leading-tight",
                            locked || absent
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer hover:bg-accent",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={
                              day.wasInstructedToWorkDuringMealBreak &&
                              day.mealBreakPostponedMoreThan30Min
                            }
                            disabled={locked || absent}
                            onChange={(e) =>
                              updateDay(index, {
                                wasInstructedToWorkDuringMealBreak: e.target.checked,
                                mealBreakPostponedMoreThan30Min: e.target.checked,
                                delayedMealBreakCompensation: e.target.checked,
                              })
                            }
                          />
                          <span>
                            Jeg blev bedt om at arbejde i min spisepause, og pausen blev udskudt
                            mere end 30 min.
                          </span>
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {showDelayedMealBreak && (
          <div className="border-t bg-muted/20 px-5 py-3 text-sm md:px-6">
            {delayedMealBreakSummaryText(delayedMealBreakDays)}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl text-sm text-muted-foreground">{message}</div>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave}>
              Gem kladde
            </Button>
            <Button onClick={handleSend} disabled={sendingMail}>
              {sendingMail ? "Sender…" : "Send timeseddel"}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RegistrationRuleNotice({
  agreementName,
  localAgreementApplies,
  showDelayedMealBreak,
}: {
  agreementName: string;
  localAgreementApplies: boolean;
  showDelayedMealBreak: boolean;
}) {
  if (localAgreementApplies) {
    return (
      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Lokalaftale:</span> Tillæg og
        arbejdstidsforhold beregnes på baggrund af den lokalaftale, der er gældende hos
        brugervirksomheden. Kun tillæg, der fremgår af den gældende lokalaftale og er relevante for
        registreringen, indgår i beregningen.
      </div>
    );
  }

  if (showDelayedMealBreak) {
    return (
      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Udsat spisepause:</span> Markér kun hvis du
        blev bedt om at arbejde i din spisepause, og pausen blev udsat mere end 30 minutter.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Overenskomst:</span> Tillæg og
      arbejdstidsforhold beregnes på baggrund af den overenskomst, der er gældende hos
      brugervirksomheden{agreementName ? `: ${agreementName}` : ""}. Kun tillæg, der fremgår af den
      gældende overenskomst og er relevante for registreringen, indgår i beregningen.
    </div>
  );
}

function withDefaultPausePlacement(timesheet: Timesheet): Timesheet {
  return {
    ...timesheet,
    days: timesheet.days.map((day) => {
      const hasWork = day.absence === "none" && Boolean(day.start && day.end);
      const hasPausePlacement = Boolean(
        day.pauseStart || day.pauseEnd || day.pause2Start || day.pause2End,
      );
      if (!hasWork || hasPausePlacement || day.pause <= 0) return day;
      return {
        ...day,
        pauseStart: DEFAULT_PAUSE_1_START,
        pauseEnd: DEFAULT_PAUSE_1_END,
        pause2Start: day.pause >= 60 ? DEFAULT_PAUSE_2_START : "",
        pause2End: day.pause >= 60 ? DEFAULT_PAUSE_2_END : "",
        pause: day.pause >= 60 ? 60 : 30,
      };
    }),
  };
}

function minutes(time: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function intervalMinutes(start: string, end: string): number {
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return 0;
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 24 * 60 - startMinutes;
}

function totalPauseMinutes(...ranges: Array<[string, string]>): number {
  return ranges.reduce((sum, [start, end]) => sum + intervalMinutes(start, end), 0);
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return "";
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

function HolidayBadges({ isoDate }: { isoDate: string }) {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : undefined;
  const day = date?.getDay();
  const holidayName = getDanishAgreementHolidayName(isoDate);
  const badges = [
    day === 6 ? "Lørdag" : "",
    day === 0 ? "Søndag" : "",
    holidayName && holidayName !== "Søndag" ? "Helligdag" : "",
  ].filter(Boolean);
  if (!badges.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          title={holidayName && holidayName !== "Søndag" ? holidayName : undefined}
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 rounded-md border bg-muted/40 px-4 py-3 text-sm">{children}</div>;
}

function TimeRangeInputs({
  start,
  end,
  disabled,
  defaultStart,
  defaultEnd,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  disabled: boolean;
  defaultStart: string;
  defaultEnd: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="time"
        className="h-8 w-24"
        step={300}
        value={start}
        disabled={disabled}
        onFocus={() => {
          if (!start) onStartChange(defaultStart);
        }}
        onChange={(e) => onStartChange(e.target.value)}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="time"
        className="h-8 w-24"
        step={300}
        value={end}
        disabled={disabled}
        onFocus={() => {
          if (!end) onEndChange(defaultEnd);
        }}
        onChange={(e) => onEndChange(e.target.value)}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
