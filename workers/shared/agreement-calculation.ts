import {
  AGREEMENT_TIME_ZONE,
  calculateAgreementSnapshot,
  DUPLICATE_SHIFT_ID,
  INVALID_WORK_DATE,
  isStrictWorkDate,
  type AgreementCalculationInput,
  type AgreementRule,
  type AgreementRuleType,
  type AgreementSourceReference,
  type CalculationBreak,
  type CalculationShift,
  type LocalOverride,
  type RuleConditions,
  type RuleRate,
  type VerificationStatus,
} from "../../shared/agreement-engine";
import type { AuthSession } from "./auth";

type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
};

export type CalculationDatabase = {
  prepare(query: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown[]>;
};

export class AgreementCalculationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AgreementCalculationError";
    this.code = code;
    this.status = status;
  }
}

type CalculationContextRow = {
  id: string;
  data: string;
  row_version: number;
  calculation_revision: number;
  worker_record_id: string;
  employment_term_id: string;
  agreement_assignment_id: string;
  base_hourly_rate_cents: number | null;
  employment_source_reference: string;
  employment_source_sha256: string | null;
  agreement_version_id: string;
  agreement_id: string;
  agreement_title: string;
  version_valid_from: string;
  version_valid_to: string | null;
  implementation_status: string;
  version_verification_status: VerificationStatus;
  assignment_status: string;
};

type RuleRow = {
  agreement_version_id: string;
  rule_id: string;
  rule_schema_version: number;
  rule_type: string;
  rule_valid_from: string;
  rule_valid_to: string | null;
  conditions_json: string;
  rule_value_unit: string;
  rule_amount_cents: number | null;
  rule_percentage_basis_points: number | null;
  combination_json: string;
  exclusivity_json: string;
  priority: number;
  occupational_scope: string;
  geographic_scope: string;
  rule_paragraph: string;
  rule_page: string;
  rule_verification_status: VerificationStatus;
  rate_period_id: string | null;
  rate_valid_from: string | null;
  rate_valid_to: string | null;
  rate_value_unit: string | null;
  rate_amount_cents: number | null;
  rate_percentage_basis_points: number | null;
  rate_paragraph: string | null;
  rate_page: string | null;
  rate_verification_status: VerificationStatus | null;
  source_id: string | null;
  source_title: string | null;
  official_url: string | null;
  source_sha256: string | null;
  source_paragraph: string | null;
  source_page: string | null;
  source_verification_status: VerificationStatus | null;
};

type OverrideRow = {
  id: string;
  override_version: number;
  base_rule_id: string;
  scope_type: string;
  company_id: string | null;
  workplace_id: string | null;
  project_id: string | null;
  employment_term_id: string | null;
  valid_from: string;
  valid_to: string | null;
  change_type: "replace" | "add" | "disable";
  value_unit: string;
  amount_cents: number | null;
  percentage_basis_points: number | null;
  duration_minutes: number | null;
  documentation_title: string;
  documentation_reference: string;
  documentation_sha256: string;
  approved_by_membership_id: string | null;
};

type StoredDay = {
  id?: string;
  start?: string;
  end?: string;
  pauseStart?: string;
  pauseEnd?: string;
  pause2Start?: string;
  pause2End?: string;
  absence?: string;
};

type StoredTimesheet = {
  id?: string;
  weekStart?: string;
  days?: StoredDay[];
};

const SUPPORTED_RULE_TYPES = new Set<AgreementRuleType>([
  "minimum_base_rate",
  "allowance",
  "overtime",
  "minimum_call",
  "pension",
  "vacation_pay",
  "free_choice",
  "sh_savings",
  "other",
]);

const copenhagenPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGREEMENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function calculateAndPersistTimesheet(
  database: CalculationDatabase,
  session: AuthSession,
  timesheetId: string,
  expectedRowVersion: number,
  asOf: string,
): Promise<{
  snapshot: Awaited<ReturnType<typeof calculateAgreementSnapshot>>;
  rowVersion: number;
}> {
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) {
    throw new AgreementCalculationError(
      "precondition_required",
      "Beregningen kræver den senest læste timeseddelversion.",
      428,
    );
  }
  const context = await loadCalculationContext(database, session.organizationId, timesheetId);
  if (!context) {
    throw new AgreementCalculationError("not_found", "Timesedlen blev ikke fundet.", 404);
  }
  if (context.row_version !== expectedRowVersion) {
    throw new AgreementCalculationError(
      "version_conflict",
      "Timesedlen er ændret af en anden. Hent den nyeste version og prøv igen.",
      409,
    );
  }

  const stored = parseStoredTimesheet(context.data);
  const preflightReasons: string[] = [];
  const shifts = buildCalculationShifts(stored, preflightReasons);
  if (!Number.isSafeInteger(context.base_hourly_rate_cents)) {
    preflightReasons.push(
      "Det serverregistrerede ansættelsesforhold mangler en grundløn i hele øre.",
    );
  }
  if (!context.employment_source_reference.trim()) {
    preflightReasons.push("Grundlønnen mangler en serverregistreret kildehenvisning.");
  }
  if (
    context.employment_source_sha256 &&
    !/^[a-f0-9]{64}$/i.test(context.employment_source_sha256)
  ) {
    preflightReasons.push("Grundlønnens dokumenthash er ugyldig.");
  }
  if (context.assignment_status !== "active") {
    preflightReasons.push("Overenskomsttildelingen er ikke aktiv.");
  }

  const ruleRows = await loadRuleRows(database, context.agreement_version_id);
  const rules = ruleRows.map(ruleFromRow);
  const overrides =
    (
      await database
        .prepare(
          `SELECT
          id,
          override_version,
          base_rule_id,
          scope_type,
          company_id,
          workplace_id,
          project_id,
          employment_term_id,
          valid_from,
          valid_to,
          change_type,
          value_unit,
          amount_cents,
          percentage_basis_points,
          duration_minutes,
          documentation_title,
          documentation_reference,
          documentation_sha256,
          approved_by_membership_id
        FROM local_overrides
        WHERE organization_id = ?
          AND agreement_assignment_id = ?
          AND status = 'approved'
        ORDER BY base_rule_id, valid_from, override_version`,
        )
        .bind(session.organizationId, context.agreement_assignment_id)
        .all<OverrideRow>()
    ).results?.map(overrideFromRow) ?? [];

  const calculationId = crypto.randomUUID();
  const input: AgreementCalculationInput = {
    calculationId,
    asOf,
    timeZone: AGREEMENT_TIME_ZONE,
    agreementVersion: {
      id: context.agreement_version_id,
      agreementId: context.agreement_id,
      title: context.agreement_title,
      validFrom: context.version_valid_from,
      validTo: context.version_valid_to ?? "9999-12-31",
      verificationStatus: context.version_verification_status,
      rulesetComplete:
        context.implementation_status === "implemented" &&
        context.version_verification_status === "verified_and_active",
    },
    employment: {
      employmentId: context.employment_term_id,
      baseRateOrePerHour: context.base_hourly_rate_cents ?? 0,
      sourceLabel: "Serverregistreret ansættelsesvilkår",
      sourceReference: context.employment_source_reference,
    },
    shifts,
    rules,
    overrides,
    preflightManualReviewReasons: preflightReasons,
  };
  const snapshot = await calculateAgreementSnapshot(input);
  const hardFailureCode = snapshot.manualReviewCodes.find(
    (code) => code === INVALID_WORK_DATE || code === DUPLICATE_SHIFT_ID,
  );
  if (hardFailureCode) {
    throw new AgreementCalculationError(
      hardFailureCode,
      snapshot.manualReviewReasons.find((reason) => reason.startsWith(`${hardFailureCode}:`)) ??
        "Beregningsinputtet kræver manuel gennemgang.",
      422,
    );
  }
  const nextRevision = context.calculation_revision + 1;
  const nextRowVersion = context.row_version + 1;
  const statements = persistStatements(database, session, context, input, snapshot, nextRevision);
  await database.batch(statements);
  return { snapshot, rowVersion: nextRowVersion };
}

