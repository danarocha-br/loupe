// @vitest-environment jsdom
// The page's rasterizer on its own (PER-217). jsdom neither lays out nor draws:
// `modern-screenshot` and the canvas are stubbed here, and only here. The capture
// sequence is tested with fixed pixels, in `snapshots.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Given = {
  width: number;
  height: number;
  scale: number;
  backgroundColor: string;
  style: Record<string, string>;
  filter: (node: Node) => boolean;
  fetch: { placeholderImage: () => string };
};

// What `modern-screenshot` was asked for, and how many images it couldn't load.
let given: Given | undefined;
let unloaded = 0;

vi.mock("modern-screenshot", () => ({
  domToCanvas: vi.fn(async (_root: Node, options: Given) => {
    given = options;
    for (let i = 0; i < unloaded; i++) options.fetch.placeholderImage();
    const canvas = document.createElement("canvas");
    canvas.dataset.image = "page";
    return canvas;
  }),
}));

const { CAPTURE_ATTRIBUTE, screenshotRasterizer } = await import("./snapshots-raster.js");
const { HOST_ATTRIBUTE } = await import("./styles.js");

const frame = { width: 800, height: 600, dpr: 2 };
let drawn: number[][] = [];
let webp = true;

const box = (top: number, left: number, width: number, height: number) =>
  ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON() {} }) as DOMRect;

const element = (name: string, attribute?: string) => {
  const node = document.createElement(name);
  if (attribute) node.setAttribute(attribute, "");
  return node;
};

beforeEach(() => {
  given = undefined;
  unloaded = 0;
  drawn = [];
  webp = true;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const target = this;
    return {
      drawImage: (source: HTMLCanvasElement, ...args: number[]) => {
        target.dataset.image = `cut of ${source.dataset.image}`;
        drawn.push(args);
      },
    } as unknown as CanvasRenderingContext2D;
  } as never);
  // A browser that can't encode WebP hands back PNG.
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement, type = "image/png") {
    return `data:${type === "image/webp" && !webp ? "image/png" : type};base64,${this.dataset.image}`;
  });
});

afterEach(() => {
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("the page's rasterizer", () => {
  it("measures a node's box, and nothing for one that draws nothing", () => {
    const node = element("div");
    node.getBoundingClientRect = () => box(10, 20, 40, 30);
    expect(screenshotRasterizer.measure(node)).toEqual({ top: 10, left: 20, bottom: 40, right: 60 });
    // A rule is drawn: one side is enough.
    node.getBoundingClientRect = () => box(10, 20, 0, 1);
    expect(screenshotRasterizer.measure(node)).toEqual({ top: 10, left: 20, bottom: 11, right: 20 });
    node.getBoundingClientRect = () => box(10, 20, 0, 0);
    expect(screenshotRasterizer.measure(node)).toBeNull();
  });

  it("draws the viewport from where the page is scrolled, at the device pixel ratio", async () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(300);
    const raster = await screenshotRasterizer.rasterize(frame);
    expect(given).toMatchObject({
      width: 800,
      height: 600,
      scale: 2,
      style: { width: "800px", height: "900px", marginTop: "-300px", marginLeft: "0px", overflow: "hidden" },
    });
    expect(raster.still).toBeInstanceOf(HTMLCanvasElement);
  });

  it("leaves out the Toolbar, what capturing adds to the page, and Next's dev overlay", async () => {
    await screenshotRasterizer.rasterize(frame);
    const keeps = given?.filter as Given["filter"];
    expect(keeps(element("main"))).toBe(true);
    expect(keeps(document.createTextNode("Ana"))).toBe(true);
    expect(keeps(element("div", HOST_ATTRIBUTE))).toBe(false);
    expect(keeps(element("div", CAPTURE_ATTRIBUTE))).toBe(false);
    expect(keeps(element("nextjs-portal"))).toBe(false);
  });

  it("fills behind a transparent page with the body's background, else white", async () => {
    await screenshotRasterizer.rasterize(frame);
    expect(given?.backgroundColor).toBe("#fff");
    document.body.style.backgroundColor = "rgb(12, 34, 56)";
    await screenshotRasterizer.rasterize(frame);
    expect(given?.backgroundColor).toBe("rgb(12, 34, 56)");
  });

  it("counts the images it drew a placeholder for", async () => {
    unloaded = 2;
    expect((await screenshotRasterizer.rasterize(frame)).failed).toBe(2);
  });

  it("cuts a crop at the device pixel ratio, and encodes WebP, or PNG where the browser can't", async () => {
    const raster = await screenshotRasterizer.rasterize(frame);
    expect(raster.encode()).toBe("data:image/webp;base64,page");
    expect(raster.cut({ top: 10, left: 20, bottom: 50, right: 120 })).toBe("data:image/webp;base64,cut of page");
    // From the image's pixels, twice the CSS pixels: x, y, width, height, then where it lands.
    expect(drawn).toEqual([[40, 20, 200, 80, 0, 0, 200, 80]]);

    webp = false;
    expect(raster.encode()).toBe("data:image/png;base64,page");
  });
});
