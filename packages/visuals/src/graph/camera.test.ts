import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  FIT_PADDING,
  KEEP_IN_VIEW,
  SMALLEST_AREA,
  UNIT_VIEW,
  WHEEL_LINE,
  WHEEL_PINCH,
  ZOOM_LIMITS,
  clampZoom,
  fitRect,
  frameRects,
  freeArea,
  keepRect,
  panView,
  pictureMoveAt,
  pinchView,
  rectToScreen,
  revealRects,
  sameView,
  showsRect,
  toPicture,
  toScreen,
  viewAt,
  viewBetween,
  wheelFactor,
  zoomLimitsFor,
  zoomView,
  type PictureMove,
  type PictureView,
  type ZoomLimits,
} from "./camera.ts";

const coordinate = fc.double({ min: -2000, max: 2000, noNaN: true });
const anyPoint = fc.record({ x: coordinate, y: coordinate });
const anyView = fc.record({ x: coordinate, y: coordinate, k: fc.double({ min: 0.06, max: 7, noNaN: true }) });
const anyPart = fc.double({ min: 0, max: 1, noNaN: true });
const anyFactor = fc.double({ min: 0.2, max: 5, noNaN: true });
/** Limits that no zoom of a test reaches. */
const WIDE: ZoomLimits = { min: 1e-9, max: 1e9 };

describe("clampZoom", () => {
  it("keeps a zoom in its limits", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(0.001)).toBe(ZOOM_LIMITS.min);
    expect(clampZoom(99)).toBe(ZOOM_LIMITS.max);
    expect(clampZoom(3, { min: 0.5, max: 2 })).toBe(2);
  });

  it("gives the smallest zoom for a value that is not a number", () => {
    expect(clampZoom(Number.NaN)).toBe(ZOOM_LIMITS.min);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(ZOOM_LIMITS.min);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_LIMITS.max);
  });
});

describe("toPicture and toScreen", () => {
  it("shows each point at its own position in the unit view", () => {
    expect(toScreen(UNIT_VIEW, { x: 3, y: -4 })).toEqual({ x: 3, y: -4 });
    expect(toPicture(UNIT_VIEW, { x: 3, y: -4 })).toEqual({ x: 3, y: -4 });
  });

  it("multiplies by the zoom, then adds the position of the origin", () => {
    const view: PictureView = { x: 10, y: 20, k: 2 };
    expect(toScreen(view, { x: 5, y: 5 })).toEqual({ x: 20, y: 30 });
    expect(toPicture(view, { x: 20, y: 30 })).toEqual({ x: 5, y: 5 });
    expect(rectToScreen(view, { x: 5, y: 5, w: 4, h: 3 })).toEqual({ x: 20, y: 30, w: 8, h: 6 });
  });

  it("are the inverse of each other", () => {
    fc.assert(
      fc.property(anyView, anyPoint, (view, point) => {
        const back = toPicture(view, toScreen(view, point));
        expect(back.x).toBeCloseTo(point.x, 6);
        expect(back.y).toBeCloseTo(point.y, 6);
      }),
    );
  });

  it("puts a point of the picture at a screen point with viewAt", () => {
    fc.assert(
      fc.property(anyPoint, anyPoint, fc.double({ min: 0.06, max: 7, noNaN: true }), (point, at, k) => {
        const view = viewAt(point, at, k);
        expect(view.k).toBe(k);
        expect(toScreen(view, point).x).toBeCloseTo(at.x, 6);
        expect(toScreen(view, point).y).toBeCloseTo(at.y, 6);
      }),
    );
  });
});

describe("panView", () => {
  it("moves each point of the picture by the same screen distance", () => {
    const view: PictureView = { x: 10, y: 20, k: 2 };
    expect(panView(view, 7, -3)).toEqual({ x: 17, y: 17, k: 2 });
    expect(toScreen(panView(view, 7, -3), { x: 5, y: 5 })).toEqual({ x: 27, y: 27 });
  });
});

