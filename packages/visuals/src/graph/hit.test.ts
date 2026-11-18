import { PICTURE_SCHEMA, pathOf, type LayoutPicture, type PictureBox, type PictureRoute } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { boxDistance, pickRecord } from "./hit.ts";
import { indexPicture, type PictureRecord } from "./records.ts";
import { CARD, CURVE, FAR, LINK, PICTURE, ROW_1, TOPIC } from "./sample.ts";

const index = indexPicture(PICTURE);

/** This function permits each record: a person can point at a route too. */
const each = (): boolean => true;

/** This function gives the id of the record below a point of the sample picture. */
function idAt(x: number, y: number, slack?: number, picks?: (record: PictureRecord) => boolean): string | undefined {
  return pickRecord(index, { x, y }, { slack, picks })?.id;
}

/** This function makes a picture of boxes and routes with no label. */
function pictureOf(boxes: readonly PictureBox[], routes: readonly PictureRoute[] = []): LayoutPicture {
  return { schema: PICTURE_SCHEMA, boxes, routes, labels: [] };
}

/** This function makes a straight route between two points. */
function line(id: string, from: readonly [number, number], to: readonly [number, number]): PictureRoute {
  return {
    id,
    source: "a",
    target: "b",
    path: pathOf([
      { x: from[0], y: from[1] },
      { x: to[0], y: to[1] },
    ]),
  };
}

describe("boxDistance", () => {
  it("gives the distance to the rectangle of a box, and 0 in it", () => {
    expect(boxDistance(FAR, { x: 50, y: 320 })).toBe(0);
    expect(boxDistance(FAR, { x: 100, y: 340 })).toBe(0);
    expect(boxDistance(FAR, { x: 110, y: 320 })).toBe(10);
    expect(boxDistance(FAR, { x: 103, y: 296 })).toBe(5);
  });

  it("gives the distance to the shape of a box, from the corner of the box", () => {
    expect(boxDistance(TOPIC, { x: 330, y: 50 })).toBe(0);
    expect(boxDistance(TOPIC, { x: 370, y: 50 })).toBe(10);
    // This point is in the rectangle of the box, and it is not in the circle.
    expect(boxDistance(TOPIC, { x: 302, y: 22 })).toBeCloseTo(Math.hypot(28, 28) - 30, 9);
  });
});

