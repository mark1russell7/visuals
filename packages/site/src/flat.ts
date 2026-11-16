import type { MultiPolygon, Position } from "@mark1russell7/geo";
import { svg } from "@mark1russell7/site-pages/chrome";
import { nameOf, type SampleRecord, type Version } from "./sample.ts";

/** A flat map of the Earth: the picture of the page in a browser with no WebGL 2. */
export interface FlatMap {
  readonly element: SVGSVGElement;
  /** This function highlights the record under the pointer and the selected record, by their names. */
  highlight(hovered: string | undefined, selected: string | undefined): void;
  /** This function shows only the versions that a test accepts. */
  show(test: (version: Version) => boolean): void;
}

/** The functions that a flat map starts for the pointer. */
export interface FlatMapEvents {
  readonly onHover: (record: SampleRecord | undefined) => void;
  readonly onSelect: (record: SampleRecord | undefined) => void;
}

/** This function gives the path of a ring on the map. The axis x is the longitude, and the north is at the top. */
function ringPath(ring: readonly Position[]): string {
  return `${ring.map(([lon = 0, lat = 0], index) => `${index === 0 ? "M" : "L"}${String(lon)} ${String(-lat)}`).join("")}Z`;
}

/** This function gives the radius of the dot of an earthquake, in degrees. */
function quakeRadius(magnitude: number): number {
  return 1.4 + Math.max(magnitude - 4.5, 0) * 1.1;
}

/**
 * This function makes a flat map with the land and one shape for each version of a record.
 * One degree of longitude is as wide as one degree of latitude is tall.
 * The map is a picture with no camera. A person selects a record with a click on its shape, or in the list of the page.
 */
export function createFlatMap(land: MultiPolygon, versions: readonly Version[], events: FlatMapEvents): FlatMap {
  const shapes = new Map<SVGElement, Version>();
  const landPath = svg("path", { class: "flat-land", "fill-rule": "evenodd", d: land.coordinates.flatMap((rings) => rings.map(ringPath)).join("") });
  for (const version of versions) {
    const { record } = version;
    const attrs = { class: "flat-record", "data-kind": version.kind, "data-record": record.record };
    const title = svg("title", {}, nameOf(version));
    const shape =
      record.type === "quake"
        ? svg("circle", { ...attrs, cx: record.at.lon, cy: -record.at.lat, r: quakeRadius(record.magnitude) }, title)
        : svg("path", { ...attrs, d: (version.region?.coordinates ?? []).map(ringPath).join("") }, title);
    shape.addEventListener("pointerenter", () => {
      events.onHover(record);
    });
    shape.addEventListener("pointerleave", () => {
      events.onHover(undefined);
    });
    shapes.set(shape, version);
  }
  const element = svg(
    "svg",
    { class: "flat", viewBox: "-180 -90 360 180", role: "img", "aria-label": "A flat map of the Earth with sample warnings and earthquakes" },
    svg("rect", { class: "flat-sea", x: -180, y: -90, width: 360, height: 180 }),
    landPath,
    [...shapes.keys()],
  );
  element.addEventListener("click", (event) => {
    const shape = event.target instanceof Element ? event.target.closest<SVGElement>("[data-record]") : null;
    events.onSelect(shape === null ? undefined : shapes.get(shape)?.record);
  });
  return {
    element,
    highlight(hovered, selected) {
      for (const [shape, version] of shapes) {
        shape.classList.toggle("is-hovered", version.record.record === hovered);
        shape.classList.toggle("is-selected", version.record.record === selected);
      }
    },
    show(test) {
      for (const [shape, version] of shapes) shape.style.display = test(version) ? "" : "none";
    },
  };
}
