import {
  activeCollectiveAgreements,
  collectiveAgreements,
  getCollectiveAgreementById,
  getCollectiveAgreementByName,
} from "./collectiveAgreements";
import {
  AGREEMENT_RULE_SOURCE_LABEL,
  defaultAgreementRules,
  type AgreementRule,
  type AgreementRuleSource,
  type AgreementRuleSourceKey,
} from "./agreementRules";
import {
  getAgreementValidationReport,
  getFailingValidationTests,
  getMissingValidationRules,
  getRulesNeedingManualReview,
} from "./agreementValidation";
import { addDaysToISODate, getDanishAgreementHolidayName } from "./danishHolidays";
import { calculateTimesheetSummary } from "./timesheetCalculationService";

export type Status = "draft" | "sent" | "approved" | "rejected";
export type WorkerLanguage = "da" | "en" | "pl";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Kladde",
  sent: "Sendt",
  approved: "Godkendt",
  rejected: "Afvist",
};

export const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-status-draft text-status-draft-fg",
  sent: "bg-status-sent text-status-sent-fg",
  approved: "bg-status-approved text-status-approved-fg",
  rejected: "bg-status-rejected text-status-rejected-fg",
};

export const OVERENSKOMSTER = collectiveAgreements.map((agreement) => agreement.name);

export const WORKER_LANGUAGES: Array<{ value: WorkerLanguage; label: string }> = [
  { value: "da", label: "Dansk" },
  { value: "en", label: "Engelsk" },
  { value: "pl", label: "Polsk" },
];

export const WEEKDAYS = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;

export const TRADE_SKILLS = [
  "Industri / produktion",
  "Montage",
  "Smed / metal",
  "Svejser",
  "CNC / maskinarbejde",
  "Træ / møbel",
  "Tømrer / snedker",
  "Byggeri / håndværk",
  "Anlæg",
  "Jord / beton",
  "Murer",
  "Murerarbejdsmand",
  "Isolering",
  "Maler",
  "Elektriker",
  "El-installation",
  "VVS",
  "Blikkenslager",
  "Ufaglært / specialarbejder",
] as const;

export type TradeSkill = (typeof TRADE_SKILLS)[number];
export type WorkPeriod = "day" | "evening" | "night";

export type AbsenceType = "none" | "sick" | "vacation" | "dayoff";
export type WorkType =
  | "normal"
  | "overtime"
  | "displaced_work_time"
  | "weekend_work_agreement"
  | "shift_work";
export type DayType =
  | "ordinary_weekday"
  | "saturday_rest_day"
  | "sunday_or_public_holiday"
  | "contractual_day_off";

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  none: "Arbejdsdag",
  sick: "Sygdom",
  vacation: "Ferie",
  dayoff: "Fridag",
};

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  normal: "Normal arbejdstid",
  overtime: "Overarbejde",
  displaced_work_time: "Forskudt arbejdstid",
  weekend_work_agreement: "Weekendarbejde efter lokalaftale",
  shift_work: "Skiftehold",
};

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  ordinary_weekday: "Almindelig hverdag",
  saturday_rest_day: "Lørdag / hverdagsfridag",
  sunday_or_public_holiday: "Søndag eller helligdag",
  contractual_day_off: "Overenskomstmæssig fridag",
};

export type DayEntry = {
  start: string;
  end: string;
  pause: number;
  pauseStart: string;
  pauseEnd: string;
  pause2Start: string;
  pause2End: string;
  dayWorkStart: string;
  dayWorkEnd: string;
  eveningWorkStart: string;
  eveningWorkEnd: string;
  nightWorkStart: string;
  nightWorkEnd: string;
  workType: WorkType;
  dayType: DayType;
  isArtificialHolidayTest: boolean;
  localAgreementApplies: boolean;
  weekendAgreementApplies: boolean;
  wasInstructedToWorkDuringMealBreak: boolean;
  mealBreakPostponedMoreThan30Min: boolean;
  delayedMealBreakCompensation: boolean;
  taskType: string;
  comment: string;
  absence: AbsenceType;
  shiftWork: boolean;
};

export type DayRuleMarker = {
  dayName: string;
  date: string;
  paidHours: number;
  dayType: DayType;
  workType: WorkType;
  crossesMidnight: boolean;
  dateSegments: string[];
  ruleAreas: string[];
  warnings: string[];
  delayedMealBreakStatus: string;
  shiftStatus: string;
  weekendAgreementStatus: string;
  requiresManualValidation: string[];
};

export type Timesheet = {
  id: string;
  ownerRole?: "bruger" | "bruger2";
  vikar: string;
  vikarCode?: string;
  vikarEmail: string;
  vikarPhone?: string;
  vikarAddress?: string;
  vikarCpr?: string;
  workerLanguage?: WorkerLanguage;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  brugervirksomhed: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  projectEndDate?: string;
  kontaktperson: string;
  kontaktpersonPhone: string;
  kontaktpersonEmail: string;
  contactPersonAccessCode?: string;
  contactPersonMustChangeAccessCode?: boolean;
  referenceNo: string;
  arbejdssted: string;
  selectedAgreementId: string;
  overenskomst?: string;
  hourlyWage: number;
  workerAccessCode?: string;
  workerMustChangeAccessCode?: boolean;
  localAgreementApplies: boolean;
  lokalaftale?: boolean;
  localAgreementId?: string;
  weekStart: string;
  days: DayEntry[];
  notes: string;
  status: Status;
  archived?: boolean;
  workerInactive?: boolean;
  workerConsentInactive?: boolean;
  workerConsentRenewalSentAt?: string;
  workerConsentRenewedAt?: string;
  invoiceDueDate?: string;
  payrollDeadline?: string;
  invoiceNumber?: string;
  rejectionComment?: string;
  createdAt: string;
  updatedAt: string;
};

export type Company = {
  id: string;
  name: string;
  ownerRole?: "bruger" | "bruger2";
  cvrNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  selectedAgreementId?: string;
  localAgreements: LocalAgreement[];
  projects: CompanyProject[];
};

export type CompanyProject = {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  referenceNo: string;
  startDate: string;
  endDate: string;
  selectedAgreementId: string;
  tradeSkills: TradeSkill[];
  competencies: string;
  workerEmails: string[];
  workPeriod: WorkPeriod;
  defaultStart: string;
  defaultEnd: string;
  pauseStart: string;
  pauseEnd: string;
  pause2Start: string;
  pause2End: string;
  billingHourlyWage: number;
  billingFactor: number;
};

export type LocalAgreement = {
  id: string;
  name: string;
  description: string;
  validFrom: string;
  validTo: string;
};

export type CalculationResult = {
  total: number;
  agreementId: string;
  agreementName: string;
  agreementCategory: string;
  industryArea: string;
  pdfUrl?: string;
  pdfFileName?: string;
  rateValidationStatus: string;
  canCalculateRatesAutomatically: boolean;
  validationNote: string;
  normal: number;
  overtime: number;
  saturday: number;
  sunday: number;
  publicHoliday: number;
  weekend: number;
  evening: number;
  night: number;
  shift: number;
  delayedMealBreakDays: number;
  delayedMealBreakAmount: number;
  localAgreement: number;
  missingRules: string[];
  dayRuleMarkers: DayRuleMarker[];
  manualValidationMessages: string[];
};

const TIMESHEET_KEY = "timesheets-v1";
const RULE_KEY = "timesheet-rules-v1";
const COMPANY_KEY = "timesheet-companies-v1";
const APP_STATE_META_KEY = "timesheet-app-state-updated-at-v1";
const DELETED_TIMESHEET_IDS_KEY = "timesheet-deleted-timesheet-ids-v1";
const DELETED_COMPANY_IDS_KEY = "timesheet-deleted-company-ids-v1";
export const INDUSTRIENS_AGREEMENT_ID = "industriens-overenskomst";
export const DELAYED_MEAL_BREAK_RATE_DKK = 34.05;

function defaultDayType(index = 0): DayType {
  if (index === 5) return "saturday_rest_day";
  if (index === 6) return "sunday_or_public_holiday";
  return "ordinary_weekday";
}

