// The panel of the 2e sketch (PER-140): a pinned header (Export Proposal, light or
// dark, Hide) and footer (the Override count, Copy as Markdown, Reset all), and a
// scrolling middle whose last card stretches. The middle holds either the
// component list (nothing selected) or the inspector, at This instance or a group
// or page scope (PER-134). Notices sit below the page or Instance card.
//
// It renders `PanelView` (PER-214): every decision and word comes from
// `panelView()`, and each button makes the `__loupe` call its data names.

import { type ReactNode, useEffect, useState } from "react";
import type { LayerStatus } from "../layer-status.js";
import type { LoupeDebug } from "../runtime/debug.js";
import type { Scope } from "../runtime/store.js";
import { attempt, PropRowView } from "./controls.js";
import { ExportButton } from "./export-dialog.js";
import { FlagsCard } from "./flags.js";
import { BackIcon, CheckIcon, ChevronIcon, CopyIcon, InfoIcon, ResetIcon, SunIcon } from "./icons.js";
import { LayerNotices, NotGeneratedNotice } from "./notices.js";
import { type GoneBody, type InspectorBody, type ListBody, type MembersView, type PanelView, type ScopeOption, type StatusTag, type Tag, TEXT } from "./panel-view/index.js";
import { copyProposalMarkdown } from "./proposal.js";
import { SnapshotsCard } from "./snapshots-card.js";

type PanelProps = {
  debug: LoupeDebug;
  view: PanelView;
  /** For the Product layer's notices, which decide their own words. */
  layer: LayerStatus | null;
  onSelect(id: string | null): void;
  onScope(scope: Scope): void;
  onHover(ids: string[]): void;
  onHide(): void;
  theme: "light" | "dark";
  onTheme(): void;
};

type Actions = Pick<PanelProps, "debug" | "onSelect" | "onScope" | "onHover">;

