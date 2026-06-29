type Env = {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
};

type TimesheetMailPayload = {
  timesheetId?: string;
  contactEmail?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  adminText?: string;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_TEXT_LENGTH = 60_000;

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
    "access-control-allow-methods": "POST, OPTIONS",
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

async function sendViaResend(payload: TimesheetMailPayload, env: Env) {
  const subject = cleanSubject(payload.subject);
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const adminText = typeof payload.adminText === "string" ? payload.adminText.trim() : text;

  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY mangler");
  if (!env.RESEND_FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL mangler");
  if (!isEmail(env.ADMIN_EMAIL)) throw new Error("ADMIN_EMAIL mangler eller er ugyldig");
  if (!isEmail(payload.contactEmail)) throw new Error("Kontaktpersonens mail er ugyldig");
  if (!subject) throw new Error("Emne mangler");
  if (!text) throw new Error("Mailtekst mangler");
  if (text.length > MAX_TEXT_LENGTH) throw new Error("Mailtekst er for lang");
  if (adminText.length > MAX_TEXT_LENGTH) throw new Error("Intern mailtekst er for lang");

  const sendEmail = async (to: string, bodyText: string) => {
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
        subject,
        text: bodyText,
        html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; line-height: 1.45;">${escapeHtml(
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

  const contactEmailResult = await sendEmail(payload.contactEmail, text);
  const adminEmailResult =
    env.ADMIN_EMAIL === payload.contactEmail
      ? undefined
      : await sendEmail(env.ADMIN_EMAIL, adminText);

  return {
    contactEmail: contactEmailResult,
    ...(adminEmailResult ? { adminEmail: adminEmailResult } : {}),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/send-timesheet") {
      return jsonResponse({ ok: false, error: "Not found" }, 404, headers);
    }

    if (!isOriginAllowed(request, env)) {
      return jsonResponse({ ok: false, error: "Origin not allowed" }, 403, headers);
    }

    const payload = await parsePayload(request);
    if (!payload) {
      return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
    }

    try {
      const resend = await sendViaResend(payload, env);
      return jsonResponse({ ok: true, resend }, 200, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mail kunne ikke sendes";
      return jsonResponse({ ok: false, error: message }, 400, headers);
    }
  },
};