describe("zoomView", () => {
  it("zooms at the origin of the screen", () => {
    expect(zoomView({ x: 10, y: 20, k: 1 }, { x: 0, y: 0 }, 2)).toEqual({ x: 20, y: 40, k: 2 });
  });

  it("keeps the point of the picture at the screen point, also at a limit of the zoom", () => {
    fc.assert(
      fc.property(anyView, anyPoint, fc.double({ min: 0.001, max: 1000, noNaN: true }), (view, at, factor) => {
        const next = zoomView(view, at, factor);
        expect(next.k).toBeGreaterThanOrEqual(ZOOM_LIMITS.min);
        expect(next.k).toBeLessThanOrEqual(ZOOM_LIMITS.max);
        const before = toPicture(view, at);
        const after = toPicture(next, at);
        expect(after.x).toBeCloseTo(before.x, 6);
        expect(after.y).toBeCloseTo(before.y, 6);
      }),
    );
  });

  it("gives the same view for two zooms at one point as for one zoom by their product", () => {
    fc.assert(
      fc.property(anyView, anyPoint, anyFactor, anyFactor, (view, at, first, second) => {
        const twice = zoomView(zoomView(view, at, first, WIDE), at, second, WIDE);
        const once = zoomView(view, at, first * second, WIDE);
        expect(twice.k).toBeCloseTo(once.k, 9);
        expect(twice.x).toBeCloseTo(once.x, 6);
        expect(twice.y).toBeCloseTo(once.y, 6);
      }),
    );
  });
});

describe("pinchView", () => {
  const view: PictureView = { x: 40, y: -10, k: 1.5 };

  it("makes the picture two times as large when the distance between the pointers becomes two times as large", () => {
    const next = pinchView(UNIT_VIEW, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }]);
    expect(next).toEqual({ x: -150, y: -100, k: 2 });
  });

  it("only moves the picture when the pointers move together", () => {
    const next = pinchView(view, [{ x: 100, y: 100 }, { x: 200, y: 150 }], [{ x: 130, y: 90 }, { x: 230, y: 140 }]);
    expect(next.k).toBeCloseTo(view.k, 12);
    expect(next.x).toBeCloseTo(view.x + 30, 9);
    expect(next.y).toBeCloseTo(view.y - 10, 9);
  });

  it("only moves the picture for two pointers at one position", () => {
    const at = { x: 100, y: 100 };
    const to = { x: 120, y: 90 };
    expect(pinchView(view, [at, at], [to, to])).toEqual(panView(view, 20, -10));
    expect(pinchView(view, [at, { x: 150, y: 100 }], [to, to])).toEqual(panView(view, -5, -10));
  });

  it("keeps the point of the picture below each pointer when the pointers do not turn", () => {
    fc.assert(
      fc.property(anyView, anyPoint, anyPoint, fc.double({ min: 0.25, max: 4, noNaN: true }), anyPoint, (start, a, b, scale, shift) => {
        fc.pre(Math.hypot(a.x - b.x, a.y - b.y) > 1);
        const moved = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x * scale + shift.x, y: p.y * scale + shift.y });
        const next = pinchView(start, [a, b], [moved(a), moved(b)], WIDE);
        expect(next.k).toBeCloseTo(start.k * scale, 9);
        for (const pointer of [a, b]) {
          const before = toPicture(start, pointer);
          const after = toPicture(next, moved(pointer));
          expect(after.x).toBeCloseTo(before.x, 5);
          expect(after.y).toBeCloseTo(before.y, 5);
        }
      }),
    );
  });

  it("keeps the point of the picture at the middle of the pointers, also with a turn and at a limit of the zoom", () => {
    fc.assert(
      fc.property(anyView, anyPoint, anyPoint, anyPoint, anyPoint, (start, a, b, c, d) => {
        const next = pinchView(start, [a, b], [c, d]);
        expect(next.k).toBeGreaterThanOrEqual(ZOOM_LIMITS.min);
        expect(next.k).toBeLessThanOrEqual(ZOOM_LIMITS.max);
        const before = toPicture(start, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const after = toPicture(next, { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 });
        expect(after.x).toBeCloseTo(before.x, 5);
        expect(after.y).toBeCloseTo(before.y, 5);
      }),
    );
  });
});

describe("wheelFactor", () => {
  it("gives 1 for no turn, a larger picture for a turn away and a smaller picture for a turn to the person", () => {
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1, 12);
  });

  it("gives the same zoom for two short turns as for one long turn", () => {
    expect(wheelFactor(30) * wheelFactor(70)).toBeCloseTo(wheelFactor(100), 12);
  });

  it("reads a turn in lines, and a pinch on a touch pad", () => {
    expect(wheelFactor(3, 1)).toBeCloseTo(wheelFactor(3 * WHEEL_LINE), 12);
    expect(wheelFactor(4, 0, true)).toBeCloseTo(wheelFactor(4 * WHEEL_PINCH), 12);
  });
});

