import { strict as assert } from "node:assert";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationDirectory = join(repositoryRoot, "timesheet-worker", "migrations");
const migrations = readdirSync(migrationDirectory)
  .filter((name) => /^\d+.*\.sql$/u.test(name))
  .sort();
assert.ok(migrations.includes("0001_create_timesheets.sql"));
assert.ok(migrations.includes("0002_secure_multitenant_agreements.sql"));
assert.ok(migrations.includes("0003_agreement_catalog.sql"));

const temporaryDirectory = mkdtempSync(join(tmpdir(), "hour-craft-migration-"));
const cleanDatabase = join(temporaryDirectory, "clean.sqlite");
const representativeDatabase = join(temporaryDirectory, "representative.sqlite");
const backupDatabase = join(temporaryDirectory, "pre-migration-backup.sqlite");
const dryRunDatabase = join(temporaryDirectory, "dry-run.sqlite");
const migratedBackupDatabase = join(temporaryDirectory, "post-migration-backup.sqlite");
const restoredDatabase = join(temporaryDirectory, "restored.sqlite");

function sqlite(database, sql, { json = false } = {}) {
  const result = spawnSync("sqlite3", [...(json ? ["-json"] : []), database], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: sql,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `sqlite3 exited ${result.status}`);
  }
  return result.stdout.trim();
}

function query(database, sql) {
  const output = sqlite(database, sql, { json: true });
  return output ? JSON.parse(output) : [];
}

function migrationSql(name) {
  return readFileSync(join(migrationDirectory, name), "utf8");
}

function applyPostBaselineMigrations(database) {
  for (const migration of migrations.filter((name) => !name.startsWith("0001_"))) {
    sqlite(database, migrationSql(migration));
  }
}

function applyAllMigrations(database) {
  for (const migration of migrations) sqlite(database, migrationSql(migration));
}

function assertCatalogAndSchema(database) {
  assert.equal(query(database, "PRAGMA integrity_check;")[0].integrity_check, "ok");
  assert.deepEqual(query(database, "PRAGMA foreign_key_check;"), []);
  assert.deepEqual(
    query(
      database,
      `SELECT
         (SELECT COUNT(*) FROM agreements) AS agreements,
         (SELECT COUNT(*) FROM agreement_versions) AS agreement_versions,
         (SELECT COUNT(*) FROM agreement_rules) AS agreement_rules,
         (SELECT COUNT(*) FROM agreement_rate_periods) AS agreement_rate_periods,
         (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger') AS triggers;`,
    )[0],
    {
      agreements: 30,
      agreement_versions: 5,
      agreement_rules: 0,
      agreement_rate_periods: 0,
      triggers: 43,
    },
  );
  assert.deepEqual(
    query(
      database,
      `SELECT catalog_status AS status, COUNT(*) AS count
       FROM agreements
       GROUP BY catalog_status
       ORDER BY catalog_status;`,
    ),
    [
      { status: "manual_review_required", count: 10 },
      { status: "missing_official_source", count: 8 },
      { status: "out_of_scope", count: 3 },
      { status: "source_conflict", count: 4 },
      { status: "verified_not_implemented", count: 5 },
    ],
  );
  const requiredTriggers = [
    "audit_events_append_only_update",
    "calculation_snapshots_immutable_update",
    "agreement_rules_require_verified_source_insert",
    "agreement_rates_no_overlap_insert",
    "timesheets_validate_tenant_references_insert",
    "timesheets_validate_tenant_references_update",
    "timesheets_preserve_approved_snapshot",
  ];
  assert.deepEqual(
    query(
      database,
      `SELECT name
       FROM sqlite_master
       WHERE type = 'trigger'
         AND name IN (${requiredTriggers.map((name) => `'${name}'`).join(", ")})
       ORDER BY name;`,
    ).map((row) => row.name),
    [
      "agreement_rates_no_overlap_insert",
      "agreement_rules_require_verified_source_insert",
      "audit_events_append_only_update",
      "calculation_snapshots_immutable_update",
      "timesheets_preserve_approved_snapshot",
      "timesheets_validate_tenant_references_insert",
      "timesheets_validate_tenant_references_update",
    ],
  );
}

function controlledSnapshot(database) {
  return {
    timesheets: query(
      database,
      `SELECT id, status, tenant_migration_status, data_schema_version, data
       FROM timesheets
       ORDER BY id;`,
    ),
    catalog: query(
      database,
      `SELECT id, catalog_key, catalog_status
       FROM agreements
       ORDER BY id;`,
    ),
    versions: query(
      database,
      `SELECT id, agreement_id, implementation_status, verification_status
       FROM agreement_versions
       ORDER BY id;`,
    ),
  };
}

