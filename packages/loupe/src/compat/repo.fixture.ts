import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterAll } from "vitest";
import { run } from "../cli.js";
import type { BuildRunner } from "../doctor/build.js";
import { parseDoctorArgs, runDoctor } from "../doctor/command.js";
import { parseInitArgs, runInit } from "../init/command.js";
import { version } from "../version.js";

export type Files = Record<string, string | object | null>;

/** Every directory made below, removed once the test file that imported this one has run. */
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

// A pnpm workspace shaped like orbix-ai: one App Router app on Next 16.3 that
// depends on a shadcn-on-Base-UI design system kept as a workspace package.
export const supportedRepo: Files = {
  "package.json": { name: "root", private: true },
  "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n",
  "apps/web/package.json": {
    name: "web",
    scripts: { dev: "next dev -p 3000" },
    dependencies: { next: "16.3.6", "@repo/design-system": "workspace:*" },
  },
  "apps/web/tsconfig.json": {},
  "apps/web/app/page.tsx":
    'import { Button } from "@repo/design-system/components/ui/button";\n',
  "apps/web/node_modules/next/package.json": { name: "next", version: "16.3.6" },
  "apps/web/node_modules/next/dist/compiled/react/cjs/react.development.js":
    'exports.version = "19.3.0-canary-cbb046ab-20260731";\n',
  "packages/design-system/package.json": {
    name: "@repo/design-system",
    dependencies: { "@base-ui/react": "^1.6.0", "class-variance-authority": "^0.7.1" },
  },
  "packages/design-system/components.json": {
    aliases: { ui: "@repo/design-system/components/ui" },
  },
  "packages/design-system/components/ui/button.tsx": "export function Button() {}\n",
};

/** Writes `files` over `base` into a fresh temp dir. `null` deletes a path from `base`. */
export function makeRepo(files: Files = {}, base: Files = supportedRepo): string {
  const root = mkdtempSync(join(tmpdir(), "loupe-compat-"));
  temps.push(root);
  for (const [path, content] of Object.entries({ ...base, ...files })) {
    if (content === null) continue;
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    );
  }
  return root;
}

/**
 * Runs git in a test repo with a fixed identity and no background maintenance:
 * auto gc and maintenance write lock files under `.git` while a test reads the tree.
 */
export function git(root: string, ...args: string[]): string {
  const config = ["user.name=t", "user.email=t@t", "gc.auto=0", "maintenance.auto=false"];
  return execFileSync("git", [...config.flatMap((c) => ["-c", c]), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Every file under `root` with its contents, to prove a run wrote nothing. Skips `.git`. */
export function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && entry.name === ".git") continue;
      if (entry.isDirectory()) walk(full);
      else out[relative(root, full)] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return out;
}

// ── An app to install Loupe into, and what an install leaves behind ─────────

/** Written out on purpose rather than imported: the ledger's location is documented, so a move should fail a test. */
export const LEDGER = "packages/loupe/loupe.ledger.json";

const layout = `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
`;

export const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;

export const biome = `{
  "files": {
    "includes": [
      "**/*",
      // Generated.
      "!dist"
    ]
  }
}
`;

/** `supportedRepo` as a person has it before `loupe init`: the four touch points exist and nothing is installed. */
export const installable: Files = {
  ...supportedRepo,
  ".gitignore": "node_modules\n.next\n*.log\n",
  "apps/web/package.json": {
    name: "web",
    scripts: { dev: "next dev -p 3000" },
    dependencies: { "@repo/design-system": "workspace:*", next: "16.3.6", react: "19.2.4" },
    devDependencies: { typescript: "^5.9.3" },
  },
  "apps/web/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "apps/web/next.config.ts": nextConfig,
  "apps/web/app/layout.tsx": layout,
  "packages/design-system/tsconfig.json": { compilerOptions: { jsx: "preserve", strict: true } },
  "packages/design-system/components/ui/button.tsx":
    'export function Button(props: { variant?: "default" | "ghost" }) {\n  return <button data-variant={props.variant} />;\n}\n',
  "biome.jsonc": biome,
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};

/** `makeRepo`, then `git init` and one commit, so the touch points start clean. */
export function committedRepo(files: Files = {}, base: Files = installable): string {
  const root = makeRepo(files, base);
  git(root, "init", "-q", "-b", "main");
  commit(root, "start");
  return root;
}

export function commit(root: string, message = "step"): void {
  git(root, "add", "-A");
  git(root, "commit", "-q", "--allow-empty", "-m", message);
}

/** The ledger as a test sees it: looser than `Ledger` in init/ledger.ts, because tests write ledgers it refuses. */
export type LedgerJson = {
  formatVersion?: number;
  touchPoints: { id: string; file: string; mode: string; sha256: string | null }[];
  files: { path: string; sha256: string }[];
  productLayer: { app: string; name: string; path: string };
  loupe?: { package: string; version: string };
  [key: string]: unknown;
};

/** Changes the ledger the way a person or an older Loupe could have left it. */
export function editLedger(root: string, change: (ledger: LedgerJson) => void): void {
  const file = join(root, LEDGER);
  const ledger = JSON.parse(readFileSync(file, "utf8")) as LedgerJson;
  change(ledger);
  writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);
}

