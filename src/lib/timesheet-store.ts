// Simple localStorage-backed store for timesheet MVP.
// All persistence is client-side for first version.

export type Status =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "reviewed";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Kladde",
  sent: "Sendt til godkendelse",
  approved: "Godkendt af kontaktperson",
  rejected: "Afvist af kontaktperson",
  reviewed: "Kontrolleret af admin",
};

export const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-status-draft text-status-draft-fg",
  sent: "bg-status-sent text-status-sent-fg",
  approved: "bg-status-approved text-status-approved-fg",
  rejected: "bg-status-rejected text-status-rejected-fg",
  reviewed: "bg-status-reviewed text-status-reviewed-fg",
};

export const OVERENSKOMSTER = [
  "Industriens Overenskomst",
  "Bygge- og Anlægsoverenskomsten",
  "Elektrikeroverenskomsten",
  "VVS-overenskomsten",
  "Maleroverenskomsten",
  "HK-industrioverenskomsten",
] as const;

export type DayEntry = {
  start: string; // "HH:MM"
  end: string;
  pause: number; // minutes
  comment: string;
};

export const WEEKDAYS = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;

export type Timesheet = {
  id: string;
  vikar: string;
  brugervirksomhed: string;
  kontaktperson: string;
  kontaktpersonEmail: string;
  arbejdssted: string;
  overenskomst: string;
  lokalaftale: boolean;
  weekStart: string; // ISO date of Monday
  days: DayEntry[]; // length 7
  status: Status;
  rejectionComment?: string;
  createdAt: string;
  updatedAt: string;
};

const KEY = "timesheets-v1";

export function emptyDay(): DayEntry {
  return { start: "", end: "", pause: 0, comment: "" };
}

export function getMondayISO(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 sun .. 6 sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(mondayISO: string): string {
  const m = new Date(mondayISO);
  const s = new Date(m);
  s.setDate(s.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("da-DK", { day: "2-digit", month: "short" });
  return `${fmt(m)} – ${fmt(s)}`;
}

export function weekNumber(mondayISO: string): number {
  const d = new Date(mondayISO);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function dayHours(day: DayEntry): number {
  if (!day.start || !day.end) return 0;
  const [sh, sm] = day.start.split(":").map(Number);
  const [eh, em] = day.end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const minutes = eh * 60 + em - (sh * 60 + sm) - (day.pause || 0);
  if (minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

export function totalHours(days: DayEntry[]): number {
  return Math.round(days.reduce((s, d) => s + dayHours(d), 0) * 100) / 100;
}

export function overtimeHours(days: DayEntry[]): number {
  const t = totalHours(days);
  return t > 37 ? Math.round((t - 37) * 100) / 100 : 0;
}

function read(): Timesheet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(list: Timesheet[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("timesheets-changed"));
}

export function listAll(): Timesheet[] {
  return read().sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export function getById(id: string): Timesheet | undefined {
  return read().find((t) => t.id === id);
}

export function upsert(t: Timesheet): Timesheet {
  const list = read();
  const idx = list.findIndex((x) => x.id === t.id);
  const updated = { ...t, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = updated;
  else list.push(updated);
  write(list);
  return updated;
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("timesheets-changed"));
}

export function remove(id: string): void {
  write(read().filter((t) => t.id !== id));
}



export function createBlank(): Timesheet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    vikar: "",
    brugervirksomhed: "",
    kontaktperson: "",
    kontaktpersonEmail: "",
    arbejdssted: "",
    overenskomst: "",
    lokalaftale: false,
    weekStart: getMondayISO(),
    days: Array.from({ length: 7 }, emptyDay),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function validate(t: Timesheet): string[] {
  const errs: string[] = [];
  if (!t.vikar.trim()) errs.push("Vikarnavn mangler");
  if (!t.brugervirksomhed.trim()) errs.push("Brugervirksomhed mangler");
  if (!t.kontaktperson.trim()) errs.push("Kontaktperson mangler");
  if (!t.kontaktpersonEmail.trim() || !/^\S+@\S+\.\S+$/.test(t.kontaktpersonEmail))
    errs.push("Kontaktpersonens mailadresse mangler");
  if (!t.arbejdssted.trim()) errs.push("Arbejdssted mangler");
  if (!t.overenskomst) errs.push("Vælg en overenskomst");
  t.days.forEach((d, i) => {
    if (d.start && d.end && d.start >= d.end)
      errs.push(`${WEEKDAYS[i]}: Starttid kan ikke være efter sluttid`);
    if (d.pause < 0) errs.push(`${WEEKDAYS[i]}: Pause kan ikke være negativ`);
  });
  return errs;
}

// Demo: seed one example so admin view isn't empty on first visit.
export function seedIfEmpty(): void {
  if (read().length > 0) return;
  const t = createBlank();
  t.vikar = "Anna Hansen";
  t.brugervirksomhed = "Nordic Production A/S";
  t.kontaktperson = "Peter Madsen";
  t.kontaktpersonEmail = "peter@nordic.dk";
  t.arbejdssted = "Industrivej 12, 2600 Glostrup";
  t.overenskomst = "Industriens Overenskomst";
  t.lokalaftale = false;
  t.days = [
    { start: "07:00", end: "15:30", pause: 30, comment: "" },
    { start: "07:00", end: "15:30", pause: 30, comment: "" },
    { start: "07:00", end: "16:00", pause: 30, comment: "Ekstra opgave" },
    { start: "07:00", end: "15:30", pause: 30, comment: "" },
    { start: "07:00", end: "15:30", pause: 30, comment: "" },
    { start: "", end: "", pause: 0, comment: "" },
    { start: "", end: "", pause: 0, comment: "" },
  ];
  t.status = "sent";
  upsert(t);
}
