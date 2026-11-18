import { curveOf, curveSpace, inputGraph, nearestSide, ROUTERS, routerSession, SIDE_NORMAL, type CurveOptions, type Graph, type Result, type Router } from "@mark1russell7/highways";
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

/** The input of a router for some placed boxes and some edges, with the facts that the curves read. */
interface Ground {
  readonly router: Router;
  /** The graph of the flat input: each card is one node, and the row of an edge is a plug on the border of its card. */
  readonly graph: Graph;
  /** The curve through the points of each route. */
  readonly type: CurveOptions["type"];
  /** The ends of each edge of the flat input, by the id of the edge. */
  readonly ends: ReadonlyMap<string, LayoutEdge>;
  /** The rectangle of each node, by its id. */
  readonly boxOf: ReadonlyMap<string, Graph["nodes"][number]["box"]>;
  /** The space of the curves: the rectangles that a spline goes around. */
  readonly space: ReturnType<typeof curveSpace>;
}

/** This function makes the input of a router from placed boxes and edges. It gives `undefined` when no edge can have a route. */
function groundOf(id: string, boxes: readonly LayoutBox[], edges: readonly LayoutEdge[], options: RouteOptions): Ground | undefined {
  const placed = new Set(boxes.filter((box) => box.x !== undefined && box.y !== undefined).map((box) => box.id));
  const top = topBoxes(boxes);
  const inner = (end: string): boolean => placed.has(end) && placed.has(top.get(end) ?? end);
  const wanted = edges.filter((edge) => inner(edge.source) && inner(edge.target));
  if (wanted.length === 0) return undefined;
  const sent = options.bundle === true ? wanted.map((edge): LayoutEdge => ({ ...edge, data: { ...edge.data, collection: top.get(edge.target) ?? edge.target } })) : wanted;
  const flat = flattenInput({ schema: "layout-input/1", id, boxes: boxes.filter((box) => placed.has(top.get(box.id) ?? box.id) && placed.has(box.id)), edges: sent });
  if ((flat.edges ?? []).length === 0) return undefined;
  const graph = inputGraph(flat);
  const router = ROUTERS.find((entry) => entry.name === (options.router ?? "corners")) ?? ROUTERS[0];
  if (router === undefined) return undefined;
  return {
    router,
    graph,
    type: options.curve ?? "spline",
    ends: new Map((flat.edges ?? []).map((edge) => [edge.id, edge])),
    boxOf: new Map(graph.nodes.map((node) => [node.id, node.box])),
    space: curveSpace(graph.nodes.map((node) => node.box)),
  };
}

/** This function gives the points and the path of each route of a result of the router. A route with fewer than 2 points has no path. */
function curved(result: Result, ground: Ground): PictureRouteSource[] {
  const { type, space } = ground;
  const out: PictureRouteSource[] = [];
  for (const route of result.routes) {
    const { points } = route;
    const first = points[0];
    const last = points[points.length - 1];
    const edge = ground.ends.get(route.edge);
    if (first === undefined || last === undefined || points.length < 2 || edge === undefined) continue;
    const source = ground.boxOf.get(edge.source);
    const target = ground.boxOf.get(edge.target);
    const curve: CurveOptions =
      type === "spline" && source !== undefined && target !== undefined
        ? { type, startNormal: SIDE_NORMAL[nearestSide(source, first)], endNormal: SIDE_NORMAL[nearestSide(target, last)], space }
        : { type, radius: CORNER, space };
    out.push({ edge: route.edge, points, path: curveOf(points, curve) });
  }
  return out;
}

/**
 * This function routes edges between placed boxes with a router of `highways`. It gives the points and the path of each route.
 *
 * - The router gets the flat input of `flattenInput`, where each card is one obstacle.
 * - The row of an edge is a plug on the border of its card.
 * - A spline leaves a box at a right angle to its side, and it goes around the boxes.
 * - An edge with its two ends in one card has no route. An edge with an end that has no place has none.
 */
export function routeThread(id: string, boxes: readonly LayoutBox[], edges: readonly LayoutEdge[], options: RouteOptions = {}): PictureRouteSource[] {
  const ground = groundOf(id, boxes, edges, options);
  return ground === undefined ? [] : curved(ground.router.route(ground.graph), ground);
}

/** A router of the edges between the placed boxes of one picture. It routes some of its edges at a time. */
export interface ThreadRouter {
  /** This function gives the routes of some edges of the router, in the order of the router. An edge that the router does not have gets no route. */
  route(edges: readonly Pick<LayoutEdge, "id">[]): PictureRouteSource[];
  /** This function releases the work that the router keeps. A route after it is an error. */
  dispose(): void;
}

/**
 * This function makes a router of some edges between placed boxes, for a caller that routes a few of these edges many times.
 *
 * - `route(some)` gives the routes that `routeThread` gives for the same boxes and the edges `some`.
 * - The router keeps the work that reads only the boxes, in a session of `highways`. The router `corners` keeps its ways around the boxes.
 * - Thus a route of a few edges among many boxes takes a short time. A different router keeps no work.
 *
 * The router holds the boxes of its start. A box with a different place needs a new router.
 */
export function threadRouter(id: string, boxes: readonly LayoutBox[], edges: readonly LayoutEdge[], options: RouteOptions = {}): ThreadRouter {
  const ground = groundOf(id, boxes, edges, options);
  if (ground === undefined) return { route: () => [], dispose: () => undefined };
  const session = routerSession(ground.router, ground.graph);
  return {
    route(some) {
      const ids = new Set(some.map((edge) => edge.id));
      const wanted = ground.graph.edges.filter((edge) => ids.has(edge.id));
      return wanted.length === 0 ? [] : curved(session.route(wanted), ground);
    },
    dispose: () => {
      session.dispose();
    },
  };
}
