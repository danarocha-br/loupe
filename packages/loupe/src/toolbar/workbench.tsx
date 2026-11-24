"use client";

// The workbench (ADR 0003): each primitive drawn by itself, and each pattern with sample
// panel-view data, inside the same shadow-root surface the Toolbar uses, in light and
// dark, under forced colours, with reduced motion and at a larger text size. `@danarocha/loupe/workbench` exists for the
// fixture app's `/workbench` page, which loads it in development only, as
// `<LoupeMount />` loads the Toolbar; a host never imports it.

import { type ReactNode, useEffect, useRef, useState } from "react";
import { InfoIcon, PROP_ICONS, ResetIcon } from "./ui/icon/icon.js";
import { INSPECTOR_WORDS, LIST_WORDS, type SelectMode } from "./panel-view/index.js";
import { AppearsOnInteraction, GroupRow, HeldForReview, Identity, OnThisPage, PageMap, PropRow, ScopeSection, SiteCard, StartCard } from "./patterns/index.js";
import {
  BUTTON_GROUP,
  GONE,
  HELD,
  HELD_META,
  IDENTITY,
  INTERACTION,
  LIST_BOXES,
  LIST_GROUPS,
  LIST_SUMMARY,
  MEMBERS,
  NOT_GENERATED,
  PAGE_MEMBERS,
  PROP_ITEMS,
  TONE_AT_SCOPE,
  TYPE_INSPECT_ONLY,
} from "./patterns/samples.js";
import { Surface, type Theme } from "./surface/index.js";
import {
  Button,
  Card,
  CardHead,
  Chip,
  ChipGroup,
  Delta,
  Dot,
  Field,
  Fold,
  FoldChevron,
  FoldPanel,
  FoldTrigger,
  Kbd,
  Popover,
  PopoverPanel,
  Row,
  RowAction,
  RowLine,
  RowName,
  RowValue,
  Switch,
  Tag,
  Toggle,
  type Politeness,
  useAnnounce,
} from "./ui/index.js";

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

const SIZES = ["sm", "md", "lg"];
const VARIANTS = ["solid", "ghost", "link", "a much longer value that wraps inside its chip"];

/** ChipGroup's states: a chosen value, the marks, nothing chosen, and the bare look. */
function ChipGroupStates() {
  const [size, setSize] = useState<string | null>("md");
  const [variant, setVariant] = useState<string | null>("ghost");
  const [flag, setFlag] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>("—");
  return (
    <div className="wb-states">
      <Frame title="Chosen, arrows move, Space or Enter chooses">
        <ChipGroup
          label="size"
          value={size}
          onChoose={(next) => {
            setSize(next);
            setChosen(next);
          }}
        >
          {SIZES.map((value) => (
            <Chip key={value} value={value}>
              {value}
            </Chip>
          ))}
        </ChipGroup>
        <p className="wb-note">
          Last chosen: {chosen}
        </p>
      </Frame>
      <Frame title="Marks: tag (app's value), dot (default), count">
        <ChipGroup label="variant" value={variant} onChoose={setVariant}>
          {VARIANTS.map((value, index) => (
            <Chip
              key={value}
              value={value}
              tag={index === 0 && variant !== value ? "app" : undefined}
              dot={index === 2}
              count={index + 1}
              description={[index === 0 && "the app’s value", index === 2 && "the design system’s default"].filter(Boolean).join("; ") || undefined}
            >
              {value}
            </Chip>
          ))}
        </ChipGroup>
      </Frame>
      <Frame title="Nothing chosen until one is (the app decides)">
        <ChipGroup label="plan" value={flag} onChoose={setFlag}>
          <Chip value="free">Free</Chip>
          <Chip value="pro">Pro</Chip>
          <Chip value="team">Team</Chip>
        </ChipGroup>
      </Frame>
    </div>
  );
}

// The notes under a control are for the eye: the control says its own state (checked,
// pressed), and nothing in a frame is a live region of its own. What a screen reader is
// told goes through the frame's announcer, tried below.

const COPIED = "Copied “Calmer rows”. Paste it into your coding agent.";

