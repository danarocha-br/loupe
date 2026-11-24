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
import type { ScopeTarget } from "../runtime/store.js";
import { attempt, PropRowView } from "./controls.js";
import type { Column } from "./dock.js";
import { CopyFlow } from "./copy-flow.js";
import { FlagsCard } from "./flags.js";
import { Button, Card, Toggle, useAnnounce, useAnnounceChange } from "./ui/index.js";
import {
  COMMAND_WORDS,
  FOOTER_WORDS,
  type GoneBody,
  type GroupItem,
  HEADER_WORDS,
  type InspectorBody,
  INSPECTOR_WORDS,
  isSwitch,
  type ListBody,
  LIST_WORDS,
  type PanelView,
  type PropItem,
  SHEET_WORDS,
  stripParts,
  stripText,
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
  PanelFooter,
  PanelHeader,
  ScopeSection,
  Sheet,
  StartCard,
  StatusStrip,
} from "./patterns/index.js";
import { copyToClipboard } from "./clipboard.js";
import { PageMapView } from "./page-map.js";
import type { SelectMode } from "./picker.js";
import { type ToolbarStore, useToolbar, useToolbarStore } from "./toolbar-store.js";
import { keepUndoWhile, offerUndo, recordsKey, takeUndo, type UndoOffer, useUndoOffer } from "./undo.js";

/**
 * What the panel draws, and the Toolbar's writes it can't make itself. The selection, its
 * tool, Hide marks and what a row points at are the Toolbar's store's (toolbar-store.ts):
 * the panel's views read the slice they draw and write to it, so a row's hover renders
 * the rows it lights and the outlines, not the panel (ADR 0009).
 */
type PanelProps = {
  debug: LoupeDebug;
  view: PanelView;
  column: Column;
  picking: boolean;
  onTool(mode: SelectMode): void;
  onHide(): void;
  /** Hide was pressed: the panel slides back out of the window, and goes once it has. */
  closing?: boolean;
  theme: "light" | "dark";
  onTheme(): void;
};

/** The sheet stands this far inside its column, as its pattern sets it (sheet.css). */
const PANEL_INSET = 8;

/**
 * Whether focus was in the panel as this render began. Read while rendering, before React
 * swaps the view: once the row that had focus is gone, nothing after the commit can tell
 * that focus was in the panel (review 2026-11-20). A hook of its own because it reads a
 * ref in render: React Compiler skips this hook rather than `Panel`, whose memoised parts
 * keep a peek or Hide marks from re-rendering the list (ADR 0009, as `usePanelView`).
 */
function useFocusWasHere(middle: RefObject<HTMLDivElement | null>): RefObject<boolean> {
  const was = useRef(false);
  const root = middle.current?.getRootNode();
  was.current = root instanceof ShadowRoot && root.activeElement !== null;
  return was;
}

