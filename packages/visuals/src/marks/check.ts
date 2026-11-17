import { dot3, length3, type Point3 } from "@mark1russell7/layout-contract";
import { LEVELS } from "./levels.ts";
import type { Frame, Mark } from "./mark.ts";

/**
 * These are the codes of the faults of a mark:
 * - `type`: the type of the mark is not known. A list from a later version of a producer can have a new type.
 * - `level`: the level of the mark is not known.
 * - `name`: a record name or the kind is empty.
 * - `label`: the label is empty, or it has more than one line.
 * - `number`: a number is not finite.
 * - `direction`: a direction is not a unit vector.
 * - `angle`: the column step of a field is not at a right angle to the direction out of its plane.
 * - `size`: a size, a width or a cell is not more than 0.
 * - `grid`: the number of the columns or of the rows of a field is not a whole number of 1 or more.
 * - `values`: a field does not have one value for each cell.
 * - `scale`: the `min` of the scale of a field is not less than its `max`.
 * - `path`: a run has fewer than 2 points.
 */
export const MARK_FAULT_CODES: readonly ["type", "level", "name", "label", "number", "direction", "angle", "size", "grid", "values", "scale", "path"] = [
  "type",
  "level",
  "name",
  "label",
  "number",
  "direction",
  "angle",
  "size",
  "grid",
  "values",
  "scale",
  "path",
];

/** A code of a fault of a mark. */
export type MarkFaultCode = (typeof MARK_FAULT_CODES)[number];

/** One fault of a mark of a list. */
export interface MarkFault {
  readonly code: MarkFaultCode;
  /** The index of the mark in the list. */
  readonly index: number;
  /** The record name of the mark. */
  readonly record: string;
  /** The part of the mark with the fault, for example `path[2].out`. */
  readonly part: string;
  /** The fault in plain words, with the values. */
  readonly message: string;
}

/**
 * The tolerance of a direction. A unit vector has the length 1 with this tolerance.
 * Two directions are at a right angle when their dot product is 0 with this tolerance.
 */
export const DIRECTION_TOLERANCE = 1e-6;

/**
 * This function gives the faults of a list of marks, in the sequence of the list. A list with no fault gives an empty list.
 * It examines the values that the types do not hold: finite numbers, unit vectors, sizes, the grid of a field and the names.
 * A producer of marks uses it as a gate in its tests, and a viewer uses it on a list that it did not make.
 * It does not examine the form of a mark: read a list from JSON through a schema first.
 */
export function checkMarks(marks: readonly Mark[]): readonly MarkFault[] {
  const faults: MarkFault[] = [];
  marks.forEach((mark, index) => {
    const fault = (code: MarkFaultCode, part: string, message: string): void => {
      faults.push({ code, index, record: mark.record, part, message });
    };
    const finite = (part: string, value: number): boolean => {
      if (Number.isFinite(value)) return true;
      fault("number", part, `${part} is not a finite number: ${String(value)}`);
      return false;
    };
    const point = (part: string, value: Point3): boolean => {
      const x = finite(`${part}.x`, value.x);
      const y = finite(`${part}.y`, value.y);
      const z = finite(`${part}.z`, value.z);
      return x && y && z;
    };
    const direction = (part: string, value: Point3): boolean => {
      if (!point(part, value)) return false;
      const length = length3(value);
      if (Math.abs(length - 1) <= DIRECTION_TOLERANCE) return true;
      fault("direction", part, `${part} is not a unit vector: its length is ${String(length)}`);
      return false;
    };
    const frame = (part: string, value: Frame): boolean => {
      const at = point(`${part}.at`, value.at);
      const out = direction(`${part}.out`, value.out);
      return at && out;
    };
    const positive = (part: string, value: number): void => {
      if (finite(part, value) && value <= 0) fault("size", part, `${part} is not more than 0: ${String(value)}`);
    };
    const count = (part: string, value: number): boolean => {
      if (Number.isInteger(value) && value >= 1) return true;
      fault("grid", part, `${part} is not a whole number of 1 or more: ${String(value)}`);
      return false;
    };

    if (mark.record === "") fault("name", "record", "the mark has no record name");
    if (mark.kind === "") fault("name", "kind", "the mark has no kind");
    if (!(LEVELS as readonly string[]).includes(mark.level)) fault("level", "level", `the level is not known: ${String(mark.level)}`);
    if (mark.label.trim() === "") fault("label", "label", "the mark has no label");
    else if (/[\r\n]/.test(mark.label)) fault("label", "label", "the label has more than one line");

    switch (mark.type) {
      case "point":
        frame("frame", mark.frame);
        if (mark.size !== undefined) positive("size", mark.size);
        break;
      case "run":
        if (mark.path.length < 2) fault("path", "path", `the path has ${String(mark.path.length)} points, and a run needs 2 or more`);
        mark.path.forEach((step, at) => frame(`path[${String(at)}]`, step));
        positive("width", mark.width);
        break;
      case "link":
        for (const [name, end] of [
          ["from", mark.from],
          ["to", mark.to],
        ] as const) {
          if (end.record === "") fault("name", `${name}.record`, `the end ${name} has no record name`);
          point(`${name}.at`, end.at);
        }
        break;
      case "field": {
        const hasFrame = frame("frame", mark.frame);
        const hasAcross = direction("across", mark.across);
        if (hasFrame && hasAcross) {
          const dot = dot3(mark.frame.out, mark.across);
          if (Math.abs(dot) > DIRECTION_TOLERANCE) fault("angle", "across", `across is not at a right angle to frame.out: their dot product is ${String(dot)}`);
        }
        positive("cell", mark.cell);
        const hasColumns = count("columns", mark.columns);
        const hasRows = count("rows", mark.rows);
        if (hasColumns && hasRows && mark.values.length !== mark.columns * mark.rows) {
          fault("values", "values", `the field has ${String(mark.values.length)} values, and ${String(mark.columns)} columns of ${String(mark.rows)} rows need ${String(mark.columns * mark.rows)}`);
        }
        // A field can have many cells, so the values give one fault, not one fault for each cell.
        const bad = mark.values.flatMap((value, at) => (value === null || Number.isFinite(value) ? [] : [at]));
        const first = bad[0];
        if (first !== undefined) {
          fault("number", `values[${String(first)}]`, `${String(bad.length)} of the values are not finite numbers, the first is values[${String(first)}]: ${String(mark.values[first])}`);
        }
        const hasMin = finite("scale.min", mark.scale.min);
        const hasMax = finite("scale.max", mark.scale.max);
        if (hasMin && hasMax && mark.scale.min >= mark.scale.max) {
          fault("scale", "scale", `scale.min is not less than scale.max: ${String(mark.scale.min)} and ${String(mark.scale.max)}`);
        }
        break;
      }
      case "meter":
        finite("value", mark.value);
        // A meter with no limit is correct. A list from JSON can have `null` there, and `null` is not a number.
        if (mark.limit !== undefined) finite("limit", mark.limit);
        break;
      default:
        fault("type", "type", `the type is not known: ${String((mark as { readonly type: unknown }).type)}`);
    }
  });
  return faults;
}
