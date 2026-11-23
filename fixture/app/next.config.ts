import { withLoupe } from "@danarocha/loupe/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otherwise `next dev` writes AGENTS.md and CLAUDE.md into the fixture.
  agentRules: false,
  // The app's own code, as a host should compile it (ADR 0004). Loupe's toolbar
  // comes compiled from its own build; Next doesn't compile node_modules.
  reactCompiler: true,
  // Typed `href`s: a link to a route that does not exist fails the typecheck.
  typedRoutes: true,
  // Cache Components: dynamic by default, `use cache` to opt in. Loupe's toolbar and
  // its Server Actions work under it (they read cookies and headers per call).
  cacheComponents: true,
};

// The loader runs under `next dev` only; every other phase gets nextConfig as is.
export default withLoupe(nextConfig, { adaptList: "./loupe/adapt-list.json" });
