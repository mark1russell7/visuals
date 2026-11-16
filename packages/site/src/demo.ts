import { h } from "@mark1russell7/site-pages/chrome";
import { changeIndex, isLive, replayOf } from "@mark1russell7/visuals";
import { GLOBE_POLAR, createGlobe, globePoint, globeView, inSight, pointRadius, regionView, type GlobeArea, type GlobePoint, type GlobeTheme } from "@mark1russell7/visuals/globe";
import { createLabels, type StageLabel } from "@mark1russell7/visuals/labels";
import { createScrubber } from "@mark1russell7/visuals/scrubber";
import { createStage, stackContents } from "@mark1russell7/visuals/three";
import { globeTheme, onThemeChange } from "./colors.ts";
import { createFlatMap } from "./flat.ts";
import { CHANGES, HISTORY, KINDS, RECORDS, TIME_LABELS, VERSIONS, landRegion, nameOf, recordsAt, timeText, versionAt, type Kind, type QuakeRecord, type SampleRecord, type Version } from "./sample.ts";

/** The elements of the page that the demo uses. */
export interface DemoElements {
  /** The box of the picture. It has a size before the demo starts. */
  readonly picture: HTMLElement;
  /** The line that names the record under the pointer, or the selected record. */
  readonly readout: HTMLElement;
  /** The box of the control of the time. The demo puts a scrubber in it. */
  readonly time: HTMLElement;
  /** The box of the buttons of the views. Each button has the name of its view in `data-view`. */
  readonly views: HTMLElement;
  /** The line that tells how to move the picture. */
  readonly hint: HTMLElement;
  /** The box of the legend. The demo puts one button for each kind in it. */
  readonly legend: HTMLElement;
  /** The list of the records. The demo puts one item for each record in it. */
  readonly records: HTMLElement;
}

/** The parts of the row of a record in the list. The row shows the version of the record at the time of the picture. */
interface Row {
  readonly record: SampleRecord;
  readonly item: HTMLElement;
  readonly button: HTMLElement;
  readonly sign: HTMLElement;
  readonly name: HTMLElement;
  readonly more: HTMLElement;
}

/** The name of each kind in the legend. */
const KIND_NAMES: Readonly<Record<Kind, string>> = { warning: "Warning", watch: "Watch", advisory: "Advisory", quake: "Earthquake" };

/** The width of the dot of an earthquake of magnitude 4.5, in CSS pixels. */
const QUAKE_SIZE = 7;

/** The width that one unit of magnitude adds to the dot of an earthquake, in CSS pixels. */
const QUAKE_GROWTH = 4;

/** The smallest distance between the name of a place and an edge of the picture, in CSS pixels. */
const NAME_EDGE = 2;

/** The space around a selected area in its view. The picture also shows the land and the sea around the area. */
const AREA_MARGIN = 3.5;

/** The angle of the cap of the Earth around a selected earthquake, in degrees. */
const QUAKE_CAP = 20;

/** The largest step of an edge of the globe, in degrees. The land has many corners, and this step keeps the picture fast. */
const STEP = 2;

/** This function gives the width of the dot of an earthquake, in CSS pixels. A larger earthquake has a larger dot. */
function quakeSize(quake: QuakeRecord): number {
  return QUAKE_SIZE + Math.max(quake.magnitude - 4.5, 0) * QUAKE_GROWTH;
}

/** This function makes the sign of a kind: a small shape with the color of the kind. The style sheet draws it. */
function sign(kind: Kind): HTMLElement {
  return h("span", { class: "sign", "data-kind": kind, "aria-hidden": "true" });
}

/**
 * This function starts the live demo: a globe with the sample records, a legend that filters them and a list that selects them.
 * A scrubber sets the time of the picture, and it replays the 72 hours of the sample.
 * A browser with no WebGL 2 gets a flat map of the same records.
 */
