import type { Point, Rect } from "@mark1russell7/layout-contract";
import { easeInOut, partAt } from "../motion.ts";

/**
 * The camera of a flat picture: a zoom and the position of the origin.
 * A point `p` of the picture shows at the screen point `p * k + (x, y)`. Each screen length is in CSS pixels.
 */
export interface PictureView {
  /** The screen position of the origin of the picture, from the left edge. */
  readonly x: number;
  /** The screen position of the origin of the picture, from the top edge. */
  readonly y: number;
  /** The zoom: the screen length of one unit of the picture. */
  readonly k: number;
}

/** The limits of the zoom of a camera. */
export interface ZoomLimits {
  readonly min: number;
  readonly max: number;
}

/** The default limits of the zoom. */
export const ZOOM_LIMITS: ZoomLimits = { min: 0.05, max: 8 };

/** The view that shows each point of the picture at its own position. */
export const UNIT_VIEW: PictureView = { x: 0, y: 0, k: 1 };

/** This function gives a zoom in its limits. A zoom that is not a number gives the smallest zoom. */
export function clampZoom(k: number, limits: ZoomLimits = ZOOM_LIMITS): number {
  return k >= limits.min ? Math.min(k, limits.max) : limits.min;
}

/** This function gives the point of the picture that shows at a screen point. */
export function toPicture(view: PictureView, screen: Point): Point {
  return { x: (screen.x - view.x) / view.k, y: (screen.y - view.y) / view.k };
}

/** This function gives the screen point that shows a point of the picture. */
export function toScreen(view: PictureView, point: Point): Point {
  return { x: point.x * view.k + view.x, y: point.y * view.k + view.y };
}

/** This function gives the screen rectangle that shows a rectangle of the picture. */
export function rectToScreen(view: PictureView, rect: Rect): Rect {
  return { x: rect.x * view.k + view.x, y: rect.y * view.k + view.y, w: rect.w * view.k, h: rect.h * view.k };
}

/** This function gives the view with the zoom `k` that shows the point `point` of the picture at the screen point `at`. */
export function viewAt(point: Point, at: Point, k: number): PictureView {
  return { x: at.x - point.x * k, y: at.y - point.y * k, k };
}

/** This function gives the view after a move of the picture by a screen distance. */
export function panView(view: PictureView, dx: number, dy: number): PictureView {
  return { x: view.x + dx, y: view.y + dy, k: view.k };
}

/**
 * This function gives the view after a zoom by `factor`. The zoom stays in its limits.
 * The screen point `at` shows the same point of the picture before and after the zoom.
 */
export function zoomView(view: PictureView, at: Point, factor: number, limits: ZoomLimits = ZOOM_LIMITS): PictureView {
  const k = clampZoom(view.k * factor, limits);
  const ratio = k / view.k;
  return { x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio, k };
}

/** The positions of the two pointers of a pinch, in CSS pixels. */
export type PointerPair = readonly [Point, Point];

/**
 * This function gives the view after the two pointers of a pinch move from `before` to `after`.
 *
 * The zoom changes by the ratio of the two distances between the pointers.
 * The point of the picture at the middle of the pointers stays at their middle.
 * Thus each pointer keeps its point of the picture, if the pointers do not turn and the zoom is in its limits.
 */
export function pinchView(view: PictureView, before: PointerPair, after: PointerPair, limits: ZoomLimits = ZOOM_LIMITS): PictureView {
  const from = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
  const to = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
  const was = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
  const is = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
  // Two pointers at one position give no ratio. The picture then only moves.
  const factor = was > 0 && is > 0 ? is / was : 1;
  return zoomView(panView(view, to.x - from.x, to.y - from.y), to, factor, limits);
}

/** The speed of the zoom of a wheel: the change of the natural logarithm of the zoom for one CSS pixel of the wheel. */
export const WHEEL_SPEED = 0.0015;

/** The height of one line of a wheel that gives its turn in lines, in CSS pixels. */
export const WHEEL_LINE = 16;

/** The factor of the speed of the wheel for a pinch on a touch pad. A browser gives such a pinch as a wheel with the key `Control`. */
export const WHEEL_PINCH = 10;

/**
 * This function gives the factor of the zoom for one event of a wheel. A turn away from the person makes the picture larger.
 *
 * `deltaY` and `deltaMode` are the fields of the event. A mode of 1 has its turn in lines.
 * `pinch` is the field `ctrlKey` of the event: a pinch on a touch pad has small turns, so its speed is higher.
 */
export function wheelFactor(deltaY: number, deltaMode: number = 0, pinch: boolean = false): number {
  const pixels = deltaMode === 1 ? deltaY * WHEEL_LINE : deltaY;
  return Math.exp(0 - pixels * WHEEL_SPEED * (pinch ? WHEEL_PINCH : 1));
}

/** The parts of a picture that a page covers, from each edge, in CSS pixels. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** The smallest width and height of a free area, in CSS pixels. */
export const SMALLEST_AREA = 80;

/**
 * This function gives the free area of a picture: the screen rectangle that the page does not cover.
 * A camera shows a selection in this area, so a panel of the page does not hide it.
 * The width and the height of the area are `SMALLEST_AREA` at least.
 */
export function freeArea(size: { readonly width: number; readonly height: number }, insets: Partial<Insets> = {}): Rect {
  const left = insets.left ?? 0;
  const top = insets.top ?? 0;
  return {
    x: left,
    y: top,
    w: Math.max(SMALLEST_AREA, size.width - left - (insets.right ?? 0)),
    h: Math.max(SMALLEST_AREA, size.height - top - (insets.bottom ?? 0)),
  };
}

/** The default distance between a rectangle that a camera shows and each edge of the area, in CSS pixels. */
export const FIT_PADDING = 24;

