import { fromUnitVector, toUnitVector, type LatLon, type Region } from "@mark1russell7/geo";
import type { Point3 } from "@mark1russell7/layout-contract";
import { ballView, capView, FIT_MARGIN, type StageView } from "../extent.ts";
import type { ViewAngles } from "../view.ts";

/**
 * The polar limits of the camera of a globe: the camera goes above each pole.
 * Give this value to the option `polar` of a stage. Set the option `pan` to false, so the camera turns around the center of the Earth.
 */
export const GLOBE_POLAR: { readonly min: number; readonly max: number } = { min: 0.01, max: Math.PI - 0.01 };

const RADIANS = Math.PI / 180;

/**
 * This function gives the point of a globe for a place on the Earth. The center of the globe is the origin of the stage.
 *
 * The axis `y` of the stage goes to the north pole. The axis `z` goes to latitude 0 and longitude 0, and the axis `x` goes to latitude 0 and longitude 90 east.
 * `radius` is the distance of the point from the center. The default is 1.
 */
export function globePoint(place: LatLon, radius: number = 1): Point3 {
  const unit = toUnitVector(place);
  return { x: unit.y * radius, y: unit.z * radius, z: unit.x * radius };
}

/**
 * This function gives the place on the Earth in the direction of a point of the stage, as seen from the center of the globe.
 * The center of the globe has no direction, so it gives `undefined`.
 */
export function globePlace(point: Point3): LatLon | undefined {
  if (point.x === 0 && point.y === 0 && point.z === 0) return undefined;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return undefined;
  return fromUnitVector({ x: point.z, y: point.x, z: point.y });
}

/** This function gives the direction of a camera that is above a place on the Earth. */
export function globeAngles(place: LatLon): ViewAngles {
  return { polar: Math.PI / 2 - place.lat * RADIANS, azimuth: place.lon * RADIANS };
}

/**
 * This function makes a view from above a place on the Earth. The picture shows the cap of the Earth around the place.
 *
 * `degrees` is the angle of the cap at the center of the Earth. It is the distance from the place to the edge of the cap, in degrees of a great circle.
 * The default is 90: the picture shows a half of the Earth. `margin` is the space around the cap, as a factor of the height above the surface.
 */
export function globeView(place: LatLon, degrees: number = 90, margin: number = FIT_MARGIN): StageView {
  return capView(globeAngles(place), Math.min(Math.max(degrees, 0), 90) * RADIANS, margin);
}

/**
 * This function makes a view that shows each region of a list. The camera is above the middle of the regions.
 * The regions fill the width or the height of the picture, so a wide region is large in a wide picture.
 * A list with no regions gives a view of a half of the Earth. `margin` is the space around the regions, as a factor of the height above the surface.
 */
export function regionView(regions: readonly Region[], margin: number = FIT_MARGIN): StageView {
  const points: Point3[] = [];
  for (const region of regions) {
    const polygons = region.type === "Polygon" ? [region.coordinates] : region.coordinates;
    for (const polygon of polygons) {
      // The first ring of a polygon is its outer edge. A hole is in it, so the holes add no extent.
      for (const position of polygon[0] ?? []) points.push(globePoint({ lat: position[1], lon: position[0] }));
    }
  }
  return ballView(points, margin);
}

/**
 * This function gives the first point of a ball that a ray finds. The center of the ball is the origin of the stage.
 *
 * `direction` has the length 1. A ray that does not find the ball gives `undefined`, and a ray that starts in the ball also gives `undefined`.
 */
export function rayBall(origin: Point3, direction: Point3, radius: number): Point3 | undefined {
  const along = origin.x * direction.x + origin.y * direction.y + origin.z * direction.z;
  const outside = origin.x * origin.x + origin.y * origin.y + origin.z * origin.z - radius * radius;
  if (!(outside > 0)) return undefined;
  const root = along * along - outside;
  if (!(root >= 0)) return undefined;
  const distance = -along - Math.sqrt(root);
  if (!(distance >= 0)) return undefined;
  return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance, z: origin.z + direction.z * distance };
}

/**
 * This function tells if a camera at `eye` sees a point of the surface of a ball. The center of the ball is the origin of the stage.
 * A point on the far side of the ball gives false.
 */
export function inSight(point: Point3, eye: Point3, radius: number): boolean {
  const length = Math.hypot(point.x, point.y, point.z);
  if (!(length > 0)) return false;
  return (point.x * eye.x + point.y * eye.y + point.z * eye.z) / length > radius;
}
