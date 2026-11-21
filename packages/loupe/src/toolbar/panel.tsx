// The panel (PER-140; the Revision Set since 2026-11-20): a sheet in the column the
// page makes room for, with a pinned header (the select tools, Hide marks, light or
// dark, Hide) and footer (the Override count, Reset all, the undo offer and Copy
// Proposal), and a scrolling middle of cards. The middle holds
// either the page's numbered changes and component list (nothing selected) or the
// inspector: one card per prop, at This instance or, with Select multiple, a group
// or page scope (PER-134). The scope is the select tool, as in Figma: there is no
// scope control in the middle, only a link that widens a call site to the page.
//
// Revision marks: every change the Proposal would list carries its number (c1 reads
// 1) in a delta on its row here and in the change list. On the page, the Instances
// it reaches are outlined for a moment as it lands, and while its row is pointed at.
//
// It renders `PanelView` (PER-214): every decision and word comes from
// `panelView()`, and each button makes the `__loupe` call its data names.

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { LayerStatus } from "../layer-status.js";
import type { LoupeDebug } from "../runtime/debug.js";
import type { Scope } from "../runtime/store.js";
import { attempt, HeldKey, Key, PropRowView } from "./controls.js";
import type { Column } from "./dock.js";
import { CopyProposalButton } from "./copy-dialog.js";
import { FlagsCard } from "./flags.js";
import { plural } from "./format.js";
import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  ContrastIcon,
  CursorIcon,
  InfoIcon,
  MarksHiddenIcon,
  MarksIcon,
  PanelIcon,
  ResetIcon,
  SelectManyIcon,
} from "./icons.js";
import { LayerNotices, NotGeneratedNotice } from "./notices.js";
import {
  type GoneBody,
  type InspectorBody,
  type ListBody,
  type MembersView,
  type PanelView,
  type PropItem,
  type ScopeOption,
  type StatusTag,
  type Tag,
  TEXT,
  THIS_INSTANCE,
} from "./panel-view/index.js";
import type { SelectMode } from "./picker.js";
import { offerUndo, takeUndo, useUndoOffer } from "./undo.js";

type PanelProps = {
  debug: LoupeDebug;
  view: PanelView;
  /** For the Product layer's notices, which decide their own words. */
  layer: LayerStatus | null;
  column: Column;
  /** The select tool: one Instance, or every one from its call site. */
  mode: SelectMode;
  picking: boolean;
  onTool(mode: SelectMode): void;
  onSelect(id: string | null, mode?: SelectMode): void;
  onScope(scope: Scope): void;
  onHover(ids: string[]): void;
  /** Hide marks: the selection's outlines and the revision clouds are off the page. */
  marksHidden: boolean;
  onMarks(): void;
  onHide(): void;
  theme: "light" | "dark";
  onTheme(): void;
};

/** The sheet stands this far inside its column on every side, as `.panel` sets it. */
const PANEL_INSET = 8;

/**
 * What the panel asks of the Toolbar. A row names its Instances to `onHover` on
 * `onMouseOver`, never `onMouseEnter`: React drops an enter that comes straight
 * from the app's page when the app renders `<body>` itself, as the App Router
 * does, so a row reached from the page would outline nothing. A repeat as the
 * pointer crosses the row's children changes nothing (`ToolbarOpen` keeps the ids).
 */
type Actions = Pick<PanelProps, "debug" | "onSelect" | "onScope" | "onHover">;

/** The header's two select tools: what each is called, and the scope it opens a selection at. */
const SELECT_TOOLS: { mode: SelectMode; scope: Scope; label: string; title: string; icon: ReactNode }[] = [
  { mode: "one", scope: "instance", label: "Select one", title: "Select one: click an Instance on the page to change it alone (Esc cancels)", icon: <CursorIcon /> },
  {
    mode: "many",
    scope: "group",
    label: "Select multiple",
    title: "Select multiple: click an Instance on the page to change every one from the same call site (Esc cancels)",
    icon: <SelectManyIcon />,
  },
];

