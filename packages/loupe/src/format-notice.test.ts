import { describe, expect, it } from "vitest";
import { missingLayerAdvice } from "./format-notice.js";

const COMMAND = "pnpm -C apps/app exec loupe generate --design-system <dir> --app <dir>";

describe("missingLayerAdvice (PER-227)", () => {
  it("puts git first, keeps regenerating for an intact Product layer, and asks for no restart", () => {
    const advice = missingLayerAdvice(COMMAND);
    expect(advice.startsWith("Restore it with git. If the rest of the Product layer is intact, write it again with ")).toBe(true);
    // The loader depends on adapt-list.json even while it is gone, so Instances return when the file does.
    expect(advice).not.toMatch(/restart/i);
    expect(advice.endsWith("(. is the app itself).")).toBe(true);
  });

  it("points at the command by itself, or by the reference a card gives it", () => {
    expect(missingLayerAdvice(COMMAND)).toContain(`write it again with ${COMMAND}, replacing`);
    expect(missingLayerAdvice(COMMAND, "the command below")).toContain("write it again with the command below, replacing");
    expect(missingLayerAdvice(COMMAND, "the command below")).not.toContain("pnpm");
  });

  it("says what to put in <dir>: a path from the app folder, not from the repo root", () => {
    expect(missingLayerAdvice(COMMAND)).toContain("replacing each <dir> with a path from the app folder (. is the app itself)");
  });

  it("explains <name> only for a command that asks for the specifier", () => {
    expect(missingLayerAdvice(COMMAND)).not.toContain("<name>");
    const advice = missingLayerAdvice(`${COMMAND} --specifier <name>`, "the command below");
    expect(advice).toContain("and <name> with the path the app imports the Product layer by");
  });
});
