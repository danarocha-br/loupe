import { describe, expect, it, vi } from "vitest";
import { callSiteId, instanceId, unanchoredId } from "../call-site.js";
import {
  createOverrideStore,
  type InstanceKey,
  inScope,
  namesInstance,
  reachOf,
  recordsFor,
  type Scope,
  type ScopeTarget,
  targetAt,
} from "./store.js";

const TRIGGER = callSiteId({ path: "app/menu.tsx", enclosing: "MemberRowMenu", component: "Button", ordinal: 1 });
const OTHER_SITE = callSiteId({ path: "app/invites.tsx", enclosing: "InvitationRowMenu", component: "Button", ordinal: 1 });
const ROUTE = "/settings/members";

const row = (n: number, current: Record<string, unknown> = { variant: "ghost" }): InstanceKey => ({
  id: instanceId(TRIGGER, `m${n}`),
  anchor: TRIGGER,
  component: "Button",
  route: ROUTE,
  current,
});
const invite = (current: Record<string, unknown> = { variant: "ghost" }): InstanceKey => ({
  id: instanceId(OTHER_SITE, "i1"),
  anchor: OTHER_SITE,
  component: "Button",
  route: ROUTE,
  current,
});

const ROW_1 = row(1).id;
const ROW_2 = row(2).id;
const instance = (id: string): ScopeTarget => ({ scope: "instance", id });
const group = (anchor = TRIGGER): ScopeTarget => ({ scope: "group", anchor });
const page = (component = "Button", route = ROUTE): ScopeTarget => ({ scope: "page", route, component });

describe("Override store: the Instance scope", () => {
  it("resolves to the Current value, every value from the app, when nothing is overridden", () => {
    const store = createOverrideStore();
    const resolved = store.resolve(row(1, { variant: "ghost", size: "icon" }));
    expect(resolved).toEqual({
      props: { variant: "ghost", size: "icon" },
      sources: { variant: "app", size: "app" },
      overrides: {},
    });
  });

  it("puts an Instance Override on top of the Current value and names its source", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    const resolved = store.resolve(row(1, { variant: "ghost", size: "icon" }));
    expect(resolved.props).toEqual({ variant: "destructive", size: "icon" });
    expect(resolved.sources).toEqual({ variant: "instance", size: "app" });
    expect(resolved.overrides).toEqual({ variant: "destructive" });
  });

  it("can override a prop the app never passed", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "disabled", true);
    const resolved = store.resolve(row(1, {}));
    expect(resolved.props).toEqual({ disabled: true });
    expect(resolved.sources).toEqual({ disabled: "instance" });
  });

  it("treats undefined as an Override that unsets the prop", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", undefined);
    const resolved = store.resolve(row(1));
    expect("variant" in resolved.props).toBe(true);
    expect(resolved.props.variant).toBeUndefined();
    expect(resolved.sources.variant).toBe("instance");
  });

  it("keeps repeated Instances independent", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    expect(store.resolve(row(2)).props.variant).toBe("ghost");
    expect(store.applies(row(2))).toBe(false);
  });

  it("follows the live Current value under an Override, so computed props keep updating", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    expect(store.resolve(row(1, { variant: "ghost", disabled: false })).props).toEqual({
      variant: "destructive",
      disabled: false,
    });
    expect(store.resolve(row(1, { variant: "ghost", disabled: true })).props).toEqual({
      variant: "destructive",
      disabled: true,
    });
  });

  it("resets one prop back to the Current value and leaves the others", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(instance(ROW_1), "size", "lg");
    store.reset(instance(ROW_1), "variant");
    const resolved = store.resolve(row(1, { variant: "ghost", size: "icon" }));
    expect(resolved.props).toEqual({ variant: "ghost", size: "lg" });
    expect(resolved.sources).toEqual({ variant: "app", size: "instance" });
  });

  it("resets every prop of an Instance and drops its record", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(instance(ROW_1), "size", "lg");
    store.set(instance(ROW_2), "size", "sm");
    store.reset(instance(ROW_1));
    expect(store.applies(row(1))).toBe(false);
    expect(store.records()).toEqual([{ target: instance(ROW_2), values: { size: "sm" }, excluded: [], suspended: null }]);
  });

  it("resetting the last prop drops the record", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    store.reset(instance(ROW_1), "variant");
    expect(store.records()).toEqual([]);
  });

  it("keeps records by Instance id, independent of anything being mounted", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    // Whatever unmounts and mounts again under the same id finds its Override.
    expect(store.resolve(row(1)).props.variant).toBe("destructive");
  });

  it("has no exclusions: excluding the one Instance it targets would be a reset", () => {
    const store = createOverrideStore();
    expect(() => store.exclude(instance(ROW_1), ROW_1)).toThrow(/group or page/);
  });
});

