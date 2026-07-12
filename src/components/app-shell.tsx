import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  ClipboardList,
  FileBadge2,
  Home,
  LogOut,
  Plus,
  Search,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_LABEL, type Status } from "@/lib/timesheet-store";
import { ROLE_HOME, ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import subzLogo from "@/assets/sub-z-logo.png";

type DashboardShellOptions = {
  title: string;
  subtitle: string;
  hideHeaderContent?: boolean;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
};

export function AppShell({
  children,
  allow,
  dashboard,
}: {
  children?: ReactNode;
  /** If set, only these roles may view the page. */
  allow?: Role[];
  dashboard?: DashboardShellOptions;
}) {
  const { role, logout, ready } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!role) {
    return pathname === "/" ? <LoginScreen /> : <Navigate to="/" replace />;
  }

  const home = ROLE_HOME[role];
  const denied = allow && !allow.includes(role);
  const adminBase = role === "bruger" ? "/bruger1" : role === "bruger2" ? "/bruger2" : "/admin";
  const adminNav =
    role === "admin"
      ? [
          { to: "/admin", label: "Dashboard" },
          { to: "/admin/timesheets", label: "Timesedler" },
          { to: "/admin/rules", label: "Regelgrundlag" },
          { to: "/admin/workers", label: "Vikarer" },
          { to: "/admin/companies", label: "Virksomheder" },
          { to: "/admin/create-worker", label: "Opret vikar" },
          { to: "/admin/calendar", label: "Kalender" },
          { to: "/admin/users", label: "Brugere" },
          { to: "/admin/statistics", label: "Statistik" },
          { to: "/admin/invoice-payroll", label: "Faktura & løn" },
        ]
      : [
          { to: adminBase, label: "Timesedler" },
          { to: `${adminBase}/workers`, label: "Vikarer" },
          { to: `${adminBase}/companies`, label: "Virksomheder" },
          { to: `${adminBase}/create-worker`, label: "Opret vikar" },
        ];
  const nav =
    role === "admin" || role === "bruger" || role === "bruger2"
      ? adminNav
      : role === "vikar"
        ? [{ to: "/vikar", label: "Mine timesedler" }]
        : [{ to: "/kontaktperson", label: "Til godkendelse" }];
  const content = denied ? (
    <div className="rounded-lg border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Du er logget ind som {ROLE_LABEL[role]}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Denne side hører til en anden rolle.</p>
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
  );

  if (dashboard) {
    return (
      <div
        className={cn(
          "min-h-screen text-slate-950 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]",
          role === "admin" ? "bg-white" : "bg-[#f5f7fb]",
        )}
      >
        <aside className="hidden min-h-screen flex-col bg-[#071629] text-white shadow-2xl lg:flex">
          <Link to={home} className="flex h-20 items-center gap-3 px-5">
            <img src={subzLogo} alt="SUB-Z" className="h-8 w-auto" />
          </Link>

          <nav className="flex-1 space-y-1 py-2 pl-[2mm] pr-[3mm]">
            {nav.map((item) => {
              const Icon = dashboardNavIcon(item.label);
              const active =
                pathname === item.to || (item.to !== home && pathname.startsWith(`${item.to}/`));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-white/10 py-4 pl-[2mm] pr-[3mm]">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log ud
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header
            className={cn(
              "border-b border-slate-200 bg-white",
              dashboard.hideHeaderContent && "lg:hidden",
            )}
          >
            <div
              className={cn(
                "flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4 lg:flex-nowrap lg:px-7",
                dashboard.hideHeaderContent && "lg:min-h-16 lg:justify-end",
              )}
            >
              {dashboard.hideHeaderContent ? (
                <Link to={home} className="flex items-center gap-2 lg:hidden">
                  <img src={subzLogo} alt="SUB-Z" className="h-7 w-auto" />
                </Link>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-2 lg:hidden">
                    <img src={subzLogo} alt="SUB-Z" className="h-7 w-auto" />
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 lg:mt-0">
                    {dashboard.title}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{dashboard.subtitle}</p>
                </div>
              )}

              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap",
                  dashboard.hideHeaderContent ? "w-auto" : "w-full",
                )}
              >
                {dashboard.search && !dashboard.hideHeaderContent && (
                  <label className="relative min-w-0 flex-1 lg:w-[25rem] lg:flex-none">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={dashboard.search.value}
                      onChange={(event) => dashboard.search?.onChange(event.target.value)}
                      placeholder={dashboard.search.placeholder}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                )}

                {!dashboard.hideHeaderContent && (
                  <div className="relative flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#164a82] text-sm font-semibold text-white">
                      {ROLE_LABEL[role].slice(0, 1)}
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <div className="text-sm font-semibold text-slate-950">{ROLE_LABEL[role]}</div>
                      <div className="text-xs text-slate-500">{dashboardRoleSubtitle(role)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfileOpen((open) => !open)}
                      className="hidden rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:block"
                      aria-expanded={profileOpen}
                      aria-label="Åbn profilmenu"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {profileOpen && (
                      <div className="absolute right-0 top-12 z-30 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={logout}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Log ud
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium",
                    pathname === item.to || (item.to !== home && pathname.startsWith(`${item.to}/`))
                      ? "border-blue-600 text-slate-950"
                      : "border-transparent text-slate-500",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main
            className={cn("w-full px-4 py-5 lg:py-6", role === "admin" ? "lg:px-[2mm]" : "lg:px-7")}
          >
            {content}
          </main>
        </div>
      </div>
    );
  }

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
      <main className="w-full px-4 py-6 md:px-6 md:py-8">{content}</main>
    </div>
  );
}

function dashboardNavIcon(label: string) {
  if (label === "Dashboard") return Home;
  if (label === "Timesedler") return ClipboardList;
  if (label === "Regelgrundlag") return FileBadge2;
  if (label === "Vikarer") return UsersRound;
  if (label === "Virksomheder") return Building2;
  if (label === "Opret vikar") return Plus;
  if (label === "Kalender") return CalendarDays;
  if (label === "Brugere") return BriefcaseBusiness;
  if (label === "Statistik") return ChartNoAxesColumn;
  if (label === "Faktura & løn") return WalletCards;
  return ClipboardList;
}

function dashboardRoleSubtitle(role: Role): string {
  if (role === "admin") return "Administrator";
  if (role === "vikar") return "Vikaradgang";
  if (role === "kontaktperson") return "Kontaktperson";
  return "Brugeradgang";
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
