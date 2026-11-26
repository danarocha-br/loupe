// Where focus goes when the panel takes its control away (DESIGN.md "Focus follows the
// work"): back to the control that opened a view, once Back or Esc returns to the list,
// and to a neighbour when the focused control goes from the view it is in. The list is
// drawn again when it comes back, so a control is kept by what names it, not by its node.

/** A control of the list, by the attributes that name it: never its words, which are the app's and change with an edit. */
export type Place = { tag: string; keys: [string, string][] };

/** The attributes that name a control in the list: a change's number, an Instance (a dot, or a block of the page map), a call site. */
const KEYS = ["data-change", "data-instance", "data-map-block", "data-site-open"] as const;

/** The list's controls that make a selection: a click on one is where a selection was made from. */
export const OPENERS = KEYS.map((key) => `[${key}]`).join(", ");

/** What focus could land on: a control that takes it, not one turned off or folded away. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/** Where `element`, one of the `OPENERS`, is: by its keys alone. */
export function placeOf(element: Element): Place {
  const keys = KEYS.flatMap((key): [string, string][] => {
    const value = element.getAttribute(key);
    return value ? [[key, value]] : [];
  });
  return { tag: element.tagName.toLowerCase(), keys };
}

/** The control at `place` in `root`, drawn again; null once it has gone. */
export function findPlace(root: ParentNode, place: Place): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>(place.tag)) {
    if (place.keys.length > 0 && place.keys.every(([key, value]) => node.getAttribute(key) === value)) return node;
  }
  return null;
}

const folded = (element: Element) => element.closest("[data-fold-panel][hidden]");

/** Focuses `element` and says whether focus took. */
function take(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  element.focus();
  const root = element.getRootNode();
  return (root instanceof ShadowRoot || root instanceof Document) && root.activeElement === element;
}

/**
 * Focus on `target`, or on the row it is folded into: the list comes back with its folds
 * closed, and the row that held the call site is where the keyboard was.
 */
export function focusPlace(target: HTMLElement): boolean {
  const fold = folded(target);
  return take(fold ? fold.closest("[data-fold]")?.querySelector<HTMLElement>("[data-fold-trigger]") : target);
}

/** The control focus had as the panel drew, and the row around it with the rows beside it. */
export type Held = { element: Element; row: Element; next: Element | null; previous: Element | null };

/** What `root` has focused, read before React commits: once the control has gone, nothing can tell where it was. */
export function heldFocus(root: Node | null | undefined): Held | null {
  const element = root instanceof ShadowRoot ? root.activeElement : null;
  if (!element) return null;
  // A list's row, or the control alone: a page-map block's neighbours are the blocks beside it.
  const row = element.closest("li") ?? element;
  return { element, row, next: row.nextElementSibling, previous: row.previousElementSibling };
}

/** The first control in `element` focus can land on, itself included. */
function firstFocusable(element: Element | null): HTMLElement | null {
  if (!element?.isConnected) return null;
  const candidates = [element, ...element.querySelectorAll(FOCUSABLE)];
  return (candidates.find((node) => node.matches(FOCUSABLE) && !folded(node)) as HTMLElement | undefined) ?? null;
}

/**
 * The focused control can no longer hold focus: it went with the page (its Instance
 * unmounted), or it was turned off (a change none of whose Instances is mounted). Focus
 * goes to what is left of its row, else the row after it, else the row before, so the
 * keyboard stays where it was in the panel rather than falling to the page's `<body>`.
 * Says whether it moved focus.
 */
export function focusNeighbour(held: Held): boolean {
  return [held.row, held.next, held.previous].some((row) => take(firstFocusable(row)));
}