describe("freeArea", () => {
  it("is the full picture with no insets", () => {
    expect(freeArea({ width: 1280, height: 800 })).toEqual({ x: 0, y: 0, w: 1280, h: 800 });
  });

  it("is the picture without the parts that the page covers", () => {
    expect(freeArea({ width: 1280, height: 800 }, { top: 58, right: 380, bottom: 12, left: 244 })).toEqual({ x: 244, y: 58, w: 656, h: 730 });
    expect(freeArea({ width: 390, height: 700 }, { bottom: 360 })).toEqual({ x: 0, y: 0, w: 390, h: 340 });
  });

  it("has a smallest size when the page covers all of the picture", () => {
    expect(freeArea({ width: 100, height: 90 }, { left: 60, right: 60, top: 50, bottom: 50 })).toEqual({ x: 60, y: 50, w: SMALLEST_AREA, h: SMALLEST_AREA });
  });
});

describe("fitRect", () => {
  const area = { x: 200, y: 50, w: 800, h: 600 };

  it("shows a wide rectangle at the full width of the area less the padding", () => {
    const view = fitRect({ x: 0, y: 0, w: 1504, h: 100 }, area);
    expect(view.k).toBeCloseTo(0.5, 12);
    expect(rectToScreen(view, { x: 0, y: 0, w: 1504, h: 100 })).toEqual({ x: 224, y: 325, w: 752, h: 50 });
  });

  it("has a largest zoom", () => {
    expect(fitRect({ x: 0, y: 0, w: 10, h: 10 }, area).k).toBe(ZOOM_LIMITS.max);
    expect(fitRect({ x: 0, y: 0, w: 10, h: 10 }, area, { most: 1 })).toEqual({ x: 595, y: 345, k: 1 });
    expect(fitRect({ x: 0, y: 0, w: 1e6, h: 10 }, area).k).toBe(ZOOM_LIMITS.min);
  });

  it("puts a rectangle with no size at the middle of the area, at the largest zoom", () => {
    const view = fitRect({ x: 30, y: 40, w: 0, h: 0 }, area, { most: 2 });
    expect(view.k).toBe(2);
    expect(toScreen(view, { x: 30, y: 40 })).toEqual({ x: 600, y: 350 });
  });

  it("makes a picture for an area that is smaller than two paddings", () => {
    const view = fitRect({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 20, h: 20 }, { limits: WIDE });
    expect(view.k).toBeCloseTo(0.01, 12);
  });

  it("shows all of the rectangle in the area less the padding, at its middle, and fills one direction", () => {
    const size = fc.double({ min: 1, max: 5000, noNaN: true });
    const rects = fc.record({ x: coordinate, y: coordinate, w: size, h: size });
    const areas = fc.record({ x: fc.double({ min: 0, max: 300, noNaN: true }), y: fc.double({ min: 0, max: 300, noNaN: true }), w: fc.double({ min: 200, max: 2000, noNaN: true }), h: fc.double({ min: 200, max: 2000, noNaN: true }) });
    fc.assert(
      fc.property(rects, areas, (rect, into) => {
        const view = fitRect(rect, into, { limits: WIDE });
        const shown = rectToScreen(view, rect);
        expect(shown.x + shown.w / 2).toBeCloseTo(into.x + into.w / 2, 6);
        expect(shown.y + shown.h / 2).toBeCloseTo(into.y + into.h / 2, 6);
        expect(shown.w).toBeLessThanOrEqual(into.w - 2 * FIT_PADDING + 1e-6);
        expect(shown.h).toBeLessThanOrEqual(into.h - 2 * FIT_PADDING + 1e-6);
        const spare = Math.min(into.w - 2 * FIT_PADDING - shown.w, into.h - 2 * FIT_PADDING - shown.h);
        expect(spare).toBeCloseTo(0, 6);
        expect(showsRect(view, rect, into, FIT_PADDING - 1e-6)).toBe(true);
      }),
    );
  });
});

