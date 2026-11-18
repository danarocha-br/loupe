import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LEDGER, LOUPE_PACKAGE, LOUPE_VERSION } from "../scripts/pin.mjs";
import { RESULTS, bump, compareVersions, plainVersion, render, setDependency, upgradeFacts, verdict } from "../scripts/upgrade.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/upgrade.mjs", import.meta.url));
const CLI_VERSION_TEST = fileURLToPath(new URL("../../../packages/loupe/src/version.test.ts", import.meta.url));
const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function write(root, rel, value) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
}

const appJson = (spec, field = "devDependencies") =>
  `${JSON.stringify({ name: "app", [field]: { [LOUPE_PACKAGE]: spec, "@repo/loupe": "workspace:*" } }, null, 2)}\n`;

/**
 * A committed pnpm workspace with one app. `ledger` is the version the ledger records (null: no ledger),
 * `installed` the copy in the app's node_modules (null: no copy) and `spec` what the app's package.json asks for.
 */
function makeRepo({ ledger = "0.0.1", installed = "0.0.1", spec = "0.0.1", field = "devDependencies" } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-upgrade-")));
  made.push(root);
  write(root, "pnpm-workspace.yaml", "packages:\n  - apps/*\n");
  write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write(root, ".gitignore", "node_modules/\n");
  if (ledger !== null) {
    write(root, LEDGER, { loupe: { package: LOUPE_PACKAGE, version: ledger }, productLayer: { app: "apps/app" } });
  }
  write(root, "apps/app/package.json", appJson(spec, field));
  if (installed !== null) {
    write(root, "apps/app/node_modules/@danarocha/loupe/package.json", { version: installed, bin: { loupe: "dist/bin.js" } });
  }
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("add", ".");
  git("commit", "-qm", "install loupe");
  return root;
}

const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");
const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8" });
const resultOf = (stdout) => stdout.match(/^Result: (.+)$/m)?.[1];
/** A string as a regular expression that matches it literally. */
const lit = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("versions", () => {
  it("orders versions as the CLI's own table does, so the copy of its compare can't drift", () => {
    const table = [...readFileSync(CLI_VERSION_TEST, "utf8").matchAll(/\["([^"]+)", "([^"]+)", (-?\d)\]/g)];
    assert.ok(table.length >= 8, `found ${table.length} rows in the CLI's compareVersions table`);
    for (const [, a, b, sign] of table) {
      assert.equal(compareVersions(a, b), Number(sign), `${a} against ${b}`);
      assert.equal(compareVersions(b, a), Number(sign) === 0 ? 0 : -Number(sign), `${b} against ${a}`);
    }
  });

  it("names a version only when the spec names one outright", () => {
    assert.equal(plainVersion("0.0.4"), "0.0.4");
    assert.equal(plainVersion("^0.0.4"), "0.0.4");
    assert.equal(plainVersion("~0.0.4"), "0.0.4");
    assert.equal(plainVersion("0.0.5-beta.1"), "0.0.5-beta.1");
    for (const spec of ["catalog:", "catalog:loupe", "workspace:*", "latest", ">=0.0.4", "0.0.x", "npm:@danarocha/loupe@0.0.4", "", undefined]) {
      assert.equal(plainVersion(spec), undefined, String(spec));
    }
  });
});

