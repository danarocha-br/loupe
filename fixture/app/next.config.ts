import { withLoupe } from "@danarocha/loupe/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otherwise `next dev` writes AGENTS.md and CLAUDE.md into the fixture.
  agentRules: false,
};

// The loader runs under `next dev` only; every other phase gets nextConfig as is.
export default withLoupe(nextConfig, { adaptList: "./loupe/adapt-list.json" });
