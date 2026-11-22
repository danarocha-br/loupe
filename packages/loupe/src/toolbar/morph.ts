// Opening and closing as one shape (2026-11-22, after the designer's reference): the
// collapsed pill's dark body grows into the panel's box, the panel's own ground and
// content fading in inside it as it goes, and on close the panel gives way to the same
// dark body shrinking back to where the pill sits.
//
// Two layers move together, both by `clip-path: inset(… round …)`, which the compositor
// animates without layout: a dark shell over the union of the pill's box and the
// panel's, and the panel itself, clipped to the same rectangle where it reaches into
// the panel's box. Web Animations, so a close that comes mid-open plays the open back
// from where it is rather than starting over.

export type Rect = { left: number; top: number; width: number; height: number };

/** Opening is the deliberate act: a little longer than closing, which only has to get out of the way. */
export const OPEN_MS = 320;
export const CLOSE_MS = 220;
/** The drawer curve: fast out of the pill, a long soft landing. */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/** The pill's corner, and the panel's (round on its left, flush to the window on its right). */
const PILL_ROUND = "16px";
const PANEL_ROUND = "24px 0px 0px 24px";

const union = (a: Rect, b: Rect): Rect => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top };
};

/** `rect` as an inset of `box`, each side clamped into the box, so a rect outside it collapses onto its nearest side. */
export function insetIn(rect: Rect, box: Rect, round: string): string {
  const clamp = (n: number, max: number) => Math.round(Math.min(max, Math.max(0, n)));
  const top = clamp(rect.top - box.top, box.height);
  const left = clamp(rect.left - box.left, box.width);
  const bottom = clamp(box.top + box.height - (rect.top + rect.height), box.height - top);
  const right = clamp(box.left + box.width - (rect.left + rect.width), box.width - left);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${round})`;
}

export type Morph = {
  /** Resolves when it has played to its end; never when it is reversed or cancelled. */
  finished: Promise<void>;
  /** Plays it back from where it is to where it started; `then` runs once it is back. */
  reverse(then: () => void): void;
  cancel(): void;
};

/** Whether the page can play it, and the reader wants motion: otherwise the panel just comes and goes. */
export function canMorph(): boolean {
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") return false;
  return typeof matchMedia !== "function" || !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Grows the pill at `pill` into `panel` (opening), or shrinks the panel back to it (closing).
 * The shell goes into `root`, under the panel, and is removed when it ends either way.
 */
export function morph(root: ShadowRoot, panel: HTMLElement, pill: Rect, direction: "open" | "close"): Morph {
  const box = panel.getBoundingClientRect();
  const panelRect: Rect = { left: box.left, top: box.top, width: box.width, height: box.height };
  const area = union(pill, panelRect);
  const shell = document.createElement("div");
  shell.className = "morph-shell";
  shell.setAttribute("aria-hidden", "true");
  Object.assign(shell.style, { left: `${area.left}px`, top: `${area.top}px`, width: `${area.width}px`, height: `${area.height}px` });
  root.append(shell);

  const small = { shell: insetIn(pill, area, PILL_ROUND), panel: insetIn(pill, panelRect, PILL_ROUND) };
  const large = { shell: insetIn(panelRect, area, PANEL_ROUND), panel: `inset(0px 0px 0px 0px round ${PANEL_ROUND})` };
  const opening = direction === "open";
  const timing: KeyframeAnimationOptions = { duration: opening ? OPEN_MS : CLOSE_MS, easing: EASE, fill: "both" };
  // The shape carries the colour, the pill's dark body turning into the panel's ground, so
  // there is never a seam where it is still outside the panel's box. The panel and its content
  // come in only once the shape mostly covers it, and on close they go first, so what shrinks
  // into the pill is the pill's own dark body.
  const tokens = getComputedStyle(shell);
  const dark = tokens.getPropertyValue("--band").trim();
  const ground = tokens.getPropertyValue("--ground").trim();
  const tone: Keyframe[] = opening
    ? [{ backgroundColor: dark, offset: 0 }, { backgroundColor: dark, offset: 0.3 }, { backgroundColor: ground, offset: 0.7 }, { backgroundColor: ground, offset: 1 }]
    : [{ backgroundColor: ground, offset: 0 }, { backgroundColor: ground, offset: 0.2 }, { backgroundColor: dark, offset: 0.6 }, { backgroundColor: dark, offset: 1 }];
  const panelFade: Keyframe[] = opening
    ? [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }]
    : [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 0, offset: 1 }];
  const animations = [
    shell.animate({ clipPath: opening ? [small.shell, large.shell] : [large.shell, small.shell] }, timing),
    shell.animate(tone, { ...timing, easing: "linear" }),
    panel.animate({ clipPath: opening ? [small.panel, large.panel] : [large.panel, small.panel] }, timing),
    panel.animate(panelFade, { ...timing, easing: "linear" }),
  ];
  let settled = false;
  let reversed = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    shell.remove();
    // Opened, the panel keeps no clip; closed, it is unmounted next.
    for (const animation of animations) animation.cancel();
  };
  // A reversed animation's `finished` resolves when it is back at its start: that end is `reverse`'s, not this one's.
  const never = new Promise<void>(() => {});
  const finished = Promise.all(animations.map((animation) => animation.finished)).then(
    () => {
      if (reversed) return never;
      finish();
    },
    () => never,
  );
  return {
    finished,
    reverse(then) {
      reversed = true;
      Promise.all(
        animations.map((animation) => {
          animation.reverse();
          return animation.finished;
        }),
      ).then(
        () => {
          finish();
          then();
        },
        () => {},
      );
    },
    cancel: finish,
  };
}
