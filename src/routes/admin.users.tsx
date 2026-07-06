import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ChevronRight, UsersRound, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ADMIN_USERS } from "@/lib/admin-users";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin — Brugere" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [search, setSearch] = useState("");
  if (pathname !== "/admin/users") return <Outlet />;
  const totalUsers = ADMIN_USERS.length;
  const activeUsers = ADMIN_USERS.length;

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Brugere",
        subtitle: "Oversigt over brugere med adgang til systemet.",
        search: {
          value: search,
          onChange: setSearch,
          placeholder: "Søg efter bruger...",
        },
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-2">
          <UserKpiCard
            label="Samlede brugere"
            value={totalUsers}
            meta="Eksisterende brugere"
            icon={UsersRound}
            tone="blue"
          />
          <UserKpiCard
            label="Aktive brugere"
            value={activeUsers}
            meta="Aktive nu"
            icon={CheckCircle2}
            tone="green"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Brugerliste</h2>
              <p className="mt-1 text-sm text-slate-500">
                Oversigt over alle brugere med adgang til systemet.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Viser 1-{totalUsers} af {totalUsers}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Navn</th>
                  <th className="px-5 py-3 font-semibold">Rolle</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {ADMIN_USERS.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-3 text-left"
                        onClick={() =>
                          navigate({
                            to: "/admin/users/$id",
                            params: { id: user.id },
                          })
                        }
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                          {user.name === "Bruger 1" ? "B1" : "B2"}
                        </span>
                        <span className="font-semibold text-slate-950">{user.name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{user.role}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Aktiv
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                        onClick={() =>
                          navigate({
                            to: "/admin/users/$id",
                            params: { id: user.id },
                          })
                        }
                      >
                        Vis profil
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UserKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  meta: string;
  icon: LucideIcon;
  tone: "blue" | "green";
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className={cn("grid h-14 w-14 place-items-center rounded-full", toneIconClass(tone))}>
          <Icon className="h-7 w-7" />
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-5 text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-4xl font-semibold leading-none text-slate-950 tabular-nums">
        {value}
      </div>
      <div className={cn("mt-3 text-sm font-semibold", toneTextClass(tone))}>{meta}</div>
    </article>
  );
}

function toneIconClass(tone: "blue" | "green"): string {
  if (tone === "green") return "bg-emerald-100 text-emerald-600";
  return "bg-blue-100 text-blue-600";
}

function toneTextClass(tone: "blue" | "green"): string {
  if (tone === "green") return "text-emerald-600";
  return "text-blue-600";
}
