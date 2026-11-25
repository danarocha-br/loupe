// Legend (ADR 0003, DESIGN.md "Property rows"): what a chip's marks mean, said once, on a
// row of its own under the options: the salmon of what shows now, the ring of the app's
// value once an Override replaces it, and the dot of the design system's default. Hidden
// from assistive technology: each chip says its own marks in words.
//
// It draws `InspectorWords`' legend and builds none. See legend.md.

import type { InspectorWords } from "../view.js";

export type LegendProps = {
  words: Pick<InspectorWords, "legend">;
  /** Whether a chip on the card rings the app's value: the legend says it only then. */
  app: boolean;
};

export function Legend({ words, app }: LegendProps) {
  return (
    <div data-legend="" aria-hidden="true">
      <span>
        <i data-legend-mark="shown" />
        {words.legend.shown}
      </span>
      {app && (
        <span>
          <i data-legend-mark="app" />
          {words.legend.app}
        </span>
      )}
      <span>
        <i data-legend-mark="default" />
        {words.legend.default}
      </span>
    </div>
  );
}
