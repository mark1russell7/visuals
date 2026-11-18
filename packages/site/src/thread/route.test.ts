import type { LayoutBox, LayoutEdge } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { routeThread } from "./route.ts";

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
