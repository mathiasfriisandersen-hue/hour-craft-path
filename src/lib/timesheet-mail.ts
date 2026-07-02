import {
  contactPersonEmailBody,
  emailBody,
  emailSubject,
  mailtoUrl,
  workerSubmissionReceiptBody,
  workerSubmissionReceiptSubject,
  workerInviteEmailBody,
  workerInviteEmailHtml,
  workerInviteEmailSubject,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
} from "./timesheet-store";
import { getCollectiveAgreementById } from "./collectiveAgreements";

const BUILD_TIME_MAIL_API_URL = import.meta.env.VITE_TIMESHEET_MAIL_API_URL?.trim() ?? "";
let runtimeMailApiUrl: string | undefined;
let runtimeConfigPromise: Promise<string> | undefined;

export function isTimesheetMailConfigured(): boolean {
  return BUILD_TIME_MAIL_API_URL.length > 0 || Boolean(runtimeMailApiUrl);
}

async function loadRuntimeMailApiUrl(): Promise<string> {
  if (runtimeMailApiUrl !== undefined) return runtimeMailApiUrl;

  runtimeConfigPromise ??= fetch(`${import.meta.env.BASE_URL}mail-config.json`, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return "";
      const config = (await response.json()) as { timesheetMailApiUrl?: string };
      return config.timesheetMailApiUrl?.trim() ?? "";
    })
    .catch(() => "");

  runtimeMailApiUrl = await runtimeConfigPromise;
  return runtimeMailApiUrl;
}

async function timesheetMailApiUrl(): Promise<string> {
  return BUILD_TIME_MAIL_API_URL || loadRuntimeMailApiUrl();
}

export type TimesheetMailResult = "api" | "mailto";

type SendTimesheetEmailOptions = {
  contactFooterMessage?: string;
  workerFooterMessage?: string;
};