async function loadCalculationContext(
  database: CalculationDatabase,
  organizationId: string,
  timesheetId: string,
): Promise<CalculationContextRow | null> {
  return database
    .prepare(
      `SELECT
        timesheet.id,
        timesheet.data,
        timesheet.row_version,
        timesheet.calculation_revision,
        timesheet.worker_record_id,
        timesheet.employment_term_id,
        timesheet.agreement_assignment_id,
        employment.base_hourly_rate_cents,
        employment.source_reference AS employment_source_reference,
        employment.source_document_sha256 AS employment_source_sha256,
        assignment.status AS assignment_status,
        version.id AS agreement_version_id,
        version.valid_from AS version_valid_from,
        version.valid_to AS version_valid_to,
        version.implementation_status,
        version.verification_status AS version_verification_status,
        agreement.id AS agreement_id,
        agreement.exact_title AS agreement_title
      FROM timesheets AS timesheet
      INNER JOIN employment_terms AS employment
        ON employment.organization_id = timesheet.organization_id
       AND employment.id = timesheet.employment_term_id
      INNER JOIN agreement_assignments AS assignment
        ON assignment.organization_id = timesheet.organization_id
       AND assignment.id = timesheet.agreement_assignment_id
      INNER JOIN agreement_versions AS version
        ON version.id = assignment.agreement_version_id
      INNER JOIN agreements AS agreement
        ON agreement.id = version.agreement_id
      WHERE timesheet.id = ?
        AND timesheet.organization_id = ?
        AND timesheet.tenant_migration_status = 'assigned'
      LIMIT 1`,
    )
    .bind(timesheetId, organizationId)
    .first<CalculationContextRow>();
}

async function loadRuleRows(
  database: CalculationDatabase,
  agreementVersionId: string,
): Promise<RuleRow[]> {
  const result = await database
    .prepare(
      `SELECT
        rule.agreement_version_id,
        rule.id AS rule_id,
        rule.rule_schema_version,
        rule.rule_type,
        rule.valid_from AS rule_valid_from,
        rule.valid_to AS rule_valid_to,
        rule.conditions_json,
        rule.value_unit AS rule_value_unit,
        rule.amount_cents AS rule_amount_cents,
        rule.percentage_basis_points AS rule_percentage_basis_points,
        rule.combination_json,
        rule.exclusivity_json,
        rule.priority,
        rule.occupational_scope,
        rule.geographic_scope,
        rule.paragraph_reference AS rule_paragraph,
        rule.page_reference AS rule_page,
        rule.verification_status AS rule_verification_status,
        rate.id AS rate_period_id,
        rate.valid_from AS rate_valid_from,
        rate.valid_to AS rate_valid_to,
        rate.value_unit AS rate_value_unit,
        rate.amount_cents AS rate_amount_cents,
        rate.percentage_basis_points AS rate_percentage_basis_points,
        rate.paragraph_reference AS rate_paragraph,
        rate.page_reference AS rate_page,
        rate.verification_status AS rate_verification_status,
        source.id AS source_id,
        source.document_title AS source_title,
        source.official_url,
        source.source_sha256,
        source.paragraph_reference AS source_paragraph,
        source.page_reference AS source_page,
        source.verification_status AS source_verification_status
      FROM agreement_rules AS rule
      LEFT JOIN agreement_rate_periods AS rate
        ON rate.agreement_version_id = rule.agreement_version_id
       AND rate.rule_id = rule.id
      LEFT JOIN agreement_sources AS source
        ON source.agreement_version_id = rule.agreement_version_id
       AND source.id = COALESCE(rate.source_id, rule.source_id)
      WHERE rule.agreement_version_id = ?
      ORDER BY rule.rule_key, rule.rule_version, rate.valid_from, rate.rate_version`,
    )
    .bind(agreementVersionId)
    .all<RuleRow>();
  return result.results ?? [];
}

