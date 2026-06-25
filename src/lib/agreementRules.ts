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

export const defaultAgreementRules: AgreementRule[] = collectiveAgreements.map((agreement) => ({
  id: agreement.id,
  agreementId: agreement.id,
  overtimeRule: "",
  saturdayRule: "",
  sundayRule: "",
  eveningRule: "",
  nightRule: "",
  shiftRule: "",
  specialRule: "",
  eveningStart: "",
  nightStart: "",
  nightEnd: "",
  validFrom: "",
  validTo: "",
  sources: [],
  updatedAt: "2026-06-24T00:00:00.000Z",
}));

export function agreementRuleSourceHref(source: AgreementRuleSource) {
  return `${publicAgreementPdfHref(source.pdfUrl)}#page=${source.page}`;
}

export function agreementRuleSourceLabel(source: AgreementRuleSource) {
  return AGREEMENT_RULE_SOURCE_LABEL[source.field];
}
