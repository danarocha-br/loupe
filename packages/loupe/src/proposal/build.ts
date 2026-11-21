// The Proposal builder (PER-135): the Override store, plus what the page showed of
// each Instance, into the Proposal JSON. Pure, like the store: the Toolbar gathers
// the inputs (`toolbar/proposal.ts`) and nothing here reads the page. Nothing is
// written anywhere and nothing is cleared: a Proposal is a reading of the store.
//
// One entry per record, by the scope it was set at, never flattened per Instance
// (PER-90). State-prop values go to "States shown", suspended records to "Held for
// review" (PER-96, PER-97, PER-99). Each change says what the agent does with it,
// Apply or Ask first, and why (ADR 0002).

import { pageAnchor, parseCallSiteId, parseHint, parseInstanceId } from "../call-site.js";
import { keyOf, type OverrideRecord, type Props, type ScopeTarget } from "../runtime/store.js";
import { stateSiblingName } from "../state-prop.js";
import { formatCurrent, plural } from "../toolbar/format.js";
import type { CallSiteWrites } from "../writes.js";
import { toJson } from "./json.js";
import { codeChangedInWords, propInWords } from "./words.js";
import {
  FORMAT_VERSION,
  howToApply,
  type JsonValue,
  type Proposal,
  type ProposalCallSite,
  type ProposalChange,
  type ProposalHeld,
  type ProposalInstance,
  type ProposalProject,
  type ProposalProp,
  type ProposalRoute,
  type ProposalStateShown,
  SCOPE_RANK,
  type WrittenAs,
} from "./types.js";

/** What the page last showed of one Instance. Kept after it unmounts: "last seen". */
export type Sighting = {
  id: string;
  anchor: string;
  /** `path:line:col n/total`. */
  hint: string | null;
  component: string;
  keyPath: string;
  rendered: "client" | "server";
  /** The app's own props when last seen: the Current value. */
  current: Props;
  writes: CallSiteWrites | null;
  stateProps: readonly string[];
  /** Every route it was seen on, the latest last. */
  routes: string[];
  /** Mounted at export. */
  mounted: boolean;
};

/** What a route looked like when last seen. */
export type RouteContext = {
  url: string;
  viewport: [number, number] | null;
  dpr: number;
  theme: "light" | "dark" | null;
  capturedAt: string;
};

export type ProposalInput = {
  /** Required: an empty title throws. */
  title: string;
  designer?: string | null;
  createdAt: string;
  project: ProposalProject;
  records: readonly OverrideRecord[];
  sightings: readonly Sighting[];
  /** Per record (`setOnKey`), the route it was set on. Page records carry their own. */
  setOn: Readonly<Record<string, string>>;
  routes: Readonly<Record<string, RouteContext>>;
  /** The route at export: where a record with nothing else to place it goes. */
  currentRoute: string;
  /** Previewed flags; the override cookie is site-wide, so every route group carries them. */
  flags: Readonly<Record<string, JsonValue>>;
  /** Per record (`setOnKey`), the designer's note: the "why" (PER-139). Blank is none. */
  notes?: Readonly<Record<string, string>>;
  /**
   * The number of each change, given its record's key (`setOnKey`) and values, in the
   * order given: the Toolbar passes the page's numbering (`toolbar/numbers.ts`), so
   * `c2` is the change the page marks Δ2, gaps and all. Without it, 1, 2, 3 in
   * record order.
   */
  number?: (changes: readonly { key: string; values: Readonly<Record<string, unknown>> }[]) => number[];
};

const inOrder = (changes: readonly unknown[]): number[] => changes.map((_, index) => index + 1);

const NOT_SET = "not set";

/** The key `setOn` uses for a record's target. */
export function setOnKey(target: ScopeTarget): string {
  return `${target.scope}:${keyOf(target)}`;
}

function proposedOf(value: unknown): Pick<ProposalProp, "proposed" | "proposedUnset"> {
  return value === undefined ? { proposedUnset: true } : { proposed: toJson(value) };
}

function callSiteOf(anchor: string, sighting: Sighting | undefined, component: string): ProposalCallSite {
  const key = parseCallSiteId(anchor);
  const hint = parseHint(sighting?.hint ?? null);
  return {
    path: key?.path ?? hint?.path ?? anchor,
    enclosing: key?.enclosing ?? "",
    component: key?.component ?? component,
    nth: key?.ordinal ?? hint?.ordinal ?? 1,
    total: hint?.total ?? null,
    anchor,
    lineHint: hint ? `${hint.line}:${hint.column}` : null,
  };
}