export function startDemo(elements: DemoElements): void {
  const land = landRegion();
  const hidden = new Set<Kind>();
  let hovered: SampleRecord | undefined;
  let selected: SampleRecord | undefined;
  /** The time of the picture. */
  let at = HISTORY.to;
  /** The count of the changes before the picture. The picture is the same between two changes. */
  let drawn = changeIndex(CHANGES, at);

  // The globe has one part for each version of a record. The versions of one record have one name, so they are one record.
  const areas: GlobeArea<Version | undefined>[] = [
    { record: "land", kind: "land", value: undefined, region: land, pick: false },
    ...VERSIONS.flatMap((version) => (version.region === undefined ? [] : [{ record: version.record.record, kind: version.kind, value: version, region: version.region }])),
  ];
  const points: GlobePoint<Version | undefined>[] = VERSIONS.flatMap((version) => {
    const { record } = version;
    if (record.type !== "quake") return [];
    return [{ record: record.record, kind: version.kind, value: version, place: record.at, size: quakeSize(record) }];
  });
  const globe = createGlobe({ areas, points, step: STEP, grid: 15, lineWidth: 1.5, highlightWidth: 3 });
  // The name of the place of each earthquake is next to its dot. When two names have one place, the larger earthquake keeps its name.
  const named = new Map<StageLabel, Version>();
  for (const version of VERSIONS) {
    const { record } = version;
    if (record.type !== "quake") continue;
    named.set({ record: record.record, at: globePoint(record.at), text: record.place, kind: version.kind, rank: record.magnitude, clear: pointRadius(quakeSize(record)) }, version);
  }
  // A place on the far side of the Earth has no name in the picture.
  const names = createLabels(elements.picture, { labels: [...named.keys()], visible: (point, eye) => inSight(point, eye, 1), edge: NAME_EDGE });
  const content = stackContents<Version | undefined, GlobeTheme>([globe, names]);
  const stage = createStage(elements.picture, {
    content,
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
      hover(pick?.record);
    },
    onSelect: (pick) => {
      select(pick?.record, false);
    },
  });
  // The globe and the names are in the stage only when the stage exists. Without a stage, the page shows a flat map of the same records.
  const flat =
    stage === undefined
      ? createFlatMap(land, VERSIONS, {
          onHover: (record) => {
            hover(record);
          },
          onSelect: (record) => {
            select(record, false);
          },
        })
      : undefined;
  if (flat !== undefined) {
    content.dispose();
    elements.picture.append(flat.element);
    elements.picture.classList.add("is-flat");
    elements.views.hidden = true;
    elements.hint.textContent = "This browser has no WebGL 2, so the page shows a flat map. Select a record in the list.";
  }

  const rows: Row[] = RECORDS.map((record) => {
    const mark = sign("quake");
    const name = h("span", { class: "record-name" });
    const more = h("span", { class: "record-more" });
    const button = h("button", { class: "record", type: "button", "data-record": record.record, "aria-pressed": "false" }, mark, name, h("span", { class: "record-place" }, record.place), more);
    button.addEventListener("click", () => {
      select(selected === record ? undefined : record, true);
    });
    button.addEventListener("pointerenter", () => {
      hover(record);
    });
    button.addEventListener("pointerleave", () => {
      hover(undefined);
    });
    const item = h("li", {}, button);
    elements.records.append(item);
    return { record, item, button, sign: mark, name, more };
  });

  const counts = new Map<Kind, HTMLElement>();
  for (const kind of KINDS) {
    const count = h("span", { class: "count" });
    const button = h("button", { class: "kind", type: "button", "data-kind": kind, "aria-pressed": "true" }, sign(kind), `${KIND_NAMES[kind]} `, count);
    button.addEventListener("click", () => {
      if (hidden.has(kind)) hidden.delete(kind);
      else hidden.add(kind);
      button.setAttribute("aria-pressed", String(!hidden.has(kind)));
      draw();
    });
    counts.set(kind, count);
    elements.legend.append(button);
  }

  for (const button of elements.views.querySelectorAll<HTMLButtonElement>("button[data-view]")) {
    button.addEventListener("click", () => {
      stage?.setView(button.dataset["view"] ?? "atlantic");
    });
  }

  createScrubber(elements.time, {
    label: "Time of the picture",
    replay: replayOf(HISTORY, at),
    times: CHANGES,
    labels: TIME_LABELS,
    format: timeText,
    onChange: (replay) => {
      at = replay.at;
      const index = changeIndex(CHANGES, at);
      if (index === drawn) return;
      drawn = index;
      draw();
    },
  });

  /** This function tells if a version is in the picture: it is of the time, and the legend has its kind on. */
  function shown(version: Version | undefined): version is Version {
    return version !== undefined && isLive(version.life, at) && !hidden.has(version.kind);
  }

  /** This function shows the highlights of the pointer and of the selection in the picture, in the list and in the line of the name. */
  function paint(): void {
    stage?.highlight(hovered === undefined ? [] : [hovered.record]);
    flat?.highlight(hovered?.record, selected?.record);
    for (const row of rows) {
      row.button.classList.toggle("is-hovered", row.record === hovered);
      row.button.setAttribute("aria-pressed", String(row.record === selected));
    }
    const named = hovered ?? selected;
    const version = named === undefined ? undefined : versionAt(named, at);
    elements.readout.textContent = version === undefined ? "" : nameOf(version);
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
    if (record !== undefined && move) {
      const region = versionAt(record, at)?.region;
      if (record.type === "quake") stage?.setView(globeView(record.at, QUAKE_CAP));
      else if (region !== undefined) stage?.setView(regionView([region], AREA_MARGIN));
    }
    paint();
  }

  /** This function puts the rows of the list in the sequence of the records of the time. A row with no record of the time is last. */
  function sortRows(live: readonly Version[]): void {
    const place = new Map(live.map((version, index) => [version.record, index]));
    const sorted = [...rows].sort((a, b) => (place.get(a.record) ?? live.length) - (place.get(b.record) ?? live.length));
    if (sorted.every((row, index) => elements.records.children[index] === row.item)) return;
    // A row that moves in the list loses the keyboard. The row gets it back.
    const active = elements.records.ownerDocument.activeElement;
    elements.records.append(...sorted.map((row) => row.item));
    if (active instanceof HTMLElement && elements.records.contains(active)) active.focus();
  }

  /**
   * This function shows the records of the time of the picture, less the kinds that the legend has off.
   * It starts after a change of the legend, and when the time goes across a change of the sample.
   */
  function draw(): void {
    const live = recordsAt(at);
    const versions = new Map(live.map((version) => [version.record, version]));
    // The land has no record, so it has no value. It stays in the picture.
    if (stage !== undefined) {
      globe.show((part) => part.value === undefined || shown(part.value));
      names.show((label) => shown(named.get(label)));
    }
    flat?.show(shown);
    for (const row of rows) {
      const version = versions.get(row.record);
      row.item.hidden = !shown(version);
      if (version === undefined) continue;
      row.button.dataset["kind"] = version.kind;
      row.sign.dataset["kind"] = version.kind;
      row.name.textContent = version.title;
      row.more.textContent = version.text;
    }
    sortRows(live);
    for (const [kind, count] of counts) count.textContent = String(live.filter((version) => version.kind === kind).length);
    if (hovered !== undefined && !shown(versions.get(hovered))) hovered = undefined;
    if (selected !== undefined && !shown(versions.get(selected))) select(undefined, false);
    else paint();
    stage?.refresh();
  }

  onThemeChange(() => {
    stage?.setTheme(globeTheme());
  });
  draw();
}
