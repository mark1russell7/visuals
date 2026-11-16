import type { MultiPolygon, Position } from "@mark1russell7/geo";
import { svg } from "@mark1russell7/site-pages/chrome";
import { kindOf, nameOf, type SampleRecord } from "./sample.ts";

/** A flat map of the Earth: the picture of the page in a browser with no WebGL 2. */
export interface FlatMap {
  readonly element: SVGSVGElement;
  /** This function highlights the record under the pointer and the selected record, by their names. */
  highlight(hovered: string | undefined, selected: string | undefined): void;
  /** This function shows only the records that a test accepts. */
  show(test: (record: SampleRecord) => boolean): void;
}

/** The functions that a flat map starts for the pointer. */
export interface FlatMapEvents {
  readonly onHover: (record: SampleRecord | undefined) => void;
  readonly onSelect: (record: SampleRecord | undefined) => void;
}

/** This function gives the path of a ring on the map. The axis x is the longitude, and the north is at the top. */
function ringPath(ring: readonly Position[]): string {
  return `${ring.map(([lon, lat], index) => `${index === 0 ? "M" : "L"}${lon} ${-lat}`).join("")}Z`;
}

/** This function gives the radius of the dot of an earthquake, in degrees. */
function quakeRadius(magnitude: number): number {
  return 1.4 + Math.max(magnitude - 4.5, 0) * 1.1;
}

/**
 * This function makes a flat map with the land and each record. One degree of longitude is as wide as one degree of latitude is tall.
 * The map is a picture with no camera. A person selects a record with a click on its shape, or in the list of the page.
 */
export function createFlatMap(land: MultiPolygon, records: readonly SampleRecord[], events: FlatMapEvents): FlatMap {
  const shapes = new Map<string, { readonly record: SampleRecord; readonly shape: SVGElement }>();
  const landPath = svg("path", { class: "flat-land", "fill-rule": "evenodd", d: land.coordinates.flatMap((rings) => rings.map(ringPath)).join("") });
  for (const record of records) {
    const attrs = { class: "flat-record", "data-kind": kindOf(record), "data-record": record.record };
    const title = svg("title", {}, nameOf(record));
    const shape =
      record.type === "quake"
        ? svg("circle", { ...attrs, cx: record.at.lon, cy: -record.at.lat, r: quakeRadius(record.magnitude) }, title)
        : svg("path", { ...attrs, d: ringPath(record.outline) }, title);
    shape.addEventListener("pointerenter", () => {
      events.onHover(record);
    });
    shape.addEventListener("pointerleave", () => {
      events.onHover(undefined);
    });
    shapes.set(record.record, { record, shape });
  }
  const element = svg(
    "svg",
    { class: "flat", viewBox: "-180 -90 360 180", role: "img", "aria-label": "A flat map of the Earth with sample warnings and earthquakes" },
    svg("rect", { class: "flat-sea", x: -180, y: -90, width: 360, height: 180 }),
    landPath,
    [...shapes.values()].map((part) => part.shape),
  );
  element.addEventListener("click", (event) => {
    const name = event.target instanceof Element ? event.target.closest<SVGElement>("[data-record]")?.dataset["record"] : undefined;
    events.onSelect(name === undefined ? undefined : shapes.get(name)?.record);
  });
  return {
    element,
    highlight(hovered, selected) {
      for (const [name, part] of shapes) {
        part.shape.classList.toggle("is-hovered", name === hovered);
        part.shape.classList.toggle("is-selected", name === selected);
      }
    },
    show(test) {
      for (const part of shapes.values()) part.shape.style.display = test(part.record) ? "" : "none";
    },
  };
}
