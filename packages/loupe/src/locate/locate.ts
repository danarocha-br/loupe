// `loupe locate` (ADR 0002): finds each call site a Proposal names, by the same
// `transform` the dev loader runs, so its answer can never disagree with the page's
// anchors. For each change it says where the call site is now, whether the code
// around it changed since the Proposal was made, and how each prop is written
// there: still to do, already in the code, or something the designer has to decide.
// Read-only, and pure apart from reading files.

import path from "node:path";
import { parseCallSiteId } from "../call-site.js";
import { type Proposal, type ProposalCallSite, type ProposalChange, type ProposalProp, SCOPE_RANK } from "../proposal/types.js";
import { codeChangedInWords, ordinal } from "../proposal/words.js";
import { plural } from "../toolbar/format.js";
import { type CallSite, type TransformContext, transform } from "../transform.js";
import type { CallSiteWrites, LiteralValue } from "../writes.js";

export type PropStatus =
  /** The code writes the proposed value: nothing left to do here. */
  | { kind: "in-code" }
  /** A literal edit left to make; `written` is what is there now, null when the prop isn't written. */
  | { kind: "to-do"; written: string | null }
  /** The value comes from app logic: the designer decides the code. */
  | { kind: "expression"; expression: string }
  /** Not written, but the call site spreads props, so it may come from them. */
  | { kind: "spread" }
  /**
   * A narrower Apply change in the same Proposal sets this prop at this call site, so
   * its value is the one the code should hold here; `status` reads the code against it.
   */
  | { kind: "overridden"; by: string; status: PropStatus }
  /** Written in a way Loupe can't compare, such as a BigInt. */
  | { kind: "unreadable" };

export type PropReport = { name: string; proposed: string; status: PropStatus };

export type SiteReport = {
  anchor: string;
  path: string;
  enclosing: string;
  component: string;
  nth: number;
  /** `found`, or why it can't be checked: the code around it changed, it is gone, or the file doesn't parse. */
  status: "found" | "code-changed" | "not-found" | "unreadable";
  /** Where it is now, when found or changed. */
  line: number | null;
  column: number | null;
  total: number | null;
  /** What went wrong, in words, when it isn't `found`. */
  detail: string | null;
  /** Empty unless `found`: a site whose code changed can't be read safely. */
  props: PropReport[];
};

export type ChangeReport = Pick<ProposalChange, "id" | "action" | "scope" | "component"> & {
  keyPath: string | null;
  sites: SiteReport[];
};

export type LocateReport = {
  changes: ChangeReport[];
  /** Entries that are not changes to the code: States shown and Flag previews. */
  context: { states: number; flags: number };
  held: number;
};

export type LocateOptions = {
  /** What `transform` reads; build it with `loaderContext`. */
  context: TransformContext;
  /** The file's text, or null when it isn't there. */
  readFile: (file: string) => string | null;
};

