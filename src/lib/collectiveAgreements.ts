export type AgreementCategory =
  | "industry"
  | "construction"
  | "electrical"
  | "plumbing"
  | "inactive";

export type RateValidationStatus =
  | "missing_pdf"
  | "pdf_uploaded"
  | "pending_validation"
  | "validated";

export type CollectiveAgreement = {
  id: string;
  name: string;
  category: AgreementCategory;
  industryArea: string;
  isActive: boolean;
  supportsLocalAgreement: boolean;
  requiresUploadedAgreementPdf: boolean;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfUploadedAt?: string;
  rateValidationStatus: RateValidationStatus;
  note?: string;
};

const uploadedNote =
  "PDF er uploadet som juridisk kilde. Satser og tillæg er endnu ikke valideret til automatisk beregning.";

export const collectiveAgreements: CollectiveAgreement[] = [
  {
    id: "industriens-overenskomst",
    name: "Industriens Overenskomst",
    category: "industry",
    industryArea: "Industri / produktion / montage",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/industriens-overenskomst.pdf",
    pdfFileName: "industriens-overenskomst.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "industri-trae-moebeloverenskomsten",
    name: "Industri-, Træ- og Møbeloverenskomsten",
    category: "industry",
    industryArea: "Industri / træ / møbel / produktion",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/industri-trae-moebeloverenskomsten.pdf",
    pdfFileName: "industri-trae-moebeloverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "trae-moebeloverenskomsten",
    name: "Træ- og Møbeloverenskomsten",
    category: "industry",
    industryArea: "Træ / møbel / produktion",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/trae-moebeloverenskomsten.pdf",
    pdfFileName: "trae-moebeloverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "industrioverenskomsten-byggeri",
    name: "Industrioverenskomsten (Byggeri)",
    category: "construction",
    industryArea: "Byggeri / industri",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/industrioverenskomsten-byggeri.pdf",
    pdfFileName: "industrioverenskomsten-byggeri.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "industri-og-vaerkstedsoverenskomsten",
    name: "Industri- og Værkstedsoverenskomsten",
    category: "inactive",
    industryArea: "Industri / værksted / afventer relevans",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "pending_validation",
    note: "Skal ikke vises i version 1. Kun relevant hvis Sub-Z konkret har brugervirksomheder, hvor denne overenskomst er relevant. PDF, relevans og aktualitet skal kontrolleres før brug.",
  },
  {
    id: "bygningsoverenskomsten",
    name: "Bygningsoverenskomsten",
    category: "construction",
    industryArea: "Byggeri / håndværk",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/bygningsoverenskomsten.pdf",
    pdfFileName: "bygningsoverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "bygge-anlaegsoverenskomsten",
    name: "Bygge- og Anlægsoverenskomsten",
    category: "construction",
    industryArea: "Byggeri / anlæg",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/bygge-anlaegsoverenskomsten.pdf",
    pdfFileName: "bygge-anlaegsoverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "bygge-anlaegsoverenskomsten-dansk-haandvaerk-3f",
    name: "Bygge- og Anlægsoverenskomsten (Dansk Håndværk / 3F)",
    category: "construction",
    industryArea: "Byggeri / anlæg / Dansk Håndværk",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/bygge-anlaegsoverenskomsten-dansk-haandvaerk.pdf",
    pdfFileName: "bygge-anlaegsoverenskomsten-dansk-haandvaerk.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "jord-betonoverenskomsten",
    name: "Jord- og Betonoverenskomsten",
    category: "construction",
    industryArea: "Jord / beton / anlæg",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/jord-betonoverenskomsten.pdf",
    pdfFileName: "jord-betonoverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "murer-murerarbejdsmandsarbejde",
    name: "Murer- og murerarbejdsmandsarbejde",
    category: "construction",
    industryArea: "Murer / murerarbejdsmand",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/murer-murerarbejdsmandsarbejde.pdf",
    pdfFileName: "murer-murerarbejdsmandsarbejde.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "isoleringsoverenskomsten",
    name: "Isoleringsoverenskomsten",
    category: "construction",
    industryArea: "Isolering / byggeri",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/isoleringsoverenskomsten.pdf",
    pdfFileName: "isoleringsoverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "maleroverenskomsten",
    name: "Maleroverenskomsten",
    category: "construction",
    industryArea: "Maler / byggeri / håndværk",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/maleroverenskomsten.pdf",
    pdfFileName: "maleroverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "elektrikeroverenskomsten",
    name: "Elektrikeroverenskomsten",
    category: "electrical",
    industryArea: "El / installation",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/elektrikeroverenskomsten.pdf",
    pdfFileName: "elektrikeroverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "el-overenskomsten-di-def",
    name: "El-overenskomsten (DI / DEF)",
    category: "electrical",
    industryArea: "El / industri / installation",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/el-overenskomsten-di-def.pdf",
    pdfFileName: "el-overenskomsten-di-def.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "vvs-overenskomsten",
    name: "VVS-overenskomsten",
    category: "plumbing",
    industryArea: "VVS",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/vvs-overenskomsten.pdf",
    pdfFileName: "vvs-overenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "industri-vvs-overenskomsten",
    name: "Industri- og VVS-overenskomsten",
    category: "plumbing",
    industryArea: "Industri / VVS",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/industri-vvs-overenskomsten.pdf",
    pdfFileName: "industri-vvs-overenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "vvs-blikkenslageroverenskomsten",
    name: "VVS- og Blikkenslageroverenskomsten",
    category: "plumbing",
    industryArea: "VVS / blikkenslager",
    isActive: true,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "/overenskomster/vvs-blikkenslageroverenskomsten.pdf",
    pdfFileName: "vvs-blikkenslageroverenskomsten.pdf",
    pdfUploadedAt: "2026-06-24",
    rateValidationStatus: "pdf_uploaded",
    note: uploadedNote,
  },
  {
    id: "industriens-funktionaeroverenskomst",
    name: "Industriens Funktionæroverenskomst",
    category: "inactive",
    industryArea: "Funktionær / industri",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "missing_pdf",
    note: "Oprettet til senere brug. Skal ikke vises i version 1.",
  },
  {
    id: "hk-industrioverenskomsten",
    name: "HK-industrioverenskomsten",
    category: "inactive",
    industryArea: "HK / industri",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "missing_pdf",
    note: "Oprettet til senere brug. Skal ikke vises i version 1.",
  },
  {
    id: "hk-installationsoverenskomsten",
    name: "HK-installationsoverenskomsten",
    category: "inactive",
    industryArea: "HK / installation",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "missing_pdf",
    note: "Oprettet til senere brug. Skal ikke vises i version 1.",
  },
  {
    id: "tl-overenskomsten",
    name: "TL-overenskomsten",
    category: "inactive",
    industryArea: "Teknisk Landsforbund",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "missing_pdf",
    note: "Oprettet til senere brug. Skal ikke vises i version 1.",
  },
  {
    id: "auto-boligmonteringsoverenskomsten",
    name: "Auto- og Boligmonteringsoverenskomsten",
    category: "inactive",
    industryArea: "Auto / boligmontering",
    isActive: false,
    supportsLocalAgreement: true,
    requiresUploadedAgreementPdf: true,
    pdfUrl: "",
    pdfFileName: "",
    pdfUploadedAt: "",
    rateValidationStatus: "missing_pdf",
    note: "Oprettet til senere brug. Skal ikke vises i version 1.",
  },
];

export const activeCollectiveAgreements = collectiveAgreements.filter(
  (agreement) => agreement.isActive,
);

export function getCollectiveAgreementById(id: string) {
  return collectiveAgreements.find((agreement) => agreement.id === id);
}

export function getCollectiveAgreementByName(name: string) {
  return collectiveAgreements.find((agreement) => agreement.name === name);
}

export function publicAgreementPdfHref(pdfUrl?: string) {
  if (!pdfUrl) return "";
  if (/^https?:\/\//.test(pdfUrl)) return pdfUrl;
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${pdfUrl.replace(/^\//, "")}`;
}
