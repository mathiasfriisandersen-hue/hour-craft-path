import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AdminOverviewContent } from "./admin.index";

export const Route = createFileRoute("/bruger1/")({
  head: () => ({ meta: [{ title: "Bruger 1 — Overblik" }] }),
  component: Bruger1Page,
});

function Bruger1Page() {
  return (
    <AppShell allow={["bruger"]}>
      <AdminOverviewContent role="bruger" />
    </AppShell>
  );
}