describe("zoomLimitsFor", () => {
  const area = { x: 200, y: 50, w: 800, h: 600 };

  it("keeps the limits for a picture that the smallest zoom shows fully", () => {
    expect(zoomLimitsFor({ x: 0, y: 0, w: 1000, h: 500 }, area)).toBe(ZOOM_LIMITS);
    expect(zoomLimitsFor({ x: 0, y: 0, w: 15_000, h: 11_000 }, area)).toBe(ZOOM_LIMITS);
  });

  it("keeps the limits for a picture with no size", () => {
    expect(zoomLimitsFor({ x: 5, y: 5, w: 0, h: 0 }, area)).toBe(ZOOM_LIMITS);
  });

  it("gives a smaller smallest zoom for a very large picture, so a camera shows all of it", () => {
    const bounds = { x: -3000, y: 100, w: 1_000_000, h: 40_000 };
    const limits = zoomLimitsFor(bounds, area);
    expect(limits.max).toBe(ZOOM_LIMITS.max);
    expect(limits.min).toBeCloseTo(752 / 1_000_000, 12);
    const view = fitRect(bounds, area, { limits });
    expect(view.k).toBe(limits.min);
    expect(showsRect(view, bounds, area, FIT_PADDING - 1e-6)).toBe(true);
    // The default limits do not show all of this picture.
    expect(showsRect(fitRect(bounds, area), bounds, area)).toBe(false);
  });

  it("uses the limits and the padding of the options", () => {
    const limits = { min: 0.5, max: 2 };
    expect(zoomLimitsFor({ x: 0, y: 0, w: 1000, h: 100 }, area, limits)).toBe(limits);
    expect(zoomLimitsFor({ x: 0, y: 0, w: 4000, h: 100 }, area, limits, 0)).toEqual({ min: 0.2, max: 2 });
  });
});

describe("keepRect", () => {
  const area = { x: 0, y: 0, w: 800, h: 600 };
  const rect = { x: 0, y: 0, w: 400, h: 300 };

  it("gives the same view when a part of the rectangle is in the area", () => {
    const view = { x: 700, y: -200, k: 1 };
    expect(keepRect(view, rect, area)).toBe(view);
    expect(keepRect(UNIT_VIEW, rect, area)).toBe(UNIT_VIEW);
  });

  it("stops a rectangle that goes out of the area at the right and the bottom", () => {
    expect(keepRect({ x: 2000, y: 0, k: 1 }, rect, area)).toEqual({ x: 800 - KEEP_IN_VIEW, y: 0, k: 1 });
    expect(keepRect({ x: 100, y: 5000, k: 1 }, rect, area)).toEqual({ x: 100, y: 600 - KEEP_IN_VIEW, k: 1 });
  });

  it("stops a rectangle that goes out of the area at the left and the top", () => {
    expect(keepRect({ x: -2000, y: -2000, k: 1 }, rect, area)).toEqual({ x: KEEP_IN_VIEW - 400, y: KEEP_IN_VIEW - 300, k: 1 });
    expect(keepRect({ x: -2000, y: -2000, k: 2 }, rect, area)).toEqual({ x: KEEP_IN_VIEW - 800, y: KEEP_IN_VIEW - 600, k: 2 });
  });

  it("uses the free area, not the full picture", () => {
    const free = { x: 244, y: 58, w: 500, h: 400 };
    expect(keepRect({ x: 0, y: 0, k: 1 }, { x: -1000, y: -1000, w: 100, h: 100 }, free)).toEqual({ x: 1244 + KEEP_IN_VIEW - 100, y: 1058 + KEEP_IN_VIEW - 100, k: 1 });
  });

  it("keeps a rectangle that is smaller than the length fully in the area", () => {
    const small = { x: 0, y: 0, w: 20, h: 10 };
    expect(keepRect({ x: 900, y: 900, k: 1 }, small, area)).toEqual({ x: 780, y: 590, k: 1 });
    expect(keepRect({ x: -50, y: -50, k: 1 }, small, area)).toEqual({ x: 0, y: 0, k: 1 });
    expect(keepRect({ x: 300, y: 300, k: 1 }, small, area)).toEqual({ x: 300, y: 300, k: 1 });
  });

  it("lets a rectangle touch the area from the outside with a length of 0", () => {
    expect(keepRect({ x: 2000, y: -2000, k: 1 }, rect, area, 0)).toEqual({ x: 800, y: -300, k: 1 });
  });

  it("keeps the length in the area for each view, changes no zoom, and changes no view a second time", () => {
    const size = fc.double({ min: 0, max: 3000, noNaN: true });
    const rects = fc.record({ x: coordinate, y: coordinate, w: size, h: size });
    const areas = fc.record({ x: fc.double({ min: 0, max: 300, noNaN: true }), y: fc.double({ min: 0, max: 300, noNaN: true }), w: fc.double({ min: 80, max: 2000, noNaN: true }), h: fc.double({ min: 80, max: 2000, noNaN: true }) });
    const overlap = (start: number, length: number, from: number, across: number): number => Math.min(start + length, from + across) - Math.max(start, from);
    fc.assert(
      fc.property(anyView, rects, areas, fc.double({ min: 0, max: 200, noNaN: true }), (view, of, into, least) => {
        const kept = keepRect(view, of, into, least);
        expect(kept.k).toBe(view.k);
        const shown = rectToScreen(kept, of);
        expect(overlap(shown.x, shown.w, into.x, into.w)).toBeGreaterThanOrEqual(Math.min(least, shown.w, into.w) - 1e-6);
        expect(overlap(shown.y, shown.h, into.y, into.h)).toBeGreaterThanOrEqual(Math.min(least, shown.h, into.h) - 1e-6);
        const again = keepRect(kept, of, into, least);
        expect(again.x).toBeCloseTo(kept.x, 6);
        expect(again.y).toBeCloseTo(kept.y, 6);
      }),
    );
  });
});