/** The Announcer: a polite message, the same one twice, and an assertive one, to hear in a screen reader. */
function AnnouncerStates() {
  const announce = useAnnounce();
  const [said, setSaid] = useState<string>("—");
  const say = (text: string, politeness: Politeness = "polite") => {
    announce(text, { politeness });
    setSaid(`${politeness}: ${text}`);
  };
  return (
    <div className="wb-states">
      <Frame title="Polite waits for a pause; the same message twice is read twice">
        <div className="wb-line">
          <Button onClick={() => say(COPIED)}>Announce a copy</Button>
          <Button onClick={() => say("Reset 2 Overrides")}>Announce a reset</Button>
        </div>
      </Frame>
      <Frame title="Assertive interrupts: a refusal to act on">
        <div className="wb-line">
          <Button onClick={() => say("Couldn’t reach the clipboard. Select the command and copy it.", "assertive")}>Announce a refusal</Button>
        </div>
        <p className="wb-note">Last said, {said}</p>
      </Frame>
    </div>
  );
}

/** Fold's states: closed, open, kept by the caller at its own width, and one inside another. */
function FoldStates() {
  const [open, setOpen] = useState(false);
  return (
    <div className="wb-states">
      <Frame title="Closed: Enter or Space opens it, focus stays on the row">
        <Fold>
          <FoldTrigger className="wb-fold-row">
            <span>Order details</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <p className="wb-fold-body">Still in the page while closed: find in page opens it.</p>
          </FoldPanel>
        </Fold>
      </Frame>
      <Frame title="Open at first, with a fold inside">
        <Fold defaultOpen>
          <FoldTrigger className="wb-fold-row">
            <span>Inspect only · 3</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <div className="wb-fold-body">
              <Fold>
                <FoldTrigger className="wb-fold-row wb-fold-small">
                  <FoldChevron />
                  <span>1 set by the library</span>
                </FoldTrigger>
                <FoldPanel>
                  <p className="wb-fold-body">aria-expanded · false</p>
                </FoldPanel>
              </Fold>
            </div>
          </FoldPanel>
        </Fold>
      </Frame>
      <Frame title="Inline, the caller keeps the state">
        <Fold open={open} onOpenChange={setOpen}>
          <div className="wb-fold-line">
            <span>Reaches 4 of 4</span>
            <FoldTrigger inline className="wb-fold-row">
              <span>4 Instances</span>
              <FoldChevron />
            </FoldTrigger>
          </div>
          <FoldPanel>
            <p className="wb-fold-body">{open ? "Opened by the caller’s state." : ""}</p>
          </FoldPanel>
        </Fold>
      </Frame>
    </div>
  );
}

/** A glyph for the workbench's icon-only buttons: the tools draw their own. */
const Glyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="7" />
  </svg>
);

/** Button's looks and sizes, and Toggle pressed, unpressed and unmarked. */
function ButtonStates() {
  const [pressed, setPressed] = useState(false);
  const [held, setHeld] = useState(true);
  const [dark, setDark] = useState(false);
  const [presses, setPresses] = useState(0);
  return (
    <div className="wb-states">
      <Frame title="Soft: small, medium, large; disabled">
        <div className="wb-line">
          <Button size="small" onClick={() => setPresses(presses + 1)}>
            Discard
          </Button>
          <Button onClick={() => setPresses(presses + 1)}>
            <Glyph />
            Reset all
          </Button>
          <Button size="large" onClick={() => setPresses(presses + 1)}>
            Select all
          </Button>
          <Button disabled>Reset all</Button>
        </div>
        <p className="wb-note">
          Pressed {presses} times
        </p>
      </Frame>
      <Frame title="Primary, and icon only">
        <div className="wb-line">
          <Button look="primary">
            <Glyph />
            Copy with these details
          </Button>
        </div>
        <div className="wb-line">
          <Button look="tool" iconOnly title="Hide the panel">
            <Glyph />
            <span className="sr-only">Hide panel</span>
          </Button>
          <Button size="small" iconOnly title="Reset">
            <Glyph />
            <span className="sr-only">Reset</span>
          </Button>
        </div>
      </Frame>
      <Frame title="Toggle: a tool, a soft pill, and one whose pressed shows elsewhere">
        <div className="wb-line">
          <Toggle look="tool" iconOnly pressed={pressed} onPressedChange={setPressed} title="Hide marks">
            <Glyph />
            <span className="sr-only">Hide marks</span>
          </Toggle>
          <Toggle size="small" pressed={held} onPressedChange={setHeld}>
            {held ? "Holding open · Release" : "Hold open"}
          </Toggle>
          <Toggle size="large" iconOnly marksPressed={false} pressed={dark} onPressedChange={setDark} title="Dark theme">
            <Glyph />
            <span className="sr-only">Dark theme</span>
          </Toggle>
        </div>
        {/* Unmarked: in the panel the theme itself shows it's pressed; here this line does. */}
        <p className="wb-note">
          Dark theme {dark ? "pressed" : "not pressed"}: the button draws no mark
        </p>
      </Frame>
    </div>
  );
}

