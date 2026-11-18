// @vitest-environment jsdom
// What the panel shows, asked of `panelView()` over the real `__loupe` (PER-214): a
// members page renders in jsdom, and each test reads what the panel would show.
// No Toolbar, no shadow DOM, no timers. How the panel's buttons reach `__loupe` is
// `toolbar.test.tsx`'s.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instanceId } from "../../call-site.js";
import type { LayerStatus } from "../../layer-status.js";
import { debugOf, type LoupeDebug } from "../../runtime/debug.js";
import { disableOverrides } from "../../runtime/registry.js";
import { resetLoupe } from "../../runtime/slot.js";
import type { Scope } from "../../runtime/store.js";
import { ANA, BIA, Button, CONFIRM, DIALOG, GROUP, MENU, members, Page, site } from "../members.fixture.js";
import { type GoneBody, type InspectorBody, type ListBody, panelView, type PanelView, type PropItem, type SeenComponents } from "./index.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let loupe: LoupeDebug;
let seen: SeenComponents;

beforeEach(() => {
  resetLoupe();
  history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  loupe = debugOf();
  seen = { route: "", components: new Set() };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (page: Parameters<typeof Page>[0] = {}) => act(() => root.render(<Page {...page} />));
const click = (text: string) =>
  act(() => ([...container.querySelectorAll("button")].find((button) => button.textContent === text) as HTMLButtonElement).click());
const row = (name: string) => instanceId(members("Button", 1), name);
const menuItem = () => loupe.list("MenuItem")[0]?.id as string;

/** What the panel shows now, carrying "Appears on interaction" over from the last call. */
function view(selected: string | null = null, scope: Scope = "instance", layer: LayerStatus | null = null): PanelView {
  const next = panelView({ debug: loupe, layer, selected, scope, seen });
  seen = next.seen;
  return next;
}

function listOf(shown: PanelView): ListBody {
  if (shown.body.kind !== "list") throw new Error(`Expected the list, got ${shown.body.kind}`);
  return shown.body;
}
function inspector(shown: PanelView): InspectorBody {
  if (shown.body.kind !== "inspector") throw new Error(`Expected the Inspector, got ${shown.body.kind}`);
  return shown.body;
}
function gone(shown: PanelView): GoneBody {
  if (shown.body.kind !== "gone") throw new Error(`Expected "Not on the page now", got ${shown.body.kind}`);
  return shown.body;
}

const group = (body: ListBody, component: string) => body.groups.find((candidate) => candidate.component === component);
const prop = (body: InspectorBody, name: string) =>
  [...body.editable, ...body.inspectOnly].find((item) => item.name === name) as PropItem;
const pills = (item: PropItem) =>
  item.control?.kind === "options" ? item.control.options.map((option) => [option.label, option.pressed, option.count]) : null;
const pressed = (item: PropItem) => (pills(item) ?? []).filter(([, on]) => on).map(([label]) => label);

describe("the list", () => {
  it("groups every Instance by component, with its count and verdict", () => {
    render();
    const body = listOf(view());
    expect(body.page).toEqual({ name: "Home", route: "/" });
    expect(body.groups.map((candidate) => [candidate.component, candidate.count, candidate.verdict.status?.text])).toEqual([
      ["Button", "×5", "Supported"],
      ["Dialog", "×1", "Supported"],
    ]);
    expect(body.summary).toBe("2 components · 6 Instances");
    expect(group(body, "Button")?.outlineIds).toEqual([row("ana"), row("bia"), row("caio"), row("dani"), MENU]);
  });

  it("lists a menu's component while it is open, then under Appears on interaction", () => {
    render();
    view();
    click("Menu");
    const item = group(listOf(view()), "MenuItem");
    expect(item?.count).toBe("×1");
    // An Adapter with no prop that can be Editable.
    expect(item?.verdict).toMatchObject({ supported: false, reason: "no-editable", status: { text: "Inspect only" } });
    expect(item?.notes).toEqual([{ kind: "reason", text: "No Editable prop" }]);
    expect(item?.statusTitle).toBe("No Editable prop");

    click("Menu");
    const body = listOf(view());
    expect(group(body, "MenuItem")).toBeUndefined();
    expect(body.interaction).toEqual(["MenuItem"]);
  });

  it("lists a closed dialog's Button as No Instance mounted while it holds an Override, with its Current value last seen", () => {
    render();
    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    click("Fechar");
    const buttons = group(listOf(view()), "Button");
    expect(buttons?.instances.find((item) => item.id === CONFIRM)).toEqual({
      id: CONFIRM,
      label: "members.tsx:40",
      mounted: false,
      tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
      values: ['variant "default" · Current "ghost" (last seen)'],
    });
    expect(buttons?.notes).toEqual([
      { kind: "overrides", text: "1 override" },
      { kind: "not-mounted", text: "1 not mounted" },
    ]);

    // Mounted again: one ordinary row, no held one beside it.
    click("Abrir");
    expect(group(listOf(view()), "Button")?.instances.filter((item) => item.id === CONFIRM)).toEqual([
      { id: CONFIRM, label: "members.tsx:40", mounted: true, tags: [], values: [] },
    ]);
  });

  it("does not list a closed Instance that holds nothing", () => {
    render();
    click("Abrir");
    click("Fechar");
    expect(group(listOf(view()), "Button")?.instances.some((item) => item.id === CONFIRM)).toBe(false);
    // Nothing is kept for it either.
    expect(loupe.lastSeen(CONFIRM)).toBeNull();
  });

  it("lists a held Instance on the route it mounted on, even when it unmounts after a navigation", () => {
    render();
    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    // The URL moves before the old page's Instances unmount.
    act(() => history.pushState(null, "", "/outro"));
    click("Fechar");
    expect(loupe.lastSeen(CONFIRM)?.route).toBe("/");
    expect(group(listOf(view()), "Button")?.instances.some((item) => item.id === CONFIRM)).toBe(false);

    act(() => history.pushState(null, "", "/"));
    expect(group(listOf(view()), "Button")?.instances.find((item) => item.id === CONFIRM)?.tags).toEqual([
      { kind: "not-mounted", text: "No Instance mounted" },
    ]);
  });

  it("holds a record for review when its call site's total changes, and says why", () => {
    render();
    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    click("Fechar");
    // A same-component call was added above it: the call site now has four uses.
    render({ confirmTotal: 4 });
    click("Abrir");
    const open = listOf(view());
    expect(open.suspendedMeta).toBe("1 · apply to nothing");
    expect(open.suspended).toEqual([
      {
        target: { scope: "instance", id: CONFIRM },
        label: "Members › Button[3]",
        why: "Code changed here: this call site had 3 uses, now 4.",
        values: ['variant "default"'],
      },
    ]);
    expect(group(open, "Button")?.instances.find((item) => item.id === CONFIRM)?.tags).toEqual([{ kind: "suspended", text: "Held for review" }]);

    // Closed again: its row says it is held, and its values show once, on the card.
    click("Fechar");
    const closed = listOf(view());
    expect(group(closed, "Button")?.instances.find((item) => item.id === CONFIRM)).toMatchObject({
      tags: [{ kind: "suspended", text: "Held for review" }],
      values: [],
    });
    expect(closed.suspended[0]?.values).toEqual(['variant "default" · Current "ghost" (last seen)']);
  });

  it("holds a record for review when its id matches more than one Instance", () => {
    render();
    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    click("Fechar");
    render({ twice: true });
    click("Abrir");
    const [held] = listOf(view()).suspended;
    expect(held?.why).toBe(`Matches more than one Instance (${CONFIRM}): discard it and set it again on the one you mean.`);
    // Its id is mounted, on two elements: there is no last-seen Current value to show.
    expect(held?.values).toEqual(['variant "default"']);
  });

  it("counts the page's Overrides, held ones included, and names every record Reset all discards", () => {
    render();
    click("Menu");
    const item = menuItem();
    act(() => {
      loupe.set(item, "children", "Sair");
      loupe.set(ANA, "variant", "default");
    });
    click("Menu");
    const shown = view();
    expect(shown.header).toEqual({ exportEnabled: true });
    expect(shown.footer).toMatchObject({ countText: "2 Overrides on this page", hasOverrides: true, copyEnabled: true });
    expect(shown.footer.resetAll).toEqual(
      expect.arrayContaining([
        { scope: "instance", id: item },
        { scope: "instance", id: ANA },
      ]),
    );
    expect(shown.footer.resetAll).toHaveLength(2);
    expect(shown.instanceCount).toBe(6);
  });
});

describe("the Inspector", () => {
  it("shows an Instance's identity, call site and Coverage, with the library's props on one line", () => {
    render();
    const shown = view(BIA);
    expect(shown.outline).toEqual({ label: "Button", members: null });
    const body = inspector(shown);
    expect(body.id).toBe(BIA);
    expect(body.verdict).toEqual({ supported: true, status: { kind: "supported", text: "Supported" } });
    expect(body.coverage).toMatchObject({
      editable: 2,
      inspectOnly: 2,
      text: "2 editable props · 2 inspect only",
      callSite: { text: "members.tsx:11 · use 1 of 2" },
      notGenerated: null,
    });
    expect(prop(body, "onClick").reason).toBe("FUNCTION");
    expect(prop(body, "render").reason).toBe("STRUCTURAL");
    // Injected by "the library": one collapsed line, not a row.
    expect(prop(body, "aria-expanded")).toBeUndefined();
    expect(body.injected).toEqual({ summary: "1 set by the library", rows: [{ name: "aria-expanded", value: "false" }] });
    expect(prop(body, "children")).toMatchObject({ label: "Text", codeName: "children", control: { kind: "text", value: "bia" } });
    expect(prop(body, "variant").codeName).toBeNull();
    expect(body.note).toBeNull();
  });

  it("goes inspect-only as a whole while the React self-check fails, and says so once, in the banner", () => {
    render();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    const shown = view(BIA);
    expect(shown.banner).toEqual({
      title: "Overrides are off",
      body: "Everything is inspect-only: this React build isn't supported (React reported no fiber while an Adapter rendered.).",
    });
    expect(shown.footer.resetAll).toEqual([]);
    const body = inspector(shown);
    expect(body.coverage.text).toBe("0 editable props · 4 inspect only");
    expect(body.verdict).toMatchObject({ supported: false, reason: "overrides-off" });
    // The banner says it (PER-184).
    expect(body.note).toBeNull();
    expect(body.editing).toBeNull();
    expect(body.inspectOnlyMeta).toBe("Overrides off");
    expect(listOf(view()).groups.map((candidate) => candidate.notes.find((note) => note.kind === "reason")?.text)).toEqual([
      "Overrides are off",
      "Overrides are off",
    ]);
  });

  it("reads Not on the page now once the selected Instance has gone, with what it still holds", () => {
    render();
    click("Menu");
    const item = menuItem();
    expect(view(item).body.kind).toBe("inspector");
    click("Menu");
    expect(gone(view(item))).toEqual({ kind: "gone", id: item, held: null, canReset: false });

    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    click("Fechar");
    expect(gone(view(CONFIRM))).toEqual({
      kind: "gone",
      id: CONFIRM,
      held: { tag: { kind: "not-mounted", text: "No Instance mounted" }, values: ['variant "default" · Current "ghost" (last seen)'] },
      canReset: true,
    });
    act(() => {
      loupe.discard({ scope: "instance", id: CONFIRM });
    });
    expect(gone(view(CONFIRM)).canReset).toBe(false);
    expect(loupe.lastSeen(CONFIRM)).toBeNull();
  });

  it("never throws because an Instance has gone, and lets any other error through", () => {
    render();
    click("Abrir");
    const inspect = loupe.inspect.bind(loupe);
    // The confirm Button's Dialog goes between the list and its inspection: its crumb shows the id.
    const spy = vi.spyOn(loupe, "inspect").mockImplementation((id) => {
      if (id === DIALOG) throw new Error(`[loupe] No Instance ${id} on this page.`);
      return inspect(id);
    });
    expect(inspector(view(CONFIRM)).crumbs).toEqual([{ id: DIALOG, label: DIALOG }]);

    spy.mockImplementation(() => {
      throw new TypeError("a bug");
    });
    expect(() => view(CONFIRM)).toThrow("a bug");
  });

  it("overrides an option on one Instance, and shows the app's value under its Override", () => {
    render();
    let variant = prop(inspector(view(BIA)), "variant");
    expect(variant).toMatchObject({ dot: "off", overridden: false, value: { kind: "set", text: '"ghost"' }, current: null, reset: null });
    expect(variant.source).toBe("from the app");
    expect(pressed(variant)).toEqual(['"ghost"']);

    act(() => {
      loupe.set(BIA, "variant", "default");
    });
    variant = prop(inspector(view(BIA)), "variant");
    expect(variant).toMatchObject({
      dot: "on",
      overridden: true,
      value: null,
      current: { kind: "set", text: '"ghost"' },
      source: "from This instance",
      reset: { label: "Reset", write: { id: BIA, prop: "variant", scope: "instance" } },
      control: { kind: "options", key: BIA, write: { id: BIA, prop: "variant", scope: "instance" } },
    });
    expect(pressed(variant)).toEqual(['"default"']);
    expect(inspector(view(BIA)).editing).toEqual(expect.objectContaining({ resetInstanceEnabled: true }));
  });

  it("marks label text held empty, until it is reset", () => {
    render();
    act(() => {
      loupe.set(BIA, "children", "");
    });
    expect(prop(inspector(view(BIA)), "children")).toMatchObject({ empty: true, current: { text: '"bia"' } });
    act(() => {
      loupe.reset(BIA, "children");
    });
    expect(prop(inspector(view(BIA)), "children")).toMatchObject({ empty: false, current: null });
  });

  it("tags a State prop, and says when the app tries to change a value an Override holds", () => {
    render();
    expect(prop(inspector(view(DIALOG)), "open").state).toBe(true);
    // Its default's two sources disagree: no pill is guessed.
    expect(pressed(prop(inspector(view(DIALOG)), "modal"))).toEqual([]);

    act(() => {
      loupe.set(DIALOG, "open", true);
    });
    expect(prop(inspector(view(DIALOG)), "open")).toMatchObject({ current: { text: "false" }, held: null });

    // The app's own state moves: Current follows it.
    click("Abrir");
    expect(prop(inspector(view(DIALOG)), "open").current?.text).toBe("true");

    // The app tries to close it: the Override holds, and the row says so.
    click("Fechar");
    expect(prop(inspector(view(DIALOG)), "open")).toMatchObject({
      current: { text: "false" },
      held: { before: "Your Override holds this at", value: "true", middle: "; the app tried to set", tried: "false", after: "." },
      // Its Reset sits in the notice.
      reset: { label: "Reset", inNotice: true },
    });
  });

  it("says where a group Override comes from, with no Reset at This instance", () => {
    render();
    act(() => {
      loupe.set(BIA, "variant", "default", "group");
    });
    const variant = prop(inspector(view(BIA)), "variant");
    expect(variant).toMatchObject({ dot: "off", source: `from ${GROUP}`, current: { text: '"ghost"' }, reset: null });
    expect(pressed(variant)).toEqual(['"default"']);
  });

  it.each([
    ["from-code", "FROM CODE", "Written as an expression here, so it changes in code."],
    ["mixed", "MIXED", "Text and code together: no single string to change."],
  ])("shows text a call site writes as %s inspect-only, tagged %s, with no field", (children, reason, explanation) => {
    act(() => root.render(<Button {...(site(1, [], children) as object)}>{"Remover"}</Button>));
    const body = inspector(view(loupe.list()[0]?.id as string));
    expect(body.inspectOnly.find((item) => item.name === "children")).toMatchObject({ label: "Text", reason, explanation, control: null });
    expect(body.editable.some((item) => item.name === "children")).toBe(false);
  });
});

describe("group and page scopes", () => {
  it("opens at This instance and offers each scope with its size", () => {
    render();
    const shown = view(BIA);
    expect(shown.scope).toBe("instance");
    expect(inspector(shown).editing?.scopes?.map((option) => [option.scope, option.label, option.enabled, option.pressed])).toEqual([
      ["instance", "This instance", true, true],
      ["group", `${GROUP} · 4`, true, false],
      ["page", "All on page · 5", true, false],
    ]);
  });

  it("reaches every Instance of a call site at group scope, and keeps counting the app's values", () => {
    render();
    let shown = view(BIA, "group");
    expect(shown.scope).toBe("group");
    expect(shown.outline.members).toEqual(["ana", "bia", "caio", "dani"].map((name) => ({ id: row(name), out: false })));
    let variant = prop(inspector(shown), "variant");
    expect(variant).toMatchObject({ counts: "SAME ON ALL 4", source: "from the app", reset: null, control: { key: "group" } });
    expect(pressed(variant)).toEqual(['"ghost"']);

    act(() => {
      loupe.set(BIA, "variant", "default", "group");
    });
    shown = view(BIA, "group");
    variant = prop(inspector(shown), "variant");
    expect(variant).toMatchObject({ source: `from ${GROUP}`, reset: { label: "Reset", write: { id: BIA, prop: "variant", scope: "group" } } });
    // The pills keep counting the app's own values after the Override is set.
    expect(pills(variant)).toEqual([
      ['"default"', true, null],
      ['"ghost"', false, 4],
    ]);
    expect(inspector(shown).members?.reset).toEqual({ target: { scope: "group", anchor: members("Button", 1) }, enabled: true });
    expect(inspector(view(ANA)).chips).toEqual([GROUP]);
  });

  it("leaves one Instance out at its own value, and notes the ones a narrower scope keeps", () => {
    render();
    act(() => {
      loupe.set(BIA, "variant", "default", "group");
      loupe.exclude(BIA, "group");
    });
    let shown = view(BIA, "group");
    expect(shown.outline.members?.filter((member) => member.out)).toEqual([{ id: BIA, out: true }]);
    const scoped = inspector(shown).members;
    expect(scoped?.countText).toBe("3 of 4 previewed");
    expect(scoped?.sites).toBeNull();
    expect(scoped?.members.find((member) => member.id === BIA)).toEqual({
      id: BIA,
      label: "This instance",
      out: true,
      tag: { kind: "left-out", text: "Left out" },
      toggle: "include",
    });
    expect(scoped?.members.find((member) => member.id === ANA)).toEqual({ id: ANA, label: "#ana", out: false, tag: null, toggle: "exclude" });
    expect(pills(prop(inspector(shown), "variant"))).toEqual([
      ['"default"', true, null],
      ['"ghost"', false, 3],
    ]);

    // Ana gets her own value on top of the group's.
    act(() => {
      loupe.set(ANA, "variant", "ghost");
    });
    expect(prop(inspector(view(ANA)), "variant")).toMatchObject({ source: "from This instance", reset: { label: "Reset to group value" } });
    shown = view(BIA, "group");
    expect(prop(inspector(shown), "variant").keeping).toEqual({ text: "1 of 3 keeps its own value", ids: [ANA], select: ANA });
  });

  it("keeps an Instance Override when its group is reset, and drops a member that has gone", () => {
    render();
    act(() => {
      loupe.set(BIA, "variant", "default", "group");
      loupe.set(ANA, "variant", "ghost");
    });
    const inspect = loupe.inspect.bind(loupe);
    // Caio goes between the list and his inspection: he isn't counted or outlined.
    vi.spyOn(loupe, "inspect").mockImplementation((id) => {
      if (id === row("caio")) throw new Error(`[loupe] No Instance ${id} on this page.`);
      return inspect(id);
    });
    const shown = view(BIA, "group");
    expect(shown.outline.members?.map((entry) => entry.id)).toEqual([row("ana"), row("bia"), row("dani")]);
    expect(pills(prop(inspector(shown), "variant"))).toEqual([
      ['"default"', true, null],
      ['"ghost"', false, 3],
    ]);
    vi.restoreAllMocks();

    act(() => {
      loupe.discard({ scope: "group", anchor: members("Button", 1) });
    });
    expect(loupe.records().map((record) => record.target)).toEqual([{ scope: "instance", id: ANA }]);
    expect(prop(inspector(view(ANA)), "variant")).toMatchObject({ source: "from This instance", reset: { label: "Reset" } });
  });

  it("notes a narrower value only where this scope overrides the prop", () => {
    render();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    const variant = prop(inspector(view(BIA, "group")), "variant");
    expect(variant.keeping).toBeNull();
    expect(variant.counts).toBe("SAME ON ALL 4");
  });

  it("falls back to This instance while the scoped Instance has gone", () => {
    render();
    click("Menu");
    const item = menuItem();
    expect(view(item, "group").scope).toBe("group");
    click("Menu");
    expect(view(item, "group").scope).toBe("instance");
  });

  it("counts differing values at page scope, with one box per call site", () => {
    render();
    let shown = view(BIA, "page");
    expect(shown.outline.members).toHaveLength(5);
    expect(prop(inspector(shown), "variant").counts).toBe('"ghost" 4 · not set 1');
    expect(inspector(shown).members?.sites?.map((entry) => [entry.anchor, entry.label, entry.count, entry.allIn, entry.toggle])).toEqual([
      [members("Button", 1), "Members › Button[1]", 4, true, { action: "exclude", ids: [row("ana"), row("bia"), row("caio"), row("dani")] }],
      [MENU, "Members › Button[2]", 1, true, { action: "exclude", ids: [MENU] }],
    ]);

    act(() => {
      loupe.exclude(MENU, "page");
    });
    shown = view(BIA, "page");
    expect(inspector(shown).members?.sites?.find((entry) => entry.anchor === MENU)).toMatchObject({
      allIn: false,
      toggle: { action: "include", ids: [MENU] },
    });
    expect(inspector(view(MENU)).chips).toEqual(["Left out of All on page"]);
  });

  it("offers a State prop at This instance only", () => {
    render();
    const body = inspector(view(DIALOG, "group"));
    expect(prop(body, "open").control).toEqual({ kind: "refused", refusal: "state-only", text: "Change it on one Instance." });
    // `modal` isn't a State prop: it keeps its pills, and its conflicting default selects none.
    expect(prop(body, "modal").control?.kind).toBe("options");
    expect(pressed(prop(body, "modal"))).toEqual([]);
  });

  it("doesn't offer label text page-wide, and still shows what each Instance says", () => {
    render();
    const body = inspector(view(BIA, "page"));
    expect(prop(body, "children")).toMatchObject({
      control: { kind: "refused", refusal: "per-call-site", text: "Change it per call site." },
      counts: '"ana" 1 · "bia" 1 · "caio" 1 · "dani" 1 · "Menu" 1',
    });
    expect(prop(body, "variant").control?.kind).toBe("options");
  });
});