describe("sameView", () => {
  it("tells if two views are equal by their values", () => {
    expect(sameView({ x: 1, y: 2, k: 3 }, { x: 1, y: 2, k: 3 })).toBe(true);
    expect(sameView(UNIT_VIEW, { x: 0, y: 0, k: 1.5 })).toBe(false);
    expect(sameView(UNIT_VIEW, { x: 0, y: 1, k: 1 })).toBe(false);
    expect(sameView(UNIT_VIEW, { x: 1, y: 0, k: 1 })).toBe(false);
  });
});

describe("frameRects", () => {
  const area = { x: 0, y: 0, w: 1000, h: 800 };
  const options = { least: 0.7, most: 1, padding: 36 };

  it("takes the first rectangle that the area shows at the least zoom or more", () => {
    const all = { x: 0, y: 0, w: 4000, h: 3000 };
    const group = { x: 0, y: 0, w: 1200, h: 600 };
    const box = { x: 100, y: 100, w: 300, h: 200 };
    expect(frameRects([all, group, box], area, options)).toEqual(fitRect(group, area, options));
    expect(frameRects([all, group, box], area, options)?.k).toBeCloseTo(928 / 1200, 12);
    expect(frameRects([box, group], area, options)).toEqual(fitRect(box, area, options));
  });

  it("shows the middle of the last rectangle at the least zoom when no rectangle is small enough", () => {
    const view = frameRects([{ x: 0, y: 0, w: 4000, h: 3000 }, { x: 0, y: 0, w: 2000, h: 2000 }], area, options);
    expect(view).toEqual({ x: 500 - 1000 * 0.7, y: 400 - 1000 * 0.7, k: 0.7 });
  });

  it("gives no view for an empty list", () => {
    expect(frameRects([], area, options)).toBeUndefined();
  });

  it("never gives a zoom below the least zoom", () => {
    const size = fc.double({ min: 0, max: 20_000, noNaN: true });
    const rects = fc.array(fc.record({ x: coordinate, y: coordinate, w: size, h: size }), { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(rects, fc.double({ min: 0.1, max: 1, noNaN: true }), (list, least) => {
        const view = frameRects(list, area, { least });
        expect(view?.k).toBeGreaterThanOrEqual(least);
      }),
    );
  });
});

describe("showsRect", () => {
  const area = { x: 100, y: 0, w: 400, h: 300 };
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it("tells if all of a rectangle is in the area", () => {
    expect(showsRect({ x: 150, y: 50, k: 1 }, rect, area)).toBe(true);
    expect(showsRect({ x: 50, y: 50, k: 1 }, rect, area)).toBe(false);
    expect(showsRect({ x: 150, y: 50, k: 4 }, rect, area)).toBe(false);
    expect(showsRect({ x: 150, y: 250, k: 1 }, rect, area)).toBe(false);
  });

  it("keeps a margin to each edge of the area", () => {
    expect(showsRect({ x: 104, y: 50, k: 1 }, rect, area)).toBe(true);
    expect(showsRect({ x: 104, y: 50, k: 1 }, rect, area, 8)).toBe(false);
    expect(showsRect({ x: 108, y: 50, k: 1 }, rect, area, 8)).toBe(true);
  });
});

describe("revealRects", () => {
  const area = { x: 0, y: 0, w: 1000, h: 800 };
  const options = { least: 0.7, most: 1, padding: 36, margin: 8 };
  const all = { x: 0, y: 0, w: 4000, h: 3000 };
  const group = { x: 0, y: 0, w: 1200, h: 600 };
  const box = { x: 100, y: 100, w: 300, h: 200 };

  it("keeps a view that shows the selection at the least zoom or more", () => {
    const view: PictureView = { x: 100, y: 100, k: 1 };
    expect(revealRects(view, [box], area, options)).toBe(view);
    const onGroup = fitRect(group, area, options);
    expect(revealRects(onGroup, [all, group, box], area, options)).toBe(onGroup);
  });

  it("moves to the selection when a part of it is out of the area", () => {
    expect(revealRects({ x: -300, y: 100, k: 1 }, [box], area, options)).toEqual(fitRect(box, area, options));
    // The view shows the box, and the first group that the area can show is larger.
    expect(revealRects({ x: 100, y: 100, k: 1 }, [all, group, box], area, options)).toEqual(fitRect(group, area, options));
  });

  it("moves to the selection when the zoom is too small to read it", () => {
    expect(revealRects({ x: 100, y: 100, k: 0.5 }, [box], area, options)).toEqual(fitRect(box, area, options));
  });

  it("keeps a margin to each edge of the area", () => {
    const view: PictureView = { x: -96, y: 100, k: 1 };
    expect(revealRects(view, [box], area, { ...options, margin: 0 })).toBe(view);
    expect(revealRects(view, [box], area, options)).toEqual(fitRect(box, area, options));
  });

  it("gives the view of frameRects when no rectangle is small enough", () => {
    const large = [all, { x: 0, y: 0, w: 2000, h: 2000 }];
    expect(revealRects({ x: 100, y: 100, k: 1 }, large, area, options)).toEqual({ x: 500 - 1000 * 0.7, y: 400 - 1000 * 0.7, k: 0.7 });
    expect(revealRects({ x: 100, y: 100, k: 1 }, large, area, options)).toEqual(frameRects(large, area, options));
  });

  it("keeps the view for an empty list", () => {
    const view: PictureView = { x: 3, y: 4, k: 2 };
    expect(revealRects(view, [], area, options)).toBe(view);
  });

  it("gives a view that shows the first rectangle at the least zoom or more", () => {
    const size = fc.double({ min: 1, max: 600, noNaN: true });
    const rects = fc.array(fc.record({ x: coordinate, y: coordinate, w: size, h: size }), { minLength: 1, maxLength: 4 });
    fc.assert(
      fc.property(anyView, rects, (view, list) => {
        const first = list[0];
        if (first === undefined) return;
        const result = revealRects(view, list, area, { least: 0.7 });
        expect(result.k).toBeGreaterThanOrEqual(0.7);
        expect(showsRect(result, first, area)).toBe(true);
      }),
    );
  });
});

describe("viewBetween", () => {
  const from: PictureView = { x: 0, y: 0, k: 1 };
  const to: PictureView = { x: -300, y: -200, k: 4 };

  it("gives the first view at the start and the second view at the end", () => {
    expect(viewBetween(from, to, 0)).toBe(from);
    expect(viewBetween(from, to, 1)).toBe(to);
    expect(viewBetween(from, to, -2)).toBe(from);
    expect(viewBetween(from, to, 3)).toBe(to);
    expect(viewBetween(from, to, Number.NaN)).toBe(from);
  });

  it("is a zoom at one screen point", () => {
    // The two views show the point (100, 200 / 3) of the picture at the screen point (100, 200 / 3).
    const half = viewBetween(from, to, 0.5);
    expect(half.k).toBeCloseTo(2, 12);
    expect(half.x).toBeCloseTo(-100, 9);
    expect(half.y).toBeCloseTo(-200 / 3, 9);
    expect(toScreen(half, { x: 100, y: 200 / 3 }).x).toBeCloseTo(100, 9);
  });

  it("is a straight move at one speed between two views with one zoom", () => {
    expect(viewBetween({ x: 0, y: 0, k: 2 }, { x: 100, y: -40, k: 2 }, 0.25)).toEqual({ x: 25, y: -10, k: 2 });
  });

  it("is almost a straight move between two views with almost one zoom", () => {
    const near = viewBetween({ x: 0, y: 0, k: 1 }, { x: 1000, y: -400, k: 1 + 1e-12 }, 0.25);
    expect(near.x).toBeCloseTo(250, 6);
    expect(near.y).toBeCloseTo(-100, 6);
  });

  it("goes to the end immediately for a zoom that is not more than 0", () => {
    expect(viewBetween({ x: 0, y: 0, k: 0 }, to, 0.5)).toBe(to);
    expect(viewBetween(from, { x: 0, y: 0, k: Number.NaN }, 0.5)).toEqual({ x: 0, y: 0, k: Number.NaN });
  });

  it("changes the zoom by an equal factor for each equal step", () => {
    fc.assert(
      fc.property(anyView, anyView, anyPart, (first, second, part) => {
        const zoom = viewBetween(first, second, part).k;
        expect(Math.log(zoom)).toBeCloseTo(Math.log(first.k) + (Math.log(second.k) - Math.log(first.k)) * part, 9);
      }),
    );
  });

  it("keeps the screen point of a zoom at each part of the way", () => {
    fc.assert(
      fc.property(anyView, anyPoint, anyFactor, anyPart, (first, at, factor, part) => {
        const second = zoomView(first, at, factor, WIDE);
        const before = toPicture(first, at);
        const during = toPicture(viewBetween(first, second, part), at);
        expect(during.x).toBeCloseTo(before.x, 5);
        expect(during.y).toBeCloseTo(before.y, 5);
      }),
    );
  });

  it("moves each point of the picture along a straight line of the screen, in one direction", () => {
    fc.assert(
      fc.property(anyView, anyView, anyPoint, fc.tuple(anyPart, anyPart, anyPart), (first, second, point, parts) => {
        const [a, b, c] = [...parts].sort((left, right) => left - right).map((part) => toScreen(viewBetween(first, second, part), point)) as [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ];
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const bc = { x: c.x - b.x, y: c.y - b.y };
        const scale = Math.hypot(ab.x, ab.y) * Math.hypot(bc.x, bc.y) + 1;
        expect(Math.abs(ab.x * bc.y - ab.y * bc.x) / scale).toBeLessThan(1e-6);
        expect((ab.x * bc.x + ab.y * bc.y) / scale).toBeGreaterThan(-1e-6);
      }),
    );
  });
});

describe("pictureMoveAt", () => {
  const from: PictureView = { x: 0, y: 0, k: 1 };
  const to: PictureView = { x: -300, y: -200, k: 4 };
  const move: PictureMove = { from, to, start: 1000, duration: 400 };

  it("gives the first view at the start and before it", () => {
    expect(pictureMoveAt(move, 1000)).toEqual({ view: from, done: false });
    expect(pictureMoveAt(move, 0)).toEqual({ view: from, done: false });
  });

  it("gives the second view at the end and after it, and tells that the move is done", () => {
    expect(pictureMoveAt(move, 1400)).toEqual({ view: to, done: true });
    expect(pictureMoveAt(move, 99_999)).toEqual({ view: to, done: true });
  });

  it("is at the middle of the way at the middle of the time", () => {
    const { view, done } = pictureMoveAt(move, 1200);
    expect(done).toBe(false);
    expect(view.k).toBeCloseTo(2, 12);
    expect(view.x).toBeCloseTo(-100, 9);
  });

  it("starts slowly", () => {
    // After a tenth of the time, the move went less than a tenth of the way: the zoom is below 4 ** 0.1.
    expect(pictureMoveAt(move, 1040).view.k).toBeLessThan(4 ** 0.1);
    expect(pictureMoveAt(move, 1040).view.k).toBeGreaterThan(1);
  });

  it("is at its end immediately when it has no duration", () => {
    expect(pictureMoveAt({ from, to, start: 1000, duration: 0 }, 0)).toEqual({ view: to, done: true });
    expect(pictureMoveAt({ from, to, start: 1000, duration: Number.NaN }, 1000)).toEqual({ view: to, done: true });
  });
});
