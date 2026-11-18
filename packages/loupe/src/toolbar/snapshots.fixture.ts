// Fixed pixels: a Rasterizer for tests only (PER-217); the build leaves
// `*.fixture.ts` out. jsdom neither lays out nor draws, so the test says where
// each node is and what each drawing shows. An image is plain text, and the data
// URLs carry it, so a test can read back which drawing a crop came from and where
// it was cut.

import type { Rasterizer, Rect } from "./snapshots.js";

export type FixedPixelsOptions = {
  /** Where each node is drawn: nowhere by default. */
  layout?: (node: Element) => Rect | null;
  /**
   * Runs as each rasterization does; its text is the image, "1", "2", … by
   * default. What it throws fails that rasterization.
   */
  draw?: () => string;
  /** Per rasterization, in order, how many images didn't load: none by default. */
  failed?: readonly number[];
};

export type FixedPixels = Rasterizer & {
  /** Every image drawn so far, in order. */
  drawn: string[];
};

export function fixedPixels(options: FixedPixelsOptions = {}): FixedPixels {
  const drawn: string[] = [];
  let rasterizations = 0;
  const layout = options.layout ?? (() => null);
  const draw = options.draw ?? (() => String(drawn.length + 1));
  return {
    drawn,
    measure: (node) => layout(node),
    async rasterize() {
      const failed = options.failed?.[rasterizations++] ?? 0;
      const image = draw();
      drawn.push(image);
      return {
        failed,
        still: document.createElement("div"),
        encode: () => `data:image/png;base64,${image}`,
        cut: ({ top, left, bottom, right }) => `data:image/png;base64,${image}@${top},${left},${bottom},${right}`,
      };
    },
  };
}
