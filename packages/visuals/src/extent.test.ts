import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { capView, FIT_MARGIN, fitView, stageLimits, surfaceOf, type StageExtent, type ViewFrame } from "./extent.ts";
import { capDistance, fitDistance, type ViewAngles } from "./view.ts";

const origin = { x: 0, y: 0, z: 0 };
const TOP: ViewAngles = { polar: 0, azimuth: 0 };
const SIDE: ViewAngles = { polar: 0.9, azimuth: 0.6 };
const POLAR = { min: 0.0005, max: 1.5 };

/** The corners of a box of 4 by 2 by 6 with its center at the origin. */
const box: StageExtent = {
  center: origin,
  corners: [-2, 2].flatMap((x) => [-1, 1].flatMap((y) => [-3, 3].map((z) => ({ x, y, z })))),
};
/** A ball of radius 5 around the origin. */
const ball: StageExtent = { center: origin, corners: [], surface: 5 };

const frameOf = (extent: StageExtent, aspect: number = 1.5, fieldOfView: number = 32): ViewFrame => ({ extent, fieldOfView, aspect });

describe("surfaceOf", () => {
  it("gives the radius of the ball of an extent, and 0 for no ball", () => {
    expect(surfaceOf(ball)).toBe(5);
    expect(surfaceOf(box)).toBe(0);
    expect(surfaceOf({ ...box, surface: -3 })).toBe(0);
    expect(surfaceOf({ ...box, surface: Number.NaN })).toBe(0);
  });
});

describe("fitView", () => {
  it("looks at the center from the direction of the angles, at the distance that shows each corner with a margin", () => {
    const place = fitView(SIDE)(frameOf(box));
    expect(place.target).toBe(origin);
    expect(place.polar).toBe(SIDE.polar);
    expect(place.azimuth).toBe(SIDE.azimuth);
    expect(place.distance).toBeCloseTo(fitDistance(box.corners, origin, SIDE, 32, 1.5) * FIT_MARGIN, 12);
  });

  it("uses the margin that it gets", () => {
    expect(fitView(TOP, 2)(frameOf(box)).distance).toBeCloseTo(fitDistance(box.corners, origin, TOP, 32, 1.5) * 2, 12);
  });

  it("gives a larger distance for a narrow picture", () => {
    expect(fitView(SIDE)(frameOf(box, 0.5)).distance).toBeGreaterThan(fitView(SIDE)(frameOf(box, 1.5)).distance);
  });

  it("gives the distance 1 for an extent with no corners", () => {
    expect(fitView(SIDE)(frameOf({ center: origin, corners: [] })).distance).toBe(1);
  });
});

describe("capView", () => {
  it("shows a cap of the ball, with a margin on the height above the ball", () => {
    const place = capView(SIDE, 0.3)(frameOf(ball));
    const height = capDistance(5, 0.3, 32, 1.5) - 5;
    expect(place.target).toBe(origin);
    expect(place.polar).toBe(SIDE.polar);
    expect(place.azimuth).toBe(SIDE.azimuth);
    expect(place.distance).toBeCloseTo(5 + height * FIT_MARGIN, 12);
  });

  it("shows all of the ball for a cap of half of it", () => {
    // In a wide picture of 32 degrees, the outline of the ball fills the height at the distance r / sin(16°).
    const all = 5 / Math.sin((16 * Math.PI) / 180);
    expect(capView(TOP, Math.PI / 2, 1)(frameOf(ball)).distance).toBeCloseTo(all, 9);
  });

  it("puts the camera on the ball for a cap with no size, and not in the ball", () => {
    expect(capView(TOP, 0)(frameOf(ball)).distance).toBe(5);
    expect(capView(TOP, -2)(frameOf(ball)).distance).toBe(5);
  });

  it("gives the distance 1 for an extent with no ball", () => {
    expect(capView(TOP, 0.3)(frameOf(box)).distance).toBe(1);
  });
});

describe("stageLimits", () => {
  it("takes the distances from the largest view of the stage", () => {
    const frame = frameOf(box);
    const top = fitView(TOP)(frame).distance;
    const side = fitView(SIDE)(frame).distance;
    const widest = Math.max(top, side);
    const limits = stageLimits(frame, [fitView(TOP), fitView(SIDE)], POLAR);
    expect(limits.minDistance).toBeCloseTo(widest * 0.03, 12);
    expect(limits.maxDistance).toBeCloseTo(widest * 3, 12);
    expect(limits.minPolar).toBe(POLAR.min);
    expect(limits.maxPolar).toBe(POLAR.max);
  });

  it("measures the distances of a ball from its surface", () => {
    const frame = frameOf(ball);
    const all = capView(TOP, Math.PI / 2)(frame).distance;
    const limits = stageLimits(frame, [capView(TOP, Math.PI / 2), capView(TOP, 0.1)], POLAR);
    expect(limits.minDistance).toBeCloseTo(5 + (all - 5) * 0.03, 12);
    expect(limits.maxDistance).toBeCloseTo(5 + (all - 5) * 3, 12);
    expect(limits.minDistance).toBeGreaterThan(5);
  });

  it("uses the distances of the extent", () => {
    const limits = stageLimits(frameOf({ ...box, minDistance: 0.4, maxDistance: 90 }), [fitView(SIDE)], POLAR);
    expect(limits.minDistance).toBe(0.4);
    expect(limits.maxDistance).toBe(90);
  });

  it("keeps the largest distance at the smallest distance or above it", () => {
    const limits = stageLimits(frameOf({ ...box, minDistance: 50, maxDistance: 10 }), [fitView(SIDE)], POLAR);
    expect(limits.minDistance).toBe(50);
    expect(limits.maxDistance).toBe(50);
  });

  it("gives limits for a stage with no views and no corners", () => {
    const limits = stageLimits(frameOf({ center: origin, corners: [] }), [], POLAR);
    expect(limits.minDistance).toBeCloseTo(0.03, 12);
    expect(limits.maxDistance).toBeCloseTo(3, 12);
    expect(limits.near).toBeGreaterThan(0);
    expect(limits.far).toBeGreaterThan(limits.maxDistance);
  });

  it("draws all the content from each place in the limits", () => {
    const anyCoordinate = fc.double({ min: -30, max: 30, noNaN: true });
    const anyPoint = fc.record({ x: anyCoordinate, y: anyCoordinate, z: anyCoordinate });
    fc.assert(
      fc.property(fc.array(anyPoint, { minLength: 1, maxLength: 8 }), fc.constantFrom(0, 2, 40), fc.double({ min: 0.3, max: 3, noNaN: true }), (corners, surface, aspect) => {
        const extent: StageExtent = { center: origin, corners, surface };
        const frame = frameOf(extent, aspect);
        const limits = stageLimits(frame, [fitView(SIDE), capView(TOP, Math.PI / 2)], POLAR);
        let reach = surface;
        for (const corner of corners) reach = Math.max(reach, Math.hypot(corner.x, corner.y, corner.z));
        expect(limits.minDistance).toBeGreaterThan(surface);
        expect(limits.maxDistance).toBeGreaterThanOrEqual(limits.minDistance);
        // The nearest depth is in front of the surface for the nearest camera.
        expect(limits.near).toBeGreaterThan(0);
        expect(limits.near).toBeLessThan(limits.minDistance - surface);
        // The farthest depth is behind the farthest point for the farthest camera.
        expect(limits.far).toBeGreaterThan(limits.maxDistance + reach);
      }),
    );
  });
});
