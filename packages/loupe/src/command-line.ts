// The `loupe` command a person or an agent runs from the repo root, as text. The
// panel's notices, `loupe doctor` and the Proposal (ADR 0002) all print one, so
// they share this. It runs in the browser too, so it imports nothing from Node.

import { PRODUCT_LAYER } from "./names.js";

/** Repo-relative POSIX paths: the app Loupe is installed in, and the Product layer. */
export type CommandPaths = { app: string; layer: string };

/**
 * `pnpm -C apps/app exec loupe <sub>`, with `--out` only when the layer isn't the
 * default `packages/loupe`. No `--root`: run from the app, the command finds the
 * workspace root itself (PER-233).
 */
export function loupeCommand(sub: string, { app, layer }: CommandPaths): string {
  const out = clean(layer) === PRODUCT_LAYER.path ? "" : ` --out ${quoteForShell(relativePosix(app, layer) || ".")}`;
  const appRel = clean(app);
  return `${appRel === "" ? "pnpm" : `pnpm -C ${quoteForShell(appRel)}`} exec loupe ${sub}${out}`;
}

/** As it is when the shell reads it back unchanged, else in single quotes, a `'` inside written `'\''`. */
export function quoteForShell(file: string): string {
  return /^[A-Za-z0-9._/@-]+$/.test(file) ? file : `'${file.replaceAll("'", `'\\''`)}'`;
}

function segments(file: string): string[] {
  return file.split("/").filter((part) => part !== "" && part !== ".");
}

function clean(file: string): string {
  return segments(file).join("/");
}

/** `path.posix.relative` for two repo-relative paths. */
export function relativePosix(from: string, to: string): string {
  const a = segments(from);
  const b = segments(to);
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  return [...a.slice(shared).map(() => ".."), ...b.slice(shared)].join("/");
}
