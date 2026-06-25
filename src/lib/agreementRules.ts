import { collectiveAgreements, publicAgreementPdfHref } from "./collectiveAgreements";

export const AGREEMENT_RULE_SOURCE_LABEL = {
  normalDayHours: "Normal daglig arbejdstid",
  normalWeekHours: "Normal ugentlig arbejdstid",
  overtimeRule: "Overarbejdsregel",
  saturdayRule: "Lørdagstillæg",
  sundayRule: "Søndagstillæg",
  eveningRule: "Aftentillæg",
  nightRule: "Nattillæg",
  shiftRule: "Skifteholdstillæg",
  specialRule: "Særlige tillæg / noter",
} as const;

export type AgreementRuleSourceKey = keyof typeof AGREEMENT_RULE_SOURCE_LABEL;

export type AgreementRuleSource = {
  field: AgreementRuleSourceKey;
  pdfUrl: string;
  pdfFileName?: string;
  page: number;
  excerpt?: string;
  note?: string;
};

export type AgreementRule = {
  id: string;
  agreementId: string;
  normalDayHours?: number;
  normalWeekHours?: number;
  overtimeRule: string;
  saturdayRule: string;
  sundayRule: string;
  eveningRule: string;
  nightRule: string;
  shiftRule: string;
  specialRule: string;
  eveningStart: string;
  nightStart: string;
  nightEnd: string;
  validFrom: string;
  validTo: string;
  sources: AgreementRuleSource[];
  updatedAt: string;
};

const EXTRACTED_RULE_SOURCE_PAGES: Record<
  string,
  Partial<Record<AgreementRuleSourceKey, number>>
> = {
  "industriens-overenskomst": {
    normalWeekHours: 28,
    overtimeRule: 35,
    saturdayRule: 31,
    sundayRule: 53,
    eveningRule: 45,
    nightRule: 173,
    shiftRule: 48,
    specialRule: 62,
  },
  "industri-trae-moebeloverenskomsten": {
    normalWeekHours: 34,
    overtimeRule: 45,
    saturdayRule: 32,
    sundayRule: 39,
    eveningRule: 118,
    nightRule: 178,
    shiftRule: 36,
    specialRule: 129,
  },
  "trae-moebeloverenskomsten": {
    normalWeekHours: 23,
    overtimeRule: 34,
    saturdayRule: 17,
    sundayRule: 27,
    eveningRule: 14,
    nightRule: 216,
    shiftRule: 26,
    specialRule: 237,
  },
  "industrioverenskomsten-byggeri": {
    normalWeekHours: 106,
    overtimeRule: 117,
    saturdayRule: 33,
    sundayRule: 67,
    eveningRule: 27,
    nightRule: 201,
    shiftRule: 29,
    specialRule: 155,
  },
  bygningsoverenskomsten: {
    normalWeekHours: 29,
    overtimeRule: 33,
    saturdayRule: 34,
    sundayRule: 87,
    eveningRule: 26,
    nightRule: 160,
    shiftRule: 20,
    specialRule: 133,
  },
  "bygge-anlaegsoverenskomsten": {
    normalWeekHours: 24,
    overtimeRule: 30,
    saturdayRule: 26,
    sundayRule: 36,
    eveningRule: 32,
    nightRule: 171,
    shiftRule: 34,
    specialRule: 143,
  },
  "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f": {
    normalWeekHours: 26,
    overtimeRule: 36,
    saturdayRule: 74,
    sundayRule: 106,
    eveningRule: 28,
    nightRule: 216,
    shiftRule: 23,
    specialRule: 163,
  },
  "jord-betonoverenskomsten": {
    normalWeekHours: 22,
    overtimeRule: 28,
    saturdayRule: 24,
    sundayRule: 35,
    eveningRule: 30,
    nightRule: 146,
    shiftRule: 32,
    specialRule: 135,
  },
  "murer-murerarbejdsmandsarbejde": {
    normalWeekHours: 111,
    overtimeRule: 30,
    saturdayRule: 112,
    sundayRule: 30,
    nightRule: 158,
    specialRule: 130,
  },
  isoleringsoverenskomsten: {
    normalWeekHours: 11,
    overtimeRule: 113,
    saturdayRule: 78,
    sundayRule: 24,
    eveningRule: 13,
    nightRule: 106,
    shiftRule: 46,
    specialRule: 77,
  },
  maleroverenskomsten: {
    normalWeekHours: 13,
    overtimeRule: 13,
    saturdayRule: 30,
    sundayRule: 30,
    nightRule: 114,
    shiftRule: 14,
    specialRule: 9,
  },
  elektrikeroverenskomsten: {
    normalWeekHours: 23,
    overtimeRule: 54,
    saturdayRule: 24,
    sundayRule: 182,
    eveningRule: 21,
    nightRule: 139,
    shiftRule: 26,
    specialRule: 70,
  },
  "el-overenskomsten-di-def": {
    normalWeekHours: 24,
    overtimeRule: 23,
    saturdayRule: 18,
    sundayRule: 30,
    eveningRule: 27,
    nightRule: 120,
    shiftRule: 28,
  },
  "vvs-overenskomsten": {
    normalWeekHours: 19,
    overtimeRule: 22,
    saturdayRule: 67,
    sundayRule: 41,
    eveningRule: 25,
    nightRule: 99,
    specialRule: 70,
  },
  "industri-vvs-overenskomsten": {
    normalWeekHours: 31,
    overtimeRule: 24,
    saturdayRule: 18,
    sundayRule: 32,
    eveningRule: 37,
    nightRule: 142,
    shiftRule: 33,
    specialRule: 39,
  },
  "vvs-blikkenslageroverenskomsten": {
    normalWeekHours: 26,
    overtimeRule: 36,
    saturdayRule: 35,
    sundayRule: 90,
    eveningRule: 26,
    nightRule: 162,
    shiftRule: 21,
    specialRule: 62,
  },
};

