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

/** `--only`'s prefixes, separated by commas; an empty one (`states/,`) is no prefix, not every scene. */
const prefixes = (only: string) => only.split(",").map((p) => p.trim()).filter(Boolean);

/** Whether `scene` is one `--only` keeps: it starts with one of its prefixes. */
export const selects = (only: string | undefined, scene: string) => !only || prefixes(only).some((prefix) => scene.startsWith(prefix));

/** Whether any scene under `prefix` may be one `--only` keeps. */
export const mayselect = (only: string | undefined, prefix: string) => !only || prefixes(only).some((p) => prefix.startsWith(p) || p.startsWith(prefix));
