import { type Timesheet } from "./timesheet-store";

export type WorkerInvitePayload = {
  version: 1;
  timesheet: Timesheet;
};

export type WorkerConsentPayload = {
  version: 1;
  workerName: string;
  workerEmail: string;
};

function decodeBase64Url(value: string): string {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const BUILD_TIME_MAIL_API_URL = import.meta.env.VITE_TIMESHEET_MAIL_API_URL?.trim() ?? "";
let runtimeMailApiUrl: string | undefined;
let runtimeConfigPromise: Promise<string> | undefined;

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

function workerApiUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

export async function createShortWorkerInviteUrl(t: Timesheet): Promise<string> {
  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) throw new Error("Mailsystemet er ikke konfigureret");

  const response = await fetch(workerApiUrl("/create-worker-invite", mailApiUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ timesheet: t }),
  });

  const body = (await response.json().catch(() => undefined)) as
    | { ok?: boolean; invite?: { token?: string }; error?: string }
    | undefined;

  if (!response.ok || !body?.ok || !body.invite?.token) {
    throw new Error(body?.error || `Invite-server svarede med HTTP ${response.status}`);
  }

  const basePath = import.meta.env.BASE_URL ?? "/";
  const inviteUrl = new URL(`${basePath}vikar/invite`, window.location.origin);
  inviteUrl.searchParams.set("i", body.invite.token);
  return inviteUrl.toString();
}

export async function createWorkerConsentUrl(workerName: string, workerEmail: string): Promise<string> {
  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) throw new Error("Mailsystemet er ikke konfigureret");

  const response = await fetch(workerApiUrl("/create-worker-consent", mailApiUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ workerName, workerEmail }),
  });

  const body = (await response.json().catch(() => undefined)) as
    | { ok?: boolean; consent?: { token?: string }; error?: string }
    | undefined;

  if (!response.ok || !body?.ok || !body.consent?.token) {
    throw new Error(body?.error || `Samtykke-server svarede med HTTP ${response.status}`);
  }

  const basePath = import.meta.env.BASE_URL ?? "/";
  const consentUrl = new URL(`${basePath}vikar/consent`, window.location.origin);
  consentUrl.searchParams.set("i", body.consent.token);
  return consentUrl.toString();
}

export async function fetchWorkerInviteByToken(
  token: string,
): Promise<WorkerInvitePayload | undefined> {
  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) return undefined;

  const url = new URL(workerApiUrl("/worker-invite", mailApiUrl));
  url.searchParams.set("i", token);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const body = (await response.json().catch(() => undefined)) as
    | { ok?: boolean; invite?: WorkerInvitePayload }
    | undefined;

  if (!response.ok || !body?.ok || body.invite?.version !== 1 || !body.invite.timesheet?.id) {
    return undefined;
  }

  return body.invite;
}

export async function fetchWorkerConsentByToken(
  token: string,
): Promise<WorkerConsentPayload | undefined> {
  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) return undefined;

  const url = new URL(workerApiUrl("/worker-consent", mailApiUrl));
  url.searchParams.set("i", token);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const body = (await response.json().catch(() => undefined)) as
    | { ok?: boolean; consent?: WorkerConsentPayload }
    | undefined;

  if (
    !response.ok ||
    !body?.ok ||
    body.consent?.version !== 1 ||
    !body.consent.workerName ||
    !body.consent.workerEmail
  ) {
    return undefined;
  }

  return body.consent;
}

export function parseWorkerInviteFromHash(hash: string): WorkerInvitePayload | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("invite");
  if (!encoded) return undefined;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as WorkerInvitePayload;
    if (parsed.version !== 1 || !parsed.timesheet?.id) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
