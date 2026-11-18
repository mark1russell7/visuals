import type { Rect } from "@mark1russell7/layout-contract";
import { rectToScreen, type PictureView } from "@mark1russell7/visuals/graph";

/**
 * This function gives the rectangle of a box of the picture in the viewport of the page, in CSS pixels.
 *
 * `view` is the view of the camera, and `frame` is the rectangle of the canvas in the viewport.
 * The result is `undefined` when no part of the box is in the canvas.
 * The result has the full box, also the part that is out of the canvas.
 */
export function anchorRect(view: PictureView, rect: Rect, frame: Rect): Rect | undefined {
  const shown = rectToScreen(view, rect);
  if (shown.x >= frame.w || shown.y >= frame.h || shown.x + shown.w <= 0 || shown.y + shown.h <= 0) return undefined;
  return { x: frame.x + shown.x, y: frame.y + shown.y, w: shown.w, h: shown.h };
}
