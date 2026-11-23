"use client";

// The workbench (ADR 0003): each primitive drawn by itself, inside the same shadow-root
// surface the Toolbar uses, in light and dark, under forced colours, with reduced
// motion and at a larger text size. `@danarocha/loupe/workbench` exists for the
// fixture app's `/workbench` page, which loads it in development only, as
// `<LoupeMount />` loads the Toolbar; a host never imports it.

import { type ReactNode, useEffect, useState } from "react";
import { Surface, type Theme } from "./surface/index.js";
import { Button, Chip, ChipGroup, Fold, FoldChevron, FoldPanel, FoldTrigger, Switch, Toggle } from "./ui/index.js";

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
      <Row title="Chosen, arrows move, Space or Enter chooses">
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
        <p className="wb-note" aria-live="polite">
          Last chosen: {chosen}
        </p>
      </Row>
      <Row title="Marks: tag (app's value), dot (default), count">
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
      </Row>
      <Row title="Nothing chosen until one is (the app decides)">
        <ChipGroup label="plan" value={flag} onChoose={setFlag}>
          <Chip value="free">Free</Chip>
          <Chip value="pro">Pro</Chip>
          <Chip value="team">Team</Chip>
        </ChipGroup>
      </Row>
    </div>
  );
}

/** Fold's states: closed, open, kept by the caller at its own width, and one inside another. */
function FoldStates() {
  const [open, setOpen] = useState(false);
  return (
    <div className="wb-states">
      <Row title="Closed: Enter or Space opens it, focus stays on the row">
        <Fold>
          <FoldTrigger className="wb-fold-row">
            <span>Order details</span>
            <FoldChevron />
          </FoldTrigger>
          <FoldPanel>
            <p className="wb-fold-body">Still in the page while closed: find in page opens it.</p>
          </FoldPanel>
        </Fold>
      </Row>
      <Row title="Open at first, with a fold inside">
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
      </Row>
      <Row title="Inline, the caller keeps the state">
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
      </Row>
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
      <Row title="Soft: small, medium, large; disabled">
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
        <p className="wb-note" aria-live="polite">
          Pressed {presses} times
        </p>
      </Row>
      <Row title="Primary, and icon only">
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
      </Row>
      <Row title="Toggle: a tool, a soft pill, and one whose pressed shows elsewhere">
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
        <p className="wb-note" aria-live="polite">
          Dark theme {dark ? "pressed" : "not pressed"}: the button draws no mark
        </p>
      </Row>
    </div>
  );
}

/** Switch's states: off, on, and disabled. */
function SwitchStates() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(true);
  return (
    <div className="wb-states">
      <Row title="Space or Enter turns it; the thumb slides with its corners">
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
      </Row>
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="wb-row">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** The frame's own layout: a card on the panel's ground, in the surface's tokens. */
const FRAME_CSS = `
.wb-card { padding: 14px; border-radius: var(--radius-card); background: var(--card); color: var(--ink); box-shadow: var(--shadow); font: var(--font-body); }
.wb-states { display: flex; flex-direction: column; gap: 16px; }
.wb-row { display: flex; flex-direction: column; gap: 8px; }
.wb-row h3 { font: var(--font-label); color: var(--muted); }
.wb-note { font: var(--font-meta); color: var(--faint); }
.wb-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.wb-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; font: var(--font-title); color: var(--ink); }
.wb-ground { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: var(--radius-sheet); background: var(--ground); }
.wb-card > h2 { margin-bottom: 12px; font: var(--font-title); color: var(--ink); }
.wb-fold-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; font: var(--font-title); color: var(--ink); }
.wb-fold-row [data-fold-chevron] { color: var(--muted); }
.wb-fold-small { justify-content: flex-start; gap: 6px; min-height: 28px; font: var(--font-control); color: var(--muted); }
.wb-fold-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: var(--font-label); color: var(--faint); }
.wb-fold-line .wb-fold-row { font: var(--font-control); }
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
          <div className="wb-card">
            <h2>ChipGroup</h2>
            <ChipGroupStates />
          </div>
          <div className="wb-card">
            <h2>Button and Toggle</h2>
            <ButtonStates />
          </div>
          <div className="wb-card">
            <h2>Switch</h2>
            <SwitchStates />
          </div>
          <div className="wb-card">
            <h2>Fold</h2>
            <FoldStates />
          </div>
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
