import {
  authenticateRequest,
  AuthenticationError,
  hashOpaqueToken,
  requireRole,
  type AuthEnvironment,
  type AuthSession,
  type MembershipRole,
} from "../../workers/shared/auth";

type D1RunResult = {
  success: boolean;
  meta?: {
    changes?: number;
  };
};

type D1Result<T> = {
  results?: T[];
  success: boolean;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type Env = AuthEnvironment & {
  TIMESHEET_DB?: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ALLOWED_ORIGIN?: string;
  APP_BASE_URL?: string;
};

const MAIL_TEMPLATES = [
  "timesheet_submission_contact",
  "worker_submission_receipt",
  "worker_invitation",
  "contact_invitation",
] as const;

type MailTemplateCommand = (typeof MAIL_TEMPLATES)[number];
type InvitationRecipient = "worker" | "contact";

type TimesheetRow = {
  id: string;
  organization_id: string;
  project_record_id: string | null;
  worker_record_id: string | null;
  owner_membership_id: string | null;
  week_start: string;
  status: string;
};

type RecipientRow = {
  recipient_id: string;
  email_lookup_hmac: string | null;
  email_ciphertext: unknown;
  encryption_key_version: number | null;
};

type RecipientReference = RecipientRow & {
  recipientType: InvitationRecipient;
};

type RoleRow = {
  id: string;
};

type OrganizationMailPolicyRow = {
  is_demo: number;
  outbound_mail_enabled: number;
};

type InvitationRow = {
  id: string;
  organization_id: string;
  invitation_purpose: string;
  project_id: string | null;
  role_key: MembershipRole;
};

type IdempotencyReservation = {
  id: string;
};

type FixedMail = {
  subject: string;
  text: string;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};
const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_JSON_BYTES = 4_096;
const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const MUTATION_RATE_WINDOW_SECONDS = 60;
const MUTATION_RATE_LIMIT = 10;
const OPAQUE_TOKEN_BYTES = 32;
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
  async scheduled(): Promise<void> {
    // The previous cron treated KV app-state as authoritative. Retention mail is
    // intentionally disabled until a D1-backed, organization-scoped consent
    // workflow and secure recipient resolver are configured.
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    const url = new URL(request.url);

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname === "/privacy-timesheet-gpt.html"
    ) {
      return privacyPolicyResponse(request.method === "HEAD");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      enforceBrowserOrigin(request, env);

      if (
        url.pathname === "/app-state" ||
        url.pathname === "/create-worker-consent" ||
        url.pathname === "/worker-consent"
      ) {
        throw new ApiError(
          "legacy_state_authority_removed",
          "KV app-state og det tidligere samtykkeflow er fjernet. Brug det organisation-afgrænsede D1-flow.",
          410,
        );
      }

      if (request.method === "GET" && url.pathname === "/worker-invite") {
        return await inspectInvitation(url, env, headers);
      }

      if (request.method === "POST" && url.pathname === "/worker-invite") {
        return await redeemInvitation(request, env, headers);
      }

      if (request.method === "POST" && url.pathname === "/create-worker-invite") {
        return await handleCreateInvitation(request, env, headers);
      }

      if (request.method === "POST" && url.pathname === "/send-timesheet") {
        return await handleFixedMailCommand(request, env, headers);
      }

      throw new ApiError("not_found", "Endpointet findes ikke.", 404);
    } catch (error) {
      return errorResponse(error, headers);
    }
  },
};