function writtenAsOf(writes: CallSiteWrites | null, prop: string): { writtenAs: Exclude<WrittenAs, "varies">; expression?: string } {
  if (writes === null) return { writtenAs: "unknown" };
  const attribute = writes.attributes.find((entry) => entry.name === prop);
  if (attribute) {
    return attribute.writtenAs === "expression"
      ? { writtenAs: "expression", expression: attribute.expression ?? "" }
      : { writtenAs: "literal" };
  }
  if (prop === "children" && writes.children !== "none") {
    // Only literal text is editable (PER-113), so a text change is always a literal.
    return { writtenAs: writes.children === "text" ? "literal" : "expression" };
  }
  return { writtenAs: writes.spreads ? "spread" : "unset" };
}

/**
 * Why a change needs the designer's decision before it is written (ADR 0002): it
 * reaches some Instances of a call site only, a prop's value comes from app logic or
 * spread props, Loupe has no record of how a call site writes it, or a page change
 * reached server-rendered Instances the designer never saw change. Empty: a literal
 * edit at each call site, so the change is Apply. A prop some call sites write as a
 * literal and others don't write at all is still one literal edit each, so it stays
 * Apply: the ADR asks first only for expressions and spreads. What a narrower change
 * passes on is added by the builder, which knows the other changes.
 */
