import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import type { OverrideRecord } from "../runtime/store.js";
import type { CallSiteWrites } from "../writes.js";
import { buildProposal, buildProposalKeyed, ordinal, type ProposalInput, type Sighting, setOnKey, toJson } from "./build.js";
import { locationInWords, proposalMarkdown, REPORT_LINE } from "./markdown.js";
import { HOW_TO_APPLY, type Proposal } from "./types.js";

// A Membros page, as the Toolbar would have seen it: four member rows, each with a
// menu trigger Button, a remove dialog, and a role Badge rendered on the server.

const ROUTE = "/org/acme/configuracoes/membros";
const FILE = "apps/app/components/product/member-row-menu.tsx";
const TRIGGER = `${FILE} › MemberRowMenu › Button[1]`;
const CONFIRM = `${FILE} › MemberRowMenu › Button[2]`;
const DIALOG = `${FILE} › MemberRowMenu › AlertDialog[1]`;
const CANCEL = `${FILE} › MemberRowMenu › AlertDialogCancel[1]`;
const INVITE = "apps/app/app/membros/page-client.tsx › MembersHeader › Button[1]";
const BADGE = "apps/app/app/membros/page.tsx › MembersTable › Badge[1]";

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
        id: `${TRIGGER}#${user}`,
        anchor: TRIGGER,
        component: "Button",
        hint: `${FILE}:80:13 1/2`,
        keyPath: user,
        current: { variant: index === 3 ? "secondary" : "ghost", size: "icon" },
        writes: { attributes: [{ name: "variant", writtenAs: "expression", expression: "isSelf ? \"secondary\" : \"ghost\"" }, { name: "size", writtenAs: "literal" }], spreads: false, children: "elements" },
      }),
    ),
    sighting({
      id: `${CONFIRM}#user_2`,
      anchor: CONFIRM,
      component: "Button",
      hint: `${FILE}:120:9 2/2`,
      keyPath: "user_2",
      current: { variant: "destructive" },
      writes: literal("variant"),
      mounted: false,
    }),
    sighting({
      id: `${DIALOG}#user_2`,
      anchor: DIALOG,
      component: "AlertDialog",
      hint: `${FILE}:100:5 1/1`,
      keyPath: "user_2",
      current: { open: false },
      writes: { attributes: [{ name: "open", writtenAs: "expression", expression: "open" }, { name: "onOpenChange", writtenAs: "expression", expression: "setOpen" }], spreads: false, children: "elements" },
      stateProps: ["open"],
    }),
    sighting({
      id: `${CANCEL}#user_2`,
      anchor: CANCEL,
      component: "AlertDialogCancel",
      hint: `${FILE}:118:9 1/1`,
      keyPath: "user_2",
      current: { children: "Cancelar" },
      writes: { attributes: [], spreads: false, children: "text" },
    }),
    sighting({
      id: INVITE,
      anchor: INVITE,
      component: "Button",
      hint: "apps/app/app/membros/page-client.tsx:30:7 1/1",
      current: { variant: "default" },
      writes: literal("variant"),
    }),
    sighting({
      id: `${BADGE}#user_1`,
      anchor: BADGE,
      component: "Badge",
      rendered: "server",
      keyPath: "user_1",
      hint: "apps/app/app/membros/page.tsx:44:11 1/1",
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

function input(records: OverrideRecord[], overrides: Partial<ProposalInput> = {}): ProposalInput {
  return {
    title: "Quieter member menus",
    createdAt: "2026-11-12T10:00:00.000Z",
    project: { repo: "orbix-ai", commit: "0123456789abcdef", dirty: true, playgroundVersion: "0.0.2" },
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
    expect(proposal.howToApply).toBe(HOW_TO_APPLY);
  });

  it("flags a left-out Instance of a call-site change as needing a condition", () => {
    const proposal = buildProposal(
      input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [`${TRIGGER}#user_4`] })]),
    );
    const [change] = changesOf(proposal);
    expect(change?.needsCondition).toBe("Left out: 1 (user_4), needs a condition");
    expect(change?.instances.find((instance) => instance.keyPath === "user_4")?.included).toBe(false);
    // The left-out Instance's value doesn't count towards Current.
    expect(change?.props[0]).toMatchObject({ name: "size", current: "icon", writtenAs: "literal" });
  });

  it("flags one Instance of a repeated call site, and not the only one of a single call site", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: `${TRIGGER}#user_3` }, { variant: "outline" }),
        record({ scope: "instance", id: INVITE }, { variant: "secondary" }),
      ]),
    );
    const [repeated, single] = changesOf(proposal);
    expect(repeated?.needsCondition).toBe("1 of 4 from this call site (user_3), needs a condition");
    expect(repeated?.props[0]).toMatchObject({ current: "ghost", proposed: "outline" });
    expect(single?.needsCondition).toBeNull();
    expect(single?.props[0]).toMatchObject({ current: "default", proposed: "secondary", writtenAs: "literal" });
  });

  it("lists every call site a page change reached, the server-rendered ones apart, and who wins over it", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: `${TRIGGER}#user_1` }, { size: "lg" }),
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
    expect(badge?.serverRendered).toEqual([{ id: `${BADGE}#user_1`, anchor: BADGE, keyPath: "user_1" }]);
    expect(badge?.callSites).toEqual([]);
    expectValid(proposal);
  });

  it("records label text as an ordinary children entry, written as a literal", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: CANCEL }, { children: "Voltar" })]));
    expect(changesOf(proposal)[0]?.props).toEqual([
      { name: "children", current: "Cancelar", proposed: "Voltar", writtenAs: "literal" },
    ]);
    expect(proposalMarkdown(proposal)).toContain("Text: 'Cancelar' → 'Voltar'");
  });

  it("puts a State prop under States shown, not under changes", () => {
    const proposal = buildProposal(input([record({ scope: "instance", id: `${DIALOG}#user_2` }, { open: true })]));
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
          { scope: "instance", id: `${CONFIRM}#user_2` },
          { variant: undefined },
          { suspended: { reason: "ambiguous", ids: [`${CONFIRM}#user_2`] } },
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
        detail: `Matches more than one Instance, review: ${CONFIRM}#user_2`,
        props: [{ name: "variant", proposedUnset: true }],
      },
    ]);
    expectValid(proposal);
  });

  it("flags a change with no Instance mounted, its Current value as last seen", () => {
    const proposal = buildProposal(input([record({ scope: "instance", id: `${CONFIRM}#user_2` }, { variant: "default" })]));
    const [change] = changesOf(proposal);
    expect(change?.onScreenAtExport).toBe(false);
    expect(change?.props[0]).toMatchObject({ current: "destructive", proposed: "default" });
    expect(proposalMarkdown(proposal)).toContain("not on screen at export");
  });

  it("keeps a record that was never seen, as a call site with no total", () => {
    const anchor = `${FILE} › MemberRowMenu › DropdownMenuItem[3]`;
    const proposal = buildProposal(input([record({ scope: "group", anchor }, { variant: "destructive" })]));
    const [change] = changesOf(proposal);
    expect(change?.callSites[0]).toMatchObject({ nth: 3, total: null, lineHint: null, component: "DropdownMenuItem" });
    expect(change?.props[0]).toEqual({ name: "variant", proposed: "destructive", writtenAs: "unknown" });
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

  it("carries the context: commit, dirty tree, URL, viewport, theme and flags", () => {
    const proposal = buildProposal(input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" })], { designer: "  " }));
    expect(proposal.project).toEqual({ repo: "orbix-ai", commit: "0123456789abcdef", dirty: true, playgroundVersion: "0.0.2" });
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
    const records = [record({ scope: "group", anchor: TRIGGER }, { variant: "outline" }, { excluded: [`${TRIGGER}#user_4`] })];
    const before = structuredClone(records);
    buildProposal(input(records));
    expect(records).toEqual(before);
  });
});

describe("Snapshots in a Proposal (PER-138)", () => {
  const pair = (name: string, failedImages = 0) => ({
    before: `data:image/webp;base64,${name}-before`,
    after: `data:image/webp;base64,${name}-after`,
    failedImages,
  });
  const group = record({ scope: "group", anchor: TRIGGER }, { size: "sm" });
  const invite = record({ scope: "instance", id: INVITE }, { variant: "ghost" });

  it("gives each image an id, puts the viewport pair on its route and links each crop from its change", () => {
    const proposal = buildProposal(
      input([group, invite], {
        snapshots: [
          {
            route: ROUTE,
            viewport: pair("v1"),
            crops: [
              { ...pair("c-trigger"), change: setOnKey(group.target), keyPath: null, more: 0 },
              { ...pair("c-invite"), change: setOnKey(invite.target), keyPath: null, more: 0 },
            ],
          },
          {
            route: ROUTE,
            size: [1280, 800],
            dpr: 2,
            viewport: pair("v2", 1),
            crops: [{ ...pair("c-tall", 1), change: setOnKey(group.target), keyPath: "user_4", more: 2 }],
          },
        ],
      }),
    );
    expectValid(proposal);
    const [route] = proposal.routes;
    expect(route?.screenshots.map((shot) => [shot.id, shot.kind, shot.caption])).toEqual([
      ["s1", "viewport", `Screen 1: ${ROUTE}`],
      ["s2", "crop", "c1: size on 1st of 2 <Button> in MemberRowMenu, every Instance, screen 1"],
      ["s3", "crop", "c2: variant on 1st of 1 <Button> in MembersHeader, screen 1"],
      ["s4", "viewport", `Screen 2: ${ROUTE}, 1280×800 at 2x (1 image could not be captured, shown as a placeholder)`],
      [
        "s5",
        "crop",
        "c1: size on 1st of 2 <Button> in MemberRowMenu, every Instance, Instance user_4 (+2 more), screen 2 (1 image could not be captured, shown as a placeholder)",
      ],
    ]);
    expect(route?.screenshots[1]).toMatchObject({ before: "data:image/webp;base64,c-trigger-before", after: "data:image/webp;base64,c-trigger-after" });
    expect(changesOf(proposal).map((change) => [change.id, change.screenshots])).toEqual([
      ["c1", ["s2", "s5"]],
      ["c2", ["s3"]],
    ]);
  });

  it("drops a crop whose change is gone, and leaves an entry with none as without a screenshot", () => {
    const proposal = buildProposal(
      input([invite], {
        snapshots: [
          {
            route: ROUTE,
            viewport: pair("v1"),
            crops: [{ ...pair("gone"), change: setOnKey(group.target), keyPath: null, more: 0 }],
          },
        ],
      }),
    );
    expect(proposal.routes[0]?.screenshots.map((shot) => shot.id)).toEqual(["s1"]);
    expect(changesOf(proposal)[0]?.screenshots).toEqual([]);
  });

  it("files a viewport pair from a route with no changes under the first change it cropped", () => {
    const proposal = buildProposal(
      input([group], {
        setOn: { [setOnKey(group.target)]: ROUTE },
        snapshots: [
          {
            route: "/org/acme/configuracoes/organizacao",
            viewport: pair("elsewhere"),
            crops: [{ ...pair("c"), change: setOnKey(group.target), keyPath: null, more: 0 }],
          },
          { route: "/nowhere", viewport: pair("dropped"), crops: [] },
        ],
      }),
    );
    expect(proposal.routes.map((route) => route.route)).toEqual([ROUTE]);
    expect(proposal.routes[0]?.screenshots.map((shot) => [shot.id, shot.caption])).toEqual([
      ["s1", "Screen 1: /org/acme/configuracoes/organizacao"],
      ["s2", "c1: size on 1st of 2 <Button> in MemberRowMenu, every Instance, screen 1"],
    ]);
  });
});

describe("the published schema", () => {
  it("accepts a Proposal with every scope, label text, a State prop and held records", () => {
    const proposal = buildProposal(
      input(
        [
          record({ scope: "instance", id: `${TRIGGER}#user_3` }, { variant: "outline" }),
          record({ scope: "instance", id: `${DIALOG}#user_2` }, { open: true }),
          record({ scope: "group", anchor: CANCEL }, { children: "Voltar" }),
          record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [`${TRIGGER}#user_4`] }),
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
    expect(validate({ ...proposal, formatVersion: 2 })).toBe(false);
    expect(validate({ ...proposal, title: "" })).toBe(false);
    const [route] = proposal.routes;
    const change = route?.changes[0];
    const broken = { ...proposal, routes: [{ ...route, changes: [{ ...change, props: [{ name: "size", writtenAs: "literal" }] }] }] };
    expect(validate(broken)).toBe(false);
    expect(validate({ ...proposal, extra: true })).toBe(false);
  });
});

describe("Copy as Markdown", () => {
  it("is a short summary fit for a ticket", () => {
    const proposal = buildProposal(
      input([
        record({ scope: "instance", id: `${TRIGGER}#user_3` }, { variant: "outline" }),
        record({ scope: "instance", id: `${DIALOG}#user_2` }, { open: true }),
        record({ scope: "group", anchor: INVITE }, { variant: "ghost" }, { suspended: { reason: "code-changed", anchor: INVITE, was: 1, now: 2 } }),
      ]),
    );
    expect(proposalMarkdown(proposal)).toBe(
      [
        "## Quieter member menus",
        "",
        `http://localhost:3131${ROUTE}?tab=ativos`,
        "orbix-ai@0123456 (uncommitted changes)",
        "",
        `- c1. 1st of 2 \`<Button>\` in \`MemberRowMenu\` (member-row-menu.tsx), Instance user_3: \`variant\`: "ghost" → "outline" (written as an expression: \`isSelf ? "secondary" : "ghost"\`) · **1 of 4 from this call site (user_3), needs a condition**`,
        "- State shown: `open` held at true on `<AlertDialog>`, Instance user_2 (the app controls it via `onOpenChange`). Context, not a change.",
        "",
        `- Held for review, do not apply: \`<Button>\` at ${INVITE} (\`variant\`). Code changed here, review: this call site had 1 use and now has 2.`,
        "",
        REPORT_LINE,
        "",
      ].join("\n"),
    );
  });

  it("names a page change by each call site it reached", () => {
    const proposal = buildProposal(input([record({ scope: "page", route: ROUTE, component: "Button" }, { size: "sm" })]));
    const line = proposalMarkdown(proposal).split("\n").find((entry) => entry.startsWith("- c1."));
    expect(line).toContain("Every `<Button>` on the page (3 call sites:");
  });
});

describe("helpers", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st",
    ]);
  });

  it("keeps JSON as it is and shows anything else as the Toolbar does", () => {
    expect(toJson({ a: [1, "x", null] })).toEqual({ a: [1, "x", null] });
    expect(toJson(function onSelect() {})).toBe("ƒ onSelect()");
    expect(toJson(Number.NaN)).toBe("NaN");
  });

  it("says where a call site is in words", () => {
    expect(
      locationInWords({ path: FILE, enclosing: "MemberRowMenu", component: "Button", nth: 3, total: 4, anchor: "", lineHint: null }),
    ).toBe("3rd of 4 `<Button>` in `MemberRowMenu` (member-row-menu.tsx)");
  });
});

