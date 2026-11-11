import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otherwise `next dev` writes AGENTS.md and CLAUDE.md into the fixture.
  agentRules: false,
};

export default nextConfig;
