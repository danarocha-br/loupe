// The page's rasterizer for Snapshots (PER-217): `modern-screenshot` draws the
// viewport in the page itself, with no separate browser and no permission prompt.
// Canvas cuts the crops and encodes the images. Tests use fixed pixels instead
// (`snapshots.fixture.ts`).

import type { Rasterizer, Rect } from "./snapshots.js";
import { HOST_ATTRIBUTE } from "./styles.js";

/** Marks what capturing adds to the page (the cover holding the still, the style that stops transitions); never captured. */
export const CAPTURE_ATTRIBUTE = "data-loupe-capture";

const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#f1f3f3" stroke="#999" stroke-dasharray="4"/><text x="50%" y="55%" font-family="system-ui,sans-serif" font-size="11" fill="#555" text-anchor="middle">Image not captured</text></svg>',
)}`;

export const screenshotRasterizer: Rasterizer = {
  measure(node) {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return null;
    return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right };
  },

  async rasterize({ width, height, dpr }) {
    const { domToCanvas } = await import("modern-screenshot");
    let failed = 0;
    const canvas = await domToCanvas(document.documentElement, {
      width,
      height,
      scale: dpr,
      backgroundColor: pageBackground(),
      // The window's scroll: the root grows by it and moves up and left by it, so
      // the image starts where the viewport does. Fixed elements stay put.
      style: {
        width: `${width + window.scrollX}px`,
        height: `${height + window.scrollY}px`,
        marginTop: `${-window.scrollY}px`,
        marginLeft: `${-window.scrollX}px`,
        overflow: "hidden",
      },
      filter: (node) =>
        !(node instanceof Element) ||
        !(node.hasAttribute(HOST_ATTRIBUTE) || node.hasAttribute(CAPTURE_ATTRIBUTE) || node.localName === "nextjs-portal"),
      fetch: {
        placeholderImage: () => {
          failed++;
          return PLACEHOLDER;
        },
      },
    });
    return {
      failed,
      still: canvas,
      encode: () => encode(canvas),
      cut: (rect) => cut(canvas, rect, dpr),
    };
  },
};

/** What shows behind a transparent page: the body's background, else the root's, else white. */
function pageBackground(): string {
  for (const element of [document.body, document.documentElement]) {
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
  }
  return "#fff";
}

function cut(source: HTMLCanvasElement, rect: Rect, dpr: number): string {
  const canvas = document.createElement("canvas");
  const x = Math.round(rect.left * dpr);
  const y = Math.round(rect.top * dpr);
  canvas.width = Math.max(1, Math.round((rect.right - rect.left) * dpr));
  canvas.height = Math.max(1, Math.round((rect.bottom - rect.top) * dpr));
  canvas.getContext("2d")?.drawImage(source, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return encode(canvas);
}

/** WebP at 0.9, or PNG where the browser can't encode WebP. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
