import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { companyOwnerForRole } from "@/lib/company-access";
import { useAuth } from "@/lib/auth";
import {
  createBlank,
  TRADE_SKILLS,
  upsert,
  WORKER_LANGUAGES,
  type TradeSkill,
  type WorkerLanguage,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/create-worker")({
  head: () => ({ meta: [{ title: "Admin — Opret vikar" }] }),
  component: CreateWorkerPage,
});

type FormState = {
  vikar: string;
  vikarCode: string;
  vikarEmail: string;
  vikarPhone: string;
  vikarAddress: string;
  vikarCpr: string;
  workerLanguage: WorkerLanguage;
  tradeSkills: TradeSkill[];
  competencies: string;
};

function initialForm(): FormState {
  return {
    vikar: "",
    vikarCode: "",
    vikarEmail: "",
    vikarPhone: "",
    vikarAddress: "",
    vikarCpr: "",
    workerLanguage: "da",
    tradeSkills: [],
    competencies: "",
  };
}

export function CreateWorkerPage() {
  const { role } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const ownerRole = companyOwnerForRole(role);

  const validateWorkerFields = () => {
    const nextErrors: string[] = [];
    if (!form.vikar.trim()) nextErrors.push("Vikarnavn mangler");
    if (!form.vikarCode.trim()) nextErrors.push("Kode mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.vikarEmail))
      nextErrors.push("Vikarens mail mangler eller er ugyldig");
    if (!form.vikarPhone.trim()) nextErrors.push("Vikarens telefon mangler");
    if (!form.vikarAddress.trim()) nextErrors.push("Adresse mangler");
    if (!form.vikarCpr.trim()) nextErrors.push("CPR-nr. mangler");
    if (!form.workerLanguage) nextErrors.push("Sprog mangler");
    if (!form.tradeSkills.length) nextErrors.push("Vælg mindst ét fag for vikaren");
    if (!form.competencies.trim()) nextErrors.push("Kompetencer mangler");
    return nextErrors;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateWorkerFields();
    setErrors(nextErrors);
    if (nextErrors.length) return;

    const now = new Date().toISOString();
    const worker = upsert({
      ...createBlank(),
      ownerRole,
      vikar: form.vikar.trim(),
      vikarCode: form.vikarCode.trim(),
      vikarEmail: form.vikarEmail.trim(),
      vikarPhone: form.vikarPhone.trim(),
      vikarAddress: form.vikarAddress.trim(),
      vikarCpr: form.vikarCpr.trim(),
      workerLanguage: form.workerLanguage,
      tradeSkills: form.tradeSkills,
      competencies: form.competencies.trim(),
      workerMustChangeAccessCode: false,
      contactPersonMustChangeAccessCode: false,
      createdAt: now,
      updatedAt: now,
    });

    setCreatedId(worker.id);
    setMessage("Vikaren er oprettet til senere brug.");
    setForm(initialForm());
  };

  return (
    <AppShell allow={["admin", "bruger", "bruger2"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Opret vikar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Opret en ny vikar til senere brug.</p>
        </div>
        {createdId && (
          <Link
            to="/admin/$id"
            params={{ id: createdId }}
            className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Åbn vikar →
          </Link>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="font-medium">Ret følgende før oprettelse:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="rounded-lg border bg-card p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vikarnavn *">
            <Input required value={form.vikar} onChange={(e) => update({ vikar: e.target.value })} />
          </Field>
          <Field label="Vikarens mail *">
            <Input
              required
              type="email"
              value={form.vikarEmail}
              onChange={(e) => update({ vikarEmail: e.target.value })}
            />
          </Field>
          <Field label="Kode *">
            <Input
              required
              value={form.vikarCode}
              onChange={(e) => update({ vikarCode: e.target.value })}
            />
          </Field>
          <Field label="Vikarens telefon *">
            <Input
              required
              value={form.vikarPhone}
              onChange={(e) => update({ vikarPhone: e.target.value })}
            />
          </Field>
          <Field label="Adresse *">
            <Input
              required
              value={form.vikarAddress}
              onChange={(e) => update({ vikarAddress: e.target.value })}
            />
          </Field>
          <Field label="CPR-nr. *">
            <Input
              required
              value={form.vikarCpr}
              onChange={(e) => update({ vikarCpr: e.target.value })}
            />
          </Field>
          <Field label="Sprog *">
            <select
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.workerLanguage}
              onChange={(e) => update({ workerLanguage: e.target.value as WorkerLanguage })}
            >
              {WORKER_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <TradeSkillPicker
              label="Vikarens fag *"
              selected={form.tradeSkills}
              onChange={(tradeSkills) => update({ tradeSkills })}
            />
          </div>
          <Field label="Kompetencer *" className="md:col-span-2">
            <textarea
              required
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.competencies}
              onChange={(e) => update({ competencies: e.target.value })}
              placeholder="Beskriv hvad medarbejderen konkret skal kunne inden for sit fag."
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{message}</div>
          <Button type="submit">Opret vikar</Button>
        </div>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
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
      <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3 md:grid-cols-2">
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
