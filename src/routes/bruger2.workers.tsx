import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WorkerOverviewContent } from "./admin.workers";

export const Route = createFileRoute("/bruger2/workers")({
  head: () => ({ meta: [{ title: "Bruger 2 — Vikaroversigt" }] }),
  component: Bruger2WorkersPage,
});

function Bruger2WorkersPage() {
  return (
    <AppShell allow={["bruger2"]}>
      <WorkerOverviewContent role="bruger2" showBackLink backHref="/bruger2" />
    </AppShell>
  );
}
