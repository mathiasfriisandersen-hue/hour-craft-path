import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DEMO_PASSWORD, ROLE_HOME, ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
import { findByWorkerAccessCode, getById } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";
import subzLogo from "@/assets/sub-z-logo.png";

const ROLES: Role[] = ["vikar", "kontaktperson", "bruger", "admin"];

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [role, setRole] = useState<Role>("vikar");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const vikarTimesheetId = pathname.match(/^\/vikar\/([^/]+)$/)?.[1];
    const vikarTimesheet = vikarTimesheetId ? getById(vikarTimesheetId) : undefined;
    const validVikarPassword =
      role === "vikar" &&
      vikarTimesheet?.workerAccessCode === password &&
      vikarTimesheet.workerMustChangeAccessCode === false &&
      /^\d{4,8}$/.test(password);
    const matchedVikarTimesheet =
      role === "vikar" && !validVikarPassword ? findByWorkerAccessCode(password) : undefined;
    const validDemoPassword = password === DEMO_PASSWORD;

    if (!validDemoPassword && !validVikarPassword && !matchedVikarTimesheet) {
      setError("Forkert adgangskode");
      return;
    }
    setError(null);
    login(role);
    if (validVikarPassword && vikarTimesheet) {
      navigate({ to: "/vikar/$id", params: { id: vikarTimesheet.id }, replace: true });
      return;
    }
    if (matchedVikarTimesheet) {
      navigate({ to: "/vikar/$id", params: { id: matchedVikarTimesheet.id }, replace: true });
      return;
    }
    navigate({ to: ROLE_HOME[role], replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-xl rounded-lg border bg-card p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
            T
          </div>
          <div>
            <div className="font-semibold leading-tight">Timeseddel</div>
            <div className="text-xs text-muted-foreground leading-tight">
              Timeregistrering for vikarer
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Log ind</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demo-login: vælg rolle og brug koden <span className="font-mono font-semibold">0000</span>
          . Vikarer kan også bruge deres personlige adgangskode via invitationslinket.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-medium">Vælg rolle</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    role === r
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="pw" className="text-sm font-medium">
              Adgangskode
            </label>
            <input
              id="pw"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="0000"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-status-rejected-fg">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Log ind
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground leading-snug">
            Demooplysninger gemmes ikke permanent og kan ryddes af admin.
          </p>
          <img
            src={subzLogo}
            alt="SUB-Z — Esprit de corps at work"
            className="hidden h-8 w-auto shrink-0 sm:block"
          />
        </div>
      </div>
    </div>
  );
}
