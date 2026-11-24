// Identity (ADR 0003, DESIGN.md "Identity"): the top of the Inspector card, which says
// what is selected. Back, the component and its page, its verdict and deltas; its visible
// name as the headline; where it is written; then only the exceptions: tags, the scopes
// acting on it, the not-generated warning and the actions that can act on it; and at its
// foot, the adapted Instances it is inside. The same block heads "Not on the page now".
//
// It draws what panel-view decided, in its words, and builds none. The actions are the
// view's (they write, and offer to undo): it places them. See identity.md.

import type { ReactNode, Ref } from "react";
import type { InspectorWords, StatusTag, Tag as TagText } from "../../panel-view/index.js";
import { BackIcon, Button, Dot, ElbowIcon, FileIcon, Tag } from "../../ui/index.js";
import { Breakable, Keys, type Status, StatusChip, TagChip } from "../marks/marks.js";

export type IdentityProps = {
  words: InspectorWords;
  /** Back to the list. */
  onBack(): void;
  /** The component, muted after Back; null when the headline is the component already. */
  component: string | null;
  /** The page, "Billing", after the component; none once the Instance is gone. */
  page?: string | null;
  /** Its verdict ("✓ Supported"), or a plain status ("Not on the page now"). */
  status?: Status | null;
  /** The numbered changes that reach it. */
  keys?: readonly number[];
  /** The headline: its visible name in full, else its component. The app's own words, in whatever script it writes. */
  name: string;
  nameTitle?: string;
  /** The app's language, for a name it wrote: a screen reader reads it in that voice. */
  nameLang?: string;
  /** The headline, for the view that moves focus to it. */
  heading?: Ref<HTMLHeadingElement>;
  /** Where it is written: a file and its line, set apart, after a file icon; or one line of words. */
  where?: { file: string; line: string } | string | null;
  /** The full path and key, on hover. */
  whereTitle?: string;
  /** Its id, on the where line, for the view's own queries. */
  id?: string;
  /** What it says once it is gone. */
  note?: string | null;
  tags?: readonly TagText[];
  /** The scopes acting on it, and the ones it was left out of. */
  chips?: readonly string[];
  /** What a gone Instance still holds. */
  held?: readonly string[] | null;
  /** Its component isn't generated yet: the tag, and the command that would read it. */
  notGenerated?: { tag: StatusTag; command: string } | null;
  /** The view's buttons that act on it: Hold open, Reset this Instance. */
  actions?: ReactNode;
  /** The view's, after its actions: where Select multiple can't group it. */
  children?: ReactNode;
  /** The adapted Instances around it, nearest first; each selects it. */
  crumbs?: readonly { id: string; label: string }[];
  onCrumb?(id: string): void;
};

export function Identity({
  words,
  onBack,
  component,
  page,
  status,
  keys = [],
  name,
  nameTitle,
  nameLang,
  heading,
  where,
  whereTitle,
  id,
  note,
  tags = [],
  chips = [],
  held,
  notGenerated,
  actions,
  children,
  crumbs = [],
  onCrumb,
}: IdentityProps) {
  return (
    <div data-identity="" data-inside={crumbs.length > 0 ? "" : undefined}>
      <div data-identity-title="">
        <div data-identity-lead="">
          <Button iconOnly data-identity-back="" onClick={onBack} title={words.back.title}>
            <BackIcon />
            <span className="sr-only">{words.back.label}</span>
          </Button>
          {component && (
            <span data-identity-component="">
              <Breakable text={component} />
            </span>
          )}
          {page && <span data-identity-page="">/ {page}</span>}
        </div>
        {status && <StatusChip status={status} check />}
        <Keys keys={keys} words={words} />
      </div>
      <h2 data-identity-name="" tabIndex={-1} ref={heading} title={nameTitle} dir="auto" lang={nameLang}>
        {name}
      </h2>
      {where && (
        <div data-identity-where="" data-testid="instance-id" data-id={id} title={whereTitle}>
          {typeof where === "string" ? (
            where
          ) : (
            <>
              <FileIcon />
              {/* The file names the place, the line finds it: set apart, lighter. */}
              <span>
                {where.file}
                <span data-identity-line="">{where.line}</span>
              </span>
            </>
          )}
        </div>
      )}
      {note && <p data-identity-note="">{note}</p>}
      {(tags.length > 0 || chips.length > 0) && (
        <div data-identity-tags="" data-testid="chips">
          {tags.map((tag) => (
            <TagChip key={tag.kind} tag={tag} />
          ))}
          {chips.map((chip) => (
            <Tag key={chip}>{chip}</Tag>
          ))}
        </div>
      )}
      {held && held.length > 0 && (
        <ul data-identity-held="" data-testid="held-values">
          {held.map((value, index) => (
            <li key={index}>{value}</li>
          ))}
        </ul>
      )}
      {notGenerated && (
        <div data-identity-warn="" data-testid="not-generated">
          <Dot tone="amber" />
          <span>
            <StatusChip status={notGenerated.tag} /> {words.run} <span data-identity-command="">{notGenerated.command}</span> {words.fromRootToReadProps}
          </span>
        </div>
      )}
      {actions && <div data-identity-actions="">{actions}</div>}
      {children}
      {crumbs.length > 0 && (
        <div data-identity-inside="" data-testid="inside">
          <span data-identity-inside-label="">{words.inside}</span>
          <ol>
            {/* Outermost first, each a step further in than the last; the Instance itself last. */}
            {[...crumbs].reverse().map((crumb, index) => (
              <li key={crumb.id} style={{ paddingLeft: index === 0 ? 0 : (index - 1) * 18 }}>
                {index > 0 && <ElbowIcon />}
                <button type="button" onClick={() => onCrumb?.(crumb.id)}>
                  {crumb.label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