/** Switch's states: off, on, and disabled. */
function SwitchStates() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(true);
  return (
    <div className="wb-states">
      <Frame title="Space or Enter turns it; the thumb slides with its corners">
        <label className="wb-switch-row">
          <span>open</span>
          <Switch label="open" checked={open} onCheckedChange={setOpen} />
        </label>
        <label className="wb-switch-row">
          <span>modal</span>
          <Switch label="modal" checked={modal} onCheckedChange={setModal} />
        </label>
        <label className="wb-switch-row">
          <span>disabled</span>
          <Switch label="disabled" checked={false} disabled onCheckedChange={() => {}} />
        </label>
      </Frame>
    </div>
  );
}

const LONG_TEXT = Array.from({ length: 14 }, (_, line) => `${line + 1}. A line of a long read-only text, to select and copy by hand.`).join("\n");

/** Field's looks: filled with its marker, error and hint; the outline that grows; the read-only well. */
function FieldStates() {
  const [title, setTitle] = useState("");
  const [designer, setDesigner] = useState("");
  const [text, setText] = useState("Save changes");
  return (
    <div className="wb-states">
      <Frame title="Filled: a label, an optional marker, a placeholder">
        <Field label="Designer" optional="optional" placeholder="Who is asking for this?" value={designer} onValueChange={setDesigner} />
      </Frame>
      <Frame title="Filled, with an error until it has text, and a hint">
        <Field
          label="Title"
          required
          hint="It heads the text."
          error={title.trim() === "" ? "Give it a title." : undefined}
          value={title}
          onValueChange={setTitle}
        />
      </Frame>
      <Frame title="Outline: a hidden label, grows with its text">
        <Field label="children" labelHidden look="outline" multiline autoResize rows={1} value={text} onValueChange={setText} />
      </Frame>
      <Frame title="Well: read-only, fades out at its foot">
        <Field label="Long text" labelHidden look="well" multiline readOnly value={LONG_TEXT} />
      </Frame>
    </div>
  );
}

/** Popover's states: over a footer, its caret at its end or under its middle. */
function PopoverStates() {
  const [open, setOpen] = useState(false);
  // Which button opened it, kept past closing: focus goes back there once it has closed.
  const [caret, setCaret] = useState<"end" | "center">("end");
  const footer = useRef<HTMLDivElement>(null);
  const toggles = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLButtonElement>(null);
  const center = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const toggle = (from: "end" | "center") => {
    setOpen(!(open && caret === from));
    setCaret(from);
  };
  return (
    <div className="wb-states">
      <Frame title="Escape or a press outside closes it; focus goes back to what opened it">
        <div ref={footer} className="wb-footer">
          <div ref={toggles} className="wb-line">
            <Button ref={center} aria-expanded={open && caret === "center"} aria-haspopup="dialog" onClick={() => toggle("center")}>
              Caret in the middle
            </Button>
            <Button ref={end} aria-expanded={open && caret === "end"} aria-haspopup="dialog" onClick={() => toggle("end")}>
              At the end
            </Button>
          </div>
        </div>
        <Popover open={open} onOpenChange={setOpen} inside={toggles}>
          <PopoverPanel label="Details" anchor={footer} returnFocus={caret === "center" ? center : end} caret={caret}>
            <div className="wb-states">
              <Field label="Name" optional="optional" value={name} onValueChange={setName} />
              <Button look="primary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </PopoverPanel>
        </Popover>
      </Frame>
    </div>
  );
}

/** The marks: Tag in each look, Dot in each tone, Delta numbered and empty, Kbd in a sentence. */
function MarkStates() {
  return (
    <div className="wb-states">
      <Frame title="Tag: plain, reason, picked, amber, ring, dashed, empty">
        <div className="wb-line">
          <Tag>State prop</Tag>
          <Tag look="reason" title="The library sets this prop; the call site doesn’t pass it">set by the library</Tag>
          <Tag look="picked">picked</Tag>
          <Tag look="amber">Source changed</Tag>
          <Tag look="ring">Held for review</Tag>
          <Tag look="dashed">Not visible now</Tag>
          <Tag look="empty">empty</Tag>
        </div>
      </Frame>
      <Frame title="Dot: hidden; the words beside it say what it marks">
        <div className="wb-line">
          <span className="wb-mark">
            <Dot tone="alert" /> Product layer missing
          </span>
          <span className="wb-mark">
            <Dot tone="amber" /> Not generated yet
          </span>
          <span className="wb-mark">
            <Dot tone="amber" small /> Source changed
          </span>
          <span className="wb-mark">
            <Dot tone="lilac" small /> Previewing on
          </span>
          <span className="wb-mark">
            <Dot tone="hollow" small /> App decides
          </span>
          <span className="wb-mark">
            <Dot tone="ring" /> Held for review
          </span>
        </div>
      </Frame>
      <Frame title="Delta: numbered (an image named “Change n”), and empty and dashed (hidden)">
        <div className="wb-line">
          <Delta n={1} label="Change 1" title="Change 1 in the Proposal" />
          <Delta n={2} label="Change 2" title="Change 2 in the Proposal" />
          <Delta n={12} label="Change 12" title="Change 12 in the Proposal" />
          <span className="wb-mark">
            <Delta title="Held open: shown as a state" /> open <Tag>State prop</Tag>
          </span>
        </div>
      </Frame>
      <Frame title="Kbd: a key in running text">
        <p className="wb-status">
          Click an Instance on the page · <Kbd>Esc</Kbd> cancels
        </p>
        <p className="wb-status">
          A dialog on the page runs under the panel · hold <Kbd>Alt</Kbd> to see through
        </p>
      </Frame>
    </div>
  );
}

