import type { FieldMark, Frame, LinkMark, Mark, PointMark, RunMark } from "@mark1russell7/visuals/marks";

// The sample of the room demo. Each value is made up: the room, its furniture, the loads and the light.
// The space has the unit meter. The y axis goes up, the back wall is the plane z = 0, and the left wall is the plane x = 0.

/** A point of the space of the room. */
export type RoomPoint = Frame["at"];

/** The size of the room: its width along the x axis, its height along the y axis and its depth along the z axis. */
export const ROOM: { readonly width: number; readonly height: number; readonly depth: number } = { width: 4.2, height: 2.4, depth: 3.2 };

/** A box of the room: a part of a piece of furniture or of a machine. The boxes of one record are one record. */
export interface RoomSolid {
  /** The name of the record of the box. */
  readonly record: string;
  /** One line of text: the name of the record for a person. */
  readonly label: string;
  /** The corner with the smallest value on each axis. */
  readonly low: RoomPoint;
  /** The corner with the largest value on each axis. */
  readonly high: RoomPoint;
}

/** The name of the record of the computer. The feed of an outlet ends at it. */
export const COMPUTER = "object:computer";

/** The boxes of the room: a desk at the back wall, and a computer on the floor next to it. */
export const ROOM_SOLIDS: readonly RoomSolid[] = [
  { record: "object:desk", label: "Desk", low: { x: 1.6, y: 0.72, z: 0.05 }, high: { x: 3, y: 0.76, z: 0.75 } },
  { record: "object:desk", label: "Desk", low: { x: 1.6, y: 0, z: 0.05 }, high: { x: 1.64, y: 0.72, z: 0.75 } },
  { record: "object:desk", label: "Desk", low: { x: 2.96, y: 0, z: 0.05 }, high: { x: 3, y: 0.72, z: 0.75 } },
  { record: COMPUTER, label: "Computer", low: { x: 3.2, y: 0, z: 0.2 }, high: { x: 3.42, y: 0.46, z: 0.66 } },
];

/** A mark of the sample, with the parts of its text. */
export interface RoomRecord {
  readonly mark: Mark;
  /** The short name of the mark, for the picture and for the list. */
  readonly name: string;
  /** The reading of the mark, for the list. */
  readonly detail: string;
}

/** The direction out of the back wall. */
const BACK: RoomPoint = { x: 0, y: 0, z: 1 };

/** The direction out of the left wall. */
const LEFT: RoomPoint = { x: 1, y: 0, z: 0 };

/** The direction out of the floor. */
const UP: RoomPoint = { x: 0, y: 1, z: 0 };

/** The height of an outlet above the floor. */
const OUTLET_HEIGHT = 0.3;

/** The position of the lamp on the left wall. The light on the floor comes from it. */
const LAMP: RoomPoint = { x: 0, y: 1.9, z: 0.9 };

/** The length of a side of a cell of the light on the floor. */
const CELL = 0.2;

/** The largest value of the scale of the light, in lux. */
const LIGHT_MAX = 500;

/** This function gives the text of a mark: its name, then its reading. */
function textOf(name: string, detail: string): string {
  return `${name}: ${detail}`;
}

function point(record: string, name: string, detail: string, level: PointMark["level"], frame: Frame, kind: string = "outlet", size?: number): RoomRecord {
  const mark: PointMark = { type: "point", record, kind, level, label: textOf(name, detail), frame, ...(size === undefined ? {} : { size }) };
  return { mark, name, detail };
}

/** This function tells if a point of the floor is below a box of the room. */
function covered(x: number, z: number): boolean {
  return ROOM_SOLIDS.some((solid) => x >= solid.low.x && x <= solid.high.x && z >= solid.low.z && z <= solid.high.z);
}

/** This function gives the light at a point of the floor, in lux. The light decreases with the distance from the lamp. */
function lightAt(x: number, z: number): number {
  const distance = Math.hypot(x - LAMP.x, LAMP.y, z - LAMP.z);
  return Math.round(30 + (1700 * LAMP.y) / distance ** 3);
}

/**
 * This function makes the light on the floor: one value for each cell of the floor.
 * A column goes along the z axis, and a row goes along the x axis. A cell below a box has no value.
 */
