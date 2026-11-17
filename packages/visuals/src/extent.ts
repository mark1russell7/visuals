import type { Point3 } from "@mark1russell7/layout-contract";
import { capDistance, fitDistance, viewOf, type Place, type PlaceLimits, type ViewAngles } from "./view.ts";

/** The space that the content of a stage fills. A view and the limits of the camera come from it. */
export interface StageExtent {
  /** The points that a view of all the content shows, for example each corner of each solid. */
  readonly corners: readonly Point3[];
  /** The point that the camera looks at. */
  readonly center: Point3;
  /**
   * The radius of the ball around the center that the camera stays out of, for example the radius of a globe.
   * The default is 0: the content has no ball.
   */
  readonly surface?: number | undefined;
  /** The smallest distance of the camera from the center. The default comes from the views of the stage. */
  readonly minDistance?: number | undefined;
  /** The largest distance of the camera from the center. The default comes from the views of the stage. */
  readonly maxDistance?: number | undefined;
}

/** The picture that a view is for: the content, and the angle and the shape of the picture. */
export interface ViewFrame {
  readonly extent: StageExtent;
  /** The vertical angle of the picture, in degrees. */
  readonly fieldOfView: number;
  /** The width of the picture divided by its height. */
  readonly aspect: number;
}

/** A view of a stage: a function that gives the place of the camera for a picture. A new size of the picture gives a new place. */
export type StageView = (frame: ViewFrame) => Place;

/** The limits of the camera of a stage: the limits of its place, and the nearest and the farthest depth that it draws. */
export interface StageLimits extends PlaceLimits {
  readonly near: number;
  readonly far: number;
}

/** The space around the content in a view that shows all of it, as a factor of the distance. */
export const FIT_MARGIN = 1.06;

/** This function gives the radius of the ball around the center of an extent, or 0 for no ball. */
export function surfaceOf(extent: StageExtent): number {
  const surface = extent.surface ?? 0;
  return surface > 0 ? surface : 0;
}

/**
 * This function makes a view that shows each corner of the content from one direction.
 * `margin` is the space around the content, as a factor of the distance. An extent with no corners gives the distance 1.
 */
export function fitView(angles: ViewAngles, margin: number = FIT_MARGIN): StageView {
  return ({ extent, fieldOfView, aspect }) => {
    const distance = fitDistance(extent.corners, extent.center, angles, fieldOfView, aspect) * margin;
    return { target: extent.center, polar: angles.polar, azimuth: angles.azimuth, distance: distance > 0 ? distance : 1 };
  };
}

/**
 * This function makes a view of a part of the ball of the content: a cap around the point of the ball below the camera.
 *
 * `angles` is the direction from the center of the ball to the camera. `angle` is the angle of the cap at the center of the ball, in radians.
 * `margin` is the space around the cap, as a factor of the height above the ball. An extent with no ball gives the distance 1.
 */
export function capView(angles: ViewAngles, angle: number, margin: number = FIT_MARGIN): StageView {
  return ({ extent, fieldOfView, aspect }) => {
    const surface = surfaceOf(extent);
    const height = Math.max(capDistance(surface, angle, fieldOfView, aspect) - surface, 0);
    return { target: extent.center, polar: angles.polar, azimuth: angles.azimuth, distance: surface > 0 ? surface + height * margin : 1 };
  };
}

/**
 * This function makes a view of points on the ball of the content. The camera is above the middle of the points, and the picture shows each point.
 *
 * The middle is the center of the box of the points. The camera is at the smallest distance that shows each point in the width and in the height of the picture.
 * Thus wide points fill a wide picture. `margin` is the space around the points, as a factor of the height above the ball.
 * A list with no points gives a view of all of the ball from the front. Points with their middle at the center of the ball give the same view.
 */
