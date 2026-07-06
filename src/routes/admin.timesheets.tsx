import { createFileRoute } from "@tanstack/react-router";
import { AdminOverviewContent } from "./admin.index";

export const Route = createFileRoute("/admin/timesheets")({
  head: () => ({ meta: [{ title: "Admin — Timesedler" }] }),
  component: AdminTimesheetsPage,
});

function AdminTimesheetsPage() {
  return <AdminOverviewContent role="admin" dashboardShell />;
}
