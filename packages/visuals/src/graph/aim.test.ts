import { describe, expect, it } from "vitest";
import { aimAll, aimRects, aimReveal, type AimFrame } from "./aim.ts";
import { UNIT_VIEW, ZOOM_LIMITS, fitRect, rectToScreen, showsRect, zoomLimitsFor } from "./camera.ts";

const area = { x: 200, y: 50, w: 800, h: 600 };
const frame: AimFrame = { bounds: { x: 0, y: 0, w: 1504, h: 100 }, area, view: UNIT_VIEW, limits: ZOOM_LIMITS };

/** The bounds of a large group, then of a small group in it. */
const large = { x: 0, y: 0, w: 4000, h: 3000 };
const small = { x: 100, y: 100, w: 400, h: 300 };

describe("aimAll", () => {
  it("shows all of the picture in the free area", () => {
    const view = aimAll()(frame);
    expect(view).toEqual(fitRect(frame.bounds, area));
    expect(rectToScreen(view, frame.bounds)).toEqual({ x: 224, y: 325, w: 752, h: 50 });
  });

  it("uses the limits of the frame, so a very large picture shows fully", () => {
    const bounds = { x: 0, y: 0, w: 1_000_000, h: 100 };
    const limits = zoomLimitsFor(bounds, area);
    const view = aimAll()({ ...frame, bounds, limits });
    expect(view.k).toBe(limits.min);
    expect(showsRect(view, bounds, area)).toBe(true);
  });

  it("uses the options before the limits of the frame", () => {
    expect(aimAll({ limits: { min: 0.75, max: 2 } })(frame).k).toBe(0.75);
    expect(aimAll({ most: 1 })({ ...frame, bounds: small }).k).toBe(1);
    expect(aimAll({ padding: 0 })(frame).k).toBeCloseTo(800 / 1504, 12);
  });
});

describe("aimRects", () => {
  it("shows the first group that a person reads", () => {
    const view = aimRects([large, small], { least: 0.5 })(frame);
    expect(view).toEqual(fitRect(small, area));
    expect(view.k).toBeCloseTo(1.84, 12);
  });

  it("shows the largest group when a person reads it", () => {
    expect(aimRects([large, small], { least: 0.1 })(frame)).toEqual(fitRect(large, area));
  });

  it("keeps the view for an empty list", () => {
    expect(aimRects([], { least: 0.5 })(frame)).toBe(frame.view);
  });

  it("uses the limits of the frame", () => {
    expect(aimRects([small], { least: 0.5 })({ ...frame, limits: { min: 0.01, max: 1.5 } }).k).toBe(1.5);
    expect(aimRects([small], { least: 0.5, limits: { min: 0.01, max: 1.25 } })({ ...frame, limits: { min: 0.01, max: 1.5 } }).k).toBe(1.25);
  });
});

describe("aimReveal", () => {
  it("keeps the view when the selection is in view", () => {
    const view = { x: 300, y: 100, k: 1 };
    expect(aimReveal([small], { least: 0.5 })({ ...frame, view })).toBe(view);
  });

  it("moves to the selection when a part of it is out of view", () => {
    expect(aimReveal([small], { least: 0.5 })(frame)).toEqual(fitRect(small, area));
  });

  it("moves to the selection when the zoom is too small to read", () => {
    const view = { x: 500, y: 300, k: 0.25 };
    expect(showsRect(view, small, area)).toBe(true);
    expect(aimReveal([small], { least: 0.5 })({ ...frame, view })).toEqual(fitRect(small, area));
  });

  it("uses the margin of the options", () => {
    const view = { x: 110, y: 100, k: 1 };
    expect(aimReveal([small], { least: 0.5 })({ ...frame, view })).toBe(view);
    expect(aimReveal([small], { least: 0.5, margin: 24 })({ ...frame, view })).toEqual(fitRect(small, area));
  });

  it("keeps the view for an empty list", () => {
    expect(aimReveal([], { least: 0.5 })(frame)).toBe(frame.view);
  });
});
