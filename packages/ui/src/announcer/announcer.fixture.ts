// For tests: what a surface's announcer reads out. A view's test listens on its shadow
// root, acts, and checks the messages, each by politeness, found by the regions' roles.

/** The messages read out since `listen()`, oldest first: the same one twice is there twice. */
export type Heard = { polite: string[]; assertive: string[]; stop(): void };

function region(root: ParentNode, role: "status" | "alert"): Element {
  const found = root.querySelectorAll(`[role="${role}"]`);
  // One region of each in a surface: a second would be a live region a view wrote itself.
  if (found.length !== 1) throw new Error(`Expected the announcer's one role="${role}" region, found ${found.length}.`);
  return found[0] as Element;
}

/** Starts recording each message the announcer in `root` (a surface's shadow root) writes. */
export function listen(root: ParentNode): Heard {
  const heard: Heard = { polite: [], assertive: [], stop: () => {} };
  const observers = (["polite", "assertive"] as const).map((politeness) => {
    const element = region(root, politeness === "polite" ? "status" : "alert");
    // Each write adds the message's text: counted from the records, so two writes before
    // the observer runs (fake timers) are still two.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node.textContent) heard[politeness].push(node.textContent);
      }
    });
    observer.observe(element, { childList: true, subtree: true });
    return observer;
  });
  heard.stop = () => {
    for (const observer of observers) observer.disconnect();
  };
  return heard;
}
