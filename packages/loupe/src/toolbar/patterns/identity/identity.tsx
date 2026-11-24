// Identity (ADR 0003, DESIGN.md "Identity"): the top of the Inspector card, which says
// what is selected. Back, the component and its page, its verdict and deltas; its visible
// name as the headline; where it is written; then only the exceptions: tags, the scopes
// acting on it, the not-generated warning and the actions that can act on it; and at its
// foot, the adapted Instances it is inside. The same block heads "Not on the page now".
//
// It draws panel-view's `IdentityView`, in its words, and builds none. The actions are the
// view's (they write, and offer to undo): it places them. See identity.md.

import type { ReactNode, Ref } from "react";
import type { IdentityView, InspectorWords } from "../../panel-view/index.js";
import { BackIcon, Button, Dot, ElbowIcon, FileIcon, Tag } from "../../ui/index.js";
import { Breakable, Keys, StatusChip, TagChip } from "../marks/marks.js";

export type IdentityProps = {
  /** What panel-view decided the block says: the Inspector's, or "Not on the page now"'s. */
  identity: IdentityView;
  words: InspectorWords;
  /** Back to the list. */
  onBack(): void;
  /** The app's language, for a name it wrote (`identity.ownName`): a screen reader reads it in that voice. */
  nameLang?: string;
  /** The headline, for the view that moves focus to it. */
  heading?: Ref<HTMLHeadingElement>;
  /** The view's buttons that act on it: Hold open, Reset this Instance. */
  actions?: ReactNode;
  /** The view's, after its actions: where Select multiple can't group it. */
  children?: ReactNode;
  /** An Instance it is inside, pressed: select it. */
  onCrumb?(id: string): void;
};

export function Identity({ identity, words, onBack, nameLang, heading, actions, children, onCrumb }: IdentityProps) {
  const { component, page, status, keys, name, nameTitle, where, whereTitle, id, note, tags, chips, held, notGenerated, crumbs } = identity;
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
      <h2 data-identity-name="" tabIndex={-1} ref={heading} title={nameTitle} dir="auto" lang={identity.ownName ? nameLang : undefined}>
        {name}
      </h2>
      {where && (
        <div data-identity-where="" data-testid="instance-id" data-id={id ?? undefined} title={whereTitle}>
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
