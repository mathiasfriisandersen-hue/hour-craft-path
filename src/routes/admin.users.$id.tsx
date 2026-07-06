import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { companiesVisibleForRole } from "@/lib/company-access";
import { findAdminUser } from "@/lib/admin-users";
import { listCompanies, type Company } from "@/lib/timesheet-store";
import { AdminOverviewContent } from "@/routes/admin.index";
import { WorkerOverviewContent } from "@/routes/admin.workers";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({ meta: [{ title: "Admin — Bruger" }] }),
  component: AdminUserDetail,
});

function AdminUserDetail() {
  const { id } = Route.useParams();
  const search = useRouterState({ select: (state) => state.location.search as { view?: string } });
  const user = findAdminUser(id);
  const view = search.view === "workers" || search.view === "companies" ? search.view : "overview";

  if (user) {
    if (view === "overview") {
      return (
        <AdminOverviewContent
          role={user.roleKey}
          previewUserId={user.id}
          dashboardShell
          dashboardAllow={["admin"]}
        />
      );
    }

    return (
      <AppShell allow={["admin"]}>
        {view === "workers" ? (
          <WorkerOverviewContent
            role={user.roleKey}
            showBackLink
            backHref={`/admin/users/${user.id}`}
          />
        ) : (
          <UserCompaniesOverview userId={user.id} role={user.roleKey} />
        )}
      </AppShell>
    );
  }

  return (
    <AppShell allow={["admin"]}>
      <section className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Bruger ikke fundet</h1>
        </div>

        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Brugeren findes ikke.
        </div>
      </section>
    </AppShell>
  );
}

function UserCompaniesOverview({ userId, role }: { userId: string; role: "bruger" | "bruger2" }) {
  const [companies, setCompanies] = useState(listCompanies);

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const visibleCompanies = useMemo(
    () => companiesVisibleForRole(companies, role),
    [companies, role],
  );

  return (
    <>
      <div className="mb-6">
        <a
          href={`/admin/users/${userId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timesedler
        </a>
        <h1 className="mt-3 text-2xl font-semibold">Virksomheder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Oversigt over virksomheder der er placeret hos brugeren.
        </p>
      </div>

      {visibleCompanies.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen virksomheder er placeret hos brugeren.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCompanies.map((company) => (
            <UserCompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </>
  );
}

function UserCompanyCard({ company }: { company: Company }) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.contactName || "—"} · {company.contactPhone || "—"} ·{" "}
            {company.contactEmail || "—"}
          </p>
          <p className="text-sm text-muted-foreground">{company.address || "—"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            CVR.nr {company.cvrNumber || "—"} · {company.projects.length} projekt(er) ·{" "}
            {company.localAgreements.length} lokalaftale(r)
          </p>
        </div>
      </div>
    </article>
  );
}
