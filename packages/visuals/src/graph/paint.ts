import {
  grow,
  overlapOf,
  pathEnd,
  pathStart,
  translate,
  type LabelAlign,
  type PathSegment,
  type PathTangent,
  type PictureBox,
  type PictureLabel,
  type PictureRoute,
  type Rect,
  type Region,
  type Ring,
} from "@mark1russell7/layout-contract";
import type { Highlight } from "../highlight.ts";
import { boxFocus, FOCUS_OPACITY, routeFocus, type FocusLevel, type PictureFocus } from "./focus.ts";
import { lookUnit, MOST_KEPT_LINE, type BoxLook, type LabelLook, type PictureLooks, type RecordState, type RouteEnd, type RouteLook } from "./looks.ts";
import { routeLine, type PictureIndex, type PictureRecord } from "./records.ts";

/** The outline of a shape of a paint list, in the unit of the picture. */
export type PaintOutline =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly radius: number }
  | { readonly kind: "ellipse"; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }
  | { readonly kind: "polygon"; readonly rings: readonly Ring[] }
  | { readonly kind: "path"; readonly path: readonly PathSegment[] };

/** A shape of a paint list with an outline: an inside, a line, or the two. */
export interface PaintOutlined {
  readonly type: "shape";
  readonly outline: PaintOutline;
  /** The color of the inside. */
  readonly fill?: string | undefined;
  /** The color of the line. */
  readonly stroke?: string | undefined;
  /** The width of the line, in the unit of the picture. */
  readonly lineWidth?: number | undefined;
  /** The lengths of the dashes and the gaps of the line, in the unit of the picture. */
  readonly dash?: readonly number[] | undefined;
  /** The share of its color that the shape keeps, above 0 and to 1. */
  readonly opacity: number;
}

/** One line of text of a paint list. */
export interface PaintText {
  readonly type: "text";
  readonly text: string;
  /** The point of the line on the x axis: its left end, its middle or its right end, as `align` tells. */
  readonly x: number;
  /** The middle of the height of the line. */
  readonly y: number;
  /** The font, as the CSS property `font`. Its size is in the unit of the picture. */
  readonly font: string;
  readonly align: LabelAlign;
  readonly fill: string;
  /** A line around each letter, below the letters. Its width is in the unit of the picture. */
  readonly halo?: { readonly color: string; readonly width: number } | undefined;
  /** The share of its color that the text keeps, above 0 and to 1. */
  readonly opacity: number;
  /**
   * The factor by which the text is larger than its font, about its point (`x`, `y`). The default is 1.
   * A label that keeps a height on the screen has it. The width of `halo` is the width after this factor.
   */
  readonly scale?: number | undefined;
}

/** One shape of a paint list. The list is in the order of the paint, so its first shape is at the back. */
export type PaintShape = PaintOutlined | PaintText;

/** The state of a picture at the time of a paint. */
export interface PaintState {
  /** The zoom of the camera: the number of CSS pixels for one unit of the picture. */
  readonly zoom: number;
  /** This function gives the highlight of a record by its name. */
  readonly highlight: (record: string) => Highlight;
  /** The focus of the picture. Without it, each record is clear. */
  readonly focus?: PictureFocus | undefined;
  /** The part of the picture in view. A record out of it gets no shape. Without it, each record gets its shapes. */
  readonly visible?: Rect | undefined;
  /** This function gives the width of a text in a font, in the unit of the picture. A bar of a label has this width, or the width of the label. */
  readonly measure?: ((font: string, text: string) => number) | undefined;
  /**
   * This function gives the share of its color that a record keeps. `key` is the key of the record, and `goal` is the share of its focus level.
   * A content gives a function that goes to the goal with time. Without it, the share is the goal.
   */
  readonly fade?: ((key: string, goal: number) => number) | undefined;
}

/** The key of the labels that name no record, for `fade`. */
export const FREE_LABELS = "labels";

/** The distance out of the view at which a record keeps its shapes, in units of a look. A ring, a sign or a wide line can be this far from its record. */
export const VIEW_MARGIN = 24;

/** The height of a bar of a label, as a share of the height of its line. */
export const BAR_HEIGHT = 0.42;

