// The app's package.json: Loupe's npm package and the Product layer, as devDependencies.

// jsonc-parser ships UMD as `main`, which Node can't read named exports from.
import jsonc from "jsonc-parser";
import { NPM_PACKAGE, type TouchPoint } from "../touch-points.js";
import { type Candidates, isRecord, jsonFormatting, readObject, revertTo } from "./shared.js";

/** `wanted`: each devDependency Loupe adds, and the version it adds. */
export function packageJson(file: string, wanted: Record<string, string>): TouchPoint {
  const names = Object.keys(wanted).sort();
  const tp: TouchPoint = {
    id: "package-json",
    file,
    applyByHand: [
      `In ${file}, add to "devDependencies", keeping its alphabetical order:`,
      ...names.map((n) => `  "${n}": "${wanted[n]}",`),
    ],
    revertByHand: `remove ${names.join(" and ")} from "devDependencies", then run pnpm install`,
    find(text) {
      const dev = readObject(text)?.devDependencies;
      if (!isRecord(dev) || !names.every((n) => typeof dev[n] === "string")) return undefined;
      // Loupe's version stays out of the hash, so a version bump never reads as drift.
      const pairs = names.map((n) => (n === NPM_PACKAGE ? [n] : [n, dev[n]]));
      return {
        canonical: JSON.stringify(pairs),
        exact: names.every((n) => dev[n] === wanted[n]),
        legacy: (version) => JSON.stringify(names.map((n) => [n, n === NPM_PACKAGE ? version : dev[n]])),
      };
    },
    apply(text) {
      if (text === undefined) return { unexpected: `${file} doesn't exist.` };
      const json = readObject(text);
      if (!json) return { unexpected: `${file} isn't a JSON object.` };
      if (json.devDependencies !== undefined && !isRecord(json.devDependencies)) {
        return { unexpected: `"devDependencies" in ${file} isn't an object.` };
      }
      for (const field of ["dependencies", "devDependencies"] as const) {
        const deps = json[field];
        if (!isRecord(deps)) continue;
        for (const name of names) {
          if (deps[name] === undefined) continue;
          if (field === "dependencies") return { unexpected: `${name} is already in "dependencies".` };
          if (deps[name] !== wanted[name]) return { unexpected: `${name} is already "${String(deps[name])}".` };
        }
      }
      const options = jsonFormatting(text);
      let next = text;
      const added: string[] = [];
      for (const name of names) {
        const dev = readObject(next)?.devDependencies;
        if (isRecord(dev) && dev[name] !== undefined) continue;
        const edits = jsonc.modify(next, ["devDependencies", name], wanted[name], {
          formattingOptions: options,
          getInsertionIndex: (keys) => {
            const at = keys.findIndex((k) => k > name);
            return at === -1 ? keys.length : at;
          },
        });
        next = jsonc.applyEdits(next, edits);
        added.push(name);
      }
      return { text: next, summary: `added ${added.join(" and ")} to devDependencies` };
    },
    revert(text) {
      return revertTo(tp, text, candidates(text, names), "removed the two Loupe devDependencies");
    },
  };
  return tp;
}

function candidates(text: string, names: string[]): Candidates {
  const options = jsonFormatting(text);
  let next = text;
  for (const name of names) {
    next = jsonc.applyEdits(next, jsonc.modify(next, ["devDependencies", name], undefined, { formattingOptions: options }));
  }
  const dev = (jsonc.parse(next) as { devDependencies?: unknown } | undefined)?.devDependencies;
  // An emptied "devDependencies" redoes the same as none at all; none is likelier, as apply creates it.
  if (dev && typeof dev === "object" && Object.keys(dev).length === 0) {
    const without = jsonc.applyEdits(next, jsonc.modify(next, ["devDependencies"], undefined, { formattingOptions: options }));
    return { candidates: [without, next], fallback: next };
  }
  return { candidates: [next], fallback: next };
}
