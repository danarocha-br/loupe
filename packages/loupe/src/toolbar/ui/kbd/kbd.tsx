// Kbd: a key on the keyboard, named in running text ("Esc cancels") (ADR 0003). The
// native `kbd`, so it says what it is in the markup; no UI SDK part fits. See kbd.md.

import type { ReactNode } from "react";
import type { DataAttributes } from "../data-attributes.js";

export type KbdProps = {
  className?: string;
  /** The key as the reader's keyboard prints it: "Esc", "Alt", "⌥⇧L". */
  children: ReactNode;
} & DataAttributes;

export function Kbd({ className, children, ...rest }: KbdProps) {
  return (
    <kbd {...rest} data-kbd="" className={className}>
      {children}
    </kbd>
  );
}
