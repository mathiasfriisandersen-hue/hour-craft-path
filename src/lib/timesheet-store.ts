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
  vikar: string;
  vikarEmail: string;
  vikarPhone?: string;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  brugervirksomhed: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  kontaktperson: string;
  kontaktpersonPhone: string;
  kontaktpersonEmail: string;
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
  rejectionComment?: string;
  createdAt: string;
  updatedAt: string;
};

export type Company = {
  id: string;
  name: string;
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
  vikarPhone?: string;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  kontaktpersonPhone?: string;
  hourlyWage?: number;
  workerAccessCode?: string;
  workerMustChangeAccessCode?: boolean;
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
  };
}

function normalizeCompany(company: StoredCompany): Company {
  return {
    ...company,
    contactPhone: company.contactPhone ?? "",
    selectedAgreementId: company.selectedAgreementId ?? "",
    localAgreements: company.localAgreements ?? [],
    projects: (company.projects ?? []).map(normalizeProject),
  };
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
    vikarEmail: value.vikarEmail ?? "",
    vikarPhone: value.vikarPhone ?? "",
    tradeSkills: normalizeTradeSkills(value.tradeSkills),
    competencies: value.competencies ?? "",
    companyId: value.companyId ?? "",
    projectId: value.projectId ?? "",
    projectName: value.projectName ?? "",
    kontaktpersonPhone: value.kontaktpersonPhone ?? "",
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

export function upsert(t: Timesheet): Timesheet {
  const list = readTimesheets();
  const updated = normalizeTimesheet({ ...t, updatedAt: new Date().toISOString() });
  const index = list.findIndex((item) => item.id === t.id);
  if (index >= 0) list[index] = updated;
  else list.push(updated);
  writeTimesheets(list);
  return updated;
}

export function remove(id: string): void {
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
    vikar: "",
    vikarEmail: "",
    vikarPhone: "",
    tradeSkills: [],
    competencies: "",
    brugervirksomhed: "",
    companyId: "",
    projectId: "",
    projectName: "",
    kontaktperson: "",
    kontaktpersonPhone: "",
    kontaktpersonEmail: "",
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
    createdAt: now,
    updatedAt: now,
  };
}

export type CreateWorkerTimesheetInput = {
  vikar: string;
  vikarEmail: string;
  vikarPhone?: string;
  tradeSkills?: TradeSkill[];
  competencies?: string;
  brugervirksomhed: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
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
    vikar: input.vikar.trim(),
    vikarEmail: input.vikarEmail.trim(),
    vikarPhone: input.vikarPhone?.trim() ?? "",
    tradeSkills: normalizeTradeSkills(input.tradeSkills),
    competencies: input.competencies?.trim() ?? "",
    brugervirksomhed: input.brugervirksomhed.trim(),
    companyId: input.companyId ?? "",
    projectId: input.projectId ?? "",
    projectName: input.projectName ?? "",
    arbejdssted: input.arbejdssted.trim(),
    kontaktperson: input.kontaktperson.trim(),
    kontaktpersonPhone: input.kontaktpersonPhone.trim(),
    kontaktpersonEmail: input.kontaktpersonEmail.trim(),
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
  setStorageItem(COMPANY_KEY, JSON.stringify(list));
  markLocalUpdated();
  queueRemoteAppStatePersist();
  emit();
}

