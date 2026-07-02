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
    <AppShell allow={["kontaktperson"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Timesedler til godkendelse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modtagne timesedler fra vikarer. Godkend eller afvis de indsendte timer.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen timesedler venter på godkendelse.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => {
            const canAct = t.status === "sent";
            return (
              <div key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold">{t.vikar}</div>
                    <div className="text-sm text-muted-foreground">{t.brugervirksomhed}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={t.status} />
                    <div className="text-sm tabular-nums font-medium">
                      {totalHours(t.days).toFixed(2)} timer
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Link
                    to="/kontaktperson/$id"
                    params={{ id: t.id }}
                    className="text-sm text-primary font-medium hover:underline sm:mr-auto"
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
                      <Button size="sm" onClick={() => approve(t)}>
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
          <h2 className="text-lg font-semibold mb-3">Behandlede timesedler</h2>
          <div className="space-y-3">
            {handled.map((t) => (
              <div key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold">{t.vikar}</div>
                    <div className="text-sm text-muted-foreground">{t.brugervirksomhed}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Uge {weekNumber(t.weekStart)} · {formatWeekRange(t.weekStart)}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={t.status} />
                    <div className="text-sm tabular-nums font-medium">
                      {totalHours(t.days).toFixed(2)} timer
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Link
                    to="/kontaktperson/$id"
                    params={{ id: t.id }}
                    className="text-sm text-primary font-medium hover:underline sm:mr-auto"
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
                    <Button size="sm" onClick={() => approve(t)}>
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
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="bg-card rounded-lg border w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">Afvis timeseddel</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {rejectTarget.vikar} · Uge {weekNumber(rejectTarget.weekStart)}
            </p>
            <label className="block text-sm font-medium mt-4 mb-1.5">Kommentar</label>
            <textarea
              className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