describe("Override store: group and page scopes", () => {
  it("a group Override reaches every Instance of its call site and no other call site", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    expect(store.resolve(row(1)).props.variant).toBe("outline");
    expect(store.resolve(row(2)).props.variant).toBe("outline");
    expect(store.resolve(row(1)).sources.variant).toBe("group");
    expect(store.resolve(invite()).props.variant).toBe("ghost");
    expect(store.resolve(invite()).sources.variant).toBe("app");
  });

  it("a page Override reaches every Instance of the component on that route, across call sites", () => {
    const store = createOverrideStore();
    store.set(page(), "size", "sm");
    expect(store.resolve(row(1)).props.size).toBe("sm");
    expect(store.resolve(invite()).props.size).toBe("sm");
    expect(store.resolve(invite()).sources.size).toBe("page");
  });

  it("a page Override is per component", () => {
    const store = createOverrideStore();
    store.set(page("Badge"), "variant", "muted");
    expect(store.resolve(row(1)).props.variant).toBe("ghost");
  });

  it("a page Override is per route", () => {
    const store = createOverrideStore();
    store.set(page("Button", "/settings/billing"), "size", "sm");
    expect(store.resolve(row(1)).sources).toEqual({ variant: "app" });
    expect(store.resolve({ ...row(1), route: "/settings/billing" }).props.size).toBe("sm");
  });

  it("a group Override follows its call site to any route", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    expect(store.resolve({ ...row(1), route: "/settings/billing" }).props.variant).toBe("outline");
  });

  it("the narrowest scope wins per prop: Instance over group over page", () => {
    const store = createOverrideStore();
    store.set(page(), "variant", "secondary");
    store.set(page(), "size", "sm");
    store.set(page(), "disabled", true);
    store.set(group(), "variant", "outline");
    store.set(group(), "size", "lg");
    store.set(instance(ROW_1), "variant", "destructive");

    const one = store.resolve(row(1, { variant: "ghost", size: "icon", disabled: false }));
    expect(one.props).toEqual({ variant: "destructive", size: "lg", disabled: true });
    expect(one.sources).toEqual({ variant: "instance", size: "group", disabled: "page" });
    expect(one.overrides).toEqual({ variant: "destructive", size: "lg", disabled: true });

    const two = store.resolve(row(2, { variant: "ghost", size: "icon", disabled: false }));
    expect(two.sources).toEqual({ variant: "group", size: "group", disabled: "page" });

    const other = store.resolve(invite({ variant: "ghost", size: "icon", disabled: false }));
    expect(other.props).toEqual({ variant: "secondary", size: "sm", disabled: true });
    expect(other.sources).toEqual({ variant: "page", size: "page", disabled: "page" });
  });

  it("the order Overrides were set in does not change which scope wins", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(group(), "variant", "outline");
    store.set(page(), "variant", "secondary");
    expect(store.resolve(row(1)).sources.variant).toBe("instance");
  });

  it("later mounts join silently: a scope record needs no Instance to exist when it is set", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.set(page(), "size", "sm");
    // Row 9 mounts after both were set; nothing registers it with the store.
    const late = store.resolve(row(9));
    expect(late.props).toEqual({ variant: "outline", size: "sm" });
    expect(store.applies(row(9))).toBe(true);
  });

  it("an excluded Instance keeps its Current value for that scope only", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.set(page(), "size", "sm");
    store.exclude(group(), ROW_1);

    const one = store.resolve(row(1, { variant: "ghost", size: "icon" }));
    expect(one.props).toEqual({ variant: "ghost", size: "sm" });
    expect(one.sources).toEqual({ variant: "app", size: "page" });
    expect(store.resolve(row(2)).props.variant).toBe("outline");
  });

  it("an Instance excluded from the group falls through to the page scope for the same prop", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.set(page(), "variant", "secondary");
    store.exclude(group(), ROW_1);
    expect(store.resolve(row(1)).props.variant).toBe("secondary");
    expect(store.resolve(row(1)).sources.variant).toBe("page");
  });

  it("each scope keeps its own exclusion list", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.set(page(), "size", "sm");
    store.exclude(page(), ROW_1);
    expect(store.resolve(row(1)).props).toEqual({ variant: "outline" });
    expect(store.records().find((r) => r.target.scope === "group")?.excluded).toEqual([]);
  });

  it("an Instance Override still applies to an Instance excluded from the group", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);
    store.set(instance(ROW_1), "variant", "destructive");
    expect(store.resolve(row(1)).props.variant).toBe("destructive");
  });

  it("an exclusion is keyed by Instance id, so it survives a remount", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);
    // A remount builds a new Instance object with the same id.
    expect(store.resolve({ ...row(1) }).props.variant).toBe("ghost");
  });

  it("an exclusion can be undone", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);
    store.include(group(), ROW_1);
    expect(store.resolve(row(1)).props.variant).toBe("outline");
  });

  it("an exclusion made before any value is kept for the values set after it", () => {
    const store = createOverrideStore();
    store.exclude(group(), ROW_1);
    store.set(group(), "variant", "outline");
    expect(store.resolve(row(1)).props.variant).toBe("ghost");
    expect(store.resolve(row(2)).props.variant).toBe("outline");
  });

  it("reset undoes only its own scope", () => {
    const store = createOverrideStore();
    store.set(page(), "variant", "secondary");
    store.set(group(), "variant", "outline");
    store.set(instance(ROW_1), "variant", "destructive");

    store.reset(group(), "variant");
    expect(store.resolve(row(1)).props.variant).toBe("destructive");
    expect(store.resolve(row(2)).props.variant).toBe("secondary");

    store.reset(instance(ROW_1));
    expect(store.resolve(row(1)).sources.variant).toBe("page");

    store.reset(page());
    expect(store.resolve(row(1)).sources.variant).toBe("app");
  });

  it("resetting a group's last prop keeps its exclusions; resetting the whole group drops them", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);

    store.reset(group(), "variant");
    expect(store.records()).toEqual([{ target: group(), values: {}, excluded: [ROW_1], suspended: null }]);
    store.set(group(), "variant", "outline");
    expect(store.resolve(row(1)).props.variant).toBe("ghost");

    store.reset(group());
    expect(store.records()).toEqual([]);
    store.set(group(), "variant", "outline");
    expect(store.resolve(row(1)).props.variant).toBe("outline");
  });

  it("a record with neither values nor exclusions is dropped", () => {
    const store = createOverrideStore();
    store.exclude(group(), ROW_1);
    store.include(group(), ROW_1);
    expect(store.records()).toEqual([]);
  });

  it("lists one record per scope target, exclusions included", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "size", "lg");
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_2);
    store.set(page(), "disabled", true);
    expect(store.records()).toEqual([
      { target: instance(ROW_1), values: { size: "lg" }, excluded: [], suspended: null },
      { target: group(), values: { variant: "outline" }, excluded: [ROW_2], suspended: null },
      { target: page(), values: { disabled: true }, excluded: [], suspended: null },
    ]);
  });

  it("applies() is false for an Instance excluded from every record that would reach it", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);
    expect(store.applies(row(1))).toBe(false);
    expect(store.applies(row(2))).toBe(true);
  });
});

