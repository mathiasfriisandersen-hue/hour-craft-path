import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTimesheets } from "@/lib/use-timesheets";

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
  const list = useTimesheets();
  const counts = {
    draft: list.filter((t) => t.status === "draft").length,
    sent: list.filter((t) => t.status === "sent").length,
    approved: list.filter((t) => t.status === "approved").length,
    rejected: list.filter((t) => t.status === "rejected").length,
  };

  const roles = [
    {
      to: "/vikar",
      title: "Vikar",
      desc: "Registrér dine timer for ugen og send timesedlen til godkendelse hos kontaktpersonen.",
      cta: "Åbn vikar-visning",
    },
    {
      to: "/kontaktperson",
      title: "Kontaktperson",
      desc: "Modtag timesedler fra vikarer og godkend eller afvis de arbejdede timer.",
      cta: "Åbn kontaktperson-visning",
    },
    {
      to: "/admin",
      title: "Admin",
      desc: "Få overblik over alle timesedler, kontrollér overenskomst og se vejledende tillæg.",
      cta: "Åbn admin-overblik",
    },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Timeregistrering for vikarer</h1>
          <p className="text-muted-foreground max-w-2xl">
            Vælg en rolle for at komme i gang. Vikar registrerer timer, kontaktpersonen godkender
            eller afviser, og admin får overblikket.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group rounded-lg border bg-card p-6 hover:border-primary transition-colors"
            >
              <div className="text-sm font-medium text-muted-foreground">Rolle</div>
              <div className="mt-1 text-xl font-semibold">{r.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
              <div className="mt-4 text-sm font-medium text-primary group-hover:underline">
                {r.cta} →
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Status i systemet</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Kladder" value={counts.draft} />
            <Stat label="Sendt til godkendelse" value={counts.sent} />
            <Stat label="Godkendt" value={counts.approved} />
            <Stat label="Afvist" value={counts.rejected} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
