import type { Point3 } from "@mark1russell7/layout-contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cameraPosition, capDistance, clampPlace, fitDistance, placeBetween, speedAt, turnBetween, viewAxes, viewOf, type Place, type PlaceLimits, type ViewAngles } from "./view.ts";

const dot = (a: Point3, b: Point3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point3, b: Point3): Point3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const minus = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const close = (point: Point3): unknown => ({ x: expect.closeTo(point.x, 9), y: expect.closeTo(point.y, 9), z: expect.closeTo(point.z, 9) });

const TOP: ViewAngles = { polar: 0, azimuth: 0 };
const SIDE: ViewAngles = { polar: (52 * Math.PI) / 180, azimuth: (35 * Math.PI) / 180 };

const coordinate = fc.double({ min: -50, max: 50, noNaN: true });
const anyPoint = fc.record({ x: coordinate, y: coordinate, z: coordinate });
const anyView: fc.Arbitrary<ViewAngles> = fc.record({
  polar: fc.double({ min: 0.01, max: Math.PI - 0.01, noNaN: true }),
  azimuth: fc.double({ min: -3.14, max: 3.14, noNaN: true }),
});
const anyPlace: fc.Arbitrary<Place> = fc.record({
  target: anyPoint,
  polar: fc.double({ min: 0.01, max: Math.PI - 0.01, noNaN: true }),
  azimuth: fc.double({ min: -3.14, max: 3.14, noNaN: true }),
  distance: fc.double({ min: 0.1, max: 200, noNaN: true }),
});
const anyPart = fc.double({ min: 0, max: 1, noNaN: true });
const anyFov = fc.double({ min: 10, max: 100, noNaN: true });
const anyAspect = fc.double({ min: 0.3, max: 3, noNaN: true });

describe("viewAxes", () => {
  it("gives three unit vectors at right angles, with the right side, the top and the back in the sequence of a right hand", () => {
    fc.assert(
      fc.property(anyView, (view) => {
        const { back, right, up } = viewAxes(view);
        for (const axis of [back, right, up]) expect(dot(axis, axis)).toBeCloseTo(1, 9);
        expect(dot(back, right)).toBeCloseTo(0, 9);
        expect(dot(back, up)).toBeCloseTo(0, 9);
        expect(dot(right, up)).toBeCloseTo(0, 9);
        expect(cross(right, up)).toEqual(close(back));
      }),
    );
  });

  it("puts the negative z axis at the top of the view from above, and the x axis at its right side", () => {
    const { back, right, up } = viewAxes(TOP);
    expect(back).toEqual(close({ x: 0, y: 1, z: 0 }));
    expect(up).toEqual(close({ x: 0, y: 0, z: -1 }));
    expect(right).toEqual(close({ x: 1, y: 0, z: 0 }));
  });

  it("puts a camera with the azimuth 0 on the positive z side of the target", () => {
    expect(viewAxes({ polar: Math.PI / 2, azimuth: 0 }).back).toEqual(close({ x: 0, y: 0, z: 1 }));
    expect(viewAxes({ polar: Math.PI / 2, azimuth: Math.PI / 2 }).back).toEqual(close({ x: 1, y: 0, z: 0 }));
  });
});

