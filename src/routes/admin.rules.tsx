import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, InfoBanner } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRules, saveRule } from "@/lib/timesheet-store";
import type { AgreementRule } from "@/lib/agreementRules";
import {
  collectiveAgreements,
  getCollectiveAgreementById,
  publicAgreementPdfHref,
} from "@/lib/collectiveAgreements";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({ meta: [{ title: "Admin — Regelgrundlag" }] }),
  component: RulesPage,
});

function RulesPage() {
  const [rules, setRules] = useState(listRules);
  const [selectedId, setSelectedId] = useState(rules[0]?.agreementId ?? "");
  const [message, setMessage] = useState("");
  const rule = rules.find((item) => item.agreementId === selectedId);
  const agreement = rule ? getCollectiveAgreementById(rule.agreementId) : undefined;

  const update = (patch: Partial<AgreementRule>) => {
    setRules((current) =>
      current.map((item) => (item.agreementId === selectedId ? { ...item, ...patch } : item)),
    );
  };
  const save = () => {
    if (!rule) return;
    saveRule(rule);
    setRules(listRules());
    setMessage("Regelgrundlaget er gemt i denne browser.");
    window.setTimeout(() => setMessage(""), 3000);
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Overenskomstregler</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vedligehold det regelgrundlag, som bruges i adminberegningen.
        </p>
      </div>
      <InfoBanner tone="warning">
        Systemet indeholder ingen forudfyldte satser. Indtast kun verificerede regler fra den
        gældende overenskomst, og angiv gyldighedsperioden.
      </InfoBanner>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[720px] overflow-y-auto rounded-lg border bg-card p-2">
          {collectiveAgreements.map((agreement) => (
            <button
              key={agreement.id}
              onClick={() => setSelectedId(agreement.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === agreement.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <span className="block">{agreement.name}</span>
              <span className="block text-xs opacity-80">{agreement.rateValidationStatus}</span>
            </button>
          ))}
        </aside>
        {rule && (
          <section className="rounded-lg border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{agreement?.name ?? rule.agreementId}</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                {agreement?.industryArea ?? "Ukendt brancheområde"} ·{" "}
                {agreement?.rateValidationStatus ?? "missing_pdf"}
              </div>
              {agreement?.pdfUrl && (
                <a
                  href={publicAgreementPdfHref(agreement.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Åbn PDF-kilde →
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Normal daglig arbejdstid (timer)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rule.normalDayHours ?? ""}
                  onChange={(e) =>
                    update({ normalDayHours: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Normal ugentlig arbejdstid (timer)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rule.normalWeekHours ?? ""}
                  onChange={(e) =>
                    update({ normalWeekHours: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Gyldig fra">
                <Input
                  type="date"
                  value={rule.validFrom}
                  onChange={(e) => update({ validFrom: e.target.value })}
                />
              </Field>
              <Field label="Gyldig til">
                <Input
                  type="date"
                  value={rule.validTo}
                  onChange={(e) => update({ validTo: e.target.value })}
                />
              </Field>
              <Field label="Aften starter">
                <Input
                  type="time"
                  value={rule.eveningStart}
                  onChange={(e) => update({ eveningStart: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nat starter">
                  <Input
                    type="time"
                    value={rule.nightStart}
                    onChange={(e) => update({ nightStart: e.target.value })}
                  />
                </Field>
                <Field label="Nat slutter">
                  <Input
                    type="time"
                    value={rule.nightEnd}
                    onChange={(e) => update({ nightEnd: e.target.value })}
                  />
                </Field>
              </div>
              <TextField
                label="Overarbejdsregel"
                value={rule.overtimeRule}
                onChange={(value) => update({ overtimeRule: value })}
              />
              <TextField
                label="Lørdagstillæg"
                value={rule.saturdayRule}
                onChange={(value) => update({ saturdayRule: value })}
              />
              <TextField
                label="Søndagstillæg"
                value={rule.sundayRule}
                onChange={(value) => update({ sundayRule: value })}
              />
              <TextField
                label="Aftentillæg"
                value={rule.eveningRule}
                onChange={(value) => update({ eveningRule: value })}
              />
              <TextField
                label="Nattillæg"
                value={rule.nightRule}
                onChange={(value) => update({ nightRule: value })}
              />
              <TextField
                label="Skifteholdstillæg"
                value={rule.shiftRule}
                onChange={(value) => update({ shiftRule: value })}
              />
              <TextField
                label="Særlige tillæg / noter"
                value={rule.specialRule}
                onChange={(value) => update({ specialRule: value })}
                className="md:col-span-2"
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{message}</span>
              <Button onClick={save}>Gem regler</Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
