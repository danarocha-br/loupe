import { describe, expect, it } from "vitest";
import {
  BODY,
  bodyRect,
  centreOf,
  DEFAULT_PLACE,
  FLARE,
  glue,
  MARGIN,
  nearestEdge,
  placeFor,
  REACH,
  readPlace,
  seamRect,
} from "./launcher-place.js";

const VIEWPORT = { width: 1200, height: 800 };

describe("where the collapsed pill lands (2026-11-22)", () => {
  it("docks on the nearest side when let go within reach of it", () => {
    // The body's right end 30px from the right side.
    expect(placeFor(1200 - BODY.width / 2 - 30, 400, VIEWPORT)).toEqual({ edge: "right", at: 0.5 });
    expect(placeFor(600, 800 - BODY.height / 2 - (REACH - 1), VIEWPORT)).toEqual({ edge: "bottom", at: 0.5 });
    expect(placeFor(BODY.width / 2 + 2, 200, VIEWPORT)).toEqual({ edge: "left", at: 0.25 });
    expect(placeFor(300, 0, VIEWPORT)).toEqual({ edge: "top", at: 0.25 });
  });

  it("stays free where it was let go, out of every side's reach", () => {
    expect(placeFor(600, 400, VIEWPORT)).toEqual({ edge: null, x: 0.5, y: 0.5 });
    expect(placeFor(600, 800 - BODY.height / 2 - REACH, VIEWPORT).edge).toBeNull();
  });

  it("keeps a docked pill's fillets clear of the corners", () => {
    const centre = centreOf(glue("bottom", 0, VIEWPORT), VIEWPORT);
    expect(centre.x - BODY.width / 2 - FLARE).toBe(MARGIN);
    expect(centre.y + BODY.height / 2).toBe(VIEWPORT.height);
  });

  it("holds its place across a resize, in fractions of the window", () => {
    const place = placeFor(300, 200, VIEWPORT);
    expect(centreOf(place, { width: 600, height: 400 })).toEqual({ x: 150, y: 100 });
    // A free pill shrunk out of a small window is kept inside it.
    expect(centreOf({ edge: null, x: 1, y: 1 }, { width: 600, height: 400 })).toEqual({ x: 600 - BODY.width / 2 - MARGIN, y: 400 - BODY.height / 2 - MARGIN });
  });

  it("gives the body's box for a place", () => {
    expect(bodyRect({ edge: null, x: 0.5, y: 0.5 }, VIEWPORT)).toEqual({ left: 600 - BODY.width / 2, top: 400 - BODY.height / 2, width: BODY.width, height: BODY.height });
  });

  it("lights a seam on the edge it would dock on, centred on the preview, 24px past the pill's side each way", () => {
    expect(seamRect("right", { x: 1178, y: 400 }, VIEWPORT)).toEqual({ left: 1198, top: 360, width: 2, height: 80 });
    expect(seamRect("bottom", { x: 600, y: 784 }, VIEWPORT)).toEqual({ left: 554, top: 798, width: 92, height: 2 });
  });

  it("finds the side the body is closest to", () => {
    expect(nearestEdge(600, 800 - BODY.height / 2 - 30, VIEWPORT)).toEqual({ edge: "bottom", gap: 30 });
  });

  it("reads back what it stored, and starts on the right side for anything else", () => {
    expect(readPlace(JSON.stringify({ edge: "left", at: 0.3 }))).toEqual({ edge: "left", at: 0.3 });
    expect(readPlace(JSON.stringify({ edge: null, x: 0.2, y: 0.4 }))).toEqual({ edge: null, x: 0.2, y: 0.4 });
    for (const stored of [null, "", "{", "[]", '{"edge":"middle","at":0.5}', '{"edge":"top","at":4}']) {
      expect(readPlace(stored)).toEqual(DEFAULT_PLACE);
    }
  });
});