describe("Override store: change notifications", () => {
  it("tells listeners which scope target changed, and only when something did", () => {
    const store = createOverrideStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(instance(ROW_1), "variant", "destructive");
    store.set(instance(ROW_1), "variant", "destructive");
    store.reset(instance(ROW_2));
    store.reset(instance(ROW_1), "size");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(instance(ROW_1));

    store.set(group(), "variant", "outline");
    expect(listener).toHaveBeenLastCalledWith(group());
    store.set(page(), "size", "sm");
    expect(listener).toHaveBeenLastCalledWith(page());
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    store.set(instance(ROW_2), "size", "sm");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("an exclusion notifies only the Instance it changes, and only when it changes", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    const listener = vi.fn();
    store.subscribe(listener);

    store.exclude(group(), ROW_1);
    store.exclude(group(), ROW_1);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith(instance(ROW_1));

    store.include(group(), ROW_1);
    store.include(group(), ROW_1);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("resetting a whole group notifies the group, which covers the Instances it had excluded", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.exclude(group(), ROW_1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset(group());
    expect(listener).toHaveBeenCalledWith(group());
  });

  it("notifies when an Override changes from a value to undefined", () => {
    const store = createOverrideStore();
    const listener = vi.fn();
    store.set(instance(ROW_1), "variant", "destructive");
    store.subscribe(listener);
    store.set(instance(ROW_1), "variant", undefined);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("inScope() says which Instances a record's scope holds", () => {
    expect(inScope(instance(ROW_1), row(1))).toBe(true);
    expect(inScope(instance(ROW_1), row(2))).toBe(false);
    expect(inScope(group(), row(2))).toBe(true);
    expect(inScope(group(), invite())).toBe(false);
    expect(inScope(page(), invite())).toBe(true);
    expect(inScope(page("Badge"), invite())).toBe(false);
    expect(inScope(page("Button", "/other"), invite())).toBe(false);
  });
});

describe("Override store: kept across unmount, suspended for review (PER-125)", () => {
  // The member trigger renders 1st of 3 Buttons in MemberRowMenu.
  const at = (n: number, total: number | null, current: Record<string, unknown> = { variant: "ghost" }) => ({
    ...row(n, current),
    total,
  });
  const seen = (n: number, total: number | null) => ({ id: row(n).id, anchor: TRIGGER, total });

  it("keeps an Instance record with no Instance mounted, and applies it again on remount", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    // Nothing tells the store an Instance unmounted: the record is keyed by id, so it stays.
    expect(store.records()).toHaveLength(1);
    expect(store.resolve(at(1, 3)).props.variant).toBe("destructive");
  });

  it("an Instance whose call site's total changed shows its Current value, and the record stays", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    // A same-component call was added before it: the Instance renders with 4.
    const resolved = store.resolve(at(1, 4));
    expect(resolved.props.variant).toBe("ghost");
    expect(resolved.sources.variant).toBe("app");
    expect(store.applies(at(1, 4))).toBe(false);
    expect(store.records()).toEqual([
      { target: instance(ROW_1), values: { variant: "destructive" }, excluded: [], suspended: null },
    ]);
  });

  it("observing the new total suspends every record pinned to that call site, at every scope, and notifies", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.observe(seen(2, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(group(), "size", "sm");
    store.set(page(), "disabled", true);
    store.exclude(page(), ROW_2);
    const listener = vi.fn();
    store.subscribe(listener);

    store.observe(seen(2, 4));

    const suspended = { reason: "code-changed", anchor: TRIGGER, was: 3, now: 4 };
    expect(store.records().map((r) => r.suspended)).toEqual([suspended, suspended, suspended]);
    expect(listener).toHaveBeenCalledWith(instance(ROW_1));
    expect(listener).toHaveBeenCalledWith(group());
    expect(listener).toHaveBeenCalledWith(page());
    // The page record is suspended because an exclusion names that call site.
    expect(store.resolve(invite()).props).toEqual({ variant: "ghost" });
  });

  it("stays suspended when the total comes back: it is never rebound automatically", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    store.observe(seen(1, 4));
    store.observe(seen(1, 3));
    expect(store.resolve(at(1, 3)).props.variant).toBe("ghost");
    expect(store.records()[0]?.suspended).toMatchObject({ reason: "code-changed" });
  });

  it("observing an unchanged total, or one at another call site, suspends nothing and notifies no one", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(group(), "variant", "outline");
    const listener = vi.fn();
    store.subscribe(listener);
    store.observe(seen(1, 3));
    store.observe({ id: invite().id, anchor: OTHER_SITE, total: 1 });
    store.observe({ id: invite().id, anchor: OTHER_SITE, total: 2 });
    expect(listener).not.toHaveBeenCalled();
    expect(store.records()[0]?.suspended).toBeNull();
  });

  it("a page record with no exclusions pins no call site, so a changed total leaves it applying", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(page(), "disabled", true);
    store.observe(seen(1, 4));
    expect(store.records()[0]?.suspended).toBeNull();
    expect(store.resolve(at(1, 4)).props.disabled).toBe(true);
  });

  it("including the excluded Instance unpins its call site from a page record", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(page(), "disabled", true);
    store.exclude(page(), ROW_1);
    store.include(page(), ROW_1);
    store.observe(seen(1, 4));
    expect(store.records()[0]?.suspended).toBeNull();
  });

  it("a suspended record falls through to the next scope", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(page(), "variant", "secondary");
    store.observe(seen(1, 4));
    expect(store.resolve(at(1, 4)).sources.variant).toBe("page");
  });

  it("Reapply pins the call site's new total and applies the record again", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    store.observe(seen(1, 4));
    const listener = vi.fn();
    store.subscribe(listener);
    store.reapply(instance(ROW_1));
    expect(listener).toHaveBeenCalledWith(instance(ROW_1));
    expect(store.records()[0]?.suspended).toBeNull();
    expect(store.resolve(at(1, 4)).props.variant).toBe("destructive");
    // Pinned at 4 now, so a later change suspends it again.
    store.observe(seen(1, 5));
    expect(store.records()[0]?.suspended).toMatchObject({ was: 4, now: 5 });
  });

  it("Discard is a whole-record reset, and works on a suspended record", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(group(), "variant", "outline");
    store.observe(seen(1, 4));
    store.reset(group());
    expect(store.records()).toEqual([]);
  });

  it("refuses a new Override or exclusion on a suspended record: review it first", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(group(), "variant", "outline");
    store.observe(seen(1, 4));
    expect(() => store.set(group(), "size", "sm")).toThrow(/suspended/);
    expect(() => store.exclude(group(), ROW_1)).toThrow(/suspended/);
  });

  it("an id that matches more than one mounted Instance suspends the records naming it, with no Reapply", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "destructive");
    store.set(group(OTHER_SITE), "variant", "outline");
    store.exclude(group(OTHER_SITE), invite().id);
    store.set(page(), "size", "sm");
    const listener = vi.fn();
    store.subscribe(listener);

    store.suspendAmbiguous((id) => id === ROW_1 || id === invite().id);

    expect(store.records().map((r) => r.suspended)).toEqual([
      { reason: "ambiguous", ids: [ROW_1] },
      { reason: "ambiguous", ids: [invite().id] },
      null,
    ]);
    expect(listener).toHaveBeenCalledWith(instance(ROW_1));
    expect(listener).toHaveBeenCalledWith(group(OTHER_SITE));
    expect(store.resolve(at(1, null)).props.variant).toBe("ghost");
    expect(() => store.reapply(instance(ROW_1))).toThrow(/more than one Instance/);
  });

  it("an ambiguous id takes over a code-changed suspension, so Reapply can't put it back on a guess", () => {
    const store = createOverrideStore();
    store.observe(seen(1, 3));
    store.set(instance(ROW_1), "variant", "destructive");
    store.observe(seen(1, 4));
    store.suspendAmbiguous((id) => id === ROW_1);
    expect(store.records()[0]?.suspended).toEqual({ reason: "ambiguous", ids: [ROW_1] });
    expect(() => store.reapply(instance(ROW_1))).toThrow(/more than one Instance/);
  });

  it("a record set before its call site was seen is pinned the first time it is", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "outline");
    store.observe(seen(1, 3));
    store.observe(seen(1, 4));
    expect(store.records()[0]?.suspended).toMatchObject({ reason: "code-changed", was: 3, now: 4 });
  });

  it("an Instance with no total (unanchored) is never suspended by the hop guard", () => {
    const store = createOverrideStore();
    store.observe(seen(1, null));
    store.set(instance(ROW_1), "variant", "destructive");
    store.observe(seen(1, null));
    expect(store.resolve(at(1, null)).props.variant).toBe("destructive");
  });
});

