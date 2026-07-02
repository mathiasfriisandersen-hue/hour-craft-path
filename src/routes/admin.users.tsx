import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

const USERS = [
  {
    name: "Bruger 1",
    role: "Bruger",
    access: "Admin-adgang uden regelgrundlag",
  },
];

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin — Brugere" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  return (
    <AppShell allow={["admin"]}>
      <section className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Brugere</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oversigt over brugere med adgang til systemet.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[1.2fr_1fr_1.5fr] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
            <div>Navn</div>
            <div>Rolle</div>
            <div>Adgang</div>
          </div>
          {USERS.map((user) => (
            <div
              key={user.name}
              className="grid grid-cols-[1.2fr_1fr_1.5fr] gap-4 px-4 py-4 text-sm"
            >
              <div className="font-medium">{user.name}</div>
              <div>{user.role}</div>
              <div className="text-muted-foreground">{user.access}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
