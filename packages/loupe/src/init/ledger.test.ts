import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stampModule } from "../generate/header.js";
import {
  claimOf,
  type FileEntry,
  formatTooNew,
  judgeLayerFile,
  judgeTouchPoint,
  LEDGER_PATH,
  type Ledger,
  LedgerError,
  readLedger,
  recordAccepted,
  saveLedger,
  serialiseLedger,
  type TouchPointEntry,
} from "./ledger.js";
import { fileHash, sha256 } from "./syntax.js";
import { type TouchPoint, touchPoints } from "./touch-points.js";

// The ledger module reads files but never runs git, so a plain tmp dir is enough.

const APP = "apps/web";
const PKG = `${APP}/package.json`;
const OURS = { "@danarocha/loupe": "0.0.4", "@repo/loupe": "workspace:*" };

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function repo(files: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "loupe-ledger-"));
  roots.push(root);
  for (const [file, text] of Object.entries(files)) write(root, file, text);
  return root;
}

function write(root: string, file: string, text: string): void {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
}

const packageJson = (dev: Record<string, string>) => `${JSON.stringify({ name: "web", devDependencies: dev }, null, 2)}\n`;

function packageJsonPoint(root: string): TouchPoint {
  const tp = touchPoints({ root, app: APP, version: "0.0.4", workspaceProtocol: "workspace:*" }).find((t) => t.id === "package-json");
  if (!tp) throw new Error("no package-json touch point");
  return tp;
}

/** The hash init records for Loupe's two devDependencies, as written. */
function recorded(dev: Record<string, string>): string {
  const found = packageJsonPoint(repo()).find(packageJson(dev));
  if (!found) throw new Error("no Loupe edit in that package.json");
  return sha256(found.canonical);
}

const auto = (hash: string): TouchPointEntry => ({ id: "package-json", file: PKG, mode: "auto", sha256: hash });
const manual: TouchPointEntry = { id: "package-json", file: PKG, mode: "manual", sha256: null };

describe("judgeTouchPoint", () => {
  type Case = {
    name: string;
    file: string | undefined;
    entry: () => TouchPointEntry | undefined;
    kind: string;
    exact?: boolean;
    found?: boolean;
  };
  const cases: Case[] = [
    { name: "nothing recorded, no Loupe edit", file: packageJson({ react: "19.2.0" }), entry: () => undefined, kind: "not-loupes" },
    { name: "nothing recorded, no file", file: undefined, entry: () => undefined, kind: "not-loupes" },
    { name: "nothing recorded, exactly init's edit", file: packageJson(OURS), entry: () => undefined, kind: "unclaimed", exact: true },
    {
      name: "nothing recorded, a Loupe edit init didn't write",
      file: packageJson({ ...OURS, "@danarocha/loupe": "0.0.3" }),
      entry: () => undefined,
      kind: "unclaimed",
      exact: false,
    },
    { name: "a manual step, made", file: packageJson(OURS), entry: () => manual, kind: "pending", found: true },
    { name: "a manual step, not made", file: packageJson({}), entry: () => manual, kind: "pending", found: false },
    { name: "recorded and unchanged", file: packageJson(OURS), entry: () => auto(recorded(OURS)), kind: "intact" },
    {
      name: "recorded, then changed by hand",
      file: packageJson({ ...OURS, "@repo/loupe": "workspace:^" }),
      entry: () => auto(recorded(OURS)),
      kind: "drift",
    },
    { name: "recorded, the edit taken out", file: packageJson({ react: "19.2.0" }), entry: () => auto(recorded(OURS)), kind: "missing" },
    { name: "recorded, the file deleted", file: undefined, entry: () => auto(recorded(OURS)), kind: "missing" },
  ];

  it.each(cases)("$name: $kind", ({ file, entry, kind, exact, found }) => {
    const root = repo(file === undefined ? {} : { [PKG]: file });
    const verdict = judgeTouchPoint(root, entry(), packageJsonPoint(root));
    expect(verdict.kind).toBe(kind);
    if (verdict.kind === "unclaimed") {
      expect(verdict.claim.found.exact).toBe(exact);
      expect(verdict.claim.hash).toBe(sha256(verdict.claim.found.canonical));
    }
    if (verdict.kind === "pending") expect(verdict.claim !== undefined).toBe(found);
    if (verdict.kind !== "unrecognised") expect(verdict.text).toBe(file);
  });

  it("is unrecognised when no touch point answers for an entry whose file is still there", () => {
    const root = repo({ [PKG]: packageJson(OURS) });
    expect(judgeTouchPoint(root, auto(recorded(OURS)), undefined)).toEqual({ kind: "unrecognised" });
  });

  it("is missing when no touch point answers and the file is gone", () => {
    expect(judgeTouchPoint(repo(), auto(recorded(OURS)), undefined)).toEqual({ kind: "missing", text: undefined });
  });

  it("hashes what it found the way init records it, so recording a pending step makes it intact", () => {
    const root = repo({ [PKG]: packageJson(OURS) });
    const tp = packageJsonPoint(root);
    const claim = claimOf(judgeTouchPoint(root, manual, tp));
    if (!claim) throw new Error("expected a pending step with an edit");
    expect(judgeTouchPoint(root, { ...manual, sha256: claim.hash }, tp).kind).toBe("intact");
  });
});

