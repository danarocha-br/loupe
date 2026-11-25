"use client";

// The patterns' workbench (ADR 0003, 0011): each pattern with its sample data, inside
// the same shadow-root surface the Toolbar uses, in light and dark, under forced colours,
// with reduced motion and at a larger text size. The primitives have a workbench of their
// own, in their package (`pnpm --filter @loupe/ui dev`). `@danarocha/loupe/workbench` exists
// for the fixture app's `/workbench` page, which loads it in development only, as
// `<LoupeMount />` loads the Toolbar; a host never imports it.

import { type ReactNode, useEffect, useState } from "react";
import {
  COMMAND_WORDS,
  COPY_WORDS,
  FOOTER_WORDS,
  HEADER_WORDS,
  INSPECTOR_WORDS,
  LAUNCHER_WORDS,
  LIST_WORDS,
  OUTLINE_WORDS,
  SHEET_WORDS,
  stripParts,
} from "./panel-view/index.js";
import type { SelectMode } from "./patterns/view.js";
import {
  AppearsOnInteraction,
  ChangeList,
  ChangeOutline,
  CommandLine,
  CopySplit,
  type CopyState,
  CopyToast,
  DetailsForm,
  FlagsCard,
  GroupRow,
  HeldForReview,
  Identity,
  InspectOnly,
  InstanceNote,
  Legend,
  NoGroup,
  NotCopied,
  Notice,
  OnThisPage,
  PageMap,
  PageOutline,
  PanelFooter,
  PanelHeader,
  PickTag,
  PropRow,
  ScopeSection,
  Sheet,
  SiteCard,
  StartCard,
  StatusStrip,
} from "./patterns/index.js";
import {
  BUTTON_GROUP,
  CHANGE_OUTLINE,
  CHANGES,
  COPIED_TITLE,
  FLAGS,
  FLAGS_CROWDED,
  FLAGS_OFF,
  FOOTER,
  FOOTER_EMPTY,
  GONE,
  HEADER_PAGE,
  HELD,
  HELD_META,
  IDENTITY,
  INSPECT_ONLY,
  INSPECT_ONLY_SHARED,
  INTERACTION,
  LIST_BOXES,
  LIST_GROUPS,
  LIST_SUMMARY,
  MEMBERS,
  MISSING_NOTICE,
  NO_GROUP,
  NOT_GENERATED,
  NOT_GENERATED_NOTICE,
  COMMAND,
  NOTE,
  OUTLINES,
  OVERRIDES_OFF_NOTICE,
  PAGE_MEMBERS,
  PICK_OUTLINE,
  PICK_TAG,
  PILL_IN_STAGE,
  PROP_ITEMS,
  REFUSED,
  SECRET_LINE,
  SHEET_WIDTH,
  STALE_NOTICE,
  TONE_AT_SCOPE,
  TYPE_INSPECT_ONLY,
  UNDO_OFFER,
} from "./patterns/samples.js";
import { LauncherPill } from "./patterns/launcher/launcher.js";
import { Surface, type Theme } from "./surface/index.js";
import { Button, Card, CardHead } from "@loupe/ui";

/** Whether a media feature the frame depends on is on in this browser right now. */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = matchMedia(query);
    setMatches(list.matches);
    const change = () => setMatches(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}

type Frame = { name: string; theme: Theme; textSize?: number; media?: { query: string; how: string } };

const FRAMES: Frame[] = [
  { name: "Light", theme: "light" },
  { name: "Dark", theme: "dark" },
  {
    name: "Forced colours",
    theme: "light",
    media: { query: "(forced-colors: active)", how: "DevTools › Rendering › Emulate CSS media feature forced-colors: active" },
  },
  {
    name: "Reduced motion",
    theme: "light",
    media: { query: "(prefers-reduced-motion: reduce)", how: "DevTools › Rendering › Emulate CSS media feature prefers-reduced-motion: reduce" },
  },
  { name: "Larger text (20px default)", theme: "light", textSize: 20 },
];

/**
 * The Inspector's patterns with sample panel-view data: Identity, ScopeSection and
 * PropRow in one divided card, as the Inspector draws them; a gone Instance's identity;
 * the page's scope; and a scope's row beside Inspect only's pairs. Each write is said
 * under the cards rather than made.
 */
