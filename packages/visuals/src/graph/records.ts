import { pathBounds, samplePath, type LayoutPicture, type PictureBox, type PictureLabel, type PictureRoute, type Point, type Rect } from "@mark1russell7/layout-contract";

/**
 * A record of a picture that a person can point at: a box or a route. The name of the record is its id.
 * A box and a route with the same id are one record for the highlights of a stage.
 */
export type PictureRecord =
  | { readonly type: "box"; readonly id: string; readonly box: PictureBox }
  | { readonly type: "route"; readonly id: string; readonly route: PictureRoute };

/** The tables of a picture, for the functions that find its records. */
export interface PictureIndex {
  readonly picture: LayoutPicture;
  /** Each box by its id. */
  readonly boxes: ReadonlyMap<string, PictureBox>;
  /** Each route by its id. */
  readonly routes: ReadonlyMap<string, PictureRoute>;
  /** The children of each box that has children, in the order of the picture. A box with children is a container. */
  readonly children: ReadonlyMap<string, readonly PictureBox[]>;
  /** The routes that start or end at each box, in the order of the picture. */
  readonly routesAt: ReadonlyMap<string, readonly PictureRoute[]>;
  /** The labels that name each box, in the order of the picture. */
  readonly boxLabels: ReadonlyMap<string, readonly PictureLabel[]>;
  /** The labels that name each route, in the order of the picture. */
  readonly routeLabels: ReadonlyMap<string, readonly PictureLabel[]>;
  /** The labels that name no record, in the order of the picture. */
  readonly freeLabels: readonly PictureLabel[];
}

/** This function adds a value to the list of a key. */
function add<V>(lists: Map<string, V[]>, key: string, value: V): void {
  const list = lists.get(key);
  if (list === undefined) lists.set(key, [value]);
  else list.push(value);
}

/**
 * This function makes the tables of a picture. It does not examine the picture: `checkPicture` of `@mark1russell7/layout-contract` does that.
 * For an id that two boxes have, the table has the last box. A label that names a record that the picture does not have is in no table.
 * Thus a page that removes a route from a picture can keep the label of the route.
 */
export function indexPicture(picture: LayoutPicture): PictureIndex {
  const boxes = new Map<string, PictureBox>();
  const routes = new Map<string, PictureRoute>();
  const children = new Map<string, PictureBox[]>();
  const routesAt = new Map<string, PictureRoute[]>();
  const boxLabels = new Map<string, PictureLabel[]>();
  const routeLabels = new Map<string, PictureLabel[]>();
  const freeLabels: PictureLabel[] = [];
  for (const box of picture.boxes) {
    boxes.set(box.id, box);
    if (box.parent !== undefined) add(children, box.parent, box);
  }
  for (const route of picture.routes) {
    routes.set(route.id, route);
    add(routesAt, route.source, route);
    if (route.target !== route.source) add(routesAt, route.target, route);
  }
  for (const label of picture.labels) {
    if (label.box !== undefined) {
      if (boxes.has(label.box)) add(boxLabels, label.box, label);
    } else if (label.route !== undefined) {
      if (routes.has(label.route)) add(routeLabels, label.route, label);
    } else {
      freeLabels.push(label);
    }
  }
  return { picture, boxes, routes, children, routesAt, boxLabels, routeLabels, freeLabels };
}

/** The line of a route, for the functions that find it: its bounds, and a polyline that follows its path. */
export interface RouteLine {
  readonly bounds: Rect;
  /** The polyline is 0.5 units or less from the path. */
  readonly points: readonly Point[];
}

const lines = new WeakMap<PictureRoute, RouteLine>();

/**
 * This function gives the line of a route, or `undefined` for a route with an empty path.
 * It keeps the line of each route, so a second question about a route costs nothing.
 */
export function routeLine(route: PictureRoute): RouteLine | undefined {
  if (route.path.length === 0) return undefined;
  const known = lines.get(route);
  if (known !== undefined) return known;
  const line: RouteLine = { bounds: pathBounds(route.path), points: samplePath(route.path) };
  lines.set(route, line);
  return line;
}
