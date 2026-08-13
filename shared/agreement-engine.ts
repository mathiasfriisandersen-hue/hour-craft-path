import { getDanishAgreementHolidayName } from "../src/lib/danishHolidays";

export const AGREEMENT_TIME_ZONE = "Europe/Copenhagen" as const;
export const MANUAL_REVIEW_MESSAGE =
  "Kræver manuel afklaring – beregning kan ikke afsluttes." as const;
export const INVALID_WORK_DATE = "INVALID_WORK_DATE" as const;
export const DUPLICATE_SHIFT_ID = "DUPLICATE_SHIFT_ID" as const;

export type VerificationStatus =
  | "verified_and_active"
  | "verified_not_implemented"
  | "missing_official_source"
  | "source_conflict"
  | "manual_review_required"
  | "out_of_scope";

export type AgreementRuleType =
  | "base_pay"
  | "minimum_base_rate"
  | "allowance"
  | "overtime"
  | "minimum_call"
  | "pension"
  | "vacation_pay"
  | "free_choice"
  | "sh_savings"
  | "other";

export type RuleRate =
  | { kind: "ore_per_hour"; value: number }
  | { kind: "ore_per_occurrence"; value: number }
  | { kind: "basis_points_of_base"; value: number };

export type AgreementSourceReference = {
  sourceId: string;
  title: string;
  officialUrl: string;
  paragraph: string;
  page: string;
  sha256: string;
};

export type RuleConditions = {
  weekdays?: number[];
  publicHoliday?: boolean;
  localStartMinute?: number;
  localEndMinute?: number;
  workTypes?: string[];
  afterDailyMinutes?: number;
  afterWeeklyMinutes?: number;
};

export type AgreementRule = {
  id: string;
  sourceRuleId?: string;
  ratePeriodId?: string;
  schemaVersion: number;
  agreementVersionId: string;
  type: AgreementRuleType;
  validFrom: string;
  validTo: string;
  conditions: RuleConditions;
  rate: RuleRate;
  combinationGroup?: string;
  exclusive?: boolean;
  priority: number;
  professionalScope: string;
  geographicScope: string;
  source: AgreementSourceReference;
  verificationStatus: VerificationStatus;
  explanation: string;
};

export type AgreementVersion = {
  id: string;
  agreementId: string;
  title: string;
  validFrom: string;
  validTo: string;
  verificationStatus: VerificationStatus;
  rulesetComplete: boolean;
};

export type LocalOverride = {
  id: string;
  version: number;
  baseRuleId: string;
  scopeKey: string;
  validFrom: string;
  validTo: string;
  changeType: "replace" | "add" | "disable";
  rate?: RuleRate;
  status: "draft" | "approved" | "expired";
  documentation: AgreementSourceReference;
  approvedBy: string;
};

export type CalculationBreak = {
  start: string;
  end: string;
};

export type CalculationShift = {
  id: string;
  start: string;
  end: string;
  breaks?: CalculationBreak[];
  workType?: string;
};

export type EmploymentTerms = {
  employmentId: string;
  baseRateOrePerHour: number;
  sourceLabel: string;
  sourceReference: string;
};

export type AgreementCalculationInput = {
  calculationId: string;
  asOf: string;
  timeZone: typeof AGREEMENT_TIME_ZONE;
  agreementVersion: AgreementVersion | null;
  employment: EmploymentTerms;
  shifts: CalculationShift[];
  rules: AgreementRule[];
  overrides: LocalOverride[];
  preflightManualReviewReasons?: string[];
};

export type CalculationLine = {
  lineId: string;
  ruleId: string;
  ratePeriodId?: string;
  ruleSchemaVersion: number;
  agreementId: string;
  agreementVersionId: string;
  agreementTitle: string;
  type: AgreementRuleType;
  workDates: string[];
  minutes: number;
  units: number;
  rate: RuleRate;
  formula: string;
  amountOre: number;
  source: AgreementSourceReference;
  localOverrideId?: string;
  explanation: string;
};

