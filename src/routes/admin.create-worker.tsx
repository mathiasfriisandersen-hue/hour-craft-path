import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import {
  createTimesheetForWorker,
  listCompanies,
  upsert,
  WEEKDAYS,
  type CreateWorkerDayPlan,
  type CreateWorkerTimesheetInput,
} from "@/lib/timesheet-store";
import { sendWorkerInviteEmail } from "@/lib/timesheet-mail";
import { buildWorkerInviteUrl } from "@/lib/worker-invite";

export const Route = createFileRoute("/admin/create-worker")({
  head: () => ({ meta: [{ title: "Admin — Opret vikar" }] }),
  component: CreateWorkerPage,
});

type FormState = Omit<
  CreateWorkerTimesheetInput,
  "hourlyWage" | "defaultPause" | "workerAccessCode" | "weekPlan"
> & {
  hourlyWage: string;
  defaultPause: string;
  defaultPauseStart: string;
  defaultPauseEnd: string;
  defaultPause2Start: string;
  defaultPause2End: string;
  defaultDayWorkStart: string;
  defaultDayWorkEnd: string;
  defaultEveningWorkStart: string;
  defaultEveningWorkEnd: string;
  defaultNightWorkStart: string;
  defaultNightWorkEnd: string;
  shiftWorkApplies: boolean;
  weekPlan: WorkerDayForm[];
};

