import { useState } from "react";
import { Chip, ChipGroup } from "../../src/index.js";
import { Frame, States } from "./frame.js";

const SIZES = ["sm", "md", "lg"];
const VARIANTS = ["solid", "ghost", "link", "a much longer value that wraps inside its chip"];

/** ChipGroup's states: a chosen value, the marks, nothing chosen. */
export function ChipGroupStates() {
  const [size, setSize] = useState<string | null>("md");
  const [variant, setVariant] = useState<string | null>("ghost");
  const [flag, setFlag] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>("—");
  return (
    <States>
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
        <p className="wb-note">Last chosen: {chosen}</p>
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
    </States>
  );
}
