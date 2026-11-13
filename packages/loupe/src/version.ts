import { readFileSync } from "node:fs";

// Read from package.json at run time, so the printed version is always the
// one npm installed, whether this runs from `src` (tests) or `dist`.
export const version: string = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

/**
 * Orders two npm versions by semver precedence: negative when `a` is older. A prerelease sorts before its
 * release; build metadata is ignored.
 */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  if (x.pre.length === 0 || y.pre.length === 0) return Math.sign(y.pre.length - x.pre.length);
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i += 1) {
    const d = compareIdentifiers(x.pre[i] ?? "", y.pre[i] ?? "");
    if (d !== 0) return d;
  }
  return Math.sign(x.pre.length - y.pre.length);
}

function parts(version: string): { core: number[]; pre: string[] } {
  const bare = version.split("+")[0] ?? "";
  const dash = bare.indexOf("-");
  const core = dash === -1 ? bare : bare.slice(0, dash);
  return {
    core: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
    pre: dash === -1 ? [] : bare.slice(dash + 1).split("."),
  };
}

/** Numeric identifiers compare as numbers and sort before alphanumeric ones, which compare as text. */
function compareIdentifiers(p: string, q: string): number {
  const pn = /^\d+$/.test(p);
  const qn = /^\d+$/.test(q);
  if (pn && qn) return Math.sign(Number(p) - Number(q));
  if (pn !== qn) return pn ? -1 : 1;
  return p < q ? -1 : p > q ? 1 : 0;
}