/** The width of the line around the letters of a label, as a share of the height of its line. */
export const HALO_WIDTH = 0.25;

/** The half width of an arrow at the end of a route, as a share of its length. */
export const ARROW_SPREAD = 0.45;

/** The smallest distance between two labels that keep a height on the screen, in units of a look. */
export const KEPT_GAP = 4;

/** This function gives the key of a record for `fade`: its type, a colon and its id. A box and a route with the same id have different keys. */
export function recordKey(type: PictureRecord["type"], id: string): string {
  return `${type}:${id}`;
}

/** This function gives the state of a box for its look. */
export function boxState(index: PictureIndex, box: PictureBox, state: PaintState): RecordState {
  return { highlight: state.highlight(box.id), focus: boxFocus(state.focus, box), zoom: state.zoom, container: index.children.has(box.id) };
}

/** This function gives the state of a route for its look. */
export function routeState(route: PictureRoute, state: PaintState): RecordState {
  return { highlight: state.highlight(route.id), focus: routeFocus(state.focus, route), zoom: state.zoom, container: false };
}

/** This function gives the outline of a box, larger by `more` at each side. A polygon does not become larger. */
function outlineOf(box: PictureBox, radius: number, more: number): PaintOutline {
  const region: Region = box.shape === undefined ? { kind: "rect", x: box.x, y: box.y, w: box.w, h: box.h } : translate(box.shape, box.x, box.y);
  switch (region.kind) {
    case "rect": {
      const w = Math.max(0, region.w + 2 * more);
      const h = Math.max(0, region.h + 2 * more);
      return { kind: "rect", x: region.x - more, y: region.y - more, w, h, radius: Math.max(0, Math.min(radius + more, w / 2, h / 2)) };
    }
    case "circle":
      return { kind: "ellipse", cx: region.cx, cy: region.cy, rx: Math.max(0, region.r + more), ry: Math.max(0, region.r + more) };
    case "ellipse":
      return { kind: "ellipse", cx: region.cx, cy: region.cy, rx: Math.max(0, region.rx + more), ry: Math.max(0, region.ry + more) };
    case "polygon":
      return { kind: "polygon", rings: region.holes === undefined ? [region.points] : [region.points, ...region.holes] };
  }
}

/** This function gives the lengths of a dash in the unit of the picture. */
function dashOf(dash: readonly number[] | undefined, unit: number): readonly number[] | undefined {
  return dash === undefined || dash.length === 0 ? undefined : dash.map((length) => length * unit);
}

/** This function adds the shapes of a box: its ring, its inside and border, and its signs. */
function addBox(shapes: PaintShape[], box: PictureBox, look: BoxLook, unit: number, share: number): void {
  const opacity = Math.min(1, (look.opacity ?? 1) * share);
  if (!(opacity > 0)) return;
  const radius = look.radius ?? 0;
  if (look.ring !== undefined) {
    const more = (look.ring.gap + look.ring.width / 2) * unit;
    shapes.push({ type: "shape", outline: outlineOf(box, radius, more), stroke: look.ring.color, lineWidth: look.ring.width * unit, opacity });
  }
  if (look.fill !== undefined || look.stroke !== undefined) {
    const line = look.stroke === undefined ? undefined : (look.width ?? 1) * unit;
    shapes.push({ type: "shape", outline: outlineOf(box, radius, 0), fill: look.fill, stroke: look.stroke, lineWidth: line, dash: dashOf(look.dash, unit), opacity });
  }
  for (const mark of look.marks ?? []) {
    const r = Math.max(0, mark.radius * unit);
    const outline: PaintOutline = { kind: "ellipse", cx: box.x + mark.x, cy: box.y + mark.y, rx: r, ry: r };
    if (mark.shape === "dot") shapes.push({ type: "shape", outline, fill: mark.color, opacity });
    else shapes.push({ type: "shape", outline, stroke: mark.color, lineWidth: (mark.width ?? 1.5) * unit, opacity });
  }
}

/** This function gives the share of the free width of a label that is at the left of a line: 0, a half or 1. */
function leftShare(label: PictureLabel): number {
  return label.align === "center" ? 0.5 : label.align === "right" ? 1 : 0;
}

