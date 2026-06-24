import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  dayHours,
  getById,
  OVERENSKOMSTER,
  overtimeHours,
  totalHours,
  upsert,
  validate,
  WEEKDAYS,
  weekNumber,
  formatWeekRange,
  type Timesheet,
} from "@/lib/timesheet-store";
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
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const found = getById(id);
    if (!found) navigate({ to: "/vikar" });
    else setT(found);
  }, [id, navigate]);

  if (!t) return <AppShell allow={["vikar"]}><div>Indlæser…</div></AppShell>;

  const locked = t.status !== "draft" && t.status !== "rejected";
  const update = (patch: Partial<Timesheet>) => setT({ ...t, ...patch });
  const updateDay = (i: number, patch: Partial<Timesheet["days"][number]>) => {
    const days = t.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    setT({ ...t, days });
  };

  const handleSave = () => {
    const saved = upsert(t);
    setT(saved);
    setSavedMsg("Kladde gemt");
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const handleSend = () => {
    const errs = validate(t);
    setErrors(errs);
    if (errs.length > 0) return;
    const saved = upsert({ ...t, status: "sent" });
    setT(saved);
    navigate({ to: "/vikar" });
  };

  const total = totalHours(t.days);

  return (
    <AppShell allow={["vikar"]}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/vikar" className="text-sm text-muted-foreground hover:text-foreground">
            ← Mine timesedler
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
          </h1>
        </div>
        <StatusBadge status={t.status} />
      </div>

      {locked && (
        <div className="mb-6 rounded-md border bg-muted/40 px-4 py-3 text-sm">
          Denne timeseddel er sendt til godkendelse og kan ikke redigeres.
        </div>
      )}

      {t.status === "rejected" && t.rejectionComment && (
        <div className="mb-6 rounded-md border border-status-rejected-fg/30 bg-status-rejected/40 text-status-rejected-fg px-4 py-3 text-sm">
          <div className="font-medium">Afvist af kontaktperson</div>
          <div className="mt-1">{t.rejectionComment}</div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          <div className="font-medium mb-1">Ret følgende før afsendelse:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <section className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="font-semibold mb-4">Oplysninger</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Vikarnavn">
            <Input value={t.vikar} disabled={locked} onChange={(e) => update({ vikar: e.target.value })} />
          </Field>
          <Field label="Brugervirksomhed">
            <Input value={t.brugervirksomhed} disabled={locked} onChange={(e) => update({ brugervirksomhed: e.target.value })} />
          </Field>
          <Field label="Kontaktperson">
            <Input value={t.kontaktperson} disabled={locked} onChange={(e) => update({ kontaktperson: e.target.value })} />
          </Field>
          <Field label="Kontaktpersonens mailadresse">
            <Input type="email" value={t.kontaktpersonEmail} disabled={locked} onChange={(e) => update({ kontaktpersonEmail: e.target.value })} />
          </Field>
          <Field label="Arbejdssted / adresse" className="md:col-span-2">
            <Input value={t.arbejdssted} disabled={locked} onChange={(e) => update({ arbejdssted: e.target.value })} />
          </Field>
          <Field label="Overenskomst">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={t.overenskomst}
              disabled={locked}
              onChange={(e) => update({ overenskomst: e.target.value })}
            >
              <option value="">Vælg overenskomst…</option>
              {OVERENSKOMSTER.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Lokalaftale gælder">
            <div className="flex gap-2">
              {[
                { v: false, l: "Nej" },
                { v: true, l: "Ja" },
              ].map((opt) => (
                <button
                  key={opt.l}
                  type="button"
                  disabled={locked}
                  onClick={() => update({ lokalaftale: opt.v })}
                  className={cn(
                    "h-9 px-4 rounded-md border text-sm font-medium transition-colors",
                    t.lokalaftale === opt.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent",
                    locked && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Ugestart (mandag)">
            <Input type="date" value={t.weekStart} disabled={locked} onChange={(e) => update({ weekStart: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border bg-card overflow-hidden mb-6">
        <h2 className="font-semibold p-6 pb-3">Timer for ugen</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Dag</th>
              <th className="px-4 py-2 font-medium">Start</th>
              <th className="px-4 py-2 font-medium">Slut</th>
              <th className="px-4 py-2 font-medium">Pause (min)</th>
              <th className="px-4 py-2 font-medium">Kommentar</th>
              <th className="px-4 py-2 font-medium text-right">Timer</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((name, i) => {
              const d = t.days[i];
              return (
                <tr key={name} className="border-t">
                  <td className="px-4 py-2 font-medium">{name}</td>
                  <td className="px-4 py-2">
                    <Input type="time" value={d.start} disabled={locked} onChange={(e) => updateDay(i, { start: e.target.value })} className="h-8 w-28" />
                  </td>
                  <td className="px-4 py-2">
                    <Input type="time" value={d.end} disabled={locked} onChange={(e) => updateDay(i, { end: e.target.value })} className="h-8 w-28" />
                  </td>
                  <td className="px-4 py-2">
                    <Input type="number" min={0} value={d.pause} disabled={locked} onChange={(e) => updateDay(i, { pause: Number(e.target.value) || 0 })} className="h-8 w-24" />
                  </td>
                  <td className="px-4 py-2">
                    <Input value={d.comment} disabled={locked} onChange={(e) => updateDay(i, { comment: e.target.value })} className="h-8" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{dayHours(d).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td colSpan={5} className="px-4 py-3 text-right font-medium">Samlede timer</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">{savedMsg}</div>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave}>Gem kladde</Button>
            <Button onClick={handleSend}>Send til godkendelse</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
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
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}
