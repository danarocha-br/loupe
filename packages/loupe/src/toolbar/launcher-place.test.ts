import { describe, expect, it } from "vitest";
import { BODY, bodyRect, centreOf, DEFAULT_PLACE, FILLET, glue, layout, MARGIN, neckPath, nearestEdge, placeFor, pullOf, readPlace, SNAP } from "./launcher-place.js";

const VIEWPORT = { width: 1200, height: 800 };

describe("where the collapsed pill lands (2026-11-22)", () => {
  it("glues to the nearest side when dropped within reach of it", () => {
    // The body's right end 30px from the right side.
    expect(placeFor(1200 - BODY.width / 2 - 30, 400, VIEWPORT)).toEqual({ edge: "right", at: 0.5 });
    expect(placeFor(600, 800 - BODY.height / 2 - SNAP, VIEWPORT)).toEqual({ edge: "bottom", at: 0.5 });
    expect(placeFor(BODY.width / 2 + 2, 200, VIEWPORT)).toEqual({ edge: "left", at: 0.25 });
    expect(placeFor(300, 0, VIEWPORT)).toEqual({ edge: "top", at: 0.25 });
  });

  it("stays free where it was let go, away from every side", () => {
    expect(placeFor(600, 400, VIEWPORT)).toEqual({ edge: null, x: 0.5, y: 0.5 });
    expect(placeFor(600, 800 - BODY.height / 2 - SNAP - 1, VIEWPORT).edge).toBeNull();
  });

  it("keeps a glued pill's fillets clear of the corners", () => {
    const place = glue("bottom", 0, VIEWPORT);
    const box = layout(place, VIEWPORT);
    expect(box.left).toBe(MARGIN);
    expect(box.top + box.height).toBe(VIEWPORT.height);
    expect(box.width).toBe(BODY.width + 2 * FILLET);
  });

  it("lays a glued pill flush with its side, the body's far end out, the L at the body's centre", () => {
    const right = layout({ edge: "right", at: 0.5 }, VIEWPORT);
    expect(right.left + right.width).toBe(VIEWPORT.width);
    // The pill never turns: against a side, its long axis stands out from the edge.
    expect(right.width).toBe(BODY.width);
    expect(right.height).toBe(BODY.height + 2 * FILLET);
    expect(right.body).toEqual({ x: BODY.width / 2, y: BODY.height / 2 + FILLET });
    const left = layout({ edge: "left", at: 0.5 }, VIEWPORT);
    expect(left.left).toBe(0);
    const top = layout({ edge: "top", at: 0.5 }, VIEWPORT);
    expect(top.top).toBe(0);
    expect(top.body).toEqual({ x: BODY.width / 2 + FILLET, y: BODY.height / 2 });
  });

  it("draws the fillets as concave arcs on each side, mirrored where the side mirrors the drawing", () => {
    // Bottom: the flare arcs sweep one way, the far corners the other.
    expect(layout({ edge: "bottom", at: 0.5 }, VIEWPORT).path).toBe(
      "M0 32A8 8 0 0 0 8 24L8 16A16 16 0 0 1 24 0L36 0A16 16 0 0 1 52 16L52 24A8 8 0 0 0 60 32Z",
    );
    // Top mirrors it: every sweep flips.
    expect(layout({ edge: "top", at: 0.5 }, VIEWPORT).path).toBe(
      "M0 0A8 8 0 0 1 8 8L8 16A16 16 0 0 0 24 32L36 32A16 16 0 0 0 52 16L52 8A8 8 0 0 1 60 0Z",
    );
  });

  it("holds its place across a resize, in fractions of the window", () => {
    const place = placeFor(300, 200, VIEWPORT);
    expect(centreOf(place, { width: 600, height: 400 })).toEqual({ x: 150, y: 100 });
    // A free pill shrunk out of a small window is kept inside it.
    expect(centreOf({ edge: null, x: 1, y: 1 }, { width: 600, height: 400 })).toEqual({ x: 600 - BODY.width / 2 - MARGIN, y: 400 - BODY.height / 2 - MARGIN });
  });

  it("reads back what it stored, and starts on the right side for anything else", () => {
    expect(readPlace(JSON.stringify({ edge: "left", at: 0.3 }))).toEqual({ edge: "left", at: 0.3 });
    expect(readPlace(JSON.stringify({ edge: null, x: 0.2, y: 0.4 }))).toEqual({ edge: null, x: 0.2, y: 0.4 });
    for (const stored of [null, "", "{", "[]", '{"edge":"middle","at":0.5}', '{"edge":"top","at":4}']) {
      expect(readPlace(stored)).toEqual(DEFAULT_PLACE);
    }
  });

  it("pulls harder as the pill nears a side: nothing from where it glues on out, full at the edge", () => {
    expect(pullOf(SNAP)).toBe(0);
    expect(pullOf(SNAP + 50)).toBe(0);
    expect(pullOf(SNAP / 2)).toBeCloseTo(0.5);
    expect(pullOf(0)).toBe(1);
    expect(nearestEdge(600, 800 - BODY.height / 2 - 30, VIEWPORT)).toEqual({ edge: "bottom", gap: 30 });
  });

  it("reaches for the pill with a neck only within reach, flaring onto the edge and into the body", () => {
    const y = (gap: number) => 800 - BODY.height / 2 - gap;
    expect(neckPath("bottom", 600, y(SNAP), VIEWPORT)).toBeNull();
    expect(neckPath("bottom", 600, y(0), VIEWPORT)).toBeNull();
    const neck = neckPath("bottom", 600, y(20), VIEWPORT) as string;
    // It starts inside the body (8px past its side) and ends on the edge, at y = 800.
    expect(neck.startsWith(`M${600 - 7.5} ${800 - 28}`)).toBe(true);
    expect(neck).toContain(" 800L");
    // Mapped onto the right side, it ends on x = 1200.
    expect(neckPath("right", 1200 - BODY.width / 2 - 20, 400, VIEWPORT)).toMatch(/C[^C]* 1200 [\d.]+L1200 /);
  });

  it("gives the body's box for a place, where a closing panel lands", () => {
    expect(bodyRect({ edge: null, x: 0.5, y: 0.5 }, VIEWPORT)).toEqual({ left: 600 - BODY.width / 2, top: 400 - BODY.height / 2, width: BODY.width, height: BODY.height });
  });
});