function ruleText(field: AgreementRuleSourceKey, page?: number) {
  return page
    ? `${AGREEMENT_RULE_SOURCE_LABEL[field]} er fundet i PDF-kilden. Brug kildehenvisningen til side ${page} for den konkrete regeltekst og sats.`
    : "";
}

function ruleSources(agreement: (typeof collectiveAgreements)[number]) {
  const pages = EXTRACTED_RULE_SOURCE_PAGES[agreement.id] ?? {};
  if (!agreement.pdfUrl) return [];
  return Object.entries(pages).map(([field, page]) => ({
    field: field as AgreementRuleSourceKey,
    page,
    pdfUrl: agreement.pdfUrl!,
    pdfFileName: agreement.pdfFileName,
  }));
}

export const defaultAgreementRules: AgreementRule[] = collectiveAgreements.map((agreement) => ({
  id: agreement.id,
  agreementId: agreement.id,
  normalWeekHours: EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.normalWeekHours ? 37 : undefined,
  overtimeRule: ruleText("overtimeRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.overtimeRule),
  saturdayRule: ruleText("saturdayRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.saturdayRule),
  sundayRule: ruleText("sundayRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.sundayRule),
  eveningRule: ruleText("eveningRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.eveningRule),
  nightRule: ruleText("nightRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule),
  shiftRule: ruleText("shiftRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.shiftRule),
  specialRule: ruleText("specialRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.specialRule),
  eveningStart: EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.eveningRule ? "18:00" : "",
  nightStart: EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule ? "22:00" : "",
  nightEnd: EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule ? "06:00" : "",
  validFrom: "",
  validTo: "",
  sources: ruleSources(agreement),
  updatedAt: "2026-06-24T00:00:00.000Z",
}));

export function agreementRuleSourceHref(source: AgreementRuleSource) {
  return `${publicAgreementPdfHref(source.pdfUrl)}#page=${source.page}`;
}

export function agreementRuleSourceLabel(source: AgreementRuleSource) {
  return AGREEMENT_RULE_SOURCE_LABEL[source.field];
}
