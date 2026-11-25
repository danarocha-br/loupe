// SiteCard (ADR 0003, DESIGN.md "On this page"): a call site of a component, in an opened
// row of "On this page". Where it is written and what its Instances show; the card picks
// every Instance from the call site, a dot one of them. One of the two things lifted inside
// a card (the One Card Deep Rule): it is itself a button.
//
// It draws `panelView()`'s `CallSiteItem`, its words included, and builds none: picking and
// pointing go out through its callbacks. See site-card.md.

import type { CallSiteItem } from "../view.js";
import { ChevronIcon, EyeIcon } from "@loupe/ui";
import { hovering } from "../marks/marks.js";

export type SiteCardProps = {
  site: CallSiteItem;
  /** The card pressed: inspect every Instance from the call site. */
  onSite(site: CallSiteItem): void;
  /** A dot pressed: inspect that Instance alone. */
  onInstance(id: string): void;
  /** Outline these Instances on the page while the pointer or focus is on what names them; none clears. */
  onHover(ids: string[]): void;
};

export function SiteCard({ site, onSite, onInstance, onHover }: SiteCardProps) {
  return (
    <div data-site-card="" onMouseOver={() => onHover(site.ids)} onMouseLeave={() => onHover([])}>
      {/* The whole card is the button, under its words: they let the pointer through to it. */}
      <button type="button" data-site-open={site.anchor} onClick={() => onSite(site)} {...hovering(onHover, site.ids)} aria-label={site.inspect} />
      <span data-site-where="">
        <span data-site-file="">{site.label}</span>
        <span data-site-names="">
          <span>{site.names}</span>
          {!site.supported && <EyeIcon />}
        </span>
      </span>
      <span data-site-dots="">
        {site.instances.map(({ id, label, inspect }) => {
          const hover = hovering(onHover, [id]);
          return (
            <button
              key={id}
              type="button"
              data-instance={id}
              title={label}
              aria-label={inspect}
              onClick={() => onInstance(id)}
              {...hover}
              // The card outlines its whole call site: a dot outlines its one Instance.
              onMouseOver={(event) => {
                event.stopPropagation();
                hover.onMouseOver();
              }}
            />
          );
        })}
      </span>
      <ChevronIcon />
    </div>
  );
}
