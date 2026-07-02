import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  createTimesheetForWorker,
  knownWorkersFromTimesheets,
  listCompanies,
  listKnownContacts,
  listKnownWorkers,
  TRADE_SKILLS,
  upsert,
  workerReferenceKeys,
  WEEKDAYS,
  type CompanyProject,
  type CreateWorkerDayPlan,
  type CreateWorkerTimesheetInput,
  type Timesheet,
  type TradeSkill,
  type WorkPeriod,
} from "@/lib/timesheet-store";
import { sendWorkerInviteEmail } from "@/lib/timesheet-mail";
import { createShortWorkerInviteUrl } from "@/lib/worker-invite";

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

function workPeriodTimes(workPeriod: WorkPeriod): { start: string; end: string } {
  if (workPeriod === "evening") return { start: "14:00", end: "23:00" };
  if (workPeriod === "night") return { start: "22:00", end: "07:00" };
  return { start: "07:00", end: "15:00" };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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

function defaultWorkWindow(form: FormState): { start: string; end: string } {
  if (form.defaultDayWorkStart && form.defaultDayWorkEnd) {
    return { start: form.defaultDayWorkStart, end: form.defaultDayWorkEnd };
  }
  if (form.defaultEveningWorkStart && form.defaultEveningWorkEnd) {
    return { start: form.defaultEveningWorkStart, end: form.defaultEveningWorkEnd };
  }
  if (form.defaultNightWorkStart && form.defaultNightWorkEnd) {
    return { start: form.defaultNightWorkStart, end: form.defaultNightWorkEnd };
  }
  return { start: form.defaultStart, end: form.defaultEnd };
}

function initialWeekPlan(): WorkerDayForm[] {
  return WEEKDAYS.map((_, index) => ({
    start: "",
    end: "",
    pause: index < 5 ? "60" : "0",
    pauseStart: index < 5 ? "09:00" : "",
    pauseEnd: index < 5 ? "09:30" : "",
    pause2Start: index < 5 ? "12:00" : "",
    pause2End: index < 5 ? "12:30" : "",
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
    vikarPhone: "",
    tradeSkills: [],
    competencies: "",
    brugervirksomhed: "",
    companyId: "",
    projectId: "",
    projectName: "",
    projectEndDate: "",
    arbejdssted: "",
    kontaktperson: "",
    kontaktpersonPhone: "",
    kontaktpersonEmail: "",
    referenceNo: "",
    selectedAgreementId: "",
    hourlyWage: "",
    defaultStart: "07:00",
    defaultEnd: "15:00",
    defaultPause: "60",
    defaultPauseStart: "09:00",
    defaultPauseEnd: "09:30",
    defaultPause2Start: "12:00",
    defaultPause2End: "12:30",
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
  const timesheets = useTimesheets();
  const companies = listCompanies();
  const knownWorkers = knownWorkersFromTimesheets(timesheets);
  const knownContacts = listKnownContacts();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const selectedCompany = companies.find((item) => item.id === form.companyId);
  const companyProjects = selectedCompany?.projects ?? [];
  const selectedProject = companyProjects.find((project) => project.id === form.projectId);
  const selectedProjectForAvailability = selectedProject
    ? {
        ...selectedProject,
        startDate: form.startDate || selectedProject.startDate,
        endDate: form.projectEndDate || selectedProject.endDate,
      }
    : undefined;
  const projectWorkerOptions = selectedProjectForAvailability
    ? knownWorkers.filter(
        (worker) =>
          !workerProjectConflict(
            companies,
            timesheets,
            selectedCompany?.id ?? "",
            selectedProjectForAvailability,
            worker,
          ),
      )
    : knownWorkers;

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
        const workWindow = defaultWorkWindow(current);
        const pauseMinutes = totalPauseMinutes(
          [current.defaultPauseStart, current.defaultPauseEnd],
          [current.defaultPause2Start, current.defaultPause2End],
        );
        return {
          ...day,
          start: hasWork ? workWindow.start : day.start,
          end: hasWork ? workWindow.end : day.end,
          pause: hasWork ? String(pauseMinutes || Number(current.defaultPause) || 0) : day.pause,
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
    const company = companies.find(
      (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    update({
      brugervirksomhed: name,
      companyId: company?.id ?? "",
      projectId: "",
      projectName: "",
      projectEndDate: "",
      ...(company
        ? {
            arbejdssted: company.address,
            kontaktperson: company.contactName,
            kontaktpersonPhone: company.contactPhone,
            kontaktpersonEmail: company.contactEmail,
            selectedAgreementId: company.selectedAgreementId || form.selectedAgreementId,
          }
        : {}),
    });
  };

  const selectProject = (projectId: string) => {
    const project = companyProjects.find((item) => item.id === projectId);
    if (!project) {
      update({ projectId: "", projectName: "", projectEndDate: "" });
      return;
    }
    const pauseMinutes = totalPauseMinutes(
      [project.pauseStart, project.pauseEnd],
      [project.pause2Start, project.pause2End],
    );
    update({
      projectId: project.id,
      projectName: project.name,
      projectEndDate: project.endDate || form.projectEndDate,
      kontaktperson: project.contactName || selectedCompany?.contactName || form.kontaktperson,
      kontaktpersonPhone:
        project.contactPhone || selectedCompany?.contactPhone || form.kontaktpersonPhone,
      kontaktpersonEmail:
        project.contactEmail || selectedCompany?.contactEmail || form.kontaktpersonEmail,
      referenceNo: project.referenceNo || form.referenceNo,
      selectedAgreementId:
        project.selectedAgreementId ||
        selectedCompany?.selectedAgreementId ||
        form.selectedAgreementId,
      startDate: project.startDate || form.startDate,
      defaultStart: project.defaultStart || form.defaultStart,
      defaultEnd: project.defaultEnd || form.defaultEnd,
      defaultPause: pauseMinutes ? String(pauseMinutes) : form.defaultPause,
      defaultPauseStart: project.pauseStart || form.defaultPauseStart,
      defaultPauseEnd: project.pauseEnd || form.defaultPauseEnd,
      defaultPause2Start: project.pause2Start || form.defaultPause2Start,
      defaultPause2End: project.pause2End || form.defaultPause2End,
      defaultDayWorkStart: project.workPeriod === "day" ? project.defaultStart : "",
      defaultDayWorkEnd: project.workPeriod === "day" ? project.defaultEnd : "",
      defaultEveningWorkStart: project.workPeriod === "evening" ? project.defaultStart : "",
      defaultEveningWorkEnd: project.workPeriod === "evening" ? project.defaultEnd : "",
      defaultNightWorkStart: project.workPeriod === "night" ? project.defaultStart : "",
      defaultNightWorkEnd: project.workPeriod === "night" ? project.defaultEnd : "",
      tradeSkills: project.tradeSkills.length ? project.tradeSkills : form.tradeSkills,
      competencies: project.competencies || form.competencies,
    });
  };

  const applyWorker = (key: string) => {
    const worker = knownWorkers.find((item) => item.key === key);
    if (!worker) return;
    update({
      vikar: worker.name,
      vikarEmail: worker.email,
      vikarPhone: worker.phone,
      tradeSkills: worker.tradeSkills,
      competencies: worker.competencies || form.competencies,
    });
  };

  const applyContactName = (name: string) => {
    const contact = knownContacts.find(
      (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    update({
      kontaktperson: name,
      ...(contact
        ? {
            kontaktpersonPhone: contact.phone || form.kontaktpersonPhone,
            kontaktpersonEmail: contact.email || form.kontaktpersonEmail,
          }
        : {}),
    });
  };

  const applyContactEmail = (email: string) => {
    const contact = knownContacts.find(
      (item) => item.email.trim().toLowerCase() === email.trim().toLowerCase(),
    );
    update({
      kontaktpersonEmail: email,
      ...(contact
        ? {
            kontaktperson: contact.name || form.kontaktperson,
            kontaktpersonPhone: contact.phone || form.kontaktpersonPhone,
          }
        : {}),
    });
  };

  const applyWorkPeriod = (workPeriod: WorkPeriod) => {
    const times = workPeriodTimes(workPeriod);
    update({
      defaultStart: times.start,
      defaultEnd: times.end,
      defaultDayWorkStart: workPeriod === "day" ? times.start : "",
      defaultDayWorkEnd: workPeriod === "day" ? times.end : "",
      defaultEveningWorkStart: workPeriod === "evening" ? times.start : "",
      defaultEveningWorkEnd: workPeriod === "evening" ? times.end : "",
      defaultNightWorkStart: workPeriod === "night" ? times.start : "",
      defaultNightWorkEnd: workPeriod === "night" ? times.end : "",
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
    if (!form.tradeSkills?.length) nextErrors.push("Vælg mindst ét fag for vikaren");
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
    if (form.projectId && !form.projectEndDate) {
      nextErrors.push("Projektafslutning mangler for det valgte projekt");
    }
    if (form.projectEndDate && form.startDate && form.projectEndDate < form.startDate) {
      nextErrors.push("Projektafslutning må ikke være før startdato");
    }
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

    const workWindow = defaultWorkWindow(form);
    const defaultPauseMinutes =
      totalPauseMinutes(
        [form.defaultPauseStart, form.defaultPauseEnd],
        [form.defaultPause2Start, form.defaultPause2End],
      ) ||
      Number(form.defaultPause) ||
      0;
    const timesheet = upsert(
      createTimesheetForWorker({
        ...form,
        defaultStart: workWindow.start,
        defaultEnd: workWindow.end,
        hourlyWage: Number(form.hourlyWage),
        defaultPause: defaultPauseMinutes,
        weekPlan: form.shiftWorkApplies
          ? form.weekPlan.map((day) => ({
              ...day,
              pause:
                totalPauseMinutes(
                  [day.pauseStart, day.pauseEnd],
                  [day.pause2Start, day.pause2End],
                ) ||
                Number(day.pause) ||
                0,
            }))
          : undefined,
        workerAccessCode: generateOneTimeCode(),
      }),
    );
    setCreatedId(timesheet.id);

    try {
      const inviteUrl = await createShortWorkerInviteUrl(timesheet);
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
          <Field label="Vikarens telefon">
            <Input
              value={form.vikarPhone ?? ""}
              onChange={(e) => update({ vikarPhone: e.target.value })}
            />
          </Field>
          <div>
            <TradeSkillPicker
              label="Vikarens fag *"
              selected={form.tradeSkills ?? []}
              onChange={(tradeSkills) => update({ tradeSkills })}
            />
          </div>
          <Field label="Kompetencer">
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.competencies ?? ""}
              onChange={(e) => update({ competencies: e.target.value })}
              placeholder="Beskriv hvad medarbejderen konkret skal kunne inden for sit fag."
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
          {companyProjects.length > 0 && (
            <Field label="Projekt / afdeling">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.projectId || ""}
                onChange={(e) => selectProject(e.target.value)}
              >
                <option value="">Ingen projekt valgt</option>
                {companyProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name || "Unavngivet projekt"}
                  </option>
                ))}
              </select>
              {selectedProject && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Projektdata bruges som standard. Projektets overenskomst overstyrer virksomhedens
                  standard, hvis den er valgt.
                </p>
              )}
            </Field>
          )}
          <Field label="Brugervirksomhed adresse / arbejdssted *">
            <Input
              value={form.arbejdssted}
              onChange={(e) => update({ arbejdssted: e.target.value })}
            />
          </Field>
          <Field label="Kontaktperson *">
            <Input
              list="admin-create-contact-list"
              value={form.kontaktperson}
              onChange={(e) => applyContactName(e.target.value)}
            />
            <datalist id="admin-create-contact-list">
              {knownContacts.map((contact) => (
                <option key={contact.key} value={contact.name || contact.email} />
              ))}
            </datalist>
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
              list="admin-create-contact-email-list"
              value={form.kontaktpersonEmail}
              onChange={(e) => applyContactEmail(e.target.value)}
            />
            <datalist id="admin-create-contact-email-list">
              {knownContacts
                .filter((contact) => contact.email)
                .map((contact) => (
                  <option key={contact.key} value={contact.email} />
                ))}
            </datalist>
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
          <Field label="Projektafslutning">
            <Input
              type="date"
              value={form.projectEndDate ?? ""}
              onChange={(e) => update({ projectEndDate: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Bruges til at kontrollere, om en tidligere vikar er ledig i projektperioden.
            </p>
          </Field>
          <Field label="Ledig / tidligere vikar">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value=""
              onChange={(e) => applyWorker(e.target.value)}
            >
              <option value="">Vælg ledig tidligere vikar…</option>
              {projectWorkerOptions.map((worker) => (
                <option key={worker.key} value={worker.key}>
                  {worker.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Listen viser aktive tidligere vikarer, der er ledige i den valgte periode.
            </p>
          </Field>
          <div className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Arbejdstidstype</span>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["day", "Dag"],
                  ["evening", "Aften"],
                  ["night", "Nat"],
                ] as Array<[WorkPeriod, string]>
              ).map(([value, label]) => {
                const times = workPeriodTimes(value);
                const checked = form.defaultStart === times.start && form.defaultEnd === times.end;
                return (
                  <label key={value} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="admin-create-work-period"
                      checked={checked}
                      onChange={() => applyWorkPeriod(value)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Valget forudfylder arbejdstiden. Tiderne kan stadig rettes manuelt bagefter.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2 lg:grid-cols-5">
            <TimeRangeField
              label="Pause 1 start / slut"
              start={form.defaultPauseStart}
              end={form.defaultPauseEnd}
              defaultStart="09:00"
              defaultEnd="09:30"
              onStartChange={(value) => update({ defaultPauseStart: value })}
              onEndChange={(value) => update({ defaultPauseEnd: value })}
            />
            <TimeRangeField
              label="Pause 2 start / slut"
              start={form.defaultPause2Start}
              end={form.defaultPause2End}
              defaultStart="12:00"
              defaultEnd="12:30"
              onStartChange={(value) => update({ defaultPause2Start: value })}
              onEndChange={(value) => update({ defaultPause2End: value })}
            />
            <TimeRangeField
              label="Dagarbejde"
              help="Udfyld kun hvis der er daghold."
              start={form.defaultDayWorkStart}
              end={form.defaultDayWorkEnd}
              defaultStart="07:00"
              defaultEnd="15:00"
              onStartChange={(value) => update({ defaultDayWorkStart: value })}
              onEndChange={(value) => update({ defaultDayWorkEnd: value })}
            />
            <TimeRangeField
              label="Aftenarbejde"
              help="Udfyld kun hvis der er aftenarbejde."
              start={form.defaultEveningWorkStart}
              end={form.defaultEveningWorkEnd}
              defaultStart="14:00"
              defaultEnd="23:00"
              onStartChange={(value) => update({ defaultEveningWorkStart: value })}
              onEndChange={(value) => update({ defaultEveningWorkEnd: value })}
            />
            <TimeRangeField
              label="Natarbejde"
              help="Udfyld kun hvis der er natarbejde."
              start={form.defaultNightWorkStart}
              end={form.defaultNightWorkEnd}
              defaultStart="22:00"
              defaultEnd="07:00"
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
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      {[
                        "Dag",
                        "Pause 1",
                        "Pause 2",
                        "Dagarbejde",
                        "Aftenarbejde",
                        "Natarbejde",
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
                          <InlineTimeRange
                            start={day.pauseStart}
                            end={day.pauseEnd}
                            defaultStart="09:00"
                            defaultEnd="09:30"
                            onStartChange={(value) => updateWeekDay(index, { pauseStart: value })}
                            onEndChange={(value) => updateWeekDay(index, { pauseEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.pause2Start}
                            end={day.pause2End}
                            defaultStart="12:00"
                            defaultEnd="12:30"
                            onStartChange={(value) => updateWeekDay(index, { pause2Start: value })}
                            onEndChange={(value) => updateWeekDay(index, { pause2End: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.dayWorkStart}
                            end={day.dayWorkEnd}
                            defaultStart="07:00"
                            defaultEnd="15:00"
                            onStartChange={(value) => updateWeekDay(index, { dayWorkStart: value })}
                            onEndChange={(value) => updateWeekDay(index, { dayWorkEnd: value })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <InlineTimeRange
                            start={day.eveningWorkStart}
                            end={day.eveningWorkEnd}
                            defaultStart="14:00"
                            defaultEnd="23:00"
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
                            defaultStart="22:00"
                            defaultEnd="07:00"
                            onStartChange={(value) =>
                              updateWeekDay(index, { nightWorkStart: value })
                            }
                            onEndChange={(value) => updateWeekDay(index, { nightWorkEnd: value })}
                          />
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
  defaultStart,
  defaultEnd,
  onStartChange,
  onEndChange,
}: {
  label: string;
  help?: string;
  start: string;
  end: string;
  defaultStart?: string;
  defaultEnd?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <InlineTimeRange
        start={start}
        end={end}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
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
  defaultStart,
  defaultEnd,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  defaultStart?: string;
  defaultEnd?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <DefaultTimeInput
        value={start}
        defaultValue={defaultStart}
        onChange={(e) => onStartChange(e.target.value)}
        onDefault={() => defaultStart && onStartChange(defaultStart)}
        className="h-9 min-w-0 flex-1"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <DefaultTimeInput
        value={end}
        defaultValue={defaultEnd}
        onChange={(e) => onEndChange(e.target.value)}
        onDefault={() => defaultEnd && onEndChange(defaultEnd)}
        className="h-9 min-w-0 flex-1"
      />
    </div>
  );
}

function TradeSkillPicker({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: TradeSkill[];
  onChange: (value: TradeSkill[]) => void;
}) {
  const toggle = (skill: TradeSkill, checked: boolean) => {
    onChange(
      checked ? [...new Set([...selected, skill])] : selected.filter((item) => item !== skill),
    );
  };
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3 md:grid-cols-2">
        {TRADE_SKILLS.map((skill) => (
          <label key={skill} className="inline-flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(skill)}
              onChange={(e) => toggle(skill, e.target.checked)}
            />
            {skill}
          </label>
        ))}
      </div>
    </div>
  );
}

function DefaultTimeInput({
  value,
  defaultValue,
  onDefault,
  onFocus,
  ...props
}: ComponentProps<typeof Input> & {
  value: string;
  defaultValue?: string;
  onDefault?: () => void;
}) {
  return (
    <Input
      {...props}
      type="time"
      step={300}
      value={value}
      onFocus={(event) => {
        if (!value && defaultValue) {
          onDefault?.();
        }
        onFocus?.(event);
      }}
    />
  );
}

function projectDatesOverlap(a: CompanyProject, b: CompanyProject): boolean {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return false;
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function workerProjectConflict(
  companies: ReturnType<typeof listCompanies>,
  timesheets: Timesheet[],
  currentCompanyId: string,
  currentProject: CompanyProject,
  worker: ReturnType<typeof listKnownWorkers>[number],
): boolean {
  if (!currentProject.startDate || !currentProject.endDate) return false;
  const references = workerReferenceKeys(worker);
  const hasProjectConflict = companies.some((company) =>
    company.projects.some((project) => {
      if (company.id === currentCompanyId && project.id === currentProject.id) return false;
      if (!project.workerEmails.some((item) => references.includes(item.toLowerCase())))
        return false;
      return projectDatesOverlap(currentProject, project);
    }),
  );
  if (hasProjectConflict) return true;
  return timesheets.some((timesheet) => {
    if (
      timesheet.status === "draft" ||
      timesheet.archived ||
      timesheet.workerInactive ||
      timesheet.workerConsentInactive
    ) {
      return false;
    }
    if (!workerMatchesTimesheet(worker, timesheet)) return false;
    return projectDatesOverlap(currentProject, timesheetPeriod(timesheet));
  });
}

function workerMatchesTimesheet(
  worker: ReturnType<typeof listKnownWorkers>[number],
  timesheet: Timesheet,
): boolean {
  const references = workerReferenceKeys(worker);
  return [timesheet.vikar, timesheet.vikarEmail]
    .map((item) => item.trim().toLowerCase())
    .some((item) => references.includes(item));
}

function timesheetPeriod(timesheet: Timesheet): CompanyProject {
  return {
    id: timesheet.projectId || timesheet.id,
    name: timesheet.projectName || "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    referenceNo: "",
    startDate: timesheet.weekStart,
    endDate: timesheet.projectEndDate || addDays(timesheet.weekStart, 6),
    selectedAgreementId: timesheet.selectedAgreementId,
    tradeSkills: timesheet.tradeSkills ?? [],
    competencies: timesheet.competencies ?? "",
    workerEmails: [timesheet.vikar, timesheet.vikarEmail].filter(Boolean),
    workPeriod: "day",
    defaultStart: "",
    defaultEnd: "",
    pauseStart: "",
    pauseEnd: "",
    pause2Start: "",
    pause2End: "",
  };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