function shown(value: unknown): string {
  return value === undefined ? "unset" : JSON.stringify(value);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** How a prop is written at a found call site, against what the Proposal asks for it. */
export function propStatus(prop: ProposalProp, writes: CallSiteWrites): PropStatus {
  const proposed = prop.proposedUnset ? undefined : prop.proposed;
  if (prop.name === "children") {
    if (writes.children === "text") {
      const text = writes.text ?? "";
      return proposed !== undefined && same(text, proposed) ? { kind: "in-code" } : { kind: "to-do", written: JSON.stringify(text) };
    }
    if (writes.children === "none") {
      if (proposed === undefined) return { kind: "in-code" };
      return writes.spreads ? { kind: "spread" } : { kind: "to-do", written: null };
    }
    return { kind: "expression", expression: `children ${writes.children === "elements" ? "are elements" : "come from code"}` };
  }
  const attribute = writes.attributes.find((entry) => entry.name === prop.name);
  if (!attribute) {
    if (proposed === undefined) return { kind: "in-code" };
    return writes.spreads ? { kind: "spread" } : { kind: "to-do", written: null };
  }
  if (attribute.writtenAs === "expression") return { kind: "expression", expression: attribute.expression ?? "" };
  if (!("value" in attribute)) return { kind: "unreadable" };
  const written: LiteralValue | undefined = attribute.value;
  if (proposed !== undefined && same(written, proposed)) return { kind: "in-code" };
  return { kind: "to-do", written: JSON.stringify(written) };
}

/** "MemberRowMenu has 3 uses of <Button> now, no 4th", or that it has none. */
function missing(site: ProposalCallSite, sites: readonly CallSite[]): string {
  const key = parseCallSiteId(site.anchor);
  const enclosing = key?.enclosing ?? site.enclosing;
  const component = key?.component ?? site.component;
  const peers = sites.filter((entry) => entry.enclosing === enclosing && entry.component === component);
  if (peers.length === 0) return `No <${component}> in ${enclosing || "this file"} any more.`;
  return `${enclosing || "This file"} has ${plural(peers.length, "use")} of <${component}> now, no ${ordinal(key?.ordinal ?? site.nth)}.`;
}

/** Finds every call site the Proposal's changes name, and reads how each prop is written there. */
export function locateProposal(proposal: Proposal, options: LocateOptions): LocateReport {
  const changes = proposal.routes.flatMap((route) => route.changes);
  const parsed = new Map<string, { sites: CallSite[]; error: string | null } | null>();

  const read = (relative: string) => {
    if (parsed.has(relative)) return parsed.get(relative) ?? null;
    const file = path.join(options.context.root, relative);
    const source = options.readFile(file);
    const result = source === null ? null : transform(source, file, options.context);
    const entry = result === null ? null : { sites: result.callSites, error: result.parseError ?? null };
    parsed.set(relative, entry);
    return entry;
  };

  /**
   * The narrowest Apply change, narrower than `change`, that sets `prop` at this call
   * site: its value wins there. A narrower change that asks first doesn't count: the
   * builder makes `change` ask first too, and the code there is the designer's call.
   */
  const winner = (change: ProposalChange, anchor: string, prop: string): { id: string; prop: ProposalProp } | null => {
    const narrower = changes
      .filter((other) => other !== change && other.action === "apply" && SCOPE_RANK[other.scope] < SCOPE_RANK[change.scope])
      .filter((other) => other.callSites.some((site) => site.anchor === anchor))
      .sort((a, b) => SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]);
    for (const other of narrower) {
      const set = other.props.find((entry) => entry.name === prop);
      if (set) return { id: other.id, prop: set };
    }
    return null;
  };

  const report = (change: ProposalChange): ChangeReport => ({
    id: change.id,
    action: change.action,
    scope: change.scope,
    component: change.component,
    keyPath: change.scope === "instance" ? (change.instances[0]?.keyPath ?? null) : null,
    sites: change.callSites.map((site): SiteReport => {
      const base = { anchor: site.anchor, path: site.path, enclosing: site.enclosing, component: site.component, nth: site.nth };
      const file = read(site.path);
      if (file === null) return { ...base, status: "not-found", line: null, column: null, total: null, detail: "The file is gone.", props: [] };
      if (file.error !== null) {
        return { ...base, status: "unreadable", line: null, column: null, total: null, detail: `The file doesn't parse: ${file.error}`, props: [] };
      }
      const found = file.sites.find((entry) => entry.id === site.anchor);
      if (!found) return { ...base, status: "not-found", line: null, column: null, total: null, detail: missing(site, file.sites), props: [] };
      const where = { line: found.line, column: found.column, total: found.total };
      if (site.total !== null && site.total !== found.total) {
        return { ...base, ...where, status: "code-changed", detail: `${codeChangedInWords(site.total, found.total)}.`, props: [] };
      }
      const props = change.props.map((prop): PropReport => {
        const by = winner(change, site.anchor, prop.name);
        const proposed = shown(prop.proposedUnset ? undefined : prop.proposed);
        const status: PropStatus = by
          ? { kind: "overridden", by: by.id, status: propStatus(by.prop, found.writes) }
          : propStatus(prop, found.writes);
        return { name: prop.name, proposed, status };
      });
      return { ...base, ...where, status: "found", detail: null, props };
    }),
  });

  return {
    changes: changes.map(report),
    context: {
      states: proposal.routes.reduce((sum, route) => sum + route.statesShown.length, 0),
      flags: Object.keys(proposal.routes[0]?.flags ?? {}).length,
    },
    held: proposal.heldForReview.length,
  };
}

/** Whether the code holds what it should for this prop: the proposed value, or the narrower change's that wins here. */
export function inCode(status: PropStatus): boolean {
  return status.kind === "in-code" || (status.kind === "overridden" && inCode(status.status));
}

/** Whether every prop of every call site of a change is in the code: what `--check` asks of each Apply change. */
export function applied(change: ChangeReport): boolean {
  return change.sites.every((site) => site.status === "found" && site.props.every((prop) => inCode(prop.status)));
}
