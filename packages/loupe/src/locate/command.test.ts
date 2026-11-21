import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { callSiteId } from "../call-site.js";
import { run } from "../cli.js";
import { proposalText } from "../proposal/text.js";
import { howToApply, type Proposal } from "../proposal/types.js";
import { parseLocateArgs } from "./command.js";

const ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."));
const APP = path.join(ROOT, "fixture/app");
const MENU = "fixture/app/components/product/member-row-menu.tsx";
const REMOVE = callSiteId({ path: MENU, enclosing: "MemberRowMenu", component: "DropdownMenuItem", ordinal: 2 });

/** The copied text of a Proposal that sets the Remove item's variant. */
function copied(proposed: string, total = 2): string {
  const project = { repo: "loupe", commit: null, dirty: null, playgroundVersion: null, install: { app: "fixture/app", layer: "fixture/app/loupe" } };
  const proposal: Proposal = {
    formatVersion: 2,
    title: "Fixture",
    createdAt: "2026-11-20T10:00:00.000Z",
    designer: null,
    project,
    howToApply: howToApply(project.install),
    routes: [
      {
        url: null,
        route: "/",
        viewport: null,
        dpr: null,
        theme: null,
        flags: { "new-roles": true },
        capturedAt: null,
        changes: [
          {
            id: "c1",
            action: "apply",
            askFirst: [],
            scope: "call-site",
            component: "DropdownMenuItem",
            origin: null,
            callSites: [{ path: MENU, enclosing: "MemberRowMenu", component: "DropdownMenuItem", nth: 2, total, anchor: REMOVE, lineHint: "43:11" }],
            props: [{ name: "variant", current: "destructive", proposed, writtenAs: "literal" }],
            instances: [],
            needsCondition: null,
            serverRendered: [],
            overriddenBy: [],
            alsoRendersOn: [],
            onScreenAtExport: true,
            note: null,
          },
        ],
        statesShown: [],
      },
    ],
    heldForReview: [],
  };
  return proposalText(proposal);
}

/** `loupe locate` run from the fixture app, as the Proposal's rules say, with `text` piped in. */
async function locate(argv: string[], text?: string, cwd = APP) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(["locate", "--out", "loupe", ...argv], {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    cwd,
    read: text === undefined ? undefined : async () => text,
  });
  return { code, out, err };
}

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A copy of the fixture workspace, its Product layer included, to edit on disk; `node_modules` linked back. */
function fixtureCopy(): string {
  const root = mkdtempSync(path.join(tmpdir(), "loupe-locate-"));
  temps.push(root);
  mkdirSync(path.join(root, ".git"));
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - fixture/*\n");
  cpSync(path.join(ROOT, "tsconfig.base.json"), path.join(root, "tsconfig.base.json"));
  for (const pkg of ["fixture/design-system", "fixture/app"]) {
    cpSync(path.join(ROOT, pkg), path.join(root, pkg), { recursive: true, filter: (source) => !/[/\\](node_modules|\.next)$/.test(source) });
    symlinkSync(path.join(ROOT, pkg, "node_modules"), path.join(root, pkg, "node_modules"));
  }
  symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"));
  return root;
}

describe("loupe locate, the command", () => {
  it("reads the copied text on standard input and says where each call site is", async () => {
    const { code, out } = await locate([], copied("default"));
    expect(code).toBe(0);
    expect(out).toEqual([
      "c1 · Apply · <DropdownMenuItem>, every Instance",
      `  ${MENU}:43:11 · 2nd of 2 in MemberRowMenu`,
      '    `variant` → "default" · to do: written "destructive"',
      "Not code changes: 1 Flag preview (Context).",
      "Apply: 0 of 1 in the code. Ask first: 0.",
    ]);
  });

  it("exits 1 with --check until every Apply change is in the code", async () => {
    const pending = await locate(["--check"], copied("default"));
    expect(pending.code).toBe(1);
    expect(pending.out.at(-1)).toBe("Not in the code yet: c1.");
    const done = await locate(["--check"], copied("destructive"));
    expect(done.code).toBe(0);
    expect(done.out).toContain('    `variant` → "destructive" · in the code');
    expect(done.out.at(-1)).toBe("Every Apply change is in the code.");
  });

  it("passes --check once the file on disk writes the proposed value", async () => {
    const root = fixtureCopy();
    const app = path.join(root, "fixture/app");
    const pending = await locate(["--check"], copied("default"), app);
    expect(pending.code).toBe(1);
    expect(pending.out).toContain('    `variant` → "default" · to do: written "destructive"');

    const file = path.join(root, MENU);
    writeFileSync(file, readFileSync(file, "utf8").replace('variant="destructive"\n            disabled', 'variant="default"\n            disabled'));
    const done = await locate(["--check"], copied("default"), app);
    expect(done.out).toContain('    `variant` → "default" · in the code');
    expect(done.out.at(-1)).toBe("Every Apply change is in the code.");
    expect(done.code).toBe(0);
  });

  it("exits 1 when the code around a call site changed, check or not", async () => {
    const { code, out } = await locate([], copied("default", 3));
    expect(code).toBe(1);
    expect(out[1]).toBe(
      `  ${MENU}:43:11 · 2nd of 2 in MemberRowMenu · Code changed here, review: this call site had 3 uses and now has 2. Stop and ask the designer.`,
    );
  });

  it("reads the copied text from a file", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "loupe-locate-")), "proposal.md");
    writeFileSync(file, copied("default"));
    const { code, out } = await locate([file]);
    expect(code).toBe(0);
    expect(out[0]).toBe("c1 · Apply · <DropdownMenuItem>, every Instance");
  });

  it("refuses what isn't a Proposal it can read, and says what to do", async () => {
    const old = copied("default").replace('"formatVersion": 2', '"formatVersion": 1');
    expect((await locate([], old)).err).toEqual([
      "This Proposal is format 1; this Loupe reads format 2. Copy it again with Copy Proposal in the Loupe panel.",
    ]);
    expect((await locate([], "Make the buttons quieter")).err[0]).toMatch(/^No Proposal JSON in this text/);
    const nothing = await locate([]);
    expect(nothing.code).toBe(1);
    expect(nothing.err[0]).toMatch(/^Pass the copied Proposal as a file, or pipe it on standard input/);
  });

  it("says where it looked when the Product layer isn't where --out says", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(["locate"], { out: (line) => out.push(line), err: (line) => err.push(line), cwd: APP, read: async () => copied("default") });
    expect(code).toBe(1);
    expect(err[0]).toMatch(/^No adapt-list\.json at .*packages\/loupe\/adapt-list\.json: pass --out/);
  });

  it("takes one file, --check, --out and --root", () => {
    expect(parseLocateArgs(["a.md", "--check", "--out", "loupe", "--root", ".."])).toEqual({ file: "a.md", check: true, out: "loupe", root: ".." });
    expect(parseLocateArgs(["-"])).toEqual({ check: false });
    expect(parseLocateArgs(["a.md", "b.md"])).toBe("One Proposal at a time: a.md and b.md");
    expect(parseLocateArgs(["--json"])).toBe("Unknown option: --json");
    expect(parseLocateArgs(["--out"])).toBe("Missing value for --out");
  });
});