try {
  applyAllMigrations(cleanDatabase);
  assertCatalogAndSchema(cleanDatabase);

  sqlite(representativeDatabase, migrationSql("0001_create_timesheets.sql"));
  sqlite(
    representativeDatabase,
    `INSERT INTO timesheets (
       id, status, owner_role, week_start, project_end_date, company_id,
       project_id, brugervirksomhed, worker_code, has_sick_leave, total_hours,
       invoice_sent_date, payroll_sent_date, created_at, updated_at, data
     ) VALUES
       (
         'legacy-with-codes', 'draft', 'bruger', '2026-07-20', '',
         'legacy-company', 'legacy-project', 'Bevar virksomhed', 'W-001',
         0, 7.5, '', '', '2026-07-20T08:00:00Z', '2026-07-20T08:00:00Z',
         '{"id":"legacy-with-codes","notes":"bevar-notat","workerAccessCode":"0000","contactPersonAccessCode":"1234","workerRequiresCodeChange":true,"contactPersonRequiresCodeChange":true}'
       ),
       (
         'legacy-without-codes', 'approved', 'bruger2', '2026-07-13', '',
         'legacy-company', 'legacy-project', 'Bevar virksomhed', 'W-002',
         0, 8, '', '', '2026-07-13T08:00:00Z', '2026-07-13T08:00:00Z',
         '{"id":"legacy-without-codes","notes":"uændret"}'
       );`,
  );

  const before = query(
    representativeDatabase,
    `SELECT COUNT(*) AS timesheets,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
     FROM timesheets;`,
  )[0];
  assert.deepEqual(before, { timesheets: 2, approved: 1 });
  copyFileSync(representativeDatabase, backupDatabase);

  copyFileSync(backupDatabase, dryRunDatabase);
  applyPostBaselineMigrations(dryRunDatabase);
  assert.equal(query(dryRunDatabase, "PRAGMA integrity_check;")[0].integrity_check, "ok");
  assert.deepEqual(query(dryRunDatabase, "PRAGMA foreign_key_check;"), []);

  applyPostBaselineMigrations(representativeDatabase);
  const after = query(
    representativeDatabase,
    `SELECT COUNT(*) AS timesheets,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN tenant_migration_status = 'manual_review_required' THEN 1 ELSE 0 END)
              AS manual_tenant_review
     FROM timesheets;`,
  )[0];
  assert.deepEqual(after, {
    timesheets: 2,
    approved: 1,
    manual_tenant_review: 2,
  });

  const sanitized = query(
    representativeDatabase,
    `SELECT
       json_extract(data, '$.notes') AS notes,
       json_type(data, '$.workerAccessCode') AS worker_access_code,
       json_type(data, '$.contactPersonAccessCode') AS contact_access_code,
       data_schema_version
     FROM timesheets
     WHERE id = 'legacy-with-codes';`,
  )[0];
  assert.deepEqual(sanitized, {
    notes: "bevar-notat",
    worker_access_code: null,
    contact_access_code: null,
    data_schema_version: 2,
  });
  assert.deepEqual(query(representativeDatabase, "PRAGMA foreign_key_check;"), []);
  assert.equal(query(representativeDatabase, "PRAGMA integrity_check;")[0].integrity_check, "ok");
  assertCatalogAndSchema(representativeDatabase);
  assert.deepEqual(
    query(
      representativeDatabase,
      `SELECT id, COUNT(*) AS duplicate_count
       FROM agreements
       GROUP BY id
       HAVING COUNT(*) > 1;`,
    ),
    [],
  );

  copyFileSync(representativeDatabase, migratedBackupDatabase);
  copyFileSync(migratedBackupDatabase, restoredDatabase);
  assert.deepEqual(
    controlledSnapshot(restoredDatabase),
    controlledSnapshot(representativeDatabase),
  );

  const counts = query(
    representativeDatabase,
    `SELECT
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table') AS tables,
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger') AS triggers,
       (SELECT COUNT(*) FROM agreements) AS agreements,
       (SELECT COUNT(*) FROM agreement_versions) AS agreement_versions,
       (SELECT COUNT(*) FROM agreement_rules) AS agreement_rules,
       (SELECT COUNT(*) FROM calculation_snapshots) AS calculation_snapshots;`,
  )[0];
  console.log(`PASS clean, dry-run and representative migration (${migrations.join(", ")})`);
  console.log(`PASS legacy counts preserved: ${before.timesheets} -> ${after.timesheets}`);
  console.log("PASS cleartext access-code fields invalidated; business JSON preserved");
  console.log("PASS exact catalog counts/statuses/triggers, foreign keys and integrity");
  console.log("PASS post-migration controlled backup and restore");
  console.log(JSON.stringify(counts));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