export type CalculationSnapshot = {
  calculationId: string;
  asOf: string;
  timeZone: typeof AGREEMENT_TIME_ZONE;
  status: "completed" | "manual_review_required";
  exportBlocked: boolean;
  manualReviewReasons: string[];
  manualReviewCodes: string[];
  totalWorkedMinutes: number;
  basePayOre: number;
  additionsOre: number;
  deductionsOre: number;
  grossPayOre: number;
  lines: CalculationLine[];
  inputHash: string;
  rulesHash: string;
  resultHash: string;
  overrideHash: string;
};

type MinuteRecord = {
  epochMs: number;
  localDate: string;
  localMinute: number;
  weekday: number;
  publicHoliday: boolean;
  shiftId: string;
  workType: string;
  dailyOrdinal: number;
  weeklyOrdinal: number;
};

type EffectiveRule = {
  rule: AgreementRule;
  rate: RuleRate;
  localOverrideId?: string;
  aggregateKey: string;
};

const localPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGREEMENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAY_NUMBER: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export async function calculateAgreementSnapshot(
  input: AgreementCalculationInput,
): Promise<CalculationSnapshot> {
  const reasons = [...(input.preflightManualReviewReasons ?? []), ...validateInput(input)];
  let minutes = hasHardInputBlock(reasons) ? [] : buildMinuteRecords(input.shifts, reasons);
  if (hasHardInputBlock(reasons)) minutes = [];
  const agreementVersion = input.agreementVersion;

  if (!agreementVersion) {
    reasons.push("Der er ikke tilknyttet en servervalideret overenskomstversion.");
  } else {
    if (agreementVersion.verificationStatus !== "verified_and_active") {
      reasons.push(
        `Overenskomstversion ${agreementVersion.id} er ${agreementVersion.verificationStatus}.`,
      );
    }
    if (!agreementVersion.rulesetComplete) {
      reasons.push(`Regelsættet for ${agreementVersion.id} er ikke dokumenteret som komplet.`);
    }
    const workDates = [...new Set(minutes.map((minute) => minute.localDate))];
    if (
      workDates.some(
        (workDate) => workDate < agreementVersion.validFrom || workDate > agreementVersion.validTo,
      )
    ) {
      reasons.push("Mindst én arbejdsdato ligger uden for overenskomstversionens gyldighed.");
    }
  }

  const unresolvedRules = input.rules.filter(
    (rule) => rule.verificationStatus !== "verified_and_active",
  );
  if (unresolvedRules.length > 0) {
    reasons.push(
      `Uverificerede regler: ${unresolvedRules
        .map((rule) => rule.id)
        .sort()
        .join(", ")}.`,
    );
  }

  const executableRules = input.rules.filter((rule) => ruleIsExecutable(rule, agreementVersion));
  const executableOverrides = input.overrides.filter((override) =>
    overrideIsExecutable(override, executableRules),
  );
  const lines = hasHardInputBlock(reasons)
    ? []
    : buildCalculationLines(
        { ...input, overrides: executableOverrides },
        minutes,
        executableRules,
        reasons,
      );
  const basePayOre = lines
    .filter((line) => line.type === "base_pay")
    .reduce((sum, line) => sum + line.amountOre, 0);
  const additionsOre = lines
    .filter((line) => !["base_pay", "minimum_base_rate"].includes(line.type))
    .reduce((sum, line) => sum + Math.max(0, line.amountOre), 0);
  const deductionsOre = lines.reduce((sum, line) => sum + Math.min(0, line.amountOre), 0);
  const grossPayOre = basePayOre + additionsOre + deductionsOre;
  const uniqueReasons = [...new Set(reasons)];
  const manualReviewCodes = [
    ...new Set(
      uniqueReasons.flatMap((reason) => {
        const match = reason.match(/^([A-Z][A-Z0-9_]+):/u);
        return match ? [match[1]] : [];
      }),
    ),
  ];
  const inputHash = await sha256Hex(canonicalStringify(input));
  const rulesHash = await sha256Hex(
    canonicalStringify({
      agreementVersion: input.agreementVersion,
      rules: input.rules,
    }),
  );
  const overrideHash = await sha256Hex(canonicalStringify(input.overrides));
  const snapshotWithoutHash = {
    calculationId: input.calculationId,
    asOf: input.asOf,
    timeZone: input.timeZone,
    status: uniqueReasons.length > 0 ? ("manual_review_required" as const) : ("completed" as const),
    exportBlocked: uniqueReasons.length > 0,
    manualReviewReasons: uniqueReasons.length > 0 ? [MANUAL_REVIEW_MESSAGE, ...uniqueReasons] : [],
    manualReviewCodes,
    totalWorkedMinutes: minutes.length,
    basePayOre,
    additionsOre,
    deductionsOre,
    grossPayOre,
    lines,
    inputHash,
    rulesHash,
    overrideHash,
  };

  return {
    ...snapshotWithoutHash,
    resultHash: await sha256Hex(canonicalStringify(snapshotWithoutHash)),
  };
}

