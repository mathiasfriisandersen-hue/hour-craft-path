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

type AgreementRuleSourcePages = number | number[];

const EXTRACTED_RULE_SOURCE_PAGES: Record<
  string,
  Partial<Record<AgreementRuleSourceKey, AgreementRuleSourcePages>>
> = {
  "industriens-overenskomst": {
    normalWeekHours: 28,
    overtimeRule: [38, 39, 40, 41],
    saturdayRule: [38, 40],
    sundayRule: 41,
    eveningRule: [45, 46],
    nightRule: 46,
    shiftRule: [48, 51, 52, 53],
    specialRule: 62,
  },
  "industri-trae-moebeloverenskomsten": {
    normalWeekHours: 34,
    overtimeRule: [42, 43, 45],
    saturdayRule: [32, 42],
    sundayRule: 42,
    eveningRule: [117, 118],
    nightRule: 118,
    shiftRule: [36, 37, 38, 39],
    specialRule: 129,
  },
  "trae-moebeloverenskomsten": {
    normalWeekHours: 23,
    overtimeRule: [34, 35, 36, 37],
    saturdayRule: [17, 27, 129],
    sundayRule: [27, 129],
    eveningRule: [14, 15],
    nightRule: [15, 27],
    shiftRule: [22, 25, 26, 27, 28],
    specialRule: 237,
  },
  "industrioverenskomsten-byggeri": {
    normalWeekHours: 106,
    overtimeRule: [117, 118],
    saturdayRule: 33,
    sundayRule: 118,
    eveningRule: [27, 28],
    nightRule: 28,
    shiftRule: [29, 31],
    specialRule: 155,
  },
  bygningsoverenskomsten: {
    normalWeekHours: 29,
    overtimeRule: [32, 34],
    saturdayRule: 34,
    sundayRule: 34,
    eveningRule: [25, 26],
    nightRule: 34,
    specialRule: 133,
  },
  "bygge-anlaegsoverenskomsten": {
    normalWeekHours: 24,
    overtimeRule: [30, 31, 32],
    saturdayRule: [26, 31, 32],
    sundayRule: [31, 32],
    eveningRule: [32, 33],
    nightRule: 33,
    shiftRule: [34, 36],
    specialRule: 143,
  },
  "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f": {
    normalWeekHours: 26,
    overtimeRule: [34, 36],
    saturdayRule: 36,
    sundayRule: 36,
    eveningRule: [28, 29],
    nightRule: [28, 29],
    specialRule: 163,
  },
  "jord-betonoverenskomsten": {
    normalWeekHours: 22,
    overtimeRule: [29, 30],
    saturdayRule: [24, 29, 30],
    sundayRule: [30, 35],
    eveningRule: [30, 31],
    nightRule: [30, 31],
    shiftRule: [32, 33, 34, 35],
    specialRule: 135,
  },
  "murer-murerarbejdsmandsarbejde": {
    normalWeekHours: 111,
    overtimeRule: [30, 31],
    saturdayRule: 30,
    sundayRule: 30,
    specialRule: 130,
  },
  isoleringsoverenskomsten: {
    normalWeekHours: 11,
    overtimeRule: 15,
    eveningRule: [13, 14],
    nightRule: 14,
    specialRule: 77,
  },
  maleroverenskomsten: {
    normalWeekHours: 13,
    overtimeRule: 13,
    saturdayRule: 13,
    sundayRule: 13,
    shiftRule: 14,
    specialRule: 9,
  },
  elektrikeroverenskomsten: {
    normalWeekHours: 23,
    overtimeRule: [54, 55],
    saturdayRule: [23, 24, 72],
    sundayRule: [61, 62],
    eveningRule: [20, 21],
    nightRule: 21,
    shiftRule: 26,
    specialRule: 70,
  },
  "el-overenskomsten-di-def": {
    normalWeekHours: 24,
    overtimeRule: [23, 25],
    saturdayRule: 18,
    sundayRule: 30,
    eveningRule: [26, 27],
    nightRule: [26, 27],
    shiftRule: [28, 29, 30],
  },
  "vvs-overenskomsten": {
    normalWeekHours: 19,
    overtimeRule: [22, 23],
    saturdayRule: 22,
    sundayRule: 22,
    eveningRule: 25,
    nightRule: 25,
    specialRule: 70,
  },
  "industri-vvs-overenskomsten": {
    normalWeekHours: 31,
    overtimeRule: [24, 25, 26, 27],
    saturdayRule: [18, 26],
    sundayRule: [26, 27],
    eveningRule: [37, 38],
    nightRule: 38,
    shiftRule: [31, 33, 34],
    specialRule: 39,
  },
  "vvs-blikkenslageroverenskomsten": {
    normalWeekHours: 26,
    overtimeRule: [35, 36],
    saturdayRule: [35, 36],
    sundayRule: [35, 36],
    eveningRule: [25, 26],
    nightRule: [25, 26],
    specialRule: 62,
  },
};

