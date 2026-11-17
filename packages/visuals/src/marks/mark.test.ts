import { cross3, dot3, length3, subtractPoints3 } from "@mark1russell7/layout-contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MARK_TYPES, fieldCellCenter, fieldRowStep, fieldValue, type FieldMark, type Mark } from "./mark.ts";
import { FIELD, METER_NO_LIMIT, SAMPLE_MARKS } from "./sample.ts";

describe("Mark", () => {
  it("has one sample for each type", () => {
    expect(SAMPLE_MARKS.map((mark) => mark.type)).toEqual([...MARK_TYPES]);
  });

  it("goes through JSON with no change", () => {
    const text = JSON.stringify(SAMPLE_MARKS);
    expect(JSON.parse(text) as Mark[]).toEqual(SAMPLE_MARKS);
  });

  it("keeps a meter with no limit through JSON: the text has no limit, and the mark has each other part", () => {
    const text = JSON.stringify(METER_NO_LIMIT);
    expect(text).not.toContain("limit");
    expect(JSON.parse(text) as Mark).toStrictEqual(METER_NO_LIMIT);
  });
});

describe("fieldRowStep", () => {
  it("gives the cross product of the direction out of the plane and the column step", () => {
    expect(fieldRowStep(FIELD)).toEqual({ x: 0, y: 1, z: 0 });
    expect(fieldRowStep(FIELD)).toEqual(cross3(FIELD.frame.out, FIELD.across));
  });

  it("gives a unit vector in the plane, at a right angle to the column step", () => {
    const wall: FieldMark = { ...FIELD, frame: { at: { x: 2, y: 3, z: 0 }, out: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 } }, across: { x: 0, y: 0, z: 1 } };
    const step = fieldRowStep(wall);
    expect(length3(step)).toBeCloseTo(1, 12);
    expect(dot3(step, wall.across)).toBeCloseTo(0, 12);
    expect(dot3(step, wall.frame.out)).toBeCloseTo(0, 12);
  });
});

describe("fieldCellCenter", () => {
  it("gives the center of the first cell at half of a cell from the corner", () => {
    expect(fieldCellCenter(FIELD, 0, 0)).toEqual({ x: 0.25, y: 0.25, z: 0 });
  });

  it("goes one cell along the column step for each column, and along the row step for each row", () => {
    expect(fieldCellCenter(FIELD, 2, 0)).toEqual({ x: 1.25, y: 0.25, z: 0 });
    expect(fieldCellCenter(FIELD, 0, 1)).toEqual({ x: 0.25, y: 0.75, z: 0 });
  });

  it("keeps each center in the plane of the field", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), fc.double({ min: 0.01, max: 5, noNaN: true }), (column, row, cell) => {
        const field: FieldMark = { ...FIELD, frame: { at: { x: 1, y: -2, z: 3 }, out: { x: 0, y: 1, z: 0 } }, across: { x: 0, y: 0, z: 1 }, cell };
        const offset = subtractPoints3(fieldCellCenter(field, column, row), field.frame.at);
        expect(dot3(offset, field.frame.out)).toBeCloseTo(0, 9);
        expect(dot3(offset, field.across)).toBeCloseTo((column + 0.5) * cell, 9);
        expect(dot3(offset, fieldRowStep(field))).toBeCloseTo((row + 0.5) * cell, 9);
      }),
    );
  });
});

describe("fieldValue", () => {
  it("reads the values row by row", () => {
    expect(fieldValue(FIELD, 0, 0)).toBe(100);
    expect(fieldValue(FIELD, 2, 0)).toBe(300);
    expect(fieldValue(FIELD, 0, 1)).toBe(400);
    expect(fieldValue(FIELD, 2, 1)).toBe(600);
  });

  it("gives null for a cell with no value", () => {
    expect(fieldValue(FIELD, 1, 1)).toBeNull();
  });

  it("gives null for a cell that is not in the grid", () => {
    expect(fieldValue(FIELD, 3, 0)).toBeNull();
    expect(fieldValue(FIELD, 0, 2)).toBeNull();
    expect(fieldValue(FIELD, -1, 0)).toBeNull();
    expect(fieldValue(FIELD, 0.5, 0)).toBeNull();
  });

  it("does not read the value of the next row for a column after the last column", () => {
    expect(fieldValue({ ...FIELD, columns: 2, rows: 3 }, 2, 0)).toBeNull();
  });
});
