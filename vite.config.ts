// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isLovableSandbox =
  process.env["LOVABLE_SANDBOX"] === "1" || !!process.env["DEV_SERVER__PROJECT_PATH"];

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    ...(!isLovableSandbox
      ? {
          environments: {
            client: { build: { outDir: "dist" } },
            ssr: { build: { outDir: ".tanstack/build-server" } },
          },
        }
      : {}),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(!isLovableSandbox
      ? {
          spa: {
            enabled: true,
            prerender: {
              outputPath: "/index.html",
            },
          },
        }
      : {}),
  },
  ...(!isLovableSandbox ? { nitro: false } : {}),
});
