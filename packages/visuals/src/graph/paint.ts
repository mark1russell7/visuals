import {
  boundsOf,
  grow,
  overlapOf,
  pathEnd,
  pathStart,
  rectCenter,
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

/** The image of a shape of a paint list. A renderer draws it in the bounds of the outline of the shape, and the outline cuts it. */
export interface PaintImage {
  /** The address of the image. */
  readonly src: string;
  /** With `contain`, all of the image is in the bounds. With `cover`, the image fills the bounds. */
  readonly fit: "contain" | "cover";
  /** The place of the image in the bounds on the x axis, from 0 to 1. With 0, the image starts at the left edge. */
  readonly alignX: number;
  /** The place of the image in the bounds on the y axis, from 0 to 1. With 0, the image starts at the top edge. */
  readonly alignY: number;
}

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
  /**
   * An image in the outline, above the color of the inside and below the line. Only a rectangle and an ellipse can have one.
   * A renderer with no image for the address draws the shape with no image.
   */
  readonly image?: PaintImage | undefined;
  /**
   * The id of a box, for the inside of a box that is larger around its name (`boxed` of a label look).
   * A content lets a person point at the box through this shape. Each other shape has no id.
   */
  readonly box?: string | undefined;
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
  /**
   * The part of `visible` that no control of a page covers. A text that keeps a height on the screen stays in it.
   * The default is `visible`.
   */
  readonly free?: Rect | undefined;
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

/** The side of a cell of the grid of the boxes with no child, in units of a look. A text that keeps a height finds the boxes near it in the grid. */
const LEAF_CELL = 128;

/** The boxes with no child in the view, in the cells of a grid. */
interface LeafGrid {
  readonly cell: number;
  readonly cells: Map<string, PictureBox[]>;
}

/** This function gives the range of the cells of a grid that a rectangle touches, on one axis. */
function cellSpan(start: number, length: number, cell: number): [number, number] {
  return [Math.floor(start / cell), Math.floor((start + Math.max(0, length)) / cell)];
}

/** This function puts each box into each cell of the grid that it touches. */
function leafGrid(boxes: readonly PictureBox[], cell: number): LeafGrid {
  const cells = new Map<string, PictureBox[]>();
  for (const box of boxes) {
    const [x0, x1] = cellSpan(box.x, box.w, cell);
    const [y0, y1] = cellSpan(box.y, box.h, cell);
    for (let i = x0; i <= x1; i++) {
      for (let j = y0; j <= y1; j++) {
        const key = `${String(i)},${String(j)}`;
        const list = cells.get(key);
        if (list === undefined) cells.set(key, [box]);
        else list.push(box);
      }
    }
  }
  return { cell, cells };
}

/** This function tells if a rectangle covers a box of the grid that is not the box `own`. */
function coversLeaf(grid: LeafGrid, rect: Rect, own: string | undefined): boolean {
  const [x0, x1] = cellSpan(rect.x, rect.w, grid.cell);
  const [y0, y1] = cellSpan(rect.y, rect.h, grid.cell);
  for (let i = x0; i <= x1; i++) {
    for (let j = y0; j <= y1; j++) {
      for (const box of grid.cells.get(`${String(i)},${String(j)}`) ?? []) {
        if (box.id === own) continue;
        const overlap = overlapOf(rect, box);
        if (overlap.x > 0 && overlap.y > 0) return true;
      }
    }
  }
  return false;
}

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

/** This function gives the outline of a rectangle with round corners, larger by `more` at each side. */
function roundRect(rect: Rect, radius: number, more: number): PaintOutline {
  const w = Math.max(0, rect.w + 2 * more);
  const h = Math.max(0, rect.h + 2 * more);
  return { kind: "rect", x: rect.x - more, y: rect.y - more, w, h, radius: Math.max(0, Math.min(radius + more, w / 2, h / 2)) };
}

/** This function gives the outline of a box, larger by `more` at each side. A polygon does not become larger. */
function outlineOf(box: PictureBox, radius: number, more: number): PaintOutline {
  const region: Region = box.shape === undefined ? { kind: "rect", x: box.x, y: box.y, w: box.w, h: box.h } : translate(box.shape, box.x, box.y);
  switch (region.kind) {
    case "rect":
      return roundRect(region, radius, more);
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

/** This function gives the share of its color that a box keeps, from its look and the share of its focus. */
function boxOpacity(look: BoxLook, share: number): number {
  return Math.min(1, (look.opacity ?? 1) * share);
}

/**
 * This function adds the ring of a box look, then its inside and border. `outline` gives the outline that is larger by a distance at each side.
 * `box` is the id of a box that is larger around its name: the inside gets the id.
 */
function addFrame(shapes: PaintShape[], outline: (more: number) => PaintOutline, look: BoxLook, unit: number, opacity: number, box?: string): void {
  if (look.ring !== undefined) {
    const more = (look.ring.gap + look.ring.width / 2) * unit;
    shapes.push({ type: "shape", outline: outline(more), stroke: look.ring.color, lineWidth: look.ring.width * unit, opacity });
  }
  if (look.fill !== undefined || look.stroke !== undefined) {
    const line = look.stroke === undefined ? undefined : (look.width ?? 1) * unit;
    const inside: PaintOutlined = { type: "shape", outline: outline(0), fill: look.fill, stroke: look.stroke, lineWidth: line, dash: dashOf(look.dash, unit), opacity };
    shapes.push(box === undefined ? inside : { ...inside, box });
  }
}

/** This function gives a place of an image on one axis: a share from 0 to 1. The default is the middle. */
function alignShare(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0.5 : Math.min(1, Math.max(0, value));
}

/** This function adds the image of a box: one shape with the area of the image as its outline. An image with no address or no area gets no shape. */
function addImage(shapes: PaintShape[], box: PictureBox, look: BoxLook, opacity: number): void {
  const image = look.image;
  if (image === undefined || image.src === "" || !(image.w > 0) || !(image.h > 0)) return;
  const area: Rect = { x: box.x + image.x, y: box.y + image.y, w: image.w, h: image.h };
  const paint: PaintImage = { src: image.src, fit: image.fit ?? "contain", alignX: alignShare(image.alignX), alignY: alignShare(image.alignY) };
  shapes.push({ type: "shape", outline: roundRect(area, image.radius ?? 0, 0), fill: image.fill, image: paint, opacity });
}

/** This function adds the signs of a box. */
function addMarks(shapes: PaintShape[], box: PictureBox, look: BoxLook, unit: number, opacity: number): void {
  for (const mark of look.marks ?? []) {
    const r = Math.max(0, mark.radius * unit);
    const outline: PaintOutline = { kind: "ellipse", cx: box.x + mark.x, cy: box.y + mark.y, rx: r, ry: r };
    if (mark.shape === "dot") shapes.push({ type: "shape", outline, fill: mark.color, opacity });
    else shapes.push({ type: "shape", outline, stroke: mark.color, lineWidth: (mark.width ?? 1.5) * unit, opacity });
  }
}

/** This function adds the shapes of a box: its ring, its inside and border, its image, and its signs. */
function addBox(shapes: PaintShape[], box: PictureBox, look: BoxLook, unit: number, share: number): void {
  const opacity = boxOpacity(look, share);
  if (!(opacity > 0)) return;
  const radius = look.radius ?? 0;
  addFrame(shapes, (more) => outlineOf(box, radius, more), look, unit, opacity);
  addImage(shapes, box, look, opacity);
  addMarks(shapes, box, look, unit, opacity);
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

/** The box that a label names, with its look and its shapes at its place. */
interface KeptBox {
  readonly box: PictureBox;
  readonly look: BoxLook;
  /** The share of its color that the box keeps from its focus. */
  readonly share: number;
  /** The shapes of the box at its place. A box out of the view has none. */
  readonly shapes: readonly PaintShape[];
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
  /** The box that the label names. */
  readonly of?: KeptBox | undefined;
}

/** A label that keeps a height on the screen, with its size, before it has a place. */
interface KeptPlan {
  readonly item: KeptLabel;
  /** The rectangle of the text. */
  readonly text: Rect;
  /** The rectangle that takes a place: the text, with the padding of a box that becomes larger. */
  readonly plate: Rect;
  /** The area that gives the order of the label: the area of its box, at the larger size of a box that becomes larger. */
  readonly size: number;
  /** The box that becomes larger around the text. */
  readonly of?: KeptBox | undefined;
}

/** This function gives the start of a span that is in an area, on one axis. A span that is longer than the area keeps its start. */
function startIn(start: number, length: number, areaStart: number, areaLength: number): number {
  if (length > areaLength) return start;
  return Math.min(Math.max(start, areaStart), areaStart + areaLength - length);
}

/**
 * This function gives the place of the rectangle of a text that keeps a height, or `undefined` for a text with no place.
 * `area` is the free part of the view, and `pad` is the distance that stays between the rectangle and each edge.
 *
 * - A rectangle that an edge of the area cuts moves, so that all of it is in the area.
 * - A rectangle that is longer than the area on an axis keeps its place on that axis.
 * - A rectangle with no part in the area moves into the part of `box` in the area, when that part has room for it.
 * - Each other rectangle below a control of the page has no place: it is in `view` and not in the area.
 * - A rectangle out of `view` keeps its place.
 */
function placeIn(rect: Rect, area: Rect, view: Rect, box: Rect | undefined, pad: number): Rect | undefined {
  const overlap = overlapOf(rect, area);
  if (overlap.x > 0 && overlap.y > 0) return { ...rect, x: startIn(rect.x, rect.w, area.x + pad, area.w - 2 * pad), y: startIn(rect.y, rect.h, area.y + pad, area.h - 2 * pad) };
  if (box !== undefined) {
    // The rectangle stays in its box, and it keeps the distance to each edge of the area.
    const x = Math.max(box.x, area.x + pad);
    const y = Math.max(box.y, area.y + pad);
    const w = Math.min(box.x + box.w, area.x + area.w - pad) - x;
    const h = Math.min(box.y + box.h, area.y + area.h - pad) - y;
    if (w >= rect.w && h >= rect.h) return { ...rect, x: startIn(rect.x, rect.w, x, w), y: startIn(rect.y, rect.h, y, h) };
  }
  const seen = overlapOf(rect, view);
  return seen.x > 0 && seen.y > 0 ? undefined : rect;
}

/** This function adds the texts of a label that keeps a height on the screen. `rect` is the rectangle of its lines. */
function addKept(shapes: PaintShape[], kept: KeptLabel, rect: Rect): void {
  const { label, look, scale, opacity } = kept;
  const tall = label.lineHeight * scale;
  const halo = look.halo === undefined ? undefined : { color: look.halo, width: tall * HALO_WIDTH };
  // A line keeps its left end, its middle or its right end in the rectangle, as the label aligns it.
  const x = rect.x + leftShare(label) * rect.w;
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
 * - The names of the boxes with no room to become larger around them (`boxed` of a label look).
 * - The labels that keep a height on the screen (`least` of a label look). A box that is larger around its name is below the name.
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
  const place = (shapes: PaintShape[], label: PictureLabel, look: LabelLook | undefined, share: number, highlight: Highlight, area: number, of?: () => KeptBox): void => {
    if (look === undefined) return;
    const scale = look.least === undefined || look.as === "bars" ? 1 : keptScale(label, Math.min(look.least, MOST_KEPT_LINE), zoom);
    if (scale > 1) {
      const opacity = Math.min(1, (look.opacity ?? 1) * share);
      if (opacity > 0) kept.push({ label, look, scale, opacity, highlight, area, of: of?.() });
    } else if (inView(label)) addLabel(shapes, label, look, share, measure);
  };

  const containers: PaintShape[] = [];
  const leaves: PaintShape[] = [];
  /** The boxes with no child in the view. A text with `clear` covers none of them. */
  const shownLeaves: PictureBox[] = [];
  for (const box of picture.boxes) {
    const labels = index.boxLabels.get(box.id) ?? [];
    const shown = inView(box);
    if (!shown && !labels.some(near)) continue;
    const boxIs = boxState(index, box, state);
    const look = looks.box(box, boxIs, theme);
    if (look === undefined) continue;
    const share = shareOf(recordKey("box", box.id), boxIs.focus);
    const shapes = boxIs.container ? containers : leaves;
    const from = shapes.length;
    if (shown) addBox(shapes, box, look, unit, share);
    if (shown && !boxIs.container) shownLeaves.push(box);
    const to = shapes.length;
    let own: KeptBox | undefined;
    const of = (): KeptBox => (own ??= { box, look, share, shapes: shapes.slice(from, to) });
    const record: PictureRecord = { type: "box", id: box.id, box };
    // A name that keeps a height can move into the part of its box in the view, so a box in the view gives each label.
    for (const label of labels) if (shown || near(label)) place(shapes, label, looks.label(label, boxIs, theme, record), share, boxIs.highlight, box.w * box.h, of);
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
  /** The names at their places of the boxes with no room for their larger size. */
  const small: PaintShape[] = [];
  /** The shapes at their places of the boxes that are larger around their names. The top layer has the paint of these boxes. */
  const replaced = new Set<PaintShape>();
  if (kept.length > 0) {
    const gap = KEPT_GAP * unit;
    const area = state.free ?? visible;
    const plans: KeptPlan[] = [];
    for (const item of kept) {
      const { label, look } = item;
      const lines = label.lines.filter((line) => line.trim() !== "");
      if (lines.length === 0) continue;
      let wide = measure === undefined ? label.w : Math.max(...lines.map((line) => measure(label.font, line)));
      if (label.w > 0) wide = Math.min(wide, label.w);
      const natural = keptRect(label, wide, item.scale);
      const boxed = look.boxed;
      const of = boxed === undefined ? undefined : item.of;
      if (boxed === undefined || of === undefined) {
        plans.push({ item, text: natural, plate: natural, size: item.area });
        continue;
      }
      // The name of a box that becomes larger has its middle at the middle of the box, and the plate is the name with its padding.
      const middle = rectCenter(of.box);
      const text = { ...natural, x: middle.x - natural.w / 2, y: middle.y - natural.h / 2 };
      const padX = Math.max(0, boxed.x) * unit;
      const padY = Math.max(0, boxed.y) * unit;
      const plate = grow(text, { top: padY, right: padX, bottom: padY, left: padX });
      plans.push({ item, text, plate, size: Math.max(of.box.w, plate.w) * Math.max(of.box.h, plate.h), of });
    }
    // The sort keeps the order of two labels of the same rank: the boxes, then the routes, then the labels that name no record.
    plans.sort((a, b) => b.item.highlight - a.item.highlight || (b.item.look.rank ?? 0) - (a.item.look.rank ?? 0) || b.size - a.size);
    const taken: Rect[] = [];
    let grid: LeafGrid | undefined;
    const coversOther = (rect: Rect, own: string | undefined): boolean => coversLeaf((grid ??= leafGrid(shownLeaves, LEAF_CELL * unit)), rect, own);
    for (const { item, text, plate, of } of plans) {
      // A text that an edge of the free area cuts moves into the area, before it takes its place.
      const placed = area === undefined ? plate : placeIn(plate, area, visible ?? area, item.of?.box, gap);
      // The larger box is the smallest rectangle around its box and the plate. Thus a text that moved stays in its box.
      const rect =
        placed === undefined || of === undefined
          ? placed
          : boundsOf({
              kind: "polygon",
              points: [
                [of.box.x, of.box.y],
                [of.box.x + of.box.w, of.box.y + of.box.h],
                [placed.x, placed.y],
                [placed.x + placed.w, placed.y + placed.h],
              ],
            });
      const clear =
        rect !== undefined &&
        inView(rect) &&
        taken.every((other) => {
          const overlap = overlapOf(grow(rect, gap), other);
          return !(overlap.x > 0 && overlap.y > 0);
        }) &&
        !(item.look.clear === true && coversOther(rect, item.of?.box.id));
      if (placed === undefined || rect === undefined || !clear) {
        // A box with no room for its larger size stays as it is, with its name at its place.
        // With `clear`, the name at its place is too small to read, so it has no paint.
        if (of !== undefined && item.look.clear !== true && inView(item.label)) addLabel(small, item.label, item.look, of.share, measure);
        continue;
      }
      taken.push(rect);
      if (of !== undefined) {
        const opacity = boxOpacity(of.look, of.share);
        if (opacity > 0) {
          const radius = (of.look.radius ?? 0) * item.scale;
          addFrame(top, (more) => roundRect(rect, radius, more), of.look, unit, opacity, of.box.id);
          addMarks(top, of.box, of.look, unit, opacity);
        }
        // The larger box has the paint of the box, so the box at its place has none.
        for (const shape of of.shapes) replaced.add(shape);
      }
      addKept(top, item, { ...text, x: text.x + placed.x - plate.x, y: text.y + placed.y - plate.y });
    }
  }
  const all = containers.concat(back, front, leaves, routeLabels, free, small, top);
  return replaced.size === 0 ? all : all.filter((shape) => !replaced.has(shape));
}
