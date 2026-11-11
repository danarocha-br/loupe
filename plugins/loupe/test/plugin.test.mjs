import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LEDGER, LOUPE_PACKAGE, LOUPE_VERSION, PRODUCT_LAYER, PRODUCT_LAYER_PACKAGE } from "../scripts/pin.mjs";

const plugin = fileURLToPath(new URL("..", import.meta.url));
const repo = path.resolve(plugin, "../..");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));

describe("the Installer plugin", () => {
  it("pins the Loupe version this repo builds", () => {
    const loupe = json(path.join(repo, "packages/loupe/package.json"));
    assert.equal(LOUPE_PACKAGE, loupe.name);
    assert.equal(LOUPE_VERSION, loupe.version);
  });

  it("names the Product layer and its ledger as the CLI does", () => {
    const src = (file) => readFileSync(path.join(repo, "packages/loupe/src", file), "utf8");
    assert.match(
      src("init/touch-points.ts"),
      new RegExp(`PRODUCT_LAYER = \\{ name: "${PRODUCT_LAYER_PACKAGE}", path: "${PRODUCT_LAYER}" \\}`),
    );
    assert.match(src("init/touch-points.ts"), new RegExp(`NPM_PACKAGE = "${LOUPE_PACKAGE}"`));
    assert.match(src("compat/ledger.ts"), new RegExp(`LEDGER_PATH = "${LEDGER}"`));
  });

  it("has a manifest, a marketplace entry, and no bin/ and no npm dependencies", () => {
    const manifest = json(path.join(plugin, ".claude-plugin/plugin.json"));
    assert.equal(manifest.name, "loupe");
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    const market = json(path.join(repo, ".claude-plugin/marketplace.json"));
    const entry = market.plugins.find((p) => p.name === "loupe");
    assert.equal(path.resolve(repo, entry.source), path.resolve(plugin));
    assert.equal(existsSync(path.join(plugin, "bin")), false);
    const pkg = json(path.join(plugin, "package.json"));
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      assert.equal(pkg[field], undefined, field);
    }
  });

  it("wires one PreToolUse guard over Claude's edit tools, through the plugin root", () => {
    const hooks = json(path.join(plugin, "hooks/hooks.json")).hooks;
    assert.deepEqual(Object.keys(hooks), ["PreToolUse"]);
    const [entry] = hooks.PreToolUse;
    assert.deepEqual(entry.matcher.split("|").sort(), ["Edit", "MultiEdit", "NotebookEdit", "Write"]);
    assert.equal(entry.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/scripts/guard.mjs"');
  });

  it("ships the install, remove and doctor skills, each running the CLI through the pinned runner", () => {
    const skills = readdirSync(path.join(plugin, "skills")).sort();
    assert.deepEqual(skills, ["doctor", "install", "remove"]);
    for (const skill of skills) {
      const text = readFileSync(path.join(plugin, "skills", skill, "SKILL.md"), "utf8");
      const front = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
      assert.match(front, new RegExp(`^name: ${skill}$`, "m"));
      assert.match(front, /^description: \S/m);
      assert.match(text, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/loupe\.mjs/);
    }
  });

  it("parses every script", () => {
    for (const file of readdirSync(path.join(plugin, "scripts"))) {
      const result = spawnSync(process.execPath, ["--check", path.join(plugin, "scripts", file)], { encoding: "utf8" });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  });
});
