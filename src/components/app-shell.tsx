import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_LABEL, type Status } from "@/lib/timesheet-store";
import { ROLE_HOME, ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import subzLogo from "@/assets/sub-z-logo.png";

export function AppShell({
  children,
  allow,
}: {
  children?: ReactNode;
  /** If set, only these roles may view the page. */
  allow?: Role[];
}) {
  const { role, logout, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!role) {
    return <LoginScreen />;
  }

  const home = ROLE_HOME[role];
  const denied = allow && !allow.includes(role);
  const nav =
    role === "admin"
      ? [
          { to: "/admin", label: "Overblik" },
          { to: "/admin/rules", label: "Regelgrundlag" },
          { to: "/admin/companies", label: "Virksomheder" },
          { to: "/admin/create-worker", label: "Opret vikar" },
        ]
      : role === "vikar"
        ? [{ to: "/vikar", label: "Mine timesedler" }]
        : [{ to: "/kontaktperson", label: "Til godkendelse" }];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 md:flex-nowrap md:gap-6 md:px-6">
          <Link to={home} className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
              T
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">Timeseddel</div>
              <div className="hidden truncate text-xs leading-tight text-muted-foreground sm:block">
                Dokumentation for modtagelse og godkendelse
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              Logget ind som:{" "}
              <span className="font-medium text-foreground">{ROLE_LABEL[role]}</span>
            </span>
            <span
              className={cn(
                "sm:hidden px-2 py-0.5 rounded-md text-xs font-medium bg-accent text-accent-foreground",
              )}
            >
              {ROLE_LABEL[role]}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-md text-sm font-medium border bg-background hover:bg-accent transition-colors"
            >
              Log ud
            </button>
            <img src={subzLogo} alt="SUB-Z" className="h-7 w-auto hidden sm:block" />
          </div>
        </div>
      </header>
      <div className="border-b bg-card/70">
        <nav className="flex w-full flex-wrap gap-1 px-4 md:flex-nowrap md:overflow-x-auto md:px-6">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                pathname === item.to || (item.to !== home && pathname.startsWith(`${item.to}/`))
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="w-full px-4 py-6 md:px-6 md:py-8">
        {denied ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold">Du er logget ind som {ROLE_LABEL[role]}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Denne side hører til en anden rolle.
            </p>
            <Link
              to={home}
              className="mt-4 inline-flex px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground"
            >
              Gå til {ROLE_LABEL[role]}-visning
            </Link>
            <span className="hidden">{pathname}</span>
          </div>
        ) : (
          (children ?? <Outlet />)
        )}
      </main>
    </div>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function InfoBanner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-status-sent-fg/30 bg-status-sent/40 text-status-sent-fg"
          : "border-status-reviewed-fg/30 bg-status-reviewed/40 text-status-reviewed-fg",
      )}
    >
      {children}
    </div>
  );
}