export function emptyDay(index = 0): DayEntry {
  return {
    start: "",
    end: "",
    pause: 0,
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
    workType: "normal",
    dayType: defaultDayType(index),
    isArtificialHolidayTest: false,
    localAgreementApplies: false,
    weekendAgreementApplies: false,
    wasInstructedToWorkDuringMealBreak: false,
    mealBreakPostponedMoreThan30Min: false,
    delayedMealBreakCompensation: false,
    taskType: "",
    comment: "",
    absence: "none",
    shiftWork: false,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatDkk(value: number): string {
  return `${round(value).toLocaleString("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DKK`;
}

function normalizeDay(value: Partial<DayEntry> | undefined, index = 0): DayEntry {
  const base = emptyDay(index);
  const migratedMealBreak = Boolean(value?.delayedMealBreakCompensation);
  const workType: WorkType = value?.workType ?? (value?.shiftWork ? "shift_work" : base.workType);
  const weekendAgreementApplies =
    value?.weekendAgreementApplies ?? workType === "weekend_work_agreement";
  return {
    ...base,
    ...value,
    workType,
    dayType: value?.dayType ?? defaultDayType(index),
    weekendAgreementApplies,
    wasInstructedToWorkDuringMealBreak:
      value?.wasInstructedToWorkDuringMealBreak ?? migratedMealBreak,
    mealBreakPostponedMoreThan30Min: value?.mealBreakPostponedMoreThan30Min ?? migratedMealBreak,
    delayedMealBreakCompensation:
      value?.delayedMealBreakCompensation ??
      Boolean(value?.wasInstructedToWorkDuringMealBreak && value?.mealBreakPostponedMoreThan30Min),
    shiftWork: workType === "shift_work",
  };
}

export function isIndustriensAgreement(agreementId: string): boolean {
  return agreementId === INDUSTRIENS_AGREEMENT_ID;
}

export function delayedMealBreakDaysForTimesheet(
  t: Pick<Timesheet, "selectedAgreementId" | "days">,
): number {
  if (!isIndustriensAgreement(t.selectedAgreementId)) return 0;
  return t.days.filter(
    (day) =>
      day.absence === "none" &&
      Boolean(day.wasInstructedToWorkDuringMealBreak) &&
      Boolean(day.mealBreakPostponedMoreThan30Min),
  ).length;
}

export function delayedMealBreakAmountForDays(days: number): number {
  return round(days * DELAYED_MEAL_BREAK_RATE_DKK);
}

export function delayedMealBreakCalculationText(days: number): string {
  return `${days} ${days === 1 ? "dag" : "dage"} x ${formatDkk(
    DELAYED_MEAL_BREAK_RATE_DKK,
  )} = ${formatDkk(delayedMealBreakAmountForDays(days))}`;
}

export function delayedMealBreakSummaryText(days: number): string {
  return `Udsat spisepause: ${delayedMealBreakCalculationText(days)}`;
}

type StoredTimesheet = Omit<
  Timesheet,
  "status" | "selectedAgreementId" | "localAgreementApplies"
> & {
  status?: string;
  selectedAgreementId?: string;
  localAgreementApplies?: boolean;
  overenskomst?: string;
  lokalaftale?: boolean;
  vikarEmail?: string;
  vikarCode?: string;
  vikarPhone?: string;
  vikarAddress?: string;
  vikarCpr?: string;
  workerLanguage?: WorkerLanguage;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  projectEndDate?: string;
  kontaktpersonPhone?: string;
  contactPersonAccessCode?: string;
  contactPersonMustChangeAccessCode?: boolean;
  hourlyWage?: number;
  workerAccessCode?: string;
  workerMustChangeAccessCode?: boolean;
  archived?: boolean;
  workerInactive?: boolean;
  workerConsentInactive?: boolean;
  workerConsentRenewalSentAt?: string;
  workerConsentRenewedAt?: string;
  invoiceDueDate?: string;
  payrollDeadline?: string;
  invoiceNumber?: string;
  notes?: string;
};

type StoredCompany = Omit<Company, "projects"> & {
  selectedAgreementId?: string;
  projects?: CompanyProject[];
};

function normalizeTradeSkills(value: unknown): TradeSkill[] {
  if (!Array.isArray(value)) return [];
  return value.filter((skill): skill is TradeSkill =>
    (TRADE_SKILLS as readonly string[]).includes(String(skill)),
  );
}

function normalizeWorkPeriod(value: unknown): WorkPeriod {
  return value === "evening" || value === "night" ? value : "day";
}

function normalizeOwnerRole(value: unknown): "bruger" | "bruger2" | undefined {
  return value === "bruger" || value === "bruger2" ? value : undefined;
}

function normalizeWorkerLanguage(value: unknown): WorkerLanguage {
  return value === "en" || value === "pl" ? value : "da";
}

function defaultTimesForWorkPeriod(workPeriod: WorkPeriod): { start: string; end: string } {
  if (workPeriod === "evening") return { start: "14:00", end: "23:00" };
  if (workPeriod === "night") return { start: "22:00", end: "07:00" };
  return { start: "07:00", end: "15:00" };
}

function normalizeProject(project: Partial<CompanyProject>): CompanyProject {
  const workPeriod = normalizeWorkPeriod(project.workPeriod);
  const defaults = defaultTimesForWorkPeriod(workPeriod);
  return {
    id: project.id || crypto.randomUUID(),
    name: project.name ?? "",
    contactName: project.contactName ?? "",
    contactPhone: project.contactPhone ?? "",
    contactEmail: project.contactEmail ?? "",
    referenceNo: project.referenceNo ?? "",
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    selectedAgreementId: project.selectedAgreementId ?? "",
    tradeSkills: normalizeTradeSkills(project.tradeSkills),
    competencies: project.competencies ?? "",
    workerEmails: Array.isArray(project.workerEmails)
      ? [...new Set(project.workerEmails.filter(Boolean))]
      : [],
    workPeriod,
    defaultStart: project.defaultStart || defaults.start,
    defaultEnd: project.defaultEnd || defaults.end,
    pauseStart: project.pauseStart ?? "",
    pauseEnd: project.pauseEnd ?? "",
    pause2Start: project.pause2Start ?? "",
    pause2End: project.pause2End ?? "",
    billingHourlyWage: Number(project.billingHourlyWage) || 0,
    billingFactor: Number(project.billingFactor) || 0,
  };
}

function normalizeCompany(company: StoredCompany): Company {
  const ownerRole = normalizeOwnerRole(company.ownerRole);
  return {
    ...company,
    ownerRole,
    cvrNumber: company.cvrNumber ?? "",
    contactPhone: company.contactPhone ?? "",
    selectedAgreementId: company.selectedAgreementId ?? "",
    localAgreements: company.localAgreements ?? [],
    projects: (company.projects ?? []).map(normalizeProject),
  };
}

function normalizeWorkerPhone(value: StoredTimesheet | CreateWorkerTimesheetInput): string {
  const record = value as Record<string, unknown>;
  const phone =
    value.vikarPhone ??
    record.vikarTelefon ??
    record.workerPhone ??
    record.telefon ??
    record.phone ??
    record.mobil ??
    record.mobile ??
    "";
  return typeof phone === "string" ? phone.trim() : "";
}

function normalizeTimesheet(value: StoredTimesheet): Timesheet {
  const now = new Date().toISOString();
  const days = Array.from({ length: 7 }, (_, index) => normalizeDay(value.days?.[index], index));
  const migratedAgreementId =
    value.selectedAgreementId || getCollectiveAgreementByName(value.overenskomst ?? "")?.id || "";
  const agreementName =
    getCollectiveAgreementById(migratedAgreementId)?.name ?? value.overenskomst ?? "";
  const localAgreementApplies = value.localAgreementApplies ?? value.lokalaftale ?? false;
  return {
    ...value,
    ownerRole: normalizeOwnerRole(value.ownerRole),
    vikarCode: value.vikarCode ?? "",
    vikarEmail: value.vikarEmail ?? "",
    vikarPhone: normalizeWorkerPhone(value),
    vikarAddress: value.vikarAddress ?? "",
    vikarCpr: value.vikarCpr ?? "",
    workerLanguage: normalizeWorkerLanguage(value.workerLanguage),
    tradeSkills: normalizeTradeSkills(value.tradeSkills),
    competencies: value.competencies ?? "",
    companyId: value.companyId ?? "",
    projectId: value.projectId ?? "",
    projectName: value.projectName ?? "",
    projectEndDate: value.projectEndDate ?? "",
    kontaktpersonPhone: value.kontaktpersonPhone ?? "",
    contactPersonAccessCode: value.contactPersonAccessCode,
    contactPersonMustChangeAccessCode: value.contactPersonMustChangeAccessCode ?? false,
    referenceNo: value.referenceNo ?? "",
    hourlyWage: Number(value.hourlyWage) || 0,
    workerAccessCode: value.workerAccessCode,
    workerMustChangeAccessCode: value.workerMustChangeAccessCode ?? false,
    selectedAgreementId: migratedAgreementId,
    overenskomst: agreementName,
    localAgreementApplies,
    lokalaftale: localAgreementApplies,
    notes: value.notes ?? "",
    status: value.status === "reviewed" ? "approved" : (value.status as Status),
    archived: value.archived ?? false,
    workerInactive: value.workerInactive ?? false,
    workerConsentInactive: value.workerConsentInactive ?? false,
    workerConsentRenewalSentAt: value.workerConsentRenewalSentAt ?? "",
    workerConsentRenewedAt: value.workerConsentRenewedAt ?? "",
    invoiceDueDate: value.invoiceDueDate ?? "",
    payrollDeadline: value.payrollDeadline ?? "",
    invoiceNumber: value.invoiceNumber ?? "",
    days,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now,
  };
}

export function getMondayISO(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return localISODate(date);
}

function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWeekRange(mondayISO: string): string {
  const monday = new Date(`${mondayISO}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("da-DK", { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function formatDateLabel(isoDate: string): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function weekNumber(mondayISO: string): number {
  const d = new Date(`${mondayISO}T12:00:00`);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function minutes(time: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function shiftBounds(day: DayEntry): { start: number; end: number } | null {
  if (day.absence !== "none") return null;
  const start = minutes(day.start);
  const rawEnd = minutes(day.end);
  if (start === null || rawEnd === null || rawEnd === start) return null;
  return { start, end: rawEnd < start ? rawEnd + 24 * 60 : rawEnd };
}

function normalizedIntervalWithinShift(
  shiftStart: number,
  shiftEnd: number,
  intervalStart: number,
  intervalEnd: number,
): { start: number; end: number } {
  let start = intervalStart;
  let end = intervalEnd <= intervalStart ? intervalEnd + 24 * 60 : intervalEnd;
  while (end <= shiftStart) {
    start += 24 * 60;
    end += 24 * 60;
  }
  while (start < shiftStart && end <= shiftEnd - 24 * 60) {
    start += 24 * 60;
    end += 24 * 60;
  }
  return { start, end };
}

function buildPauseInterval(
  day: DayEntry,
  pauseStartValue: string,
  pauseEndValue: string,
): { start: number; end: number } | null {
  const bounds = shiftBounds(day);
  const pauseStart = minutes(pauseStartValue);
  const pauseEnd = minutes(pauseEndValue);
  if (!bounds || pauseStart === null || pauseEnd === null || pauseStart === pauseEnd) return null;
  const interval = normalizedIntervalWithinShift(bounds.start, bounds.end, pauseStart, pauseEnd);
  const start = Math.max(bounds.start, interval.start);
  const end = Math.min(bounds.end, interval.end);
  if (end <= start) return null;
  return { start, end };
}

function pauseIntervals(day: DayEntry): { start: number; end: number }[] {
  return [
    buildPauseInterval(day, day.pauseStart, day.pauseEnd),
    buildPauseInterval(day, day.pause2Start, day.pause2End),
  ].filter((interval): interval is { start: number; end: number } => Boolean(interval));
}

function pauseInterval(day: DayEntry): { start: number; end: number } | null {
  return pauseIntervals(day)[0] ?? null;
}

function pauseMinutesForDay(day: DayEntry): number {
  const intervals = pauseIntervals(day);
  if (intervals.length > 0) {
    return intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  }
  return Math.max(0, Number(day.pause) || 0);
}

export function dayHours(day: DayEntry): number {
  const bounds = shiftBounds(day);
  if (!bounds) return 0;
  return round(Math.max(0, bounds.end - bounds.start - pauseMinutesForDay(day)) / 60);
}

export function totalHours(days: DayEntry[]): number {
  return round(days.reduce((sum, day) => sum + dayHours(day), 0));
}

export function overtimeHours(days: DayEntry[], weeklyLimit = 37): number {
  return round(Math.max(0, totalHours(days) - weeklyLimit));
}

function overlapHours(day: DayEntry, from: string, to: string): number {
  const bounds = shiftBounds(day);
  const rangeStart = minutes(from);
  const rangeEnd = minutes(to);
  if (!bounds || rangeStart === null || rangeEnd === null) {
    return 0;
  }
  const adjustedRangeEnd = rangeEnd <= rangeStart ? rangeEnd + 24 * 60 : rangeEnd;
  const intervals = [-24 * 60, 0, 24 * 60].map((offset) => [
    rangeStart + offset,
    adjustedRangeEnd + offset,
  ]);
  const pauses = pauseIntervals(day);
  const overlap = intervals.reduce((sum, [a, b]) => {
    const gross = Math.max(0, Math.min(bounds.end, b) - Math.max(bounds.start, a));
    const pauseOverlap = pauses.reduce(
      (pauseSum, pause) =>
        pauseSum + Math.max(0, Math.min(pause.end, b) - Math.max(pause.start, a)),
      0,
    );
    return sum + Math.max(0, gross - pauseOverlap);
  }, 0);
  return round(overlap / 60);
}

function crossesMidnight(day: DayEntry): boolean {
  const start = minutes(day.start);
  const end = minutes(day.end);
  return start !== null && end !== null && end < start;
}

function hasPausePlacement(day: DayEntry): boolean {
  return pauseIntervals(day).length > 0;
}

function dateDayOfWeek(isoDate: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return undefined;
  return new Date(`${isoDate}T12:00:00`).getDay();
}

function effectiveDayType(day: DayEntry, index: number, weekStart: string): DayType {
  const date = addDaysToISODate(weekStart, index);
  if (day.isArtificialHolidayTest) return "sunday_or_public_holiday";
  const holidayName = getDanishAgreementHolidayName(date);
  if (holidayName) return "sunday_or_public_holiday";
  const weekday = dateDayOfWeek(date);
  if (weekday === 6) return "saturday_rest_day";
  if (weekday === 0) return "sunday_or_public_holiday";
  return day.dayType;
}

function hasPauseDurationWithoutPlacement(day: DayEntry): boolean {
  return day.absence === "none" && day.pause > 0 && !hasPausePlacement(day);
}

function daySegments(day: DayEntry, date: string): string[] {
  if (!day.start || !day.end) return [];
  if (!crossesMidnight(day)) return [`${date} ${day.start}–${day.end}`];
  return [`${date} ${day.start}–24:00`, `${addDaysToISODate(date, 1)} 00:00–${day.end}`];
}

function explicitShiftWork(day: DayEntry): boolean {
  return day.workType === "shift_work" || day.shiftWork;
}

function explicitWeekendAgreement(day: DayEntry): boolean {
  return day.workType === "weekend_work_agreement" || day.weekendAgreementApplies;
}

function delayedMealBreakTriggered(day: DayEntry): boolean {
  return Boolean(day.wasInstructedToWorkDuringMealBreak && day.mealBreakPostponedMoreThan30Min);
}

function buildDayRuleMarkers(
  t: Timesheet,
  canCalculateRatesAutomatically: boolean,
): DayRuleMarker[] {
  return t.days.map((day, index) => {
    const date = addDaysToISODate(t.weekStart, index);
    const effectiveType = effectiveDayType(day, index, t.weekStart);
    const ruleAreas: string[] = [DAY_TYPE_LABEL[effectiveType]];
    const warnings: string[] = [];
    const requiresManualValidation: string[] = [];

    if (day.workType !== "normal") ruleAreas.push(WORK_TYPE_LABEL[day.workType]);
    if (crossesMidnight(day)) ruleAreas.push("Vagt over midnat");
    if (day.isArtificialHolidayTest) ruleAreas.push("Test: behandles som helligdag");
    if (hasPauseDurationWithoutPlacement(day)) {
      warnings.push("Pauseplacering mangler. Tillæg kan ikke fordeles præcist.");
    }
    if (day.workType === "displaced_work_time" && !canCalculateRatesAutomatically) {
      requiresManualValidation.push(
        "Forskudt arbejdstid: Sats kræver manuel validering mod overenskomstkilde.",
      );
    }
    if (day.workType === "overtime" && !canCalculateRatesAutomatically) {
      requiresManualValidation.push(
        "Overarbejde: Sats kræver manuel validering mod overenskomstkilde.",
      );
    }
    if (explicitShiftWork(day) && !canCalculateRatesAutomatically) {
      requiresManualValidation.push(
        "Skiftehold: Sats kræver manuel validering mod overenskomstkilde.",
      );
    }
    if (explicitWeekendAgreement(day) && !canCalculateRatesAutomatically) {
      requiresManualValidation.push(
        "Weekendarbejde efter lokalaftale: Sats kræver manuel validering mod overenskomstkilde.",
      );
    }

    return {
      dayName: WEEKDAYS[index],
      date,
      paidHours: dayHours(day),
      dayType: effectiveType,
      workType: day.workType,
      crossesMidnight: crossesMidnight(day),
      dateSegments: daySegments(day, date),
      ruleAreas,
      warnings,
      delayedMealBreakStatus: delayedMealBreakTriggered(day)
        ? "Udskudt spisepause mulig"
        : "Udskudt spisepause ikke udløst",
      shiftStatus: explicitShiftWork(day)
        ? "Skiftehold markeret eksplicit"
        : "Skiftehold fravalgt/ikke relevant",
      weekendAgreementStatus: explicitWeekendAgreement(day)
        ? "Weekendarbejde efter lokalaftale markeret eksplicit"
        : "Weekendarbejde efter lokalaftale fravalgt/ikke relevant",
      requiresManualValidation,
    };
  });
}

function uniqueMessages(markers: DayRuleMarker[]): string[] {
  return [
    ...new Set(
      markers.flatMap((marker) => [...marker.warnings, ...marker.requiresManualValidation]),
    ),
  ];
}

function storageForKey(key: string): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function safeParse<T>(key: string, fallback: T): T {
  const storage = storageForKey(key);
  if (!storage) return fallback;
  try {
    let raw = storage.getItem(key);
    if (!raw && typeof window !== "undefined") {
      raw = window.sessionStorage.getItem(key);
      if (raw) {
        storage.setItem(key, raw);
      }
    }
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStorageItem(key: string, value: string): void {
  storageForKey(key)?.setItem(key, value);
}

function removeStorageItem(key: string): void {
  storageForKey(key)?.removeItem(key);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(key);
  }
}

function readDeletedIds(key: string): Set<string> {
  return new Set(safeParse<string[]>(key, []));
}

function rememberDeletedId(key: string, id: string): void {
  if (!id) return;
  const ids = readDeletedIds(key);
  ids.add(id);
  setStorageItem(key, JSON.stringify([...ids]));
}

function forgetDeletedId(key: string, id: string): void {
  const ids = readDeletedIds(key);
  if (!ids.delete(id)) return;
  setStorageItem(key, JSON.stringify([...ids]));
}

function emit(): void {
  window.dispatchEvent(new Event("timesheets-changed"));
}

function localUpdatedAt(): string {
  const stored = storageForKey(APP_STATE_META_KEY)?.getItem(APP_STATE_META_KEY) ?? "";
  if (stored) return stored;
  const timesheetUpdatedAt = readTimesheets()
    .map((item) => item.updatedAt)
    .sort()
    .at(-1);
  if (timesheetUpdatedAt) return timesheetUpdatedAt;
  return listCompanies().length > 0 ? new Date().toISOString() : "";
}

function markLocalUpdated(updatedAt = new Date().toISOString()): void {
  setStorageItem(APP_STATE_META_KEY, updatedAt);
}

function workerApiUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

const BUILD_TIME_MAIL_API_URL = import.meta.env.VITE_TIMESHEET_MAIL_API_URL?.trim() ?? "";
let runtimeMailApiUrl: string | undefined;
let runtimeConfigPromise: Promise<string> | undefined;

async function loadRuntimeMailApiUrl(): Promise<string> {
  if (runtimeMailApiUrl !== undefined) return runtimeMailApiUrl;

  runtimeConfigPromise ??= fetch(`${import.meta.env.BASE_URL}mail-config.json`, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return "";
      const config = (await response.json()) as { timesheetMailApiUrl?: string };
      return config.timesheetMailApiUrl?.trim() ?? "";
    })
    .catch(() => "");

  runtimeMailApiUrl = await runtimeConfigPromise;
  return runtimeMailApiUrl;
}

async function appStateApiUrl(): Promise<string> {
  const mailApiUrl = BUILD_TIME_MAIL_API_URL || (await loadRuntimeMailApiUrl());
  return mailApiUrl ? workerApiUrl("/app-state", mailApiUrl) : "";
}

function readTimesheets(): Timesheet[] {
  return safeParse<Timesheet[]>(TIMESHEET_KEY, []).map(normalizeTimesheet);
}

function writeTimesheets(list: Timesheet[], options: { syncRemote?: boolean } = {}): void {
  setStorageItem(TIMESHEET_KEY, JSON.stringify(list));
  if (options.syncRemote !== false) {
    markLocalUpdated();
    queueRemoteAppStatePersist();
  }
  emit();
}

export function listAll(): Timesheet[] {
  return readTimesheets().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getById(id: string): Timesheet | undefined {
  return readTimesheets().find((item) => item.id === id);
}

export function findByWorkerAccessCode(code: string): Timesheet | undefined {
  if (!/^\d{4,8}$/.test(code)) return undefined;
  return readTimesheets().find(
    (item) => item.workerAccessCode === code && item.workerMustChangeAccessCode === false,
  );
}

export function findByContactPersonAccessCode(code: string): Timesheet | undefined {
  if (!/^\d{4,8}$/.test(code)) return undefined;
  return readTimesheets().find(
    (item) =>
      item.contactPersonAccessCode === code && item.contactPersonMustChangeAccessCode === false,
  );
}

export function generateOneTimeCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export function upsert(t: Timesheet): Timesheet {
  const list = readTimesheets();
  const updated = normalizeTimesheet({ ...t, updatedAt: new Date().toISOString() });
  const index = list.findIndex((item) => item.id === t.id);
  if (index >= 0) list[index] = updated;
  else list.push(updated);
  forgetDeletedId(DELETED_TIMESHEET_IDS_KEY, updated.id);
  writeTimesheets(list);
  return updated;
}

export function setArchived(id: string, archived: boolean): Timesheet | undefined {
  const item = getById(id);
  if (!item) return undefined;
  return upsert({ ...item, archived });
}

export function setWorkerInactive(workerKey: string, workerInactive: boolean): Timesheet[] {
  const key = personLookupKey(workerKey);
  if (!key) return [];
  const list = readTimesheets();
  const updated = list.map((item) =>
    knownWorkerKey(item) === key
      ? normalizeTimesheet({ ...item, workerInactive, updatedAt: new Date().toISOString() })
      : item,
  );
  writeTimesheets(updated);
  return updated.filter((item) => knownWorkerKey(item) === key);
}

export function remove(id: string): void {
  rememberDeletedId(DELETED_TIMESHEET_IDS_KEY, id);
  writeTimesheets(readTimesheets().filter((item) => item.id !== id));
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  removeStorageItem(TIMESHEET_KEY);
  markLocalUpdated();
  queueRemoteAppStatePersist();
  emit();
}

export function createBlank(): Timesheet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ownerRole: undefined,
    vikar: "",
    vikarCode: "",
    vikarEmail: "",
    vikarPhone: "",
    vikarAddress: "",
    vikarCpr: "",
    workerLanguage: "da",
    tradeSkills: [],
    competencies: "",
    brugervirksomhed: "",
    companyId: "",
    projectId: "",
    projectName: "",
    projectEndDate: "",
    kontaktperson: "",
    kontaktpersonPhone: "",
    kontaktpersonEmail: "",
    contactPersonAccessCode: "",
    contactPersonMustChangeAccessCode: false,
    referenceNo: "",
    arbejdssted: "",
    selectedAgreementId: "",
    overenskomst: "",
    hourlyWage: 0,
    workerAccessCode: "",
    workerMustChangeAccessCode: false,
    localAgreementApplies: false,
    lokalaftale: false,
    weekStart: getMondayISO(),
    days: Array.from({ length: 7 }, (_, index) => emptyDay(index)),
    notes: "",
    status: "draft",
    archived: false,
    workerInactive: false,
    workerConsentInactive: false,
    workerConsentRenewalSentAt: "",
    workerConsentRenewedAt: "",
    createdAt: now,
    updatedAt: now,
  };
}

export type CreateWorkerTimesheetInput = {
  vikar: string;
  vikarCode?: string;
  vikarEmail: string;
  vikarPhone?: string;
  workerLanguage?: WorkerLanguage;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  brugervirksomhed: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  projectEndDate?: string;
  arbejdssted: string;
  kontaktperson: string;
  kontaktpersonPhone: string;
  kontaktpersonEmail: string;
  referenceNo: string;
  selectedAgreementId: string;
  hourlyWage: number;
  defaultStart: string;
  defaultEnd: string;
  defaultPause: number;
  defaultPauseStart?: string;
  defaultPauseEnd?: string;
  defaultPause2Start?: string;
  defaultPause2End?: string;
  defaultDayWorkStart?: string;
  defaultDayWorkEnd?: string;
  defaultEveningWorkStart?: string;
  defaultEveningWorkEnd?: string;
  defaultNightWorkStart?: string;
  defaultNightWorkEnd?: string;
  shiftWorkApplies?: boolean;
  weekPlan?: CreateWorkerDayPlan[];
  startDate: string;
  workerAccessCode: string;
  contactPersonAccessCode?: string;
  ownerRole?: "bruger" | "bruger2";
};

export type CreateWorkerDayPlan = {
  start: string;
  end: string;
  pause: number;
  pauseStart: string;
  pauseEnd: string;
  pause2Start: string;
  pause2End: string;
  dayWorkStart: string;
  dayWorkEnd: string;
  eveningWorkStart: string;
  eveningWorkEnd: string;
  nightWorkStart: string;
  nightWorkEnd: string;
  shiftWork: boolean;
};

function workWindowFromDayPlan(plan: CreateWorkerDayPlan): { start: string; end: string } | null {
  const ranges = [
    [plan.dayWorkStart, plan.dayWorkEnd],
    [plan.eveningWorkStart, plan.eveningWorkEnd],
    [plan.nightWorkStart, plan.nightWorkEnd],
  ].filter(([start, end]) => start && end);
  if (ranges.length === 0) return null;
  return {
    start: ranges[0][0],
    end: ranges[ranges.length - 1][1],
  };
}

export function createTimesheetForWorker(input: CreateWorkerTimesheetInput): Timesheet {
  const base = createBlank();
  const agreement = getCollectiveAgreementById(input.selectedAgreementId);
  const weekStart = getMondayISO(new Date(`${input.startDate}T12:00:00`));
  const workerPhone =
    normalizeWorkerPhone(input) ||
    listKnownWorkers().find((worker) => {
      const references = workerReferenceKeys(worker);
      return (
        references.includes(personLookupKey(input.vikar)) ||
        references.includes(personLookupKey(input.vikarEmail))
      );
    })?.phone ||
    "";
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToISODate(weekStart, index);
    const isWorkday = index < 5 && (!input.startDate || date >= input.startDate);
    const plan = input.weekPlan?.[index];
    if (plan) {
      const workWindow = workWindowFromDayPlan(plan);
      const hasWork = Boolean(workWindow && (!input.startDate || date >= input.startDate));
      const shiftWork = Boolean(plan.shiftWork || input.shiftWorkApplies);
      const workType: WorkType = shiftWork ? "shift_work" : "normal";
      return {
        ...emptyDay(index),
        start: hasWork ? workWindow?.start || "" : "",
        end: hasWork ? workWindow?.end || "" : "",
        pause: hasWork ? Number(plan.pause) || 0 : 0,
        pauseStart: hasWork ? plan.pauseStart : "",
        pauseEnd: hasWork ? plan.pauseEnd : "",
        pause2Start: hasWork ? plan.pause2Start : "",
        pause2End: hasWork ? plan.pause2End : "",
        dayWorkStart: hasWork ? plan.dayWorkStart : "",
        dayWorkEnd: hasWork ? plan.dayWorkEnd : "",
        eveningWorkStart: hasWork ? plan.eveningWorkStart : "",
        eveningWorkEnd: hasWork ? plan.eveningWorkEnd : "",
        nightWorkStart: hasWork ? plan.nightWorkStart : "",
        nightWorkEnd: hasWork ? plan.nightWorkEnd : "",
        workType,
        shiftWork,
      };
    }
    const workType: WorkType = input.shiftWorkApplies ? "shift_work" : "normal";
    return {
      ...emptyDay(index),
      start: isWorkday ? input.defaultStart : "",
      end: isWorkday ? input.defaultEnd : "",
      pause: isWorkday ? input.defaultPause : 0,
      pauseStart: isWorkday ? input.defaultPauseStart || "" : "",
      pauseEnd: isWorkday ? input.defaultPauseEnd || "" : "",
      pause2Start: isWorkday ? input.defaultPause2Start || "" : "",
      pause2End: isWorkday ? input.defaultPause2End || "" : "",
      dayWorkStart: isWorkday ? input.defaultDayWorkStart || "" : "",
      dayWorkEnd: isWorkday ? input.defaultDayWorkEnd || "" : "",
      eveningWorkStart: isWorkday ? input.defaultEveningWorkStart || "" : "",
      eveningWorkEnd: isWorkday ? input.defaultEveningWorkEnd || "" : "",
      nightWorkStart: isWorkday ? input.defaultNightWorkStart || "" : "",
      nightWorkEnd: isWorkday ? input.defaultNightWorkEnd || "" : "",
      workType,
      shiftWork: Boolean(input.shiftWorkApplies),
    };
  });

  return {
    ...base,
    ownerRole: input.ownerRole,
    vikar: input.vikar.trim(),
    vikarCode: input.vikarCode?.trim() ?? "",
    vikarEmail: input.vikarEmail.trim(),
    vikarPhone: workerPhone,
    workerLanguage: normalizeWorkerLanguage(input.workerLanguage),
    tradeSkills: normalizeTradeSkills(input.tradeSkills),
    competencies: input.competencies?.trim() ?? "",
    brugervirksomhed: input.brugervirksomhed.trim(),
    companyId: input.companyId ?? "",
    projectId: input.projectId ?? "",
    projectName: input.projectName ?? "",
    projectEndDate: input.projectEndDate ?? "",
    arbejdssted: input.arbejdssted.trim(),
    kontaktperson: input.kontaktperson.trim(),
    kontaktpersonPhone: input.kontaktpersonPhone.trim(),
    kontaktpersonEmail: input.kontaktpersonEmail.trim(),
    contactPersonAccessCode: input.contactPersonAccessCode?.trim() ?? "",
    contactPersonMustChangeAccessCode: Boolean(input.contactPersonAccessCode?.trim()),
    referenceNo: input.referenceNo.trim(),
    selectedAgreementId: input.selectedAgreementId,
    overenskomst: agreement?.name ?? "",
    hourlyWage: Number(input.hourlyWage) || 0,
    workerAccessCode: input.workerAccessCode.trim(),
    workerMustChangeAccessCode: true,
    weekStart,
    days,
  };
}

export function validate(t: Timesheet): string[] {
  const errors: string[] = [];
  if (!t.vikar.trim()) errors.push("Vikarnavn mangler");
  if (!/^\S+@\S+\.\S+$/.test(t.vikarEmail))
    errors.push("Vikarens mailadresse mangler eller er ugyldig");
  if (!t.brugervirksomhed.trim()) errors.push("Brugervirksomhed mangler");
  if (!t.kontaktperson.trim()) errors.push("Kontaktperson mangler");
  if (!/^\S+@\S+\.\S+$/.test(t.kontaktpersonEmail))
    errors.push("Kontaktpersonens mailadresse mangler eller er ugyldig");
  if (!t.arbejdssted.trim()) errors.push("Arbejdssted mangler");
  if (
    !t.selectedAgreementId ||
    t.selectedAgreementId === "all" ||
    !getCollectiveAgreementById(t.selectedAgreementId)
  )
    errors.push("Vælg en aktiv overenskomst");
  t.days.forEach((day, index) => {
    if (day.absence === "none" && Boolean(day.start) !== Boolean(day.end))
      errors.push(`${WEEKDAYS[index]}: Udfyld både start og slut`);
    if (day.start && day.end && day.start === day.end)
      errors.push(`${WEEKDAYS[index]}: Start og slut kan ikke være ens`);
    if (day.pause < 0) errors.push(`${WEEKDAYS[index]}: Pause kan ikke være negativ`);
    if (Boolean(day.pauseStart) !== Boolean(day.pauseEnd))
      errors.push(`${WEEKDAYS[index]}: Udfyld både pause 1 start og pause 1 slut`);
    if (Boolean(day.pause2Start) !== Boolean(day.pause2End))
      errors.push(`${WEEKDAYS[index]}: Udfyld både pause 2 start og pause 2 slut`);
    if (Boolean(day.dayWorkStart) !== Boolean(day.dayWorkEnd))
      errors.push(`${WEEKDAYS[index]}: Udfyld både dagarbejde start og dagarbejde slut`);
    if (Boolean(day.eveningWorkStart) !== Boolean(day.eveningWorkEnd))
      errors.push(`${WEEKDAYS[index]}: Udfyld både aftenarbejde start og aftenarbejde slut`);
    if (Boolean(day.nightWorkStart) !== Boolean(day.nightWorkEnd))
      errors.push(`${WEEKDAYS[index]}: Udfyld både natarbejde start og natarbejde slut`);
  });
  return errors;
}

type StoredAgreementRule = AgreementRule & {
  name?: string;
  sourcePages?: Partial<Record<AgreementRuleSourceKey, number>>;
  sources?: AgreementRuleSource[];
};

function isGeneratedRuleText(value?: string) {
  const text = value?.trim() ?? "";
  return (
    text.includes("er fundet i PDF-kilden. Brug kildehenvisningen til side") ||
    text.includes("Brug kildehenvisningen til PDF-side")
  );
}

function ruleTextOrDefault(storedValue: string | undefined, defaultValue: string) {
  if (!storedValue?.trim() || isGeneratedRuleText(storedValue)) return defaultValue;
  return storedValue;
}

function normalizeAgreementRule(rule: AgreementRule, stored?: StoredAgreementRule): AgreementRule {
  const agreement = getCollectiveAgreementById(rule.agreementId);
  const legacySources = Object.entries(stored?.sourcePages ?? {})
    .filter((entry): entry is [AgreementRuleSourceKey, number] => {
      const [field, page] = entry;
      return field in AGREEMENT_RULE_SOURCE_LABEL && Number.isFinite(page) && page > 0;
    })
    .map(([field, page]) => ({
      field,
      page,
      pdfUrl: agreement?.pdfUrl ?? "",
      pdfFileName: agreement?.pdfFileName,
    }));
  const storedSources = stored?.sources ?? [];
  const hasCustomSourcePdf = storedSources.some(
    (source) => source.pdfUrl && source.pdfUrl !== (agreement?.pdfUrl ?? ""),
  );

  const merged = {
    ...rule,
    ...(stored ?? {}),
    id: rule.id,
    agreementId: rule.agreementId,
    sources: hasCustomSourcePdf
      ? storedSources
      : legacySources.length
        ? legacySources
        : rule.sources,
  };

  return {
    ...merged,
    normalDayHours: stored?.normalDayHours ?? rule.normalDayHours,
    normalWeekHours: stored?.normalWeekHours ?? rule.normalWeekHours,
    overtimeRule: ruleTextOrDefault(stored?.overtimeRule, rule.overtimeRule),
    saturdayRule: ruleTextOrDefault(stored?.saturdayRule, rule.saturdayRule),
    sundayRule: ruleTextOrDefault(stored?.sundayRule, rule.sundayRule),
    eveningRule: ruleTextOrDefault(stored?.eveningRule, rule.eveningRule),
    nightRule: ruleTextOrDefault(stored?.nightRule, rule.nightRule),
    shiftRule: ruleTextOrDefault(stored?.shiftRule, rule.shiftRule),
    specialRule: ruleTextOrDefault(stored?.specialRule, rule.specialRule),
    eveningStart: stored?.eveningStart?.trim() ? stored.eveningStart : rule.eveningStart,
    nightStart: stored?.nightStart?.trim() ? stored.nightStart : rule.nightStart,
    nightEnd: stored?.nightEnd?.trim() ? stored.nightEnd : rule.nightEnd,
    sources: hasCustomSourcePdf ? merged.sources : rule.sources,
  };
}

export function listRules(): AgreementRule[] {
  const stored = safeParse<StoredAgreementRule[]>(RULE_KEY, []);
  const byAgreementId = new Map(stored.map((rule) => [rule.agreementId, rule]));
  const byLegacyName = new Map(stored.filter((rule) => rule.name).map((rule) => [rule.name, rule]));
  const now = new Date().toISOString();

  return defaultAgreementRules.map((rule) => {
    const storedRule =
      byAgreementId.get(rule.agreementId) ??
      byLegacyName.get(getCollectiveAgreementById(rule.agreementId)?.name);

    const normalized = normalizeAgreementRule(rule, storedRule);

    return {
      ...normalized,
      sources: storedRule?.sources ?? normalized.sources,
      updatedAt: storedRule?.updatedAt ?? rule.updatedAt ?? now,
    };
  });
}

export function saveRule(rule: AgreementRule): void {
  const list = listRules();
  const updated = { ...rule, updatedAt: new Date().toISOString() };
  const index = list.findIndex((item) => item.agreementId === rule.agreementId);
  if (index >= 0) list[index] = updated;
  else list.push(updated);
  setStorageItem(RULE_KEY, JSON.stringify(list));
  emit();
}

export function getRule(agreementId: string): AgreementRule | undefined {
  return listRules().find((rule) => rule.agreementId === agreementId);
}

export function listCompanies(): Company[] {
  return safeParse<StoredCompany[]>(COMPANY_KEY, []).map(normalizeCompany);
}

export function saveCompany(company: Company): void {
  const list = listCompanies();
  const updated = normalizeCompany(company);
  const index = list.findIndex((item) => item.id === updated.id);
  if (index >= 0) list[index] = updated;
  else list.push(updated);
  forgetDeletedId(DELETED_COMPANY_IDS_KEY, updated.id);
  setStorageItem(COMPANY_KEY, JSON.stringify(list));
  markLocalUpdated();
  queueRemoteAppStatePersist();
  emit();
}

export function removeCompany(id: string): void {
  rememberDeletedId(DELETED_COMPANY_IDS_KEY, id);
  setStorageItem(
    COMPANY_KEY,
    JSON.stringify(listCompanies().filter((company) => company.id !== id)),
  );
  markLocalUpdated();
  queueRemoteAppStatePersist();
  emit();
}

type RemoteAppState = {
  version?: number;
  updatedAt?: string;
  timesheets?: StoredTimesheet[];
  companies?: StoredCompany[];
};

type NormalizedAppState = {
  version: 1;
  updatedAt: string;
  timesheets: Timesheet[];
  companies: Company[];
};

let remotePersistTimer: number | undefined;
let remoteSyncPromise: Promise<void> | undefined;

function currentAppState(): NormalizedAppState {
  return {
    version: 1,
    updatedAt: localUpdatedAt(),
    timesheets: readTimesheets(),
    companies: listCompanies(),
  };
}

function mergeTimesheets(local: Timesheet[], remote: Timesheet[]): Timesheet[] {
  const deletedIds = readDeletedIds(DELETED_TIMESHEET_IDS_KEY);
  const byId = new Map<string, Timesheet>();
  for (const item of remote) {
    if (!deletedIds.has(item.id)) byId.set(item.id, item);
  }
  for (const item of local) {
    if (deletedIds.has(item.id)) continue;
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mergeCompanies(local: Company[], remote: Company[], preferLocal: boolean): Company[] {
  const deletedIds = readDeletedIds(DELETED_COMPANY_IDS_KEY);
  const byId = new Map<string, Company>();
  for (const item of preferLocal ? remote : local) {
    if (!deletedIds.has(item.id)) byId.set(item.id, item);
  }
  for (const item of preferLocal ? local : remote) {
    if (!deletedIds.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

function applyAppState(state: RemoteAppState, updatedAt: string): void {
  const timesheets = Array.isArray(state.timesheets)
    ? state.timesheets.map((item) => normalizeTimesheet(item))
    : [];
  const companies = Array.isArray(state.companies)
    ? state.companies.map((item) => normalizeCompany(item))
    : [];

  writeTimesheets(timesheets, { syncRemote: false });
  setStorageItem(COMPANY_KEY, JSON.stringify(companies));
  markLocalUpdated(updatedAt);
  emit();
}

async function persistRemoteAppState(): Promise<void> {
  const url = await appStateApiUrl();
  if (!url) return;

  const state = currentAppState();
  if (!state.updatedAt) return;

  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(state),
  }).catch(() => undefined);
}

function queueRemoteAppStatePersist(): void {
  if (typeof window === "undefined") return;
  if (remotePersistTimer) window.clearTimeout(remotePersistTimer);
  remotePersistTimer = window.setTimeout(() => {
    void persistRemoteAppState();
  }, 400);
}

export async function syncRemoteAppState(): Promise<void> {
  if (typeof window === "undefined") return;
  if (remoteSyncPromise) return remoteSyncPromise;

  remoteSyncPromise = (async () => {
    const url = await appStateApiUrl();
    if (!url) return;

    const response = await fetch(url, { cache: "no-store" }).catch(() => undefined);
    if (!response?.ok) return;
    const body = (await response.json().catch(() => undefined)) as
      | { ok?: boolean; state?: RemoteAppState }
      | undefined;
    if (!body?.ok || !body.state) return;

    const remoteUpdatedAt = body.state.updatedAt ?? "";
    const localState = currentAppState();
    const preferLocal = !remoteUpdatedAt || localState.updatedAt >= remoteUpdatedAt;
    const remoteTimesheets = Array.isArray(body.state.timesheets)
      ? body.state.timesheets.map((item) => normalizeTimesheet(item))
      : [];
    const remoteCompanies = Array.isArray(body.state.companies)
      ? body.state.companies.map((item) => normalizeCompany(item))
      : [];
    const mergedTimesheets = mergeTimesheets(localState.timesheets, remoteTimesheets);
    const mergedCompanies = mergeCompanies(localState.companies, remoteCompanies, preferLocal);
    const mergedUpdatedAt =
      [localState.updatedAt, remoteUpdatedAt].filter(Boolean).sort().at(-1) ||
      new Date().toISOString();

    applyAppState(
      {
        version: 1,
        updatedAt: mergedUpdatedAt,
        timesheets: mergedTimesheets,
        companies: mergedCompanies,
      },
      mergedUpdatedAt,
    );

    if (
      localState.updatedAt !== remoteUpdatedAt ||
      mergedTimesheets.length !== remoteTimesheets.length ||
      mergedCompanies.length !== remoteCompanies.length
    ) {
      await persistRemoteAppState();
    }
  })().finally(() => {
    remoteSyncPromise = undefined;
  });

  return remoteSyncPromise;
}

export type KnownWorker = {
  key: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  language: WorkerLanguage;
  tradeSkills: TradeSkill[];
  competencies: string;
  inactive: boolean;
};

export type KnownContact = {
  key: string;
  name: string;
  email: string;
  phone: string;
};

function personLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function knownWorkerKey(timesheet: Timesheet): string {
  return personLookupKey(timesheet.vikar) || personLookupKey(timesheet.vikarEmail);
}

function knownWorkerReferenceKeys(worker: Pick<KnownWorker, "key" | "name" | "email">): string[] {
  return [
    ...new Set(
      [worker.key, personLookupKey(worker.name), personLookupKey(worker.email)].filter(Boolean),
    ),
  ];
}

export function knownWorkersFromTimesheets(timesheets: Timesheet[]): KnownWorker[] {
  const workers: KnownWorker[] = [];
  for (const timesheet of timesheets) {
    const nameKey = personLookupKey(timesheet.vikar);
    const emailKey = personLookupKey(timesheet.vikarEmail);
    const key = nameKey || emailKey;
    if (!key) continue;
    const existing = workers.find((worker) => {
      const references = knownWorkerReferenceKeys(worker);
      return nameKey ? references.includes(nameKey) : references.includes(emailKey);
    });
    const inactive =
      existing?.inactive || timesheet.workerInactive || timesheet.workerConsentInactive || false;
    const tradeSkills = [
      ...new Set([...(existing?.tradeSkills ?? []), ...(timesheet.tradeSkills ?? [])]),
    ];
    const competencies = [
      ...new Set(
        [existing?.competencies ?? "", timesheet.competencies ?? ""]
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].join("; ");
    const worker = {
      key: existing?.key || key,
      name: timesheet.vikar || existing?.name || timesheet.vikarEmail,
      code: timesheet.vikarCode || existing?.code || "",
      email: timesheet.vikarEmail || existing?.email || "",
      phone: timesheet.vikarPhone || existing?.phone || "",
      language: normalizeWorkerLanguage(timesheet.workerLanguage || existing?.language),
      tradeSkills,
      competencies,
      inactive,
    };
    if (existing) {
      Object.assign(existing, worker);
    } else {
      workers.push(worker);
    }
  }
  return workers
    .filter((worker) => !worker.inactive)
    .sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

export function listKnownWorkers(): KnownWorker[] {
  return knownWorkersFromTimesheets(readTimesheets());
}

export function workerReferenceKeys(worker: KnownWorker): string[] {
  return knownWorkerReferenceKeys(worker);
}

export function timesheetRetentionWarning(
  t: Timesheet,
): { level: "warning" | "critical"; text: string } | null {
  if (t.workerInactive || !t.vikarEmail) return null;
  const key = knownWorkerKey(t);
  if (!key) return null;
  const workerTimesheets = readTimesheets().filter(
    (item) => knownWorkerKey(item) === key && item.status !== "draft",
  );
  const latestActivity = workerTimesheets
    .flatMap((item) =>
      [item.weekStart || item.createdAt, item.workerConsentRenewedAt].filter(Boolean),
    )
    .sort()
    .at(-1);
  if (!latestActivity) return null;

  const created = new Date(latestActivity);
  if (Number.isNaN(created.getTime())) return null;
  const now = new Date();
  const fiveMonths = new Date(created);
  fiveMonths.setMonth(fiveMonths.getMonth() + 5);
  const sixMonths = new Date(created);
  sixMonths.setMonth(sixMonths.getMonth() + 6);

  if (now >= sixMonths) {
    return {
      level: "critical",
      text: "Vikarens samtykke til kontakt er udløbet. Fjern kontakt- og profiloplysninger, men bevar timeseddeldata til dokumentation.",
    };
  }
  if (now >= fiveMonths) {
    return {
      level: "warning",
      text: "Vikarens samtykke til kontakt skal fornyes. Send samtykkemail, hvis vikaren fortsat må kontaktes om jobmuligheder.",
    };
  }
  return null;
}

export function markWorkerConsentRenewalSent(workerKey: string): Timesheet[] {
  const key = personLookupKey(workerKey);
  if (!key) return [];
  const now = new Date().toISOString();
  const list = readTimesheets();
  const updated = list.map((item) =>
    knownWorkerKey(item) === key
      ? normalizeTimesheet({ ...item, workerConsentRenewalSentAt: now, updatedAt: now })
      : item,
  );
  writeTimesheets(updated);
  return updated.filter((item) => knownWorkerKey(item) === key);
}

export function renewWorkerConsent(workerName: string, workerEmail: string): Timesheet[] {
  const nameKey = personLookupKey(workerName);
  const emailKey = personLookupKey(workerEmail);
  if (!nameKey && !emailKey) return [];
  const now = new Date().toISOString();
  const list = readTimesheets();
  const updated = list.map((item) => {
    const matchesName = nameKey && personLookupKey(item.vikar) === nameKey;
    const matchesEmail = emailKey && personLookupKey(item.vikarEmail) === emailKey;
    return matchesName || matchesEmail
      ? normalizeTimesheet({ ...item, workerConsentRenewedAt: now, updatedAt: now })
      : item;
  });
  writeTimesheets(updated);
  return updated.filter((item) => {
    const matchesName = nameKey && personLookupKey(item.vikar) === nameKey;
    const matchesEmail = emailKey && personLookupKey(item.vikarEmail) === emailKey;
    return Boolean(matchesName || matchesEmail);
  });
}

export function listKnownContacts(): KnownContact[] {
  const contacts: KnownContact[] = [];
  const addContact = (name: string, email: string, phone: string) => {
    const normalizedName = personLookupKey(name);
    const normalizedEmail = personLookupKey(email);
    if (!normalizedName && !normalizedEmail) return;
    const existing = contacts.find(
      (contact) =>
        (normalizedName && personLookupKey(contact.name) === normalizedName) ||
        (normalizedEmail && personLookupKey(contact.email) === normalizedEmail),
    );
    if (existing) {
      existing.name = existing.name || name;
      existing.email = existing.email || email;
      existing.phone = existing.phone || phone;
      existing.key = personLookupKey(existing.name) || personLookupKey(existing.email);
      return;
    }
    contacts.push({
      key: normalizedName || normalizedEmail,
      name,
      email,
      phone,
    });
  };

  for (const company of listCompanies()) {
    addContact(company.contactName, company.contactEmail, company.contactPhone);
    for (const project of company.projects) {
      addContact(project.contactName, project.contactEmail, project.contactPhone);
    }
  }
  for (const timesheet of readTimesheets()) {
    addContact(timesheet.kontaktperson, timesheet.kontaktpersonEmail, timesheet.kontaktpersonPhone);
  }

  return contacts.sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

export function calculateTimesheet(t: Timesheet): CalculationResult {
  const delayedMealBreakDays = delayedMealBreakDaysForTimesheet(t);
  const delayedMealBreakAmount = delayedMealBreakAmountForDays(delayedMealBreakDays);

  if (!t.selectedAgreementId || t.selectedAgreementId === "all") {
    const total = totalHours(t.days);
    const dayRuleMarkers = buildDayRuleMarkers(t, false);
    const localAgreementHours = round(
      t.localAgreementApplies
        ? total
        : t.days.reduce((sum, day) => sum + (day.localAgreementApplies ? dayHours(day) : 0), 0),
    );
    return {
      total,
      agreementId: "",
      agreementName: "",
      agreementCategory: "",
      industryArea: "",
      canCalculateRatesAutomatically: false,
      rateValidationStatus: "missing_pdf",
      validationNote: "Vælg en konkret overenskomst for at validere regler og tillæg.",
      normal: total,
      overtime: 0,
      saturday: 0,
      sunday: 0,
      publicHoliday: 0,
      weekend: 0,
      evening: 0,
      night: 0,
      shift: 0,
      delayedMealBreakDays,
      delayedMealBreakAmount,
      localAgreement: localAgreementHours,
      missingRules: ["valgt overenskomst"],
      dayRuleMarkers,
      manualValidationMessages: uniqueMessages(dayRuleMarkers),
    };
  }
  const summary = calculateTimesheetSummary({
    workerName: t.vikar,
    workerEmail: t.vikarEmail,
    userCompany: t.brugervirksomhed,
    contactPerson: t.kontaktperson,
    referenceNumber: t.referenceNo,
    workAddress: t.arbejdssted,
    selectedAgreementId: t.selectedAgreementId,
    localAgreementApplies: t.localAgreementApplies,
    days: WEEKDAYS.map((day, index) => ({ day, hours: dayHours(t.days[index]) })),
    notes: t.notes,
  });
  const rule = getRule(t.selectedAgreementId);
  const validationReport = getAgreementValidationReport(t.selectedAgreementId);
  const total = totalHours(t.days);
  const missingRules: string[] = [];
  const dayRuleMarkers = buildDayRuleMarkers(t, summary.canCalculateRatesAutomatically);
  const saturday = round(
    t.days.reduce(
      (sum, day, index) =>
        sum +
        (effectiveDayType(day, index, t.weekStart) === "saturday_rest_day" ? dayHours(day) : 0),
      0,
    ),
  );
  const sunday = round(
    t.days.reduce(
      (sum, day, index) =>
        sum +
        (effectiveDayType(day, index, t.weekStart) === "sunday_or_public_holiday"
          ? dayHours(day)
          : 0),
      0,
    ),
  );
  const publicHoliday = round(
    t.days.reduce((sum, day, index) => {
      const holidayName = getDanishAgreementHolidayName(addDaysToISODate(t.weekStart, index));
      return (
        sum +
        ((holidayName && holidayName !== "Søndag") || day.isArtificialHolidayTest
          ? dayHours(day)
          : 0)
      );
    }, 0),
  );
  const evening = t.days.reduce((sum, day) => {
    if (day.eveningWorkStart && day.eveningWorkEnd) {
      return sum + overlapHours(day, day.eveningWorkStart, day.eveningWorkEnd);
    }
    if (rule?.eveningStart && day.workType === "displaced_work_time") {
      return sum + overlapHours(day, rule.eveningStart, rule.nightStart || "23:59");
    }
    return sum;
  }, 0);
  const night = t.days.reduce((sum, day) => {
    if (day.nightWorkStart && day.nightWorkEnd) {
      return sum + overlapHours(day, day.nightWorkStart, day.nightWorkEnd);
    }
    if (rule?.nightStart && rule.nightEnd && day.workType === "displaced_work_time") {
      return sum + overlapHours(day, rule.nightStart, rule.nightEnd);
    }
    return sum;
  }, 0);
  const shift = round(
    t.days.reduce((sum, day) => sum + (explicitShiftWork(day) ? dayHours(day) : 0), 0),
  );
  const overtime = round(
    t.days.reduce((sum, day) => sum + (day.workType === "overtime" ? dayHours(day) : 0), 0),
  );
  const weekendAgreement = round(
    t.days.reduce((sum, day) => sum + (explicitWeekendAgreement(day) ? dayHours(day) : 0), 0),
  );
  const localAgreementHours = round(
    t.localAgreementApplies
      ? total
      : t.days.reduce((sum, day) => sum + (day.localAgreementApplies ? dayHours(day) : 0), 0),
  );

  if (!summary.canCalculateRatesAutomatically) {
    const validationBlockers = validationReport
      ? [
          ...getMissingValidationRules(validationReport).map(
            (item) => `mangler godkendelse: ${item.label}`,
          ),
          ...getRulesNeedingManualReview(validationReport).map(
            (item) => `kræver review: ${item.label}`,
          ),
          ...getFailingValidationTests(validationReport).map(
            (item) => `testcase ikke bestået: ${item.label}`,
          ),
        ]
      : [];
    return {
      total,
      agreementId: summary.agreementId,
      agreementName: summary.agreementName,
      agreementCategory: summary.agreementCategory,
      industryArea: summary.industryArea,
      pdfUrl: summary.pdfUrl,
      pdfFileName: summary.pdfFileName,
      rateValidationStatus: summary.rateValidationStatus,
      canCalculateRatesAutomatically: summary.canCalculateRatesAutomatically,
      validationNote: summary.validationNote,
      normal: round(Math.max(0, total - overtime)),
      overtime: round(overtime),
      saturday,
      sunday,
      publicHoliday,
      weekend: weekendAgreement,
      evening: round(evening),
      night: round(night),
      shift,
      delayedMealBreakDays,
      delayedMealBreakAmount,
      localAgreement: localAgreementHours,
      missingRules: [
        ...new Set([
          summary.validationNote,
          ...validationBlockers,
          ...uniqueMessages(dayRuleMarkers),
        ]),
      ],
      dayRuleMarkers,
      manualValidationMessages: uniqueMessages(dayRuleMarkers),
    };
  }

  const validatedOvertime = overtime;

  if (!rule?.overtimeRule) missingRules.push("overarbejdsregel");
  if (!rule?.validFrom || !rule?.validTo) missingRules.push("reglernes gyldighedsperiode");
  if (saturday > 0 && !rule?.saturdayRule) missingRules.push("lørdagstillæg");
  if (sunday > 0 && !rule?.sundayRule) missingRules.push("søndagstillæg");
  if (publicHoliday > 0 && !rule?.sundayRule) missingRules.push("helligdags-/søndagstillæg");
  if (evening > 0 && !rule?.eveningRule) missingRules.push("aftentillæg");
  if (night > 0 && !rule?.nightRule) missingRules.push("nattillæg");
  if (t.days.some((day) => explicitShiftWork(day)) && !rule?.shiftRule)
    missingRules.push("skifteholdstillæg");
  return {
    total,
    agreementId: summary.agreementId,
    agreementName: summary.agreementName,
    agreementCategory: summary.agreementCategory,
    industryArea: summary.industryArea,
    pdfUrl: summary.pdfUrl,
    pdfFileName: summary.pdfFileName,
    rateValidationStatus: summary.rateValidationStatus,
    canCalculateRatesAutomatically: summary.canCalculateRatesAutomatically,
    validationNote: summary.validationNote,
    normal: round(Math.max(0, total - validatedOvertime)),
    overtime: round(validatedOvertime),
    saturday,
    sunday,
    publicHoliday,
    weekend: weekendAgreement,
    evening: round(evening),
    night: round(night),
    shift,
    delayedMealBreakDays,
    delayedMealBreakAmount,
    localAgreement: localAgreementHours,
    missingRules: [...new Set([...missingRules, ...uniqueMessages(dayRuleMarkers)])],
    dayRuleMarkers,
    manualValidationMessages: uniqueMessages(dayRuleMarkers),
  };
}

export function emailSubject(t: Timesheet): string {
  return `Timeseddel til godkendelse – uge ${weekNumber(t.weekStart)}`;
}

type EmailBodyOptions = {
  includeApprovalTerms?: boolean;
};

type MailTextOptions = {
  footerMessage?: string;
  contactInviteUrl?: string;
};

export function emailBody(t: Timesheet, options: EmailBodyOptions = {}): string {
  const calc = calculateTimesheet(t);
  const dayLines = WEEKDAYS.map((name, index) => {
    const day = t.days[index];
    const date = addDaysToISODate(t.weekStart, index);
    const registration =
      day.absence !== "none"
        ? ABSENCE_LABEL[day.absence]
        : day.start && day.end
          ? `${day.start}–${day.end}, pause ${day.pause} min, ${dayHours(day).toFixed(2)} t`
          : "Ingen registrering";
    const delayedMealBreakDetail =
      isIndustriensAgreement(t.selectedAgreementId) &&
      day.absence === "none" &&
      delayedMealBreakTriggered(day)
        ? "Udsat spisepause 30+ min efter besked fra virksomheden"
        : "";
    const details = [
      day.taskType,
      day.workType !== "normal" ? WORK_TYPE_LABEL[day.workType] : "",
      explicitShiftWork(day) ? "Skiftehold markeret" : "",
      delayedMealBreakDetail,
      day.comment,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${name} ${formatDateLabel(date)}: ${registration}${details ? ` (${details})` : ""}`;
  });

  const manualAllowanceLines: string[] = [];
  if (isIndustriensAgreement(t.selectedAgreementId) && calc.delayedMealBreakDays > 0) {
    manualAllowanceLines.push(delayedMealBreakSummaryText(calc.delayedMealBreakDays));
  }
  if (manualAllowanceLines.length === 0) {
    manualAllowanceLines.push("Ingen manuelle tillæg registreret.");
  }

  return [
    "TIMESSEDDEL TIL GODKENDELSE",
    "",
    "OPLYSNINGER",
    `Vikarnavn: ${t.vikar}`,
    `Brugervirksomhed: ${t.brugervirksomhed}`,
    `Kontaktperson: ${t.kontaktperson}`,
    `Kontaktperson telefon: ${t.kontaktpersonPhone || "—"}`,
    `Reference: ${t.referenceNo || "—"}`,
    `Arbejdssted: ${t.arbejdssted}`,
    `Uge og dato: Uge ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
    "",
    "REGISTRERINGER",
    ...dayLines,
    "",
    "SAMLET TIMETAL",
    `${calc.total.toFixed(2)} timer`,
    "",
    "MANUELLE TILLÆG",
    ...manualAllowanceLines,
    "",
    "NOTER",
    t.notes || "—",
    "",
    ...(options.includeApprovalTerms
      ? [
          "GODKENDELSE OG INDSIGELSER",
          "I henhold til de aftalte forretningsbetingelser anses timesedlen som godkendt, medmindre der modtages skriftlig indsigelse senest tirsdag efter fremsendelsen. Eventuelle indsigelser skal angive, hvilke registreringer der bestrides, og begrundelsen herfor.",
          "",
        ]
      : []),
    "Timesedlen er sendt til godkendelse hos kontaktpersonen.",
  ].join("\n");
}

export function contactPersonEmailBody(t: Timesheet, options: MailTextOptions = {}): string {
  const calc = calculateTimesheet(t);
  const dayLines = WEEKDAYS.map((name, index) => {
    const day = t.days[index];
    const date = addDaysToISODate(t.weekStart, index);
    const registration =
      day.absence !== "none"
        ? ABSENCE_LABEL[day.absence]
        : day.start && day.end
          ? `${day.start}–${day.end}, pause ${day.pause} min, ${dayHours(day).toFixed(2)} t`
          : "Ingen registrering";
    const delayedMealBreakDetail =
      isIndustriensAgreement(t.selectedAgreementId) &&
      day.absence === "none" &&
      delayedMealBreakTriggered(day)
        ? "Udsat spisepause 30+ min efter besked fra virksomheden"
        : "";
    const details = [
      day.taskType,
      day.workType !== "normal" ? WORK_TYPE_LABEL[day.workType] : "",
      explicitShiftWork(day) ? "Skiftehold markeret" : "",
      delayedMealBreakDetail,
      day.comment,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${name} ${formatDateLabel(date)}: ${registration}${details ? ` (${details})` : ""}`;
  });

  const manualAllowanceLines: string[] = [];
  if (isIndustriensAgreement(t.selectedAgreementId) && calc.delayedMealBreakDays > 0) {
    manualAllowanceLines.push(delayedMealBreakSummaryText(calc.delayedMealBreakDays));
  }
  if (manualAllowanceLines.length === 0) {
    manualAllowanceLines.push("Ingen manuelle tillæg registreret.");
  }

  return [
    `Hej ${t.kontaktperson || "kontaktperson"}`,
    "",
    `Du modtager hermed timeseddel for ${t.vikar || "vikaren"} hos ${
      t.brugervirksomhed || "brugervirksomheden"
    } for uge ${weekNumber(t.weekStart)}.`,
    "",
    "Vil du venligst gennemgå registreringerne og godkende timesedlen senest tirsdag efter fremsendelsen.",
    "",
    "Hvis der er fejl eller indsigelser, skal de sendes skriftligt inden samme frist med angivelse af, hvilke registreringer der bestrides, og hvorfor.",
    "",
    ...(options.contactInviteUrl
      ? [
          "LOGIN",
          "Åbn linket herunder for at gennemgå og godkende timesedlen:",
          "",
          options.contactInviteUrl,
          "",
          ...(t.contactPersonMustChangeAccessCode
            ? [
                "Log ind første gang med denne engangskode:",
                "",
                t.contactPersonAccessCode || "—",
                "",
                "Efter første login bliver du bedt om at ændre adgangskoden.",
              ]
            : ["Brug din personlige adgangskode, hvis du allerede har valgt en."]),
          "",
        ]
      : []),
    "TIMESSEDDEL TIL GODKENDELSE",
    "",
    "OPLYSNINGER",
    `Vikar: ${t.vikar || "—"}`,
    `Brugervirksomhed: ${t.brugervirksomhed || "—"}`,
    `Kontaktperson: ${t.kontaktperson || "—"}`,
    `Kontaktperson telefon: ${t.kontaktpersonPhone || "—"}`,
    `Reference: ${t.referenceNo || "—"}`,
    `Arbejdssted: ${t.arbejdssted || "—"}`,
    `Uge og dato: Uge ${weekNumber(t.weekStart)} (${formatDateLabel(t.weekStart)} – ${formatDateLabel(
      addDaysToISODate(t.weekStart, 6),
    )})`,
    "",
    "REGISTRERINGER",
    ...dayLines,
    "",
    "SAMLET TIMETAL",
    `${calc.total.toFixed(2)} timer`,
    "",
    "MANUELLE TILLÆG",
    ...manualAllowanceLines,
    "",
    "NOTER",
    t.notes || "—",
    "",
    "GODKENDELSE OG INDSIGELSER",
    "Timesedlen skal godkendes eller bestrides skriftligt senest tirsdag efter fremsendelsen.",
    "",
    "Hvis der ikke modtages godkendelse eller skriftlig indsigelse inden fristen, anses timesedlen som godkendt i henhold til de aftalte forretningsbetingelser.",
    "",
    ...(options.footerMessage ? [options.footerMessage, ""] : []),
    "Med venlig hilsen",
    "Sub-Z",
    "40601253",
    "timesheet@send.mathiasfriisandersen.dk",
  ].join("\n");
}

