import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
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
  listCompanies,
  upsert,
  validate,
  WEEKDAYS,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";
import { getCollectiveAgreementById } from "@/lib/collectiveAgreements";
import { addDaysToISODate, getDanishAgreementHolidayName } from "@/lib/danishHolidays";
import { getMailSessionAvailability } from "@/lib/api-session";
import { safeTimesheetMailErrorMessage, sendTimesheetEmail } from "@/lib/timesheet-mail";
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
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
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
  const mailAvailability = getMailSessionAvailability();

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
    if (validationErrors.length) {
      setShowAssignmentDetails(true);
      return;
    }
    const saved = upsert({ ...t, status: "sent", rejectionComment: undefined });
    setT(saved);

    if (!mailAvailability.available) {
      setMessage(`Timesedlen er markeret som sendt. ${mailAvailability.reason}`);
      return;
    }
    setSendingMail(true);
    setMessage("Sender timesedlen via mailsystemet…");
    try {
      await sendTimesheetEmail(saved);
      setMessage("Timesedlen er sendt via det servervaliderede mailsystem.");
    } catch (error) {
      setMessage(`Timesedlen er markeret som sendt. ${safeTimesheetMailErrorMessage(error)}`);
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <AppShell allow={["vikar"]}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div>
          <Link to="/vikar" className="text-sm text-muted-foreground hover:text-foreground">
            ← Mine timesedler
          </Link>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
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

      <section className="mb-4 rounded-lg border bg-card p-3 sm:mb-6 sm:p-5 md:p-6">
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <h2 className="font-semibold">Opgave og virksomhed</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground md:hidden">
              {t.vikar || "Vikar"} · {t.brugervirksomhed || "Virksomhed"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 md:hidden"
            onClick={() => setShowAssignmentDetails((value) => !value)}
          >
            {showAssignmentDetails ? "Skjul" : "Ret"}
          </Button>
        </div>
        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2",
            !showAssignmentDetails && "hidden md:grid",
          )}
        >
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
            <div className="grid grid-cols-2 gap-2 sm:flex">
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

      <section className="mb-4 overflow-hidden rounded-lg border bg-card sm:mb-6">
        <div className="p-3 pb-3 sm:p-5 md:p-6 md:pb-3">
          <h2 className="font-semibold">Registrering for ugen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Udfyld start, slut og pause for de dage, du har arbejdet. Lørdag, søndag og helligdage
            markeres automatisk ud fra datoen.
          </p>
          <p className="mt-2 hidden text-sm text-muted-foreground md:block">
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
        <div className="space-y-3 border-t p-3 md:hidden">
          {WEEKDAYS.map((name, index) => {
            const day = t.days[index];
            const absent = day.absence !== "none";
            const date = addDaysToISODate(t.weekStart, index);
            return (
              <article key={name} className="rounded-lg border bg-background p-3 shadow-sm">
                <div className="mb-3">
                  <h3 className="font-medium">
                    {name} {formatShortDate(date)}
                  </h3>
                  <HolidayBadges isoDate={date} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start">
                    <TimeInput
                      value={day.start}
                      disabled={locked || absent}
                      defaultValue="07:00"
                      onChange={(value) => updateDay(index, { start: value })}
                    />
                  </Field>
                  <Field label="Slut">
                    <TimeInput
                      value={day.end}
                      disabled={locked || absent}
                      defaultValue="15:30"
                      onChange={(value) => updateDay(index, { end: value })}
                    />
                  </Field>
                  <Field label="Pause 1" className="col-span-2">
                    <TimeRangeInputs
                      start={day.pauseStart}
                      end={day.pauseEnd}
                      disabled={locked || absent}
                      defaultStart={DEFAULT_PAUSE_1_START}
                      defaultEnd={DEFAULT_PAUSE_1_END}
                      onStartChange={(value) => updateDayPauseRange(index, { pauseStart: value })}
                      onEndChange={(value) => updateDayPauseRange(index, { pauseEnd: value })}
                    />
                  </Field>
                  <Field label="Pause 2" className="col-span-2">
                    <TimeRangeInputs
                      start={day.pause2Start}
                      end={day.pause2End}
                      disabled={locked || absent}
                      defaultStart={DEFAULT_PAUSE_2_START}
                      defaultEnd={DEFAULT_PAUSE_2_END}
                      onStartChange={(value) => updateDayPauseRange(index, { pause2Start: value })}
                      onEndChange={(value) => updateDayPauseRange(index, { pause2End: value })}
                    />
                  </Field>
                  <label
                    className={cn(
                      "col-span-2 inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm",
                      locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={day.absence === "sick"}
                      disabled={locked}
                      onChange={(e) =>
                        updateDay(index, { absence: e.target.checked ? "sick" : "none" })
                      }
                    />
                    <span>Syg</span>
                  </label>
                  {showDelayedMealBreak && (
                    <label
                      className={cn(
                        "col-span-2 inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-xs leading-tight",
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
                        Jeg blev bedt om at arbejde i min spisepause, og pausen blev udskudt mere
                        end 30 min.
                      </span>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                  "Syg",
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
                      <TimeInput
                        value={day.start}
                        disabled={locked || absent}
                        defaultValue="07:00"
                        onChange={(value) => updateDay(index, { start: value })}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TimeInput
                        value={day.end}
                        disabled={locked || absent}
                        defaultValue="15:30"
                        onChange={(value) => updateDay(index, { end: value })}
                        compact
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
                    <td className="px-3 py-2">
                      <label
                        className={cn(
                          "inline-flex min-h-8 items-center gap-2 rounded-md border border-input px-2 text-sm",
                          locked
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:bg-accent",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={day.absence === "sick"}
                          disabled={locked}
                          onChange={(e) =>
                            updateDay(index, { absence: e.target.checked ? "sick" : "none" })
                          }
                        />
                        <span>Syg</span>
                      </label>
                    </td>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="max-w-2xl text-sm text-muted-foreground">
          {message ||
            (!mailAvailability.available
              ? `Timesedlen kan afleveres i systemet, men mailnotifikation er blokeret. ${mailAvailability.reason}`
              : "")}
        </div>
        {!locked && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleSave}>
              Gem kladde
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSend} disabled={sendingMail}>
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

function TimeInput({
  value,
  disabled,
  defaultValue,
  onChange,
  compact = false,
}: {
  value: string;
  disabled: boolean;
  defaultValue: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const canClear = Boolean(value) && !disabled;

  return (
    <div className={cn("flex min-w-0 items-center gap-1", compact && "md:w-32")}>
      <Input
        type="time"
        className={cn("min-w-0 flex-1", compact ? "h-8" : "h-10 md:h-8")}
        step={300}
        value={value}
        disabled={disabled}
        title="Tryk Delete eller brug nulstil-knappen for at sætte feltet til --.--"
        onFocus={() => {
          if (!value) onChange(defaultValue);
        }}
        onKeyDown={(event) => {
          if ((event.key === "Delete" || event.key === "Escape") && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
          compact ? "h-8 w-8" : "h-10 w-9 md:h-8 md:w-8",
        )}
        disabled={!canClear}
        aria-label="Nulstil tidspunkt til --.--"
        title="Nulstil til --.--"
        onClick={() => onChange("")}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:inline-grid md:w-auto">
      <TimeInput
        value={start}
        disabled={disabled}
        defaultValue={defaultStart}
        onChange={onStartChange}
        compact
      />
      <span className="text-muted-foreground">–</span>
      <TimeInput
        value={end}
        disabled={disabled}
        defaultValue={defaultEnd}
        onChange={onEndChange}
        compact
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
