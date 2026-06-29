import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import subzLogo from "@/assets/sub-z-logo.png";
import { useAuth } from "@/lib/auth";
import { upsert, type Timesheet } from "@/lib/timesheet-store";
import { parseWorkerInviteFromHash } from "@/lib/worker-invite";

export const Route = createFileRoute("/vikar/invite")({
  head: () => ({ meta: [{ title: "Vikar — Invitation" }] }),
  component: VikarInvitePage,
});

function VikarInvitePage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const payload = useMemo(
    () =>
      typeof window === "undefined" ? undefined : parseWorkerInviteFromHash(window.location.hash),
    [],
  );
  const [temporaryCode, setTemporaryCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [step, setStep] = useState<"temporary" | "change">("temporary");
  const [error, setError] = useState("");

  if (!payload) {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitationen kunne ikke læses</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linket er ugyldigt eller mangler invitationsdata. Kontakt Sub-Z for et nyt link.
        </p>
      </InviteShell>
    );
  }

  const timesheet = payload.timesheet;

  const verifyTemporaryCode = (event: FormEvent) => {
    event.preventDefault();
    if (temporaryCode !== timesheet.workerAccessCode) {
      setError("Forkert midlertidig adgangskode");
      return;
    }
    setError("");
    setStep("change");
  };

  const saveNewCode = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(newCode)) {
      setError("Ny adgangskode skal være 4-8 cifre");
      return;
    }
    const saved: Timesheet = upsert({
      ...timesheet,
      workerAccessCode: newCode,
      workerMustChangeAccessCode: false,
    });
    login("vikar");
    navigate({ to: "/vikar/$id", params: { id: saved.id }, replace: true });
  };

  return (
    <InviteShell>
      <h1 className="text-2xl font-semibold">Log ind på din timeseddel</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Timeseddel for {timesheet.brugervirksomhed || "brugervirksomhed"} er oprettet til{" "}
        {timesheet.vikar || "vikaren"}.
      </p>

      {step === "temporary" ? (
        <form onSubmit={verifyTemporaryCode} className="mt-6 space-y-4">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Midlertidig adgangskode</span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={temporaryCode}
              onChange={(e) => {
                setTemporaryCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              placeholder="Sidste 4 cifre"
            />
          </label>
          {error && <p className="text-sm font-medium text-status-rejected-fg">{error}</p>}
          <Button type="submit" className="w-full">
            Fortsæt
          </Button>
        </form>
      ) : (
        <form onSubmit={saveNewCode} className="mt-6 space-y-4">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Vælg ny adgangskode</span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newCode}
              onChange={(e) => {
                setNewCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              placeholder="4-8 cifre"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Denne prototype gemmer adgangskoden lokalt i browseren. Produktionslogin kræver en
            fælles serverdatabase.
          </p>
          {error && <p className="text-sm font-medium text-status-rejected-fg">{error}</p>}
          <Button type="submit" className="w-full">
            Gem adgangskode og åbn timeseddel
          </Button>
        </form>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold leading-tight">Timeseddel</div>
            <div className="text-xs text-muted-foreground">Vikarlogin</div>
          </div>
          <img src={subzLogo} alt="SUB-Z" className="h-8 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
