type Env = {
  TIMESHEET_DB: D1Database;
  TIMESHEET_API_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1ExecResult>;
};

type D1Result<T> = {
  results?: T[];
  success: boolean;
  meta: unknown;
};

type D1ExecResult = {
  success: boolean;
  meta: unknown;
};

type Status = "draft" | "sent" | "approved" | "rejected";
type OwnerRole = "bruger" | "bruger2";
type AbsenceType = "none" | "sick" | "vacation" | "dayoff";

type DayEntry = {
  start?: string;
  end?: string;
  pause?: number;
  pauseStart?: string;
  pauseEnd?: string;
  pause2Start?: string;
  pause2End?: string;
  absence?: AbsenceType;
};

type Timesheet = {
  id: string;
  ownerRole?: OwnerRole;
  vikar?: string;
  vikarCode?: string;
  vikarEmail?: string;
  vikarPhone?: string;
  vikarAddress?: string;
  vikarCpr?: string;
  brugervirksomhed?: string;
  companyId?: string;
  projectId?: string;
  projectName?: string;
  projectEndDate?: string;
  kontaktperson?: string;
  kontaktpersonPhone?: string;
  kontaktpersonEmail?: string;
  contactPersonAccessCode?: string;
  workerAccessCode?: string;
  referenceNo?: string;
  arbejdssted?: string;
  selectedAgreementId?: string;
  overenskomst?: string;
  hourlyWage?: number;
  weekStart?: string;
  days?: DayEntry[];
  notes?: string;
  status?: Status;
  archived?: boolean;
  invoiceSentDate?: string;
  payrollSentDate?: string;
  rejectionComment?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TimesheetRow = {
  data: string;
};

type AnalyticsStatusRow = {
  status: Status;
  count: number;
  totalHours: number;
};

type AnalyticsSummaryRow = {
  totalTimesheets: number;
  totalHours: number;
  sickLeaveTimesheets: number;
  pendingTimesheets: number;
  invoiceReadyTimesheets: number;
  payrollReadyTimesheets: number;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

const VALID_STATUSES = new Set(["draft", "sent", "approved", "rejected"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!isOriginAllowed(request, env)) {
      return errorResponse("origin_not_allowed", "Origin is not allowed.", 403, cors);
    }

    if (!isAuthorized(request, env)) {
      return errorResponse("unauthorized", "Authorization header with Bearer token is required.", 401, cors);
    }

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/api/timesheets") {
        return await upsertTimesheet(request, env, cors);
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets") {
        return await listTimesheets(env, cors, allTimesheetsQuery());
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/pending") {
        return await listTimesheets(env, cors, pendingTimesheetsQuery(todayIso()));
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/invoice-ready") {
        return await listTimesheets(env, cors, invoiceReadyTimesheetsQuery());
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/payroll-ready") {
        return await listTimesheets(env, cors, payrollReadyTimesheetsQuery(todayIso()));
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/sick-leave") {
        return await listTimesheets(env, cors, sickLeaveTimesheetsQuery());
      }

      if (request.method === "GET" && url.pathname === "/api/analytics") {
        return await analytics(env, cors);
      }

      return errorResponse("not_found", "Endpoint not found.", 404, cors);
    } catch {
      return errorResponse("internal_error", "Unexpected API error.", 500, cors);
    }
  },
};

async function upsertTimesheet(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const payload = await readJson(request);
  const timesheet = unwrapTimesheetPayload(payload);
  const validationError = validateTimesheet(timesheet);

  if (validationError) {
    return errorResponse("invalid_timesheet", validationError, 400, cors);
  }

  const normalized = normalizeTimesheet(timesheet);
  const row = toTimesheetDbRow(normalized);

  await env.TIMESHEET_DB.prepare(
    `INSERT INTO timesheets (
      id,
      status,
      owner_role,
      week_start,
      project_end_date,
      company_id,
      project_id,
      brugervirksomhed,
      worker_code,
      has_sick_leave,
      total_hours,
      invoice_sent_date,
      payroll_sent_date,
      created_at,
      updated_at,
      data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      owner_role = excluded.owner_role,
      week_start = excluded.week_start,
      project_end_date = excluded.project_end_date,
      company_id = excluded.company_id,
      project_id = excluded.project_id,
      brugervirksomhed = excluded.brugervirksomhed,
      worker_code = excluded.worker_code,
      has_sick_leave = excluded.has_sick_leave,
      total_hours = excluded.total_hours,
      invoice_sent_date = excluded.invoice_sent_date,
      payroll_sent_date = excluded.payroll_sent_date,
      updated_at = excluded.updated_at,
      data = excluded.data`,
  )
    .bind(
      row.id,
      row.status,
      row.ownerRole,
      row.weekStart,
      row.projectEndDate,
      row.companyId,
      row.projectId,
      row.brugervirksomhed,
      row.workerCode,
      row.hasSickLeave,
      row.totalHours,
      row.invoiceSentDate,
      row.payrollSentDate,
      row.createdAt,
      row.updatedAt,
      row.data,
    )
    .run();

  return jsonResponse({ ok: true, timesheet: normalized }, 200, cors);
}