function PatternStates() {
  const [last, setLast] = useState("—");
  const said = (what: string) => () => setLast(what);
  const rowCalls = {
    onSet: (write: { prop: string }, value: unknown) => setLast(`set ${write.prop} to ${JSON.stringify(value)}`),
    onText: (write: { prop: string }, text: string) => setLast(`typed ${JSON.stringify(text)} in ${write.prop}`),
    onReset: (write: { prop: string }) => setLast(`reset ${write.prop}`),
    onSelect: (id: string) => setLast(`select ${id}`),
    onHover: () => {},
  };
  const scopeCalls = {
    onScope: (scope: string) => setLast(`scope ${scope}`),
    onReset: said("reset this scope"),
    onToggle: (action: string, ids: readonly string[]) => setLast(`${action} ${ids.join(", ")}`),
    onHover: () => {},
  };
  const selected = MEMBERS.members[2]?.id ?? "";
  const pairRow = (item: (typeof INSPECT_ONLY.rows)[number]) => <PropRow key={item.name} item={item} look="pair" words={INSPECTOR_WORDS} {...rowCalls} />;
  return (
    <div className="wb-states">
      <Frame title="The Inspector: Identity, ScopeSection, then a PropRow per prop">
        <Card look="divided">
          <Identity identity={IDENTITY} words={INSPECTOR_WORDS} onBack={said("back")} onCrumb={(id) => setLast(`select ${id}`)} />
          <ScopeSection members={MEMBERS} selected={selected} words={INSPECTOR_WORDS} {...scopeCalls} />
          {PROP_ITEMS.map((item) => (
            <PropRow key={item.name} item={item} words={INSPECTOR_WORDS} {...rowCalls} />
          ))}
          <Legend words={INSPECTOR_WORDS} app />
          <InspectOnly inspect={INSPECT_ONLY} row={pairRow} />
        </Card>
      </Frame>
      <Frame title="An Instance nothing can change: its note, and Inspect only open with the one reason">
        <Card look="divided">
          <Identity identity={{ ...IDENTITY, keys: [], tags: [], chips: [], crumbs: [] }} words={INSPECTOR_WORDS} onBack={said("back")} />
          <InstanceNote note={NOTE} />
          <InspectOnly inspect={INSPECT_ONLY_SHARED} row={pairRow} />
        </Card>
      </Frame>
      <Frame title="NoGroup: Select multiple on an Instance with no call site">
        <Card look="divided">
          <Identity identity={{ ...IDENTITY, keys: [], tags: [], chips: [], crumbs: [] }} words={INSPECTOR_WORDS} onBack={said("back")}>
            <NoGroup noGroup={NO_GROUP} onScope={(scope) => setLast(`scope ${scope}`)} />
          </Identity>
        </Card>
      </Frame>
      <Frame title="Identity: not generated yet, and gone">
        <Card look="divided">
          <Identity
            identity={{
              ...IDENTITY,
              status: NOT_GENERATED,
              keys: [],
              tags: [],
              chips: [],
              crumbs: [],
              notGenerated: { tag: NOT_GENERATED, command: "npx loupe generate" },
            }}
            words={INSPECTOR_WORDS}
            onBack={said("back")}
          />
        </Card>
        <Card look="divided">
          <Identity
            identity={GONE}
            words={INSPECTOR_WORDS}
            onBack={said("back")}
            actions={
              <Button size="small" onClick={said("reset this Instance")}>
                Reset this Instance
              </Button>
            }
          />
        </Card>
      </Frame>
      <Frame title="ScopeSection at All on page, by call site">
        <Card look="divided">
          <ScopeSection members={PAGE_MEMBERS} selected={selected} words={INSPECTOR_WORDS} {...scopeCalls} />
          <PropRow item={TONE_AT_SCOPE} words={INSPECTOR_WORDS} {...rowCalls} />
          <div className="wb-pairs">
            <PropRow item={TYPE_INSPECT_ONLY} look="pair" words={INSPECTOR_WORDS} {...rowCalls} />
          </div>
        </Card>
      </Frame>
      <p className="wb-note">Last: {last}</p>
    </div>
  );
}