/**
 * This function gives the factor by which a label becomes larger, so that a line is `least` CSS pixels high on the screen.
 * The factor is 1 for a label that is high enough.
 */
function keptScale(label: PictureLabel, least: number, zoom: number): number {
  const tall = label.lineHeight * zoom;
  return tall > 0 && tall < least ? least / tall : 1;
}

/**
 * This function gives the rectangle of the lines of a label that is larger by a factor. `wide` is the width of the lines before the factor.
 * The middle of the height of the lines keeps its place. A line keeps its left end, its middle or its right end, as the label aligns it.
 */
function keptRect(label: PictureLabel, wide: number, scale: number): Rect {
  const left = leftShare(label);
  const tall = label.lines.length * label.lineHeight;
  return { x: label.x + left * label.w - left * wide * scale, y: label.y + (tall - tall * scale) / 2, w: wide * scale, h: tall * scale };
}

/** A label that keeps a height on the screen, before it has a place. */
interface KeptLabel {
  readonly label: PictureLabel;
  readonly look: LabelLook;
  readonly scale: number;
  readonly opacity: number;
  /** The highlight of the record that the label names. */
  readonly highlight: Highlight;
  /** The area of the box that the label names, or 0. */
  readonly area: number;
}

/** This function gives the start of a span that is in an area, on one axis. A span that is longer than the area keeps its start. */
function startIn(start: number, length: number, areaStart: number, areaLength: number): number {
  if (length > areaLength) return start;
  return Math.min(Math.max(start, areaStart), areaStart + areaLength - length);
}

/**
 * This function moves a rectangle that an edge of the view cuts, so that all of it is in the view.
 * `pad` is the distance that stays between the rectangle and each edge of the view.
 * A rectangle that is longer than the view on an axis keeps its place on that axis. A rectangle with no part in the view keeps its place.
 */
function movedIn(rect: Rect, view: Rect, pad: number): Rect {
  const overlap = overlapOf(rect, view);
  if (!(overlap.x > 0 && overlap.y > 0)) return rect;
  return { ...rect, x: startIn(rect.x, rect.w, view.x + pad, view.w - 2 * pad), y: startIn(rect.y, rect.h, view.y + pad, view.h - 2 * pad) };
}

/**
 * This function adds the texts of a label that keeps a height on the screen. `rect` is the rectangle of its lines.
 * `dx` is the distance that the rectangle moved on the x axis, into the view.
 */
function addKept(shapes: PaintShape[], kept: KeptLabel, rect: Rect, dx: number): void {
  const { label, look, scale, opacity } = kept;
  const tall = label.lineHeight * scale;
  const halo = look.halo === undefined ? undefined : { color: look.halo, width: tall * HALO_WIDTH };
  const x = label.x + leftShare(label) * label.w + dx;
  for (let i = 0; i < label.lines.length; i++) {
    const text = label.lines[i]!;
    if (text.trim() === "") continue;
    shapes.push({ type: "text", text, x, y: rect.y + (i + 0.5) * tall, font: label.font, align: label.align ?? "left", fill: look.color, halo, opacity, scale });
  }
}

/** This function adds the shapes of a label: one text or one bar for each line that is not empty. */
function addLabel(shapes: PaintShape[], label: PictureLabel, look: LabelLook, share: number, measure: PaintState["measure"]): void {
  const opacity = Math.min(1, (look.opacity ?? 1) * share);
  if (!(opacity > 0)) return;
  const align = label.align ?? "left";
  const left = leftShare(label);
  for (let i = 0; i < label.lines.length; i++) {
    const text = label.lines[i]!;
    if (text.trim() === "") continue;
    const y = label.y + (i + 0.5) * label.lineHeight;
    if (look.as !== "bars") {
      const halo = look.halo === undefined ? undefined : { color: look.halo, width: label.lineHeight * HALO_WIDTH };
      shapes.push({ type: "text", text, x: label.x + left * label.w, y, font: label.font, align, fill: look.color, halo, opacity });
      continue;
    }
    const measured = measure === undefined ? label.w : measure(label.font, text);
    const wide = label.w > 0 ? Math.min(measured, label.w) : measured;
    if (!(wide > 0)) continue;
    const tall = label.lineHeight * BAR_HEIGHT;
    const outline: PaintOutline = { kind: "rect", x: label.x + left * (label.w - wide), y: y - tall / 2, w: wide, h: tall, radius: Math.min(tall, wide) / 2 };
    shapes.push({ type: "shape", outline, fill: look.color, opacity });
  }
}

