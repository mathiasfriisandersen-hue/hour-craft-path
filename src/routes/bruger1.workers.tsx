import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WorkerOverviewContent } from "./admin.workers";

export const Route = createFileRoute("/bruger1/workers")({
  head: () => ({ meta: [{ title: "Bruger 1 — Vikaroversigt" }] }),
  component: Bruger1WorkersPage,
});

function Bruger1WorkersPage() {
  return (
    <AppShell
      allow={["bruger"]}
      dashboard={{
        title: "Vikaroversigt",
        subtitle: "Overblik over aktive, ledige og inaktive vikarer.",
      }}
    >
      <WorkerOverviewContent role="bruger" showBackLink backHref="/bruger1" dashboardShell />
    </AppShell>
  );
}