function validateInput(input: AgreementCalculationInput): string[] {
  const reasons: string[] = [];
  if (!input.calculationId.trim()) reasons.push("Beregningen mangler et stabilt ID.");
  if (input.timeZone !== AGREEMENT_TIME_ZONE) {
    reasons.push(`Tidszonen skal være ${AGREEMENT_TIME_ZONE}.`);
  }
  if (!isTimestamp(input.asOf)) reasons.push("Beregningen mangler et gyldigt asOf-tidspunkt.");
  if (
    input.agreementVersion &&
    (!isStrictWorkDate(input.agreementVersion.validFrom) ||
      !isStrictWorkDate(input.agreementVersion.validTo) ||
      input.agreementVersion.validFrom > input.agreementVersion.validTo)
  ) {
    reasons.push(
      validationReason(
        INVALID_WORK_DATE,
        `Overenskomstversion ${input.agreementVersion.id} har en ugyldig kalenderdato.`,
      ),
    );
  }
  if (!Number.isSafeInteger(input.employment.baseRateOrePerHour)) {
    reasons.push("Grundløn skal angives som et helt antal øre pr. time.");
  }
  if (input.employment.baseRateOrePerHour < 0) {
    reasons.push("Grundløn kan ikke være negativ.");
  }
  reasons.push(...validateShifts(input.shifts));
  reasons.push(...validateRules(input.rules, input.agreementVersion));
  reasons.push(...validateOverrides(input.overrides, input.rules));
  return reasons;
}

function validateShifts(shifts: CalculationShift[]): string[] {
  const reasons: string[] = [];
  const seenIds = new Set<string>();

  for (const shift of shifts) {
    const shiftId = shift.id.trim();
    if (!shiftId) {
      reasons.push("Vagten mangler et stabilt ID.");
    } else if (seenIds.has(shiftId)) {
      reasons.push(
        validationReason(
          DUPLICATE_SHIFT_ID,
          `Vagt-ID ${shiftId} forekommer flere gange i samme beregningsinput.`,
        ),
      );
    }
    seenIds.add(shiftId);

    if (!isTimestamp(shift.start) || !isTimestamp(shift.end)) {
      reasons.push(
        validationReason(
          INVALID_WORK_DATE,
          `Vagt ${shiftId || "(uden ID)"} har en ugyldig kalenderdato eller tidsformat.`,
        ),
      );
    }

    for (const entry of shift.breaks ?? []) {
      if (!isTimestamp(entry.start) || !isTimestamp(entry.end)) {
        reasons.push(
          validationReason(
            INVALID_WORK_DATE,
            `Vagt ${shiftId || "(uden ID)"} har en pause med ugyldig kalenderdato eller tidsformat.`,
          ),
        );
      }
    }
  }

  return reasons;
}

