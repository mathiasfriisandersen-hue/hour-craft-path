import {
  AuthenticationError,
  authenticateRequest,
  issueDemoSession,
  requireRole,
  type AuthEnvironment,
  type AuthSession,
  type MembershipRole,
} from "../../workers/shared/auth";
import {
  AgreementCalculationError,
  calculateAndPersistTimesheet,
} from "../../workers/shared/agreement-calculation";
import { INVALID_WORK_DATE, isStrictWorkDate } from "../../shared/agreement-engine";

type Env = {
  TIMESHEET_DB: D1Database;
  ALLOWED_ORIGIN?: string;
  AUTH_ISSUER?: string;
  AUTH_AUDIENCE?: string;
  SUPABASE_JWKS_URL?: string;
  DEMO_SESSION_SECRET?: string;
  DEMO_ACCESS_CODE?: string;
  OPENAI_API_KEY?: string;
} & AuthEnvironment;

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
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
  meta: {
    changes?: number;
  };
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
  companyRecordId?: string;
  projectId?: string;
  projectRecordId?: string;
  workerRecordId?: string;
  employmentTermId?: string;
  agreementAssignmentId?: string;
  projectName?: string;
  projectEndDate?: string;
  kontaktperson?: string;
  kontaktpersonPhone?: string;
  kontaktpersonEmail?: string;
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

type AdminAssistantTimesheet = {
  id: string;
  worker: string;
  company: string;
  project: string;
  weekStart: string;
  status: string;
  totalHours: number;
  absence: string;
  invoiceSent: boolean;
  payrollSent: boolean;
};

type TimesheetRow = {
  id: string;
  organization_id: string;
  company_record_id: string;
  project_record_id: string;
  worker_record_id: string;
  employment_term_id: string;
  agreement_assignment_id: string;
  owner_membership_id: string;
  row_version: number;
  status: Status;
  data: string;
};

