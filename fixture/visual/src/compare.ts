// Diffs two recordings: every scene's structural snapshot (boxes, computed styles, pseudo
// elements, text, ARIA) and every root's screenshot. Structure is the verdict and the detail;
// the pixels catch what the properties don't name (an SVG path, a glyph, a gradient's stops).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { type Entry, type Root } from "./snapshot.ts";
import type { Recording } from "./record.ts";
import { slug } from "./record.ts";

/** Subpixel layout lands a box 0.01–0.02px off when its origin moves by a fraction; 1px is far above this. */
export const BOX_TOLERANCE = 0.05;

/**
 * Skia can antialias the same rounded corner 1/255 apart from one run to the next (seen on
 * a Card's corner at 20px, dark). The structure names every colour exactly, so a pixel
 * counts as changed only when a channel moves by more than this.
 */
export const CHANNEL_TOLERANCE = 3;

export type SceneReport = { scene: string; differences: string[]; pixels: string[] };
export type Report = { scenes: SceneReport[]; added: string[]; removed: string[]; elements: number; images: number };

const readScenes = (dir: string): string[] => (existsSync(join(dir, "scenes.json")) ? JSON.parse(readFileSync(join(dir, "scenes.json"), "utf8")) : []);
const readScene = (dir: string, scene: string): Recording => JSON.parse(readFileSync(join(dir, `${slug(scene)}.json`), "utf8"));

function diffValues(label: string, names: string[], a: string[] | undefined, b: string[] | undefined, out: string[]): void {
  if (!a && !b) return;
  if (!a || !b) {
    out.push(`${label}: ${a ? "gone" : "new"}`);
    return;
  }
  const changed = names.flatMap((name, i) => (a[i] === b[i] ? [] : [`${name}: ${a[i]} → ${b[i]}`]));
  if (changed.length) out.push(`${label} ${changed.join("; ")}`);
}

function diffEntry(key: string, a: Entry, b: Entry, base: Recording, head: Recording, out: string[]): void {
  if (a.box || b.box) {
    const moved = !a.box || !b.box || a.box.some((v, i) => Math.abs(v - (b.box?.[i] ?? NaN)) > BOX_TOLERANCE);
    if (moved) out.push(`${key} box: [${a.box?.join(", ") ?? "none"}] → [${b.box?.join(", ") ?? "none"}]`);
  }
  // A property list that changed between recorders would misalign the values: map them by name.
  const css = (rec: Recording, e: Entry) => Object.fromEntries(rec.props.map((p, i) => [p, e.css[i]]));
  const ca = css(base, a);
  const cb = css(head, b);
  const props = [...new Set([...base.props, ...head.props])];
  diffValues(`${key} css`, props, props.map((p) => ca[p] ?? ""), props.map((p) => cb[p] ?? ""), out);
  diffValues(`${key} ::before`, head.pseudo, a.before, b.before, out);
  diffValues(`${key} ::after`, head.pseudo, a.after, b.after, out);
  if ((a.text ?? "") !== (b.text ?? "")) out.push(`${key} text: ${JSON.stringify(a.text ?? "")} → ${JSON.stringify(b.text ?? "")}`);
  if ((a.aria ?? "") !== (b.aria ?? "")) out.push(`${key} aria: ${a.aria ?? "(none)"} → ${b.aria ?? "(none)"}`);
}

function diffRoot(name: string, a: Root, b: Root, base: Recording, head: Recording, out: string[]): number {
  if (a.host.join() !== b.host.join()) out.push(`${name} host size: ${a.host.join(" × ")} → ${b.host.join(" × ")}`);
  const keys = new Set([...Object.keys(a.entries), ...Object.keys(b.entries)]);
  for (const key of keys) {
    const x = a.entries[key];
    const y = b.entries[key];
    if (!x || !y) out.push(`${key}: only in ${x ? "base" : "head"}`);
    else diffEntry(key, x, y, base, head, out);
  }
  const ariaA = base.aria[name] ?? "";
  const ariaB = head.aria[name] ?? "";
  if (ariaA !== ariaB) {
    const la = ariaA.split("\n");
    const lb = ariaB.split("\n");
    const at = la.findIndex((line, i) => line !== lb[i]);
    const i = at < 0 ? la.length : at;
    out.push(`${name} ARIA tree, line ${i + 1}: ${JSON.stringify(la[i] ?? "")} → ${JSON.stringify(lb[i] ?? "")}`);
  }
  return keys.size;
}