async function handleCreateInvitation(
  request: Request,
  env: Env,
  headers: HeadersInit,
): Promise<Response> {
  const database = requireDatabase(env);
  const session = await requireProductionSession(request, env, database);
  requireRole(session, ["konsulent", "organisationsadministrator", "platformsadministrator"]);

  const payload = await parseJsonObject(request);
  assertExactKeys(payload, ["timesheetId", "purpose", "idempotencyKey"]);
  const timesheetId = requiredIdentifier(payload.timesheetId, "timesheetId");
  const purpose = requiredInvitationRecipient(payload.purpose);
  const idempotencyKey = requiredIdempotencyKey(payload.idempotencyKey);
  const timesheet = await loadAuthorizedTimesheet(database, session, timesheetId);
  await enforceMutationRateLimit(database, session);
  const recipient = await resolveRecipientReference(database, timesheet, purpose);
  const reservation = await reserveIdempotency(
    database,
    session,
    `invitation.create.${purpose}`,
    idempotencyKey,
    { timesheetId, purpose },
  );

  try {
    await writeAuditEvent(database, session, request, {
      action: "invitation.create_requested",
      objectType: "timesheet",
      objectId: timesheet.id,
      details: { purpose },
    });
    const invitation = await createInvitationRecord(
      database,
      session,
      timesheet,
      purpose,
      recipient,
    );
    const responseBody = {
      ok: true,
      invitation: {
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        purpose,
      },
    };
    await completeIdempotency(database, reservation, 201, responseBody);
    return jsonResponse(responseBody, 201, headers);
  } catch (error) {
    await failIdempotency(database, reservation);
    throw error;
  }
}

async function handleFixedMailCommand(
  request: Request,
  env: Env,
  headers: HeadersInit,
): Promise<Response> {
  const database = requireDatabase(env);
  const session = await requireProductionSession(request, env, database);
  const payload = await parseJsonObject(request);
  assertExactKeys(payload, ["template", "timesheetId", "idempotencyKey"]);
  const template = requiredMailTemplate(payload.template);
  const timesheetId = requiredIdentifier(payload.timesheetId, "timesheetId");
  const idempotencyKey = requiredIdempotencyKey(payload.idempotencyKey);
  enforceTemplateRole(session, template);
  const timesheet = await loadAuthorizedTimesheet(database, session, timesheetId);
  await enforceMutationRateLimit(database, session);
  const recipientType = recipientTypeForTemplate(template);
  const recipientReference = await resolveRecipientReference(database, timesheet, recipientType);

  // D1 intentionally stores encrypted recipient data. The encryption format and
  // key-management contract have not been supplied, so this fails closed rather
  // than guessing a format or falling back to legacy JSON/plaintext recipients.
  const recipientEmail = resolveDeliverableEmail(recipientReference);
  const reservation = await reserveIdempotency(
    database,
    session,
    `mail.send.${template}`,
    idempotencyKey,
    { template, timesheetId },
  );
  let createdInvitationId: string | undefined;

  try {
    let invitationToken: string | undefined;
    if (template === "worker_invitation" || template === "contact_invitation") {
      const invitation = await createInvitationRecord(
        database,
        session,
        timesheet,
        recipientType,
        recipientReference,
      );
      invitationToken = invitation.token;
      createdInvitationId = invitation.id;
    }

    const fixedMail = buildFixedMail(template, timesheet, invitationToken, env);
    await writeAuditEvent(database, session, request, {
      action: "mail.send_requested",
      objectType: "timesheet",
      objectId: timesheet.id,
      details: { template },
    });
    const providerMessageId = await sendFixedEmail(recipientEmail, fixedMail, env);
    const responseBody = {
      ok: true,
      template,
      messageId: providerMessageId,
    };
    await completeIdempotency(database, reservation, 200, responseBody);
    await writeAuditEvent(database, session, request, {
      action: "mail.sent",
      objectType: "timesheet",
      objectId: timesheet.id,
      details: { template, providerMessageId },
    });
    return jsonResponse(responseBody, 200, headers);
  } catch (error) {
    if (createdInvitationId) {
      await revokeInvitation(database, createdInvitationId);
    }
    await failIdempotency(database, reservation);
    throw error;
  }
}