function ruleFromRow(row: RuleRow): AgreementRule {
  const valueUnit = row.rate_value_unit ?? row.rule_value_unit;
  const rate = rateFromColumns(
    valueUnit,
    row.rate_period_id ? row.rate_amount_cents : row.rule_amount_cents,
    row.rate_period_id ? row.rate_percentage_basis_points : row.rule_percentage_basis_points,
  );
  const source = sourceFromRuleRow(row);
  const ruleType = SUPPORTED_RULE_TYPES.has(row.rule_type as AgreementRuleType)
    ? (row.rule_type as AgreementRuleType)
    : "other";
  const supported =
    row.rule_type !== "base_pay" &&
    SUPPORTED_RULE_TYPES.has(row.rule_type as AgreementRuleType) &&
    rate !== null;
  const verificationStatus =
    supported &&
    row.rule_verification_status === "verified_and_active" &&
    (!row.rate_period_id || row.rate_verification_status === "verified_and_active") &&
    row.source_verification_status === "verified_and_active"
      ? "verified_and_active"
      : row.rule_verification_status === "source_conflict" ||
          row.rate_verification_status === "source_conflict" ||
          row.source_verification_status === "source_conflict"
        ? "source_conflict"
        : supported
          ? "manual_review_required"
          : "verified_not_implemented";
  const combination = parseJsonRecord(row.combination_json);
  const exclusivity = parseJsonRecord(row.exclusivity_json);
  return {
    id: row.rate_period_id ? `${row.rule_id}:${row.rate_period_id}` : row.rule_id,
    sourceRuleId: row.rule_id,
    ...(row.rate_period_id ? { ratePeriodId: row.rate_period_id } : {}),
    schemaVersion: row.rule_schema_version,
    agreementVersionId: row.agreement_version_id,
    type: ruleType,
    validFrom: maxDate(row.rule_valid_from, row.rate_valid_from),
    validTo: minDate(row.rule_valid_to, row.rate_valid_to),
    conditions: parseConditions(row.conditions_json),
    rate: rate ?? { kind: "ore_per_occurrence", value: 0 },
    combinationGroup: typeof combination.group === "string" ? combination.group : undefined,
    exclusive: exclusivity.exclusive === true,
    priority: row.priority,
    professionalScope: row.occupational_scope,
    geographicScope: row.geographic_scope,
    source,
    verificationStatus,
    explanation: "Versioneret serverregel med kildesporing.",
  };
}

function sourceFromRuleRow(row: RuleRow): AgreementSourceReference {
  return {
    sourceId: row.source_id ?? "",
    title: row.source_title ?? "",
    officialUrl: row.official_url ?? "",
    paragraph: row.rate_paragraph || row.rule_paragraph || row.source_paragraph || "",
    page: row.rate_page || row.rule_page || row.source_page || "",
    sha256: row.source_sha256 ?? "",
  };
}

function overrideFromRow(row: OverrideRow): LocalOverride {
  const scopeValue =
    row.company_id ||
    row.workplace_id ||
    row.project_id ||
    row.employment_term_id ||
    "organization";
  return {
    id: row.id,
    version: row.override_version,
    baseRuleId: row.base_rule_id,
    scopeKey: `${row.scope_type}:${scopeValue}`,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? "9999-12-31",
    changeType: row.change_type,
    rate:
      rateFromColumns(row.value_unit, row.amount_cents, row.percentage_basis_points) ?? undefined,
    status: "approved",
    documentation: {
      sourceId: row.id,
      title: row.documentation_title,
      officialUrl: `private://local-override/${row.id}`,
      paragraph: row.documentation_reference,
      page: "lokalaftale",
      sha256: row.documentation_sha256,
    },
    approvedBy: row.approved_by_membership_id ?? "",
  };
}

function rateFromColumns(
  valueUnit: string,
  amountCents: number | null,
  basisPoints: number | null,
): RuleRate | null {
  if (valueUnit === "cents_per_hour" && Number.isSafeInteger(amountCents)) {
    return { kind: "ore_per_hour", value: amountCents ?? 0 };
  }
  if (
    (valueUnit === "cents" || valueUnit === "cents_per_unit") &&
    Number.isSafeInteger(amountCents)
  ) {
    return { kind: "ore_per_occurrence", value: amountCents ?? 0 };
  }
  if (valueUnit === "basis_points" && Number.isSafeInteger(basisPoints)) {
    return { kind: "basis_points_of_base", value: basisPoints ?? 0 };
  }
  return null;
}