export function removeCompany(id: string): void {
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
  const byId = new Map<string, Timesheet>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) {
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mergeCompanies(local: Company[], remote: Company[], preferLocal: boolean): Company[] {
  const byId = new Map<string, Company>();
  for (const item of preferLocal ? remote : local) byId.set(item.id, item);
  for (const item of preferLocal ? local : remote) byId.set(item.id, item);
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
  name: string;
  email: string;
  phone: string;
  tradeSkills: TradeSkill[];
  competencies: string;
};

export function listKnownWorkers(): KnownWorker[] {
  const byEmail = new Map<string, KnownWorker>();
  for (const timesheet of readTimesheets()) {
    const email = timesheet.vikarEmail.trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
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
    byEmail.set(email, {
      name: timesheet.vikar || existing?.name || email,
      email: timesheet.vikarEmail,
      phone: timesheet.vikarPhone || existing?.phone || "",
      tradeSkills,
      competencies,
    });
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
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

export function workerSubmissionReceiptSubject(t: Timesheet): string {
  return `Timeseddel sendt til godkendelse – uge ${weekNumber(t.weekStart)}`;
}

export function workerSubmissionReceiptBody(t: Timesheet, options: MailTextOptions = {}): string {
  const calc = calculateTimesheet(t);
  const manualAllowanceLines: string[] = [];
  if (isIndustriensAgreement(t.selectedAgreementId) && calc.delayedMealBreakDays > 0) {
    manualAllowanceLines.push(delayedMealBreakSummaryText(calc.delayedMealBreakDays));
  }
  if (manualAllowanceLines.length === 0) {
    manualAllowanceLines.push("Ingen manuelle tillæg registreret.");
  }

  const dayLines = WEEKDAYS.map((name, index) => {
    const day = t.days[index];
    const date = addDaysToISODate(t.weekStart, index);
    if (day.absence !== "none") {
      return `${name} ${formatDateLabel(date)}: ${ABSENCE_LABEL[day.absence]}`;
    }
    if (!day.start || !day.end) {
      return `${name} ${formatDateLabel(date)}: Ingen registrering`;
    }
    return `${name} ${formatDateLabel(date)}: ${day.start}–${day.end}, pause ${
      day.pause
    } min. – ${dayHours(day).toFixed(2)} timer`;
  });

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
  return `Timeseddel oprettet – ${t.brugervirksomhed} – uge ${weekNumber(t.weekStart)}`;
}

export function workerInviteEmailBody(t: Timesheet, inviteUrl: string): string {
  const calc = calculateTimesheet(t);
  const defaultWorkday = t.days.find((day) => day.start && day.end);

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
  const calc = calculateTimesheet(t);
  const defaultWorkday = t.days.find((day) => day.start && day.end);
  const safeName = htmlEscape(t.vikar || "vikar");
  const safeInviteUrl = htmlEscape(inviteUrl);

  return `<!doctype html>
<html lang="da">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">Hej ${safeName}</p>
      <p style="margin:0 0 18px;line-height:1.5;">Sub-Z har oprettet en timeseddel til dig. Brug knappen herunder til at åbne timesedlen.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeInviteUrl}" style="display:inline-block;background:#1f4e79;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">Åbn timeseddel</a>
      </p>
      <p style="margin:0 0 8px;font-weight:700;">Login</p>
      <p style="margin:0 0 6px;line-height:1.5;">Log ind første gang med denne engangskode:</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:700;letter-spacing:0.12em;">${htmlEscape(
        t.workerAccessCode || "—",
      )}</p>
      <p style="margin:0 0 22px;color:#4b5563;line-height:1.5;">Efter første login bliver du bedt om at ændre adgangskoden. Invitationslinket er gyldigt i 7 dage fra oprettelse.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tbody>
          ${htmlRow("Vikarnavn", t.vikar)}
          ${htmlRow("Brugervirksomhed", t.brugervirksomhed)}
          ${htmlRow("Arbejdssted", t.arbejdssted)}
          ${htmlRow("Kontaktperson", t.kontaktperson)}
          ${htmlRow("Kontaktperson telefon", t.kontaktpersonPhone || "—")}
          ${htmlRow("Reference nr.", t.referenceNo || "—")}
          ${htmlRow("Overenskomst", calc.agreementName || "—")}
          ${htmlRow("Timeløn", t.hourlyWage ? formatDkk(t.hourlyWage) : "—")}
          ${htmlRow(
            "Arbejdstid",
            `${defaultWorkday?.start || "—"}–${defaultWorkday?.end || "—"}, pause ${
              defaultWorkday?.pause || 0
            } min`,
          )}
          ${htmlRow("Startdato/uge", `Uge ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`)}
        </tbody>
      </table>
      <p style="margin:22px 0 0;color:#4b5563;line-height:1.5;">Når du har udfyldt eller kontrolleret timerne, sender du timesedlen til godkendelse.</p>
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

// Kept for backwards compatibility with the existing hook. New installations start empty.
export function seedIfEmpty(): void {}
