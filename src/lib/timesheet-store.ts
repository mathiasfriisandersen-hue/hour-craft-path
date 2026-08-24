import {
  activeCollectiveAgreements,
  collectiveAgreements,
  getCollectiveAgreementById,
  getCollectiveAgreementByName,
  normalizeCollectiveAgreementId,
} from "./collectiveAgreements";
import {
  AGREEMENT_RULE_SOURCE_LABEL,
  agreementRuleText,
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
import {
  invoicePeriodTone,
  isoDateOrNull,
  type InvoicePeriodStatusInput,
  type InvoicePeriodTone,
} from "./invoice-period-status";
import { calculateTimesheetSummary } from "./timesheetCalculationService";

export { invoicePeriodTone, type InvoicePeriodStatusInput, type InvoicePeriodTone };

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
  invoiceArchivedAt?: string;
  calendarStatus?: "planned";
  calendarSource?: "project-mail";
  projectMailSentAt?: string;
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
  referenceNo: string;
  arbejdssted: string;
  selectedAgreementId: string;
  overenskomst?: string;
  hourlyWage: number;
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
  invoiceSentDate?: string;
  payrollSentDate?: string;
  payrollBookkeepingApprovedDate?: string;
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

export type InvoiceBookingPeriod = {
  startDate: string;
  endDate: string;
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
const TIMESHEET_API_SYNC_STATUS_KEY = "timesheet-api-sync-status-v1";
export const INDUSTRIENS_AGREEMENT_ID = "industriens-overenskomst";
export const DELAYED_MEAL_BREAK_RATE_DKK: null = null;

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
  void days;
  return 0;
}

export function delayedMealBreakCalculationText(days: number): string {
  return `${days} ${
    days === 1 ? "dag" : "dage"
  } – Kræver manuel validering; ingen sats anvendes automatisk`;
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
  hourlyWage?: number;
  archived?: boolean;
  workerInactive?: boolean;
  workerConsentInactive?: boolean;
  workerConsentRenewalSentAt?: string;
  workerConsentRenewedAt?: string;
  invoiceDueDate?: string;
  payrollDeadline?: string;
  invoiceNumber?: string;
  invoiceSentDate?: string;
  payrollSentDate?: string;
  payrollBookkeepingApprovedDate?: string;
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

function normalizeStoredAgreementId(id?: string, agreementName?: string) {
  const namedAgreementId = agreementName
    ? getCollectiveAgreementByName(agreementName)?.id
    : undefined;
  return normalizeCollectiveAgreementId(id || namedAgreementId);
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
    selectedAgreementId: normalizeStoredAgreementId(project.selectedAgreementId),
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
    selectedAgreementId: normalizeStoredAgreementId(company.selectedAgreementId),
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
  const cleanValue = Object.fromEntries(
    Object.entries(value).filter(([key]) => !isLegacyAccessCredentialKey(key)),
  ) as StoredTimesheet;
  const days = Array.from({ length: 7 }, (_, index) => normalizeDay(value.days?.[index], index));
  const migratedAgreementId = normalizeStoredAgreementId(
    value.selectedAgreementId,
    value.overenskomst ?? "",
  );
  const agreementName =
    getCollectiveAgreementById(migratedAgreementId)?.name ?? value.overenskomst ?? "";
  const localAgreementApplies = value.localAgreementApplies ?? value.lokalaftale ?? false;
  return {
    ...cleanValue,
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
    referenceNo: value.referenceNo ?? "",
    hourlyWage: Number(value.hourlyWage) || 0,
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
    invoiceSentDate: value.invoiceSentDate ?? "",
    payrollSentDate: value.payrollSentDate ?? "",
    payrollBookkeepingApprovedDate: value.payrollBookkeepingApprovedDate ?? "",
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

export function resolveInvoiceBookingPeriod(
  timesheet: Timesheet,
  companies: Company[],
): InvoiceBookingPeriod | null {
  const company = findTimesheetCompany(timesheet, companies);
  if (!company) return null;

  const project = findTimesheetProject(timesheet, company);
  if (!project || !projectIsLinkedToTimesheet(project, timesheet)) return null;

  const startDate = isoDateOrNull(project.startDate);
  const endDate = isoDateOrNull(project.endDate);
  if (!startDate || !endDate) return null;

  return { startDate, endDate };
}

function findTimesheetCompany(timesheet: Timesheet, companies: Company[]): Company | undefined {
  if (timesheet.companyId) {
    const byId = companies.find((company) => company.id === timesheet.companyId);
    if (byId) return byId;
  }
  const companyName = invoiceReferenceKey(timesheet.brugervirksomhed);
  return companies.find((company) => invoiceReferenceKey(company.name) === companyName);
}

function findTimesheetProject(timesheet: Timesheet, company: Company): CompanyProject | undefined {
  if (timesheet.projectId) {
    return company.projects.find((project) => project.id === timesheet.projectId);
  }

  const projectName = invoiceReferenceKey(timesheet.projectName ?? "");
  if (!projectName) return undefined;

  const matches = company.projects.filter(
    (project) => invoiceReferenceKey(project.name) === projectName,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function projectIsLinkedToTimesheet(project: CompanyProject, timesheet: Timesheet): boolean {
  if (!project.workerEmails.length) return Boolean(timesheet.projectId || timesheet.projectName);
  return project.workerEmails.some((reference) =>
    projectReferenceMatchesTimesheet(reference, timesheet),
  );
}

function projectReferenceMatchesTimesheet(reference: string, timesheet: Timesheet): boolean {
  const referenceKey = invoiceReferenceKey(reference);
  if (!referenceKey) return false;
  return [timesheet.vikar, timesheet.vikarCode ?? "", timesheet.vikarEmail]
    .map(invoiceReferenceKey)
    .some((key) => key && key === referenceKey);
}

function invoiceReferenceKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
  void key;
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function normalizedStorageName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function isSensitiveBrowserField(key: string): boolean {
  const normalized = normalizedStorageName(key);
  return (
    normalized.includes("cpr") ||
    normalized.includes("password") ||
    normalized.includes("passcode") ||
    normalized.includes("accesscode") ||
    normalized.endsWith("vikarcode") ||
    normalized.endsWith("workercode") ||
    normalized.endsWith("kontaktpersoncode") ||
    normalized.endsWith("contactpersoncode") ||
    normalized.endsWith("token") ||
    normalized.includes("authorization") ||
    normalized.includes("credential") ||
    normalized.includes("secret") ||
    normalized.includes("apikey")
  );
}

export function sanitizeSensitiveBrowserData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSensitiveBrowserData(entry)) as T;
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitiveBrowserField(key))
      .map(([key, entry]) => [key, sanitizeSensitiveBrowserData(entry)]),
  ) as T;
}

function sanitizeSerializedStorageValue(value: string): { value: string; changed: boolean } {
  try {
    const parsed: unknown = JSON.parse(value);
    const sanitized = sanitizeSensitiveBrowserData(parsed);
    const serialized = JSON.stringify(sanitized);
    return { value: serialized, changed: serialized !== value };
  } catch {
    return { value, changed: false };
  }
}

function safeParse<T>(key: string, fallback: T): T {
  const storage = storageForKey(key);
  if (!storage) return fallback;
  try {
    let raw = storage.getItem(key);
    if (!raw && typeof window !== "undefined") {
      raw = window.sessionStorage.getItem(key);
      if (raw) {
        setStorageItem(key, raw);
      }
    }
    if (!raw) return fallback;
    const sanitized = sanitizeSerializedStorageValue(raw);
    if (sanitized.changed) storage.setItem(key, sanitized.value);
    return JSON.parse(sanitized.value) as T;
  } catch {
    return fallback;
  }
}

function setStorageItem(key: string, value: string): void {
  const storage = storageForKey(key);
  if (!storage) return;
  if (isSensitiveBrowserField(key)) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, sanitizeSerializedStorageValue(value).value);
}

function removeStorageItem(key: string): void {
  storageForKey(key)?.removeItem(key);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(key);
  }
}

export function scrubSensitiveBrowserStorage(): void {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const relevantKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => Boolean(key))
        .filter((key) => /^(?:timesheet|timeseddel)/iu.test(key));
      for (const key of relevantKeys) {
        if (isSensitiveBrowserField(key)) {
          storage.removeItem(key);
          continue;
        }
        const current = storage.getItem(key);
        if (!current) continue;
        const sanitized = sanitizeSerializedStorageValue(current);
        if (sanitized.changed) storage.setItem(key, sanitized.value);
      }
    } catch {
      // Rensningen kopierer eller logger aldrig lagrede værdier.
    }
  }
}

scrubSensitiveBrowserStorage();

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