async function inspectInvitation(url: URL, env: Env, headers: HeadersInit): Promise<Response> {
  const database = requireDatabase(env);
  const token = requiredOpaqueToken(url.searchParams.get("i"));
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const invitation = await database
    .prepare(
      `SELECT 1 AS valid
       FROM invitation_tokens
       WHERE token_hash = ?
         AND consumed_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<{ valid: number }>();

  return jsonResponse({ ok: true, valid: Boolean(invitation) }, 200, headers);
}

async function redeemInvitation(
  request: Request,
  env: Env,
  headers: HeadersInit,
): Promise<Response> {
  const database = requireDatabase(env);
  const session = await requireProductionSession(request, env, database);
  const payload = await parseJsonObject(request);
  assertExactKeys(payload, ["token"]);
  const token = requiredOpaqueToken(payload.token);
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const invitation = await database
    .prepare(
      `SELECT
         invitation.id,
         invitation.organization_id,
         invitation.invitation_purpose,
         invitation.project_id,
         role.role_key
       FROM invitation_tokens AS invitation
       JOIN roles AS role ON role.id = invitation.role_id
       WHERE invitation.token_hash = ?
         AND invitation.organization_id = ?
         AND invitation.consumed_at IS NULL
         AND invitation.revoked_at IS NULL
         AND invitation.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, session.organizationId, now)
    .first<InvitationRow>();

  if (!invitation || invitation.role_key !== session.role) {
    throw new ApiError(
      "invalid_or_expired_invitation",
      "Invitationen er ugyldig, udløbet eller tilhører ikke sessionen.",
      410,
    );
  }

  await writeAuditEvent(database, session, request, {
    action: "invitation.redeem_requested",
    objectType: "invitation",
    objectId: invitation.id,
    details: { purpose: invitation.invitation_purpose },
  });
  const consumed = await database
    .prepare(
      `UPDATE invitation_tokens
       SET consumed_at = ?, consumed_by_identity_id = ?
       WHERE id = ?
         AND organization_id = ?
         AND consumed_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > ?`,
    )
    .bind(now, session.userId, invitation.id, session.organizationId, now)
    .run();

  if (changedRows(consumed) !== 1) {
    throw new ApiError(
      "invitation_already_consumed",
      "Invitationen er allerede brugt eller udløbet.",
      410,
    );
  }

  return jsonResponse(
    {
      ok: true,
      invitation: {
        purpose: invitation.invitation_purpose,
        projectId: invitation.project_id,
      },
    },
    200,
    headers,
  );
}

async function requireProductionSession(
  request: Request,
  env: Env,
  database: D1Database,
): Promise<AuthSession> {
  const session = await authenticateRequest(request, env, database);
  if (session.demo) {
    throw new ApiError(
      "demo_mail_disabled",
      "Demoorganisationen må ikke sende mails eller oprette invitationer.",
      403,
    );
  }
  const organization = await database
    .prepare(
      `SELECT is_demo, outbound_mail_enabled
       FROM organizations
       WHERE id = ?
         AND status = 'active'
       LIMIT 1`,
    )
    .bind(session.organizationId)
    .first<OrganizationMailPolicyRow>();
  if (
    !organization ||
    (organization.is_demo !== 0 && organization.is_demo !== 1) ||
    (organization.outbound_mail_enabled !== 0 && organization.outbound_mail_enabled !== 1)
  ) {
    throw new ApiError(
      "organization_mail_policy_unavailable",
      "Mail er blokeret, fordi organisationens mailpolitik ikke kunne verificeres.",
      503,
    );
  }
  if (organization.is_demo === 1) {
    throw new ApiError(
      "demo_mail_disabled",
      "Demoorganisationen må ikke sende mails eller oprette invitationer.",
      403,
    );
  }
  if (organization.outbound_mail_enabled !== 1) {
    throw new ApiError(
      "organization_mail_disabled",
      "Organisationen har ikke tilladelse til at sende mails eller oprette invitationer.",
      403,
    );
  }
  return session;
}

