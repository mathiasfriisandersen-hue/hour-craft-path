import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  listCompanies,
  workerReferenceKeys,
  type Company,
  type KnownWorker,
  type Timesheet,
} from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin/statistics")({
  head: () => ({ meta: [{ title: "Admin — Statistik" }] }),
  component: StatisticsPage,
});

type UserRole = "bruger" | "bruger2";
type UserKey = "bruger1" | "bruger2";
type MetricKey = "companies" | "workers" | "tasks" | "sent" | "approved";

type MetricDefinition = {
  key: MetricKey;
  label: string;
};

type UserDefinition = {
  role: UserRole;
  key: UserKey;
  label: string;
};

const USERS: UserDefinition[] = [
  { role: "bruger", key: "bruger1", label: "Bruger 1" },
  { role: "bruger2", key: "bruger2", label: "Bruger 2" },
];

const METRICS: MetricDefinition[] = [
  { key: "companies", label: "Virksomheder oprettet" },
  { key: "workers", label: "Vikarer oprettet" },
  { key: "tasks", label: "Opgaver løst" },
  { key: "sent", label: "Timesedler sendt" },
  { key: "approved", label: "Timesedler godkendt" },
];

const USER_COLORS: Record<UserKey, string> = {
  bruger1: "#2563eb",
  bruger2: "#dc2626",
};

function StatisticsPage() {
  const timesheets = useTimesheets();
  const [companies, setCompanies] = useState(listCompanies);
  const [visibleUsers, setVisibleUsers] = useState<Record<UserKey, boolean>>({
    bruger1: true,
    bruger2: true,
  });
  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>({
    companies: true,
    workers: true,
    tasks: true,
    sent: true,
    approved: true,
  });

  useEffect(() => {
    const refresh = () => setCompanies(listCompanies());
    window.addEventListener("timesheets-changed", refresh);
    return () => window.removeEventListener("timesheets-changed", refresh);
  }, []);

  const chartData = useMemo(
    () =>
      METRICS.filter((metric) => visibleMetrics[metric.key]).map((metric) => {
        const row: { metric: string; bruger1?: number; bruger2?: number } = {
          metric: metric.label,
        };
        for (const user of USERS) {
          if (visibleUsers[user.key]) {
            row[user.key] = metricValue(metric.key, user.role, timesheets, companies);
          }
        }
        return row;
      }),
    [companies, timesheets, visibleMetrics, visibleUsers],
  );

  const toggleUser = (key: UserKey) => {
    setVisibleUsers((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Statistik</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overblik over aktivitet fordelt på brugere
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-lg border bg-card p-4">
          <div className="h-[420px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 44, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="metric"
                  interval={0}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 16 }} />
                {visibleUsers.bruger1 && (
                  <Bar dataKey="bruger1" name="Blå = Bruger 1" fill={USER_COLORS.bruger1} />
                )}
                {visibleUsers.bruger2 && (
                  <Bar dataKey="bruger2" name="Rød = Bruger 2" fill={USER_COLORS.bruger2} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Filtre</h2>
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">Brugere</div>
              <div className="space-y-2">
                {USERS.map((user) => (
                  <FilterCheckbox
                    key={user.key}
                    label={`Vis ${user.label}`}
                    checked={visibleUsers[user.key]}
                    onChange={() => toggleUser(user.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">Målinger</div>
              <div className="space-y-2">
                {METRICS.map((metric) => (
                  <FilterCheckbox
                    key={metric.key}
                    label={metric.label}
                    checked={visibleMetrics[metric.key]}
                    onChange={() => toggleMetric(metric.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}

function metricValue(
  metric: MetricKey,
  role: UserRole,
  timesheets: Timesheet[],
  companies: Company[],
): number {
  const roleCompanies = companies.filter((company) => company.ownerRole === role);
  const roleTimesheets = timesheets.filter((timesheet) =>
    timesheetBelongsToRole(timesheet, role, companies),
  );

  if (metric === "companies") return roleCompanies.length;
  if (metric === "workers") return countWorkers(role, roleCompanies, roleTimesheets);
  if (metric === "tasks") return countWorkerCompanyLinks(roleCompanies, roleTimesheets);
  if (metric === "sent")
    return roleTimesheets.filter((timesheet) => timesheet.status === "sent").length;
  return roleTimesheets.filter((timesheet) => timesheet.status === "approved").length;
}

function timesheetBelongsToRole(
  timesheet: Timesheet,
  role: UserRole,
  companies: Company[],
): boolean {
  if (timesheet.ownerRole) return timesheet.ownerRole === role;
  const company = companies.find((item) =>
    timesheet.companyId
      ? item.id === timesheet.companyId
      : item.name.trim().toLowerCase() === timesheet.brugervirksomhed.trim().toLowerCase(),
  );
  return company?.ownerRole === role;
}

function countWorkers(role: UserRole, companies: Company[], timesheets: Timesheet[]): number {
  const workerKeys = new Set<string>();
  for (const timesheet of timesheets) {
    const worker = knownWorkerFromTimesheet(timesheet);
    for (const key of workerReferenceKeys(worker)) workerKeys.add(key);
  }
  for (const company of companies) {
    if (company.ownerRole !== role) continue;
    for (const project of company.projects) {
      for (const reference of project.workerEmails) {
        const key = reference.trim().toLowerCase();
        if (key) workerKeys.add(key);
      }
    }
  }
  return workerKeys.size;
}

function countWorkerCompanyLinks(companies: Company[], timesheets: Timesheet[]): number {
  const links = new Set<string>();
  for (const timesheet of timesheets) {
    const companyKey = timesheet.companyId || timesheet.brugervirksomhed.trim().toLowerCase();
    const workerKey = workerReferenceKeys(knownWorkerFromTimesheet(timesheet))[0];
    if (companyKey && workerKey) links.add(`${companyKey}:${workerKey}`);
  }
  for (const company of companies) {
    for (const project of company.projects) {
      for (const reference of project.workerEmails) {
        const workerKey = reference.trim().toLowerCase();
        if (workerKey) links.add(`${company.id}:${workerKey}`);
      }
    }
  }
  return links.size;
}

function knownWorkerFromTimesheet(
  timesheet: Timesheet,
): Pick<KnownWorker, "key" | "name" | "email"> {
  const name = timesheet.vikar.trim();
  const email = timesheet.vikarEmail.trim();
  return {
    key: (name || email).toLowerCase(),
    name,
    email,
  };
}
