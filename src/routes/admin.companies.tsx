import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCompanies, removeCompany, saveCompany, type Company } from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/companies")({
  head: () => ({ meta: [{ title: "Admin — Virksomheder" }] }),
  component: CompaniesPage,
});

function blankCompany(): Company {
  return {
    id: crypto.randomUUID(),
    name: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    localAgreements: [],
  };
}

function CompaniesPage() {
  const [companies, setCompanies] = useState(listCompanies);
  const [editing, setEditing] = useState<Company | null>(null);
  const refresh = () => setCompanies(listCompanies());
  const update = (patch: Partial<Company>) => editing && setEditing({ ...editing, ...patch });
  const save = () => {
    if (!editing?.name.trim()) return;
    saveCompany(editing);
    refresh();
    setEditing(null);
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Virksomheder og lokalaftaler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gem kontaktoplysninger og lokale aftaler til genbrug på timesedler.
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
                  {company.contactName} · {company.contactPhone || "—"} · {company.contactEmail}
                </div>
                <div className="text-sm text-muted-foreground">{company.address}</div>
                <div className="mt-2 text-xs">{company.localAgreements.length} lokalaftale(r)</div>
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
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-5"
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
            </div>
            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-semibold">Lokalaftaler</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update({
                    localAgreements: [
                      ...editing.localAgreements,
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
              {editing.localAgreements.map((agreement, index) => (
                <div key={agreement.id} className="rounded-md border p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Navn">
                      <Input
                        value={agreement.name}
                        onChange={(e) =>
                          updateAgreement(editing, setEditing, index, { name: e.target.value })
                        }
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Gyldig fra">
                        <Input
                          type="date"
                          value={agreement.validFrom}
                          onChange={(e) =>
                            updateAgreement(editing, setEditing, index, {
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
                            updateAgreement(editing, setEditing, index, { validTo: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <label className="md:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium">
                        Beskrivelse og tillæg
                      </span>
                      <textarea
                        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={agreement.description}
                        onChange={(e) =>
                          updateAgreement(editing, setEditing, index, {
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
                        localAgreements: editing.localAgreements.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Fjern lokalaftale
                  </button>
                </div>
              ))}
            </div>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
