import type { LatLon, MultiPolygon, Polygon, Position } from "@mark1russell7/geo";
import { LAND_RINGS } from "./land.ts";

/** The levels of a warning area, from the lowest to the highest. */
export const LEVELS = ["advisory", "watch", "warning"] as const;

/** The level of a warning area. */
export type Level = (typeof LEVELS)[number];

/** A warning for an area of the Earth. Each area of the demo is made up. */
export interface AreaRecord {
  readonly record: string;
  readonly type: "area";
  readonly level: Level;
  /** The name of the warning, for example "Gale warning". */
  readonly title: string;
  /** The name of the area. */
  readonly place: string;
  /** One sentence that tells the danger. */
  readonly text: string;
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
}

/** A record of the demo. */
export type SampleRecord = AreaRecord | QuakeRecord;

/** The kinds of the legend: each level of an area, and the earthquakes. */
export const KINDS = ["warning", "watch", "advisory", "quake"] as const;

/** A kind of the legend. It is also the name of a style of the globe. */
export type Kind = (typeof KINDS)[number];

/** This function gives the kind of a record. */
export function kindOf(record: SampleRecord): Kind {
  return record.type === "quake" ? "quake" : record.level;
}

/** This function gives the name of a record for a person, for example "Gale warning, Bay of Biscay". */
export function nameOf(record: SampleRecord): string {
  return record.type === "quake" ? `Earthquake, ${record.place}` : `${record.title}, ${record.place}`;
}

/** This function gives the region of a warning area. */
export function regionOf(area: AreaRecord): Polygon {
  return { type: "Polygon", coordinates: [area.outline] };
}

