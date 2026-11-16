import { FIELD_OF_VIEW, turnAcross, type Place } from "./view.ts";

/** The largest angle of one step of an arrow key, in radians. A camera far from a ball, or with no ball, turns by this angle. */
export const KEY_TURN: number = Math.PI / 24;

/** The part of the height of the picture by which one step of an arrow key moves the surface of a ball, near the ball. */
export const KEY_PART = 0.125;

/** The factor of the height of a camera above the surface for one step of the key `+`. */
export const KEY_ZOOM = 0.85;

/** What a key does on a stage: it moves the camera to a place, or it shows a view. */
export type KeyAction = { readonly type: "place"; readonly place: Place } | { readonly type: "view"; readonly view: string };

/** The keys of a stage. */
export interface KeyOptions {
  /** The name of the view of the keys `Home` and `0`. */
  readonly home: string;
  /** The name of the view of each other key, for example `{ t: "top" }`. A letter has no case. */
  readonly views?: Readonly<Record<string, string>> | undefined;
  /** The radius of the ball around the target that the camera stays out of, or 0 for no ball. */
  readonly surface?: number | undefined;
  /** The vertical angle of the picture, in degrees. The default is `FIELD_OF_VIEW`. */
  readonly fieldOfView?: number | undefined;
}

/**
 * This function gives the action of a key on a stage, or `undefined` for a key with no action.
 *
 * The arrow keys turn the camera around the target. The keys `+` and `-` change the height above the surface.
 * The keys `Home` and `0` show the home view.
 * Near a ball, a step of an arrow key moves the surface by the part `KEY_PART` of the height of the picture.
 * The result has no limits: the stage puts the place in its limits.
 */
export function keyAction(key: string, now: Place, options: KeyOptions): KeyAction | undefined {
  const surface = options.surface ?? 0;
  const turn = Math.min(KEY_TURN, KEY_PART * turnAcross(now.distance, surface, options.fieldOfView ?? FIELD_OF_VIEW));
  const zoom = (factor: number): Place => ({ ...now, distance: surface + (now.distance - surface) * factor });
  switch (key) {
    case "ArrowLeft":
      return { type: "place", place: { ...now, azimuth: now.azimuth - turn } };
    case "ArrowRight":
      return { type: "place", place: { ...now, azimuth: now.azimuth + turn } };
    case "ArrowUp":
      return { type: "place", place: { ...now, polar: now.polar - turn } };
    case "ArrowDown":
      return { type: "place", place: { ...now, polar: now.polar + turn } };
    case "+":
    case "=":
      return { type: "place", place: zoom(KEY_ZOOM) };
    case "-":
    case "_":
      return { type: "place", place: zoom(1 / KEY_ZOOM) };
    case "Home":
    case "0":
      return { type: "view", view: options.home };
    default: {
      const view = key.length === 1 ? options.views?.[key.toLowerCase()] : undefined;
      return view === undefined ? undefined : { type: "view", view };
    }
  }
}