function validateRules(
  rules: AgreementRule[],
  agreementVersion: AgreementVersion | null,
): string[] {
  const reasons: string[] = [];
  const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) reasons.push(`Regel-ID ${rule.id} forekommer flere gange.`);
    ids.add(rule.id);
    if (agreementVersion && rule.agreementVersionId !== agreementVersion.id) {
      reasons.push(`Regel ${rule.id} tilhører en anden overenskomstversion.`);
    }
    if (
      !isStrictWorkDate(rule.validFrom) ||
      !isStrictWorkDate(rule.validTo) ||
      rule.validFrom > rule.validTo
    ) {
      reasons.push(`Regel ${rule.id} har en ugyldig gyldighedsperiode.`);
    }
    if (!Number.isSafeInteger(rule.schemaVersion) || rule.schemaVersion < 1) {
      reasons.push(`Regel ${rule.id} har en ugyldig skemaversion.`);
    }
    if (!Number.isSafeInteger(rule.rate.value)) {
      reasons.push(`Regel ${rule.id} bruger ikke en heltalsbaseret sats.`);
    }
    if (
      !rule.source.sourceId ||
      !rule.source.title ||
      !rule.source.officialUrl ||
      !rule.source.paragraph ||
      !rule.source.page ||
      !/^[a-f0-9]{64}$/i.test(rule.source.sha256)
    ) {
      reasons.push(`Regel ${rule.id} mangler en fuld officiel kildehenvisning.`);
    }
  }
  return reasons;
}

function validateOverrides(overrides: LocalOverride[], rules: AgreementRule[]): string[] {
  const reasons: string[] = [];
  const ruleIds = new Set(
    rules.flatMap((rule) => [rule.id, rule.sourceRuleId].filter(Boolean) as string[]),
  );
  for (const override of overrides) {
    if (!ruleIds.has(override.baseRuleId)) {
      reasons.push(`Override ${override.id} henviser til en ukendt grundregel.`);
    }
    if (
      !isStrictWorkDate(override.validFrom) ||
      !isStrictWorkDate(override.validTo) ||
      override.validFrom > override.validTo
    ) {
      reasons.push(`Override ${override.id} har en ugyldig gyldighedsperiode.`);
    }
    if (override.status === "approved" && !override.approvedBy.trim()) {
      reasons.push(`Override ${override.id} mangler godkender.`);
    }
    if (
      !override.documentation.sourceId ||
      !override.documentation.title ||
      !override.documentation.officialUrl ||
      !override.documentation.paragraph ||
      !override.documentation.page ||
      !/^[a-f0-9]{64}$/i.test(override.documentation.sha256)
    ) {
      reasons.push(`Override ${override.id} mangler fuld dokumentation og hash.`);
    }
    if (
      override.changeType !== "disable" &&
      (!override.rate || !Number.isSafeInteger(override.rate.value))
    ) {
      reasons.push(`Override ${override.id} mangler en heltalsbaseret sats.`);
    }
  }

  const approved = overrides.filter((override) => override.status === "approved");
  for (let leftIndex = 0; leftIndex < approved.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < approved.length; rightIndex += 1) {
      const left = approved[leftIndex];
      const right = approved[rightIndex];
      if (
        left.baseRuleId === right.baseRuleId &&
        left.scopeKey === right.scopeKey &&
        rangesOverlap(left.validFrom, left.validTo, right.validFrom, right.validTo)
      ) {
        reasons.push(`Overrides ${left.id} og ${right.id} overlapper tvetydigt.`);
      }
    }
  }
  return reasons;
}

function ruleIsExecutable(rule: AgreementRule, agreementVersion: AgreementVersion | null): boolean {
  return (
    rule.verificationStatus === "verified_and_active" &&
    Boolean(agreementVersion) &&
    rule.agreementVersionId === agreementVersion?.id &&
    isStrictWorkDate(rule.validFrom) &&
    isStrictWorkDate(rule.validTo) &&
    rule.validFrom <= rule.validTo &&
    Number.isSafeInteger(rule.schemaVersion) &&
    rule.schemaVersion >= 1 &&
    Number.isSafeInteger(rule.rate.value) &&
    Boolean(
      rule.source.sourceId &&
      rule.source.title &&
      rule.source.officialUrl &&
      rule.source.paragraph &&
      rule.source.page &&
      /^[a-f0-9]{64}$/i.test(rule.source.sha256),
    )
  );
}