function parseConditions(value: string): RuleConditions {
  const parsed = parseJsonRecord(value);
  return {
    ...(Array.isArray(parsed.weekdays)
      ? {
          weekdays: parsed.weekdays.filter(
            (entry): entry is number => Number.isInteger(entry) && entry >= 1 && entry <= 7,
          ),
        }
      : {}),
    ...(typeof parsed.publicHoliday === "boolean" ? { publicHoliday: parsed.publicHoliday } : {}),
    ...(safeMinute(parsed.localStartMinute) !== undefined
      ? { localStartMinute: safeMinute(parsed.localStartMinute) }
      : {}),
    ...(safeMinute(parsed.localEndMinute) !== undefined
      ? { localEndMinute: safeMinute(parsed.localEndMinute) }
      : {}),
    ...(Array.isArray(parsed.workTypes)
      ? {
          workTypes: parsed.workTypes.filter((entry): entry is string => typeof entry === "string"),
        }
      : {}),
    ...(safeNonNegativeInteger(parsed.afterDailyMinutes) !== undefined
      ? { afterDailyMinutes: safeNonNegativeInteger(parsed.afterDailyMinutes) }
      : {}),
    ...(safeNonNegativeInteger(parsed.afterWeeklyMinutes) !== undefined
      ? { afterWeeklyMinutes: safeNonNegativeInteger(parsed.afterWeeklyMinutes) }
      : {}),
  };
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeMinute(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1440
    ? Number(value)
    : undefined;
}

function safeNonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function parseStoredTimesheet(value: string): StoredTimesheet {
  try {
    const parsed = JSON.parse(value) as StoredTimesheet;
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    return parsed;
  } catch {
    throw new AgreementCalculationError(
      "stored_timesheet_invalid",
      "Den lagrede timeseddel kræver manuel gennemgang.",
      409,
    );
  }
}

function buildCalculationShifts(timesheet: StoredTimesheet, reasons: string[]): CalculationShift[] {
  if (!timesheet.weekStart || !isStrictWorkDate(timesheet.weekStart)) {
    reasons.push(
      `${INVALID_WORK_DATE}: Timesedlen mangler en gyldig serverregistreret kalenderdato.`,
    );
    return [];
  }
  if (!Array.isArray(timesheet.days)) {
    reasons.push("Timesedlen mangler gyldige dagsregistreringer.");
    return [];
  }
  const shifts: CalculationShift[] = [];
  timesheet.days.slice(0, 14).forEach((day, index) => {
    if (day.absence && day.absence !== "none") return;
    if (!day.start && !day.end) return;
    if (!validClock(day.start) || !validClock(day.end)) {
      reasons.push(`Dag ${index + 1} har ugyldig start eller slut.`);
      return;
    }
    const startDate = addDays(timesheet.weekStart ?? "", index);
    const endDate = day.end! <= day.start! ? addDays(startDate, 1) : startDate;
    const startCandidates = localTimestampCandidates(startDate, day.start!);
    const endCandidates = localTimestampCandidates(endDate, day.end!);
    const pair = chooseInstantPair(startCandidates, endCandidates);
    if (!pair) {
      reasons.push(`Dag ${index + 1} ligger i et ugyldigt lokalt DST-tidsrum.`);
      return;
    }
    if (pair.ambiguous) {
      reasons.push(`Dag ${index + 1} indeholder et tvetydigt DST-tidspunkt.`);
    }
    const breaks = [
      buildBreak(day.pauseStart, day.pauseEnd, startDate, day.start!, pair, reasons, index),
      buildBreak(day.pause2Start, day.pause2End, startDate, day.start!, pair, reasons, index),
    ].filter((entry): entry is CalculationBreak => Boolean(entry));
    const shiftId =
      typeof day.id === "string" && day.id.trim() ? day.id.trim() : `day-${index + 1}`;
    shifts.push({
      id: shiftId,
      start: pair.start,
      end: pair.end,
      breaks,
      workType: "ordinary",
    });
  });
  return shifts;
}

function buildBreak(
  start: string | undefined,
  end: string | undefined,
  shiftStartDate: string,
  shiftStartClock: string,
  shift: { start: string; end: string },
  reasons: string[],
  dayIndex: number,
): CalculationBreak | null {
  if (!start && !end) return null;
  if (!validClock(start) || !validClock(end)) {
    reasons.push(`Dag ${dayIndex + 1} har en ugyldig pause.`);
    return null;
  }
  const breakStartDate = start! < shiftStartClock ? addDays(shiftStartDate, 1) : shiftStartDate;
  const breakEndDate = end! <= start! ? addDays(breakStartDate, 1) : breakStartDate;
  const pair = chooseInstantPair(
    localTimestampCandidates(breakStartDate, start!),
    localTimestampCandidates(breakEndDate, end!),
  );
  if (
    !pair ||
    Date.parse(pair.start) < Date.parse(shift.start) ||
    Date.parse(pair.end) > Date.parse(shift.end)
  ) {
    reasons.push(`Dag ${dayIndex + 1} har en pause uden for vagten.`);
    return null;
  }
  if (pair.ambiguous) reasons.push(`Dag ${dayIndex + 1} har en tvetydig DST-pause.`);
  return { start: pair.start, end: pair.end };
}

function localTimestampCandidates(date: string, time: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const candidates: string[] = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const epochMs = naiveUtc - offsetMinutes * 60_000;
    if (formattedLocal(epochMs) === `${date}T${time}`) {
      candidates.push(formatWithOffset(epochMs, offsetMinutes));
    }
  }
  return [...new Set(candidates)].sort((left, right) => Date.parse(left) - Date.parse(right));
}

