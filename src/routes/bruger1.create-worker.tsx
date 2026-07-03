import { createFileRoute } from "@tanstack/react-router";
import { CreateWorkerPage } from "./admin.create-worker";

export const Route = createFileRoute("/bruger1/create-worker")({
  head: () => ({ meta: [{ title: "Bruger 1 — Opret vikar" }] }),
  component: CreateWorkerPage,
});