function overrideIsExecutable(override: LocalOverride, rules: AgreementRule[]): boolean {
  const ruleIds = new Set(
    rules.flatMap((rule) => [rule.id, rule.sourceRuleId].filter(Boolean) as string[]),
  );
  return (
    override.status === "approved" &&
    ruleIds.has(override.baseRuleId) &&
    isStrictWorkDate(override.validFrom) &&
    isStrictWorkDate(override.validTo) &&
    override.validFrom <= override.validTo &&
    Boolean(override.approvedBy.trim()) &&
    Boolean(
      override.documentation.sourceId &&
      override.documentation.title &&
      override.documentation.officialUrl &&
      override.documentation.paragraph &&
      override.documentation.page &&
      /^[a-f0-9]{64}$/i.test(override.documentation.sha256),
    ) &&
    (override.changeType === "disable" ||
      Boolean(override.rate && Number.isSafeInteger(override.rate.value)))
  );
}

function buildMinuteRecords(shifts: CalculationShift[], reasons: string[]): MinuteRecord[] {
  const parsedShifts = shifts
    .map((shift) => ({
      shift,
      startMs: parseMinuteTimestamp(shift.start),
      endMs: parseMinuteTimestamp(shift.end),
    }))
    .sort((left, right) => left.startMs - right.startMs);

  for (let index = 0; index < parsedShifts.length; index += 1) {
    const current = parsedShifts[index];
    if (!Number.isFinite(current.startMs) || !Number.isFinite(current.endMs)) {
      reasons.push(
        validationReason(
          INVALID_WORK_DATE,
          `Vagt ${current.shift.id} har et ugyldigt tidspunkt eller en ugyldig kalenderdato.`,
        ),
      );
      continue;
    }
    if (current.endMs <= current.startMs) {
      reasons.push(`Vagt ${current.shift.id} slutter ikke efter start.`);
    }
    const previous = parsedShifts[index - 1];
    if (previous && current.startMs < previous.endMs) {
      reasons.push(`Vagterne ${previous.shift.id} og ${current.shift.id} overlapper.`);
    }
  }

  const rawMinutes: Omit<MinuteRecord, "dailyOrdinal" | "weeklyOrdinal">[] = [];
  for (const parsed of parsedShifts) {
    if (
      !Number.isFinite(parsed.startMs) ||
      !Number.isFinite(parsed.endMs) ||
      parsed.endMs <= parsed.startMs
    ) {
      continue;
    }
    const breakRanges = normalizeBreaks(parsed.shift, parsed.startMs, parsed.endMs, reasons);
    for (let epochMs = parsed.startMs; epochMs < parsed.endMs; epochMs += 60_000) {
      if (breakRanges.some((range) => epochMs >= range.startMs && epochMs < range.endMs)) {
        continue;
      }
      const local = localParts(epochMs);
      const holidayName = getDanishAgreementHolidayName(local.date);
      rawMinutes.push({
        epochMs,
        localDate: local.date,
        localMinute: local.minute,
        weekday: local.weekday,
        publicHoliday: Boolean(holidayName && holidayName !== "Søndag"),
        shiftId: parsed.shift.id,
        workType: parsed.shift.workType ?? "ordinary",
      });
    }
  }

  const dailyCounts = new Map<string, number>();
  const weeklyCounts = new Map<string, number>();
  return rawMinutes.map((minute) => {
    const dailyOrdinal = (dailyCounts.get(minute.localDate) ?? 0) + 1;
    dailyCounts.set(minute.localDate, dailyOrdinal);
    const weekKey = weekStart(minute.localDate);
    const weeklyOrdinal = (weeklyCounts.get(weekKey) ?? 0) + 1;
    weeklyCounts.set(weekKey, weeklyOrdinal);
    return { ...minute, dailyOrdinal, weeklyOrdinal };
  });
}