export function contactPersonEmailHtml(t: Timesheet, options: MailTextOptions = {}): string {
  const calc = calculateTimesheet(t);
  const dayRows = WEEKDAYS.map((name, index) => {
    const day = t.days[index];
    const date = addDaysToISODate(t.weekStart, index);
    const registration =
      day.absence !== "none"
        ? ABSENCE_LABEL[day.absence]
        : day.start && day.end
          ? `${day.start}–${day.end}, pause ${day.pause} min, ${dayHours(day).toFixed(2)} t`
          : "Ingen registrering";
    const delayedMealBreakDetail =
      isIndustriensAgreement(t.selectedAgreementId) &&
      day.absence === "none" &&
      delayedMealBreakTriggered(day)
        ? "Udsat spisepause 30+ min efter besked fra virksomheden"
        : "";
    const details = [
      day.taskType,
      day.workType !== "normal" ? WORK_TYPE_LABEL[day.workType] : "",
      explicitShiftWork(day) ? "Skiftehold markeret" : "",
      delayedMealBreakDetail,
      day.comment,
    ]
      .filter(Boolean)
      .join(" · ");
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#4b5563;white-space:nowrap;">${htmlEscape(
        `${name} ${formatDateLabel(date)}`,
      )}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#111827;">${htmlEscape(
        `${registration}${details ? ` (${details})` : ""}`,
      )}</td>
    </tr>`;
  }).join("");

  const manualAllowanceLines: string[] = [];
  if (isIndustriensAgreement(t.selectedAgreementId) && calc.delayedMealBreakDays > 0) {
    manualAllowanceLines.push(delayedMealBreakSummaryText(calc.delayedMealBreakDays));
  }
  if (manualAllowanceLines.length === 0) {
    manualAllowanceLines.push("Ingen manuelle tillæg registreret.");
  }

  const safeInviteUrl = options.contactInviteUrl ? htmlEscape(options.contactInviteUrl) : "";
  const loginBlock = options.contactInviteUrl
    ? `<h2 style="margin:24px 0 10px;font-size:16px;color:#111827;">Login</h2>
      <p style="margin:0 0 16px;line-height:1.5;">Åbn timesedlen via knappen herunder for at gennemgå og godkende den.</p>
      <p style="margin:0 0 18px;">
        <a href="${safeInviteUrl}" style="display:inline-block;background:#1f4e79;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">Åbn timeseddel</a>
      </p>
      <p style="margin:0 0 6px;color:#4b5563;font-size:13px;line-height:1.5;">Hvis knappen ikke virker, kan du kopiere dette link:</p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeInviteUrl}" style="color:#1f4e79;">${safeInviteUrl}</a></p>
      ${
        t.contactPersonMustChangeAccessCode
          ? `<p style="margin:0 0 6px;line-height:1.5;">Log ind første gang med denne engangskode:</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:700;letter-spacing:0.12em;">${htmlEscape(
        t.contactPersonAccessCode || "—",
      )}</p>
      <p style="margin:0 0 18px;color:#4b5563;line-height:1.5;">Efter første login bliver du bedt om at ændre adgangskoden.</p>`
          : `<p style="margin:0 0 18px;color:#4b5563;line-height:1.5;">Brug din personlige adgangskode, hvis du allerede har valgt en.</p>`
      }`
    : "";

  return `<!doctype html>
