import type {
  Company,
  CompanyProject,
  KnownWorker,
  Timesheet,
  WorkerLanguage,
} from "./timesheet-store";
import { requireVerifiedMailBearer, SessionApiError } from "./api-session";

const BUILD_TIME_MAIL_API_URL = import.meta.env.VITE_TIMESHEET_MAIL_API_URL?.trim() ?? "";
let runtimeMailApiUrl: string | undefined;
let runtimeConfigPromise: Promise<string> | undefined;

export type TimesheetMailResult = "api";

type FixedMailTemplate =
  | "timesheet_submission_contact"
  | "worker_submission_receipt"
  | "worker_invitation"
  | "contact_invitation";

type ProjectConfirmationInput = {
  company: Company;
  project: CompanyProject;
  worker?: KnownWorker;
  workerInviteUrl?: string;
  timesheetId?: string;
};

export class TimesheetMailError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TimesheetMailError";
    this.code = code;
  }
}

export function isTimesheetMailConfigured(): boolean {
  return BUILD_TIME_MAIL_API_URL.length > 0 || Boolean(runtimeMailApiUrl);
}

export function safeTimesheetMailErrorMessage(error: unknown): string {
  if (error instanceof TimesheetMailError || error instanceof SessionApiError) {
    return error.message;
  }
  return "Mail er blokeret, fordi den sikre mailtjeneste ikke kunne verificeres.";
}

export async function sendTimesheetEmail(t: Timesheet): Promise<TimesheetMailResult> {
  await sendVerifiedCommand("timesheet_submission_contact", t.id);
  await sendVerifiedCommand("worker_submission_receipt", t.id);
  return "api";
}

export async function sendWorkerInviteEmail(
  t: Timesheet,
  inviteUrl: string,
): Promise<TimesheetMailResult> {
  void inviteUrl;
  await sendVerifiedCommand("worker_invitation", t.id);
  return "api";
}

export async function sendContactPersonInviteEmail(
  t: Timesheet,
  inviteUrl: string,
): Promise<TimesheetMailResult> {
  void inviteUrl;
  await sendVerifiedCommand("contact_invitation", t.id);
  return "api";
}

export async function sendWorkerConsentRenewalEmail(
  workerName: string,
  workerEmail: string,
  consentUrl: string,
  workerLanguage: WorkerLanguage = "da",
): Promise<TimesheetMailResult> {
  void workerName;
  void workerEmail;
  void consentUrl;
  void workerLanguage;
  throw new TimesheetMailError(
    "consent_mail_not_configured",
    "Samtykkemail er blokeret, indtil et serververificeret D1-samtykkeflow er konfigureret.",
  );
}

export async function sendProjectConfirmationEmail(
  input: ProjectConfirmationInput,
): Promise<TimesheetMailResult> {
  void input.company;
  void input.project;
  void input.workerInviteUrl;
  if (!input.worker || !input.timesheetId) {
    throw new TimesheetMailError(
      "project_mail_not_mapped",
      "Projektmail er blokeret, indtil en autoriseret D1-timeseddel og vikar er tilknyttet.",
    );
  }
  await sendVerifiedCommand("worker_invitation", input.timesheetId);
  return "api";
}

async function sendVerifiedCommand(
  template: FixedMailTemplate,
  timesheetId: string,
): Promise<void> {
  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) {
    throw new TimesheetMailError(
      "mail_not_configured",
      "Mail er blokeret, fordi den servervaliderede mailtjeneste ikke er konfigureret.",
    );
  }
  const { accessToken } = await requireVerifiedMailBearer();
  const token = accessToken.trim();
  if (!token || token.length > 8192 || /\s/u.test(token)) {
    throw new TimesheetMailError(
      "mail_session_blocked",
      "En serververificeret bearer-session er påkrævet for at sende mail.",
    );
  }

  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(mailApiUrl, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-request-id": idempotencyKey,
    },
    body: JSON.stringify({ template, timesheetId, idempotencyKey }),
  });

  if (!response.ok) {
    let code = "mail_rejected";
    try {
      const payload: unknown = await response.json();
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "code" in payload.error &&
        typeof payload.error.code === "string"
      ) {
        code = payload.error.code;
      }
    } catch {
      // Provider- og serverdetaljer må ikke sendes videre til browserens UI.
    }
    throw new TimesheetMailError(code, blockedMailMessage(code, response.status));
  }
}

async function timesheetMailApiUrl(): Promise<string> {
  const configured = BUILD_TIME_MAIL_API_URL || (await loadRuntimeMailApiUrl());
  if (!configured) return "";
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    return "";
  }
  const localDevelopment =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  return parsed.protocol === "https:" || localDevelopment ? parsed.toString() : "";
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

function blockedMailMessage(code: string, status: number): string {
  if (code === "recipient_decryption_not_configured") {
    return "Mail er blokeret, fordi den godkendte modtagerresolver ikke er konfigureret.";
  }
  if (code === "recipient_not_found" || code === "recipient_not_mapped") {
    return "Mail er blokeret, fordi en autoriseret D1-modtager ikke kunne findes.";
  }
  if (code === "recipient_ambiguous") {
    return "Mail er blokeret, fordi D1 indeholder flere mulige modtagere.";
  }
  if (code === "demo_mail_disabled") {
    return "Demoorganisationen må ikke sende rigtige mails.";
  }
  if (status === 401 || status === 403) {
    return "Mail er blokeret, fordi bearer-sessionen ikke kunne verificeres.";
  }
  if (status === 503) {
    return "Mail er blokeret, fordi den sikre mailkonfiguration ikke er komplet.";
  }
  return "Mailserveren afviste forespørgslen sikkert.";
}
