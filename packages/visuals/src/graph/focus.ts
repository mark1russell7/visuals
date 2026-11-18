import type { PictureBox, PictureRoute } from "@mark1russell7/layout-contract";
import type { PictureIndex } from "./records.ts";

/** The focus of a picture: the records that stay clear, while each other record has less color. */
export interface PictureFocus {
  /** The ids of the boxes of the focus. */
  readonly boxes: ReadonlySet<string>;
  /** The ids of the routes of the focus. */
  readonly routes: ReadonlySet<string>;
}

/**
 * How near a record is to the focus of a picture.
 *
 * - `all`: the picture has no focus, so each record is clear.
 * - `in`: the record is in the focus.
 * - `beside`: the box is not in the focus, and its parent is. An example is a different row of the card of the selection.
 * - `out`: the record is not in the focus.
 */
export type FocusLevel = "all" | "in" | "beside" | "out";

/** The share of the color that a record keeps at each focus level. */
export const FOCUS_OPACITY: Readonly<Record<FocusLevel, number>> = { all: 1, in: 1, beside: 0.55, out: 0.2 };

/** The options of `focusOf`. */
export interface FocusOptions {
  /**
   * This function tells if a route at a box of the list is in the focus. The default permits each route.
   * A content gives the routes that its looks show, so a route with no line brings no box. A route of the list is in the focus in each case.
   */
  readonly routes?: ((route: PictureRoute) => boolean) | undefined;
}

/**
 * This function gives the focus of a list of records, or `undefined` when the picture has none of them.
 *
 * - A box brings each box below it in the tree.
 * - Each route at one of these boxes is in the focus, with the box at its other end. The option `routes` can refuse a route.
 * - A route brings its two boxes.
 * - Each box of the focus brings each box above it in the tree, so the card of a row stays clear.
 */
export function focusOf(index: PictureIndex, seeds: Iterable<string>, options: FocusOptions = {}): PictureFocus | undefined {
  const permits = options.routes;
  const boxes = new Set<string>();
  const routes = new Set<string>();
  /** The boxes of the list, and each box below them. */
  const own: string[] = [];
  const addRoute = (route: PictureRoute): void => {
    routes.add(route.id);
    if (index.boxes.has(route.source)) boxes.add(route.source);
    if (index.boxes.has(route.target)) boxes.add(route.target);
  };
  const seedRoutes: PictureRoute[] = [];
  for (const seed of seeds) {
    const route = index.routes.get(seed);
    if (route !== undefined) seedRoutes.push(route);
    if (!index.boxes.has(seed)) continue;
    const stack = [seed];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      if (boxes.has(id)) continue;
      boxes.add(id);
      own.push(id);
      for (const child of index.children.get(id) ?? []) stack.push(child.id);
    }
  }
  for (const id of own) for (const route of index.routesAt.get(id) ?? []) if (permits === undefined || permits(route)) addRoute(route);
  for (const route of seedRoutes) addRoute(route);
  for (const id of [...boxes]) {
    // A box that is in the focus stops the way up: a different step adds the boxes above it.
    for (let parent = index.boxes.get(id)?.parent; parent !== undefined && index.boxes.has(parent) && !boxes.has(parent); parent = index.boxes.get(parent)?.parent) {
      boxes.add(parent);
    }
  }
  return boxes.size === 0 && routes.size === 0 ? undefined : { boxes, routes };
}

/** This function gives the focus level of a box. */
export function boxFocus(focus: PictureFocus | undefined, box: PictureBox): FocusLevel {
  if (focus === undefined) return "all";
  if (focus.boxes.has(box.id)) return "in";
  return box.parent !== undefined && focus.boxes.has(box.parent) ? "beside" : "out";
}

/** This function gives the focus level of a route: `all`, `in` or `out`. */
export function routeFocus(focus: PictureFocus | undefined, route: PictureRoute): FocusLevel {
  if (focus === undefined) return "all";
  return focus.routes.has(route.id) ? "in" : "out";
}
