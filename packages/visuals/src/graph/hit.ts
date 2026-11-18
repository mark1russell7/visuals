import { pointPolylineDistance, pointRegionDistance, type PictureBox, type Point } from "@mark1russell7/layout-contract";
import { routeLine, type PictureIndex, type PictureRecord } from "./records.ts";

/** The options of `pickRecord`. */
export interface PickOptions {
  /** The distance from the point at which a record is below the point, in the unit of the picture. The default is 0. */
  readonly slack?: number | undefined;
  /** This function tells if a person can point at a record. The default permits each box and no route. */
  readonly picks?: ((record: PictureRecord) => boolean) | undefined;
}

/** This function gives the distance from a point to a box, and 0 for a point in the box. A box with a `shape` is that region. */
export function boxDistance(box: PictureBox, point: Point): number {
  if (box.shape === undefined) return pointRegionDistance(point, { kind: "rect", x: box.x, y: box.y, w: box.w, h: box.h });
  return pointRegionDistance({ x: point.x - box.x, y: point.y - box.y }, box.shape);
}

const boxesOnly = (record: PictureRecord): boolean => record.type === "box";

/**
 * This function gives the record of a picture below a point, or `undefined` for no record.
 *
 * - A box with no child comes first: the top box at the point, then the nearest box in the slack.
 * - A route comes next: the nearest route in the slack. A route is thin, so it comes before a container.
 * - A box with children comes last: the top one at the point, then the nearest one in the slack.
 *
 * The last record of a list of the picture is the top one. The distance to a route has an error of 0.5 units or less.
 */
export function pickRecord(index: PictureIndex, point: Point, options: PickOptions = {}): PictureRecord | undefined {
  const slack = Math.max(0, options.slack ?? 0);
  const picks = options.picks ?? boxesOnly;
  let leaf: PictureRecord | undefined;
  let nearLeaf: PictureRecord | undefined;
  let nearLeafAt = Infinity;
  let container: PictureRecord | undefined;
  let nearContainer: PictureRecord | undefined;
  let nearContainerAt = Infinity;
  for (const box of index.picture.boxes) {
    if (point.x < box.x - slack || point.x > box.x + box.w + slack || point.y < box.y - slack || point.y > box.y + box.h + slack) continue;
    const distance = boxDistance(box, point);
    if (distance > slack) continue;
    const record: PictureRecord = { type: "box", id: box.id, box };
    if (!picks(record)) continue;
    if (index.children.has(box.id)) {
      if (distance === 0) container = record;
      else if (distance <= nearContainerAt) {
        nearContainer = record;
        nearContainerAt = distance;
      }
    } else if (distance === 0) leaf = record;
    else if (distance <= nearLeafAt) {
      nearLeaf = record;
      nearLeafAt = distance;
    }
  }
  if (leaf !== undefined) return leaf;
  if (nearLeaf !== undefined) return nearLeaf;
  let found: PictureRecord | undefined;
  let foundAt = Infinity;
  for (const route of index.picture.routes) {
    const line = routeLine(route);
    if (line === undefined) continue;
    const { bounds } = line;
    if (point.x < bounds.x - slack || point.x > bounds.x + bounds.w + slack || point.y < bounds.y - slack || point.y > bounds.y + bounds.h + slack) continue;
    const record: PictureRecord = { type: "route", id: route.id, route };
    if (!picks(record)) continue;
    const distance = pointPolylineDistance(point, line.points);
    if (distance > slack || distance > foundAt) continue;
    found = record;
    foundAt = distance;
  }
  return found ?? container ?? nearContainer;
}