function normalizeBreaks(
  shift: CalculationShift,
  shiftStartMs: number,
  shiftEndMs: number,
  reasons: string[],
): Array<{ startMs: number; endMs: number }> {
  const ranges = (shift.breaks ?? [])
    .map((entry) => ({
      startMs: parseMinuteTimestamp(entry.start),
      endMs: parseMinuteTimestamp(entry.end),
    }))
    .sort((left, right) => left.startMs - right.startMs);
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (
      !Number.isFinite(range.startMs) ||
      !Number.isFinite(range.endMs) ||
      range.endMs <= range.startMs ||
      range.startMs < shiftStartMs ||
      range.endMs > shiftEndMs
    ) {
      reasons.push(`Vagt ${shift.id} har en ugyldig pause.`);
      continue;
    }
    const previous = ranges[index - 1];
    if (previous && range.startMs < previous.endMs) {
      reasons.push(`Vagt ${shift.id} har overlappende pauser.`);
    }
  }
  return ranges.filter(
    (range) =>
      Number.isFinite(range.startMs) &&
      Number.isFinite(range.endMs) &&
      range.endMs > range.startMs &&
      range.startMs >= shiftStartMs &&
      range.endMs <= shiftEndMs,
  );
}

function buildCalculationLines(
  input: AgreementCalculationInput,
  minutes: MinuteRecord[],
  rules: AgreementRule[],
  reasons: string[],
): CalculationLine[] {
  const agreementVersion = input.agreementVersion;
  if (!agreementVersion) return [];

  const baseRate: RuleRate = {
    kind: "ore_per_hour",
    value: input.employment.baseRateOrePerHour,
  };
  const baseSource: AgreementSourceReference = {
    sourceId: input.employment.employmentId,
    title: input.employment.sourceLabel,
    officialUrl: "employment://server-validated",
    paragraph: input.employment.sourceReference,
    page: "ansættelsesvilkår",
    sha256: "0".repeat(64),
  };
  const lines: CalculationLine[] = [
    {
      lineId: "base-pay",
      ruleId: "employment-base-pay",
      ruleSchemaVersion: 1,
      agreementId: agreementVersion.agreementId,
      agreementVersionId: agreementVersion.id,
      agreementTitle: agreementVersion.title,
      type: "base_pay",
      workDates: [...new Set(minutes.map((minute) => minute.localDate))].sort(),
      minutes: minutes.length,
      units: minutes.length,
      rate: baseRate,
      formula: `${minutes.length} min × ${baseRate.value} øre/time ÷ 60`,
      amountOre: roundFraction(minutes.length * baseRate.value, 60),
      source: baseSource,
      explanation: "Grundløn fra det servervaliderede ansættelsesforhold.",
    },
  ];

  const minuteRules = new Map<string, { effective: EffectiveRule; minutes: MinuteRecord[] }>();
  for (const minute of minutes) {
    const applicable = effectiveRulesForMinute(rules, input.overrides, minute, reasons);
    const selected = applyExclusivity(applicable);
    for (const effective of selected) {
      const current = minuteRules.get(effective.aggregateKey) ?? { effective, minutes: [] };
      current.minutes.push(minute);
      minuteRules.set(effective.aggregateKey, current);
    }
  }

  for (const { effective, minutes: matchedMinutes } of [...minuteRules.values()].sort((a, b) =>
    a.effective.aggregateKey.localeCompare(b.effective.aggregateKey),
  )) {
    const { rule, rate, localOverrideId } = effective;
    if (rule.type === "minimum_base_rate") {
      if (rate.kind === "ore_per_hour" && input.employment.baseRateOrePerHour < rate.value) {
        reasons.push(`Grundlønnen er under den dokumenterede mindstebetaling i regel ${rule.id}.`);
      }
      lines.push(
        calculationLine(
          agreementVersion,
          rule,
          rate,
          matchedMinutes,
          0,
          localOverrideId,
          "Valideringslinje; mindstebetalingen erstatter ikke den aftalte grundløn automatisk.",
        ),
      );
      continue;
    }

    const matchedBaseOre = roundFraction(
      matchedMinutes.length * input.employment.baseRateOrePerHour,
      60,
    );
    let amountOre = 0;
    let formula = "";
    if (rate.kind === "ore_per_hour") {
      amountOre = roundFraction(matchedMinutes.length * rate.value, 60);
      formula = `${matchedMinutes.length} min × ${rate.value} øre/time ÷ 60`;
    } else if (rate.kind === "basis_points_of_base") {
      amountOre = roundFraction(matchedBaseOre * rate.value, 10_000);
      formula = `${matchedBaseOre} øre × ${rate.value} basispoint ÷ 10000`;
    } else {
      const occurrences = new Set(matchedMinutes.map((minute) => minute.shiftId)).size;
      amountOre = occurrences * rate.value;
      formula = `${occurrences} forekomst(er) × ${rate.value} øre`;
    }
    lines.push(
      calculationLine(
        agreementVersion,
        rule,
        rate,
        matchedMinutes,
        amountOre,
        localOverrideId,
        rule.explanation,
        formula,
      ),
    );
  }
  return lines;
}

