import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  formatWeekRange,
  weekNumber,
  type DayEntry,
  type Timesheet,
} from "@/lib/timesheet-store";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/calendar")({
  head: () => ({ meta: [{ title: "Admin — Kalender" }] }),
  component: AdminCalendar,
});

type CalendarDay = {
  id: string;
  timesheet: Timesheet;
  day: DayEntry;
  date: string;
  dayName: string;
};

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function AdminCalendar() {
  const all = useTimesheets();
  const [worker, setWorker] = useState("all");
  const [company, setCompany] = useState("all");

  const activeTimesheets = useMemo(
    () =>
      all.filter(
        (item) =>
          item.status !== "draft" &&
          !item.archived &&
          !item.workerInactive &&
          !item.workerConsentInactive,
      ),
    [all],
  );

  const workers = useMemo(
    () =>
      [...new Set(activeTimesheets.map((item) => item.vikar).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "da-DK"),
      ),
    [activeTimesheets],
  );

  const companies = useMemo(
    () =>
      [...new Set(activeTimesheets.map((item) => item.brugervirksomhed).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "da-DK"),
      ),
    [activeTimesheets],
  );

  const days = useMemo(
    () =>
      activeTimesheets
        .filter(
          (item) =>
            (worker === "all" || item.vikar === worker) &&
            (company === "all" || item.brugervirksomhed === company),
        )
        .flatMap((timesheet) => plannedDays(timesheet))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.timesheet.vikar.localeCompare(b.timesheet.vikar),
        ),
    [activeTimesheets, worker, company],
  );

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Se hvilke vikarer der er planlagt hos hvilke virksomheder.
          </p>
        </div>
      </div>

      <section className="mb-5 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Vikarer</span>
            <select
              className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
              value={worker}
              onChange={(event) => setWorker(event.target.value)}
            >
              <option value="all">Alle vikarer</option>
              {workers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Virksomheder</span>
            <select
              className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            >
              <option value="all">Alle virksomheder</option>
              {companies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {days.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen planlagte vagter matcher filtrene.
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((item) => (
            <article
              key={item.id}
              className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(120px,0.8fr)_minmax(180px,1.2fr)_minmax(180px,1.2fr)_minmax(140px,0.8fr)_auto] md:items-center"
            >
              <div>
                <div className="font-medium">{item.dayName}</div>
                <div className="text-sm text-muted-foreground">{formatDate(item.date)}</div>
              </div>
              <div>
                <div className="font-medium">{item.timesheet.vikar || "—"}</div>
                <div className="text-sm text-muted-foreground">
                  Uge {weekNumber(item.timesheet.weekStart)} ·{" "}
                  {formatWeekRange(item.timesheet.weekStart)}
                </div>
              </div>
              <div>
                <div className="font-medium">{item.timesheet.brugervirksomhed || "—"}</div>
                <div className="text-sm text-muted-foreground">
                  {item.timesheet.projectName || item.timesheet.arbejdssted || "—"}
                </div>
              </div>
              <div className="text-sm">
                <div>
                  {item.day.start} – {item.day.end}
                </div>
                <div className="text-muted-foreground">Pause {item.day.pause || 0} min.</div>
              </div>
              <Link
                to="/admin/$id"
                params={{ id: item.timesheet.id }}
                className="font-medium text-primary hover:underline md:text-right"
              >
                Åbn →
              </Link>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function plannedDays(timesheet: Timesheet): CalendarDay[] {
  return timesheet.days.flatMap((day, index) => {
    if (day.absence !== "none" || !day.start || !day.end) return [];
    return [
      {
        id: `${timesheet.id}-${index}`,
        timesheet,
        day,
        date: addDays(timesheet.weekStart, index),
        dayName: DAY_NAMES[index] ?? "",
      },
    ];
  });
}

function addDays(mondayISO: string, days: number): string {
  const date = new Date(`${mondayISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