type WorkerDayForm = Omit<CreateWorkerDayPlan, "pause"> & {
  pause: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialWeekPlan(): WorkerDayForm[] {
  return WEEKDAYS.map((_, index) => ({
    start: index < 5 ? "07:00" : "",
    end: index < 5 ? "15:30" : "",
    pause: index < 5 ? "60" : "0",
    pauseStart: "",
    pauseEnd: "",
    pause2Start: "",
    pause2End: "",
    dayWorkStart: "",
    dayWorkEnd: "",
    eveningWorkStart: "",
    eveningWorkEnd: "",
    nightWorkStart: "",
    nightWorkEnd: "",
    shiftWork: false,
  }));
}

function initialForm(): FormState {
  return {
    vikar: "",
    vikarEmail: "",
    brugervirksomhed: "",
    arbejdssted: "",
    kontaktperson: "",
    kontaktpersonPhone: "",
    kontaktpersonEmail: "",
    referenceNo: "",
    selectedAgreementId: "",
    hourlyWage: "",
    defaultStart: "07:00",
    defaultEnd: "15:30",
    defaultPause: "60",
    defaultPauseStart: "",
    defaultPauseEnd: "",
    defaultPause2Start: "",
    defaultPause2End: "",
    defaultDayWorkStart: "",
    defaultDayWorkEnd: "",
    defaultEveningWorkStart: "",
    defaultEveningWorkEnd: "",
    defaultNightWorkStart: "",
    defaultNightWorkEnd: "",
    shiftWorkApplies: false,
    weekPlan: initialWeekPlan(),
    startDate: todayISO(),
  };
}

function generateOneTimeCode(): string {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

function CreateWorkerPage() {
  const navigate = useNavigate();
  const companies = listCompanies();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const updateWeekDay = (index: number, patch: Partial<WorkerDayForm>) => {
    setForm((current) => ({
      ...current,
      weekPlan: current.weekPlan.map((day, dayIndex) =>
        dayIndex === index ? { ...day, ...patch } : day,
      ),
    }));
  };

  const syncWeekPlanFromDefaults = (shiftWorkApplies: boolean) => {
    setForm((current) => ({
      ...current,
      shiftWorkApplies,
      weekPlan: current.weekPlan.map((day, index) => {
        const hasWork = index < 5;
        return {
          ...day,
          start: hasWork ? current.defaultStart : day.start,
          end: hasWork ? current.defaultEnd : day.end,
          pause: hasWork ? current.defaultPause : day.pause,
          pauseStart: hasWork ? current.defaultPauseStart : day.pauseStart,
          pauseEnd: hasWork ? current.defaultPauseEnd : day.pauseEnd,
          pause2Start: hasWork ? current.defaultPause2Start : day.pause2Start,
          pause2End: hasWork ? current.defaultPause2End : day.pause2End,
          dayWorkStart: hasWork ? current.defaultDayWorkStart : day.dayWorkStart,
          dayWorkEnd: hasWork ? current.defaultDayWorkEnd : day.dayWorkEnd,
          eveningWorkStart: hasWork ? current.defaultEveningWorkStart : day.eveningWorkStart,
          eveningWorkEnd: hasWork ? current.defaultEveningWorkEnd : day.eveningWorkEnd,
          nightWorkStart: hasWork ? current.defaultNightWorkStart : day.nightWorkStart,
          nightWorkEnd: hasWork ? current.defaultNightWorkEnd : day.nightWorkEnd,
          shiftWork: shiftWorkApplies && hasWork,
        };
      }),
    }));
  };

  const selectCompany = (name: string) => {
    const company = companies.find((item) => item.name === name);
    update({
      brugervirksomhed: name,
      ...(company
        ? {
            arbejdssted: company.address,
            kontaktperson: company.contactName,
            kontaktpersonPhone: company.contactPhone,
            kontaktpersonEmail: company.contactEmail,
          }
        : {}),
    });
  };

  const validateForm = () => {
    const nextErrors: string[] = [];
    const requirePair = (start: string, end: string, label: string) => {
      if (Boolean(start) !== Boolean(end)) nextErrors.push(`${label}: udfyld både start og slut`);
    };
    if (!form.vikar.trim()) nextErrors.push("Vikarnavn mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.vikarEmail))
      nextErrors.push("Vikarens mail mangler eller er ugyldig");
    if (!form.brugervirksomhed.trim()) nextErrors.push("Brugervirksomhed mangler");
    if (!form.arbejdssted.trim()) nextErrors.push("Brugervirksomhed adresse/arbejdssted mangler");
    if (!form.kontaktperson.trim()) nextErrors.push("Kontaktperson mangler");
    if (!form.kontaktpersonPhone.trim()) nextErrors.push("Kontaktperson telefonnummer mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.kontaktpersonEmail))
      nextErrors.push("Kontaktpersonens mail mangler eller er ugyldig");
    if (!form.selectedAgreementId) nextErrors.push("Overenskomst mangler");
    if (!Number.isFinite(Number(form.hourlyWage)) || Number(form.hourlyWage) <= 0)
      nextErrors.push("Timeløn skal være et tal over 0");
    if (!form.defaultStart || !form.defaultEnd) nextErrors.push("Arbejdstider skal udfyldes");
    if (!Number.isFinite(Number(form.defaultPause)) || Number(form.defaultPause) < 0)
      nextErrors.push("Pause skal være et tal på 0 minutter eller mere");
    requirePair(form.defaultPauseStart, form.defaultPauseEnd, "Pause 1 placering");
    requirePair(form.defaultPause2Start, form.defaultPause2End, "Pause 2 placering");
    requirePair(form.defaultDayWorkStart, form.defaultDayWorkEnd, "Dagarbejde");
    requirePair(form.defaultEveningWorkStart, form.defaultEveningWorkEnd, "Aftenarbejde");
    requirePair(form.defaultNightWorkStart, form.defaultNightWorkEnd, "Natarbejde");
    if (form.shiftWorkApplies) {
      form.weekPlan.forEach((day, index) => {
        if (!Number.isFinite(Number(day.pause)) || Number(day.pause) < 0)
          nextErrors.push(`${WEEKDAYS[index]}: pause skal være 0 minutter eller mere`);
        requirePair(day.pauseStart, day.pauseEnd, `${WEEKDAYS[index]} pause 1 placering`);
        requirePair(day.pause2Start, day.pause2End, `${WEEKDAYS[index]} pause 2 placering`);
        requirePair(day.dayWorkStart, day.dayWorkEnd, `${WEEKDAYS[index]} dagarbejde`);
        requirePair(day.eveningWorkStart, day.eveningWorkEnd, `${WEEKDAYS[index]} aftenarbejde`);
        requirePair(day.nightWorkStart, day.nightWorkEnd, `${WEEKDAYS[index]} natarbejde`);
      });
    }
    if (!form.startDate) nextErrors.push("Startdato mangler");
    return nextErrors;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setSending(true);
    setMessage("Opretter timeseddel og sender invitation til vikaren…");

    const timesheet = upsert(
      createTimesheetForWorker({
        ...form,
        hourlyWage: Number(form.hourlyWage),
        defaultPause: Number(form.defaultPause),
        weekPlan: form.shiftWorkApplies
          ? form.weekPlan.map((day) => ({
              ...day,
              pause: Number(day.pause) || 0,
            }))
          : undefined,
        workerAccessCode: generateOneTimeCode(),
      }),
    );
    setCreatedId(timesheet.id);

    try {
      const inviteUrl = buildWorkerInviteUrl(timesheet);
      const result = await sendWorkerInviteEmail(timesheet, inviteUrl);
      setMessage(
        result === "api"
          ? "Vikaren er oprettet, og invitationsmailen er sendt."
          : "Vikaren er oprettet. Mailappen er åbnet som fallback, fordi mailsystemet ikke svarede.",
      );
    } catch {
      setMessage(
        "Vikaren er oprettet, men invitationsmailen kunne ikke sendes automatisk. Prøv igen eller send manuelt.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Opret vikar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opret timeseddel, forudfyld arbejdsoplysninger og send loginlink til vikaren.
          </p>
        </div>
        {createdId && (
          <Link
            to="/admin/$id"
            params={{ id: createdId }}
            className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Åbn timeseddel →
          </Link>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="font-medium">Ret følgende før oprettelse:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="rounded-lg border bg-card p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vikarnavn *">
            <Input value={form.vikar} onChange={(e) => update({ vikar: e.target.value })} />
          </Field>
          <Field label="Vikarens mail *">
            <Input
              type="email"
              value={form.vikarEmail}
              onChange={(e) => update({ vikarEmail: e.target.value })}
            />
          </Field>
          <Field label="Engangskode">
            <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              Genereres automatisk
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Systemet laver en 6-cifret engangskode og sender den til vikaren i invitationsmailen.
              Vikaren bliver bedt om at ændre adgangskoden efter første login.
            </p>
          </Field>
          <Field label="Brugervirksomhed *">
            <Input
              list="admin-create-company-list"
              value={form.brugervirksomhed}
              onChange={(e) => selectCompany(e.target.value)}
            />
            <datalist id="admin-create-company-list">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Brugervirksomhed adresse / arbejdssted *">
            <Input
              value={form.arbejdssted}
              onChange={(e) => update({ arbejdssted: e.target.value })}
            />
          </Field>
          <Field label="Kontaktperson *">
            <Input
              value={form.kontaktperson}
              onChange={(e) => update({ kontaktperson: e.target.value })}
            />
          </Field>
          <Field label="Kontaktperson telefonnummer *">
            <Input
              value={form.kontaktpersonPhone}
              onChange={(e) => update({ kontaktpersonPhone: e.target.value })}
            />
          </Field>
          <Field label="Kontaktpersonens mail *">
            <Input
              type="email"
              value={form.kontaktpersonEmail}
              onChange={(e) => update({ kontaktpersonEmail: e.target.value })}
            />
          </Field>
          <Field label="Evt. reference nr.">
            <Input
              value={form.referenceNo}
              onChange={(e) => update({ referenceNo: e.target.value })}
            />
          </Field>
          <Field label="Overenskomst *">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.selectedAgreementId}
              onChange={(e) => update({ selectedAgreementId: e.target.value })}
            >
              <option value="">Vælg overenskomst…</option>
              {activeCollectiveAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} — {agreement.industryArea}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timeløn *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.hourlyWage}
              onChange={(e) => update({ hourlyWage: e.target.value })}
            />
          </Field>
          <Field label="Startdato *">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <Field label="Start">
              <Input
                type="time"
                step={300}
                value={form.defaultStart}
                onChange={(e) => update({ defaultStart: e.target.value })}
              />
            </Field>
            <Field label="Slut">
              <Input
                type="time"
                step={300}
                value={form.defaultEnd}
                onChange={(e) => update({ defaultEnd: e.target.value })}
              />
            </Field>
            <Field label="Pause">
              <Input
                type="number"
                min={0}
                step={5}
                value={form.defaultPause}
                onChange={(e) => update({ defaultPause: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2 lg:grid-cols-5">
            <TimeRangeField
              label="Pause 1 start / slut"
              start={form.defaultPauseStart}
              end={form.defaultPauseEnd}
              onStartChange={(value) => update({ defaultPauseStart: value })}
              onEndChange={(value) => update({ defaultPauseEnd: value })}
            />
            <TimeRangeField
              label="Pause 2 start / slut"
              start={form.defaultPause2Start}
              end={form.defaultPause2End}
              onStartChange={(value) => update({ defaultPause2Start: value })}
              onEndChange={(value) => update({ defaultPause2End: value })}
            />
            <TimeRangeField
              label="Dagarbejde"
              help="Udfyld kun hvis der er daghold."
              start={form.defaultDayWorkStart}
              end={form.defaultDayWorkEnd}
              onStartChange={(value) => update({ defaultDayWorkStart: value })}
              onEndChange={(value) => update({ defaultDayWorkEnd: value })}
            />
            <TimeRangeField
              label="Aftenarbejde"
              help="Udfyld kun hvis der er aftenarbejde."
              start={form.defaultEveningWorkStart}
              end={form.defaultEveningWorkEnd}
              onStartChange={(value) => update({ defaultEveningWorkStart: value })}
              onEndChange={(value) => update({ defaultEveningWorkEnd: value })}
            />
            <TimeRangeField
              label="Natarbejde"
              help="Udfyld kun hvis der er natarbejde."
              start={form.defaultNightWorkStart}
              end={form.defaultNightWorkEnd}
              onStartChange={(value) => update({ defaultNightWorkStart: value })}
              onEndChange={(value) => update({ defaultNightWorkEnd: value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.shiftWorkApplies}
                onChange={(e) => syncWeekPlanFromDefaults(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Skiftehold
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Markér kun hvis vikaren arbejder skiftehold. Når feltet er markeret, bruges
              ugekalenderen nedenfor til de konkrete arbejdstider.
            </p>
          </div>
          {form.shiftWorkApplies && (
            <section className="md:col-span-2">
              <div className="mb-3">
                <h2 className="text-base font-semibold">Ugekalender for skiftehold</h2>
                <p className="text-xs text-muted-foreground">
                  Udfyld arbejdstider pr. dag. Dag, aften og nat udfyldes kun på de dage, hvor det
                  er relevant.
                </p>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1420px] text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      {[
                        "Dag",
                        "Start",
                        "Slut",
                        "Pause",
                        "Pause 1",
                        "Pause 2",
                        "Dagarbejde",
                        "Aftenarbejde",
                        "Natarbejde",
                        "Skiftehold",
                        "Visning",
                      ].map((head) => (
                        <th key={head} className="px-3 py-2 font-medium">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.weekPlan.map((day, index) => (
                      <tr key={WEEKDAYS[index]} className="border-t">
                        <td className="px-3 py-3 font-medium">{WEEKDAYS[index]}</td>
                        <td className="px-3 py-3">
                          <Input
                            type="time"
                            step={300}
                            value={day.start}
                            onChange={(e) => updateWeekDay(index, { start: e.target.value })}
                            className="h-9 w-28"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="time"
                            step={300}
                            value={day.end}
                            onChange={(e) => updateWeekDay(index, { end: e.target.value })}
                            className="h-9 w-28"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            min={0}
                            step={5}
                            value={day.pause}
                            onChange={(e) => updateWeekDay(index, { pause: e.target.value })}
                            className="h-9 w-24"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.pauseStart}
                            end={day.pauseEnd}
                            onStartChange={(value) => updateWeekDay(index, { pauseStart: value })}
                            onEndChange={(value) => updateWeekDay(index, { pauseEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.pause2Start}
                            end={day.pause2End}
                            onStartChange={(value) => updateWeekDay(index, { pause2Start: value })}
                            onEndChange={(value) => updateWeekDay(index, { pause2End: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.dayWorkStart}
                            end={day.dayWorkEnd}
                            onStartChange={(value) => updateWeekDay(index, { dayWorkStart: value })}
                            onEndChange={(value) => updateWeekDay(index, { dayWorkEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.eveningWorkStart}
                            end={day.eveningWorkEnd}
                            onStartChange={(value) =>
                              updateWeekDay(index, { eveningWorkStart: value })
                            }
                            onEndChange={(value) => updateWeekDay(index, { eveningWorkEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.nightWorkStart}
                            end={day.nightWorkEnd}
                            onStartChange={(value) =>
                              updateWeekDay(index, { nightWorkStart: value })
                            }
                            onEndChange={(value) => updateWeekDay(index, { nightWorkEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={day.shiftWork}
                            onChange={(e) => updateWeekDay(index, { shiftWork: e.target.checked })}
                            className="h-4 w-4 rounded border-input"
                            aria-label={`${WEEKDAYS[index]} skiftehold`}
                          />
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                          {workPeriodLabel(day)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{message}</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin" })}>
              Annullér
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "Sender…" : "Opret vikar og send mail"}
            </Button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function TimeRangeField({
  label,
  help,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  label: string;
  help?: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <InlineTimeRange
        start={start}
        end={end}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </Field>
  );
}

function InlineTimeRange({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        step={300}
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="h-9 min-w-0 flex-1"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="time"
        step={300}
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="h-9 min-w-0 flex-1"
      />
    </div>
  );
}

function workPeriodLabel(day: WorkerDayForm): string {
  if (!day.start || !day.end) return "Fri / ikke udfyldt";
  const parts: string[] = [];
  if (day.dayWorkStart && day.dayWorkEnd) parts.push("Daghold");
  if (day.eveningWorkStart && day.eveningWorkEnd) parts.push("Aften");
  if (day.nightWorkStart && day.nightWorkEnd) parts.push("Nat");
  if (day.shiftWork) parts.push("Skiftehold");
  return parts.length ? parts.join(" + ") : "Ikke klassificeret";
}
