import { getCollectiveAgreementById } from "./collectiveAgreements";

export type AgreementValidationWorkflowStatus =
  | "source_uploaded"
  | "rules_extracted"
  | "needs_manual_review"
  | "validated_for_calculation";

export type AgreementCalculationType = "fixed_rate" | "percentage" | "time_condition" | "manual";
export type AgreementRuleConfidence = "low" | "medium" | "high";
export type AgreementRuleReviewStatus = "needs_review" | "approved" | "rejected" | "not_applicable";
export type AgreementValidationTestStatus = "pending" | "passed" | "failed";

export type AgreementRuleCategory =
  | "normal_daily_working_time"
  | "normal_weekly_working_time"
  | "overtime"
  | "saturday_allowance"
  | "sunday_allowance"
  | "public_holiday"
  | "evening_allowance"
  | "night_allowance"
  | "staggered_time"
  | "shift_work"
  | "special_allowances"
  | "local_agreements"
  | "breaks"
  | "outside_normal_time";

export type AgreementValidationRule = {
  ruleKey: AgreementRuleCategory;
  label: string;
  required: boolean;
  calculationType: AgreementCalculationType;
  rate: number | null;
  unit: string | null;
  conditions: string;
  pdfPages: number[];
  sourceText: string;
  possibleRates: string[];
  confidence: AgreementRuleConfidence;
  reviewStatus: AgreementRuleReviewStatus;
  notes: string;
};

export type AgreementValidationTestCase = {
  id: string;
  label: string;
  description: string;
  status: AgreementValidationTestStatus;
  expected: string;
  actual: string;
  notes: string;
};

export type AgreementValidationReport = {
  agreementSlug: string;
  agreementName: string;
  sourceAuditVersion: string;
  status: AgreementValidationWorkflowStatus;
  validatedForCalculation: boolean;
  sourcePdf: string;
  extractedAt: string;
  validatedAt: string;
  validatedBy: string;
  validationNote: string;
  rules: AgreementValidationRule[];
  testCases: AgreementValidationTestCase[];
};

export const AGREEMENT_VALIDATION_STATUS_LABEL: Record<AgreementValidationWorkflowStatus, string> =
  {
    source_uploaded: "PDF uploadet som kilde",
    rules_extracted: "Regler og satser udtrukket",
    needs_manual_review: "Kræver manuel gennemgang",
    validated_for_calculation: "Valideret til beregning",
  };

export const AGREEMENT_RULE_REVIEW_STATUS_LABEL: Record<AgreementRuleReviewStatus, string> = {
  needs_review: "Kræver review",
  approved: "Godkendt",
  rejected: "Afvist",
  not_applicable: "Ikke relevant",
};

const VALIDATION_KEY = "agreement-validation-reports-v1";

