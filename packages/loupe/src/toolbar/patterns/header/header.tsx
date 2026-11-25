// PanelHeader and StatusStrip (ADR 0003, DESIGN.md "Select tools", "Hide marks"): the
// panel's pinned header card, the wordmark and the page at its left, the tools at its right
// (the select tools as one radio group, Hide marks, Hide), and the strip under it that says
// what the page is doing: picking, a dialog of the app's under the panel, the marks hidden.
//
// Both draw panel-view's words (`HeaderWords`) and build none. They write nothing: a tool,
// Hide marks and Hide call back, and the view picks, hides and says the strip as it
// changes. See header.md.

import type { ReactNode } from "react";
import type { HeaderWords, Scope, SelectMode, StripPart } from "../../panel-view/index.js";
import {
  Button,
  Chip,
  ChipGroup,
  CursorIcon,
  Kbd,
  lookAttributes,
  MarksHiddenIcon,
  MarksIcon,
  PanelIcon,
  SelectManyIcon,
  Toggle,
  Wordmark,
} from "@loupe/ui";

/** The select tools are chips of a radio group drawn as Button's round tool. */
const TOOL_LOOK = lookAttributes({ look: "tool", iconOnly: true });

/** The two select tools: the scope each opens a selection at, and its icon. */
const SELECT_TOOLS: { mode: SelectMode; scope: Scope; icon: ReactNode }[] = [
  { mode: "one", scope: "instance", icon: <CursorIcon /> },
  { mode: "many", scope: "group", icon: <SelectManyIcon /> },
];

export type PanelHeaderProps = {
  /** The page after the wordmark, and its tooltip, while nothing is selected; null while an Instance's identity names it. */
  page: { name: string; title: string } | null;
  /** The select tool checked. */
  mode: SelectMode;
  /** Picking on the page with it: the tool is armed. */
  armed: boolean;
  /** The marks are off the page: Hide marks is pressed. */
  marksHidden: boolean;
  words: HeaderWords;
  onTool(mode: SelectMode): void;
  onMarks(): void;
  onHide(): void;
};

export function PanelHeader({ page, mode, armed, marksHidden, words, onTool, onMarks, onHide }: PanelHeaderProps) {
  return (
    <header data-header="">
      <div data-header-brand="">
        <Wordmark />
        {page && (
          <span data-header-page="" title={page.title}>
            {words.pageLead}
            {page.name}
          </span>
        )}
      </div>
      <div data-header-tools="">
        {/* The mode, as a radio group: armed is the page's state, said by the status strip below. */}
        <ChipGroup look="bare" data-select-tools="" label={words.select} value={mode} onChoose={(next) => onTool(next as SelectMode)}>
          {SELECT_TOOLS.map((tool) => (
            <Chip
              key={tool.mode}
              value={tool.mode}
              {...TOOL_LOOK}
              data-select-tool=""
              data-scope={tool.scope}
              data-armed={armed && mode === tool.mode ? "" : undefined}
              title={words.tools[tool.mode].title}
            >
              {tool.icon}
              <span className="sr-only">{words.tools[tool.mode].label}</span>
            </Chip>
          ))}
        </ChipGroup>
        <span data-header-divider="" aria-hidden="true" />
        <Toggle look="tool" iconOnly data-marks="" pressed={marksHidden} onPressedChange={() => onMarks()} title={marksHidden ? words.marks.show : words.marks.hide}>
          {marksHidden ? <MarksHiddenIcon /> : <MarksIcon />}
          <span className="sr-only">{words.marks.label}</span>
        </Toggle>
        <Button look="tool" iconOnly onClick={onHide} title={words.hide.title}>
          <PanelIcon />
          <span className="sr-only">{words.hide.label}</span>
        </Button>
      </div>
    </header>
  );
}

export type StatusStripProps = {
  /** What the strip says, a key drawn in `kbd`; null while there is nothing to say. */
  parts: readonly StripPart[] | null;
};

/** The strip under the header. Its region stays while it is empty, so the line comes and goes inside it. */
export function StatusStrip({ parts }: StatusStripProps) {
  return (
    <div data-strip-region="">
      {parts && <div data-strip="">{parts.map((part, index) => (typeof part === "string" ? part : <Kbd key={index}>{part.key}</Kbd>))}</div>}
    </div>
  );
}
