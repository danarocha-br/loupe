import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { run } from "./cli.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

async function capture(argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { code, out, err };
}

describe("loupe CLI", () => {
  it.each([["--version"], ["-v"]])("%s prints the package version alone", async (flag) => {
    expect(await capture([flag])).toEqual({ code: 0, out: [version], err: [] });
  });

  it("prints usage with no arguments", async () => {
    const { code, out } = await capture([]);
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Usage: loupe");
  });

  it("refuses an unknown command", async () => {
    const { code, err } = await capture(["frobnicate"]);
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("Unknown command: frobnicate");
  });
});
