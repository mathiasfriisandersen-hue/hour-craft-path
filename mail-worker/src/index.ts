type Env = {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
  APP_BASE_URL?: string;
  WORKER_INVITES: KVNamespace;
};

type KVNamespace = {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
};

type TimesheetMailPayload = {
  timesheetId?: string;
  contactEmail?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  adminText?: string;
  adminHtml?: string;
  workerEmail?: string;
  workerSubject?: string;
  workerText?: string;
  workerHtml?: string;
  sendAdminCopy?: boolean;
};

type WorkerInviteCreatePayload = {
  timesheet?: unknown;
};

type WorkerConsentCreatePayload = {
  workerName?: string;
  workerEmail?: string;
};

type AppStatePayload = {
  version?: number;
  updatedAt?: string;
  timesheets?: unknown[];
  companies?: unknown[];
};

type StoredTimesheet = {
  id?: string;
  vikar?: string;
  vikarEmail?: string;
  vikarPhone?: string;
  tradeSkills?: unknown[];
  workerAccessCode?: string;
  competencies?: string;
  status?: string;
  weekStart?: string;
  createdAt?: string;
  updatedAt?: string;
  workerInactive?: boolean;
  workerConsentInactive?: boolean;
  workerConsentRenewalSentAt?: string;
  workerConsentRenewedAt?: string;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_TEXT_LENGTH = 60_000;
const MAX_HTML_LENGTH = 120_000;
const MAX_APP_STATE_LENGTH = 900_000;
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CONSENT_TTL_SECONDS = 31 * 24 * 60 * 60;
const INVITE_TOKEN_BYTES = 12;
const APP_STATE_KEY = "app-state-v1";

function jsonResponse(body: unknown, status: number, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins(env);
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0] || "";

  return {
    ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function isOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = allowedOrigins(env);
  return allowed.length === 0 || allowed.includes(origin);
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function personKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function cleanSubject(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 180);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function parsePayload(request: Request): Promise<TimesheetMailPayload | undefined> {
  try {
    return (await request.json()) as TimesheetMailPayload;
  } catch {
    return undefined;
  }
}

async function parseInviteCreatePayload(
  request: Request,
): Promise<WorkerInviteCreatePayload | undefined> {
  try {
    return (await request.json()) as WorkerInviteCreatePayload;
  } catch {
    return undefined;
  }
}

async function parseAppStatePayload(request: Request): Promise<AppStatePayload | undefined> {
  try {
    return (await request.json()) as AppStatePayload;
  } catch {
    return undefined;
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(INVITE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidInviteToken(value: string | null): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
}

async function createWorkerInvite(payload: WorkerInviteCreatePayload, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  const timesheet = payload.timesheet;
  if (!timesheet || typeof timesheet !== "object" || !("id" in timesheet)) {
    throw new Error("Timeseddel mangler");
  }

  const token = randomToken();
  await env.WORKER_INVITES.put(
    token,
    JSON.stringify({
      version: 1,
      timesheet,
    }),
    { expirationTtl: INVITE_TTL_SECONDS },
  );

  return { token, expiresInSeconds: INVITE_TTL_SECONDS };
}

async function createWorkerConsent(payload: WorkerConsentCreatePayload, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  if (!payload.workerName?.trim()) throw new Error("Vikarnavn mangler");
  if (!isEmail(payload.workerEmail)) throw new Error("Vikarens mail er ugyldig");

  const token = randomToken();
  await env.WORKER_INVITES.put(
    token,
    JSON.stringify({
      version: 1,
      workerName: payload.workerName.trim(),
      workerEmail: payload.workerEmail.trim(),
    }),
    { expirationTtl: CONSENT_TTL_SECONDS },
  );

  return { token, expiresInSeconds: CONSENT_TTL_SECONDS };
}

async function readWorkerInvite(token: string, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  const invite = await env.WORKER_INVITES.get(token);
  if (!invite) throw new Error("Invitationen er udløbet eller findes ikke");
  return JSON.parse(invite) as unknown;
}

async function readWorkerConsent(token: string, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  const consent = await env.WORKER_INVITES.get(token);
  if (!consent) throw new Error("Samtykkelinket er udløbet eller findes ikke");
  return JSON.parse(consent) as unknown;
}

async function readAppState(env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  const stored = await env.WORKER_INVITES.get(APP_STATE_KEY);
  if (!stored) {
    return { version: 1, updatedAt: "", timesheets: [], companies: [] };
  }
  return JSON.parse(stored) as unknown;
}

async function writeAppState(payload: AppStatePayload, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  if (!Array.isArray(payload.timesheets)) throw new Error("Timesedler mangler");
  if (!Array.isArray(payload.companies)) throw new Error("Virksomheder mangler");

  const state = {
    version: 1,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
    timesheets: payload.timesheets,
    companies: payload.companies,
  };
  const serialized = JSON.stringify(state);
  if (serialized.length > MAX_APP_STATE_LENGTH) {
    throw new Error("App-data er for stor til at blive gemt");
  }
  await env.WORKER_INVITES.put(APP_STATE_KEY, serialized);
  return state;
}

function appBaseUrl(env: Env): string {
  return (env.APP_BASE_URL || allowedOrigins(env)[0] || "").replace(/\/$/, "");
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

async function sendViaResend(payload: TimesheetMailPayload, env: Env) {
  const subject = cleanSubject(payload.subject);
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const html = typeof payload.html === "string" ? payload.html.trim() : "";
  const adminText = typeof payload.adminText === "string" ? payload.adminText.trim() : text;
  const adminHtml = typeof payload.adminHtml === "string" ? payload.adminHtml.trim() : html;
  const workerSubject = cleanSubject(payload.workerSubject) || subject;
  const workerText = typeof payload.workerText === "string" ? payload.workerText.trim() : "";
  const workerHtml = typeof payload.workerHtml === "string" ? payload.workerHtml.trim() : "";

  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY mangler");
  if (!env.RESEND_FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL mangler");
  if (!isEmail(env.ADMIN_EMAIL)) throw new Error("ADMIN_EMAIL mangler eller er ugyldig");
  if (!isEmail(payload.contactEmail)) throw new Error("Kontaktpersonens mail er ugyldig");
  if (payload.workerEmail && !isEmail(payload.workerEmail))
    throw new Error("Vikarens mail er ugyldig");
  if (!subject) throw new Error("Emne mangler");
  if (!text) throw new Error("Mailtekst mangler");
  if (text.length > MAX_TEXT_LENGTH) throw new Error("Mailtekst er for lang");
  if (adminText.length > MAX_TEXT_LENGTH) throw new Error("Intern mailtekst er for lang");
  if (workerText.length > MAX_TEXT_LENGTH) throw new Error("Vikarmailtekst er for lang");
  if (html.length > MAX_HTML_LENGTH) throw new Error("HTML-mail er for lang");
  if (adminHtml.length > MAX_HTML_LENGTH) throw new Error("Intern HTML-mail er for lang");
  if (workerHtml.length > MAX_HTML_LENGTH) throw new Error("Vikar HTML-mail er for lang");

  const sendEmail = async (
    to: string,
    emailSubject: string,
    bodyText: string,
    bodyHtml?: string,
  ) => {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to,
        ...(isEmail(payload.replyTo) ? { reply_to: payload.replyTo } : {}),
        subject: emailSubject,
        text: bodyText,
        html:
          bodyHtml ||
          `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; line-height: 1.45;">${escapeHtml(
            bodyText,
          )}</pre>`,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(responseText || `Resend svarede med HTTP ${response.status}`);
    }

    return responseText ? JSON.parse(responseText) : {};
  };

  const contactEmailResult = await sendEmail(payload.contactEmail, subject, text, html);
  const adminEmailResult =
    payload.sendAdminCopy === false || env.ADMIN_EMAIL === payload.contactEmail
      ? undefined
      : await sendEmail(env.ADMIN_EMAIL, subject, adminText, adminHtml);
  const workerEmailResult =
    payload.workerEmail && workerText
      ? await sendEmail(payload.workerEmail, workerSubject, workerText, workerHtml)
      : undefined;

  return {
    contactEmail: contactEmailResult,
    ...(adminEmailResult ? { adminEmail: adminEmailResult } : {}),
    ...(workerEmailResult ? { workerEmail: workerEmailResult } : {}),
  };
}

async function sendSingleEmail(
  to: string,
  subject: string,
  text: string,
  env: Env,
): Promise<unknown> {
  return sendViaResend({ contactEmail: to, subject, text, sendAdminCopy: false }, env);
}

async function runConsentRetention(env: Env): Promise<{ sent: number; anonymized: number }> {
  const state = (await readAppState(env)) as AppStatePayload;
  const timesheets = Array.isArray(state.timesheets)
    ? (state.timesheets as StoredTimesheet[])
    : [];
  const baseUrl = appBaseUrl(env);
  if (!baseUrl || timesheets.length === 0) return { sent: 0, anonymized: 0 };

  const now = new Date();
  let sent = 0;
  let anonymized = 0;
  const groups = new Map<string, StoredTimesheet[]>();

  for (const item of timesheets) {
    if (item.status === "draft" || item.workerInactive || item.workerConsentInactive) continue;
    const key = personKey(item.vikar) || personKey(item.vikarEmail);
    if (!key || !isEmail(item.vikarEmail)) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  for (const group of groups.values()) {
    const latestActivity = group
      .flatMap((item) => [parseDate(item.weekStart || item.createdAt), parseDate(item.workerConsentRenewedAt)])
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1);
    if (!latestActivity) continue;

    const warningAt = addMonths(latestActivity, 5);
    const inactiveAt = addMonths(latestActivity, 6);
    const latestSent = group
      .map((item) => parseDate(item.workerConsentRenewalSentAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1);

    if (now >= inactiveAt) {
      for (const item of group) {
        item.vikarEmail = "";
        item.vikarPhone = "";
        item.tradeSkills = [];
        item.workerAccessCode = "";
        item.competencies = "";
        item.workerConsentInactive = true;
        item.updatedAt = now.toISOString();
      }
      anonymized += group.length;
      continue;
    }

    if (now >= warningAt && (!latestSent || latestSent < latestActivity)) {
      const worker = group[0];
      const consent = await createWorkerConsent(
        { workerName: worker.vikar || "vikar", workerEmail: worker.vikarEmail },
        env,
      );
      const consentUrl = `${baseUrl}/vikar/consent?i=${encodeURIComponent(consent.token)}`;
      await sendSingleEmail(
        worker.vikarEmail || "",
        workerConsentRenewalSubject(),
        workerConsentRenewalBody(worker.vikar || "vikar", consentUrl),
        env,
      );
      for (const item of group) {
        item.workerConsentRenewalSentAt = now.toISOString();
        item.updatedAt = now.toISOString();
      }
      sent += 1;
    }
  }

  if (sent || anonymized) {
    await writeAppState(
      {
        version: 1,
        updatedAt: now.toISOString(),
        timesheets,
        companies: state.companies ?? [],
      },
      env,
    );
  }

  return { sent, anonymized };
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await runConsentRetention(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (
      !(
        (request.method === "POST" && url.pathname === "/send-timesheet") ||
        (request.method === "POST" && url.pathname === "/create-worker-invite") ||
        (request.method === "POST" && url.pathname === "/create-worker-consent") ||
        (request.method === "GET" && url.pathname === "/worker-invite") ||
        (request.method === "GET" && url.pathname === "/worker-consent") ||
        (request.method === "GET" && url.pathname === "/app-state") ||
        (request.method === "POST" && url.pathname === "/app-state")
      )
    ) {
      return jsonResponse({ ok: false, error: "Not found" }, 404, headers);
    }

    if (!isOriginAllowed(request, env)) {
      return jsonResponse({ ok: false, error: "Origin not allowed" }, 403, headers);
    }

    try {
      if (request.method === "POST" && url.pathname === "/create-worker-invite") {
        const invitePayload = await parseInviteCreatePayload(request);
        if (!invitePayload) {
          return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
        }
        const invite = await createWorkerInvite(invitePayload, env);
        return jsonResponse({ ok: true, invite }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/create-worker-consent") {
        const consentPayload = (await parsePayload(request)) as WorkerConsentCreatePayload;
        if (!consentPayload) {
          return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
        }
        const consent = await createWorkerConsent(consentPayload, env);
        return jsonResponse({ ok: true, consent }, 200, headers);
      }

      if (request.method === "GET" && url.pathname === "/app-state") {
        const state = await readAppState(env);
        return jsonResponse({ ok: true, state }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/app-state") {
        const appStatePayload = await parseAppStatePayload(request);
        if (!appStatePayload) {
          return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
        }
        const state = await writeAppState(appStatePayload, env);
        return jsonResponse({ ok: true, state }, 200, headers);
      }

      if (request.method === "GET" && url.pathname === "/worker-invite") {
        const token = url.searchParams.get("i");
        if (!isValidInviteToken(token)) {
          return jsonResponse({ ok: false, error: "Invitationstoken er ugyldig" }, 400, headers);
        }
        const invite = await readWorkerInvite(token, env);
        return jsonResponse({ ok: true, invite }, 200, headers);
      }

      if (request.method === "GET" && url.pathname === "/worker-consent") {
        const token = url.searchParams.get("i");
        if (!isValidInviteToken(token)) {
          return jsonResponse({ ok: false, error: "Samtykketoken er ugyldig" }, 400, headers);
        }
        const consent = await readWorkerConsent(token, env);
        return jsonResponse({ ok: true, consent }, 200, headers);
      }

      const payload = await parsePayload(request);
      if (!payload) {
        return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
      }
      const resend = await sendViaResend(payload, env);
      return jsonResponse({ ok: true, resend }, 200, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mail kunne ikke sendes";
      return jsonResponse({ ok: false, error: message }, 400, headers);
    }
  },
};
