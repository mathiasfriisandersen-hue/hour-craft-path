import type { Role } from "@/lib/auth";
import type { Company, Timesheet } from "@/lib/timesheet-store";

export type CompanyOwnerRole = Extract<Role, "bruger" | "bruger2">;

export function companyOwnerForRole(role: Role | null | undefined): CompanyOwnerRole | undefined {
  if (role === "bruger" || role === "bruger2") return role;
  return undefined;
}

export function companyVisibleForRole(company: Company, role: Role | null | undefined): boolean {
  if (role === "admin") return true;
  const owner = companyOwnerForRole(role);
  if (!owner) return false;
  return company.ownerRole === owner;
}

export function companiesVisibleForRole(
  companies: Company[],
  role: Role | null | undefined,
): Company[] {
  return companies.filter((company) => companyVisibleForRole(company, role));
}

export function timesheetsVisibleForRole(
  timesheets: Timesheet[],
  role: Role | null | undefined,
  companies: Company[],
): Timesheet[] {
  if (role === "admin") return timesheets;
  const visibleCompanies = companiesVisibleForRole(companies, role);
  const visibleCompanyIds = new Set(visibleCompanies.map((company) => company.id));
  const visibleCompanyNames = new Set(
    visibleCompanies.map((company) => company.name.trim().toLowerCase()).filter(Boolean),
  );

  return timesheets.filter((timesheet) => {
    if (timesheet.ownerRole) return timesheet.ownerRole === role;
    if (timesheet.companyId) return visibleCompanyIds.has(timesheet.companyId);
    return visibleCompanyNames.has(timesheet.brugervirksomhed.trim().toLowerCase());
  });
}