async function loadAuthorizedTimesheet(
  database: D1Database,
  session: AuthSession,
  timesheetId: string,
): Promise<TimesheetRow> {
  const timesheet = await database
    .prepare(
      `SELECT
         id,
         organization_id,
         project_record_id,
         worker_record_id,
         owner_membership_id,
         week_start,
         status
       FROM timesheets
       WHERE id = ?
         AND organization_id = ?
         AND tenant_migration_status IN ('assigned', 'verified_demo')
       LIMIT 1`,
    )
    .bind(timesheetId, session.organizationId)
    .first<TimesheetRow>();

  if (!timesheet) {
    throw new ApiError(
      "timesheet_not_found",
      "Timesedlen findes ikke i sessionens organisation eller kræver manuel tenant-migrering.",
      404,
    );
  }

  if (
    session.role === "konsulent" ||
    session.role === "organisationsadministrator" ||
    session.role === "platformsadministrator"
  ) {
    return timesheet;
  }

  if (session.role === "vikar") {
    if (timesheet.owner_membership_id !== session.membershipId) {
      throw new ApiError("forbidden", "Vikaren har ikke adgang til timesedlen.", 403);
    }
    return timesheet;
  }

  if (session.role === "kontaktperson" && timesheet.project_record_id) {
    const projectAccess = await database
      .prepare(
        `SELECT 1 AS allowed
         FROM project_membership_access
         WHERE organization_id = ?
           AND project_id = ?
           AND membership_id = ?
           AND revoked_at IS NULL
         LIMIT 1`,
      )
      .bind(session.organizationId, timesheet.project_record_id, session.membershipId)
      .first<{ allowed: number }>();
    if (projectAccess) return timesheet;
  }

  throw new ApiError("forbidden", "Sessionen har ikke adgang til timesedlen.", 403);
}

function enforceTemplateRole(session: AuthSession, template: MailTemplateCommand): void {
  if (template === "worker_invitation" || template === "contact_invitation") {
    requireRole(session, ["konsulent", "organisationsadministrator", "platformsadministrator"]);
    return;
  }

  requireRole(session, [
    "vikar",
    "kontaktperson",
    "konsulent",
    "organisationsadministrator",
    "platformsadministrator",
  ]);
}

function recipientTypeForTemplate(template: MailTemplateCommand): InvitationRecipient {
  return template === "worker_submission_receipt" || template === "worker_invitation"
    ? "worker"
    : "contact";
}

async function resolveRecipientReference(
  database: D1Database,
  timesheet: TimesheetRow,
  recipientType: InvitationRecipient,
): Promise<RecipientReference> {
  if (recipientType === "worker") {
    if (!timesheet.worker_record_id) {
      throw new ApiError(
        "recipient_not_mapped",
        "Timesedlen har ingen organisation-afgrænset worker-reference.",
        409,
      );
    }
    const worker = await database
      .prepare(
        `SELECT
           id AS recipient_id,
           email_lookup_hmac,
           email_ciphertext,
           personal_data_encryption_key_version AS encryption_key_version
         FROM workers
         WHERE id = ?
           AND organization_id = ?
           AND status = 'active'
         LIMIT 1`,
      )
      .bind(timesheet.worker_record_id, timesheet.organization_id)
      .first<RecipientRow>();
    if (!worker) {
      throw new ApiError(
        "recipient_not_found",
        "Den autoriserede D1-worker-modtager blev ikke fundet.",
        404,
      );
    }
    return { ...worker, recipientType };
  }

  if (!timesheet.project_record_id) {
    throw new ApiError(
      "recipient_not_mapped",
      "Timesedlen har ingen organisation-afgrænset project-reference.",
      409,
    );
  }
  const contacts = await database
    .prepare(
      `SELECT DISTINCT
         identity.id AS recipient_id,
         identity.email_lookup_hmac,
         identity.email_ciphertext,
         identity.email_encryption_key_version AS encryption_key_version
       FROM project_membership_access AS access
       JOIN organization_memberships AS membership
         ON membership.id = access.membership_id
        AND membership.organization_id = access.organization_id
       JOIN membership_roles AS membership_role
         ON membership_role.membership_id = membership.id
        AND membership_role.organization_id = membership.organization_id
        AND membership_role.revoked_at IS NULL
       JOIN roles AS role
         ON role.id = membership_role.role_id
        AND role.role_key = 'kontaktperson'
        AND role.role_scope = 'organization'
       JOIN identities AS identity ON identity.id = membership.identity_id
       WHERE access.organization_id = ?
         AND access.project_id = ?
         AND access.revoked_at IS NULL
         AND membership.status = 'active'
         AND identity.status = 'active'
       ORDER BY identity.id ASC`,
    )
    .bind(timesheet.organization_id, timesheet.project_record_id)
    .all<RecipientRow>();
  const rows = contacts.results ?? [];
  if (rows.length === 0) {
    throw new ApiError(
      "recipient_not_found",
      "Projektet har ingen aktiv, autoriseret kontaktperson i D1.",
      404,
    );
  }
  if (rows.length !== 1) {
    throw new ApiError(
      "recipient_ambiguous",
      "Projektet har flere mulige kontaktpersoner. Modtageren skal afklares administrativt.",
      409,
    );
  }
  return { ...rows[0], recipientType };
}

