import type { Ring } from "@mark1russell7/layout-contract";

/** These are the levels of a mark, from the lowest to the highest. */
export const LEVELS: readonly ["unknown", "ok", "near", "over"] = ["unknown", "ok", "near", "over"];

/**
 * A level of a mark, in the scale of limits. `ok` is below a limit, `near` is near it and `over` is above it.
 * A mark with no known value has `unknown`. The producer of a mark calculates the level, because each topic has its own limits.
 */
export type Level = (typeof LEVELS)[number];

/**
 * This function gives the rank of a level: 0 for `unknown` and 3 for `over`.
 * A viewer draws the marks in the sequence of their ranks, so the worst level is always in view.
 */
export function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

/** These are the shapes of the sign of a level. */
export const LEVEL_SHAPES: readonly ["ring", "disc", "triangle", "square"] = ["ring", "disc", "triangle", "square"];

/** A shape of the sign of a level. A person who does not see a color reads the level from the shape. */
export type LevelShape = (typeof LEVEL_SHAPES)[number];

/**
 * This function gives the shape of the sign of a level: a disc for `ok`, a triangle for `near` and a square for `over`.
 * The level `unknown` has a ring, and so has a record with no level.
 */
export function levelShape(level: Level | undefined): LevelShape {
  return level === "ok" ? "disc" : level === "near" ? "triangle" : level === "over" ? "square" : "ring";
}

/** The outline of the sign of a shape, as a regular polygon. A circle is a polygon with 40 sides. */
export interface ShapeOutline {
  /** The radius of the circle through the corners, for a disc with the radius 1. */
  readonly radius: number;
  /** The number of the sides. */
  readonly sides: number;
  /** The angle of the first corner, in radians, counter-clockwise from the x axis. */
  readonly start: number;
  /** The radius of the hole of the sign, for a disc with the radius 1. A sign with no hole has 0. */
  readonly hole: number;
}

/**
 * The outline of the sign of each shape. Each viewer draws the signs from these values, so each viewer shows the same signs.
 * A triangle and a square with the radius of the disc look small, so they are larger.
 */
export const SHAPE_OUTLINES: Readonly<Record<LevelShape, ShapeOutline>> = {
  ring: { radius: 1, sides: 40, start: 0, hole: 0.52 },
  disc: { radius: 1, sides: 40, start: 0, hole: 0 },
  triangle: { radius: 1.3, sides: 3, start: Math.PI / 2, hole: 0 },
  square: { radius: 1.25, sides: 4, start: Math.PI / 4, hole: 0 },
};

/**
 * This function gives the corners of the outline of a sign, counter-clockwise, with the y axis up.
 * The center of the sign is the origin, and `radius` is the radius of a disc.
 */
export function shapeRing(shape: LevelShape, radius: number = 1): Ring {
  const outline = SHAPE_OUTLINES[shape];
  return Array.from({ length: outline.sides }, (_, index): readonly [number, number] => {
    const angle = outline.start + (index * 2 * Math.PI) / outline.sides;
    return [radius * outline.radius * Math.cos(angle), radius * outline.radius * Math.sin(angle)];
  });
}
