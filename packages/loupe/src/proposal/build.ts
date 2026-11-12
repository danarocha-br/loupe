// The Proposal builder (PER-135): the Override store, plus what the page showed of
// each Instance, into the Proposal JSON. Pure, like the store: the Toolbar gathers
// the inputs (`toolbar/proposal.ts`) and nothing here reads the page. Nothing is
// written anywhere and nothing is cleared: a Proposal is a reading of the store.
//
// One entry per record, by the scope it was set at, never flattened per Instance
// (PER-90). State-prop values go to "States shown", suspended records to "Held for
// review" (PER-96, PER-97, PER-99).

import { parseCallSiteId } from "../call-site.js";
import { parseHint } from "../runtime/inspect.js";
import { keyOf, type OverrideRecord, type Props, type ScopeTarget } from "../runtime/store.js";
import { stateSiblingName } from "../state-prop.js";
import { formatCurrent } from "../toolbar/format.js";
import type { CallSiteWrites } from "../writes.js";
import {
  FORMAT_VERSION,
  HOW_TO_APPLY,
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
};

const NOT_SET = "not set";

/** The key `setOn` uses for a record's target. */
export function setOnKey(target: ScopeTarget): string {
  return `${target.scope}:${keyOf(target)}`;
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** A value as JSON: functions, elements and other non-JSON values become how the Toolbar shows them. */
export function toJson(value: unknown, seen: WeakSet<object> = new WeakSet()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  const plain =
    Array.isArray(value) ||
    (typeof value === "object" && !("$$typeof" in value) && Object.getPrototypeOf(value) === Object.prototype);
  if (!plain) return formatCurrent(value);
  const object = value as object;
  if (seen.has(object)) return "[Circular]";
  seen.add(object);
  const result: JsonValue = Array.isArray(object)
    ? object.map((inner) => toJson(inner, seen))
    : Object.fromEntries(Object.entries(object).map(([key, inner]) => [key, toJson(inner, seen)]));
  seen.delete(object);
  return result;
}

function proposedOf(value: unknown): Pick<ProposalProp, "proposed" | "proposedUnset"> {
  return value === undefined ? { proposedUnset: true } : { proposed: toJson(value) };
}

/** The part of an Instance id after the anchor: its key path, with any `~n` mount-order suffix. */
function keyPathOfId(id: string, anchor: string): string {
  return id.startsWith(`${anchor}#`) ? id.slice(anchor.length + 1) : "";
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

export function buildProposal(input: ProposalInput): Proposal {
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
  type Draft = { record: OverrideRecord; change: ProposalChange; route: string; covered: Sighting[] };
  const drafts: Draft[] = [];
  const shown: { route: string; state: ProposalStateShown }[] = [];

  for (const record of live) {
    const states = record.target.scope === "instance" ? stateProps(record) : new Set<string>();
    const changed = Object.keys(record.values).filter((prop) => !states.has(prop));
    const route = routeOf(record);

    if (record.target.scope === "instance") {
      const sighting = byId.get(record.target.id);
      const anchor = sighting?.anchor ?? anchorOfId(record.target.id);
      for (const prop of Object.keys(record.values).filter((name) => states.has(name))) {
        shown.push({
          route,
          state: {
            anchor,
            component: sighting?.component ?? parseCallSiteId(anchor)?.component ?? "",
            keyPath: sighting?.keyPath ?? keyPathOfId(record.target.id, anchor),
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
      instances.push({ id, keyPath: seen?.keyPath ?? keyPathOfId(id, anchorOfId(id)), included: false, onScreenAtExport: seen?.mounted ?? false });
    }

    const props: ProposalProp[] = changed.map((name) => ({
      name,
      ...currentOf(included, name),
      ...proposedOf(record.values[name]),
      ...writtenAcross(anchors, name),
    }));

    const routes = new Set(client.flatMap((sighting) => sighting.routes));
    routes.delete(route);

    drafts.push({
      record,
      route,
      covered: included,
      change: {
        id: "",
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
        alsoRendersOn: record.target.scope === "page" ? [] : [...routes].sort(),
        onScreenAtExport: client.some((sighting) => sighting.mounted),
        note: null,
        screenshots: [],
      },
    });
  }

  drafts.forEach((draft, index) => {
    draft.change.id = `c${index + 1}`;
  });
  for (const draft of drafts) draft.change.overriddenBy = overriddenBy(draft, drafts);

  /** How many Instances the call site rendered: those mounted now, else every one seen. */
  function siblingsOf(anchor: string): Sighting[] {
    const all = byAnchor(anchor).filter((sighting) => sighting.rendered === "client");
    const anchors = new Set(all.filter((sighting) => sighting.mounted).map((sighting) => sighting.anchor));
    return all.filter((sighting) => sighting.mounted || !anchors.has(sighting.anchor));
  }

  function conditionOf(record: OverrideRecord, instances: readonly ProposalInstance[]): string | null {
    if (record.target.scope === "instance") {
      const id = record.target.id;
      const anchor = byId.get(id)?.anchor ?? anchorOfId(id);
      const siblings = siblingsOf(anchor);
      const others = siblings.filter((sighting) => sighting.id !== id).length;
      if (others === 0) return null;
      const total = others + 1;
      const keyPath = byId.get(id)?.keyPath ?? keyPathOfId(id, anchor);
      return `1 of ${total} from this call site${keyPath ? ` (${keyPath})` : ""}, needs a condition`;
    }
    const left = instances.filter((instance) => !instance.included);
    if (left.length === 0) return null;
    const keys = left.map((instance) => instance.keyPath || instance.id).join(", ");
    return `Left out: ${left.length} (${keys}), needs a condition`;
  }

  function overriddenBy(draft: Draft, all: readonly Draft[]): string[] {
    const winners = new Set<string>();
    const rank = { instance: 0, group: 1, page: 2 } as const;
    for (const other of all) {
      if (other === draft) continue;
      if (rank[other.record.target.scope] >= rank[draft.record.target.scope]) continue;
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
        screenshots: [],
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
            ? `${target.route} › ${target.component}`
            : target.scope === "group"
              ? target.anchor
              : (byId.get(target.id)?.anchor ?? anchorOfId(target.id)),
        route: routeOf(record),
        reason: suspended.reason,
        detail:
          suspended.reason === "code-changed"
            ? `Code changed here, review: this call site had ${suspended.was} use${suspended.was === 1 ? "" : "s"} and now has ${suspended.now}`
            : `Matches more than one Instance, review: ${suspended.ids.join(", ")}`,
        props: Object.keys(record.values).map((name) => ({ name, ...proposedOf(record.values[name]) })),
      };
    });

  return {
    formatVersion: FORMAT_VERSION,
    title,
    createdAt: input.createdAt,
    designer: input.designer?.trim() ? input.designer.trim() : null,
    project: input.project,
    howToApply: HOW_TO_APPLY,
    routes,
    heldForReview,
  };

  /** Each call site a record covers: its own, or every one a page change reached. */
  function callSiteAnchors(record: OverrideRecord, client: readonly Sighting[]): string[] {
    const { target } = record;
    if (target.scope === "group") return [target.anchor];
    if (target.scope === "instance") return [byId.get(target.id)?.anchor ?? anchorOfId(target.id)];
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
  const anchor = target.scope === "group" ? target.anchor : anchorOfId(target.id);
  return parseCallSiteId(anchor)?.component ?? "";
}

/** An Instance id is its anchor, then `#` and the key path; `~n` marks a mount-order duplicate. */
function anchorOfId(id: string): string {
  const hash = id.indexOf("#");
  const base = hash === -1 ? id : id.slice(0, hash);
  return base.replace(/~\d+$/, "");
}
