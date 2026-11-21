import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { callSiteHint, callSiteId, instanceId } from "../call-site.js";
import type { OverrideRecord } from "../runtime/store.js";
import type { CallSiteWrites } from "../writes.js";
import { buildProposal, buildProposalKeyed, type ProposalInput, type Sighting, setOnKey } from "./build.js";
import { locationInWords, proposalText } from "./text.js";
import { howToApply, type Proposal } from "./types.js";

// A Membros page, as the Toolbar would have seen it: four member rows, each with a
// menu trigger Button, a remove dialog, and a role Badge rendered on the server.

const ROUTE = "/org/acme/configuracoes/membros";
const FILE = "apps/app/components/product/member-row-menu.tsx";
const menuSite = (component: string, ordinal: number) => ({ path: FILE, enclosing: "MemberRowMenu", component, ordinal });
const TRIGGER_SITE = menuSite("Button", 1);
const CONFIRM_SITE = menuSite("Button", 2);
const DIALOG_SITE = menuSite("AlertDialog", 1);
const CANCEL_SITE = menuSite("AlertDialogCancel", 1);
const INVITE_SITE = { path: "apps/app/app/membros/page-client.tsx", enclosing: "MembersHeader", component: "Button", ordinal: 1 };
const BADGE_SITE = { path: "apps/app/app/membros/page.tsx", enclosing: "MembersTable", component: "Badge", ordinal: 1 };
const TRIGGER = callSiteId(TRIGGER_SITE);
const CONFIRM = callSiteId(CONFIRM_SITE);
const DIALOG = callSiteId(DIALOG_SITE);
const CANCEL = callSiteId(CANCEL_SITE);
const INVITE = callSiteId(INVITE_SITE);
const BADGE = callSiteId(BADGE_SITE);

const literal = (...names: string[]): CallSiteWrites => ({
  attributes: names.map((name) => ({ name, writtenAs: "literal" as const })),
  spreads: false,
  children: "none",
});

function sighting(partial: Partial<Sighting> & Pick<Sighting, "id" | "anchor" | "component">): Sighting {
  return {
    hint: null,
    keyPath: "",
    rendered: "client",
    current: {},
    writes: null,
    stateProps: [],
    routes: [ROUTE],
    mounted: true,
    ...partial,
  };
}

const USERS = ["user_1", "user_2", "user_3", "user_4"];

function membros(): Sighting[] {
  return [
    ...USERS.map((user, index) =>
      sighting({
        id: instanceId(TRIGGER, user),
        anchor: TRIGGER,
        component: "Button",
        hint: callSiteHint(TRIGGER_SITE, { line: 80, column: 13, total: 2 }),
        keyPath: user,
        current: { variant: index === 3 ? "secondary" : "ghost", size: "icon" },
        writes: { attributes: [{ name: "variant", writtenAs: "expression", expression: "isSelf ? \"secondary\" : \"ghost\"" }, { name: "size", writtenAs: "literal" }], spreads: false, children: "elements" },
      }),
    ),
    sighting({
      id: instanceId(CONFIRM, "user_2"),
      anchor: CONFIRM,
      component: "Button",
      hint: callSiteHint(CONFIRM_SITE, { line: 120, column: 9, total: 2 }),
      keyPath: "user_2",
      current: { variant: "destructive" },
      writes: literal("variant"),
      mounted: false,
    }),
    sighting({
      id: instanceId(DIALOG, "user_2"),
      anchor: DIALOG,
      component: "AlertDialog",
      hint: callSiteHint(DIALOG_SITE, { line: 100, column: 5, total: 1 }),
      keyPath: "user_2",
      current: { open: false },
      writes: { attributes: [{ name: "open", writtenAs: "expression", expression: "open" }, { name: "onOpenChange", writtenAs: "expression", expression: "setOpen" }], spreads: false, children: "elements" },
      stateProps: ["open"],
    }),
    sighting({
      id: instanceId(CANCEL, "user_2"),
      anchor: CANCEL,
      component: "AlertDialogCancel",
      hint: callSiteHint(CANCEL_SITE, { line: 118, column: 9, total: 1 }),
      keyPath: "user_2",
      current: { children: "Cancelar" },
      writes: { attributes: [], spreads: false, children: "text" },
    }),
    sighting({
      id: INVITE,
      anchor: INVITE,
      component: "Button",
      hint: callSiteHint(INVITE_SITE, { line: 30, column: 7, total: 1 }),
      current: { variant: "default" },
      writes: literal("variant"),
    }),
    sighting({
      id: instanceId(BADGE, "user_1"),
      anchor: BADGE,
      component: "Badge",
      rendered: "server",
      keyPath: "user_1",
      hint: callSiteHint(BADGE_SITE, { line: 44, column: 11, total: 1 }),
    }),
  ];
}

