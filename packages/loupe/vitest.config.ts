import { defineConfig } from "vitest/config";

// Vite only transforms .ts/.mts by default; next.cts and loader.cts are CommonJS sources.
export default defineConfig({ oxc: { include: /\.[cm]?tsx?$/ } });
