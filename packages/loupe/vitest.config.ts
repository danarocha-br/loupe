import { defineConfig } from "vitest/config";

// Vite only transforms .ts/.mts by default; next.cts and loader.cts are CommonJS sources.
// The meta tests build real TypeScript programs, so a loaded runner needs a long timeout.
export default defineConfig({
  oxc: { include: /\.[cm]?tsx?$/ },
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
