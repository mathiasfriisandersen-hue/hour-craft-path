import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ROLE_HOME, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Timeseddel — MVP" },
      { name: "description", content: "Simpelt timeregistreringssystem til vikarer." },
    ],
  }),
  component: Index,
});

function Index() {
  const { role, ready } = useAuth();

  // Not logged in → AppShell renders the login screen.
  if (!ready || !role) {
    return <AppShell />;
  }

  return <Navigate to={ROLE_HOME[role]} replace />;
}
