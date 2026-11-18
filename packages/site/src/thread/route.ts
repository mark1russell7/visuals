import { curveOf, curveSpace, inputGraph, nearestSide, ROUTERS, SIDE_NORMAL, type CurveOptions } from "@mark1russell7/highways";
import { flattenInput, topBoxes, type LayoutBox, type LayoutEdge, type PictureRouteSource } from "@mark1russell7/layout-contract";

/** The options of `routeThread`. */
export interface RouteOptions {
  /** The name of a router of `highways`. The default is `corners`. A name that is not a router gives the first router. */
  readonly router?: string | undefined;
  /** The curve through the points of each route. The default is `spline`. */
  readonly curve?: CurveOptions["type"] | undefined;
  /**
   * With `true`, the edges to one target are one collection. A router with shared ways gives them one trunk.
   * The default is `false`.
   */
  readonly bundle?: boolean | undefined;
}

/** The radius of the corners of a curve that is not a spline. */
const CORNER = 18;

/**
 * This function routes edges between placed boxes with a router of `highways`. It gives the points and the path of each route.
 *
 * - The router gets the flat input of `flattenInput`, where each card is one obstacle.
 * - The row of an edge is a plug on the border of its card.
 * - A spline leaves a box at a right angle to its side, and it goes around the boxes.
 * - An edge with its two ends in one card has no route. An edge with an end that has no place has none.
 */
export function routeThread(id: string, boxes: readonly LayoutBox[], edges: readonly LayoutEdge[], options: RouteOptions = {}): PictureRouteSource[] {
  const placed = new Set(boxes.filter((box) => box.x !== undefined && box.y !== undefined).map((box) => box.id));
  const top = topBoxes(boxes);
  const inner = (end: string): boolean => placed.has(end) && placed.has(top.get(end) ?? end);
  const wanted = edges.filter((edge) => inner(edge.source) && inner(edge.target));
  if (wanted.length === 0) return [];
  const sent = options.bundle === true ? wanted.map((edge): LayoutEdge => ({ ...edge, data: { ...edge.data, collection: top.get(edge.target) ?? edge.target } })) : wanted;
  const flat = flattenInput({ schema: "layout-input/1", id, boxes: boxes.filter((box) => placed.has(top.get(box.id) ?? box.id) && placed.has(box.id)), edges: sent });
  if ((flat.edges ?? []).length === 0) return [];
  const graph = inputGraph(flat);
  const router = ROUTERS.find((entry) => entry.name === (options.router ?? "corners")) ?? ROUTERS[0];
  if (router === undefined) return [];
  const boxOf = new Map(graph.nodes.map((node) => [node.id, node.box]));
  const space = curveSpace(graph.nodes.map((node) => node.box));
  const ends = new Map((flat.edges ?? []).map((edge) => [edge.id, edge]));
  const type = options.curve ?? "spline";
  const out: PictureRouteSource[] = [];
  for (const route of router.route(graph).routes) {
    const { points } = route;
    const first = points[0];
    const last = points[points.length - 1];
    const edge = ends.get(route.edge);
    if (first === undefined || last === undefined || points.length < 2 || edge === undefined) continue;
    const source = boxOf.get(edge.source);
    const target = boxOf.get(edge.target);
    const curve: CurveOptions =
      type === "spline" && source !== undefined && target !== undefined
        ? { type, startNormal: SIDE_NORMAL[nearestSide(source, first)], endNormal: SIDE_NORMAL[nearestSide(target, last)], space }
        : { type, radius: CORNER, space };
    out.push({ edge: route.edge, points, path: curveOf(points, curve) });
  }
  return out;
}
