import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { timesheetsVisibleForRole } from "@/lib/company-access";
import { useAuth } from "@/lib/auth";
import { useTimesheets } from "@/lib/use-timesheets";
import { listCompanies, type DayEntry, type Timesheet } from "@/lib/timesheet-store";
import { useEffect, useMemo, useState } from "react";

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
  const { role } = useAuth();
  const all = useTimesheets();
  const [companiesList, setCompaniesList] = useState(listCompanies);
  const [worker, setWorker] = useState("all");
  const [company, setCompany] = useState("all");
  const [month, setMonth] = useState(() => monthKey(new Date()));

  useEffect(() => {
    const refresh = () => setCompaniesList(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const visibleTimesheets = useMemo(
    () => timesheetsVisibleForRole(all, role, companiesList),
    [all, role, companiesList],
  );

  const activeTimesheets = useMemo(
    () =>
      visibleTimesheets.filter(
        (item) =>
          item.status !== "draft" &&
          !item.archived &&
          !item.workerInactive &&
          !item.workerConsentInactive,
      ),
    [visibleTimesheets],
  );

  const workers = useMemo(
    () =>
      [
        ...new Set(
          activeTimesheets
            .filter(
              (item) =>
                (company === "all" || item.brugervirksomhed === company) &&
                plannedDays(item).length > 0,
            )
            .map((item) => item.vikar)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "da-DK")),
    [activeTimesheets, company],
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

  useEffect(() => {
    if (worker !== "all" && !workers.includes(worker)) setWorker("all");
  }, [worker, workers]);

  const monthCells = useMemo(() => buildMonth(month, days), [month, days]);
  const currentMonthLabel = useMemo(() => formatMonth(month), [month]);

  return (
    <AppShell
      allow={["admin", "bruger", "bruger2"]}
      dashboard={{
        title: "Kalender",
        subtitle: "Se hvilke vikarer der er planlagt hos hvilke virksomheder.",
      }}
    >
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-slate-950">Vikarer</span>
            <select
              className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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

          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-slate-950">Virksomheder</span>
            <select
              className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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

          <div className="grid gap-2 text-sm">
            <span className="font-semibold text-slate-950">Måned</span>
            <div className="flex h-11 items-center justify-between overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                className="grid h-full w-12 place-items-center border-r border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
                aria-label="Forrige måned"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-32 flex-1 px-3 text-center text-sm font-semibold capitalize text-slate-950">
                {currentMonthLabel}
              </div>
              <button
                type="button"
                className="grid h-full w-12 place-items-center border-l border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
                aria-label="Næste måned"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="grid min-w-[920px] grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {WEEK_DAY_LABELS.map((label) => (
              <div key={label} className="px-4 py-3 text-center">
                {label}
              </div>
            ))}
          </div>
          <div className="grid min-w-[920px] grid-cols-7">
            {monthCells.map((cell) => (
              <div
                key={cell.date}
                className={
                  cell.inMonth
                    ? "min-h-36 border-b border-r border-slate-200 bg-white p-3"
                    : "min-h-36 border-b border-r border-slate-200 bg-slate-50/80 p-3 text-slate-400"
                }
              >
                <div className="mb-2 text-sm font-semibold text-slate-950">{cell.dayOfMonth}</div>
                <div className="space-y-2">
                  {cell.shifts.map((item) => (
                    <Link
                      key={item.id}
                      to="/admin/$id"
                      params={{ id: item.timesheet.id }}
                      className="block rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-100"
                    >
                      <div className="truncate font-semibold text-blue-800">
                        {item.timesheet.vikar || "—"}
                      </div>
                      <div className="mt-1 truncate text-slate-600">
                        {item.day.start}–{item.day.end} · {item.timesheet.brugervirksomhed || "—"}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
