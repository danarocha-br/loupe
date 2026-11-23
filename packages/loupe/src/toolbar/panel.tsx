// The panel (PER-140; Paper's "Inspector as property rows" since 2026-11-22): a sheet
// in the column the page makes room for, with a pinned header card (the wordmark, the
// select tools, Hide marks, Hide) and footer card (the change count, Reset all, the
// undo offer, light or dark and Copy Proposal), and a scrolling middle of cards. The middle holds
// either the page's numbered changes and component list (nothing selected) or the
// inspector: one card of property rows, at This instance or, with Select multiple, a
// group or page scope (PER-134). The scope is the select tool, as in Figma: there is no
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
import type { Scope, ScopeTarget } from "../runtime/store.js";
import { attempt, Breakable, Key, PropRowView } from "./controls.js";
import type { Column } from "./dock.js";
import { CopyFlow } from "./copy-flow.js";
import { FlagsCard } from "./flags.js";
import { Button, Chip, ChipGroup, Fold, FoldChevron, FoldPanel, FoldTrigger, lookAttributes, Toggle, useAnnounceChange } from "./ui/index.js";
import { plural } from "./format.js";
import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  ContrastIcon,
  CursorIcon,
  ElbowIcon,
  EyeIcon,
  FileIcon,
  InfoIcon,
  LayersIcon,
  MarksHiddenIcon,
  MarksIcon,
  PanelIcon,
  PROP_ICONS,
  ResetIcon,
  SelectManyIcon,
  WidenIcon,
  Wordmark,
} from "./icons.js";
import { layerAnnouncement, LayerNotices, NotGeneratedNotice } from "./notices.js";
import {
  type CallSiteItem,
  type GoneBody,
  type GroupItem,
  type InspectorBody,
  type ListBody,
  type MembersView,
  type PanelView,
  type PropItem,
  type ScopeOption,
  type StatusTag,
  type Tag,
  inspectOnlyTitle,
  LEGEND,
  TEXT,
} from "./panel-view/index.js";
import { appLang } from "./app-lang.js";
import { hueOf, PageMap } from "./page-map.js";
import type { SelectMode } from "./picker.js";
import { keepUndoWhile, offerUndo, recordsKey, takeUndo, useUndoOffer } from "./undo.js";

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
  /** Hide was pressed: the panel slides back out of the window, and goes once it has. */
  closing?: boolean;
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

/** Pointing at or focusing something outlines `ids` on the page, and leaving it clears them: over, not enter (see above). */
function hoverProps(onHover: Actions["onHover"], ids: string[]) {
  return {
    onMouseOver: () => onHover(ids),
    onMouseLeave: () => onHover([]),
    onFocus: () => onHover(ids),
    onBlur: () => onHover([]),
  };
}

/** The header's select tools are chips of a radio group drawn as Button's round tool. */
const TOOL_LOOK = lookAttributes({ look: "tool", iconOnly: true });