<html lang="da">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">Hej ${htmlEscape(t.kontaktperson || "kontaktperson")}</p>
      <p style="margin:0 0 14px;line-height:1.5;">Du modtager hermed timeseddel for ${htmlEscape(
        t.vikar || "vikaren",
      )} hos ${htmlEscape(t.brugervirksomhed || "brugervirksomheden")} for uge ${weekNumber(
        t.weekStart,
      )}.</p>
      <p style="margin:0 0 14px;line-height:1.5;">Vil du venligst gennemgå registreringerne og godkende timesedlen senest tirsdag efter fremsendelsen.</p>
      <p style="margin:0 0 18px;line-height:1.5;">Hvis der er fejl eller indsigelser, skal de sendes skriftligt inden samme frist med angivelse af, hvilke registreringer der bestrides, og hvorfor.</p>
      ${loginBlock}
      <h1 style="margin:24px 0 14px;font-size:20px;color:#111827;">Timeseddel til godkendelse</h1>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Oplysninger</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:22px;">
        <tbody>
          ${htmlRow("Vikar", t.vikar || "—")}
          ${htmlRow("Brugervirksomhed", t.brugervirksomhed || "—")}
          ${htmlRow("Kontaktperson", t.kontaktperson || "—")}
          ${htmlRow("Kontaktperson telefon", t.kontaktpersonPhone || "—")}
          ${htmlRow("Reference", t.referenceNo || "—")}
          ${htmlRow("Arbejdssted", t.arbejdssted || "—")}
          ${htmlRow("Uge og dato", `Uge ${weekNumber(t.weekStart)} (${formatDateLabel(t.weekStart)} – ${formatDateLabel(addDaysToISODate(t.weekStart, 6))})`)}
        </tbody>
      </table>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Registreringer</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:22px;">
        <tbody>${dayRows}</tbody>
      </table>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Samlet timetal</h2>
      <p style="margin:0 0 22px;font-size:18px;font-weight:700;">${calc.total.toFixed(2)} timer</p>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Manuelle tillæg</h2>
      <p style="margin:0 0 22px;line-height:1.5;">${htmlEscape(manualAllowanceLines.join(" · "))}</p>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Noter</h2>
      <p style="margin:0 0 22px;line-height:1.5;">${htmlEscape(t.notes || "—")}</p>
      <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Godkendelse og indsigelser</h2>
      <p style="margin:0 0 12px;line-height:1.5;">Timesedlen skal godkendes eller bestrides skriftligt senest tirsdag efter fremsendelsen.</p>
      <p style="margin:0 0 22px;line-height:1.5;">Hvis der ikke modtages godkendelse eller skriftlig indsigelse inden fristen, anses timesedlen som godkendt i henhold til de aftalte forretningsbetingelser.</p>
      ${options.footerMessage ? `<p style="margin:0 0 22px;line-height:1.5;">${htmlEscape(options.footerMessage)}</p>` : ""}
      <p style="margin:0;line-height:1.5;">Med venlig hilsen<br />Sub-Z<br />40601253<br />timesheet@send.mathiasfriisandersen.dk</p>
    </div>
  </body>