export function ballView(points: readonly Point3[], margin: number = FIT_MARGIN): StageView {
  let found: { readonly center: Point3; readonly angles: ViewAngles | undefined } | undefined;
  return (frame) => {
    const { extent } = frame;
    const { center } = extent;
    // The middle is the same for each picture of one content. So the function calculates it one time for each center.
    if (found === undefined || found.center.x !== center.x || found.center.y !== center.y || found.center.z !== center.z) {
      found = { center, angles: middleOf(points, center) };
    }
    const { angles } = found;
    if (angles === undefined) return capView({ polar: Math.PI / 2, azimuth: 0 }, Math.PI / 2, margin)(frame);
    const surface = surfaceOf(extent);
    // A point of the ball needs no more distance than the outline of the ball. Thus the camera is not farther than a view of all of the ball.
    const height = Math.max(fitDistance(points, center, angles, frame.fieldOfView, frame.aspect) - surface, 0);
    return { target: center, polar: angles.polar, azimuth: angles.azimuth, distance: surface > 0 ? surface + height * margin : 1 };
  };
}

/** This function gives the direction from `center` to the middle of the box of the points. It gives `undefined` when the middle has no direction. */
function middleOf(points: readonly Point3[], center: Point3): ViewAngles | undefined {
  const low = { x: Infinity, y: Infinity, z: Infinity };
  const high = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const point of points) {
    low.x = Math.min(low.x, point.x);
    low.y = Math.min(low.y, point.y);
    low.z = Math.min(low.z, point.z);
    high.x = Math.max(high.x, point.x);
    high.y = Math.max(high.y, point.y);
    high.z = Math.max(high.z, point.z);
  }
  const middle = { x: (low.x + high.x) / 2 - center.x, y: (low.y + high.y) / 2 - center.y, z: (low.z + high.z) / 2 - center.z };
  const length = Math.hypot(middle.x, middle.y, middle.z);
  if (!(length > 0) || !Number.isFinite(length)) return undefined;
  const { polar, azimuth } = viewOf(middle, { x: 0, y: 0, z: 0 });
  return { polar, azimuth };
}

/** This function gives the radius of the ball around the center of an extent that holds the ball of the extent and each corner. */
export function reachOf(extent: StageExtent): number {
  let reach = surfaceOf(extent);
  for (const corner of extent.corners) reach = Math.max(reach, Math.hypot(corner.x - extent.center.x, corner.y - extent.center.y, corner.z - extent.center.z));
  return reach;
}

/**
 * This function gives the nearest depth that a camera draws, from the distance of the camera to the center of the content.
 *
 * A camera far from the content gets a large value. The depths of the content then have more steps, so two surfaces that are near stay apart.
 * The result is not less than the nearest depth of the limits, and it is in front of all the content.
 */
export function nearDepth(limits: StageLimits, extent: StageExtent, distance: number): number {
  const free = (distance - reachOf(extent)) / 8;
  return free > limits.near ? Math.min(free, limits.far / 4) : limits.near;
}

/**
 * This function gives the limits of the camera of a stage for a picture.
 *
 * The largest distance of the views is the base. The camera goes out to 3 times this distance, and in to 3 % of the height of that view.
 * The extent can give each distance. The nearest depth is small against the height of the nearest camera, and the farthest depth is behind all the content.
 */
export function stageLimits(frame: ViewFrame, views: readonly StageView[], polar: { readonly min: number; readonly max: number }): StageLimits {
  const { extent } = frame;
  const surface = surfaceOf(extent);
  let widest = 0;
  for (const view of views) widest = Math.max(widest, view(frame).distance);
  if (!(widest > surface)) widest = surface + 1;
  const reach = reachOf(extent);
  const minDistance = extent.minDistance ?? surface + (widest - surface) * 0.03;
  const maxDistance = Math.max(extent.maxDistance ?? surface + (widest - surface) * 3, minDistance);
  const height = Math.max(minDistance - surface, 1e-6);
  return { minPolar: polar.min, maxPolar: polar.max, minDistance, maxDistance, near: height / 8, far: (maxDistance + reach) * 1.5 };
}