/** Card's looks and Row's: the Inspector's divided card of glyph rows, a list card, a padded card of ruled rows. */
function CardRowStates() {
  const [open, setOpen] = useState(true);
  return (
    <div className="wb-states">
      <Frame title="Divided: parts on hairlines, inset rows on a 20px glyph column">
        <Card look="divided">
          <Row glyph={PROP_ICONS.size}>
            <RowLine>
              <Delta n={2} label="Change 2" />
              <RowName code="size">Size</RowName>
              <RowAction>
                <Button size="small">
                  <ResetIcon />
                  Reset
                </Button>
              </RowAction>
            </RowLine>
            <ChipGroup label="Size" value="md" onChoose={() => {}}>
              {SIZES.map((size) => (
                <Chip key={size} value={size}>
                  {size}
                </Chip>
              ))}
            </ChipGroup>
          </Row>
          <Row glyph={PROP_ICONS.variant}>
            <RowLine>
              <RowName code="accessibilityLabelWhenCollapsed">A much longer label that wraps between its words</RowName>
              <Tag look="reason">set by the library</Tag>
              <RowValue>"ghost"</RowValue>
            </RowLine>
          </Row>
          <Row glyph={PROP_ICONS.state}>
            <RowLine>
              <RowName>open</RowName>
              <Tag>State prop</Tag>
              <RowAction>
                <Switch label="open" checked={open} onCheckedChange={setOpen} />
              </RowAction>
            </RowLine>
          </Row>
          <Row glyph={<InfoIcon />} role="note">
            <div className="wb-note-text">
              <h3>Rendered on the server</h3>
              <p>Its props can't change here. A note is a Row, not a card on a card.</p>
            </div>
          </Row>
          <div className="wb-pairs">
            <Row look="pair">
              <RowLine>
                <RowName code="aria-label">aria-label</RowName>
                <RowValue>"More actions"</RowValue>
              </RowLine>
            </Row>
            <Row look="pair">
              <RowLine>
                <RowName>onSelect</RowName>
                <RowValue>ƒ handleSelect</RowValue>
              </RowLine>
            </Row>
          </div>
        </Card>
      </Frame>
      <Frame title="List, with item rows: edge to edge on their hairline, the text 14px in">
        <Card look="list">
          <CardHead>
            <h3>Appears on interaction</h3>
            <span className="wb-note">Not on screen yet</span>
          </CardHead>
          <ul className="wb-list">
            <Row as="li" look="item">
              Dialog
              <span className="wb-note">A line under the name, 2px apart.</span>
            </Row>
            <Row as="li" look="item">
              Tooltip
              <span className="wb-note">A line under the name, 2px apart.</span>
            </Row>
          </ul>
        </Card>
      </Frame>
      <Frame title="Plain, with ruled rows: a name in mono, a value, an action">
        <Card>
          <CardHead>
            <h3>Feature flags</h3>
            <span className="wb-note">2 declared · 1 previewing</span>
          </CardHead>
          <Row look="ruled">
            <RowLine>
              <Dot tone="lilac" small />
              <RowName mono>showBetaFeature</RowName>
              <RowAction>
                <Button size="small">
                  <ResetIcon />
                  Clear
                </Button>
              </RowAction>
            </RowLine>
            <p className="wb-note">Previewing On</p>
          </Row>
          <ul className="wb-list">
            <Row as="li" look="ruled">
              <RowLine>
                <span>Button, ButtonGroup, ButtonGroupSeparator</span>
                <RowValue title="ui/button.tsx">ui/button.tsx</RowValue>
              </RowLine>
            </Row>
          </ul>
        </Card>
      </Frame>
    </div>
  );
}

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
  return (
    <div className="wb-states">
      <Frame title="The Inspector: Identity, ScopeSection, then a PropRow per prop">
        <Card look="divided">
          <Identity words={INSPECTOR_WORDS} onBack={said("back")} onCrumb={(id) => setLast(`select ${id}`)} {...IDENTITY} />
          <ScopeSection members={MEMBERS} selected={selected} words={INSPECTOR_WORDS} {...scopeCalls} />
          {PROP_ITEMS.map((item) => (
            <PropRow key={item.name} item={item} words={INSPECTOR_WORDS} {...rowCalls} />
          ))}
        </Card>
      </Frame>
      <Frame title="Identity: not generated yet, and gone">
        <Card look="divided">
          <Identity
            words={INSPECTOR_WORDS}
            onBack={said("back")}
            {...IDENTITY}
            status={NOT_GENERATED}
            keys={[]}
            tags={[]}
            chips={[]}
            crumbs={[]}
            notGenerated={{ tag: NOT_GENERATED, command: "npx loupe generate" }}
          />
        </Card>
        <Card look="divided">
          <Identity
            words={INSPECTOR_WORDS}
            onBack={said("back")}
            {...GONE}
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
.wb-list { list-style: none; margin: 0; padding: 0; }
.wb-site { display: flex; flex-direction: column; gap: var(--space-sheet); padding: var(--space-row) var(--space-gutter) var(--space-card); border-radius: var(--radius-card); background: var(--hover); }
.wb-pairs { padding: 0 var(--space-gutter) var(--space-inset) 42px; }
.wb-note-text { display: flex; flex-direction: column; gap: var(--space-xs); }
.wb-note-text p { font: var(--font-paragraph); color: var(--muted); }
.wb-note { font: var(--font-meta); color: var(--faint); }
.wb-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.wb-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; font: var(--font-title); color: var(--ink); }
.wb-ground { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: var(--radius-sheet); background: var(--ground); }
.wb-card > h2 { font: var(--font-title); color: var(--ink); }
.wb-bare { display: flex; flex-direction: column; gap: var(--space-row); padding: var(--space-card) var(--space-sheet); }
.wb-bare > h2 { font: var(--font-title); color: var(--ink); }
.wb-fold-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; font: var(--font-title); color: var(--ink); }
.wb-fold-row [data-fold-chevron] { color: var(--muted); }
.wb-fold-small { justify-content: flex-start; gap: 6px; min-height: 28px; font: var(--font-control); color: var(--muted); }
.wb-fold-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: var(--font-label); color: var(--faint); }
.wb-fold-line .wb-fold-row { font: var(--font-control); }
.wb-footer { padding: 14px; border-radius: var(--radius-card); background: var(--card); box-shadow: var(--shadow); }
.wb-mark { display: inline-flex; align-items: center; gap: 6px; font: var(--font-control); color: var(--ink); }
.wb-status { padding: 8px 14px; border-radius: var(--radius-status); background: var(--shown); color: var(--on-shown); box-shadow: inset 0 0 0 1px var(--shown-edge); font: var(--font-caption); }
.wb-fold-body { padding: 4px 0 4px 12px; font: var(--font-paragraph); color: var(--muted); }
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
          <Card className="wb-card">
            <h2>ChipGroup</h2>
            <ChipGroupStates />
          </Card>
          <Card className="wb-card">
            <h2>Button and Toggle</h2>
            <ButtonStates />
          </Card>
          <Card className="wb-card">
            <h2>Switch</h2>
            <SwitchStates />
          </Card>
          <Card className="wb-card">
            <h2>Fold</h2>
            <FoldStates />
          </Card>
          <Card className="wb-card">
            <h2>Field</h2>
            <FieldStates />
          </Card>
          <Card className="wb-card">
            <h2>Popover</h2>
            <PopoverStates />
          </Card>
          <Card className="wb-card">
            <h2>Tag, Dot, Delta and Kbd</h2>
            <MarkStates />
          </Card>
          <Card className="wb-card">
            <h2>Announcer</h2>
            <AnnouncerStates />
          </Card>
          {/* On the ground, not in a frame's card: a card never sits on a card. */}
          <section className="wb-bare">
            <h2>Card and Row</h2>
            <CardRowStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: the Inspector</h2>
            <PatternStates />
          </section>
          <section className="wb-bare">
            <h2>Patterns: the list</h2>
            <ListPatternStates />
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
