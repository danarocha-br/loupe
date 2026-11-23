import type { KeyboardEvent } from "react";

/**
 * Enter as a press, for a part UI SDK leaves Enter to a form (a radio, a switch): the
 * panel has no form, and every other control in it answers Enter. Held down, it acts once.
 */
export function onEnter(act: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) act();
  };
}
