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
import type { LoupeDebug } from "../runtime/debug.js";
import type { Scope, ScopeTarget } from "../runtime/store.js";
import { attempt, PropRowView } from "./controls.js";
import type { Column } from "./dock.js";
import { CopyFlow } from "./copy-flow.js";
import { FlagsCard } from "./flags.js";
import { Button, Card, Chip, ChipGroup, Dot, Kbd, lookAttributes, Toggle, useAnnounce, useAnnounceChange } from "./ui/index.js";
import { plural } from "./format.js";
import { ContrastIcon, CursorIcon, MarksHiddenIcon, MarksIcon, PanelIcon, ResetIcon, SelectManyIcon, Wordmark } from "./ui/icon/icon.js";
import {
  COMMAND_WORDS,
  type GoneBody,
  type GroupItem,
  type InspectorBody,
  INSPECTOR_WORDS,
  isSwitch,
  type ListBody,
  LIST_WORDS,
  type PanelView,
  type PropItem,
} from "./panel-view/index.js";
import { appLang } from "./app-lang.js";
import {
  AppearsOnInteraction,
  ChangeList,
  GroupRow,
  HeldForReview,
  Identity,
  InspectOnly,
  InstanceNote,
  Legend,
  NoGroup,
  Notice,
  OnThisPage,
  ScopeSection,
  StartCard,
} from "./patterns/index.js";
import { copyToClipboard } from "./clipboard.js";
import { PageMapView } from "./page-map.js";
import type { SelectMode } from "./picker.js";
import { keepUndoWhile, offerUndo, recordsKey, takeUndo, type UndoOffer, useUndoOffer } from "./undo.js";

type PanelProps = {
  debug: LoupeDebug;
  view: PanelView;
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

/** The header's select tools are chips of a radio group drawn as Button's round tool. */
const TOOL_LOOK = lookAttributes({ look: "tool", iconOnly: true });

/** The header's two select tools: the scope each opens a selection at, and its icon. Their words are panel-view's. */
const SELECT_TOOLS: { mode: SelectMode; scope: Scope; icon: ReactNode }[] = [
  { mode: "one", scope: "instance", icon: <CursorIcon /> },
  { mode: "many", scope: "group", icon: <SelectManyIcon /> },
];

export function Panel(props: PanelProps) {
  const { view, column } = props;
  const middle = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const peeking = usePeek();
  const covered = useCoveredDialog(column);
  const notices = view.notices.map((notice) => <Notice key={notice.kind} notice={notice} words={COMMAND_WORDS} onCopy={copyToClipboard} />);
  // The notices' cards come and go with the view; what they say is announced from here.
  useAnnounceChange(view.announcements.alert, { politeness: "assertive" });
  useAnnounceChange(view.announcements.status);
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
  // The strip's words, once: drawn with their keys in `kbd`, and said by the announcer
  // as they change. A key is a `{ key }` part.
  const strip: StripPart[] | null = props.picking
    ? [props.mode === "one" ? "Click an Instance on the page" : "Click an Instance: every one from its call site is selected", " · ", { key: "Esc" }, " cancels"]
    : covered
      ? ["A dialog on the page runs under the panel · hold ", { key: "Alt" }, " to see through"]
      : props.marksHidden
        ? ["Outlines are hidden on the page"]
        : null;
  useAnnounceChange(strip ? strip.map((part) => (typeof part === "string" ? part : part.key)).join("") : "");
  const status = strip?.map((part, index) => (typeof part === "string" ? part : <Kbd key={index}>{part.key}</Kbd>));
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
                title={LIST_WORDS.tools[tool.mode].title}
              >
                {tool.icon}
                <span className="sr-only">{LIST_WORDS.tools[tool.mode].label}</span>
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
      <StartCard words={LIST_WORDS} mode={mode} armed={picking} onTool={onTool} headingRef={heading} />
      {notices}
      {body.notGenerated && <Notice notice={body.notGenerated} words={COMMAND_WORDS} onCopy={copyToClipboard} />}
      <ChangeList changes={body.changes} words={LIST_WORDS} onSelect={(id) => onSelect(id)} onHover={onHover} />
      <HeldForReview
        items={body.suspended}
        meta={body.suspendedMeta}
        words={LIST_WORDS}
        onDiscard={(target) => {
          dropUndoably(debug, target, (count) => `Discarded ${plural(count, "held Override")}`);
          // The card may go with its last record: the keyboard stays in the panel, on the view's heading.
          heading.current?.focus();
        }}
      />
      <OnThisPage words={LIST_WORDS} summary={body.summary} map={<PageMapView debug={debug} groups={body.groups} lit={lit} onPoint={point} onSelect={onSelect} />}>
        {body.groups.map((group) => (
          <GroupRow
            key={group.component}
            group={group}
            lit={lit === group.component}
            words={INSPECTOR_WORDS}
            onPoint={point}
            // Every Instance from the call site at once, as Select multiple picks them; one alone as Select one.
            onSite={(site) => onSelect(site.select, site.ids.length > 1 ? "many" : undefined)}
            onInstance={(id) => onSelect(id)}
            onHover={onHover}
          />
        ))}
      </OnThisPage>
      <AppearsOnInteraction components={body.interaction} words={LIST_WORDS} />
      <FlagsCard />
    </>
  );
}

