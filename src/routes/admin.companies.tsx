import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import { sendProjectConfirmationEmail } from "@/lib/timesheet-mail";
import {
  listCompanies,
  listKnownWorkers,
  removeCompany,
  saveCompany,
  TRADE_SKILLS,
  workerReferenceKeys,
  type Company,
  type CompanyProject,
  type TradeSkill,
  type WorkPeriod,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/companies")({
  head: () => ({ meta: [{ title: "Admin — Virksomheder" }] }),
  component: CompaniesPage,
});

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
    pauseStart: "",
    pauseEnd: "",
    pause2Start: "",
    pause2End: "",
  };
}

function blankCompany(): Company {
  return {
    id: crypto.randomUUID(),
    name: "",
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

function CompaniesPage() {
  const [companies, setCompanies] = useState(listCompanies);
  const [editing, setEditing] = useState<Company | null>(null);
  const knownWorkers = listKnownWorkers();
  const refresh = () => setCompanies(listCompanies());
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

  return (
    <AppShell allow={["admin", "bruger"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Virksomheder, projekter og lokalaftaler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gem virksomheder, projekter/afdelinger, kontaktpersoner og standardoplysninger til
            oprettelse af vikarer.
          </p>
        </div>
        <Button onClick={() => setEditing(blankCompany())}>Ny virksomhed</Button>
      </div>
      <div className="space-y-3">
        {companies.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Ingen virksomheder er oprettet endnu.
          </div>
        )}
        {companies.map((company) => (
          <div key={company.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{company.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {company.contactName || "—"} · {company.contactPhone || "—"} ·{" "}
                  {company.contactEmail || "—"}
                </div>
                <div className="text-sm text-muted-foreground">{company.address || "—"}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {company.projects.length} projekt(er) · {company.localAgreements.length}{" "}
                  lokalaftale(r)
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(company)}>
                  Redigér
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
          </div>
        ))}
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
      const workers = project.workerEmails
        .map((reference) =>
          knownWorkers.find((worker) =>
            workerReferenceKeys(worker).includes(reference.toLowerCase()),
          ),
        )
        .filter((worker): worker is (typeof knownWorkers)[number] => Boolean(worker));

      if (workers.length === 0) {
        await sendProjectConfirmationEmail({ company, project });
      } else {
        for (const worker of workers) {
          await sendProjectConfirmationEmail({ company, project, worker });
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
                          );
                          const disabled = Boolean(conflict);
                          const workerReferences = workerReferenceKeys(worker);
                          const isAttached = project.workerEmails.some((reference) =>
                            workerReferences.includes(reference.toLowerCase()),
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
                                          !workerReferences.includes(reference.toLowerCase()),
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

function workerProjectConflict(
  companies: Company[],
  currentCompanyId: string,
  currentProject: CompanyProject,
  worker: ReturnType<typeof listKnownWorkers>[number],
): string {
  if (!currentProject.startDate || !currentProject.endDate) return "";
  const references = workerReferenceKeys(worker);
  for (const company of companies) {
    for (const project of company.projects) {
      if (company.id === currentCompanyId && project.id === currentProject.id) continue;
      if (!project.workerEmails.some((item) => references.includes(item.toLowerCase()))) continue;
      if (projectDatesOverlap(currentProject, project)) {
        return `${company.name} / ${project.name || "unavngivet projekt"} (${formatDate(project.startDate)} – ${formatDate(project.endDate)})`;
      }
    }
  }
  return "";
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
