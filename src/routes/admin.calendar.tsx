import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import { type DayEntry, type Timesheet } from "@/lib/timesheet-store";
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
};

type MonthCell = {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  shifts: CalendarDay[];
};

const WEEK_DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function AdminCalendar() {
  const all = useTimesheets();
  const [worker, setWorker] = useState("all");
  const [company, setCompany] = useState("all");
  const [month, setMonth] = useState(() => monthKey(new Date()));

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

  const monthCells = useMemo(() => buildMonth(month, days), [month, days]);
  const currentMonthLabel = useMemo(() => formatMonth(month), [month]);

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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
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

          <div className="grid gap-1 text-sm">
            <span className="font-medium">Måned</span>
            <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-2">
              <button
                type="button"
                className="rounded px-2 py-1 text-sm font-medium hover:bg-accent"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                ←
              </button>
              <div className="min-w-32 text-center text-sm font-medium">{currentMonthLabel}</div>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm font-medium hover:bg-accent"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="grid min-w-[860px] grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          {WEEK_DAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid min-w-[860px] grid-cols-7">
          {monthCells.map((cell) => (
            <div
              key={cell.date}
              className={
                cell.inMonth
                  ? "min-h-36 border-b border-r p-2"
                  : "min-h-36 border-b border-r bg-muted/25 p-2 text-muted-foreground"
              }
            >
              <div className="mb-2 text-xs font-medium">{cell.dayOfMonth}</div>
              <div className="space-y-1.5">
                {cell.shifts.map((item) => (
                  <Link
                    key={item.id}
                    to="/admin/$id"
                    params={{ id: item.timesheet.id }}
                    className="block rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                  >
                    <div className="truncate font-medium">{item.timesheet.vikar || "—"}</div>
                    <div className="truncate text-muted-foreground">
                      {item.day.start}–{item.day.end} · {item.timesheet.brugervirksomhed || "—"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
      },
    ];
  });
}

function addDays(mondayISO: string, days: number): string {
  const date = new Date(`${mondayISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1, 12);
  return monthKey(date);
}

function formatMonth(value: string): string {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("da-DK", {
    month: "long",
    year: "numeric",
  });
}

function buildMonth(month: string, days: CalendarDay[]): MonthCell[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const daysByDate = new Map<string, CalendarDay[]>();
  for (const day of days) {
    daysByDate.set(day.date, [...(daysByDate.get(day.date) ?? []), day]);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === monthNumber - 1,
      shifts: daysByDate.get(iso) ?? [],
    };
  });
}
