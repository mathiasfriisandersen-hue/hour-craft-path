import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AdminOverviewContent } from "./admin.index";

export const Route = createFileRoute("/bruger2/")({
  head: () => ({ meta: [{ title: "Bruger 2 — Overblik" }] }),
  component: Bruger2Page,
});

function Bruger2Page() {
  return (
    <AppShell allow={["bruger2"]}>
      <AdminOverviewContent role="bruger2" />
    </AppShell>
  );
}