describe("pickRecord", () => {
  it("gives the box with no child at a point, before the box that contains it", () => {
    expect(pickRecord(index, { x: 50, y: 40 })).toEqual({ type: "box", id: "row-1", box: ROW_1 });
    expect(idAt(50, 80)).toBe("row-2");
  });

  it("gives the box with children at a point where no child is", () => {
    expect(pickRecord(index, { x: 50, y: 10 })).toEqual({ type: "box", id: "card", box: CARD });
  });

  it("gives no record for a point that is far from each record", () => {
    expect(idAt(600, 600)).toBeUndefined();
    expect(idAt(600, 600, 20, each)).toBeUndefined();
  });

  it("gives the nearest box with no child in the slack, before the box with children at the point", () => {
    // The point is between the two rows of the card: 4 units from the first row, and 6 units from the second row.
    expect(idAt(50, 59)).toBe("card");
    expect(idAt(50, 59, 5)).toBe("row-1");
    expect(idAt(50, 59, 7)).toBe("row-1");
    expect(idAt(50, 61, 7)).toBe("row-2");
  });

  it("uses the shape of a box, not its rectangle", () => {
    expect(idAt(302, 22)).toBeUndefined();
    expect(idAt(302, 22, 9)).toBeUndefined();
    expect(idAt(302, 22, 10)).toBe("topic");
    expect(idAt(330, 50)).toBe("topic");
  });

  it("gives the top box of two boxes with no child at a point", () => {
    const a: PictureBox = { id: "a", x: 0, y: 0, w: 100, h: 100 };
    const b: PictureBox = { id: "b", x: 50, y: 50, w: 100, h: 100 };
    expect(pickRecord(indexPicture(pictureOf([a, b])), { x: 75, y: 75 })?.id).toBe("b");
    expect(pickRecord(indexPicture(pictureOf([b, a])), { x: 75, y: 75 })?.id).toBe("a");
    expect(pickRecord(indexPicture(pictureOf([a, b])), { x: 25, y: 25 })?.id).toBe("a");
  });

  it("gives the top box of two boxes with children at a point", () => {
    const outer: PictureBox = { id: "outer", x: 0, y: 0, w: 300, h: 300 };
    const inner: PictureBox = { id: "inner", parent: "outer", x: 50, y: 50, w: 200, h: 200 };
    const leaf: PictureBox = { id: "leaf", parent: "inner", x: 100, y: 100, w: 50, h: 50 };
    const nested = indexPicture(pictureOf([outer, inner, leaf]));
    expect(pickRecord(nested, { x: 120, y: 120 })?.id).toBe("leaf");
    expect(pickRecord(nested, { x: 60, y: 60 })?.id).toBe("inner");
    expect(pickRecord(nested, { x: 10, y: 10 })?.id).toBe("outer");
  });

  it("gives the nearest box with children in the slack, after each other record", () => {
    expect(idAt(205, 20)).toBeUndefined();
    expect(idAt(205, 20, 4)).toBeUndefined();
    expect(idAt(205, 20, 5)).toBe("card");
  });

  it("gives no route if the option does not permit routes", () => {
    expect(idAt(250, 50)).toBeUndefined();
    expect(idAt(250, 50, 20)).toBeUndefined();
  });

  it("gives the route in the slack of a point, if the option permits routes", () => {
    expect(pickRecord(index, { x: 250, y: 50 }, { picks: each })).toEqual({ type: "route", id: "link", route: LINK });
    expect(idAt(250, 53, 5, each)).toBe("link");
    expect(idAt(250, 53, 2, each)).toBeUndefined();
    expect(idAt(215, 322, 3, each)).toBe("aside");
  });

  it("follows the curve of a route", () => {
    // The middle of the curve is at (75, 198.75).
    expect(idAt(75, 198.75, 1, each)).toBe("curve");
    // The straight line between the ends of the curve is far from the curve at this height.
    expect(idAt(88, 140, 3, each)).toBeUndefined();
  });

  it("gives a box with no child before a route, and a route before a box with children", () => {
    // The route to the topic ends on the circle of the topic.
    expect(idAt(300, 50, 0, each)).toBe("topic");
    // The curve starts at the bottom of the second row, in the card.
    expect(idAt(100, 95, 1, each)).toBe("curve");
    expect(idAt(100, 95, 1)).toBe("card");
    expect(pickRecord(index, { x: 100, y: 95 }, { slack: 1, picks: each })).toEqual({ type: "route", id: "curve", route: CURVE });
  });

  it("gives the nearest of two routes in the slack, and the top one at an equal distance", () => {
    const routes = indexPicture(pictureOf([], [line("low", [0, 0], [100, 0]), line("high", [0, 4], [100, 4])]));
    expect(pickRecord(routes, { x: 50, y: 1 }, { slack: 5, picks: each })?.id).toBe("low");
    expect(pickRecord(routes, { x: 50, y: 3 }, { slack: 5, picks: each })?.id).toBe("high");
    expect(pickRecord(routes, { x: 50, y: 2 }, { slack: 5, picks: each })?.id).toBe("high");
  });

  it("ignores a record that the option does not permit", () => {
    expect(idAt(50, 40, 0, (record) => record.id !== "row-1")).toBe("card");
    expect(idAt(50, 40, 0, (record) => record.type === "route")).toBeUndefined();
    expect(idAt(250, 50, 0, (record) => record.id !== "link")).toBeUndefined();
  });

  it("uses a slack of 0 for a slack below 0", () => {
    expect(idAt(110, 320, -20)).toBeUndefined();
    expect(idAt(50, 320, -20)).toBe("far");
  });

  it("ignores a route with an empty path", () => {
    const empty = indexPicture(pictureOf([], [{ ...LINK, path: [] }]));
    expect(pickRecord(empty, { x: 250, y: 50 }, { slack: 5, picks: each })).toBeUndefined();
  });
});
