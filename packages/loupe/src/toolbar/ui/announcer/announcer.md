# Announcer

The one place a surface speaks to a screen reader (ADR 0008). Two live regions, one polite and one assertive, mounted once in the surface: in the Toolbar's shadow root from the collapsed pill on, and in every `<Surface>` frame of the workbench and the tests. They are there, empty, before the first message, since some screen readers only hear a region that existed before its text changed. No view writes a live region of its own.

```tsx
const announce = useAnnounce();
announce(copiedText(title)); // something that happened
announce(reason, { politeness: "assertive" }); // something that failed and needs the person

useAnnounceChange(footer.countText); // text a view shows, said as it changes
useAnnounceChange(offer?.text ?? "", { key: offer }); // said each time it is made, the same words included
```

## Interface

- `Announcer`: the surface mounts it around what it draws (`surface/index.tsx`, `index.tsx`). It renders its children, then the two regions.
- `useAnnounce()` returns `announce(text, { politeness })`. Empty text, or text that is only spaces, says nothing. Outside a surface it does nothing and throws nothing.
- `useAnnounceChange(text, { politeness, key })` says `text` each time it changes, or each time `key` changes when one is given, unless it is empty. What a view shows as it mounts is read with the view, so it isn't said.
- For tests, `announcer.fixture.ts` exports `listen(root)`: it finds the regions by role in a surface's shadow root (and throws unless there is exactly one of each), and records each message written, by politeness, oldest first.

## Polite or assertive

- **Polite** (the default) waits until the screen reader has finished. Use it for a result or a change of state: a copy landed, a count changed, an undo offer was made, a mode was armed, the app pushed back on a held value, a notice appeared.
- **Assertive** interrupts. Use it only when what the person just asked for failed and they have to do something else: a copy the browser refused, a command the clipboard refused, a flag the server wouldn't write, a missing title they pressed Copy with, a Product layer that is gone. Never for success or progress.

## Visible text and the announcer

Text on screen can stay on screen (the status strip, the footer's count and undo offer, a refused command's sentence, the toast, the held notice). It carries no live role: the view says it through the announcer, so it is heard once.

- Don't announce what focus already reads. When focus moves to the thing that changed (a popover's Try again, a field with its error as its description), say only what focus doesn't read: the reason a copy failed, not the popover's title. A Field's error is read with the control when focus moves to it; the caller announces it only when focus is there already (`field.md`).
- A control's own state is read by the control: a radio's "checked", a toggle's "pressed". Don't announce it again.

## Timing, repeats and clearing

| Step | When | Why |
| --- | --- | --- |
| The region is emptied | at once | so that what is written next is an addition |
| The message is written | `WRITE_AFTER_MS` (100ms) later | the same text twice is two additions, read twice: two copies of the same title are two messages (UI SDK's `announce()` waits the same) |
| The message is emptied | `CLEAR_AFTER_MS` (7s) after it was written | someone reading line by line doesn't find a stale message at the end of the surface; a busy screen reader has long since queued it |

One region holds one message. A newer one at the same politeness, before the first was written, replaces it: a view that has two things to say at once says them in one message, or says the one that matters. The footer does this: Reset all makes an offer and changes the count in the same moment, and only the offer ("Reset 2 Overrides") is said; the count is said again once the offer is gone.

Polite and assertive are separate: an assertive message doesn't replace a polite one.

## Why not UI SDK's `announce()`

UI SDK's `announce()` and `prepareAnnouncements()` write their regions into `document.body`: the host's own DOM, outside Loupe's shadow root, which Loupe never touches. Its `setAnnouncer()` replaces the announcer for the whole module, so where a host uses UI SDK too and shares the module, Loupe would take over the host's announcements. So the Announcer is Loupe's own, with UI SDK's timing. UI SDK's `FieldError` announces through that `announce()`, which is why Field draws its error as a description instead.

## ARIA

- `div role="status" aria-live="polite" aria-atomic="true"` and `div role="alert" aria-live="assertive" aria-atomic="true"`, inside `[data-announcer]`, which `announcer.css` hides by size and clipping (never `display` or `visibility`, which take a region out of the accessibility tree).
- No keys, no focus, no name.
- The regions live in a shadow root. Chrome exposes them as live regions from there (its accessibility tree, read over CDP); VoiceOver in Safari and Chrome is a human check (Linear PER-243).
- While an app's modal `<dialog>` is open, everything outside it is inert, Loupe's host too: nothing Loupe says is read until it closes.

## Tests

`announcer.test.tsx` draws it inside a real shadow root and queries the regions by role, with fake timers and axe: present and empty before the first message; written after emptying, by politeness; the same message twice read twice; a newer message replacing a pending one; changes said, mounts not; nothing in the host's document. The views' tests listen with `listen()`.
