import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `loader.cts` is the CommonJS shell Turbopack runs. These tests call it the way
// Turbopack does: with a loader context, and a callback from `this.async()`.

const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "loupe-loader-")));
const missing = path.join(dir, "loupe", "adapt-list.json");
const resourcePath = path.join(dir, "app", "page.tsx");
const source = "export default function Page() { return null; }\n";

type Callback = (error: Error | null, code?: string, map?: unknown) => void;

async function runShell(getOptions: (() => unknown) | undefined) {
  // `warned` lives in the module, so each run gets a fresh one.
  vi.resetModules();
  const { default: loupeLoader } = await import("./loader.cjs");
  const addDependency = vi.fn();
  const emitWarning = vi.fn();
  const done = new Promise<{ error: Error | null; code?: string }>((resolve) => {
    const context = {
      resourcePath,
      async: (): Callback => (error, code) => resolve({ error, code }),
      getOptions,
      addDependency,
      emitWarning,
    };
    loupeLoader.call(context as never, source);
  });
  return { ...(await done), addDependency, emitWarning };
}

describe("the loader shell when adapt-list.json is missing", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("hands the file back untouched, says so once, and still depends on adapt-list.json", async () => {
    const { error, code, addDependency, emitWarning } = await runShell(() => ({ root: dir, adaptList: missing }));
    expect(error).toBeNull();
    expect(code).toBe(source);
    expect(emitWarning).toHaveBeenCalledTimes(1);
    expect(String(emitWarning.mock.calls[0]?.[0])).toContain("ENOENT");
    // Without this, Turbopack caches the untouched file and never revisits it once the
    // adapt list is back: the Instances stay lost until `next dev` restarts.
    expect(addDependency).toHaveBeenCalledWith(missing);
  });

  it("still hands the file back when it was given no options at all", async () => {
    const { error, code, addDependency } = await runShell(undefined);
    expect(error).toBeNull();
    expect(code).toBe(source);
    expect(addDependency).not.toHaveBeenCalled();
  });
});
