import {
  contactPersonEmailBody,
  emailBody,
  emailSubject,
  mailtoUrl,
  type Timesheet,
} from "./timesheet-store";

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

export async function sendTimesheetEmail(t: Timesheet): Promise<TimesheetMailResult> {
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
      text: contactPersonEmailBody(t),
      adminText: emailBody(t),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Mailserver svarede med HTTP ${response.status}`);
  }

  return "api";
}
