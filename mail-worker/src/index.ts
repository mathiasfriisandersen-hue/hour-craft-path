type Env = {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
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

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_TEXT_LENGTH = 60_000;
const MAX_HTML_LENGTH = 120_000;
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
const INVITE_TOKEN_BYTES = 12;

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

async function readWorkerInvite(token: string, env: Env) {
  if (!env.WORKER_INVITES) throw new Error("WORKER_INVITES mangler");
  const invite = await env.WORKER_INVITES.get(token);
  if (!invite) throw new Error("Invitationen er udløbet eller findes ikke");
  return JSON.parse(invite) as unknown;
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

export default {
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
        (request.method === "GET" && url.pathname === "/worker-invite")
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

      if (request.method === "GET" && url.pathname === "/worker-invite") {
        const token = url.searchParams.get("i");
        if (!isValidInviteToken(token)) {
          return jsonResponse({ ok: false, error: "Invitationstoken er ugyldig" }, 400, headers);
        }
        const invite = await readWorkerInvite(token, env);
        return jsonResponse({ ok: true, invite }, 200, headers);
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
