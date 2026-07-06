import { createFileRoute } from "@tanstack/react-router";
import { AdminOverviewContent } from "./admin.index";

export const Route = createFileRoute("/bruger1/")({
  head: () => ({ meta: [{ title: "Bruger 1 — Timesedler" }] }),
  component: Bruger1Page,
});

function Bruger1Page() {
  return <AdminOverviewContent role="bruger" dashboardShell />;
}
