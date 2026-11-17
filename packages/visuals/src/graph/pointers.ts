import type { Point } from "@mark1russell7/layout-contract";
import { CLICK_DISTANCE, isClick } from "../highlight.ts";
import { panView, pinchView, ZOOM_LIMITS, type PictureView, type ZoomLimits } from "./camera.ts";

/** The pointers that are down on a picture: a mouse button, a pen or each finger of a hand. */
export interface Pointers {
  /** The screen position of each pointer that is down, by the id of the pointer. */
  readonly at: ReadonlyMap<number, Point>;
  /** The position where the first pointer went down. */
  readonly start: Point | undefined;
  /** This value is true after a second pointer went down. The pointers then make no click. */
  readonly many: boolean;
}

/** The pointers of a picture that no pointer is down on. */
export const NO_POINTERS: Pointers = { at: new Map(), start: undefined, many: false };

/** A finger moves more than a mouse between down and up. This is the distance of a click for a finger, in CSS pixels. */
export const TOUCH_CLICK_DISTANCE = 10;

/** This function gives the pointers after a pointer went down. The first pointer starts a possible click. */
export function pointerDown(pointers: Pointers, id: number, at: Point): Pointers {
  const next = new Map(pointers.at).set(id, at);
  // A pointer that went up outside of the page can go down again with no up between.
  const first = next.size === 1;
  return first ? { at: next, start: at, many: false } : { at: next, start: pointers.start, many: true };
}

/** The result of `pointerMove`: the pointers and the view after the move. */
export interface PointerMoveResult {
  readonly pointers: Pointers;
  readonly view: PictureView;
}

/**
 * This function gives the pointers and the view after a pointer moved.
 *
 * One pointer moves the picture, so the point of the picture below the pointer stays there.
 * Two pointers make a pinch: `pinchView` gives the view. Three pointers or more do not change the view.
 * A pointer that is not down changes nothing.
 */
export function pointerMove(pointers: Pointers, id: number, at: Point, view: PictureView, limits: ZoomLimits = ZOOM_LIMITS): PointerMoveResult {
  const old = pointers.at.get(id);
  if (old === undefined) return { pointers, view };
  const next: Pointers = { ...pointers, at: new Map(pointers.at).set(id, at) };
  if (pointers.at.size === 1) return { pointers: next, view: panView(view, at.x - old.x, at.y - old.y) };
  if (pointers.at.size > 2) return { pointers: next, view };
  for (const [key, other] of pointers.at) {
    if (key !== id) return { pointers: next, view: pinchView(view, [old, other], [at, other], limits) };
  }
  return { pointers: next, view };
}

/** The result of `pointerUp`: the pointers that stay down, and the answer if the pointer made a click. */
export interface PointerUpResult {
  readonly pointers: Pointers;
  /** This value is true when one pointer went down and up at almost the same position. */
  readonly click: boolean;
}

/**
 * This function gives the pointers after a pointer went up, and tells if the pointer made a click.
 *
 * A click is one pointer that went up not more than `limit` from its start, with no second pointer between.
 * The default of `limit` is `CLICK_DISTANCE`. Use `TOUCH_CLICK_DISTANCE` for a finger.
 */
export function pointerUp(pointers: Pointers, id: number, at: Point, limit: number = CLICK_DISTANCE): PointerUpResult {
  if (!pointers.at.has(id)) return { pointers, click: false };
  const rest = new Map(pointers.at);
  rest.delete(id);
  if (rest.size > 0) return { pointers: { ...pointers, at: rest }, click: false };
  return { pointers: NO_POINTERS, click: !pointers.many && pointers.start !== undefined && isClick(pointers.start, at, limit) };
}

/** This function gives the pointers after the browser stopped a pointer, for example for a gesture of the system. It makes no click. */
export function pointerCancel(pointers: Pointers, id: number): Pointers {
  if (!pointers.at.has(id)) return pointers;
  const rest = new Map(pointers.at);
  rest.delete(id);
  return rest.size > 0 ? { ...pointers, at: rest } : NO_POINTERS;
}