/** This function adds the sign at one end of a route. `out` is 1 at the target and -1 at the source: an arrow points out of the route. */
function addEnd(shapes: PaintShape[], at: PathTangent, out: 1 | -1, end: RouteEnd, stroke: string, lineWidth: number, unit: number, opacity: number): void {
  const size = end.size * unit;
  if (!(size > 0)) return;
  const { point } = at;
  if (end.shape === "dot") {
    shapes.push({ type: "shape", outline: { kind: "ellipse", cx: point.x, cy: point.y, rx: size, ry: size }, fill: stroke, opacity });
    return;
  }
  const dx = at.direction.x * out;
  const dy = at.direction.y * out;
  // A path with no length has no direction, so it has no arrow.
  if (dx === 0 && dy === 0) return;
  // The arrow is two lines from its point back to each side of the route.
  const backX = point.x - dx * size;
  const backY = point.y - dy * size;
  const half = size * ARROW_SPREAD;
  const path: PathSegment[] = [
    { kind: "move", to: { x: backX - dy * half, y: backY + dx * half } },
    { kind: "line", to: point },
    { kind: "line", to: { x: backX + dy * half, y: backY - dx * half } },
  ];
  shapes.push({ type: "shape", outline: { kind: "path", path }, stroke, lineWidth, opacity });
}

/** This function adds the shapes of a route: its line, and the signs at its ends. */
function addRoute(shapes: PaintShape[], route: PictureRoute, look: RouteLook, unit: number, share: number): void {
  const opacity = Math.min(1, (look.opacity ?? 1) * share);
  if (!(opacity > 0)) return;
  const lineWidth = (look.width ?? 1.25) * unit;
  shapes.push({ type: "shape", outline: { kind: "path", path: route.path }, stroke: look.stroke, lineWidth, dash: dashOf(look.dash, unit), opacity });
  if (look.start !== undefined) addEnd(shapes, pathStart(route.path), -1, look.start, look.stroke, lineWidth, unit, opacity);
  if (look.end !== undefined) addEnd(shapes, pathEnd(route.path), 1, look.end, look.stroke, lineWidth, unit, opacity);
}

/**
 * This function gives the paint list of a picture: the shapes that a renderer draws, in the order of the paint.
 * The function is pure, so a test examines a picture with no browser. `drawShapes` draws the list on a canvas.
 *
 * The layers are, from the back:
 *
 * - The boxes with children, each with its labels.
 * - The routes. The routes of the focus and those with a highlight are after the others.
 * - The boxes with no child, each with its labels.
 * - The labels of the routes, then the labels that name no record.
 * - The labels that keep a height on the screen (`least` of a label look).
 *
 * In a layer, the records are in the order of the picture. A label has the state of the record that it names.
 * The focus of the picture decreases the color of each record out of it (`FOCUS_OPACITY`).
 */
