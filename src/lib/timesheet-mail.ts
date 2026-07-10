import {
  contactPersonEmailBody,
  contactPersonEmailHtml,
  emailBody,
  emailSubject,
  formatWeekRange,
  generateOneTimeCode,
  mailtoUrl,
  upsert,
  workerSubmissionReceiptBody,
  workerSubmissionReceiptSubject,
  workerInviteEmailBody,
  workerInviteEmailHtml,
  workerInviteEmailSubject,
  weekNumber,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
  type WorkerLanguage,
} from "./timesheet-store";
import { getCollectiveAgreementById } from "./collectiveAgreements";
import { addDaysToISODate } from "./danishHolidays";
import { createShortContactPersonInviteUrl } from "./worker-invite";

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

  const contactTimesheet =
    t.contactPersonAccessCode && t.contactPersonMustChangeAccessCode !== undefined
      ? t
      : upsert({
          ...t,
          contactPersonAccessCode: generateOneTimeCode(),
          contactPersonMustChangeAccessCode: true,
        });
  const contactInviteUrl = await createShortContactPersonInviteUrl(contactTimesheet);

  const response = await fetch(mailApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timesheetId: contactTimesheet.id,
      contactEmail: contactTimesheet.kontaktpersonEmail,
      replyTo: contactTimesheet.vikarEmail,
      subject: emailSubject(contactTimesheet),
      text: contactPersonEmailBody(contactTimesheet, {
        footerMessage: options.contactFooterMessage,
        contactInviteUrl,
      }),
      html: contactPersonEmailHtml(contactTimesheet, {
        footerMessage: options.contactFooterMessage,
        contactInviteUrl,
      }),
      adminText: emailBody(contactTimesheet),
      workerEmail: contactTimesheet.vikarEmail,
      workerSubject: workerSubmissionReceiptSubject(contactTimesheet),
      workerText: workerSubmissionReceiptBody(contactTimesheet, {
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

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#4b5563;">${htmlEscape(
    label,
  )}</td><td style="padding:6px 0;font-weight:600;color:#111827;">${htmlEscape(value || "—")}</td></tr>`;
}

function workerStartDate(t: Timesheet): string {
  const firstWorkdayIndex = t.days.findIndex((day) => day.start && day.end);
  return addDaysToISODate(t.weekStart, firstWorkdayIndex >= 0 ? firstWorkdayIndex : 0);
}

function contactPersonInviteSubject(t: Timesheet): string {
  return `Ny vikar starter – ${t.vikar || "vikar"} – ${formatDate(workerStartDate(t))}`;
}

function contactPersonInviteBody(t: Timesheet, inviteUrl: string): string {
  return [
    `Hej ${t.kontaktperson || "kontaktperson"}`,
    "",
    `${t.vikar || "Vikaren"} starter hos ${t.brugervirksomhed || "jer"} den ${formatDate(
      workerStartDate(t),
    )}.`,
    "",
    "VIKAROPLYSNINGER",
    `Navn: ${t.vikar || "—"}`,
    `Telefon: ${t.vikarPhone || "—"}`,
    `Mail: ${t.vikarEmail || "—"}`,
    `Startdato: ${formatDate(workerStartDate(t))}`,
    `Periode: Uge ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`,
    `Arbejdssted: ${t.arbejdssted || "—"}`,
    `Reference: ${t.referenceNo || "—"}`,
    "",
    "LOGIN",
    "Du kan åbne timesedlen via linket her:",
    "",
    inviteUrl,
    "",
    ...(t.contactPersonMustChangeAccessCode
      ? [
          "Log ind første gang med denne engangskode:",
          "",
          t.contactPersonAccessCode || "—",
          "",
          "Efter første login bliver du bedt om at ændre adgangskoden.",
        ]
      : ["Brug din personlige adgangskode, hvis du allerede har valgt en."]),
    "",
    "Med venlig hilsen",
    "Sub-Z",
  ].join("\n");
}

function contactPersonInviteHtml(t: Timesheet, inviteUrl: string): string {
  const safeInviteUrl = htmlEscape(inviteUrl);
  return `<!doctype html>
<html lang="da">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">Hej ${htmlEscape(t.kontaktperson || "kontaktperson")}</p>
      <p style="margin:0 0 20px;line-height:1.5;">${htmlEscape(
        t.vikar || "Vikaren",
      )} starter hos ${htmlEscape(t.brugervirksomhed || "jer")} den ${htmlEscape(
        formatDate(workerStartDate(t)),
      )}.</p>
      <p style="margin:0 0 10px;font-weight:700;">Vikaroplysninger</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:22px;">
        <tbody>
          ${htmlRow("Navn", t.vikar || "—")}
          ${htmlRow("Telefon", t.vikarPhone || "—")}
          ${htmlRow("Mail", t.vikarEmail || "—")}
          ${htmlRow("Startdato", formatDate(workerStartDate(t)))}
          ${htmlRow("Periode", `Uge ${weekNumber(t.weekStart)} (${formatWeekRange(t.weekStart)})`)}
          ${htmlRow("Arbejdssted", t.arbejdssted || "—")}
          ${htmlRow("Reference", t.referenceNo || "—")}
        </tbody>
      </table>
      <p style="margin:0 0 10px;font-weight:700;">Login</p>
      <p style="margin:0 0 18px;line-height:1.5;">Du kan åbne timesedlen via knappen herunder.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeInviteUrl}" style="display:inline-block;background:#1f4e79;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">Åbn timeseddel</a>
      </p>
      <p style="margin:0 0 8px;color:#4b5563;font-size:13px;line-height:1.5;">Hvis knappen ikke virker, kan du kopiere dette link:</p>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.5;"><a href="${safeInviteUrl}" style="color:#1f4e79;">${safeInviteUrl}</a></p>
      ${
        t.contactPersonMustChangeAccessCode
          ? `<p style="margin:0 0 6px;line-height:1.5;">Log ind første gang med denne engangskode:</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:700;letter-spacing:0.12em;">${htmlEscape(
        t.contactPersonAccessCode || "—",
      )}</p>
      <p style="margin:0 0 22px;color:#4b5563;line-height:1.5;">Efter første login bliver du bedt om at ændre adgangskoden.</p>`
          : `<p style="margin:0 0 22px;color:#4b5563;line-height:1.5;">Brug din personlige adgangskode, hvis du allerede har valgt en.</p>`
      }
      <p style="margin:0;">Med venlig hilsen<br />Sub-Z</p>
    </div>
  </body>
