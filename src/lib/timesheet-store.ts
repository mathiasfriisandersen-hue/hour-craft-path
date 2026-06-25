import {
  activeCollectiveAgreements,
  collectiveAgreements,
  getCollectiveAgreementById,
  getCollectiveAgreementByName,
} from "./collectiveAgreements";
import {
  AGREEMENT_RULE_SOURCE_LABEL,
  agreementRuleSourceHref,
  agreementRuleSourceLabel,
  defaultAgreementRules,
  type AgreementRule,
  type AgreementRuleSource,
  type AgreementRuleSourceKey,
} from "./agreementRules";
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

export type AbsenceType = "none" | "sick" | "vacation" | "dayoff";

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  none: "Arbejdsdag",
  sick: "Sygdom",
  vacation: "Ferie",
  dayoff: "Fridag",
};

export type DayEntry = {
  start: string;
  end: string;
  pause: number;
  taskType: string;
  comment: string;
  absence: AbsenceType;
  shiftWork: boolean;
};

export type Timesheet = {
  id: string;
  vikar: string;
  vikarEmail: string;
  brugervirksomhed: string;
  kontaktperson: string;
  kontaktpersonEmail: string;
  referenceNo: string;
  arbejdssted: string;
  selectedAgreementId: string;
  overenskomst?: string;
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
  contactEmail: string;
  address: string;
  localAgreements: LocalAgreement[];
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
  weekend: number;
  evening: number;
  night: number;
  shift: number;
  localAgreement: number;
  missingRules: string[];
};

const TIMESHEET_KEY = "timesheets-v1";
const RULE_KEY = "timesheet-rules-v1";
const COMPANY_KEY = "timesheet-companies-v1";
const ADMIN_EMAIL = "mathiasfriisandersen@gmail.com";

