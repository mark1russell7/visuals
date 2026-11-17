import { cross3, dot3, inverseTransform3, length3, rotationAbout, subtractPoints3, transformPoint3, type Point3, type Transform3 } from "@mark1russell7/layout-contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkMarks } from "./check.ts";
import { MARK_TYPES, fieldCellCenter, fieldRowStep, fieldValue, transformMarks, type FieldMark, type Mark } from "./mark.ts";
import { FIELD, LINK, METER, METER_NO_LIMIT, POINT, RUN, SAMPLE_MARKS } from "./sample.ts";

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

/** The transform from a space with the z axis up to a space with the y axis up: a turn of a quarter about the x axis. */
const TO_Y_UP: Transform3 = { position: { x: 0, y: 0, z: 0 }, rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } };

/** This function examines that two points are equal to 12 decimal places. */
function expectPoint(found: Point3, wanted: Point3): void {
  expect(found.x).toBeCloseTo(wanted.x, 12);
  expect(found.y).toBeCloseTo(wanted.y, 12);
  expect(found.z).toBeCloseTo(wanted.z, 12);
}

/** A transform with a turn about an axis and a move. The axis is not the zero vector. */
const transforms: fc.Arbitrary<Transform3> = fc
  .record({
    axis: fc.constantFrom({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 2, z: -3 }, { x: -2, y: 0.5, z: 1 }),
    angle: fc.double({ min: -6, max: 6, noNaN: true }),
    x: fc.double({ min: -50, max: 50, noNaN: true }),
    y: fc.double({ min: -50, max: 50, noNaN: true }),
    z: fc.double({ min: -50, max: 50, noNaN: true }),
  })
  .map(({ axis, angle, x, y, z }) => ({ position: { x, y, z }, rotation: rotationAbout(axis, angle) }));

describe("transformMarks", () => {
  it("gives the marks of a space with the z axis up in a space with the y axis up", () => {
    const [point] = transformMarks([{ ...POINT, frame: { at: { x: 1, y: 2, z: 3 }, out: { x: 0, y: 1, z: 0 } } }], TO_Y_UP);
    if (point?.type !== "point") throw new Error("The mark is not a point.");
    // The z axis becomes the y axis, and the y axis becomes the negative z axis.
    expectPoint(point.frame.at, { x: 1, y: 3, z: -2 });
    expectPoint(point.frame.out, { x: 0, y: 0, z: -1 });
  });

  it("moves each point of each type of mark, and turns each direction", () => {
    const move: Transform3 = { position: { x: 10, y: 20, z: 30 }, rotation: rotationAbout({ x: 0, y: 0, z: 1 }, Math.PI / 2) };
    const [point, run, link, field, meter] = transformMarks(SAMPLE_MARKS, move);
    if (point?.type !== "point" || run?.type !== "run" || link?.type !== "link" || field?.type !== "field") throw new Error("A mark has a different type.");
    expectPoint(point.frame.at, transformPoint3(move, POINT.frame.at));
    expect(run.path).toHaveLength(RUN.path.length);
    run.path.forEach((frame, at) => {
      expectPoint(frame.at, transformPoint3(move, RUN.path[at]?.at ?? { x: 0, y: 0, z: 0 }));
      expect(length3(frame.out)).toBeCloseTo(1, 12);
    });
    expectPoint(link.from.at, transformPoint3(move, LINK.from.at));
    expectPoint(link.to.at, transformPoint3(move, LINK.to.at));
    expect(link.from.record).toBe(LINK.from.record);
    expectPoint(field.frame.at, transformPoint3(move, FIELD.frame.at));
    expect(field.values).toBe(FIELD.values);
    expect(meter).toBe(METER);
  });

  it("turns the direction of a point with the rotation only", () => {
    const move: Transform3 = { position: { x: 10, y: 20, z: 30 }, rotation: rotationAbout({ x: 0, y: 0, z: 1 }, Math.PI / 2) };
    const [point] = transformMarks([{ ...POINT, frame: { at: { x: 0, y: 0, z: 0 }, out: { x: 1, y: 0, z: 0 } } }], move);
    if (point?.type !== "point") throw new Error("The mark is not a point.");
    expectPoint(point.frame.at, { x: 10, y: 20, z: 30 });
    expectPoint(point.frame.out, { x: 0, y: 1, z: 0 });
  });

  it("keeps each length, each name and each value, and changes no mark of the list", () => {
    const before = JSON.stringify(SAMPLE_MARKS);
    const moved = transformMarks(SAMPLE_MARKS, TO_Y_UP);
    expect(JSON.stringify(SAMPLE_MARKS)).toBe(before);
    expect(moved.map(({ record, kind, level, label, type }) => ({ record, kind, level, label, type }))).toEqual(
      SAMPLE_MARKS.map(({ record, kind, level, label, type }) => ({ record, kind, level, label, type })),
    );
    const [point, run, , field] = moved;
    if (point?.type !== "point" || run?.type !== "run" || field?.type !== "field") throw new Error("A mark has a different type.");
    expect(point.size).toBe(POINT.size);
    expect(run.width).toBe(RUN.width);
    expect(field.cell).toBe(FIELD.cell);
    expect(field.scale).toBe(FIELD.scale);
  });

  it("gives marks with no fault from marks with no fault", () => {
    fc.assert(
      fc.property(transforms, (transform) => {
        expect(checkMarks(transformMarks(SAMPLE_MARKS, transform))).toEqual([]);
      }),
    );
  });

  it("moves the center of each cell of a field as the transform moves a point", () => {
    fc.assert(
      fc.property(transforms, fc.nat({ max: FIELD.columns - 1 }), fc.nat({ max: FIELD.rows - 1 }), (transform, column, row) => {
        const [field] = transformMarks([FIELD], transform);
        if (field?.type !== "field") throw new Error("The mark is not a field.");
        const found = fieldCellCenter(field, column, row);
        const wanted = transformPoint3(transform, fieldCellCenter(FIELD, column, row));
        expect(Math.hypot(found.x - wanted.x, found.y - wanted.y, found.z - wanted.z)).toBeLessThan(1e-9);
      }),
    );
  });

  it("gives the first marks again after the inverse transform", () => {
    fc.assert(
      fc.property(transforms, (transform) => {
        const back = transformMarks(transformMarks(SAMPLE_MARKS, transform), inverseTransform3(transform));
        const [point, , link] = back;
        if (point?.type !== "point" || link?.type !== "link") throw new Error("A mark has a different type.");
        expect(Math.hypot(point.frame.at.x - POINT.frame.at.x, point.frame.at.y - POINT.frame.at.y, point.frame.at.z - POINT.frame.at.z)).toBeLessThan(1e-9);
        expect(Math.hypot(point.frame.out.x - POINT.frame.out.x, point.frame.out.y - POINT.frame.out.y, point.frame.out.z - POINT.frame.out.z)).toBeLessThan(1e-9);
        expect(Math.hypot(link.to.at.x - LINK.to.at.x, link.to.at.y - LINK.to.at.y, link.to.at.z - LINK.to.at.z)).toBeLessThan(1e-9);
      }),
    );
  });
});