export function agreementRuleSourcePages(pages?: AgreementRuleSourcePages): number[] {
  if (Array.isArray(pages)) {
    return [...new Set(pages)].filter((page) => Number.isFinite(page) && page > 0);
  }
  return typeof pages === "number" && Number.isFinite(pages) && pages > 0 ? [pages] : [];
}

export function formatAgreementRulePages(pages: number[]) {
  const sortedPages = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart: number | undefined;
  let previousPage: number | undefined;

  for (const page of sortedPages) {
    if (rangeStart === undefined) {
      rangeStart = page;
      previousPage = page;
      continue;
    }
    if (previousPage !== undefined && page === previousPage + 1) {
      previousPage = page;
      continue;
    }
    ranges.push(rangeStart === previousPage ? `${rangeStart}` : `${rangeStart}-${previousPage}`);
    rangeStart = page;
    previousPage = page;
  }

  if (rangeStart !== undefined) {
    ranges.push(rangeStart === previousPage ? `${rangeStart}` : `${rangeStart}-${previousPage}`);
  }

  return ranges.join(", ");
}

function hasRuleSourcePages(pages?: AgreementRuleSourcePages) {
  return agreementRuleSourcePages(pages).length > 0;
}

function ruleText(field: AgreementRuleSourceKey, pages?: AgreementRuleSourcePages) {
  const sourcePages = agreementRuleSourcePages(pages);
  return sourcePages.length
    ? `${AGREEMENT_RULE_SOURCE_LABEL[field]} er fundet i PDF-kilden. Brug kildehenvisningen til side ${formatAgreementRulePages(sourcePages)} for den konkrete regeltekst og sats.`
    : "";
}

function ruleSources(agreement: (typeof collectiveAgreements)[number]) {
  const pages = EXTRACTED_RULE_SOURCE_PAGES[agreement.id] ?? {};
  if (!agreement.pdfUrl) return [];
  return Object.entries(pages).flatMap(([field, sourcePages]) =>
    agreementRuleSourcePages(sourcePages).map((page) => ({
      field: field as AgreementRuleSourceKey,
      page,
      pdfUrl: agreement.pdfUrl!,
      pdfFileName: agreement.pdfFileName,
    })),
  );
}

export const defaultAgreementRules: AgreementRule[] = collectiveAgreements.map((agreement) => ({
  id: agreement.id,
  agreementId: agreement.id,
  normalWeekHours: hasRuleSourcePages(EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.normalWeekHours)
    ? 37
    : undefined,
  overtimeRule: ruleText("overtimeRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.overtimeRule),
  saturdayRule: ruleText("saturdayRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.saturdayRule),
  sundayRule: ruleText("sundayRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.sundayRule),
  eveningRule: ruleText("eveningRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.eveningRule),
  nightRule: ruleText("nightRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule),
  shiftRule: ruleText("shiftRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.shiftRule),
  specialRule: ruleText("specialRule", EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.specialRule),
  eveningStart: hasRuleSourcePages(EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.eveningRule)
    ? "18:00"
    : "",
  nightStart: hasRuleSourcePages(EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule)
    ? "22:00"
    : "",
  nightEnd: hasRuleSourcePages(EXTRACTED_RULE_SOURCE_PAGES[agreement.id]?.nightRule) ? "06:00" : "",
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
