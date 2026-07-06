import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/auth";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  knownWorkersFromTimesheets,
  knownWorkersIncludingInactiveFromTimesheets,
  listCompanies,
  setKnownWorkerInactive,
  TRADE_SKILLS,
  updateKnownWorker,
  WORKER_LANGUAGES,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
  type TradeSkill,
  type WorkerLanguage,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/workers")({
  head: () => ({ meta: [{ title: "Admin — Vikaroversigt" }] }),
  component: WorkerOverview,
});

type Assignment = {
  companyName: string;
  projectName: string;
  startDate: string;
  endDate: string;
};

type WorkerRow = {
  worker: KnownWorker;
  assignments: Assignment[];
  futureAssignments: Assignment[];
  currentTimesheets: Timesheet[];
  nextTimesheet: Timesheet | null;
  hasActiveBooking: boolean;
  nextBookingStart: string;
  bookingStart: string;
  bookingEnd: string;
};

function WorkerOverview() {
  return (
    <AppShell allow={["admin"]}>
      <WorkerOverviewContent role="admin" showBackLink />
    </AppShell>
  );
}

export function WorkerOverviewContent({
  role,
  showBackLink = false,
  backHref = "/admin",
}: {
  role: Role;
  showBackLink?: boolean;
  backHref?: string;
}) {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const rows = useMemo(() => buildWorkerRows(timesheets, companies), [timesheets, companies]);
  const inactiveRows = useMemo(
    () => buildWorkerRows(timesheets, companies, { inactive: true }),
    [timesheets, companies],
  );

  const working = rows.filter((row) => row.hasActiveBooking);
  const available = rows.filter((row) => !row.hasActiveBooking).sort(compareAvailableWorkerRows);

  const restoreWorker = (worker: KnownWorker) => {
    setKnownWorkerInactive(worker, false);
  };

  const inactivateWorker = (worker: KnownWorker) => {
    setKnownWorkerInactive(worker, true);
    setShowInactive(true);
  };

  return (
    <>
      <div className="mb-6">
        {showBackLink && (
          <a href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            ← Timesedler
          </a>
        )}
        <h1 className="mt-3 text-2xl font-semibold">Vikaroversigt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se hvilke aktive vikarer der er i arbejde, og hvilke der er ledige.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WorkerSection
          title="I arbejde"
          rows={working}
          emptyText="Ingen vikarer er i arbejde."
          onInactivate={inactivateWorker}
        />
        <div className="space-y-5">
          <WorkerSection
            title="Ledige"
            rows={available}
            emptyText="Ingen ledige vikarer fundet."
            onInactivate={inactivateWorker}
            headerAction={
              <Button variant="outline" onClick={() => setShowInactive((current) => !current)}>
                Inaktive vikarer ({inactiveRows.length})
              </Button>
            }
            inlineSection={
              showInactive
                ? {
                    title: "Inaktive vikarer",
                    rows: inactiveRows,
                    emptyText: "Ingen inaktive vikarer.",
                    inactiveMode: true,
                    onRestore: restoreWorker,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
}

type InlineWorkerSection = {
  title: string;
  rows: WorkerRow[];
  emptyText: string;
  inactiveMode?: boolean;
  onRestore?: (worker: KnownWorker) => void;
};

function WorkerSection({
  title,
  rows,
  emptyText,
  headerAction,
  inlineSection,
  inactiveMode = false,
  onInactivate,
  onRestore,
}: {
  title: string;
  rows: WorkerRow[];
  emptyText: string;
  headerAction?: ReactNode;
  inlineSection?: InlineWorkerSection;
  inactiveMode?: boolean;
  onInactivate?: (worker: KnownWorker) => void;
  onRestore?: (worker: KnownWorker) => void;
}) {
  const [expandedWorkerKeys, setExpandedWorkerKeys] = useState<string[]>([]);

  const toggleWorker = (workerKey: string) => {
    setExpandedWorkerKeys((current) =>
      current.includes(workerKey)
        ? current.filter((key) => key !== workerKey)
        : [...current, workerKey],
    );
  };

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">
          {title} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        {headerAction}
      </div>
      {inlineSection && (
        <div className="border-b bg-muted/20">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">
              {inlineSection.title}{" "}
              <span className="text-muted-foreground">({inlineSection.rows.length})</span>
            </h3>
          </div>
          {inlineSection.rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">{inlineSection.emptyText}</div>
          ) : (
            <WorkerRows
              title={inlineSection.title}
              rows={inlineSection.rows}
              expandedWorkerKeys={expandedWorkerKeys}
              inactiveMode={inlineSection.inactiveMode ?? false}
              onInactivate={onInactivate}
              onRestore={inlineSection.onRestore}
              onToggleWorker={toggleWorker}
            />
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <WorkerRows
          title={title}
          rows={rows}
          expandedWorkerKeys={expandedWorkerKeys}
          inactiveMode={inactiveMode}
          onInactivate={onInactivate}
          onRestore={onRestore}
          onToggleWorker={toggleWorker}
        />
      )}
    </section>
  );
}

function WorkerRows({
  title,
  rows,
  expandedWorkerKeys,
  inactiveMode,
  onInactivate,
  onRestore,
  onToggleWorker,
}: {
  title: string;
  rows: WorkerRow[];
  expandedWorkerKeys: string[];
  inactiveMode: boolean;
  onInactivate?: (worker: KnownWorker) => void;
  onRestore?: (worker: KnownWorker) => void;
  onToggleWorker: (workerKey: string) => void;
}) {
  return (
    <div className="divide-y">
      {rows.map((row) => {
        const isExpanded = expandedWorkerKeys.includes(row.worker.key);
        return (
          <article key={row.worker.key} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{row.worker.name || "—"}</h3>
                <p className="text-sm text-muted-foreground">{row.worker.email || "—"}</p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                {row.bookingStart || row.bookingEnd ? (
                  <>
                    <div>Start vagt {formatDate(row.bookingStart)}</div>
                    <div>Slut vagt {formatDate(row.bookingEnd)}</div>
                  </>
                ) : (
                  <div>Ingen aktiv booking</div>
                )}
                {row.worker.phone && <div className="mt-1">Tlf. {row.worker.phone}</div>}
              </div>
            </div>
            {title === "I arbejde" && row.assignments.length > 0 && (
              <div className="mt-3 space-y-1.5 text-sm">
                {row.assignments.map((assignment) => (
                  <div key={`${assignment.companyName}-${assignment.projectName}`}>
                    <span className="font-medium">{assignment.companyName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {assignment.projectName || "Projekt"} · {formatDate(assignment.startDate)} –{" "}
                      {formatDate(assignment.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {row.currentTimesheets.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                Aktiv timeseddeluge: {row.currentTimesheets.length}
              </div>
            )}
            <button
              type="button"
              className="mt-3 text-sm font-medium text-primary hover:underline"
              aria-expanded={isExpanded}
              onClick={() => onToggleWorker(row.worker.key)}
            >
              {isExpanded ? "Skjul oplysninger" : "Vis oplysninger"}
            </button>
            {isExpanded && (
              <WorkerDetails
                row={row}
                inactiveMode={inactiveMode}
                onInactivate={onInactivate}
                onRestore={onRestore}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

function WorkerDetails({
  row,
  inactiveMode,
  onInactivate,
  onRestore,
}: {
  row: WorkerRow;
  inactiveMode: boolean;
  onInactivate?: (worker: KnownWorker) => void;
  onRestore?: (worker: KnownWorker) => void;
}) {
  const [editing, setEditing] = useState(false);
  const timesheet = row.currentTimesheets[0];
  const assignment = row.assignments[0];
  const plannedAssignment = row.futureAssignments[0];
  const nextTimesheet = row.nextTimesheet;
  const hasActiveBooking = Boolean(timesheet || assignment);
  const hasFutureBooking = Boolean(plannedAssignment || nextTimesheet);
  const tradeSkills = row.worker.tradeSkills.length ? row.worker.tradeSkills.join(", ") : "—";
  const period =
    row.bookingStart || row.bookingEnd
      ? `${formatDate(row.bookingStart)} – ${formatDate(row.bookingEnd)}`
      : "—";

  return (
    <div className="mt-4 border-t pt-3">
      {editing ? (
        <WorkerEditForm worker={row.worker} onClose={() => setEditing(false)} />
      ) : (
        <>
          <dl className="text-sm">
            <DetailRow label="Vikar" value={row.worker.name || "—"} />
            <DetailRow label="Kode" value={row.worker.code || "—"} />
            <DetailRow label="Vikarens e-mail" value={row.worker.email || "—"} />
            <DetailRow label="Vikarens telefon" value={row.worker.phone || "—"} />
            <DetailRow label="Adresse" value={row.worker.address || "—"} />
            <DetailRow label="CPR-nr." value={row.worker.cpr || "—"} />
            <DetailRow
              label="Sprog"
              value={
                WORKER_LANGUAGES.find((item) => item.value === row.worker.language)?.label ||
                "Dansk"
              }
            />
            {hasActiveBooking ? (
              <>
                <DetailRow
                  label="Brugervirksomhed"
                  value={timesheet?.brugervirksomhed || assignment?.companyName || "—"}
                />
                <DetailRow
                  label="Projekt"
                  value={timesheet?.projectName || assignment?.projectName || "—"}
                />
                <DetailRow label="Kontaktperson" value={timesheet?.kontaktperson || "—"} />
                <DetailRow
                  label="Kontaktperson telefon"
                  value={timesheet?.kontaktpersonPhone || "—"}
                />
                <DetailRow label="Mail" value={timesheet?.kontaktpersonEmail || "—"} />
                <DetailRow label="Reference" value={timesheet?.referenceNo || "—"} />
                <DetailRow label="Arbejdssted" value={timesheet?.arbejdssted || "—"} />
                <DetailRow label="Periode" value={period} />
                <DetailRow label="Overenskomst" value={timesheet?.overenskomst || "—"} />
              </>
            ) : hasFutureBooking ? (
              <>
                <DetailRow label="Booking" value="Ikke aktiv endnu" />
                <DetailRow
                  label="Brugervirksomhed"
                  value={plannedAssignment?.companyName || nextTimesheet?.brugervirksomhed || "—"}
                />
                <DetailRow
                  label="Projekt"
                  value={plannedAssignment?.projectName || nextTimesheet?.projectName || "—"}
                />
                <DetailRow label="Periode" value={period} />
                <DetailRow label="Overenskomst" value={nextTimesheet?.overenskomst || "—"} />
              </>
            ) : (
              <DetailRow label="Booking" value="Ingen aktiv booking" />
            )}
            <DetailRow label="Fag" value={tradeSkills} />
            <DetailRow label="Kompetencer" value={row.worker.competencies || "—"} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {!inactiveMode && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Rediger vikar
              </Button>
            )}
            {inactiveMode ? (
              <Button size="sm" onClick={() => onRestore?.(row.worker)}>
                Læg tilbage i ledige vikarer
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => onInactivate?.(row.worker)}>
                Slet vikar
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type WorkerEditState = Pick<
  KnownWorker,
  | "name"
  | "code"
  | "email"
  | "phone"
  | "address"
  | "cpr"
  | "language"
  | "tradeSkills"
  | "competencies"
>;

function WorkerEditForm({ worker, onClose }: { worker: KnownWorker; onClose: () => void }) {
  const [form, setForm] = useState<WorkerEditState>({
    name: worker.name,
    code: worker.code,
    email: worker.email,
    phone: worker.phone,
    address: worker.address,
    cpr: worker.cpr,
    language: worker.language,
    tradeSkills: worker.tradeSkills,
    competencies: worker.competencies,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const update = (patch: Partial<WorkerEditState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const toggleSkill = (skill: TradeSkill, checked: boolean) => {
    update({
      tradeSkills: checked
        ? [...new Set([...form.tradeSkills, skill])]
        : form.tradeSkills.filter((item) => item !== skill),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!form.name.trim()) nextErrors.push("Vikarnavn mangler");
    if (!form.code.trim()) nextErrors.push("Kode mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      nextErrors.push("Vikarens mail mangler eller er ugyldig");
    if (!form.phone.trim()) nextErrors.push("Vikarens telefon mangler");
    if (!form.address.trim()) nextErrors.push("Adresse mangler");
    if (!form.cpr.trim()) nextErrors.push("CPR-nr. mangler");
    if (!form.tradeSkills.length) nextErrors.push("Vælg mindst ét fag for vikaren");
    if (!form.competencies.trim()) nextErrors.push("Kompetencer mangler");
    setErrors(nextErrors);
    if (nextErrors.length) return;

    updateKnownWorker(worker, form);
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          <div className="font-medium">Ret følgende:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <EditField label="Vikarnavn *">
          <Input
            required
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </EditField>
        <EditField label="Kode *">
          <Input
            required
            value={form.code}
            onChange={(event) => update({ code: event.target.value })}
          />
        </EditField>
        <EditField label="Vikarens mail *">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(event) => update({ email: event.target.value })}
          />
        </EditField>
        <EditField label="Vikarens telefon *">
          <Input
            required
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </EditField>
        <EditField label="Adresse *">
          <Input
            required
            value={form.address}
            onChange={(event) => update({ address: event.target.value })}
          />
        </EditField>
        <EditField label="CPR-nr. *">
          <Input
            required
            value={form.cpr}
            onChange={(event) => update({ cpr: event.target.value })}
          />
        </EditField>
        <EditField label="Sprog *">
          <select
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2"
            value={form.language}
            onChange={(event) => update({ language: event.target.value as WorkerLanguage })}
          >
            {WORKER_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </EditField>
        <div>
          <span className="mb-1.5 block font-medium">Vikarens fag *</span>
          <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3">
            {TRADE_SKILLS.map((skill) => (
              <label key={skill} className="inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={form.tradeSkills.includes(skill)}
                  onChange={(event) => toggleSkill(skill, event.target.checked)}
                />
                {skill}
              </label>
            ))}
          </div>
        </div>
        <EditField label="Kompetencer *" className="md:col-span-2">
          <textarea
            required
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2"
            value={form.competencies}
            onChange={(event) => update({ competencies: event.target.value })}
          />
        </EditField>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Annullér
        </Button>
        <Button type="submit" size="sm">
          Gem vikar
        </Button>
      </div>
    </form>
  );
}

function EditField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b py-2 last:border-b-0 sm:grid-cols-[11rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground sm:text-right">{value}</dd>
    </div>
  );
}

function buildWorkerRows(
  timesheets: Timesheet[],
  companies: Company[],
  options: { inactive?: boolean } = {},
): WorkerRow[] {
  const today = localISODate(new Date());
  const activeTimesheets = timesheets.filter(
    (item) =>
      !item.archived &&
      !item.workerInactive &&
      !item.workerConsentInactive &&
      (item.status !== "draft" || hasPlannedBooking(item)),
  );
  const knownWorkers = knownWorkersForOverview(timesheets, companies, options);

  return knownWorkers
    .map((worker) => {
      const assignments = currentProjectAssignments(worker, companies, today);
      const futureAssignments = futureProjectAssignments(worker, companies, today);
      const displayAssignments = [...assignments, ...futureAssignments];
      const workerTimesheets = activeTimesheets.filter((timesheet) =>
        workerMatchesTimesheet(worker, timesheet),
      );
      const currentTimesheets = workerTimesheets.filter((timesheet) =>
        isTimesheetBookingActiveToday(today, timesheet),
      );
      const nextTimesheet = nextFutureTimesheet(workerTimesheets, today);
      const nextBookingDate = nextBookingStartForWorker(futureAssignments, workerTimesheets, today);
      const booking = currentOrNextBooking(displayAssignments, workerTimesheets, today);
      const hasActiveBooking = assignments.length > 0 || currentTimesheets.length > 0;
      return {
        worker,
        assignments,
        futureAssignments,
        currentTimesheets,
        nextTimesheet,
        hasActiveBooking,
        nextBookingStart: nextBookingDate,
        bookingStart: booking.startDate,
        bookingEnd: booking.endDate,
      };
    })
    .sort(compareWorkerRowsByBookingStart);
}

function knownWorkersForOverview(
  timesheets: Timesheet[],
  _companies: Company[],
  options: { inactive?: boolean } = {},
): KnownWorker[] {
  if (options.inactive) {
    return knownWorkersIncludingInactiveFromTimesheets(timesheets).filter(
      (worker) => worker.inactive,
    );
  }
  return knownWorkersFromTimesheets(timesheets).filter((worker) => !worker.inactive);
}

function currentProjectAssignments(
  worker: KnownWorker,
  companies: Company[],
  today: string,
): Assignment[] {
  const assignments: Assignment[] = [];
  for (const company of companies) {
    for (const project of company.projects) {
      if (!isProjectBookingActiveToday(project, today)) continue;
      if (!projectHasWorker(project, worker)) continue;
      assignments.push({
        companyName: company.name,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
      });
    }
  }
  return assignments;
}

function futureProjectAssignments(
  worker: KnownWorker,
  companies: Company[],
  today: string,
): Assignment[] {
  const assignments: Assignment[] = [];

  for (const company of companies) {
    for (const project of company.projects) {
      if (!project.startDate || project.startDate <= today) continue;
      if (!projectHasWorker(project, worker)) continue;

      assignments.push({
        companyName: company.name,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
      });
    }
  }

  return assignments;
}

function nextFutureTimesheet(timesheets: Timesheet[], today: string): Timesheet | null {
  return (
    timesheets
      .filter((timesheet) => timesheet.weekStart && timesheet.weekStart > today)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0] ?? null
  );
}

function nextBookingStartForWorker(
  futureAssignments: Assignment[],
  timesheets: Timesheet[],
  today: string,
): string {
  const futureStarts = [
    ...futureAssignments.map((assignment) => assignment.startDate),
    ...futureTimesheetShiftDates(timesheets, today),
  ].filter(Boolean);

  return futureStarts.sort((a, b) => a.localeCompare(b))[0] ?? "";
}

function workerMatchesTimesheet(worker: KnownWorker, timesheet: Timesheet): boolean {
  const workerNameKey = normalizeReference(worker.name || worker.key);
  const timesheetNameKey = normalizeReference(timesheet.vikar);
  if (workerNameKey && timesheetNameKey) return workerNameKey === timesheetNameKey;

  const workerCodeKey = normalizeReference(worker.code);
  const timesheetCodeKey = normalizeReference(timesheet.vikarCode ?? "");
  if (workerCodeKey && timesheetCodeKey) return workerCodeKey === timesheetCodeKey;

  const workerEmailKey = normalizeReference(worker.email);
  const timesheetEmailKey = normalizeReference(timesheet.vikarEmail);
  return Boolean(workerEmailKey && timesheetEmailKey && workerEmailKey === timesheetEmailKey);
}

function hasPlannedBooking(timesheet: Timesheet): boolean {
  return Boolean(
    (timesheet.brugervirksomhed || timesheet.projectId || timesheet.projectName) &&
    timesheet.weekStart &&
    (timesheet.projectEndDate || timesheet.days.some((day) => day.start && day.end)),
  );
}

function isProjectBookingActiveToday(project: CompanyProject, today: string): boolean {
  return Boolean(
    project.startDate && project.endDate && project.startDate <= today && today <= project.endDate,
  );
}

function projectHasWorker(project: CompanyProject, worker: KnownWorker): boolean {
  const projectReferences = project.workerEmails.map((item) => normalizeReference(item));
  const workerNameKey = normalizeReference(worker.name || worker.key);
  const workerCodeKey = normalizeReference(worker.code);

  if (workerNameKey && projectReferences.includes(workerNameKey)) return true;
  if (workerCodeKey && projectReferences.includes(workerCodeKey)) return true;

  const workerEmailKey = normalizeReference(worker.email);
  return Boolean(
    !workerNameKey &&
    !workerCodeKey &&
    workerEmailKey &&
    projectReferences.includes(workerEmailKey),
  );
}

function normalizeReference(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTimesheetBookingActiveToday(today: string, timesheet: Timesheet): boolean {
  if (!timesheet.weekStart) return false;
  const endDate = timesheet.projectEndDate || addDays(timesheet.weekStart, 6);
  return timesheet.weekStart <= today && today <= endDate;
}

function futureTimesheetShiftDates(timesheets: Timesheet[], today: string): string[] {
  return timesheets.flatMap((timesheet) => {
    if (!timesheet.weekStart) return [];

    return timesheet.days
      .map((day, index) => ({
        date: addDays(timesheet.weekStart, index),
        hasShift: Boolean(day?.start && day?.end),
      }))
      .filter((item) => item.hasShift && item.date > today)
      .map((item) => item.date);
  });
}

function daysBetween(startIsoDate: string, endIsoDate: string): number {
  const start = new Date(`${startIsoDate}T12:00:00`);
  const end = new Date(`${endIsoDate}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentOrNextBooking(
  assignments: Assignment[],
  timesheets: Timesheet[],
  today: string,
): { startDate: string; endDate: string } {
  const periods = [
    ...assignments.map((assignment) => ({
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    })),
    ...timesheets.map((timesheet) => ({
      startDate: timesheet.weekStart,
      endDate: timesheet.projectEndDate || addDays(timesheet.weekStart, 6),
    })),
  ].filter((period) => period.startDate && period.endDate);

  const currentPeriod = periods
    .filter((period) => period.startDate <= today && today <= period.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .at(0);
  if (currentPeriod) return currentPeriod;

  const nextPeriod = periods
    .filter((period) => period.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(0);
  if (nextPeriod) return nextPeriod;

  return (
    periods
      .filter((period) => period.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .at(0) ?? {
      startDate: "",
      endDate: "",
    }
  );
}

function compareWorkerRowsByBookingStart(a: WorkerRow, b: WorkerRow): number {
  if (!a.bookingStart && b.bookingStart) return -1;
  if (a.bookingStart && !b.bookingStart) return 1;
  if (a.bookingStart && b.bookingStart && a.bookingStart !== b.bookingStart) {
    return b.bookingStart.localeCompare(a.bookingStart);
  }
  return a.worker.name.localeCompare(b.worker.name, "da-DK");
}

function compareAvailableWorkerRows(a: WorkerRow, b: WorkerRow): number {
  if (!a.nextBookingStart && b.nextBookingStart) return -1;
  if (a.nextBookingStart && !b.nextBookingStart) return 1;

  if (a.nextBookingStart && b.nextBookingStart && a.nextBookingStart !== b.nextBookingStart) {
    return b.nextBookingStart.localeCompare(a.nextBookingStart);
  }

  return a.worker.name.localeCompare(b.worker.name, "da-DK");
}

function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
