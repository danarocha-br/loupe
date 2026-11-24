// GroupRow (ADR 0003, DESIGN.md "On this page"): one component on the page (Rows option B).
// Its name, a bar in its hue for how much the page uses it next to the most used, its
// count, and under the name only what is exceptional. Opened, its call sites as cards
// (SiteCard), then the Instances that hold an Override but aren't mounted now.
//
// It draws panel-view's `GroupItem` and builds no words: pointing, picking and opening an
// unmounted Instance go out through its callbacks. See group-row.md.

import type { CallSiteItem, GroupItem, InspectorWords } from "../../panel-view/index.js";
import { Dot, EyeIcon, Fold, FoldChevron, FoldPanel, FoldTrigger } from "../../ui/index.js";
import { Breakable, HeldValues, Keys, StatusChip, TagChip } from "../marks/marks.js";
import { SiteCard } from "../site-card/site-card.js";

export type GroupRowProps = {
  group: GroupItem;
  /** Its component is pointed at, here or on the page map: the row takes the hover wash. */
  lit: boolean;
  /** For the change numbers an unmounted Instance holds. */
  words: Pick<InspectorWords, "change">;
  /** The row pointed at or focused; null as it is left. Lights its blocks on the map, and outlines its Instances. */
  onPoint(group: GroupItem | null): void;
  /** A call site's card pressed: inspect every Instance from it. */
  onSite(site: CallSiteItem): void;
  /** A dot, or an unmounted Instance, pressed: inspect that one. */
  onInstance(id: string): void;
  /** Outline these Instances on the page while the pointer or focus is on what names them; none clears. */
  onHover(ids: string[]): void;
};

export function GroupRow({ group, lit, words, onPoint, onSite, onInstance, onHover }: GroupRowProps) {
  const { inspectOnly } = group;
  const unmounted = group.instances.filter((item) => !item.mounted);
  return (
    <li data-group-row="" data-hue={group.hue} data-lit={lit ? "" : undefined} data-inspect-only={inspectOnly ? "" : undefined}>
      <Fold>
        <FoldTrigger
          onMouseOver={() => onPoint(group)}
          onMouseLeave={() => onPoint(null)}
          onFocus={() => onPoint(group)}
          onBlur={() => onPoint(null)}
          title={group.statusTitle ?? undefined}
        >
          {/* The whole name, wrapping where its words meet: a long one is never cut short (layout review). */}
          <span data-group-name="">
            <span>
              <Breakable text={group.component} />
            </span>
            {inspectOnly && <EyeIcon />}
          </span>{" "}
          <span data-group-bar="" aria-hidden="true">
            <i style={{ width: `${Math.round(group.share * 1000) / 10}%` }} />
          </span>
          <span data-group-count="">{group.count}</span>
          <span data-group-notes="">
            {/* No board draws it, but it says what to run: the one verdict the row keeps in words. */}
            {group.verdict.status?.kind === "not-generated" && <StatusChip status={group.verdict.status} title={group.statusTitle} />}
            {group.notes.map((note) => (
              <span key={note.kind} data-note={note.kind}>
                {note.kind === "stale" && <Dot tone="amber" small />}
                {note.text}
              </span>
            ))}
          </span>
          <FoldChevron />
        </FoldTrigger>
        <FoldPanel>
          {group.sites.length > 0 && (
            <div data-group-sites="">
              <div data-group-sites-head="">{group.sitesText}</div>
              {group.sites.map((site) => (
                <SiteCard key={site.anchor} site={site} onSite={onSite} onInstance={onInstance} onHover={onHover} />
              ))}
            </div>
          )}
          {unmounted.length > 0 && (
            <ul data-group-unmounted="">
              {unmounted.map((item) => (
                <li key={item.id}>
                  <button type="button" data-instance={item.id} onClick={() => onInstance(item.id)}>
                    <Keys keys={item.keys} words={words} />
                    <span data-group-site="">{item.label}</span>
                    {item.tags.map((tag) => (
                      <TagChip key={tag.kind} tag={tag} />
                    ))}
                  </button>
                  {item.values.length > 0 && <HeldValues values={item.values} />}
                </li>
              ))}
            </ul>
          )}
        </FoldPanel>
      </Fold>
    </li>
  );
}
