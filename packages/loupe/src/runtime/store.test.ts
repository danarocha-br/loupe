import { describe, expect, it, vi } from "vitest";
import { covers, createOverrideStore, type InstanceKey, type ScopeTarget } from "./store.js";

const TRIGGER = "app/menu.tsx › MemberRowMenu › Button[1]";
const OTHER_SITE = "app/invites.tsx › InvitationRowMenu › Button[1]";
const ROUTE = "/settings/members";

const row = (n: number, current: Record<string, unknown> = { variant: "ghost" }): InstanceKey => ({
  id: `${TRIGGER}#m${n}`,
  anchor: TRIGGER,
  component: "Button",
  route: ROUTE,
  current,
});
const invite = (current: Record<string, unknown> = { variant: "ghost" }): InstanceKey => ({
  id: `${OTHER_SITE}#i1`,
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
    expect(store.records()).toEqual([{ target: instance(ROW_2), values: { size: "sm" }, excluded: [] }]);
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
    expect(store.records()).toEqual([{ target: group(), values: {}, excluded: [ROW_1] }]);
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
      { target: instance(ROW_1), values: { size: "lg" }, excluded: [] },
      { target: group(), values: { variant: "outline" }, excluded: [ROW_2] },
      { target: page(), values: { disabled: true }, excluded: [] },
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
    expect(listener).toHaveBeenLastCalledWith([instance(ROW_1)]);

    store.set(group(), "variant", "outline");
    expect(listener).toHaveBeenLastCalledWith([group()]);
    store.set(page(), "size", "sm");
    expect(listener).toHaveBeenLastCalledWith([page()]);
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
    expect(listener).toHaveBeenLastCalledWith([instance(ROW_1)]);

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
    expect(listener).toHaveBeenCalledWith([group()]);
  });

  it("notifies when an Override changes from a value to undefined", () => {
    const store = createOverrideStore();
    const listener = vi.fn();
    store.set(instance(ROW_1), "variant", "destructive");
    store.subscribe(listener);
    store.set(instance(ROW_1), "variant", undefined);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("covers() says which Instances a change reaches", () => {
    expect(covers(instance(ROW_1), row(1))).toBe(true);
    expect(covers(instance(ROW_1), row(2))).toBe(false);
    expect(covers(group(), row(2))).toBe(true);
    expect(covers(group(), invite())).toBe(false);
    expect(covers(page(), invite())).toBe(true);
    expect(covers(page("Badge"), invite())).toBe(false);
    expect(covers(page("Button", "/other"), invite())).toBe(false);
  });
});