export function emptyDay(): DayEntry {
  return {
    start: "",
    end: "",
    pause: 0,
    taskType: "",
    comment: "",
    absence: "none",
    shiftWork: false,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDay(value: Partial<DayEntry> | undefined): DayEntry {
  return { ...emptyDay(), ...value };
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
  notes?: string;
};

function normalizeTimesheet(value: StoredTimesheet): Timesheet {
  const now = new Date().toISOString();
  const days = Array.from({ length: 7 }, (_, index) => normalizeDay(value.days?.[index]));
  const migratedAgreementId =
    value.selectedAgreementId || getCollectiveAgreementByName(value.overenskomst ?? "")?.id || "";
  const agreementName =
    getCollectiveAgreementById(migratedAgreementId)?.name ?? value.overenskomst ?? "";
  const localAgreementApplies = value.localAgreementApplies ?? value.lokalaftale ?? false;
  return {
    ...value,
    vikarEmail: value.vikarEmail ?? "",
    referenceNo: value.referenceNo ?? "",
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
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(mondayISO: string): string {
  const monday = new Date(`${mondayISO}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("da-DK", { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
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

export function dayHours(day: DayEntry): number {
  if (day.absence !== "none") return 0;
  const start = minutes(day.start);
  const rawEnd = minutes(day.end);
  if (start === null || rawEnd === null || rawEnd === start) return 0;
  const end = rawEnd < start ? rawEnd + 24 * 60 : rawEnd;
  return round(Math.max(0, end - start - (day.pause || 0)) / 60);
}

export function totalHours(days: DayEntry[]): number {
  return round(days.reduce((sum, day) => sum + dayHours(day), 0));
}

export function overtimeHours(days: DayEntry[], weeklyLimit = 37): number {
  return round(Math.max(0, totalHours(days) - weeklyLimit));
}

function overlapHours(day: DayEntry, from: string, to: string): number {
  const start = minutes(day.start);
  const rawEnd = minutes(day.end);
  const rangeStart = minutes(from);
  const rangeEnd = minutes(to);
  if (
    day.absence !== "none" ||
    start === null ||
    rawEnd === null ||
    rangeStart === null ||
    rangeEnd === null
  ) {
    return 0;
  }
  const end = rawEnd <= start ? rawEnd + 24 * 60 : rawEnd;
  const adjustedRangeEnd = rangeEnd <= rangeStart ? rangeEnd + 24 * 60 : rangeEnd;
  const intervals = [-24 * 60, 0, 24 * 60].map((offset) => [
    rangeStart + offset,
    adjustedRangeEnd + offset,
  ]);
  return round(
    intervals.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(end, b) - Math.max(start, a)), 0) /
      60,
  );
}

function storageForKey(key: string): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return key === RULE_KEY ? window.localStorage : window.sessionStorage;
}

function safeParse<T>(key: string, fallback: T): T {
  const storage = storageForKey(key);
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
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
}

function emit(): void {
  window.dispatchEvent(new Event("timesheets-changed"));
}

function readTimesheets(): Timesheet[] {
  return safeParse<Timesheet[]>(TIMESHEET_KEY, []).map(normalizeTimesheet);
}

function writeTimesheets(list: Timesheet[]): void {
  setStorageItem(TIMESHEET_KEY, JSON.stringify(list));
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
  writeTimesheets(list);
  return updated;
}

export function remove(id: string): void {
  writeTimesheets(readTimesheets().filter((item) => item.id !== id));
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  removeStorageItem(TIMESHEET_KEY);
  emit();
}

export function createBlank(): Timesheet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    vikar: "",
    vikarEmail: "",
    brugervirksomhed: "",
    kontaktperson: "",
    kontaktpersonEmail: "",
    referenceNo: "",
    arbejdssted: "",
    selectedAgreementId: "",
    overenskomst: "",
    localAgreementApplies: false,
    lokalaftale: false,
    weekStart: getMondayISO(),
    days: Array.from({ length: 7 }, emptyDay),
    notes: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
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
  if (!t.selectedAgreementId || !getCollectiveAgreementById(t.selectedAgreementId))
    errors.push("Vælg en aktiv overenskomst");
  t.days.forEach((day, index) => {
    if (day.absence === "none" && Boolean(day.start) !== Boolean(day.end))
      errors.push(`${WEEKDAYS[index]}: Udfyld både start og slut`);
    if (day.start && day.end && day.start === day.end)
      errors.push(`${WEEKDAYS[index]}: Start og slut kan ikke være ens`);
    if (day.pause < 0) errors.push(`${WEEKDAYS[index]}: Pause kan ikke være negativ`);
  });
  return errors;
}

type StoredAgreementRule = AgreementRule & {
  name?: string;
  sourcePages?: Partial<Record<AgreementRuleSourceKey, number>>;
  sources?: AgreementRuleSource[];
};

function isGeneratedRuleText(value?: string) {
  return Boolean(value?.trim().includes("er fundet i PDF-kilden. Brug kildehenvisningen til side"));
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
  return safeParse<Company[]>(COMPANY_KEY, []);
}

export function saveCompany(company: Company): void {
  const list = listCompanies();
  const index = list.findIndex((item) => item.id === company.id);
  if (index >= 0) list[index] = company;
  else list.push(company);
  setStorageItem(COMPANY_KEY, JSON.stringify(list));
  emit();
}

export function removeCompany(id: string): void {
  setStorageItem(
    COMPANY_KEY,
    JSON.stringify(listCompanies().filter((company) => company.id !== id)),
  );
  emit();
}

export function calculateTimesheet(t: Timesheet): CalculationResult {
  if (!t.selectedAgreementId) {
    const total = totalHours(t.days);
    return {
      total,
      agreementId: "",
      agreementName: "",
      agreementCategory: "",
      industryArea: "",
      canCalculateRatesAutomatically: false,
      rateValidationStatus: "missing_pdf",
      validationNote: "Vælg en overenskomst, før regelgrundlaget kan vurderes.",
      normal: total,
      overtime: 0,
      saturday: 0,
      sunday: 0,
      weekend: 0,
      evening: 0,
      night: 0,
      shift: 0,
      localAgreement: t.localAgreementApplies ? total : 0,
      missingRules: ["valgt overenskomst"],
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
  const total = totalHours(t.days);
  const missingRules: string[] = [];
  const saturday = dayHours(t.days[5]);
  const sunday = dayHours(t.days[6]);
  const evening = rule?.eveningStart
    ? t.days.reduce(
        (sum, day) => sum + overlapHours(day, rule.eveningStart, rule.nightStart || "23:59"),
        0,
      )
    : 0;
  const night =
    rule?.nightStart && rule.nightEnd
      ? t.days.reduce((sum, day) => sum + overlapHours(day, rule.nightStart, rule.nightEnd), 0)
      : 0;
  const shift = round(t.days.reduce((sum, day) => sum + (day.shiftWork ? dayHours(day) : 0), 0));
  const overtime = rule?.normalWeekHours ? Math.max(0, total - rule.normalWeekHours) : 0;

  if (!summary.canCalculateRatesAutomatically) {
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
      weekend: round(saturday + sunday),
      evening: round(evening),
      night: round(night),
      shift,
      localAgreement: t.localAgreementApplies ? total : 0,
      missingRules: [summary.validationNote],
    };
  }

  let validatedOvertime = overtime;

  if (rule?.normalWeekHours) {
    validatedOvertime = Math.max(validatedOvertime, total - rule.normalWeekHours);
  } else {
    missingRules.push("normal ugentlig arbejdstid");
  }
  if (rule?.normalDayHours) {
    const daily = t.days.reduce(
      (sum, day) => sum + Math.max(0, dayHours(day) - rule.normalDayHours!),
      0,
    );
    validatedOvertime = Math.max(validatedOvertime, daily);
  } else {
    missingRules.push("normal daglig arbejdstid");
  }
  if (!rule?.overtimeRule) missingRules.push("overarbejdsregel");
  if (!rule?.validFrom || !rule?.validTo) missingRules.push("reglernes gyldighedsperiode");
  if (saturday > 0 && !rule?.saturdayRule) missingRules.push("lørdagstillæg");
  if (sunday > 0 && !rule?.sundayRule) missingRules.push("søndagstillæg");
  if (evening > 0 && !rule?.eveningRule) missingRules.push("aftentillæg");
  if (night > 0 && !rule?.nightRule) missingRules.push("nattillæg");
  if (t.days.some((day) => day.shiftWork) && !rule?.shiftRule)
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
    weekend: round(saturday + sunday),
    evening: round(evening),
    night: round(night),
    shift,
    localAgreement: t.localAgreementApplies ? total : 0,
    missingRules: [...new Set(missingRules)],
  };
}

export function emailSubject(t: Timesheet): string {
  return `Timeseddel – ${t.vikar} – uge ${weekNumber(t.weekStart)} – ${t.brugervirksomhed}`;
}

export function emailBody(t: Timesheet): string {
  const calc = calculateTimesheet(t);
  const rule = getRule(t.selectedAgreementId);
  const dayLines = WEEKDAYS.map((name, index) => {
    const day = t.days[index];
    const registration =
      day.absence !== "none"
        ? ABSENCE_LABEL[day.absence]
        : day.start && day.end
          ? `${day.start}–${day.end}, pause ${day.pause} min, ${dayHours(day).toFixed(2)} t`
          : "Ingen registrering";
    const details = [day.taskType, day.shiftWork ? "Skiftehold" : "", day.comment]
      .filter(Boolean)
      .join(" · ");
    return `${name}: ${registration}${details ? ` (${details})` : ""}`;
  });
  const sourceLines =
    rule?.sources.map(
      (source) =>
        `${agreementRuleSourceLabel(source)}: ${source.pdfFileName || source.pdfUrl}, side ${source.page} (${agreementRuleSourceHref(source)})`,
    ) ?? [];
  return [
    "TIMESSEDDEL",
    "",
    `Vikar: ${t.vikar}`,
    `Vikarens e-mail: ${t.vikarEmail}`,
    `Brugervirksomhed: ${t.brugervirksomhed}`,
    `Kontaktperson: ${t.kontaktperson}`,
    `Kontaktpersonens e-mail: ${t.kontaktpersonEmail}`,
    `Reference: ${t.referenceNo || "—"}`,
    `Arbejdssted: ${t.arbejdssted}`,
    `Uge: ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
    `Valgt overenskomst: ${calc.agreementName || "—"}`,
    `Kategori: ${calc.agreementCategory || "—"}`,
    `Brancheområde: ${calc.industryArea || "—"}`,
    `PDF-kilde: ${calc.pdfUrl || calc.pdfFileName || "PDF mangler"}`,
    `Valideringsstatus: ${calc.rateValidationStatus}`,
    `Lokalaftale: ${t.localAgreementApplies ? "Ja" : "Nej"}`,
    "",
    "REGISTRERINGER",
    ...dayLines,
    "",
    "SAMLET TIMETAL",
    `Samlede timer: ${calc.total.toFixed(2)}`,
    `Mulige overarbejdstimer: ${calc.overtime.toFixed(2)}`,
    `Lørdagstimer: ${calc.saturday.toFixed(2)}`,
    `Søndagstimer: ${calc.sunday.toFixed(2)}`,
    `Aftentimer: ${calc.evening.toFixed(2)}`,
    `Nattetimer: ${calc.night.toFixed(2)}`,
    `Skifteholdstimer: ${calc.shift.toFixed(2)}`,
    "",
    "NOTER",
    t.notes || "—",
    "",
    "VALIDERINGSNOTE FOR TILLÆG",
    calc.validationNote,
    calc.canCalculateRatesAutomatically
      ? "Automatisk satsberegning er aktiveret for denne overenskomst."
      : "Automatisk satsberegning er ikke aktiveret for denne overenskomst.",
    "",
    "KILDER",
    ...(sourceLines.length ? sourceLines : ["Ingen regel-/tillægskilder er registreret endnu."]),
    "",
    "Timesedlen er afsendt til kontrol. Tillæg, satser og eventuelle lokalaftaler skal kontrolleres mod PDF-kilden før løn- eller fakturabehandling.",
  ].join("\n");
}

export function mailtoUrl(t: Timesheet): string {
  const recipients = [ADMIN_EMAIL, t.kontaktpersonEmail].filter(Boolean).join(",");
  return `mailto:${recipients}?subject=${encodeURIComponent(emailSubject(t))}&body=${encodeURIComponent(emailBody(t))}`;
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
