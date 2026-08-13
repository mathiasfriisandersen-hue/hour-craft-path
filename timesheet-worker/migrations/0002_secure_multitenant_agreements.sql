-- Hour Craft Path: additive secure multi-tenant and agreement-engine schema.
--
-- Safety and recovery:
-- 1. Export the target D1 database and record table counts before applying this
--    migration in any environment.
-- 2. Apply first to a representative local copy and compare counts and foreign
--    key checks before and after.
-- 3. Existing timesheet rows intentionally remain organization_id = NULL and
--    tenant_migration_status = 'manual_review_required'. No tenant mapping is
--    guessed by this migration.
-- 4. This migration performs no DELETE, DROP, or agreement seed. Its only
--    legacy data rewrite removes obsolete cleartext access-code fields from
--    valid timesheet JSON; the remaining business payload is preserved.
-- 5. Rollback should restore the verified export into a replacement database.
--    Do not attempt an in-place destructive rollback of the added columns.
--
-- All timestamps are UTC ISO-8601 text supplied by trusted server code unless a
-- CURRENT_TIMESTAMP default is stated. Calendar calculations remain explicitly
-- tied to Europe/Copenhagen in calculation_snapshots.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  outbound_mail_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (outbound_mail_enabled IN (0, 1)),
  default_timezone TEXT NOT NULL DEFAULT 'Europe/Copenhagen'
    CHECK (default_timezone = 'Europe/Copenhagen'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  CHECK (is_demo = 0 OR outbound_mail_enabled = 0)
);

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email_lookup_hmac TEXT NOT NULL UNIQUE,
  email_ciphertext BLOB NOT NULL,
  email_encryption_key_version INTEGER NOT NULL DEFAULT 1
    CHECK (email_encryption_key_version >= 1),
  display_name_ciphertext BLOB,
  display_name_encryption_key_version INTEGER
    CHECK (
      display_name_encryption_key_version IS NULL
      OR display_name_encryption_key_version >= 1
    ),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended', 'disabled')),
  email_verified_at TEXT,
  last_authenticated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (auth_provider, provider_subject),
  CHECK (length(email_lookup_hmac) = 64),
  CHECK (email_lookup_hmac NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('organization', 'platform')),
  permissions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(permissions_json)),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  joined_at TEXT,
  suspended_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, identity_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS membership_roles (
  organization_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  granted_by_membership_id TEXT,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (organization_id, membership_id, role_id),
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, granted_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS identity_platform_roles (
  identity_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  granted_by_identity_id TEXT,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (identity_id, role_id),
  FOREIGN KEY (identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (granted_by_identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_code TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  registration_number_lookup_hmac TEXT,
  registration_number_ciphertext BLOB,
  registration_number_encryption_key_version INTEGER
    CHECK (
      registration_number_encryption_key_version IS NULL
      OR registration_number_encryption_key_version >= 1
    ),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, company_code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (
    registration_number_lookup_hmac IS NULL
    OR (
      length(registration_number_lookup_hmac) = 64
      AND registration_number_lookup_hmac NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS workplaces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  workplace_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  municipality_code TEXT,
  country_code TEXT NOT NULL DEFAULT 'DK'
    CHECK (length(country_code) = 2),
  address_ciphertext BLOB,
  address_encryption_key_version INTEGER
    CHECK (
      address_encryption_key_version IS NULL
      OR address_encryption_key_version >= 1
    ),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, workplace_code),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, company_id, id),
  FOREIGN KEY (organization_id, company_id)
    REFERENCES companies(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  workplace_id TEXT,
  project_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  work_scope TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, project_code),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, company_id, id),
  FOREIGN KEY (organization_id, company_id)
    REFERENCES companies(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id, workplace_id)
    REFERENCES workplaces(organization_id, company_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS project_membership_access (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  access_level TEXT NOT NULL
    CHECK (access_level IN ('view', 'submit', 'approve', 'manage')),
  granted_by_membership_id TEXT,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (organization_id, project_id, membership_id, access_level),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, granted_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  membership_id TEXT,
  worker_code TEXT NOT NULL,
  display_name_ciphertext BLOB NOT NULL,
  email_lookup_hmac TEXT,
  email_ciphertext BLOB,
  phone_ciphertext BLOB,
  personal_data_encryption_key_version INTEGER NOT NULL DEFAULT 1
    CHECK (personal_data_encryption_key_version >= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'inactive', 'terminated')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, worker_code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (
    email_lookup_hmac IS NULL
    OR (
      length(email_lookup_hmac) = 64
      AND email_lookup_hmac NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS employment_terms (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id TEXT,
  workplace_id TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  employee_category TEXT NOT NULL,
  is_temporary_worker INTEGER NOT NULL DEFAULT 0
    CHECK (is_temporary_worker IN (0, 1)),
  base_hourly_rate_cents INTEGER
    CHECK (base_hourly_rate_cents IS NULL OR base_hourly_rate_cents >= 0),
  pension_basis_points INTEGER
    CHECK (
      pension_basis_points IS NULL
      OR pension_basis_points BETWEEN 0 AND 100000
    ),
  holiday_pay_basis_points INTEGER
    CHECK (
      holiday_pay_basis_points IS NULL
      OR holiday_pay_basis_points BETWEEN 0 AND 100000
    ),
  free_choice_basis_points INTEGER
    CHECK (
      free_choice_basis_points IS NULL
      OR free_choice_basis_points BETWEEN 0 AND 100000
    ),
  source_reference TEXT NOT NULL DEFAULT '',
  source_document_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'revoked', 'manual_review_required')),
  created_by_membership_id TEXT NOT NULL,
  approved_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, worker_id)
    REFERENCES workers(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id)
    REFERENCES companies(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id, project_id)
    REFERENCES projects(organization_id, company_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id, workplace_id)
    REFERENCES workplaces(organization_id, company_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, approved_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (
    source_document_sha256 IS NULL
    OR (
      length(source_document_sha256) = 64
      AND source_document_sha256 NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  catalog_key TEXT NOT NULL UNIQUE,
  exact_title TEXT NOT NULL,
  agreement_parties TEXT NOT NULL,
  employer_organization TEXT NOT NULL DEFAULT '',
  covered_work_areas TEXT NOT NULL DEFAULT '',
  employee_category TEXT NOT NULL,
  geography_scope TEXT NOT NULL DEFAULT '',
  catalog_status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      catalog_status IN (
        'verified_and_active',
        'verified_not_implemented',
        'missing_official_source',
        'source_conflict',
        'manual_review_required',
        'out_of_scope'
      )
    ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1)
);

CREATE TABLE IF NOT EXISTS agreement_versions (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  published_at TEXT,
  rule_schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (rule_schema_version >= 1),
  implementation_status TEXT NOT NULL DEFAULT 'not_implemented'
    CHECK (
      implementation_status IN (
        'not_implemented',
        'partially_implemented',
        'implemented',
        'out_of_scope'
      )
    ),
  verification_status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      verification_status IN (
        'verified_and_active',
        'verified_not_implemented',
        'missing_official_source',
        'source_conflict',
        'manual_review_required',
        'out_of_scope'
      )
    ),
  activated_at TEXT,
  activated_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (agreement_id, version_label),
  FOREIGN KEY (agreement_id) REFERENCES agreements(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (activated_by_membership_id) REFERENCES organization_memberships(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS agreement_sources (
  id TEXT PRIMARY KEY,
  agreement_version_id TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('main_agreement', 'protocol', 'rate_sheet', 'price_list', 'correction')),
  official_url TEXT NOT NULL,
  document_title TEXT NOT NULL,
  agreement_parties TEXT NOT NULL,
  document_version TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  retrieved_at TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  paragraph_reference TEXT NOT NULL DEFAULT '',
  page_reference TEXT NOT NULL DEFAULT '',
  table_reference TEXT NOT NULL DEFAULT '',
  private_storage_object_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      verification_status IN (
        'verified_and_active',
        'verified_not_implemented',
        'missing_official_source',
        'source_conflict',
        'manual_review_required',
        'out_of_scope'
      )
    ),
  verified_at TEXT,
  verified_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (agreement_version_id, source_sha256),
  UNIQUE (agreement_version_id, id),
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (verified_by_membership_id) REFERENCES organization_memberships(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK (length(source_sha256) = 64),
  CHECK (source_sha256 NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE IF NOT EXISTS agreement_rules (
  id TEXT PRIMARY KEY,
  agreement_version_id TEXT NOT NULL,
  source_id TEXT,
  rule_key TEXT NOT NULL,
  rule_version INTEGER NOT NULL DEFAULT 1 CHECK (rule_version >= 1),
  rule_schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (rule_schema_version >= 1),
  rule_type TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  conditions_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(conditions_json)),
  value_unit TEXT NOT NULL DEFAULT 'none'
    CHECK (
      value_unit IN (
        'none',
        'cents',
        'cents_per_hour',
        'cents_per_unit',
        'basis_points',
        'minutes'
      )
    ),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  percentage_basis_points INTEGER
    CHECK (
      percentage_basis_points IS NULL
      OR percentage_basis_points BETWEEN 0 AND 100000
    ),
  duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  formula_expression TEXT NOT NULL DEFAULT '',
  rounding_mode TEXT NOT NULL DEFAULT 'half_up'
    CHECK (rounding_mode IN ('half_up', 'half_even', 'floor', 'ceiling', 'exact')),
  combination_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(combination_json)),
  exclusivity_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(exclusivity_json)),
  priority INTEGER NOT NULL DEFAULT 0,
  occupational_scope TEXT NOT NULL DEFAULT '',
  geographic_scope TEXT NOT NULL DEFAULT '',
  paragraph_reference TEXT NOT NULL DEFAULT '',
  page_reference TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      verification_status IN (
        'verified_and_active',
        'verified_not_implemented',
        'missing_official_source',
        'source_conflict',
        'manual_review_required',
        'out_of_scope'
      )
    ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (agreement_version_id, rule_key, rule_version),
  UNIQUE (agreement_version_id, id),
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id, source_id)
    REFERENCES agreement_sources(agreement_version_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (
    (value_unit = 'none'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NULL)
    OR
    (value_unit IN ('cents', 'cents_per_hour', 'cents_per_unit')
      AND amount_cents IS NOT NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NULL)
    OR
    (value_unit = 'basis_points'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NOT NULL
      AND duration_minutes IS NULL)
    OR
    (value_unit = 'minutes'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS agreement_rate_periods (
  id TEXT PRIMARY KEY,
  agreement_version_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  rate_version INTEGER NOT NULL DEFAULT 1 CHECK (rate_version >= 1),
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  value_unit TEXT NOT NULL
    CHECK (
      value_unit IN ('cents', 'cents_per_hour', 'cents_per_unit', 'basis_points', 'minutes')
    ),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  percentage_basis_points INTEGER
    CHECK (
      percentage_basis_points IS NULL
      OR percentage_basis_points BETWEEN 0 AND 100000
    ),
  duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  rounding_mode TEXT NOT NULL DEFAULT 'half_up'
    CHECK (rounding_mode IN ('half_up', 'half_even', 'floor', 'ceiling', 'exact')),
  paragraph_reference TEXT NOT NULL DEFAULT '',
  page_reference TEXT NOT NULL DEFAULT '',
  table_reference TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      verification_status IN (
        'verified_and_active',
        'verified_not_implemented',
        'missing_official_source',
        'source_conflict',
        'manual_review_required',
        'out_of_scope'
      )
    ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (rule_id, rate_key, rate_version),
  UNIQUE (agreement_version_id, id),
  UNIQUE (rule_id, id),
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id, rule_id)
    REFERENCES agreement_rules(agreement_version_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id, source_id)
    REFERENCES agreement_sources(agreement_version_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (
    (value_unit IN ('cents', 'cents_per_hour', 'cents_per_unit')
      AND amount_cents IS NOT NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NULL)
    OR
    (value_unit = 'basis_points'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NOT NULL
      AND duration_minutes IS NULL)
    OR
    (value_unit = 'minutes'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS agreement_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agreement_version_id TEXT NOT NULL,
  scope_type TEXT NOT NULL
    CHECK (
      scope_type IN ('organization', 'company', 'workplace', 'project', 'worker', 'employment_term')
    ),
  company_id TEXT,
  workplace_id TEXT,
  project_id TEXT,
  worker_id TEXT,
  employment_term_id TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  assignment_basis TEXT NOT NULL
    CHECK (
      assignment_basis IN (
        'employer_agreement',
        'accession_agreement',
        'performed_work',
        'user_company_equal_treatment',
        'documented_manual_decision'
      )
    ),
  decision_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'active',
        'expired',
        'revoked',
        'manual_review_required',
        'source_conflict'
      )
    ),
  created_by_membership_id TEXT NOT NULL,
  approved_by_membership_id TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id)
    REFERENCES companies(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, workplace_id)
    REFERENCES workplaces(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, worker_id)
    REFERENCES workers(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, employment_term_id)
    REFERENCES employment_terms(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, approved_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (
    (scope_type = 'organization'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND worker_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'company'
      AND company_id IS NOT NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND worker_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'workplace'
      AND company_id IS NULL
      AND workplace_id IS NOT NULL
      AND project_id IS NULL
      AND worker_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'project'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NOT NULL
      AND worker_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'worker'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND worker_id IS NOT NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'employment_term'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND worker_id IS NULL
      AND employment_term_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS local_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agreement_assignment_id TEXT NOT NULL,
  base_rule_id TEXT NOT NULL,
  override_version INTEGER NOT NULL DEFAULT 1 CHECK (override_version >= 1),
  scope_type TEXT NOT NULL
    CHECK (
      scope_type IN ('organization', 'company', 'workplace', 'project', 'employment_term')
    ),
  company_id TEXT,
  workplace_id TEXT,
  project_id TEXT,
  employment_term_id TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('replace', 'add', 'disable')),
  value_unit TEXT NOT NULL DEFAULT 'none'
    CHECK (
      value_unit IN (
        'none',
        'cents',
        'cents_per_hour',
        'cents_per_unit',
        'basis_points',
        'minutes'
      )
    ),
  amount_cents INTEGER,
  percentage_basis_points INTEGER,
  duration_minutes INTEGER,
  calculation_basis TEXT NOT NULL DEFAULT '',
  precedence_documented INTEGER NOT NULL DEFAULT 0
    CHECK (precedence_documented IN (0, 1)),
  documentation_title TEXT NOT NULL,
  documentation_reference TEXT NOT NULL,
  documentation_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'approved',
        'expired',
        'revoked',
        'manual_review_required',
        'source_conflict'
      )
    ),
  created_by_membership_id TEXT NOT NULL,
  approved_by_membership_id TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  UNIQUE (organization_id, agreement_assignment_id, base_rule_id, override_version),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, agreement_assignment_id)
    REFERENCES agreement_assignments(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (base_rule_id) REFERENCES agreement_rules(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, company_id)
    REFERENCES companies(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, workplace_id)
    REFERENCES workplaces(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, employment_term_id)
    REFERENCES employment_terms(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, approved_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (length(documentation_sha256) = 64),
  CHECK (documentation_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK (
    (scope_type = 'organization'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'company'
      AND company_id IS NOT NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'workplace'
      AND company_id IS NULL
      AND workplace_id IS NOT NULL
      AND project_id IS NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'project'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NOT NULL
      AND employment_term_id IS NULL)
    OR
    (scope_type = 'employment_term'
      AND company_id IS NULL
      AND workplace_id IS NULL
      AND project_id IS NULL
      AND employment_term_id IS NOT NULL)
  ),
  CHECK (
    (change_type = 'disable'
      AND value_unit = 'none'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NULL)
    OR
    (change_type IN ('replace', 'add')
      AND value_unit IN ('cents', 'cents_per_hour', 'cents_per_unit')
      AND amount_cents IS NOT NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NULL)
    OR
    (change_type IN ('replace', 'add')
      AND value_unit = 'basis_points'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NOT NULL
      AND duration_minutes IS NULL)
    OR
    (change_type IN ('replace', 'add')
      AND value_unit = 'minutes'
      AND amount_cents IS NULL
      AND percentage_basis_points IS NULL
      AND duration_minutes IS NOT NULL)
  ),
  CHECK (amount_cents IS NULL OR amount_cents >= 0),
  CHECK (
    percentage_basis_points IS NULL
    OR percentage_basis_points BETWEEN 0 AND 100000
  ),
  CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  CHECK (
    status <> 'approved'
    OR (
      precedence_documented = 1
      AND approved_by_membership_id IS NOT NULL
      AND approved_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS calculation_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  timesheet_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  employment_term_id TEXT NOT NULL,
  agreement_assignment_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  calculation_revision INTEGER NOT NULL CHECK (calculation_revision >= 1),
  as_of_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Copenhagen'
    CHECK (timezone = 'Europe/Copenhagen'),
  status TEXT NOT NULL
    CHECK (
      status IN (
        'completed',
        'manual_review_required',
        'source_conflict',
        'failed'
      )
    ),
  total_work_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (total_work_minutes >= 0),
  base_pay_cents INTEGER NOT NULL DEFAULT 0 CHECK (base_pay_cents >= 0),
  allowance_cents INTEGER NOT NULL DEFAULT 0 CHECK (allowance_cents >= 0),
  overtime_cents INTEGER NOT NULL DEFAULT 0 CHECK (overtime_cents >= 0),
  pension_cents INTEGER NOT NULL DEFAULT 0 CHECK (pension_cents >= 0),
  holiday_pay_cents INTEGER NOT NULL DEFAULT 0 CHECK (holiday_pay_cents >= 0),
  free_choice_cents INTEGER NOT NULL DEFAULT 0 CHECK (free_choice_cents >= 0),
  sh_holiday_cents INTEGER NOT NULL DEFAULT 0 CHECK (sh_holiday_cents >= 0),
  gross_pay_cents INTEGER NOT NULL DEFAULT 0 CHECK (gross_pay_cents >= 0),
  invoice_total_cents INTEGER NOT NULL DEFAULT 0 CHECK (invoice_total_cents >= 0),
  input_sha256 TEXT NOT NULL,
  rule_set_sha256 TEXT NOT NULL,
  override_set_sha256 TEXT NOT NULL,
  result_sha256 TEXT NOT NULL,
  input_snapshot_json TEXT NOT NULL CHECK (json_valid(input_snapshot_json)),
  result_snapshot_json TEXT NOT NULL CHECK (json_valid(result_snapshot_json)),
  manual_review_reasons_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(manual_review_reasons_json)),
  created_by_identity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, timesheet_id, calculation_revision),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (timesheet_id) REFERENCES timesheets(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, worker_id)
    REFERENCES workers(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, employment_term_id)
    REFERENCES employment_terms(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, agreement_assignment_id)
    REFERENCES agreement_assignments(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (created_by_identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (length(input_sha256) = 64 AND input_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(rule_set_sha256) = 64 AND rule_set_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(override_set_sha256) = 64 AND override_set_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(result_sha256) = 64 AND result_sha256 NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE IF NOT EXISTS calculation_lines (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  calculation_snapshot_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number >= 1),
  line_origin TEXT NOT NULL
    CHECK (line_origin IN ('employment_term', 'agreement_rule')),
  work_date TEXT NOT NULL,
  work_dates_json TEXT NOT NULL CHECK (json_valid(work_dates_json)),
  line_type TEXT NOT NULL,
  quantity_minutes INTEGER CHECK (quantity_minutes IS NULL OR quantity_minutes >= 0),
  quantity_units INTEGER CHECK (quantity_units IS NULL OR quantity_units >= 0),
  base_amount_cents INTEGER CHECK (base_amount_cents IS NULL OR base_amount_cents >= 0),
  unit_rate_cents INTEGER CHECK (unit_rate_cents IS NULL OR unit_rate_cents >= 0),
  percentage_basis_points INTEGER
    CHECK (
      percentage_basis_points IS NULL
      OR percentage_basis_points BETWEEN 0 AND 100000
    ),
  amount_cents INTEGER NOT NULL,
  formula TEXT NOT NULL,
  explanation TEXT NOT NULL,
  agreement_version_id TEXT NOT NULL,
  employment_term_id TEXT,
  rule_id TEXT,
  rate_period_id TEXT,
  source_id TEXT,
  local_override_id TEXT,
  paragraph_reference TEXT NOT NULL DEFAULT '',
  page_reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (calculation_snapshot_id, line_number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, calculation_snapshot_id)
    REFERENCES calculation_snapshots(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, employment_term_id)
    REFERENCES employment_terms(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id, rule_id)
    REFERENCES agreement_rules(agreement_version_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (rule_id, rate_period_id)
    REFERENCES agreement_rate_periods(rule_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id, source_id)
    REFERENCES agreement_sources(agreement_version_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, local_override_id)
    REFERENCES local_overrides(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (quantity_minutes IS NOT NULL OR quantity_units IS NOT NULL),
  CHECK (
    (line_origin = 'employment_term'
      AND employment_term_id IS NOT NULL
      AND rule_id IS NULL
      AND rate_period_id IS NULL
      AND source_id IS NULL
      AND local_override_id IS NULL)
    OR
    (line_origin = 'agreement_rule'
      AND employment_term_id IS NULL
      AND rule_id IS NOT NULL
      AND source_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS calculation_adjustments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  calculation_snapshot_id TEXT NOT NULL,
  adjusts_calculation_line_id TEXT,
  local_override_id TEXT,
  adjustment_type TEXT NOT NULL
    CHECK (adjustment_type IN ('correction', 'reversal', 'supplement')),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  created_by_membership_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, calculation_snapshot_id)
    REFERENCES calculation_snapshots(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, adjusts_calculation_line_id)
    REFERENCES calculation_lines(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, local_override_id)
    REFERENCES local_overrides(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('identity', 'system')),
  actor_identity_id TEXT,
  actor_membership_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id TEXT NOT NULL,
  request_id TEXT,
  before_values_json TEXT CHECK (before_values_json IS NULL OR json_valid(before_values_json)),
  after_values_json TEXT CHECK (after_values_json IS NULL OR json_valid(after_values_json)),
  agreement_version_id TEXT,
  rule_id TEXT,
  calculation_snapshot_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  source_ip_hmac TEXT,
  user_agent_hmac TEXT,
  redaction_schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (redaction_schema_version >= 1),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (actor_identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (agreement_version_id) REFERENCES agreement_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (rule_id) REFERENCES agreement_rules(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (calculation_snapshot_id) REFERENCES calculation_snapshots(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (
    (actor_type = 'identity' AND actor_identity_id IS NOT NULL)
    OR (actor_type = 'system' AND actor_membership_id IS NULL)
  ),
  CHECK (
    source_ip_hmac IS NULL
    OR (
      length(source_ip_hmac) = 64
      AND source_ip_hmac NOT GLOB '*[^0-9a-f]*'
    )
  ),
  CHECK (
    user_agent_hmac IS NULL
    OR (
      length(user_agent_hmac) = 64
      AND user_agent_hmac NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS invitation_tokens (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  invitation_purpose TEXT NOT NULL
    CHECK (
      invitation_purpose IN (
        'organization_membership',
        'worker_membership',
        'project_contact'
      )
    ),
  email_lookup_hmac TEXT NOT NULL,
  email_ciphertext BLOB NOT NULL,
  email_encryption_key_version INTEGER NOT NULL DEFAULT 1
    CHECK (email_encryption_key_version >= 1),
  role_id TEXT NOT NULL,
  project_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_identity_id TEXT,
  revoked_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_by_membership_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (consumed_by_identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (length(email_lookup_hmac) = 64),
  CHECK (email_lookup_hmac NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(token_hash) = 64),
  CHECK (token_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR revoked_at IS NULL),
  CHECK (
    consumed_at IS NULL
    OR consumed_by_identity_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  organization_id TEXT,
  membership_id TEXT,
  session_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (session_kind IN ('standard', 'demo', 'platform')),
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_secret_hash TEXT,
  issuer TEXT NOT NULL,
  audience TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  rotated_from_session_id TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  FOREIGN KEY (identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES organization_memberships(organization_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (rotated_from_session_id) REFERENCES auth_sessions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (length(session_token_hash) = 64),
  CHECK (session_token_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (
    csrf_secret_hash IS NULL
    OR (
      length(csrf_secret_hash) = 64
      AND csrf_secret_hash NOT GLOB '*[^0-9a-f]*'
    )
  ),
  CHECK (expires_at > issued_at),
  CHECK (
    (session_kind = 'platform'
      AND organization_id IS NULL
      AND membership_id IS NULL)
    OR
    (session_kind IN ('standard', 'demo')
      AND organization_id IS NOT NULL
      AND membership_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS revoked_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  identity_id TEXT NOT NULL,
  organization_id TEXT,
  session_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES auth_sessions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (length(session_token_hash) = 64),
  CHECK (session_token_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (expires_at > revoked_at)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_identity_id TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (state IN ('in_progress', 'completed', 'failed')),
  response_status INTEGER
    CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_sha256 TEXT,
  resource_type TEXT,
  resource_id TEXT,
  locked_until TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE (organization_id, actor_identity_id, operation_scope, idempotency_key_hash),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (actor_identity_id) REFERENCES identities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (length(idempotency_key_hash) = 64),
  CHECK (idempotency_key_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(request_sha256) = 64),
  CHECK (request_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK (
    response_sha256 IS NULL
    OR (
      length(response_sha256) = 64
      AND response_sha256 NOT GLOB '*[^0-9a-f]*'
    )
  ),
  CHECK (expires_at > created_at),
  CHECK (
    state <> 'completed'
    OR (
      response_status IS NOT NULL
      AND response_sha256 IS NOT NULL
      AND completed_at IS NOT NULL
    )
  )
);

-- Existing free-text company_id/project_id fields are retained untouched.
-- New normalized references are nullable until each legacy row has been
-- assigned by an authorized, audited migration process.
ALTER TABLE timesheets ADD COLUMN organization_id TEXT
  REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN company_record_id TEXT
  REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN project_record_id TEXT
  REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN worker_record_id TEXT
  REFERENCES workers(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN employment_term_id TEXT
  REFERENCES employment_terms(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN agreement_assignment_id TEXT
  REFERENCES agreement_assignments(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN owner_membership_id TEXT
  REFERENCES organization_memberships(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN approved_by_membership_id TEXT
  REFERENCES organization_memberships(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE timesheets ADD COLUMN tenant_migration_status TEXT NOT NULL
  DEFAULT 'manual_review_required'
  CHECK (
    tenant_migration_status IN (
      'manual_review_required',
      'assigned',
      'verified_demo'
    )
    AND (
      tenant_migration_status = 'manual_review_required'
      OR organization_id IS NOT NULL
    )
  );
ALTER TABLE timesheets ADD COLUMN row_version INTEGER NOT NULL
  DEFAULT 1 CHECK (row_version >= 1);
ALTER TABLE timesheets ADD COLUMN data_schema_version INTEGER NOT NULL
  DEFAULT 1 CHECK (data_schema_version >= 1);
ALTER TABLE timesheets ADD COLUMN calculation_revision INTEGER NOT NULL
  DEFAULT 0 CHECK (calculation_revision >= 0);
ALTER TABLE timesheets ADD COLUMN last_calculation_snapshot_id TEXT
  REFERENCES calculation_snapshots(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- The previous browser-authoritative flow stored these one-time access
-- credentials in cleartext inside the timesheet JSON. They are no longer an
-- authentication mechanism. Remove the obsolete fields without guessing tenant
-- relationships or changing any remaining business data.
UPDATE timesheets
SET data = json_remove(
      data,
      '$.workerAccessCode',
      '$.contactPersonAccessCode',
      '$.workerRequiresCodeChange',
      '$.contactPersonRequiresCodeChange'
    ),
    data_schema_version = 2
WHERE json_valid(data) = 1
  AND (
    json_type(data, '$.workerAccessCode') IS NOT NULL
    OR json_type(data, '$.contactPersonAccessCode') IS NOT NULL
    OR json_type(data, '$.workerRequiresCodeChange') IS NOT NULL
    OR json_type(data, '$.contactPersonRequiresCodeChange') IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_memberships_identity_status
  ON organization_memberships(identity_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_organization_status
  ON organization_memberships(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_roles_active
  ON membership_roles(organization_id, membership_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_companies_organization_status
  ON companies(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_workplaces_organization_company
  ON workplaces(organization_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_organization_company_status
  ON projects(organization_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_project_access_membership
  ON project_membership_access(organization_id, membership_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_workers_organization_status
  ON workers(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_employment_terms_worker_dates
  ON employment_terms(organization_id, worker_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_agreement_versions_dates
  ON agreement_versions(agreement_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_agreement_sources_version_status
  ON agreement_sources(agreement_version_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_agreement_rules_version_type_dates
  ON agreement_rules(agreement_version_id, rule_type, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_agreement_rate_periods_rule_dates
  ON agreement_rate_periods(rule_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_agreement_assignments_scope_dates
  ON agreement_assignments(
    organization_id,
    scope_type,
    valid_from,
    valid_to,
    status
  );
CREATE INDEX IF NOT EXISTS idx_local_overrides_assignment_rule_dates
  ON local_overrides(
    organization_id,
    agreement_assignment_id,
    base_rule_id,
    valid_from,
    valid_to,
    status
  );
CREATE INDEX IF NOT EXISTS idx_calculation_snapshots_timesheet_revision
  ON calculation_snapshots(organization_id, timesheet_id, calculation_revision);
CREATE INDEX IF NOT EXISTS idx_calculation_lines_snapshot
  ON calculation_lines(organization_id, calculation_snapshot_id, line_number);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_time
  ON audit_events(organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_object
  ON audit_events(organization_id, object_type, object_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation
  ON audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_lookup
  ON invitation_tokens(organization_id, email_lookup_hmac, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_identity_expiry
  ON auth_sessions(identity_id, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expiry
  ON revoked_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expiry
  ON idempotency_keys(organization_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_timesheets_organization_status_week
  ON timesheets(organization_id, status, week_start);
CREATE INDEX IF NOT EXISTS idx_timesheets_organization_worker_week
  ON timesheets(organization_id, worker_record_id, week_start);
CREATE INDEX IF NOT EXISTS idx_timesheets_organization_project_week
  ON timesheets(organization_id, project_record_id, week_start);

CREATE TRIGGER IF NOT EXISTS audit_events_append_only_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_append_only_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS calculation_snapshots_immutable_update
BEFORE UPDATE ON calculation_snapshots
BEGIN
  SELECT RAISE(ABORT, 'calculation_snapshots are immutable');
END;

CREATE TRIGGER IF NOT EXISTS calculation_snapshots_immutable_delete
BEFORE DELETE ON calculation_snapshots
BEGIN
  SELECT RAISE(ABORT, 'calculation_snapshots are immutable');
END;

CREATE TRIGGER IF NOT EXISTS calculation_lines_immutable_update
BEFORE UPDATE ON calculation_lines
BEGIN
  SELECT RAISE(ABORT, 'calculation_lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS calculation_lines_immutable_delete
BEFORE DELETE ON calculation_lines
BEGIN
  SELECT RAISE(ABORT, 'calculation_lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS calculation_adjustments_immutable_update
BEFORE UPDATE ON calculation_adjustments
BEGIN
  SELECT RAISE(ABORT, 'calculation_adjustments are immutable');
END;

CREATE TRIGGER IF NOT EXISTS calculation_adjustments_immutable_delete
BEFORE DELETE ON calculation_adjustments
BEGIN
  SELECT RAISE(ABORT, 'calculation_adjustments are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agreement_sources_preserve_evidence
BEFORE UPDATE OF
  agreement_version_id,
  source_type,
  official_url,
  document_title,
  agreement_parties,
  document_version,
  valid_from,
  valid_to,
  retrieved_at,
  source_sha256,
  paragraph_reference,
  page_reference,
  table_reference
ON agreement_sources
BEGIN
  SELECT RAISE(ABORT, 'agreement source evidence is immutable; add a corrected source');
END;

CREATE TRIGGER IF NOT EXISTS agreement_sources_preserve_history
BEFORE DELETE ON agreement_sources
BEGIN
  SELECT RAISE(ABORT, 'agreement source history cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rules_preserve_version
BEFORE UPDATE OF
  agreement_version_id,
  source_id,
  rule_key,
  rule_version,
  rule_schema_version,
  rule_type,
  valid_from,
  valid_to,
  conditions_json,
  value_unit,
  amount_cents,
  percentage_basis_points,
  duration_minutes,
  formula_expression,
  rounding_mode,
  combination_json,
  exclusivity_json,
  priority,
  occupational_scope,
  geographic_scope,
  paragraph_reference,
  page_reference
ON agreement_rules
BEGIN
  SELECT RAISE(ABORT, 'agreement rule versions are immutable; add a new version');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rules_preserve_history
BEFORE DELETE ON agreement_rules
BEGIN
  SELECT RAISE(ABORT, 'agreement rule history cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rate_periods_preserve_version
BEFORE UPDATE OF
  agreement_version_id,
  rule_id,
  source_id,
  rate_key,
  rate_version,
  valid_from,
  valid_to,
  value_unit,
  amount_cents,
  percentage_basis_points,
  duration_minutes,
  rounding_mode,
  paragraph_reference,
  page_reference,
  table_reference
ON agreement_rate_periods
BEGIN
  SELECT RAISE(ABORT, 'agreement rate periods are immutable; add a new version');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rate_periods_preserve_history
BEFORE DELETE ON agreement_rate_periods
BEGIN
  SELECT RAISE(ABORT, 'agreement rate history cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rules_require_verified_source_insert
BEFORE INSERT ON agreement_rules
WHEN NEW.verification_status = 'verified_and_active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_sources AS source
    WHERE source.id = NEW.source_id
      AND source.agreement_version_id = NEW.agreement_version_id
      AND source.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'active agreement rule requires a verified official source');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rules_require_verified_source_update
BEFORE UPDATE OF verification_status ON agreement_rules
WHEN NEW.verification_status = 'verified_and_active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_sources AS source
    WHERE source.id = NEW.source_id
      AND source.agreement_version_id = NEW.agreement_version_id
      AND source.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'active agreement rule requires a verified official source');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rates_require_verified_source_insert
BEFORE INSERT ON agreement_rate_periods
WHEN NEW.verification_status = 'verified_and_active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_sources AS source
    WHERE source.id = NEW.source_id
      AND source.agreement_version_id = NEW.agreement_version_id
      AND source.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'active agreement rate requires a verified official source');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rates_require_verified_source_update
BEFORE UPDATE OF verification_status ON agreement_rate_periods
WHEN NEW.verification_status = 'verified_and_active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_sources AS source
    WHERE source.id = NEW.source_id
      AND source.agreement_version_id = NEW.agreement_version_id
      AND source.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'active agreement rate requires a verified official source');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rates_no_overlap_insert
BEFORE INSERT ON agreement_rate_periods
WHEN NEW.verification_status = 'verified_and_active'
  AND EXISTS (
    SELECT 1
    FROM agreement_rate_periods AS existing
    WHERE existing.rule_id = NEW.rule_id
      AND existing.rate_key = NEW.rate_key
      AND existing.verification_status = 'verified_and_active'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping verified rate periods require source review');
END;

CREATE TRIGGER IF NOT EXISTS agreement_rates_no_overlap_update
BEFORE UPDATE OF verification_status ON agreement_rate_periods
WHEN NEW.verification_status = 'verified_and_active'
  AND EXISTS (
    SELECT 1
    FROM agreement_rate_periods AS existing
    WHERE existing.id <> NEW.id
      AND existing.rule_id = NEW.rule_id
      AND existing.rate_key = NEW.rate_key
      AND existing.verification_status = 'verified_and_active'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping verified rate periods require source review');
END;

CREATE TRIGGER IF NOT EXISTS agreement_assignments_preserve_version
BEFORE UPDATE OF
  organization_id,
  agreement_version_id,
  scope_type,
  company_id,
  workplace_id,
  project_id,
  worker_id,
  employment_term_id,
  valid_from,
  valid_to,
  assignment_basis,
  decision_reference
ON agreement_assignments
BEGIN
  SELECT RAISE(ABORT, 'agreement assignments are versioned; add a new assignment');
END;

CREATE TRIGGER IF NOT EXISTS agreement_assignments_require_verified_version_insert
BEFORE INSERT ON agreement_assignments
WHEN NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_versions AS version
    WHERE version.id = NEW.agreement_version_id
      AND version.verification_status = 'verified_and_active'
      AND version.implementation_status = 'implemented'
  )
BEGIN
  SELECT RAISE(ABORT, 'active assignment requires an implemented verified agreement version');
END;

CREATE TRIGGER IF NOT EXISTS agreement_assignments_require_verified_version_update
BEFORE UPDATE OF status ON agreement_assignments
WHEN NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_versions AS version
    WHERE version.id = NEW.agreement_version_id
      AND version.verification_status = 'verified_and_active'
      AND version.implementation_status = 'implemented'
  )
BEGIN
  SELECT RAISE(ABORT, 'active assignment requires an implemented verified agreement version');
END;

CREATE TRIGGER IF NOT EXISTS agreement_assignments_no_overlap_insert
BEFORE INSERT ON agreement_assignments
WHEN NEW.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM agreement_assignments AS existing
    WHERE existing.organization_id = NEW.organization_id
      AND existing.scope_type = NEW.scope_type
      AND ifnull(existing.company_id, '') = ifnull(NEW.company_id, '')
      AND ifnull(existing.workplace_id, '') = ifnull(NEW.workplace_id, '')
      AND ifnull(existing.project_id, '') = ifnull(NEW.project_id, '')
      AND ifnull(existing.worker_id, '') = ifnull(NEW.worker_id, '')
      AND ifnull(existing.employment_term_id, '') = ifnull(NEW.employment_term_id, '')
      AND existing.status = 'active'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping active agreement assignments require manual review');
END;

CREATE TRIGGER IF NOT EXISTS agreement_assignments_no_overlap_update
BEFORE UPDATE OF status ON agreement_assignments
WHEN NEW.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM agreement_assignments AS existing
    WHERE existing.id <> NEW.id
      AND existing.organization_id = NEW.organization_id
      AND existing.scope_type = NEW.scope_type
      AND ifnull(existing.company_id, '') = ifnull(NEW.company_id, '')
      AND ifnull(existing.workplace_id, '') = ifnull(NEW.workplace_id, '')
      AND ifnull(existing.project_id, '') = ifnull(NEW.project_id, '')
      AND ifnull(existing.worker_id, '') = ifnull(NEW.worker_id, '')
      AND ifnull(existing.employment_term_id, '') = ifnull(NEW.employment_term_id, '')
      AND existing.status = 'active'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping active agreement assignments require manual review');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_preserve_version
BEFORE UPDATE OF
  organization_id,
  agreement_assignment_id,
  base_rule_id,
  override_version,
  scope_type,
  company_id,
  workplace_id,
  project_id,
  employment_term_id,
  valid_from,
  valid_to,
  change_type,
  value_unit,
  amount_cents,
  percentage_basis_points,
  duration_minutes,
  calculation_basis,
  precedence_documented,
  documentation_title,
  documentation_reference,
  documentation_sha256
ON local_overrides
BEGIN
  SELECT RAISE(ABORT, 'local overrides are versioned; add a new override version');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_preserve_history
BEFORE DELETE ON local_overrides
BEGIN
  SELECT RAISE(ABORT, 'local override history cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_validate_rule_insert
BEFORE INSERT ON local_overrides
WHEN NOT EXISTS (
  SELECT 1
  FROM agreement_assignments AS assignment
  JOIN agreement_rules AS rule
    ON rule.id = NEW.base_rule_id
   AND rule.agreement_version_id = assignment.agreement_version_id
  WHERE assignment.id = NEW.agreement_assignment_id
    AND assignment.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'local override rule does not belong to assigned agreement version');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_require_active_rule_insert
BEFORE INSERT ON local_overrides
WHEN NEW.status = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_assignments AS assignment
    JOIN agreement_rules AS rule
      ON rule.id = NEW.base_rule_id
     AND rule.agreement_version_id = assignment.agreement_version_id
    WHERE assignment.id = NEW.agreement_assignment_id
      AND assignment.organization_id = NEW.organization_id
      AND assignment.status = 'active'
      AND rule.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'approved override requires an active assignment and verified rule');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_require_active_rule_update
BEFORE UPDATE OF status ON local_overrides
WHEN NEW.status = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_assignments AS assignment
    JOIN agreement_rules AS rule
      ON rule.id = NEW.base_rule_id
     AND rule.agreement_version_id = assignment.agreement_version_id
    WHERE assignment.id = NEW.agreement_assignment_id
      AND assignment.organization_id = NEW.organization_id
      AND assignment.status = 'active'
      AND rule.verification_status = 'verified_and_active'
  )
BEGIN
  SELECT RAISE(ABORT, 'approved override requires an active assignment and verified rule');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_no_overlap_insert
BEFORE INSERT ON local_overrides
WHEN NEW.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM local_overrides AS existing
    WHERE existing.organization_id = NEW.organization_id
      AND existing.agreement_assignment_id = NEW.agreement_assignment_id
      AND existing.base_rule_id = NEW.base_rule_id
      AND existing.scope_type = NEW.scope_type
      AND ifnull(existing.company_id, '') = ifnull(NEW.company_id, '')
      AND ifnull(existing.workplace_id, '') = ifnull(NEW.workplace_id, '')
      AND ifnull(existing.project_id, '') = ifnull(NEW.project_id, '')
      AND ifnull(existing.employment_term_id, '') = ifnull(NEW.employment_term_id, '')
      AND existing.status = 'approved'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping approved local overrides require manual review');
END;

CREATE TRIGGER IF NOT EXISTS local_overrides_no_overlap_update
BEFORE UPDATE OF status ON local_overrides
WHEN NEW.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM local_overrides AS existing
    WHERE existing.id <> NEW.id
      AND existing.organization_id = NEW.organization_id
      AND existing.agreement_assignment_id = NEW.agreement_assignment_id
      AND existing.base_rule_id = NEW.base_rule_id
      AND existing.scope_type = NEW.scope_type
      AND ifnull(existing.company_id, '') = ifnull(NEW.company_id, '')
      AND ifnull(existing.workplace_id, '') = ifnull(NEW.workplace_id, '')
      AND ifnull(existing.project_id, '') = ifnull(NEW.project_id, '')
      AND ifnull(existing.employment_term_id, '') = ifnull(NEW.employment_term_id, '')
      AND existing.status = 'approved'
      AND existing.valid_from <= ifnull(NEW.valid_to, '9999-12-31')
      AND NEW.valid_from <= ifnull(existing.valid_to, '9999-12-31')
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping approved local overrides require manual review');
END;

CREATE TRIGGER IF NOT EXISTS invitation_tokens_preserve_secret
BEFORE UPDATE OF token_hash, organization_id, email_lookup_hmac, email_ciphertext
ON invitation_tokens
BEGIN
  SELECT RAISE(ABORT, 'invitation token identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS invitation_tokens_prevent_reuse
BEFORE UPDATE OF consumed_at ON invitation_tokens
WHEN OLD.consumed_at IS NOT NULL
  AND NEW.consumed_at IS NOT OLD.consumed_at
BEGIN
  SELECT RAISE(ABORT, 'invitation token has already been consumed');
END;

CREATE TRIGGER IF NOT EXISTS invitation_tokens_require_organization_role
BEFORE INSERT ON invitation_tokens
WHEN NOT EXISTS (
  SELECT 1
  FROM roles
  WHERE id = NEW.role_id
    AND role_scope = 'organization'
)
BEGIN
  SELECT RAISE(ABORT, 'invitation requires an organization-scoped role');
END;

CREATE TRIGGER IF NOT EXISTS auth_sessions_validate_demo_organization
BEFORE INSERT ON auth_sessions
WHEN NEW.session_kind = 'demo'
  AND NOT EXISTS (
    SELECT 1
    FROM organizations
    WHERE id = NEW.organization_id
      AND is_demo = 1
      AND outbound_mail_enabled = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'demo session requires an isolated demo organization');
END;

CREATE TRIGGER IF NOT EXISTS revoked_sessions_validate_source_session
BEFORE INSERT ON revoked_sessions
WHEN NEW.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth_sessions AS session
    WHERE session.id = NEW.session_id
      AND session.identity_id = NEW.identity_id
      AND session.organization_id IS NEW.organization_id
      AND session.session_token_hash = NEW.session_token_hash
  )
BEGIN
  SELECT RAISE(ABORT, 'revoked session does not match its source session');
END;

CREATE TRIGGER IF NOT EXISTS calculation_snapshots_validate_tenant_insert
BEFORE INSERT ON calculation_snapshots
WHEN NOT EXISTS (
  SELECT 1
  FROM timesheets AS sheet
  WHERE sheet.id = NEW.timesheet_id
    AND sheet.organization_id = NEW.organization_id
    AND sheet.worker_record_id = NEW.worker_id
    AND sheet.employment_term_id = NEW.employment_term_id
    AND sheet.agreement_assignment_id = NEW.agreement_assignment_id
)
BEGIN
  SELECT RAISE(ABORT, 'calculation snapshot references an unmapped or cross-tenant timesheet');
END;

CREATE TRIGGER IF NOT EXISTS calculation_snapshots_require_active_assignment
BEFORE INSERT ON calculation_snapshots
WHEN NEW.status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM agreement_assignments AS assignment
    JOIN agreement_versions AS version
      ON version.id = assignment.agreement_version_id
    WHERE assignment.id = NEW.agreement_assignment_id
      AND assignment.organization_id = NEW.organization_id
      AND assignment.status = 'active'
      AND version.verification_status = 'verified_and_active'
      AND version.implementation_status = 'implemented'
  )
BEGIN
  SELECT RAISE(ABORT, 'completed calculation requires an active verified assignment');
END;

CREATE TRIGGER IF NOT EXISTS calculation_lines_validate_override_insert
BEFORE INSERT ON calculation_lines
WHEN NEW.local_override_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM local_overrides AS override
    JOIN calculation_snapshots AS snapshot
      ON snapshot.id = NEW.calculation_snapshot_id
     AND snapshot.organization_id = NEW.organization_id
    WHERE override.id = NEW.local_override_id
      AND override.organization_id = NEW.organization_id
      AND override.base_rule_id = NEW.rule_id
      AND override.agreement_assignment_id = snapshot.agreement_assignment_id
      AND override.status = 'approved'
      AND override.valid_from <= NEW.work_date
      AND ifnull(override.valid_to, '9999-12-31') >= NEW.work_date
  )
BEGIN
  SELECT RAISE(ABORT, 'calculation line local override is invalid for this snapshot');
END;

CREATE TRIGGER IF NOT EXISTS timesheets_validate_tenant_references_insert
BEFORE INSERT ON timesheets
WHEN NEW.organization_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'company_record_id is outside organization')
  WHERE NEW.company_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM companies
      WHERE id = NEW.company_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'project_record_id is outside organization')
  WHERE NEW.project_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM projects
      WHERE id = NEW.project_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'worker_record_id is outside organization')
  WHERE NEW.worker_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workers
      WHERE id = NEW.worker_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'employment_term_id is outside organization')
  WHERE NEW.employment_term_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employment_terms
      WHERE id = NEW.employment_term_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'agreement_assignment_id is outside organization')
  WHERE NEW.agreement_assignment_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM agreement_assignments
      WHERE id = NEW.agreement_assignment_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'owner_membership_id is outside organization')
  WHERE NEW.owner_membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE id = NEW.owner_membership_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'approved_by_membership_id is outside organization')
  WHERE NEW.approved_by_membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE id = NEW.approved_by_membership_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'last_calculation_snapshot_id is outside organization')
  WHERE NEW.last_calculation_snapshot_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM calculation_snapshots
      WHERE id = NEW.last_calculation_snapshot_id
        AND organization_id = NEW.organization_id
        AND timesheet_id = NEW.id
    );
END;

CREATE TRIGGER IF NOT EXISTS timesheets_validate_tenant_references_update
BEFORE UPDATE OF
  organization_id,
  company_record_id,
  project_record_id,
  worker_record_id,
  employment_term_id,
  agreement_assignment_id,
  owner_membership_id,
  approved_by_membership_id,
  last_calculation_snapshot_id
ON timesheets
WHEN NEW.organization_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'company_record_id is outside organization')
  WHERE NEW.company_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM companies
      WHERE id = NEW.company_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'project_record_id is outside organization')
  WHERE NEW.project_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM projects
      WHERE id = NEW.project_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'worker_record_id is outside organization')
  WHERE NEW.worker_record_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workers
      WHERE id = NEW.worker_record_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'employment_term_id is outside organization')
  WHERE NEW.employment_term_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employment_terms
      WHERE id = NEW.employment_term_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'agreement_assignment_id is outside organization')
  WHERE NEW.agreement_assignment_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM agreement_assignments
      WHERE id = NEW.agreement_assignment_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'owner_membership_id is outside organization')
  WHERE NEW.owner_membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE id = NEW.owner_membership_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'approved_by_membership_id is outside organization')
  WHERE NEW.approved_by_membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE id = NEW.approved_by_membership_id
        AND organization_id = NEW.organization_id
    );
  SELECT RAISE(ABORT, 'last_calculation_snapshot_id is outside organization')
  WHERE NEW.last_calculation_snapshot_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM calculation_snapshots
      WHERE id = NEW.last_calculation_snapshot_id
        AND organization_id = NEW.organization_id
        AND timesheet_id = NEW.id
    );
END;

CREATE TRIGGER IF NOT EXISTS timesheets_preserve_approved_snapshot
BEFORE UPDATE OF last_calculation_snapshot_id ON timesheets
WHEN OLD.status = 'approved'
  AND OLD.last_calculation_snapshot_id IS NOT NULL
  AND NEW.last_calculation_snapshot_id IS NOT OLD.last_calculation_snapshot_id
BEGIN
  SELECT RAISE(ABORT, 'approved timesheet calculation snapshot is immutable');
END;
