// StartCard (ADR 0003, DESIGN.md "Start"): the list's first card, with nothing selected.
// "What do you want to change?" in the hero style, a line under it, and the two select
// tools again as tiles side by side, each showing what its tool does: three small controls
// and a pointer, the middle one ringed in coral, and for Select multiple the other two dashed.
//
// The tiles are the header's radio group again (ChipGroup): the mode is the checked tile,
// and armed, a state of the page, only rings it. It draws `ListWords` and builds none:
// choosing goes out through `onTool`. See start-card.md.

import type { Ref } from "react";
import type { ListWords, SelectMode } from "../../panel-view/index.js";
import { Card, Chip, ChipGroup } from "../../ui/index.js";

/** The tiles, in the header's order. */
const MODES: readonly SelectMode[] = ["one", "many"];

export type StartCardProps = {
  words: Pick<ListWords, "start" | "tools">;
  /** The select tool in use: its tile is checked. */
  mode: SelectMode;
  /** A select tool is waiting for a click on the page: the tile in use is ringed in coral. */
  armed: boolean;
  /** A tile chosen, or the checked one pressed again. */
  onTool(mode: SelectMode): void;
  /** The view's heading, where focus goes as the list opens. */
  headingRef?: Ref<HTMLHeadingElement>;
};

/** What each select tool does, drawn small: three controls, one ringed or every one from a call site. */
export function ToolPreview({ mode }: { mode: SelectMode }) {
  const many = mode === "many";
  return (
    <span data-tool-preview="" aria-hidden="true">
      <span data-preview-chip={many ? "dashed" : ""} />
      <span data-preview-chip="ringed" />
      <span data-preview-chip={many ? "dashed" : ""} />
      <svg data-preview-pointer="" viewBox="238 238 36 36" focusable="false">
        <path d="M247.171 248.005l5.315 17.434c0.354 1.16 1.906 1.232 2.341 0.121l2.854-6.582c0.212-0.535 0.675-0.959 1.24-1.09l7.272-1.705c1.17-0.273 1.21-1.928 0.131-2.352l-17.597-7.366c-1.08-0.454-1.866 0.535-1.553 1.544z" />
      </svg>
    </span>
  );
}

export function StartCard({ words, mode, armed, onTool, headingRef }: StartCardProps) {
  return (
    <Card data-start="">
      {/* Each view has one level-2 heading, its own: focus finds it as the view's `h2`. */}
      <h2 tabIndex={-1} ref={headingRef}>
        {words.start.title}
      </h2>
      <p>{words.start.body}</p>
      <ChipGroup look="bare" data-start-tools="" label={words.start.tools} value={mode} onChoose={(next) => onTool(next as SelectMode)}>
        {MODES.map((tool) => (
          <Chip key={tool} value={tool} data-start-tool="" data-armed={armed && mode === tool ? "" : undefined} title={words.tools[tool].title}>
            <ToolPreview mode={tool} />
            <span data-tool-name="">{words.tools[tool].label}</span>
            <span data-tool-hint="">{words.tools[tool].hint}</span>
          </Chip>
        ))}
      </ChipGroup>
    </Card>
  );
}
