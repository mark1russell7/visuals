import type { Point3 } from "@mark1russell7/layout-contract";

/**
 * The direction of a view: where the camera is, as seen from the point that it looks at.
 * The space of a stage has the y axis up.
 */
export interface ViewAngles {
  /** The angle from the up axis to the camera, in radians. At 0, the camera looks down from above. */
  readonly polar: number;
  /** The angle around the up axis, in radians. At 0, the camera is on the positive z side of the point. */
  readonly azimuth: number;
}

/** A place of a camera: the point that it looks at, the angles of its view and its distance from the point. */
export interface Place extends ViewAngles {
  readonly target: Point3;
  readonly distance: number;
}

/** The three axes of a camera, as unit vectors in the space of the stage. */
export interface ViewAxes {
  /** The vector from the point that the camera looks at to the camera. */
  readonly back: Point3;
  /** The vector to the right side of the picture. */
  readonly right: Point3;
  /** The vector to the top of the picture. */
  readonly up: Point3;
}

/** The limits of the place of a camera. */
export interface PlaceLimits {
  /** The smallest polar angle. At 0, the azimuth of a camera has no meaning. */
  readonly minPolar: number;
  /** The largest polar angle. */
  readonly maxPolar: number;
  /** The smallest distance from the target. */
  readonly minDistance: number;
  /** The largest distance from the target. */
  readonly maxDistance: number;
}

/** This function gives the axes of the camera of a view. At a polar angle of 0, the top of the picture is the negative z axis. */
export function viewAxes(view: ViewAngles): ViewAxes {
  const sinPolar = Math.sin(view.polar);
  const cosPolar = Math.cos(view.polar);
  const sinAzimuth = Math.sin(view.azimuth);
  const cosAzimuth = Math.cos(view.azimuth);
  return {
    back: { x: sinPolar * sinAzimuth, y: cosPolar, z: sinPolar * cosAzimuth },
    right: { x: cosAzimuth, y: 0, z: 0 - sinAzimuth },
    up: { x: 0 - cosPolar * sinAzimuth, y: sinPolar, z: 0 - cosPolar * cosAzimuth },
  };
}

/** This function gives the dot product of the vector from `origin` to `point` with `axis`. */
function along(point: Point3, origin: Point3, axis: Point3): number {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y + (point.z - origin.z) * axis.z;
}

/**
 * This function gives the smallest distance from `target` at which a camera shows each point.
 *
 * The camera looks at `target` along the direction of `view`. `fov` is the vertical angle of the picture in degrees,
 * and `aspect` is the width of the picture divided by its height.
 * The function gives 0 for no points, and for an angle or an aspect that makes no picture.
 */
export function fitDistance(points: readonly Point3[], target: Point3, view: ViewAngles, fov: number, aspect: number): number {
  const tanUp = Math.tan((fov * Math.PI) / 360);
  const tanRight = tanUp * aspect;
  if (!(tanUp > 0) || !(tanRight > 0) || !Number.isFinite(tanRight)) return 0;
  const axes = viewAxes(view);
  let distance = 0;
  for (const point of points) {
    const depth = along(point, target, axes.back);
    const needed = Math.max(Math.abs(along(point, target, axes.right)) / tanRight, Math.abs(along(point, target, axes.up)) / tanUp);
    distance = Math.max(distance, depth + needed);
  }
  return distance;
}

/**
 * This function gives the smallest distance from the center of a ball at which a camera shows a cap of the ball.
 *
 * The camera looks at the center of the ball, and the center of the cap is on the line to the camera.
 * `radius` is the radius of the ball. `angle` is the angle of the cap at the center of the ball, in radians, from 0 to π / 2.
 * `fov` is the vertical angle of the picture in degrees, and `aspect` is the width of the picture divided by its height.
 * The function gives 0 for an angle or an aspect that makes no picture.
 */
export function capDistance(radius: number, angle: number, fov: number, aspect: number): number {
  const tanUp = Math.tan((fov * Math.PI) / 360);
  const tan = Math.min(tanUp, tanUp * aspect);
  if (!(tan > 0) || !Number.isFinite(tan) || !(radius > 0)) return 0;
  const cap = Math.min(Math.max(angle, 0), Math.PI / 2);
  const half = Math.atan(tan);
  // A cap this large has its edge behind the outline of the ball. Then the outline of the ball is the limit.
  if (cap >= Math.PI / 2 - half) return radius / Math.sin(half);
  // The edge of the cap is at the height r sin(a) from the line, and at the depth r cos(a) from the center.
  return radius * Math.cos(cap) + (radius * Math.sin(cap)) / tan;
}

/** This function gives the position of a camera at a distance from `target`, in the direction of `view`. */
export function cameraPosition(target: Point3, view: ViewAngles, distance: number): Point3 {
  const { back } = viewAxes(view);
  return { x: target.x + back.x * distance, y: target.y + back.y * distance, z: target.z + back.z * distance };
}

/** This function gives the angles of the view from `target` to a camera, and the distance between them. A camera at the target gives the angles 0. */
export function viewOf(camera: Point3, target: Point3): ViewAngles & { readonly distance: number } {
  const x = camera.x - target.x;
  const y = camera.y - target.y;
  const z = camera.z - target.z;
  const distance = Math.hypot(x, y, z);
  if (!(distance > 0)) return { polar: 0, azimuth: 0, distance: 0 };
  return { polar: Math.acos(Math.min(Math.max(y / distance, -1), 1)), azimuth: Math.atan2(x, z), distance };
}

/** This function gives the angle between two azimuths along the shortest way, from −π to π. */
export function turnBetween(from: number, to: number): number {
  const full = 2 * Math.PI;
  const turn = (((to - from) % full) + full) % full;
  return turn > Math.PI ? turn - full : turn;
}

/** This function gives a place in its limits. The target and the azimuth stay as they are. */
export function clampPlace(place: Place, limits: PlaceLimits): Place {
  return {
    target: place.target,
    azimuth: place.azimuth,
    polar: Math.min(Math.max(place.polar, limits.minPolar), limits.maxPolar),
    distance: Math.min(Math.max(place.distance, limits.minDistance), limits.maxDistance),
  };
}

/**
 * This function gives the height of a camera above the surface of a stage, as a part of its distance from the target.
 *
 * `surface` is the radius of the ball around the target that the camera stays out of. A stage with no ball has the value 0.
 * The result is the factor of the turn speed and the zoom speed of a camera: near the surface, a camera moves slowly.
 * The result is 0.02 at least, so a camera on the surface can move away.
 */
export function speedAt(distance: number, surface: number): number {
  if (!(distance > 0)) return 1;
  return Math.min(Math.max((distance - surface) / distance, 0.02), 1);
}

/**
 * This function gives the place at a part of the way between two places. `part` goes from 0 to 1.
 *
 * The azimuth goes along the shortest way. The height above the surface changes by an equal factor for each equal step,
 * so a zoom has one speed in the picture. `surface` is the radius of the ball around the target, or 0 for no ball.
 */
export function placeBetween(from: Place, to: Place, part: number, surface: number = 0): Place {
  const between = (a: number, b: number): number => a + (b - a) * part;
  const low = from.distance - surface;
  const high = to.distance - surface;
  const height = low > 0 && high > 0 ? low * (high / low) ** part : between(low, high);
  return {
    target: { x: between(from.target.x, to.target.x), y: between(from.target.y, to.target.y), z: between(from.target.z, to.target.z) },
    polar: between(from.polar, to.polar),
    azimuth: from.azimuth + turnBetween(from.azimuth, to.azimuth) * part,
    distance: surface + height,
  };
}
