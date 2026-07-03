import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ADMIN_USERS } from "@/lib/admin-users";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin — Brugere" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/users") return <Outlet />;

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
          <div className="grid grid-cols-[1.2fr_1fr_1.5fr_auto] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
            <div>Navn</div>
            <div>Rolle</div>
            <div>Adgang</div>
            <div></div>
          </div>
          {ADMIN_USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              className="grid w-full cursor-pointer grid-cols-[1.2fr_1fr_1.5fr_auto] items-center gap-4 px-4 py-4 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() =>
                navigate({
                  to: "/admin/users/$id",
                  params: { id: user.id },
                })
              }
            >
              <div className="font-medium text-primary underline-offset-4 hover:underline">
                {user.name}
              </div>
              <div>{user.role}</div>
              <div className="text-muted-foreground">{user.access}</div>
              <div className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium">
                Åbn
              </div>
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