/** The header's two select tools: what each is called, and the scope it opens a selection at. */
const SELECT_TOOLS: { mode: SelectMode; scope: Scope; label: string; hint: string; title: string; icon: ReactNode }[] = [
  {
    mode: "one",
    scope: "instance",
    label: "Select one",
    hint: "Click one thing on the page",
    title: "Select one: click an Instance on the page to change it alone (Esc cancels)",
    icon: <CursorIcon />,
  },
  {
    mode: "many",
    scope: "group",
    label: "Select multiple",
    hint: "Every Instance from one call site",
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
  // The notices' cards come and go with the view; what they say is announced from here.
  const layerSaid = layerAnnouncement(props.layer);
  useAnnounceChange(layerSaid.alert, { politeness: "assertive" });
  useAnnounceChange([layerSaid.status, view.banner ? `${view.banner.title}. ${view.banner.body}` : ""].filter(Boolean).join(" "));
  const { body } = view;
  const opened = body.kind === "list" ? null : body.id;
  // Read while rendering, before React swaps the view: once the row that had focus is
  // gone, nothing after the commit can tell that focus was in the panel (review 2026-11-20).
  const focusWasHere = useRef(false);
  const root = middle.current?.getRootNode();
  focusWasHere.current = root instanceof ShadowRoot && root.activeElement !== null;
  // A new selection, or back to the list, opens at the top. Focus follows it when it
  // was in the panel: a pick on the page leaves the app's focus where it is. The same
  // selection changing kind counts too: an Instance that unmounts swaps the Inspector
  // for Gone (and back when it mounts again), and takes the focused control with it.
  useEffect(() => {
    if (middle.current) middle.current.scrollTop = 0;
    if (focusWasHere.current) heading.current?.focus();
  }, [opened, body.kind]);
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
  // The strip is for the eye; the announcer says it, in the strip's words, as it changes.
  useAnnounceChange(
    props.picking
      ? `${props.mode === "one" ? "Click an Instance on the page" : "Click an Instance: every one from its call site is selected"} · Esc cancels`
      : covered
        ? "A dialog on the page runs under the panel · hold Alt to see through"
        : props.marksHidden
          ? "Outlines are hidden on the page"
          : "",
  );
  return (
    <section
      className={`panel${column.docked ? "" : " overlay"}${peeking ? " peek" : ""}${props.closing ? " closing" : ""}`}
      aria-label="Loupe"
      inert={props.closing || undefined}
      style={{ width: column.width - PANEL_INSET * 2 }}
    >
      <header className="header">
        <div className="brand">
          <Wordmark />
          {/* The page, while nothing is selected: an Instance's identity names it beside the component instead. */}
          {body.kind === "list" && (
            <span className="report" title={`${view.header.report} · ${view.header.route}`}>
              / {view.header.page}
            </span>
          )}
        </div>
        <div className="tools">
          {/* The mode, as a radio group: armed is the page's state, said by the status strip below. */}
          <ChipGroup look="bare" className="select-tools" label="Select" value={props.mode} onChoose={(mode) => props.onTool(mode as SelectMode)}>
            {SELECT_TOOLS.map((tool) => (
              <Chip
                key={tool.mode}
                value={tool.mode}
                {...TOOL_LOOK}
                className="tool"
                data-scope={tool.scope}
                data-armed={props.picking && props.mode === tool.mode ? "" : undefined}
                title={tool.title}
              >
                {tool.icon}
                <span className="sr-only">{tool.label}</span>
              </Chip>
            ))}
          </ChipGroup>
          <span className="divider" aria-hidden="true" />
          <Toggle
            look="tool"
            iconOnly
            data-marks=""
            pressed={props.marksHidden}
            onPressedChange={() => props.onMarks()}
            title={
              props.marksHidden
                ? "Show marks: outline the selection on the page again"
                : "Hide marks: take Loupe’s outlines off the page, to judge the change as it will ship. The selection stays."
            }
          >
            {props.marksHidden ? <MarksHiddenIcon /> : <MarksIcon />}
            <span className="sr-only">Hide marks</span>
          </Toggle>
          <Button look="tool" iconOnly onClick={props.onHide} title="Hide the panel">
            <PanelIcon />
            <span className="sr-only">Hide panel</span>
          </Button>
        </div>
      </header>
      <div className="status-region">{status && <div className="status-line">{status}</div>}</div>
      <div className="middle" ref={middle}>
        {body.kind === "list" ? (
          <ComponentList {...props} body={body} notices={notices} heading={heading} />
        ) : body.kind === "gone" ? (
          <Gone {...props} body={body} notices={notices} heading={heading} />
        ) : (
          <Inspector {...props} body={body} notices={notices} heading={heading} />
        )}
      </div>
      <Footer debug={props.debug} footer={view.footer} theme={props.theme} onTheme={props.onTheme} />
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
    <div className="section notice-card banner">
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
  "not-visible": "tag dashed",
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

function ComponentList({
  debug,
  onSelect,
  onHover,
  body,
  notices,
  heading,
  onTool,
  mode,
  picking,
}: Actions & Heading & Pick<PanelProps, "onTool" | "mode" | "picking"> & { body: ListBody; notices: ReactNode }) {
  // One component pointed at, on the map or on its row: both light it, and the page outlines it.
  const [lit, setLit] = useState<string | null>(null);
  const point = (group: GroupItem | null) => {
    setLit(group?.component ?? null);
    onHover(group ? group.outlineIds : []);
  };
  return (
    <>
      <div className="section hero">
        {/* `name` with the other views' headings: focus finds each view's by `h2.name`. */}
        <h2 className="name hero-title" tabIndex={-1} ref={heading}>
          {TEXT.startTitle}
        </h2>
        <p className="body">{TEXT.startBody}</p>
        <ChipGroup look="bare" className="hero-tools" label="Start selecting" value={mode} onChoose={(next) => onTool(next as SelectMode)}>
          {SELECT_TOOLS.map((tool) => (
            <Chip
              key={tool.mode}
              value={tool.mode}
              className="big-tool"
              data-armed={picking && mode === tool.mode ? "" : undefined}
              title={tool.title}
            >
              <ToolPreview mode={tool.mode} />
              <span className="t">{tool.label}</span>
              <span className="h">{tool.hint}</span>
            </Chip>
          ))}
        </ChipGroup>
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
                  onFocus={() => onHover(change.reached)}
                  onBlur={() => onHover([])}
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
      <div className="section on-page">
        <div className="head">
          <h3>On this page</h3>
          <span className="meta">{body.summary}</span>
        </div>
        <PageMap debug={debug} groups={body.groups} lit={lit} onPoint={point} onSelect={onSelect} />
        <ul className="list" aria-label="Components on this page">
          {body.groups.map((group, index) => (
            <GroupRow key={group.component} group={group} hue={hueOf(index)} lit={lit === group.component} point={point} onSelect={onSelect} onHover={onHover} />
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

/** What each select tool does, drawn small: three controls, one ringed or every one from a call site. */
function ToolPreview({ mode }: { mode: SelectMode }) {
  const many = mode === "many";
  return (
    <span className="preview" aria-hidden="true">
      <span className={many ? "chip dashed" : "chip"} />
      <span className="chip ringed" />
      <span className={many ? "chip dashed" : "chip"} />
      <svg className="pointer" viewBox="238 238 36 36" focusable="false">
        <path d="M247.171 248.005l5.315 17.434c0.354 1.16 1.906 1.232 2.341 0.121l2.854-6.582c0.212-0.535 0.675-0.959 1.24-1.09l7.272-1.705c1.17-0.273 1.21-1.928 0.131-2.352l-17.597-7.366c-1.08-0.454-1.866 0.535-1.553 1.544z" />
      </svg>
    </span>
  );
}

/**
 * One component on the page (Rows option B): its name, a bar for how much the page
 * uses it next to the most used, and its count. Opened, its call sites as cards: a
 * card inspects the call site's Instances, a dot one of them.
 */
function GroupRow({
  group,
  hue,
  lit,
  point,
  onSelect,
  onHover,
}: Pick<Actions, "onSelect" | "onHover"> & { group: GroupItem; hue: string; lit: boolean; point(group: GroupItem | null): void }) {
  const { inspectOnly } = group;
  const unmounted = group.instances.filter((item) => !item.mounted);
  return (
    <li className={`group ${hue}${lit ? " lit" : ""}${inspectOnly ? " inspect-only" : ""}`}>
      <Fold>
        <FoldTrigger
          onMouseOver={() => point(group)}
          onMouseLeave={() => point(null)}
          onFocus={() => point(group)}
          onBlur={() => point(null)}
          title={group.statusTitle ?? undefined}
        >
          {/* The whole name, wrapping where its words meet: a long one is never cut short (layout review). */}
          <span className="cname">
            <span>
              <Breakable text={group.component} />
            </span>
            {inspectOnly && <EyeIcon />}
          </span>{" "}
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${Math.round(group.share * 1000) / 10}%` }} />
          </span>
          <span className="times">{group.count}</span>
          <span className="sub">
            {/* No board draws it, but it says what to run: the one verdict the row keeps in words. */}
            {group.verdict.status?.kind === "not-generated" && <StatusView status={group.verdict.status} title={group.statusTitle} />}
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
          <FoldChevron />
        </FoldTrigger>
        <FoldPanel>
        {group.sites.length > 0 && (
          <div className="sites">
            <div className="sites-head">{group.sitesText}</div>
            {group.sites.map((site) => (
              <SiteCard key={site.anchor} site={site} onSelect={onSelect} onHover={onHover} />
            ))}
          </div>
        )}
        {unmounted.length > 0 && (
          <ul className="list unmounted">
            {unmounted.map((item) => (
              <li key={item.id}>
                <button type="button" data-instance={item.id} onClick={() => onSelect(item.id)}>
                  <Keys keys={item.keys} />
                  <span className="who">
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
        )}
        </FoldPanel>
      </Fold>
    </li>
  );
}

/** A call site's card: where it is written and what it shows; its dots are its Instances, each one to pick alone. */
function SiteCard({ site, onSelect, onHover }: Pick<Actions, "onSelect" | "onHover"> & { site: CallSiteItem }) {
  const several = site.ids.length > 1;
  return (
    <div className="site-card" onMouseOver={() => onHover(site.ids)} onMouseLeave={() => onHover([])}>
      {/* Every Instance from the call site at once, as Select multiple picks them; one alone as Select one. */}
      <button
        type="button"
        className="open"
        data-site-card={site.anchor}
        onClick={() => onSelect(site.select, several ? "many" : undefined)}
        {...hoverProps(onHover, site.ids)}
        aria-label={`Inspect ${site.label}: ${site.names}`}
      />
      <span className="where">
        <span className="file">{site.label}</span>
        <span className="names">
          <span>{site.names}</span>
          {!site.supported && <EyeIcon />}
        </span>
      </span>
      <span className="dots">
        {site.instances.map(({ id, label }) => {
          const hover = hoverProps(onHover, [id]);
          return (
            <button
              key={id}
              type="button"
              data-instance={id}
              title={label}
              aria-label={`Inspect ${label}`}
              onClick={() => onSelect(id)}
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
              <Button
                size="small"
                onClick={(event) => {
                  const button = event.currentTarget;
                  dropUndoably(debug, item.target, (count) => `Discarded ${plural(count, "held Override")}`);
                  focusHeading(button);
                }}
              >
                Discard
              </Button>
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
    <Button iconOnly className="back" onClick={() => onSelect(null)} title="Back to every component on this page (Esc)">
      <BackIcon />
      <span className="sr-only">All components</span>
    </Button>
  );
}

/**
 * A button that goes once it has done its job (a Reset with nothing left to reset)
 * hands focus to the heading, so a keyboard doesn't fall out of the panel.
 */
function focusHeading(from: HTMLElement) {
  const root = from.getRootNode();
  if (root instanceof ShadowRoot) root.querySelector<HTMLElement>("h2.name")?.focus();
}

/** "Reset 2 Overrides": what the footer's undo offer says a reset dropped. */
const resetText = (count: number) => `Reset ${plural(count, "Override")}`;

/**
 * Drops one record and offers to put it back. Nothing in the panel asks before it
 * drops a designer's work, so every reset and Discard is undoable, as Reset all is.
 */
function dropUndoably(debug: LoupeDebug, target: ScopeTarget, text: (count: number) => string) {
  const key = JSON.stringify(target);
  const saved = debug.records().filter((record) => JSON.stringify(record.target) === key);
  try {
    debug.discard(target);
  } catch {
    // Nothing was dropped (Overrides went off), so there is nothing to offer back.
    return;
  }
  const count = saved.reduce((sum, record) => sum + Object.keys(record.values).length, 0);
  offerUndo(text(count), () => attempt(() => debug.restore(saved)), recordsKey(debug));
}

/** `discard` also drops the record of an Instance that isn't mounted, where `reset(id)` throws (PER-128). */
function ResetInstance({ debug, id, enabled }: { debug: LoupeDebug; id: string; enabled: boolean }) {
  return (
    <Button
      size="small"
      disabled={!enabled}
      onClick={(event) => {
        const button = event.currentTarget;
        dropUndoably(debug, { scope: "instance", id }, resetText);
        focusHeading(button);
      }}
    >
      Reset this Instance
    </Button>
  );
}

/** "Not on the page now": what it was and where it is written, why it may be gone, and what it still holds. */
function Gone({ debug, onSelect, body, notices, heading }: Actions & Heading & { body: GoneBody; notices: ReactNode }) {
  return (
    <>
      <div className="section identity">
        <div className="title-line">
          <BackButton onSelect={onSelect} />
          {body.component && <span className="status">{TEXT.notOnPage}</span>}
        </div>
        <h2 className="name" tabIndex={-1} ref={heading} title={body.id}>
          {body.component ?? TEXT.notOnPage}
        </h2>
        {body.where && (
          <div className="id" title={body.id}>
            {body.where}
          </div>
        )}
        <p className="body">{TEXT.showsWhenMounted}</p>
        {body.held && (
          <div className="verdicts">
            <TagView tag={body.held.tag} />
          </div>
        )}
        {body.held && <HeldValues values={body.held.values} />}
        {body.canReset && (
          <div className="actions">
            <ResetInstance debug={debug} id={body.id} enabled />
          </div>
        )}
      </div>
      {notices}
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
  // State props first: a menu's `open` is the switch a designer reaches for.
  const switches = body.editable.filter(isSwitch).sort((a, b) => Number(b.state) - Number(a.state));
  const cards = body.editable.filter((item) => !isSwitch(item));
  const named = body.name !== null;
  const site = body.coverage.callSite;
  // At This instance the State prop's own switch holds it; at a wider scope that switch can't, so the button does.
  const holdButton = hold && view.scope !== "instance" ? hold : null;
  const resetInstance = body.editing?.resetInstanceEnabled === true;
  // The exceptions: a server or stale tag, and the scopes acting on it, unless the scope's own section already names its scope.
  const chips = body.members ? [] : body.chips;
  // The marks' legend: a row of its own under the options, when any of them marks a default.
  const legend = cards.some((item) => item.control?.kind === "options" && item.control.options.some((option) => option.isDefault));
  const row = (item: PropItem) => <PropRowView key={item.name} item={item} debug={debug} onSelect={onSelect} onHover={onHover} />;
  const propRow = (item: PropItem, toggle: boolean) => (
    <div key={item.name} className={`prop${toggle ? " switch-row" : ""}${item.overridden ? " overridden" : ""}`}>
      <span className="glyph" aria-hidden="true">
        {PROP_ICONS[item.glyph]}
      </span>
      {row(item)}
    </div>
  );
  return (
    <>
      {notices}
      <div className="section inspector">
        <div className="identity">
          <div className="title-line">
            <div className="lead">
              <BackButton onSelect={onSelect} />
              {named && (
                <span className="component">
                  <Breakable text={body.component} />
                </span>
              )}
              <span className="report route">/ {view.header.page}</span>
            </div>
            {body.verdict.status && <StatusView status={body.verdict.status} check />}
            <Keys keys={body.keys} />
          </div>
          {/* The app's own words, in whatever script it writes: `dir="auto"` lays them out their way. */}
          <h2 className="name" tabIndex={-1} ref={heading} title={body.name ?? body.component} dir="auto" lang={body.name ? appLang() : undefined}>
            {body.name ?? body.component}
          </h2>
          {/* Where it is written, and which of that call site's Instances it is; the full path and key in the tooltip. */}
          <div className="id" data-testid="instance-id" data-id={body.id} title={site ? `${site.title}\n${body.id}` : body.id}>
            <FileIcon />
            {/* The file names the place, the line finds it: set apart, lighter. */}
            <span>
              {body.source.file}
              <span className="line">{body.source.line}</span>
            </span>
          </div>
          {(body.tags.length > 0 || chips.length > 0) && (
            <div className="verdicts" data-testid="chips">
              {body.tags.map((tag) => (
                <TagView key={tag.kind} tag={tag} />
              ))}
              {chips.map((chip) => (
                <span key={chip} className="tag">
                  {chip}
                </span>
              ))}
            </div>
          )}
          {body.coverage.notGenerated && (
            <div className="warn" data-testid="not-generated">
              <span className="dot" />
              <span>
                <StatusView status={body.coverage.notGenerated.tag} /> {TEXT.run}{" "}
                <span className="mono verbatim">{body.coverage.notGenerated.command}</span> {TEXT.fromRootToReadProps}
              </span>
            </div>
          )}
          {(holdButton || resetInstance) && (
            <div className="actions">
              {holdButton && (
                <Toggle
                  size="small"
                  pressed={holdButton.held}
                  data-hold={holdButton.prop}
                  onPressedChange={(hold) =>
                    attempt(() =>
                      hold
                        ? debug.set(holdButton.write.id, holdButton.write.prop, true, "instance")
                        : debug.reset(holdButton.write.id, holdButton.write.prop, "instance"),
                    )
                  }
                >
                  {holdButton.held ? `Holding ${holdButton.prop} · Release` : `Hold ${holdButton.prop}`}
                </Toggle>
              )}
              {resetInstance && <ResetInstance debug={debug} id={body.id} enabled />}
            </div>
          )}
          {mode === "many" && body.editing?.scopes && view.scope === "instance" && <NoGroup options={body.editing.scopes} onScope={onScope} />}
          {body.crumbs.length > 0 && (
            <div className="inside" data-testid="inside">
              <span className="inside-label">Inside</span>
              <ol>
                {[...body.crumbs].reverse().map((crumb, index) => (
                  <li key={crumb.id} style={{ paddingLeft: index === 0 ? 0 : (index - 1) * 18 }}>
                    {index > 0 && <ElbowIcon />}
                    <button type="button" onClick={() => onSelect(crumb.id)}>
                      {crumb.label}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        {body.note && (
          <div className="note-card" role="note">
            <InfoIcon />
            <div className="text">
              <h3>{body.note.title}</h3>
              <p className="body">{body.note.body}</p>
            </div>
          </div>
        )}
        {body.members && (
          <ScopeSection
            debug={debug}
            members={body.members}
            options={body.editing?.scopes ?? null}
            selected={body.id}
            onScope={onScope}
            onHover={onHover}
          />
        )}
        {cards.map((item) => propRow(item, false))}
        {legend && <Legend app={cards.some((card) => card.change !== null && card.counts === null)} />}
        {switches.map((item) => propRow(item, true))}
        <InspectOnly key={body.id} body={body} row={row} />
      </div>
    </>
  );
}

/** What a chip's marks mean, once, on a row of its own under the options. */
function Legend({ app }: { app: boolean }) {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i className="shown" />
        {LEGEND.shown}
      </span>
      {app && (
        <span>
          <i className="app" />
          {LEGEND.app}
        </span>
      )}
      <span>
        <i className="is-default" />
        {LEGEND.default}
      </span>
    </div>
  );
}

/**
 * The props it shows but can't change here, folded to one row (open when nothing
 * else can change). Closed, the row names them; one cause for them all is said
 * once, under the row, instead of a tag on every row.
 */
function InspectOnly({ body, row }: { body: InspectorBody; row(item: PropItem): ReactNode }) {
  const [open, setOpen] = useState(body.editable.length === 0);
  const items = body.inspectOnly;
  const reasons = new Set(items.map((item) => item.reason));
  const [only] = reasons.size === 1 ? [...reasons] : [];
  const shared = only ? items.find((item) => item.reason === only) : undefined;
  const rows = shared ? items.map((item) => ({ ...item, reason: null })) : items;
  return (
    <div className="inspect">
      <Fold open={open} onOpenChange={setOpen}>
        <FoldTrigger>
          <span className="glyph" aria-hidden="true">
            {PROP_ICONS.inspect}
          </span>
          <span className="summary-text" data-testid="inspect-only">
            {inspectOnlyTitle(items.length)}
            {!open && items.length > 0 && <span className="muted"> · {items.map((item) => item.name).join(", ")}</span>}
          </span>
          {body.inspectOnlyMeta ? <span className="meta">{body.inspectOnlyMeta}</span> : <span />}
          <FoldChevron />
        </FoldTrigger>
        <FoldPanel>
        {shared?.reason && (
          <p className="why">
            <span className="tag reason" title={shared.reasonTitle ?? undefined}>
              {shared.reason}
            </span>{" "}
            {shared.reasonTitle}
          </p>
        )}
        <div className="inspect-rows">{rows.length === 0 ? <div className="muted">{TEXT.none}</div> : rows.map(row)}</div>
        {body.injected && (
          <Fold className="injected">
            <FoldTrigger>
              <FoldChevron />
              {body.injected.summary}
            </FoldTrigger>
            <FoldPanel>
            {body.injected.rows.map((injected) => (
              <div className="row" key={injected.name}>
                <div className="line">
                  <span className="name">{injected.name}</span>
                  <span className="value">{injected.value}</span>
                </div>
              </div>
            ))}
            </FoldPanel>
          </Fold>
        )}
        </FoldPanel>
      </Fold>
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
      {/* Widened, this goes, and the page scope has no call site to narrow back to: its button goes with it. */}
      {page?.enabled && <WidenButton option={page} verb="Widen to" onScope={onScope} goes />}
    </div>
  );
}

/**
 * Widens a call site's selection to the page, or narrows it back: "Widen to All on page · 7".
 * One that `goes` once pressed hands focus to the heading, as a spent Reset does.
 */
function WidenButton({ option, verb, onScope, goes = false }: { option: ScopeOption; verb: string; onScope(scope: Scope): void; goes?: boolean }) {
  return (
    <Button
      className="widen"
      data-scope={option.scope}
      title={option.title ?? option.label}
      onClick={(event) => {
        const button = event.currentTarget;
        onScope(option.scope);
        if (goes) focusHeading(button);
      }}
    >
      <WidenIcon />
      {/* What it can't change stays in the tooltip: "(1 server-rendered, inspect only)". */}
      {verb} {option.label.replace(/ \(.*\)$/, "")}
    </Button>
  );
}

/** As many dots as a scope's meter can show: past this, the words alone say how far it reaches. */
const METER_MAX = 12;

/**
 * Select multiple's scope: who a group or page change reaches, a dot for each of the
 * component's Instances on the page, the way to widen or narrow it, and its Instances
 * folded behind their count, each with a box to leave it out. A page scope groups them
 * by call site, so one box leaves a whole call site out.
 */
function ScopeSection({
  debug,
  members,
  options,
  selected,
  onScope,
  onHover,
}: Pick<Actions, "debug" | "onHover" | "onScope"> & { members: MembersView; options: ScopeOption[] | null; selected: string }) {
  const { scope, reach } = members;
  const current = options?.find((option) => option.scope === scope) ?? null;
  // At a call site, widen to the page; at the page, narrow back to the call site.
  const other = options?.find((option) => option.scope === (scope === "group" ? "page" : "group") && option.enabled) ?? null;
  // Open while one is left out, as Figma keeps layers out of the properties until asked.
  const leftOut = members.members.some((member) => member.out);
  const toggle = (action: "include" | "exclude", id: string) =>
    attempt(() => (action === "include" ? debug.include(id, scope) : debug.exclude(id, scope)));
  const memberItem = (member: MembersView["members"][number]) => {
    const picked = member.id === selected;
    return (
      <li key={member.id} {...hoverProps(onHover, [member.id])}>
        <label>
          <input
            type="checkbox"
            data-member={member.id}
            checked={!member.out}
            disabled={members.suspended}
            onChange={() => toggle(member.toggle, member.id)}
          />
          {/* By name only: the key that tells Instances apart is for engineers, in the tooltip. */}
          <span className={`who${member.out ? " out" : ""}${picked ? " picked" : ""}`} title={member.id}>
            <span className="screen-name" dir="auto" lang={member.name ? appLang() : undefined}>
              {member.name ?? member.label}
            </span>
          </span>
          {member.tag && <TagView tag={member.tag} />}
          {picked && <span className="tag picked">{TEXT.picked}</span>}
        </label>
      </li>
    );
  };
  const name = current ? current.label.replace(/ · \d+.*$/, "") : "Instances";
  return (
    <Fold defaultOpen={leftOut} className="scope-fold">
      <div className="scope" data-testid="members">
        <div className="scope-title">
          <div className="lead">
            <LayersIcon />
            <h3 title={current?.title ?? undefined}>
              <Breakable text={name} />
            </h3>
          </div>
          {reach.page <= METER_MAX && (
            <span className="meter" aria-hidden="true">
              {Array.from({ length: reach.page }, (_, index) => (
                <i key={index} className={index < reach.included ? "in" : undefined} />
              ))}
            </span>
          )}
        </div>
        <p className="reach">
          {reach.lead}{" "}
          <b>
            {reach.included} of {reach.total}
          </b>
          {reach.moreText && <> · {reach.moreText}</>}
        </p>
        <div className="scope-actions">
          {other && <WidenButton option={other} verb={scope === "group" ? "Widen to" : "Narrow to"} onScope={onScope} />}
          {members.reset.enabled && (
            <Button
              size="small"
              onClick={(event) => {
                const button = event.currentTarget;
                dropUndoably(debug, members.reset.target, resetText);
                focusHeading(button);
              }}
            >
              <ResetIcon />
              Reset this scope
            </Button>
          )}
          <FoldTrigger inline className="count-toggle">
            {plural(members.members.length, "Instance")}
            <FoldChevron />
          </FoldTrigger>
        </div>
      </div>
      <FoldPanel>
      <div className="members">
        <p className="hint">{TEXT.untick}</p>
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
                    onFocus={() => onHover(site.members.map((member) => member.id))}
                    onBlur={() => onHover([])}
                    onChange={() => {
                      for (const id of site.toggle.ids) toggle(site.toggle.action, id);
                    }}
                  />
                  <span className="who">
                    <span className="screen-name" title={site.anchor}>
                      {site.label} <span className="muted">· {site.count}</span>
                    </span>
                  </span>
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
                <span className="server-name" title={server.id}>
                  {server.label}
                </span>
                <TagView tag={server.tag} />
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
      </div>
      </FoldPanel>
    </Fold>
  );
}

/**
 * The footer: how many changes the Proposal will list and the states it shows, Reset
 * all, the undo offer after a reset, light or dark, and Copy Proposal.
 */
function Footer({
  debug,
  footer,
  theme,
  onTheme,
}: Pick<Actions, "debug"> & Pick<PanelProps, "theme" | "onTheme"> & { footer: PanelView["footer"] }) {
  const offer = useUndoOffer();
  // Each offer as it is made, and the count as it changes, unless an offer is up: the
  // offer says what the change was (Reset all), and Undo's count is said once the
  // restored records reach the view.
  useAnnounceChange(offer?.text ?? "", { key: offer });
  useAnnounceChange(offer ? "" : footer.countText, { key: footer.countText });
  // The offer stays until the Overrides move on from what the drop left (undo.ts).
  useEffect(() => {
    if (offer !== null) keepUndoWhile(recordsKey(debug));
  });
  // Reset all goes disabled once it has acted: focus moves to its Undo, the next thing to do.
  const undoButton = useRef<HTMLButtonElement>(null);
  const focusUndo = useRef(false);
  useEffect(() => {
    if (!focusUndo.current || offer === null) return;
    focusUndo.current = false;
    undoButton.current?.focus();
  }, [offer]);
  // Undo goes once it is taken: focus moves back to Reset all, which has something to reset again.
  const resetAllButton = useRef<HTMLButtonElement>(null);
  const focusResetAll = useRef(false);
  useEffect(() => {
    const button = resetAllButton.current;
    if (!focusResetAll.current || offer !== null || !button) return;
    // The view catches up with the restored records a frame later: wait for the button to come back.
    if (button.disabled && debug.records().length > 0) return;
    focusResetAll.current = false;
    if (button.disabled) focusHeading(button);
    else button.focus();
  });
  // Copy Proposal's popovers stand over the whole footer.
  const frame = useRef<HTMLElement>(null);
  return (
    <footer ref={frame} className="footer">
      <div className="tally">
        <span className="count">
          <span className="sr-only">{footer.countText}</span>
          <span className="n" aria-hidden="true">
            {footer.changes.count}
          </span>
          <span className="word" aria-hidden="true">
            {footer.changes.word}
          </span>
          {footer.states.chip && (
            <span className="held-chip" aria-hidden="true" title={footer.states.title}>
              <span className="dot" />
              {footer.states.chip}
            </span>
          )}
        </span>
        <Button
          className="reset-all"
          ref={resetAllButton}
          disabled={footer.resetAll.length === 0}
          onClick={() => {
            // Kept so the footer can put them back: Reset all asks nothing, so it is undoable.
            const saved = debug.records();
            const count = saved.reduce((sum, record) => sum + Object.keys(record.values).length, 0);
            for (const target of footer.resetAll) debug.discard(target);
            focusUndo.current = true;
            offerUndo(resetText(count), () => attempt(() => debug.restore(saved)), recordsKey(debug));
          }}
        >
          <ResetIcon />
          Reset all
        </Button>
        <span className="undo">
          {offer && (
            <>
              <span className="what">{offer.text}</span>
              <button
                type="button"
                className="link"
                ref={undoButton}
                onClick={() => {
                  focusResetAll.current = true;
                  takeUndo();
                }}
              >
                Undo
              </button>
            </>
          )}
        </span>
      </div>
      <div className="act">
        {/* Pressed in dark, unmarked: the whole panel says it. */}
        <Toggle
          size="large"
          iconOnly
          marksPressed={false}
          className="theme"
          pressed={theme === "dark"}
          onPressedChange={() => onTheme()}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          <ContrastIcon />
          <span className="sr-only">Dark theme</span>
        </Toggle>
        <CopyFlow disabled={!footer.copyEnabled} frame={frame} />
      </div>
    </footer>
  );
}