describe("the verdict", () => {
  const rows = [
    // [ledger, installed copy, the app's pin, result], with the plugin pinning 0.0.5
    [undefined, "0.0.4", "0.0.4", "not-installed"],
    ["0.0.4", "0.0.4", "0.0.4", "upgrade"],
    ["0.0.4", "0.0.4", "^0.0.4", "upgrade"],
    ["0.0.4", undefined, "0.0.4", "upgrade"],
    ["0.0.4", "0.0.4", "0.0.5", "resume"],
    ["0.0.4", undefined, "0.0.5", "resume"],
    ["0.0.4", "0.0.5", "0.0.5", "resume"],
    // A copy of the new release from another branch, while the app's own pin is still the old one: bump it.
    ["0.0.4", "0.0.5", "0.0.4", "upgrade"],
    ["0.0.4", "0.0.5", "^0.0.4", "upgrade"],
    ["0.0.4", "0.0.5", "catalog:", "resume"],
    ["0.0.4", "0.0.4", "catalog:", "app-pin-not-plain"],
    ["0.0.4", "0.0.4", "workspace:*", "app-pin-not-plain"],
    ["0.0.4", "0.0.4", ">=0.0.4", "app-pin-not-plain"],
    ["0.0.4", undefined, undefined, "app-pin-not-plain"],
    ["0.0.5", "0.0.5", "0.0.5", "up-to-date"],
    ["0.0.6", "0.0.6", "0.0.6", "plugin-behind"],
    ["0.0.6", "0.0.5", "0.0.5", "plugin-behind"],
    ["0.0.5", "0.0.6", "0.0.6", "plugin-behind"],
    ["0.0.4", "0.0.4", "0.0.6", "plugin-behind"],
    ["0.0.4", "0.0.4", "^0.0.6", "plugin-behind"],
  ];
  for (const [ledger, installed, appSpec, want] of rows) {
    it(`ledger ${ledger}, copy ${installed}, app asks ${appSpec}: ${want}`, () => {
      assert.equal(verdict({ pin: "0.0.5", ledger, installed, appSpec }), want);
    });
  }

  it("compares by version, not as text: 0.0.9 is older than 0.0.10", () => {
    assert.equal(verdict({ pin: "0.0.10", ledger: "0.0.9", installed: "0.0.9", appSpec: "0.0.9" }), "upgrade");
    assert.equal(verdict({ pin: "0.0.9", ledger: "0.0.10", installed: "0.0.10", appSpec: "0.0.10" }), "plugin-behind");
  });

  it("treats a prerelease as older than its release", () => {
    assert.equal(verdict({ pin: "0.0.5", ledger: "0.0.5-beta.1", installed: "0.0.5-beta.1", appSpec: "0.0.5-beta.1" }), "upgrade");
  });

  it("only ever answers with the words the skill branches on", () => {
    for (const [ledger, installed, appSpec] of rows) assert.ok(RESULTS.includes(verdict({ pin: "0.0.5", ledger, installed, appSpec })));
    assert.equal(new Set(RESULTS).size, RESULTS.length);
  });

  it("decides against the pin this plugin ships when none is given", () => {
    assert.equal(verdict({ ledger: "0.0.1", installed: "0.0.1", appSpec: "0.0.1" }), "upgrade");
    assert.equal(verdict({ ledger: LOUPE_VERSION, installed: LOUPE_VERSION, appSpec: LOUPE_VERSION }), "up-to-date");
  });
});

