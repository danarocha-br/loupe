// The Compatibility statement for this release (PER-98). It names the minor
// series 0.x was tested on, never a range. A setup joins it only once proven.
export const STATEMENT =
  "Loupe 0.x supports: Next.js 16.3 with the App Router and Turbopack in development, " +
  "on Node 22 or Bun; a pnpm workspace; TypeScript; one design system kept as a " +
  "workspace package with its source (shadcn on Base UI).";

export type Grade = "supported" | "untested" | "unsupported";

export type Item = {
  /** Stable key, recorded in the ledger with `seen` when an untested item is accepted. */
  key: "next" | "router" | "bundler" | "runtime" | "workspace" | "typescript" | "designSystem";
  grade: Grade;
  /** What was found, as the line prints it. */
  label: string;
  /** The value the ledger remembers; a changed value asks again. */
  seen: string;
  /** Untested: one sentence of risk. Unsupported: what Loupe needs. */
  detail?: string;
  /** Unsupported only, when a fix exists. */
  fix?: string;
  /** Version items are the ones `generate` rechecks. */
  version?: boolean;
};
