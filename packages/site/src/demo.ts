import { h } from "@mark1russell7/site-pages/chrome";
import { GLOBE_POLAR, createGlobe, globeView, regionView, type GlobeArea, type GlobePoint } from "@mark1russell7/visuals/globe";
import { createStage } from "@mark1russell7/visuals/three";
import { globeTheme, onThemeChange } from "./colors.ts";
import { createFlatMap } from "./flat.ts";
import { AREAS, KINDS, QUAKES, RECORDS, kindOf, landRegion, nameOf, regionOf, type Kind, type SampleRecord } from "./sample.ts";

/** The elements of the page that the demo uses. */
export interface DemoElements {
  /** The box of the picture. It has a size before the demo starts. */
  readonly picture: HTMLElement;
  /** The line that names the record under the pointer, or the selected record. */
  readonly readout: HTMLElement;
  /** The box of the buttons of the views. Each button has the name of its view in `data-view`. */
  readonly views: HTMLElement;
  /** The line that tells how to move the picture. */
  readonly hint: HTMLElement;
  /** The box of the legend. The demo puts one button for each kind in it. */
  readonly legend: HTMLElement;
  /** The list of the records. The demo puts one item for each record in it. */
  readonly records: HTMLElement;
}

/** The name of each kind in the legend. */
const KIND_NAMES: Readonly<Record<Kind, string>> = { warning: "Warning", watch: "Watch", advisory: "Advisory", quake: "Earthquake" };

/** The width of the dot of an earthquake of magnitude 4.5, in CSS pixels. */
const QUAKE_SIZE = 7;

/** The width that one unit of magnitude adds to the dot of an earthquake, in CSS pixels. */
const QUAKE_GROWTH = 4;

/** The space around a selected area in its view. The picture also shows the land and the sea around the area. */
const AREA_MARGIN = 3.5;

/** The angle of the cap of the Earth around a selected earthquake, in degrees. */
const QUAKE_CAP = 20;

/** The largest step of an edge of the globe, in degrees. The land has many corners, and this step keeps the picture fast. */
const STEP = 2;

/** This function gives the second line of a record in the list: what the record tells. */
function detailOf(record: SampleRecord): string {
  return record.type === "quake" ? `Magnitude ${record.magnitude.toFixed(1)}, at a depth of ${record.depth} km.` : record.text;
}

/** This function makes the sign of a kind: a small shape with the color of the kind. The style sheet draws it. */
function sign(kind: Kind): HTMLElement {
  return h("span", { class: "sign", "data-kind": kind, "aria-hidden": "true" });
}

/**
 * This function starts the live demo: a globe with the sample records, a legend that filters them and a list that selects them.
 * A browser with no WebGL 2 gets a flat map of the same records.
 */
