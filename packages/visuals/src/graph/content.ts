import { pictureBounds, type LayoutPicture, type PictureRoute, type Rect } from "@mark1russell7/layout-contract";
import type { Highlight } from "../highlight.ts";
import { approach } from "../motion.ts";
import { drawShapes } from "./draw.ts";
import { boxFocus, FOCUS_OPACITY, focusOf, routeFocus, type PictureFocus } from "./focus.ts";
import { pickRecord } from "./hit.ts";
import type { PictureLooks } from "./looks.ts";
import { boxState, FREE_LABELS, paintPicture, recordKey, routeState, type PaintState } from "./paint.ts";
import { indexPicture, type PictureIndex, type PictureRecord } from "./records.ts";
import type { PictureContent } from "./stage.ts";

/** The time in which the color of a record goes most of the way to its goal after a change of the focus, in seconds. */
export const FOCUS_FADE = 0.08;

/** The bounds of a picture with no record. */
const NO_BOUNDS: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** The largest number of text widths that a content keeps. */
const MOST_WIDTHS = 4000;

const NO_SEEDS: readonly string[] = [];

/** The options of `createPictureContent`. `T` is the type of the theme. */
export interface PictureContentOptions<T> {
  /** The looks of the records. `plainLooks` gives the looks of a plain picture. */
  readonly looks: PictureLooks<T>;
  /** This function tells if a person can point at a record. The default permits each box and no route. */
  readonly picks?: ((record: PictureRecord) => boolean) | undefined;
  /**
   * The records of the focus. With `selection`, the selected record and the records at it stay clear, and each other record has less color.
   * With `none`, the picture has no focus until the page gives one with `setFocus`. The default is `selection`.
   */
  readonly focus?: "selection" | "none" | undefined;
}

/** The options of `setPicture` of a picture content. */
export interface SetPictureOptions {
  /**
   * With `true`, the colors go from the picture before to this picture in a short time, as after a change of the focus.
   * A record that the picture before did not have starts with no color. Use it for a picture with more routes between the same boxes.
   * The default is `false`: the first drawing of the picture has its colors at their goals.
   */
  readonly fade?: boolean | undefined;
}

/** The content of a flat stage that shows a picture of `@mark1russell7/layout-contract`. The value of a pick is the record. */
export interface LayoutPictureContent<T> extends PictureContent<PictureRecord, T> {
  /** This function shows a different picture, for example after a new layout. Start `refresh` of the stage after it. */
  setPicture(picture: LayoutPicture, options?: SetPictureOptions): void;
  /**
   * This function sets the records of the focus by their names. An empty list gives no focus.
   * `undefined` gives the focus of the options again. Start `refresh` of the stage after it.
   */
  setFocus(records: readonly string[] | undefined): void;
}

const boxesOnly = (record: PictureRecord): boolean => record.type === "box";

/**
 * This function makes the content of a flat stage from a picture: its boxes, its routes and its labels.
 *
 * - The looks give the colors, the lines and the signs of each record from its state.
 * - A person points at the top box below the pointer, or at a route that the option `picks` permits.
 * - A change of the focus changes the colors in a short time.
 * - The content makes shapes only for the records in view.
 *
 * The picture must be good (`checkPicture` of `@mark1russell7/layout-contract`). The content does not change it.
 */