</html>`;
}

export async function sendContactPersonInviteEmail(
  t: Timesheet,
  inviteUrl: string,
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const subject = contactPersonInviteSubject(t);
  const text = contactPersonInviteBody(t, inviteUrl);
  const html = contactPersonInviteHtml(t, inviteUrl);

  if (!mailApiUrl) {
    window.location.href = `mailto:${t.kontaktpersonEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
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
      subject,
      text,
      html,
      adminText: emailBody(t),
      sendAdminCopy: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}

function normalizeWorkerLanguage(value: unknown): WorkerLanguage {
  return value === "en" || value === "pl" ? value : "da";
}

function workerConsentRenewalSubject(language: WorkerLanguage = "da"): string {
  if (language === "en") return "Renew your consent to job offers from Sub-Z";
  if (language === "pl") return "Odnów zgodę na oferty pracy od Sub-Z";
  return "Forny samtykke til jobhenvendelser fra Sub-Z";
}

function workerConsentRenewalBody(
  workerName: string,
  consentUrl: string,
  language: WorkerLanguage = "da",
): string {
  if (language === "en") {
    return [
      `Hi ${workerName || "worker"}`,
      "",
      "We are contacting you because your consent for Sub-Z to contact you about relevant job opportunities must be renewed.",
      "",
      "If you still want to be registered with Sub-Z and receive job opportunities, confirm your consent here:",
      "",
      consentUrl,
      "",
      "When you confirm, your consent will be renewed and you can again receive relevant job opportunities from Sub-Z.",
      "",
      "If you do not want to renew your consent, you do not need to do anything.",
      "",
      "Best regards",
      "Sub-Z ApS",
    ].join("\n");
  }

  if (language === "pl") {
    return [
      `Cześć ${workerName || "pracowniku"}`,
      "",
      "Kontaktujemy się, ponieważ Twoja zgoda na kontakt ze strony Sub-Z w sprawie odpowiednich ofert pracy musi zostać odnowiona.",
      "",
      "Jeśli nadal chcesz być zarejestrowany w Sub-Z i otrzymywać oferty pracy, potwierdź zgodę tutaj:",
      "",
      consentUrl,
      "",
      "Po potwierdzeniu zgoda zostanie odnowiona i będziesz ponownie otrzymywać odpowiednie oferty pracy od Sub-Z.",
      "",
      "Jeśli nie chcesz odnawiać zgody, nie musisz nic robić.",
      "",
      "Z poważaniem",
      "Sub-Z ApS",
    ].join("\n");
  }

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
  workerLanguage: WorkerLanguage = "da",
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const language = normalizeWorkerLanguage(workerLanguage);
  const subject = workerConsentRenewalSubject(language);
  const text = workerConsentRenewalBody(workerName, consentUrl, language);

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
  workerInviteUrl?: string;
  workerAccessCode?: string;
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

function projectWorkerLanguage(worker?: KnownWorker): WorkerLanguage {
  return normalizeWorkerLanguage(worker?.language);
}

function projectWorkerSubject({ company, project, worker }: ProjectConfirmationInput): string {
  if (!worker) return "";
  const projectName = project.name || company.name;
  const language = projectWorkerLanguage(worker);
  if (language === "en") return `Project start – ${worker.name} – ${projectName}`;
  if (language === "pl") return `Rozpoczęcie projektu – ${worker.name} – ${projectName}`;
  return `Projektopstart – ${worker.name} – ${projectName}`;
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

function projectMailHtml({ company, project, worker }: ProjectConfirmationInput): string {
  const contactName = project.contactName || company.contactName || "kontaktperson";
  const intro = worker
    ? `Vi bekræfter hermed, at ${worker.name} starter hos ${company.name} på projektet ${project.name || "—"}.`
    : `Vi bekræfter hermed opstart af projektet ${project.name || "—"} hos ${company.name}.`;
  const detailsTitle = worker
    ? "Medarbejderen er oprettet med følgende oplysninger:"
    : "Projektet er oprettet med følgende oplysninger:";
  const footerText = worker
    ? "Medarbejderen bruger disse oplysninger som udgangspunkt ved registrering af timer. Hvis den faktiske arbejdstid afviger, kan medarbejderen rette timerne på timesedlen."
    : "De tilknyttede vikarer vil bruge disse oplysninger som udgangspunkt ved registrering af timer. Hvis arbejdstiden ændrer sig, kan vikaren stadig rette sine faktiske timer på timesedlen.";

  return `<!doctype html>
<html lang="da">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">Hej ${htmlEscape(contactName)}</p>
      <p style="margin:0 0 18px;line-height:1.5;">${htmlEscape(intro)}</p>
      <p style="margin:0 0 10px;font-weight:700;">${htmlEscape(detailsTitle)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:22px;">
        <tbody>
          ${worker ? htmlRow("Medarbejder", worker.name) : htmlRow("Projekt", project.name || "—")}
          ${worker ? htmlRow("Telefon", worker.phone || "—") : ""}
          ${worker ? htmlRow("Mail", worker.email) : ""}
          ${htmlRow("Opstartsdato", projectDate(project.startDate))}
          ${htmlRow("Projektafslutning", projectDate(project.endDate))}
          ${htmlRow("Reference nr.", project.referenceNo || "—")}
          ${htmlRow("Overenskomst", projectAgreementName(company, project))}
          ${htmlRow("Fagområde", projectTradeSkills(project))}
          ${htmlRow("Kompetencer", projectCompetencies(project, worker))}
          ${htmlRow("Arbejdstid", `${project.defaultStart || "—"} – ${project.defaultEnd || "—"}`)}
          ${htmlRow("Pause 1", `${project.pauseStart || "—"} – ${project.pauseEnd || "—"}`)}
          ${htmlRow("Pause 2", `${project.pause2Start || "—"} – ${project.pause2End || "—"}`)}
        </tbody>
      </table>
      <p style="margin:0 0 16px;line-height:1.5;">${htmlEscape(footerText)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">Når en timeseddel er indsendt, modtager du den til gennemgang og godkendelse.</p>
      <p style="margin:0 0 22px;line-height:1.5;">Giv gerne besked, hvis der er fejl i oplysningerne inden opstart.</p>
      <p style="margin:0;line-height:1.5;">Venlig hilsen<br />${htmlEscape(PROJECT_MAIL_SENDER_NAME)}<br />${htmlEscape(
        PROJECT_MAIL_COMPANY_NAME,
      )}<br />${htmlEscape(PROJECT_MAIL_PHONE)}<br />${htmlEscape(PROJECT_MAIL_EMAIL)}</p>
    </div>
  </body>
</html>`;
}

function projectWorkerMailLines({
  company,
  project,
  worker,
  workerInviteUrl,
  workerAccessCode,
}: ProjectConfirmationInput): string[] {
  if (!worker) return [];
  const language = projectWorkerLanguage(worker);

  if (language === "en") {
    return [
      `Hi ${worker.name}`,
      "",
      `You have been assigned to the project ${project.name || "—"} at ${company.name}.`,
      "",
      "You have been created with the following information:",
      "",
      `Worker: ${worker.name}`,
      `Phone: ${worker.phone || "—"}`,
      `Email: ${worker.email}`,
      `Start date: ${projectDate(project.startDate)}`,
      `Project end: ${projectDate(project.endDate)}`,
      `Reference no.: ${project.referenceNo || "—"}`,
      `Collective agreement: ${projectAgreementName(company, project)}`,
      `Trade area: ${projectTradeSkills(project)}`,
      `Competencies: ${projectCompetencies(project, worker)}`,
      "",
      "Work time:",
      `${project.defaultStart || "—"} – ${project.defaultEnd || "—"}`,
      "",
      "Breaks:",
      `Break 1: ${project.pauseStart || "—"} – ${project.pauseEnd || "—"}`,
      `Break 2: ${project.pause2Start || "—"} – ${project.pause2End || "—"}`,
      "",
      "Use this information as the starting point when registering your hours. If your actual work time differs, you can edit the hours on the timesheet.",
      "",
      ...(workerInviteUrl
        ? [
            "LOGIN",
            "Open the link below to log in to your timesheet:",
            "",
            workerInviteUrl,
            "",
            `One-time code: ${workerAccessCode || "—"}`,
            "",
            "The link is valid for 7 days from creation.",
            "",
            "You will be asked to use the one-time code and choose your own password.",
            "",
          ]
        : []),
      "Please let us know if any of the information is incorrect before start.",
      "",
      "Best regards",
      PROJECT_MAIL_SENDER_NAME,
      PROJECT_MAIL_COMPANY_NAME,
      PROJECT_MAIL_PHONE,
      PROJECT_MAIL_EMAIL,
    ];
  }

  if (language === "pl") {
    return [
      `Cześć ${worker.name}`,
      "",
      `Zostałeś przypisany do projektu ${project.name || "—"} w firmie ${company.name}.`,
      "",
      "Utworzono Cię z następującymi informacjami:",
      "",
      `Pracownik: ${worker.name}`,
      `Telefon: ${worker.phone || "—"}`,
      `E-mail: ${worker.email}`,
      `Data rozpoczęcia: ${projectDate(project.startDate)}`,
      `Zakończenie projektu: ${projectDate(project.endDate)}`,
      `Nr referencyjny: ${project.referenceNo || "—"}`,
      `Układ zbiorowy: ${projectAgreementName(company, project)}`,
      `Obszar zawodowy: ${projectTradeSkills(project)}`,
      `Kompetencje: ${projectCompetencies(project, worker)}`,
      "",
      "Czas pracy:",
      `${project.defaultStart || "—"} – ${project.defaultEnd || "—"}`,
      "",
      "Przerwy:",
      `Przerwa 1: ${project.pauseStart || "—"} – ${project.pauseEnd || "—"}`,
      `Przerwa 2: ${project.pause2Start || "—"} – ${project.pause2End || "—"}`,
      "",
      "Użyj tych informacji jako punktu wyjścia przy rejestracji godzin. Jeśli rzeczywisty czas pracy jest inny, możesz poprawić godziny na karcie czasu pracy.",
      "",
      ...(workerInviteUrl
        ? [
            "LOGOWANIE",
            "Otwórz poniższy link, aby zalogować się do karty czasu pracy:",
            "",
            workerInviteUrl,
            "",
            `Kod jednorazowy: ${workerAccessCode || "—"}`,
            "",
            "Link jest ważny przez 7 dni od utworzenia.",
            "",
            "Zostaniesz poproszony o użycie kodu jednorazowego i wybranie własnego hasła.",
            "",
          ]
        : []),
      "Daj nam znać przed rozpoczęciem, jeśli informacje są nieprawidłowe.",
      "",
      "Z poważaniem",
      PROJECT_MAIL_SENDER_NAME,
      PROJECT_MAIL_COMPANY_NAME,
      PROJECT_MAIL_PHONE,
      PROJECT_MAIL_EMAIL,
    ];
  }

  return [
    `Hej ${worker.name}`,
    "",
    `Du er tilknyttet projektet ${project.name || "—"} hos ${company.name}.`,
    "",
    "Du er oprettet med følgende oplysninger:",
    "",
    `Medarbejder: ${worker.name}`,
    `Telefon: ${worker.phone || "—"}`,
    `Mail: ${worker.email}`,
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
    "",
    "Brug oplysningerne som udgangspunkt ved registrering af timer. Hvis den faktiske arbejdstid afviger, kan du rette timerne på timesedlen.",
    "",
    ...(workerInviteUrl
      ? [
          "LOGIN",
          "Åbn linket herunder for at logge ind på din timeseddel:",
          "",
          workerInviteUrl,
          "",
          `Engangskode: ${workerAccessCode || "—"}`,
          "",
          "Linket er gyldigt i 7 dage fra oprettelse.",
          "",
          "Du bliver bedt om at bruge engangskoden og vælge din egen adgangskode.",
          "",
        ]
      : []),
    "Giv gerne besked, hvis der er fejl i oplysningerne inden opstart.",
    "",
    "Venlig hilsen",
    PROJECT_MAIL_SENDER_NAME,
    PROJECT_MAIL_COMPANY_NAME,
    PROJECT_MAIL_PHONE,
    PROJECT_MAIL_EMAIL,
  ];
}

function projectWorkerMailHtml({
  company,
  project,
  worker,
  workerInviteUrl,
  workerAccessCode,
}: ProjectConfirmationInput): string {
  if (!worker || !workerInviteUrl) return "";

  const language = projectWorkerLanguage(worker);
  const safeInviteUrl = htmlEscape(workerInviteUrl);
  const copy =
    language === "en"
      ? {
          htmlLang: "en",
          greeting: "Hi",
          intro: `You have been assigned to the project ${project.name || "—"} at ${company.name}.`,
          button: "Open timesheet",
          oneTimeCode: "One-time code",
          validityLabel: "Validity",
          validity: "The link is valid for 7 days from creation.",
          loginHelp:
            "You will be asked to use the one-time code and choose your own password.",
          worker: "Worker",
          phone: "Phone",
          email: "Email",
          startDate: "Start date",
          endDate: "Project end",
          reference: "Reference no.",
          agreement: "Collective agreement",
          tradeArea: "Trade area",
          competencies: "Competencies",
          workTime: "Work time",
          break1: "Break 1",
          break2: "Break 2",
          footer:
            "If your actual work time differs, you can edit the hours on the timesheet.",
        }
      : language === "pl"
        ? {
            htmlLang: "pl",
            greeting: "Cześć",
            intro: `Zostałeś przypisany do projektu ${project.name || "—"} w firmie ${company.name}.`,
            button: "Otwórz kartę czasu pracy",
            oneTimeCode: "Kod jednorazowy",
            validityLabel: "Ważność",
            validity: "Link jest ważny przez 7 dni od utworzenia.",
            loginHelp:
              "Zostaniesz poproszony o użycie kodu jednorazowego i wybranie własnego hasła.",
            worker: "Pracownik",
            phone: "Telefon",
            email: "E-mail",
            startDate: "Data rozpoczęcia",
            endDate: "Zakończenie projektu",
            reference: "Nr referencyjny",
            agreement: "Układ zbiorowy",
            tradeArea: "Obszar zawodowy",
            competencies: "Kompetencje",
            workTime: "Czas pracy",
            break1: "Przerwa 1",
            break2: "Przerwa 2",
            footer:
              "Jeśli rzeczywisty czas pracy jest inny, możesz poprawić godziny na karcie czasu pracy.",
          }
        : {
            htmlLang: "da",
            greeting: "Hej",
            intro: `Du er tilknyttet projektet ${project.name || "—"} hos ${company.name}.`,
            button: "Åbn timeseddel",
            oneTimeCode: "Engangskode",
            validityLabel: "Gyldighed",
            validity: "Linket er gyldigt i 7 dage fra oprettelse.",
            loginHelp:
              "Du bliver bedt om at bruge engangskoden og vælge din egen adgangskode.",
            worker: "Medarbejder",
            phone: "Telefon",
            email: "Mail",
            startDate: "Opstartsdato",
            endDate: "Projektafslutning",
            reference: "Reference nr.",
            agreement: "Overenskomst",
            tradeArea: "Fagområde",
            competencies: "Kompetencer",
            workTime: "Arbejdstid",
            break1: "Pause 1",
            break2: "Pause 2",
            footer:
              "Hvis den faktiske arbejdstid afviger, kan du rette timerne på timesedlen.",
          };

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">${copy.greeting} ${htmlEscape(worker.name)}</p>
      <p style="margin:0 0 18px;line-height:1.5;">${htmlEscape(copy.intro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${safeInviteUrl}" style="display:inline-block;background:#1f4e79;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;">${htmlEscape(copy.button)}</a>
      </p>
      <p style="margin:0 0 8px;font-weight:700;">Login</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:18px;">
        <tbody>
          ${htmlRow(copy.oneTimeCode, workerAccessCode || "—")}
          ${htmlRow(copy.validityLabel, copy.validity)}
        </tbody>
      </table>
      <p style="margin:0 0 18px;color:#4b5563;line-height:1.5;">${htmlEscape(copy.loginHelp)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tbody>
          ${htmlRow(copy.worker, worker.name)}
          ${htmlRow(copy.phone, worker.phone || "—")}
          ${htmlRow(copy.email, worker.email)}
          ${htmlRow(copy.startDate, projectDate(project.startDate))}
          ${htmlRow(copy.endDate, projectDate(project.endDate))}
          ${htmlRow(copy.reference, project.referenceNo || "—")}
          ${htmlRow(copy.agreement, projectAgreementName(company, project))}
          ${htmlRow(copy.tradeArea, projectTradeSkills(project))}
          ${htmlRow(copy.competencies, projectCompetencies(project, worker))}
          ${htmlRow(copy.workTime, `${project.defaultStart || "—"} – ${project.defaultEnd || "—"}`)}
          ${htmlRow(copy.break1, `${project.pauseStart || "—"} – ${project.pauseEnd || "—"}`)}
          ${htmlRow(copy.break2, `${project.pause2Start || "—"} – ${project.pause2End || "—"}`)}
        </tbody>
      </table>
      <p style="margin:22px 0 0;color:#4b5563;line-height:1.5;">${htmlEscape(copy.footer)}</p>
    </div>
  </body>
</html>`;
}

export async function sendProjectConfirmationEmail(
  input: ProjectConfirmationInput,
): Promise<TimesheetMailResult> {
  const mailApiUrl = await timesheetMailApiUrl();
  const contactEmail = input.project.contactEmail || input.company.contactEmail;
  const workerEmail = input.worker?.email?.trim() ?? "";
  const subject = input.worker
    ? `Projektopstart – ${input.worker.name} – ${input.project.name || input.company.name}`
    : `Projektopstart – ${input.project.name || input.company.name}`;
  const text = projectMailLines(input).join("\n");
  const html = projectMailHtml(input);
  const workerText = projectWorkerMailLines(input).join("\n");
  const workerHtml = projectWorkerMailHtml(input);
  const workerSubject = input.worker ? projectWorkerSubject(input) : subject;

  if (!mailApiUrl) {
    const cc = workerEmail ? `&cc=${encodeURIComponent(workerEmail)}` : "";
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}${cc}&body=${encodeURIComponent(text)}`;
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
      html,
      workerEmail,
      workerSubject,
      workerText,
      workerHtml,
      sendAdminCopy: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}
