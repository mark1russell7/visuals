import { h, svg } from "@mark1russell7/site-pages/chrome";
import { fitView } from "@mark1russell7/visuals";
import { createLabels, type StageLabel } from "@mark1russell7/visuals/labels";
import { createMarkers, signReach } from "@mark1russell7/visuals/markers";
import { LEVELS, levelShape, shapeRing, type FieldMark, type Level, type Mark } from "@mark1russell7/visuals/marks";
import { createStage, stackContents } from "@mark1russell7/visuals/three";
import { onThemeChange, roomTheme } from "./colors.ts";
import { LEVEL_NAMES, ROOM, ROOM_KINDS, ROOM_MARKS, ROOM_RECORDS, ROOM_SOLIDS, type RoomRecord, type RoomSolid } from "./room-sample.ts";
import { createSolids, type RoomTheme } from "./room-solids.ts";

/** The elements of the page that the room demo uses. */
export interface RoomElements {
  /** The box of the picture. It has a size before the demo starts. */
  readonly picture: HTMLElement;
  /** The line that names the mark under the pointer, or the selected mark. */
  readonly readout: HTMLElement;
  /** The box of the key of the levels. The demo puts one sign for each level in it. */
  readonly levels: HTMLElement;
  /** The box of the scale of the light. The demo puts the colors and the two ends of the scale in it. */
  readonly scale: HTMLElement;
  /** The box of the buttons of the views. Each button has the name of its view in `data-view`. */
  readonly views: HTMLElement;
  /** The line that tells how to move the picture. */
  readonly hint: HTMLElement;
  /** The box of the legend. The demo puts one button for each kind in it. */
  readonly legend: HTMLElement;
  /** The list of the marks. The demo puts one item for each mark in it. */
  readonly records: HTMLElement;
}

/** The record under the pointer: a mark, or a box of the room. Each of them has a name and a text. */
type RoomPick = Mark | RoomSolid;

/** The smallest distance between the name of a mark and an edge of the picture, in CSS pixels. */
const NAME_EDGE = 2;

/** This function makes the sign of a level: the shape that the picture draws for it, with the color of the level. */
function levelSign(level: Level): SVGElement {
  const shape = levelShape(level);
  // The y axis of a shape goes up, and the y axis of SVG goes down.
  const outline =
    shape === "ring"
      ? svg("circle", { r: "0.76", fill: "none", stroke: "currentColor", "stroke-width": "0.48" })
      : svg("polygon", { points: shapeRing(shape).map(([x, y]) => `${x.toFixed(3)},${(0 - y).toFixed(3)}`).join(" "), fill: "currentColor" });
  return svg("svg", { class: "mark-sign", "data-level": level, viewBox: "-1.4 -1.4 2.8 2.8", "aria-hidden": "true" }, outline);
}

/** This function makes the sign of a mark for the list. A point has the shape of its level, a run or a link has a line, and a field has its colors. */
function markSign(mark: Mark): Element {
  if (mark.type === "field") return h("span", { class: "mark-sign mark-sign-field", "aria-hidden": "true" });
  if (mark.type === "run" || mark.type === "link") {
    const line = svg("line", { x1: "-1.2", y1: "0", x2: "1.2", y2: "0", stroke: "currentColor", "stroke-width": mark.type === "run" ? "0.6" : "0.4", "stroke-linecap": "round", "stroke-dasharray": mark.type === "run" ? false : "0.5 0.7" });
    return svg("svg", { class: "mark-sign", "data-level": mark.level, viewBox: "-1.4 -1.4 2.8 2.8", "aria-hidden": "true" }, line);
  }
  return levelSign(mark.level);
}

/**
 * This function starts the room demo: a sample room with marks on its surfaces, a legend that filters them and a list that selects them.
 * A browser with no WebGL 2 gets the list and no picture.
 */
