import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { companyOwnerForRole } from "@/lib/company-access";
import { useAuth } from "@/lib/auth";
import {
  createBlank,
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

const CREATE_WORKER_TRADE_SKILLS: TradeSkill[] = [
  "Industri / produktion",
  "Smed / metal",
  "CNC / maskinarbejde",
  "Tømrer / snedker",
  "Anlæg",
  "Murer",
  "Montage",
  "Svejser",
  "Træ / møbel",
  "Byggeri / håndværk",
  "Jord / beton",
  "Murerarbejdsmand",
];

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
    <AppShell
      allow={["admin", "bruger", "bruger2"]}
      dashboard={{
        title: "Opret vikar",
        subtitle: "Opret en ny vikar til senere brug.",
      }}
    >
      {(errors.length > 0 || message || createdId) && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          {errors.length > 0 && (
            <div className="text-sm text-red-700">
              <div className="font-semibold">Ret følgende før oprettelse:</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {message && errors.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-700">
              <span className="font-semibold">{message}</span>
              {createdId && (
                <Link
                  to="/admin/$id"
                  params={{ id: createdId }}
                  className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Åbn vikar →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
          <Field label="Vikarnavn *">
            <Input
              required
              value={form.vikar}
              onChange={(e) => update({ vikar: e.target.value })}
              placeholder="Indtast vikarens navn"
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="Vikarens mail *">
            <Input
              required
              type="email"
              value={form.vikarEmail}
              onChange={(e) => update({ vikarEmail: e.target.value })}
              placeholder="Indtast vikarens mail"
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="Kode *">
            <Input
              required
              value={form.vikarCode}
              onChange={(e) => update({ vikarCode: e.target.value })}
              placeholder="Indtast kode"
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="Vikarens telefon *">
            <Input
              required
              value={form.vikarPhone}
              onChange={(e) => update({ vikarPhone: e.target.value })}
              placeholder="Indtast vikarens telefon"
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="Adresse *">
            <Input
              required
              value={form.vikarAddress}
              onChange={(e) => update({ vikarAddress: e.target.value })}
              placeholder="Indtast adresse"
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="CPR-nr. *">
            <Input
              required
              value={form.vikarCpr}
              onChange={(e) => update({ vikarCpr: e.target.value })}
              placeholder="Indtast CPR-nr."
              className="h-11 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
            />
          </Field>
          <Field label="Sprog *">
            <select
              required
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
          <Field label="Kompetencer *" className="lg:col-span-2">
            <textarea
              required
              className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={form.competencies}
              onChange={(e) => update({ competencies: e.target.value })}
              placeholder="Beskriv hvad medarbejderen konkret skal kunne inden for sit fag."
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            className="h-11 rounded-lg bg-blue-600 px-7 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Opret vikar
          </Button>
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
      <span className="mb-2 block text-sm font-semibold text-slate-900">{label}</span>
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
      <span className="mb-2 block text-sm font-semibold text-slate-900">{label}</span>
      <div className="grid gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        {CREATE_WORKER_TRADE_SKILLS.map((skill) => (
          <label key={skill} className="inline-flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={selected.includes(skill)}
              onChange={(e) => toggle(skill, e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {skill}
          </label>
        ))}
      </div>
    </div>
  );
}