export function Panel(props: PanelProps) {
  const { view } = props;
  const notices = (
    <>
      <LayerNotices status={props.layer} />
      {view.banner && <OverridesOff banner={view.banner} />}
    </>
  );
  const { body } = view;
  return (
    <section className="panel" aria-label="Loupe">
      <header className="header">
        <ExportButton disabled={!view.header.exportEnabled} />
        <div className="end">
          <button
            type="button"
            className="btn round"
            aria-pressed={props.theme === "dark"}
            onClick={props.onTheme}
            title={props.theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            <SunIcon />
            <span className="sr-only">Dark theme</span>
          </button>
          <button type="button" className="btn" onClick={props.onHide}>
            Hide
          </button>
        </div>
      </header>
      <div className="middle">
        {body.kind === "list" ? (
          <ComponentList {...props} body={body} notices={notices} />
        ) : body.kind === "gone" ? (
          <Gone {...props} body={body} notices={notices} />
        ) : (
          <Inspector {...props} body={body} notices={notices} />
        )}
      </div>
      <Footer debug={props.debug} footer={view.footer} />
    </section>
  );
}

/** The React self-check failed (PER-184: said here once, not again on the Instance). */
function OverridesOff({ banner }: { banner: NonNullable<PanelView["banner"]> }) {
  return (
    <div className="card notice-card banner" role="status">
      <div className="head">
        <div className="title">
          <span className="dot red" />
          {banner.title}
        </div>
      </div>
      <p className="body">{banner.body}</p>
    </div>
  );
}

const TAG_CLASS: Record<Tag["kind"], string> = {
  server: "tag status",
  suspended: "tag status held",
  "not-mounted": "tag status dashed",
  stale: "tag status stale",
  "left-out": "tag status",
  "left-out-unmounted": "tag status dashed",
};

function TagView({ tag }: { tag: Tag }) {
  return <span className={TAG_CLASS[tag.kind]}>{tag.text}</span>;
}

const STATUS_CLASS: Record<StatusTag["kind"], string> = {
  supported: "tag status supported",
  "inspect-only": "tag status",
  "not-generated": "tag status stale",
};

function StatusView({ status, title, check }: { status: StatusTag; title?: string | null; check?: boolean }) {
  return (
    <span className={STATUS_CLASS[status.kind]} title={title ?? undefined}>
      {check && status.kind === "supported" && <CheckIcon />}
      {status.text}
    </span>
  );
}

function HeldValues({ values }: { values: readonly string[] }) {
  return (
    <ul className="list held-values" data-testid="held-values">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  );
}

function ComponentList({ debug, onSelect, onHover, body, notices }: Actions & { body: ListBody; notices: ReactNode }) {
  return (
    <>
      <div className="card identity">
        <div className="head">
          <div className="title">
            <span className="name">{body.page.name}</span>
            <span className="chip-label">{body.page.route}</span>
          </div>
        </div>
        <p className="body">{TEXT.nothingSelected}</p>
      </div>
      {notices}
      {body.notGenerated && <NotGeneratedNotice names={body.notGenerated.names} command={body.notGenerated.command} />}
      <FlagsCard />
      <SnapshotsCard />
      <HeldForReviewCard debug={debug} items={body.suspended} meta={body.suspendedMeta} />
      <div className={body.interaction.length === 0 ? "card list-card stretch" : "card list-card"}>
        <div className="head">
          <h3>On this page</h3>
          <span className="meta">{body.summary}</span>
        </div>
        <ul className="list" aria-label="Components on this page">
          {body.groups.map((group) => (
            <li key={group.component} className="group">
              <details>
                <summary onMouseEnter={() => onHover(group.outlineIds)} onMouseLeave={() => onHover([])}>
                  <span className="cname">{group.component}</span> <span className="times">{group.count}</span>
                  <span className="sub">
                    {group.notes.map((note) =>
                      note.kind === "overrides" ? (
                        <span key={note.kind}>
                          <span className="dot small purple" />
                          {note.text}
                        </span>
                      ) : note.kind === "stale" ? (
                        <span key={note.kind} className="stale">
                          <span className="dot small amber" />
                          {note.text}
                        </span>
                      ) : (
                        <span key={note.kind}>{note.text}</span>
                      ),
                    )}
                  </span>
                  <span className="status">
                    {group.verdict.status && <StatusView status={group.verdict.status} title={group.statusTitle} />}
                  </span>
                  <ChevronIcon />
                </summary>
                <ul className="list instances">
                  {group.instances.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-instance={item.id}
                        onClick={() => onSelect(item.id)}
                        {...(item.mounted ? { onMouseEnter: () => onHover([item.id]), onMouseLeave: () => onHover([]) } : {})}
                      >
                        <span>{item.label}</span>
                        {!item.mounted && " "}
                        {item.tags.map((tag) => (
                          <TagView key={tag.kind} tag={tag} />
                        ))}
                      </button>
                      {item.values.length > 0 && <HeldValues values={item.values} />}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>
      {body.interaction.length > 0 && (
        <div className="card list-card soft stretch">
          <div className="head">
            <h3>Appears on interaction</h3>
            <span className="meta">Not on screen yet</span>
          </div>
          <ul className="list interaction">
            {body.interaction.map((component) => (
              <li key={component}>
                {component}
                <span className="muted">{TEXT.seenNotMounted}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Records suspended for review (PER-95): the call site's total changed, or the id
 * names more than one Instance. They apply to nothing until discarded, which the
 * hollow purple ring says (PER-140). Nothing here opens a menu or dialog to reach one.
 */
function HeldForReviewCard({ debug, items, meta }: { debug: LoupeDebug; items: ListBody["suspended"]; meta: string }) {
  if (items.length === 0) return null;
  return (
    <div className="card list-card" data-testid="held-for-review">
      <div className="head">
        <div className="title">
          <span className="dot ring" />
          <h3>Held for review</h3>
        </div>
        <span className="meta">{meta}</span>
      </div>
      <ul className="list held-list">
        {items.map((item) => (
          <li key={JSON.stringify(item.target)} className="held-item">
            <div className="target">
              <span>{item.label}</span>
              <button type="button" className="btn small" onClick={() => attempt(() => debug.discard(item.target))}>
                Discard
              </button>
            </div>
            <div className="muted">{item.why}</div>
            <HeldValues values={item.values} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackButton({ onSelect }: Pick<Actions, "onSelect">) {
  return (
    <button type="button" className="btn circle" onClick={() => onSelect(null)} title="Back to every component on this page">
      <BackIcon />
      <span className="sr-only">All components</span>
    </button>
  );
}

/** `discard` also drops the record of an Instance that isn't mounted, where `reset(id)` throws (PER-128). */
function ResetInstance({ debug, id, enabled }: { debug: LoupeDebug; id: string; enabled: boolean }) {
  return (
    <button type="button" className="btn small" disabled={!enabled} onClick={() => debug.discard({ scope: "instance", id })}>
      Reset this Instance
    </button>
  );
}

function Gone({ debug, onSelect, body, notices }: Actions & { body: GoneBody; notices: ReactNode }) {
  return (
    <>
      <div className="card identity">
        <div className="head">
          <div className="title">
            <span className="name">{TEXT.notOnPage}</span>
          </div>
          <BackButton onSelect={onSelect} />
        </div>
        <div className="id">{body.id}</div>
      </div>
      {notices}
      <div className="card stretch">
        <h3>{TEXT.notOnPage}</h3>
        {body.held && (
          <>
            <span>
              <TagView tag={body.held.tag} />
            </span>
            <HeldValues values={body.held.values} />
          </>
        )}
        <p className="body">{TEXT.showsWhenMounted}</p>
        <div className="actions">
          {body.canReset && <ResetInstance debug={debug} id={body.id} enabled />}
          <button type="button" className="btn small" onClick={() => onSelect(null)}>
            Back to the list
          </button>
        </div>
      </div>
    </>
  );
}

function Inspector({ debug, onSelect, onScope, onHover, body, notices }: Actions & { body: InspectorBody; notices: ReactNode }) {
  return (
    <>
      <div className="card identity">
        <div className="head">
          <div className="title">
            <span className="name">{body.component}</span>
            {body.verdict.status && <StatusView status={body.verdict.status} check />}
            {body.tags.map((tag) => (
              <TagView key={tag.kind} tag={tag} />
            ))}
          </div>
          <BackButton onSelect={onSelect} />
        </div>
        <div className="id" data-testid="instance-id">
          {body.id}
        </div>
        {body.chips.length > 0 && (
          <div className="chips" data-testid="chips">
            {body.chips.map((chip) => (
              <span key={chip} className="tag">
                {chip}
              </span>
            ))}
          </div>
        )}
        {body.crumbs.length > 0 && (
          <div className="crumbs">
            Inside
            {body.crumbs.map((crumb) => (
              <button key={crumb.id} type="button" onClick={() => onSelect(crumb.id)}>
                {crumb.label}
              </button>
            ))}
          </div>
        )}
        {body.editing && (
          <div className="actions">
            <ResetInstance debug={debug} id={body.id} enabled={body.editing.resetInstanceEnabled} />
          </div>
        )}
        {body.editing?.scopes && <ScopePicker options={body.editing.scopes} onScope={onScope} />}
      </div>
      {notices}
      {body.members && <MembersCard debug={debug} members={body.members} onHover={onHover} />}
      {body.note && (
        <div className="card note-card" role="note">
          <InfoIcon />
          <div className="text">
            <h3>{body.note.title}</h3>
            <p className="body">{body.note.body}</p>
          </div>
        </div>
      )}
      <CoverageCard coverage={body.coverage} />
      {body.editable.map((item) => (
        <div className="card prop" key={item.name}>
          <PropRowView item={item} debug={debug} onSelect={onSelect} onHover={onHover} />
        </div>
      ))}
      <div className="card soft stretch inspect">
        <div className="head">
          <h3>Inspect only</h3>
          {body.inspectOnlyMeta && <span className="meta">{body.inspectOnlyMeta}</span>}
        </div>
        {body.inspectOnly.length === 0 ? (
          <div className="muted">{TEXT.none}</div>
        ) : (
          body.inspectOnly.map((item) => <PropRowView key={item.name} item={item} debug={debug} onSelect={onSelect} onHover={onHover} />)
        )}
        {body.injected && (
          <details>
            <summary>
              <ChevronIcon />
              {body.injected.summary}
            </summary>
            {body.injected.rows.map((row) => (
              <div className="row" key={row.name}>
                <div className="line">
                  <span className="name">{row.name}</span>
                  <span className="value">{row.value}</span>
                </div>
              </div>
            ))}
          </details>
        )}
      </div>
    </>
  );
}

/** Editable against inspect-only as a bar, and the call site under it: one card (PER-140). */
function CoverageCard({ coverage }: { coverage: InspectorBody["coverage"] }) {
  const { editable, inspectOnly } = coverage;
  const total = editable + inspectOnly;
  const notGenerated = coverage.notGenerated;
  return (
    <div className="card coverage">
      <div className="head">
        <h3>Coverage</h3>
        <span className="meta" data-testid="coverage">
          {coverage.text}
        </span>
      </div>
      {total > 0 && (
        <div className="bar" aria-hidden="true">
          {coverage.segmented ? (
            Array.from({ length: total }, (_, index) => <span key={index} className={index < editable ? "on" : undefined} />)
          ) : (
            <>
              {editable > 0 && <span className="on" style={{ flex: editable }} />}
              {inspectOnly > 0 && <span style={{ flex: inspectOnly }} />}
            </>
          )}
        </div>
      )}
      <div className="site">
        <span className="meta">Call site</span>
        {coverage.callSite ? (
          <span className="mono" title={coverage.callSite.title}>
            {coverage.callSite.text}
          </span>
        ) : (
          <span className="muted">{coverage.noCallSite}</span>
        )}
      </div>
      {notGenerated && (
        <div className="warn" data-testid="not-generated">
          <span className="dot" />
          <span>
            <StatusView status={notGenerated.tag} /> {TEXT.run} <span className="mono verbatim">{notGenerated.command}</span> {TEXT.fromRootToReadProps}
          </span>
        </div>
      )}
    </div>
  );
}

/** APPLY TO: this instance, every Instance from this call site, every Instance on this page, each with its size. */
function ScopePicker({ options, onScope }: { options: ScopeOption[]; onScope(scope: Scope): void }) {
  return (
    <div className="apply">
      <span className="meta">Apply to</span>
      <div className="scopes" role="group" aria-label="Scope">
        {options.map((option) => (
          <button
            key={option.scope}
            type="button"
            data-scope={option.scope}
            aria-pressed={option.pressed}
            disabled={!option.enabled}
            title={option.title ?? undefined}
            onClick={() => onScope(option.scope)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Who a group or page change reaches, with a box to leave each one out. A page
 * scope groups them by call site, so one box leaves a whole call site out.
 */
function MembersCard({ debug, members, onHover }: Pick<Actions, "debug" | "onHover"> & { members: MembersView }) {
  const { scope } = members;
  const toggle = (action: "include" | "exclude", id: string) =>
    attempt(() => (action === "include" ? debug.include(id, scope) : debug.exclude(id, scope)));
  const memberItem = (member: MembersView["members"][number]) => (
    <li key={member.id} onMouseEnter={() => onHover([member.id])} onMouseLeave={() => onHover([])}>
      <label>
        <input
          type="checkbox"
          data-member={member.id}
          checked={!member.out}
          disabled={members.suspended}
          onChange={() => toggle(member.toggle, member.id)}
        />
        <span className={member.out ? "mono muted" : "mono"}>{member.label}</span>
        {member.tag && <TagView tag={member.tag} />}
      </label>
    </li>
  );
  return (
    <div className="card members" data-testid="members">
      <div className="head">
        <h3>Instances</h3>
        <span className="meta">{members.countText}</span>
      </div>
      <div className="muted">{TEXT.untick}</div>
      {members.sites === null ? (
        <ul className="list">{members.members.map(memberItem)}</ul>
      ) : (
        members.sites.map((site) => (
          <fieldset key={site.anchor} className="site">
            <legend>
              <label onMouseEnter={() => onHover(site.members.map((member) => member.id))} onMouseLeave={() => onHover([])}>
                <input
                  type="checkbox"
                  data-site={site.anchor}
                  checked={site.allIn}
                  disabled={members.suspended}
                  onChange={() => {
                    for (const id of site.toggle.ids) toggle(site.toggle.action, id);
                  }}
                />
                <span className="mono" title={site.anchor}>
                  {site.label}
                </span>
                <span className="muted">· {site.count}</span>
              </label>
            </legend>
            <ul className="list">{site.members.map(memberItem)}</ul>
          </fieldset>
        ))
      )}
      {members.server.length > 0 && (
        <ul className="list" aria-label="Server-rendered">
          {members.server.map((server) => (
            <li key={server.id}>
              <span className="mono">{server.id}</span> <TagView tag={server.tag} />
            </li>
          ))}
        </ul>
      )}
      {members.outUnmounted.length > 0 && (
        <ul className="list" aria-label="Left out, not mounted">
          {members.outUnmounted.map((out) => (
            <li key={out.id}>
              <span className="mono muted">{out.id}</span> <TagView tag={out.tag} />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn small"
        style={{ alignSelf: "flex-start" }}
        disabled={!members.reset.enabled}
        onClick={() => attempt(() => debug.discard(members.reset.target))}
      >
        <ResetIcon />
        Reset this scope
      </button>
    </div>
  );
}

function Footer({ debug, footer }: { debug: LoupeDebug; footer: PanelView["footer"] }) {
  return (
    <footer className="footer">
      <span className="count">
        <span className={footer.hasOverrides ? "dot purple" : "dot none"} />
        <span className="text">{footer.countText}</span>
      </span>
      <CopyMarkdown disabled={!footer.copyEnabled} />
      <button
        type="button"
        className="btn tall"
        disabled={footer.resetAll.length === 0}
        onClick={() => {
          for (const target of footer.resetAll) debug.discard(target);
        }}
      >
        <ResetIcon />
        Reset all
      </button>
    </footer>
  );
}

/** Copy as Markdown (PER-135): the Proposal's summary, for a ticket. Clears nothing. */
function CopyMarkdown({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | { failed: string }>("idle");
  useEffect(() => {
    if (state === "idle" || state === "copying") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  const failed = typeof state === "object" ? state.failed : null;
  const said = state === "copied" ? "Copied" : failed !== null ? "Copy failed" : null;
  return (
    <button
      type="button"
      className={said ? "btn tall" : "btn round tall"}
      disabled={disabled || state === "copying"}
      title={failed ?? "Copy as Markdown: a short summary of every Override, to paste into a ticket"}
      onClick={() => {
        setState("copying");
        copyProposalMarkdown().then(
          () => setState("copied"),
          (error: unknown) => {
            console.warn("[loupe] Copy as Markdown failed:", error);
            setState({ failed: error instanceof Error ? error.message : String(error) });
          },
        );
      }}
    >
      {state === "copied" ? <CheckIcon size={14} /> : <CopyIcon />}
      {said ?? <span className="sr-only">Copy as Markdown</span>}
    </button>
  );
}