function calculationLine(
  agreementVersion: AgreementVersion,
  rule: AgreementRule,
  rate: RuleRate,
  minutes: MinuteRecord[],
  amountOre: number,
  localOverrideId: string | undefined,
  explanation: string,
  formula = "Validering uden automatisk beløb",
): CalculationLine {
  return {
    lineId: localOverrideId ? `${rule.id}:${localOverrideId}` : rule.id,
    ruleId: rule.sourceRuleId ?? rule.id,
    ...(rule.ratePeriodId ? { ratePeriodId: rule.ratePeriodId } : {}),
    ruleSchemaVersion: rule.schemaVersion,
    agreementId: agreementVersion.agreementId,
    agreementVersionId: agreementVersion.id,
    agreementTitle: agreementVersion.title,
    type: rule.type,
    workDates: [...new Set(minutes.map((minute) => minute.localDate))].sort(),
    minutes: minutes.length,
    units:
      rate.kind === "ore_per_occurrence"
        ? new Set(minutes.map((m) => m.shiftId)).size
        : minutes.length,
    rate,
    formula,
    amountOre,
    source: rule.source,
    ...(localOverrideId ? { localOverrideId } : {}),
    explanation,
  };
}

function effectiveRulesForMinute(
  rules: AgreementRule[],
  overrides: LocalOverride[],
  minute: MinuteRecord,
  reasons: string[],
): EffectiveRule[] {
  const effective: EffectiveRule[] = [];
  for (const rule of rules) {
    if (!ruleMatchesMinute(rule, minute)) continue;
    const matchingOverrides = overrides.filter(
      (override) =>
        override.status === "approved" &&
        override.baseRuleId === (rule.sourceRuleId ?? rule.id) &&
        minute.localDate >= override.validFrom &&
        minute.localDate <= override.validTo,
    );
    if (matchingOverrides.length > 1) {
      reasons.push(`Regel ${rule.id} har flere samtidige godkendte overrides.`);
      continue;
    }
    const override = matchingOverrides[0];
    if (!override) {
      effective.push({ rule, rate: rule.rate, aggregateKey: rule.id });
      continue;
    }
    if (override.changeType === "disable") continue;
    if (!override.rate) {
      reasons.push(`Override ${override.id} mangler sats.`);
      continue;
    }
    if (override.changeType === "replace") {
      effective.push({
        rule,
        rate: override.rate,
        localOverrideId: override.id,
        aggregateKey: `${rule.id}:replace:${override.id}`,
      });
      continue;
    }
    effective.push({ rule, rate: rule.rate, aggregateKey: rule.id });
    effective.push({
      rule,
      rate: override.rate,
      localOverrideId: override.id,
      aggregateKey: `${rule.id}:add:${override.id}`,
    });
  }
  return effective;
}

