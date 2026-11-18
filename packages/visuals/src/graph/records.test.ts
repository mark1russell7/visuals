import { checkPicture, cubicAt, pictureBounds, pointPolylineDistance, type LayoutPicture, type PictureRoute } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { indexPicture, routeLine } from "./records.ts";
import { ASIDE, CARD, CARD_LABEL, CURVE, FAR, LINK, LINK_LABEL, NOTE, PICTURE, ROW_1, ROW_2, ROW_LABEL, TOPIC } from "./sample.ts";

describe("the sample picture", () => {
  it("is a good picture, with bounds of 520 by 340", () => {
    expect(checkPicture(PICTURE)).toEqual([]);
    expect(pictureBounds(PICTURE)).toEqual({ x: 0, y: 0, w: 520, h: 340 });
  });
});

describe("indexPicture", () => {
  const index = indexPicture(PICTURE);

  it("gives each box and each route by its id", () => {
    expect(index.picture).toBe(PICTURE);
    expect([...index.boxes.keys()]).toEqual(["card", "row-1", "row-2", "topic", "far"]);
    expect(index.boxes.get("topic")).toBe(TOPIC);
    expect([...index.routes.keys()]).toEqual(["link", "curve", "aside"]);
    expect(index.routes.get("curve")).toBe(CURVE);
  });

  it("gives the children of each box that has children, in the order of the picture", () => {
    expect([...index.children]).toEqual([["card", [ROW_1, ROW_2]]]);
  });

  it("gives the routes at each box, in the order of the picture", () => {
    expect(index.routesAt.get("row-1")).toEqual([LINK]);
    expect(index.routesAt.get("row-2")).toEqual([CURVE]);
    expect(index.routesAt.get("topic")).toEqual([LINK, ASIDE]);
    expect(index.routesAt.get("far")).toEqual([CURVE, ASIDE]);
    expect(index.routesAt.has("card")).toBe(false);
  });

  it("gives a route from a box to the same box one time", () => {
    const loop: PictureRoute = { ...LINK, id: "loop", source: "far", target: "far" };
    expect(indexPicture({ ...PICTURE, routes: [loop] }).routesAt.get("far")).toEqual([loop]);
  });

  it("gives the labels of each box and of each route, and the labels that name no record", () => {
    expect([...index.boxLabels]).toEqual([
      ["card", [CARD_LABEL]],
      ["row-1", [ROW_LABEL]],
    ]);
    expect([...index.routeLabels]).toEqual([["link", [LINK_LABEL]]]);
    expect(index.freeLabels).toEqual([NOTE]);
  });

  it("has no table for a label that names a record that the picture does not have", () => {
    const picture: LayoutPicture = { ...PICTURE, boxes: [CARD, FAR], routes: [] };
    const less = indexPicture(picture);
    expect([...less.boxLabels.keys()]).toEqual(["card"]);
    expect(less.routeLabels.size).toBe(0);
    expect(less.freeLabels).toEqual([NOTE]);
  });

  it("has the last box of an id that two boxes have", () => {
    const second = { ...FAR, x: 700 };
    expect(indexPicture({ ...PICTURE, boxes: [FAR, second] }).boxes.get("far")).toBe(second);
  });

  it("makes empty tables for a picture with no record", () => {
    const empty = indexPicture({ ...PICTURE, boxes: [], routes: [], labels: [] });
    expect([empty.boxes.size, empty.routes.size, empty.children.size, empty.routesAt.size, empty.boxLabels.size, empty.routeLabels.size, empty.freeLabels.length]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("routeLine", () => {
  it("gives the bounds and the corners of a path of straight lines", () => {
    expect(routeLine(LINK)).toEqual({
      bounds: { x: 190, y: 50, w: 110, h: 0 },
      points: [
        { x: 190, y: 50 },
        { x: 300, y: 50 },
      ],
    });
    expect(routeLine(ASIDE)?.bounds).toEqual({ x: 100, y: 80, w: 230, h: 240 });
  });

  it("follows a curve: each point of the curve is half a unit or less from the polyline", () => {
    const line = routeLine(CURVE);
    expect(line?.points.at(0)).toEqual({ x: 100, y: 90 });
    expect(line?.points.at(-1)).toEqual({ x: 50, y: 300 });
    expect(line?.points.length).toBeGreaterThan(4);
    for (let i = 0; i <= 40; i++) {
      const on = cubicAt({ x: 100, y: 90 }, { x: 100, y: 200 }, { x: 50, y: 200 }, { x: 50, y: 300 }, i / 40);
      expect(pointPolylineDistance(on, line?.points ?? [])).toBeLessThanOrEqual(0.5);
    }
  });

  it("gives no line for a route with an empty path", () => {
    expect(routeLine({ ...LINK, path: [] })).toBeUndefined();
  });

  it("keeps the line of a route", () => {
    expect(routeLine(CURVE)).toBe(routeLine(CURVE));
  });
});