function light(): RoomRecord {
  const columns = Math.round(ROOM.depth / CELL);
  const rows = Math.round(ROOM.width / CELL);
  const values: (number | null)[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (row + 0.5) * CELL;
      const z = (column + 0.5) * CELL;
      values.push(covered(x, z) ? null : lightAt(x, z));
    }
  }
  const known = values.filter((value) => value !== null);
  const name = "Light on the floor";
  const detail = `${String(Math.min(...known))} lx to ${String(Math.max(...known))} lx`;
  const mark: FieldMark = {
    type: "field",
    record: "light",
    kind: "light",
    level: "ok",
    label: textOf(name, detail),
    frame: { at: { x: 0, y: 0, z: 0 }, out: UP },
    across: BACK,
    cell: CELL,
    columns,
    rows,
    values,
    scale: { min: 0, max: LIGHT_MAX, unit: "lx" },
  };
  return { mark, name, detail };
}

/** The cable from the outlet 3: down the left wall, then across the floor to the desk. It has more load than its limit. */
const CABLE: RunMark = {
  type: "run",
  record: "cable-3",
  kind: "cable",
  level: "over",
  label: textOf("Cable of outlet 3", "1900 W of 1800 W"),
  path: [
    { at: { x: 0, y: OUTLET_HEIGHT, z: 1.5 }, out: LEFT },
    { at: { x: 0, y: 0.02, z: 1.5 }, out: LEFT },
    { at: { x: 0.02, y: 0, z: 1.5 }, out: UP },
    { at: { x: 1.3, y: 0, z: 1.5 }, out: UP },
    { at: { x: 1.3, y: 0, z: 0.4 }, out: UP },
    { at: { x: 1.9, y: 0, z: 0.4 }, out: UP },
  ],
  width: 0.03,
};

/** The feed from the outlet behind the desk to the computer. The picture shows it while one of its ends has a highlight. */
const FEED: LinkMark = {
  type: "link",
  record: "feed-2",
  kind: "feed",
  level: "near",
  label: textOf("Feed of the computer", "from outlet 2"),
  from: { record: "outlet-2", at: { x: 2.3, y: OUTLET_HEIGHT, z: 0 } },
  to: { record: COMPUTER, at: { x: 3.31, y: 0.46, z: 0.43 } },
};

/** The marks of the room, in the sequence of the list. */
export const ROOM_RECORDS: readonly RoomRecord[] = [
  point("outlet-3", "Outlet 3", "1900 W of 1440 W", "over", { at: { x: 0, y: OUTLET_HEIGHT, z: 1.5 }, out: LEFT }),
  { mark: CABLE, name: "Cable of outlet 3", detail: "1900 W of 1800 W" },
  point("outlet-2", "Outlet 2", "1210 W of 1440 W", "near", { at: { x: 2.3, y: OUTLET_HEIGHT, z: 0 }, out: BACK }),
  { mark: FEED, name: "Feed of the computer", detail: "from outlet 2" },
  point("outlet-1", "Outlet 1", "310 W of 1440 W", "ok", { at: { x: 0.7, y: OUTLET_HEIGHT, z: 0 }, out: BACK }),
  point("outlet-4", "Outlet 4", "no reading", "unknown", { at: { x: 0, y: OUTLET_HEIGHT, z: 2.6 }, out: LEFT }),
  point("lamp-1", "Wall lamp", "12 W", "ok", { at: LAMP, out: LEFT }, "lamp", 0.28),
  light(),
];

/** The marks of the room, for the picture. */
export const ROOM_MARKS: readonly Mark[] = ROOM_RECORDS.map((record) => record.mark);

/** The kinds of the marks, in the sequence of the legend, each with its name. */
export const ROOM_KINDS: readonly { readonly kind: string; readonly name: string }[] = [
  { kind: "outlet", name: "Outlet" },
  { kind: "lamp", name: "Lamp" },
  { kind: "cable", name: "Cable" },
  { kind: "feed", name: "Feed" },
  { kind: "light", name: "Light" },
];

/** The text of each level, for the key below the picture. */
export const LEVEL_NAMES: Readonly<Record<Mark["level"], string>> = {
  unknown: "No reading",
  ok: "In its limit",
  near: "Near its limit",
  over: "Over its limit",
};