type TimesheetQuery = {
  sql: string;
  params: unknown[];
  label: string;
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

type CalculationSnapshotRow = {
  calculation_id: string;
  status: "completed" | "manual_review_required" | "source_conflict" | "failed";
  gross_pay_cents: number;
  result_sha256: string;
  result_snapshot_json: string;
  manual_review_reasons_json: string;
};

type AgreementCatalogRow = {
  id: string;
  catalog_key: string;
  exact_title: string;
  agreement_parties: string;
  employer_organization: string;
  covered_work_areas: string;
  employee_category: string;
  geography_scope: string;
  catalog_status: string;
  version_id: string | null;
  version_label: string | null;
  valid_from: string | null;
  valid_to: string | null;
  implementation_status: string | null;
  verification_status: string | null;
  source_id: string | null;
  source_type: string | null;
  source_title: string | null;
  official_url: string | null;
  source_verification_status: string | null;
  approved_override_count: number;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

const PRIVACY_POLICY_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <title>Privacy Policy - Timesheet GPT</title>
  </head>
  <body>
    <main>
      <h1>Privacy Policy for Timesheet GPT</h1>
      <p>Last updated: 13 July 2026</p>
      <h2>What data the GPT may access</h2>
      <p>The GPT may access information from the timesheet system when needed to answer a user request. This can include timesheet status, work dates, start and end times, break duration, submitted hours, worker names or worker codes, company or project names, contact person details, comments, approval status and relevant system configuration.</p>
      <h2>How the data is used</h2>
      <p>The data is used only to help with timesheet-related tasks, such as finding information, explaining a timesheet, checking status, preparing support answers and helping users understand the workflow. The GPT should not be used to make final payroll, legal or collective-agreement decisions without manual validation.</p>
      <h2>Data sharing and sale</h2>
      <p>The information is not sold. Data is only used for the timesheet support purpose described above and is not shared with third parties for advertising or resale.</p>
      <h2>Contact</h2>
      <p>Questions about this privacy policy or the Timesheet GPT can be sent to mathiasfriisandersen@gmail.com.</p>
    </main>
  </body>
</html>`;

const VALID_STATUSES = new Set(["draft", "sent", "approved", "rejected"]);

class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname === "/privacy-timesheet-gpt.html"
    ) {
      return privacyPolicyResponse(request.method === "HEAD");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!isOriginAllowed(request, env)) {
      return errorResponse("origin_not_allowed", "Origin is not allowed.", 403, cors);
    }

    try {
      if (request.method === "POST" && url.pathname === "/api/demo/session") {
        const payload = (await readJson(request)) as {
          role?: MembershipRole;
          accessCode?: unknown;
        };
        const role = payload?.role;
        if (
          role !== "vikar" &&
          role !== "kontaktperson" &&
          role !== "konsulent" &&
          role !== "organisationsadministrator"
        ) {
          return errorResponse("invalid_demo_role", "Demo-rollen er ugyldig.", 400, cors);
        }
        await requireDemoAccessCode(env.DEMO_ACCESS_CODE ?? "", payload?.accessCode);
        const issued = await issueDemoSession(env.DEMO_SESSION_SECRET ?? "", role);
        return jsonResponse(
          {
            ok: true,
            token: issued.token,
            session: publicSession(issued.session),
          },
          200,
          cors,
        );
      }

      const session = await authenticateRequest(request, env, env.TIMESHEET_DB);
      if (request.method === "GET" && url.pathname === "/api/session") {
        return jsonResponse({ ok: true, session: publicSession(session) }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/admin-assistant") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await answerAdminAssistant(request, env, session, cors);
      }
      if (session.demo) {
        return demoResponse(request, url, session, cors);
      }

      if (request.method === "GET" && url.pathname === "/api/agreements") {
        requireRole(session, ["konsulent", "organisationsadministrator", "platformsadministrator"]);
        return await listAgreementCatalog(env, session, cors);
      }

      const calculationMatch = url.pathname.match(/^\/api\/timesheets\/([^/]+)\/calculations$/);
      if (request.method === "POST" && calculationMatch) {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        const body = (await readJson(request)) as { asOf?: unknown };
        if (typeof body.asOf !== "string") {
          throw new ApiError(
            "as_of_required",
            "Beregningen kræver et eksplicit asOf-tidspunkt.",
            400,
          );
        }
        const expectedVersion = expectedVersionFromIfMatch(request);
        const result = await calculateAndPersistTimesheet(
          env.TIMESHEET_DB,
          session,
          decodeURIComponent(calculationMatch[1]),
          expectedVersion,
          body.asOf,
        );
        return jsonResponse(
          {
            ok: true,
            rowVersion: result.rowVersion,
            exportBlocked: result.snapshot.exportBlocked,
            snapshot: result.snapshot,
          },
          201,
          { ...cors, etag: `"${result.rowVersion}"` },
        );
      }

      const latestCalculationMatch = url.pathname.match(
        /^\/api\/timesheets\/([^/]+)\/calculations\/latest$/,
      );
      if (request.method === "GET" && latestCalculationMatch) {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await latestCalculationSnapshot(
          env,
          session,
          decodeURIComponent(latestCalculationMatch[1]),
          cors,
        );
      }

      if (request.method === "POST" && url.pathname === "/api/timesheets") {
        return await upsertTimesheet(request, env, session, cors);
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets") {
        return await listTimesheets(env, session, cors, allTimesheetsQuery(session));
      }

      if (request.method === "GET" && url.pathname === "/api/gpt-timesheets") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await listGptTimesheets(env, session, cors);
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/pending") {
        requireRole(session, ["kontaktperson", "konsulent", "organisationsadministrator"]);
        return await listTimesheets(
          env,
          session,
          cors,
          pendingTimesheetsQuery(session, todayIso()),
        );
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/invoice-ready") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await listTimesheets(env, session, cors, invoiceReadyTimesheetsQuery(session));
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/payroll-ready") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await listTimesheets(
          env,
          session,
          cors,
          payrollReadyTimesheetsQuery(session, todayIso()),
        );
      }

      if (request.method === "GET" && url.pathname === "/api/timesheets/sick-leave") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await listTimesheets(env, session, cors, sickLeaveTimesheetsQuery(session));
      }

      if (request.method === "GET" && url.pathname === "/api/analytics") {
        requireRole(session, ["konsulent", "organisationsadministrator"]);
        return await analytics(env, session, cors);
      }

      return errorResponse("not_found", "Endpoint not found.", 404, cors);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(error.code, error.message, error.status, cors);
      }
      if (error instanceof ApiError) {
        return errorResponse(error.code, error.message, error.status, cors);
      }
      if (error instanceof AgreementCalculationError) {
        return errorResponse(error.code, error.message, error.status, cors);
      }
      return errorResponse("internal_error", "Unexpected API error.", 500, cors);
    }
  },
};

function privacyPolicyResponse(headOnly = false): Response {
  return new Response(headOnly ? null : PRIVACY_POLICY_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}

async function answerAdminAssistant(
  request: Request,
  env: Env,
  session: AuthSession,
  cors: HeadersInit,
): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(
      "assistant_not_configured",
      "Admin-assistenten er ikke konfigureret på serveren endnu.",
      503,
    );
  }

  const body = await readJson(request);
  const message = assistantMessage(body);
  const timesheets = session.demo
    ? assistantTimesheetsFromRequest(body)
    : await assistantTimesheetsFromDatabase(env, session);
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      store: false,
      max_output_tokens: 500,
      reasoning: { effort: "minimal" },
      instructions:
        "Du er Hour Craft Path's admin-assistent. Svar på dansk og kort. Brug kun det medsendte timeseddelgrundlag. Forklar status, timer, fravær og administrative næste skridt. Du må aldrig ændre, godkende, sende, arkivere eller slette data. Du må ikke fastsætte løn, moms, overenskomstsatser eller juridiske vurderinger; markér sådanne spørgsmål til manuel validering.",
      input: `Spørgsmål: ${message}\n\nTimeseddelgrundlag:\n${JSON.stringify(timesheets)}`,
    }),
  });

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    payload = {};
  }
  if (!upstream.ok) {
    throw new ApiError(
      "assistant_unavailable",
      "Admin-assistenten kunne ikke svare lige nu. Prøv igen senere.",
      502,
    );
  }
  const answer = responseOutputText(payload);
  if (!answer) {
    throw new ApiError(
      "assistant_invalid_response",
      "Admin-assistenten returnerede ikke et brugbart svar.",
      502,
    );
  }
  return jsonResponse({ ok: true, answer }, 200, cors);
}

function assistantMessage(body: unknown): string {
  const message = isPlainObject(body) ? body.message : undefined;
  if (typeof message !== "string" || !message.trim() || message.length > 1_200) {
    throw new ApiError("invalid_assistant_message", "Skriv et spørgsmål på højst 1.200 tegn.", 400);
  }
  return message.trim();
}

function assistantTimesheetsFromRequest(body: unknown): AdminAssistantTimesheet[] {
  const timesheets = isPlainObject(body) ? body.timesheets : undefined;
  if (!Array.isArray(timesheets) || timesheets.length > 24) {
    throw new ApiError(
      "invalid_assistant_context",
      "Assistenten kan højst modtage 24 timesedler.",
      400,
    );
  }
  return timesheets.map((timesheet) => assistantTimesheetFromUnknown(timesheet));
}

async function assistantTimesheetsFromDatabase(
  env: Env,
  session: AuthSession,
): Promise<AdminAssistantTimesheet[]> {
  const query = allTimesheetsQuery(session);
  const result = await env.TIMESHEET_DB.prepare(query.sql)
    .bind(...query.params)
    .all<TimesheetRow>();
  return (result.results ?? [])
    .map(parseStoredTimesheet)
    .filter((timesheet) => !timesheet.archived)
    .slice(0, 24)
    .map(toAdminAssistantTimesheet);
}

function assistantTimesheetFromUnknown(value: unknown): AdminAssistantTimesheet {
  if (!isPlainObject(value)) {
    throw new ApiError("invalid_assistant_context", "Timeseddelgrundlaget er ugyldigt.", 400);
  }
  return {
    id: assistantText(value.id, 160),
    worker: assistantText(value.worker, 160),
    company: assistantText(value.company, 160),
    project: assistantText(value.project, 160),
    weekStart: assistantText(value.weekStart, 32),
    status: assistantText(value.status, 32),
    totalHours: assistantNumber(value.totalHours),
    absence: assistantText(value.absence, 32),
    invoiceSent: value.invoiceSent === true,
    payrollSent: value.payrollSent === true,
  };
}

function toAdminAssistantTimesheet(timesheet: Timesheet): AdminAssistantTimesheet {
  return {
    id: timesheet.id,
    worker: timesheet.vikar ?? "Ukendt vikar",
    company: timesheet.brugervirksomhed ?? "Ukendt virksomhed",
    project: timesheet.projectName ?? "",
    weekStart: timesheet.weekStart ?? "",
    status: timesheet.status ?? "draft",
    totalHours: totalHours(timesheet.days),
    absence: hasSickLeave(timesheet.days) ? "registreret" : "ingen",
    invoiceSent: Boolean(timesheet.invoiceSentDate),
    payrollSent: Boolean(timesheet.payrollSentDate),
  };
}

function assistantText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function assistantNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : 0;
}

function responseOutputText(payload: unknown): string {
  if (!isPlainObject(payload) || !Array.isArray(payload.output)) return "";
  return payload.output
    .flatMap((item) => (isPlainObject(item) && Array.isArray(item.content) ? item.content : []))
    .map((part) => (isPlainObject(part) && part.type === "output_text" ? part.text : ""))
    .filter((text): text is string => typeof text === "string")
    .join("\n")
    .trim()
    .slice(0, 8_000);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function publicSession(session: AuthSession): Record<string, unknown> {
  return {
    userId: session.userId,
    organizationId: session.organizationId,
    membershipId: session.membershipId,
    role: session.role,
    expiresAt: session.expiresAt,
    demo: session.demo,
  };
}

function demoResponse(
  request: Request,
  url: URL,
  session: AuthSession,
  cors: HeadersInit,
): Response {
  if (request.method !== "GET") {
    return errorResponse(
      "demo_read_only",
      "Demoorganisationen er isoleret og skrivebeskyttet.",
      403,
      cors,
    );
  }
  if (url.pathname === "/api/session") {
    return jsonResponse({ ok: true, session: publicSession(session) }, 200, cors);
  }
  if (url.pathname === "/api/analytics") {
    requireRole(session, ["konsulent", "organisationsadministrator"]);
    return jsonResponse(
      {
        ok: true,
        source: "synthetic-demo",
        generatedAt: new Date().toISOString(),
        analytics: {
          totalTimesheets: 0,
          totalHours: 0,
          sickLeaveTimesheets: 0,
          pendingTimesheets: 0,
          invoiceReadyTimesheets: 0,
          payrollReadyTimesheets: 0,
          invoiceOverview: { soon: 0, now: 0, waiting: 0, done: 0 },
          payrollOverview: { soon: 0, now: 0, waiting: 0, done: 0 },
          statusCounts: [],
        },
      },
      200,
      cors,
    );
  }
  if (url.pathname === "/api/agreements") {
    requireRole(session, ["konsulent", "organisationsadministrator", "platformsadministrator"]);
    return jsonResponse(
      {
        ok: true,
        source: "synthetic-demo",
        count: 0,
        agreements: [],
      },
      200,
      cors,
    );
  }
  if (
    url.pathname === "/api/timesheets" ||
    url.pathname === "/api/timesheets/pending" ||
    url.pathname === "/api/timesheets/invoice-ready" ||
    url.pathname === "/api/timesheets/payroll-ready" ||
    url.pathname === "/api/timesheets/sick-leave" ||
    url.pathname === "/api/gpt-timesheets"
  ) {
    if (url.pathname === "/api/gpt-timesheets") {
      requireRole(session, ["konsulent", "organisationsadministrator"]);
    }
    return jsonResponse(
      {
        ok: true,
        source: "synthetic-demo",
        list: "demo",
        count: 0,
        timesheets: [],
      },
      200,
      cors,
    );
  }
  return errorResponse("not_found", "Endpoint not found.", 404, cors);
}

async function listAgreementCatalog(
  env: Env,
  session: AuthSession,
  cors: HeadersInit,
): Promise<Response> {
  const result = await env.TIMESHEET_DB.prepare(
    `SELECT
       agreement.id,
       agreement.catalog_key,
       agreement.exact_title,
       agreement.agreement_parties,
       agreement.employer_organization,
       agreement.covered_work_areas,
       agreement.employee_category,
       agreement.geography_scope,
       agreement.catalog_status,
       version.id AS version_id,
       version.version_label,
       version.valid_from,
       version.valid_to,
       version.implementation_status,
       version.verification_status,
       source.id AS source_id,
       source.source_type,
       source.document_title AS source_title,
       source.official_url,
       source.verification_status AS source_verification_status,
       (
         SELECT COUNT(*)
         FROM agreement_assignments AS assignment
         INNER JOIN local_overrides AS local_override
           ON local_override.organization_id = assignment.organization_id
          AND local_override.agreement_assignment_id = assignment.id
          AND local_override.status = 'approved'
         WHERE assignment.organization_id = ?
           AND assignment.agreement_version_id = version.id
       ) AS approved_override_count
     FROM agreements AS agreement
     LEFT JOIN agreement_versions AS version
       ON version.agreement_id = agreement.id
     LEFT JOIN agreement_sources AS source
       ON source.agreement_version_id = version.id
     ORDER BY agreement.exact_title, version.valid_from, source.source_type, source.id`,
  )
    .bind(session.organizationId)
    .all<AgreementCatalogRow>();
  const rows = result.results ?? [];
  const agreements = new Map<
    string,
    {
      id: string;
      catalogKey: string;
      exactTitle: string;
      agreementParties: string;
      employerOrganization: string;
      coveredWorkAreas: string;
      employeeCategory: string;
      geographyScope: string;
      catalogStatus: string;
      versions: Array<{
        id: string;
        versionLabel: string;
        validFrom: string;
        validTo: string | null;
        implementationStatus: string;
        verificationStatus: string;
        approvedOverrideCount: number;
        sources: Array<{
          id: string;
          sourceType: string;
          documentTitle: string;
          officialUrl: string;
          verificationStatus: string;
        }>;
      }>;
    }
  >();

  for (const row of rows) {
    let agreement = agreements.get(row.id);
    if (!agreement) {
      agreement = {
        id: row.id,
        catalogKey: row.catalog_key,
        exactTitle: row.exact_title,
        agreementParties: row.agreement_parties,
        employerOrganization: row.employer_organization,
        coveredWorkAreas: row.covered_work_areas,
        employeeCategory: row.employee_category,
        geographyScope: row.geography_scope,
        catalogStatus: row.catalog_status,
        versions: [],
      };
      agreements.set(row.id, agreement);
    }
    if (!row.version_id) continue;
    let version = agreement.versions.find((entry) => entry.id === row.version_id);
    if (!version) {
      version = {
        id: row.version_id,
        versionLabel: row.version_label ?? "",
        validFrom: row.valid_from ?? "",
        validTo: row.valid_to,
        implementationStatus: row.implementation_status ?? "not_implemented",
        verificationStatus: row.verification_status ?? "manual_review_required",
        approvedOverrideCount: Number(row.approved_override_count || 0),
        sources: [],
      };
      agreement.versions.push(version);
    }
    if (row.source_id) {
      version.sources.push({
        id: row.source_id,
        sourceType: row.source_type ?? "",
        documentTitle: row.source_title ?? "",
        officialUrl: row.official_url ?? "",
        verificationStatus: row.source_verification_status ?? "manual_review_required",
      });
    }
  }

  return jsonResponse(
    {
      ok: true,
      source: "d1",
      count: agreements.size,
      agreements: [...agreements.values()],
    },
    200,
    cors,
  );
}

async function latestCalculationSnapshot(
  env: Env,
  session: AuthSession,
  timesheetId: string,
  cors: HeadersInit,
): Promise<Response> {
  const row = await env.TIMESHEET_DB.prepare(
    `SELECT
       snapshot.id AS calculation_id,
       snapshot.status,
       snapshot.gross_pay_cents,
       snapshot.result_sha256,
       snapshot.result_snapshot_json,
       snapshot.manual_review_reasons_json
     FROM timesheets AS timesheet
     INNER JOIN calculation_snapshots AS snapshot
       ON snapshot.id = timesheet.last_calculation_snapshot_id
      AND snapshot.organization_id = timesheet.organization_id
      AND snapshot.timesheet_id = timesheet.id
     WHERE timesheet.id = ?
       AND timesheet.organization_id = ?
       AND timesheet.tenant_migration_status IN ('assigned', 'verified_demo')
     LIMIT 1`,
  )
    .bind(timesheetId, session.organizationId)
    .first<CalculationSnapshotRow>();
  if (!row) {
    return errorResponse(
      "calculation_snapshot_not_found",
      "Timesedlen har ikke et aktuelt serverberegnet snapshot.",
      404,
      cors,
    );
  }

  let storedResult: Record<string, unknown>;
  let manualReviewReasons: string[];
  try {
    const parsedResult = JSON.parse(row.result_snapshot_json) as unknown;
    const parsedReasons = JSON.parse(row.manual_review_reasons_json) as unknown;
    if (
      typeof parsedResult !== "object" ||
      parsedResult === null ||
      !Array.isArray(parsedReasons) ||
      !parsedReasons.every((reason) => typeof reason === "string")
    ) {
      throw new Error("invalid snapshot JSON");
    }
    storedResult = parsedResult as Record<string, unknown>;
    manualReviewReasons = parsedReasons;
  } catch {
    throw new ApiError(
      "invalid_calculation_snapshot",
      "Det serverlagrede beregningssnapshot er ugyldigt.",
      500,
    );
  }

  const invoiceTotalOre =
    typeof storedResult.invoiceTotalOre === "number" &&
    Number.isSafeInteger(storedResult.invoiceTotalOre) &&
    storedResult.invoiceTotalOre >= 0
      ? storedResult.invoiceTotalOre
      : null;
  const exportBlocked =
    row.status !== "completed" ||
    storedResult.exportBlocked !== false ||
    manualReviewReasons.length > 0 ||
    !/^[a-f0-9]{64}$/iu.test(row.result_sha256);

  return jsonResponse(
    {
      ok: true,
      source: "d1",
      snapshot: {
        source: "d1",
        calculationId: row.calculation_id,
        status: row.status,
        exportBlocked,
        manualReviewReasons,
        resultHash: row.result_sha256,
        grossPayOre: row.gross_pay_cents,
        invoiceTotalOre,
      },
    },
    200,
    cors,
  );
}

async function upsertTimesheet(
  request: Request,
  env: Env,
  session: AuthSession,
  cors: HeadersInit,
): Promise<Response> {
  requireRole(session, ["vikar", "kontaktperson", "konsulent", "organisationsadministrator"]);
  const payload = await readJson(request);
  const incoming = unwrapTimesheetPayload(payload);
  const validationError = validateTimesheet(incoming);
  if (validationError) {
    throw new ApiError(validationError.code, validationError.message, validationError.status);
  }

  const existing = await env.TIMESHEET_DB.prepare(
    `${timesheetSelectSql()}
     WHERE timesheet.id = ?
       AND timesheet.organization_id = ?
       AND timesheet.tenant_migration_status IN ('assigned', 'verified_demo')
     LIMIT 1`,
  )
    .bind(incoming.id, session.organizationId)
    .first<TimesheetRow>();

  if (existing && !(await canAccessTimesheet(env, session, existing, "submit"))) {
    throw new ApiError("not_found", "Timesedlen blev ikke fundet.", 404);
  }
  if (!existing && !isAdministrativeRole(session.role)) {
    throw new ApiError(
      "forbidden",
      "Kun konsulent eller organisationsadministrator kan oprette en timeseddel.",
      403,
    );
  }

  assertConcurrencyHeaders(request, existing?.row_version);
  const before = existing ? parseStoredTimesheet(existing) : undefined;
  const candidate = applyAllowedMutation(before, incoming, session);
  const normalized = normalizeTimesheet(sanitizeSensitiveTimesheet(candidate));
  await validateNormalizedReferences(env, session, normalized, existing);
  const row = toTimesheetDbRow(normalized);
  const correlationId = request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

  let nextVersion = 1;
  if (!existing) {
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
        data,
        organization_id,
        company_record_id,
        project_record_id,
        worker_record_id,
        employment_term_id,
        agreement_assignment_id,
        owner_membership_id,
        tenant_migration_status,
        row_version,
        data_schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', 1, 2)`,
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
        session.organizationId,
        normalized.companyRecordId,
        normalized.projectRecordId,
        normalized.workerRecordId,
        normalized.employmentTermId,
        normalized.agreementAssignmentId,
        session.membershipId,
      )
      .run();
  } else {
    nextVersion = existing.row_version + 1;
    const result = await env.TIMESHEET_DB.prepare(
      `UPDATE timesheets
       SET status = ?,
           owner_role = ?,
           week_start = ?,
           project_end_date = ?,
           company_id = ?,
           project_id = ?,
           brugervirksomhed = ?,
           worker_code = ?,
           has_sick_leave = ?,
           total_hours = ?,
           invoice_sent_date = ?,
           payroll_sent_date = ?,
           updated_at = ?,
           data = ?,
           company_record_id = ?,
           project_record_id = ?,
           worker_record_id = ?,
           employment_term_id = ?,
           agreement_assignment_id = ?,
           row_version = row_version + 1,
           data_schema_version = 2
       WHERE id = ?
         AND organization_id = ?
         AND row_version = ?`,
    )
      .bind(
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
        row.updatedAt,
        row.data,
        normalized.companyRecordId,
        normalized.projectRecordId,
        normalized.workerRecordId,
        normalized.employmentTermId,
        normalized.agreementAssignmentId,
        row.id,
        session.organizationId,
        existing.row_version,
      )
      .run();
    if ((result.meta.changes ?? 0) !== 1) {
      throw new ApiError(
        "version_conflict",
        "Timesedlen er ændret af en anden. Hent den nyeste version og prøv igen.",
        409,
      );
    }
  }

  await appendAuditEvent(env, session, {
    action: existing ? "timesheet.updated" : "timesheet.created",
    objectId: row.id,
    correlationId,
    requestId: request.headers.get("cf-ray") ?? undefined,
    before: before ? auditSummary(before, existing?.row_version ?? 1) : undefined,
    after: auditSummary(normalized, nextVersion),
  });

  return jsonResponse(
    {
      ok: true,
      version: nextVersion,
      etag: `"${nextVersion}"`,
      timesheet: sanitizeTimesheetForSession(normalized, session),
    },
    existing ? 200 : 201,
    { ...cors, etag: `"${nextVersion}"` },
  );
}

