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
import {
  COPY_WORDS,
  type GoneBody,
  type InspectorBody,
  isolate,
  type ListBody,
  panelView,
  type PanelView,
  type PropItem,
  type SeenComponents,
  stripParts,
  stripText,
} from "./index.js";

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

  it("puts the most used component first, each with its share of the most used", () => {
    render();
    click("Menu");
    const body = listOf(view());
    expect(body.groups.map((candidate) => [candidate.component, candidate.mountedCount, candidate.share])).toEqual([
      ["Button", 5, 1],
      ["Dialog", 1, 0.2],
      ["MenuItem", 1, 0.2],
    ]);
  });

  it("gathers a component's Instances by call site, each named by what its Instances show", () => {
    render();
    const sites = group(listOf(view()), "Button")?.sites;
    expect(sites).toEqual([
      {
        anchor: members("Button", 1),
        label: "members.tsx:11",
        names: `${isolate("ana")}, ${isolate("bia")} +2`,
        ids: [row("ana"), row("bia"), row("caio"), row("dani")],
        // The card and each dot are named for a screen reader as what they inspect.
        inspect: `Inspect members.tsx:11: ${isolate("ana")}, ${isolate("bia")} +2`,
        instances: ["ana", "bia", "caio", "dani"].map((name) => ({ id: row(name), label: name, inspect: `Inspect ${name}` })),
        select: row("ana"),
        supported: true,
      },
      {
        anchor: MENU,
        label: "members.tsx:12",
        names: "Menu",
        ids: [MENU],
        inspect: "Inspect members.tsx:12: Menu",
        instances: [{ id: MENU, label: "Menu", inspect: "Inspect Menu" }],
        select: MENU,
        supported: true,
      },
    ]);
  });

  it("gives each component a map hue by its place in the list, and names each mounted Instance's block", () => {
    render();
    const body = listOf(view());
    expect(body.groups.map((item) => item.hue)).toEqual(body.groups.map((_, index) => index % 7));
    const buttons = group(body, "Button");
    expect(buttons?.mapTitle).toBe(`Button ${buttons?.count}`);
    const mounted = buttons?.instances.filter((item) => item.mounted) ?? [];
    expect(mounted.map((item) => item.block?.lead)).toEqual(mounted.map((_, index) => `Inspect Button ${index + 1} of ${mounted.length}, `));
    // What it shows on screen is the app's own words; with nothing to show, its call site says which.
    for (const item of mounted) expect(item.block).toMatchObject(item.name === null ? { who: item.label, own: false } : { who: item.name, own: true });
  });

  it("lists a menu's component while it is open, then under Appears on interaction", () => {
    render();
    view();
    click("Menu");
    const item = group(listOf(view()), "MenuItem");
    expect(item?.count).toBe("×1");
    // An Adapter with no prop that can be Editable.
    expect(item?.verdict).toMatchObject({ supported: false, reason: "no-editable", status: { text: "Inspect only" } });
    // Why is the eye's, in the row's tooltip: no line repeats it.
    expect(item?.notes).toEqual([]);
    expect(item?.inspectOnly).toBe(true);
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
      name: null,
      keys: [],
      mounted: false,
      tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
      values: ['variant "default" · Current "ghost" (last seen)'],
      // Not on the page: no block on the map.
      block: null,
    });
    expect(buttons?.notes).toEqual([
      { kind: "overrides", text: "1 Instance changed" },
      { kind: "not-mounted", text: "1 not mounted" },
    ]);

    // Mounted again: one ordinary row, no held one beside it.
    click("Abrir");
    expect(group(listOf(view()), "Button")?.instances.filter((item) => item.id === CONFIRM)).toEqual([
      {
        id: CONFIRM,
        label: "members.tsx:40",
        name: "Confirmar",
        keys: [1],
        mounted: true,
        tags: [],
        values: [],
        block: { lead: expect.stringMatching(/^Inspect Button \d+ of \d+, $/), who: "Confirmar", own: true },
      },
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

  it("counts the page's changes, and names every record Reset all discards", () => {
    render();
    click("Menu");
    const item = menuItem();
    act(() => {
      loupe.set(item, "children", "Sair");
      loupe.set(ANA, "variant", "default");
    });
    click("Menu");
    const shown = view();
    expect(shown.header).toEqual({ route: "/", page: "Home", report: "Home · 2 changes", title: "Home · 2 changes · /" });
    expect(shown.footer).toMatchObject({ countText: "2 changes", changes: { count: 2, word: "changes" }, hasOverrides: true, copyEnabled: true, states: { chip: null } });
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
    expect(body.inspectFold.injected).toEqual({ summary: "1 set by the library", rows: [{ name: "aria-expanded", value: "false" }] });
    expect(prop(body, "children")).toMatchObject({ label: "Text", codeName: "children", control: { kind: "text", value: "bia" } });
    expect(prop(body, "variant").codeName).toBeNull();
    expect(body.note).toBeNull();
    // The identity block: its component, the page, the verdict, its visible name as the app's own words, and where it is written.
    expect(body.identity).toMatchObject({
      component: body.name === null ? null : "Button",
      page: "Home",
      status: { kind: "supported", text: "Supported" },
      ownName: body.name !== null,
      where: { file: "members.tsx", line: ":11 · use 1 of 2" },
      id: BIA,
      note: null,
      held: null,
    });
    // Inspect only, folded: two props, for two reasons, so each row keeps its own.
    expect(body.inspectFold).toMatchObject({ title: "Inspect only · 2", names: " · render, onClick", meta: null, open: false, shared: null });
    expect(body.inspectFold.rows.map((row) => row.reason)).toEqual(["STRUCTURAL", "FUNCTION"]);
  });

  it("goes inspect-only as a whole while the React self-check fails, and says so once, in the banner", () => {
    render();
    act(() => {
      loupe.set(ANA, "variant", "default");
    });
    act(() => disableOverrides("React reported no fiber while an Adapter rendered."));
    const shown = view(BIA);
    expect(shown.notices).toEqual([
      {
        kind: "overrides-off",
        tone: "alert",
        title: "Overrides are off",
        meta: null,
        body: "Everything is inspect-only: this React build isn’t supported (React reported no fiber while an Adapter rendered.).",
        rows: [],
        command: null,
      },
    ]);
    expect(shown.announcements).toEqual({
      alert: "",
      status: "Overrides are off. Everything is inspect-only: this React build isn’t supported (React reported no fiber while an Adapter rendered.).",
    });
    expect(shown.footer.resetAll).toEqual([]);
    const body = inspector(shown);
    expect(body.coverage.text).toBe("0 editable props · 4 inspect only");
    expect(body.verdict).toMatchObject({ supported: false, reason: "overrides-off" });
    // The banner says it (PER-184).
    expect(body.note).toBeNull();
    expect(body.editing).toBeNull();
    expect(body.inspectFold.meta).toBe("Overrides off");
    // Each row draws the eye, and says why in its tooltip.
    expect(listOf(view()).groups.map((candidate) => [candidate.inspectOnly, candidate.statusTitle])).toEqual([
      [true, "Overrides are off"],
      [true, "Overrides are off"],
    ]);
  });

  it("says how to give metadata to an Adapter made without it, with no generate command (PER-234)", () => {
    render();
    click("Menu");
    // The fixture's MenuItem is `createAdapter` with no `{ props }`, as a hand-made Adapter is.
    const body = inspector(view(menuItem()));
    expect(body.note).toEqual({
      kind: "no-meta",
      title: "No prop metadata",
      body: "This Adapter was made without prop metadata, so its props are inspect-only. Pass the metadata to `createAdapter` as `{ props }`, as the Product layer’s Adapters do.",
    });
  });

  it("reads Not on the page now once the selected Instance has gone, with what it still holds", () => {
    render();
    click("Menu");
    const item = menuItem();
    expect(view(item).body.kind).toBe("inspector");
    click("Menu");
    // What it was stays: the component its id names, though Loupe never kept how it rendered.
    expect(gone(view(item))).toMatchObject({ kind: "gone", id: item, canReset: false });
    // The identity block says so, in words, and names it by its component: Loupe's word, not the app's.
    expect(gone(view(item)).identity).toMatchObject({
      component: null,
      page: null,
      status: { text: "Not on the page now" },
      name: "MenuItem",
      ownName: false,
      where: null,
      id: null,
      tags: [],
      held: null,
    });

    click("Abrir");
    act(() => {
      loupe.set(CONFIRM, "variant", "default");
    });
    click("Fechar");
    expect(gone(view(CONFIRM))).toMatchObject({ kind: "gone", id: CONFIRM, canReset: true });
    expect(gone(view(CONFIRM)).identity).toMatchObject({
      name: "Button",
      tags: [{ kind: "not-mounted", text: "No Instance mounted" }],
      held: ['variant "default" · Current "ghost" (last seen)'],
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
      held: {
        before: "Your Override holds this at",
        value: "true",
        middle: "; the app tried to set",
        tried: "false",
        after: ".",
        text: "Your Override holds this at true; the app tried to set false.",
      },
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

  it("reaches every Instance of a call site at group scope, and counts what each one shows (critique 2026-11-20)", () => {
    render();
    let shown = view(BIA, "group");
    expect(shown.scope).toBe("group");
    expect(shown.outline.members).toEqual(["ana", "bia", "caio", "dani"].map((name) => ({ id: row(name), out: false })));
    let variant = prop(inspector(shown), "variant");
    expect(variant).toMatchObject({ counts: "Same on all 4", source: "from the app", reset: null, control: { key: "group" } });
    expect(pressed(variant)).toEqual(['"ghost"']);

    act(() => {
      loupe.set(BIA, "variant", "default", "group");
    });
    shown = view(BIA, "group");
    variant = prop(inspector(shown), "variant");
    expect(variant).toMatchObject({ source: `from ${GROUP}`, reset: { label: "Reset", write: { id: BIA, prop: "variant", scope: "group" } } });
    // The pills count what each member shows now: all four show the group's value.
    expect(pills(variant)).toEqual([
      ['"default"', true, 4],
      ['"ghost"', false, null],
    ]);
    // The change still reads from the app's own value.
    expect(variant.change).toEqual({ from: '"ghost"', to: '"default"' });
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
    expect(scoped?.countText).toBe("Reaches 3 of 4");
    // The page has one more Button than the call site: the scope says so, and can widen to it.
    expect(scoped?.reach).toEqual({ lead: "Reaches", included: 3, total: 4, page: 5, moreText: "1 more on this page", countText: "3 of 4" });
    expect(scoped?.sites).toBeNull();
    expect(scoped?.members.find((member) => member.id === BIA)).toEqual({
      id: BIA,
      label: "This instance",
      name: "bia",
      out: true,
      tag: { kind: "left-out", text: "Left out" },
      toggle: "include",
    });
    expect(scoped?.members.find((member) => member.id === ANA)).toEqual({ id: ANA, label: "#ana", name: "ana", out: false, tag: null, toggle: "exclude" });
    // The three still in the scope show its value; Bia, left out, isn't counted.
    expect(pills(prop(inspector(shown), "variant"))).toEqual([
      ['"default"', true, 3],
      ['"ghost"', false, null],
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
    // Ana keeps her own ghost on top of the group's default.
    expect(pills(prop(inspector(shown), "variant"))).toEqual([
      ['"default"', true, 2],
      ['"ghost"', false, 1],
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
    // The table says what shows: Ana's own value too, so it never claims all four agree (critique 2026-11-20).
    expect(variant.counts).toBe('"default" 1 · "ghost" 3');
    expect(pressed(variant)).toEqual([]);
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

describe("the plot key and on-screen names (critique 2026-11-19)", () => {
  it("numbers each change as the Proposal will, and marks every Instance it reaches", () => {
    render();
    act(() => {
      loupe.set(ANA, "variant", "outline");
      loupe.set(BIA, "variant", "secondary", "group");
      loupe.exclude(ANA, "group");
    });
    const shown = view();
    // Numbered in the order they were made, as the Proposal will: c1, c2.
    expect(listOf(shown).changes).toEqual([
      { n: 1, props: "variant", detail: 'variant "ghost" → "outline"', where: "ana", select: ANA, reached: [ANA] },
      // The group reaches BIA, CAIO and DANI: ANA is left out of it.
      {
        n: 2,
        props: "variant",
        detail: 'variant "ghost" → "secondary"',
        // The name sits between direction isolates: an RTL name can't reorder "and 2 more".
        where: "\u2068bia\u2069 and 2 more",
        select: BIA,
        reached: [BIA, row("caio"), row("dani")],
      },
    ]);
    // ANA is left out of the group, so only its own change marks it.
    expect(shown.marks.map(({ id, keys }) => ({ id, keys }))).toEqual([
      { id: ANA, keys: [1] },
      { id: BIA, keys: [2] },
      { id: row("caio"), keys: [2] },
      { id: row("dani"), keys: [2] },
    ]);
    expect(prop(inspector(view(ANA)), "variant").key).toBe(1);
    expect(prop(inspector(view(BIA)), "variant").key).toBe(2);
    expect(prop(inspector(view(BIA, "group")), "variant").key).toBe(2);
    // A stamp per Instance of what its changes set: a new value moves it, the same number or not.
    const before = shown.marks.find((mark) => mark.id === BIA)?.stamp;
    act(() => {
      loupe.set(BIA, "variant", "outline", "group");
    });
    expect(view().marks.find((mark) => mark.id === BIA)?.stamp).not.toBe(before);
    expect(view().marks.find((mark) => mark.id === BIA)?.keys).toEqual([2]);
  });

  it("names an Instance by what it shows on screen", () => {
    render();
    const body = listOf(view());
    expect(group(body, "Button")?.instances.find((item) => item.id === ANA)?.name).toBe("ana");
    expect(inspector(view(ANA)).name).toBe("ana");
  });

  it("offers Hold open for a State prop with a true/false choice, and leaves it out of the numbered changes", () => {
    render();
    const before = inspector(view(DIALOG));
    expect(before.hold).toEqual({ prop: "open", held: false, write: { id: DIALOG, prop: "open", scope: "instance" } });
    act(() => {
      loupe.set(DIALOG, "open", true);
    });
    const shown = view(DIALOG);
    expect(inspector(shown).hold?.held).toBe(true);
    // The Proposal shows a held State prop as a state, not a change.
    expect(listOf(view()).changes).toEqual([]);
    expect(shown.marks).toEqual([]);
    // The footer counts it apart, with an unnumbered dashed delta, and so does the band.
    expect(shown.footer.countText).toBe("0 changes · 1 state shown");
    expect(shown.footer.states).toEqual({ chip: "1 held", title: expect.stringContaining("open held at true") });
    expect(shown.header.report).toBe("Home · 1 state shown");
  });

  it("says a dialog that renders nothing until it is held open is not visible now (critique 2026-11-20)", () => {
    render();
    const notVisible = { kind: "not-visible", text: "Not visible now" };
    expect(inspector(view(DIALOG)).tags).toContainEqual(notVisible);
    act(() => {
      loupe.set(DIALOG, "open", true);
    });
    expect(inspector(view(DIALOG)).tags).not.toContainEqual(notVisible);
  });

  it("keeps each change's number while others come and go (critique 2026-11-20)", () => {
    render();
    // The panel shows before any change, as the Toolbar's does: numbering watches from then.
    view();
    // A page-wide change first, then an Instance change: records() lists the Instance first.
    act(() => {
      loupe.set(BIA, "variant", "secondary", "page");
      loupe.set(ANA, "size", "sm");
    });
    expect(listOf(view()).changes.map(({ n, props }) => [n, props])).toEqual([
      [1, "variant"],
      [2, "size"],
    ]);
    // A reset change leaves its number unused: the next one never takes it.
    act(() => {
      loupe.reset(BIA, "variant", "page");
      loupe.set(row("caio"), "variant", "outline");
    });
    expect(listOf(view()).changes.map(({ n, props }) => [n, props])).toEqual([
      [2, "size"],
      [3, "variant"],
    ]);
    // Undo puts changes back as they were, numbers included.
    const saved = loupe.records();
    act(() => {
      for (const record of saved) loupe.discard(record.target);
    });
    expect(listOf(view()).changes).toEqual([]);
    act(() => loupe.restore(saved));
    expect(listOf(view()).changes.map(({ n }) => n)).toEqual([2, 3]);
    // Made again with other values, a change is a new one.
    act(() => {
      loupe.reset(row("caio"), "variant");
      loupe.set(row("caio"), "variant", "ghost");
    });
    expect(listOf(view()).changes.map(({ n }) => n)).toEqual([2, 4]);
  });
});

describe("the chrome's words", () => {
  const still = { picking: false, mode: "one" as const, covered: false, marksHidden: false };

  it("says on the strip what the page is doing: picking first, then a dialog under the panel, then the marks hidden", () => {
    expect(stripParts(still)).toBeNull();
    expect(stripText(stripParts({ ...still, marksHidden: true }))).toBe("Outlines are hidden on the page");
    expect(stripText(stripParts({ ...still, marksHidden: true, covered: true }))).toBe("A dialog on the page runs under the panel · hold Alt to see through");
    expect(stripText(stripParts({ ...still, covered: true, picking: true, mode: "many" }))).toBe(
      "Click an Instance: every one from its call site is selected · Esc cancels",
    );
    expect(stripText(null)).toBe("");
  });

  it("says a copy as the toast shows it, and a refusal with the text below only when there is text", () => {
    expect(COPY_WORDS.copiedText("Outline the menu")).toBe("Copied “Outline the menu”. Paste it into your coding agent.");
    expect(COPY_WORDS.notCopiedText("Document is not focused.", true)).toBe("Document is not focused. Your Proposal is below.");
    expect(COPY_WORDS.notCopiedText("The clipboard needs localhost or HTTPS.", false)).toBe("The clipboard needs localhost or HTTPS.");
  });
});

describe("structural sharing across calls", () => {
  /** A call given the last view, as the Toolbar makes it (`open.tsx`). */
  const after = (previous: PanelView, selected: string | null = null, scope: Scope = "instance") =>
    panelView({ debug: loupe, layer: null, selected, scope, seen: previous.seen, previous });

  it("hands back the last view itself when nothing it shows changed", () => {
    render();
    const list = view();
    expect(after(list)).toBe(list);
    const inspected = view(BIA, "group");
    expect(after(inspected, BIA, "group")).toBe(inspected);
  });

  it("keeps every group and Instance of the list that an Override elsewhere didn't touch", () => {
    render();
    const first = view();
    act(() => {
      loupe.set(ANA, "variant", "ghost");
    });
    const next = after(first);
    const [before, now] = [listOf(first), listOf(next)];
    // Ana's group changed: it holds an Override now, and Ana is numbered on the plot key.
    expect(group(now, "Button")).not.toBe(group(before, "Button"));
    expect(group(now, "Button")?.instances[0]?.keys).toEqual([1]);
    // Everything else in it, and the other component, is the last call's own object.
    expect(group(now, "Dialog")).toBe(group(before, "Dialog"));
    expect(group(now, "Button")?.instances[1]).toBe(group(before, "Button")?.instances[1]);
    expect(group(now, "Button")?.sites).toBe(group(before, "Button")?.sites);
    expect(now.page).toBe(before.page);
  });

  it("keeps the rows a scope switch doesn't change, and makes new the ones it does", () => {
    render();
    const one = view(BIA);
    const many = after(one, BIA, "group");
    expect(many.scope).toBe("group");
    // At the group, the Editable rows count the call site's four members: new rows.
    expect(prop(inspector(many), "variant")).not.toBe(prop(inspector(one), "variant"));
    // The Inspect only row reads the app's value at either scope: the same object.
    expect(prop(inspector(many), "render")).toBe(prop(inspector(one), "render"));
    expect(inspector(many).identity.crumbs).toBe(inspector(one).identity.crumbs);
  });

  it("keeps the selected Instance's rows when something else on the page changes", () => {
    render();
    const first = view(BIA);
    click("Menu");
    const next = after(first, BIA);
    // The page did move: a MenuItem mounted.
    expect(next.instanceCount).toBe(first.instanceCount + 1);
    expect(inspector(next).editable).toBe(inspector(first).editable);
    expect(inspector(next).inspectOnly).toBe(inspector(first).inspectOnly);
  });
});
