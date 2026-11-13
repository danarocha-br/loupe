// @vitest-environment jsdom
// jsdom replaces the global URL, so the schema is found with Node's.
import { readFileSync } from "node:fs";
import { URL as NodeUrl } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { callSiteId, instanceId } from "../call-site.js";
import { proposalReport, REPORT_DATA_ID, reportFileName } from "./report.js";
import { HOW_TO_APPLY, type Proposal } from "./types.js";

// A Membros Proposal as an engineer would receive it: one change of each scope,
// a label text change, a State shown, a held record, a second route and Snapshots.

const ROUTE = "/org/acme/configuracoes/membros";
const FILE = "apps/app/components/product/member-row-menu.tsx";
const siteAt = (path: string, enclosing: string, component: string, ordinal = 1) =>
  callSiteId({ path, enclosing, component, ordinal });
const TRIGGER = siteAt(FILE, "MemberRowMenu", "Button");
const shot = (id: string, kind: "viewport" | "crop", caption: string) => ({
  id,
  kind,
  caption,
  before: `data:image/webp;base64,${id}-before`,
  after: `data:image/webp;base64,${id}-after`,
});

function sample(): Proposal {
  return {
    formatVersion: 1,
    title: "Quieter member menus",
    createdAt: "2026-11-12T10:31:00.000Z",
    designer: "Dana",
    project: { repo: "orbix-ai", commit: "0123456789abcdef", dirty: true, playgroundVersion: "0.0.3" },
    howToApply: HOW_TO_APPLY,
    routes: [
      {
        url: `http://localhost:3131${ROUTE}?tab=ativos`,
        route: ROUTE,
        viewport: [1440, 900],
        dpr: 2,
        theme: "dark",
        flags: { "new-roles": true },
        capturedAt: "2026-11-12T10:30:00.000Z",
        changes: [
          {
            id: "c1",
            scope: "call-site",
            component: "Button",
            origin: null,
            callSites: [
              { path: FILE, enclosing: "MemberRowMenu", component: "Button", nth: 1, total: 2, anchor: TRIGGER, lineHint: "80:13" },
            ],
            props: [
              {
                name: "variant",
                currentCounts: { '"ghost"': 3, '"secondary"': 1 },
                proposed: "outline",
                writtenAs: "expression",
                expression: 'isSelf ? "secondary" : "ghost"',
              },
              { name: "size", current: "icon", proposed: "sm", writtenAs: "literal" },
            ],
            instances: [
              { id: instanceId(TRIGGER, "user_1"), keyPath: "user_1", included: true, onScreenAtExport: true },
              { id: instanceId(TRIGGER, "user_2"), keyPath: "user_2", included: true, onScreenAtExport: true },
              { id: instanceId(TRIGGER, "user_4"), keyPath: "user_4", included: false, onScreenAtExport: true },
            ],
            needsCondition: "Left out: 1 (user_4), needs a condition",
            serverRendered: [],
            overriddenBy: ["c2"],
            alsoRendersOn: ["/org/acme/configuracoes/organizacao"],
            onScreenAtExport: true,
            note: "Rows feel heavy </script><script>window.pwned = true</script>",
            screenshots: ["s2"],
          },
          {
            id: "c2",
            scope: "instance",
            component: "AlertDialogCancel",
            origin: null,
            callSites: [
              {
                path: FILE,
                enclosing: "MemberRowMenu",
                component: "AlertDialogCancel",
                nth: 1,
                total: 1,
                anchor: siteAt(FILE, "MemberRowMenu", "AlertDialogCancel"),
                lineHint: "118:9",
              },
            ],
            props: [{ name: "children", current: "Cancelar", proposed: "Voltar", writtenAs: "literal" }],
            instances: [{ id: instanceId("x", "user_2"), keyPath: "user_2", included: true, onScreenAtExport: false }],
            needsCondition: null,
            serverRendered: [],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: false,
            note: null,
            screenshots: [],
          },
          {
            id: "c3",
            scope: "page",
            component: "Badge",
            origin: null,
            callSites: [
              { path: "apps/app/settings-header.tsx", enclosing: "SettingsHeader", component: "Badge", nth: 1, total: 2, anchor: siteAt("a", "SettingsHeader", "Badge", 1), lineHint: "80:13" },
              { path: "apps/app/settings-header.tsx", enclosing: "SettingsHeader", component: "Badge", nth: 2, total: 2, anchor: siteAt("a", "SettingsHeader", "Badge", 2), lineHint: null },
            ],
            props: [
              {
                name: "variant",
                current: "secondary",
                proposedUnset: true,
                writtenAs: "varies",
                perCallSite: [
                  { anchor: siteAt("a", "SettingsHeader", "Badge", 1), writtenAs: "literal" },
                  { anchor: siteAt("a", "SettingsHeader", "Badge", 2), writtenAs: "expression", expression: "tone" },
                ],
              },
            ],
            instances: [],
            needsCondition: null,
            serverRendered: [{ id: instanceId("b", "user_1"), anchor: siteAt("apps/app/membros/page.tsx", "MembersTable", "Badge"), keyPath: "user_1" }],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: true,
            note: null,
            screenshots: [],
          },
        ],
        statesShown: [
          {
            anchor: siteAt(FILE, "MemberRowMenu", "AlertDialog"),
            component: "AlertDialog",
            keyPath: "user_2",
            prop: "open",
            forced: true,
            controlled: true,
            appControlsVia: "onOpenChange",
            onScreenAtExport: true,
          },
        ],
        screenshots: [
          shot("s1", "viewport", `Screen 1: ${ROUTE}`),
          shot("s2", "crop", "c1: variant, size on 1st of 2 <Button> in MemberRowMenu, every Instance, screen 1"),
        ],
      },
      {
        url: null,
        route: "/org/acme/configuracoes/organizacao",
        viewport: null,
        dpr: null,
        theme: null,
        flags: {},
        capturedAt: null,
        changes: [],
        statesShown: [],
        screenshots: [],
      },
    ],
    heldForReview: [
      {
        scope: "call-site",
        component: "Button",
        anchor: siteAt("apps/app/membros/page-client.tsx", "MembersHeader", "Button"),
        route: ROUTE,
        reason: "code-changed",
        detail: "Code changed here, review: this call site had 1 use and now has 2",
        props: [{ name: "variant", proposed: "ghost" }],
      },
    ],
  };
}