describe("fitDistance", () => {
  it("gives the distance at which the widest side of a plan fills the picture", () => {
    const corners = [
      { x: -2, y: 0, z: -1 },
      { x: 2, y: 0, z: -1 },
      { x: 2, y: 0, z: 1 },
      { x: -2, y: 0, z: 1 },
    ];
    const origin = { x: 0, y: 0, z: 0 };
    // At 90 degrees, the picture shows as much above its center as the distance. The depth is the limit for a square picture.
    expect(fitDistance(corners, origin, TOP, 90, 1)).toBeCloseTo(2, 9);
    expect(fitDistance(corners, origin, TOP, 90, 2)).toBeCloseTo(1, 9);
    expect(fitDistance(corners, origin, TOP, 90, 4)).toBeCloseTo(1, 9);
  });

  it("adds the height of a point above the target", () => {
    expect(fitDistance([{ x: 1, y: 3, z: 0 }], { x: 0, y: 0, z: 0 }, TOP, 90, 1)).toBeCloseTo(4, 9);
  });

  it("gives a camera that shows each point, with one point on an edge of the picture", () => {
    fc.assert(
      fc.property(fc.array(anyPoint, { minLength: 1, maxLength: 12 }), anyPoint, anyView, anyFov, anyAspect, (points, target, view, fov, aspect) => {
        const distance = fitDistance(points, target, view, fov, aspect);
        fc.pre(distance > 1e-6);
        const axes = viewAxes(view);
        const camera = cameraPosition(target, view, distance);
        const tanUp = Math.tan((fov * Math.PI) / 360);
        let fullest = Number.NEGATIVE_INFINITY;
        for (const point of points) {
          const from = minus(point, camera);
          const depth = 0 - dot(from, axes.back);
          expect(depth).toBeGreaterThan(-1e-9);
          const reach = Math.max(Math.abs(dot(from, axes.right)) / (tanUp * aspect), Math.abs(dot(from, axes.up)) / tanUp);
          expect(reach).toBeLessThanOrEqual(depth + 1e-9);
          fullest = Math.max(fullest, reach - depth);
        }
        expect(fullest).toBeCloseTo(0, 6);
      }),
    );
  });

  it("gives 0 for no points, and for an angle or an aspect that makes no picture", () => {
    const origin = { x: 0, y: 0, z: 0 };
    const point = [{ x: 1, y: 1, z: 1 }];
    expect(fitDistance([], origin, SIDE, 32, 1.5)).toBe(0);
    expect(fitDistance(point, origin, SIDE, 0, 1.5)).toBe(0);
    expect(fitDistance(point, origin, SIDE, 32, 0)).toBe(0);
    expect(fitDistance(point, origin, SIDE, Number.NaN, 1.5)).toBe(0);
    expect(fitDistance(point, origin, SIDE, 32, Infinity)).toBe(0);
  });
});

describe("capDistance", () => {
  it("gives the distance at which the outline of the ball fills the picture, for a cap of half of the ball", () => {
    // At 90 degrees, the picture shows 45 degrees to each side. The line that touches the ball makes a square with its radius.
    expect(capDistance(1, Math.PI / 2, 90, 1)).toBeCloseTo(Math.SQRT2, 9);
    expect(capDistance(3, Math.PI / 2, 90, 1)).toBeCloseTo(3 * Math.SQRT2, 9);
    expect(capDistance(1, Math.PI, 90, 1)).toBeCloseTo(Math.SQRT2, 9);
  });

  it("uses the smaller side of the picture", () => {
    expect(capDistance(1, 0.2, 90, 0.5)).toBeGreaterThan(capDistance(1, 0.2, 90, 1));
    expect(capDistance(1, 0.2, 90, 4)).toBeCloseTo(capDistance(1, 0.2, 90, 1), 12);
  });

  it("gives a camera on the ball for a cap with no size", () => {
    expect(capDistance(2, 0, 40, 1.5)).toBeCloseTo(2, 12);
    expect(capDistance(2, -1, 40, 1.5)).toBeCloseTo(2, 12);
  });

  it("puts the edge of a small cap on the edge of the picture, in front of the outline of the ball", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 50, noNaN: true }), fc.double({ min: 0.01, max: 0.999, noNaN: true }), anyFov, anyAspect, (radius, part, fov, aspect) => {
        const tan = Math.tan((fov * Math.PI) / 360) * Math.min(aspect, 1);
        const half = Math.atan(tan);
        const angle = part * (Math.PI / 2 - half);
        const distance = capDistance(radius, angle, fov, aspect);
        // The edge of the cap is a circle at the depth r cos(a) from the center, with the radius r sin(a).
        expect((radius * Math.sin(angle)) / (distance - radius * Math.cos(angle))).toBeCloseTo(tan, 6);
        // The camera sees the edge: the edge is nearer to the camera than the points where its lines touch the ball.
        expect(radius * Math.cos(angle)).toBeGreaterThanOrEqual((radius * radius) / distance - 1e-9);
      }),
    );
  });

  it("gives a larger distance for a larger cap, to the distance that shows all of the ball", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 50, noNaN: true }), anyPart, anyPart, anyFov, anyAspect, (radius, first, second, fov, aspect) => {
        const small = (Math.min(first, second) * Math.PI) / 2;
        const large = (Math.max(first, second) * Math.PI) / 2;
        const all = capDistance(radius, Math.PI / 2, fov, aspect);
        expect(capDistance(radius, small, fov, aspect)).toBeLessThanOrEqual(capDistance(radius, large, fov, aspect) + 1e-9);
        expect(capDistance(radius, large, fov, aspect)).toBeLessThanOrEqual(all + 1e-9);
        expect(capDistance(radius, small, fov, aspect)).toBeGreaterThanOrEqual(radius - 1e-9);
      }),
    );
  });

  it("gives 0 for a ball with no size, and for an angle or an aspect that makes no picture", () => {
    expect(capDistance(0, 0.3, 32, 1.5)).toBe(0);
    expect(capDistance(-1, 0.3, 32, 1.5)).toBe(0);
    expect(capDistance(1, 0.3, 0, 1.5)).toBe(0);
    expect(capDistance(1, 0.3, 32, 0)).toBe(0);
    expect(capDistance(1, 0.3, Number.NaN, 1.5)).toBe(0);
    expect(capDistance(Number.NaN, 0.3, 32, 1.5)).toBe(0);
  });
});

