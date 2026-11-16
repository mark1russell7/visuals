import type { LatLon, MultiPolygon, Polygon, Position } from "@mark1russell7/geo";
import { changeTimes, isLive, type Lifetime, type TimeSpan } from "@mark1russell7/visuals";
import type { ScrubberLabel } from "@mark1russell7/visuals/scrubber";
import { LAND_RINGS } from "./land.ts";

/** The levels of a warning area, from the lowest to the highest. */
export const LEVELS = ["advisory", "watch", "warning"] as const;

/** The level of a warning area. */
export type Level = (typeof LEVELS)[number];

/**
 * One state of a warning area: from a time, the area has a level and a text.
 * Each time of the demo is a count of hours from the present. The present is 0, so a time that passed is negative.
 */
export interface AreaState {
  readonly from: number;
  readonly level: Level;
  /** One sentence that tells the danger. */
  readonly text: string;
  /** How far the area is from its outline: degrees to the east, then degrees to the north. The area of a storm moves. */
  readonly moved?: readonly [number, number] | undefined;
}

/** A warning for an area of the Earth, with its states in time. Each area of the demo is made up. */
export interface AreaRecord {
  readonly record: string;
  readonly type: "area";
  /** The danger, for example "Gale". The title of the area is the danger and the level: "Gale warning". */
  readonly hazard: string;
  /** The name of the area. */
  readonly place: string;
  /** The states of the area, in the sequence of time. */
  readonly states: readonly AreaState[];
  /** The time of the end of the warning. An area with no end is active at the present. */
  readonly to?: number | undefined;
  /** The outer ring of the area: each corner is a longitude, then a latitude. The last corner is the first corner. */
  readonly outline: readonly Position[];
}

/** An earthquake at a place on the Earth. Each earthquake of the demo is made up. */
export interface QuakeRecord {
  readonly record: string;
  readonly type: "quake";
  readonly place: string;
  readonly magnitude: number;
  /** The depth, in kilometers. */
  readonly depth: number;
  readonly at: LatLon;
  /** The time of the earthquake. */
  readonly time: number;
}

/** A record of the demo. */
export type SampleRecord = AreaRecord | QuakeRecord;

/** The kinds of the legend: each level of an area, and the earthquakes. */
export const KINDS = ["warning", "watch", "advisory", "quake"] as const;

/** A kind of the legend. It is also the name of a style of the globe. */
export type Kind = (typeof KINDS)[number];

/**
 * A record in one part of its time: one state of a warning area, or an earthquake.
 * The picture has one part for each version, and it shows the versions of one time.
 */
export interface Version {
  readonly record: SampleRecord;
  readonly kind: Kind;
  /** The time in which the version is in the picture. */
  readonly life: Lifetime;
  /** The first words of the version in the list, for example "Gale warning" or "Earthquake". */
  readonly title: string;
  /** One sentence that tells the danger, or the size of an earthquake. */
  readonly text: string;
  /** The region of a warning area in this state. An earthquake has no region. */
  readonly region?: Polygon | undefined;
}

/** This function gives the name of a version for a person, for example "Gale warning, Bay of Biscay". */
export function nameOf(version: Version): string {
  return `${version.title}, ${version.record.place}`;
}

/**
 * This function gives the versions of a record, in the sequence of time.
 * An area has one version for each state: a state ends at the start of the next state, or at the end of the area.
 * An earthquake has one version, from its time.
 */
export function versionsOf(record: SampleRecord): readonly Version[] {
  if (record.type === "quake") {
    const text = `Magnitude ${record.magnitude.toFixed(1)}, at a depth of ${String(record.depth)} km.`;
    return [{ record, kind: "quake", life: { from: record.time }, title: "Earthquake", text }];
  }
  return record.states.map((state, index) => {
    const [east, north] = state.moved ?? [0, 0];
    const outline: Position[] = record.outline.map(([lon = 0, lat = 0]) => [lon + east, lat + north]);
    return {
      record,
      kind: state.level,
      life: { from: state.from, to: record.states[index + 1]?.from ?? record.to },
      title: `${record.hazard} ${state.level}`,
      text: state.text,
      region: { type: "Polygon", coordinates: [outline] },
    };
  });
}