describe("what the page last showed", () => {
  it("counts only the mounted Instances while any is mounted, and keeps a left-out one that isn't", () => {
    const old = USERS.map((user) =>
      sighting({ id: `${TRIGGER}#old_${user}`, anchor: TRIGGER, component: "Button", keyPath: `old_${user}`, current: { size: "lg" }, mounted: false }),
    );
    const proposal = buildProposal(
      input([record({ scope: "group", anchor: TRIGGER }, { size: "sm" }, { excluded: [`${TRIGGER}#old_user_1`] })], {
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

  it("survives a value that refers to itself", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(toJson(cyclic)).toEqual({ a: 1, self: "[Circular]" });
    expect(toJson({ left: [1], right: [1] })).toEqual({ left: [1], right: [1] });
  });

  it("says a value comes from code even when there is no expression text", () => {
    const sightings = membros().map((entry) =>
      entry.anchor === CANCEL ? { ...entry, writes: { attributes: [], spreads: false, children: "from-code" as const } } : entry,
    );
    const proposal = buildProposal(input([record({ scope: "group", anchor: CANCEL }, { children: "Voltar" })], { sightings }));
    expect(changesOf(proposal)[0]?.props[0]?.writtenAs).toBe("expression");
    const markdown = proposalMarkdown(proposal);
    expect(markdown).toContain("(written as an expression)");
    expect(markdown).not.toContain("undefined");
  });
});