function markLocalUpdated(updatedAt = new Date().toISOString()): void {
  setStorageItem(APP_STATE_META_KEY, updatedAt);
}

type TimesheetApiSyncStatus = {
  mode: "api" | "fallback";
  message: string;
  updatedAt: string;
};

function setTimesheetApiSyncStatus(mode: TimesheetApiSyncStatus["mode"], message: string): void {
  const status: TimesheetApiSyncStatus = {
    mode,
    message,
    updatedAt: new Date().toISOString(),
  };
  setStorageItem(TIMESHEET_API_SYNC_STATUS_KEY, JSON.stringify(status));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("timesheet-api-sync-status-changed"));
  }
  if (mode === "fallback") {
    console.warn(`[timesheet-api] ${message}`);
  }
}

export function getTimesheetApiSyncStatus(): TimesheetApiSyncStatus {
  return safeParse<TimesheetApiSyncStatus>(TIMESHEET_API_SYNC_STATUS_KEY, {
    mode: "fallback",
    message:
      "Legacy app-state-synkronisering er fjernet. Forretningsdata skal læses og skrives via den autentificerede D1 API.",
    updatedAt: "",
  });
}

function readTimesheets(): Timesheet[] {
  const stored = safeParse<StoredTimesheet[]>(TIMESHEET_KEY, []);
  const normalized = stored.map(normalizeTimesheet);
  if (stored.some((item) => Object.keys(item).some(isLegacyAccessCredentialKey))) {
    setStorageItem(TIMESHEET_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function isLegacyAccessCredentialKey(key: string): boolean {
  const normalized = normalizedStorageName(key);
  return /^(?:worker|contactperson)(?:mustchange)?accesscode$/u.test(normalized);
}

function writeTimesheets(list: Timesheet[], options: { syncRemote?: boolean } = {}): void {
  setStorageItem(TIMESHEET_KEY, JSON.stringify(sanitizeSensitiveBrowserData(list)));
  if (options.syncRemote !== false) {
    markLocalUpdated();
  }
  emit();
}

export function listAll(): Timesheet[] {
  return readTimesheets().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getById(id: string): Timesheet | undefined {
  return readTimesheets().find((item) => item.id === id);
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
  const changed = updated.filter((item) => knownWorkerKey(item) === key);
  return changed;
}

export function removeWorkerFromSystem(
  worker: Pick<Timesheet, "vikar" | "vikarCode" | "vikarEmail">,
): void {
  const nameKey = personLookupKey(worker.vikar);
  const codeKey = personLookupKey(worker.vikarCode ?? "");
  const emailKey = personLookupKey(worker.vikarEmail);

  const matchesWorker = (item: Timesheet) => {
    if (nameKey && personLookupKey(item.vikar) === nameKey) return true;
    if (codeKey && personLookupKey(item.vikarCode ?? "") === codeKey) return true;
    return Boolean(
      !nameKey && !codeKey && emailKey && personLookupKey(item.vikarEmail) === emailKey,
    );
  };

  const nextTimesheets = readTimesheets().filter((item) => {
    const shouldRemove = matchesWorker(item);
    if (shouldRemove) rememberDeletedId(DELETED_TIMESHEET_IDS_KEY, item.id);
    return !shouldRemove;
  });

  const projectReferenceMatchesWorker = (reference: string) => {
    const referenceKey = personLookupKey(reference);
    if (!referenceKey) return false;
    if (nameKey && referenceKey === nameKey) return true;
    if (codeKey && referenceKey === codeKey) return true;
    return Boolean(!nameKey && !codeKey && emailKey && referenceKey === emailKey);
  };

  const nextCompanies = listCompanies().map((company) => ({
    ...company,
    projects: company.projects.map((project) => ({
      ...project,
      workerEmails: project.workerEmails.filter(
        (reference) => !projectReferenceMatchesWorker(reference),
      ),
    })),
  }));

  writeTimesheets(nextTimesheets);
  setStorageItem(COMPANY_KEY, JSON.stringify(nextCompanies));
  markLocalUpdated();
  emit();
}

export function remove(id: string): void {
  rememberDeletedId(DELETED_TIMESHEET_IDS_KEY, id);
  writeTimesheets(readTimesheets().filter((item) => item.id !== id));
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  removeStorageItem(TIMESHEET_KEY);
  markLocalUpdated();
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
    referenceNo: "",
    arbejdssted: "",
    selectedAgreementId: "",
    overenskomst: "",
    hourlyWage: 0,
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
  const selectedAgreementId = normalizeCollectiveAgreementId(input.selectedAgreementId);
  const agreement = getCollectiveAgreementById(selectedAgreementId);
  const weekStart = getMondayISO(new Date(`${input.startDate}T12:00:00`));
  const workerPhone =
    normalizeWorkerPhone(input) ||
    listKnownWorkers().find((worker) => {
      const references = workerReferenceKeys(worker);
      const nameKey = personLookupKey(input.vikar);
      if (nameKey) return references.includes(nameKey);
      return references.includes(personLookupKey(input.vikarEmail));
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
    referenceNo: input.referenceNo.trim(),
    selectedAgreementId,
    overenskomst: agreement?.name ?? "",
    hourlyWage: Number(input.hourlyWage) || 0,
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
  const ruleTextFor = (
    field: AgreementRuleSourceKey,
    storedValue: string | undefined,
    defaultValue: string,
  ) => {
    const sourcePages = merged.sources
      .filter((source) => source.field === field)
      .map((source) => source.page);
    const textFromSources = agreementRuleText(field, sourcePages);
    return textFromSources || ruleTextOrDefault(storedValue, defaultValue);
  };

  return {
    ...merged,
    normalDayHours: stored?.normalDayHours ?? rule.normalDayHours,
    normalWeekHours: stored?.normalWeekHours ?? rule.normalWeekHours,
    overtimeRule: ruleTextFor("overtimeRule", stored?.overtimeRule, rule.overtimeRule),
    saturdayRule: ruleTextFor("saturdayRule", stored?.saturdayRule, rule.saturdayRule),
    sundayRule: ruleTextFor("sundayRule", stored?.sundayRule, rule.sundayRule),
    eveningRule: ruleTextFor("eveningRule", stored?.eveningRule, rule.eveningRule),
    nightRule: ruleTextFor("nightRule", stored?.nightRule, rule.nightRule),
    shiftRule: ruleTextFor("shiftRule", stored?.shiftRule, rule.shiftRule),
    specialRule: ruleTextFor("specialRule", stored?.specialRule, rule.specialRule),
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
  const defaultRule =
    defaultAgreementRules.find((item) => item.agreementId === rule.agreementId) ?? rule;
  const updated = normalizeAgreementRule(defaultRule, {
    ...rule,
    updatedAt: new Date().toISOString(),
  });
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
  emit();
}

export function removeCompany(id: string): void {
  rememberDeletedId(DELETED_COMPANY_IDS_KEY, id);

  setStorageItem(
    COMPANY_KEY,
    JSON.stringify(listCompanies().filter((company) => company.id !== id)),
  );

  markLocalUpdated();
  emit();
}

type RemoteAppState = {
  version?: number;
  updatedAt?: string;
  timesheets?: StoredTimesheet[];
  companies?: StoredCompany[];
  workerConsents?: RemoteWorkerConsent[];
  deletedTimesheetIds?: string[];
  deletedCompanyIds?: string[];
};

type RemoteWorkerConsent = {
  key: string;
  vikar: string;
  vikarEmail: string;
  vikarPhone: string;
  workerLanguage: WorkerLanguage;
  tradeSkills: TradeSkill[];
  competencies: string;
  status: Status;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  workerInactive: boolean;
  workerConsentInactive: boolean;
  workerConsentRenewalSentAt: string;
  workerConsentRenewedAt: string;
};

type NormalizedAppState = {
  version: 1;
  updatedAt: string;
  timesheets: Timesheet[];
  companies: Company[];
  workerConsents: RemoteWorkerConsent[];
  deletedTimesheetIds: string[];
  deletedCompanyIds: string[];
};

let remotePersistTimer: number | undefined;
let remoteSyncPromise: Promise<void> | undefined;

function currentAppState(): NormalizedAppState {
  return {
    version: 1,
    updatedAt: "",
    timesheets: readTimesheets(),
    companies: listCompanies(),
    workerConsents: workerConsentIndexFromTimesheets(readTimesheets()),
    deletedTimesheetIds: [...readDeletedIds(DELETED_TIMESHEET_IDS_KEY)],
    deletedCompanyIds: [...readDeletedIds(DELETED_COMPANY_IDS_KEY)],
  };
}

function workerConsentIndexFromTimesheets(timesheets: Timesheet[]): RemoteWorkerConsent[] {
  return timesheets
    .filter((timesheet) => timesheet.status !== "draft")
    .map((timesheet) => ({
      key: knownWorkerKey(timesheet),
      vikar: timesheet.vikar,
      vikarEmail: timesheet.vikarEmail,
      vikarPhone: timesheet.vikarPhone ?? "",
      workerLanguage: normalizeWorkerLanguage(timesheet.workerLanguage),
      tradeSkills: timesheet.tradeSkills ?? [],
      competencies: timesheet.competencies ?? "",
      status: timesheet.status,
      weekStart: timesheet.weekStart,
      createdAt: timesheet.createdAt,
      updatedAt: timesheet.updatedAt,
      workerInactive: timesheet.workerInactive ?? false,
      workerConsentInactive: timesheet.workerConsentInactive ?? false,
      workerConsentRenewalSentAt: timesheet.workerConsentRenewalSentAt ?? "",
      workerConsentRenewedAt: timesheet.workerConsentRenewedAt ?? "",
    }))
    .filter((item) => item.key && item.vikarEmail);
}

function mergeCompanies(local: Company[], remote: Company[], preferLocal: boolean): Company[] {
  const deletedIds = readDeletedIds(DELETED_COMPANY_IDS_KEY);
  const localById = new Map(
    local.filter((company) => !deletedIds.has(company.id)).map((company) => [company.id, company]),
  );
  const remoteById = new Map(
    remote.filter((company) => !deletedIds.has(company.id)).map((company) => [company.id, company]),
  );
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  return [...ids]
    .flatMap((id) => {
      const localCompany = localById.get(id);
      const remoteCompany = remoteById.get(id);
      if (localCompany && remoteCompany) {
        const preferred = preferLocal ? localCompany : remoteCompany;
        const fallback = preferLocal ? remoteCompany : localCompany;
        return [
          {
            ...fallback,
            ...preferred,
            projects: mergeCompanyProjects(
              localCompany.projects,
              remoteCompany.projects,
              preferLocal,
            ),
          },
        ];
      }
      return localCompany ?? remoteCompany ?? [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

function mergeCompanyProjects(
  local: CompanyProject[],
  remote: CompanyProject[],
  preferLocal: boolean,
): CompanyProject[] {
  const byId = new Map<string, CompanyProject>();
  for (const project of preferLocal ? remote : local) {
    byId.set(project.id, project);
  }
  for (const project of preferLocal ? local : remote) {
    byId.set(project.id, project);
  }
  return [...byId.values()];
}

function applyAppState(state: RemoteAppState, updatedAt: string): void {
  const deletedTimesheetIds = new Set([
    ...readDeletedIds(DELETED_TIMESHEET_IDS_KEY),
    ...(Array.isArray(state.deletedTimesheetIds) ? state.deletedTimesheetIds : []),
  ]);

  const deletedCompanyIds = new Set([
    ...readDeletedIds(DELETED_COMPANY_IDS_KEY),
    ...(Array.isArray(state.deletedCompanyIds) ? state.deletedCompanyIds : []),
  ]);

  setStorageItem(DELETED_TIMESHEET_IDS_KEY, JSON.stringify([...deletedTimesheetIds]));
  setStorageItem(DELETED_COMPANY_IDS_KEY, JSON.stringify([...deletedCompanyIds]));

  const timesheets = Array.isArray(state.timesheets)
    ? state.timesheets
        .map((item) => normalizeTimesheet(item))
        .filter((item) => !deletedTimesheetIds.has(item.id))
    : [];

  const companies = Array.isArray(state.companies)
    ? state.companies
        .map((item) => normalizeCompany(item))
        .filter((item) => !deletedCompanyIds.has(item.id))
    : [];

  writeTimesheets(timesheets, { syncRemote: false });
  setStorageItem(COMPANY_KEY, JSON.stringify(companies));
  markLocalUpdated(updatedAt);
  emit();
}

function remoteConsentKey(item: RemoteWorkerConsent): string {
  return item.key || personLookupKey(item.vikar) || personLookupKey(item.vikarEmail);
}

function applyRemoteWorkerConsentState(workerConsents: RemoteWorkerConsent[]): void {
  if (workerConsents.length === 0) return;
  const remoteByKey = new Map(
    workerConsents
      .map((item) => [remoteConsentKey(item), item] as const)
      .filter(([key]) => Boolean(key)),
  );
  if (remoteByKey.size === 0) return;

  let hasChanges = false;
  const updated = readTimesheets().map((timesheet) => {
    const remote = remoteByKey.get(knownWorkerKey(timesheet));
    if (!remote) return timesheet;

    const next = { ...timesheet };
    let changed = false;
    if (remote.workerConsentRenewalSentAt > (next.workerConsentRenewalSentAt ?? "")) {
      next.workerConsentRenewalSentAt = remote.workerConsentRenewalSentAt;
      changed = true;
    }
    if (remote.workerConsentRenewedAt > (next.workerConsentRenewedAt ?? "")) {
      next.workerConsentRenewedAt = remote.workerConsentRenewedAt;
      changed = true;
    }
    if (remote.workerConsentInactive && !next.workerConsentInactive) {
      next.vikarEmail = "";
      next.vikarPhone = "";
      next.kontaktperson = "";
      next.kontaktpersonPhone = "";
      next.kontaktpersonEmail = "";
      next.tradeSkills = [];
      next.competencies = "";
      next.workerConsentInactive = true;
      changed = true;
    }
    if (changed) {
      hasChanges = true;
      next.updatedAt =
        [next.updatedAt, remote.updatedAt].filter(Boolean).sort().at(-1) ?? next.updatedAt;
    }
    return changed ? normalizeTimesheet(next) : timesheet;
  });

  if (hasChanges) {
    writeTimesheets(updated, { syncRemote: false });
    const newestRemoteUpdate =
      workerConsents
        .map((item) => item.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? new Date().toISOString();
    markLocalUpdated(newestRemoteUpdate);
  }
}

export type KnownWorker = {
  key: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  cpr: string;
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

type WorkerIdentity = Pick<KnownWorker, "key" | "name" | "code" | "email">;

function knownWorkerReferenceKeys(worker: WorkerIdentity): string[] {
  return [
    ...new Set(
      [
        worker.key,
        personLookupKey(worker.name),
        personLookupKey(worker.code),
        personLookupKey(worker.email),
      ].filter(Boolean),
    ),
  ];
}

function knownWorkerIdentityMatches(
  worker: WorkerIdentity,
  candidate: { nameKey: string; codeKey: string; emailKey: string },
): boolean {
  const workerNameKey = personLookupKey(worker.name);
  const workerCodeKey = personLookupKey(worker.code);
  if (candidate.nameKey && workerNameKey) return candidate.nameKey === workerNameKey;
  if (candidate.codeKey && workerCodeKey) return candidate.codeKey === workerCodeKey;

  const workerKey = personLookupKey(worker.key);
  if (candidate.nameKey && workerKey) return candidate.nameKey === workerKey;
  if (candidate.codeKey && workerKey) return candidate.codeKey === workerKey;

  const workerEmailKey = personLookupKey(worker.email);
  return Boolean(
    !candidate.nameKey &&
    !candidate.codeKey &&
    candidate.emailKey &&
    workerEmailKey &&
    candidate.emailKey === workerEmailKey,
  );
}

function buildKnownWorkersFromTimesheets(timesheets: Timesheet[]): KnownWorker[] {
  const workers: KnownWorker[] = [];
  for (const timesheet of timesheets) {
    const nameKey = personLookupKey(timesheet.vikar);
    const codeKey = personLookupKey(timesheet.vikarCode ?? "");
    const emailKey = personLookupKey(timesheet.vikarEmail);
    const key = nameKey || codeKey || emailKey;
    if (!key) continue;
    const existing = workers.find((worker) =>
      knownWorkerIdentityMatches(worker, { nameKey, codeKey, emailKey }),
    );
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
      address: timesheet.vikarAddress || existing?.address || "",
      cpr: timesheet.vikarCpr || existing?.cpr || "",
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
  return workers.sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

export function knownWorkersFromTimesheets(timesheets: Timesheet[]): KnownWorker[] {
  return buildKnownWorkersFromTimesheets(timesheets).filter((worker) => !worker.inactive);
}

export function knownWorkersIncludingInactiveFromTimesheets(
  timesheets: Timesheet[],
): KnownWorker[] {
  return buildKnownWorkersFromTimesheets(timesheets);
}

export function listKnownWorkers(): KnownWorker[] {
  return knownWorkersFromTimesheets(readTimesheets());
}

export function workerReferenceKeys(worker: KnownWorker): string[] {
  return knownWorkerReferenceKeys(worker);
}

function timesheetMatchesWorker(timesheet: Timesheet, worker: WorkerIdentity): boolean {
  const nameKey = personLookupKey(timesheet.vikar);
  const codeKey = personLookupKey(timesheet.vikarCode ?? "");
  const emailKey = personLookupKey(timesheet.vikarEmail);
  return knownWorkerIdentityMatches(worker, { nameKey, codeKey, emailKey });
}

export function setKnownWorkerInactive(worker: KnownWorker, inactive: boolean): Timesheet[] {
  const list = readTimesheets();
  const updated = list.map((item) =>
    timesheetMatchesWorker(item, worker)
      ? normalizeTimesheet({
          ...item,
          workerInactive: inactive,
          workerConsentInactive: inactive ? item.workerConsentInactive : false,
          updatedAt: new Date().toISOString(),
        })
      : item,
  );
  writeTimesheets(updated);
  const changed = updated.filter((item) => timesheetMatchesWorker(item, worker));
  return changed;
}
export function deleteKnownWorker(worker: KnownWorker): Timesheet[] {
  const list = readTimesheets();
  const toDelete = list.filter((item) => timesheetMatchesWorker(item, worker));
  const updated = list.filter((item) => !timesheetMatchesWorker(item, worker));

  toDelete.forEach((item) => {
    rememberDeletedId(DELETED_TIMESHEET_IDS_KEY, item.id);
  });

  writeTimesheets(updated);

  return updated;
}
export function updateKnownWorker(
  worker: KnownWorker,
  patch: Pick<
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
  >,
): Timesheet[] {
  const list = readTimesheets();
  const updated = list.map((item) =>
    timesheetMatchesWorker(item, worker)
      ? normalizeTimesheet({
          ...item,
          vikar: patch.name.trim(),
          vikarCode: patch.code.trim(),
          vikarEmail: patch.email.trim(),
          vikarPhone: patch.phone.trim(),
          vikarAddress: patch.address.trim(),
          vikarCpr: patch.cpr.trim(),
          workerLanguage: normalizeWorkerLanguage(patch.language),
          tradeSkills: normalizeTradeSkills(patch.tradeSkills),
          competencies: patch.competencies.trim(),
          updatedAt: new Date().toISOString(),
        })
      : item,
  );
  writeTimesheets(updated);
  const changed = updated.filter((item) => timesheetMatchesWorker(item, { ...worker, ...patch }));
  return changed;
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
  const changed = updated.filter((item) => knownWorkerKey(item) === key);
  return changed;
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
  const changed = updated.filter((item) => {
    const matchesName = nameKey && personLookupKey(item.vikar) === nameKey;
    const matchesEmail = emailKey && personLookupKey(item.vikarEmail) === emailKey;
    return Boolean(matchesName || matchesEmail);
  });
  return changed;
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
    if (summary.canCalculateRatesAutomatically && rule?.eveningStart) {
      return sum + overlapHours(day, rule.eveningStart, rule.nightStart || "23:59");
    }
    return sum;
  }, 0);
  const night = t.days.reduce((sum, day) => {
    if (day.nightWorkStart && day.nightWorkEnd) {
      return sum + overlapHours(day, day.nightWorkStart, day.nightWorkEnd);
    }
    if (summary.canCalculateRatesAutomatically && rule?.nightStart && rule.nightEnd) {
      return sum + overlapHours(day, rule.nightStart, rule.nightEnd);
    }
    return sum;
  }, 0);
  const shift = round(
    t.days.reduce((sum, day) => sum + (explicitShiftWork(day) ? dayHours(day) : 0), 0),
  );
  const explicitOvertime = round(
    t.days.reduce((sum, day) => sum + (day.workType === "overtime" ? dayHours(day) : 0), 0),
  );
  const normalWeekHours =
    rule?.normalWeekHours && rule.normalWeekHours > 0 ? rule.normalWeekHours : undefined;
  const overtime =
    summary.canCalculateRatesAutomatically && normalWeekHours
      ? Math.max(explicitOvertime, overtimeHours(t.days, normalWeekHours))
      : explicitOvertime;
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
          "Invitationen er personlig og kræver en serververificeret session.",
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
      <p style="margin:0 0 18px;color:#4b5563;line-height:1.5;">Invitationen er personlig og kræver en serververificeret session.</p>`
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
        language === "en"
          ? "No registration"
          : language === "pl"
            ? "Brak rejestracji"
            : "Ingen registrering"
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
      "Open the personal invitation link in the email. A server-verified session is required.",
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
      "Otwórz osobisty link z zaproszeniem w wiadomości. Wymagana jest sesja zweryfikowana przez serwer.",
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
    "Åbn det personlige invitationslink i mailen. En serververificeret session er påkrævet.",
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
  const safeName = htmlEscape(
    t.vikar || (language === "en" ? "worker" : language === "pl" ? "pracowniku" : "vikar"),
  );
  const safeInviteUrl = htmlEscape(inviteUrl);
  const copy =
    language === "en"
      ? {
          htmlLang: "en",
          greeting: "Hi",
          intro:
            "Sub-Z has created a timesheet for you. Use the button below to open the timesheet.",
          button: "Open timesheet",
          loginIntro: "The personal invitation requires a server-verified session.",
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
            loginIntro: "Osobiste zaproszenie wymaga sesji zweryfikowanej przez serwer.",
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
            loginIntro: "Den personlige invitation kræver en serververificeret session.",
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
      <p style="margin:0 0 22px;color:#4b5563;line-height:1.5;">${htmlEscape(copy.loginIntro)}</p>
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

type DemoInvoiceScenario = "now" | "soon" | "waiting" | "sent" | "draft";

const PRESENTATION_DEMO_TIMESHEET_COUNT = 12;
const PAYROLL_SENT_DEMO_INDEXES = new Set([3, 4, 5, 8]);
const CURRENT_WEEK_DEMO_SHIFT_COUNTS = new Map([
  [2, 2],
  [9, 1],
  [10, 1],
  [11, 2],
]);
const CURRENT_WEEK_DEMO_ABSENCE_DAYS = new Map([
  [2, 3],
  [9, 1],
  [10, 2],
]);

function demoInvoiceScenario(index: number): DemoInvoiceScenario {
  if (index < 3) return "now";
  if (index < 6) return "soon";
  if (index < 9) return "waiting";
  if (index < PRESENTATION_DEMO_TIMESHEET_COUNT) return "sent";
  return "draft";
}

function demoTimesheetWeekStart(index: number, currentWeekStart: string): string {
  if (CURRENT_WEEK_DEMO_SHIFT_COUNTS.has(index)) return currentWeekStart;
  return addDaysToISODate(currentWeekStart, -21);
}

function demoProjectDates(index: number, currentWeekStart: string) {
  const scenario = demoInvoiceScenario(index);
  if (scenario === "now" || scenario === "sent") {
    return {
      startDate: addDaysToISODate(currentWeekStart, -28),
      endDate: addDaysToISODate(currentWeekStart, -15),
    };
  }
  if (scenario === "soon") {
    return {
      startDate: currentWeekStart,
      endDate: addDaysToISODate(currentWeekStart, 11),
    };
  }
  return {
    startDate: addDaysToISODate(currentWeekStart, 7),
    endDate: addDaysToISODate(currentWeekStart, 18),
  };
}

function demoTimesheetStatus(index: number): Status {
  const scenario = demoInvoiceScenario(index);
  if (scenario === "draft") return "draft";
  if (scenario === "now" || scenario === "sent") return "approved";
  return "sent";
}

function presentationDemoDays(days: Timesheet["days"], index: number): Timesheet["days"] {
  const plannedShiftCount = CURRENT_WEEK_DEMO_SHIFT_COUNTS.get(index);
  const absenceDayIndex = CURRENT_WEEK_DEMO_ABSENCE_DAYS.get(index);

  if (plannedShiftCount === undefined && absenceDayIndex === undefined) return days;

  let retainedShifts = 0;
  return days.map((day, dayIndex) => {
    const isPlannedShift = Boolean(day.start && day.end) && retainedShifts < (plannedShiftCount ?? 0);
    if (day.start && day.end && isPlannedShift) retainedShifts += 1;

    const absence = dayIndex === absenceDayIndex ? "dayoff" : day.absence;
    if (isPlannedShift) return { ...day, absence };

    return {
      ...day,
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
      absence,
    };
  });
}

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
      agreementId: "bygge-anlaegsoverenskomsten",
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
      agreementId: "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f",
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
      agreementId: "bygningsoverenskomsten",
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
      agreementId: "bygningsoverenskomsten",
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
      agreementId: "industrioverenskomsten-byggeri",
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
      agreementId: "industriens-overenskomst",
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
      agreementId: "industriens-overenskomst",
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
      agreementId: "industriens-overenskomst",
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
      agreementId: "bygge-anlaegsoverenskomsten",
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

function createDemoTimesheet(worker: DemoWorkerSeed, currentWeekStart: string, index: number): Timesheet {
  const weekStart = demoTimesheetWeekStart(index, currentWeekStart);
  const projectDates = demoProjectDates(index, currentWeekStart);
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
    projectEndDate: projectDates.endDate,
    arbejdssted: worker.address,
    kontaktperson: worker.companyContactName,
    kontaktpersonPhone: worker.companyContactPhone,
    kontaktpersonEmail: worker.companyContactEmail,
    referenceNo: `REF-${worker.id.slice(-4).toUpperCase()}`,
    selectedAgreementId: normalizeCollectiveAgreementId(worker.agreementId),
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
    status: demoTimesheetStatus(index),
    invoiceSentDate:
      demoInvoiceScenario(index) === "sent" ? TEST_DATA_INVOICE_SENT_DATE : "",
    payrollSentDate: PAYROLL_SENT_DEMO_INDEXES.has(index) ? TEST_DATA_PAYROLL_SENT_DATE : "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    days: presentationDemoDays(days, index),
  });
}

function demoCompaniesForSeed(weekStart: string, workers: DemoWorkerSeed[]): Company[] {
  const byId = new Map<string, Company>();
  for (const [index, worker] of workers.entries()) {
    const projectDates = demoProjectDates(index, weekStart);
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
        selectedAgreementId: normalizeCollectiveAgreementId(worker.agreementId),
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
      startDate: projectDates.startDate,
      endDate: projectDates.endDate,
      selectedAgreementId: normalizeCollectiveAgreementId(worker.agreementId),
      billingHourlyWage: Number(worker.hourlyWage) || 0,
      billingFactor: 0,
      tradeSkills: [worker.tradeSkill],
      competencies: worker.competencies,
      workerEmails: [worker.name],
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
        billingHourlyWage: 0,
        billingFactor: 0,
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

const TEST_DATA_PREFIX = "testdata-2026-08-24-v7";
const TEST_DATA_SEED_KEY = "timesheet-testdata-seed-version-v1";
export function rollingDemoDates(referenceDate: Date | string = new Date()) {
  const parsedReferenceDate =
    typeof referenceDate === "string"
      ? new Date(`${referenceDate.slice(0, 10)}T12:00:00`)
      : referenceDate;
  const currentWeekStart = getMondayISO(parsedReferenceDate);
  return {
    currentWeekStart,
    activeProjectEndDate: addDaysToISODate(currentWeekStart, 28),
    pastProjectStart: addDaysToISODate(currentWeekStart, -28),
    pastProjectEnd: addDaysToISODate(currentWeekStart, -15),
    pastWeekStart: addDaysToISODate(currentWeekStart, -21),
    invoiceSoonStart: currentWeekStart,
    invoiceSoonEnd: addDaysToISODate(currentWeekStart, 11),
    invoiceWaitingStart: addDaysToISODate(currentWeekStart, 7),
    invoiceWaitingEnd: addDaysToISODate(currentWeekStart, 18),
    invoiceSentDate: addDaysToISODate(currentWeekStart, -7),
    payrollSentDate: addDaysToISODate(currentWeekStart, -6),
  };
}

const TEST_DATA_DATES = rollingDemoDates();
const TEST_DATA_CURRENT_WEEK_START = TEST_DATA_DATES.currentWeekStart;
const TEST_DATA_SEED_VERSION = `${TEST_DATA_PREFIX}-rolling-${TEST_DATA_CURRENT_WEEK_START}`;
const TEST_DATA_BASE_DATE = TEST_DATA_CURRENT_WEEK_START;
const TEST_DATA_ACTIVE_PROJECT_END_DATE = TEST_DATA_DATES.activeProjectEndDate;
const TEST_DATA_PAST_PROJECT_START = TEST_DATA_DATES.pastProjectStart;
const TEST_DATA_PAST_PROJECT_END = TEST_DATA_DATES.pastProjectEnd;
const TEST_DATA_PAST_WEEK_START = TEST_DATA_DATES.pastWeekStart;
const TEST_DATA_ACTIVE_WEEK_START = TEST_DATA_CURRENT_WEEK_START;
const TEST_DATA_INVOICE_SOON_START = TEST_DATA_DATES.invoiceSoonStart;
const TEST_DATA_INVOICE_SOON_END = TEST_DATA_DATES.invoiceSoonEnd;
const TEST_DATA_INVOICE_WAITING_START = TEST_DATA_DATES.invoiceWaitingStart;
const TEST_DATA_INVOICE_WAITING_END = TEST_DATA_DATES.invoiceWaitingEnd;
const TEST_DATA_INVOICE_SENT_DATE = TEST_DATA_DATES.invoiceSentDate;
const TEST_DATA_PAYROLL_SENT_DATE = TEST_DATA_DATES.payrollSentDate;
const LEGACY_DEMO_TIMESHEET_ID = /^timesheet-\d{3}$/u;

type TestCompanyInput = {
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  agreementId: string;
};

type TestWorkerInput = {
  index: number;
  ownerRole: "bruger" | "bruger2";
  name: string;
  tradeSkill: TradeSkill;
  competencies: string;
  language: WorkerLanguage;
};

type TestProjectInput = {
  companyIndex: number;
  projectIndex: number;
  ownerRole: "bruger" | "bruger2";
  name: string;
  tradeSkill: TradeSkill;
  competencies: string;
  workerIndexes: number[];
  workPeriod: WorkPeriod;
  startDate: string;
  endDate: string;
};

const TEST_TRADE_SKILLS: TradeSkill[] = [
  "Industri / produktion",
  "Smed / metal",
  "CNC / maskinarbejde",
  "Tømrer / snedker",
  "Anlæg",
  "Murer",
  "Montage",
  "Svejser",
  "Træ / møbel",
  "Byggeri / håndværk",
  "Jord / beton",
  "Murerarbejdsmand",
];

const TEST_AGREEMENT_IDS = [
  "industriens-overenskomst",
  "industri-trae-moebeloverenskomsten",
  "trae-moebeloverenskomsten",
  "bygge-anlaegsoverenskomsten",
  "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f",
  "bygningsoverenskomsten",
];

const TEST_COMPETENCIES = [
  "Kan arbejde selvstændigt efter tegninger og arbejdsbeskrivelser",
  "Erfaring med montage og brug af almindeligt håndværktøj",
  "Truckcertifikat og erfaring med lager, pluk og pak",
  "Svejsning med MIG/MAG og efterkontrol af emner",
  "Erfaring med byggeplads, oprydning og sikkerhedsregler",
  "CNC-betjening, opmåling og kvalitetskontrol",
  "Kan læse simple produktionstegninger og følge procesplan",
  "Erfaring med beton, jordarbejde og afspærring",
  "Stabil på aften- og nathold med overlevering til næste hold",
  "Erfaring med træbearbejdning, samling og finish",
  "Kan arbejde i teams og dokumentere udført arbejde",
  "Erfaring med murerarbejde, blanding og materialehåndtering",
];

function testCompaniesInput(ownerRole: "bruger" | "bruger2"): TestCompanyInput[] {
  const bruger1: TestCompanyInput[] = [
    ["Test Industri Nord", "Industrivej 12, 6700 Esbjerg", "Mette Holm"],
    ["Test Montage Syd", "Montageparken 4, 6000 Kolding", "Lars Mikkelsen"],
    ["Test CNC Center", "Maskinvej 8, 7100 Vejle", "Camilla Birk"],
    ["Test Byg Vest", "Teglvangen 5, 6200 Aabenraa", "Rasmus Toft"],
    ["Test Træværk", "Snedkervej 17, 7400 Herning", "Niels Lund"],
    ["Test Beton & Jord", "Grusvej 21, 8800 Viborg", "Sofie Brandt"],
    ["Test Smedeteknik", "Staalvej 3, 7000 Fredericia", "Jonas Krag"],
    ["Test Lager Produktion", "Logistikvej 14, 8700 Horsens", "Laura Nørgaard"],
    ["Test Håndværk Øst", "Byggepladsen 2, 4600 Køge", "Henrik Dahl"],
    ["Test Murer Service", "Murervej 9, 5000 Odense C", "Pernille Skov"],
    ["Test Anlæg Fyn", "Anlægsvej 44, 5700 Svendborg", "Thomas Vang"],
    ["Test Metal Partner", "Metalbuen 6, 9000 Aalborg", "Julie Fisker"],
    ["Test Produktionslinjen", "Fabriks Allé 10, 2630 Taastrup", "Anders Riis"],
  ].map(([name, address, contactName], index) =>
    testCompanyInput(index, name, address, contactName),
  );

  const bruger2: TestCompanyInput[] = [
    ["Test El & Montage", "Havnevej 22, 7100 Vejle", "Sanne Bro"],
    ["Test VVS Drift", "Installationsvej 7, 8200 Aarhus N", "Morten Hjort"],
    ["Test Malerteam", "Farvevej 18, 4000 Roskilde", "Eva Møller"],
    ["Test Byggepartner", "Entreprenørvej 1, 8600 Silkeborg", "Kristian Holm"],
    ["Test Maskinfabrik", "Drejebænken 11, 9400 Nørresundby", "Sara Kjær"],
    ["Test Elementbyg", "Elementvej 30, 4700 Næstved", "Daniel Bøje"],
    ["Test Anlæg Øst", "Jordstykket 16, 3400 Hillerød", "Nina Falk"],
    ["Test Produktion Vest", "Procesvej 26, 7500 Holstebro", "Martin Smed"],
    ["Test Træ & Møbel", "Møbelvej 33, 8300 Odder", "Ida Storm"],
    ["Test Byggeri Service", "Stilladsvej 5, 9900 Frederikshavn", "Peter Brix"],
  ].map(([name, address, contactName], index) =>
    testCompanyInput(index + 13, name, address, contactName),
  );

  return ownerRole === "bruger" ? bruger1 : bruger2;
}

function testCompanyInput(
  index: number,
  name: string,
  address: string,
  contactName: string,
): TestCompanyInput {
  return {
    name,
    address,
    contactName,
    contactPhone: `28${String(110000 + index).slice(0, 6)}`,
    contactEmail: `kontakt${String(index + 1).padStart(2, "0")}@testdata.local`,
    agreementId: TEST_AGREEMENT_IDS[index % TEST_AGREEMENT_IDS.length],
  };
}

function testLanguage(index: number): WorkerLanguage {
  if (index % 10 === 0) return "pl";
  if (index % 5 === 0) return "en";
  return "da";
}

function testWorkersInput(
  ownerRole: "bruger" | "bruger2",
  count: number,
  offset: number,
): TestWorkerInput[] {
  return Array.from({ length: count }, (_, index) => {
    const globalIndex = offset + index;
    const tradeSkill = TEST_TRADE_SKILLS[index % TEST_TRADE_SKILLS.length];
    return {
      index,
      ownerRole,
      name: `${tradeSkill.split(" / ")[0]} Vikar ${String(index + 1).padStart(2, "0")}`,
      tradeSkill,
      competencies: TEST_COMPETENCIES[index % TEST_COMPETENCIES.length],
      language: testLanguage(globalIndex),
    };
  });
}

function testWorkPeriod(index: number): WorkPeriod {
  if (index % 3 === 1) return "evening";
  if (index % 3 === 2) return "night";
  return "day";
}

function testWorkPeriodTimes(workPeriod: WorkPeriod) {
  if (workPeriod === "evening") {
    return {
      start: "14:00",
      end: "23:00",
      pauseStart: "17:30",
      pauseEnd: "17:45",
      pause2Start: "20:30",
      pause2End: "20:45",
    };
  }
  if (workPeriod === "night") {
    return {
      start: "22:00",
      end: "06:00",
      pauseStart: "01:00",
      pauseEnd: "01:15",
      pause2Start: "04:00",
      pause2End: "04:15",
    };
  }
  return {
    start: "07:00",
    end: "15:00",
    pauseStart: "09:30",
    pauseEnd: "09:45",
    pause2Start: "12:00",
    pause2End: "12:15",
  };
}

function testProjectInputs(
  ownerRole: "bruger" | "bruger2",
  companyProjectCounts: number[],
  workerCount: number,
): TestProjectInput[] {
  const projects: TestProjectInput[] = [];
  let projectIndex = 0;
  companyProjectCounts.forEach((count, companyIndex) => {
    for (let localProjectIndex = 0; localProjectIndex < count; localProjectIndex += 1) {
      const tradeSkill = TEST_TRADE_SKILLS[projectIndex % TEST_TRADE_SKILLS.length];
      const isCurrentProject = projectIndex < 20;
      const invoiceScenario = testInvoicePeriodScenario(projectIndex);
      const workerIndexes =
        ownerRole === "bruger" && projectIndex === 0
          ? [0, workerCount - 1]
          : [projectIndex % workerCount];
      projects.push({
        companyIndex,
        projectIndex,
        ownerRole,
        name: `${tradeSkill.split(" / ")[0]} ${localProjectIndex + 1}`,
        tradeSkill,
        competencies: TEST_COMPETENCIES[projectIndex % TEST_COMPETENCIES.length],
        workerIndexes,
        workPeriod: testWorkPeriod(projectIndex),
        startDate:
          invoiceScenario === "soon"
            ? TEST_DATA_INVOICE_SOON_START
            : invoiceScenario === "waiting"
              ? TEST_DATA_INVOICE_WAITING_START
              : isCurrentProject
                ? TEST_DATA_BASE_DATE
                : TEST_DATA_PAST_PROJECT_START,
        endDate:
          invoiceScenario === "soon"
            ? TEST_DATA_INVOICE_SOON_END
            : invoiceScenario === "waiting"
              ? TEST_DATA_INVOICE_WAITING_END
              : isCurrentProject
                ? TEST_DATA_ACTIVE_PROJECT_END_DATE
                : TEST_DATA_PAST_PROJECT_END,
      });
      projectIndex += 1;
    }
  });
  return projects;
}

function testWeekPlan(workPeriod: WorkPeriod): CreateWorkerDayPlan[] {
  const times = testWorkPeriodTimes(workPeriod);
  return Array.from({ length: 7 }, (_, index) => {
    const isWorkday = index < 5;
    return {
      start: isWorkday ? times.start : "",
      end: isWorkday ? times.end : "",
      pause: isWorkday ? 30 : 0,
      pauseStart: isWorkday ? times.pauseStart : "",
      pauseEnd: isWorkday ? times.pauseEnd : "",
      pause2Start: isWorkday ? times.pause2Start : "",
      pause2End: isWorkday ? times.pause2End : "",
      dayWorkStart: isWorkday && workPeriod === "day" ? times.start : "",
      dayWorkEnd: isWorkday && workPeriod === "day" ? times.end : "",
      eveningWorkStart: isWorkday && workPeriod === "evening" ? times.start : "",
      eveningWorkEnd: isWorkday && workPeriod === "evening" ? times.end : "",
      nightWorkStart: isWorkday && workPeriod === "night" ? times.start : "",
      nightWorkEnd: isWorkday && workPeriod === "night" ? times.end : "",
      shiftWork: false,
    };
  });
}

function testDataId(kind: string, ownerRole: "bruger" | "bruger2", index: number): string {
  return `${TEST_DATA_PREFIX}-${ownerRole}-${kind}-${String(index + 1).padStart(2, "0")}`;
}

function testInvoicePeriodScenario(projectIndex: number): "soon" | "waiting" | null {
  if (projectIndex >= 6 && projectIndex <= 10) return "soon";
  if (projectIndex >= 1 && projectIndex <= 5) return "waiting";
  return null;
}

function testTimesheetWeekStart(projectIndex: number): string {
  return projectIndex < 20 ? TEST_DATA_ACTIVE_WEEK_START : TEST_DATA_PAST_WEEK_START;
}

function testTimesheetStatus(projectIndex: number): Status {
  if (testInvoicePeriodScenario(projectIndex)) return "sent";
  if (projectIndex >= 11 && projectIndex <= 18) return "approved";
  if (projectIndex >= 19 && projectIndex < 28) return "approved";
  if (projectIndex % 11 === 0) return "rejected";
  return "draft";
}

function testInvoiceSentDate(projectIndex: number): string {
  return projectIndex >= 19 && projectIndex < 28 ? TEST_DATA_INVOICE_SENT_DATE : "";
}

function testPayrollSentDate(projectIndex: number): string {
  return projectIndex >= 17 && projectIndex < 20 ? TEST_DATA_PAYROLL_SENT_DATE : "";
}

function testCancelledShiftDayIndex(
  ownerRole: "bruger" | "bruger2",
  workerIndex: number,
): number | null {
  const cancelledByWorker =
    ownerRole === "bruger"
      ? new Map([
          [3, 1],
          [11, 3],
        ])
      : new Map([
          [4, 2],
          [14, 4],
        ]);
  return cancelledByWorker.get(workerIndex) ?? null;
}

function testWorkerCode(globalIndex: number): string {
  return `VIK-${String(globalIndex + 1).padStart(3, "0")}`;
}

function testWorkerEmail(globalIndex: number): string {
  return `vikar${String(globalIndex + 1).padStart(3, "0")}@testdata.local`;
}

function testWorkerPhone(globalIndex: number): string {
  return `30${String(100000 + globalIndex).slice(0, 6)}`;
}

function testWorkerCpr(globalIndex: number): string {
  return `010190-${String(9000 + globalIndex).padStart(4, "0")}`;
}

function testWorkerAddress(globalIndex: number): string {
  const postalCodes = [
    "6000 Kolding",
    "7100 Vejle",
    "8700 Horsens",
    "5000 Odense C",
    "8200 Aarhus N",
  ];
  return `Testvej ${globalIndex + 1}, ${postalCodes[globalIndex % postalCodes.length]}`;
}

function buildOwnerTestSeed(
  ownerRole: "bruger" | "bruger2",
  companyProjectCounts: number[],
  workerCount: number,
  globalWorkerOffset: number,
): { companies: Company[]; timesheets: Timesheet[] } {
  const companiesInput = testCompaniesInput(ownerRole);
  const workers = testWorkersInput(ownerRole, workerCount, globalWorkerOffset);
  const projects = testProjectInputs(ownerRole, companyProjectCounts, workerCount);
  const projectsByWorker = new Map<number, TestProjectInput>();
  projects.forEach((project) => {
    project.workerIndexes.forEach((workerIndex) => {
      if (!projectsByWorker.has(workerIndex)) projectsByWorker.set(workerIndex, project);
    });
  });

  const companies = companiesInput.map((companyInput, companyIndex) => {
    const companyProjects = projects.filter((project) => project.companyIndex === companyIndex);
    const company: Company = {
      id: testDataId("company", ownerRole, companyIndex),
      name: companyInput.name,
      ownerRole,
      cvrNumber: `99${String(companyIndex + (ownerRole === "bruger" ? 1 : 14)).padStart(6, "0")}`,
      contactName: companyInput.contactName,
      contactPhone: companyInput.contactPhone,
      contactEmail: companyInput.contactEmail,
      address: companyInput.address,
      selectedAgreementId: normalizeCollectiveAgreementId(companyInput.agreementId),
      localAgreements: [],
      projects: companyProjects.map((project) => {
        const times = testWorkPeriodTimes(project.workPeriod);
        return {
          id: testDataId("project", ownerRole, project.projectIndex),
          name: project.name,
          contactName: companyInput.contactName,
          contactPhone: companyInput.contactPhone,
          contactEmail: companyInput.contactEmail,
          referenceNo: `REF-${ownerRole === "bruger" ? "B1" : "B2"}-${String(project.projectIndex + 1).padStart(3, "0")}`,
          startDate: project.startDate,
          endDate: project.endDate,
          selectedAgreementId: normalizeCollectiveAgreementId(companyInput.agreementId),
          tradeSkills: [project.tradeSkill],
          competencies: project.competencies,
          workerEmails: project.workerIndexes.map((workerIndex) => workers[workerIndex].name),
          workPeriod: project.workPeriod,
          defaultStart: times.start,
          defaultEnd: times.end,
          pauseStart: times.pauseStart,
          pauseEnd: times.pauseEnd,
          pause2Start: times.pause2Start,
          pause2End: times.pause2End,
          billingHourlyWage: 205 + (project.projectIndex % 9) * 5,
          billingFactor: 1.72 + (project.projectIndex % 4) * 0.08,
        };
      }),
    };
    return normalizeCompany(company);
  });

  const timesheets = workers.map((worker, workerIndex) => {
    const project = projectsByWorker.get(workerIndex) ?? projects[0];
    const companyInput = companiesInput[project.companyIndex];
    const company = companies[project.companyIndex];
    const companyProject = company.projects.find(
      (item) => item.id === testDataId("project", ownerRole, project.projectIndex),
    );
    const times = testWorkPeriodTimes(project.workPeriod);
    const globalIndex = globalWorkerOffset + workerIndex;
    const cancelledDayIndex = testCancelledShiftDayIndex(ownerRole, workerIndex);
    const timesheet = createTimesheetForWorker({
      ownerRole,
      vikar: worker.name,
      vikarCode: testWorkerCode(globalIndex),
      vikarEmail: testWorkerEmail(globalIndex),
      vikarPhone: testWorkerPhone(globalIndex),
      workerLanguage: worker.language,
      tradeSkills: [worker.tradeSkill],
      competencies: worker.competencies,
      brugervirksomhed: company.name,
      companyId: company.id,
      projectId: companyProject?.id ?? "",
      projectName: companyProject?.name ?? project.name,
      projectEndDate: project.endDate,
      arbejdssted: company.address,
      kontaktperson: companyInput.contactName,
      kontaktpersonPhone: companyInput.contactPhone,
      kontaktpersonEmail: companyInput.contactEmail,
      referenceNo: companyProject?.referenceNo ?? "",
      selectedAgreementId: companyProject?.selectedAgreementId ?? company.selectedAgreementId ?? "",
      hourlyWage: 168 + (workerIndex % 8) * 4,
      defaultStart: times.start,
      defaultEnd: times.end,
      defaultPause: 30,
      defaultPauseStart: times.pauseStart,
      defaultPauseEnd: times.pauseEnd,
      defaultPause2Start: times.pause2Start,
      defaultPause2End: times.pause2End,
      defaultDayWorkStart: project.workPeriod === "day" ? times.start : "",
      defaultDayWorkEnd: project.workPeriod === "day" ? times.end : "",
      defaultEveningWorkStart: project.workPeriod === "evening" ? times.start : "",
      defaultEveningWorkEnd: project.workPeriod === "evening" ? times.end : "",
      defaultNightWorkStart: project.workPeriod === "night" ? times.start : "",
      defaultNightWorkEnd: project.workPeriod === "night" ? times.end : "",
      weekPlan: testWeekPlan(project.workPeriod),
      startDate: testTimesheetWeekStart(project.projectIndex),
    });

    return normalizeTimesheet({
      ...timesheet,
      id: testDataId("timesheet", ownerRole, workerIndex),
      vikarAddress: testWorkerAddress(globalIndex),
      vikarCpr: testWorkerCpr(globalIndex),
      days: timesheet.days.map((day, dayIndex) =>
        dayIndex === cancelledDayIndex
          ? {
              ...day,
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
              absence: "dayoff",
              comment: "Aflyst vagt",
            }
          : day,
      ),
      status: testTimesheetStatus(project.projectIndex),
      invoiceSentDate: testInvoiceSentDate(project.projectIndex),
      payrollSentDate: testPayrollSentDate(project.projectIndex),
      createdAt: `${testTimesheetWeekStart(project.projectIndex)}T08:00:00.000Z`,
      updatedAt: `${TEST_DATA_BASE_DATE}T08:00:00.000Z`,
    });
  });

  return { companies, timesheets };
}

function buildTestDataSeed(): { companies: Company[]; timesheets: Timesheet[] } {
  const demoWeekStart = TEST_DATA_CURRENT_WEEK_START;
  const demoWorkers = demoWorkersSeed();

  return {
    companies: demoCompaniesForSeed(demoWeekStart, demoWorkers),
    timesheets: demoWorkers.map((worker, index) => createDemoTimesheet(worker, demoWeekStart, index)),
  };
}

function isSupersededBulkTestDataId(id: string): boolean {
  return /^testdata-\d{4}-\d{2}-\d{2}-v\d+-(?:bruger|bruger2)-(?:company|timesheet)-/u.test(id);
}

function testTimesheetMatchesSeed(existing: Timesheet | undefined, testTimesheet: Timesheet) {
  return (
    existing &&
    existing.projectEndDate === testTimesheet.projectEndDate &&
    existing.weekStart === testTimesheet.weekStart &&
    existing.status === testTimesheet.status &&
    (existing.invoiceSentDate ?? "") === (testTimesheet.invoiceSentDate ?? "") &&
    (existing.payrollSentDate ?? "") === (testTimesheet.payrollSentDate ?? "")
  );
}

function testProjectMatchesSeed(
  existing: CompanyProject | undefined,
  testProject: CompanyProject,
): boolean {
  return Boolean(
    existing &&
    existing.startDate === testProject.startDate &&
    existing.endDate === testProject.endDate &&
    existing.workerEmails.length === testProject.workerEmails.length &&
    existing.workerEmails.every(
      (reference, index) => reference === testProject.workerEmails[index],
    ),
  );
}

function legacyDemoWeekStart(timesheet: Timesheet): string {
  return timesheet.status === "sent" || timesheet.status === "approved"
    ? addDaysToISODate(TEST_DATA_CURRENT_WEEK_START, -7)
    : TEST_DATA_CURRENT_WEEK_START;
}

function refreshLegacyDemoTimesheetDates(timesheet: Timesheet): Timesheet {
  if (!LEGACY_DEMO_TIMESHEET_ID.test(timesheet.id)) return timesheet;
  const weekStart = legacyDemoWeekStart(timesheet);
  return normalizeTimesheet({
    ...timesheet,
    weekStart,
    projectEndDate: addDaysToISODate(TEST_DATA_CURRENT_WEEK_START, 28),
    invoiceDueDate: timesheet.invoiceDueDate
      ? addDaysToISODate(TEST_DATA_CURRENT_WEEK_START, 8)
      : "",
    payrollDeadline: timesheet.payrollDeadline
      ? addDaysToISODate(TEST_DATA_CURRENT_WEEK_START, 2)
      : "",
    invoiceSentDate: timesheet.invoiceSentDate ? TEST_DATA_INVOICE_SENT_DATE : "",
    payrollSentDate: timesheet.payrollSentDate ? TEST_DATA_PAYROLL_SENT_DATE : "",
    invoiceArchivedAt: timesheet.invoiceArchivedAt
      ? `${TEST_DATA_INVOICE_SENT_DATE}T08:00:00.000Z`
      : "",
    createdAt: `${weekStart}T08:00:00.000Z`,
    updatedAt: `${TEST_DATA_BASE_DATE}T08:00:00.000Z`,
  });
}

function hasCurrentLegacyDemoDates(timesheets: Timesheet[]): boolean {
  return timesheets
    .filter((timesheet) => LEGACY_DEMO_TIMESHEET_ID.test(timesheet.id))
    .every((timesheet) => {
      const expectedWeekStart = legacyDemoWeekStart(timesheet);
      return (
        timesheet.weekStart === expectedWeekStart &&
        timesheet.projectEndDate === addDaysToISODate(TEST_DATA_CURRENT_WEEK_START, 28) &&
        (!timesheet.invoiceSentDate || timesheet.invoiceSentDate === TEST_DATA_INVOICE_SENT_DATE) &&
        (!timesheet.payrollSentDate || timesheet.payrollSentDate === TEST_DATA_PAYROLL_SENT_DATE)
      );
    });
}

function hasCurrentTestData(companies: Company[], timesheets: Timesheet[]): boolean {
  const { companies: testCompanies, timesheets: testTimesheets } = buildTestDataSeed();
  const deletedCompanyIds = readDeletedIds(DELETED_COMPANY_IDS_KEY);
  const deletedTimesheetIds = readDeletedIds(DELETED_TIMESHEET_IDS_KEY);

  const requiredTestCompanies = testCompanies.filter(
    (company) => !deletedCompanyIds.has(company.id),
  );

  const requiredTestTimesheets = testTimesheets.filter(
    (timesheet) => !deletedTimesheetIds.has(timesheet.id),
  );

  const companyIds = new Set(companies.map((company) => company.id));
  const timesheetsById = new Map(timesheets.map((timesheet) => [timesheet.id, timesheet]));
  const projectIds = new Set(
    companies.flatMap((company) => company.projects.map((project) => project.id)),
  );
  const projectsById = new Map(
    companies.flatMap((company) => company.projects.map((project) => [project.id, project])),
  );

  const requiredTestProjectIds = requiredTestCompanies.flatMap((company) =>
    company.projects.map((project) => project.id),
  );

  return (
    requiredTestCompanies.every((company) => companyIds.has(company.id)) &&
    requiredTestProjectIds.every((projectId) => projectIds.has(projectId)) &&
    requiredTestCompanies.every((company) =>
      company.projects.every((project) =>
        testProjectMatchesSeed(projectsById.get(project.id), project),
      ),
    ) &&
    requiredTestTimesheets.every((timesheet) =>
      testTimesheetMatchesSeed(timesheetsById.get(timesheet.id), timesheet),
    ) &&
    hasCurrentLegacyDemoDates(timesheets)
  );
}

function mergeTestTimesheet(existing: Timesheet, testTimesheet: Timesheet): Timesheet {
  return normalizeTimesheet({
    ...existing,
    projectEndDate: testTimesheet.projectEndDate,
    weekStart: testTimesheet.weekStart,
    days: testTimesheet.days,
    status: testTimesheet.status,
    invoiceSentDate: testTimesheet.invoiceSentDate,
    payrollSentDate: testTimesheet.payrollSentDate,
    updatedAt: new Date().toISOString(),
  });
}

function mergeTestDataSeed(
  existingCompanies: Company[],
  existingTimesheets: Timesheet[],
): { companies: Company[]; timesheets: Timesheet[] } {
  const { companies: testCompanies, timesheets: testTimesheets } = buildTestDataSeed();
  const deletedCompanyIds = readDeletedIds(DELETED_COMPANY_IDS_KEY);
  const deletedTimesheetIds = readDeletedIds(DELETED_TIMESHEET_IDS_KEY);
  const refreshedExistingTimesheets = existingTimesheets
    .filter((timesheet) => !isSupersededBulkTestDataId(timesheet.id))
    .map(refreshLegacyDemoTimesheetDates);
  const legacyProjectDates = new Map(
    refreshedExistingTimesheets
      .filter((timesheet) => LEGACY_DEMO_TIMESHEET_ID.test(timesheet.id) && timesheet.projectId)
      .map((timesheet) => [
        timesheet.projectId,
        {
          startDate: timesheet.weekStart,
          endDate: timesheet.projectEndDate ?? TEST_DATA_DATES.activeProjectEndDate,
        },
      ]),
  );
  const refreshedExistingCompanies = existingCompanies
    .filter((company) => !isSupersededBulkTestDataId(company.id))
    .map((company) => ({
      ...company,
      projects: company.projects.map((project) => {
        const dates = legacyProjectDates.get(project.id);
        return dates ? { ...project, ...dates } : project;
      }),
    }));

  const companiesById = new Map(
    refreshedExistingCompanies
      .filter((company) => !deletedCompanyIds.has(company.id))
      .map((company) => [company.id, company]),
  );

  const timesheetsById = new Map(
    refreshedExistingTimesheets
      .filter((timesheet) => !deletedTimesheetIds.has(timesheet.id))
      .map((timesheet) => [timesheet.id, timesheet]),
  );

  for (const testCompany of testCompanies) {
    if (deletedCompanyIds.has(testCompany.id)) continue;

    const existingCompany = companiesById.get(testCompany.id);
    if (!existingCompany) {
      companiesById.set(testCompany.id, testCompany);
      continue;
    }

    const projectsById = new Map(existingCompany.projects.map((project) => [project.id, project]));
    let hasProjectChanges = false;

    for (const testProject of testCompany.projects) {
      const existingProject = projectsById.get(testProject.id);
      if (!existingProject) {
        projectsById.set(testProject.id, testProject);
        hasProjectChanges = true;
        continue;
      }
      if (!testProjectMatchesSeed(existingProject, testProject)) {
        projectsById.set(testProject.id, {
          ...existingProject,
          startDate: testProject.startDate,
          endDate: testProject.endDate,
          workerEmails: testProject.workerEmails,
        });
        hasProjectChanges = true;
      }
    }

    if (hasProjectChanges) {
      companiesById.set(testCompany.id, {
        ...existingCompany,
        projects: [...projectsById.values()],
      });
    }
  }

  for (const testTimesheet of testTimesheets) {
    if (deletedTimesheetIds.has(testTimesheet.id)) continue;

    const existingTimesheet = timesheetsById.get(testTimesheet.id);
    if (!existingTimesheet) {
      timesheetsById.set(testTimesheet.id, testTimesheet);
      continue;
    }

    if (!testTimesheetMatchesSeed(existingTimesheet, testTimesheet)) {
      timesheetsById.set(testTimesheet.id, mergeTestTimesheet(existingTimesheet, testTimesheet));
    }
  }

  return {
    companies: [...companiesById.values()],
    timesheets: [...timesheetsById.values()],
  };
}

export function seedIfEmpty(): void {
  const enableLocalTestDataSeed = import.meta.env.VITE_ENABLE_TEST_DATA_SEED === "true";
  if (!enableLocalTestDataSeed) return;
  const existingTimesheets = readTimesheets();
  const existingCompanies = listCompanies();
  const hasSeededCurrentVersion =
    storageForKey(TEST_DATA_SEED_KEY)?.getItem(TEST_DATA_SEED_KEY) === TEST_DATA_SEED_VERSION;

  if (hasSeededCurrentVersion && hasCurrentTestData(existingCompanies, existingTimesheets)) {
    return;
  }

  const { companies, timesheets } = mergeTestDataSeed(existingCompanies, existingTimesheets);

  setStorageItem(TIMESHEET_KEY, JSON.stringify(timesheets));
  setStorageItem(COMPANY_KEY, JSON.stringify(companies));
  setStorageItem(TEST_DATA_SEED_KEY, TEST_DATA_SEED_VERSION);
  markLocalUpdated();
  emit();
}
