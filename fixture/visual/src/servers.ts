// The servers a tree is recorded from: `@loupe/ui`'s and `@loupe/patterns`' workbenches (each
// package's own `dev` script) and the fixture (`next dev`, the only phase the Toolbar runs in).
// Each run starts its own, on ports it first checks are free, and stops them, so the check never
// measures a server some other checkout started.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

/** Each package's workbench, by its folder in `packages/`, on a port of the check's own. */
const WORKBENCH_PORTS = { ui: 3300, patterns: 3320 } as const;
export type Workbench = keyof typeof WORKBENCH_PORTS;
const FIXTURE_PORT = 3310;
const PORTS = [WORKBENCH_PORTS.ui, FIXTURE_PORT, WORKBENCH_PORTS.patterns].join(", ");
const HOST = "127.0.0.1";

export type Server = { url: string; stop: () => Promise<void> };

/** Every server still running, so an interrupted run (Ctrl+C) can stop them: see `stopAll`. */
const running = new Set<Server>();

export async function stopAll(): Promise<void> {
  await Promise.all([...running].map((server) => server.stop()));
}

const exited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

/** Stops a server and everything it forked: it is started in a process group of its own. */
function stopper(child: ChildProcess): () => Promise<void> {
  return () =>
    new Promise((resolve) => {
      if (exited(child) || child.pid === undefined) return resolve();
      const pid = child.pid;
      const kill = (signal: NodeJS.Signals) => {
        try {
          process.kill(-pid, signal);
        } catch {
          // Gone already, or no group: the child alone.
          try {
            child.kill(signal);
          } catch {
            // Gone.
          }
        }
      };
      const force = setTimeout(() => kill("SIGKILL"), 5000);
      child.once("exit", () => {
        clearTimeout(force);
        resolve();
      });
      kill("SIGTERM");
    });
}

/** Whether nothing listens on the port yet: a server already there would answer for ours. */
function free(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, HOST);
  });
}

/** Waits for a 2xx from `url`, each request bounded by what is left of the deadline. */
async function waitFor(url: string, child: ChildProcess, log: () => string, timeoutMs: number): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (exited(child)) throw new Error(`the server for ${url} exited (${child.exitCode ?? child.signalCode}):\n${log()}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, end - Date.now())) });
      if (response.ok) return;
    } catch {
      // Not listening yet, or not answering in time.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no answer from ${url} in ${timeoutMs / 1000}s:\n${log()}`);
}

async function start(command: string, args: string[], cwd: string, port: number, paths: string[], timeoutMs: number): Promise<Server> {
  if (!(await free(port))) throw new Error(`port ${port} is taken. The visual check serves each tree on ${PORTS}: stop whatever listens there (another run of the check?).`);
  const child = spawn(command, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  let output = "";
  const keep = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-8000);
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  const url = `http://${HOST}:${port}/`;
  const server: Server = { url, stop: stopper(child) };
  running.add(server);
  const stop = server.stop;
  server.stop = async () => {
    running.delete(server);
    await stop();
  };
  try {
    // The first path is the server's root; the others are compiled before a browser waits on them.
    for (const path of paths) await waitFor(`${url}${path}`, child, () => output, timeoutMs);
  } catch (error) {
    await server.stop();
    throw error;
  }
  return server;
}

/**
 * Whether `root` has the package's workbench to serve: its `dev` script. `@loupe/ui`'s since
 * ADR 0011 (#88), `@loupe/patterns`' since ADR 0012; a base older than either records without it.
 */
export function hasWorkbench(root: string, name: Workbench): boolean {
  const manifest = join(root, "packages", name, "package.json");
  return existsSync(manifest) && Boolean(JSON.parse(readFileSync(manifest, "utf8")).scripts?.dev);
}

/** A package's workbench, through its own `dev` script, on the check's port for it. */
export function startWorkbench(root: string, name: Workbench): Promise<Server> {
  const port = WORKBENCH_PORTS[name];
  return start("pnpm", ["run", "dev", "--port", String(port), "--strictPort", "--host", HOST], join(root, "packages", name), port, [""], 60_000);
}

/**
 * Throws when a `next dev` holds the fixture of `root`. Next 16 locks a project's dev server
 * (`.next/dev/lock`), and a build of Loupe under a running one breaks it, so the check asks
 * for it to be stopped before it builds anything.
 */
export function assertFixtureFree(root: string): void {
  const lock = join(root, "fixture/app/.next/dev/lock");
  if (!existsSync(lock)) return;
  let info: { pid?: number; appUrl?: string } = {};
  try {
    info = JSON.parse(readFileSync(lock, "utf8"));
  } catch {
    // An empty or old lock: Next takes it over if nothing holds it.
  }
  if (!info.pid) return;
  try {
    process.kill(info.pid, 0);
  } catch {
    return; // Not running: a stale lock.
  }
  throw new Error(`a next dev server is running on the fixture in ${root} (pid ${info.pid}, ${info.appUrl ?? "port unknown"}). Stop it first: the check builds Loupe and starts its own.`);
}

/** `next dev` on the fixture, its home page compiled before a browser waits on it. */
export function startFixture(root: string): Promise<Server> {
  assertFixtureFree(root);
  const cwd = join(root, "fixture/app");
  const args = ["dev", "--port", String(FIXTURE_PORT), "--hostname", HOST];
  return start(join(cwd, "node_modules/.bin/next"), args, cwd, FIXTURE_PORT, [""], 180_000);
}
