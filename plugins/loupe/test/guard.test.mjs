import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { decide, productLayerOf } from "../scripts/guard.mjs";

const GUARD = fileURLToPath(new URL("../scripts/guard.mjs", import.meta.url));
const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-guard-")));
after(() => rmSync(repo, { recursive: true, force: true }));

function write(rel, text) {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}

write("packages/loupe/loupe.ledger.json", "{}\n");
write("packages/loupe/adapters/ds/ui/button.tsx", "// generated\n");
write("packages/design-system/components/ui/button.tsx", "export {};\n");
// Loupe's own source package (in the Loupe repo) is not a Product layer.
write("tool/packages/loupe/package.json", JSON.stringify({ name: "@danarocha/loupe" }));
write("tool/packages/loupe/src/cli.ts", "export {};\n");
// A Product layer whose ledger is gone is still recognised by its package name.
write("other/packages/loupe/package.json", JSON.stringify({ name: "@repo/loupe" }));

const edit = (file_path, cwd = repo) => ({ tool_name: "Edit", cwd, tool_input: { file_path } });

describe("guard", () => {
  it("refuses an Edit to a generated file under packages/loupe, naming generate", () => {
    const answer = decide(edit(path.join(repo, "packages/loupe/adapters/ds/ui/button.tsx")));
    assert.equal(answer?.hookSpecificOutput.permissionDecision, "deny");
    assert.equal(answer.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.match(answer.hookSpecificOutput.permissionDecisionReason, /loupe\.mjs" generate/);
    assert.match(answer.hookSpecificOutput.permissionDecisionReason, /Product layer/);
  });

  it("refuses the ledger itself and a Write of a new file in a new folder", () => {
    assert.ok(decide(edit(path.join(repo, "packages/loupe/loupe.ledger.json"))));
    const write = { tool_name: "Write", cwd: repo, tool_input: { file_path: path.join(repo, "packages/loupe/new/dir/x.tsx") } };
    assert.ok(decide(write));
  });

  it("resolves a relative path against the hook's cwd", () => {
    assert.ok(decide(edit("packages/loupe/adapters/ds/ui/button.tsx")));
    assert.equal(decide(edit("packages/design-system/components/ui/button.tsx")), undefined);
  });

  it("allows edits outside the layer, including Loupe's own source package", () => {
    assert.equal(decide(edit(path.join(repo, "packages/design-system/components/ui/button.tsx"))), undefined);
    assert.equal(decide(edit(path.join(repo, "tool/packages/loupe/src/cli.ts"))), undefined);
  });

  it("recognises a layer by its package name when the ledger is gone", () => {
    assert.equal(productLayerOf(path.join(repo, "other/packages/loupe/x.tsx")), path.join(repo, "other/packages/loupe"));
  });

  it("allows a notebook or tool input with no path", () => {
    assert.equal(decide({ tool_input: {} }), undefined);
    assert.equal(decide({}), undefined);
  });

  it("speaks the hook protocol end to end, and never fails on bad input", () => {
    const denied = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify(edit(path.join(repo, "packages/loupe/adapters/ds/ui/button.tsx"))),
      encoding: "utf8",
    });
    assert.equal(denied.status, 0);
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, "deny");

    const allowed = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify(edit(path.join(repo, "packages/design-system/components/ui/button.tsx"))),
      encoding: "utf8",
    });
    assert.equal(allowed.status, 0);
    assert.equal(allowed.stdout, "");

    const garbage = spawnSync(process.execPath, [GUARD], { input: "not json", encoding: "utf8" });
    assert.equal(garbage.status, 0);
    assert.equal(garbage.stdout, "");
  });
});