async function listTimesheets(
  env: Env,
  session: AuthSession,
  cors: HeadersInit,
  query: TimesheetQuery,
): Promise<Response> {
  const result = await env.TIMESHEET_DB.prepare(query.sql)
    .bind(...query.params)
    .all<TimesheetRow>();
  const timesheets = (result.results ?? []).map((row) => ({
    ...sanitizeTimesheetForSession(parseStoredTimesheet(row), session),
    rowVersion: row.row_version,
  }));
  return jsonResponse(
    { ok: true, source: "d1", list: query.label, count: timesheets.length, timesheets },
    200,
    cors,
  );
}

async function listGptTimesheets(
  env: Env,
  session: AuthSession,
  cors: HeadersInit,
): Promise<Response> {
  const query = allTimesheetsQuery(session);
  const result = await env.TIMESHEET_DB.prepare(query.sql)
    .bind(...query.params)
    .all<TimesheetRow>();
  const timesheets = (result.results ?? [])
    .map(parseStoredTimesheet)
    .map(sanitizeSensitiveTimesheet)
    .map(toGptTimesheet);
  return jsonResponse(
    { ok: true, source: "d1", list: "gpt-compact", count: timesheets.length, timesheets },
    200,
    cors,
  );
}

function timesheetSelectSql(): string {
  return `SELECT
    timesheet.id,
    timesheet.organization_id,
    timesheet.company_record_id,
    timesheet.project_record_id,
    timesheet.worker_record_id,
    timesheet.employment_term_id,
    timesheet.agreement_assignment_id,
    timesheet.owner_membership_id,
    timesheet.row_version,
    timesheet.status,
    timesheet.data
  FROM timesheets AS timesheet`;
}