</html>`;
}

export function workerSubmissionReceiptSubject(t: Timesheet): string {
  const week = weekNumber(t.weekStart);
  if (t.workerLanguage === "en") return `Timesheet sent for approval – week ${week}`;
  if (t.workerLanguage === "pl")
    return `Karta czasu pracy wysłana do zatwierdzenia – tydzień ${week}`;
  return `Timeseddel sendt til godkendelse – uge ${week}`;
}

export function workerSubmissionReceiptBody(t: Timesheet, options: MailTextOptions = {}): string {
  const language = normalizeWorkerLanguage(t.workerLanguage);
  const calc = calculateTimesheet(t);
  const manualAllowanceLines: string[] = [];
  if (isIndustriensAgreement(t.selectedAgreementId) && calc.delayedMealBreakDays > 0) {
    manualAllowanceLines.push(delayedMealBreakSummaryText(calc.delayedMealBreakDays));
  }
  if (manualAllowanceLines.length === 0) {
    manualAllowanceLines.push(
      language === "en"
        ? "No manual allowances registered."
        : language === "pl"
          ? "Brak zarejestrowanych dodatków ręcznych."
          : "Ingen manuelle tillæg registreret.",
    );
  }

  const weekdayLabels =
    language === "en"
      ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      : language === "pl"
        ? ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
        : WEEKDAYS;
  const absenceLabels: Record<AbsenceType, string> =
    language === "en"
      ? { none: "", sick: "Sick", vacation: "Vacation", dayoff: "Day off" }
      : language === "pl"
        ? { none: "", sick: "Choroba", vacation: "Urlop", dayoff: "Dzień wolny" }
        : ABSENCE_LABEL;

  const dayLines = weekdayLabels.map((name, index) => {
    const day = t.days[index];
    const date = addDaysToISODate(t.weekStart, index);
    if (day.absence !== "none") {
      return `${name} ${formatDateLabel(date)}: ${absenceLabels[day.absence]}`;
    }
    if (!day.start || !day.end) {
      return `${name} ${formatDateLabel(date)}: ${
        language === "en" ? "No registration" : language === "pl" ? "Brak rejestracji" : "Ingen registrering"
      }`;
    }
    const pause = language === "pl" ? "przerwa" : "pause";
    const hours = language === "en" ? "hours" : language === "pl" ? "godz." : "timer";
    return `${name} ${formatDateLabel(date)}: ${day.start}–${day.end}, ${pause} ${
      day.pause
    } min. – ${dayHours(day).toFixed(2)} ${hours}`;
  });

  if (language === "en") {
    return [
      `Hi ${t.vikar || "worker"}`,
      "",
      "Thank you for your submission.",
      "",
      `Your timesheet for week ${weekNumber(t.weekStart)} has been sent for approval to ${
        t.kontaktperson || "the contact person"
      } at ${t.brugervirksomhed || "the company"}.`,
      "",
      "INFORMATION",
      `Worker: ${t.vikar || "—"}`,
      `Company: ${t.brugervirksomhed || "—"}`,
      `Contact person: ${t.kontaktperson || "—"}`,
      `Phone: ${t.kontaktpersonPhone || "—"}`,
      `Reference: ${t.referenceNo || "—"}`,
      `Workplace: ${t.arbejdssted || "—"}`,
      `Period: Week ${weekNumber(t.weekStart)} – ${formatDateLabel(t.weekStart)} to ${formatDateLabel(
        addDaysToISODate(t.weekStart, 6),
      )}`,
      "",
      "REGISTERED HOURS",
      ...dayLines,
      "",
      "TOTAL HOURS",
      `${calc.total.toFixed(2)} hours`,
      "",
      "MANUAL ALLOWANCES",
      ...manualAllowanceLines,
      "",
      "NOTES FROM WORKER",
      t.notes || "—",
      "",
      "STATUS",
      "The timesheet has been sent to the contact person for approval.",
      "",
      ...(options.footerMessage ? [options.footerMessage, ""] : []),
      "If you have questions about the registration, please contact us as soon as possible.",
      "",
      "Best regards",
      "Sub-Z",
      "40601253",
      "timesheet@send.mathiasfriisandersen.dk",
    ].join("\n");
  }

  if (language === "pl") {
    return [
      `Cześć ${t.vikar || "pracowniku"}`,
      "",
      "Dziękujemy za przesłanie karty czasu pracy.",
      "",
      `Twoja karta czasu pracy za tydzień ${weekNumber(t.weekStart)} została wysłana do zatwierdzenia do ${
        t.kontaktperson || "osoby kontaktowej"
      } w ${t.brugervirksomhed || "firmie"}.`,
      "",
      "INFORMACJE",
      `Pracownik: ${t.vikar || "—"}`,
      `Firma: ${t.brugervirksomhed || "—"}`,
      `Osoba kontaktowa: ${t.kontaktperson || "—"}`,
      `Telefon: ${t.kontaktpersonPhone || "—"}`,
      `Referencja: ${t.referenceNo || "—"}`,
      `Miejsce pracy: ${t.arbejdssted || "—"}`,
      `Okres: tydzień ${weekNumber(t.weekStart)} – ${formatDateLabel(t.weekStart)} do ${formatDateLabel(
        addDaysToISODate(t.weekStart, 6),
      )}`,
      "",
      "ZAREJESTROWANE GODZINY",
      ...dayLines,
      "",
      "ŁĄCZNA LICZBA GODZIN",
      `${calc.total.toFixed(2)} godz.`,
      "",
      "DODATKI RĘCZNE",
      ...manualAllowanceLines,
      "",
      "NOTATKI OD PRACOWNIKA",
      t.notes || "—",
      "",
      "STATUS",
      "Karta czasu pracy została wysłana do osoby kontaktowej w celu zatwierdzenia.",
      "",
      ...(options.footerMessage ? [options.footerMessage, ""] : []),
      "W razie pytań dotyczących rejestracji skontaktuj się z nami jak najszybciej.",
      "",
      "Z poważaniem",
      "Sub-Z",
      "40601253",
      "timesheet@send.mathiasfriisandersen.dk",
    ].join("\n");
  }

  return [
    `Hej ${t.vikar || "vikar"}`,
    "",
    "Tak for din indsendelse.",
    "",
    `Din timeseddel for uge ${weekNumber(t.weekStart)} er nu sendt til godkendelse hos ${
      t.kontaktperson || "kontaktpersonen"
    } hos ${t.brugervirksomhed || "brugervirksomheden"}.`,
    "",
    "OPLYSNINGER",
    `Vikar: ${t.vikar || "—"}`,
    `Brugervirksomhed: ${t.brugervirksomhed || "—"}`,
    `Kontaktperson: ${t.kontaktperson || "—"}`,
    `Telefon: ${t.kontaktpersonPhone || "—"}`,
    `Reference: ${t.referenceNo || "—"}`,
    `Arbejdssted: ${t.arbejdssted || "—"}`,
    `Periode: Uge ${weekNumber(t.weekStart)} – ${formatDateLabel(t.weekStart)} til ${formatDateLabel(
      addDaysToISODate(t.weekStart, 6),
    )}`,
    "",
    "REGISTREREDE TIMER",
    ...dayLines,
    "",
    "SAMLET TIMETAL",
    `${calc.total.toFixed(2)} timer`,
    "",
    "MANUELLE TILLÆG",
    ...manualAllowanceLines,
    "",
    "NOTER FRA VIKAREN",
    t.notes || "—",
    "",
    "STATUS",
    "Timesedlen er sendt til godkendelse hos kontaktpersonen.",
    "",
    ...(options.footerMessage ? [options.footerMessage, ""] : []),
    "Har du spørgsmål til registreringen, skal du kontakte os hurtigst muligt.",
    "",
    "Med venlig hilsen",
    "Sub-Z",
    "40601253",
    "timesheet@send.mathiasfriisandersen.dk",
  ].join("\n");
}

export function workerInviteEmailSubject(t: Timesheet): string {
  if (t.workerLanguage === "en")
    return `Timesheet created – ${t.brugervirksomhed} – week ${weekNumber(t.weekStart)}`;
  if (t.workerLanguage === "pl")
    return `Utworzono kartę czasu pracy – ${t.brugervirksomhed} – tydzień ${weekNumber(t.weekStart)}`;
  return `Timeseddel oprettet – ${t.brugervirksomhed} – uge ${weekNumber(t.weekStart)}`;
}

export function workerInviteEmailBody(t: Timesheet, inviteUrl: string): string {
  const language = normalizeWorkerLanguage(t.workerLanguage);
  const calc = calculateTimesheet(t);
  const defaultWorkday = t.days.find((day) => day.start && day.end);

  if (language === "en") {
    return [
      `Hi ${t.vikar || "worker"}`,
      "",
      "Sub-Z has created a timesheet for you with the following information:",
      "",
      "ASSIGNMENT INFORMATION",
      `Worker name: ${t.vikar}`,
      `Worker email: ${t.vikarEmail}`,
      `Company: ${t.brugervirksomhed}`,
      `Workplace address: ${t.arbejdssted}`,
      `Contact person: ${t.kontaktperson}`,
      `Contact phone: ${t.kontaktpersonPhone || "—"}`,
      `Contact email: ${t.kontaktpersonEmail}`,
      `Reference no.: ${t.referenceNo || "—"}`,
      `Collective agreement: ${calc.agreementName || "—"}`,
      `Work time: ${defaultWorkday?.start || "07:00"}–${defaultWorkday?.end || "15:30"}, break ${
        defaultWorkday?.pause || 60
      } min`,
      `Start date/week: Week ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
      "",
      "LOGIN",
      "Open the link below and log in the first time with this one-time code:",
      "",
      t.workerAccessCode || "—",
      "",
      "After your first login, you will be asked to change the password.",
      "The invitation link is valid for 7 days from creation.",
      "",
      "Open the timesheet using the button/link in the email.",
      "",
      "When you have completed or checked the hours, submit the timesheet for approval.",
    ].join("\n");
  }

  if (language === "pl") {
    return [
      `Cześć ${t.vikar || "pracowniku"}`,
      "",
      "Sub-Z utworzył dla Ciebie kartę czasu pracy z następującymi informacjami:",
      "",
      "INFORMACJE O ZLECENIU",
      `Imię i nazwisko pracownika: ${t.vikar}`,
      `E-mail pracownika: ${t.vikarEmail}`,
      `Firma: ${t.brugervirksomhed}`,
      `Adres/miejsce pracy: ${t.arbejdssted}`,
      `Osoba kontaktowa: ${t.kontaktperson}`,
      `Telefon kontaktowy: ${t.kontaktpersonPhone || "—"}`,
      `E-mail kontaktowy: ${t.kontaktpersonEmail}`,
      `Nr referencyjny: ${t.referenceNo || "—"}`,
      `Układ zbiorowy: ${calc.agreementName || "—"}`,
      `Czas pracy: ${defaultWorkday?.start || "07:00"}–${defaultWorkday?.end || "15:30"}, przerwa ${
        defaultWorkday?.pause || 60
      } min`,
      `Data startu/tydzień: tydzień ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
      "",
      "LOGOWANIE",
      "Otwórz poniższy link i przy pierwszym logowaniu użyj tego kodu jednorazowego:",
      "",
      t.workerAccessCode || "—",
      "",
      "Po pierwszym logowaniu zostaniesz poproszony o zmianę hasła.",
      "Link zaproszenia jest ważny przez 7 dni od utworzenia.",
      "",
      "Otwórz kartę czasu pracy za pomocą przycisku/linku w wiadomości.",
      "",
      "Po uzupełnieniu lub sprawdzeniu godzin wyślij kartę czasu pracy do zatwierdzenia.",
    ].join("\n");
  }

  return [
    `Hej ${t.vikar || "vikar"}`,
    "",
    "Sub-Z har oprettet en timeseddel til dig med følgende oplysninger:",
    "",
    "OPGAVEOPLYSNINGER",
    `Vikarnavn: ${t.vikar}`,
    `Vikarens mail: ${t.vikarEmail}`,
    `Brugervirksomhed: ${t.brugervirksomhed}`,
    `Brugervirksomhed adresse/arbejdssted: ${t.arbejdssted}`,
    `Kontaktperson: ${t.kontaktperson}`,
    `Kontaktperson telefonnummer: ${t.kontaktpersonPhone || "—"}`,
    `Kontaktpersonens mail: ${t.kontaktpersonEmail}`,
    `Reference nr.: ${t.referenceNo || "—"}`,
    `Overenskomst: ${calc.agreementName || "—"}`,
    `Timeløn: ${t.hourlyWage ? formatDkk(t.hourlyWage) : "—"}`,
    `Arbejdstid: ${defaultWorkday?.start || "07:00"}–${defaultWorkday?.end || "15:30"}, pause ${
      defaultWorkday?.pause || 60
    } min`,
    `Startdato/uge: Uge ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
    "",
    "LOGIN",
    "Åbn linket herunder og log ind første gang med denne engangskode:",
    "",
    t.workerAccessCode || "—",
    "",
    "Efter første login bliver du bedt om at ændre adgangskoden.",
    "Invitationslinket er gyldigt i 7 dage fra oprettelse.",
    "",
    "Åbn timesedlen via knappen/linket i mailen.",
    "",
    "Når du har udfyldt eller kontrolleret timerne, sender du timesedlen til godkendelse.",
  ].join("\n");
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#4b5563;">${htmlEscape(
    label,
  )}</td><td style="padding:6px 0;font-weight:600;color:#111827;">${htmlEscape(value || "—")}</td></tr>`;
}

export function workerInviteEmailHtml(t: Timesheet, inviteUrl: string): string {
  const language = normalizeWorkerLanguage(t.workerLanguage);
  const calc = calculateTimesheet(t);
  const defaultWorkday = t.days.find((day) => day.start && day.end);
  const safeName = htmlEscape(t.vikar || (language === "en" ? "worker" : language === "pl" ? "pracowniku" : "vikar"));
  const safeInviteUrl = htmlEscape(inviteUrl);
  const copy =
    language === "en"
      ? {
          htmlLang: "en",
          greeting: "Hi",
          intro:
            "Sub-Z has created a timesheet for you. Use the button below to open the timesheet.",
          button: "Open timesheet",
          loginIntro: "Log in the first time with this one-time code:",
          validity:
            "After your first login, you will be asked to change the password. The invitation link is valid for 7 days from creation.",
          footer:
            "When you have completed or checked the hours, submit the timesheet for approval.",
          workerName: "Worker name",
          company: "Company",
          workplace: "Workplace",
          contact: "Contact person",
          contactPhone: "Contact phone",
          reference: "Reference no.",
          agreement: "Collective agreement",
          wage: "Hourly wage",
          workTime: "Work time",
          startWeek: "Start date/week",
          pause: "break",
          week: "Week",
        }
      : language === "pl"
        ? {
            htmlLang: "pl",
            greeting: "Cześć",
            intro:
              "Sub-Z utworzył dla Ciebie kartę czasu pracy. Użyj przycisku poniżej, aby ją otworzyć.",
            button: "Otwórz kartę czasu pracy",
            loginIntro: "Przy pierwszym logowaniu użyj tego kodu jednorazowego:",
            validity:
              "Po pierwszym logowaniu zostaniesz poproszony o zmianę hasła. Link zaproszenia jest ważny przez 7 dni od utworzenia.",
            footer:
              "Po uzupełnieniu lub sprawdzeniu godzin wyślij kartę czasu pracy do zatwierdzenia.",
            workerName: "Pracownik",
            company: "Firma",
            workplace: "Miejsce pracy",
            contact: "Osoba kontaktowa",
            contactPhone: "Telefon kontaktowy",
            reference: "Nr referencyjny",
            agreement: "Układ zbiorowy",
            wage: "Stawka godzinowa",
            workTime: "Czas pracy",
            startWeek: "Data startu/tydzień",
            pause: "przerwa",
            week: "Tydzień",
          }
        : {
            htmlLang: "da",
            greeting: "Hej",
            intro:
              "Sub-Z har oprettet en timeseddel til dig. Brug knappen herunder til at åbne timesedlen.",
            button: "Åbn timeseddel",
            loginIntro: "Log ind første gang med denne engangskode:",
            validity:
              "Efter første login bliver du bedt om at ændre adgangskoden. Invitationslinket er gyldigt i 7 dage fra oprettelse.",
            footer:
              "Når du har udfyldt eller kontrolleret timerne, sender du timesedlen til godkendelse.",
            workerName: "Vikarnavn",
            company: "Brugervirksomhed",
            workplace: "Arbejdssted",
            contact: "Kontaktperson",
            contactPhone: "Kontaktperson telefon",
            reference: "Reference nr.",
            agreement: "Overenskomst",
            wage: "Timeløn",
            workTime: "Arbejdstid",
            startWeek: "Startdato/uge",
            pause: "pause",
            week: "Uge",
          };

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">${copy.greeting} ${safeName}</p>
      <p style="margin:0 0 18px;line-height:1.5;">${htmlEscape(copy.intro)}</p>
      <p style="margin:0 0 24px;">
        <a href="${safeInviteUrl}" style="display:inline-block;background:#1f4e79;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">${htmlEscape(copy.button)}</a>
      </p>
      <p style="margin:0 0 8px;font-weight:700;">Login</p>
      <p style="margin:0 0 6px;line-height:1.5;">${htmlEscape(copy.loginIntro)}</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:700;letter-spacing:0.12em;">${htmlEscape(
        t.workerAccessCode || "—",
      )}</p>
      <p style="margin:0 0 22px;color:#4b5563;line-height:1.5;">${htmlEscape(copy.validity)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tbody>
          ${htmlRow(copy.workerName, t.vikar)}
          ${htmlRow(copy.company, t.brugervirksomhed)}
          ${htmlRow(copy.workplace, t.arbejdssted)}
          ${htmlRow(copy.contact, t.kontaktperson)}
          ${htmlRow(copy.contactPhone, t.kontaktpersonPhone || "—")}
          ${htmlRow(copy.reference, t.referenceNo || "—")}
          ${htmlRow(copy.agreement, calc.agreementName || "—")}
          ${htmlRow(copy.wage, t.hourlyWage ? formatDkk(t.hourlyWage) : "—")}
          ${htmlRow(
            copy.workTime,
            `${defaultWorkday?.start || "—"}–${defaultWorkday?.end || "—"}, ${copy.pause} ${
              defaultWorkday?.pause || 0
            } min`,
          )}
          ${htmlRow(copy.startWeek, `${copy.week} ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`)}
        </tbody>
      </table>
      <p style="margin:22px 0 0;color:#4b5563;line-height:1.5;">${htmlEscape(copy.footer)}</p>
    </div>
  </body>
</html>`;
}

