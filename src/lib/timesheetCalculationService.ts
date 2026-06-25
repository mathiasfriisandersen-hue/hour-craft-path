import { getCollectiveAgreementById } from "./collectiveAgreements";
import {
  AGREEMENT_VALIDATION_STATUS_LABEL,
  getAgreementValidationReport,
} from "./agreementValidation";

export type TimesheetDay = {
  day: string;
  hours: number;
};

export type TimesheetInput = {
  workerName: string;
  workerEmail: string;
  userCompany: string;
  contactPerson: string;
  referenceNumber?: string;
  workAddress: string;
  selectedAgreementId: string;
  localAgreementApplies: boolean;
  days: TimesheetDay[];
  notes?: string;
};

export function validationNoteForStatus(status: string) {
  if (status === "validated_for_calculation") {
    return "Overenskomsten er manuelt valideret til den beregning, systemet understøtter.";
  }
  if (status === "needs_manual_review") {
    return "Regler og satser er udtrukket fra PDF, men kræver manuel review. Brug ikke automatisk satsberegning endnu.";
  }
  if (status === "rules_extracted") {
    return "Regler og satser er udtrukket fra PDF, men mangler manuel review, kildekontrol og test.";
  }
  if (status === "source_uploaded") {
    return "PDF er uploadet som juridisk kilde. Regler og satser skal udtrækkes, reviewes og testes før beregning.";
  }
  if (status === "validated") {
    return "Satser og tillæg er valideret til automatisk beregning.";
  }
  if (status === "missing_pdf") {
    return "PDF mangler for denne overenskomst. Satser og tillæg skal kontrolleres manuelt, før timesedlen bruges til løn- eller fakturabehandling.";
  }
  if (status === "pending_validation") {
    return "PDF er uploadet, men overenskomsten afventer manuel validering. Brug ikke automatisk satsberegning endnu.";
  }
  return "PDF er uploadet som juridisk kilde, men satser og tillæg er endnu ikke valideret til automatisk beregning. Tillæg skal kontrolleres mod PDF’en før løn- eller fakturabehandling.";
}

export function calculateTimesheetSummary(input: TimesheetInput) {
  const agreement = getCollectiveAgreementById(input.selectedAgreementId);

  if (!agreement) {
    throw new Error("Valgt overenskomst kunne ikke findes.");
  }
  const validationReport = getAgreementValidationReport(agreement.id);
  const workflowStatus =
    validationReport?.status ??
    (agreement.pdfUrl ? "source_uploaded" : agreement.rateValidationStatus);

  const totalHours = input.days.reduce((sum, day) => {
    return sum + (Number(day.hours) || 0);
  }, 0);

  const canCalculateRatesAutomatically = validationReport?.validatedForCalculation === true;
  const validationNote = validationReport?.validatedForCalculation
    ? validationReport.validationNote || validationNoteForStatus(workflowStatus)
    : validationReport?.validationNote || validationNoteForStatus(workflowStatus);

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    agreementId: agreement.id,
    agreementName: agreement.name,
    agreementCategory: agreement.category,
    industryArea: agreement.industryArea,
    localAgreementApplies: input.localAgreementApplies,
    pdfUrl: agreement.pdfUrl,
    pdfFileName: agreement.pdfFileName,
    rateValidationStatus:
      workflowStatus in AGREEMENT_VALIDATION_STATUS_LABEL
        ? AGREEMENT_VALIDATION_STATUS_LABEL[
            workflowStatus as keyof typeof AGREEMENT_VALIDATION_STATUS_LABEL
          ]
        : workflowStatus,
    canCalculateRatesAutomatically,
    validationNote,
  };
}
