import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ABSENCE_LABEL,
  dayHours,
  formatWeekRange,
  getById,
  mailtoUrl,
  listCompanies,
  totalHours,
  upsert,
  validate,
  WEEKDAYS,
  weekNumber,
  type AbsenceType,
  type Timesheet,
} from "@/lib/timesheet-store";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vikar/$id")({
  head: () => ({ meta: [{ title: "Vikar — Timeseddel" }] }),
  component: VikarEdit,
});

function VikarEdit() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Timesheet | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const companies = listCompanies();

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/vikar" });
    else setT(found);
  }, [id, navigate]);

  if (!t)
    return (
      <AppShell allow={["vikar"]}>
        <div>Indlæser…</div>
      </AppShell>
    );

  const locked = t.status === "sent" || t.status === "approved";
  const update = (patch: Partial<Timesheet>) => setT({ ...t, ...patch });
  const updateDay = (index: number, patch: Partial<Timesheet["days"][number]>) => {
    const days = t.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
    setT({ ...t, days });
  };

  const selectCompany = (name: string) => {
    const company = companies.find((item) => item.name === name);
    update({
      brugervirksomhed: name,
      ...(company
        ? {
            kontaktperson: company.contactName,
            kontaktpersonEmail: company.contactEmail,
            arbejdssted: company.address,
          }
        : {}),
    });
  };

  const handleSave = () => {
    setT(upsert(t));
    setMessage("Kladde gemt midlertidigt i denne browsersession.");
  };

  const handleSend = () => {
    const validationErrors = validate(t);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    const saved = upsert({ ...t, status: "sent", rejectionComment: undefined });
    setT(saved);
    setMessage(
      "Timesedlen er markeret som sendt. Din mailapp åbnes nu — tryk Send dér for at afsende mailen.",
    );
    window.location.href = mailtoUrl(saved);
  };

  return (
    <AppShell allow={["vikar"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/vikar" className="text-sm text-muted-foreground hover:text-foreground">
            ← Mine timesedler
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
          </h1>
        </div>
        <StatusBadge status={t.status} />
      </div>

      {locked && <Notice>Denne timeseddel er låst. Admin kan genåbne den.</Notice>}
      {t.status === "rejected" && t.rejectionComment && (
        <div className="mb-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 px-4 py-3 text-sm text-status-rejected-fg">
          <strong>Afvist:</strong> {t.rejectionComment}
        </div>
      )}
      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="font-medium">Ret følgende før afsendelse:</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6 rounded-lg border bg-card p-5 md:p-6">
        <h2 className="mb-4 font-semibold">Opgave og virksomhed</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vikarnavn *">
            <Input
              value={t.vikar}
              disabled={locked}
              onChange={(e) => update({ vikar: e.target.value })}
            />
          </Field>
          <Field label="Vikarens e-mail *">
            <Input
              type="email"
              value={t.vikarEmail}
              disabled={locked}
              onChange={(e) => update({ vikarEmail: e.target.value })}
            />
          </Field>
          <Field label="Brugervirksomhed *">
            <Input
              list="company-list"
              value={t.brugervirksomhed}
              disabled={locked}
              onChange={(e) => selectCompany(e.target.value)}
            />
            <datalist id="company-list">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Kontaktperson *">
            <Input
              value={t.kontaktperson}
              disabled={locked}
              onChange={(e) => update({ kontaktperson: e.target.value })}
            />
          </Field>
          <Field label="Kontaktpersonens mail *">
            <Input
              type="email"
              value={t.kontaktpersonEmail}
              disabled={locked}
              onChange={(e) => update({ kontaktpersonEmail: e.target.value })}
            />
          </Field>
          <Field label="Reference / rekvisitionsnummer">
            <Input
              value={t.referenceNo}
              disabled={locked}
              onChange={(e) => update({ referenceNo: e.target.value })}
            />
          </Field>
          <Field label="Arbejdssted / adresse *">
            <Input
              value={t.arbejdssted}
              disabled={locked}
              onChange={(e) => update({ arbejdssted: e.target.value })}
            />
          </Field>
          <Field label="Overenskomst *">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={t.selectedAgreementId}
              disabled={locked}
              onChange={(e) => {
                const agreement = activeCollectiveAgreements.find(
                  (item) => item.id === e.target.value,
                );
                update({
                  selectedAgreementId: e.target.value,
                  overenskomst: agreement?.name ?? "",
                });
              }}
            >
              <option value="">Vælg overenskomst…</option>
              {activeCollectiveAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} — {agreement.industryArea}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ugestart (mandag)">
            <Input
              type="date"
              value={t.weekStart}
              disabled={locked}
              onChange={(e) => update({ weekStart: e.target.value })}
            />
          </Field>
          <Field label="Gælder der en lokalaftale?" className="md:col-span-2">
            <div className="flex gap-2">
              {[
                { value: false, label: "Nej" },
                { value: true, label: "Ja" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    update({
                      localAgreementApplies: option.value,
                      lokalaftale: option.value,
                      localAgreementId: undefined,
                    })
                  }
                  className={cn(
                    "h-9 rounded-md border px-4 text-sm font-medium",
                    t.localAgreementApplies === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                    locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Noter" className="md:col-span-2">
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={t.notes}
              disabled={locked}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-lg border bg-card">
        <div className="p-5 pb-3 md:p-6 md:pb-3">
          <h2 className="font-semibold">Registrering for ugen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vælg fraværstype på dage uden arbejdstimer. Tillægsberegninger vises kun for admin.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {[
                  "Dag",
                  "Type",
                  "Start",
                  "Slut",
                  "Pause",
                  "Opgavetype",
                  "Skiftehold",
                  "Kommentar",
                  "Timer",
                ].map((head) => (
                  <th key={head} className="px-3 py-2 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((name, index) => {
                const day = t.days[index];
                const absent = day.absence !== "none";
                return (
                  <tr key={name} className="border-t align-top">
                    <td className="px-3 py-3 font-medium">{name}</td>
                    <td className="px-3 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2"
                        value={day.absence}
                        disabled={locked}
                        onChange={(e) =>
                          updateDay(index, {
                            absence: e.target.value as AbsenceType,
                            ...(e.target.value !== "none" ? { start: "", end: "", pause: 0 } : {}),
                          })
                        }
                      >
                        {Object.entries(ABSENCE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={day.start}
                        disabled={locked || absent}
                        onChange={(e) => updateDay(index, { start: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={day.end}
                        disabled={locked || absent}
                        onChange={(e) => updateDay(index, { end: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20"
                        value={day.pause}
                        disabled={locked || absent}
                        onChange={(e) => updateDay(index, { pause: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-36"
                        value={day.taskType}
                        disabled={locked || absent}
                        onChange={(e) => updateDay(index, { taskType: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="mt-2 h-4 w-4 accent-primary"
                        checked={day.shiftWork}
                        disabled={locked || absent}
                        onChange={(e) => updateDay(index, { shiftWork: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 min-w-44"
                        value={day.comment}
                        disabled={locked}
                        onChange={(e) => updateDay(index, { comment: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {dayHours(day).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={8} className="px-3 py-3 text-right font-medium">
                  Samlede timer
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {totalHours(t.days).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl text-sm text-muted-foreground">{message}</div>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave}>
              Gem kladde
            </Button>
            <Button onClick={handleSend}>Send timeseddel</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 rounded-md border bg-muted/40 px-4 py-3 text-sm">{children}</div>;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