function resolveDeliverableEmail(reference: RecipientReference): never {
  if (!reference.email_lookup_hmac || reference.email_ciphertext == null) {
    throw new ApiError(
      "recipient_email_missing",
      "Den autoriserede D1-modtager mangler krypteret mailadresse.",
      409,
    );
  }
  throw new ApiError(
    "recipient_decryption_not_configured",
    "Mail er blokeret: format, nøglehåndtering og resolver til email_ciphertext er ikke konfigureret.",
    503,
  );
}

async function createInvitationRecord(
  database: D1Database,
  session: AuthSession,
  timesheet: TimesheetRow,
  recipientType: InvitationRecipient,
  recipient: RecipientReference,
): Promise<{ id: string; token: string; expiresAt: string }> {
  if (!recipient.email_lookup_hmac || recipient.email_ciphertext == null) {
    throw new ApiError(
      "recipient_email_missing",
      "Invitationen kan ikke oprettes uden en krypteret, D1-resolved mailmodtager.",
      409,
    );
  }
  const roleKey = recipientType === "worker" ? "vikar" : "kontaktperson";
  const role = await database
    .prepare(
      `SELECT id
       FROM roles
       WHERE role_key = ?
         AND role_scope = 'organization'
       LIMIT 1`,
    )
    .bind(roleKey)
    .first<RoleRow>();
  if (!role) {
    throw new ApiError(
      "invitation_role_not_configured",
      `Organisationsrollen ${roleKey} findes ikke i D1.`,
      503,
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_SECONDS * 1000).toISOString();
  const token = randomOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const id = crypto.randomUUID();
  const invitationPurpose = recipientType === "worker" ? "worker_membership" : "project_contact";
  const created = await database
    .prepare(
      `INSERT INTO invitation_tokens (
         id,
         organization_id,
         invitation_purpose,
         email_lookup_hmac,
         email_ciphertext,
         email_encryption_key_version,
         role_id,
         project_id,
         token_hash,
         expires_at,
         created_by_membership_id,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      timesheet.organization_id,
      invitationPurpose,
      recipient.email_lookup_hmac,
      recipient.email_ciphertext,
      recipient.encryption_key_version ?? 1,
      role.id,
      timesheet.project_record_id,
      tokenHash,
      expiresAt,
      session.membershipId,
      now.toISOString(),
    )
    .run();
  if (!created.success || changedRows(created) !== 1) {
    throw new ApiError(
      "invitation_create_failed",
      "Invitationen kunne ikke gemmes sikkert i D1.",
      503,
    );
  }
  return { id, token, expiresAt };
}

async function revokeInvitation(database: D1Database, invitationId: string): Promise<void> {
  await database
    .prepare(
      `UPDATE invitation_tokens
       SET revoked_at = ?
       WHERE id = ?
         AND consumed_at IS NULL
         AND revoked_at IS NULL`,
    )
    .bind(new Date().toISOString(), invitationId)
    .run()
    .catch(() => undefined);
}

function buildFixedMail(
  template: MailTemplateCommand,
  timesheet: TimesheetRow,
  invitationToken: string | undefined,
  env: Env,
): FixedMail {
  const week = timesheet.week_start || "ukendt uge";

  if (template === "timesheet_submission_contact") {
    return {
      subject: "Timeseddel klar til godkendelse",
      text: [
        "Hej",
        "",
        `En timeseddel for uge ${week} er klar til godkendelse i Hour Craft Path.`,
        `Timeseddel-ID: ${timesheet.id}`,
        "",
        `Åbn systemet her: ${applicationUrl(env, "/")}`,
        "",
        "Med venlig hilsen",
        "Sub-Z",
      ].join("\n"),
    };
  }

  if (template === "worker_submission_receipt") {
    return {
      subject: "Din timeseddel er modtaget",
      text: [
        "Hej",
        "",
        `Din timeseddel for uge ${week} er modtaget i Hour Craft Path.`,
        `Timeseddel-ID: ${timesheet.id}`,
        "",
        `Åbn systemet her: ${applicationUrl(env, "/")}`,
        "",
        "Med venlig hilsen",
        "Sub-Z",
      ].join("\n"),
    };
  }

  if (!invitationToken) {
    throw new ApiError(
      "invitation_token_missing",
      "Den faste invitationsmail mangler en serverudstedt invitation.",
      500,
    );
  }
  const path = template === "worker_invitation" ? "/vikar/invite" : "/kontaktperson/invite";
  const invitationUrl = applicationUrl(env, path, invitationToken);
  return {
    subject:
      template === "worker_invitation"
        ? "Invitation til din timeseddel"
        : "Invitation til godkendelse af timeseddel",
    text: [
      "Hej",
      "",
      "Du har fået en sikker invitation til Hour Craft Path.",
      "Invitationen er personlig, udløber efter syv dage og kan kun bruges én gang.",
      "",
      invitationUrl,
      "",
      "Med venlig hilsen",
      "Sub-Z",
    ].join("\n"),
  };
}

function applicationUrl(env: Env, path: string, invitationToken?: string): string {
  const configured = env.APP_BASE_URL?.trim();
  if (!configured) {
    throw new ApiError(
      "app_base_url_not_configured",
      "APP_BASE_URL skal konfigureres server-side før mail kan sendes.",
      503,
    );
  }
  let url: URL;
  try {
    url = new URL(path.replace(/^\//u, ""), `${configured.replace(/\/$/u, "")}/`);
  } catch {
    throw new ApiError("app_base_url_invalid", "APP_BASE_URL er ugyldig.", 503);
  }
  if (url.protocol !== "https:") {
    throw new ApiError("app_base_url_insecure", "APP_BASE_URL skal bruge HTTPS.", 503);
  }
  if (invitationToken) url.searchParams.set("i", invitationToken);
  return url.toString();
}

async function sendFixedEmail(recipient: string, mail: FixedMail, env: Env): Promise<string> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new ApiError(
      "resend_not_configured",
      "RESEND_API_KEY og RESEND_FROM_EMAIL skal konfigureres som serverhemmeligheder.",
      503,
    );
  }
  if (!isEmail(recipient)) {
    throw new ApiError(
      "resolved_recipient_invalid",
      "Den sikre recipient-resolver returnerede en ugyldig mailadresse.",
      503,
    );
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: mail.subject,
      text: mail.text,
      html: textToHtml(mail.text),
    }),
  });
  if (!response.ok) {
    throw new ApiError(
      "mail_provider_failed",
      `Mailudbyderen afviste den faste mail med HTTP ${response.status}.`,
      502,
    );
  }
  const body = (await response.json().catch(() => ({}))) as { id?: unknown };
  return typeof body.id === "string" && body.id ? body.id : "accepted";
}

async function reserveIdempotency(
  database: D1Database,
  session: AuthSession,
  operationScope: string,
  rawKey: string,
  requestBody: Record<string, string>,
): Promise<IdempotencyReservation> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000).toISOString();
  const keyHash = await hashOpaqueToken(rawKey);
  const requestHash = await hashOpaqueToken(JSON.stringify(requestBody));
  const result = await database
    .prepare(
      `INSERT INTO idempotency_keys (
         id,
         organization_id,
         actor_identity_id,
         operation_scope,
         idempotency_key_hash,
         request_sha256,
         state,
         expires_at,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)
       ON CONFLICT (
         organization_id,
         actor_identity_id,
         operation_scope,
         idempotency_key_hash
       ) DO NOTHING`,
    )
    .bind(
      id,
      session.organizationId,
      session.userId,
      operationScope,
      keyHash,
      requestHash,
      expiresAt,
      now.toISOString(),
    )
    .run();
  if (!result.success || changedRows(result) !== 1) {
    throw new ApiError(
      "duplicate_operation",
      "Handlingen er allerede registreret med denne idempotency-nøgle.",
      409,
    );
  }
  return { id };
}

async function enforceMutationRateLimit(database: D1Database, session: AuthSession): Promise<void> {
  const cutoff = new Date(Date.now() - MUTATION_RATE_WINDOW_SECONDS * 1000).toISOString();
  const row = await database
    .prepare(
      `SELECT COUNT(*) AS request_count
       FROM idempotency_keys
       WHERE organization_id = ?
         AND actor_identity_id = ?
         AND created_at >= ?`,
    )
    .bind(session.organizationId, session.userId, cutoff)
    .first<{ request_count: number | string }>();
  const requestCount = Number(row?.request_count ?? 0);
  if (!Number.isFinite(requestCount)) {
    throw new ApiError(
      "rate_limit_unavailable",
      "Mailhandlingen blev blokeret, fordi rate limit ikke kunne valideres.",
      503,
    );
  }
  if (requestCount >= MUTATION_RATE_LIMIT) {
    throw new ApiError(
      "rate_limited",
      "For mange mail- eller invitationshandlinger. Prøv igen senere.",
      429,
    );
  }
}

async function completeIdempotency(
  database: D1Database,
  reservation: IdempotencyReservation,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const completedAt = new Date().toISOString();
  const responseHash = await hashOpaqueToken(JSON.stringify(responseBody));
  const result = await database
    .prepare(
      `UPDATE idempotency_keys
       SET
         state = 'completed',
         response_status = ?,
         response_sha256 = ?,
         completed_at = ?
       WHERE id = ?
         AND state = 'in_progress'`,
    )
    .bind(responseStatus, responseHash, completedAt, reservation.id)
    .run();
  if (!result.success || changedRows(result) !== 1) {
    throw new ApiError(
      "idempotency_finalize_failed",
      "Handlingen blev blokeret, fordi idempotency-resultatet ikke kunne afsluttes.",
      503,
    );
  }
}

async function failIdempotency(
  database: D1Database,
  reservation: IdempotencyReservation,
): Promise<void> {
  await database
    .prepare(
      `UPDATE idempotency_keys
       SET state = 'failed'
       WHERE id = ?
         AND state = 'in_progress'`,
    )
    .bind(reservation.id)
    .run()
    .catch(() => undefined);
}

async function writeAuditEvent(
  database: D1Database,
  session: AuthSession,
  request: Request,
  event: {
    action: string;
    objectType: string;
    objectId: string;
    details: Record<string, string>;
  },
): Promise<void> {
  const requestId = safeRequestId(request.headers.get("x-request-id"));
  const result = await database
    .prepare(
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
         after_values_json,
         reason
       ) VALUES (?, ?, 'identity', ?, ?, ?, ?, ?, ?, ?, ?, '')`,
    )
    .bind(
      crypto.randomUUID(),
      session.organizationId,
      session.userId,
      session.role === "platformsadministrator" ? null : session.membershipId,
      event.action,
      event.objectType,
      event.objectId,
      requestId,
      requestId,
      JSON.stringify(event.details),
    )
    .run();
  if (!result.success || changedRows(result) !== 1) {
    throw new ApiError(
      "audit_write_failed",
      "Handlingen blev blokeret, fordi revisionssporet ikke kunne gemmes.",
      503,
    );
  }
}

function requireDatabase(env: Env): D1Database {
  if (!env.TIMESHEET_DB || typeof env.TIMESHEET_DB.prepare !== "function") {
    throw new ApiError(
      "database_not_configured",
      "TIMESHEET_DB-binding mangler. Alle mail- og invitationshandlinger er blokeret.",
      503,
    );
  }
  return env.TIMESHEET_DB;
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("invalid_content_type", "Content-Type skal være application/json.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError("payload_too_large", "Requesten er for stor.", 413);
  }
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ApiError("invalid_json", "JSON-requesten mangler eller er for stor.", 400);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not_object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError("invalid_json", "Requesten indeholder ugyldig JSON.", 400);
  }
}