export function paintPicture<T>(index: PictureIndex, looks: PictureLooks<T>, theme: T, state: PaintState): PaintShape[] {
  const { picture } = index;
  const unit = lookUnit(state.zoom);
  const margin = VIEW_MARGIN * unit;
  const { visible, measure, zoom } = state;
  const inView = (rect: Rect): boolean => {
    if (visible === undefined) return true;
    const overlap = overlapOf(grow(rect, margin), visible);
    return overlap.x >= 0 && overlap.y >= 0;
  };
  /** This function tells if a label can be in view: at its place, or with the largest height that a label keeps. */
  const near = (label: PictureLabel): boolean => {
    if (inView(label)) return true;
    const most = keptScale(label, MOST_KEPT_LINE, zoom);
    return most > 1 && inView(keptRect(label, label.w, most));
  };
  const shareOf = (key: string, level: FocusLevel): number => {
    const goal = FOCUS_OPACITY[level];
    return state.fade === undefined ? goal : state.fade(key, goal);
  };
  const kept: KeptLabel[] = [];
  /** This function adds the shapes of a label at its place, or keeps a label that is larger than its place for the top layer. */
  const place = (shapes: PaintShape[], label: PictureLabel, look: LabelLook | undefined, share: number, highlight: Highlight, area: number): void => {
    if (look === undefined) return;
    const scale = look.least === undefined || look.as === "bars" ? 1 : keptScale(label, Math.min(look.least, MOST_KEPT_LINE), zoom);
    if (scale > 1) {
      const opacity = Math.min(1, (look.opacity ?? 1) * share);
      if (opacity > 0) kept.push({ label, look, scale, opacity, highlight, area });
    } else if (inView(label)) addLabel(shapes, label, look, share, measure);
  };

  const containers: PaintShape[] = [];
  const leaves: PaintShape[] = [];
  for (const box of picture.boxes) {
    const labels = index.boxLabels.get(box.id) ?? [];
    const shown = inView(box);
    if (!shown && !labels.some(near)) continue;
    const boxIs = boxState(index, box, state);
    const look = looks.box(box, boxIs, theme);
    if (look === undefined) continue;
    const share = shareOf(recordKey("box", box.id), boxIs.focus);
    const shapes = boxIs.container ? containers : leaves;
    if (shown) addBox(shapes, box, look, unit, share);
    const record: PictureRecord = { type: "box", id: box.id, box };
    for (const label of labels) if (near(label)) place(shapes, label, looks.label(label, boxIs, theme, record), share, boxIs.highlight, box.w * box.h);
  }

  const back: PaintShape[] = [];
  const front: PaintShape[] = [];
  const routeLabels: PaintShape[] = [];
  for (const route of picture.routes) {
    const line = routeLine(route);
    if (line === undefined) continue;
    const labels = index.routeLabels.get(route.id) ?? [];
    const shown = inView(line.bounds);
    if (!shown && !labels.some(near)) continue;
    const routeIs = routeState(route, state);
    const look = looks.route(route, routeIs, theme);
    if (look === undefined) continue;
    const share = shareOf(recordKey("route", route.id), routeIs.focus);
    if (shown) addRoute(routeIs.focus === "in" || routeIs.highlight > 0 ? front : back, route, look, unit, share);
    const record: PictureRecord = { type: "route", id: route.id, route };
    for (const label of labels) if (near(label)) place(routeLabels, label, looks.label(label, routeIs, theme, record), share, routeIs.highlight, 0);
  }

  const free: PaintShape[] = [];
  if (index.freeLabels.length > 0) {
    const level: FocusLevel = state.focus === undefined ? "all" : "out";
    const labelIs: RecordState = { highlight: 0, focus: level, zoom: state.zoom, container: false };
    const share = shareOf(FREE_LABELS, level);
    for (const label of index.freeLabels) if (near(label)) place(free, label, looks.label(label, labelIs, theme, undefined), share, 0, 0);
  }

  const top: PaintShape[] = [];
  if (kept.length > 0) {
    // The sort keeps the order of two labels of the same rank: the boxes, then the routes, then the labels that name no record.
    kept.sort((a, b) => b.highlight - a.highlight || b.area - a.area);
    const gap = KEPT_GAP * unit;
    const taken: Rect[] = [];
    for (const item of kept) {
      const { label } = item;
      const lines = label.lines.filter((line) => line.trim() !== "");
      if (lines.length === 0) continue;
      let wide = measure === undefined ? label.w : Math.max(...lines.map((line) => measure(label.font, line)));
      if (label.w > 0) wide = Math.min(wide, label.w);
      const natural = keptRect(label, wide, item.scale);
      if (!inView(natural)) continue;
      // A text that an edge of the view cuts moves into the view, before it takes its place.
      const rect = visible === undefined ? natural : movedIn(natural, visible, gap);
      const space = grow(rect, gap);
      const clear = taken.every((other) => {
        const overlap = overlapOf(space, other);
        return !(overlap.x > 0 && overlap.y > 0);
      });
      if (!clear) continue;
      taken.push(rect);
      addKept(top, item, rect, rect.x - natural.x);
    }
  }
  return containers.concat(back, front, leaves, routeLabels, free, top);
}
