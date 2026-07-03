import { createFileRoute } from "@tanstack/react-router";
import { CompaniesPage } from "./admin.companies";

export const Route = createFileRoute("/bruger2/companies")({
  head: () => ({ meta: [{ title: "Bruger 2 — Virksomheder" }] }),
  component: CompaniesPage,
});