describe("Override resolution: Overrides off", () => {
  const OFF = { overrides: false as const, reason: "React reported no fiber." };

  it("starts on, and resolves to the Current value alone once off, every value from the app", () => {
    const store = createOverrideStore();
    expect(store.status).toEqual({ overrides: true });
    store.set(instance(ROW_1), "variant", "destructive");
    expect(store.disable(OFF.reason)).toBe(true);
    expect(store.status).toEqual(OFF);
    expect(store.resolve(row(1, { variant: "ghost", size: "sm" }))).toEqual({
      props: { variant: "ghost", size: "sm" },
      sources: { variant: "app", size: "app" },
      overrides: {},
    });
    expect(store.applies(row(1))).toBe(false);
    // The records stay: only what applies changes.
    expect(store.records()).toHaveLength(1);
  });

  it("can start off, and stays off: a second disable changes nothing", () => {
    const store = createOverrideStore({ status: OFF });
    expect(store.status).toEqual(OFF);
    expect(store.disable("another reason")).toBe(false);
    expect(store.status).toEqual(OFF);
  });

  it("refuses every write while off, with the same message", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "destructive");
    store.disable(OFF.reason);
    const message = `[loupe] Overrides are off, everything is inspect-only: ${OFF.reason}`;
    expect(() => store.set(instance(ROW_1), "variant", "outline")).toThrow(message);
    expect(() => store.reset(group(), "variant")).toThrow(message);
    expect(() => store.reset(group())).toThrow(message);
    expect(() => store.exclude(group(), ROW_1)).toThrow(message);
    expect(() => store.include(group(), ROW_1)).toThrow(message);
    expect(() => store.reapply(group())).toThrow(message);
  });
});

