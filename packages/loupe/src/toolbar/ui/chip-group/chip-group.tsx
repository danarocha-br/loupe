// ChipGroup: choosing one value from a set, as chips (ADR 0003). A radio group on
// UI SDK's `radio`, behind Loupe's own interface: the group owns the keys, the tab
// stop and the ARIA; each Chip's content is the caller's. See chip-group.md.

import { Radio, RadioGroup } from "@ui-sdk/react/radio";
import { createContext, type KeyboardEvent, type MouseEvent, type ReactNode, useContext } from "react";

type DataAttributes = { [name: `data-${string}`]: string | undefined };

export type ChipGroupProps = {
  /** The group's accessible name. */
  label: string;
  /** The checked chip's value; `null` checks none (a group whose value is decided elsewhere). */
  value: string | null;
  /**
   * A chip was chosen: a click, Space or Enter, on any chip, the checked one included.
   * Arrow keys only move focus (manual activation): the caller decides what choosing does.
   */
  onChoose(value: string): void;
  /** `chips` draws the option chips; `bare` leaves the look to the caller's class. */
  look?: "chips" | "bare";
  /** A choice is on its way: said on the group, the chips stay usable. */
  busy?: boolean;
  className?: string;
  children: ReactNode;
} & DataAttributes;

export type ChipProps = {
  value: string;
  children: ReactNode;
  /** A short tag after the label, which also rings the chip: "app". */
  tag?: string;
  /** A dot after the label. */
  dot?: boolean;
  /** A count after everything else; `null` shows none. */
  count?: number | null;
  /** What the marks mean, for a screen reader: read after the label. */
  description?: string;
  title?: string;
  className?: string;
} & DataAttributes;

type Group = { value: string | null; choose(value: string): void };

const GroupContext = createContext<Group | null>(null);

export function ChipGroup({ label, value, onChoose, look = "chips", busy, className, children, ...data }: ChipGroupProps) {
  return (
    <GroupContext.Provider value={{ value, choose: onChoose }}>
      <RadioGroup<string>
        {...data}
        value={value}
        // UI SDK checks on arrows and on a press. The group is controlled and the caller
        // decides: arrows move focus alone, and a press reaches `onChoose`.
        onValueChange={(next, details) => {
          details.cancel();
          if (details.reason === "item-press" && next !== null) onChoose(next);
        }}
        aria-label={label}
        aria-busy={busy || undefined}
        data-chip-group=""
        data-look={look}
        className={className}
      >
        {children}
      </RadioGroup>
    </GroupContext.Provider>
  );
}

export function Chip({ value, children, tag, dot, count = null, description, title, className, ...data }: ChipProps) {
  const group = useContext(GroupContext);
  if (!group) throw new Error("A Chip renders inside a ChipGroup.");
  // UI SDK hears nothing when the checked radio is pressed again; choosing it still means something here.
  const onClick = (_event: MouseEvent<HTMLButtonElement>) => {
    if (group.value === value) group.choose(value);
  };
  // Enter chooses too (UI SDK's radio leaves it to a form); held down, it chooses once.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) group.choose(value);
  };
  return (
    <Radio
      {...data}
      value={value}
      title={title}
      className={className}
      data-chip=""
      data-tagged={tag ? "" : undefined}
      data-dotted={dot ? "" : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span data-part="label">{children}</span>
      {tag && (
        <span data-part="tag" aria-hidden="true">
          {tag}
        </span>
      )}
      {count !== null && <span data-part="count">{count}</span>}
      {description && <span data-part="description">, {description}</span>}
    </Radio>
  );
}
