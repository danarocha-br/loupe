import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { appArgument, chooseCommand, findRoot, inspectRepo } from "../scripts/loupe.mjs";
import { LOUPE_VERSION } from "../scripts/pin.mjs";

const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-runner-")));
after(() => rmSync(repo, { recursive: true, force: true }));

function write(rel, value) {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
}

write("pnpm-workspace.yaml", "packages:\n  - apps/*\n");
mkdirSync(path.join(repo, "apps/app/app"), { recursive: true });

describe("the loupe runner", () => {
  it("finds the workspace root from below it", () => {
    assert.equal(findRoot(path.join(repo, "apps/app/app")), repo);
  });

  it("reads --app in both spellings", () => {
    assert.equal(appArgument(["init", "--app", "apps/app"]), "apps/app");
    assert.equal(appArgument(["init", "--app=apps/web"]), "apps/web");
    assert.equal(appArgument(["doctor"]), undefined);
  });

  it("runs the pinned release with pnpm dlx before anything is installed, never latest", () => {
    const choice = chooseCommand({ args: ["check"], pinned: true, ...inspectRepo(repo, ["check"]) });
    assert.deepEqual(choice.argv, ["dlx", `@danarocha/loupe@${LOUPE_VERSION}`, "check"]);
    assert.equal(choice.command, "pnpm");
  });

  it("runs the app's own copy once it is installed, found through the ledger's app", () => {
    write("packages/loupe/loupe.ledger.json", { loupe: { version: "0.0.1" }, productLayer: { app: "apps/app" } });
    write("apps/app/node_modules/@danarocha/loupe/package.json", { version: "0.0.1", bin: { loupe: "dist/bin.js" } });
    const seen = inspectRepo(repo, ["doctor"]);
    assert.equal(seen.app, "apps/app");
    assert.deepEqual(seen.local, {
      version: "0.0.1",
      bin: path.join(repo, "apps/app/node_modules/@danarocha/loupe/dist/bin.js"),
    });
    const choice = chooseCommand({ args: ["doctor"], pinned: false, ...seen });
    assert.equal(choice.command, process.execPath);
    assert.deepEqual(choice.argv, [seen.local.bin, "doctor"]);
  });

  it("refuses, under --pinned, a copy of another version", () => {
    const choice = chooseCommand({
      args: ["init"],
      pinned: true,
      app: "apps/app",
      local: { version: "0.0.1", bin: "/x/bin.js" },
      pin: "0.0.2",
    });
    assert.match(choice.refuse, /already has @danarocha\/loupe 0\.0\.1; this plugin installs 0\.0\.2/);
  });

  it("falls back to the ledger's version, not the pin, when the copy is missing", () => {
    const choice = chooseCommand({ args: ["remove"], pinned: false, app: "apps/app", ledgerVersion: "0.0.1", pin: "0.0.2" });
    assert.deepEqual(choice.argv, ["dlx", "@danarocha/loupe@0.0.1", "remove"]);
  });
});