const record = (target: OverrideRecord["target"], values: OverrideRecord["values"], extra: Partial<OverrideRecord> = {}): OverrideRecord => ({
  target,
  values,
  excluded: [],
  suspended: null,
  ...extra,
});

const PROJECT = { repo: "orbix-ai", commit: "0123456789abcdef", dirty: true, playgroundVersion: "0.0.2", install: { app: "apps/app", layer: "packages/loupe" } };

function input(records: OverrideRecord[], overrides: Partial<ProposalInput> = {}): ProposalInput {
  return {
    title: "Quieter member menus",
    createdAt: "2026-11-12T10:00:00.000Z",
    project: PROJECT,
    records,
    sightings: membros(),
    setOn: {},
    routes: {
      [ROUTE]: {
        url: `http://localhost:3131${ROUTE}?tab=ativos`,
        viewport: [1440, 900],
        dpr: 2,
        theme: "dark",
        capturedAt: "2026-11-12T09:59:00.000Z",
      },
    },
    currentRoute: ROUTE,
    flags: { "new-roles": true },
    ...overrides,
  };
}

const changesOf = (proposal: Proposal) => proposal.routes.flatMap((route) => route.changes);

const schema = JSON.parse(readFileSync(new URL("../../proposal.schema.json", import.meta.url), "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats.default(ajv);
const validate = ajv.compile(schema);

function expectValid(proposal: unknown): void {
  const ok = validate(JSON.parse(JSON.stringify(proposal)));
  expect(validate.errors ?? []).toEqual([]);
  expect(ok).toBe(true);
}

describe("buildProposal", () => {
  it("records a call-site change as one source edit with its counting rule", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: TRIGGER }, { variant: "outline" })]));
    const [change] = changesOf(proposal);
    expect(change?.scope).toBe("call-site");
    expect(change?.callSites).toEqual([
      {
        path: FILE,
        enclosing: "MemberRowMenu",
        component: "Button",
        nth: 1,
        total: 2,
        anchor: TRIGGER,
        lineHint: "80:13",
      },
    ]);
    expect(change?.props).toEqual([
      {
        name: "variant",
        currentCounts: { '"ghost"': 3, '"secondary"': 1 },
        proposed: "outline",
        writtenAs: "expression",
        expression: 'isSelf ? "secondary" : "ghost"',
      },
    ]);
    expect(change?.instances.map((instance) => instance.keyPath)).toEqual(USERS);
    expect(change?.needsCondition).toBeNull();
    // The value comes from app logic: the agent proposes the code and waits.
    expect(change?.action).toBe("ask-first");
    expect(change?.askFirst).toEqual(['`variant` is written as an expression: `isSelf ? "secondary" : "ghost"`']);
    expect(proposal.formatVersion).toBe(2);
    expect(proposal.howToApply).toBe(howToApply(PROJECT.install));
    expect(proposal.howToApply).toContain("`pnpm -C apps/app exec loupe locate`");
  });

  it("flags a left-out Instance of a call-site change as needing a condition", () => {
    const proposal = buildProposal(
      input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [instanceId(TRIGGER, "user_4")] })]),
    );
    const [change] = changesOf(proposal);
    expect(change?.needsCondition).toBe("Left out: 1 (user_4), needs a condition");
    expect(change?.action).toBe("ask-first");
    expect(change?.askFirst).toEqual(["Left out: 1 (user_4), needs a condition"]);
    expect(change?.instances.find((instance) => instance.keyPath === "user_4")?.included).toBe(false);
    // The left-out Instance's value doesn't count towards Current.
    expect(change?.props[0]).toMatchObject({ name: "size", current: "icon", writtenAs: "literal" });
  });

  it("flags one Instance of a repeated call site, and not the only one of a single call site", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: instanceId(TRIGGER, "user_3") }, { variant: "outline" }),
        record({ scope: "instance", id: INVITE }, { variant: "secondary" }),
      ]),
    );
    const [repeated, single] = changesOf(proposal);
    expect(repeated?.needsCondition).toBe("1 of 4 from this call site (user_3), needs a condition");
    expect(repeated?.props[0]).toMatchObject({ current: "ghost", proposed: "outline" });
    expect(repeated?.action).toBe("ask-first");
    expect(repeated?.askFirst[0]).toBe("1 of 4 from this call site (user_3), needs a condition");
    expect(single?.needsCondition).toBeNull();
    expect(single?.props[0]).toMatchObject({ current: "default", proposed: "secondary", writtenAs: "literal" });
    expect(single?.action).toBe("apply");
    expect(single?.askFirst).toEqual([]);
  });

  it("lists every call site a page change reached, the server-rendered ones apart, and who wins over it", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: instanceId(TRIGGER, "user_1") }, { size: "lg" }),
        record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" }),
        record({ scope: "page", route: ROUTE, component: "Badge" }, { variant: "outline" }),
      ]),
    );
    const [instance, page, badge] = changesOf(proposal);
    expect(page?.scope).toBe("page");
    expect(page?.callSites.map((site) => site.anchor)).toEqual([INVITE, TRIGGER, CONFIRM].sort());
    expect(page?.overriddenBy).toEqual([instance?.id]);
    expect(page?.props[0]?.writtenAs).toBe("varies");
    expect(page?.props[0]?.perCallSite).toHaveLength(3);
    expect(badge?.serverRendered).toEqual([{ id: instanceId(BADGE, "user_1"), anchor: BADGE, keyPath: "user_1" }]);
    expect(badge?.callSites).toEqual([]);
    // c1 sets `size` on 1 of 4 Instances and asks first: the page change waits for that decision.
    expect(page?.action).toBe("ask-first");
    expect(page?.askFirst).toEqual(["c1 sets `size` on some of the same Instances and asks first, so this does too"]);
    // Server-rendered Instances the designer never saw change: the agent asks.
    expect(badge?.action).toBe("ask-first");
    expect(badge?.askFirst).toEqual([
      "Loupe has no record of how the call site writes `variant`",
      "1 server-rendered Instance on the page couldn't be previewed: ask whether to change its call site too",
    ]);
    expectValid(proposal);
  });

  it("keeps a page change Apply when its call sites write the prop as a literal or not at all", () => {
    const proposal = buildProposal(input([record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" })]));
    const [page] = changesOf(proposal);
    expect(page?.props[0]?.writtenAs).toBe("varies");
    expect(page?.props[0]?.perCallSite?.map((site) => site.writtenAs).sort()).toEqual(["literal", "unset", "unset"]);
    expect(page?.action).toBe("apply");
    expect(page?.askFirst).toEqual([]);
  });

  it("keeps a page change Apply under a narrower change that is itself Apply", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: INVITE }, { size: "lg" }),
        record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" }),
      ]),
    );
    const [instance, page] = changesOf(proposal);
    expect(instance?.action).toBe("apply");
    expect(page?.overriddenBy).toEqual([instance?.id]);
    expect(page?.action).toBe("apply");
  });

  it("asks first when a prop may come from props the call site spreads", () => {
    const sightings = membros().map((entry) =>
      entry.anchor === INVITE ? { ...entry, writes: { attributes: [], spreads: true, children: "none" as const } } : entry,
    );
    const proposal = buildProposal(input([record({ scope: "group", anchor: INVITE }, { size: "sm" })], { sightings }));
    const [change] = changesOf(proposal);
    expect(change?.props[0]?.writtenAs).toBe("spread");
    expect(change?.action).toBe("ask-first");
    expect(change?.askFirst).toEqual(["`size` may come from props the call site spreads"]);
    expectValid(proposal);
  });

  it("records label text as an ordinary children entry, written as a literal", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: CANCEL }, { children: "Voltar" })]));
    expect(changesOf(proposal)[0]?.props).toEqual([
      { name: "children", current: "Cancelar", proposed: "Voltar", writtenAs: "literal" },
    ]);
    expect(changesOf(proposal)[0]?.action).toBe("apply");
    expect(proposalText(proposal)).toContain("Text: 'Cancelar' → 'Voltar'");
  });

  it("puts a State prop under States shown, not under changes", () => {
    const proposal = buildProposal(input([record({ scope: "instance", id: instanceId(DIALOG, "user_2") }, { open: true })]));
    const [route] = proposal.routes;
    expect(route?.changes).toEqual([]);
    expect(route?.statesShown).toEqual([
      {
        anchor: DIALOG,
        component: "AlertDialog",
        keyPath: "user_2",
        prop: "open",
        forced: true,
        controlled: true,
        appControlsVia: "onOpenChange",
        onScreenAtExport: true,
      },
    ]);
    expectValid(proposal);
  });

  it("holds suspended records for review and never proposes them", () => {
    const proposal = buildProposal(
      input([
        record(
          { scope: "group", anchor: TRIGGER },
          { variant: "outline" },
          { suspended: { reason: "code-changed", anchor: TRIGGER, was: 2, now: 3 } },
        ),
        record(
          { scope: "instance", id: instanceId(CONFIRM, "user_2") },
          { variant: undefined },
          { suspended: { reason: "ambiguous", ids: [instanceId(CONFIRM, "user_2")] } },
        ),
      ]),
    );
    expect(changesOf(proposal)).toEqual([]);
    expect(proposal.heldForReview).toEqual([
      {
        scope: "call-site",
        component: "Button",
        anchor: TRIGGER,
        route: ROUTE,
        reason: "code-changed",
        detail: "Code changed here, review: this call site had 2 uses and now has 3",
        props: [{ name: "variant", proposed: "outline" }],
      },
      {
        scope: "instance",
        component: "Button",
        anchor: CONFIRM,
        route: ROUTE,
        reason: "ambiguous",
        detail: `Matches more than one Instance, review: ${instanceId(CONFIRM, "user_2")}`,
        props: [{ name: "variant", proposedUnset: true }],
      },
    ]);
    expectValid(proposal);
  });

  it("flags a change with no Instance mounted, its Current value as last seen", () => {
    const proposal = buildProposal(input([record({ scope: "instance", id: instanceId(CONFIRM, "user_2") }, { variant: "default" })]));
    const [change] = changesOf(proposal);
    expect(change?.onScreenAtExport).toBe(false);
    expect(change?.props[0]).toMatchObject({ current: "destructive", proposed: "default" });
    expect(proposalText(proposal)).toContain("not on screen when copied");
  });

  it("keeps a record that was never seen, as a call site with no total", () => {
    const anchor = callSiteId(menuSite("DropdownMenuItem", 3));
    const proposal = buildProposal(input([record({ scope: "group", anchor }, { variant: "destructive" })]));
    const [change] = changesOf(proposal);
    expect(change?.callSites[0]).toMatchObject({ nth: 3, total: null, lineHint: null, component: "DropdownMenuItem" });
    expect(change?.props[0]).toEqual({ name: "variant", proposed: "destructive", writtenAs: "unknown" });
    expect(change?.action).toBe("ask-first");
    expectValid(proposal);
  });

  it("lists a change under the route it was set on, with the other routes it renders on", () => {
    const sightings = membros().map((entry) =>
      entry.anchor === INVITE ? { ...entry, routes: ["/org/acme/configuracoes/convites", ROUTE] } : entry,
    );
    const target = { scope: "group", anchor: INVITE } as const;
    const proposal = buildProposal(
      input([record(target, { variant: "outline" })], {
        sightings,
        setOn: { [setOnKey(target)]: "/org/acme/configuracoes/convites" },
      }),
    );
    expect(proposal.routes.map((route) => route.route)).toEqual(["/org/acme/configuracoes/convites"]);
    const [route] = proposal.routes;
    expect(route?.url).toBeNull();
    expect(route?.changes[0]?.alsoRendersOn).toEqual([ROUTE]);
    expectValid(proposal);
  });

  it("names the other routes a page change's call sites render on: an edit there reaches them too", () => {
    const sightings = membros().map((entry) => (entry.anchor === INVITE ? { ...entry, routes: ["/org/acme/configuracoes/convites", ROUTE] } : entry));
    const proposal = buildProposal(input([record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" })], { sightings }));
    expect(changesOf(proposal)[0]?.alsoRendersOn).toEqual(["/org/acme/configuracoes/convites"]);
    expectValid(proposal);
  });

  it("names a route where the call site draws other Instances than the ones the change covers", () => {
    // Another page draws the same trigger Button for its own rows, never seen on this one.
    const elsewhere = sighting({
      id: instanceId(TRIGGER, "user_9"),
      anchor: TRIGGER,
      component: "Button",
      keyPath: "user_9",
      current: { variant: "ghost", size: "icon" },
      routes: ["/org/acme/equipes"],
      mounted: false,
    });
    const proposal = buildProposal(
      input([record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" })], { sightings: [...membros(), elsewhere] }),
    );
    const [page] = changesOf(proposal);
    expect(page?.instances.map((instance) => instance.keyPath)).not.toContain("user_9");
    expect(page?.alsoRendersOn).toEqual(["/org/acme/equipes"]);
  });

  it("carries the context: commit, dirty tree, URL, viewport, theme and flags", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" })], { designer: "  " }));
    expect(proposal.project).toEqual(PROJECT);
    expect(proposal.designer).toBeNull();
    expect(proposal.routes[0]).toMatchObject({
      url: `http://localhost:3131${ROUTE}?tab=ativos`,
      route: ROUTE,
      viewport: [1440, 900],
      dpr: 2,
      theme: "dark",
      flags: { "new-roles": true },
    });
  });

  it("requires a title", () => {
    expect(() => buildProposal(input([], { title: "   " }))).toThrow(/needs a title/);
  });

  it("carries each entry's note, keyed by its record, and names each entry's record (PER-139)", () => {
    const group = record({ scope: "group", anchor: TRIGGER }, { size: "sm" });
    const invite = record({ scope: "instance", id: INVITE }, { variant: "ghost" });
    const { proposal, keys } = buildProposalKeyed(
      input([group, invite], { notes: { [setOnKey(group.target)]: "  Rows feel heavy at icon size.  ", [setOnKey(invite.target)]: "   " } }),
    );
    expect(changesOf(proposal).map((change) => [change.id, change.note])).toEqual([
      ["c1", "Rows feel heavy at icon size."],
      ["c2", null],
    ]);
    expect(keys).toEqual({ c1: setOnKey(group.target), c2: setOnKey(invite.target) });
    expectValid(proposal);
  });

  it("reads the store without changing it", () => {
    const records = [record({ scope: "group", anchor: TRIGGER }, { variant: "outline" }, { excluded: [instanceId(TRIGGER, "user_4")] })];
    const before = structuredClone(records);
    buildProposal(input(records));
    expect(records).toEqual(before);
  });
});

describe("the published schema", () => {
  it("accepts a Proposal with every scope, label text, a State prop and held records", () => {
    const proposal = buildProposal(
      input(
        [
          record({ scope: "instance", id: instanceId(TRIGGER, "user_3") }, { variant: "outline" }),
          record({ scope: "instance", id: instanceId(DIALOG, "user_2") }, { open: true }),
          record({ scope: "group", anchor: CANCEL }, { children: "Voltar" }),
          record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [instanceId(TRIGGER, "user_4")] }),
          record({ scope: "page", route: ROUTE, component: "Button" }, { size: undefined }),
          record({ scope: "group", anchor: INVITE }, { variant: "ghost" }, { suspended: { reason: "code-changed", anchor: INVITE, was: 1, now: 2 } }),
        ],
        { designer: "Dana" },
      ),
    );
    expectValid(proposal);
    expect(changesOf(proposal).map((change) => change.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("rejects what isn't a Proposal", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" })]));
    expect(validate({ ...proposal, formatVersion: 1 })).toBe(false);
    expect(validate({ ...proposal, formatVersion: 3 })).toBe(false);
    expect(validate({ ...proposal, title: "" })).toBe(false);
    const [route] = proposal.routes;
    const change = route?.changes[0];
    const broken = { ...proposal, routes: [{ ...route, changes: [{ ...change, props: [{ name: "size", writtenAs: "literal" }] }] }] };
    expect(validate(broken)).toBe(false);
    expect(validate({ ...proposal, extra: true })).toBe(false);
    // An action and its reasons go together.
    const reasonless = { ...proposal, routes: [{ ...route, changes: [{ ...change, action: "ask-first", askFirst: [] }] }] };
    expect(validate(reasonless)).toBe(false);
    const reasoned = { ...proposal, routes: [{ ...route, changes: [{ ...change, action: "apply", askFirst: ["why"] }] }] };
    expect(validate(reasoned)).toBe(false);
  });
});

describe("helpers", () => {
  it("says where a call site is in words", () => {
    expect(
      locationInWords({ path: FILE, enclosing: "MemberRowMenu", component: "Button", nth: 3, total: 4, anchor: "", lineHint: null }),
    ).toBe("3rd of 4 `<Button>` in `MemberRowMenu` (member-row-menu.tsx)");
  });
});

describe("what the page last showed", () => {
  it("counts only the mounted Instances while any is mounted, and keeps a left-out one that isn't", () => {
    const old = USERS.map((user) =>
      sighting({ id: instanceId(TRIGGER, `old_${user}`), anchor: TRIGGER, component: "Button", keyPath: `old_${user}`, current: { size: "lg" }, mounted: false }),
    );
    const proposal = buildProposal(
      input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [instanceId(TRIGGER, "old_user_1")] })], {
        // Rows of an earlier page of the list, seen first.
        sightings: [...old, ...membros()],
      }),
    );
    const [change] = changesOf(proposal);
    expect(change?.props[0]).toMatchObject({ current: "icon" });
    expect(change?.instances.filter((instance) => instance.included).map((instance) => instance.keyPath)).toEqual(USERS);
    expect(change?.instances.find((instance) => !instance.included)).toMatchObject({ keyPath: "old_user_1", onScreenAtExport: false });
    expect(change?.callSites[0]?.lineHint).toBe("80:13");
  });

  it("tells apart values that the Toolbar shows the same", () => {
    const long = "x".repeat(130);
    const sightings = membros().map((entry, index) =>
      entry.anchor === TRIGGER ? { ...entry, current: { title: index === 0 ? `${long}a` : `${long}b` } } : entry,
    );
    const proposal = buildProposal(input([record({ scope: "group", anchor: TRIGGER }, { title: "short" })], { sightings }));
    const counts = changesOf(proposal)[0]?.props[0]?.currentCounts ?? {};
    expect(Object.values(counts).sort()).toEqual([1, 3]);
    expect(Object.keys(counts)).toHaveLength(2);
    expectValid(proposal);
  });

  it("says a value comes from code even when there is no expression text", () => {
    const sightings = membros().map((entry) =>
      entry.anchor === CANCEL ? { ...entry, writes: { attributes: [], spreads: false, children: "from-code" as const } } : entry,
    );
    const proposal = buildProposal(input([record({ scope: "group", anchor: CANCEL }, { children: "Voltar" })], { sightings }));
    expect(changesOf(proposal)[0]?.props[0]?.writtenAs).toBe("expression");
    expect(changesOf(proposal)[0]?.askFirst).toEqual(["Text is written as an expression"]);
    expect(proposalText(proposal)).not.toContain("undefined");
  });
});
