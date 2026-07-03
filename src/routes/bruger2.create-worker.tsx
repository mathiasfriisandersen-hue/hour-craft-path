import { createFileRoute } from "@tanstack/react-router";
import { CreateWorkerPage } from "./admin.create-worker";

export const Route = createFileRoute("/bruger2/create-worker")({
  head: () => ({ meta: [{ title: "Bruger 2 — Opret vikar" }] }),
  component: CreateWorkerPage,
});
