import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

// Tests run through the build's own Vite config (ADR 0004, 0010), so React Compiler and a
// `.css?inline` import behave here as they do in `dist`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 60_000,
      // jsdom's gaps that UI SDK's parts reach for, filled before any test runs.
      setupFiles: ["./src/surface/jsdom-gaps.fixture.ts"],
      // Without this, Vitest stubs every CSS import as an empty string.
      css: { include: /\.css(?:$|\?)/ },
    },
  }),
);
