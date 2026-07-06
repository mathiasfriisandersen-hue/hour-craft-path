import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness, Building2, MapPin, Search, UsersRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import { companiesVisibleForRole, companyOwnerForRole } from "@/lib/company-access";
import { useAuth } from "@/lib/auth";
import { sendProjectConfirmationEmail } from "@/lib/timesheet-mail";
import { createShortWorkerInviteUrl } from "@/lib/worker-invite";
import {
  createTimesheetForWorker,
  generateOneTimeCode,
  listAll,
  listCompanies,
  listKnownWorkers,
  removeCompany,
  saveCompany,
  seedIfEmpty,
  TRADE_SKILLS,
  upsert,
  type Company,
  type CompanyProject,
  type KnownWorker,
  type Timesheet,
  type TradeSkill,
  type WorkPeriod,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/companies")({
  head: () => ({ meta: [{ title: "Admin — Virksomheder" }] }),
  component: CompaniesPage,
});

type CompanyKpiFilter = "companies" | "projects" | "localAgreements" | "contacts";

function blankProject(): CompanyProject {
  return {
    id: crypto.randomUUID(),
    name: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    referenceNo: "",
    startDate: "",
    endDate: "",
    selectedAgreementId: "",
    tradeSkills: [],
    competencies: "",
    workerEmails: [],
    workPeriod: "day",
    defaultStart: "07:00",
    defaultEnd: "15:00",
    pauseStart: "09:00",
    pauseEnd: "09:30",
    pause2Start: "12:00",
    pause2End: "12:30",
    billingHourlyWage: 0,
    billingFactor: 0,
  };
}

function blankCompany(): Company {
  return {
    id: crypto.randomUUID(),
    name: "",
    cvrNumber: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    selectedAgreementId: "",
    localAgreements: [],
    projects: [],
  };
}

function workPeriodTimes(workPeriod: WorkPeriod): { start: string; end: string } {
  if (workPeriod === "evening") return { start: "14:00", end: "23:00" };
  if (workPeriod === "night") return { start: "22:00", end: "07:00" };
  return { start: "07:00", end: "15:00" };
}

