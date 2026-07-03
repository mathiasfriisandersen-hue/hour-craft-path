import { createFileRoute } from "@tanstack/react-router";
import { CompaniesPage } from "./admin.companies";

export const Route = createFileRoute("/bruger1/companies")({
  head: () => ({ meta: [{ title: "Bruger 1 — Virksomheder" }] }),
  component: CompaniesPage,
});
