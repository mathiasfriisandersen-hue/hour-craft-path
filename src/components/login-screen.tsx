import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ROLE_HOME, ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import subzLogo from "@/assets/sub-z-logo.png";

const ROLES: Role[] = ["vikar", "kontaktperson", "bruger", "bruger2", "admin"];

export function LoginScreen() {
  const { login, role: authenticatedRole, authenticating, error } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("vikar");

  useEffect(() => {
    if (authenticatedRole) {
      void navigate({ to: ROLE_HOME[authenticatedRole], replace: true });
    }
  }, [authenticatedRole, navigate]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    login(role, { demo: true });
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
          Vælg en rolle for at starte en tidsbegrænset, serververificeret session i den isolerede
          demo.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-medium">Vælg rolle</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "min-w-32 flex-1 rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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

          {error && (
            <p role="alert" className="text-sm font-medium text-status-rejected-fg">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={authenticating}>
            {authenticating ? "Starter sikker demo…" : "Start demo"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground leading-snug">
            Syntetiske demodata kan blive gemt lokalt i denne browser. Demoen er isoleret fra
            produktionsdata og kan ikke sende rigtige mails.
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
