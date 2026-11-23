import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

// Tests run through the build's own Vite config (ADR 0004), so React Compiler and a
// `.css?inline` import behave here as they do in `dist`. Vite only transforms
// .ts/.mts by default; next.cts and loader.cts are CommonJS sources (`oxc.include`).
// The meta tests build real TypeScript programs, so a loaded runner needs a long timeout.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 60_000,
      hookTimeout: 60_000,
      // Without this, Vitest stubs every CSS import as an empty string.
      css: { include: /\.css(?:$|\?)/ },
    },
  }),
);