export function startDemo(elements: DemoElements): void {
  const land = landRegion();
  const hidden = new Set<Kind>();
  let hovered: SampleRecord | undefined;
  let selected: SampleRecord | undefined;

  const areas: GlobeArea<SampleRecord | undefined>[] = [
    { record: "land", kind: "land", value: undefined, region: land, pick: false },
    ...AREAS.map((area) => ({ record: area.record, kind: area.level, value: area, region: regionOf(area) })),
  ];
  const points: GlobePoint<SampleRecord | undefined>[] = QUAKES.map((quake) => ({
    record: quake.record,
    kind: "quake",
    value: quake,
    place: quake.at,
    size: QUAKE_SIZE + Math.max(quake.magnitude - 4.5, 0) * QUAKE_GROWTH,
  }));
  const globe = createGlobe({ areas, points, step: STEP, grid: 15, lineWidth: 1.5, highlightWidth: 3 });
  const stage = createStage(elements.picture, {
    content: globe,
    theme: globeTheme(),
    label: "The Earth as a globe, with sample warnings and earthquakes",
    views: {
      atlantic: globeView({ lat: 30, lon: -38 }),
      indian: globeView({ lat: 8, lon: 92 }, 62),
      pacific: globeView({ lat: 6, lon: 158 }, 78),
    },
    home: "atlantic",
    polar: GLOBE_POLAR,
    pan: false,
    onHover: (pick) => {
      hover(pick);
    },
    onSelect: (pick) => {
      select(pick, false);
    },
  });
  // The globe is in the stage only when the stage exists. Without a stage, the page shows a flat map of the same records.
  const flat =
    stage === undefined
      ? createFlatMap(land, RECORDS, {
          onHover: (record) => {
            hover(record);
          },
          onSelect: (record) => {
            select(record, false);
          },
        })
      : undefined;
  if (flat !== undefined) {
    globe.dispose();
    elements.picture.append(flat.element);
    elements.picture.classList.add("is-flat");
    elements.views.hidden = true;
    elements.hint.textContent = "This browser has no WebGL 2, so the page shows a flat map. Select a record in the list.";
  }

  const rows = new Map<string, HTMLButtonElement>();
  for (const record of RECORDS) {
    const row = h(
      "button",
      { class: "record", type: "button", "data-record": record.record, "data-kind": kindOf(record), "aria-pressed": "false" },
      sign(kindOf(record)),
      h("span", { class: "record-name" }, record.type === "quake" ? "Earthquake" : record.title),
      h("span", { class: "record-place" }, record.place),
      h("span", { class: "record-more" }, detailOf(record)),
    );
    row.addEventListener("click", () => {
      select(selected === record ? undefined : record, true);
    });
    row.addEventListener("pointerenter", () => {
      hover(record);
    });
    row.addEventListener("pointerleave", () => {
      hover(undefined);
    });
    rows.set(record.record, row);
    elements.records.append(h("li", {}, row));
  }

  for (const kind of KINDS) {
    const count = RECORDS.filter((record) => kindOf(record) === kind).length;
    const button = h("button", { class: "kind", type: "button", "data-kind": kind, "aria-pressed": "true" }, sign(kind), `${KIND_NAMES[kind]} `, h("span", { class: "count" }, String(count)));
    button.addEventListener("click", () => {
      if (hidden.has(kind)) hidden.delete(kind);
      else hidden.add(kind);
      button.setAttribute("aria-pressed", String(!hidden.has(kind)));
      filter();
    });
    elements.legend.append(button);
  }

  for (const button of elements.views.querySelectorAll<HTMLButtonElement>("button[data-view]")) {
    button.addEventListener("click", () => {
      stage?.setView(button.dataset["view"] ?? "atlantic");
    });
  }

  /** This function shows the highlights of the pointer and of the selection in the picture, in the list and in the line of the name. */
  function paint(): void {
    stage?.highlight(hovered === undefined ? [] : [hovered.record]);
    flat?.highlight(hovered?.record, selected?.record);
    for (const [name, row] of rows) {
      row.classList.toggle("is-hovered", name === hovered?.record);
      row.setAttribute("aria-pressed", String(name === selected?.record));
    }
    const named = hovered ?? selected;
    elements.readout.textContent = named === undefined ? "" : nameOf(named);
  }

  function hover(record: SampleRecord | undefined): void {
    if (record === hovered) return;
    hovered = record;
    paint();
  }

  /** This function selects a record, or no record. `move` is true when the camera goes to the record. */
  function select(record: SampleRecord | undefined, move: boolean): void {
    selected = record;
    stage?.select(record?.record);
    if (record !== undefined && move) stage?.setView(record.type === "quake" ? globeView(record.at, QUAKE_CAP) : regionView([regionOf(record)], AREA_MARGIN));
    paint();
  }

  /** This function shows only the records of the kinds that the legend has on. */
  function filter(): void {
    const shown = (record: SampleRecord): boolean => !hidden.has(kindOf(record));
    // The land has no record, so it has no value. It stays in the picture.
    if (stage !== undefined) globe.show((part) => part.value === undefined || shown(part.value));
    flat?.show(shown);
    for (const record of RECORDS) {
      const item = rows.get(record.record)?.parentElement;
      if (item !== null && item !== undefined) item.hidden = !shown(record);
    }
    if (hovered !== undefined && !shown(hovered)) hovered = undefined;
    if (selected !== undefined && !shown(selected)) select(undefined, false);
    else paint();
    stage?.refresh();
  }

  onThemeChange(() => {
    stage?.setTheme(globeTheme());
  });
  paint();
}