type Copies = { app: string; layer: string };

/** What `pnpm install` leaves behind after `init`: the app's copy of Loupe, and the Product layer's own. */
export function link(root: string, copies: Copies = { app: version, layer: version }): void {
  const pkg = (dir: string, json: object) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, "package.json"), JSON.stringify(json));
  };
  pkg("apps/web/node_modules/@danarocha/loupe", { name: "@danarocha/loupe", version: copies.app });
  pkg("apps/web/node_modules/@repo/loupe", { name: "@repo/loupe" });
  pkg("packages/loupe/node_modules/@danarocha/loupe", { name: "@danarocha/loupe", version: copies.layer });
  for (const name of ["@repo/design-system", "next", "react"]) pkg(`packages/loupe/node_modules/${name}`, { name });
}

/** The person's half of an upgrade: the version bump in the app's package.json (pnpm install updates the lockfile too). */
export function bump(root: string, to: string): void {
  const file = join(root, "apps/web/package.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.devDependencies["@danarocha/loupe"] = to;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

export type InstallOptions = {
  /** Written over `installable`, as `makeRepo` takes them; `null` deletes a path. */
  files?: Files;
  /** The Loupe version that runs `loupe init`; this build's by default. */
  at?: string;
  /** Records the package-json hash the way Loupe 0.0.4 and earlier did, with the Loupe version in it. */
  oldHash?: boolean;
  /** Leaves what `pnpm install` leaves in node_modules, at the version that ran init. */
  link?: boolean;
};

/**
 * A committed repo with `loupe init` run on it and its writes committed too, as a person who just installed Loupe
 * has it. `start` is the commit before init. The lockfile is left as init found it; a test that needs
 * `pnpm install`'s changes to it makes them.
 */
export async function installedRepo(options: InstallOptions = {}): Promise<{ root: string; start: string }> {
  const root = committedRepo(options.files);
  const start = git(root, "rev-parse", "HEAD").trim();
  const init = await cli(root, ["init"], { version: options.at });
  if (init.code !== 0) throw new Error(`loupe init exited with ${init.code}:\n${init.text}`);
  if (options.oldHash) recordHashTheOldWay(root);
  if (options.link) link(root, { app: options.at ?? version, layer: options.at ?? version });
  commit(root, "init");
  return { root, start };
}

function recordHashTheOldWay(root: string): void {
  editLedger(root, (ledger) => {
    const recorded = ledger.loupe?.version;
    if (recorded === undefined) throw new Error("the ledger records no Loupe version");
    const hash = createHash("sha256")
      .update(JSON.stringify([["@danarocha/loupe", recorded], ["@repo/loupe", "workspace:*"]]))
      .digest("hex");
    for (const entry of ledger.touchPoints) if (entry.id === "package-json") entry.sha256 = hash;
  });
}

type CliOptions = {
  /** Answers to the questions it asks, in order; "" once they run out. */
  answers?: string[];
  /** Stands in for `pnpm install` during `loupe remove`. Not used with `version`, which covers `init` and `doctor` only. */
  install?: (root: string) => number;
  /** Stands in for `next build` during `loupe doctor --build`. */
  build?: BuildRunner;
  /** Runs `init` or `doctor` as this Loupe version would; `run` itself can't carry one. */
  version?: string;
};

/** `loupe <argv>` at `root`, with everything it printed and every question it asked. */
export async function cli(root: string, argv: readonly string[], options: CliOptions = {}) {
  const out: string[] = [];
  const questions: string[] = [];
  const answers = [...(options.answers ?? [])];
  const io = {
    out: (line: string) => out.push(line),
    err: (line: string) => out.push(line),
    ask: async (question: string) => {
      questions.push(question);
      return answers.shift() ?? "";
    },
    cwd: root,
    nodeVersion: "22.22.2",
  };
  const code =
    options.version === undefined
      ? await run(argv, { ...io, install: options.install, build: options.build })
      : await runAs(options.version, argv, io, options.build);
  return { code, text: out.join("\n"), questions };
}

async function runAs(pinned: string, argv: readonly string[], io: Parameters<typeof runInit>[1], build?: BuildRunner): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "init") {
    const parsed = parseInitArgs(rest);
    if (typeof parsed === "string") throw new Error(parsed);
    return runInit(parsed, { ...io, version: pinned });
  }
  if (command === "doctor") {
    const parsed = parseDoctorArgs(rest);
    if (typeof parsed === "string") throw new Error(parsed);
    return runDoctor(parsed, { out: io.out, err: io.err, cwd: io.cwd, nodeVersion: io.nodeVersion, version: pinned, build });
  }
  throw new Error(`cli can pin a Loupe version for init and doctor, not for ${command}`);
}
