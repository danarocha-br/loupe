// The two servers a tree is recorded from: `@loupe/ui`'s workbench (Vite) and the fixture
// (`next dev`, the only phase the Toolbar runs in). Each run starts its own, on its own
// ports, and stops them, so the check never measures a server some other checkout started.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PORTS = { ui: 3300, fixture: 3310 };

export type Server = { url: string; stop: () => Promise<void> };

/** Stops a server and everything it forked: it is started in a process group of its own. */
function stopper(child: ChildProcess): () => Promise<void> {
  return () =>
    new Promise((resolve) => {
      if (child.exitCode !== null || child.pid === undefined) return resolve();
      child.once("exit", () => resolve());
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {
          // Gone already.
        }
      }, 5000).unref();
    });
}

async function waitFor(url: string, child: ChildProcess, log: () => string, timeoutMs: number): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`the server for ${url} exited (${child.exitCode}):\n${log()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no answer from ${url} in ${timeoutMs / 1000}s:\n${log()}`);
}

function start(command: string, args: string[], cwd: string, url: string, timeoutMs: number, env: NodeJS.ProcessEnv = {}): Promise<Server> {
  const child = spawn(command, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  let output = "";
  const keep = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-8000);
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  const stop = stopper(child);
  return waitFor(url, child, () => output, timeoutMs).then(
    () => ({ url, stop }),
    async (error: unknown) => {
      await stop();
      throw error;
    },
  );
}

/** The ui workbench of `root`, or null where the tree has none yet (before ADR 0011). */
export function hasUiWorkbench(root: string): boolean {
  return existsSync(join(root, "packages/ui/workbench/vite.config.ts"));
}

export function startUi(root: string, port = PORTS.ui): Promise<Server> {
  const cwd = join(root, "packages/ui");
  return start(join(cwd, "node_modules/.bin/vite"), ["--config", "workbench/vite.config.ts", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], cwd, `http://127.0.0.1:${port}/`, 60_000);
}

/**
 * `next dev` on the fixture. Next 16 locks a project's dev server (`.next/dev/lock`), and a
 * build of Loupe under a running one breaks it, so a server already running there is an
 * error to stop, not one to share.
 */
export async function startFixture(root: string, port = PORTS.fixture): Promise<Server> {
  const cwd = join(root, "fixture/app");
  const lock = join(cwd, ".next/dev/lock");
  if (existsSync(lock)) {
    let info: { pid?: number; appUrl?: string } = {};
    try {
      info = JSON.parse(readFileSync(lock, "utf8"));
    } catch {
      // An empty or old lock: Next takes it over if nothing holds it.
    }
    let alive = false;
    if (info.pid) {
      try {
        process.kill(info.pid, 0);
        alive = true;
      } catch {
        // Not running: a stale lock.
      }
    }
    if (alive) throw new Error(`a next dev server is running on the fixture in ${root} (pid ${info.pid}, ${info.appUrl ?? "port unknown"}). Stop it first: the check builds Loupe and starts its own.`);
  }
  const server = await start(join(cwd, "node_modules/.bin/next"), ["dev", "--port", String(port), "--hostname", "127.0.0.1"], cwd, `http://127.0.0.1:${port}/`, 180_000, { NEXT_TELEMETRY_DISABLED: "1" });
  // The first request compiled `/`; compile `/workbench` too before a browser waits on it.
  await waitFor(`${server.url}workbench`, { exitCode: null } as ChildProcess, () => "", 180_000);
  return server;
}