/** The warning areas, from the lowest level to the highest level of their last state. */
export const AREAS: readonly AreaRecord[] = [
  {
    record: "heat-iberia",
    type: "area",
    hazard: "Heat",
    place: "Iberian Peninsula",
    states: [
      { from: -60, level: "advisory", text: "Afternoon temperatures of 38 to 41 °C for three days." },
    ],
    outline: [[-1.2, 39.6], [-0.6, 40.6], [-0.7, 41.9], [-2.4, 42.5], [-4.4, 42.5], [-6.1, 42.2], [-7.2, 41.3], [-8.1, 40.5], [-8.8, 39.6], [-8.1, 38.7], [-7.2, 37.9], [-6.3, 36.8], [-4.4, 36.3], [-2.5, 36.8], [-1.3, 37.7], [-1, 38.7], [-1.2, 39.6]],
  },
  {
    record: "dust-sahel",
    type: "area",
    hazard: "Dust",
    place: "Western Sahel",
    states: [
      { from: -34, level: "advisory", text: "Dust decreases the visibility to less than 2 km." },
    ],
    outline: [[5.6, 15.4], [3.6, 16.5], [2, 17.5], [-1.1, 18.1], [-4.6, 18], [-7.7, 17.8], [-10.6, 17.3], [-13, 16.5], [-15.6, 15.4], [-15.3, 14], [-11.2, 13.3], [-7.4, 13.2], [-4.6, 13], [-1.5, 13], [2.2, 13.3], [5.7, 14.1], [5.6, 15.4]],
  },
  {
    record: "snow-hokkaido",
    type: "area",
    hazard: "Snow",
    place: "Hokkaido",
    states: [
      { from: -9, level: "advisory", text: "Snow of 20 to 30 cm on the west coast." },
    ],
    outline: [[145.7, 43.5], [145.1, 44], [144.3, 44.3], [143.7, 44.7], [142.8, 45.1], [141.7, 45], [140.8, 44.6], [140, 44.1], [139.9, 43.5], [140.3, 42.9], [140.9, 42.5], [142, 42.4], [142.8, 42.3], [143.9, 42.1], [145.2, 42.2], [145.8, 42.8], [145.7, 43.5]],
  },
  {
    record: "fog-channel",
    type: "area",
    hazard: "Fog",
    place: "English Channel",
    states: [
      { from: -68, level: "advisory", text: "Fog decreases the visibility to less than 200 m." },
    ],
    to: -50,
    outline: [[1.4, 50.9], [0.2, 50.6], [-1.2, 50.5], [-2.6, 50.4], [-4, 50.1], [-5.2, 49.8], [-5, 49.2], [-3.6, 48.9], [-2.2, 49.3], [-1.2, 49.8], [0, 49.9], [1.2, 50.3], [1.4, 50.9]],
  },
  {
    record: "storm-north-sea",
    type: "area",
    hazard: "Storm",
    place: "North Sea",
    states: [
      { from: -30, level: "advisory", text: "Northwest winds of 30 knots are possible in two days." },
      { from: -12, level: "watch", text: "Northwest winds of 45 knots are possible from tomorrow." },
    ],
    outline: [[7.6, 56.4], [6.7, 57.4], [6, 58.3], [4.7, 58.9], [3.2, 59.1], [1.5, 59.1], [0.1, 58.5], [-1, 57.6], [-2, 56.4], [-1.3, 55.2], [0.6, 54.6], [1.9, 54.3], [3.2, 53.9], [4.8, 53.8], [6.8, 53.9], [8.1, 55], [7.6, 56.4]],
  },
  {
    record: "hurricane-gulf",
    type: "area",
    hazard: "Hurricane",
    place: "Gulf of Mexico",
    states: [
      { from: -20, level: "watch", text: "A hurricane can come to this area in 60 hours.", moved: [4, -2.5] },
      { from: -8, level: "watch", text: "A hurricane can come to this area in 48 hours." },
    ],
    outline: [[-84.1, 25.2], [-84.2, 26.3], [-84.4, 27.8], [-86.6, 28.8], [-89.6, 28.4], [-91.7, 27.7], [-93.1, 26.9], [-94.2, 26.2], [-96, 25.2], [-96.5, 23.8], [-94.4, 22.8], [-92, 22.3], [-89.6, 22], [-87.3, 22.4], [-85.6, 23.2], [-84.2, 24.1], [-84.1, 25.2]],
  },
  {
    record: "cyclone-coral",
    type: "area",
    hazard: "Cyclone",
    place: "Coral Sea",
    states: [
      { from: -15, level: "watch", text: "A tropical low can become a cyclone in two days." },
    ],
    outline: [[159.2, -17.2], [159, -15.5], [156.9, -14.6], [154.9, -14.6], [153.4, -14.1], [151.4, -13.7], [149.2, -14.2], [147.5, -15.4], [147.5, -17.2], [149.2, -18.5], [150.3, -19.5], [151.5, -20.6], [153.4, -20.8], [155.3, -20.6], [157.3, -20], [158.5, -18.7], [159.2, -17.2]],
  },
  {
    record: "gale-biscay",
    type: "area",
    hazard: "Gale",
    place: "Bay of Biscay",
    states: [
      { from: -54, level: "advisory", text: "Southwest winds of 25 to 30 knots." },
      { from: -40, level: "watch", text: "Southwest winds of 40 knots are possible tonight." },
      { from: -22, level: "warning", text: "Southwest winds of 40 to 50 knots, with a high sea." },
    ],
    outline: [[-1.3, 45.4], [-1.6, 46.4], [-2.5, 47.1], [-3.7, 48.1], [-5.6, 48.4], [-7.3, 47.7], [-8.1, 46.8], [-8.9, 46.2], [-9.4, 45.4], [-10, 44.4], [-9.5, 43.2], [-7.5, 42.8], [-5.6, 43], [-4, 43.2], [-2.7, 43.8], [-1.9, 44.5], [-1.3, 45.4]],
  },
  {
    record: "flood-mississippi",
    type: "area",
    hazard: "Flood",
    place: "Lower Mississippi",
    states: [
      { from: -66, level: "watch", text: "The river comes near its flood level at two gauges." },
      { from: -47, level: "warning", text: "The river is above its flood level at four gauges." },
    ],
    outline: [[-88.1, 32.6], [-88, 34.3], [-88.9, 35.4], [-90.1, 35.4], [-91, 35.5], [-91.9, 35.7], [-92.8, 35], [-93.4, 33.9], [-93.8, 32.6], [-93.5, 31.2], [-93, 29.9], [-92.1, 28.9], [-91, 29.2], [-90.3, 30.2], [-89.5, 30.6], [-88.6, 31.3], [-88.1, 32.6]],
  },
  {
    record: "cyclone-bengal",
    type: "area",
    hazard: "Cyclone",
    place: "Bay of Bengal",
    states: [
      { from: -58, level: "watch", text: "A tropical storm becomes stronger, and it moves north.", moved: [1.6, -5] },
      { from: -36, level: "warning", text: "A cyclone moves north at 8 knots.", moved: [0.8, -2.4] },
      { from: -14, level: "warning", text: "A cyclone moves north at 12 knots." },
    ],
    outline: [[93.2, 15.2], [92.8, 17], [92, 18.8], [90.1, 19.6], [88.2, 19.6], [86.5, 19], [85.5, 17.8], [84.2, 16.8], [82.5, 15.2], [82.6, 13], [84.5, 11.7], [86.5, 11.2], [88.2, 11.4], [89.7, 11.8], [91.6, 11.9], [93.2, 13.2], [93.2, 15.2]],
  },
  {
    record: "fire-australia",
    type: "area",
    hazard: "Fire weather",
    place: "Southeastern Australia",
    states: [
      { from: -26, level: "watch", text: "Hot, dry winds are possible in two days." },
      { from: -6, level: "warning", text: "Hot, dry winds give an extreme fire danger." },
    ],
    outline: [[152.1, -36.2], [151.8, -35.1], [150, -34.5], [148.5, -34.3], [147.2, -34.2], [145.8, -34.1], [143.8, -34.2], [142.3, -35], [142.6, -36.2], [143.6, -37.1], [144.5, -37.8], [145.7, -38.3], [147.2, -38.5], [148.8, -38.5], [150.2, -38], [151.1, -37.2], [152.1, -36.2]],
  },
  {
    record: "thunder-po",
    type: "area",
    hazard: "Thunderstorm",
    place: "Po Valley",
    states: [
      { from: -45, level: "watch", text: "Large hail and strong winds are possible this afternoon." },
      { from: -41, level: "warning", text: "Storms with large hail move east across the valley." },
    ],
    to: -35,
    outline: [[12.4, 45.2], [11.6, 45.7], [10.4, 45.8], [9.2, 45.7], [8.2, 45.5], [7.6, 45], [8, 44.6], [9, 44.5], [10.2, 44.4], [11.4, 44.5], [12.2, 44.7], [12.4, 45.2]],
  },
];