/**
 * The list's patterns with sample panel-view data, as the list draws them with nothing
 * selected: the guided start, Held for review, On this page (the map over its rows, one
 * opened to its call sites) and Appears on interaction. A choice or a write is said under
 * the cards rather than made.
 */
function ListPatternStates() {
  const [last, setLast] = useState("—");
  const [mode, setMode] = useState<SelectMode>("one");
  const [armed, setArmed] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const point = (group: { component: string } | null) => setLit(group?.component ?? null);
  return (
    <div className="wb-states">
      <Frame title="StartCard: the mode checked; pressed again, armed">
        <StartCard
          words={LIST_WORDS}
          mode={mode}
          armed={armed}
          onTool={(next) => {
            setArmed(next === mode ? !armed : true);
            setMode(next);
            setLast(`tool ${next}`);
          }}
        />
      </Frame>
      <Frame title="HeldForReview">
        <HeldForReview items={HELD} meta={HELD_META} words={LIST_WORDS} onDiscard={(target) => setLast(`discard ${JSON.stringify(target)}`)} />
      </Frame>
      <Frame title="OnThisPage: PageMap over a GroupRow per component">
        <OnThisPage
          words={LIST_WORDS}
          summary={LIST_SUMMARY}
          map={<PageMap groups={LIST_GROUPS} boxes={LIST_BOXES} lit={lit} words={LIST_WORDS} onPoint={point} onSelect={(id) => setLast(`select ${id}`)} />}
        >
          {LIST_GROUPS.map((group) => (
            <GroupRow
              key={group.component}
              group={group}
              lit={lit === group.component}
              words={INSPECTOR_WORDS}
              onPoint={point}
              onSite={(site) => setLast(`select ${site.label}`)}
              onInstance={(id) => setLast(`select ${id}`)}
              onHover={() => {}}
            />
          ))}
        </OnThisPage>
      </Frame>
      <Frame title="SiteCard: a call site, lifted on an opened row's wash">
        <div className="wb-site" data-hue={BUTTON_GROUP.hue}>
          {BUTTON_GROUP.sites.map((site) => (
            <SiteCard key={site.anchor} site={site} onSite={(picked) => setLast(`select ${picked.label}`)} onInstance={(id) => setLast(`select ${id}`)} onHover={() => {}} />
          ))}
        </div>
      </Frame>
      <Frame title="AppearsOnInteraction">
        <AppearsOnInteraction components={INTERACTION} words={LIST_WORDS} />
      </Frame>
      <p className="wb-note">Last: {last}</p>
    </div>
  );
}

/**
 * The notices, the change list and the Feature flags card with sample panel-view data, as
 * the list draws them. Copy and every write are said under the cards rather than made; a
 * copy refused here is a copy that rejects.
 */
function NoticePatternStates() {
  const [last, setLast] = useState("—");
  const onCopy = (text: string) => {
    setLast(`copy ${text}`);
    return Promise.resolve();
  };
  return (
    <div className="wb-states">
      <Frame title="Notice: amber, with rows and the command">
        <Notice notice={STALE_NOTICE} words={COMMAND_WORDS} onCopy={onCopy} />
        <Notice notice={NOT_GENERATED_NOTICE} words={COMMAND_WORDS} onCopy={() => Promise.reject(new Error("refused"))} />
      </Frame>
      <Frame title="Notice: red, with a command and without">
        <Notice notice={MISSING_NOTICE} words={COMMAND_WORDS} onCopy={onCopy} />
        <Notice notice={OVERRIDES_OFF_NOTICE} words={COMMAND_WORDS} onCopy={onCopy} />
      </Frame>
      <Frame title="CommandLine: a command with its prompt, a line without, and a copy the clipboard refuses">
        <CommandLine text={COMMAND} words={COMMAND_WORDS} onCopy={onCopy} />
        <CommandLine text={SECRET_LINE.text} copy={SECRET_LINE.copy} prompt={false} words={COMMAND_WORDS} onCopy={onCopy} />
        <CommandLine text={COMMAND} words={COMMAND_WORDS} onCopy={() => Promise.reject(new Error("refused"))} />
      </Frame>
      <Frame title="ChangeList: the last change's Instance isn't mounted">
        <ChangeList changes={CHANGES} words={LIST_WORDS} onSelect={(id) => setLast(`select ${id}`)} onHover={() => {}} />
      </Frame>
      <Frame title="FlagsCard: one previewed, a write refused">
        <FlagsCard
          flags={FLAGS}
          busy={false}
          onPreview={(key, value) => setLast(`preview ${key} ${JSON.stringify(value)}`)}
          onClear={(key) => setLast(`clear ${key}`)}
          onClearAll={() => setLast("clear all")}
          words={COMMAND_WORDS}
          onCopy={onCopy}
        />
      </Frame>
      <Frame title="FlagsCard: a crowded flag, what shows now under its options, words whole">
        <FlagsCard
          flags={FLAGS_CROWDED}
          busy={false}
          onPreview={(key, value) => setLast(`preview ${key} ${JSON.stringify(value)}`)}
          onClear={(key) => setLast(`clear ${key}`)}
          onClearAll={() => setLast("clear all")}
          words={COMMAND_WORDS}
          onCopy={onCopy}
        />
      </Frame>
      <Frame title="FlagsCard: previews off, folded to one line (open it for why)">
        <FlagsCard flags={FLAGS_OFF} busy={false} onPreview={() => {}} onClear={() => {}} onClearAll={() => {}} words={COMMAND_WORDS} onCopy={onCopy} />
      </Frame>
      <p className="wb-note">Last: {last}</p>
    </div>
  );
}