export function CompaniesPage() {
  const { role } = useAuth();
  const [companies, setCompanies] = useState(listCompanies);
  const [editing, setEditing] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<CompanyKpiFilter>("companies");
  const knownWorkers = listKnownWorkers();
  const refresh = () => setCompanies(listCompanies());
  const visibleCompanies = companiesVisibleForRole(companies, role);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const projectRows = visibleCompanies.flatMap((company) =>
    company.projects.map((project) => ({ company, project })),
  );
  const localAgreementRows = visibleCompanies.flatMap((company) =>
    company.localAgreements.map((agreement) => ({ company, agreement })),
  );
  const contactRows = visibleCompanies.flatMap((company) => {
    const rows = [];
    if (company.contactName || company.contactPhone || company.contactEmail) {
      rows.push({
        company,
        title: company.contactName || "Kontaktperson",
        subtitle: "Virksomhed",
        phone: company.contactPhone,
        email: company.contactEmail,
      });
    }
    company.projects.forEach((project) => {
      if (project.contactName || project.contactPhone || project.contactEmail) {
        rows.push({
          company,
          title: project.contactName || "Kontaktperson",
          subtitle: project.name || "Projekt",
          phone: project.contactPhone,
          email: project.contactEmail,
        });
      }
    });
    return rows;
  });
  const filteredCompanies = visibleCompanies.filter(
    (company) => !normalizedSearch || companySearchText(company).includes(normalizedSearch),
  );
  const filteredProjectRows = projectRows.filter(
    (row) =>
      !normalizedSearch || projectSearchText(row.company, row.project).includes(normalizedSearch),
  );
  const filteredLocalAgreementRows = localAgreementRows.filter(
    (row) =>
      !normalizedSearch ||
      localAgreementSearchText(row.company, row.agreement).includes(normalizedSearch),
  );
  const filteredContactRows = contactRows.filter(
    (row) => !normalizedSearch || contactSearchText(row).includes(normalizedSearch),
  );
  const totalProjects = projectRows.length;
  const totalLocalAgreements = localAgreementRows.length;
  const totalContacts = contactRows.length;
  const update = (patch: Partial<Company>) => editing && setEditing({ ...editing, ...patch });
  useEffect(() => {
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);
  const save = () => {
    if (!editing?.name.trim()) return;
    saveCompany(editing);
    refresh();
    setEditing(null);
  };

  useEffect(() => {
    seedIfEmpty();
    refresh();
  }, []);

  return (
    <AppShell
      allow={["admin", "bruger", "bruger2"]}
      dashboard={{
        title: "Virksomheder, projekter og lokalaftaler",
        subtitle:
          "Gem virksomheder, projekter/afdelinger, kontaktpersoner og standardoplysninger til oprettelse af vikarer.",
      }}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Søg på virksomheder, projekter og kontaktpersoner"
              className="h-10 rounded-lg pl-9"
            />
          </label>
          <Button
            className="shrink-0 shadow-sm"
            onClick={() => setEditing({ ...blankCompany(), ownerRole: companyOwnerForRole(role) })}
          >
            Ny virksomhed
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompanyKpiCard
            icon={<Building2 className="h-5 w-5" />}
            label="Virksomheder"
            value={visibleCompanies.length}
            tone="blue"
            active={activeFilter === "companies"}
            onClick={() => setActiveFilter("companies")}
          />
          <CompanyKpiCard
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            label="Projekter"
            value={totalProjects}
            tone="green"
            active={activeFilter === "projects"}
            onClick={() => setActiveFilter("projects")}
          />
          <CompanyKpiCard
            icon={<MapPin className="h-5 w-5" />}
            label="Lokalaftaler"
            value={totalLocalAgreements}
            tone="violet"
            active={activeFilter === "localAgreements"}
            onClick={() => setActiveFilter("localAgreements")}
          />
          <CompanyKpiCard
            icon={<UsersRound className="h-5 w-5" />}
            label="Kontaktpersoner"
            value={totalContacts}
            tone="orange"
            active={activeFilter === "contacts"}
            onClick={() => setActiveFilter("contacts")}
          />
        </div>

        <div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <div className="text-sm font-semibold text-muted-foreground">
                {companyFilterLabel(activeFilter)}
              </div>
            </div>

            {activeFilter === "companies" && filteredCompanies.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {visibleCompanies.length === 0
                  ? "Ingen virksomheder er oprettet endnu."
                  : "Ingen virksomheder matcher søgningen."}
              </div>
            )}
            {activeFilter === "companies" && filteredCompanies.length > 0 && (
              <div className="divide-y">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="grid gap-4 px-5 py-4 transition hover:bg-muted/30 lg:grid-cols-[minmax(0,1fr)_120px_120px_auto]"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">{company.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {company.contactName || "—"} · {company.contactPhone || "—"} ·{" "}
                          {company.contactEmail || "—"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          CVR.nr: {company.cvrNumber || "—"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {company.address || "—"}
                        </div>
                      </div>
                    </div>

                    <CompanyCount value={company.projects.length} label="projekter" />
                    <CompanyCount value={company.localAgreements.length} label="lokalaftaler" />

                    <div className="flex items-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(company)}>
                        Redigér
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`Slet ${company.name}?`)) {
                            removeCompany(company.id);
                            refresh();
                          }
                        }}
                      >
                        Slet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFilter === "projects" && filteredProjectRows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Ingen projekter matcher søgningen.
              </div>
            )}
            {activeFilter === "projects" && filteredProjectRows.length > 0 && (
              <div className="divide-y">
                {filteredProjectRows.map(({ company, project }) => (
                  <div
                    key={`${company.id}:${project.id}`}
                    className="grid gap-4 px-5 py-4 transition hover:bg-muted/30 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{project.name || "—"}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{company.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {project.contactName || "—"} · {project.contactPhone || "—"} ·{" "}
                        {project.contactEmail || "—"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {project.startDate || "—"} – {project.endDate || "—"}
                    </div>
                    <div className="flex items-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(company)}>
                        Redigér
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFilter === "localAgreements" && filteredLocalAgreementRows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Ingen lokalaftaler matcher søgningen.
              </div>
            )}
            {activeFilter === "localAgreements" && filteredLocalAgreementRows.length > 0 && (
              <div className="divide-y">
                {filteredLocalAgreementRows.map(({ company, agreement }) => (
                  <div
                    key={`${company.id}:${agreement.id}`}
                    className="grid gap-4 px-5 py-4 transition hover:bg-muted/30 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{agreement.name || "—"}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{company.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {agreement.description || "—"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {agreement.validFrom || "—"} – {agreement.validTo || "—"}
                    </div>
                    <div className="flex items-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(company)}>
                        Redigér
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFilter === "contacts" && filteredContactRows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Ingen kontaktpersoner matcher søgningen.
              </div>
            )}
            {activeFilter === "contacts" && filteredContactRows.length > 0 && (
              <div className="divide-y">
                {filteredContactRows.map((row) => (
                  <div
                    key={`${row.company.id}:${row.subtitle}:${row.title}:${row.email}:${row.phone}`}
                    className="grid gap-4 px-5 py-4 transition hover:bg-muted/30 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{row.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{row.company.name}</div>
                      <div className="text-sm text-muted-foreground">{row.subtitle}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>{row.phone || "—"}</div>
                      <div>{row.email || "—"}</div>
                    </div>
                    <div className="flex items-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditing(row.company)}>
                        Redigér
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {companies.some((item) => item.id === editing.id)
                ? "Redigér virksomhed"
                : "Ny virksomhed"}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Virksomhedsnavn *">
                <Input value={editing.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="CVR.nr">
                <Input
                  value={editing.cvrNumber}
                  onChange={(e) => update({ cvrNumber: e.target.value })}
                />
              </Field>
              <Field label="Kontaktperson">
                <Input
                  value={editing.contactName}
                  onChange={(e) => update({ contactName: e.target.value })}
                />
              </Field>
              <Field label="Kontaktperson telefon">
                <Input
                  value={editing.contactPhone}
                  onChange={(e) => update({ contactPhone: e.target.value })}
                />
              </Field>
              <Field label="Kontaktmail">
                <Input
                  type="email"
                  value={editing.contactEmail}
                  onChange={(e) => update({ contactEmail: e.target.value })}
                />
              </Field>
              <Field label="Adresse">
                <Input
                  value={editing.address}
                  onChange={(e) => update({ address: e.target.value })}
                />
              </Field>
              <Field label="Standardoverenskomst">
                <AgreementSelect
                  value={editing.selectedAgreementId || ""}
                  emptyLabel="Ingen standardoverenskomst"
                  onChange={(value) => update({ selectedAgreementId: value })}
                />
              </Field>
            </div>

            <ProjectsSection
              company={editing}
              companies={companies}
              knownWorkers={knownWorkers}
              setCompany={setEditing}
            />

            <LocalAgreementsSection company={editing} setCompany={setEditing} update={update} />

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Annullér
              </Button>
              <Button onClick={save} disabled={!editing.name.trim()}>
                Gem virksomhed
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CompanyKpiCard({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "blue" | "green" | "violet" | "orange";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${active ? "border-blue-300 ring-2 ring-blue-100" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ${toneClass}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </button>
  );
}

function companySearchText(company: Company): string {
  return [
    company.name,
    company.cvrNumber,
    company.contactName,
    company.contactPhone,
    company.contactEmail,
    company.address,
    ...company.projects.flatMap((project) => [
      project.name,
      project.contactName,
      project.contactPhone,
      project.contactEmail,
      project.referenceNo,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function projectSearchText(company: Company, project: CompanyProject): string {
  return [
    company.name,
    company.cvrNumber,
    project.name,
    project.contactName,
    project.contactPhone,
    project.contactEmail,
    project.referenceNo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function localAgreementSearchText(
  company: Company,
  agreement: Company["localAgreements"][number],
): string {
  return [
    company.name,
    company.cvrNumber,
    agreement.name,
    agreement.description,
    agreement.validFrom,
    agreement.validTo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function contactSearchText(row: {
  company: Company;
  title: string;
  subtitle: string;
  phone: string;
  email: string;
}): string {
  return [row.company.name, row.company.cvrNumber, row.title, row.subtitle, row.phone, row.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function companyFilterLabel(filter: CompanyKpiFilter): string {
  if (filter === "projects") return "Projektliste";
  if (filter === "localAgreements") return "Lokalaftaler";
  if (filter === "contacts") return "Kontaktpersoner";
  return "Virksomhedsliste";
}

function CompanyCount({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-sm">
      <div className="font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ProjectsSection({
  company,
  companies,
  knownWorkers,
  setCompany,
}: {
  company: Company;
  companies: Company[];
  knownWorkers: ReturnType<typeof listKnownWorkers>;
  setCompany: (value: Company) => void;
}) {
  const [projectMailMessage, setProjectMailMessage] = useState("");
  const [sendingProjectId, setSendingProjectId] = useState<string | null>(null);
  const updateProject = (index: number, patch: Partial<CompanyProject>) => {
    setCompany({
      ...company,
      projects: company.projects.map((project, i) =>
        i === index ? { ...project, ...patch } : project,
      ),
    });
  };
  const sendProjectMail = async (project: CompanyProject) => {
    setSendingProjectId(project.id);
    setProjectMailMessage("Sender projektbekræftelse…");
    try {
      saveCompany(company);
      const workers = project.workerEmails
        .map((reference) => findWorkerByProjectReference(knownWorkers, reference))
        .filter((worker): worker is (typeof knownWorkers)[number] => Boolean(worker));

      if (workers.length === 0) {
        await sendProjectConfirmationEmail({ company, project });
      } else {
        for (const worker of workers) {
          const timesheet = ensureProjectTimesheet(company, project, worker);
          const workerInviteUrl = await createShortWorkerInviteUrl(timesheet);
          await sendProjectConfirmationEmail({
            company,
            project,
            worker,
            workerInviteUrl,
            workerAccessCode: timesheet.workerAccessCode,
          });
        }
      }
      setProjectMailMessage("Projektbekræftelse sendt.");
    } catch {
      setProjectMailMessage("Projektbekræftelsen kunne ikke sendes automatisk.");
    } finally {
      setSendingProjectId(null);
    }
  };

  return (
    <section className="mt-7 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Projekter</h3>
          <p className="text-xs text-muted-foreground">
            Opret afdelinger/projekter med egne fag, kontaktpersoner og evt. overenskomst.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setCompany({ ...company, projects: [...company.projects, blankProject()] })
          }
        >
          Opret projekt
        </Button>
      </div>

      <div className="mt-3 space-y-4">
        {projectMailMessage && (
          <div className="text-sm text-muted-foreground">{projectMailMessage}</div>
        )}
        {company.projects.length === 0 && (
          <div className="rounded-md border px-3 py-4 text-sm text-muted-foreground">
            Ingen projekter oprettet.
          </div>
        )}
        {company.projects.map((project, index) => {
          const matchingWorkers =
            project.tradeSkills.length === 0
              ? knownWorkers
              : knownWorkers.filter((worker) =>
                  worker.tradeSkills.some((skill) => project.tradeSkills.includes(skill)),
                );
          return (
            <details key={project.id} className="rounded-md border p-3" open>
              <summary className="cursor-pointer font-medium">
                {project.name || "Nyt projekt"}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · {project.tradeSkills.length} fag · {project.workerEmails.length} vikar(er)
                </span>
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Projektnavn">
                  <Input
                    value={project.name}
                    onChange={(e) => updateProject(index, { name: e.target.value })}
                  />
                </Field>
                <Field label="Projektets opstartsdato">
                  <Input
                    type="date"
                    value={project.startDate}
                    onChange={(e) => updateProject(index, { startDate: e.target.value })}
                  />
                </Field>
                <Field label="Projektets afslutning">
                  <Input
                    type="date"
                    value={project.endDate}
                    onChange={(e) => updateProject(index, { endDate: e.target.value })}
                  />
                </Field>
                <Field label="Kontaktperson">
                  <Input
                    value={project.contactName}
                    onChange={(e) => updateProject(index, { contactName: e.target.value })}
                  />
                </Field>
                <Field label="Telefonnr.">
                  <Input
                    value={project.contactPhone}
                    onChange={(e) => updateProject(index, { contactPhone: e.target.value })}
                  />
                </Field>
                <Field label="Mail">
                  <Input
                    type="email"
                    value={project.contactEmail}
                    onChange={(e) => updateProject(index, { contactEmail: e.target.value })}
                  />
                </Field>
                <Field label="Evt. reference nr.">
                  <Input
                    value={project.referenceNo}
                    onChange={(e) => updateProject(index, { referenceNo: e.target.value })}
                  />
                </Field>
                <Field label="Overenskomst">
                  <AgreementSelect
                    value={project.selectedAgreementId}
                    emptyLabel="Brug virksomhedens standard"
                    onChange={(value) => updateProject(index, { selectedAgreementId: value })}
                  />
                </Field>
                <div>
                  <span className="mb-1.5 block text-sm font-medium">Arbejdstid</span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["day", "Dag"],
                        ["evening", "Aften"],
                        ["night", "Nat"],
                      ] as Array<[WorkPeriod, string]>
                    ).map(([value, label]) => (
                      <label key={value} className="inline-flex items-center gap-1 text-sm">
                        <input
                          type="radio"
                          name={`work-period-${project.id}`}
                          checked={project.workPeriod === value}
                          onChange={() => {
                            const times = workPeriodTimes(value);
                            updateProject(index, {
                              workPeriod: value,
                              defaultStart: times.start,
                              defaultEnd: times.end,
                            });
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <TimeRangeField
                  label="Arbejdstid start/slut"
                  start={project.defaultStart}
                  end={project.defaultEnd}
                  onStartChange={(value) => updateProject(index, { defaultStart: value })}
                  onEndChange={(value) => updateProject(index, { defaultEnd: value })}
                />
                <TimeRangeField
                  label="Pause 1 start/slut"
                  start={project.pauseStart}
                  end={project.pauseEnd}
                  onStartChange={(value) => updateProject(index, { pauseStart: value })}
                  onEndChange={(value) => updateProject(index, { pauseEnd: value })}
                />
                <TimeRangeField
                  label="Pause 2 start/slut"
                  start={project.pause2Start}
                  end={project.pause2End}
                  onStartChange={(value) => updateProject(index, { pause2Start: value })}
                  onEndChange={(value) => updateProject(index, { pause2End: value })}
                />
                <div className="md:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Afregning</span>
                  <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-3">
                    <Field label="Timeløn">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={project.billingHourlyWage || ""}
                        onChange={(e) =>
                          updateProject(index, { billingHourlyWage: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                    <Field label="Faktor">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={project.billingFactor || ""}
                        onChange={(e) =>
                          updateProject(index, { billingFactor: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                    <Field label="Total til kunden">
                      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                        {formatProjectBilling(project)}
                      </div>
                    </Field>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <TradeSkillPicker
                    label="Fag"
                    selected={project.tradeSkills}
                    onChange={(tradeSkills) => updateProject(index, { tradeSkills })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Field label="Kompetencer">
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={project.competencies}
                      onChange={(e) => updateProject(index, { competencies: e.target.value })}
                      placeholder="Beskriv hvad medarbejderen konkret skal kunne inden for projektets fagområde."
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Tilknyttede vikarer</span>
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Viser vikarer med matchende fag. Hvis projektet ikke har fag, vises alle
                      tidligere oprettede vikarer.
                    </p>
                    {matchingWorkers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Ingen tidligere vikarer matcher de valgte fag.
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {matchingWorkers.map((worker) => {
                          const conflict = workerProjectConflict(
                            companies,
                            company.id,
                            project,
                            worker,
                            knownWorkers,
                          );
                          const disabled = Boolean(conflict);
                          const isAttached = project.workerEmails.some((reference) =>
                            projectReferenceMatchesWorker(reference, worker, knownWorkers),
                          );
                          return (
                            <label
                              key={worker.key}
                              className="flex items-start gap-2 text-sm"
                              title={conflict ? `Vikaren er allerede tilknyttet ${conflict}` : ""}
                            >
                              <input
                                type="checkbox"
                                checked={isAttached}
                                disabled={disabled && !isAttached}
                                onChange={(e) => {
                                  const workerEmails = e.target.checked
                                    ? [...new Set([...project.workerEmails, worker.key])]
                                    : project.workerEmails.filter(
                                        (reference) =>
                                          !projectReferenceMatchesWorker(
                                            reference,
                                            worker,
                                            knownWorkers,
                                          ),
                                      );
                                  updateProject(index, { workerEmails });
                                }}
                              />
                              <span>
                                <span className="font-medium">{worker.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {worker.tradeSkills.join(", ") || "Ingen fag"}
                                </span>
                                {worker.competencies && (
                                  <span className="block text-xs text-muted-foreground">
                                    Kompetencer: {worker.competencies}
                                  </span>
                                )}
                                {conflict && (
                                  <span className="block text-xs text-status-rejected-fg">
                                    Optaget på {conflict} i projektperioden.
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendProjectMail(project)}
                  disabled={
                    sendingProjectId === project.id ||
                    !(project.contactEmail || company.contactEmail)
                  }
                >
                  {sendingProjectId === project.id ? "Sender…" : "Send projektmail"}
                </Button>
                <button
                  className="text-xs font-medium text-status-rejected-fg"
                  onClick={() =>
                    setCompany({
                      ...company,
                      projects: company.projects.filter((_, i) => i !== index),
                    })
                  }
                >
                  Slet projekt
                </button>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function projectDatesOverlap(a: CompanyProject, b: CompanyProject): boolean {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return false;
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function formatProjectBilling(project: CompanyProject): string {
  const hourlyWage = Number(project.billingHourlyWage) || 0;
  const factor = Number(project.billingFactor) || 0;
  const total = hourlyWage * factor;
  if (!hourlyWage || !factor) return "—";
  return `${formatNumber(hourlyWage)} * ${formatNumber(factor)} = ${formatDkk(total)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDkk(value: number): string {
  return `${formatNumber(value)} DKK`;
}

function workerProjectConflict(
  companies: Company[],
  currentCompanyId: string,
  currentProject: CompanyProject,
  worker: ReturnType<typeof listKnownWorkers>[number],
  knownWorkers: ReturnType<typeof listKnownWorkers>,
): string {
  if (!currentProject.startDate || !currentProject.endDate) return "";
  for (const company of companies) {
    for (const project of company.projects) {
      if (company.id === currentCompanyId && project.id === currentProject.id) continue;
      if (
        !project.workerEmails.some((reference) =>
          projectReferenceMatchesWorker(reference, worker, knownWorkers),
        )
      ) {
        continue;
      }
      if (projectDatesOverlap(currentProject, project)) {
        return `${company.name} / ${project.name || "unavngivet projekt"} (${formatDate(project.startDate)} – ${formatDate(project.endDate)})`;
      }
    }
  }
  return "";
}

function findWorkerByProjectReference(
  knownWorkers: ReturnType<typeof listKnownWorkers>,
  reference: string,
): ReturnType<typeof listKnownWorkers>[number] | undefined {
  const referenceKey = normalizeReference(reference);
  if (!referenceKey) return undefined;

  const directMatch = knownWorkers.find((worker) => {
    const workerNameKey = normalizeReference(worker.name || worker.key);
    const workerCodeKey = normalizeReference(worker.code);
    return referenceKey === workerNameKey || referenceKey === workerCodeKey;
  });
  if (directMatch) return directMatch;

  const emailMatches = knownWorkers.filter(
    (worker) => normalizeReference(worker.email) === referenceKey,
  );
  return emailMatches.length === 1 ? emailMatches[0] : undefined;
}

function projectReferenceMatchesWorker(
  reference: string,
  worker: KnownWorker,
  knownWorkers: ReturnType<typeof listKnownWorkers>,
): boolean {
  const referenceKey = normalizeReference(reference);
  if (!referenceKey) return false;

  const workerNameKey = normalizeReference(worker.name || worker.key);
  const workerCodeKey = normalizeReference(worker.code);
  if (referenceKey === workerNameKey || referenceKey === workerCodeKey) return true;

  const emailMatches = knownWorkers.filter(
    (candidate) => normalizeReference(candidate.email) === referenceKey,
  );
  return emailMatches.length === 1 && emailMatches[0]?.key === worker.key;
}

function ensureProjectTimesheet(
  company: Company,
  project: CompanyProject,
  worker: KnownWorker,
): Timesheet {
  const existing = listAll().find((timesheet) => {
    const workerMatch = projectWorkerMatchesTimesheet(worker, timesheet);
    const projectMatch =
      timesheet.projectId === project.id ||
      (timesheet.brugervirksomhed === company.name &&
        timesheet.projectName === project.name &&
        timesheet.projectEndDate === project.endDate);
    return workerMatch && projectMatch;
  });

  if (existing) {
    return upsert({
      ...existing,
      workerLanguage: existing.workerLanguage || worker.language,
      workerAccessCode: existing.workerAccessCode || generateOneTimeCode(),
      workerMustChangeAccessCode: existing.workerMustChangeAccessCode || !existing.workerAccessCode,
    });
  }

  return upsert(
    createTimesheetForWorker({
      vikar: worker.name,
      vikarCode: worker.code,
      vikarEmail: worker.email,
      vikarPhone: worker.phone,
      workerLanguage: worker.language,
      tradeSkills: project.tradeSkills.length ? project.tradeSkills : worker.tradeSkills,
      competencies: project.competencies || worker.competencies,
      brugervirksomhed: company.name,
      companyId: company.id,
      projectId: project.id,
      projectName: project.name,
      projectEndDate: project.endDate,
      arbejdssted: company.address,
      kontaktperson: project.contactName || company.contactName,
      kontaktpersonPhone: project.contactPhone || company.contactPhone,
      kontaktpersonEmail: project.contactEmail || company.contactEmail,
      referenceNo: project.referenceNo,
      selectedAgreementId: project.selectedAgreementId || company.selectedAgreementId || "",
      hourlyWage: 0,
      defaultStart: project.defaultStart,
      defaultEnd: project.defaultEnd,
      defaultPause: 0,
      defaultPauseStart: project.pauseStart,
      defaultPauseEnd: project.pauseEnd,
      defaultPause2Start: project.pause2Start,
      defaultPause2End: project.pause2End,
      defaultDayWorkStart: project.workPeriod === "day" ? project.defaultStart : "",
      defaultDayWorkEnd: project.workPeriod === "day" ? project.defaultEnd : "",
      defaultEveningWorkStart: project.workPeriod === "evening" ? project.defaultStart : "",
      defaultEveningWorkEnd: project.workPeriod === "evening" ? project.defaultEnd : "",
      defaultNightWorkStart: project.workPeriod === "night" ? project.defaultStart : "",
      defaultNightWorkEnd: project.workPeriod === "night" ? project.defaultEnd : "",
      shiftWorkApplies: false,
      startDate: project.startDate,
      workerAccessCode: generateOneTimeCode(),
      contactPersonAccessCode: generateOneTimeCode(),
      ownerRole: company.ownerRole,
    }),
  );
}

function projectWorkerMatchesTimesheet(worker: KnownWorker, timesheet: Timesheet): boolean {
  const workerNameKey = normalizeReference(worker.name || worker.key);
  const timesheetNameKey = normalizeReference(timesheet.vikar);
  if (workerNameKey && timesheetNameKey) return workerNameKey === timesheetNameKey;

  const workerCodeKey = normalizeReference(worker.code);
  const timesheetCodeKey = normalizeReference(timesheet.vikarCode ?? "");
  if (workerCodeKey && timesheetCodeKey) return workerCodeKey === timesheetCodeKey;

  const workerEmailKey = normalizeReference(worker.email);
  const timesheetEmailKey = normalizeReference(timesheet.vikarEmail);
  return Boolean(workerEmailKey && timesheetEmailKey && workerEmailKey === timesheetEmailKey);
}

function normalizeReference(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function LocalAgreementsSection({
  company,
  setCompany,
  update,
}: {
  company: Company;
  setCompany: (value: Company) => void;
  update: (patch: Partial<Company>) => void;
}) {
  return (
    <section className="mt-7 border-t pt-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Lokalaftaler</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              localAgreements: [
                ...company.localAgreements,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  description: "",
                  validFrom: "",
                  validTo: "",
                },
              ],
            })
          }
        >
          Tilføj lokalaftale
        </Button>
      </div>
      <div className="mt-3 space-y-3">
        {company.localAgreements.map((agreement, index) => (
          <div key={agreement.id} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Navn">
                <Input
                  value={agreement.name}
                  onChange={(e) =>
                    updateAgreement(company, setCompany, index, { name: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Gyldig fra">
                  <Input
                    type="date"
                    value={agreement.validFrom}
                    onChange={(e) =>
                      updateAgreement(company, setCompany, index, {
                        validFrom: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Gyldig til">
                  <Input
                    type="date"
                    value={agreement.validTo}
                    onChange={(e) =>
                      updateAgreement(company, setCompany, index, { validTo: e.target.value })
                    }
                  />
                </Field>
              </div>
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">Beskrivelse og tillæg</span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={agreement.description}
                  onChange={(e) =>
                    updateAgreement(company, setCompany, index, {
                      description: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <button
              className="mt-2 text-xs font-medium text-status-rejected-fg"
              onClick={() =>
                update({
                  localAgreements: company.localAgreements.filter((_, i) => i !== index),
                })
              }
            >
              Fjern lokalaftale
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function updateAgreement(
  company: Company,
  setCompany: (value: Company) => void,
  index: number,
  patch: Partial<Company["localAgreements"][number]>,
) {
  setCompany({
    ...company,
    localAgreements: company.localAgreements.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    ),
  });
}

function AgreementSelect({
  value,
  emptyLabel,
  onChange,
}: {
  value: string;
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {activeCollectiveAgreements.map((agreement) => (
        <option key={agreement.id} value={agreement.id}>
          {agreement.name}
        </option>
      ))}
    </select>
  );
}

function TradeSkillPicker({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: TradeSkill[];
  onChange: (value: TradeSkill[]) => void;
}) {
  const toggle = (skill: TradeSkill, checked: boolean) => {
    onChange(
      checked ? [...new Set([...selected, skill])] : selected.filter((item) => item !== skill),
    );
  };
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border p-3 md:grid-cols-2">
        {TRADE_SKILLS.map((skill) => (
          <label key={skill} className="inline-flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(skill)}
              onChange={(e) => toggle(skill, e.target.checked)}
            />
            {skill}
          </label>
        ))}
      </div>
    </div>
  );
}

function TimeRangeField({
  label,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  label: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          step={300}
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="time" step={300} value={end} onChange={(e) => onEndChange(e.target.value)} />
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
