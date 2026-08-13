import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import subzLogo from "@/assets/sub-z-logo.png";
import { fetchWorkerInviteByToken } from "@/lib/worker-invite";

type InviteState = "loading" | "valid" | "invalid";

export const Route = createFileRoute("/vikar/invite")({
  head: () => ({ meta: [{ title: "Vikar — Invitation" }] }),
  component: VikarInvitePage,
});

function VikarInvitePage() {
  const [inviteState, setInviteState] = useState<InviteState>("loading");

  useEffect(() => {
    let isMounted = true;

    async function validateInvite() {
      const token =
        typeof window === "undefined"
          ? ""
          : (new URLSearchParams(window.location.search).get("i") ?? "");
      const valid = token ? await fetchWorkerInviteByToken(token) : false;
      if (isMounted) setInviteState(valid ? "valid" : "invalid");
    }

    void validateInvite();
    return () => {
      isMounted = false;
    };
  }, []);

  if (inviteState === "loading") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Kontrollerer invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vent et øjeblik…</p>
      </InviteShell>
    );
  }

  if (inviteState === "invalid") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitationen er ugyldig</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linket er udløbet, allerede brugt eller kunne ikke verificeres sikkert. Kontakt Sub-Z for
          en ny invitation.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <h1 className="text-2xl font-semibold">Invitationen er gyldig</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Invitationen indeholder ikke dine timeseddeldata og giver ikke adgang alene. Du skal logge
        ind med den serververificerede Supabase-session eller det personlige magic link fra Sub-Z,
        før timesedlen kan åbnes.
      </p>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold leading-tight">Timeseddel</div>
            <div className="text-xs text-muted-foreground">Vikarlogin</div>
          </div>
          <img src={subzLogo} alt="SUB-Z" className="h-8 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