function isAdministrativeRole(role: MembershipRole): boolean {
  return role === "konsulent" || role === "organisationsadministrator";
}

function assertConcurrencyHeaders(request: Request, existingVersion?: number): void {
  if (existingVersion === undefined) {
    if (request.headers.get("if-none-match") !== "*") {
      throw new ApiError("precondition_required", "Nye timesedler kræver If-None-Match: *.", 428);
    }
    return;
  }
  const expectedVersion = expectedVersionFromIfMatch(request);
  if (expectedVersion !== existingVersion) {
    throw new ApiError(
      "version_conflict",
      "Timesedlen er ændret af en anden. Hent den nyeste version og prøv igen.",
      409,
    );
  }
}

function expectedVersionFromIfMatch(request: Request): number {
  const match = request.headers
    .get("if-match")
    ?.trim()
    .match(/^(?:W\/)?"?(\d+)"?$/);
  if (!match) {
    throw new ApiError(
      "precondition_required",
      "Opdateringer kræver If-Match med den senest læste version.",
      428,
    );
  }
  return Number(match[1]);
}

function parseStoredTimesheet(row: TimesheetRow): Timesheet {
  try {
    const parsed = JSON.parse(row.data) as Timesheet;
    return {
      ...sanitizeSensitiveTimesheet(parsed),
      id: row.id,
      companyRecordId: row.company_record_id,
      projectRecordId: row.project_record_id,
      workerRecordId: row.worker_record_id,
      employmentTermId: row.employment_term_id,
      agreementAssignmentId: row.agreement_assignment_id,
      status: row.status,
    };
  } catch {
    throw new ApiError(
      "stored_timesheet_invalid",
      "Den lagrede timeseddel kan ikke læses og kræver manuel gennemgang.",
      500,
    );
  }
}

