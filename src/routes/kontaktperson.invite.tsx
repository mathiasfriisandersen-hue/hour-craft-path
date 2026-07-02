import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import subzLogo from "@/assets/sub-z-logo.png";
import { useAuth } from "@/lib/auth";
import { getById, upsert, type Timesheet } from "@/lib/timesheet-store";
import { fetchWorkerInviteByToken, parseWorkerInviteFromHash } from "@/lib/worker-invite";

const INVITE_VALIDITY_DAYS = 7;
const INVITE_VALIDITY_MS = INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/kontaktperson/invite")({
  head: () => ({ meta: [{ title: "Kontaktperson — Invitation" }] }),
  component: KontaktpersonInvitePage,
});

function isInviteExpired(timesheet: Timesheet): boolean {
  const createdAt = Date.parse(timesheet.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt > INVITE_VALIDITY_MS;
}

function KontaktpersonInvitePage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [payload, setPayload] = useState<ReturnType<typeof parseWorkerInviteFromHash>>();
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [temporaryCode, setTemporaryCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [step, setStep] = useState<"temporary" | "change">("temporary");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvite() {
      if (typeof window === "undefined") return;

      const legacyPayload = parseWorkerInviteFromHash(window.location.hash);
      if (legacyPayload) {
        if (isMounted) {
          setPayload(legacyPayload);
          setIsLoadingInvite(false);
        }
        return;
      }

      const token = new URLSearchParams(window.location.search).get("i") ?? "";
      const tokenPayload = token ? await fetchWorkerInviteByToken(token) : undefined;
      if (isMounted) {
        setPayload(tokenPayload);
        setIsLoadingInvite(false);
      }
    }

    void loadInvite();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoadingInvite) {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Indlæser invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vent et øjeblik…</p>
      </InviteShell>
    );
  }

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

  const timesheet = getById(payload.timesheet.id) ?? payload.timesheet;

  if (isInviteExpired(timesheet)) {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitationslinket er udløbet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linket er kun gyldigt i {INVITE_VALIDITY_DAYS} dage fra oprettelse. Kontakt Sub-Z for et
          nyt invitationslink.
        </p>
      </InviteShell>
    );
  }

  if (
    timesheet.contactPersonAccessCode &&
    timesheet.contactPersonMustChangeAccessCode === false
  ) {
    const verifyPersonalCode = (event: FormEvent) => {
      event.preventDefault();
      if (temporaryCode !== timesheet.contactPersonAccessCode) {
        setError("Forkert adgangskode");
        return;
      }
      login("kontaktperson");
      navigate({ to: "/kontaktperson/$id", params: { id: timesheet.id }, replace: true });
    };

    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Åbn timeseddel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Timeseddel for {timesheet.vikar || "vikaren"} hos{" "}
          {timesheet.brugervirksomhed || "brugervirksomheden"}.
        </p>
        <form onSubmit={verifyPersonalCode} className="mt-6 space-y-4">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Personlig adgangskode</span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={temporaryCode}
              onChange={(e) => {
                setTemporaryCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              placeholder="4-8 cifre"
            />
          </label>
          {error && <p className="text-sm font-medium text-status-rejected-fg">{error}</p>}
          <Button type="submit" className="w-full">
            Åbn timeseddel
          </Button>
        </form>
      </InviteShell>
    );
  }

  const verifyTemporaryCode = (event: FormEvent) => {
    event.preventDefault();
    if (temporaryCode !== timesheet.contactPersonAccessCode) {
      setError("Forkert engangskode");
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
    const current = getById(timesheet.id) ?? timesheet;
    const saved = upsert({
      ...current,
      contactPersonAccessCode: newCode,
      contactPersonMustChangeAccessCode: false,
    });
    login("kontaktperson");
    navigate({ to: "/kontaktperson/$id", params: { id: saved.id }, replace: true });
  };

  return (
    <InviteShell>
      <h1 className="text-2xl font-semibold">Log ind på timeseddel</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Timeseddel for {timesheet.vikar || "vikaren"} hos{" "}
        {timesheet.brugervirksomhed || "brugervirksomheden"}.
      </p>

      {step === "temporary" ? (
        <form onSubmit={verifyTemporaryCode} className="mt-6 space-y-4">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Engangskode</span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={temporaryCode}
              onChange={(e) => {
                setTemporaryCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="6-cifret engangskode"
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
            <div className="text-xs text-muted-foreground">Kontaktpersonlogin</div>
          </div>
          <img src={subzLogo} alt="SUB-Z" className="h-8 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
