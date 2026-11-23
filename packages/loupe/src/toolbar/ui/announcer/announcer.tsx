// Announcer (ADR 0003, ADR 0008): the one place a surface speaks to a screen reader.
// Two live regions, one polite and one assertive, mounted once in the surface before
// any message, and empty until one comes. A view never writes a live region of its own:
// it calls `useAnnounce()` for something that happened, or `useAnnounceChange()` for text
// it shows that changes. See announcer.md.
//
// UI SDK has an `announce()`, but it writes its regions into `document.body`, the host's
// own DOM, which Loupe never touches outside its shadow root; and `setAnnouncer()` would
// take over the host's announcements too wherever the host shares UI SDK's module. So
// this is Loupe's own, with UI SDK's timing.

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";

/** `polite` waits for the screen reader to finish; `assertive` interrupts it. */
export type Politeness = "polite" | "assertive";

export type AnnounceOptions = { politeness?: Politeness };

/** Has the surface's screen reader read `text`. Empty text says nothing. */
export type Announce = (text: string, options?: AnnounceOptions) => void;

/**
 * The region is emptied, then written this much later, so the same text twice is two
 * additions, and read twice. UI SDK's `announce()` waits the same.
 */
export const WRITE_AFTER_MS = 100;

/**
 * A message is emptied this long after it is written: long enough for a screen reader
 * that is busy to come to it, short enough that someone reading the page line by line
 * doesn't find a stale one at the end of the surface.
 */
export const CLEAR_AFTER_MS = 7000;

/** On the regions' wrapper: how `announcer.css` hides them. */
const ANNOUNCER_ATTRIBUTE = "data-announcer";

/** Outside a surface (a unit test of a view drawn bare) there is no one to hear: nothing happens. */
const AnnounceContext = createContext<Announce>(() => {});

type Pending = { write?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> };

/** The surface's two regions, after `children`, and the `announce` every view below reaches. */
export function Announcer({ children }: { children?: ReactNode }) {
  const polite = useRef<HTMLDivElement>(null);
  const assertive = useRef<HTMLDivElement>(null);
  const pending = useRef<Record<Politeness, Pending>>({ polite: {}, assertive: {} });

  const announce = useCallback<Announce>((text, { politeness = "polite" } = {}) => {
    const region = (politeness === "assertive" ? assertive : polite).current;
    const said = text.replace(/\s+/g, " ").trim();
    if (!region || said === "") return;
    // A newer message replaces one not yet read: one region, one message at a time.
    const timers = pending.current[politeness];
    clearTimeout(timers.write);
    clearTimeout(timers.clear);
    region.textContent = "";
    timers.write = setTimeout(() => {
      region.textContent = said;
      timers.clear = setTimeout(() => {
        region.textContent = "";
      }, CLEAR_AFTER_MS);
    }, WRITE_AFTER_MS);
  }, []);

  useEffect(
    () => () => {
      for (const timers of Object.values(pending.current)) {
        clearTimeout(timers.write);
        clearTimeout(timers.clear);
      }
    },
    [],
  );

  // The regions' text is written here, never rendered: React leaves an element with no children alone.
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div {...{ [ANNOUNCER_ATTRIBUTE]: "" }}>
        <div ref={polite} role="status" aria-live="polite" aria-atomic="true" />
        <div ref={assertive} role="alert" aria-live="assertive" aria-atomic="true" />
      </div>
    </AnnounceContext.Provider>
  );
}

/** The surface's `announce`, for something that happened: a copy landed, a write failed. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}

/**
 * Announces `text` each time it changes, or each time `key` changes when one is given
 * (an offer made again in the same words), unless it is empty. What a view shows as it
 * mounts is read with the view, so it isn't announced.
 */
export function useAnnounceChange(text: string, { politeness, key }: AnnounceOptions & { key?: unknown } = {}): void {
  const announce = useAnnounce();
  const trigger = key === undefined ? text : key;
  // The last trigger seen, not a first-run flag: Strict Mode runs an effect twice on mount.
  const last = useRef(trigger);
  useEffect(() => {
    if (Object.is(last.current, trigger)) return;
    last.current = trigger;
    announce(text, { politeness });
  });
}