export function askFirstOf(change: Pick<ProposalChange, "needsCondition" | "props" | "serverRendered">): string[] {
  const reasons: string[] = [];
  if (change.needsCondition) reasons.push(change.needsCondition);
  for (const prop of change.props) {
    const sites = prop.perCallSite ?? [{ writtenAs: prop.writtenAs, expression: prop.expression }];
    const expression = sites.find((site) => site.writtenAs === "expression");
    if (expression) {
      reasons.push(`${propInWords(prop.name)} is written as an expression${expression.expression ? `: \`${expression.expression}\`` : ""}`);
    }
    if (sites.some((site) => site.writtenAs === "spread")) reasons.push(`${propInWords(prop.name)} may come from props the call site spreads`);
    if (sites.some((site) => site.writtenAs === "unknown")) reasons.push(`Loupe has no record of how the call site writes ${propInWords(prop.name)}`);
  }
  const server = change.serverRendered.length;
  if (server > 0) {
    reasons.push(`${plural(server, "server-rendered Instance")} on the page couldn't be previewed: ask whether to change ${server === 1 ? "its call site" : "their call sites"} too`);
  }
  return reasons;
}

export function buildProposal(input: ProposalInput): Proposal {
  return buildProposalKeyed(input).proposal;
}

/** The Proposal, and per change id the record it reads (`setOnKey`): what a note is kept against. */
export function buildProposalKeyed(input: ProposalInput): { proposal: Proposal; keys: Record<string, string> } {
  const title = input.title.trim();
  if (title === "") throw new Error("[loupe] A Proposal needs a title.");

  const byId = new Map(input.sightings.map((sighting) => [sighting.id, sighting]));
  const byAnchor = (anchor: string) => input.sightings.filter((sighting) => sighting.anchor === anchor);
  /** The call site's freshest sighting: a mounted one, else the last seen. */
  const anySightingOf = (anchor: string): Sighting | undefined => {
    const all = byAnchor(anchor);
    const client = all.filter((sighting) => sighting.rendered === "client");
    return client.find((sighting) => sighting.mounted) ?? client.at(-1) ?? all.at(-1);
  };

  const live = input.records.filter((record) => !record.suspended);
  const routeOf = (record: OverrideRecord): string => {
    if (record.target.scope === "page") return record.target.route;
    const set = input.setOn[setOnKey(record.target)];
    if (set !== undefined) return set;
    const seen = coverage(record).find((sighting) => sighting.routes.length > 0);
    return seen?.routes[seen.routes.length - 1] ?? input.currentRoute;
  };

  /**
   * The sighted Instances a record reaches, left-out ones included. Per call site,
   * only the mounted ones while any is: the rest are rows from another page of a
   * list, and would count twice. A call site with nothing mounted, such as a
   * closed dialog's, keeps what it last showed.
   */
  function coverage(record: OverrideRecord): Sighting[] {
    const { target } = record;
    let all: Sighting[];
    switch (target.scope) {
      case "instance": {
        const sighting = byId.get(target.id);
        return sighting ? [sighting] : [];
      }
      case "group":
        all = byAnchor(target.anchor);
        break;
      case "page":
        all = input.sightings.filter(
          (sighting) => sighting.component === target.component && sighting.routes.includes(target.route),
        );
        break;
    }
    const anchors = new Set(all.filter((sighting) => sighting.mounted).map((sighting) => sighting.anchor));
    return all.filter((sighting) => sighting.mounted || !anchors.has(sighting.anchor));
  }

  const stateProps = (record: OverrideRecord): Set<string> => {
    const names = new Set<string>();
    for (const sighting of coverage(record)) for (const prop of sighting.stateProps) names.add(prop);
    return names;
  };

  // Entries first, so `overriddenBy` can name them by id.
  type Draft = { record: OverrideRecord; change: ProposalChange; route: string; covered: Sighting[]; n: number };
  const drafts: Draft[] = [];
  const shown: { route: string; state: ProposalStateShown }[] = [];

  for (const record of live) {
    const states = record.target.scope === "instance" ? stateProps(record) : new Set<string>();
    const changed = Object.keys(record.values).filter((prop) => !states.has(prop));
    const route = routeOf(record);

    if (record.target.scope === "instance") {
      const sighting = byId.get(record.target.id);
      const anchor = sighting?.anchor ?? parseInstanceId(record.target.id).anchor;
      for (const prop of Object.keys(record.values).filter((name) => states.has(name))) {
        shown.push({
          route,
          state: {
            anchor,
            component: sighting?.component ?? parseCallSiteId(anchor)?.component ?? "",
            keyPath: sighting?.keyPath ?? parseInstanceId(record.target.id).key,
            prop,
            forced: toJson(record.values[prop]),
            controlled: sighting ? prop in sighting.current : false,
            appControlsVia: stateSiblingName(prop),
            onScreenAtExport: sighting?.mounted ?? false,
          },
        });
      }
    }
    if (changed.length === 0) continue;

    const covered = coverage(record);
    const excluded = new Set(record.excluded);
    const client = covered.filter((sighting) => sighting.rendered === "client");
    const server = covered.filter((sighting) => sighting.rendered === "server");
    const included = client.filter((sighting) => !excluded.has(sighting.id));
    const component = componentOf(record.target, covered);
    const anchors = callSiteAnchors(record, client);

    const instances: ProposalInstance[] = client.map((sighting) => ({
      id: sighting.id,
      keyPath: sighting.keyPath,
      included: !excluded.has(sighting.id),
      onScreenAtExport: sighting.mounted,
    }));
    // A left-out Instance that isn't covered now still belongs on the record.
    const listed = new Set(instances.map((instance) => instance.id));
    for (const id of record.excluded) {
      if (listed.has(id)) continue;
      const seen = byId.get(id);
      instances.push({ id, keyPath: seen?.keyPath ?? parseInstanceId(id).key, included: false, onScreenAtExport: seen?.mounted ?? false });
    }

    const props: ProposalProp[] = changed.map((name) => ({
      name,
      ...currentOf(included, name),
      ...proposedOf(record.values[name]),
      ...writtenAcross(anchors, name),
    }));

    // An edit at a call site reaches every page that draws it, not only the Instances this change covers.
    const routes = new Set(anchors.flatMap((anchor) => byAnchor(anchor).flatMap((sighting) => sighting.routes)));
    routes.delete(route);

    drafts.push({
      record,
      route,
      covered: included,
      n: 0,
      change: {
        id: "",
        action: "apply",
        askFirst: [],
        scope: record.target.scope === "group" ? "call-site" : record.target.scope,
        component,
        origin: null,
        callSites: anchors.map((anchor) => callSiteOf(anchor, anySightingOf(anchor), component)),
        props,
        instances,
        needsCondition: conditionOf(record, instances),
        serverRendered:
          record.target.scope === "page"
            ? server.map((sighting) => ({ id: sighting.id, anchor: sighting.anchor, keyPath: sighting.keyPath }))
            : [],
        overriddenBy: [],
        alsoRendersOn: [...routes].sort(),
        onScreenAtExport: client.some((sighting) => sighting.mounted),
        note: input.notes?.[setOnKey(record.target)]?.trim() || null,
      },
    });
  }

  // Each change by the number it was made with, gaps kept, and listed in that order.
  const numbers = (input.number ?? inOrder)(drafts.map((draft) => ({ key: setOnKey(draft.record.target), values: draft.record.values })));
  drafts.forEach((draft, index) => {
    draft.n = numbers[index] ?? index + 1;
    draft.change.id = `c${draft.n}`;
  });
  drafts.sort((a, b) => a.n - b.n);
  for (const draft of drafts) draft.change.overriddenBy = overriddenBy(draft, drafts);
  // Narrowest first, so what a narrower change passes on is settled before a wider one reads it.
  const byChangeId = new Map(drafts.map((draft) => [draft.change.id, draft.change]));
  for (const { change } of [...drafts].sort((a, b) => SCOPE_RANK[a.change.scope] - SCOPE_RANK[b.change.scope])) {
    change.askFirst = [...askFirstOf(change), ...passedOn(change)];
    change.action = change.askFirst.length > 0 ? "ask-first" : "apply";
  }

  /**
   * A narrower change that waits for the designer and sets one of this change's props
   * on some of the same Instances: the code at that call site needs the same decision,
   * so this change waits too, rather than letting `--check` call it done.
   */
  function passedOn(change: ProposalChange): string[] {
    return change.overriddenBy.flatMap((id) => {
      const other = byChangeId.get(id);
      if (other?.action !== "ask-first") return [];
      const shared = change.props.filter((prop) => other.props.some((entry) => entry.name === prop.name));
      if (shared.length === 0) return [];
      return [`${other.id} sets ${shared.map((prop) => propInWords(prop.name)).join(", ")} on some of the same Instances and asks first, so this does too`];
    });
  }

  /** How many Instances the call site rendered: those mounted now, else every one seen. */
  function siblingsOf(anchor: string): Sighting[] {
    const all = byAnchor(anchor).filter((sighting) => sighting.rendered === "client");
    const anchors = new Set(all.filter((sighting) => sighting.mounted).map((sighting) => sighting.anchor));
    return all.filter((sighting) => sighting.mounted || !anchors.has(sighting.anchor));
  }

  function conditionOf(record: OverrideRecord, instances: readonly ProposalInstance[]): string | null {
    if (record.target.scope === "instance") {
      const id = record.target.id;
      const anchor = byId.get(id)?.anchor ?? parseInstanceId(id).anchor;
      const siblings = siblingsOf(anchor);
      const others = siblings.filter((sighting) => sighting.id !== id).length;
      if (others === 0) return null;
      const total = others + 1;
      const keyPath = byId.get(id)?.keyPath ?? parseInstanceId(id).key;
      return `1 of ${total} from this call site${keyPath ? ` (${keyPath})` : ""}, needs a condition`;
    }
    const left = instances.filter((instance) => !instance.included);
    if (left.length === 0) return null;
    const keys = left.map((instance) => instance.keyPath || instance.id).join(", ");
    return `Left out: ${left.length} (${keys}), needs a condition`;
  }

  function overriddenBy(draft: Draft, all: readonly Draft[]): string[] {
    const winners = new Set<string>();
    for (const other of all) {
      if (other === draft) continue;
      if (SCOPE_RANK[other.change.scope] >= SCOPE_RANK[draft.change.scope]) continue;
      const shared = Object.keys(other.record.values).some((prop) => prop in draft.record.values);
      if (!shared) continue;
      const reachesOne = other.covered.some((sighting) => draft.covered.some((mine) => mine.id === sighting.id));
      if (reachesOne) winners.add(other.change.id);
    }
    return [...winners];
  }

  const routeNames = new Set<string>([...drafts.map((draft) => draft.route), ...shown.map((entry) => entry.route)]);
  const routes: ProposalRoute[] = [...routeNames]
    .sort((a, b) => (a === input.currentRoute ? -1 : b === input.currentRoute ? 1 : a.localeCompare(b)))
    .map((route) => {
      const context = input.routes[route];
      return {
        url: context?.url ?? null,
        route,
        viewport: context?.viewport ?? null,
        dpr: context?.dpr ?? null,
        theme: context?.theme ?? null,
        flags: { ...input.flags },
        capturedAt: context?.capturedAt ?? null,
        changes: drafts.filter((draft) => draft.route === route).map((draft) => draft.change),
        statesShown: shown.filter((entry) => entry.route === route).map((entry) => entry.state),
      };
    });

  const heldForReview: ProposalHeld[] = input.records
    .filter((record) => record.suspended)
    .map((record) => {
      const suspended = record.suspended as NonNullable<OverrideRecord["suspended"]>;
      const { target } = record;
      return {
        scope: target.scope === "group" ? "call-site" : target.scope,
        component: componentOf(target, coverage(record)),
        anchor:
          target.scope === "page"
            ? pageAnchor(target.route, target.component)
            : target.scope === "group"
              ? target.anchor
              : (byId.get(target.id)?.anchor ?? parseInstanceId(target.id).anchor),
        route: routeOf(record),
        reason: suspended.reason,
        detail:
          suspended.reason === "code-changed"
            ? codeChangedInWords(suspended.was, suspended.now)
            : `Matches more than one Instance, review: ${suspended.ids.join(", ")}`,
        props: Object.keys(record.values).map((name) => ({ name, ...proposedOf(record.values[name]) })),
      };
    });

  const proposal: Proposal = {
    formatVersion: FORMAT_VERSION,
    title,
    createdAt: input.createdAt,
    designer: input.designer?.trim() ? input.designer.trim() : null,
    project: input.project,
    howToApply: howToApply(input.project.install),
    routes,
    heldForReview,
  };
  return { proposal, keys: Object.fromEntries(drafts.map((draft) => [draft.change.id, setOnKey(draft.record.target)])) };

  /** Each call site a record covers: its own, or every one a page change reached. */
  function callSiteAnchors(record: OverrideRecord, client: readonly Sighting[]): string[] {
    const { target } = record;
    if (target.scope === "group") return [target.anchor];
    if (target.scope === "instance") return [byId.get(target.id)?.anchor ?? parseInstanceId(target.id).anchor];
    const excluded = new Set(record.excluded);
    return [...new Set(client.filter((sighting) => !excluded.has(sighting.id)).map((sighting) => sighting.anchor))].sort();
  }

  /** How the call sites write `prop`: one answer, or `varies` with each site's. */
  function writtenAcross(anchors: readonly string[], prop: string): Pick<ProposalProp, "writtenAs" | "expression" | "perCallSite"> {
    const sites = anchors.map((anchor) => ({ anchor, ...writtenAsOf(anySightingOf(anchor)?.writes ?? null, prop) }));
    const first = sites[0];
    if (!first) return { writtenAs: "unknown" };
    const same = sites.every((site) => site.writtenAs === first.writtenAs && site.expression === first.expression);
    if (same) return first.expression === undefined ? { writtenAs: first.writtenAs } : { writtenAs: first.writtenAs, expression: first.expression };
    return { writtenAs: "varies", perCallSite: sites };
  }
}

/** The covered Instances' Current value for a prop: one value, or counts when they differ. */
function currentOf(covered: readonly Sighting[], prop: string): Pick<ProposalProp, "current" | "currentCounts"> {
  if (covered.length === 0) return {};
  // Compared in full, labelled as the Toolbar shows them: two values that read the same get a number.
  const counts = new Map<string, { label: string; count: number }>();
  for (const sighting of covered) {
    const set = prop in sighting.current;
    const value = sighting.current[prop];
    const key = set ? `${typeof value}:${JSON.stringify(toJson(value))}` : "unset";
    const entry = counts.get(key) ?? { label: set ? formatCurrent(value) : NOT_SET, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  if (counts.size > 1) {
    const labelled: Record<string, number> = {};
    for (const { label, count } of counts.values()) {
      let shown = label;
      for (let n = 2; shown in labelled; n++) shown = `${label} (${n})`;
      labelled[shown] = count;
    }
    return { currentCounts: labelled };
  }
  const [one] = covered;
  return one && prop in one.current ? { current: toJson(one.current[prop]) } : {};
}

function componentOf(target: ScopeTarget, covered: readonly Sighting[]): string {
  if (target.scope === "page") return target.component;
  const seen = covered[0]?.component;
  if (seen) return seen;
  const anchor = target.scope === "group" ? target.anchor : parseInstanceId(target.id).anchor;
  return parseCallSiteId(anchor)?.component ?? "";
}