function formattedLocal(epochMs: number): string {
  const parts = copenhagenPartsFormatter.formatToParts(new Date(epochMs));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function formatWithOffset(epochMs: number, offsetMinutes: number): string {
  const localEpochMs = epochMs + offsetMinutes * 60_000;
  const local = new Date(localEpochMs).toISOString().slice(0, 16);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${local}${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(
    absolute % 60,
  ).padStart(2, "0")}`;
}

function chooseInstantPair(
  starts: string[],
  ends: string[],
): { start: string; end: string; ambiguous: boolean } | null {
  const pairs = starts
    .flatMap((start) =>
      ends.map((end) => ({
        start,
        end,
        duration: Date.parse(end) - Date.parse(start),
      })),
    )
    .filter((pair) => pair.duration > 0 && pair.duration <= 24 * 60 * 60 * 1000)
    .sort(
      (left, right) =>
        left.duration - right.duration || Date.parse(left.start) - Date.parse(right.start),
    );
  if (!pairs[0]) return null;
  return {
    start: pairs[0].start,
    end: pairs[0].end,
    ambiguous: pairs.length > 1,
  };
}

function persistStatements(
  database: CalculationDatabase,
  session: AuthSession,
  context: CalculationContextRow,
  input: AgreementCalculationInput,
  snapshot: Awaited<ReturnType<typeof calculateAgreementSnapshot>>,
  revision: number,
): PreparedStatement[] {
  const snapshotInsert = database
    .prepare(
      `INSERT INTO calculation_snapshots (
        id,
        organization_id,
        timesheet_id,
        worker_id,
        employment_term_id,
        agreement_assignment_id,
        engine_version,
        schema_version,
        calculation_revision,
        as_of_at,
        timezone,
        status,
        total_work_minutes,
        base_pay_cents,
        allowance_cents,
        overtime_cents,
        pension_cents,
        holiday_pay_cents,
        free_choice_cents,
        sh_holiday_cents,
        gross_pay_cents,
        invoice_total_cents,
        input_sha256,
        rule_set_sha256,
        override_set_sha256,
        result_sha256,
        input_snapshot_json,
        result_snapshot_json,
        manual_review_reasons_json,
        created_by_identity_id
      )
      SELECT
        ?, ?, ?, ?, ?, ?, 'agreement-engine-v1', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0,
        ?, ?, ?, ?, ?, ?, ?, ?
      FROM timesheets
      WHERE id = ?
        AND organization_id = ?
        AND row_version = ?`,
    )
    .bind(
      snapshot.calculationId,
      session.organizationId,
      context.id,
      context.worker_record_id,
      context.employment_term_id,
      context.agreement_assignment_id,
      revision,
      snapshot.asOf,
      snapshot.timeZone,
      snapshot.status,
      snapshot.totalWorkedMinutes,
      snapshot.basePayOre,
      sumLineType(snapshot.lines, "allowance"),
      sumLineType(snapshot.lines, "overtime"),
      sumLineType(snapshot.lines, "pension"),
      sumLineType(snapshot.lines, "vacation_pay"),
      sumLineType(snapshot.lines, "free_choice"),
      sumLineType(snapshot.lines, "sh_savings"),
      snapshot.grossPayOre,
      snapshot.inputHash,
      snapshot.rulesHash,
      snapshot.overrideHash,
      snapshot.resultHash,
      JSON.stringify(input),
      JSON.stringify(snapshot),
      JSON.stringify(snapshot.manualReviewReasons),
      session.userId,
      context.id,
      session.organizationId,
      context.row_version,
    );
  const lineInserts = snapshot.lines.map((line, index) =>
    database
      .prepare(
        `INSERT INTO calculation_lines (
          id,
          organization_id,
          calculation_snapshot_id,
          line_number,
          line_origin,
          work_date,
          work_dates_json,
          line_type,
          quantity_minutes,
          quantity_units,
          base_amount_cents,
          unit_rate_cents,
          percentage_basis_points,
          amount_cents,
          formula,
          explanation,
          agreement_version_id,
          employment_term_id,
          rule_id,
          rate_period_id,
          source_id,
          local_override_id,
          paragraph_reference,
          page_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        session.organizationId,
        snapshot.calculationId,
        index + 1,
        line.type === "base_pay" ? "employment_term" : "agreement_rule",
        line.workDates[0] ?? "",
        JSON.stringify(line.workDates),
        line.type,
        line.minutes,
        line.units,
        line.type === "base_pay" ? snapshot.basePayOre : null,
        line.rate.kind === "ore_per_hour" || line.rate.kind === "ore_per_occurrence"
          ? line.rate.value
          : null,
        line.rate.kind === "basis_points_of_base" ? line.rate.value : null,
        line.amountOre,
        line.formula,
        line.explanation,
        line.agreementVersionId,
        line.type === "base_pay" ? context.employment_term_id : null,
        line.type === "base_pay" ? null : line.ruleId,
        line.type === "base_pay" ? null : (line.ratePeriodId ?? null),
        line.type === "base_pay" ? null : line.source.sourceId,
        line.type === "base_pay" ? null : (line.localOverrideId ?? null),
        line.source.paragraph,
        line.source.page,
      ),
  );
  const timesheetUpdate = database
    .prepare(
      `UPDATE timesheets
       SET calculation_revision = ?,
           last_calculation_snapshot_id = ?,
           row_version = row_version + 1,
           updated_at = ?
       WHERE id = ?
         AND organization_id = ?
         AND row_version = ?`,
    )
    .bind(
      revision,
      snapshot.calculationId,
      snapshot.asOf,
      context.id,
      session.organizationId,
      context.row_version,
    );
  const auditInsert = database
    .prepare(
      `INSERT INTO audit_events (
        id,
        organization_id,
        actor_type,
        actor_identity_id,
        actor_membership_id,
        action,
        object_type,
        object_id,
        correlation_id,
        after_values_json,
        calculation_snapshot_id,
        reason
      ) VALUES (?, ?, 'identity', ?, ?, 'calculation.created', 'calculation_snapshot', ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      session.organizationId,
      session.userId,
      session.membershipId,
      snapshot.calculationId,
      snapshot.calculationId,
      JSON.stringify({
        status: snapshot.status,
        resultHash: snapshot.resultHash,
        revision,
      }),
      snapshot.calculationId,
      snapshot.exportBlocked ? "export_blocked" : "",
    );
  return [snapshotInsert, ...lineInserts, timesheetUpdate, auditInsert];
}

function sumLineType(
  lines: Awaited<ReturnType<typeof calculateAgreementSnapshot>>["lines"],
  type: AgreementRuleType,
): number {
  return lines
    .filter((line) => line.type === type)
    .reduce((total, line) => total + line.amountOre, 0);
}

function maxDate(left: string, right: string | null): string {
  return right && right > left ? right : left;
}

function minDate(left: string | null, right: string | null): string {
  if (!left) return right ?? "9999-12-31";
  if (!right) return left;
  return left < right ? left : right;
}

function validClock(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
