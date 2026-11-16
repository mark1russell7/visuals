import type { Region } from "@mark1russell7/geo";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { capView, type StageExtent, type ViewFrame } from "../extent.ts";
import { cameraPosition, fitDistance } from "../view.ts";
import { GLOBE_POLAR, globeAngles, globePlace, globePoint, globeView, inSight, rayBall, regionView } from "./space.ts";

const origin = { x: 0, y: 0, z: 0 };
const earth: StageExtent = { center: origin, corners: [], surface: 1 };
const frameOf = (aspect: number = 1.5, fieldOfView: number = 32): ViewFrame => ({ extent: earth, fieldOfView, aspect });

const anyLat = fc.double({ min: -89, max: 89, noNaN: true });
const anyLon = fc.double({ min: -179.9, max: 179.9, noNaN: true });
const anyPlace = fc.record({ lat: anyLat, lon: anyLon });

/** This function makes a region with four corners. */
const square = (west: number, south: number, east: number, north: number): Region => ({
  type: "Polygon",
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

describe("globePoint", () => {
  it("puts the north pole on the y axis, and the equator at longitude 0 on the z axis", () => {
    const pole = globePoint({ lat: 90, lon: 0 });
    expect(pole.x).toBeCloseTo(0, 12);
    expect(pole.y).toBeCloseTo(1, 12);
    expect(pole.z).toBeCloseTo(0, 12);
    const front = globePoint({ lat: 0, lon: 0 });
    expect(front.x).toBeCloseTo(0, 12);
    expect(front.y).toBeCloseTo(0, 12);
    expect(front.z).toBeCloseTo(1, 12);
  });

  it("puts longitude 90 east on the x axis, so east is on the right of a camera in front", () => {
    const east = globePoint({ lat: 0, lon: 90 });
    expect(east.x).toBeCloseTo(1, 12);
    expect(east.y).toBeCloseTo(0, 12);
    expect(east.z).toBeCloseTo(0, 12);
  });

  it("puts the point at the distance of the radius from the center", () => {
    fc.assert(
      fc.property(anyPlace, fc.double({ min: 0.1, max: 50, noNaN: true }), (place, radius) => {
        const point = globePoint(place, radius);
        expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(radius, 9);
      }),
    );
  });
});

describe("globePlace", () => {
  it("gives the place of each point of a globe again", () => {
    fc.assert(
      fc.property(anyPlace, fc.double({ min: 0.1, max: 50, noNaN: true }), (place, radius) => {
        const back = globePlace(globePoint(place, radius));
        expect(back?.lat).toBeCloseTo(place.lat, 8);
        expect(back?.lon).toBeCloseTo(place.lon, 8);
      }),
    );
  });

  it("gives undefined for the center of the globe, and for a point that is not finite", () => {
    expect(globePlace(origin)).toBeUndefined();
    expect(globePlace({ x: Number.NaN, y: 0, z: 1 })).toBeUndefined();
    expect(globePlace({ x: 0, y: Infinity, z: 1 })).toBeUndefined();
  });
});

describe("globeAngles", () => {
  it("puts the camera on the line from the center of the Earth through the place", () => {
    fc.assert(
      fc.property(anyPlace, (place) => {
        const camera = cameraPosition(origin, globeAngles(place), 3);
        const point = globePoint(place, 3);
        expect(camera.x).toBeCloseTo(point.x, 9);
        expect(camera.y).toBeCloseTo(point.y, 9);
        expect(camera.z).toBeCloseTo(point.z, 9);
      }),
    );
  });

  it("keeps the camera in the polar limits of a globe for each place that is not a pole", () => {
    fc.assert(
      fc.property(anyPlace, (place) => {
        const { polar } = globeAngles(place);
        expect(polar).toBeGreaterThan(GLOBE_POLAR.min);
        expect(polar).toBeLessThan(GLOBE_POLAR.max);
      }),
    );
  });
});

describe("globeView", () => {
  const place = { lat: 40, lon: -75 };

  it("shows a half of the Earth by default", () => {
    expect(globeView(place)(frameOf())).toEqual(capView(globeAngles(place), Math.PI / 2)(frameOf()));
  });

  it("shows a cap of the angle that it gets, in degrees", () => {
    expect(globeView(place, 10, 1.2)(frameOf())).toEqual(capView(globeAngles(place), (10 * Math.PI) / 180, 1.2)(frameOf()));
  });

  it("goes nearer for a smaller cap", () => {
    expect(globeView(place, 5)(frameOf()).distance).toBeLessThan(globeView(place, 30)(frameOf()).distance);
  });

  it("keeps the angle between 0 and 90 degrees", () => {
    expect(globeView(place, 400)(frameOf())).toEqual(globeView(place, 90)(frameOf()));
    expect(globeView(place, -5)(frameOf())).toEqual(globeView(place, 0)(frameOf()));
  });
});

describe("regionView", () => {
  it("puts the camera above the middle of a region", () => {
    const view = regionView([square(-10, -10, 10, 10)])(frameOf());
    expect(view.polar).toBeCloseTo(Math.PI / 2, 9);
    expect(view.azimuth).toBeCloseTo(0, 9);
    expect(view.distance).toBeGreaterThan(1);
    expect(view.distance).toBeLessThan(globeView({ lat: 0, lon: 0 })(frameOf()).distance);
  });

  it("shows each corner of each region of the list", () => {
    const anySquare = fc
      .record({ lat: fc.double({ min: -60, max: 60, noNaN: true }), lon: fc.double({ min: -150, max: 150, noNaN: true }), size: fc.double({ min: 0.5, max: 25, noNaN: true }) })
      .map(({ lat, lon, size }) => square(lon - size, lat - size, lon + size, lat + size));
    fc.assert(
      fc.property(fc.array(anySquare, { minLength: 1, maxLength: 4 }), fc.double({ min: 0.4, max: 2.5, noNaN: true }), (regions, aspect) => {
        const frame = frameOf(aspect);
        const place = regionView(regions, 1)(frame);
        const corners = regions.flatMap((region) => (region.type === "Polygon" ? (region.coordinates[0] ?? []) : [])).map((position) => globePoint({ lat: position[1], lon: position[0] }));
        // The camera at this distance shows each corner, or the corner is behind the outline of the Earth.
        expect(fitDistance(corners, origin, place, frame.fieldOfView, aspect)).toBeLessThanOrEqual(place.distance * (1 + 1e-9));
      }),
    );
  });

  it("shows a half of the Earth for a list with no regions", () => {
    expect(regionView([])(frameOf())).toEqual(capView({ polar: Math.PI / 2, azimuth: 0 }, Math.PI / 2)(frameOf()));
  });

  it("uses each polygon of a region with many polygons", () => {
    const west = square(-30, -5, -20, 5);
    const east = square(20, -5, 30, 5);
    const both: Region = { type: "MultiPolygon", coordinates: [west.type === "Polygon" ? west.coordinates : [], east.type === "Polygon" ? east.coordinates : []] };
    const view = regionView([both])(frameOf());
    expect(view.azimuth).toBeCloseTo(0, 9);
    expect(view.distance).toBeGreaterThan(regionView([east])(frameOf()).distance);
  });
});

describe("rayBall", () => {
  it("gives the first point of the ball on the ray", () => {
    expect(rayBall({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -1 }, 1)).toEqual({ x: 0, y: 0, z: 1 });
    expect(rayBall({ x: 4, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 2)).toEqual({ x: 2, y: 0, z: 0 });
  });

  it("gives undefined for a ray that does not find the ball", () => {
    expect(rayBall({ x: 0, y: 3, z: 5 }, { x: 0, y: 0, z: -1 }, 1)).toBeUndefined();
    // The ball is behind the start of this ray.
    expect(rayBall({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 1 }, 1)).toBeUndefined();
  });

  it("gives undefined for a ray that starts in the ball", () => {
    expect(rayBall({ x: 0, y: 0, z: 0.5 }, { x: 0, y: 0, z: -1 }, 1)).toBeUndefined();
    expect(rayBall(origin, { x: 0, y: 0, z: -1 }, 1)).toBeUndefined();
  });

  it("gives a point on the ball that the camera sees", () => {
    const anyUnit = fc.record({ polar: fc.double({ min: 0.05, max: 3.09, noNaN: true }), azimuth: fc.double({ min: -3.1, max: 3.1, noNaN: true }) });
    fc.assert(
      fc.property(anyUnit, anyPlace, fc.double({ min: 1.05, max: 20, noNaN: true }), (angles, place, distance) => {
        const eye = cameraPosition(origin, angles, distance);
        const goal = globePoint(place, 1);
        if (!inSight(goal, eye, 1)) return;
        const length = Math.hypot(goal.x - eye.x, goal.y - eye.y, goal.z - eye.z);
        const hit = rayBall(eye, { x: (goal.x - eye.x) / length, y: (goal.y - eye.y) / length, z: (goal.z - eye.z) / length }, 1);
        // A ray to a point in sight finds that point first.
        expect(hit?.x).toBeCloseTo(goal.x, 6);
        expect(hit?.y).toBeCloseTo(goal.y, 6);
        expect(hit?.z).toBeCloseTo(goal.z, 6);
      }),
    );
  });
});

describe("inSight", () => {
  const eye = { x: 0, y: 0, z: 5 };

  it("is true for a point on the side of the camera", () => {
    expect(inSight({ x: 0, y: 0, z: 1 }, eye, 1)).toBe(true);
    expect(inSight(globePoint({ lat: 40, lon: 30 }), eye, 1)).toBe(true);
  });

  it("is false for a point on the far side, and for a point behind the outline of the ball", () => {
    expect(inSight({ x: 0, y: 0, z: -1 }, eye, 1)).toBe(false);
    expect(inSight({ x: 1, y: 0, z: 0 }, eye, 1)).toBe(false);
    // From the distance 5, the outline is at the angle acos(1 / 5) = 78.46 degrees from the camera.
    expect(inSight(globePoint({ lat: 0, lon: 78 }), eye, 1)).toBe(true);
    expect(inSight(globePoint({ lat: 0, lon: 79 }), eye, 1)).toBe(false);
  });

  it("is false for the center of the ball", () => {
    expect(inSight(origin, eye, 1)).toBe(false);
  });
});
