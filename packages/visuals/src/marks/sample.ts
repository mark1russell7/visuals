import type { FieldMark, LinkMark, Mark, MeterMark, PointMark, RunMark } from "./mark.ts";

// The marks of the tests: one correct mark of each type, in a space with the z axis up. The entry does not export them.

/** A point on a wall that looks along the y axis. */
export const POINT: PointMark = {
  type: "point",
  record: "sample/1:outlet-1",
  kind: "outlet",
  level: "ok",
  label: "Outlet 1",
  frame: { at: { x: 1, y: 0, z: 0.3 }, out: { x: 0, y: 1, z: 0 } },
};

/** A run that goes up a wall and then across a ceiling, so its directions change. */
export const RUN: RunMark = {
  type: "run",
  record: "sample/1:cable-1",
  kind: "cable",
  level: "near",
  label: "Cable 1",
  path: [
    { at: { x: 1, y: 0, z: 0.3 }, out: { x: 0, y: 1, z: 0 } },
    { at: { x: 1, y: 0, z: 2.4 }, out: { x: 0, y: 1, z: 0 } },
    { at: { x: 1, y: 2, z: 2.4 }, out: { x: 0, y: 0, z: -1 } },
  ],
  width: 0.02,
};

/** A link between the point and a second record. */
export const LINK: LinkMark = {
  type: "link",
  record: "sample/1:feed-1",
  kind: "feed",
  level: "unknown",
  label: "Outlet 1 to the computer",
  from: { record: "sample/1:outlet-1", at: { x: 1, y: 0, z: 0.3 } },
  to: { record: "object:computer", at: { x: 2, y: 1, z: 0.7 } },
};

/** A field of 3 columns and 2 rows on a floor, with one cell that has no value. */
export const FIELD: FieldMark = {
  type: "field",
  record: "sample/1:light",
  kind: "light",
  level: "ok",
  label: "The light on the floor",
  frame: { at: { x: 0, y: 0, z: 0 }, out: { x: 0, y: 0, z: 1 } },
  across: { x: 1, y: 0, z: 0 },
  cell: 0.5,
  columns: 3,
  rows: 2,
  values: [100, 200, 300, 400, null, 600],
  scale: { min: 0, max: 600, unit: "lx" },
};

/** A meter above its limit. */
export const METER: MeterMark = {
  type: "meter",
  record: "sample/1:circuit-1",
  kind: "circuit",
  level: "over",
  label: "Circuit 1",
  value: 1900,
  limit: 1440,
  unit: "W",
};

/** A meter with no limit: it has only its value and its unit. */
export const METER_NO_LIMIT: MeterMark = {
  type: "meter",
  record: "sample/1:circuit-2",
  kind: "circuit",
  level: "unknown",
  label: "Circuit 2",
  value: 600,
  unit: "W",
};

/** One correct mark of each type. */
export const SAMPLE_MARKS: readonly Mark[] = [POINT, RUN, LINK, FIELD, METER];