async function canAccessTimesheet(
  env: Env,
  session: AuthSession,
  row: TimesheetRow,
  operation: "view" | "submit",
): Promise<boolean> {
  if (isAdministrativeRole(session.role)) return true;
  if (session.role === "vikar") {
    const worker = await env.TIMESHEET_DB.prepare(
      `SELECT id
       FROM workers
       WHERE id = ?
         AND organization_id = ?
         AND membership_id = ?
         AND status = 'active'
       LIMIT 1`,
    )
      .bind(row.worker_record_id, session.organizationId, session.membershipId)
      .first<{ id: string }>();
    return Boolean(worker);
  }
  if (session.role === "kontaktperson") {
    const allowedLevels =
      operation === "submit" ? ["approve", "manage"] : ["view", "approve", "manage"];
    const placeholders = allowedLevels.map(() => "?").join(", ");
    const access = await env.TIMESHEET_DB.prepare(
      `SELECT project_id
       FROM project_membership_access
       WHERE organization_id = ?
         AND project_id = ?
         AND membership_id = ?
         AND revoked_at IS NULL
         AND access_level IN (${placeholders})
       LIMIT 1`,
    )
      .bind(session.organizationId, row.project_record_id, session.membershipId, ...allowedLevels)
      .first<{ project_id: string }>();
    return Boolean(access);
  }
  return false;
}

function applyAllowedMutation(
  before: Timesheet | undefined,
  incoming: Timesheet,
  session: AuthSession,
): Timesheet {
  if (isAdministrativeRole(session.role)) {
    if (before?.status === "approved") {
      throw new ApiError(
        "approved_timesheet_immutable",
        "En godkendt timeseddel må ikke overskrives. Opret en auditeret korrektion.",
        409,
      );
    }
    return {
      ...(before ?? {}),
      ...incoming,
      id: incoming.id,
      createdAt: before?.createdAt ?? incoming.createdAt,
    };
  }
  if (!before) {
    throw new ApiError("not_found", "Timesedlen blev ikke fundet.", 404);
  }
  if (session.role === "vikar") {
    const nextStatus = incoming.status ?? before.status ?? "draft";
    if (nextStatus !== "draft" && nextStatus !== "sent") {
      throw new ApiError(
        "invalid_status_transition",
        "Vikaren kan kun gemme kladde eller indsende timesedlen.",
        409,
      );
    }
    if (before.status !== "draft" && before.status !== "rejected") {
      throw new ApiError(
        "timesheet_locked",
        "Timesedlen kan ikke ændres i den aktuelle status.",
        409,
      );
    }
    return {
      ...before,
      days: sanitizeWorkerDays(incoming.days),
      notes: typeof incoming.notes === "string" ? incoming.notes.slice(0, 2000) : before.notes,
      status: nextStatus,
      rejectionComment: nextStatus === "sent" ? undefined : before.rejectionComment,
    };
  }
  if (session.role === "kontaktperson") {
    if (before.status !== "sent") {
      throw new ApiError(
        "timesheet_locked",
        "Kun en indsendt timeseddel kan godkendes eller afvises.",
        409,
      );
    }
    if (incoming.status !== "approved" && incoming.status !== "rejected") {
      throw new ApiError(
        "invalid_status_transition",
        "Kontaktpersonen kan kun godkende eller afvise timesedlen.",
        409,
      );
    }
    return {
      ...before,
      status: incoming.status,
      rejectionComment:
        incoming.status === "rejected" && typeof incoming.rejectionComment === "string"
          ? incoming.rejectionComment.slice(0, 2000)
          : undefined,
    };
  }
  throw new ApiError("forbidden", "Rollen kan ikke ændre timesedlen.", 403);
}

function sanitizeWorkerDays(days: DayEntry[] | undefined): DayEntry[] {
  if (!Array.isArray(days)) return [];
  return days.slice(0, 14).map((day) => ({
    start: typeof day?.start === "string" ? day.start : undefined,
    end: typeof day?.end === "string" ? day.end : undefined,
    pause: Number.isInteger(day?.pause) ? Math.max(0, Number(day.pause)) : undefined,
    pauseStart: typeof day?.pauseStart === "string" ? day.pauseStart : undefined,
    pauseEnd: typeof day?.pauseEnd === "string" ? day.pauseEnd : undefined,
    pause2Start: typeof day?.pause2Start === "string" ? day.pause2Start : undefined,
    pause2End: typeof day?.pause2End === "string" ? day.pause2End : undefined,
    absence:
      day?.absence === "sick" ||
      day?.absence === "vacation" ||
      day?.absence === "dayoff" ||
      day?.absence === "none"
        ? day.absence
        : "none",
  }));
}

const FORBIDDEN_STORED_KEYS = new Set([
  "vikarcpr",
  "cpr",
  "personnummer",
  "contactpersonaccesscode",
  "workeraccesscode",
  "accesscode",
  "password",
  "passwordhash",
  "secret",
  "token",
  "organizationid",
  "ownermembershipid",
  "approvedbymembershipid",
  "tenantmigrationstatus",
  "rowversion",
  "hourlywage",
  "selectedagreementid",
  "overenskomst",
  "localagreementapplies",
  "lokalaftale",
  "localagreementid",
]);

function sanitizeSensitiveTimesheet(value: Timesheet): Timesheet {
  return sanitizeObject(value) as Timesheet;
}

function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== "object") return value;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_STORED_KEYS.has(normalizedKey)) continue;
    clean[key] = sanitizeObject(child);
  }
  return clean;
}