/** The earthquakes. */
export const QUAKES: readonly QuakeRecord[] = [
  { record: "quake-aleutian", type: "quake", place: "Aleutian Islands", magnitude: 6.4, depth: 35, at: { lat: 51.8, lon: -176.5 }, time: -33 },
  { record: "quake-sumatra", type: "quake", place: "West of Sumatra", magnitude: 6.1, depth: 22, at: { lat: 1.2, lon: 97.1 }, time: -4 },
  { record: "quake-fiji", type: "quake", place: "South of Fiji", magnitude: 6, depth: 550, at: { lat: -20.5, lon: 178.3 }, time: -61 },
  { record: "quake-chile", type: "quake", place: "Coast of central Chile", magnitude: 5.8, depth: 28, at: { lat: -33.2, lon: -72.3 }, time: -70 },
  { record: "quake-oaxaca", type: "quake", place: "Coast of Oaxaca", magnitude: 5.4, depth: 18, at: { lat: 15.8, lon: -96.4 }, time: -49 },
  { record: "quake-reykjanes", type: "quake", place: "Reykjanes Ridge", magnitude: 4.9, depth: 10, at: { lat: 61.5, lon: -27.8 }, time: -18 },
];

/** This function gives the place of the level of the last state of an area in `LEVELS`. */
function lastRank(area: AreaRecord): number {
  return LEVELS.indexOf(area.states.at(-1)?.level ?? "advisory");
}