describe("status", () => {
  it("reads the ledger, the installed copy and the app's package.json", () => {
    const root = makeRepo({ ledger: "0.0.1", installed: "0.0.2", spec: "^0.0.3", field: "dependencies" });
    const { manifest, ...facts } = upgradeFacts(root, undefined, "0.0.9");
    assert.equal(manifest.file, path.join(root, "apps/app/package.json"));
    assert.deepEqual(facts, { pin: "0.0.9", appDir: "apps/app", ledger: "0.0.1", installed: "0.0.2", appSpec: "^0.0.3", field: "dependencies" });
    assert.deepEqual(render({ ...facts, manifest }, "upgrade"), [
      "Loupe upgrade — apps/app",
      "  this plugin installs   @danarocha/loupe 0.0.9",
      "  the ledger records     0.0.1",
      "  the app has installed  0.0.2",
      "  its package.json       @danarocha/loupe ^0.0.3 (dependencies)",
      "Result: upgrade",
    ]);
  });

  it("says upgrade for an install behind the pin, resume once the app asks for it, and up-to-date at the pin", () => {
    const root = makeRepo({ ledger: "0.0.1", installed: "0.0.1", spec: "0.0.1" });
    const old = run(root, "status");
    assert.equal(old.status, 0, old.stderr);
    assert.equal(resultOf(old.stdout), "upgrade");
    assert.match(old.stdout, new RegExp(`this plugin installs +${lit(`${LOUPE_PACKAGE} ${LOUPE_VERSION}`)}`));

    write(root, "apps/app/package.json", appJson(LOUPE_VERSION));
    assert.equal(resultOf(run(root, "status").stdout), "resume");

    write(root, LEDGER, { loupe: { package: LOUPE_PACKAGE, version: LOUPE_VERSION }, productLayer: { app: "apps/app" } });
    assert.equal(resultOf(run(root, "status").stdout), "up-to-date");
  });

  it("says not-installed with no ledger, or a ledger that holds only an accepted yes", () => {
    const none = makeRepo({ ledger: null, installed: null });
    assert.equal(resultOf(run(none, "status").stdout), "not-installed");
    write(none, LEDGER, { untestedAccepted: [] });
    assert.equal(resultOf(run(none, "status").stdout), "not-installed");
  });

  it("says plugin-behind when the install is ahead of this plugin", () => {
    const root = makeRepo({ ledger: "99.0.0", installed: "99.0.0", spec: "99.0.0" });
    assert.equal(resultOf(run(root, "status").stdout), "plugin-behind");
  });

  it("takes the app from --app, in both spellings", () => {
    const root = makeRepo();
    write(root, "apps/other/package.json", appJson("0.0.2"));
    for (const args of [["--app", "apps/other"], ["--app=apps/other"]]) {
      const out = run(root, "status", ...args).stdout;
      assert.match(out, /^Loupe upgrade — apps\/other$/m);
      assert.match(out, /@danarocha\/loupe 0\.0\.2 \(devDependencies\)/);
    }
  });

  it("works from a folder below the workspace root", () => {
    const root = makeRepo();
    const out = run(path.join(root, "apps/app"), "status");
    assert.equal(out.status, 0, out.stderr);
    assert.equal(resultOf(out.stdout), "upgrade");
  });

  it("refuses outside a pnpm workspace, and unknown commands and options", () => {
    const empty = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-upgrade-")));
    made.push(empty);
    const outside = run(empty, "status");
    assert.equal(outside.status, 2);
    assert.match(outside.stderr, /No pnpm-workspace\.yaml/);
    const root = makeRepo();
    assert.equal(run(root, "restore").status, 2);
    assert.equal(run(root).status, 2);
    const stray = run(root, "status", "--force");
    assert.equal(stray.status, 2);
    assert.match(stray.stderr, /Unknown option: --force/);
  });
});