function applyExclusivity(rules: EffectiveRule[]): EffectiveRule[] {
  const selected: EffectiveRule[] = [];
  const exclusiveGroups = new Map<string, EffectiveRule>();
  for (const effective of rules) {
    const group = effective.rule.combinationGroup;
    if (!effective.rule.exclusive || !group) {
      selected.push(effective);
      continue;
    }
    const current = exclusiveGroups.get(group);
    if (
      !current ||
      effective.rule.priority > current.rule.priority ||
      (effective.rule.priority === current.rule.priority &&
        effective.aggregateKey.localeCompare(current.aggregateKey) < 0)
    ) {
      exclusiveGroups.set(group, effective);
    }
  }
  return [...selected, ...exclusiveGroups.values()];
}

function ruleMatchesMinute(rule: AgreementRule, minute: MinuteRecord): boolean {
  if (minute.localDate < rule.validFrom || minute.localDate > rule.validTo) return false;
  const conditions = rule.conditions;
  if (conditions.weekdays && !conditions.weekdays.includes(minute.weekday)) return false;
  if (conditions.publicHoliday !== undefined && conditions.publicHoliday !== minute.publicHoliday) {
    return false;
  }
  if (conditions.workTypes && !conditions.workTypes.includes(minute.workType)) return false;
  if (
    conditions.afterDailyMinutes !== undefined &&
    minute.dailyOrdinal <= conditions.afterDailyMinutes
  ) {
    return false;
  }
  if (
    conditions.afterWeeklyMinutes !== undefined &&
    minute.weeklyOrdinal <= conditions.afterWeeklyMinutes
  ) {
    return false;
  }
  if (
    conditions.localStartMinute !== undefined &&
    conditions.localEndMinute !== undefined &&
    !minuteInRange(minute.localMinute, conditions.localStartMinute, conditions.localEndMinute)
  ) {
    return false;
  }
  return true;
}

function minuteInRange(value: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return value >= start && value < end;
  return value >= start || value < end;
}

function parseMinuteTimestamp(value: string): number {
  if (!isTimestamp(value)) return Number.NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed % 60_000 !== 0) return Number.NaN;
  return parsed;
}

function isTimestamp(value: string): boolean {
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::00(?:\.000)?)?(Z|[+-]\d{2}:\d{2})$/u,
  );
  if (!match || !isStrictWorkDate(match[1])) return false;

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) return false;

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const offsetMinutes = parseOffsetMinutes(match[4]);
  if (offsetMinutes === null) return false;
  const normalizedLocal = new Date(parsed + offsetMinutes * 60_000).toISOString().slice(0, 16);
  return normalizedLocal === `${match[1]}T${match[2]}:${match[3]}`;
}

export function isStrictWorkDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseOffsetMinutes(value: string): number | null {
  if (value === "Z") return 0;
  const match = value.match(/^([+-])(\d{2}):(\d{2})$/u);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  const offset = hours * 60 + minutes;
  return match[1] === "-" ? -offset : offset;
}

function validationReason(code: string, message: string): string {
  return `${code}: ${message}`;
}

function hasHardInputBlock(reasons: string[]): boolean {
  return reasons.some(
    (reason) =>
      reason.startsWith(`${INVALID_WORK_DATE}:`) || reason.startsWith(`${DUPLICATE_SHIFT_ID}:`),
  );
}

function localParts(epochMs: number): { date: string; minute: number; weekday: number } {
  const parts = localPartsFormatter.formatToParts(new Date(epochMs));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: hour * 60 + minute,
    weekday: WEEKDAY_NUMBER[part("weekday")] ?? 0,
  };
}

function weekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const weekday = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - (weekday - 1));
  return parsed.toISOString().slice(0, 10);
}

function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function roundFraction(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error("Pengeberegning kræver sikre heltal.");
  }
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
    .join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
