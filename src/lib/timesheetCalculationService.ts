import { getCollectiveAgreementById } from "./collectiveAgreements";

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

  const totalHours = input.days.reduce((sum, day) => {
    return sum + (Number(day.hours) || 0);
  }, 0);

  const canCalculateRatesAutomatically = agreement.rateValidationStatus === "validated";

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    agreementId: agreement.id,
    agreementName: agreement.name,
    agreementCategory: agreement.category,
    industryArea: agreement.industryArea,
    localAgreementApplies: input.localAgreementApplies,
    pdfUrl: agreement.pdfUrl,
    pdfFileName: agreement.pdfFileName,
    rateValidationStatus: agreement.rateValidationStatus,
    canCalculateRatesAutomatically,
    validationNote: validationNoteForStatus(agreement.rateValidationStatus),
  };
}