function sanitizeTimesheetForSession(
  value: Timesheet,
  session: AuthSession,
): Record<string, unknown> {
  const clean = sanitizeSensitiveTimesheet(value) as Record<string, unknown>;
  if (session.role === "kontaktperson") {
    delete clean.vikarEmail;
    delete clean.vikarPhone;
    delete clean.vikarAddress;
  }
  if (session.role === "vikar") {
    delete clean.kontaktpersonEmail;
    delete clean.kontaktpersonPhone;
  }
  return clean;
}

async function validateNormalizedReferences(
  env: Env,
  session: AuthSession,
  timesheet: Timesheet,
  existing: TimesheetRow | null,
): Promise<void> {
  const companyId = timesheet.companyRecordId || existing?.company_record_id;
  const projectId = timesheet.projectRecordId || existing?.project_record_id;
  const workerId = timesheet.workerRecordId || existing?.worker_record_id;
  const employmentTermId = timesheet.employmentTermId;
  const assignmentId = timesheet.agreementAssignmentId;
  if (
    !isNonEmptyString(companyId) ||
    !isNonEmptyString(projectId) ||
    !isNonEmptyString(workerId) ||
    !isNonEmptyString(employmentTermId) ||
    !isNonEmptyString(assignmentId) ||
    !isStrictWorkDate(timesheet.weekStart ?? "")
  ) {
    throw new ApiError(
      "authoritative_references_required",
      "Virksomhed, projekt, vikar, ansættelsesvilkår, aftaletildeling og uge skal være serverregistrerede.",
      409,
    );
  }

  const relation = await env.TIMESHEET_DB.prepare(
    `SELECT assignment.id
     FROM projects AS project
     INNER JOIN companies AS company
       ON company.organization_id = project.organization_id
      AND company.id = project.company_id
      AND company.status = 'active'
     INNER JOIN workers AS worker
       ON worker.organization_id = project.organization_id
      AND worker.id = ?
      AND worker.status = 'active'
     INNER JOIN employment_terms AS employment
       ON employment.organization_id = project.organization_id
      AND employment.id = ?
      AND employment.worker_id = worker.id
      AND employment.company_id = company.id
      AND (employment.project_id IS NULL OR employment.project_id = project.id)
      AND employment.status = 'active'
      AND employment.valid_from <= ?
      AND (employment.valid_to IS NULL OR employment.valid_to >= ?)
     INNER JOIN agreement_assignments AS assignment
       ON assignment.organization_id = project.organization_id
      AND assignment.id = ?
      AND assignment.status = 'active'
      AND assignment.valid_from <= ?
      AND (assignment.valid_to IS NULL OR assignment.valid_to >= ?)
      AND (
        assignment.scope_type = 'organization'
        OR (assignment.scope_type = 'company' AND assignment.company_id = company.id)
        OR (assignment.scope_type = 'project' AND assignment.project_id = project.id)
        OR (assignment.scope_type = 'worker' AND assignment.worker_id = worker.id)
        OR (
          assignment.scope_type = 'employment_term'
          AND assignment.employment_term_id = employment.id
        )
        OR (
          assignment.scope_type = 'workplace'
          AND assignment.workplace_id = project.workplace_id
        )
      )
     WHERE project.organization_id = ?
       AND project.id = ?
       AND project.company_id = ?
       AND project.status = 'active'
     LIMIT 1`,
  )
    .bind(
      workerId,
      employmentTermId,
      timesheet.weekStart,
      timesheet.weekStart,
      assignmentId,
      timesheet.weekStart,
      timesheet.weekStart,
      session.organizationId,
      projectId,
      companyId,
    )
    .first<{ id: string }>();
  if (!relation) {
    throw new ApiError(
      "authoritative_relationship_invalid",
      "Timesedlens serverregistrerede relationer eller aktive aftaletildeling er ugyldige.",
      409,
    );
  }
  timesheet.companyRecordId = companyId;
  timesheet.projectRecordId = projectId;
  timesheet.workerRecordId = workerId;
}

async function appendAuditEvent(
  env: Env,
  session: AuthSession,
  event: {
    action: string;
    objectId: string;
    correlationId: string;
    requestId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  },
): Promise<void> {
  const result = await env.TIMESHEET_DB.prepare(
    `INSERT INTO audit_events (
      id,
      organization_id,
      actor_type,
      actor_identity_id,
      actor_membership_id,
      action,
      object_type,
      object_id,
      correlation_id,
      request_id,
      before_values_json,
      after_values_json,
      reason
    ) VALUES (?, ?, 'identity', ?, ?, ?, 'timesheet', ?, ?, ?, ?, ?, '')`,
  )
    .bind(
      crypto.randomUUID(),
      session.organizationId,
      session.userId,
      session.membershipId,
      event.action,
      event.objectId,
      event.correlationId,
      event.requestId ?? null,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
    )
    .run();
  if (!result.success || (result.meta.changes ?? 0) !== 1) {
    throw new ApiError(
      "audit_write_failed",
      "Handlingen blev blokeret, fordi revisionssporet ikke kunne gemmes.",
      503,
    );
  }
}

function auditSummary(timesheet: Timesheet, rowVersion: number): Record<string, unknown> {
  return {
    id: timesheet.id,
    status: timesheet.status,
    weekStart: timesheet.weekStart,
    companyRecordId: timesheet.companyRecordId,
    projectRecordId: timesheet.projectRecordId,
    workerRecordId: timesheet.workerRecordId,
    employmentTermId: timesheet.employmentTermId,
    agreementAssignmentId: timesheet.agreementAssignmentId,
    rowVersion,
    totalMinutes: totalMinutes(timesheet.days),
  };
}

function toGptTimesheet(timesheet: Timesheet): Record<string, unknown> {
  const registeredMinutes = totalMinutes(timesheet.days);

  return compactRecord({
    id: timesheet.id,
    ownerRole: timesheet.ownerRole,
    vikar: timesheet.vikar,
    vikarCode: timesheet.vikarCode,
    workerLanguage: (timesheet as Record<string, unknown>).workerLanguage,
    tradeSkills: (timesheet as Record<string, unknown>).tradeSkills,
    competencies: (timesheet as Record<string, unknown>).competencies,
    brugervirksomhed: timesheet.brugervirksomhed,
    companyId: timesheet.companyId,
    projectId: timesheet.projectId,
    projectName: timesheet.projectName,
    projectEndDate: timesheet.projectEndDate,
    kontaktperson: timesheet.kontaktperson,
    referenceNo: timesheet.referenceNo,
    arbejdssted: timesheet.arbejdssted,
    selectedAgreementId: timesheet.selectedAgreementId,
    overenskomst: timesheet.overenskomst,
    hourlyWage: timesheet.hourlyWage,
    localAgreementApplies: (timesheet as Record<string, unknown>).localAgreementApplies,
    lokalaftale: (timesheet as Record<string, unknown>).lokalaftale,
    localAgreementId: (timesheet as Record<string, unknown>).localAgreementId,
    weekStart: timesheet.weekStart,
    totalHours: round(registeredMinutes / 60),
    totalMinutes: registeredMinutes,
    registeredTime: formatRegisteredTime(registeredMinutes),
    days: (timesheet.days ?? []).map(toGptDay),
    notes: timesheet.notes,
    status: timesheet.status,
    archived: timesheet.archived,
    workerInactive: (timesheet as Record<string, unknown>).workerInactive,
    workerConsentInactive: (timesheet as Record<string, unknown>).workerConsentInactive,
    invoiceDueDate: (timesheet as Record<string, unknown>).invoiceDueDate,
    payrollDeadline: (timesheet as Record<string, unknown>).payrollDeadline,
    invoiceNumber: (timesheet as Record<string, unknown>).invoiceNumber,
    invoiceSentDate: timesheet.invoiceSentDate,
    payrollSentDate: timesheet.payrollSentDate,
    rejectionComment: timesheet.rejectionComment,
    createdAt: timesheet.createdAt,
    updatedAt: timesheet.updatedAt,
  });
}

