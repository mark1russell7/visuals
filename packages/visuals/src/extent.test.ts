import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ballView, capView, FIT_MARGIN, fitView, nearDepth, reachOf, stageLimits, surfaceOf, type StageExtent, type ViewFrame } from "./extent.ts";
import { cameraPosition, capDistance, fitDistance, type ViewAngles } from "./view.ts";

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

describe("ballView", () => {
  const FRONT: ViewAngles = { polar: Math.PI / 2, azimuth: 0 };
  /** Four points of the ball around the axis z. The angle from the axis to each point is acos(sqrt(23) / 5). */
  const deep = Math.sqrt(23);
  const four = [-1, 1].flatMap((x) => [-1, 1].map((y) => ({ x, y, z: deep })));

  /** The tangent of the half of the vertical angle of the picture of `frameOf`. */
  const tanUp = Math.tan((32 * Math.PI) / 360);

  it("puts the camera above the middle of the points, at the smallest distance that shows each point", () => {
    const place = ballView(four, 1)(frameOf(ball));
    expect(place.target).toBe(origin);
    expect(place.polar).toBeCloseTo(FRONT.polar, 12);
    expect(place.azimuth).toBeCloseTo(FRONT.azimuth, 12);
    // The picture is wider than its height, so the height of the square of the points is the limit.
    expect(place.distance).toBeCloseTo(deep + 1 / tanUp, 9);
    expect(place.distance).toBeGreaterThan(5);
  });

  it("fills a wide picture with wide points", () => {
    /** Four points of the ball: a rectangle of 4 by 2 around the axis z. */
    const far = Math.sqrt(20);
    const wide = [-2, 2].flatMap((x) => [-1, 1].map((y) => ({ x, y, z: far })));
    // A picture with the shape of the rectangle shows it from edge to edge.
    expect(ballView(wide, 1)(frameOf(ball, 2)).distance).toBeCloseTo(far + 1 / tanUp, 9);
    // In a square picture, the width of the rectangle is the limit. In a tall picture, the camera goes farther.
    expect(ballView(wide, 1)(frameOf(ball, 1)).distance).toBeCloseTo(far + 2 / tanUp, 9);
    expect(ballView(wide, 1)(frameOf(ball, 0.5)).distance).toBeCloseTo(far + 4 / tanUp, 9);
    // The view of the cap of the points keeps the space of a circle around them, so its camera is farther.
    const cap = capView(FRONT, Math.acos(far / 5), 1)(frameOf(ball, 2));
    expect(cap.distance).toBeCloseTo(far + Math.sqrt(5) / tanUp, 9);
  });

  it("uses the margin that it gets", () => {
    const near = ballView(four, 1)(frameOf(ball)).distance;
    const far = ballView(four, 2)(frameOf(ball)).distance;
    expect(far - 5).toBeCloseTo((near - 5) * 2, 9);
  });

  it("shows all of the ball from the front for a list with no points", () => {
    expect(ballView([])(frameOf(ball))).toEqual(capView(FRONT, Math.PI / 2)(frameOf(ball)));
  });

  it("shows all of the ball from the front for points with their middle at the center", () => {
    const opposite = [
      { x: 5, y: 0, z: 0 },
      { x: -5, y: 0, z: 0 },
    ];
    expect(ballView(opposite)(frameOf(ball))).toEqual(capView(FRONT, Math.PI / 2)(frameOf(ball)));
    expect(ballView([{ x: Number.NaN, y: 0, z: 0 }])(frameOf(ball))).toEqual(capView(FRONT, Math.PI / 2)(frameOf(ball)));
  });

  it("ignores a point at the center of the ball", () => {
    const place = ballView([...four, { x: 0, y: 0, z: 2 * deep }, origin])(frameOf(ball));
    expect(Number.isFinite(place.distance)).toBe(true);
    expect(place.distance).toBeGreaterThan(5);
  });

  it("measures the points from the center of each extent that it gets", () => {
    const center = { x: 10, y: -4, z: 3 };
    const moved: StageExtent = { center, corners: [], surface: 5 };
    const view = ballView(four.map((point) => ({ x: point.x + center.x, y: point.y + center.y, z: point.z + center.z })));
    const there = view(frameOf(moved));
    expect(there.target).toBe(center);
    expect(there.polar).toBeCloseTo(FRONT.polar, 12);
    expect(there.azimuth).toBeCloseTo(FRONT.azimuth, 12);
    expect(there.distance).toBeCloseTo(ballView(four)(frameOf(ball)).distance, 9);
    // The same view gives a different place for an extent with a different center, and the first place again after it.
    expect(view(frameOf(ball)).azimuth).not.toBeCloseTo(FRONT.azimuth, 3);
    expect(view(frameOf(moved))).toEqual(there);
  });

  it("shows each point of a ball", () => {
    const anyAngle = fc.record({ polar: fc.double({ min: 0.2, max: 2.9, noNaN: true }), azimuth: fc.double({ min: -3, max: 3, noNaN: true }) });
    fc.assert(
      fc.property(fc.array(anyAngle, { minLength: 1, maxLength: 12 }), fc.double({ min: 0.4, max: 2.5, noNaN: true }), (angles, aspect) => {
        const points = angles.map((angle) => cameraPosition(origin, angle, 5));
        const frame = frameOf(ball, aspect);
        const place = ballView(points, 1)(frame);
        // The camera at this distance shows each point, or the point is behind the outline of the ball.
        expect(fitDistance(points, origin, place, frame.fieldOfView, aspect)).toBeLessThanOrEqual(place.distance * (1 + 1e-9));
        expect(place.distance).toBeGreaterThanOrEqual(5);
      }),
    );
  });

  it("is not farther than the view of the cap of the points, and not farther than a view of all of the ball", () => {
    const anyAngle = fc.record({ polar: fc.double({ min: 0.2, max: 2.9, noNaN: true }), azimuth: fc.double({ min: -3, max: 3, noNaN: true }) });
    fc.assert(
      fc.property(fc.array(anyAngle, { minLength: 1, maxLength: 12 }), fc.double({ min: 0.4, max: 2.5, noNaN: true }), (angles, aspect) => {
        const points = angles.map((angle) => cameraPosition(origin, angle, 5));
        const frame = frameOf(ball, aspect);
        const place = ballView(points, 1)(frame);
        // The angle of the cap is the largest angle between the direction of the camera and a point.
        const toward = cameraPosition(origin, place, 1);
        const cosines = points.map((point) => (point.x * toward.x + point.y * toward.y + point.z * toward.z) / 5);
        const angle = Math.max(...cosines.map((cosine) => Math.acos(Math.min(Math.max(cosine, -1), 1))));
        const cap = capView(place, Math.min(angle, Math.PI / 2), 1)(frame);
        expect(place.distance).toBeLessThanOrEqual(cap.distance * (1 + 1e-9));
        expect(place.distance).toBeLessThanOrEqual(capView(place, Math.PI / 2, 1)(frame).distance * (1 + 1e-9));
      }),
    );
  });
});

