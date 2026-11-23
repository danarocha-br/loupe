"use client";

// The workbench (ADR 0003): each primitive drawn by itself, inside the same shadow-root
// surface the Toolbar uses, in light and dark, under forced colours, with reduced
// motion and at a larger text size. `@danarocha/loupe/workbench` exists for the
// fixture app's `/workbench` page, which loads it in development only, as
// `<LoupeMount />` loads the Toolbar; a host never imports it.

import { type ReactNode, useEffect, useState } from "react";
import { Surface, type Theme } from "./surface/index.js";
import { Chip, ChipGroup } from "./ui/index.js";

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
.wb-ground { padding: 6px; border-radius: var(--radius-sheet); background: var(--ground); }
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
            <ChipGroupStates />
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
