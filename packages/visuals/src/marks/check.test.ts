import { describe, expect, it } from "vitest";
import { DIRECTION_TOLERANCE, MARK_FAULT_CODES, checkMarks, type MarkFaultCode } from "./check.ts";
import type { Level } from "./levels.ts";
import type { Mark } from "./mark.ts";
import { FIELD, LINK, METER, METER_NO_LIMIT, POINT, RUN, SAMPLE_MARKS } from "./sample.ts";

/** This function gives the code and the part of each fault of one mark. */
function faultsOf(mark: Mark): readonly (readonly [MarkFaultCode, string])[] {
  return checkMarks([mark]).map((fault) => [fault.code, fault.part]);
}

describe("checkMarks", () => {
  it("gives no fault for a correct mark of each type", () => {
    expect(checkMarks(SAMPLE_MARKS)).toEqual([]);
    expect(checkMarks([])).toEqual([]);
  });

  it("gives no fault for a meter with no limit, and for a limit of 0", () => {
    expect("limit" in METER_NO_LIMIT).toBe(false);
    expect(checkMarks([METER_NO_LIMIT])).toEqual([]);
    expect(faultsOf({ ...METER, limit: undefined })).toEqual([]);
    expect(faultsOf({ ...METER, limit: 0 })).toEqual([]);
    expect(faultsOf({ ...METER, limit: -18 })).toEqual([]);
  });

  it("finds a limit of null, as in a list from JSON: a meter with no limit has no limit", () => {
    expect(faultsOf({ ...METER, limit: null } as unknown as Mark)).toEqual([["number", "limit"]]);
    expect(faultsOf({ ...METER_NO_LIMIT, value: Number.NaN })).toEqual([["number", "value"]]);
  });

  it("gives the index and the record name of the mark with the fault, in the sequence of the list", () => {
    const faults = checkMarks([POINT, { ...METER, value: Number.NaN }, RUN, { ...POINT, record: "sample/1:outlet-2", size: 0 }]);
    expect(faults.map((fault) => [fault.index, fault.record, fault.code])).toEqual([
      [1, "sample/1:circuit-1", "number"],
      [3, "sample/1:outlet-2", "size"],
    ]);
    expect(faults[0]?.message).toContain("NaN");
  });

  it("finds a mark with no record name, no kind or no label", () => {
    expect(faultsOf({ ...POINT, record: "" })).toEqual([["name", "record"]]);
    expect(faultsOf({ ...POINT, kind: "" })).toEqual([["name", "kind"]]);
    expect(faultsOf({ ...POINT, label: "  " })).toEqual([["label", "label"]]);
    expect(faultsOf({ ...POINT, label: "Outlet 1\nwall 2" })).toEqual([["label", "label"]]);
  });

  it("finds a level and a type that are not known, as in a list from JSON", () => {
    expect(faultsOf({ ...POINT, level: "high" as Level })).toEqual([["level", "level"]]);
    expect(faultsOf({ ...METER, type: "gauge" } as unknown as Mark)).toEqual([["type", "type"]]);
  });

  it("finds a number that is not finite, with the part that has it", () => {
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, at: { x: 1, y: Number.POSITIVE_INFINITY, z: 0 } } })).toEqual([["number", "frame.at.y"]]);
    expect(faultsOf({ ...LINK, to: { ...LINK.to, at: { x: Number.NaN, y: 0, z: 0 } } })).toEqual([["number", "to.at.x"]]);
    expect(faultsOf({ ...METER, limit: Number.NEGATIVE_INFINITY })).toEqual([["number", "limit"]]);
  });

  it("finds a direction that is not a unit vector", () => {
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, out: { x: 0, y: 2, z: 0 } } })).toEqual([["direction", "frame.out"]]);
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, out: { x: 0, y: 0, z: 0 } } })).toEqual([["direction", "frame.out"]]);
    const [first, second, third] = RUN.path;
    if (first === undefined || second === undefined || third === undefined) throw new Error("the sample run has 3 points");
    expect(faultsOf({ ...RUN, path: [first, second, { ...third, out: { x: 0, y: 0.5, z: -1 } }] })).toEqual([["direction", "path[2].out"]]);
  });

  it("accepts a direction that is a unit vector with the tolerance", () => {
    const near = 1 + DIRECTION_TOLERANCE / 2;
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, out: { x: 0, y: near, z: 0 } } })).toEqual([]);
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, out: { x: 0, y: 1 + DIRECTION_TOLERANCE * 4, z: 0 } } })).toEqual([["direction", "frame.out"]]);
  });

  it("gives one fault for a direction with a number that is not finite, not also a fault of its length", () => {
    expect(faultsOf({ ...POINT, frame: { ...POINT.frame, out: { x: 0, y: Number.NaN, z: 0 } } })).toEqual([["number", "frame.out.y"]]);
  });

  it("finds a size, a width and a cell that are not more than 0", () => {
    expect(faultsOf({ ...POINT, size: 0.1 })).toEqual([]);
    expect(faultsOf({ ...POINT, size: -1 })).toEqual([["size", "size"]]);
    expect(faultsOf({ ...RUN, width: 0 })).toEqual([["size", "width"]]);
    expect(faultsOf({ ...FIELD, cell: 0 })).toEqual([["size", "cell"]]);
  });

  it("finds a run with fewer than 2 points", () => {
    expect(faultsOf({ ...RUN, path: RUN.path.slice(0, 1) })).toEqual([["path", "path"]]);
    expect(faultsOf({ ...RUN, path: [] })).toEqual([["path", "path"]]);
    expect(faultsOf({ ...RUN, path: RUN.path.slice(0, 2) })).toEqual([]);
  });

  it("finds a link with an end that has no record name", () => {
    expect(faultsOf({ ...LINK, from: { ...LINK.from, record: "" } })).toEqual([["name", "from.record"]]);
  });

  it("finds a field whose column step is not in its plane", () => {
    expect(faultsOf({ ...FIELD, across: { x: 0, y: 0, z: 1 } })).toEqual([["angle", "across"]]);
    expect(faultsOf({ ...FIELD, across: { x: 0, y: 1, z: 0 } })).toEqual([]);
  });

  it("finds a field whose grid is not correct", () => {
    expect(faultsOf({ ...FIELD, columns: 0 })).toEqual([["grid", "columns"]]);
    expect(faultsOf({ ...FIELD, rows: 1.5 })).toEqual([["grid", "rows"]]);
  });

  it("finds a field that does not have one value for each cell", () => {
    expect(faultsOf({ ...FIELD, values: FIELD.values.slice(0, 5) })).toEqual([["values", "values"]]);
    expect(faultsOf({ ...FIELD, columns: 2 })).toEqual([["values", "values"]]);
    expect(checkMarks([{ ...FIELD, columns: 2 }])[0]?.message).toContain("need 4");
  });

  it("gives one fault for the values of a field that are not finite, with their number and the first index", () => {
    const faults = checkMarks([{ ...FIELD, values: [100, Number.NaN, 300, Number.POSITIVE_INFINITY, null, 600] }]);
    expect(faults.map((fault) => [fault.code, fault.part])).toEqual([["number", "values[1]"]]);
    expect(faults[0]?.message).toContain("2 of the values");
  });

  it("finds a scale whose min is not less than its max", () => {
    expect(faultsOf({ ...FIELD, scale: { min: 600, max: 600, unit: "lx" } })).toEqual([["scale", "scale"]]);
    expect(faultsOf({ ...FIELD, scale: { min: 0, max: Number.NaN, unit: "lx" } })).toEqual([["number", "scale.max"]]);
  });

  it("has a test for each code", () => {
    const bad: readonly Mark[] = [
      { ...METER, type: "gauge" } as unknown as Mark,
      { ...POINT, level: "high" as Level },
      { ...POINT, record: "" },
      { ...POINT, label: "" },
      { ...METER, value: Number.NaN },
      { ...POINT, frame: { ...POINT.frame, out: { x: 0, y: 2, z: 0 } } },
      { ...FIELD, across: { x: 0, y: 0, z: 1 } },
      { ...RUN, width: 0 },
      { ...FIELD, columns: 0 },
      { ...FIELD, values: [] },
      { ...FIELD, scale: { min: 1, max: 0, unit: "lx" } },
      { ...RUN, path: [] },
    ];
    expect(new Set(checkMarks(bad).map((fault) => fault.code))).toEqual(new Set(MARK_FAULT_CODES));
  });
});