async function listTimesheets(
  env: Env,
  cors: HeadersInit,
  query: { sql: string; params: unknown[]; label: string },
): Promise<Response> {
  const result = await env.TIMESHEET_DB.prepare(query.sql)
    .bind(...query.params)
    .all<TimesheetRow>();
  const timesheets = (result.results ?? []).map((row) => JSON.parse(row.data) as Timesheet);
  return jsonResponse({ ok: true, source: "d1", list: query.label, count: timesheets.length, timesheets }, 200, cors);
}

async function analytics(env: Env, cors: HeadersInit): Promise<Response> {
  const today = todayIso();
  const summary = await env.TIMESHEET_DB.prepare(
    `SELECT
      COUNT(*) AS totalTimesheets,
      COALESCE(SUM(total_hours), 0) AS totalHours,
      SUM(CASE WHEN has_sick_leave = 1 THEN 1 ELSE 0 END) AS sickLeaveTimesheets,
      SUM(CASE WHEN ${pendingSqlPredicate()} THEN 1 ELSE 0 END) AS pendingTimesheets,
      SUM(CASE WHEN ${invoiceReadySqlPredicate()} THEN 1 ELSE 0 END) AS invoiceReadyTimesheets,
      SUM(CASE WHEN ${payrollReadySqlPredicate()} THEN 1 ELSE 0 END) AS payrollReadyTimesheets
    FROM timesheets
    WHERE json_extract(data, '$.archived') IS NOT 1`,
  )
    .bind(today, today)
    .first<AnalyticsSummaryRow>();

  const statusRows = await env.TIMESHEET_DB.prepare(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_hours), 0) AS totalHours
    FROM timesheets
    WHERE json_extract(data, '$.archived') IS NOT 1
    GROUP BY status
    ORDER BY status`,
  ).all<AnalyticsStatusRow>();

  return jsonResponse(
    {
      ok: true,
      source: "d1",
      generatedAt: new Date().toISOString(),
      analytics: {
        totalTimesheets: Number(summary?.totalTimesheets ?? 0),
        totalHours: round(Number(summary?.totalHours ?? 0)),
        sickLeaveTimesheets: Number(summary?.sickLeaveTimesheets ?? 0),
        pendingTimesheets: Number(summary?.pendingTimesheets ?? 0),
        invoiceReadyTimesheets: Number(summary?.invoiceReadyTimesheets ?? 0),
        payrollReadyTimesheets: Number(summary?.payrollReadyTimesheets ?? 0),
        statusCounts: (statusRows.results ?? []).map((row) => ({
          status: row.status,
          count: Number(row.count),
          totalHours: round(Number(row.totalHours)),
        })),
      },
    },
    200,
    cors,
  );
}

function allTimesheetsQuery() {
  return {
    sql: `SELECT data FROM timesheets ORDER BY week_start DESC, updated_at DESC`,
    params: [],
    label: "all",
  };
}

function pendingTimesheetsQuery(today: string) {
  return {
    sql: `SELECT data FROM timesheets
      WHERE ${pendingSqlPredicate()}
      ORDER BY week_start ASC, updated_at ASC`,
    params: [today],
    label: "pending",
  };
}

function invoiceReadyTimesheetsQuery() {
  return {
    sql: `SELECT data FROM timesheets
      WHERE ${invoiceReadySqlPredicate()}
      ORDER BY week_start ASC, updated_at ASC`,
    params: [],
    label: "invoice-ready",
  };
}

function payrollReadyTimesheetsQuery(today: string) {
  return {
    sql: `SELECT data FROM timesheets
      WHERE ${payrollReadySqlPredicate()}
      ORDER BY week_start ASC, updated_at ASC`,
    params: [today],
    label: "payroll-ready",
  };
}

function sickLeaveTimesheetsQuery() {
  return {
    sql: `SELECT data FROM timesheets
      WHERE has_sick_leave = 1
      AND json_extract(data, '$.archived') IS NOT 1
      ORDER BY week_start DESC, updated_at DESC`,
    params: [],
    label: "sick-leave",
  };
}

function pendingSqlPredicate(): string {
  return `status = 'sent'
    AND json_extract(data, '$.archived') IS NOT 1
    AND COALESCE(NULLIF(project_end_date, ''), date(week_start, '+6 days')) < ?`;
}

function invoiceReadySqlPredicate(): string {
  return `status = 'approved'
    AND total_hours > 0
    AND invoice_sent_date = ''
    AND json_extract(data, '$.archived') IS NOT 1`;
}

function payrollReadySqlPredicate(): string {
  return `(
      status = 'approved'
      OR (
        status = 'sent'
        AND date(COALESCE(NULLIF(project_end_date, ''), date(week_start, '+6 days')), '+2 days') <= ?
      )
    )
    AND total_hours > 0
    AND payroll_sent_date = ''
    AND json_extract(data, '$.archived') IS NOT 1`;
}

function unwrapTimesheetPayload(payload: unknown): Timesheet {
  if (payload && typeof payload === "object" && "timesheet" in payload) {
    return (payload as { timesheet?: Timesheet }).timesheet as Timesheet;
  }
  return payload as Timesheet;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateTimesheet(value: Timesheet): string | undefined {
  if (!value || typeof value !== "object") return "Timesheet body is required.";
  if (!isNonEmptyString(value.id)) return "Timesheet id is required.";
  if (value.status && !VALID_STATUSES.has(value.status)) return "Timesheet status is invalid.";
  if (value.ownerRole && value.ownerRole !== "bruger" && value.ownerRole !== "bruger2") {
    return "Timesheet ownerRole is invalid.";
  }
  if (value.days && !Array.isArray(value.days)) return "Timesheet days must be an array.";
  return undefined;
}

function normalizeTimesheet(value: Timesheet): Timesheet {
  const now = new Date().toISOString();
  return {
    ...value,
    status: value.status ?? "draft",
    weekStart: value.weekStart ?? "",
    days: Array.isArray(value.days) ? value.days : [],
    createdAt: value.createdAt || now,
    updatedAt: now,
  };
}

function toTimesheetDbRow(timesheet: Timesheet) {
  return {
    id: timesheet.id,
    status: timesheet.status ?? "draft",
    ownerRole: timesheet.ownerRole ?? null,
    weekStart: timesheet.weekStart ?? "",
    projectEndDate: timesheet.projectEndDate ?? "",
    companyId: timesheet.companyId ?? "",
    projectId: timesheet.projectId ?? "",
    brugervirksomhed: timesheet.brugervirksomhed ?? "",
    workerCode: timesheet.vikarCode ?? "",
    hasSickLeave: hasSickLeave(timesheet.days) ? 1 : 0,
    totalHours: totalHours(timesheet.days),
    invoiceSentDate: timesheet.invoiceSentDate ?? "",
    payrollSentDate: timesheet.payrollSentDate ?? "",
    createdAt: timesheet.createdAt ?? new Date().toISOString(),
    updatedAt: timesheet.updatedAt ?? new Date().toISOString(),
    data: JSON.stringify(timesheet),
  };
}

function hasSickLeave(days: DayEntry[] | undefined): boolean {
  return Array.isArray(days) && days.some((day) => day?.absence === "sick");
}

function totalHours(days: DayEntry[] | undefined): number {
  if (!Array.isArray(days)) return 0;
  return round(
    days.reduce((sum, day) => {
      if (!day || (day.absence && day.absence !== "none")) return sum;
      const start = parseTime(day.start);
      const end = parseTime(day.end);
      if (start === undefined || end === undefined) return sum;
      const endMinutes = end <= start ? end + 24 * 60 : end;
      const pauseMinutes = pauseMinutesForDay(day);
      return sum + Math.max(0, (endMinutes - start - pauseMinutes) / 60);
    }, 0),
  );
}

function pauseMinutesForDay(day: DayEntry): number {
  const intervals = [
    buildPauseInterval(day.pauseStart, day.pauseEnd),
    buildPauseInterval(day.pause2Start, day.pause2End),
  ].filter((interval): interval is { start: number; end: number } => Boolean(interval));

  if (intervals.length > 0) {
    return intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  }

  return Math.max(0, Number(day.pause) || 0);
}

function buildPauseInterval(
  startValue: string | undefined,
  endValue: string | undefined,
): { start: number; end: number } | null {
  const start = parseTime(startValue);
  const end = parseTime(endValue);
  if (start === undefined || end === undefined || end === start) return null;
  return { start, end: end <= start ? end + 24 * 60 : end };
}

function parseTime(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function isAuthorized(request: Request, env: Env): boolean {
  const expectedToken = env.TIMESHEET_API_TOKEN?.trim();
  if (!expectedToken) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token === expectedToken;
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
  const allowedOrigin = origin ? (allowed.includes(origin) ? origin : "") : allowed[0] || "";

  return {
    ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin } : {}),
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
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

function jsonResponse(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  headers: HeadersInit = {},
): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status, headers);
}

function todayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
