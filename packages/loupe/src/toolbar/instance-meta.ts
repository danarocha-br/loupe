// Loads `meta/` for the selected Instance when it has no Adapter (PER-180). Asked
// the first time the inspector shows one and again on each later selection, so a
// `loupe generate` in between shows; never while the panel is hidden, since only
// the open panel mounts this.

import { useEffect } from "react";
import { metaRequestOf, rememberMeta } from "../runtime/instance-meta.js";
import { readInstanceMeta } from "./meta-server.js";
import type { PageSnapshot } from "./page.js";

/** Logged once per message, so a re-selection doesn't repeat it. Lives as long as the page. */
const logged = new Set<string>();

export function useInstanceMeta(page: PageSnapshot, selected: string | null): void {
  const row = selected === null ? undefined : page.rows.find((candidate) => candidate.id === selected);
  // An Adapter carries its own metadata.
  const anchor = row && !row.adapted ? row.anchor : null;
  useEffect(() => {
    const request = anchor === null ? null : metaRequestOf(anchor);
    if (request === null) return;
    let live = true;
    readInstanceMeta([request]).then(
      (results) => {
        if (live && results) rememberMeta([request], results);
      },
      // A restarting dev server refuses the call; the rows stay as they were until the next selection.
      (error: unknown) => {
        const message = `[loupe] Couldn't read meta/ for ${request.component}: ${String(error)}`;
        if (logged.has(message)) return;
        logged.add(message);
        console.warn(message);
      },
    );
    return () => {
      live = false;
    };
  }, [anchor]);
}