export function Panel({ debug, view, column, picking, onTool, onHide, closing, theme, onTheme }: PanelProps) {
  const store = useToolbarStore();
  const mode = useToolbar((state) => state.mode);
  const marksHidden = useToolbar((state) => state.marksHidden);
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
  const focusWasHere = useFocusWasHere(middle);
  // A new selection, or back to the list, opens at the top. Focus follows it when it
  // was in the panel: a pick on the page leaves the app's focus where it is. The same
  // selection changing kind counts too: an Instance that unmounts swaps the Inspector
  // for Gone (and back when it mounts again), and takes the focused control with it.
  useEffect(() => {
    if (middle.current) middle.current.scrollTop = 0;
    if (focusWasHere.current) heading.current?.focus();
  }, [opened, body.kind]);
  // The strip's words, once: drawn with their keys in `kbd`, and said by the announcer as they change.
  const strip = stripParts({ picking, mode, covered, marksHidden });
  useAnnounceChange(stripText(strip));
  return (
    <Sheet
      docked={column.docked}
      peeking={peeking}
      closing={closing === true}
      width={column.width - PANEL_INSET * 2}
      words={SHEET_WORDS}
      middleRef={middle}
      header={
        <>
          <PanelHeader
            // The page, while nothing is selected: an Instance's identity names it beside the component instead.
            page={body.kind === "list" ? { name: view.header.page, title: view.header.title } : null}
            mode={mode}
            armed={picking}
            marksHidden={marksHidden}
            words={HEADER_WORDS}
            onTool={onTool}
            onMarks={store.toggleMarks}
            onHide={onHide}
          />
          <StatusStrip parts={strip} />
        </>
      }
      footer={<Footer debug={debug} footer={view.footer} theme={theme} onTheme={onTheme} />}
    >
      {body.kind === "list" ? (
        <ComponentList debug={debug} body={body} notices={notices} heading={heading} onTool={onTool} mode={mode} picking={picking} />
      ) : body.kind === "gone" ? (
        <Gone debug={debug} body={body} notices={notices} heading={heading} />
      ) : (
        <Inspector debug={debug} view={view} mode={mode} body={body} notices={notices} heading={heading} />
      )}
    </Sheet>
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

/**
 * A view's part: the Toolbar's debug handle, the body it draws, the notices above it and its heading.
 * A row names its Instances to the store's `hover` on `onMouseOver`, never `onMouseEnter`:
 * React drops an enter that comes straight from the app's page when the app renders
 * `<body>` itself, as the App Router does, so a row reached from the page would outline
 * nothing. A repeat as the pointer crosses the row's children changes nothing (`hover` keeps the ids).
 */
type Part<Body> = Heading & { debug: LoupeDebug; body: Body; notices: ReactNode };

/**
 * One component's row, lit while it or its blocks on the map are pointed at. Each row reads
 * its own light from the store, so pointing renders the two rows whose light changes, not
 * the list (ADR 0009). GroupRow, a pattern, takes it as a prop.
 */
function LitGroupRow({ group, store }: { group: GroupItem; store: ToolbarStore }) {
  const lit = useToolbar((state) => state.lit === group.component);
  return (
    <GroupRow
      group={group}
      lit={lit}
      words={INSPECTOR_WORDS}
      onPoint={store.point}
      // Every Instance from the call site at once, as Select multiple picks them; one alone as Select one.
      onSite={(site) => store.select(site.select, site.ids.length > 1 ? "many" : undefined)}
      onInstance={(id) => store.select(id)}
      onHover={store.hover}
    />
  );
}

/** The page map, its blocks lit with their row. */
function LitPageMap({ debug, groups, store }: { debug: LoupeDebug; groups: GroupItem[]; store: ToolbarStore }) {
  const lit = useToolbar((state) => state.lit);
  return <PageMapView debug={debug} groups={groups} lit={lit} onPoint={store.point} onSelect={(id) => store.select(id)} />;
}

function ComponentList({
  debug,
  body,
  notices,
  heading,
  onTool,
  mode,
  picking,
}: Part<ListBody> & Pick<PanelProps, "onTool" | "picking"> & { mode: SelectMode }) {
  const store = useToolbarStore();
  // One component pointed at, on the map or on its row, lights both. It goes with the list,
  // as the list's own state did: back from an Instance, nothing is lit.
  useEffect(() => () => store.light(null), [store]);
  return (
    <>
      <StartCard words={LIST_WORDS} mode={mode} armed={picking} onTool={onTool} headingRef={heading} />
      {notices}
      {body.notGenerated && <Notice notice={body.notGenerated} words={COMMAND_WORDS} onCopy={copyToClipboard} />}
      <ChangeList changes={body.changes} words={LIST_WORDS} onSelect={(id) => store.select(id)} onHover={store.hover} />
      <HeldForReview
        items={body.suspended}
        meta={body.suspendedMeta}
        words={LIST_WORDS}
        onDiscard={(target) => {
          dropUndoably(debug, target, FOOTER_WORDS.offer.discard);
          // The card may go with its last record: the keyboard stays in the panel, on the view's heading.
          heading.current?.focus();
        }}
      />
      <OnThisPage words={LIST_WORDS} summary={body.summary} map={<LitPageMap debug={debug} groups={body.groups} store={store} />}>
        {body.groups.map((group) => (
          <LitGroupRow key={group.component} group={group} store={store} />
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
        dropUndoably(debug, { scope: "instance", id }, FOOTER_WORDS.offer.reset);
        focusHeading(button);
      }}
    >
      {INSPECTOR_WORDS.resetInstance}
    </Button>
  );
}

/** "Not on the page now": what it was and where it is written, why it may be gone, and what it still holds. */
function Gone({ debug, body, notices, heading }: Part<GoneBody>) {
  const store = useToolbarStore();
  return (
    <>
      <Card look="divided">
        <Identity
          identity={body.identity}
          words={INSPECTOR_WORDS}
          onBack={() => store.select(null)}
          heading={heading}
          actions={body.canReset ? <ResetInstance debug={debug} id={body.id} enabled /> : undefined}
        />
      </Card>
      {notices}
    </>
  );
}

function Inspector({ debug, mode, view, body, notices, heading }: Part<InspectorBody> & Pick<PanelProps, "view"> & { mode: SelectMode }) {
  const store = useToolbarStore();
  const { hold } = body;
  // State props first: a menu's `open` is the switch a designer reaches for.
  const switches = body.editable.filter(isSwitch).sort((a, b) => Number(b.state) - Number(a.state));
  const cards = body.editable.filter((item) => !isSwitch(item));
  // At This instance the State prop's own switch holds it; at a wider scope that switch can't, so the button does.
  const holdButton = hold && view.scope !== "instance" ? hold : null;
  const resetInstance = body.editing?.resetInstanceEnabled === true;
  const row = (item: PropItem) => <PropRowView key={item.name} item={item} look="pair" debug={debug} onSelect={store.select} onHover={store.hover} />;
  const propRow = (item: PropItem) => <PropRowView key={item.name} item={item} debug={debug} onSelect={store.select} onHover={store.hover} />;
  return (
    <>
      {notices}
      <Card look="divided">
        <Identity
          identity={body.identity}
          words={INSPECTOR_WORDS}
          onBack={() => store.select(null)}
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
                    {holdButton.held ? INSPECTOR_WORDS.hold.on(holdButton.prop) : INSPECTOR_WORDS.hold.off(holdButton.prop)}
                  </Toggle>
                )}
                {resetInstance && <ResetInstance debug={debug} id={body.id} enabled />}
              </>
            ) : undefined
          }
          onCrumb={(id) => store.select(id)}
        >
          {mode === "many" && body.editing?.noGroup && view.scope === "instance" && (
            <NoGroup
              noGroup={body.editing.noGroup}
              // Widened, this goes, and the page scope has no call site to narrow back to: focus goes to the heading.
              onScope={(scope) => {
                store.setScope(scope);
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
            onScope={store.setScope}
            onReset={(target) => {
              dropUndoably(debug, target, FOOTER_WORDS.offer.reset);
              heading.current?.focus();
            }}
            onToggle={(action, ids) => {
              const scope = body.members?.scope;
              if (scope) for (const id of ids) attempt(() => (action === "include" ? debug.include(id, scope) : debug.exclude(id, scope)));
            }}
            onHover={store.hover}
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
function Footer({ debug, footer, theme, onTheme }: Pick<PanelProps, "debug" | "theme" | "onTheme"> & { footer: PanelView["footer"] }) {
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
    <PanelFooter
      ref={frame}
      footer={footer}
      words={FOOTER_WORDS}
      undo={offer?.text ?? null}
      theme={theme}
      resetAllRef={resetAllButton}
      undoRef={undoButton}
      onResetAll={() => {
        // Kept so the footer can put them back: Reset all asks nothing, so it is undoable.
        const saved = debug.records();
        const count = saved.reduce((sum, record) => sum + Object.keys(record.values).length, 0);
        for (const target of footer.resetAll) debug.discard(target);
        focusUndo.current = true;
        offerUndo(FOOTER_WORDS.offer.reset(count), () => attempt(() => debug.restore(saved)), recordsKey(debug));
      }}
      onUndo={() => {
        focusResetAll.current = true;
        takeUndo();
      }}
      onTheme={onTheme}
      copy={<CopyFlow disabled={!footer.copyEnabled} frame={frame} />}
    />
  );
}
