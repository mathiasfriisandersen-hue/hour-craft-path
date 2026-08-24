import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { AppShell, InfoBanner } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAdminAssistant, safeSessionErrorMessage } from "@/lib/api-session";
import { totalHours } from "@/lib/timesheet-store";
import { useTimesheets } from "@/lib/use-timesheets";

export const Route = createFileRoute("/admin/assistant")({
  head: () => ({ meta: [{ title: "Admin — Assistent" }] }),
  component: AdminAssistantPage,
});

type ChatMessage = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Hvad kræver handling lige nu?",
  "Giv mig et kort overblik over godkendelserne.",
  "Er der fravær, jeg skal følge op på?",
];

function AdminAssistantPage() {
  const timesheets = useTimesheets();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hej — jeg kan hjælpe med overblik over de viste timesedler, godkendelser og fravær.",
    },
  ]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const context = useMemo(
    () =>
      timesheets
        .filter((timesheet) => !timesheet.archived)
        .slice(0, 24)
        .map((timesheet) => ({
          id: timesheet.id,
          worker: timesheet.vikar || "Ukendt vikar",
          company: timesheet.brugervirksomhed || "Ukendt virksomhed",
          project: timesheet.projectName || "",
          weekStart: timesheet.weekStart || "",
          status: timesheet.status || "draft",
          totalHours: totalHours(timesheet.days),
          absence: timesheet.days.some((day) => day.absence && day.absence !== "none")
            ? "registreret"
            : "ingen",
          invoiceSent: Boolean(timesheet.invoiceSentDate),
          payrollSent: Boolean(timesheet.payrollSentDate),
        })),
    [timesheets],
  );

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = message.trim();
    if (!question || sending) return;

    setMessage("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", text: question }]);
    try {
      const answer = await askAdminAssistant(question, context);
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (requestError) {
      setError(safeSessionErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Admin assistent",
        subtitle: "Spørg om det aktuelle timeseddeloverblik direkte i Hour Craft.",
      }}
    >
      <InfoBanner tone="info">
        Assistenten læser højst 24 korte timeseddelresuméer ad gangen. Den kan ikke ændre, godkende
        eller slette noget.
      </InfoBanner>
      <section className="mx-auto mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-700">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">Timeseddel-assistent</h2>
            <p className="text-sm text-slate-500">Aktuelt grundlag: {context.length} timesedler</p>
          </div>
        </div>
        <div className="grid gap-3 p-5">
          {messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${
                entry.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {entry.text}
            </div>
          ))}
          {sending && (
            <div className="text-sm text-slate-500">Assistenten undersøger overblikket…</div>
          )}
        </div>
        {error && (
          <p className="mx-5 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMessage(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        <form className="border-t border-slate-100 p-5" onSubmit={send}>
          <div className="flex gap-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Skriv et spørgsmål om timesedlerne…"
              maxLength={1200}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !message.trim()} aria-label="Send spørgsmål">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