const schema = JSON.parse(readFileSync(new NodeUrl("../../proposal.schema.json", import.meta.url), "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats.default(ajv);
const validate = ajv.compile(schema);

type Frame = Window & typeof globalThis & { pwned?: boolean };
type Opened = { win: Frame; doc: Document; downloads: { name: string; text: Promise<string> }[] };

/** Opens the report as a browser would, scripts and all, in a frame that catches downloads. */
function open(html: string): Opened {
  const downloads: Opened["downloads"] = [];
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const win = frame.contentWindow as Frame;
  const blobs = new Map<string, Blob>();
  win.URL.createObjectURL = (blob: Blob) => {
    const url = `blob:report/${blobs.size}`;
    blobs.set(url, blob);
    return url;
  };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (!blob) return;
    // jsdom's Blob has no text(): read it as a page would.
    const text = new Promise<string>((resolve) => {
      const reader = new win.FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    downloads.push({ name: this.download, text });
  };
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();
  return { win, doc, downloads };
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("the HTML report", () => {
  it("embeds the changes file, which parses back to the Proposal and passes the published schema", () => {
    const proposal = sample();
    const { doc } = open(proposalReport(proposal));
    const embedded = doc.getElementById(REPORT_DATA_ID);
    expect(embedded?.getAttribute("type")).toBe("application/json");
    const parsed = JSON.parse(embedded?.textContent ?? "");
    expect(parsed).toEqual(proposal);
    expect(validate(parsed)).toBe(true);
  });

  it("keeps text from the session as text: a note can't close the data block or run a script", () => {
    const { win, doc } = open(proposalReport(sample()));
    expect(win.pwned).toBeUndefined();
    expect(doc.querySelectorAll("script")).toHaveLength(2);
    expect(text(doc.querySelector('[data-change="c1"] .note'))).toContain("Rows feel heavy </script><script>window.pwned = true</script>");
  });

  it("downloads the changes file on its own, exactly as embedded", async () => {
    const proposal = sample();
    const { doc, downloads } = open(proposalReport(proposal, { fileName: "proposal-quieter-member-menus-20261112-1031.html" }));
    (doc.querySelector("[data-download-json]") as HTMLButtonElement).click();
    expect(downloads.map((download) => download.name)).toEqual(["proposal-quieter-member-menus-20261112-1031.json"]);
    // The file itself is plain JSON: `<Button>` reads as written, not as the block's escape.
    expect(await downloads[0]?.text).toBe(`${JSON.stringify(proposal, null, 2)}\n`);
  });

  it("escapes every field that came from the session, not only the note", () => {
    const proposal = sample();
    proposal.title = "<img src=x onerror=window.pwned=1>";
    proposal.designer = "<b>Dana</b>";
    proposal.createdAt = "<i>not a date</i>";
    const change = proposal.routes[0]?.changes[0];
    const prop = change?.props[0];
    if (!change || !prop) throw new Error("sample changed");
    prop.expression = "a < b && <script>window.pwned=1</script>";
    (change.callSites[0] as { anchor: string }).anchor = siteAt("x", "<svg onload=window.pwned=1>", "Button");
    const { win, doc } = open(proposalReport(proposal));
    expect(win.pwned).toBeUndefined();
    expect(doc.querySelectorAll("img:not([data-shot]), b, i, svg")).toHaveLength(0);
    expect(text(doc.querySelector("h1"))).toBe("<img src=x onerror=window.pwned=1>");
    expect(text(doc.querySelector("header"))).toContain("<i>not a date</i>");
  });

  it("orders its sections as PER-99 lays them out", () => {
    const { doc } = open(proposalReport(sample()));
    expect([...doc.querySelectorAll("main > section > h2")].map(text)).toEqual([
      "Proposed changes",
      "States shown",
      "Held for review, do not apply",
      "Screens",
      "How to apply",
    ]);
  });

  it("heads the report with the title, designer, date and commit, and warns about a dirty tree", () => {
    const { doc } = open(proposalReport(sample()));
    expect(text(doc.querySelector("h1"))).toBe("Quieter member menus");
    const header = text(doc.querySelector("header"));
    expect(header).toContain("Dana");
    expect(header).toContain("2026-11-12 10:31 UTC");
    expect(header).toContain("orbix-ai@0123456");
    expect(header).toContain("uncommitted changes");
    expect(header).toContain("Loupe 0.0.3");
    expect(header).toContain("3 changes · 1 State shown · 1 held for review");
  });

  it("says where each change is, in words and as an anchor, with the line as a hint", () => {
    const { doc } = open(proposalReport(sample()));
    const c1 = doc.querySelector('[data-change="c1"]');
    expect(text(c1?.querySelector(".where"))).toContain("1st of 2 <Button> in MemberRowMenu");
    expect(text(c1)).toContain(FILE);
    expect(text(c1)).toContain(TRIGGER);
    expect(text(c1)).toContain("line 80:13 at export, a hint");
    expect(text(c1?.querySelector(".scope"))).toBe("Every Instance at this call site");
    const c3 = doc.querySelector('[data-change="c3"]');
    expect(text(c3?.querySelector(".scope"))).toBe("Every <Badge> on the page: 2 call sites");
    expect(c3?.querySelectorAll(".where li")).toHaveLength(2);
  });

  it("shows each prop as Current → proposed, and whether it's fixed in source or computed", () => {
    const { doc } = open(proposalReport(sample()));
    const rows = (id: string) =>
      [...doc.querySelectorAll(`[data-change="${id}"] tbody tr`)].map((row) => [...row.querySelectorAll("td, th")].map(text));
    expect(rows("c1")).toEqual([
      ["variant", '"ghost" ×3, "secondary" ×1', '"outline"', 'Computed by app logic: isSelf ? "secondary" : "ghost"'],
      ["size", '"icon"', '"sm"', "Fixed in source: a one-line edit"],
    ]);
    expect(rows("c2")).toEqual([["Text", "'Cancelar'", "'Voltar'", "Fixed in source: a one-line edit"]]);
    expect(rows("c3")).toEqual([
      ["variant", '"secondary"', "Not set (remove it)", "Differs per call site: Badge[1] fixed in source: a one-line edit; Badge[2] computed by app logic: tone"],
    ]);
  });

  it("flags a needed condition and lists the Instances covered, left out and not previewed", () => {
    const { doc } = open(proposalReport(sample()));
    const c1 = doc.querySelector('[data-change="c1"]');
    expect(text(c1?.querySelector(".condition"))).toBe("Needs a condition: Left out: 1 (user_4), needs a condition");
    expect(text(c1?.querySelector(".instances"))).toContain("Covers 2: user_1, user_2");
    expect(text(c1?.querySelector(".instances"))).toContain("Left out 1: user_4");
    expect(text(c1)).toContain("Overridden by c2 on some Instances");
    expect(text(c1)).toContain("Also renders on /org/acme/configuracoes/organizacao");
    const c3 = doc.querySelector('[data-change="c3"]');
    expect(text(c3?.querySelector(".instances"))).toContain("Not previewed (server-rendered) 1: user_1");
    expect(text(doc.querySelector('[data-change="c2"]'))).toContain("Not on screen at export: Current values are as last seen");
    expect(text(doc.querySelector('[data-change="c3"] .instances'))).toBe("Not previewed (server-rendered) 1: user_1");
  });

  it("lists no key paths when the Instances have none", () => {
    const proposal = sample();
    const instance = proposal.routes[0]?.changes[1]?.instances[0];
    if (!instance) throw new Error("sample changed");
    instance.keyPath = "";
    const { doc } = open(proposalReport(proposal));
    expect(text(doc.querySelector('[data-change="c2"] .instances'))).toBe("Covers 1");
  });

  it("shows a change's crop pair, or says it has none", () => {
    const { doc } = open(proposalReport(sample()));
    const images = [...doc.querySelectorAll('[data-change="c1"] img')] as HTMLImageElement[];
    expect(images.map((image) => image.getAttribute("src"))).toEqual(["data:image/webp;base64,s2-before", "data:image/webp;base64,s2-after"]);
    expect(images.map((image) => image.alt)).toEqual([
      "Before: c1: variant, size on 1st of 2 <Button> in MemberRowMenu, every Instance, screen 1",
      "After: c1: variant, size on 1st of 2 <Button> in MemberRowMenu, every Instance, screen 1",
    ]);
    expect(text(doc.querySelector('[data-change="c2"] .shots'))).toBe("No screenshot: not captured on this route.");
  });

  it("lists States shown as context, and held records as not to apply", () => {
    const { doc } = open(proposalReport(sample()));
    const states = text(doc.querySelector("#states"));
    expect(states).toContain("open held at true on <AlertDialog>, Instance user_2");
    expect(states).toContain("the app controls it via onOpenChange");
    const held = text(doc.querySelector("#held"));
    expect(held).toContain("Do not apply");
    expect(held).toContain("Code changed here, review: this call site had 1 use and now has 2");
    expect(held).toContain('variant → "ghost"');
  });

  it("identifies each screen by URL, viewport, density, theme, flags and the states held on it", () => {
    const { doc } = open(proposalReport(sample()));
    const screen = doc.querySelector(`[data-route="${ROUTE}"]`);
    const context = text(screen?.querySelector(".context"));
    expect(context).toContain(`http://localhost:3131${ROUTE}?tab=ativos`);
    expect(context).toContain("1440×900 CSS px at 2x");
    expect(context).toContain("dark theme");
    expect(context).toContain("Flags previewed: new-roles = true");
    expect(context).toContain("States held: open = true on <AlertDialog> (user_2)");
    const viewport = [...(screen?.querySelectorAll("img") ?? [])] as HTMLImageElement[];
    expect(viewport.map((image) => image.getAttribute("src"))).toEqual(["data:image/webp;base64,s1-before", "data:image/webp;base64,s1-after"]);
    const other = text(doc.querySelector('[data-route="/org/acme/configuracoes/organizacao"]'));
    expect(other).toContain("No screen captured on this route.");
  });

  it("states the counting rule", () => {
    const { doc } = open(proposalReport(sample()));
    expect(text(doc.querySelector("#apply"))).toContain(HOW_TO_APPLY);
  });

  it("names the file after the title and the local time", () => {
    expect(reportFileName("Quieter member menus: Membros!", new Date(2026, 10, 12, 9, 5))).toBe(
      "proposal-quieter-member-menus-membros-20261112-0905.html",
    );
    expect(reportFileName("Ação rápida", new Date(2026, 0, 2, 23, 59))).toBe("proposal-acao-rapida-20260102-2359.html");
    expect(reportFileName("!!!", new Date(2026, 0, 2, 23, 59))).toBe("proposal-20260102-2359.html");
  });
});
