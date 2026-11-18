import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cli as loupe,
  commit,
  editLedger,
  type Files,
  git,
  installable,
  type InstallOptions,
  installedRepo,
  LEDGER,
  makeRepo,
  nextConfig,
  snapshot,
} from "../compat/repo.fixture.js";

const LAYOUT = "apps/web/app/layout.tsx";

// The app already mounts an Agentation of its own in the layout, where Loupe's mount goes next to it.
const layout = `import type { ReactNode } from "react";
import { Agentation } from "agentation";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === "development" && (
          <Agentation endpoint="http://localhost:4747" />
        )}
      </body>
    </html>
  );
}
`;
const agentation: Files = { [LAYOUT]: layout };

/**
 * The shared installed repo, with the Agentation layout, and the lockfile as `pnpm install` leaves it after init
 * (so a remove that restores it leaves no diff against `start`).
 */
async function installed(options: InstallOptions = {}): Promise<{ root: string; start: string }> {
  const { root, start } = await installedRepo({ ...options, files: { ...agentation, ...options.files } });
  // What the install skill's pnpm install would do.
  writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters: loupe\n");
  commit(root, "install");
  return { root, start };
}

/** `loupe <argv>`, with a `pnpm install` that records where it ran and exits with `status`. */
async function cli(root: string, argv: string[], installs: string[] = [], status = 0) {
  return loupe(root, argv, {
    install: (at) => {
      installs.push(at);
      // pnpm's own lockfile write, back to the starting one.
      if (status === 0) writeFileSync(path.join(at, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      return status;
    },
  });
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");
/** The working tree against `start`, untracked files included. */
const diff = (root: string, start: string) =>
  git(root, "diff", start, "--stat") + git(root, "ls-files", "--others", "--exclude-standard");

function generatedAdapter(root: string): string {
  const dir = path.join(root, "packages/loupe/adapters");
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const found = walk(dir)[0];
  if (!found) throw new Error("no Adapter generated");
  return path.relative(root, found);
}

describe("loupe remove after init", () => {
  it("leaves no diff against the starting commit, the lockfile included, and runs pnpm install once", async () => {
    const { root, start } = await installed();
    const installs: string[] = [];
    const { code, text } = await cli(root, ["remove"], installs);
    expect(code, text).toBe(0);
    expect(text).toContain("Loupe is removed");
    expect(text).toContain("Restart the dev server");
    expect(installs).toEqual([root]);
    expect(diff(root, start)).toBe("");
    expect(existsSync(path.join(root, "packages/loupe"))).toBe(false);

    // A rerun has nothing left to do.
    const again = await cli(root, ["remove"], installs);
    expect(again.code).toBe(0);
    expect(again.text).toContain("Nothing to remove");
    expect(installs).toHaveLength(1);
  });

  it("undoes a package.json edit whose hash Loupe 0.0.4 recorded, with the version in it", async () => {
    const { root, start } = await installed({ oldHash: true });
    const { code, text } = await cli(root, ["remove"]);
    expect(code, text).toBe(0);
    expect(diff(root, start)).toBe("");
  });

  it("removes the layer's ignored leftovers, such as its node_modules", async () => {
    const { root, start } = await installed();
    mkdirSync(path.join(root, "packages/loupe/node_modules/react"), { recursive: true });
    writeFileSync(path.join(root, "packages/loupe/node_modules/react/index.js"), "");
    const { code } = await cli(root, ["remove"]);
    expect(code).toBe(0);
    expect(diff(root, start)).toBe("");
    expect(existsSync(path.join(root, "packages/loupe"))).toBe(false);
  });
});

describe("a hand edit outside Loupe's block and in an Adapter", () => {
  it("keeps the edit and an edited Adapter, keeps the exclusion, then finishes on a second run", async () => {
    const { root, start } = await installed();
    const edited = read(root, LAYOUT).replace('<html lang="en">', '<html lang="pt-BR">');
    writeFileSync(path.join(root, LAYOUT), edited);
    const adapter = generatedAdapter(root);
    writeFileSync(path.join(root, adapter), `${read(root, adapter)}// mine\n`);
    commit(root, "hand edits");

    const installs: string[] = [];
    const first = await cli(root, ["remove"], installs);
    expect(first.code, first.text).toBe(1);
    expect(read(root, LAYOUT)).toBe(layout.replace('<html lang="en">', '<html lang="pt-BR">'));
    expect(read(root, "apps/web/next.config.ts")).toBe(nextConfig);
    expect(first.text).toContain(`✗ ${adapter}: edited since loupe generate wrote it; left as is`);
    expect(first.text).toMatch(/✗ biome-config +biome\.jsonc: packages\/loupe still has files, so its exclusion stays; left as is/);
    expect(read(root, "biome.jsonc")).toContain('"!packages/loupe"');
    expect(read(root, adapter)).toContain("// mine");
    expect(existsSync(path.join(root, LEDGER))).toBe(true);
    // The dependencies went, and pnpm install with them.
    expect(JSON.parse(read(root, "apps/web/package.json")).devDependencies).toEqual({ typescript: "^5.9.3" });
    expect(installs).toHaveLength(1);
    // Only the Adapter and the ledger remain in the layer.
    expect(git(root, "ls-files", "packages/loupe").trim().split("\n").filter((f) => existsSync(path.join(root, f)))).toEqual([
      adapter,
      LEDGER,
    ]);

    rmSync(path.join(root, adapter));
    const second = await cli(root, ["remove"], installs);
    expect(second.code, second.text).toBe(0);
    expect(installs).toHaveLength(1);
    // Nothing but the hand edit to the layout differs from the start.
    expect(git(root, "diff", start, "--name-only").trim()).toBe(LAYOUT);
    expect(git(root, "diff", start, "--", LAYOUT)).toContain('+    <html lang="pt-BR">');
    expect(git(root, "ls-files", "--others", "--exclude-standard")).toBe("");
    expect(existsSync(path.join(root, "packages/loupe"))).toBe(false);
  });
});

describe("a hand edit inside Loupe's block", () => {
  it("removes withLoupe, stops before the Product layer and the dependencies, and finishes once the edit is undone", async () => {
    const { root, start } = await installed();
    const ours = read(root, LAYOUT);
    writeFileSync(path.join(root, LAYOUT), ours.replace("<LoupeMount />", "<LoupeMount debug />"));
    const layer = snapshot(path.join(root, "packages/loupe"));
    const pkg = read(root, "apps/web/package.json");

    const installs: string[] = [];
    const first = await cli(root, ["remove"], installs);
    expect(first.code, first.text).toBe(1);
    expect(read(root, "apps/web/next.config.ts")).toBe(nextConfig);
    expect(first.text).toMatch(/✗ root-layout +apps\/web\/app\/layout\.tsx: changed since loupe init recorded it; left as is/);
    expect(first.text).toContain("Stopped before the Product layer, the Biome exclusion and the dependencies");
    expect(read(root, LAYOUT)).toContain("<LoupeMount debug />");
    expect(snapshot(path.join(root, "packages/loupe"))).toEqual(layer);
    expect(read(root, "apps/web/package.json")).toBe(pkg);
    expect(read(root, "biome.jsonc")).toContain('"!packages/loupe"');
    expect(installs).toHaveLength(0);

    // Undo the hand edit; the uncommitted next.config.ts from the first run doesn't block.
    writeFileSync(path.join(root, LAYOUT), ours);
    const second = await cli(root, ["remove"], installs);
    expect(second.code, second.text).toBe(0);
    expect(installs).toHaveLength(1);
    expect(diff(root, start)).toBe("");
  });
});

describe("the dirty-tree rule", () => {
  it("refuses uncommitted changes in a file it would change and writes nothing; --allow-dirty proceeds", async () => {
    const { root } = await installed();
    writeFileSync(path.join(root, "apps/web/next.config.ts"), `${read(root, "apps/web/next.config.ts")}// wip\n`);
    const before = snapshot(root);
    const refused = await cli(root, ["remove"]);
    expect(refused.code).toBe(1);
    expect(refused.text).toContain("apps/web/next.config.ts");
    expect(refused.text).toContain("Nothing was written.");
    expect(snapshot(root)).toEqual(before);

    const allowed = await cli(root, ["remove", "--allow-dirty"]);
    expect(allowed.code, allowed.text).toBe(0);
    expect(read(root, "apps/web/next.config.ts")).toBe(`${nextConfig}// wip\n`);
  });

  it("ignores uncommitted changes elsewhere", async () => {
    const { root } = await installed();
    writeFileSync(path.join(root, "notes.md"), "x\n");
    expect((await cli(root, ["remove"])).code).toBe(0);
    expect(read(root, "notes.md")).toBe("x\n");
  });
});

describe("what stays", () => {
  it("keeps a file Loupe didn't write in the layer, and the ledger with it", async () => {
    const { root } = await installed();
    writeFileSync(path.join(root, "packages/loupe/notes.md"), "mine\n");
    commit(root);
    const { code, text } = await cli(root, ["remove"]);
    expect(code).toBe(1);
    expect(text).toContain("✗ packages/loupe/notes.md: not written by Loupe; left as is");
    expect(existsSync(path.join(root, LEDGER))).toBe(true);
  });

  it("puts the dependencies back when pnpm install fails, so a rerun retries it", async () => {
    const { root, start } = await installed();
    const pkg = read(root, "apps/web/package.json");
    const installs: string[] = [];
    const { code, text } = await cli(root, ["remove"], installs, 1);
    expect(code).toBe(1);
    expect(text).toContain("pnpm install exited with 1");
    expect(text).not.toContain("left as is");
    expect(read(root, "apps/web/package.json")).toBe(pkg);
    expect(existsSync(path.join(root, LEDGER))).toBe(true);

    const again = await cli(root, ["remove", "--allow-dirty"], installs);
    expect(again.code, again.text).toBe(0);
    expect(installs).toHaveLength(2);
    expect(diff(root, start)).toBe("");
  });

  it("keeps an edited file init wrote, and an ignored file it can't vouch for", async () => {
    const { root } = await installed();
    writeFileSync(path.join(root, "packages/loupe/mount.tsx"), `${read(root, "packages/loupe/mount.tsx")}// mine\n`);
    commit(root);
    writeFileSync(path.join(root, "packages/loupe/debug.log"), "x\n");
    const { code, text } = await cli(root, ["remove"]);
    expect(code).toBe(1);
    expect(text).toContain("✗ packages/loupe/mount.tsx: edited since loupe init wrote it; left as is");
    expect(text).toContain("✗ packages/loupe/debug.log: ignored by git, so Loupe can't tell who wrote it; left as is");
    expect(read(root, "packages/loupe/debug.log")).toBe("x\n");
  });

  it("keeps a manual step never adopted, and stops before the Product layer", async () => {
    const { root } = await installed();
    editLedger(root, (l) => {
      for (const t of l.touchPoints) if (t.id === "next-config") Object.assign(t, { mode: "manual", sha256: null });
    });
    commit(root);
    const { code, text } = await cli(root, ["remove"]);
    expect(code).toBe(1);
    expect(text).toMatch(/✗ next-config +apps\/web\/next\.config\.ts: a manual step loupe init never recorded/);
    expect(text).toContain("Stopped before the Product layer");
    expect(read(root, LAYOUT)).not.toContain("LoupeMount");
    expect(existsSync(path.join(root, "packages/loupe/mount.tsx"))).toBe(true);
  });

  it("treats a touch point file deleted by hand as done", async () => {
    const { root } = await installed();
    rmSync(path.join(root, "biome.jsonc"));
    commit(root);
    const { code, text } = await cli(root, ["remove"]);
    expect(code, text).toBe(0);
    expect(existsSync(path.join(root, LEDGER))).toBe(false);
  });

  it("refuses a ledger that points outside the Product layer, or from a newer format", async () => {
    const { root } = await installed();
    const recorded = read(root, LEDGER);
    editLedger(root, (l) => {
      l.productLayer.path = ".";
    });
    commit(root);
    const before = snapshot(root);
    const outside = await cli(root, ["remove"]);
    expect(outside.code).toBe(1);
    expect(outside.text).toContain("isn't one loupe init wrote");
    expect(snapshot(root)).toEqual(before);

    writeFileSync(path.join(root, LEDGER), recorded);
    editLedger(root, (l) => {
      l.formatVersion = 2;
    });
    expect((await cli(root, ["remove"])).text).toContain("formatVersion 2");
  });

  it("refuses a ledger whose touch points it can't place", async () => {
    const { root } = await installed();
    const recorded = read(root, LEDGER);
    editLedger(root, (l) => {
      delete (l.productLayer as { app?: string }).app;
    });
    commit(root);
    const before = snapshot(root);
    const noApp = await cli(root, ["remove"]);
    expect(noApp.code).toBe(1);
    expect(noApp.text).toContain("isn't one loupe init wrote");
    expect(snapshot(root)).toEqual(before);

    // A Biome config recorded somewhere init never looks, while the root has none.
    writeFileSync(path.join(root, LEDGER), recorded);
    editLedger(root, (l) => {
      for (const t of l.touchPoints) if (t.id === "biome-config") t.file = "config/biome.jsonc";
    });
    mkdirSync(path.join(root, "config"));
    git(root, "mv", "biome.jsonc", "config/biome.jsonc");
    commit(root);
    const elsewhere = snapshot(root);
    const moved = await cli(root, ["remove"]);
    expect(moved.code).toBe(1);
    expect(moved.text).toContain("isn't one loupe init wrote");
    expect(snapshot(root)).toEqual(elsewhere);

    // A touch point this Loupe doesn't know, in a file that is there: removing the rest would drop its record.
    writeFileSync(path.join(root, LEDGER), recorded);
    git(root, "mv", "config/biome.jsonc", "biome.jsonc");
    editLedger(root, (l) => {
      l.touchPoints.push({ id: "tsconfig", file: "apps/web/tsconfig.json", mode: "auto", sha256: "0" });
    });
    commit(root);
    const unknown = snapshot(root);
    const later = await cli(root, ["remove"]);
    expect(later.code).toBe(1);
    expect(later.text).toContain("isn't one loupe init wrote");
    expect(snapshot(root)).toEqual(unknown);
  });

  it("says so when there is no ledger", async () => {
    const root = makeRepo(agentation, installable);
    git(root, "init", "-q");
    const { code, text } = await cli(root, ["remove"]);
    expect(code).toBe(0);
    expect(text).toContain("Nothing to remove");
  });
});

describe("when a hand edit moved things, each undo takes out only Loupe's lines", () => {
  it("keeps a comment of the user's next to the Biome exclusion", async () => {
    const { root, start } = await installed();
    const text = read(root, "biome.jsonc").replace('      // Loupe', '      // mine\n      // Loupe');
    writeFileSync(path.join(root, "biome.jsonc"), text);
    commit(root);
    expect((await cli(root, ["remove"])).code).toBe(0);
    expect(git(root, "diff", start, "--", "biome.jsonc")).toContain("+      // mine");
    expect(git(root, "diff", start, "--name-only").trim()).toBe("biome.jsonc");
  });

  it("removes a mount that is no longer the last child", async () => {
    const { root, start } = await installed();
    const text = read(root, LAYOUT).replace("<LoupeMount />}\n", "<LoupeMount />}\n        <footer />\n");
    writeFileSync(path.join(root, LAYOUT), text);
    commit(root);
    expect((await cli(root, ["remove"])).code).toBe(0);
    expect(read(root, LAYOUT)).toBe(layout.replace("        )}\n      </body>", "        )}\n        <footer />\n      </body>"));
    expect(git(root, "diff", start, "--name-only").trim()).toBe(LAYOUT);
  });
});
