import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import {
  createTimesheetForWorker,
  listCompanies,
  upsert,
  type CreateWorkerTimesheetInput,
} from "@/lib/timesheet-store";
import { sendWorkerInviteEmail } from "@/lib/timesheet-mail";
import { buildWorkerInviteUrl } from "@/lib/worker-invite";

export const Route = createFileRoute("/admin/create-worker")({
  head: () => ({ meta: [{ title: "Admin — Opret vikar" }] }),
  component: CreateWorkerPage,
});

type FormState = Omit<CreateWorkerTimesheetInput, "hourlyWage" | "defaultPause"> & {
  hourlyWage: string;
  defaultPause: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialForm(): FormState {
  return {
    vikar: "",
    vikarEmail: "",
    brugervirksomhed: "",
    arbejdssted: "",
    kontaktperson: "",
    kontaktpersonPhone: "",
    kontaktpersonEmail: "",
    referenceNo: "",
    selectedAgreementId: "",
    hourlyWage: "",
    defaultStart: "07:00",
    defaultEnd: "15:30",
    defaultPause: "60",
    startDate: todayISO(),
    workerAccessCode: "",
  };
}

function CreateWorkerPage() {
  const navigate = useNavigate();
  const companies = listCompanies();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const selectCompany = (name: string) => {
    const company = companies.find((item) => item.name === name);
    update({
      brugervirksomhed: name,
      ...(company
        ? {
            arbejdssted: company.address,
            kontaktperson: company.contactName,
            kontaktpersonPhone: company.contactPhone,
            kontaktpersonEmail: company.contactEmail,
          }
        : {}),
    });
  };

  const validateForm = () => {
    const nextErrors: string[] = [];
    if (!form.vikar.trim()) nextErrors.push("Vikarnavn mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.vikarEmail))
      nextErrors.push("Vikarens mail mangler eller er ugyldig");
    if (!form.brugervirksomhed.trim()) nextErrors.push("Brugervirksomhed mangler");
    if (!form.arbejdssted.trim()) nextErrors.push("Brugervirksomhed adresse/arbejdssted mangler");
    if (!form.kontaktperson.trim()) nextErrors.push("Kontaktperson mangler");
    if (!form.kontaktpersonPhone.trim()) nextErrors.push("Kontaktperson telefonnummer mangler");
    if (!/^\S+@\S+\.\S+$/.test(form.kontaktpersonEmail))
      nextErrors.push("Kontaktpersonens mail mangler eller er ugyldig");
    if (!form.selectedAgreementId) nextErrors.push("Overenskomst mangler");
    if (!Number.isFinite(Number(form.hourlyWage)) || Number(form.hourlyWage) <= 0)
      nextErrors.push("Timeløn skal være et tal over 0");
    if (!form.defaultStart || !form.defaultEnd) nextErrors.push("Arbejdstider skal udfyldes");
    if (!Number.isFinite(Number(form.defaultPause)) || Number(form.defaultPause) < 0)
      nextErrors.push("Pause skal være et tal på 0 minutter eller mere");
    if (!form.startDate) nextErrors.push("Startdato mangler");
    if (!/^\d{4}$/.test(form.workerAccessCode))
      nextErrors.push("Midlertidig login-kode skal være 4 cifre");
    return nextErrors;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setSending(true);
    setMessage("Opretter timeseddel og sender invitation til vikaren…");

    const timesheet = upsert(
      createTimesheetForWorker({
        ...form,
        hourlyWage: Number(form.hourlyWage),
        defaultPause: Number(form.defaultPause),
      }),
    );
    setCreatedId(timesheet.id);

    try {
      const inviteUrl = buildWorkerInviteUrl(timesheet);
      const result = await sendWorkerInviteEmail(timesheet, inviteUrl);
      setMessage(
        result === "api"
          ? "Vikaren er oprettet, og invitationsmailen er sendt."
          : "Vikaren er oprettet. Mailappen er åbnet som fallback, fordi mailsystemet ikke svarede.",
      );
    } catch {
      setMessage(
        "Vikaren er oprettet, men invitationsmailen kunne ikke sendes automatisk. Prøv igen eller send manuelt.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Opret vikar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opret timeseddel, forudfyld arbejdsoplysninger og send loginlink til vikaren.
          </p>
        </div>
        {createdId && (
          <Link
            to="/admin/$id"
            params={{ id: createdId }}
            className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Åbn timeseddel →
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
            <Input value={form.vikar} onChange={(e) => update({ vikar: e.target.value })} />
          </Field>
          <Field label="Vikarens mail *">
            <Input
              type="email"
              value={form.vikarEmail}
              onChange={(e) => update({ vikarEmail: e.target.value })}
            />
          </Field>
          <Field label="Midlertidig login-kode *">
            <Input
              inputMode="numeric"
              maxLength={4}
              value={form.workerAccessCode}
              onChange={(e) =>
                update({ workerAccessCode: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder="Sidste 4 cifre"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Bruges som første login. Vikaren bliver bedt om at ændre adgangskoden efter login.
            </p>
          </Field>
          <Field label="Brugervirksomhed *">
            <Input
              list="admin-create-company-list"
              value={form.brugervirksomhed}
              onChange={(e) => selectCompany(e.target.value)}
            />
            <datalist id="admin-create-company-list">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Brugervirksomhed adresse / arbejdssted *">
            <Input
              value={form.arbejdssted}
              onChange={(e) => update({ arbejdssted: e.target.value })}
            />
          </Field>
          <Field label="Kontaktperson *">
            <Input
              value={form.kontaktperson}
              onChange={(e) => update({ kontaktperson: e.target.value })}
            />
          </Field>
          <Field label="Kontaktperson telefonnummer *">
            <Input
              value={form.kontaktpersonPhone}
              onChange={(e) => update({ kontaktpersonPhone: e.target.value })}
            />
          </Field>
          <Field label="Kontaktpersonens mail *">
            <Input
              type="email"
              value={form.kontaktpersonEmail}
              onChange={(e) => update({ kontaktpersonEmail: e.target.value })}
            />
          </Field>
          <Field label="Evt. reference nr.">
            <Input
              value={form.referenceNo}
              onChange={(e) => update({ referenceNo: e.target.value })}
            />
          </Field>
          <Field label="Overenskomst *">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.selectedAgreementId}
              onChange={(e) => update({ selectedAgreementId: e.target.value })}
            >
              <option value="">Vælg overenskomst…</option>
              {activeCollectiveAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} — {agreement.industryArea}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timeløn *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.hourlyWage}
              onChange={(e) => update({ hourlyWage: e.target.value })}
            />
          </Field>
          <Field label="Startdato *">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <Field label="Start">
              <Input
                type="time"
                step={300}
                value={form.defaultStart}
                onChange={(e) => update({ defaultStart: e.target.value })}
              />
            </Field>
            <Field label="Slut">
              <Input
                type="time"
                step={300}
                value={form.defaultEnd}
                onChange={(e) => update({ defaultEnd: e.target.value })}
              />
            </Field>
            <Field label="Pause">
              <Input
                type="number"
                min={0}
                step={5}
                value={form.defaultPause}
                onChange={(e) => update({ defaultPause: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{message}</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin" })}>
              Annullér
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "Sender…" : "Opret vikar og send mail"}
            </Button>
          </div>
        </div>
      </form>
    </AppShell>
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