describe("judgeLayerFile", () => {
  const FILE = "packages/loupe/next.js";
  const TEXT = "exports.withLoupe = (config) => config;\n";
  const entry = (text: string): FileEntry => ({ path: "next.js", sha256: fileHash(text) });
  const generated = stampModule("export {};\n");

  type Case = { name: string; file: string | undefined; entry: FileEntry | undefined; kind: string; by?: string };
  const cases: Case[] = [
    { name: "init's file, unchanged", file: TEXT, entry: entry(TEXT), kind: "intact", by: "init" },
    { name: "init's file, line endings changed only", file: TEXT.replace(/\n/g, "\r\n"), entry: entry(TEXT), kind: "intact", by: "init" },
    { name: "init's file, edited", file: `${TEXT}// mine\n`, entry: entry(TEXT), kind: "drift", by: "init" },
    { name: "init's file, deleted", file: undefined, entry: entry(TEXT), kind: "missing" },
    { name: "generate's file, unchanged", file: generated, entry: undefined, kind: "intact", by: "generate" },
    { name: "generate's file, edited", file: `${generated}// mine\n`, entry: undefined, kind: "drift", by: "generate" },
    { name: "a file nobody claims", file: TEXT, entry: undefined, kind: "not-loupes" },
    // The ledger wins over a header: a recorded file is judged by its hash only.
    { name: "a recorded file that also carries a header", file: generated, entry: entry(TEXT), kind: "drift", by: "init" },
  ];

  it.each(cases)("$name: $kind", ({ file, entry, kind, by }) => {
    const root = repo(file === undefined ? {} : { [FILE]: file });
    const verdict = judgeLayerFile(root, FILE, entry);
    expect(verdict.kind).toBe(kind);
    if (verdict.kind === "intact" || verdict.kind === "drift") expect(verdict.by).toBe(by);
    if (verdict.kind !== "missing") expect(verdict.text).toBe(file);
  });
});

describe("reading the ledger", () => {
  it("reads an absent ledger as empty", () => {
    expect(readLedger(repo())).toEqual({});
  });

  it.each([
    ["invalid JSON", "{", "isn't valid JSON"],
    ["an array", "[]", "isn't a Loupe ledger"],
    ["untestedAccepted that isn't a list", '{"untestedAccepted": {}}', "isn't a Loupe ledger"],
  ])("refuses %s", (_name, text, message) => {
    const root = repo({ [LEDGER_PATH]: text });
    expect(() => readLedger(root)).toThrow(LedgerError);
    expect(() => readLedger(root)).toThrow(message);
  });

  it("says a ledger from a newer Loupe can't be read, and accepts its own format or none", () => {
    expect(formatTooNew({ formatVersion: 1 }, "0.0.4")).toBeUndefined();
    expect(formatTooNew({}, "0.0.4")).toBeUndefined();
    expect(formatTooNew({ formatVersion: 2 }, "0.0.4")).toBe(
      `${LEDGER_PATH} has formatVersion 2; this Loupe (0.0.4) reads 1. Upgrade Loupe.`,
    );
  });
});

describe("writing the ledger", () => {
  const ledger: Ledger = {
    touchPoints: [
      { id: "root-layout", file: "apps/web/app/layout.tsx", mode: "auto", sha256: "b" },
      { id: "next-config", file: "apps/web/next.config.ts", mode: "auto", sha256: "a" },
    ],
    loupe: { version: "0.0.4", package: "@danarocha/loupe" },
    formatVersion: 1,
  };

  it("sorts keys and lists, and leaves the file alone when nothing changed", () => {
    const root = repo();
    expect(saveLedger(root, ledger)).toBe(true);
    const text = readFileSync(path.join(root, LEDGER_PATH), "utf8");
    expect(Object.keys(JSON.parse(text))).toEqual(["formatVersion", "loupe", "touchPoints"]);
    expect(JSON.parse(text).touchPoints.map((t: TouchPointEntry) => t.id)).toEqual(["next-config", "root-layout"]);
    expect(saveLedger(root, readLedger(root))).toBe(false);
  });

  it("records the check's yes through the same writer, keeping every other field", () => {
    const root = repo();
    saveLedger(root, ledger);
    const now = new Date("2026-11-13T10:00:00Z");
    recordAccepted(root, [{ app: APP, item: "runtime", seen: "Node 24.1.0" }], now);
    recordAccepted(root, [{ app: APP, item: "runtime", seen: "Node 24.2.0" }], now);

    const text = readFileSync(path.join(root, LEDGER_PATH), "utf8");
    const after = readLedger(root);
    expect(text).toBe(serialiseLedger(after));
    expect(after.touchPoints).toHaveLength(2);
    expect(after.loupe).toEqual(ledger.loupe);
    // A later yes for the same app and item replaces the earlier one.
    expect(after.untestedAccepted).toEqual([
      { app: APP, item: "runtime", seen: "Node 24.2.0", acceptedAt: "2026-11-13T10:00:00.000Z" },
    ]);
  });

  it("gives a ledger the check starts the current formatVersion", () => {
    const root = repo();
    recordAccepted(root, [{ app: APP, item: "bundler", seen: ".babelrc" }], new Date(0));
    expect(readLedger(root).formatVersion).toBe(1);
  });
});
