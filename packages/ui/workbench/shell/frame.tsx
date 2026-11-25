// What every page's states share, a primitive's or a pattern's: a frame of one state, titled
// with what to try, and a glyph for the icon-only buttons, which the Toolbar's tools draw
// their own icons for.

import type { ReactNode } from "react";

/** One state, or a few side by side, under a line that says what to try. */
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="wb-row">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** A primitive's frames, one under the other. */
export function States({ children }: { children: ReactNode }) {
  return <div className="wb-states">{children}</div>;
}

/** A glyph for the workbench's icon-only buttons: the tools draw their own. */
export const Glyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="7" />
  </svg>
);