describe("Override resolution: the before view", () => {
  const dialog = (current: Record<string, unknown> = { open: false, tone: "plain" }) => ({
    ...row(1, current),
    stateProps: ["open"],
  });

  it("renders the proposed view by default: what resolve gives", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "open", true);
    store.set(instance(ROW_1), "tone", "danger");
    expect(store.view).toBe("proposed");
    expect(store.render(dialog())).toEqual(store.resolve(dialog()));
  });

  it("keeps only the State-prop Overrides in the before view, and resolve ignores the view", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "open", true);
    store.set(group(), "tone", "danger");
    expect(store.setView("before")).toBe(true);
    expect(store.setView("before")).toBe(false);
    expect(store.render(dialog())).toEqual({
      props: { open: true, tone: "plain" },
      sources: { open: "instance", tone: "app" },
      overrides: { open: true },
    });
    expect(store.resolve(dialog()).overrides).toEqual({ open: true, tone: "danger" });
    store.setView("proposed");
    expect(store.render(dialog()).props).toEqual({ open: true, tone: "danger" });
  });

  it("renders the Current value alone with Overrides off, in either view", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "open", true);
    store.disable("off");
    store.setView("before");
    expect(store.render(dialog()).props).toEqual({ open: false, tone: "plain" });
  });
});

