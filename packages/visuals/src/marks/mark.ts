import { addPoints3, cross3, scalePoint3, type Point3 } from "@mark1russell7/layout-contract";
import type { Level } from "./levels.ts";

/** A point of a surface, and the direction out of the surface. */
export interface Frame {
  /** The point. */
  readonly at: Point3;
  /** The unit vector out of the surface at the point. */
  readonly out: Point3;
}

/** These are the types of a mark. */
export const MARK_TYPES: readonly ["point", "run", "link", "field", "meter"] = ["point", "run", "link", "field", "meter"];

/** A type of a mark. */
export type MarkType = (typeof MARK_TYPES)[number];

/**
 * The parts that each mark has. A mark has no shape and no color.
 * A viewer gets the shape from the level, and the color from the level and its theme. Thus a mark does not use color alone.
 */
export interface MarkBase {
  /** The name of the record of the mark. The pointer and the selection of a viewer use this name. */
  readonly record: string;
  /** A word of the producer for the legend and the filter, for example `outlet`. */
  readonly kind: string;
  /** The level of the mark. The producer calculates it. */
  readonly level: Level;
  /** One line of text: the name of the mark for a person and for a screen reader. */
  readonly label: string;
}

/** A mark at one point of a surface, for example an outlet, a tap or a lamp. */
export interface PointMark extends MarkBase {
  readonly type: "point";
  /** The point, and the direction out of its surface. */
  readonly frame: Frame;
  /** The width of the sign, in the unit of the space. A mark with no size gets the default size of the viewer. */
  readonly size?: number | undefined;
}

/** A mark along a path on surfaces, for example a cable, a pipe or a duct. */
export interface RunMark extends MarkBase {
  readonly type: "run";
  /** The points of the path, in sequence. Each point has its own direction, so a run can go across surfaces. A path has 2 or more points. */
  readonly path: readonly Frame[];
  /** The width of the run, in the unit of the space. */
  readonly width: number;
}

/** One end of a link. */
export interface LinkEnd {
  /** The name of the record at this end. A viewer shows the link when the record of one end is selected or under the pointer. */
  readonly record: string;
  /** The point of this end. */
  readonly at: Point3;
}

/** A mark between two records, for example a power line from an outlet to a computer. */
export interface LinkMark extends MarkBase {
  readonly type: "link";
  readonly from: LinkEnd;
  readonly to: LinkEnd;
}

/** The scale of the values of a field. The theme of a viewer gives the colors from `min` to `max`. */
export interface FieldScale {
  /** The value of the first color. It is less than `max`. */
  readonly min: number;
  /** The value of the last color. */
  readonly max: number;
  /** The text of the unit of the values, for example `lx`. */
  readonly unit: string;
}

/** A grid of values on a plane, for example the light on a floor or the heat of a wall. */
export interface FieldMark extends MarkBase {
  readonly type: "field";
  /** The corner of the first cell, and the direction out of the plane. */
  readonly frame: Frame;
  /** The unit vector of a column step, in the plane. The step of a row is the cross product of `frame.out` and `across`. */
  readonly across: Point3;
  /** The length of a side of a cell, in the unit of the space. */
  readonly cell: number;
  /** The number of the columns. */
  readonly columns: number;
  /** The number of the rows. */
  readonly rows: number;
  /**
   * The values, row by row. The value of the column `c` and the row `r` has the index `r * columns + c`.
   * A cell with no value has `null`, because JSON has no NaN.
   */
  readonly values: readonly (number | null)[];
  readonly scale: FieldScale;
}

/**
 * A value against a limit, for example the load of a circuit. A meter has no place.
 * A page draws it in a panel, and a 3D view ignores it.
 */
export interface MeterMark extends MarkBase {
  readonly type: "meter";
  readonly value: number;
  /**
   * The limit of the value. A meter with no limit has no `limit`, for example a circuit with a known load and no known breaker.
   * A page shows only the value and the unit of that meter. A limit of 0 is a real limit, so it is not a sign for no limit.
   */
  readonly limit?: number | undefined;
  /** The text of the unit of the value and of the limit, for example `W`. */
  readonly unit: string;
}

/**
 * A record that a viewer draws. A mark is plain data with no topic, so it goes through JSON with no change.
 * Each point of a list of marks is in one space. The producer tells the unit and the axes of that space.
 */
export type Mark = PointMark | RunMark | LinkMark | FieldMark | MeterMark;

/** This function gives the unit vector of a row step of a field: the cross product of `frame.out` and `across`. */
export function fieldRowStep(field: FieldMark): Point3 {
  return cross3(field.frame.out, field.across);
}

/** This function gives the center of a cell of a field. The first cell has the column 0 and the row 0. */
export function fieldCellCenter(field: FieldMark, column: number, row: number): Point3 {
  const across = scalePoint3(field.across, (column + 0.5) * field.cell);
  const down = scalePoint3(fieldRowStep(field), (row + 0.5) * field.cell);
  return addPoints3(field.frame.at, addPoints3(across, down));
}

/** This function gives the value of a cell of a field. A cell with no value gives `null`, and so does a cell that is not in the grid. */
export function fieldValue(field: FieldMark, column: number, row: number): number | null {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= field.columns || row >= field.rows) return null;
  return field.values[row * field.columns + column] ?? null;
}