export function mailtoUrl(t: Timesheet): string {
  return `mailto:${t.kontaktpersonEmail}?subject=${encodeURIComponent(emailSubject(t))}&body=${encodeURIComponent(contactPersonEmailBody(t))}`;
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function timesheetsToCsv(list: Timesheet[]): string {
  const rows = [
    [
      "Vikar",
      "Virksomhed",
      "Kontaktperson",
      "Reference",
      "Uge",
      "Periode",
      "Overenskomst-ID",
      "Overenskomst",
      "PDF-status",
      "Lokalaftale",
      "Status",
      "Timer",
    ],
    ...list.map((t) => {
      const calc = calculateTimesheet(t);
      return [
        t.vikar,
        t.brugervirksomhed,
        t.kontaktperson,
        t.referenceNo,
        weekNumber(t.weekStart),
        formatWeekRange(t.weekStart),
        calc.agreementId,
        calc.agreementName,
        calc.rateValidationStatus,
        t.localAgreementApplies ? "Ja" : "Nej",
        STATUS_LABEL[t.status],
        totalHours(t.days).toFixed(2),
      ];
    }),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function timesheetsToCodeCsv(list: Timesheet[]): string {
  const rows = [
    [
      "Kode",
      "Virksomhed",
      "Kontaktperson",
      "Reference",
      "Uge",
      "Periode",
      "Overenskomst-ID",
      "Overenskomst",
      "PDF-status",
      "Lokalaftale",
      "Status",
      "Timer",
    ],
    ...list.map((t) => {
      const calc = calculateTimesheet(t);
      return [
        t.vikarCode || "",
        t.brugervirksomhed,
        t.kontaktperson,
        t.referenceNo,
        weekNumber(t.weekStart),
        formatWeekRange(t.weekStart),
        calc.agreementId,
        calc.agreementName,
        calc.rateValidationStatus,
        t.localAgreementApplies ? "Ja" : "Nej",
        STATUS_LABEL[t.status],
        totalHours(t.days).toFixed(2),
      ];
    }),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

type DemoWorkerSeed = {
  id: string;
  ownerRole: "bruger" | "bruger2";
  companyId: string;
  companyName: string;
  companyContactName: string;
  companyContactPhone: string;
  companyContactEmail: string;
  address: string;
  name: string;
  email: string;
  phone: string;
  agreementId: string;
  tradeSkill: TradeSkill;
  competencies: string;
  hourlyWage: number;
  workForm: "weekend" | "holiday" | "overtime" | "night" | "evening" | "shift" | "normal";
};

function demoWorkersSeed(): DemoWorkerSeed[] {
  return [
    {
      id: "demo-timesheet-bruger-1-weekend-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-industri",
      companyName: "Nordic Produktion",
      companyContactName: "Mette Holm",
      companyContactPhone: "28110001",
      companyContactEmail: "mette.holm@nordicproduktion.demo",
      address: "Fabrikvej 12, 6700 Esbjerg",
      name: "Weekendarbejde Vikar 1",
      email: "weekend1@demo-vikar.dk",
      phone: "30100001",
      agreementId: "industriens-overenskomst",
      tradeSkill: "Industri / produktion",
      competencies: "Pakning og weekendkoersel",
      hourlyWage: 198,
      workForm: "weekend",
    },
    {
      id: "demo-timesheet-bruger-1-helligdag-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-industri",
      companyName: "Nordic Produktion",
      companyContactName: "Mette Holm",
      companyContactPhone: "28110001",
      companyContactEmail: "mette.holm@nordicproduktion.demo",
      address: "Fabrikvej 12, 6700 Esbjerg",
      name: "Helligdag Vikar 1",
      email: "helligdag1@demo-vikar.dk",
      phone: "30100002",
      agreementId: "industri-trae-moebeloverenskomsten",
      tradeSkill: "Montage",
      competencies: "Linjemontage og opstart",
      hourlyWage: 205,
      workForm: "holiday",
    },
    {
      id: "demo-timesheet-bruger-1-overarbejde-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-industri",
      companyName: "Nordic Produktion",
      companyContactName: "Mette Holm",
      companyContactPhone: "28110001",
      companyContactEmail: "mette.holm@nordicproduktion.demo",
      address: "Fabrikvej 12, 6700 Esbjerg",
      name: "Overarbejde Vikar 1",
      email: "overarbejde1@demo-vikar.dk",
      phone: "30100003",
      agreementId: "trae-moebeloverenskomsten",
      tradeSkill: "Træ / møbel",
      competencies: "Samling og efterarbejde",
      hourlyWage: 202,
      workForm: "overtime",
    },
    {
      id: "demo-timesheet-bruger-1-nat-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-byg",
      companyName: "Vest Bygservice",
      companyContactName: "Lars Mikkelsen",
      companyContactPhone: "28110002",
      companyContactEmail: "lars@vestbygservice.demo",
      address: "Teglvangen 5, 6000 Kolding",
      name: "Natarbejde Vikar 1",
      email: "nat1@demo-vikar.dk",
      phone: "30100004",
      agreementId: "bygge-anlaegsoverenskomsten",
      tradeSkill: "Anlæg",
      competencies: "Natbeton og afspaerring",
      hourlyWage: 214,
      workForm: "night",
    },
    {
      id: "demo-timesheet-bruger-1-aften-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-byg",
      companyName: "Vest Bygservice",
      companyContactName: "Lars Mikkelsen",
      companyContactPhone: "28110002",
      companyContactEmail: "lars@vestbygservice.demo",
      address: "Teglvangen 5, 6000 Kolding",
      name: "Aftenarbejde Vikar 1",
      email: "aften1@demo-vikar.dk",
      phone: "30100005",
      agreementId: "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f",
      tradeSkill: "Byggeri / håndværk",
      competencies: "Aftenhold og oprydning",
      hourlyWage: 208,
      workForm: "evening",
    },
    {
      id: "demo-timesheet-bruger-1-skiftehold-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-byg",
      companyName: "Vest Bygservice",
      companyContactName: "Lars Mikkelsen",
      companyContactPhone: "28110002",
      companyContactEmail: "lars@vestbygservice.demo",
      address: "Teglvangen 5, 6000 Kolding",
      name: "Skiftehold Vikar 1",
      email: "skiftehold1@demo-vikar.dk",
      phone: "30100006",
      agreementId: "jord-betonoverenskomsten",
      tradeSkill: "Jord / beton",
      competencies: "Skiftehold paa betonstation",
      hourlyWage: 216,
      workForm: "shift",
    },
    {
      id: "demo-timesheet-bruger-1-dag-1",
      ownerRole: "bruger",
      companyId: "demo-company-bruger-1-byg",
      companyName: "Vest Bygservice",
      companyContactName: "Lars Mikkelsen",
      companyContactPhone: "28110002",
      companyContactEmail: "lars@vestbygservice.demo",
      address: "Teglvangen 5, 6000 Kolding",
      name: "Dagarbejde Vikar 1",
      email: "dag1@demo-vikar.dk",
      phone: "30100007",
      agreementId: "murer-murerarbejdsmandsarbejde",
      tradeSkill: "Murer",
      competencies: "Facade og fugearbejde",
      hourlyWage: 211,
      workForm: "normal",
    },
    {
      id: "demo-timesheet-bruger-2-weekend-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Weekendarbejde Vikar 2",
      email: "weekend2@demo-vikar.dk",
      phone: "30100008",
      agreementId: "isoleringsoverenskomsten",
      tradeSkill: "Isolering",
      competencies: "Weekendisolering paa teknikrum",
      hourlyWage: 207,
      workForm: "weekend",
    },
    {
      id: "demo-timesheet-bruger-2-weekend-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Weekendarbejde Vikar 3",
      email: "weekend3@demo-vikar.dk",
      phone: "30100009",
      agreementId: "maleroverenskomsten",
      tradeSkill: "Maler",
      competencies: "Spartel og finish i weekenden",
      hourlyWage: 199,
      workForm: "weekend",
    },
    {
      id: "demo-timesheet-bruger-2-helligdag-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Helligdag Vikar 2",
      email: "helligdag2@demo-vikar.dk",
      phone: "30100010",
      agreementId: "elektrikeroverenskomsten",
      tradeSkill: "Elektriker",
      competencies: "Fejlsoegning og service",
      hourlyWage: 223,
      workForm: "holiday",
    },
    {
      id: "demo-timesheet-bruger-2-helligdag-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Helligdag Vikar 3",
      email: "helligdag3@demo-vikar.dk",
      phone: "30100011",
      agreementId: "el-overenskomsten-di-def",
      tradeSkill: "El-installation",
      competencies: "Montage og tavlearbejde",
      hourlyWage: 226,
      workForm: "holiday",
    },
    {
      id: "demo-timesheet-bruger-2-overarbejde-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Overarbejde Vikar 2",
      email: "overarbejde2@demo-vikar.dk",
      phone: "30100012",
      agreementId: "vvs-overenskomsten",
      tradeSkill: "VVS",
      competencies: "Ekstra montage og trykproeve",
      hourlyWage: 219,
      workForm: "overtime",
    },
    {
      id: "demo-timesheet-bruger-2-overarbejde-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Overarbejde Vikar 3",
      email: "overarbejde3@demo-vikar.dk",
      phone: "30100013",
      agreementId: "industri-vvs-overenskomsten",
      tradeSkill: "Blikkenslager",
      competencies: "Kanalarbejde og indregulering",
      hourlyWage: 221,
      workForm: "overtime",
    },
    {
      id: "demo-timesheet-bruger-2-nat-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Natarbejde Vikar 2",
      email: "nat2@demo-vikar.dk",
      phone: "30100014",
      agreementId: "vvs-blikkenslageroverenskomsten",
      tradeSkill: "VVS",
      competencies: "Natservice og fejlretning",
      hourlyWage: 224,
      workForm: "night",
    },
    {
      id: "demo-timesheet-bruger-2-nat-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Natarbejde Vikar 3",
      email: "nat3@demo-vikar.dk",
      phone: "30100015",
      agreementId: "industriens-overenskomst",
      tradeSkill: "Smed / metal",
      competencies: "Svejs og reparation i natdrift",
      hourlyWage: 217,
      workForm: "night",
    },
    {
      id: "demo-timesheet-bruger-2-aften-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Aftenarbejde Vikar 2",
      email: "aften2@demo-vikar.dk",
      phone: "30100016",
      agreementId: "industri-trae-moebeloverenskomsten",
      tradeSkill: "CNC / maskinarbejde",
      competencies: "Aftenhold paa CNC-linje",
      hourlyWage: 213,
      workForm: "evening",
    },
    {
      id: "demo-timesheet-bruger-2-aften-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Aftenarbejde Vikar 3",
      email: "aften3@demo-vikar.dk",
      phone: "30100017",
      agreementId: "trae-moebeloverenskomsten",
      tradeSkill: "Tømrer / snedker",
      competencies: "Snedkeri og samling",
      hourlyWage: 206,
      workForm: "evening",
    },
    {
      id: "demo-timesheet-bruger-2-skiftehold-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Skiftehold Vikar 2",
      email: "skiftehold2@demo-vikar.dk",
      phone: "30100018",
      agreementId: "industrioverenskomsten-byggeri",
      tradeSkill: "Ufaglært / specialarbejder",
      competencies: "Skiftehold paa elementfabrik",
      hourlyWage: 204,
      workForm: "shift",
    },
    {
      id: "demo-timesheet-bruger-2-skiftehold-3",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-vvs",
      companyName: "Jysk VVS & Anlaeg",
      companyContactName: "Rasmus Toft",
      companyContactPhone: "28110004",
      companyContactEmail: "rasmus@jyskvvs.demo",
      address: "Anlaegsparken 9, 8200 Aarhus N",
      name: "Skiftehold Vikar 3",
      email: "skiftehold3@demo-vikar.dk",
      phone: "30100019",
      agreementId: "bygningsoverenskomsten",
      tradeSkill: "Murerarbejdsmand",
      competencies: "Materialelogistik i skiftehold",
      hourlyWage: 203,
      workForm: "shift",
    },
    {
      id: "demo-timesheet-bruger-2-dag-2",
      ownerRole: "bruger2",
      companyId: "demo-company-bruger-2-el",
      companyName: "Sub-Z El & Montage",
      companyContactName: "Camilla Birk",
      companyContactPhone: "28110003",
      companyContactEmail: "camilla@subzelmontage.demo",
      address: "Havnevej 22, 7100 Vejle",
      name: "Dagarbejde Vikar 2",
      email: "dag2@demo-vikar.dk",
      phone: "30100020",
      agreementId: "bygge-anlaegsoverenskomsten",
      tradeSkill: "Montage",
      competencies: "Daghold og udfoerende montage",
      hourlyWage: 210,
      workForm: "normal",
    },
  ];
}

function demoDayPlan(workForm: DemoWorkerSeed["workForm"], index: number): CreateWorkerDayPlan {
  const base = {
    start: "",
    end: "",
    pause: 0,
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
  };
  const weekday = index < 5;
  if (workForm === "weekend") {
    if (index !== 5 && index !== 6) return base;
    return {
      ...base,
      start: index === 5 ? "08:00" : "09:00",
      end: index === 5 ? "16:00" : "15:00",
      pause: 30,
      pauseStart: "11:00",
      pauseEnd: "11:30",
      dayWorkStart: index === 5 ? "08:00" : "09:00",
      dayWorkEnd: index === 5 ? "16:00" : "15:00",
    };
  }
  if (workForm === "holiday") {
    if (index !== 3) return base;
    return {
      ...base,
      start: "07:00",
      end: "15:00",
      pause: 30,
      pauseStart: "11:00",
      pauseEnd: "11:30",
      dayWorkStart: "07:00",
      dayWorkEnd: "15:00",
    };
  }
  if (workForm === "overtime") {
    if (!weekday) return base;
    const late = index === 1 || index === 3;
    return {
      ...base,
      start: "07:00",
      end: late ? "18:00" : "16:30",
      pause: 30,
      pauseStart: "11:30",
      pauseEnd: "12:00",
      dayWorkStart: "07:00",
      dayWorkEnd: late ? "18:00" : "16:30",
    };
  }
  if (workForm === "night") {
    if (!weekday) return base;
    return {
      ...base,
      start: "22:00",
      end: "06:00",
      pause: 30,
      pauseStart: "02:00",
      pauseEnd: "02:30",
      nightWorkStart: "22:00",
      nightWorkEnd: "06:00",
    };
  }
  if (workForm === "evening") {
    if (!weekday) return base;
    return {
      ...base,
      start: "14:00",
      end: "22:00",
      pause: 30,
      pauseStart: "18:00",
      pauseEnd: "18:30",
      eveningWorkStart: "14:00",
      eveningWorkEnd: "22:00",
    };
  }
  if (workForm === "shift") {
    if (!weekday) return base;
    return {
      ...base,
      start: "06:00",
      end: "14:00",
      pause: 30,
      pauseStart: "10:00",
      pauseEnd: "10:30",
      dayWorkStart: "06:00",
      dayWorkEnd: "14:00",
      shiftWork: true,
    };
  }
  if (!weekday) return base;
  return {
    ...base,
    start: "07:00",
    end: "15:00",
    pause: 30,
    pauseStart: "11:00",
    pauseEnd: "11:30",
    dayWorkStart: "07:00",
    dayWorkEnd: "15:00",
  };
}

function createDemoTimesheet(worker: DemoWorkerSeed, weekStart: string): Timesheet {
  const projectId = `${worker.id}-project`;
  const projectName = `${worker.name} projekt`;
  const timesheet = createTimesheetForWorker({
    vikar: worker.name,
    vikarEmail: worker.email,
    vikarPhone: worker.phone,
    tradeSkills: [worker.tradeSkill],
    competencies: worker.competencies,
    brugervirksomhed: worker.companyName,
    companyId: worker.companyId,
    projectId,
    projectName,
    projectEndDate: addDaysToISODate(weekStart, 28),
    arbejdssted: worker.address,
    kontaktperson: worker.companyContactName,
    kontaktpersonPhone: worker.companyContactPhone,
    kontaktpersonEmail: worker.companyContactEmail,
    referenceNo: `REF-${worker.id.slice(-4).toUpperCase()}`,
    selectedAgreementId: worker.agreementId,
    hourlyWage: worker.hourlyWage,
    defaultStart:
      worker.workForm === "night" ? "22:00" : worker.workForm === "evening" ? "14:00" : "07:00",
    defaultEnd:
      worker.workForm === "night" ? "06:00" : worker.workForm === "evening" ? "22:00" : "15:00",
    defaultPause: 30,
    defaultPauseStart:
      worker.workForm === "night" ? "02:00" : worker.workForm === "evening" ? "18:00" : "11:00",
    defaultPauseEnd:
      worker.workForm === "night" ? "02:30" : worker.workForm === "evening" ? "18:30" : "11:30",
    defaultDayWorkStart: "07:00",
    defaultDayWorkEnd: "15:00",
    defaultEveningWorkStart: "14:00",
    defaultEveningWorkEnd: "22:00",
    defaultNightWorkStart: "22:00",
    defaultNightWorkEnd: "06:00",
    shiftWorkApplies: worker.workForm === "shift",
    weekPlan: Array.from({ length: 7 }, (_, index) => demoDayPlan(worker.workForm, index)),
    startDate: weekStart,
    workerAccessCode: "0000",
    contactPersonAccessCode: "0000",
  });

  const days = timesheet.days.map((day, index) => {
    const nextDay = { ...day };
    if (worker.workForm === "holiday" && index === 3) {
      nextDay.dayType = "sunday_or_public_holiday";
      nextDay.isArtificialHolidayTest = true;
      nextDay.taskType = "Helligdagsvagt";
      nextDay.comment = "Demo: behandles som helligdag";
    }
    if (worker.workForm === "weekend" && (index === 5 || index === 6)) {
      nextDay.workType = "weekend_work_agreement";
      nextDay.weekendAgreementApplies = true;
      nextDay.taskType = "Weekendarbejde";
    }
    if (worker.workForm === "overtime" && (index === 1 || index === 3)) {
      nextDay.workType = "overtime";
      nextDay.taskType = "Overarbejde";
    }
    if (worker.workForm === "night") nextDay.taskType = "Nathold";
    if (worker.workForm === "evening") nextDay.taskType = "Aftenhold";
    if (worker.workForm === "shift") {
      nextDay.workType = "shift_work";
      nextDay.shiftWork = true;
      nextDay.taskType = "Skiftehold";
    }
    if (worker.workForm === "normal") nextDay.taskType = "Daghold";
    return nextDay;
  });

  return normalizeTimesheet({
    ...timesheet,
    id: worker.id,
    status: worker.ownerRole === "bruger2" ? "sent" : "approved",
    workerMustChangeAccessCode: false,
    contactPersonMustChangeAccessCode: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    days,
  });
}

function demoCompaniesForSeed(weekStart: string, workers: DemoWorkerSeed[]): Company[] {
  const byId = new Map<string, Company>();
  for (const worker of workers) {
    if (!byId.has(worker.companyId)) {
      byId.set(worker.companyId, {
        id: worker.companyId,
        name: worker.companyName,
        ownerRole: worker.ownerRole,
        cvrNumber: "",
        contactName: worker.companyContactName,
        contactPhone: worker.companyContactPhone,
        contactEmail: worker.companyContactEmail,
        address: worker.address,
        selectedAgreementId: worker.agreementId,
        localAgreements: [],
        projects: [],
      });
    }
    byId.get(worker.companyId)?.projects.push({
      id: `${worker.id}-project`,
      name: `${worker.name} projekt`,
      contactName: worker.companyContactName,
      contactPhone: worker.companyContactPhone,
      contactEmail: worker.companyContactEmail,
      referenceNo: `REF-${worker.id.slice(-4).toUpperCase()}`,
      startDate: weekStart,
      endDate: addDaysToISODate(weekStart, 28),
      selectedAgreementId: worker.agreementId,
      tradeSkills: [worker.tradeSkill],
      competencies: worker.competencies,
      workerEmails: [worker.email],
      workPeriod:
        worker.workForm === "night" ? "night" : worker.workForm === "evening" ? "evening" : "day",
      defaultStart:
        worker.workForm === "night" ? "22:00" : worker.workForm === "evening" ? "14:00" : "07:00",
      defaultEnd:
        worker.workForm === "night" ? "06:00" : worker.workForm === "evening" ? "22:00" : "15:00",
      pauseStart:
        worker.workForm === "night" ? "02:00" : worker.workForm === "evening" ? "18:00" : "11:00",
      pauseEnd:
        worker.workForm === "night" ? "02:30" : worker.workForm === "evening" ? "18:30" : "11:30",
      pause2Start: "",
      pause2End: "",
    });
  }

  byId.set("demo-company-admin-pending", {
    id: "demo-company-admin-pending",
    name: "Admin Demo Virksomhed",
    cvrNumber: "",
    contactName: "Admin Kontakt",
    contactPhone: "28110005",
    contactEmail: "admin@demo-virksomhed.demo",
    address: "Kontorparken 1, 2100 Koebenhavn O",
    selectedAgreementId: "industri-trae-moebeloverenskomsten",
    localAgreements: [],
    projects: [
      {
        id: "demo-project-admin-pending-1",
        name: "Afventer placering",
        contactName: "Admin Kontakt",
        contactPhone: "28110005",
        contactEmail: "admin@demo-virksomhed.demo",
        referenceNo: "ADM-100",
        startDate: weekStart,
        endDate: addDaysToISODate(weekStart, 28),
        selectedAgreementId: "industri-trae-moebeloverenskomsten",
        tradeSkills: ["Industri / produktion"],
        competencies: "Virksomhed uden ejer vises kun for admin",
        workerEmails: [],
        workPeriod: "day",
        defaultStart: "07:00",
        defaultEnd: "15:00",
        pauseStart: "11:00",
        pauseEnd: "11:30",
        pause2Start: "",
        pause2End: "",
      },
    ],
  });

  return [...byId.values()].map(normalizeCompany);
}

// Kept for backwards compatibility with the existing hook. New installations start empty.
export function seedIfEmpty(): void {
  const weekStart = getMondayISO();
  const demoWorkers = demoWorkersSeed();
  const demoTimesheets = demoWorkers.map((worker) => createDemoTimesheet(worker, weekStart));
  const demoCompanies = demoCompaniesForSeed(weekStart, demoWorkers);
  const existingTimesheets = readTimesheets();
  const existingCompanies = listCompanies();

  if (localUpdatedAt() || existingTimesheets.length > 0 || existingCompanies.length > 0) {
    return;
  }

  const mergedTimesheets = [
    ...existingTimesheets.filter((item) => !item.id.startsWith("demo-timesheet-")),
    ...demoTimesheets,
  ];
  const mergedCompanies = [
    ...existingCompanies.filter((company) => !company.id.startsWith("demo-company-")),
    ...demoCompanies,
  ];

  const hasCurrentDemoTimesheets = demoTimesheets.every((demoTimesheet) =>
    existingTimesheets.some(
      (item) => item.id === demoTimesheet.id && item.ownerRole === demoTimesheet.ownerRole,
    ),
  );
  const hasCurrentDemoCompanies = demoCompanies.every((demoCompany) =>
    existingCompanies.some(
      (company) => company.id === demoCompany.id && company.ownerRole === demoCompany.ownerRole,
    ),
  );

  if (hasCurrentDemoTimesheets && hasCurrentDemoCompanies) {
    return;
  }

  setStorageItem(TIMESHEET_KEY, JSON.stringify(mergedTimesheets));
  setStorageItem(COMPANY_KEY, JSON.stringify(mergedCompanies));
  markLocalUpdated();
  queueRemoteAppStatePersist();
  emit();
}