export function Panel(props: PanelProps) {
  const { view, column } = props;
  const middle = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const peeking = usePeek();
  const covered = useCoveredDialog(column);
  const notices = (
    <>
      <LayerNotices status={props.layer} />
      {view.banner && <OverridesOff banner={view.banner} />}
    </>
  );
  const { body } = view;
  const opened = body.kind === "list" ? null : body.id;
  // A new selection, or back to the list, opens at the top. Focus follows it when it
  // was already in the panel: a pick on the page leaves the app's focus where it is.
  useEffect(() => {
    if (middle.current) middle.current.scrollTop = 0;
    const root = middle.current?.getRootNode();
    if (root instanceof ShadowRoot && root.activeElement !== null) heading.current?.focus();
  }, [opened]);
  const status = props.picking ? (
      <>
        {props.mode === "one" ? "Click an Instance on the page" : "Click an Instance: every one from its call site is selected"} ·{" "}
        <kbd>Esc</kbd> cancels
      </>
    ) : covered ? (
      <>
        A dialog on the page runs under the panel · hold <kbd>Alt</kbd> to see through
      </>
    ) : props.marksHidden ? (
      <>Outlines are hidden on the page</>
    ) : null;
  return (
    <section
      className={`panel${column.docked ? "" : " overlay"}${peeking ? " peek" : ""}`}
      aria-label="Loupe"
      style={{ width: column.width - PANEL_INSET * 2 }}
    >
      <header className="header">
        <div className="brand">
          <span className="wordmark">Loupe</span>
          <span className="report" title={`${view.header.report} · ${view.header.route}`}>
            / {view.header.report}
          </span>
        </div>
        <div className="tools">
          <div className="select-tools" role="group" aria-label="Select">
            {SELECT_TOOLS.map((tool) => (
              <button
                key={tool.mode}
                type="button"
                className={props.picking && props.mode === tool.mode ? "tool armed" : "tool"}
                data-scope={tool.scope}
                aria-pressed={props.mode === tool.mode}
                onClick={() => props.onTool(tool.mode)}
                title={tool.title}
              >
                {tool.icon}
                <span className="sr-only">{tool.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tool"
            data-marks=""
            aria-pressed={props.marksHidden}
            onClick={props.onMarks}
            title={
              props.marksHidden
                ? "Show marks: outline the selection on the page again"
                : "Hide marks: take Loupe's outlines off the page, to judge the change as it will ship. The selection stays."
            }
          >
            {props.marksHidden ? <MarksHiddenIcon /> : <MarksIcon />}
            <span className="sr-only">Hide marks</span>
          </button>
          <button
            type="button"
            className="tool"
            aria-pressed={props.theme === "dark"}
            onClick={props.onTheme}
            title={props.theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            <ContrastIcon />
            <span className="sr-only">Dark theme</span>
          </button>
          <button type="button" className="tool" onClick={props.onHide} title="Hide the panel">
            <PanelIcon />
            <span className="sr-only">Hide</span>
          </button>
        </div>
      </header>
      {status && (
        <div className="status-line" role="status">
          {status}
        </div>
      )}
      <div className="middle" ref={middle}>
        {body.kind === "list" ? (
          <ComponentList {...props} body={body} notices={notices} heading={heading} />
        ) : body.kind === "gone" ? (
          <Gone {...props} body={body} notices={notices} heading={heading} />
        ) : (
          <Inspector {...props} body={body} notices={notices} heading={heading} />
        )}
      </div>
      <Footer debug={props.debug} footer={view.footer} onSelect={props.onSelect} onHover={props.onHover} />
    </section>
  );
}

/**
 * Holding Alt (Option on a Mac) makes the panel see-through, so what runs under it
 * shows: an app's own dialog or toast is fixed to the viewport, not to the page the
 * panel's column narrows.
 */
function usePeek(): boolean {
  const [peeking, setPeeking] = useState(false);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Alt") setPeeking(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") setPeeking(false);
    };
    const reset = () => setPeeking(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", reset);
    };
  }, []);
  return peeking;
}

/** Whether a dialog of the app's, fixed to the viewport, reaches under the docked panel. Read on every redraw. */
function useCoveredDialog(column: Column): boolean {
  if (typeof document === "undefined" || !column.docked) return false;
  const edge = window.innerWidth - column.width;
  return [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some((dialog) => {
    const rect = dialog.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.right > edge;
  });
}

/** The React self-check failed (PER-184: said here once, not again on the Instance). */
function OverridesOff({ banner }: { banner: NonNullable<PanelView["banner"]> }) {
  return (
    <div className="section notice-card banner" role="status">
      <div className="head">
        <div className="title">
          <span className="dot alert" />
          {banner.title}
        </div>
      </div>
      <p className="body">{banner.body}</p>
    </div>
  );
}

const TAG_CLASS: Record<Tag["kind"], string> = {
  server: "tag",
  suspended: "tag held",
  "not-mounted": "tag dashed",
  stale: "tag stale",
  "left-out": "tag",
  "left-out-unmounted": "tag dashed",
};

function TagView({ tag }: { tag: Tag }) {
  return <span className={TAG_CLASS[tag.kind]}>{tag.text}</span>;
}

const STATUS_CLASS: Record<StatusTag["kind"], string> = {
  supported: "status supported",
  "inspect-only": "status",
  "not-generated": "status stale",
};

/** A verdict in words. Supported is the rule, so the list says only the exceptions. */
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

/** The plot key's numbers for one Instance or row. */
function Keys({ keys }: { keys: readonly number[] }) {
  if (keys.length === 0) return null;
  return (
    <span className="keys">
      {keys.map((n) => (
        <Key key={n} n={n} />
      ))}
    </span>
  );
}

type Heading = { heading: RefObject<HTMLHeadingElement | null> };

function ComponentList({ debug, onSelect, onHover, body, notices, heading }: Actions & Heading & { body: ListBody; notices: ReactNode }) {
  return (
    <>
      <div className="section identity">
        <h2 className="name" tabIndex={-1} ref={heading}>
          {body.page.name}
        </h2>
        <p className="body">{TEXT.nothingSelected}</p>
      </div>
      {notices}
      {body.notGenerated && <NotGeneratedNotice names={body.notGenerated.names} command={body.notGenerated.command} />}
      {body.changes.length > 0 && (
        <div className="section changes">
          <div className="head">
            <h3>Changes</h3>
            <span className="meta">numbered as in the Proposal</span>
          </div>
          <ol className="keylist" aria-label="Changes">
            {body.changes.map((change) => (
              <li key={change.n}>
                <button
                  type="button"
                  disabled={change.select === null}
                  onClick={() => change.select !== null && onSelect(change.select)}
                  onMouseOver={() => onHover(change.reached)}
                  onMouseLeave={() => onHover([])}
                >
                  <Key n={change.n} />
                  <span className="what">{change.detail}</span>
                  <span className="where">{change.where}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <HeldForReviewCard debug={debug} items={body.suspended} meta={body.suspendedMeta} />
      <div className="section list-card">
        <div className="head">
          <h3>On this page</h3>
          <span className="meta">{body.summary}</span>
        </div>
        <ul className="list" aria-label="Components on this page">
          {body.groups.map((group) => (
            <li key={group.component} className="group">
              <details>
                <summary onMouseOver={() => onHover(group.outlineIds)} onMouseLeave={() => onHover([])}>
                  <span className="cname" title={group.component}>
                    {group.component}
                  </span>{" "}
                  <span className="times">{group.count}</span>
                  <span className="sub">
                    {group.notes.map((note) =>
                      note.kind === "overrides" ? (
                        <span key={note.kind} className="changed">
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
                  <span className="verdict">
                    {group.verdict.status && group.verdict.status.kind !== "supported" && (
                      <StatusView status={group.verdict.status} title={group.statusTitle} />
                    )}
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
                        {...(item.mounted
                          ? {
                              onMouseOver: () => onHover([item.id]),
                              onMouseLeave: () => onHover([]),
                              onFocus: () => onHover([item.id]),
                              onBlur: () => onHover([]),
                            }
                          : {})}
                      >
                        <Keys keys={item.keys} />
                        <span className="who">
                          {item.name && <span className="screen-name">{item.name}</span>}
                          <span className="site">{item.label}</span>
                        </span>
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
        <div className="section list-card">
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
      <FlagsCard />
    </>
  );
}

/**
 * Records suspended for review (PER-95): the call site's total changed, or the id
 * names more than one Instance. They apply to nothing until discarded, which the
 * hollow ring says, in pencil (PER-140). Nothing here opens a menu or dialog to reach one.
 */
function HeldForReviewCard({ debug, items, meta }: { debug: LoupeDebug; items: ListBody["suspended"]; meta: string }) {
  if (items.length === 0) return null;
  return (
    <div className="section list-card" data-testid="held-for-review">
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
    <button type="button" className="back" onClick={() => onSelect(null)} title="Back to every component on this page (Esc)">
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

function Gone({ debug, onSelect, body, notices, heading }: Actions & Heading & { body: GoneBody; notices: ReactNode }) {
  return (
    <>
      <div className="section identity">
        <div className="title-line">
          <BackButton onSelect={onSelect} />
        </div>
        <h2 className="name" tabIndex={-1} ref={heading}>
          {TEXT.notOnPage}
        </h2>
        <div className="id">{body.id}</div>
      </div>
      {notices}
      <div className="section">
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

/** A true/false prop: it shares one card of switches with the others. */
function isSwitch(item: PropItem): boolean {
  const control = item.control;
  if (control?.kind !== "options" || control.options.length !== 2) return false;
  const values = control.options.map((option) => option.value);
  return values.includes(true) && values.includes(false);
}

/** "Button · member-row-menu.tsx:37" without the component, which the title line names. */
function siteOf(where: string, component: string): string {
  return where.startsWith(`${component} · `) ? where.slice(component.length + 3) : where;
}

function Inspector({
  debug,
  onSelect,
  onScope,
  onHover,
  mode,
  view,
  body,
  notices,
  heading,
}: Actions & Heading & Pick<PanelProps, "mode" | "view"> & { body: InspectorBody; notices: ReactNode }) {
  const { hold } = body;
  const inspectOpen = body.editable.length === 0;
  const switches = body.editable.filter(isSwitch);
  const cards = body.editable.filter((item) => !isSwitch(item));
  const named = body.name !== null;
  const row = (item: PropItem) => <PropRowView key={item.name} item={item} debug={debug} onSelect={onSelect} onHover={onHover} />;
  return (
    <>
      <div className="section identity">
        <div className="title-line">
          <BackButton onSelect={onSelect} />
          {named && (
            <span className="component" title={body.component}>
              {body.component}
            </span>
          )}
          {body.verdict.status && <StatusView status={body.verdict.status} check />}
          <Keys keys={body.keys} />
        </div>
        <h2 className="name" tabIndex={-1} ref={heading} title={body.name ?? body.component}>
          {body.name ?? body.component}
        </h2>
        <div className="id" data-testid="instance-id" data-id={body.id} title={body.id}>
          {named ? siteOf(body.where, body.component) : body.where}
        </div>
        {body.tags.length > 0 && (
          <div className="verdicts">
            {body.tags.map((tag) => (
              <TagView key={tag.kind} tag={tag} />
            ))}
          </div>
        )}
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
        {(body.editing || hold) && (
          <div className="actions">
            {hold && (
              <button
                type="button"
                className={hold.held ? "btn small holding" : "btn small"}
                aria-pressed={hold.held}
                data-hold={hold.prop}
                onClick={() =>
                  attempt(() =>
                    hold.held ? debug.reset(hold.write.id, hold.write.prop, "instance") : debug.set(hold.write.id, hold.write.prop, true, "instance"),
                  )
                }
              >
                {hold.held ? `Holding ${hold.prop} · Release` : `Hold ${hold.prop}`}
              </button>
            )}
            {body.editing && <ResetInstance debug={debug} id={body.id} enabled={body.editing.resetInstanceEnabled} />}
          </div>
        )}
        {mode === "many" && body.editing?.scopes && view.scope === "instance" && <NoGroup options={body.editing.scopes} onScope={onScope} />}
      </div>
      {notices}
      {body.members && <MembersCard debug={debug} members={body.members} options={body.editing?.scopes ?? null} onScope={onScope} onHover={onHover} />}
      {body.note && (
        <div className="section note-card" role="note">
          <InfoIcon />
          <div className="text">
            <h3>{body.note.title}</h3>
            <p className="body">{body.note.body}</p>
          </div>
        </div>
      )}
      {cards.map((item) => (
        <div key={item.name} className={item.overridden ? "section prop-card overridden" : "section prop-card"}>
          {row(item)}
        </div>
      ))}
      {switches.length > 0 && <div className="section switches">{switches.map(row)}</div>}
      <div className="section inspect">
        <details open={inspectOpen}>
          <summary>
            <ChevronIcon />
            <span className="summary-text">
              {body.inspectOnly.length === 0 ? "Set by the code" : `${body.inspectOnly.length} set by the code`}
              {!inspectOpen && body.inspectOnly.length > 0 && (
                <span className="muted"> · {body.inspectOnly.map((item) => item.name).join(", ")}</span>
              )}
            </span>
            {body.inspectOnlyMeta && <span className="meta">{body.inspectOnlyMeta}</span>}
          </summary>
          <div className="inspect-rows">
            {body.inspectOnly.length === 0 ? <div className="muted">{TEXT.none}</div> : body.inspectOnly.map(row)}
          </div>
          {body.injected && (
            <details className="injected">
              <summary>
                <ChevronIcon />
                {body.injected.summary}
              </summary>
              {body.injected.rows.map((injected) => (
                <div className="row" key={injected.name}>
                  <div className="line">
                    <span className="name">{injected.name}</span>
                    <span className="value">{injected.value}</span>
                  </div>
                </div>
              ))}
            </details>
          )}
        </details>
      </div>
      <CoverageCard coverage={body.coverage} />
    </>
  );
}

/** Editable against inspect-only as a bar, and the call site under it (PER-140). */
function CoverageCard({ coverage }: { coverage: InspectorBody["coverage"] }) {
  const { editable, inspectOnly } = coverage;
  const total = editable + inspectOnly;
  const notGenerated = coverage.notGenerated;
  return (
    <div className="section coverage">
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
        <span className="label">Call site</span>
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

/**
 * Select multiple, on an Instance with no call site to group by: it is selected
 * alone, and the page is still one click away when that scope applies.
 */
function NoGroup({ options, onScope }: { options: ScopeOption[]; onScope(scope: Scope): void }) {
  const group = options.find((option) => option.scope === "group");
  const page = options.find((option) => option.scope === "page");
  return (
    <div className="selection">
      <span className="muted">{group?.title ?? "Only this Instance can be selected here."}</span>
      {page?.enabled && <WidenButton option={page} verb="Widen to" onScope={onScope} />}
    </div>
  );
}

/** Widens a call site's selection to the page, or narrows it back. */
function WidenButton({ option, verb, onScope }: { option: ScopeOption; verb: string; onScope(scope: Scope): void }) {
  return (
    <button type="button" className="widen" data-scope={option.scope} title={option.title ?? option.label} onClick={() => onScope(option.scope)}>
      {/* What it can't change stays in the tooltip: "(1 server-rendered, inspect only)". */}
      {verb} {option.label.replace(/ \(.*\)$/, "")}
    </button>
  );
}

/**
 * Who a group or page change reaches, with a box to leave each one out. A page
 * scope groups them by call site, so one box leaves a whole call site out.
 */
function MembersCard({
  debug,
  members,
  options,
  onScope,
  onHover,
}: Pick<Actions, "debug" | "onHover" | "onScope"> & { members: MembersView; options: ScopeOption[] | null }) {
  const { scope } = members;
  const current = options?.find((option) => option.scope === scope) ?? null;
  // At a call site, widen to the page; at the page, narrow back to the call site.
  const other = options?.find((option) => option.scope === (scope === "group" ? "page" : "group") && option.enabled) ?? null;
  const toggle = (action: "include" | "exclude", id: string) =>
    attempt(() => (action === "include" ? debug.include(id, scope) : debug.exclude(id, scope)));
  const memberItem = (member: MembersView["members"][number]) => (
    <li key={member.id} onMouseOver={() => onHover([member.id])} onMouseLeave={() => onHover([])}>
      <label>
        <input
          type="checkbox"
          data-member={member.id}
          checked={!member.out}
          disabled={members.suspended}
          onChange={() => toggle(member.toggle, member.id)}
          onFocus={() => onHover([member.id])}
          onBlur={() => onHover([])}
        />
        {/* By name only: the key that tells Instances apart is for engineers, in the tooltip. */}
        <span className={member.out ? "who out" : "who"} title={member.id}>
          <span className="screen-name">{member.name ?? member.label}</span>
          {member.label === THIS_INSTANCE && member.name && <span className="self">{THIS_INSTANCE}</span>}
        </span>
        {member.tag && <TagView tag={member.tag} />}
      </label>
    </li>
  );
  return (
    <div className="section members" data-testid="members">
      <div className="head">
        <h3>{current ? current.label.replace(/ · \d+.*$/, "") : "Instances"}</h3>
        <span className="meta">{members.countText}</span>
      </div>
      <div className="selection-actions">
        {other && <WidenButton option={other} verb={scope === "group" ? "Widen to" : "Narrow to"} onScope={onScope} />}
        <button
          type="button"
          className="btn small"
          disabled={!members.reset.enabled}
          onClick={() => attempt(() => debug.discard(members.reset.target))}
        >
          <ResetIcon />
          Reset this scope
        </button>
      </div>
      {/* The list folds away, as Figma keeps layers out of the properties: open while one is left out. */}
      <details className="fold" open={members.members.some((member) => member.out)}>
        <summary>
          <ChevronIcon />
          {plural(members.members.length, "Instance")}
          <span className="muted"> · untick one to leave it out</span>
        </summary>
        <div className="muted">{TEXT.untick}</div>
      {members.sites === null ? (
        <ul className="list">{members.members.map(memberItem)}</ul>
      ) : (
        members.sites.map((site) => (
          <fieldset key={site.anchor} className="site">
            <legend>
              <label onMouseOver={() => onHover(site.members.map((member) => member.id))} onMouseLeave={() => onHover([])}>
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
      </details>
    </div>
  );
}

/** The plot key's numbers in the footer, in every state: each selects what its change reaches. */
const FOOTER_KEYS = 8;

function Footer({
  debug,
  footer,
  onSelect,
  onHover,
}: Pick<Actions, "debug" | "onSelect" | "onHover"> & { footer: PanelView["footer"] }) {
  const offer = useUndoOffer();
  const shown = footer.keys.slice(0, FOOTER_KEYS);
  // The states shown take what room the numbered changes leave.
  const states = footer.states.slice(0, FOOTER_KEYS - shown.length);
  const more = footer.keys.length + footer.states.length - shown.length - states.length;
  return (
    <footer className="footer">
      <div className="tally">
        <span className="count" aria-live="polite">
          <span className={footer.hasOverrides ? "dot override" : "dot none"} />
          <span className="text">{footer.countText}</span>
        </span>
        <span className="undo" role="status">
          {offer && (
            <>
              <span className="what">{offer.text}</span>
              <button type="button" className="link" onClick={takeUndo}>
                Undo
              </button>
            </>
          )}
        </span>
        {!offer && shown.length + states.length > 0 && (
          <ol className="footer-keys" aria-label="Changes">
            {shown.map((change) => (
              <li key={change.n}>
                <button
                  type="button"
                  title={`${change.detail} · ${change.where}`}
                  disabled={change.select === null}
                  onClick={() => change.select !== null && onSelect(change.select)}
                  onMouseOver={() => onHover(change.reached)}
                  onMouseLeave={() => onHover([])}
                >
                  <Key n={change.n} />
                  <span className="sr-only">
                    {change.detail}, {change.where}
                  </span>
                </button>
              </li>
            ))}
            {states.map((state) => (
              <li key={`${state.select ?? state.where} ${state.detail}`}>
                <button
                  type="button"
                  title={`${state.detail} · ${state.where}`}
                  disabled={state.select === null}
                  onClick={() => state.select !== null && onSelect(state.select)}
                  onMouseOver={() => onHover(state.reached)}
                  onMouseLeave={() => onHover([])}
                >
                  <HeldKey />
                  <span className="sr-only">
                    State shown: {state.detail}, {state.where}
                  </span>
                </button>
              </li>
            ))}
            {more > 0 && <li className="more">+{more}</li>}
          </ol>
        )}
      </div>
      <div className="act">
        <button
          type="button"
          className="btn"
          disabled={footer.resetAll.length === 0}
          onClick={() => {
            // Kept so the footer can put them back: Reset all asks nothing, so it is undoable.
            const saved = debug.records();
            const count = saved.reduce((sum, record) => sum + Object.keys(record.values).length, 0);
            for (const target of footer.resetAll) debug.discard(target);
            offerUndo(`Reset ${plural(count, "Override")}`, () => attempt(() => debug.restore(saved)));
          }}
        >
          <ResetIcon />
          Reset all
        </button>
        <CopyProposalButton disabled={!footer.copyEnabled} />
      </div>
    </footer>
  );
}