/** The options of `fitRect`. */
export interface FitOptions {
  /** The distance between the rectangle and each edge of the area, in CSS pixels. The default is `FIT_PADDING`. */
  readonly padding?: number | undefined;
  /** The largest zoom of the result. The default is the largest zoom of the limits. */
  readonly most?: number | undefined;
  /** The limits of the zoom. The default is `ZOOM_LIMITS`. */
  readonly limits?: ZoomLimits | undefined;
}

/** This function gives the middle of a rectangle. */
function middleOf(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/**
 * This function gives the view that shows a rectangle of the picture in an area of the screen, as large as the area permits.
 * The middle of the rectangle is at the middle of the area. A rectangle with no size gets the largest zoom.
 */
export function fitRect(rect: Rect, area: Rect, options: FitOptions = {}): PictureView {
  const limits = options.limits ?? ZOOM_LIMITS;
  const padding = options.padding ?? FIT_PADDING;
  const width = Math.max(area.w - 2 * padding, 1);
  const height = Math.max(area.h - 2 * padding, 1);
  const k = clampZoom(Math.min(options.most ?? limits.max, width / Math.max(rect.w, 0), height / Math.max(rect.h, 0)), limits);
  return viewAt(middleOf(rect), middleOf(area), k);
}

/** The options of `frameRects`. */
export interface FrameOptions extends FitOptions {
  /** The smallest zoom at which a person reads the content of a rectangle. */
  readonly least: number;
}

/**
 * This function gives the view for the first rectangle of a list that an area of the screen shows at the zoom `least` or more.
 *
 * Give the bounds of the largest group of boxes first, then the bounds of smaller groups.
 * If no rectangle is small enough, the result has the zoom `least` and the middle of the last rectangle at the middle of the area.
 * An empty list gives `undefined`.
 */
export function frameRects(rects: readonly Rect[], area: Rect, options: FrameOptions): PictureView | undefined {
  for (const rect of rects) {
    const view = fitRect(rect, area, options);
    if (view.k >= options.least) return view;
  }
  const last = rects.at(-1);
  if (last === undefined) return undefined;
  return viewAt(middleOf(last), middleOf(area), clampZoom(options.least, options.limits));
}

/**
 * This function tells if a view shows all of a rectangle of the picture in an area of the screen.
 * `margin` is the smallest distance between the rectangle and each edge of the area, in CSS pixels.
 */
export function showsRect(view: PictureView, rect: Rect, area: Rect, margin: number = 0): boolean {
  const shown = rectToScreen(view, rect);
  return shown.x >= area.x + margin && shown.y >= area.y + margin && shown.x + shown.w <= area.x + area.w - margin && shown.y + shown.h <= area.y + area.h - margin;
}

/** The options of `revealRects`. */
export interface RevealOptions extends FrameOptions {
  /** The smallest distance between a rectangle in view and each edge of the area, in CSS pixels. The default is 0. */
  readonly margin?: number | undefined;
}

/**
 * This function gives the view that shows a selection, and it keeps the view `view` when the selection is in view.
 *
 * The rectangles are the bounds of the groups of the selection, as for `frameRects`, the largest group first.
 * The selection is in view when `view` has the zoom `least` or more, and shows all of the rectangle that `frameRects` selects.
 * The result is then `view` itself, so a camera does not move for a click on a box that a person reads.
 * In each other case, the result is the view of `frameRects`. An empty list gives `view`.
 */
export function revealRects(view: PictureView, rects: readonly Rect[], area: Rect, options: RevealOptions): PictureView {
  for (const rect of rects) {
    const framed = fitRect(rect, area, options);
    if (framed.k < options.least) continue;
    return view.k >= options.least && showsRect(view, rect, area, options.margin ?? 0) ? view : framed;
  }
  return frameRects(rects.slice(-1), area, options) ?? view;
}

/**
 * This function gives the view at a part of the way between two views. `part` goes from 0 to 1.
 *
 * The zoom changes by an equal factor for each equal step, so a zoom has one speed in the picture.
 * The way is a zoom at one screen point: the point of the picture that the two views show there stays there.
 * Thus each point of the picture moves along a straight line of the screen, in one direction.
 * Two views with one zoom give a straight move at one speed.
 */
export function viewBetween(from: PictureView, to: PictureView, part: number): PictureView {
  if (!(part > 0)) return from;
  if (part >= 1) return to;
  const log = Math.log(to.k / from.k);
  if (!Number.isFinite(log)) return to;
  // The origin moves in proportion to the change of the zoom. The function expm1 keeps the precision for two zooms that are almost equal.
  const share = log === 0 ? part : Math.expm1(log * part) / Math.expm1(log);
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, k: from.k * Math.exp(log * part) };
}

/** A move of the camera of a flat picture from one view to a different view. */
export interface PictureMove {
  readonly from: PictureView;
  readonly to: PictureView;
  /** The time of the start of the move, in milliseconds. */
  readonly start: number;
  /** The time that the move takes, in milliseconds. */
  readonly duration: number;
}

/** The view of a camera at one time of a move. */
export interface PictureMoveStep {
  readonly view: PictureView;
  /** This value is true at the end of the move, and after it. */
  readonly done: boolean;
}

/**
 * This function gives the view of a camera at the time `now` of a move, in milliseconds.
 * The move has a slow start and a slow end. A move with no duration is at its end immediately.
 */
export function pictureMoveAt(move: PictureMove, now: number): PictureMoveStep {
  const part = partAt(move.start, move.duration, now);
  if (part >= 1) return { view: move.to, done: true };
  return { view: viewBetween(move.from, move.to, easeInOut(part)), done: false };
}
