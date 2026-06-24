import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_LABEL, type Status } from "@/lib/timesheet-store";

const NAV = [
  { to: "/vikar", label: "Vikar" },
  { to: "/kontaktperson", label: "Kontaktperson" },
  { to: "/admin", label: "Admin" },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
              T
            </div>
            <div>
              <div className="font-semibold leading-tight">Timeseddel</div>
              <div className="text-xs text-muted-foreground leading-tight">
                Dokumentation for modtagelse og godkendelse
              </div>
            </div>
          </Link>
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children ?? <Outlet />}</main>
    </div>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
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
