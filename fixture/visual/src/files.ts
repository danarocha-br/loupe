// A recording's files, one definition for the recorder that writes them and the diff that
// reads them: `scenes.json` lists the scenes, `skipped.json` those a lenient recording couldn't
// drive and why, `<scene>.json` holds a scene's snapshot and
// `<scene>~<root>.png` a root's screenshot.

import { join } from "node:path";

const slug = (name: string) => name.replace(/[^\w@.-]+/g, "-").replace(/^-|-$/g, "");

export const manifestFile = (dir: string) => join(dir, "scenes.json");
export const skippedFile = (dir: string) => join(dir, "skipped.json");
export const sceneFile = (dir: string, scene: string) => join(dir, `${slug(scene)}.json`);
export const shotName = (scene: string, root: string) => `${slug(scene)}~${slug(root)}.png`;
export const shotFile = (dir: string, scene: string, root: string) => join(dir, shotName(scene, root));

/** Whether `scene` is one `--only` keeps: it starts with one of its prefixes, separated by commas. */
export const selects = (only: string | undefined, scene: string) => !only || only.split(",").some((prefix) => scene.startsWith(prefix.trim()));

/** Whether any scene under `prefix` may be one `--only` keeps. */
export const mayselect = (only: string | undefined, prefix: string) =>
  !only || only.split(",").some((p) => prefix.startsWith(p.trim()) || p.trim().startsWith(prefix));
