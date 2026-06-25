import { collectiveAgreements } from "./collectiveAgreements";

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
  updatedAt: "2026-06-24T00:00:00.000Z",
}));