describe("Override resolution: Reach", () => {
  const suspended = { reason: "ambiguous" as const, ids: [ROW_2] };
  const record = (target: ScopeTarget, excluded: string[] = [], isSuspended = false) => ({
    target,
    excluded,
    suspended: isSuspended ? suspended : null,
  });

  it.each([
    ["an Instance record, its own Instance", record(instance(ROW_1)), row(1), "applies"],
    ["an Instance record, another Instance", record(instance(ROW_1)), row(2), null],
    ["a group record, an Instance of its call site", record(group()), row(2), "applies"],
    ["a group record, another call site", record(group()), invite(), null],
    ["a page record, the component on its route", record(page()), invite(), "applies"],
    ["a page record, another component", record(page("Badge")), invite(), null],
    ["a page record, another route", record(page("Button", "/other")), invite(), null],
    ["a group record that leaves the Instance out", record(group(), [ROW_1]), row(1), "left-out"],
    ["a group record that leaves another one out", record(group(), [ROW_2]), row(1), "applies"],
    ["a suspended group record", record(group(), [], true), row(1), "suspended"],
    ["a suspended group record that leaves the Instance out", record(group(), [ROW_1], true), row(1), "left-out"],
    ["a suspended record outside the scope", record(group(), [], true), invite(), null],
  ] as const)("%s: %s", (_name, given, identity, expected) => {
    expect(reachOf(given, identity)).toBe(expected);
  });

  it("recordsFor lists the records whose scope holds the Instance, in the order given, with its Reach", () => {
    const store = createOverrideStore();
    store.set(instance(ROW_1), "variant", "outline");
    store.set(instance(ROW_2), "variant", "outline");
    store.set(group(), "size", "sm");
    store.exclude(group(), ROW_1);
    store.set(page(), "variant", "secondary");
    store.set(group(OTHER_SITE), "size", "lg");
    expect(recordsFor(store.records(), row(1)).map(({ record, reach }) => [record.target.scope, reach])).toEqual([
      ["instance", "applies"],
      ["group", "left-out"],
      ["page", "applies"],
    ]);
  });

  it("recordsFor lists them narrowest first, whatever order it is given", () => {
    const records = [record(page()), record(group()), record(instance(ROW_1))];
    expect(recordsFor(records, row(1)).map(({ record: { target } }) => target.scope)).toEqual(["instance", "group", "page"]);
  });

  it("a record names the Instances it doesn't leave out, suspended or not", () => {
    expect(namesInstance(record(group()), row(1))).toBe(true);
    expect(namesInstance(record(group(), [], true), row(1))).toBe(true);
    expect(namesInstance(record(group(), [ROW_1], true), row(1))).toBe(false);
    expect(namesInstance(record(group()), invite())).toBe(false);
  });

  it("agrees with resolve: a record only changes an Instance it applies to", () => {
    const store = createOverrideStore();
    store.set(group(), "variant", "destructive");
    store.exclude(group(), ROW_1);
    for (const n of [1, 2]) {
      const [entry] = recordsFor(store.records(), row(n));
      expect(entry?.reach === "applies").toBe(store.resolve(row(n)).sources.variant === "group");
    }
  });
});

describe("Override resolution: the record an Override goes into", () => {
  const identity = { id: ROW_1, anchor: TRIGGER, component: "Button", route: ROUTE };

  it("names the Instance, its call site, or its component on its route", () => {
    expect(targetAt(identity, "instance")).toEqual(instance(ROW_1));
    expect(targetAt(identity, "group")).toEqual(group());
    expect(targetAt(identity, "page")).toEqual(page());
  });

  it("has no group for an Instance with no call site", () => {
    expect(targetAt({ ...identity, anchor: unanchoredId("Button") }, "group")).toBeNull();
  });

  it("refuses an unknown scope", () => {
    expect(() => targetAt(identity, "everywhere" as Scope)).toThrow(
      '[loupe] Unknown scope "everywhere": use "instance", "group" or "page".',
    );
  });

  it("is the record the Override lands in: reachOf says it applies to that Instance", () => {
    const store = createOverrideStore();
    for (const scope of ["instance", "group", "page"] as const) {
      const target = targetAt(identity, scope);
      if (target) store.set(target, "variant", scope);
    }
    expect(recordsFor(store.records(), { ...identity }).map(({ reach }) => reach)).toEqual(["applies", "applies", "applies"]);
  });
});
