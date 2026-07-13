import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-timesheet-gpt")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Timesheet GPT" },
      {
        name: "description",
        content:
          "Simple privacy policy for the Timesheet GPT used with the Hour Craft Path timesheet system.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: PrivacyTimesheetGpt,
});

function PrivacyTimesheetGpt() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16">
      <article className="mx-auto max-w-3xl rounded-lg border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium text-muted-foreground">Hour Craft Path</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy for Timesheet GPT</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 13 July 2026</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">What data the GPT may access</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The GPT may access information from the timesheet system when needed to answer a user
            request. This can include timesheet status, work dates, start and end times, break
            duration, submitted hours, worker names or worker codes, company or project names,
            contact person details, comments, approval status and relevant system configuration.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-xl font-semibold">How the data is used</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The data is used only to help with timesheet-related tasks, such as finding information,
            explaining a timesheet, checking status, preparing support answers and helping users
            understand the workflow. The GPT should not be used to make final payroll, legal or
            collective-agreement decisions without manual validation.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-xl font-semibold">Data sharing and sale</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The information is not sold. Data is only used for the timesheet support purpose
            described above and is not shared with third parties for advertising or resale.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Questions about this privacy policy or the Timesheet GPT can be sent to{" "}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:mathiasfriisandersen@gmail.com">
              mathiasfriisandersen@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