function toGptDay(day: DayEntry): Record<string, unknown> {
  const source = day as Record<string, unknown>;
  const registeredMinutes = dayMinutes(day);

  return compactRecord({
    start: day.start,
    end: day.end,
    pause: day.pause,
    pauseStart: day.pauseStart,
    pauseEnd: day.pauseEnd,
    pause2Start: day.pause2Start,
    pause2End: day.pause2End,
    absence: day.absence,
    registeredHours: round(registeredMinutes / 60),
    registeredMinutes,
    registeredTime: formatRegisteredTime(registeredMinutes),
    taskType: source.taskType,
    comment: source.comment,
    shiftWork: source.shiftWork,
  });
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

async function analytics(env: Env, session: AuthSession, cors: HeadersInit): Promise<Response> {
  const query = allTimesheetsQuery(session);
  const result = await env.TIMESHEET_DB.prepare(query.sql)
    .bind(...query.params)
    .all<TimesheetRow>();
  const today = todayIso();
  const timesheets = (result.results ?? [])
    .map(parseStoredTimesheet)
    .filter((timesheet) => timesheet.archived !== true);
  const statusRows = statusCounts(timesheets);
  const invoiceOverview = buildInvoiceOverview(timesheets);
  const payrollOverview = buildPayrollOverview(timesheets);

  return jsonResponse(
    {
      ok: true,
      source: "d1",
      generatedAt: new Date().toISOString(),
      analytics: {
        totalTimesheets: timesheets.length,
        totalHours: round(
          timesheets.reduce((sum, timesheet) => sum + totalHours(timesheet.days), 0),
        ),
        sickLeaveTimesheets: timesheets.filter((timesheet) => hasSickLeave(timesheet.days)).length,
        pendingTimesheets: timesheets.filter((timesheet) => isPendingApproval(timesheet, today))
          .length,
        invoiceReadyTimesheets:
          invoiceOverview.now + invoiceOverview.soon + invoiceOverview.waiting,
        payrollReadyTimesheets: payrollOverview.now,
        invoiceOverview,
        payrollOverview,
        statusCounts: statusRows,
      },
    },
    200,
    cors,
  );
}

function statusCounts(timesheets: Timesheet[]): AnalyticsStatusRow[] {
  const counts = new Map<Status, AnalyticsStatusRow>();
  for (const timesheet of timesheets) {
    const status = timesheet.status ?? "draft";
    const existing = counts.get(status) ?? { status, count: 0, totalHours: 0 };
    existing.count += 1;
    existing.totalHours = round(existing.totalHours + totalHours(timesheet.days));
    counts.set(status, existing);
  }
  return [...counts.values()].sort((a, b) => a.status.localeCompare(b.status));
}

function buildInvoiceOverview(timesheets: Timesheet[]) {
  const overview = { soon: 0, now: 0, waiting: 0, done: 0 };
  for (const timesheet of timesheets) {
    if (
      timesheet.invoiceSentDate ||
      hasDoneStatus(timesheet, ["invoiceStatus", "invoiceState", "billingStatus"])
    ) {
      overview.done += 1;
      continue;
    }

    if (timesheet.status !== "approved" || totalHours(timesheet.days) <= 0) continue;

    const tone = deadlineTone(invoiceDueDateForTimesheet(timesheet.weekStart ?? ""));
    overview[tone] += 1;
  }
  return overview;
}

function buildPayrollOverview(timesheets: Timesheet[]) {
  const overview = { soon: 0, now: 0, waiting: 0, done: 0 };
  for (const timesheet of timesheets) {
    if (
      timesheet.payrollSentDate ||
      hasDoneStatus(timesheet, ["payrollStatus", "payrollState", "bookkeepingStatus"])
    ) {
      overview.done += 1;
      continue;
    }

    if (
      (timesheet.status !== "sent" && timesheet.status !== "approved") ||
      totalHours(timesheet.days) <= 0
    ) {
      continue;
    }

    const period = payrollPeriodForWeek(timesheet.weekStart ?? "");
    if (payrollReady(timesheet, period.end)) overview.now += 1;
    else overview.soon += 1;
  }
  return overview;
}

function hasDoneStatus(timesheet: Timesheet, fields: string[]): boolean {
  const record = timesheet as unknown as Record<string, unknown>;
  return fields.some((field) => {
    const value = record[field];
    return (
      value === "sent" || value === "done" || value === "completed" || value === "bookkeeping_sent"
    );
  });
}

function isPendingApproval(timesheet: Timesheet, today: string): boolean {
  return timesheet.status === "sent" && effectiveProjectEndDate(timesheet) < today;
}

function effectiveProjectEndDate(timesheet: Timesheet): string {
  return isNonEmptyString(timesheet.projectEndDate)
    ? timesheet.projectEndDate
    : addDaysToISODate(timesheet.weekStart ?? "", 6);
}

function invoiceDueDateForTimesheet(weekStart: string): string {
  return addDaysToISODate(addDaysToISODate(weekStart, 8), 8);
}

function deadlineTone(deadline: string): "waiting" | "soon" | "now" {
  const days = calendarDaysUntil(deadline);
  if (days <= 0) return "now";
  if (days <= 3) return "soon";
  return "waiting";
}

function calendarDaysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function payrollPeriodForWeek(weekStart: string): { start: string; end: string } {
  const monday = new Date(`${weekStart}T12:00:00`);
  const oneJan = new Date(`${monday.getFullYear()}-01-01T12:00:00`);
  const week = Math.ceil(
    ((monday.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
  );
  const start = addDaysToISODate(weekStart, week % 2 === 0 ? -7 : 0);
  return { start, end: addDaysToISODate(start, 13) };
}

function payrollReady(timesheet: Timesheet, periodEnd: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${periodEnd}T12:00:00`);
  if (end.getTime() >= today.getTime()) return false;

  if (timesheet.status === "approved") return true;
  const autoApprovalDate = new Date(`${addDaysToISODate(periodEnd, 2)}T12:00:00`);
  return timesheet.status === "sent" && autoApprovalDate.getTime() <= today.getTime();
}

function addDaysToISODate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function timesheetScope(session: AuthSession): { sql: string; params: unknown[] } {
  const base = `timesheet.organization_id = ?
    AND timesheet.tenant_migration_status IN ('assigned', 'verified_demo')`;
  if (isAdministrativeRole(session.role)) {
    return { sql: base, params: [session.organizationId] };
  }
  if (session.role === "vikar") {
    return {
      sql: `${base}
        AND EXISTS (
          SELECT 1
          FROM workers AS scoped_worker
          WHERE scoped_worker.organization_id = timesheet.organization_id
            AND scoped_worker.id = timesheet.worker_record_id
            AND scoped_worker.membership_id = ?
            AND scoped_worker.status = 'active'
        )`,
      params: [session.organizationId, session.membershipId],
    };
  }
  if (session.role === "kontaktperson") {
    return {
      sql: `${base}
        AND EXISTS (
          SELECT 1
          FROM project_membership_access AS scoped_access
          WHERE scoped_access.organization_id = timesheet.organization_id
            AND scoped_access.project_id = timesheet.project_record_id
            AND scoped_access.membership_id = ?
            AND scoped_access.revoked_at IS NULL
            AND scoped_access.access_level IN ('view', 'approve', 'manage')
        )`,
      params: [session.organizationId, session.membershipId],
    };
  }
  return { sql: "1 = 0", params: [] };
}

function allTimesheetsQuery(session: AuthSession): TimesheetQuery {
  const scope = timesheetScope(session);
  return {
    sql: `${timesheetSelectSql()}
      WHERE ${scope.sql}
      ORDER BY timesheet.week_start DESC, timesheet.updated_at DESC`,
    params: scope.params,
    label: "all",
  };
}

function pendingTimesheetsQuery(session: AuthSession, today: string): TimesheetQuery {
  const scope = timesheetScope(session);
  return {
    sql: `${timesheetSelectSql()}
      WHERE ${scope.sql}
        AND ${pendingSqlPredicate()}
      ORDER BY timesheet.week_start ASC, timesheet.updated_at ASC`,
    params: [...scope.params, today],
    label: "pending",
  };
}

function invoiceReadyTimesheetsQuery(session: AuthSession): TimesheetQuery {
  const scope = timesheetScope(session);
  return {
    sql: `${timesheetSelectSql()}
      WHERE ${scope.sql}
        AND ${invoiceReadySqlPredicate()}
      ORDER BY timesheet.week_start ASC, timesheet.updated_at ASC`,
    params: scope.params,
    label: "invoice-ready",
  };
}

function payrollReadyTimesheetsQuery(session: AuthSession, today: string): TimesheetQuery {
  const scope = timesheetScope(session);
  return {
    sql: `${timesheetSelectSql()}
      WHERE ${scope.sql}
        AND ${payrollReadySqlPredicate()}
      ORDER BY timesheet.week_start ASC, timesheet.updated_at ASC`,
    params: [...scope.params, today],
    label: "payroll-ready",
  };
}

function sickLeaveTimesheetsQuery(session: AuthSession): TimesheetQuery {
  const scope = timesheetScope(session);
  return {
    sql: `${timesheetSelectSql()}
      WHERE ${scope.sql}
        AND timesheet.has_sick_leave = 1
        AND json_extract(timesheet.data, '$.archived') IS NOT 1
      ORDER BY timesheet.week_start DESC, timesheet.updated_at DESC`,
    params: scope.params,
    label: "sick-leave",
  };
}

function pendingSqlPredicate(): string {
  return `timesheet.status = 'sent'
    AND json_extract(timesheet.data, '$.archived') IS NOT 1
    AND COALESCE(
      NULLIF(timesheet.project_end_date, ''),
      date(timesheet.week_start, '+6 days')
    ) < ?`;
}

function invoiceReadySqlPredicate(): string {
  return `timesheet.status = 'approved'
    AND timesheet.total_hours > 0
    AND timesheet.invoice_sent_date = ''
    AND json_extract(timesheet.data, '$.archived') IS NOT 1`;
}

function payrollReadySqlPredicate(): string {
  return `(
      timesheet.status = 'approved'
      OR (
        timesheet.status = 'sent'
        AND date(
          COALESCE(
            NULLIF(timesheet.project_end_date, ''),
            date(timesheet.week_start, '+6 days')
          ),
          '+2 days'
        ) <= ?
      )
    )
    AND timesheet.total_hours > 0
    AND timesheet.payroll_sent_date = ''
    AND json_extract(timesheet.data, '$.archived') IS NOT 1`;
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
    throw new ApiError("invalid_json", "Request body must be valid JSON.", 400);
  }
}

type TimesheetValidationError = {
  code: string;
  message: string;
  status: number;
};

function validateTimesheet(value: Timesheet): TimesheetValidationError | undefined {
  const invalid = (message: string): TimesheetValidationError => ({
    code: "invalid_timesheet",
    message,
    status: 400,
  });
  if (!value || typeof value !== "object") return invalid("Timesheet body is required.");
  if (!isNonEmptyString(value.id)) return invalid("Timesheet id is required.");
  if (!isStrictWorkDate(value.weekStart ?? "")) {
    return {
      code: INVALID_WORK_DATE,
      message: "Arbejdsugen skal være en eksisterende kalenderdato i formatet YYYY-MM-DD.",
      status: 422,
    };
  }
  if (value.status && !VALID_STATUSES.has(value.status)) {
    return invalid("Timesheet status is invalid.");
  }
  if (value.ownerRole && value.ownerRole !== "bruger" && value.ownerRole !== "bruger2") {
    return invalid("Timesheet ownerRole is invalid.");
  }
  if (value.days && !Array.isArray(value.days)) {
    return invalid("Timesheet days must be an array.");
  }
  if (Array.isArray(value.days) && value.days.length > 14) {
    return invalid("Timesheet days may contain at most 14 entries.");
  }
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
  return round(totalMinutes(days) / 60);
}

function totalMinutes(days: DayEntry[] | undefined): number {
  if (!Array.isArray(days)) return 0;
  return days.reduce((sum, day) => sum + dayMinutes(day), 0);
}

function dayMinutes(day: DayEntry | undefined): number {
  if (!day || (day.absence && day.absence !== "none")) return 0;
  const start = parseTime(day.start);
  const end = parseTime(day.end);
  if (start === undefined || end === undefined) return 0;
  const endMinutes = end <= start ? end + 24 * 60 : end;
  return Math.max(0, Math.round(endMinutes - start - pauseMinutesForDay(day)));
}

function formatRegisteredTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (remainingMinutes === 0) return `${hours} t`;
  if (hours === 0) return `${remainingMinutes} min`;
  return `${hours} t ${remainingMinutes} min`;
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

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function requireDemoAccessCode(expected: string, received: unknown): Promise<void> {
  if (!expected) {
    throw new AuthenticationError(
      "demo_access_code_not_configured",
      "Demoens adgangskode er ikke konfigureret.",
      503,
    );
  }
  if (typeof received !== "string" || received.length > 128) {
    throw new AuthenticationError("invalid_demo_access_code", "Koden er forkert.", 401);
  }

  const encoder = new TextEncoder();
  const [expectedHash, receivedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const receivedBytes = new Uint8Array(receivedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ receivedBytes[index];
  }
  if (difference !== 0) {
    throw new AuthenticationError("invalid_demo_access_code", "Koden er forkert.", 401);
  }
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins(env);
  const allowedOrigin = origin ? (allowed.includes(origin) ? origin : "") : allowed[0] || "";

  return {
    ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin } : {}),
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, Authorization, If-Match, If-None-Match, Idempotency-Key, X-Correlation-ID",
    "access-control-expose-headers": "ETag",
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
