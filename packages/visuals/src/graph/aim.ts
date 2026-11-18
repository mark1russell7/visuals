import type { Rect } from "@mark1russell7/layout-contract";
import { fitRect, frameRects, revealRects, type FitOptions, type FrameOptions, type PictureView, type RevealOptions, type ZoomLimits } from "./camera.ts";

/** What an aim gets: the picture and the screen at the time of the aim. */
export interface AimFrame {
  /** The bounds of the content, in the unit of the picture. */
  readonly bounds: Rect;
  /** The free area of the picture on the screen, in CSS pixels. */
  readonly area: Rect;
  /** The view of the camera before the aim. */
  readonly view: PictureView;
  /** The limits of the zoom. */
  readonly limits: ZoomLimits;
}

/**
 * An aim of the camera of a flat picture: a function that gives the view for a picture and a screen.
 * A stage asks the aim again after a change of the size of the picture, so the view stays correct.
 */
export type PictureAim = (frame: AimFrame) => PictureView;

/** This function makes the aim that shows all of the picture, as large as the free area permits. */
export function aimAll(options: FitOptions = {}): PictureAim {
  return (frame) => fitRect(frame.bounds, frame.area, { ...options, limits: options.limits ?? frame.limits });
}

/**
 * This function makes the aim that shows a group of boxes at a zoom that a person reads.
 * The rectangles are the bounds of the groups, the largest group first: `frameRects` selects one. An empty list keeps the view.
 */
export function aimRects(rects: readonly Rect[], options: FrameOptions): PictureAim {
  return (frame) => frameRects(rects, frame.area, { ...options, limits: options.limits ?? frame.limits }) ?? frame.view;
}

/**
 * This function makes the aim that shows a selection, and keeps the view when the selection is in view.
 * The rectangles are the bounds of the groups of the selection, the largest group first: `revealRects` selects one.
 */
export function aimReveal(rects: readonly Rect[], options: RevealOptions): PictureAim {
  return (frame) => revealRects(frame.view, rects, frame.area, { ...options, limits: options.limits ?? frame.limits });
}
