import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import subzLogo from "@/assets/sub-z-logo.png";
import { renewWorkerConsent, syncRemoteAppState } from "@/lib/timesheet-store";
import { fetchWorkerConsentByToken, type WorkerConsentPayload } from "@/lib/worker-invite";

export const Route = createFileRoute("/vikar/consent")({
  head: () => ({ meta: [{ title: "Vikar — Samtykke" }] }),
  component: VikarConsentPage,
});

function VikarConsentPage() {
  const [payload, setPayload] = useState<WorkerConsentPayload>();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadConsent() {
      const token = new URLSearchParams(window.location.search).get("i") ?? "";
      const consent = token ? await fetchWorkerConsentByToken(token) : undefined;
      if (isMounted) {
        setPayload(consent);
        setIsLoading(false);
      }
    }

    void loadConsent();
    return () => {
      isMounted = false;
    };
  }, []);

  const confirmConsent = async () => {
    if (!payload) return;
    await syncRemoteAppState();
    const updated = renewWorkerConsent(payload.workerName, payload.workerEmail);
    setMessage(
      updated.length
        ? "Tak. Dit samtykke er fornyet, og Sub-Z kan fortsat kontakte dig om relevante jobmuligheder."
        : "Samtykket er modtaget, men vi kunne ikke finde en lokal vikarregistrering at opdatere.",
    );
  };

  if (isLoading) {
    return (
      <ConsentShell>
        <h1 className="text-2xl font-semibold">Indlæser samtykke</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vent et øjeblik…</p>
      </ConsentShell>
    );
  }

  if (!payload) {
    return (
      <ConsentShell>
        <h1 className="text-2xl font-semibold">Samtykkelinket kunne ikke læses</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linket er ugyldigt eller udløbet. Kontakt Sub-Z, hvis du vil forny dit samtykke.
        </p>
      </ConsentShell>
    );
  }

  return (
    <ConsentShell>
      <h1 className="text-2xl font-semibold">Forny samtykke</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bekræft, at Sub-Z må beholde dine kontaktoplysninger og kontakte dig om relevante
        jobmuligheder.
      </p>
      <Button className="mt-6 w-full" onClick={confirmConsent} disabled={Boolean(message)}>
        Bekræft samtykke
      </Button>
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </ConsentShell>
  );
}

function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
            T
          </div>
          <div>
            <div className="font-semibold leading-tight">Timeseddel</div>
            <div className="text-xs leading-tight text-muted-foreground">Samtykke til kontakt</div>
          </div>
          <img src={subzLogo} alt="SUB-Z" className="ml-auto hidden h-7 w-auto sm:block" />
        </div>
        {children}
      </div>
    </div>
  );
}