const INDUSTRIENS_RULES: AgreementValidationRule[] = [
  {
    ruleKey: "normal_daily_working_time",
    label: "Normal daglig arbejdstid",
    required: true,
    calculationType: "time_condition",
    rate: null,
    unit: "timer",
    conditions:
      "Normal arbejdstid skal ligge mellem kl. 06.00 og 18.00. Ved 5-dages uge kan ingen arbejdsdag være under 6 timer, medmindre andet aftales lokalt.",
    pdfPages: [28],
    sourceText:
      "Den normale arbejdstid skal lægges mellem kl. 06.00 og kl. 18.00. Når den ugentlige arbejdstid er fordelt på 5 dage, kan ingen arbejdsdag være under 6 timer, medmindre andet aftales lokalt.",
    possibleRates: [],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Kontroller lokalaftaler og eventuel anden arbejdstidsplacering før godkendelse.",
  },
  {
    ruleKey: "normal_weekly_working_time",
    label: "Normal ugentlig arbejdstid",
    required: true,
    calculationType: "time_condition",
    rate: 37,
    unit: "timer/uge",
    conditions: "Gennemsnitlig arbejdstid på 37 timer pr. uge ved almindeligt dagarbejde.",
    pdfPages: [28],
    sourceText:
      "Arbejdstiden fastlægges pr. uge, måned eller år på basis af en gennemsnitlig arbejdstid på 37 timer pr. uge ved almindeligt dagarbejde, på skifteholdenes daghold og ved forskudt arbejdstid.",
    possibleRates: ["37 timer pr. uge"],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Reduceret arbejdstid ved søgnehelligdage/fridage kræver manuel kontrol.",
  },
  {
    ruleKey: "overtime",
    label: "Overarbejde",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions:
      "Overarbejde afhænger af klokketimer, hverdagsfridag, før/efter normal arbejdstid samt søn-/helligdage.",
    pdfPages: [38, 39, 40, 41],
    sourceText:
      "Stk. 7 Betaling for overarbejde. Tillæg for overarbejde betales afhængigt af, hvornår overarbejdet finder sted. Betalingssatser fremgår for første/anden klokketime, tredje/fjerde klokketime, femte klokketime, hverdagsfridage og søn- og helligdage for 2025, 2026 og 2027.",
    possibleRates: [
      "Første/anden klokketime efter normal arbejdstid: 1.5.2025 46,70 kr.; 1.3.2026 48,10 kr.; 1.3.2027 49,55 kr.",
      "Tredje/fjerde klokketime efter normal arbejdstid: 1.5.2025 74,55 kr.; 1.3.2026 76,80 kr.; 1.3.2027 79,10 kr.",
      "Femte klokketime og derefter indtil normal arbejdstids begyndelse: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
      "Overarbejde før normal arbejdstid kl. 06-18: 1.5.2025 46,70 kr.; 1.3.2026 48,10 kr.; 1.3.2027 49,55 kr.",
      "Overarbejde før normal arbejdstid kl. 18-06: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
      "Hel hverdagsfridag kl. 06-18: 1.5.2025 74,55 kr.; 1.3.2026 76,80 kr.; 1.3.2027 79,10 kr.",
      "Hel hverdagsfridag kl. 18-06: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
    ],
    confidence: "medium",
    reviewStatus: "needs_review",
    notes:
      "Flere satstrin og tidsbetingelser. Må ikke bruges til kroneberegning før en struktureret satsmodel er godkendt.",
  },
  {
    ruleKey: "saturday_allowance",
    label: "Lørdagstillæg",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions:
      "Lørdag kan være en i forvejen tilsikret hverdagsfridag og/eller del af skifteholdsbetaling afhængigt af arbejdsplan.",
    pdfPages: [38, 40, 53],
    sourceText:
      "En i forvejen tilsikret hverdagsfridag omfatter bl.a. lørdag hvis man arbejder mandag-fredag. For skifteholdsarbejde: Fra lørdag kl. 14.00 til søndagsdøgnets afslutning: Tillæg 2.",
    possibleRates: [
      "Hel hverdagsfridag kl. 06-18: 1.5.2025 74,55 kr.; 1.3.2026 76,80 kr.; 1.3.2027 79,10 kr.",
      "Hel hverdagsfridag kl. 18-06: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
      "Skiftehold fra lørdag kl. 14 til søndagsdøgnets afslutning, Tillæg 2: 1.5.2025 104,35 kr.; 1.3.2026 108,00 kr.; 1.3.2027 111,75 kr.",
    ],
    confidence: "medium",
    reviewStatus: "needs_review",
    notes: "Lørdag afhænger af om arbejdet er almindeligt overarbejde, fridag eller skiftehold.",
  },
  {
    ruleKey: "sunday_allowance",
    label: "Søndagstillæg",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions: "Søndag og helligdage har egne satser afhængigt af tidspunkt.",
    pdfPages: [39, 41],
    sourceText:
      "Følgende dage er søn- og helligdage. Arbejde på søn- og helligdage betales med tillæg fra normal daglig arbejdstids begyndelse indtil kl. 12 og fra kl. 12 til normal arbejdstids begyndelse.",
    possibleRates: [
      "Søn-/helligdag fra normal daglig arbejdstids begyndelse til kl. 12: 1.5.2025 92,95 kr.; 1.3.2026 95,75 kr.; 1.3.2027 98,60 kr.",
      "Søn-/helligdag fra kl. 12 til normal arbejdstids begyndelse: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
      "Søndag morgen før normal arbejdstids begyndelse: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Kontroller om den konkrete dag er søndag eller helligdag.",
  },
  {
    ruleKey: "public_holiday",
    label: "Helligdage / søgnehelligdage",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions: "Helligdagslisten og betaling følger § 13, stk. 7.",
    pdfPages: [39, 41],
    sourceText:
      "Alle almindelige søndage samt 1. juledag, 2. juledag, nytårsdag, skærtorsdag, langfredag, påskedage, Kr. Himmelfartsdag og pinsedage nævnes som søn- og helligdage.",
    possibleRates: [
      "Søn-/helligdag fra normal daglig arbejdstids begyndelse til kl. 12: 1.5.2025 92,95 kr.; 1.3.2026 95,75 kr.; 1.3.2027 98,60 kr.",
      "Søn-/helligdag fra kl. 12 til normal arbejdstids begyndelse: 1.5.2025 139,50 kr.; 1.3.2026 143,70 kr.; 1.3.2027 148,00 kr.",
      "Skiftehold på søgnehelligdage, Tillæg 2: 1.5.2025 104,35 kr.; 1.3.2026 108,00 kr.; 1.3.2027 111,75 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes:
      "Systemet kan nu markere danske søn-/helligdage som timer, men sats og klassificering kræver stadig manuel review.",
  },
  {
    ruleKey: "evening_allowance",
    label: "Aftentillæg",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions: "Forskudt arbejdstid på hverdage fra kl. 18.00 til kl. 22.00: Tillæg 1.",
    pdfPages: [45, 46],
    sourceText:
      "Stk. 6 Tillægsbetaling for forskudt arbejdstid. Hverdage fra kl. 18.00 til kl. 22.00: Tillæg 1.",
    possibleRates: [
      "Forskudt tid Tillæg 1 pr. time: 1.5.2025 31,50 kr.; 1.3.2026 32,60 kr.; 1.3.2027 33,75 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Kræver kontrol af om arbejdet er etableret som forskudt arbejdstid.",
  },
  {
    ruleKey: "night_allowance",
    label: "Nattillæg",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions:
      "Forskudt arbejdstid fra kl. 22.00 til kl. 06.00: Tillæg 2. Ved start kl. 24.00 eller derefter: Tillæg 3 indtil kl. 06.00.",
    pdfPages: [46],
    sourceText:
      "Hverdage fra kl. 22.00 til kl. 06.00: Tillæg 2. Påbegyndes den forskudte arbejdstid kl. 24.00 eller derefter, betales indtil kl. 06.00: Tillæg 3.",
    possibleRates: [
      "Forskudt tid Tillæg 2 pr. time: 1.5.2025 51,40 kr.; 1.3.2026 53,20 kr.; 1.3.2027 55,05 kr.",
      "Forskudt tid Tillæg 3 pr. time: 1.5.2025 60,60 kr.; 1.3.2026 62,70 kr.; 1.3.2027 64,90 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Kræver kontrol af om arbejde er forskudt tid, overarbejde eller skiftehold.",
  },
  {
    ruleKey: "staggered_time",
    label: "Forskudt tid",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time",
    conditions: "Forskudt arbejdstid kan placeres helt eller delvist i tidsrummet 18.00-06.00.",
    pdfPages: [45, 46],
    sourceText:
      "Ved forskudt arbejdstid er den fastlagte normale arbejdstid helt eller delvist inden for tidsrummet kl. 18.00-kl. 06.00. Arbejde på forskudt tid betales med Tillæg 1, 2 eller 3.",
    possibleRates: [
      "Tillæg 1 pr. time: 1.5.2025 31,50 kr.; 1.3.2026 32,60 kr.; 1.3.2027 33,75 kr.",
      "Tillæg 2 pr. time: 1.5.2025 51,40 kr.; 1.3.2026 53,20 kr.; 1.3.2027 55,05 kr.",
      "Tillæg 3 pr. time: 1.5.2025 60,60 kr.; 1.3.2026 62,70 kr.; 1.3.2027 64,90 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Forskudt tid må ikke forveksles med skiftehold.",
  },
  {
    ruleKey: "shift_work",
    label: "Skiftehold / holddrift",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/time eller kr/gang",
    conditions: "Skifteholdsarbejde har Tillæg 1-5 afhængigt af tidsrum, weekend og fridage.",
    pdfPages: [52, 53],
    sourceText:
      "Stk. 6 Tillægsbetaling for skifteholdsarbejde. Tillæg 1-5 fremgår. Hverdage 18.00-06.00: Tillæg 1. Fra lørdag kl. 14.00 til søndagsdøgnets afslutning: Tillæg 2.",
    possibleRates: [
      "Tillæg 1 pr. time: 1.5.2025 48,70 kr.; 1.3.2026 50,40 kr.; 1.3.2027 52,15 kr.",
      "Tillæg 2 pr. time: 1.5.2025 104,35 kr.; 1.3.2026 108,00 kr.; 1.3.2027 111,75 kr.",
      "Tillæg 3 pr. time: 1.5.2025 104,70 kr.; 1.3.2026 108,35 kr.; 1.3.2027 112,15 kr.",
      "Tillæg 4 pr. time: 1.5.2025 32,80 kr.; 1.3.2026 33,95 kr.; 1.3.2027 35,15 kr.",
      "Tillæg 5 pr. gang: 1.5.2025 261,20 kr.; 1.3.2026 270,30 kr.; 1.3.2027 279,80 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Skiftehold kræver særskilt markering i timesedlen og evt. lokal plan.",
  },
  {
    ruleKey: "special_allowances",
    label: "Særlige tillæg",
    required: false,
    calculationType: "manual",
    rate: null,
    unit: null,
    conditions:
      "Udearbejde, befordringstid og vejpenge kan være relevante afhængigt af arbejdssted.",
    pdfPages: [62],
    sourceText:
      "Befordringstiden fra bopæl til udearbejdsstedet og retur betales, hvis den er længere end normal befordringstid. Betales med 75 pct. af normal betaling ved timelønsarbejde for merbefordringstid.",
    possibleRates: ["75 pct. af normal betaling for merbefordringstid"],
    confidence: "medium",
    reviewStatus: "needs_review",
    notes: "Kræver konkrete oplysninger om udearbejdssted og transport.",
  },
  {
    ruleKey: "local_agreements",
    label: "Lokalaftaler",
    required: false,
    calculationType: "manual",
    rate: null,
    unit: null,
    conditions: "Flere bestemmelser kan fraviges eller konkretiseres ved skriftlig lokalaftale.",
    pdfPages: [28, 53],
    sourceText:
      "Overenskomstparterne anbefaler skriftlig lokalaftale om håndtering af manglende/overskydende timer. Ved skiftehold kan betalinger påbegyndes og afsluttes indtil 8 timer tidligere efter lokal aftale.",
    possibleRates: [],
    confidence: "medium",
    reviewStatus: "needs_review",
    notes: "Lokalaftaler skal uploades/kontrolleres særskilt og kan ændre beregningen.",
  },
  {
    ruleKey: "breaks",
    label: "Pauser",
    required: true,
    calculationType: "fixed_rate",
    rate: null,
    unit: "kr/gang",
    conditions:
      "Hvis en medarbejder tilsiges til arbejde i spisepausen og den udskydes over 1/2 time.",
    pdfPages: [41],
    sourceText:
      "Tilsiges en medarbejder til arbejde i spisepausen, og denne derved udskydes ud over 1/2 time, betales der pr. gang herfor.",
    possibleRates: [
      "Arbejde i spisepause pr. gang: 1.5.2025 33,05 kr.; 1.3.2026 34,05 kr.; 1.3.2027 35,10 kr.",
    ],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Timesedlen registrerer pause i minutter, men ikke om spisepausen er tilsagt/udskudt.",
  },
  {
    ruleKey: "outside_normal_time",
    label: "Arbejde uden for normal tid",
    required: true,
    calculationType: "time_condition",
    rate: null,
    unit: null,
    conditions: "Arbejde uden for normal tid kan være overarbejde, forskudt tid eller skiftehold.",
    pdfPages: [28, 38, 46, 52],
    sourceText:
      "Normal arbejdstid ligger mellem 06.00 og 18.00. Overarbejde, forskudt arbejdstid og skifteholdsarbejde har særskilte regler og betalingsbestemmelser.",
    possibleRates: [],
    confidence: "high",
    reviewStatus: "needs_review",
    notes: "Systemet skal afgøre kategori ud fra planlagt arbejdstype, ikke kun klokkeslæt.",
  },
];

const INDUSTRIENS_TEST_CASES: AgreementValidationTestCase[] = [
  {
    id: "weekday-no-allowance",
    label: "Almindelig hverdag uden tillæg",
    description: "Mandag 08:00-16:00 med 30 minutters pause.",
    status: "passed",
    expected: "7,5 timer, ingen weekendtillæg, ingen nat.",
    actual:
      "Test-runner forventer total 7,5 og canCalculateRatesAutomatically=false indtil validering.",
    notes: "Tester guardrail og almindelig timetælling.",
  },
  {
    id: "after-18-evening",
    label: "Arbejde efter kl. 18",
    description: "Mandag 16:00-21:00 uden pause.",
    status: "passed",
    expected: "5 timer total, 3 mulige aftentimer.",
    actual: "Test-runner forventer evening=3.",
    notes: "Foreløbig timer, ikke kronebeløb.",
  },
  {
    id: "night-work",
    label: "Arbejde om natten",
    description: "Mandag 21:00-02:00 uden pause.",
    status: "passed",
    expected: "5 timer total, 4 mulige nattetimer.",
    actual: "Test-runner forventer night=4.",
    notes: "Foreløbig timer, ikke kronebeløb.",
  },
  {
    id: "saturday-work",
    label: "Arbejde lørdag",
    description: "Lørdag 08:00-14:00 uden pause.",
    status: "passed",
    expected: "6 lørdagstimer.",
    actual: "Test-runner forventer saturday=6.",
    notes: "Kræver manuel vurdering af fridag/weekend/skiftehold for sats.",
  },
  {
    id: "sunday-work",
    label: "Arbejde søndag",
    description: "Søndag 08:00-14:00 uden pause.",
    status: "passed",
    expected: "6 søndagstimer.",
    actual: "Test-runner forventer sunday=6.",
    notes: "Kræver manuel vurdering af søn-/helligdagsregel for sats.",
  },
  {
    id: "weekly-overtime",
    label: "Overarbejde efter normal uge",
    description: "Fem hverdage a 8 timer uden pause.",
    status: "passed",
    expected: "40 timer total og 3 mulige overarbejdstimer over 37 timer.",
    actual: "Test-runner forventer overtime=3.",
    notes: "Overarbejde kan også afhænge af daglig arbejdstid/lokalaftale.",
  },
  {
    id: "multiple-workdays",
    label: "Uge med flere arbejdsdage",
    description: "Mandag-fredag 07:00-15:00 med 30 minutters pause.",
    status: "passed",
    expected: "37,5 timer total og 0,5 mulig overarbejdstime over 37.",
    actual: "Test-runner forventer total=37,5 og overtime=0,5.",
    notes: "Tester ugentlig opsummering.",
  },
  {
    id: "local-agreement-combination",
    label: "Kombination med lokalaftale",
    description: "Mandag 08:00-16:00 med lokalaftale markeret.",
    status: "passed",
    expected: "Lokalaftale markeres, men beregnes ikke som juridisk sats uden særskilt aftale.",
    actual: "Test-runner forventer localAgreement=7,5 og automatisk beregning blokeret.",
    notes: "Lokalaftaler kræver separat dokumentation.",
  },
  {
    id: "public-holiday-calendar",
    label: "Arbejde på helligdag",
    description: "Fredag 25. december 2026 kl. 08:00-14:00 uden pause.",
    status: "passed",
    expected: "6 helligdagstimer og automatisk satsberegning blokeret indtil manuel validering.",
    actual: "Test-runner forventer publicHoliday=6.",
    notes: "Kalenderen tester datoen. Sats og regelkategori kræver stadig manuel godkendelse.",
  },
];

export const defaultAgreementValidationReports: AgreementValidationReport[] = [
  {
    agreementSlug: "industriens-overenskomst",
    agreementName: "Industriens Overenskomst",
    sourceAuditVersion: "co-industri-industriens-overenskomst-2025-2028-2025-07-31-audit-2",
    status: "needs_manual_review",
    validatedForCalculation: false,
    sourcePdf: "industriens-overenskomst.pdf",
    extractedAt: "2026-06-25",
    validatedAt: "",
    validatedBy: "",
    validationNote:
      "Regler og mulige satser er kontrolleret mod officiel CO-industri PDF: Industriens Overenskomst 2025-2028, fil dateret 2025_07_31. Satser for 2025, 2026 og 2027 er udtrukket, men kræver stadig manuel review. Automatisk kroneberegning må ikke aktiveres før alle obligatoriske regler, kildehenvisninger og testcases er godkendt.",
    rules: INDUSTRIENS_RULES,
    testCases: INDUSTRIENS_TEST_CASES,
  },
];

function storage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function readStoredReports() {
  try {
    const raw = storage()?.getItem(VALIDATION_KEY);
    return raw ? (JSON.parse(raw) as AgreementValidationReport[]) : [];
  } catch {
    return [];
  }
}

function mergeReport(defaultReport: AgreementValidationReport, stored?: AgreementValidationReport) {
  if (!stored) return defaultReport;
  if (stored.sourceAuditVersion !== defaultReport.sourceAuditVersion) {
    return {
      ...defaultReport,
      validationNote: `${defaultReport.validationNote} Tidligere lokal review er nulstillet, fordi kildegrundlaget er opdateret til audit-version ${defaultReport.sourceAuditVersion}.`,
    };
  }
  const storedRulesByKey = new Map(stored.rules.map((rule) => [rule.ruleKey, rule]));
  const defaultRuleKeys = new Set(defaultReport.rules.map((rule) => rule.ruleKey));
  const mergedRules = defaultReport.rules.map((rule) => ({
    ...rule,
    ...storedRulesByKey.get(rule.ruleKey),
  }));
  const extraStoredRules = stored.rules.filter((rule) => !defaultRuleKeys.has(rule.ruleKey));
  return {
    ...defaultReport,
    ...stored,
    rules: [...mergedRules, ...extraStoredRules],
    testCases: defaultReport.testCases,
  };
}

export function listAgreementValidationReports() {
  const stored = readStoredReports();
  const storedBySlug = new Map(stored.map((report) => [report.agreementSlug, report]));
  const defaultSlugs = new Set(
    defaultAgreementValidationReports.map((report) => report.agreementSlug),
  );
  const mergedDefaults = defaultAgreementValidationReports.map((report) =>
    mergeReport(report, storedBySlug.get(report.agreementSlug)),
  );
  const extraStoredReports = stored.filter((report) => !defaultSlugs.has(report.agreementSlug));
  return [...mergedDefaults, ...extraStoredReports];
}

export function getAgreementValidationReport(agreementSlug: string) {
  const report = listAgreementValidationReports().find(
    (item) => item.agreementSlug === agreementSlug,
  );
  const agreement = getCollectiveAgreementById(agreementSlug);
  if (report) return report;
  if (!agreement) return undefined;
  return {
    agreementSlug: agreement.id,
    agreementName: agreement.name,
    sourceAuditVersion: "",
    status: agreement.pdfUrl ? "source_uploaded" : "needs_manual_review",
    validatedForCalculation: false,
    sourcePdf: agreement.pdfFileName ?? agreement.pdfUrl ?? "",
    extractedAt: "",
    validatedAt: "",
    validatedBy: "",
    validationNote: "Der findes endnu ingen struktureret valideringsrapport.",
    rules: [],
    testCases: [],
  } satisfies AgreementValidationReport;
}

export function saveAgreementValidationReport(report: AgreementValidationReport) {
  const reports = listAgreementValidationReports();
  const index = reports.findIndex((item) => item.agreementSlug === report.agreementSlug);
  const updated = {
    ...report,
    status: report.validatedForCalculation ? "validated_for_calculation" : report.status,
  };
  if (index >= 0) reports[index] = updated;
  else reports.push(updated);
  storage()?.setItem(VALIDATION_KEY, JSON.stringify(reports));
  return updated;
}

export function getRulesNeedingManualReview(report: AgreementValidationReport) {
  return report.rules.filter((rule) => rule.reviewStatus === "needs_review");
}

export function getMissingValidationRules(report: AgreementValidationReport) {
  return report.rules.filter(
    (rule) => rule.required && !["approved", "not_applicable"].includes(rule.reviewStatus),
  );
}

export function getFailingValidationTests(report: AgreementValidationReport) {
  return report.testCases.filter((testCase) => testCase.status !== "passed");
}

export function getAgreementValidationErrors(
  report: AgreementValidationReport,
  validationDraft?: { validatedBy?: string; validationNote?: string; validatedAt?: string },
) {
  const errors: string[] = [];
  for (const rule of report.rules.filter((item) => item.required)) {
    if (!["approved", "not_applicable"].includes(rule.reviewStatus)) {
      errors.push(`${rule.label} er ikke godkendt eller markeret ikke relevant.`);
    }
    if (rule.reviewStatus === "approved" && rule.pdfPages.length === 0) {
      errors.push(`${rule.label} mangler PDF-sidehenvisning.`);
    }
    if (rule.reviewStatus === "approved" && !rule.sourceText.trim()) {
      errors.push(`${rule.label} mangler kildeuddrag.`);
    }
  }
  for (const testCase of getFailingValidationTests(report)) {
    errors.push(`Testcase "${testCase.label}" er ${testCase.status}.`);
  }
  if (validationDraft && !validationDraft.validatedBy?.trim()) {
    errors.push("Valideret af mangler.");
  }
  if (validationDraft && !validationDraft.validationNote?.trim()) {
    errors.push("Valideringsnote mangler.");
  }
  if (validationDraft && !validationDraft.validatedAt?.trim()) {
    errors.push("Valideringsdato mangler.");
  }
  return errors;
}

export function validateAgreementForCalculation(
  report: AgreementValidationReport,
  validationDraft: { validatedBy: string; validationNote: string; validatedAt: string },
) {
  const errors = getAgreementValidationErrors(report, validationDraft);
  if (errors.length > 0) {
    return { ok: false as const, errors, report };
  }
  const updated = saveAgreementValidationReport({
    ...report,
    status: "validated_for_calculation",
    validatedForCalculation: true,
    validatedAt: validationDraft.validatedAt,
    validatedBy: validationDraft.validatedBy,
    validationNote: validationDraft.validationNote,
  });
  return { ok: true as const, errors: [], report: updated };
}

export function resetAgreementValidation(report: AgreementValidationReport) {
  return saveAgreementValidationReport({
    ...report,
    status: "needs_manual_review",
    validatedForCalculation: false,
    validatedAt: "",
    validatedBy: "",
  });
}
