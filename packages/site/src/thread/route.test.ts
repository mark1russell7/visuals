import type { LayoutBox, LayoutEdge } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { routeThread, threadRouter } from "./route.ts";

const boxes: LayoutBox[] = [
  { id: "card", x: 0, y: 0, w: 200, h: 110 },
  { id: "row", parent: "card", x: 10, y: 30, w: 180, h: 30 },
  { id: "next", parent: "card", x: 10, y: 65, w: 180, h: 30 },
  { id: "topic", x: 420, y: 20, w: 120, h: 40 },
  { id: "far", x: 420, y: 300, w: 120, h: 40 },
  { id: "lost", w: 10, h: 10 },
];

const edges: LayoutEdge[] = [
  { id: "a", source: "row", target: "topic" },
  { id: "b", source: "next", target: "topic" },
  { id: "c", source: "card", target: "far" },
  { id: "in", source: "row", target: "next" },
  { id: "gone", source: "row", target: "lost" },
];

describe("routeThread", () => {
  it("routes each edge between two placed boxes of different cards", () => {
    const routes = routeThread("d", boxes, edges);
    expect(routes.map((route) => route.edge).sort()).toEqual(["a", "b", "c"]);
    for (const route of routes) {
      expect(route.points.length).toBeGreaterThanOrEqual(2);
      expect(route.path?.length).toBeGreaterThan(0);
    }
  });

  it("starts the route of a row on the border of its card", () => {
    const route = routeThread("d", boxes, edges).find((entry) => entry.edge === "a");
    const first = route?.points[0];
    expect(first?.x).toBeCloseTo(200, 6);
    expect(first?.y).toBeGreaterThanOrEqual(30);
    expect(first?.y).toBeLessThanOrEqual(60);
  });

  it("gives a route for each router name and for each curve", () => {
    for (const router of ["corners", "shared", "not a router"]) {
      expect(routeThread("d", boxes, edges, { router, bundle: true })).toHaveLength(3);
    }
    expect(routeThread("d", boxes, edges, { curve: "rounded" })).toHaveLength(3);
  });

  it("gives no route when no edge has two placed ends in different cards", () => {
    expect(routeThread("d", boxes, edges.slice(3))).toEqual([]);
    expect(routeThread("d", boxes, [])).toEqual([]);
  });
});

describe("threadRouter", () => {
  it("gives the routes of `routeThread` for some of its edges, with each router", () => {
    for (const options of [{}, { router: "corners", curve: "rounded" as const }, { router: "shared", bundle: true }]) {
      const made = threadRouter("d", boxes, edges, options);
      for (const some of [edges.slice(0, 1), edges.slice(1, 3), edges.slice(2), edges]) {
        const routes = made.route(some);
        expect(routes).toEqual(routeThread("d", boxes, some, options));
        expect(routes.length).toBeGreaterThan(0);
      }
      // A second route of the same edges gives the same result: the kept work changes no route.
      expect(made.route(edges.slice(0, 1))).toEqual(routeThread("d", boxes, edges.slice(0, 1), options));
      made.dispose();
    }
  });

  it("gives the routes in the order of its edges", () => {
    const made = threadRouter("d", boxes, edges);
    expect(made.route([{ id: "c" }, { id: "a" }]).map((route) => route.edge)).toEqual(["a", "c"]);
  });

  it("gives no route for an edge that it does not have, and for no edge", () => {
    const made = threadRouter("d", boxes, edges.slice(0, 2));
    expect(made.route([{ id: "c" }])).toEqual([]);
    expect(made.route([])).toEqual([]);
    expect(threadRouter("d", boxes, edges.slice(3)).route(edges)).toEqual([]);
  });

  it("gives an error for a route after its release", () => {
    const made = threadRouter("d", boxes, edges);
    made.dispose();
    expect(() => made.route(edges)).toThrow();
    // A router with no edge keeps no work.
    const empty = threadRouter("d", boxes, []);
    empty.dispose();
    expect(empty.route(edges)).toEqual([]);
  });
});
