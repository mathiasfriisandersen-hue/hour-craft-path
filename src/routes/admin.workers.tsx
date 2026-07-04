import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { Role } from "@/lib/auth";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  knownWorkersFromTimesheets,
  listCompanies,
  workerReferenceKeys,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
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
  currentTimesheets: Timesheet[];
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

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const rows = useMemo(() => buildWorkerRows(timesheets, companies), [timesheets, companies]);

  const working = rows.filter((row) => row.hasActiveBooking);
  const available = rows.filter((row) => !row.hasActiveBooking).sort(compareAvailableWorkerRows);

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
        <WorkerSection title="I arbejde" rows={working} emptyText="Ingen vikarer er i arbejde." />
        <WorkerSection title="Ledige" rows={available} emptyText="Ingen ledige vikarer fundet." />
      </div>
    </>
  );
}

function WorkerSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: WorkerRow[];
  emptyText: string;
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
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">
          {title} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{emptyText}</div>
      ) : (
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
                          / {assignment.projectName || "Projekt"} ·{" "}
                          {formatDate(assignment.startDate)} – {formatDate(assignment.endDate)}
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
                  onClick={() => toggleWorker(row.worker.key)}
                >
                  {isExpanded ? "Skjul oplysninger" : "Vis oplysninger"}
                </button>
                {isExpanded && <WorkerDetails row={row} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WorkerDetails({ row }: { row: WorkerRow }) {
  const timesheet = row.currentTimesheets[0];
  const assignment = row.assignments[0];
  const hasActiveBooking = Boolean(timesheet || assignment);
  const tradeSkills = row.worker.tradeSkills.length ? row.worker.tradeSkills.join(", ") : "—";
  const period =
    row.bookingStart || row.bookingEnd
      ? `${formatDate(row.bookingStart)} – ${formatDate(row.bookingEnd)}`
      : "—";

  return (
    <dl className="mt-4 border-t pt-3 text-sm">
      <DetailRow label="Vikar" value={row.worker.name || "—"} />
      <DetailRow label="Vikarens e-mail" value={row.worker.email || "—"} />
      <DetailRow label="Vikarens telefon" value={row.worker.phone || "—"} />
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
          <DetailRow label="Kontaktperson telefon" value={timesheet?.kontaktpersonPhone || "—"} />
          <DetailRow label="Mail" value={timesheet?.kontaktpersonEmail || "—"} />
          <DetailRow label="Reference" value={timesheet?.referenceNo || "—"} />
          <DetailRow label="Arbejdssted" value={timesheet?.arbejdssted || "—"} />
          <DetailRow label="Periode" value={period} />
          <DetailRow label="Overenskomst" value={timesheet?.overenskomst || "—"} />
        </>
      ) : (
        <DetailRow label="Booking" value="Ingen aktiv booking" />
      )}
      <DetailRow label="Fag" value={tradeSkills} />
      <DetailRow label="Kompetencer" value={row.worker.competencies || "—"} />
    </dl>
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

function buildWorkerRows(timesheets: Timesheet[], companies: Company[]): WorkerRow[] {
  const today = localISODate(new Date());
  const activeTimesheets = timesheets.filter(
    (item) =>
      item.status !== "draft" &&
      !item.archived &&
      !item.workerInactive &&
      !item.workerConsentInactive,
  );
  const knownWorkers = knownWorkersForOverview(timesheets, companies);

  return knownWorkers
    .map((worker) => {
      const assignments = activeProjectAssignments(worker, companies, today);
      const futureAssignments = futureProjectAssignments(worker, companies, today);
      const workerTimesheets = activeTimesheets.filter((timesheet) =>
        workerMatchesTimesheet(worker, timesheet),
      );
      const hasActiveBooking =
        assignments.length > 0 ||
        workerTimesheets.some((timesheet) => isTimesheetBookingActive(today, timesheet));
      const currentTimesheets = workerTimesheets.filter((timesheet) =>
        isTimesheetShiftToday(today, timesheet),
      );
      const nextBookingDate = nextBookingStartForWorker(futureAssignments, workerTimesheets, today);
      const booking = latestBooking(assignments, workerTimesheets);
      return {
        worker,
        assignments,
        currentTimesheets,
        hasActiveBooking,
        nextBookingStart: nextBookingDate,
        bookingStart: booking.startDate,
        bookingEnd: booking.endDate,
      };
    })
    .sort(compareWorkerRowsByBookingStart);
}

function knownWorkersForOverview(timesheets: Timesheet[], companies: Company[]): KnownWorker[] {
  const workers = [...knownWorkersFromTimesheets(timesheets)];
  for (const company of companies) {
    for (const project of company.projects) {
      for (const reference of project.workerEmails) {
        const key = reference.trim().toLowerCase();
        if (!key) continue;
        if (workers.some((worker) => workerReferenceKeys(worker).includes(key))) continue;
        workers.push({
          key,
          name: reference.trim(),
          email: reference.includes("@") ? reference.trim() : "",
          phone: "",
          tradeSkills: project.tradeSkills,
          competencies: project.competencies,
          inactive: false,
        });
      }
    }
  }
  return workers.filter((worker) => !worker.inactive);
}

function activeProjectAssignments(
  worker: KnownWorker,
  companies: Company[],
  today: string,
): Assignment[] {
  const references = workerReferenceKeys(worker);
  const assignments: Assignment[] = [];
  for (const company of companies) {
    for (const project of company.projects) {
      if (!isActiveProject(project, today)) continue;
      if (!project.workerEmails.some((item) => references.includes(item.toLowerCase()))) continue;
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
  const references = workerReferenceKeys(worker);
  const assignments: Assignment[] = [];

  for (const company of companies) {
    for (const project of company.projects) {
      if (!project.startDate || project.startDate <= today) continue;
      if (!project.workerEmails.some((item) => references.includes(item.toLowerCase()))) continue;

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
  const references = workerReferenceKeys(worker);
  return [timesheet.vikar, timesheet.vikarEmail]
    .map((item) => item.trim().toLowerCase())
    .some((item) => references.includes(item));
}

function isActiveProject(project: CompanyProject, today: string): boolean {
  return Boolean(
    project.startDate && project.endDate && project.startDate <= today && today <= project.endDate,
  );
}

function isTimesheetShiftToday(today: string, timesheet: Timesheet): boolean {
  if (!timesheet.weekStart) return false;

  const dayIndex = daysBetween(timesheet.weekStart, today);
  if (dayIndex < 0 || dayIndex >= timesheet.days.length) return false;

  const day = timesheet.days[dayIndex];
  return Boolean(day?.start && day?.end);
}

function isTimesheetBookingActive(today: string, timesheet: Timesheet): boolean {
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

function latestBooking(
  assignments: Assignment[],
  timesheets: Timesheet[],
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
  return (
    periods.sort((a, b) => b.startDate.localeCompare(a.startDate)).at(0) ?? {
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