/**
 * The panel's chrome with sample panel-view data: the header and its strip, the footer,
 * and Copy Proposal's parts. The tools, the theme and the halves work; what they would do
 * is said under the cards rather than done. The popovers' bodies stand in a card as the
 * popover draws them, without the popover.
 */
function ChromePatternStates() {
  const [last, setLast] = useState("—");
  const [mode, setMode] = useState<SelectMode>("one");
  const [armed, setArmed] = useState(false);
  const [marksHidden, setMarksHidden] = useState(false);
  const [dark, setDark] = useState(false);
  const [undo, setUndo] = useState<string | null>(UNDO_OFFER);
  const [title, setTitle] = useState("");
  const [designer, setDesigner] = useState("");
  const [missing, setMissing] = useState(true);
  const split = (state: CopyState, disabled = false) => (
    <CopySplit
      state={state}
      busy={false}
      disabled={disabled}
      expanded={false}
      words={COPY_WORDS}
      onCopy={() => setLast(`copy (${state})`)}
      onDetails={() => setLast("details")}
    />
  );
  const strip = stripParts({ picking: armed, mode, covered: false, marksHidden });
  return (
    <div className="wb-states">
      <Frame title="PanelHeader and StatusStrip: pick a tool, press it again to arm it, hide the marks">
        <PanelHeader
          page={HEADER_PAGE}
          mode={mode}
          armed={armed}
          marksHidden={marksHidden}
          words={HEADER_WORDS}
          onTool={(next) => {
            setArmed(next === mode ? !armed : true);
            setMode(next);
          }}
          onMarks={() => setMarksHidden(!marksHidden)}
          onHide={() => setLast("hide")}
        />
        <StatusStrip parts={strip} />
      </Frame>
      <Frame title="PanelHeader: an Instance selected (no page), the strip with a key">
        <PanelHeader page={null} mode="many" armed marksHidden={false} words={HEADER_WORDS} onTool={() => {}} onMarks={() => {}} onHide={() => {}} />
        <StatusStrip parts={HEADER_WORDS.strip.covered} />
      </Frame>
      <Frame title="PanelFooter: two changes, a held state, the undo offer after Reset all">
        <PanelFooter
          footer={FOOTER}
          words={FOOTER_WORDS}
          undo={undo}
          theme={dark ? "dark" : "light"}
          onResetAll={() => setUndo(UNDO_OFFER)}
          onUndo={() => setUndo(null)}
          onTheme={() => setDark(!dark)}
          copy={split("idle")}
        />
      </Frame>
      <Frame title="PanelFooter: nothing changed, nothing to copy">
        <PanelFooter footer={FOOTER_EMPTY} words={FOOTER_WORDS} undo={null} theme="light" onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} copy={split("idle", true)} />
      </Frame>
      <Frame title="CopySplit: copied and refused">
        <div className="wb-line">{split("copied")}</div>
        <div className="wb-line">{split("failed")}</div>
      </Frame>
      <Frame title="CopyToast: over the footer as a copy lands">
        <div className="wb-toast-room">
          <PanelFooter
            footer={FOOTER}
            words={FOOTER_WORDS}
            undo={null}
            theme="light"
            onResetAll={() => {}}
            onUndo={() => {}}
            onTheme={() => {}}
            copy={
              <>
                {split("copied")}
                <CopyToast title={COPIED_TITLE} words={COPY_WORDS} />
              </>
            }
          />
        </div>
      </Frame>
      <Frame title="DetailsForm: copied with no title, until one is typed">
        <div className="wb-popover">
          <DetailsForm
            title={title}
            designer={designer}
            missing={missing}
            busy={false}
            words={COPY_WORDS}
            onTitle={(next) => {
              setTitle(next);
              if (next.trim() !== "") setMissing(false);
            }}
            onDesigner={setDesigner}
            onSubmit={() => (title.trim() === "" ? setMissing(true) : setLast(`copy "${title}" by ${designer || "—"}`))}
          />
        </div>
      </Frame>
      <Frame title="NotCopied: with the Proposal's text, and without">
        <div className="wb-popover">
          <NotCopied said={COPY_WORDS.notCopiedText(REFUSED.reason, true)} text={REFUSED.text} busy={false} words={COPY_WORDS} onRetry={() => setLast("try again")} />
        </div>
        <div className="wb-popover">
          <NotCopied said={REFUSED.reason} text="" busy={false} words={COPY_WORDS} onRetry={() => setLast("try again")} />
        </div>
      </Frame>
      <p className="wb-note">Last: {last}</p>
    </div>
  );
}