function assertExactKeys(payload: Record<string, unknown>, allowedKeys: string[]): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new ApiError(
      "unexpected_fields",
      "Requesten indeholder felter, som den faste kommando ikke accepterer.",
      400,
    );
  }
}

function requiredIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/u.test(value)) {
    throw new ApiError("invalid_identifier", `${field} er ugyldigt.`, 400);
  }
  return value;
}

function requiredMailTemplate(value: unknown): MailTemplateCommand {
  if (typeof value !== "string" || !(MAIL_TEMPLATES as readonly string[]).includes(value)) {
    throw new ApiError("invalid_template", "Mailtemplate er ugyldig.", 400);
  }
  return value as MailTemplateCommand;
}

function requiredInvitationRecipient(value: unknown): InvitationRecipient {
  if (value !== "worker" && value !== "contact") {
    throw new ApiError("invalid_invitation_purpose", "Invitationstypen er ugyldig.", 400);
  }
  return value;
}

function requiredIdempotencyKey(value: unknown): string {
  const hasControlCharacter =
    typeof value === "string" &&
    [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    });
  if (typeof value !== "string" || value.length < 16 || value.length > 200 || hasControlCharacter) {
    throw new ApiError(
      "invalid_idempotency_key",
      "En idempotency-nøgle på 16-200 tegn er påkrævet.",
      400,
    );
  }
  return value;
}

