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

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

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

/** Where a message comes from: each `useAnnounce()` (and so each `useAnnounceChange()`) is a place of its own. */
type From = object;

/** Has the region read `text`, said from `from`. */
type Say = (from: From, text: string, options?: AnnounceOptions) => void;

/** Outside a surface (a unit test of a view drawn bare) there is no one to hear: nothing happens. */
const SayContext = createContext<Say>(() => {});

/** A region's messages waiting to be written together, and its timers. */
type Pending = { messages: { from: From; text: string }[]; write?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> };

/**
 * The messages that came in one wait, as the region reads them: in the order they came, the
 * same words once, each ended as a sentence, so a screen reader pauses between them
 * ("Reset 2 Overrides. Scope: All on page. Reaches 7 of 7.").
 */
function joinMessages(texts: readonly string[]): string {
  const unique = [...new Set(texts)];
  return unique.map((text, index) => (index < unique.length - 1 && !/[.!?…:;]$/.test(text) ? `${text}.` : text)).join(" ");
}

/** The surface's two regions, after `children`, and the `announce` every view below reaches. */
export function Announcer({ children }: { children?: ReactNode }) {
  const polite = useRef<HTMLDivElement>(null);
  const assertive = useRef<HTMLDivElement>(null);
  const pending = useRef<Record<Politeness, Pending>>({ polite: { messages: [] }, assertive: { messages: [] } });

  const say = useCallback<Say>((from, text, { politeness = "polite" } = {}) => {
    const ref = politeness === "assertive" ? assertive : polite;
    const said = text.replace(/\s+/g, " ").trim();
    if (said === "") return;
    const waiting = pending.current[politeness];
    // A newer message from the same place replaces its own that isn't written yet (a count
    // that moved twice); one from another place joins it, so two views speaking in one
    // commit are both heard.
    const own = waiting.messages.findIndex((message) => message.from === from);
    if (own === -1) waiting.messages.push({ from, text: said });
    else waiting.messages[own] = { from, text: said };
    if (waiting.write !== undefined) return;
    clearTimeout(waiting.clear);
    if (ref.current) ref.current.textContent = "";
    // The region is read when the message is written, not now: a child that fails as it
    // first mounts says so before the regions, which come after it, are in the page.
    waiting.write = setTimeout(() => {
      waiting.write = undefined;
      const texts = waiting.messages.map((message) => message.text);
      waiting.messages = [];
      const region = ref.current;
      if (!region) return;
      region.textContent = joinMessages(texts);
      waiting.clear = setTimeout(() => {
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
    <SayContext.Provider value={say}>
      {children}
      <div {...{ [ANNOUNCER_ATTRIBUTE]: "" }}>
        <div ref={polite} role="status" aria-live="polite" aria-atomic="true" />
        <div ref={assertive} role="alert" aria-live="assertive" aria-atomic="true" />
      </div>
    </SayContext.Provider>
  );
}

/** The surface's `announce`, for something that happened: a copy landed, a write failed. */
export function useAnnounce(): Announce {
  const say = useContext(SayContext);
  // This call's own place: its newer message replaces its older one, another's joins it.
  const [from] = useState<From>(() => ({}));
  return useCallback<Announce>((text, options) => say(from, text, options), [say, from]);
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
