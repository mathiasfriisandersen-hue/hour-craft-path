import { createFileRoute } from "@tanstack/react-router";
import { AdminOverviewContent } from "./admin.index";

export const Route = createFileRoute("/bruger2/")({
  head: () => ({ meta: [{ title: "Bruger 2 — Timesedler" }] }),
  component: Bruger2Page,
});

function Bruger2Page() {
  return <AdminOverviewContent role="bruger2" dashboardShell />;
}
