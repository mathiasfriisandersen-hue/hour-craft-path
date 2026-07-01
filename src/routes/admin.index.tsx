import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimesheets } from "@/lib/use-timesheets";
import {
  calculateTimesheet,
  formatWeekRange,
  STATUS_LABEL,
  timesheetsToCsv,
  totalHours,
  weekNumber,
  type Status,
} from "@/lib/timesheet-store";
import { activeCollectiveAgreements } from "@/lib/collectiveAgreements";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overblik" }] }),
  component: AdminList,
});

function AdminList() {
  const all = useTimesheets();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [agreement, setAgreement] = useState("all");
  const [week, setWeek] = useState("");

  const submitted = useMemo(() => all.filter((item) => item.status !== "draft"), [all]);

  const list = useMemo(() => {
    const needle = query.toLocaleLowerCase("da-DK");
    return submitted.filter((item) => {
      const text = `${item.vikar} ${item.brugervirksomhed} ${item.kontaktperson}`.toLocaleLowerCase(
        "da-DK",
      );
      return (
        (!needle || text.includes(needle)) &&
        (status === "all" || item.status === status) &&
        (agreement === "all" || item.selectedAgreementId === agreement) &&
        (!week || String(weekNumber(item.weekStart)) === week)
      );
    });
  }, [submitted, query, status, agreement, week]);

  const exportCsv = () => {
    const blob = new Blob([timesheetsToCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesedler-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const counts = (value: Status) => submitted.filter((item) => item.status === value).length;

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Timesedler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrér indsendelser, kontrol og regelgrundlag.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!list.length}>
          Eksportér CSV
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["sent", "approved", "rejected"] as Status[]).map((value) => (
          <button
            key={value}
            onClick={() => setStatus(status === value ? "all" : value)}
            className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="text-2xl font-semibold tabular-nums">{counts(value)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{STATUS_LABEL[value]}</div>
          </button>
        ))}
      </div>

      <section className="mb-5 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Søg vikar eller virksomhed…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "all")}
          >
            <option value="all">Alle statusser</option>
            {Object.entries(STATUS_LABEL)
              .filter(([value]) => value !== "draft")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={agreement}
            onChange={(e) => setAgreement(e.target.value)}
          >
            <option value="all">Alle overenskomster</option>
            {activeCollectiveAgreements.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            max={53}
            placeholder="Ugenummer"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </div>
      </section>

      {list.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ingen timesedler matcher filtrene.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {["Vikar", "Virksomhed", "Uge", "Overenskomst", "Timer", "Status", ""].map(
                  (head, i) => (
                    <th key={`${head}-${i}`} className="px-4 py-3 font-medium">
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => {
                const calc = calculateTimesheet(item);
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{item.vikar || "—"}</td>
                    <td className="px-4 py-3">
                      <div>{item.brugervirksomhed || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.kontaktperson || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>Uge {weekNumber(item.weekStart)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatWeekRange(item.weekStart)}
                      </div>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3" title={calc.agreementName}>
                      <div>{calc.agreementName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {calc.rateValidationStatus}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{totalHours(item.days).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/$id"
                        params={{ id: item.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        Åbn →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