export function createPictureContent<T>(picture: LayoutPicture, options: PictureContentOptions<T>): LayoutPictureContent<T> {
  const { looks } = options;
  const permits = options.picks ?? boxesOnly;
  const bySelection = (options.focus ?? "selection") === "selection";
  let index = indexPicture(picture);
  let bounds = pictureBounds(picture) ?? NO_BOUNDS;
  /** The records of `setFocus`, or `undefined` for the focus of the options. */
  let asked: readonly string[] | undefined;
  /** The names from which the focus of the last picture came. */
  let seeds: readonly string[] = NO_SEEDS;
  let focus: PictureFocus | undefined;
  /** This value is true until the first picture of a picture. The first focus has no change with time. */
  let fresh = true;
  /** The records of the picture before a `setPicture` with `fade`, until the next drawing. */
  let before: PictureIndex | undefined;
  /** The color share of each record whose share changes, by the key of the record. */
  const fades = new Map<string, { value: number; goal: number }>();
  /**
   * The theme and the state of the last picture. A person cannot point at a record that the last picture did not show.
   * `larger` has the boxes that are larger around their names, in the order of the paint.
   */
  let last: { readonly theme: T; readonly state: PaintState; readonly larger: readonly { readonly id: string; readonly rect: Rect }[] } | undefined;
  /** The width of each text that the content measured, by its font and its text. */
  const widths = new Map<string, number>();

  const widthOf = (context: CanvasRenderingContext2D, font: string, text: string): number => {
    const key = `${font}\n${text}`;
    const known = widths.get(key);
    if (known !== undefined) return known;
    const before = context.font;
    context.font = font;
    const width = context.measureText(text).width;
    context.font = before;
    if (widths.size >= MOST_WIDTHS) widths.clear();
    widths.set(key, width);
    return width;
  };

  /** This function gives the names from which the focus comes. */
  const seedsOf = (highlight: (record: string) => Highlight): readonly string[] => {
    if (asked !== undefined) return asked;
    if (!bySelection) return NO_SEEDS;
    const out: string[] = [];
    for (const id of index.boxes.keys()) if (highlight(id) === 2) out.push(id);
    for (const id of index.routes.keys()) if (!index.boxes.has(id) && highlight(id) === 2) out.push(id);
    return out;
  };

  /** This function starts the change of the color of each record whose focus level changes. A change that continues starts from its value. */
  const fadeTo = (next: PictureFocus | undefined): void => {
    const add = (key: string, from: number, goal: number): void => {
      const value = fades.get(key)?.value ?? from;
      if (value === goal) fades.delete(key);
      else fades.set(key, { value, goal });
    };
    // A record that the picture before did not have starts with no color.
    const was = before;
    for (const box of index.picture.boxes) add(recordKey("box", box.id), was !== undefined && !was.boxes.has(box.id) ? 0 : FOCUS_OPACITY[boxFocus(focus, box)], FOCUS_OPACITY[boxFocus(next, box)]);
    for (const route of index.picture.routes) add(recordKey("route", route.id), was !== undefined && !was.routes.has(route.id) ? 0 : FOCUS_OPACITY[routeFocus(focus, route)], FOCUS_OPACITY[routeFocus(next, route)]);
    if (index.freeLabels.length > 0) add(FREE_LABELS, FOCUS_OPACITY[focus === undefined ? "all" : "out"], FOCUS_OPACITY[next === undefined ? "all" : "out"]);
  };

  return {
    get bounds(): Rect {
      return bounds;
    },
    has: (record) => index.boxes.has(record) || index.routes.has(record),
    pick(at) {
      const known = last;
      const state: PaintState | undefined = known === undefined ? undefined : { ...known.state, zoom: at.view.k };
      const shown = (record: PictureRecord): boolean => {
        if (!permits(record)) return false;
        if (known === undefined || state === undefined) return true;
        if (record.type === "box") return looks.box(record.box, boxState(index, record.box, state), known.theme) !== undefined;
        return looks.route(record.route, routeState(record.route, state), known.theme) !== undefined;
      };
      // A box that is larger around its name is on top of each other shape, so the pointer finds it first.
      const { x, y } = at.point;
      for (const { id, rect } of known?.larger ?? []) {
        if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) continue;
        const box = index.boxes.get(id);
        if (box === undefined) continue;
        const value: PictureRecord = { type: "box", id, box };
        if (shown(value)) return { record: id, value };
      }
      const record = pickRecord(index, at.point, { slack: at.slack / at.view.k, picks: shown });
      return record === undefined ? undefined : { record: record.id, value: record };
    },
    draw(context, frame, theme, highlight) {
      const { view } = frame;
      const from = seedsOf(highlight);
      if (fresh || before !== undefined || from.length !== seeds.length || from.some((id, i) => id !== seeds[i])) {
        // A route that the looks do not show brings no box into the focus. The looks get the state of a picture with no focus.
        const plain: PaintState = { zoom: view.k, highlight };
        const shown = (route: PictureRoute): boolean => looks.route(route, routeState(route, plain), theme) !== undefined;
        const next = from.length === 0 ? undefined : focusOf(index, from, { routes: shown });
        if (fresh || frame.settle) fades.clear();
        else fadeTo(next);
        seeds = from;
        focus = next;
        fresh = false;
        before = undefined;
      }
      if (frame.settle) fades.clear();
      for (const [key, fade] of fades) {
        fade.value = approach(fade.value, fade.goal, frame.seconds, FOCUS_FADE);
        if (fade.value === fade.goal) fades.delete(key);
      }
      const { area } = frame;
      const state: PaintState = {
        zoom: view.k,
        highlight,
        focus,
        visible: { x: (0 - view.x) / view.k, y: (0 - view.y) / view.k, w: frame.width / view.k, h: frame.height / view.k },
        // The free area of the stage: a name that keeps a height stays out from below the controls of the page.
        free: { x: (area.x - view.x) / view.k, y: (area.y - view.y) / view.k, w: area.w / view.k, h: area.h / view.k },
        measure: (font, text) => widthOf(context, font, text),
        fade: fades.size === 0 ? undefined : (key, goal) => fades.get(key)?.value ?? goal,
      };
      const shapes = paintPicture(index, looks, theme, state);
      const larger: { id: string; rect: Rect }[] = [];
      for (const shape of shapes) if (shape.type === "shape" && shape.box !== undefined && shape.outline.kind === "rect") larger.push({ id: shape.box, rect: shape.outline });
      last = { theme, state, larger };
      drawShapes(context, shapes, view);
      return fades.size > 0;
    },
    setPicture(next, more) {
      // A picture with a fade keeps the records of the last picture that the content drew. A picture with no drawing has nothing to change from.
      before = more?.fade === true && !fresh ? (before ?? index) : undefined;
      index = indexPicture(next);
      bounds = pictureBounds(next) ?? NO_BOUNDS;
      last = undefined;
      if (before !== undefined) return;
      fades.clear();
      fresh = true;
    },
    setFocus(records) {
      asked = records === undefined ? undefined : [...records];
    },
    dispose() {
      fades.clear();
      widths.clear();
      last = undefined;
    },
  };
}