/**
 * A button that goes once it has done its job (a Reset with nothing left to reset)
 * hands focus to the heading, so a keyboard doesn't fall out of the panel.
 */
function focusHeading(from: HTMLElement) {
  const root = from.getRootNode();
  if (root instanceof ShadowRoot) root.querySelector<HTMLElement>("h2")?.focus();
}

/** A piece of the status strip: its words, or a key drawn in `kbd`. */
type StripPart = string | { key: string };

/**
 * How long after an undo offer is made the count's next change still counts as the
 * offer's own: the count reaches the view a commit or two after the offer.
 */
const OFFER_COUNT_MS = 500;

/**
 * The footer's announcements: each undo offer as it is made, and the count as it
 * changes, except the one change that comes with an offer (Reset all says "Reset 2
 * Overrides", not "0 changes" too). A change made while an offer is still up is said,
 * and so is the count Undo puts back.
 */
function useFooterAnnouncements(offer: UndoOffer | null, count: string): void {
  const announce = useAnnounce();
  const last = useRef({ offer, count, offerCountUntil: 0 });
  useEffect(() => {
    const seen = last.current;
    if (offer !== seen.offer) {
      seen.offer = offer;
      if (offer) announce(offer.text);
      seen.offerCountUntil = offer ? performance.now() + OFFER_COUNT_MS : 0;
    }
    if (count !== seen.count) {
      seen.count = count;
      if (performance.now() < seen.offerCountUntil) seen.offerCountUntil = 0;
      else announce(count);
    }
  });
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
      <Card look="divided">
        <Identity
          identity={body.identity}
          words={INSPECTOR_WORDS}
          onBack={() => onSelect(null)}
          heading={heading}
          actions={body.canReset ? <ResetInstance debug={debug} id={body.id} enabled /> : undefined}
        />
      </Card>
      {notices}
    </>
  );
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
  // At This instance the State prop's own switch holds it; at a wider scope that switch can't, so the button does.
  const holdButton = hold && view.scope !== "instance" ? hold : null;
  const resetInstance = body.editing?.resetInstanceEnabled === true;
  const row = (item: PropItem) => <PropRowView key={item.name} item={item} look="pair" debug={debug} onSelect={onSelect} onHover={onHover} />;
  const propRow = (item: PropItem) => <PropRowView key={item.name} item={item} debug={debug} onSelect={onSelect} onHover={onHover} />;
  return (
    <>
      {notices}
      <Card look="divided">
        <Identity
          identity={body.identity}
          words={INSPECTOR_WORDS}
          onBack={() => onSelect(null)}
          nameLang={appLang()}
          heading={heading}
          actions={
            holdButton || resetInstance ? (
              <>
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
              </>
            ) : undefined
          }
          onCrumb={(id) => onSelect(id)}
        >
          {mode === "many" && body.editing?.noGroup && view.scope === "instance" && (
            <NoGroup
              noGroup={body.editing.noGroup}
              // Widened, this goes, and the page scope has no call site to narrow back to: focus goes to the heading.
              onScope={(scope) => {
                onScope(scope);
                heading.current?.focus();
              }}
            />
          )}
        </Identity>
        {body.note && <InstanceNote note={body.note} />}
        {body.members && (
          <ScopeSection
            members={body.members}
            selected={body.id}
            words={INSPECTOR_WORDS}
            nameLang={appLang()}
            onScope={onScope}
            onReset={(target) => {
              dropUndoably(debug, target, resetText);
              heading.current?.focus();
            }}
            onToggle={(action, ids) => {
              const scope = body.members?.scope;
              if (scope) for (const id of ids) attempt(() => (action === "include" ? debug.include(id, scope) : debug.exclude(id, scope)));
            }}
            onHover={onHover}
          />
        )}
        {cards.map(propRow)}
        {body.legend && <Legend words={INSPECTOR_WORDS} app={body.legend.app} />}
        {switches.map(propRow)}
        <InspectOnly key={body.id} inspect={body.inspectFold} row={row} />
      </Card>
    </>
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
  useFooterAnnouncements(offer, footer.countText);
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
              <Dot tone="amber" small />
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