/** The warning areas, from the lowest level to the highest level. The globe shows a later area above an earlier area. */
export const AREAS: readonly AreaRecord[] = [
  {
    record: "heat-iberia",
    type: "area",
    level: "advisory",
    title: "Heat advisory",
    place: "Iberian Peninsula",
    text: "Afternoon temperatures of 38 to 41 °C for three days.",
    outline: [[-1.2, 39.6], [-0.6, 40.6], [-0.7, 41.9], [-2.4, 42.5], [-4.4, 42.5], [-6.1, 42.2], [-7.2, 41.3], [-8.1, 40.5], [-8.8, 39.6], [-8.1, 38.7], [-7.2, 37.9], [-6.3, 36.8], [-4.4, 36.3], [-2.5, 36.8], [-1.3, 37.7], [-1, 38.7], [-1.2, 39.6]],
  },
  {
    record: "dust-sahel",
    type: "area",
    level: "advisory",
    title: "Dust advisory",
    place: "Western Sahel",
    text: "Dust decreases the visibility to less than 2 km.",
    outline: [[5.6, 15.4], [3.6, 16.5], [2, 17.5], [-1.1, 18.1], [-4.6, 18], [-7.7, 17.8], [-10.6, 17.3], [-13, 16.5], [-15.6, 15.4], [-15.3, 14], [-11.2, 13.3], [-7.4, 13.2], [-4.6, 13], [-1.5, 13], [2.2, 13.3], [5.7, 14.1], [5.6, 15.4]],
  },
  {
    record: "snow-hokkaido",
    type: "area",
    level: "advisory",
    title: "Snow advisory",
    place: "Hokkaido",
    text: "Snow of 20 to 30 cm on the west coast.",
    outline: [[145.7, 43.5], [145.1, 44], [144.3, 44.3], [143.7, 44.7], [142.8, 45.1], [141.7, 45], [140.8, 44.6], [140, 44.1], [139.9, 43.5], [140.3, 42.9], [140.9, 42.5], [142, 42.4], [142.8, 42.3], [143.9, 42.1], [145.2, 42.2], [145.8, 42.8], [145.7, 43.5]],
  },
  {
    record: "storm-north-sea",
    type: "area",
    level: "watch",
    title: "Storm watch",
    place: "North Sea",
    text: "Northwest winds of 45 knots are possible from tomorrow.",
    outline: [[7.6, 56.4], [6.7, 57.4], [6, 58.3], [4.7, 58.9], [3.2, 59.1], [1.5, 59.1], [0.1, 58.5], [-1, 57.6], [-2, 56.4], [-1.3, 55.2], [0.6, 54.6], [1.9, 54.3], [3.2, 53.9], [4.8, 53.8], [6.8, 53.9], [8.1, 55], [7.6, 56.4]],
  },
  {
    record: "hurricane-gulf",
    type: "area",
    level: "watch",
    title: "Hurricane watch",
    place: "Gulf of Mexico",
    text: "A hurricane can come to this area in 48 hours.",
    outline: [[-84.1, 25.2], [-84.2, 26.3], [-84.4, 27.8], [-86.6, 28.8], [-89.6, 28.4], [-91.7, 27.7], [-93.1, 26.9], [-94.2, 26.2], [-96, 25.2], [-96.5, 23.8], [-94.4, 22.8], [-92, 22.3], [-89.6, 22], [-87.3, 22.4], [-85.6, 23.2], [-84.2, 24.1], [-84.1, 25.2]],
  },
  {
    record: "cyclone-coral",
    type: "area",
    level: "watch",
    title: "Cyclone watch",
    place: "Coral Sea",
    text: "A tropical low can become a cyclone in two days.",
    outline: [[159.2, -17.2], [159, -15.5], [156.9, -14.6], [154.9, -14.6], [153.4, -14.1], [151.4, -13.7], [149.2, -14.2], [147.5, -15.4], [147.5, -17.2], [149.2, -18.5], [150.3, -19.5], [151.5, -20.6], [153.4, -20.8], [155.3, -20.6], [157.3, -20], [158.5, -18.7], [159.2, -17.2]],
  },
  {
    record: "gale-biscay",
    type: "area",
    level: "warning",
    title: "Gale warning",
    place: "Bay of Biscay",
    text: "Southwest winds of 40 to 50 knots, with a high sea.",
    outline: [[-1.3, 45.4], [-1.6, 46.4], [-2.5, 47.1], [-3.7, 48.1], [-5.6, 48.4], [-7.3, 47.7], [-8.1, 46.8], [-8.9, 46.2], [-9.4, 45.4], [-10, 44.4], [-9.5, 43.2], [-7.5, 42.8], [-5.6, 43], [-4, 43.2], [-2.7, 43.8], [-1.9, 44.5], [-1.3, 45.4]],
  },
  {
    record: "flood-mississippi",
    type: "area",
    level: "warning",
    title: "Flood warning",
    place: "Lower Mississippi",
    text: "The river is above its flood level at four gauges.",
    outline: [[-88.1, 32.6], [-88, 34.3], [-88.9, 35.4], [-90.1, 35.4], [-91, 35.5], [-91.9, 35.7], [-92.8, 35], [-93.4, 33.9], [-93.8, 32.6], [-93.5, 31.2], [-93, 29.9], [-92.1, 28.9], [-91, 29.2], [-90.3, 30.2], [-89.5, 30.6], [-88.6, 31.3], [-88.1, 32.6]],
  },
  {
    record: "cyclone-bengal",
    type: "area",
    level: "warning",
    title: "Cyclone warning",
    place: "Bay of Bengal",
    text: "A cyclone moves north at 12 knots.",
    outline: [[93.2, 15.2], [92.8, 17], [92, 18.8], [90.1, 19.6], [88.2, 19.6], [86.5, 19], [85.5, 17.8], [84.2, 16.8], [82.5, 15.2], [82.6, 13], [84.5, 11.7], [86.5, 11.2], [88.2, 11.4], [89.7, 11.8], [91.6, 11.9], [93.2, 13.2], [93.2, 15.2]],
  },
  {
    record: "fire-australia",
    type: "area",
    level: "warning",
    title: "Fire weather warning",
    place: "Southeastern Australia",
    text: "Hot, dry winds give an extreme fire danger.",
    outline: [[152.1, -36.2], [151.8, -35.1], [150, -34.5], [148.5, -34.3], [147.2, -34.2], [145.8, -34.1], [143.8, -34.2], [142.3, -35], [142.6, -36.2], [143.6, -37.1], [144.5, -37.8], [145.7, -38.3], [147.2, -38.5], [148.8, -38.5], [150.2, -38], [151.1, -37.2], [152.1, -36.2]],
  },
];

/** The earthquakes. */
export const QUAKES: readonly QuakeRecord[] = [
  { record: "quake-aleutian", type: "quake", place: "Aleutian Islands", magnitude: 6.4, depth: 35, at: { lat: 51.8, lon: -176.5 } },
  { record: "quake-sumatra", type: "quake", place: "West of Sumatra", magnitude: 6.1, depth: 22, at: { lat: 1.2, lon: 97.1 } },
  { record: "quake-fiji", type: "quake", place: "South of Fiji", magnitude: 6, depth: 550, at: { lat: -20.5, lon: 178.3 } },
  { record: "quake-chile", type: "quake", place: "Coast of central Chile", magnitude: 5.8, depth: 28, at: { lat: -33.2, lon: -72.3 } },
  { record: "quake-oaxaca", type: "quake", place: "Coast of Oaxaca", magnitude: 5.4, depth: 18, at: { lat: 15.8, lon: -96.4 } },
  { record: "quake-reykjanes", type: "quake", place: "Reykjanes Ridge", magnitude: 4.9, depth: 10, at: { lat: 61.5, lon: -27.8 } },
];

/** Each record of the demo, in the sequence of the list: the areas from the highest level, then the earthquakes from the largest. */
export const RECORDS: readonly SampleRecord[] = [...[...AREAS].sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level)), ...QUAKES];

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
