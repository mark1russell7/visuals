import { describe, expect, it } from "vitest";
import { LEVELS, LEVEL_SHAPES, SHAPE_OUTLINES, levelRank, levelShape, shapeRing } from "./levels.ts";

describe("levelRank", () => {
  it("gives the levels in sequence, with `over` as the highest", () => {
    expect(LEVELS.map((level) => levelRank(level))).toEqual([0, 1, 2, 3]);
    expect([...LEVELS].sort((a, b) => levelRank(b) - levelRank(a))[0]).toBe("over");
  });
});

describe("levelShape", () => {
  it("gives each level a different shape", () => {
    const shapes = LEVELS.map((level) => levelShape(level));
    expect(shapes).toEqual(["ring", "disc", "triangle", "square"]);
    expect(new Set(shapes).size).toBe(LEVELS.length);
    expect([...LEVEL_SHAPES].sort()).toEqual([...shapes].sort());
  });

  it("gives a ring for no level", () => {
    expect(levelShape(undefined)).toBe("ring");
  });
});

describe("shapeRing", () => {
  it("gives one corner for each side, at the radius of the outline", () => {
    for (const shape of LEVEL_SHAPES) {
      const outline = SHAPE_OUTLINES[shape];
      const ring = shapeRing(shape, 2);
      expect(ring.length, shape).toBe(outline.sides);
      for (const [x, y] of ring) expect(Math.hypot(x, y), shape).toBeCloseTo(2 * outline.radius, 9);
    }
  });

  it("has the radius 1 of a disc when it gets no radius", () => {
    for (const [x, y] of shapeRing("disc")) expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
  });

  it("goes counter-clockwise, with the y axis up", () => {
    for (const shape of LEVEL_SHAPES) {
      const ring = shapeRing(shape);
      const twice = ring.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = ring[(index + 1) % ring.length] ?? [0, 0];
        return sum + x * nextY - nextX * y;
      }, 0);
      expect(twice, shape).toBeGreaterThan(0);
    }
  });

  it("points a triangle up, and puts a square on one side", () => {
    const triangle = shapeRing("triangle");
    expect(triangle[0]?.[0]).toBeCloseTo(0, 9);
    expect(triangle[0]?.[1]).toBeCloseTo(SHAPE_OUTLINES.triangle.radius, 9);
    const square = shapeRing("square");
    const side = SHAPE_OUTLINES.square.radius * Math.SQRT1_2;
    expect(square.map(([x, y]) => [Math.abs(x), Math.abs(y)])).toEqual(Array.from({ length: 4 }, () => [expect.closeTo(side, 9), expect.closeTo(side, 9)]));
  });

  it("has a hole only in the ring, and the hole is in the ring", () => {
    expect(LEVEL_SHAPES.filter((shape) => SHAPE_OUTLINES[shape].hole > 0)).toEqual(["ring"]);
    expect(SHAPE_OUTLINES.ring.hole).toBeLessThan(SHAPE_OUTLINES.ring.radius);
  });
});
