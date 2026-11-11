import { readFileSync } from "node:fs";

// Read from package.json at run time, so the printed version is always the
// one npm installed, whether this runs from `src` (tests) or `dist`.
export const version: string = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;