describe("viewOf", () => {
  it("gives the view and the distance of a camera from cameraPosition", () => {
    fc.assert(
      fc.property(anyPoint, anyView, fc.double({ min: 0.1, max: 200, noNaN: true }), (target, view, distance) => {
        const found = viewOf(cameraPosition(target, view, distance), target);
        expect(found.polar).toBeCloseTo(view.polar, 6);
        expect(turnBetween(found.azimuth, view.azimuth)).toBeCloseTo(0, 6);
        expect(found.distance).toBeCloseTo(distance, 6);
      }),
    );
  });

  it("gives the angles 0 for a camera at the target", () => {
    expect(viewOf({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toEqual({ polar: 0, azimuth: 0, distance: 0 });
  });
});

describe("turnBetween", () => {
  it("gives the shortest turn", () => {
    expect(turnBetween(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 12);
    expect(turnBetween(0, (3 * Math.PI) / 2)).toBeCloseTo(0 - Math.PI / 2, 12);
    expect(turnBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6, 12);
    expect(turnBetween(1, 1 + 4 * Math.PI)).toBeCloseTo(0, 12);
  });

  it("gives a turn of half a circle at most, that goes from the first angle to the second", () => {
    fc.assert(
      fc.property(fc.double({ min: -20, max: 20, noNaN: true }), fc.double({ min: -20, max: 20, noNaN: true }), (from, to) => {
        const turn = turnBetween(from, to);
        expect(Math.abs(turn)).toBeLessThanOrEqual(Math.PI + 1e-12);
        expect(Math.cos(from + turn)).toBeCloseTo(Math.cos(to), 9);
        expect(Math.sin(from + turn)).toBeCloseTo(Math.sin(to), 9);
      }),
    );
  });
});

describe("clampPlace", () => {
  const limits: PlaceLimits = { minPolar: 0.2, maxPolar: 1.4, minDistance: 2, maxDistance: 40 };

  it("gives a place in the limits, and changes no place that is in them", () => {
    fc.assert(
      fc.property(anyPlace, (place) => {
        const clamped = clampPlace(place, limits);
        expect(clamped.polar).toBeGreaterThanOrEqual(limits.minPolar);
        expect(clamped.polar).toBeLessThanOrEqual(limits.maxPolar);
        expect(clamped.distance).toBeGreaterThanOrEqual(limits.minDistance);
        expect(clamped.distance).toBeLessThanOrEqual(limits.maxDistance);
        expect(clamped.target).toBe(place.target);
        expect(clamped.azimuth).toBe(place.azimuth);
        expect(clampPlace(clamped, limits)).toEqual(clamped);
      }),
    );
  });

  it("moves a place to the nearest limit", () => {
    const target = { x: 0, y: 0, z: 0 };
    expect(clampPlace({ target, polar: 0, azimuth: 1, distance: 1 }, limits)).toEqual({ target, polar: 0.2, azimuth: 1, distance: 2 });
    expect(clampPlace({ target, polar: 3, azimuth: 1, distance: 100 }, limits)).toEqual({ target, polar: 1.4, azimuth: 1, distance: 40 });
  });
});

describe("speedAt", () => {
  it("gives 1 for a stage with no ball", () => {
    expect(speedAt(5, 0)).toBe(1);
    expect(speedAt(0.001, 0)).toBe(1);
  });

  it("gives the height above the ball as a part of the distance", () => {
    expect(speedAt(2, 1)).toBeCloseTo(0.5, 12);
    expect(speedAt(10, 1)).toBeCloseTo(0.9, 12);
    expect(speedAt(1.1, 1)).toBeCloseTo(0.1 / 1.1, 12);
  });

  it("gives 0.02 at least, so a camera on the ball or in it can move", () => {
    expect(speedAt(1, 1)).toBe(0.02);
    expect(speedAt(0.5, 1)).toBe(0.02);
    expect(speedAt(1.001, 1)).toBe(0.02);
  });

  it("gives 1 for a distance of 0", () => {
    expect(speedAt(0, 0)).toBe(1);
    expect(speedAt(Number.NaN, 1)).toBe(1);
  });

  it("gives a factor from 0.02 to 1", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (distance, surface) => {
        const speed = speedAt(distance, surface);
        expect(speed).toBeGreaterThanOrEqual(0.02);
        expect(speed).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("placeBetween", () => {
  it("gives the first place at 0 and the second place at 1", () => {
    fc.assert(
      fc.property(anyPlace, anyPlace, fc.constantFrom(0, 0.05), (from, to, surface) => {
        const start = placeBetween(from, to, 0, surface);
        const end = placeBetween(from, to, 1, surface);
        expect(start.target).toEqual(close(from.target));
        expect(start.polar).toBeCloseTo(from.polar, 9);
        expect(start.azimuth).toBeCloseTo(from.azimuth, 9);
        expect(start.distance).toBeCloseTo(from.distance, 9);
        expect(end.target).toEqual(close(to.target));
        expect(end.polar).toBeCloseTo(to.polar, 9);
        expect(turnBetween(end.azimuth, to.azimuth)).toBeCloseTo(0, 9);
        expect(end.distance).toBeCloseTo(to.distance, 6);
      }),
    );
  });

  it("turns along the shortest way", () => {
    const target = { x: 0, y: 0, z: 0 };
    const from: Place = { target, polar: 1, azimuth: 3, distance: 5 };
    const to: Place = { target, polar: 1, azimuth: -3, distance: 5 };
    // The short way from 3 to -3 goes through π, not through 0.
    expect(placeBetween(from, to, 0.5).azimuth).toBeCloseTo(Math.PI, 9);
  });

  it("changes the height above the surface by an equal factor for each equal step", () => {
    const target = { x: 0, y: 0, z: 0 };
    const from: Place = { target, polar: 1, azimuth: 0, distance: 101 };
    const to: Place = { target, polar: 1, azimuth: 0, distance: 2 };
    // The heights above a ball of radius 1 are 100 and 1. The middle of the way is at the height 10.
    expect(placeBetween(from, to, 0.5, 1).distance).toBeCloseTo(11, 9);
    expect(placeBetween(from, to, 0.25, 1).distance).toBeCloseTo(1 + 10 ** 1.5, 9);
    // With no ball, the distances are the heights.
    expect(placeBetween({ ...from, distance: 100 }, { ...to, distance: 1 }, 0.5).distance).toBeCloseTo(10, 9);
  });

  it("keeps the distance between the two distances", () => {
    fc.assert(
      fc.property(anyPlace, anyPlace, anyPart, fc.constantFrom(0, 0.05, 1), (from, to, part, surface) => {
        const { distance } = placeBetween(from, to, part, surface);
        expect(distance).toBeGreaterThanOrEqual(Math.min(from.distance, to.distance) - 1e-9);
        expect(distance).toBeLessThanOrEqual(Math.max(from.distance, to.distance) + 1e-9);
      }),
    );
  });

  it("goes in a line for a place on the surface or in the ball", () => {
    const target = { x: 0, y: 0, z: 0 };
    const from: Place = { target, polar: 1, azimuth: 0, distance: 1 };
    const to: Place = { target, polar: 1, azimuth: 0, distance: 3 };
    expect(placeBetween(from, to, 0.5, 1).distance).toBeCloseTo(2, 12);
    expect(placeBetween({ ...from, distance: 0.5 }, to, 0.5, 1).distance).toBeCloseTo(1.75, 12);
  });
});