describe("setDependency", () => {
  const set = (text, to = "0.0.5") => setDependency(text, LOUPE_PACKAGE, to);

  it("changes the one value and nothing else, whatever the file's formatting", () => {
    for (const text of [
      appJson("0.0.4"),
      appJson("^0.0.4"),
      appJson("~0.0.4").replace(/\n$/, ""),
      appJson("0.0.4").replaceAll("  ", "\t"),
      appJson("0.0.4").replaceAll("  ", "    "),
      `{"name":"app","devDependencies":{"@danarocha/loupe":"0.0.4"}}\r\n`,
      appJson("0.0.4").replace('"@danarocha/loupe":', '"@danarocha/loupe" :   '),
    ]) {
      const { text: after, from } = set(text);
      assert.equal(after, text.replace(/("@danarocha\/loupe"\s*:\s*)"[^"]*"/, '$1"0.0.5"'));
      assert.match(from, /^[\^~]?0\.0\.4$/);
      assert.equal(JSON.parse(after).devDependencies[LOUPE_PACKAGE], "0.0.5");
    }
  });

  it("drops the ^ or ~ the old value carried, since the new one is exact", () => {
    assert.equal(JSON.parse(set(appJson("^0.0.4")).text).devDependencies[LOUPE_PACKAGE], "0.0.5");
    assert.equal(JSON.parse(set(appJson("~0.0.4")).text).devDependencies[LOUPE_PACKAGE], "0.0.5");
  });

  it("refuses when the name is absent, or appears more than once", () => {
    assert.match(set('{"name":"app"}').error, /appears 0 times/);
    const twice = JSON.stringify({ devDependencies: { [LOUPE_PACKAGE]: "0.0.4" }, pnpm: { overrides: { [LOUPE_PACKAGE]: "0.0.4" } } });
    assert.match(set(twice).error, /appears 2 times/);
  });
});

describe("bump", () => {
  const pin = "0.0.5";

  it("sets the app's dependency to the pin, exact, and writes only that file", () => {
    const root = makeRepo({ ledger: "0.0.4", installed: "0.0.4", spec: "^0.0.4" });
    const result = bump(root, undefined, pin);
    assert.equal(result.code, 0, result.err?.join("\n"));
    assert.deepEqual(result.out, [`apps/app/package.json: ${LOUPE_PACKAGE} ^0.0.4 → ${pin} (devDependencies)`, "Next: run pnpm install from the repo root."]);
    assert.equal(read(root, "apps/app/package.json"), appJson(pin));
    const changed = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
    assert.equal(changed.trim(), "M apps/app/package.json");
  });

  it("bumps the field that already names Loupe", () => {
    const root = makeRepo({ ledger: "0.0.4", installed: "0.0.4", spec: "0.0.4", field: "dependencies" });
    assert.equal(bump(root, undefined, pin).code, 0);
    assert.equal(read(root, "apps/app/package.json"), appJson(pin, "dependencies"));
  });

  it("refuses, writing nothing, while the app's package.json or the lockfile has uncommitted changes", () => {
    for (const rel of ["apps/app/package.json", "pnpm-lock.yaml"]) {
      const root = makeRepo({ ledger: "0.0.4", installed: "0.0.4", spec: "0.0.4" });
      write(root, rel, read(root, rel).replace(/\n$/, "\n\n"));
      const before = read(root, "apps/app/package.json");
      const result = bump(root, undefined, pin);
      assert.equal(result.code, 1);
      assert.match(result.err.join("\n"), new RegExp(`Uncommitted changes in:\\n  ${lit(rel)}`));
      assert.match(result.err.at(-1), /Nothing was written\.$/);
      assert.equal(read(root, "apps/app/package.json"), before);
    }
  });

  it("an uncommitted file elsewhere does not stop it", () => {
    const root = makeRepo({ ledger: "0.0.4", installed: "0.0.4", spec: "0.0.4" });
    write(root, "apps/app/notes.md", "mine");
    assert.equal(bump(root, undefined, pin).code, 0);
  });

  it("bumps only from `upgrade`: not once it has been done, not at the pin, not for another kind of pin", () => {
    const cases = [
      [{ ledger: "0.0.4", installed: "0.0.4", spec: pin }, "resume"],
      [{ ledger: pin, installed: pin, spec: pin }, "up-to-date"],
      [{ ledger: "0.0.4", installed: "0.0.4", spec: "catalog:" }, "app-pin-not-plain"],
      [{ ledger: "0.0.4", installed: "0.0.4", spec: "workspace:*" }, "app-pin-not-plain"],
      [{ ledger: "0.0.9", installed: "0.0.9", spec: "0.0.9" }, "plugin-behind"],
      [{ ledger: null, installed: null, spec: "0.0.4" }, "not-installed"],
    ];
    for (const [repo, result] of cases) {
      const root = makeRepo(repo);
      const before = read(root, "apps/app/package.json");
      const out = bump(root, undefined, pin);
      assert.equal(out.code, 1, result);
      assert.match(out.err[0], new RegExp(`at "${result}"`));
      assert.equal(read(root, "apps/app/package.json"), before);
    }
  });

  it("is the command's exit code and message, end to end", () => {
    const root = makeRepo({ ledger: "0.0.1", installed: "0.0.1", spec: "0.0.1" });
    const first = run(root, "bump");
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, new RegExp(`^${lit(`apps/app/package.json: ${LOUPE_PACKAGE} 0.0.1 → ${LOUPE_VERSION} (devDependencies)`)}$`, "m"));
    assert.equal(JSON.parse(read(root, "apps/app/package.json")).devDependencies[LOUPE_PACKAGE], LOUPE_VERSION);
    // Bumped, not yet committed: the next run is a resume, and a second bump is refused.
    assert.equal(resultOf(run(root, "status").stdout), "resume");
    const second = run(root, "bump");
    assert.equal(second.status, 1);
    assert.match(second.stderr, /Not bumping/);
  });
});