/** Each record of the demo: the areas from the highest level of their last state, then the earthquakes from the largest. */
export const RECORDS: readonly SampleRecord[] = [...[...AREAS].sort((a, b) => lastRank(b) - lastRank(a)), ...QUAKES];

/**
 * Each version of the demo. The areas are first, from the lowest level to the highest level.
 * The globe shows a later area above an earlier area, so a warning is above a watch.
 */
export const VERSIONS: readonly Version[] = [
  ...AREAS.flatMap(versionsOf).sort((a, b) => KINDS.indexOf(b.kind) - KINDS.indexOf(a.kind)),
  ...QUAKES.flatMap(versionsOf),
];

/** This function gives the version of a record at a time, or `undefined` when the record is not in the picture at that time. */
export function versionAt(record: SampleRecord, at: number): Version | undefined {
  return VERSIONS.find((version) => version.record === record && isLive(version.life, at));
}

/**
 * This function gives the records of the picture at a time, in the sequence of the list.
 * The areas are first, from the highest level at that time. The earthquakes are last, from the largest.
 */
export function recordsAt(at: number): readonly Version[] {
  return RECORDS.flatMap((record) => versionAt(record, at) ?? []).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

/** The time of the demo: the 72 hours before the present. */
export const HISTORY: TimeSpan = { from: -72, to: 0 };

/** The times at which the picture of the demo changes: the start and the end of each version. */
export const CHANGES: readonly number[] = changeTimes(VERSIONS.map((version) => version.life));

/** The labels of the axis of the time. */
export const TIME_LABELS: readonly ScrubberLabel[] = [
  { at: -72, text: "3 days ago" },
  { at: -48, text: "2 days ago" },
  { at: -24, text: "1 day ago" },
  { at: 0, text: "Now" },
];

/** This function gives the text of a time of the demo, for example "38 hours ago". The nearest full hour gives the text. */
export function timeText(at: number): string {
  const hours = Math.round(0 - at);
  if (hours <= 0) return "Now";
  return hours === 1 ? "1 hour ago" : `${String(hours)} hours ago`;
}

/** The count of the units of `LAND_RINGS` in one degree. */
const LAND_UNITS = 100;

/** This function gives the land of the Earth as one region, from the rings of `LAND_RINGS`. */
export function landRegion(): MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: LAND_RINGS.map((rings) =>
      rings.map((flat) => {
        const ring: Position[] = [];
        for (let index = 0; index + 1 < flat.length; index += 2) ring.push([(flat[index] ?? 0) / LAND_UNITS, (flat[index + 1] ?? 0) / LAND_UNITS]);
        return ring;
      }),
    ),
  };
}