describe("reachOf", () => {
  it("gives the distance from the center to the farthest corner", () => {
    expect(reachOf(box)).toBeCloseTo(Math.sqrt(14), 12);
    expect(reachOf({ center: { x: 2, y: 1, z: 3 }, corners: box.corners })).toBeCloseTo(Math.sqrt(56), 12);
  });

  it("gives the radius of the ball of an extent whose corners are in the ball", () => {
    expect(reachOf(ball)).toBe(5);
    expect(reachOf({ ...box, surface: 5 })).toBe(5);
    expect(reachOf({ ...box, surface: 2 })).toBeCloseTo(Math.sqrt(14), 12);
  });

  it("gives 0 for an extent with no corners and no ball", () => {
    expect(reachOf({ center: origin, corners: [] })).toBe(0);
  });
});

describe("nearDepth", () => {
  const limits = { minPolar: POLAR.min, maxPolar: POLAR.max, minDistance: 5.5, maxDistance: 2000, near: 0.1, far: 100 };

  it("gives the nearest depth of the limits for a camera near the content", () => {
    expect(nearDepth(limits, ball, 5.5)).toBe(0.1);
    expect(nearDepth(limits, ball, 5.8)).toBe(0.1);
    // A camera in the ball of the content gets the same depth.
    expect(nearDepth(limits, ball, 2)).toBe(0.1);
  });

  it("gives an eighth of the free distance for a camera far from the content", () => {
    expect(nearDepth(limits, ball, 45)).toBe(5);
    expect(nearDepth(limits, box, 8 + Math.sqrt(14))).toBeCloseTo(1, 12);
  });

  it("gives a quarter of the farthest depth at most", () => {
    expect(nearDepth(limits, ball, 1000)).toBe(25);
  });

  it("gives the nearest depth of the limits for a distance that is not a number", () => {
    expect(nearDepth(limits, ball, Number.NaN)).toBe(0.1);
  });

  it("stays in front of the content and behind no depth of the limits, for each place in the limits of a stage", () => {
    const anyCoordinate = fc.double({ min: -30, max: 30, noNaN: true });
    const anyPoint = fc.record({ x: anyCoordinate, y: anyCoordinate, z: anyCoordinate });
    fc.assert(
      fc.property(fc.array(anyPoint, { maxLength: 8 }), fc.constantFrom(0, 2, 40), fc.double({ min: 0, max: 1, noNaN: true }), (corners, surface, part) => {
        const extent: StageExtent = { center: origin, corners, surface };
        const found = stageLimits(frameOf(extent), [fitView(SIDE), capView(TOP, Math.PI / 2)], POLAR);
        const distance = found.minDistance + (found.maxDistance - found.minDistance) * part;
        const near = nearDepth(found, extent, distance);
        expect(near).toBeGreaterThanOrEqual(found.near);
        expect(near).toBeLessThan(found.far);
        // A depth above the depth of the limits is in front of each corner and of the ball.
        if (near > found.near) expect(near).toBeLessThan(distance - reachOf(extent));
      }),
    );
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
        let reach: number = surface;
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
