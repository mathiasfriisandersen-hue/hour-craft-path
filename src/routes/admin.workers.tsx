import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
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
  bookingStart: string;
  bookingEnd: string;
};

function WorkerOverview() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const rows = useMemo(() => buildWorkerRows(timesheets, companies), [timesheets, companies]);
  const working = rows.filter((row) => row.assignments.length || row.currentTimesheets.length);
  const available = rows.filter((row) => !row.assignments.length && !row.currentTimesheets.length);

  return (
    <AppShell allow={["admin", "bruger"]}>
      <div className="mb-6">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Timesedler
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Vikaroversigt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se hvilke aktive vikarer der er i arbejde, og hvilke der er ledige.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WorkerSection title="I arbejde" rows={working} emptyText="Ingen vikarer er i arbejde." />
        <WorkerSection title="Ledige" rows={available} emptyText="Ingen ledige vikarer fundet." />
      </div>
    </AppShell>
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
          {rows.map((row) => (
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
                  {row.worker.phone && <div className="mt-1">{row.worker.phone}</div>}
                </div>
              </div>
              {row.assignments.length > 0 && (
                <div className="mt-3 space-y-1.5 text-sm">
                  {row.assignments.map((assignment) => (
                    <div key={`${assignment.companyName}-${assignment.projectName}`}>
                      <span className="font-medium">{assignment.companyName}</span>
                      <span className="text-muted-foreground">
                        {" "} / {assignment.projectName || "Projekt"} ·{" "}
                        {formatDate(assignment.startDate)} –{" "}
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
            </article>
          ))}
        </div>
      )}
    </section>
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
  const knownWorkers = knownWorkersFromTimesheets(timesheets).filter((worker) =>
    activeTimesheets.some((timesheet) => workerMatchesTimesheet(worker, timesheet)),
  );

  return knownWorkers
    .map((worker) => {
      const assignments = activeProjectAssignments(worker, companies, today);
      const workerTimesheets = activeTimesheets.filter((timesheet) =>
        workerMatchesTimesheet(worker, timesheet),
      );
      const currentTimesheets = workerTimesheets.filter((timesheet) =>
        isDateInTimesheetWeek(today, timesheet),
      );
      const booking = latestBooking(assignments, workerTimesheets);
      return {
        worker,
        assignments,
        currentTimesheets,
        bookingStart: booking.startDate,
        bookingEnd: booking.endDate,
      };
    })
    .sort(compareWorkerRowsByBookingStart);
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

function isDateInTimesheetWeek(today: string, timesheet: Timesheet): boolean {
  if (!timesheet.weekStart) return false;
  const endDate = addDays(timesheet.weekStart, 6);
  return timesheet.weekStart <= today && today <= endDate;
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
