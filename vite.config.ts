// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBasePath =
  process.env.GITHUB_ACTIONS === "true" && repositoryName ? `/${repositoryName}` : "";

export default defineConfig({
  tanstackStart: {
    router: { basepath: pagesBasePath || undefined },
    spa: {
      enabled: true,
      prerender: { outputPath: "/index.html" },
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    base: `${pagesBasePath}/`,
  },
});
