import type { ComponentType, ReactNode } from "react";
import * as system from "../../src/index.js";
import { Frame, States } from "../shell/frame.js";

/** Every icon the package exports, by its name: `ResetIcon`, `Wordmark`. */
const ICONS: [string, ComponentType][] = Object.entries(system)
  .filter(([name]) => /Icon$|^Wordmark$/.test(name))
  .map(([name, icon]): [string, ComponentType] => [name, icon as ComponentType])
  .sort(([a], [b]) => a.localeCompare(b));

function Swatch({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="wb-icon">
      <span className="wb-icon-glyph">{children}</span>
      <figcaption>{name}</figcaption>
    </figure>
  );
}

/** Every icon at its own size, in ink and in muted, and every prop's glyph. */
export function IconStates() {
  return (
    <States>
      <Frame title="Each icon at its own size, in the ink it sits in">
        <div className="wb-icons">
          {ICONS.map(([name, Icon]) => (
            <Swatch key={name} name={name}>
              <Icon />
            </Swatch>
          ))}
        </div>
      </Frame>
      <Frame title="PROP_ICONS: a prop's glyph by what the prop does, 20px">
        <div className="wb-icons">
          {Object.entries(system.PROP_ICONS).map(([name, glyph]) => (
            <Swatch key={name} name={name}>
              {glyph}
            </Swatch>
          ))}
        </div>
      </Frame>
      <Frame title="In muted: each takes the colour it sits in">
        <div className="wb-icons wb-muted">
          {ICONS.slice(0, 8).map(([name, Icon]) => (
            <Swatch key={name} name={name}>
              <Icon />
            </Swatch>
          ))}
        </div>
      </Frame>
    </States>
  );
}
