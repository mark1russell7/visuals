import type { Point3 } from "@mark1russell7/layout-contract";
import { capDistance, fitDistance, type Place, type PlaceLimits, type ViewAngles } from "./view.ts";

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
  let reach = surface;
  for (const corner of extent.corners) reach = Math.max(reach, Math.hypot(corner.x - extent.center.x, corner.y - extent.center.y, corner.z - extent.center.z));
  const minDistance = extent.minDistance ?? surface + (widest - surface) * 0.03;
  const maxDistance = Math.max(extent.maxDistance ?? surface + (widest - surface) * 3, minDistance);
  const height = Math.max(minDistance - surface, 1e-6);
  return { minPolar: polar.min, maxPolar: polar.max, minDistance, maxDistance, near: height / 8, far: (maxDistance + reach) * 1.5 };
}
