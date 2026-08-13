import { type Timesheet } from "./timesheet-store";

export type WorkerConsentPayload = {
  version: 1;
  workerName: string;
  workerEmail: string;
};

export type InviteServerSession = {
  accessToken: string;
};

type InvitationPurpose = "worker" | "contact";

type CreateInvitationEnvelope = {
  ok?: unknown;
  invitation?: {
    token?: unknown;
    purpose?: unknown;
  };
  error?: {
    code?: unknown;
  };
};

const BUILD_TIME_MAIL_API_URL = import.meta.env.VITE_TIMESHEET_MAIL_API_URL?.trim() ?? "";
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/u;
const TIMESHEET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;

let runtimeMailApiUrl: string | undefined;
let runtimeConfigPromise: Promise<string> | undefined;

async function loadRuntimeMailApiUrl(): Promise<string> {
  if (runtimeMailApiUrl !== undefined) return runtimeMailApiUrl;

  runtimeConfigPromise ??= fetch(`${import.meta.env.BASE_URL}mail-config.json`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return "";
      const config: unknown = await response.json();
      return isRecord(config) && typeof config.timesheetMailApiUrl === "string"
        ? config.timesheetMailApiUrl.trim()
        : "";
    })
    .catch(() => "");

  runtimeMailApiUrl = await runtimeConfigPromise;
  return runtimeMailApiUrl;
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

function workerApiUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

export async function createShortWorkerInviteUrl(
  timesheet: Pick<Timesheet, "id">,
  session?: InviteServerSession,
): Promise<string> {
  return createShortInviteUrl(timesheet.id, "worker", "vikar/invite", session);
}

export async function createShortContactPersonInviteUrl(
  timesheet: Pick<Timesheet, "id">,
  session?: InviteServerSession,
): Promise<string> {
  return createShortInviteUrl(timesheet.id, "contact", "kontaktperson/invite", session);
}

async function createShortInviteUrl(
  timesheetId: string,
  purpose: InvitationPurpose,
  invitePath: string,
  session: InviteServerSession | undefined,
): Promise<string> {
  if (!TIMESHEET_ID_PATTERN.test(timesheetId)) {
    throw new Error("Invitationen mangler et gyldigt timeseddel-ID.");
  }
  const accessToken = session?.accessToken.trim() ?? "";
  if (!accessToken || accessToken.length > 8192 || /\s/u.test(accessToken)) {
    throw new Error("En serververificeret session er påkrævet for at oprette invitationer.");
  }

  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) {
    throw new Error("Den sikre invitationstjeneste er ikke konfigureret.");
  }
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Invitationen kan ikke oprettes sikkert i denne browser.");
  }

  const idempotencyKey = globalThis.crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch(workerApiUrl("/create-worker-invite", mailApiUrl), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "x-request-id": idempotencyKey,
      },
      body: JSON.stringify({ timesheetId, purpose, idempotencyKey }),
    });
  } catch {
    throw new Error("Den sikre invitationstjeneste kunne ikke kontaktes.");
  }

  const body = (await response.json().catch(() => undefined)) as
    | CreateInvitationEnvelope
    | undefined;
  if (response.status === 401 || response.status === 403) {
    throw new Error("En serververificeret session er påkrævet for at oprette invitationer.");
  }

  const token = body?.invitation?.token;
  if (
    !response.ok ||
    body?.ok !== true ||
    typeof token !== "string" ||
    !OPAQUE_TOKEN_PATTERN.test(token) ||
    body.invitation?.purpose !== purpose
  ) {
    throw new Error("Invitationen kunne ikke oprettes sikkert.");
  }

  const basePath = import.meta.env.BASE_URL || "/";
  const inviteUrl = new URL(`${basePath}${invitePath}`, window.location.origin);
  inviteUrl.searchParams.set("i", token);
  return inviteUrl.toString();
}

export async function fetchWorkerInviteByToken(token: string): Promise<boolean> {
  if (!OPAQUE_TOKEN_PATTERN.test(token)) return false;

  const mailApiUrl = await timesheetMailApiUrl();
  if (!mailApiUrl) return false;

  const url = new URL(workerApiUrl("/worker-invite", mailApiUrl));
  url.searchParams.set("i", token);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => undefined);
    return (
      response.ok &&
      isRecord(body) &&
      body.ok === true &&
      typeof body.valid === "boolean" &&
      body.valid
    );
  } catch {
    return false;
  }
}

export async function createWorkerConsentUrl(
  workerName: string,
  workerEmail: string,
): Promise<string> {
  void workerName;
  void workerEmail;
  throw new Error(
    "Det tidligere samtykkeflow er lukket. Brug det serververificerede D1-samtykkeflow.",
  );
}

export async function fetchWorkerConsentByToken(
  token: string,
): Promise<WorkerConsentPayload | undefined> {
  void token;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
