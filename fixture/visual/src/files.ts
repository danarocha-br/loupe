// A recording's files, one definition for the recorder that writes them and the diff that
// reads them: `scenes.json` lists the scenes, `<scene>.json` holds a scene's snapshot and
// `<scene>~<root>.png` a root's screenshot.

import { join } from "node:path";

const slug = (name: string) => name.replace(/[^\w@.-]+/g, "-").replace(/^-|-$/g, "");

export const manifestFile = (dir: string) => join(dir, "scenes.json");
export const sceneFile = (dir: string, scene: string) => join(dir, `${slug(scene)}.json`);
export const shotName = (scene: string, root: string) => `${slug(scene)}~${slug(root)}.png`;
export const shotFile = (dir: string, scene: string, root: string) => join(dir, shotName(scene, root));
