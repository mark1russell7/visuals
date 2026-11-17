import { LEVELS, checkMarks, fieldValue, type FieldMark, type Mark } from "@mark1russell7/visuals/marks";
import { describe, expect, it } from "vitest";
import { COMPUTER, LEVEL_NAMES, ROOM, ROOM_KINDS, ROOM_MARKS, ROOM_RECORDS, ROOM_SOLIDS, type RoomPoint } from "./room-sample.ts";

const field = ROOM_MARKS.find((mark): mark is FieldMark => mark.type === "field");

/** This function gives each point of a mark. */
function pointsOf(mark: Mark): readonly RoomPoint[] {
  if (mark.type === "point") return [mark.frame.at];
  if (mark.type === "run") return mark.path.map((frame) => frame.at);
  if (mark.type === "link") return [mark.from.at, mark.to.at];
  return [];
}

describe("the sample of the room", () => {
  it("has no fault in its marks", () => {
    expect(checkMarks(ROOM_MARKS)).toEqual([]);
  });

  it("has a mark of each level, and of each type that a picture draws", () => {
    expect(new Set(ROOM_MARKS.map((mark) => mark.level))).toEqual(new Set(LEVELS));
    expect(new Set(ROOM_MARKS.map((mark) => mark.type))).toEqual(new Set(["point", "run", "link", "field"]));
    expect(Object.keys(LEVEL_NAMES).sort()).toEqual([...LEVELS].sort());
  });

  it("gives each mark its own record, and no record of a box", () => {
    const records = ROOM_MARKS.map((mark) => mark.record);
    expect(new Set(records).size).toBe(records.length);
    for (const solid of ROOM_SOLIDS) expect(records).not.toContain(solid.record);
  });

  it("has each point of each mark in the room", () => {
    for (const point of ROOM_MARKS.flatMap(pointsOf)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ROOM.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ROOM.height);
      expect(point.z).toBeGreaterThanOrEqual(0);
      expect(point.z).toBeLessThanOrEqual(ROOM.depth);
    }
  });

  it("has each box in the room, with a size on each axis", () => {
    for (const { low, high } of ROOM_SOLIDS) {
      for (const axis of ["x", "y", "z"] as const) expect(high[axis]).toBeGreaterThan(low[axis]);
      expect(low.x).toBeGreaterThanOrEqual(0);
      expect(high.x).toBeLessThanOrEqual(ROOM.width);
      expect(low.y).toBeGreaterThanOrEqual(0);
      expect(high.y).toBeLessThanOrEqual(ROOM.height);
      expect(low.z).toBeGreaterThanOrEqual(0);
      expect(high.z).toBeLessThanOrEqual(ROOM.depth);
    }
  });

  it("has one kind of the legend for each kind of the marks", () => {
    expect(ROOM_KINDS.map(({ kind }) => kind).sort()).toEqual([...new Set(ROOM_MARKS.map((mark) => mark.kind))].sort());
  });

  it("makes the text of each mark from its name and its reading", () => {
    for (const { mark, name, detail } of ROOM_RECORDS) expect(mark.label).toBe(`${name}: ${detail}`);
  });

  it("ends the feed at an outlet and at the computer", () => {
    const feed = ROOM_MARKS.find((mark) => mark.type === "link");
    expect(feed?.from.record).toBe("outlet-2");
    expect(ROOM_MARKS.some((mark) => mark.record === feed?.from.record && mark.type === "point")).toBe(true);
    expect(feed?.to.record).toBe(COMPUTER);
    expect(ROOM_SOLIDS.some((solid) => solid.record === COMPUTER)).toBe(true);
  });

  it("has the light on all of the floor", () => {
    expect(field).toBeDefined();
    if (field === undefined) return;
    expect(field.columns * field.cell).toBeCloseTo(ROOM.depth, 9);
    expect(field.rows * field.cell).toBeCloseTo(ROOM.width, 9);
    expect(field.values).toHaveLength(field.columns * field.rows);
  });

  it("has no light below a box, and the most light below the lamp", () => {
    if (field === undefined) return;
    // The cell at the row 9 and the column 1 is below the desk. The cell at the row 16 and the column 1 is below the computer.
    expect(fieldValue(field, 1, 9)).toBeNull();
    expect(fieldValue(field, 1, 16)).toBeNull();
    expect(field.values.filter((value) => value === null)).toHaveLength(30);
    const known = field.values.filter((value) => value !== null);
    // The lamp is above the row 0 and the column 4.
    expect(fieldValue(field, 4, 0)).toBe(Math.max(...known));
    expect(Math.max(...known)).toBeLessThanOrEqual(field.scale.max);
    expect(Math.min(...known)).toBeGreaterThan(field.scale.min);
  });
});
