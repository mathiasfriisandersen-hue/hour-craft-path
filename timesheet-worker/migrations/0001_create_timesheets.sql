CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  owner_role TEXT CHECK (owner_role IN ('bruger', 'bruger2')),
  week_start TEXT NOT NULL DEFAULT '',
  project_end_date TEXT NOT NULL DEFAULT '',
  company_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  brugervirksomhed TEXT NOT NULL DEFAULT '',
  worker_code TEXT NOT NULL DEFAULT '',
  has_sick_leave INTEGER NOT NULL DEFAULT 0 CHECK (has_sick_leave IN (0, 1)),
  total_hours REAL NOT NULL DEFAULT 0,
  invoice_sent_date TEXT NOT NULL DEFAULT '',
  payroll_sent_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_start ON timesheets(week_start);
CREATE INDEX IF NOT EXISTS idx_timesheets_company_id ON timesheets(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_sick_leave ON timesheets(has_sick_leave);
CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_ready
  ON timesheets(status, invoice_sent_date, total_hours);
CREATE INDEX IF NOT EXISTS idx_timesheets_payroll_ready
  ON timesheets(status, payroll_sent_date, total_hours);
CREATE INDEX IF NOT EXISTS idx_timesheets_updated_at ON timesheets(updated_at);