export async function sendTimesheetEmail(
  t: Timesheet,
  options: SendTimesheetEmailOptions = {},
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();

  if (!mailApiUrl) {
    window.location.href = mailtoUrl(t);
    return "mailto";
  }

  const response = await fetch(mailApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timesheetId: t.id,
      contactEmail: t.kontaktpersonEmail,
      replyTo: t.vikarEmail,
      subject: emailSubject(t),
      text: contactPersonEmailBody(t, { footerMessage: options.contactFooterMessage }),
      adminText: emailBody(t),
      workerEmail: t.vikarEmail,
      workerSubject: workerSubmissionReceiptSubject(t),
      workerText: workerSubmissionReceiptBody(t, {
        footerMessage: options.workerFooterMessage,
      }),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}

export async function sendWorkerInviteEmail(
  t: Timesheet,
  inviteUrl: string,
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const subject = workerInviteEmailSubject(t);
  const text = workerInviteEmailBody(t, inviteUrl);
  const html = workerInviteEmailHtml(t, inviteUrl);

  if (!mailApiUrl) {
    const fallbackText = `${text}\n\nLink til timeseddel: ${inviteUrl}`;
    window.location.href = `mailto:${t.vikarEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fallbackText)}`;
    return "mailto";
  }

  const response = await fetch(mailApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timesheetId: t.id,
      contactEmail: t.vikarEmail,
      replyTo: t.kontaktpersonEmail,
      subject,
      text,
      html,
      sendAdminCopy: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}

function workerConsentRenewalSubject(): string {
  return "Forny samtykke til jobhenvendelser fra Sub-Z";
}

function workerConsentRenewalBody(workerName: string, consentUrl: string): string {
  return [
    `Hej ${workerName || "vikar"}`,
    "",
    "Vi kontakter dig, fordi dit samtykke til, at Sub-Z må kontakte dig om relevante jobmuligheder, skal fornyes.",
    "",
    "Hvis du fortsat ønsker at være registreret hos Sub-Z og modtage henvendelser om job, skal du bekræfte dit samtykke via linket her:",
    "",
    consentUrl,
    "",
    "Når du har bekræftet, bliver dit samtykke fornyet, og du kan igen modtage relevante jobmuligheder fra Sub-Z.",
    "",
    "Hvis du ikke ønsker at forny dit samtykke, skal du ikke gøre noget.",
    "",
    "Venlig hilsen",
    "Sub-Z ApS",
  ].join("\n");
}

export async function sendWorkerConsentRenewalEmail(
  workerName: string,
  workerEmail: string,
  consentUrl: string,
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const subject = workerConsentRenewalSubject();
  const text = workerConsentRenewalBody(workerName, consentUrl);

  if (!mailApiUrl) {
    window.location.href = `mailto:${workerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return "mailto";
  }

  const response = await fetch(mailApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contactEmail: workerEmail,
      subject,
      text,
      sendAdminCopy: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}

type ProjectConfirmationInput = {
  company: Company;
  project: CompanyProject;
  worker?: KnownWorker;
};

const PROJECT_MAIL_SENDER_NAME = "Sub-Z";
const PROJECT_MAIL_COMPANY_NAME = "Sub-Z";
const PROJECT_MAIL_PHONE = "40601253";
const PROJECT_MAIL_EMAIL = "timesheet@send.mathiasfriisandersen.dk";

function projectAgreementName(company: Company, project: CompanyProject): string {
  const agreementId = project.selectedAgreementId || company.selectedAgreementId || "";
  return agreementId ? getCollectiveAgreementById(agreementId)?.name || "—" : "—";
}

function projectTradeSkills(project: CompanyProject): string {
  return project.tradeSkills.join(", ") || "—";
}

function projectCompetencies(project: CompanyProject, worker?: KnownWorker): string {
  return project.competencies.trim() || worker?.competencies.trim() || "—";
}

function projectDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function projectMailLines({ company, project, worker }: ProjectConfirmationInput): string[] {
  const common = [
    `Opstartsdato: ${projectDate(project.startDate)}`,
    `Projektafslutning: ${projectDate(project.endDate)}`,
    `Reference nr.: ${project.referenceNo || "—"}`,
    `Overenskomst: ${projectAgreementName(company, project)}`,
    `Fagområde: ${projectTradeSkills(project)}`,
    `Kompetencer: ${projectCompetencies(project, worker)}`,
    "",
    "Arbejdstid:",
    `${project.defaultStart || "—"} – ${project.defaultEnd || "—"}`,
    "",
    "Pauser:",
    `Pause 1: ${project.pauseStart || "—"} – ${project.pauseEnd || "—"}`,
    `Pause 2: ${project.pause2Start || "—"} – ${project.pause2End || "—"}`,
  ];

  if (!worker) {
    return [
      `Hej ${project.contactName || company.contactName || "kontaktperson"}`,
      "",
      `Vi bekræfter hermed opstart af projektet ${project.name || "—"} hos ${company.name}.`,
      "",
      "Projektet er oprettet med følgende oplysninger:",
      "",
      `Projekt: ${project.name || "—"}`,
      ...common,
      "",
      "De tilknyttede vikarer vil bruge disse oplysninger som udgangspunkt ved registrering af timer. Hvis arbejdstiden ændrer sig, kan vikaren stadig rette sine faktiske timer på timesedlen.",
      "",
      "Når en timeseddel er indsendt, modtager du den til gennemgang og godkendelse.",
      "",
      "Giv gerne besked, hvis der er fejl i oplysningerne, inden projektet går i gang.",
      "",
      "Venlig hilsen",
      PROJECT_MAIL_SENDER_NAME,
      PROJECT_MAIL_COMPANY_NAME,
      PROJECT_MAIL_PHONE,
      PROJECT_MAIL_EMAIL,
    ];
  }

  return [
    `Hej ${project.contactName || company.contactName || "kontaktperson"}`,
    "",
    `Vi bekræfter hermed, at ${worker.name} starter hos ${company.name} på projektet ${project.name || "—"}.`,
    "",
    "Medarbejderen er oprettet med følgende oplysninger:",
    "",
    `Medarbejder: ${worker.name}`,
    `Telefon: ${worker.phone || "—"}`,
    `Mail: ${worker.email}`,
    ...common,
    "",
    "Medarbejderen bruger disse oplysninger som udgangspunkt ved registrering af timer. Hvis den faktiske arbejdstid afviger, kan medarbejderen rette timerne på timesedlen.",
    "",
    "Når timesedlen er indsendt, modtager du den til gennemgang og godkendelse.",
    "",
    "Giv gerne besked, hvis der er fejl i oplysningerne inden opstart.",
    "",
    "Venlig hilsen",
    PROJECT_MAIL_SENDER_NAME,
    PROJECT_MAIL_COMPANY_NAME,
    PROJECT_MAIL_PHONE,
    PROJECT_MAIL_EMAIL,
  ];
}

export async function sendProjectConfirmationEmail(
  input: ProjectConfirmationInput,
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const contactEmail = input.project.contactEmail || input.company.contactEmail;
  const subject = input.worker
    ? `Projektopstart – ${input.worker.name} – ${input.project.name || input.company.name}`
    : `Projektopstart – ${input.project.name || input.company.name}`;
  const text = projectMailLines(input).join("\n");

  if (!mailApiUrl) {
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return "mailto";
  }

  const response = await fetch(mailApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contactEmail,
      replyTo: PROJECT_MAIL_EMAIL,
      subject,
      text,
      sendAdminCopy: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}