function ShellPatternStates() {
  const [last, setLast] = useState("—");
  const [peeking, setPeeking] = useState(false);
  const words = { label: LAUNCHER_WORDS.label, title: LAUNCHER_WORDS.title("⌘.") };
  const open = () => setLast("open");
  return (
    <div className="wb-states">
      <Frame title="LauncherPill: docked on the left side, parked: the neck has let go">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.docked} words={words} onClick={open} />
        </div>
      </Frame>
      <Frame title="LauncherPill: held 4px off the left side: the neck fills in">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.neck} words={words} onClick={open} />
        </div>
      </Frame>
      <Frame title="LauncherPill: free, away from every side; point at it">
        <div className="wb-stage">
          <LauncherPill {...PILL_IN_STAGE.free} words={words} onClick={open} />
        </div>
      </Frame>
      <Frame title="Sheet: docked, its header, a card in the middle, its footer; press Peek to see through">
        <div className="wb-line">
          <Button size="small" onClick={() => setPeeking(!peeking)}>
            {peeking ? "Stop peeking" : "Peek"}
          </Button>
        </div>
        <div className="wb-stage wb-stage-sheet">
          <Sheet
            docked
            peeking={peeking}
            closing={false}
            width={SHEET_WIDTH - 40}
            words={SHEET_WORDS}
            header={
              <>
                <PanelHeader page={HEADER_PAGE} mode="one" armed={false} marksHidden={false} words={HEADER_WORDS} onTool={() => {}} onMarks={() => {}} onHide={() => setLast("hide")} />
                <StatusStrip parts={HEADER_WORDS.strip.marksHidden} />
              </>
            }
            footer={<PanelFooter footer={FOOTER_EMPTY} words={FOOTER_WORDS} undo={null} theme="light" onResetAll={() => {}} onUndo={() => {}} onTheme={() => {}} copy={null} />}
          >
            <Card>
              <CardHead>
                <h3>A card</h3>
              </CardHead>
            </Card>
          </Sheet>
        </div>
      </Frame>
      <Frame title="Sheet: over the page, where the window is too narrow for a column">
        <div className="wb-stage wb-stage-sheet">
          <Sheet docked={false} peeking={false} closing={false} width={SHEET_WIDTH - 40} words={SHEET_WORDS} header={<StatusStrip parts={HEADER_WORDS.strip.covered} />} footer={null}>
            <Card>
              <CardHead>
                <h3>A card</h3>
              </CardHead>
            </Card>
          </Sheet>
        </div>
      </Frame>
      <Frame title="The page's marks: the selection tagged with its size, two it reaches, one left out">
        <div className="wb-stage wb-stage-page">
          {OUTLINES.map(({ key, ...outline }) => (
            <PageOutline key={key} {...outline} box={{ ...outline.box, left: 180 }} />
          ))}
        </div>
      </Frame>
      <Frame title="The page's marks: picking, with its tag; a change's outline; the size tag below and from the start">
        <div className="wb-stage wb-stage-page">
          <PageOutline {...PICK_OUTLINE} box={{ ...PICK_OUTLINE.box, top: 44 }} />
          <PickTag {...PICK_TAG} place={{ top: 18, left: 24 }} words={OUTLINE_WORDS} />
          <ChangeOutline {...CHANGE_OUTLINE} box={{ ...CHANGE_OUTLINE.box, top: 120 }} quiet={false} />
          <PageOutline kind="ring" box={{ top: 6, left: 210, width: 38, height: 38 }} quiet={false} tag={{ text: "Button · 32 × 32", below: true, start: false }} />
          <PageOutline kind="ring" box={{ top: 150, left: 6, width: 38, height: 38 }} quiet={false} tag={{ text: "Button · 32 × 32", below: false, start: true }} />
        </div>
      </Frame>
      <p className="wb-note">Last: {last}</p>
    </div>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="wb-row">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** The frame's own layout: a card on the panel's ground, in the surface's tokens. */
