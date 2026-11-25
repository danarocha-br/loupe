// ScopeSection (ADR 0003, DESIGN.md "Scope (Select multiple)"): who a group or page change
// reaches. The scope's name and a meter, a dot for each of the component's Instances on
// the page; how far it reaches in words; Widen (or Narrow), Reset this scope while it holds
// a change, and its Instances folded behind their count, each with a box to leave it out.
// A page scope groups them by call site, so one box leaves a whole call site out.
//
// It draws `MembersView` in the Inspector's words, and builds none: a box, Widen and Reset
// go out through its callbacks. See scope-section.md.

import type { InspectorWords, MemberItem, MembersView, Scope, ScopeMove } from "../../panel-view/index.js";
import { Button, Fold, FoldChevron, FoldPanel, FoldTrigger, LayersIcon, ResetIcon, Tag, WidenIcon } from "@loupe/ui";
import { Breakable, hovering, TagChip } from "../marks/marks.js";

/** As many dots as the meter can show: past this, the words alone say how far it reaches. */
export const METER_MAX = 12;

export type ScopeSectionProps = {
  members: MembersView;
  /** The Instance in hand: its row reads at 500 with a "picked" tag. */
  selected: string;
  words: InspectorWords;
  /** The app's language, for the names it wrote. */
  nameLang?: string;
  /** Widen or Narrow pressed. */
  onScope(scope: Scope): void;
  /** Reset this scope pressed: drop its record. */
  onReset(target: MembersView["reset"]["target"]): void;
  /** A box ticked or unticked: bring these back into the scope, or leave them out. */
  onToggle(action: "include" | "exclude", ids: readonly string[]): void;
  /** Outline these Instances on the page while the pointer or focus is on what names them; none clears. */
  onHover(ids: string[]): void;
};

/** Moves the selection to another scope: "Widen to All on page · 7", a soft navy pill. */
export function ScopeMoveButton({ move, onScope }: { move: ScopeMove; onScope(scope: Scope): void }) {
  return (
    <Button data-scope-move="" data-scope={move.scope} title={move.title} onClick={() => onScope(move.scope)}>
      <WidenIcon />
      {move.text}
    </Button>
  );
}

export function ScopeSection({ members, selected, words, nameLang, onScope, onReset, onToggle, onHover }: ScopeSectionProps) {
  const { reach } = members;
  // Open while one is left out, as Figma keeps layers out of the properties until asked.
  const leftOut = members.members.some((member) => member.out);
  const memberItem = (member: MemberItem) => {
    const picked = member.id === selected;
    return (
      <li key={member.id} {...hovering(onHover, [member.id])}>
        <label>
          <input
            type="checkbox"
            data-member={member.id}
            checked={!member.out}
            disabled={members.suspended}
            onChange={() => onToggle(member.toggle, [member.id])}
          />
          {/* By name only: the key that tells Instances apart is for engineers, in the tooltip. */}
          <span data-scope-who="" data-out={member.out ? "" : undefined} data-picked={picked ? "" : undefined} title={member.id} dir="auto" lang={member.name ? nameLang : undefined}>
            {member.name ?? member.label}
          </span>
          {member.tag && <TagChip tag={member.tag} />}
          {picked && <Tag look="picked">{words.picked}</Tag>}
        </label>
      </li>
    );
  };
  return (
    <Fold defaultOpen={leftOut} data-scope-section="">
      <div data-scope-head="" data-testid="members">
        <div data-scope-title="">
          <div data-scope-lead="">
            <LayersIcon />
            <h3 title={members.nameTitle ?? undefined}>
              <Breakable text={members.name} />
            </h3>
          </div>
          {reach.page <= METER_MAX && (
            <span data-scope-meter="" aria-hidden="true">
              {Array.from({ length: reach.page }, (_, index) => (
                <i key={index} data-in={index < reach.included ? "" : undefined} />
              ))}
            </span>
          )}
        </div>
        <p data-scope-reach="">
          {reach.lead} <b>{reach.countText}</b>
          {reach.moreText && <> · {reach.moreText}</>}
        </p>
        <div data-scope-actions="">
          {members.widen && <ScopeMoveButton move={members.widen} onScope={onScope} />}
          {members.reset.enabled && (
            <Button size="small" onClick={() => onReset(members.reset.target)}>
              <ResetIcon />
              {words.resetScope}
            </Button>
          )}
          <FoldTrigger inline data-scope-count="">
            {members.instancesText}
            <FoldChevron />
          </FoldTrigger>
        </div>
      </div>
      <FoldPanel>
        <div data-scope-members="">
          <p data-scope-hint="">{words.untick}</p>
          {members.sites === null ? (
            <ul data-scope-list="">{members.members.map(memberItem)}</ul>
          ) : (
            members.sites.map((site) => {
              const ids = site.members.map((member) => member.id);
              return (
                <fieldset key={site.anchor} data-scope-site="">
                  <legend>
                    <label onMouseOver={() => onHover(ids)} onMouseLeave={() => onHover([])}>
                      <input
                        type="checkbox"
                        data-site={site.anchor}
                        checked={site.allIn}
                        disabled={members.suspended}
                        onFocus={() => onHover(ids)}
                        onBlur={() => onHover([])}
                        onChange={() => onToggle(site.toggle.action, site.toggle.ids)}
                      />
                      <span data-scope-who="" title={site.anchor}>
                        {site.label} <span data-scope-count-of="">· {site.count}</span>
                      </span>
                    </label>
                  </legend>
                  <ul data-scope-list="">{site.members.map(memberItem)}</ul>
                </fieldset>
              );
            })
          )}
          {members.server.length > 0 && (
            <ul data-scope-list="" aria-label={words.serverRendered}>
              {members.server.map((server) => (
                <li key={server.id}>
                  <span data-scope-server="" title={server.id}>
                    {server.label}
                  </span>
                  <TagChip tag={server.tag} />
                </li>
              ))}
            </ul>
          )}
          {members.outUnmounted.length > 0 && (
            <ul data-scope-list="" aria-label={words.leftOutUnmounted}>
              {members.outUnmounted.map((out) => (
                <li key={out.id}>
                  <span data-scope-out="">{out.id}</span>{" "}
                  <TagChip tag={out.tag} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </FoldPanel>
    </Fold>
  );
}
