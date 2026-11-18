// The four files `init` edits outside the Product layer (PER-93). Each is one
// module in `touch-points/` that finds Loupe's edit, applies it, reverts it, and
// says how to do either by hand; `touch-points/list.ts` lists them. This file
// holds what they and their callers share, and imports nothing.

export type TouchPointId = "biome-config" | "next-config" | "package-json" | "root-layout";

/**
 * `exact`: the insertion is exactly what `apply` writes, so it can be adopted
 * without asking. Otherwise it is Loupe's, but shaped by someone else.
 *
 * `legacy`: the form Loupe 0.0.4 and earlier hashed, rebuilt with the Loupe
 * version the ledger recorded. Only a touch point whose hash used to carry the
 * version has one (ADR 0001).
 */
export type Found = { canonical: string; exact: boolean; legacy?: (version: string) => string };

/** A file's new text, and what changed in it, as one line. */
export type Change = { text: string; summary: string };

/** `unexpected`: why the file isn't in a shape `apply` can edit, so the person makes the edit by hand. */
export type Applied = Change | { unexpected: string };

/** `manual`: why Loupe's edit can't be taken out on its own, so the person reverts it by hand. */
export type Reverted = Change | { manual: string };

/**
 * What a touch point's edit is to the Product layer, which is what the commands go by instead of its id:
 * - `imports-layer`: the app imports the layer through it. `remove` reverts these first, and while one stays,
 *   it stops before the layer so the app still builds.
 * - `excludes-layer`: it keeps tools off the layer's files, so `remove` keeps it while the layer has files.
 * - `adds-dependencies`: it adds the layer and Loupe to the app's dependencies, so a change to it needs an install.
 */
export type Role = "imports-layer" | "excludes-layer" | "adds-dependencies";

/**
 * One file `init` edits. Its methods only read and return text: the commands read and write the
 * file and record it in the ledger. Reverting what `apply` wrote gives back the original bytes.
 */
export type TouchPoint = {
  id: TouchPointId;
  role: Role;
  /** Repo-relative, POSIX. */
  file: string;
  /** Loupe's edit in `text`, in the form the ledger hashes; undefined when there is none. */
  find(text: string): Found | undefined;
  /** `text` is undefined when the file doesn't exist. */
  apply(text: string | undefined): Applied;
  /**
   * `text` with Loupe's edit taken out: the file as it was before `apply` when that can be told,
   * else with only what `apply` wrote removed.
   */
  revert(text: string): Reverted;
  /** How to make the edit by hand when `apply` meets an unexpected shape, one line each. */
  applyByHand: string[];
  /** How to take the edit out by hand, as a clause: "Undo your edit, or <this>; then rerun loupe remove." */
  revertByHand: string;
};

export type TouchPointContext = {
  root: string;
  /** The app's directory, relative to the root; without it, only the touch points at the root are listed. */
  app?: string;
  version: string;
  /** How the app's package.json names workspace packages ("workspace:*"). */
  workspaceProtocol: string;
};