function requiredOpaqueToken(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{40,128}$/u.test(value)) {
    throw new ApiError("invalid_invitation_token", "Invitationstoken er ugyldigt.", 400);
  }
  return value;
}

function randomOpaqueToken(): string {
  const bytes = new Uint8Array(OPAQUE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function changedRows(result: D1RunResult): number {
  return Number(result.meta?.changes ?? 0);
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function enforceBrowserOrigin(request: Request, env: Env): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (!allowedOrigins(env).includes(origin)) {
    throw new ApiError("origin_not_allowed", "Browser-Origin er ikke tilladt.", 403);
  }
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = allowedOrigins(env).includes(origin) ? origin : "";
  return {
    ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-request-id",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function errorResponse(error: unknown, headers: HeadersInit): Response {
  if (error instanceof AuthenticationError || error instanceof ApiError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
      headers,
    );
  }
  console.error("mail_worker_error", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "Mailhandlingen kunne ikke gennemføres.",
      },
    },
    500,
    headers,
  );
}

function privacyPolicyResponse(headOnly: boolean): Response {
  return new Response(headOnly ? null : PRIVACY_POLICY_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtml(value: string): string {
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.45;color:#111827;">${escapeHtml(value)}</div>`;
}

function safeRequestId(value: string | null): string {
  return value && /^[A-Za-z0-9._:-]{1,100}$/u.test(value) ? value : crypto.randomUUID();
}