const FRAME_CSS = `
.wb-states { display: flex; flex-direction: column; gap: 16px; }
.wb-row { display: flex; flex-direction: column; gap: 8px; }
.wb-row > h3 { font: var(--font-label); color: var(--muted); }
.wb-ground [data-card] h3 { font: var(--font-title); letter-spacing: var(--tracking-title); }
.wb-site { display: flex; flex-direction: column; gap: var(--space-sheet); padding: var(--space-row) var(--space-gutter) var(--space-card); border-radius: var(--radius-card); background: var(--hover); }
.wb-pairs { padding: 0 var(--space-gutter) var(--space-inset) 42px; }
.wb-note { font: var(--font-meta); color: var(--faint); }
.wb-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.wb-ground { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: var(--radius-sheet); background: var(--ground); }
.wb-bare { display: flex; flex-direction: column; gap: var(--space-row); padding: var(--space-card) var(--space-sheet); }
.wb-bare > h2 { font: var(--font-title); color: var(--ink); }
.wb-popover { padding: var(--space-gutter); border-radius: var(--radius-card); background: var(--card); box-shadow: var(--popover-shadow); }
.wb-toast-room { padding-top: 64px; }
/* A stage stands in for the window: \`contain\` makes it the box a fixed pill, sheet or outline is placed in. */
.wb-stage { position: relative; height: 88px; overflow: hidden; contain: layout paint; border-radius: var(--radius-well); background: var(--well); box-shadow: inset 0 0 0 1px var(--hairline); }
.wb-stage-sheet { height: 360px; }
.wb-stage-page { height: 248px; background: var(--card); }
`;

function FrameView({ frame }: { frame: Frame }) {
  const active = useMedia(frame.media?.query ?? "all");
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <figcaption style={{ font: "600 13px/1.4 system-ui, sans-serif" }}>
        {frame.name}
        {frame.media && (
          <span style={{ display: "block", fontWeight: 400, color: active ? "#1f7a3a" : "#8a5a00" }}>
            {active ? `${frame.media.query} is on` : `Off in this browser: ${frame.media.how}`}
          </span>
        )}
      </figcaption>
      <Surface theme={frame.theme} textSize={frame.textSize} label={`${frame.name} frame`}>
        <style>{FRAME_CSS}</style>
        <div className="wb-ground">
          <section className="wb-bare">
            <h2>Patterns: the Inspector</h2>
            <PatternStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: the list</h2>
            <ListPatternStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: notices, changes and flags</h2>
            <NoticePatternStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: the header, the footer and Copy Proposal</h2>
            <ChromePatternStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: the pill, the sheet and the page's marks</h2>
            <ShellPatternStates />
          </section>
        </div>
      </Surface>
    </figure>
  );
}

export default function Workbench() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 24, alignItems: "start" }}>
      {FRAMES.map((frame) => (
        <FrameView key={frame.name} frame={frame} />
      ))}
    </div>
  );
}