/** Counts the pixels that differ and draws them red over a faded copy of the head's image. */
async function pixels(page: Page, a: Buffer, b: Buffer): Promise<{ size: string; differing: number; total: number; diff?: string }> {
  return page.evaluate(
    async ([a64, b64, tolerance]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("an image didn't decode"));
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(`data:image/png;base64,${a64}`), load(`data:image/png;base64,${b64}`)]);
      const size = `${ia.width} × ${ia.height} → ${ib.width} × ${ib.height}`;
      const data = (img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      };
      if (ia.width !== ib.width || ia.height !== ib.height) return { size, differing: -1, total: ib.width * ib.height };
      const da = data(ia);
      const db = data(ib);
      const out = new ImageData(ib.width, ib.height);
      let differing = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        let same = true;
        for (let c = 0; c < 4; c++) if (Math.abs(da.data[i + c]! - db.data[i + c]!) > tolerance) same = false;
        if (!same) differing++;
        const grey = (db.data[i]! + db.data[i + 1]! + db.data[i + 2]!) / 3;
        out.data.set(same ? [grey, grey, grey, 50] : [255, 0, 0, 255], i);
      }
      const canvas = document.createElement("canvas");
      canvas.width = ib.width;
      canvas.height = ib.height;
      canvas.getContext("2d")!.putImageData(out, 0, 0);
      return { size, differing, total: ib.width * ib.height, diff: differing ? canvas.toDataURL("image/png").split(",")[1] : undefined };
    },
    [a.toString("base64"), b.toString("base64"), CHANNEL_TOLERANCE] as const,
  );
}

/** Compares `base` with `head`; `only` keeps the scenes whose name starts with it. Diff images go to `diffDir`. */
export async function compare(baseDir: string, headDir: string, diffDir: string, only?: string): Promise<Report> {
  const wanted = (scene: string) => !only || scene.startsWith(only);
  const baseScenes = readScenes(baseDir).filter(wanted);
  const headScenes = readScenes(headDir).filter(wanted);
  const report: Report = {
    scenes: [],
    added: headScenes.filter((s) => !baseScenes.includes(s)),
    removed: baseScenes.filter((s) => !headScenes.includes(s)),
    elements: 0,
    images: 0,
  };
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const scene of baseScenes.filter((s) => headScenes.includes(s))) {
      const base = readScene(baseDir, scene);
      const head = readScene(headDir, scene);
      const differences: string[] = [];
      const shots: string[] = [];
      for (const name of new Set([...Object.keys(base.roots), ...Object.keys(head.roots)])) {
        const a = base.roots[name];
        const b = head.roots[name];
        if (!a || !b) {
          differences.push(`${name}: the root is only in ${a ? "base" : "head"}`);
          continue;
        }
        report.elements += diffRoot(name, a, b, base, head, differences);
        const file = `${slug(scene)}~${slug(name)}.png`;
        const pa = readFileSync(join(baseDir, file));
        const pb = readFileSync(join(headDir, file));
        report.images++;
        if (pa.equals(pb)) continue;
        const result = await pixels(page, pa, pb);
        if (result.differing === -1) shots.push(`${name}: the screenshot's size changed, ${result.size}`);
        else if (result.differing > 0) {
          const out = join(diffDir, file);
          writeFileSync(out, Buffer.from(result.diff!, "base64"));
          shots.push(`${name}: ${result.differing} of ${result.total} pixels differ (${out})`);
        }
      }
      if (differences.length || shots.length) report.scenes.push({ scene, differences, pixels: shots });
    }
  } finally {
    await browser.close();
  }
  return report;
}

/** The report as Markdown: every difference, scene by scene. */
export function markdown(report: Report, title: string): string {
  const lines = [`# ${title}`, ""];
  const failed = report.scenes.length + report.removed.length;
  lines.push(failed ? `**${failed} scene(s) differ.**` : "**No difference.**", "");
  lines.push(`Compared ${report.elements} elements and ${report.images} screenshots.`, "");
  if (report.removed.length) lines.push("## Scenes only in the base", "", ...report.removed.map((s) => `- ${s}`), "");
  if (report.added.length) lines.push("## Scenes only in the head (new, not compared)", "", ...report.added.map((s) => `- ${s}`), "");
  for (const s of report.scenes) {
    lines.push(`## ${s.scene}`, "");
    for (const p of s.pixels) lines.push(`- pixels: ${p}`);
    for (const d of s.differences) lines.push(`- ${d}`);
    lines.push("");
  }
  return lines.join("\n");
}
