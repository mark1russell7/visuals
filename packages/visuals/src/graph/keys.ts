import type { Rect } from "@mark1russell7/layout-contract";
import { KEY_PART, KEY_ZOOM } from "../keys.ts";
import { panView, zoomView, type PictureView, type ZoomLimits } from "./camera.ts";

/** What a key does on a flat picture: it moves the camera to a view, or it shows a view by its name. */
export type PictureKeyAction = { readonly type: "move"; readonly to: PictureView } | { readonly type: "view"; readonly view: string };

/** The keys of a flat picture. */
export interface PictureKeyOptions {
  /** The name of the view of the keys `Home` and `0`. */
  readonly home: string;
  /** The name of the view of each other key, for example `{ f: "focus" }`. A letter has no case. */
  readonly views?: Readonly<Record<string, string>> | undefined;
  /** The limits of the zoom. The default is `ZOOM_LIMITS`. */
  readonly limits?: ZoomLimits | undefined;
}

/**
 * This function gives the action of a key on a flat picture, or `undefined` for a key with no action.
 *
 * `area` is the part of the screen that shows the picture. `freeArea` gives it.
 * An arrow key moves the camera by the part `KEY_PART` of the smaller side of the area.
 * The keys `+` and `-` zoom at the middle of the area, by the factor of one step of a key on a 3D stage.
 * The keys `Home` and `0` show the home view.
 */
export function pictureKeyAction(key: string, now: PictureView, area: Rect, options: PictureKeyOptions): PictureKeyAction | undefined {
  const step = Math.min(area.w, area.h) * KEY_PART;
  const middle = { x: area.x + area.w / 2, y: area.y + area.h / 2 };
  switch (key) {
    // The camera moves in the direction of the arrow, so the picture moves in the opposite direction.
    case "ArrowLeft":
      return { type: "move", to: panView(now, step, 0) };
    case "ArrowRight":
      return { type: "move", to: panView(now, 0 - step, 0) };
    case "ArrowUp":
      return { type: "move", to: panView(now, 0, step) };
    case "ArrowDown":
      return { type: "move", to: panView(now, 0, 0 - step) };
    case "+":
    case "=":
      return { type: "move", to: zoomView(now, middle, 1 / KEY_ZOOM, options.limits) };
    case "-":
    case "_":
      return { type: "move", to: zoomView(now, middle, KEY_ZOOM, options.limits) };
    case "Home":
    case "0":
      return { type: "view", view: options.home };
    default: {
      const view = key.length === 1 ? options.views?.[key.toLowerCase()] : undefined;
      return view === undefined ? undefined : { type: "view", view };
    }
  }
}