export function startRoom(elements: RoomElements): void {
  const hidden = new Set<string>();
  let hovered: string | undefined;
  let selected: string | undefined;

  /** The text of each record: of each mark, and of each box of the room. */
  const texts = new Map<string, string>([...ROOM_SOLIDS.map((solid): [string, string] => [solid.record, solid.label]), ...ROOM_MARKS.map((mark): [string, string] => [mark.record, mark.label])]);
  const kindOf = new Map(ROOM_MARKS.map((mark) => [mark.record, mark.kind]));

  const solids = createSolids(ROOM, ROOM_SOLIDS);
  const markers = createMarkers(ROOM_MARKS);
  // A point with no size has a sign with a size in pixels, so its name has a known distance from it.
  const labels: StageLabel[] = [];
  for (const { mark, name } of ROOM_RECORDS) {
    if (mark.type === "point" && mark.size === undefined) labels.push({ record: mark.record, at: mark.frame.at, text: name, kind: mark.kind, clear: signReach(mark.level) });
  }
  const names = createLabels(elements.picture, { labels, edge: NAME_EDGE });
  const content = stackContents<RoomPick, RoomTheme>([solids, markers, names]);
  const stage = createStage<RoomPick, RoomTheme>(elements.picture, {
    content,
    theme: roomTheme(),
    label: "A sample room with marks: four outlets, a lamp, a cable and the light on the floor",
    views: {
      corner: fitView({ polar: 1, azimuth: 0.72 }),
      plan: fitView({ polar: 0, azimuth: 0 }),
      front: fitView({ polar: 1.35, azimuth: 0.12 }),
    },
    home: "corner",
    onHover: (pick) => {
      hover(pick?.record);
    },
    onSelect: (pick) => {
      select(pick?.record);
    },
  });
  if (stage === undefined) {
    content.dispose();
    elements.picture.hidden = true;
    elements.views.hidden = true;
    elements.hint.textContent = "This browser has no WebGL 2, so the page shows no picture of the room. The list has each mark.";
  }

  for (const level of LEVELS) elements.levels.append(h("span", { class: "level" }, levelSign(level), LEVEL_NAMES[level]));
  const field = ROOM_MARKS.find((mark): mark is FieldMark => mark.type === "field");
  if (field !== undefined) {
    const { min, max, unit } = field.scale;
    elements.scale.append(h("span", {}, `${String(min)} ${unit}`), h("span", { class: "scale-colors", "aria-hidden": "true" }), h("span", {}, `${String(max)} ${unit}`));
  }

  const rows = ROOM_RECORDS.map((record: RoomRecord) => {
    const { mark } = record;
    const button = h(
      "button",
      { class: "record", type: "button", "data-record": mark.record, "aria-pressed": "false" },
      markSign(mark),
      h("span", { class: "record-name" }, record.name),
      h("span", { class: "record-place" }, record.detail),
    );
    button.addEventListener("click", () => {
      select(selected === mark.record ? undefined : mark.record);
    });
    button.addEventListener("pointerenter", () => {
      hover(mark.record);
    });
    button.addEventListener("pointerleave", () => {
      hover(undefined);
    });
    const item = h("li", {}, button);
    elements.records.append(item);
    return { mark, item, button };
  });

  for (const { kind, name } of ROOM_KINDS) {
    const count = ROOM_MARKS.filter((mark) => mark.kind === kind).length;
    const button = h("button", { class: "kind", type: "button", "data-kind": kind, "aria-pressed": "true" }, `${name} `, h("span", { class: "count" }, String(count)));
    button.addEventListener("click", () => {
      if (hidden.has(kind)) hidden.delete(kind);
      else hidden.add(kind);
      button.setAttribute("aria-pressed", String(!hidden.has(kind)));
      draw();
    });
    elements.legend.append(button);
  }

  for (const button of elements.views.querySelectorAll<HTMLButtonElement>("button[data-view]")) {
    button.addEventListener("click", () => {
      stage?.setView(button.dataset["view"] ?? "corner");
    });
  }

  /** This function tells if a record is in the picture. A box is always in the picture, and a mark is there while the legend has its kind on. */
  function shown(record: string): boolean {
    const kind = kindOf.get(record);
    return kind === undefined || !hidden.has(kind);
  }

  /** This function shows the highlights of the pointer and of the selection in the picture, in the list and in the line of the name. */
  function paint(): void {
    stage?.highlight(hovered === undefined ? [] : [hovered]);
    for (const row of rows) {
      row.button.classList.toggle("is-hovered", row.mark.record === hovered);
      row.button.setAttribute("aria-pressed", String(row.mark.record === selected));
    }
    const record = hovered ?? selected;
    elements.readout.textContent = record === undefined ? "" : (texts.get(record) ?? "");
  }

  function hover(record: string | undefined): void {
    if (record === hovered) return;
    hovered = record;
    paint();
  }

  function select(record: string | undefined): void {
    selected = record;
    stage?.select(record);
    paint();
  }

  /** This function shows the marks of the kinds that the legend has on. It starts after a change of the legend. */
  function draw(): void {
    if (stage !== undefined) {
      markers.show((mark) => !hidden.has(mark.kind));
      names.show((label) => shown(label.record));
    }
    for (const row of rows) row.item.hidden = !shown(row.mark.record);
    if (hovered !== undefined && !shown(hovered)) hovered = undefined;
    if (selected !== undefined && !shown(selected)) select(undefined);
    else paint();
    stage?.refresh();
  }

  onThemeChange(() => {
    stage?.setTheme(roomTheme());
  });
  draw();
}
