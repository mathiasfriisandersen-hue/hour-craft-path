import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  formatWeekRange,
  totalHours,
  upsert,
  weekNumber,
  type Timesheet,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/kontaktperson/")({
  head: () => ({ meta: [{ title: "Kontaktperson — Timesedler" }] }),
  component: KontaktList,
});

function KontaktList() {
  const navigate = useNavigate();
  const all = useTimesheets();
  const list = all.filter((t) => t.status === "sent");
  const handled = all.filter((t) => t.status === "approved" || t.status === "rejected");

  const [rejectTarget, setRejectTarget] = useState<Timesheet | null>(null);
  const [comment, setComment] = useState("");

  const approve = (t: Timesheet) => {
    upsert({ ...t, status: "approved", rejectionComment: undefined });
  };
  const confirmReject = () => {
    if (!rejectTarget || !comment.trim()) return;
    upsert({ ...rejectTarget, status: "rejected", rejectionComment: comment.trim() });
    setRejectTarget(null);
    setComment("");
  };

  return (
    <AppShell
      allow={["kontaktperson"]}
      dashboard={{
        title: "Timesedler til godkendelse",
        subtitle: "Modtagne timesedler fra vikarer. Godkend eller afvis de indsendte timer.",
      }}
    >
      {list.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
          Ingen timesedler venter på godkendelse.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((t) => {
            const canAct = t.status === "sent";
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{t.vikar}</div>
                    <div className="mt-1 text-sm text-slate-500">{t.brugervirksomhed}</div>
                    <div className="mt-2 text-xs font-medium text-slate-400">
                      Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={t.status} />
                    <div className="text-sm font-semibold tabular-nums text-slate-950">
                      {totalHours(t.days).toFixed(2)} timer
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Link
                    to="/kontaktperson/$id"
                    params={{ id: t.id }}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline sm:mr-auto"
                  >
                    Se detaljer →
                  </Link>
                  {canAct && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectTarget(t);
                          setComment("");
                        }}
                      >
                        Afvis
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => approve(t)}
                      >
                        Godkend
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {handled.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-950">Behandlede timesedler</h2>
          <div className="space-y-4">
            {handled.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{t.vikar}</div>
                    <div className="mt-1 text-sm text-slate-500">{t.brugervirksomhed}</div>
                    <div className="mt-2 text-xs font-medium text-slate-400">
                      Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={t.status} />
                    <div className="text-sm font-semibold tabular-nums text-slate-950">
                      {totalHours(t.days).toFixed(2)} timer
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Link
                    to="/kontaktperson/$id"
                    params={{ id: t.id }}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline sm:mr-auto"
                  >
                    Se detaljer →
                  </Link>
                  {t.status !== "rejected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectTarget(t);
                        setComment("");
                      }}
                    >
                      Afvis
                    </Button>
                  )}
                  {t.status !== "approved" && (
                    <Button
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => approve(t)}
                    >
                      Godkend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-950">Afvis timeseddel</h3>
            <p className="mt-1 text-sm text-slate-500">
              {rejectTarget.vikar} · Uge {weekNumber(rejectTarget.weekStart)}
            </p>
            <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
              Kommentar
            </label>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Beskriv kort hvorfor timesedlen afvises…"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>
                Annullér
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={!comment.trim()}>
                Bekræft afvisning
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
