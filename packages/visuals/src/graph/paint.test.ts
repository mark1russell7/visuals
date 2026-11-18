import { PICTURE_SCHEMA, pathOf, type PictureBox, type PictureLabel, type PictureRoute } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import type { Highlight } from "../highlight.ts";
import { FOCUS_OPACITY, focusOf } from "./focus.ts";
import { LIGHT_PICTURE_THEME, plainLooks, type PictureLooks, type PictureTheme, type RecordState } from "./looks.ts";
import { ARROW_SPREAD, BAR_HEIGHT, boxState, FREE_LABELS, HALO_WIDTH, paintPicture, recordKey, routeState, VIEW_MARGIN, type PaintOutline, type PaintOutlined, type PaintShape, type PaintState, type PaintText } from "./paint.ts";
import { indexPicture, type PictureIndex, type PictureRecord } from "./records.ts";
import { ASIDE, CARD, CURVE, FAR, LINK, PICTURE, ROW_1, ROW_2, TOPIC } from "./sample.ts";

const theme = LIGHT_PICTURE_THEME;
const index = indexPicture(PICTURE);
const plain = plainLooks();

/** This function gives the highlight of each record of a table, and no highlight for each other record. */
function highlights(table: Readonly<Record<string, Highlight>> = {}): (record: string) => Highlight {
  return (record) => table[record] ?? 0;
}

/**
 * This function gives the paint list of a picture. The default is the sample picture with the plain looks at the zoom 2.
 * At that zoom, each text of the sample is large enough to read, and one unit of a look is one unit of the picture.
 */
function paint(state: Partial<PaintState> = {}, looks: PictureLooks<PictureTheme> = plain, of: PictureIndex = index): PaintShape[] {
  return paintPicture(of, looks, theme, { zoom: 2, highlight: highlights(), ...state });
}

/** This function gives the plain looks with a different function for some types of record. */
function looksWith(more: Partial<PictureLooks<PictureTheme>>): PictureLooks<PictureTheme> {
  return { ...plain, ...more };
}

/** This function gives the tables of a picture of some records. */
function pictureWith(boxes: readonly PictureBox[], routes: readonly PictureRoute[] = [], labels: readonly PictureLabel[] = []): PictureIndex {
  return indexPicture({ schema: PICTURE_SCHEMA, boxes, routes, labels });
}

/** This function gives the outline of each shape of a list that has an outline. */
function outlines(shapes: readonly PaintShape[]): PaintOutline[] {
  return shapes.flatMap((shape) => (shape.type === "shape" ? [shape.outline] : []));
}

/** This function gives the width of the line of each shape of a list that has a line. */
function lineWidths(shapes: readonly PaintShape[]): (number | undefined)[] {
  return shapes.flatMap((shape) => (shape.type === "shape" && shape.stroke !== undefined ? [shape.lineWidth] : []));
}

// The shapes of the sample picture with the plain looks, at the zoom 2.
const CARD_BODY: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 0, y: 0, w: 200, h: 100, radius: 6 }, fill: theme.container, stroke: theme.containerLine, lineWidth: 1, opacity: 1 };
const CARD_TEXT: PaintText = { type: "text", text: "Card", x: 10, y: 15, font: "13px sans-serif", align: "left", fill: theme.mutedText, opacity: 1 };
const LINK_LINE: PaintOutlined = { type: "shape", outline: { kind: "path", path: LINK.path }, stroke: theme.route, lineWidth: 1.25, opacity: 1 };
const CURVE_LINE: PaintOutlined = { type: "shape", outline: { kind: "path", path: CURVE.path }, stroke: theme.route, lineWidth: 1.25, opacity: 1 };
const ASIDE_LINE: PaintOutlined = { type: "shape", outline: { kind: "path", path: ASIDE.path }, stroke: theme.route, lineWidth: 1.25, opacity: 1 };
const ROW_1_BODY: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 10, y: 30, w: 180, h: 25, radius: 6 }, fill: theme.box, stroke: theme.boxLine, lineWidth: 1, opacity: 1 };
const ROW_TEXT_1: PaintText = { type: "text", text: "First line", x: 16, y: 37, font: "8px sans-serif", align: "left", fill: theme.text, opacity: 1 };
const ROW_TEXT_2: PaintText = { type: "text", text: "Second", x: 16, y: 47, font: "8px sans-serif", align: "left", fill: theme.text, opacity: 1 };
const ROW_2_BODY: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 10, y: 65, w: 180, h: 25, radius: 6 }, fill: theme.box, stroke: theme.boxLine, lineWidth: 1, opacity: 1 };
const TOPIC_BODY: PaintOutlined = { type: "shape", outline: { kind: "ellipse", cx: 330, cy: 50, rx: 30, ry: 30 }, fill: theme.box, stroke: theme.boxLine, lineWidth: 1, opacity: 1 };
const FAR_BODY: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 0, y: 300, w: 100, h: 40, radius: 6 }, fill: theme.box, stroke: theme.boxLine, lineWidth: 1, opacity: 1 };
const LINK_TEXT: PaintText = { type: "text", text: "uses", x: 245, y: 50, font: "12px sans-serif", align: "center", fill: theme.text, halo: { color: theme.paper, width: 16 * HALO_WIDTH }, opacity: 1 };
const NOTE_TEXT: PaintText = { type: "text", text: "A note", x: 520, y: 8, font: "12px sans-serif", align: "right", fill: theme.text, opacity: 1 };

describe("paintPicture", () => {
  it("gives the shapes of a picture in layers: containers, routes, boxes with no child, then the labels of routes and the free labels", () => {
    expect(paint()).toEqual([CARD_BODY, CARD_TEXT, LINK_LINE, CURVE_LINE, ASIDE_LINE, ROW_1_BODY, ROW_TEXT_1, ROW_TEXT_2, ROW_2_BODY, TOPIC_BODY, FAR_BODY, LINK_TEXT, NOTE_TEXT]);
  });

  it("gives no shape for a picture with no record", () => {
    expect(paint({}, plain, pictureWith([]))).toEqual([]);
  });

  it("gives a record with a highlight its look, and puts a route with a highlight above each other route", () => {
    const shapes = paint({ highlight: highlights({ "row-1": 2, link: 1 }) });
    expect(shapes).toEqual([
      CARD_BODY,
      CARD_TEXT,
      CURVE_LINE,
      ASIDE_LINE,
      { ...LINK_LINE, stroke: theme.accent },
      { ...ROW_1_BODY, stroke: theme.accent, lineWidth: 2 },
      ROW_TEXT_1,
      ROW_TEXT_2,
      ROW_2_BODY,
      TOPIC_BODY,
      FAR_BODY,
      LINK_TEXT,
      NOTE_TEXT,
    ]);
  });

  it("gives less color to each record out of the focus, and puts the routes of the focus above each other route", () => {
    const { beside, out } = FOCUS_OPACITY;
    expect(paint({ focus: focusOf(index, ["row-1"]) })).toEqual([
      CARD_BODY,
      CARD_TEXT,
      { ...CURVE_LINE, opacity: out },
      { ...ASIDE_LINE, opacity: out },
      LINK_LINE,
      ROW_1_BODY,
      ROW_TEXT_1,
      ROW_TEXT_2,
      { ...ROW_2_BODY, opacity: beside },
      TOPIC_BODY,
      { ...FAR_BODY, opacity: out },
      LINK_TEXT,
      { ...NOTE_TEXT, opacity: out },
    ]);
  });

  it("gives each look the theme and the state of its record, and each label look the record that the label names", () => {
    const states = new Map<string, RecordState>();
    const named = new Map<string, PictureRecord | undefined>();
    const themes = new Set<PictureTheme>();
    const looks: PictureLooks<PictureTheme> = {
      box(box, state, t) {
        states.set(`box ${box.id}`, state);
        themes.add(t);
        return plain.box(box, state, t);
      },
      route(route, state, t) {
        states.set(`route ${route.id}`, state);
        themes.add(t);
        return plain.route(route, state, t);
      },
      label(label, state, t, of) {
        states.set(`label ${label.id}`, state);
        named.set(label.id, of);
        themes.add(t);
        return plain.label(label, state, t, of);
      },
    };
    paint({ focus: focusOf(index, ["row-1"]), highlight: highlights({ "row-1": 2, link: 1 }) }, looks);
    expect([...themes]).toEqual([theme]);
    expect(states.get("box card")).toEqual({ highlight: 0, focus: "in", zoom: 2, container: true });
    expect(states.get("box row-1")).toEqual({ highlight: 2, focus: "in", zoom: 2, container: false });
    expect(states.get("box row-2")).toEqual({ highlight: 0, focus: "beside", zoom: 2, container: false });
    expect(states.get("box far")).toEqual({ highlight: 0, focus: "out", zoom: 2, container: false });
    expect(states.get("route link")).toEqual({ highlight: 1, focus: "in", zoom: 2, container: false });
    expect(states.get("route curve")).toEqual({ highlight: 0, focus: "out", zoom: 2, container: false });
    // A label has the state of the record that it names.
    expect(states.get("label card-label")).toEqual(states.get("box card"));
    expect(states.get("label row-label")).toEqual(states.get("box row-1"));
    expect(states.get("label link-label")).toEqual(states.get("route link"));
    expect(named.get("card-label")).toEqual({ type: "box", id: "card", box: CARD });
    expect(named.get("row-label")).toEqual({ type: "box", id: "row-1", box: ROW_1 });
    expect(named.get("link-label")).toEqual({ type: "route", id: "link", route: LINK });
    // A label that names no record is out of each focus.
    expect(states.get("label note")).toEqual({ highlight: 0, focus: "out", zoom: 2, container: false });
    expect(named.has("note")).toBe(true);
    expect(named.get("note")).toBeUndefined();
    paint({}, looks);
    expect(states.get("label note")).toEqual({ highlight: 0, focus: "all", zoom: 2, container: false });
  });

  it("asks the fade function for the share of each record, with the share of its focus level", () => {
    const goals = new Map<string, number>();
    const shapes = paint({
      focus: focusOf(index, ["row-1"]),
      fade(key, goal) {
        goals.set(key, goal);
        return 0.5;
      },
    });
    expect([...goals]).toEqual([
      ["box:card", 1],
      ["box:row-1", 1],
      ["box:row-2", FOCUS_OPACITY.beside],
      ["box:topic", 1],
      ["box:far", FOCUS_OPACITY.out],
      ["route:link", 1],
      ["route:curve", FOCUS_OPACITY.out],
      ["route:aside", FOCUS_OPACITY.out],
      [FREE_LABELS, FOCUS_OPACITY.out],
    ]);
    expect(shapes.map((shape) => shape.opacity)).toEqual(new Array(13).fill(0.5));
  });

  it("gives no shape to a record with no color, and none to its labels", () => {
    const gone = new Set(["box:far", "route:link", FREE_LABELS]);
    expect(paint({ fade: (key) => (gone.has(key) ? 0 : 1) })).toEqual([CARD_BODY, CARD_TEXT, CURVE_LINE, ASIDE_LINE, ROW_1_BODY, ROW_TEXT_1, ROW_TEXT_2, ROW_2_BODY, TOPIC_BODY]);
  });

  it("multiplies the opacity of a look by the share of the focus, to 1 at most", () => {
    const shares: Readonly<Record<string, number>> = { far: 0.5, topic: 3, "row-2": 0, curve: 0.5, note: 0.5 };
    const looks: PictureLooks<PictureTheme> = {
      box: (box, state, t) => ({ ...plain.box(box, state, t), opacity: shares[box.id] }),
      route: (route, state, t) => ({ stroke: t.route, ...plain.route(route, state, t), opacity: shares[route.id] }),
      label: (label, state, t, of) => ({ color: t.text, ...plain.label(label, state, t, of), opacity: shares[label.id] }),
    };
    expect(paint({ focus: focusOf(index, ["row-1"]) }, looks)).toEqual([
      CARD_BODY,
      CARD_TEXT,
      { ...CURVE_LINE, opacity: 0.5 * FOCUS_OPACITY.out },
      { ...ASIDE_LINE, opacity: FOCUS_OPACITY.out },
      LINK_LINE,
      ROW_1_BODY,
      ROW_TEXT_1,
      ROW_TEXT_2,
      // The second row has a look with no color, so it has no shape.
      TOPIC_BODY,
      { ...FAR_BODY, opacity: 0.5 * FOCUS_OPACITY.out },
      LINK_TEXT,
      { ...NOTE_TEXT, opacity: 0.5 * FOCUS_OPACITY.out },
    ]);
  });

  it("makes each line one CSS pixel wide or more: in a small picture, one unit of a look is more than one unit of the picture", () => {
    // The lines are those of the card, the three routes and the four boxes with no child.
    expect(lineWidths(paint({ zoom: 0.5 }))).toEqual([2, 2.5, 2.5, 2.5, 2, 2, 2, 2]);
    expect(lineWidths(paint({ zoom: 0.1 }))).toEqual([10, 12.5, 12.5, 12.5, 10, 10, 10, 10]);
    expect(lineWidths(paint({ zoom: 1 }))).toEqual([1, 1.25, 1.25, 1.25, 1, 1, 1, 1]);
    // Above the zoom 1, a line grows with its box.
    expect(lineWidths(paint({ zoom: 8 }))).toEqual([1, 1.25, 1.25, 1.25, 1, 1, 1, 1]);
  });

  it("gives no shape for a text that is too small for a bar", () => {
    // At the zoom 0.1, each line of text of the sample is below 2 pixels.
    const shapes = paint({ zoom: 0.1 });
    expect(shapes).toHaveLength(8);
    expect(shapes.every((shape) => shape.type === "shape" && shape.stroke !== undefined)).toBe(true);
  });

  it("makes no shape for a record out of the view", () => {
    // The view shows the topic and the area around it.
    expect(paint({ visible: { x: 280, y: 0, w: 120, h: 100 } })).toEqual([LINK_LINE, ASIDE_LINE, TOPIC_BODY, LINK_TEXT, NOTE_TEXT]);
    expect(paint({ visible: { x: 1000, y: 1000, w: 100, h: 100 } })).toEqual([]);
  });

  it("keeps a record that is near the view, to the margin of a look", () => {
    const shown = (zoom: number, h: number): boolean => outlines(paint({ zoom, visible: { x: 0, y: 0, w: 400, h } })).some((outline) => outline.kind === "rect" && outline.y === FAR.y);
    // The far box starts at 300 on the y axis.
    expect(shown(2, 300 - VIEW_MARGIN)).toBe(true);
    expect(shown(2, 300 - VIEW_MARGIN - 1)).toBe(false);
    // In a small picture, the margin is larger in the unit of the picture.
    expect(shown(0.5, 300 - 2 * VIEW_MARGIN)).toBe(true);
    expect(shown(0.5, 300 - 2 * VIEW_MARGIN - 1)).toBe(false);
  });

  it("keeps the label in the view of a record that is out of the view", () => {
    const box: PictureBox = { id: "a", x: 0, y: 0, w: 10, h: 10 };
    const route: PictureRoute = {
      id: "r",
      source: "a",
      target: "a",
      path: pathOf([
        { x: 0, y: 200 },
        { x: 10, y: 200 },
      ]),
    };
    const name: PictureLabel = { id: "a-name", box: "a", x: 100, y: 0, w: 40, h: 20, lines: ["Name"], lineHeight: 20, font: "12px sans-serif" };
    const way: PictureLabel = { id: "r-name", route: "r", x: 100, y: 190, w: 40, h: 20, lines: ["Way"], lineHeight: 20, font: "12px sans-serif" };
    const shapes = paint({ visible: { x: 90, y: 0, w: 60, h: 220 } }, plain, pictureWith([box], [route], [name, way]));
    expect(shapes).toEqual([
      { type: "text", text: "Name", x: 100, y: 10, font: "12px sans-serif", align: "left", fill: theme.text, opacity: 1 },
      { type: "text", text: "Way", x: 100, y: 200, font: "12px sans-serif", align: "left", fill: theme.text, halo: { color: theme.paper, width: 20 * HALO_WIDTH }, opacity: 1 },
    ]);
  });

  it("makes no shape for a record with no look, and none for its labels", () => {
    const looks = looksWith({
      box: (box, state, t) => (box.id === "card" ? undefined : plain.box(box, state, t)),
      route: (route, state, t) => (route.id === "link" ? undefined : plain.route(route, state, t)),
    });
    expect(paint({}, looks)).toEqual([CURVE_LINE, ASIDE_LINE, ROW_1_BODY, ROW_TEXT_1, ROW_TEXT_2, ROW_2_BODY, TOPIC_BODY, FAR_BODY, NOTE_TEXT]);
  });

  it("makes no shape for a label with no look", () => {
    const looks = looksWith({ label: (label, state, t, of) => (label.id === "row-label" || label.id === "note" ? undefined : plain.label(label, state, t, of)) });
    expect(paint({}, looks)).toEqual([CARD_BODY, CARD_TEXT, LINK_LINE, CURVE_LINE, ASIDE_LINE, ROW_1_BODY, ROW_2_BODY, TOPIC_BODY, FAR_BODY, LINK_TEXT]);
  });

  it("makes no shape for a route with an empty path, and none for its labels", () => {
    const less = indexPicture({ ...PICTURE, routes: [{ ...LINK, path: [] }] });
    expect(paint({}, plain, less)).toEqual([CARD_BODY, CARD_TEXT, ROW_1_BODY, ROW_TEXT_1, ROW_TEXT_2, ROW_2_BODY, TOPIC_BODY, FAR_BODY, NOTE_TEXT]);
  });
});

describe("the shapes of a box", () => {
  const oval: PictureBox = { id: "oval", x: 100, y: 50, w: 80, h: 40, shape: { kind: "ellipse", cx: 40, cy: 20, rx: 40, ry: 20 } };
  const flag: PictureBox = {
    id: "flag",
    x: 100,
    y: 200,
    w: 40,
    h: 30,
    shape: {
      kind: "polygon",
      points: [
        [0, 0],
        [40, 0],
        [20, 30],
      ],
      holes: [
        [
          [15, 5],
          [25, 5],
          [20, 12],
        ],
      ],
    },
  };
  /** The rings of the flag, in the coordinates of the picture. */
  const flagRings = [
    [
      [100, 200],
      [140, 200],
      [120, 230],
    ],
    [
      [115, 205],
      [125, 205],
      [120, 212],
    ],
  ];

  it("gives the outline of the shape of a box, in the coordinates of the picture", () => {
    const plate: PictureBox = { id: "plate", x: 10, y: 10, w: 50, h: 50, shape: { kind: "rect", x: 5, y: 5, w: 40, h: 30 } };
    const corner: PictureBox = {
      id: "corner",
      x: 0,
      y: 100,
      w: 30,
      h: 30,
      shape: {
        kind: "polygon",
        points: [
          [0, 0],
          [30, 0],
          [0, 30],
        ],
      },
    };
    expect(outlines(paint({}, plain, pictureWith([oval, plate, flag, corner, TOPIC])))).toEqual([
      { kind: "ellipse", cx: 140, cy: 70, rx: 40, ry: 20 },
      { kind: "rect", x: 15, y: 15, w: 40, h: 30, radius: 6 },
      { kind: "polygon", rings: flagRings },
      {
        kind: "polygon",
        rings: [
          [
            [0, 100],
            [30, 100],
            [0, 130],
          ],
        ],
      },
      { kind: "ellipse", cx: 330, cy: 50, rx: 30, ry: 30 },
    ]);
  });

  it("makes the radius of a corner half of the smaller side at most", () => {
    const small: PictureBox = { id: "small", x: 0, y: 0, w: 10, h: 4 };
    expect(outlines(paint({}, plain, pictureWith([small])))).toEqual([{ kind: "rect", x: 0, y: 0, w: 10, h: 4, radius: 2 }]);
    expect(outlines(paint({}, plainLooks({ radius: 0 }), pictureWith([small])))).toEqual([{ kind: "rect", x: 0, y: 0, w: 10, h: 4, radius: 0 }]);
  });

  it("puts the ring of a box below the box, off its border", () => {
    const ring = { color: "#c00", width: 2, gap: 3 };
    const looks = looksWith({ box: (box, state, t) => ({ ...plain.box(box, state, t), ring }) });
    const shapes = paint({}, looks, pictureWith([ROW_1, TOPIC, oval, flag]));
    // The middle of the line is 4 units out of the border: the gap and half of the width.
    expect(shapes.slice(0, 2)).toEqual([{ type: "shape", outline: { kind: "rect", x: 6, y: 26, w: 188, h: 33, radius: 10 }, stroke: "#c00", lineWidth: 2, opacity: 1 }, ROW_1_BODY]);
    expect(outlines(shapes.filter((shape) => shape.type === "shape" && shape.stroke === "#c00"))).toEqual([
      { kind: "rect", x: 6, y: 26, w: 188, h: 33, radius: 10 },
      { kind: "ellipse", cx: 330, cy: 50, rx: 34, ry: 34 },
      { kind: "ellipse", cx: 140, cy: 70, rx: 44, ry: 24 },
      // The ring of a polygon is on its border.
      { kind: "polygon", rings: flagRings },
    ]);
    // In a small picture, the gap and the width are in CSS pixels.
    expect(paint({ zoom: 0.5 }, looks, pictureWith([ROW_1])).slice(0, 1)).toEqual([{ type: "shape", outline: { kind: "rect", x: 2, y: 22, w: 196, h: 41, radius: 14 }, stroke: "#c00", lineWidth: 4, opacity: 1 }]);
  });

  it("puts the signs of a box above the box, from its top left corner", () => {
    const marks = [
      { shape: "dot", x: 8, y: 8, radius: 3, color: "#0a0" },
      { shape: "ring", x: 20, y: 8, radius: 3, color: "#00a" },
      { shape: "ring", x: 32, y: 8, radius: 3, color: "#a00", width: 4 },
    ] as const;
    const looks = looksWith({ box: (box, state, t) => ({ ...plain.box(box, state, t), marks }) });
    expect(paint({}, looks, pictureWith([FAR]))).toEqual([
      FAR_BODY,
      { type: "shape", outline: { kind: "ellipse", cx: 8, cy: 308, rx: 3, ry: 3 }, fill: "#0a0", opacity: 1 },
      { type: "shape", outline: { kind: "ellipse", cx: 20, cy: 308, rx: 3, ry: 3 }, stroke: "#00a", lineWidth: 1.5, opacity: 1 },
      { type: "shape", outline: { kind: "ellipse", cx: 32, cy: 308, rx: 3, ry: 3 }, stroke: "#a00", lineWidth: 4, opacity: 1 },
    ]);
    // A box with no inside and no border shows only its signs. In a small picture, the size of a sign is in CSS pixels.
    const only = looksWith({ box: () => ({ marks }) });
    expect(paint({ zoom: 0.5 }, only, pictureWith([FAR]))).toEqual([
      { type: "shape", outline: { kind: "ellipse", cx: 8, cy: 308, rx: 6, ry: 6 }, fill: "#0a0", opacity: 1 },
      { type: "shape", outline: { kind: "ellipse", cx: 20, cy: 308, rx: 6, ry: 6 }, stroke: "#00a", lineWidth: 3, opacity: 1 },
      { type: "shape", outline: { kind: "ellipse", cx: 32, cy: 308, rx: 6, ry: 6 }, stroke: "#a00", lineWidth: 8, opacity: 1 },
    ]);
  });

  it("gives a box only the parts that its look has: an inside, a border, dashes", () => {
    const looks = looksWith({
      box(box) {
        if (box.id === "far") return { fill: "#eee" };
        if (box.id === "topic") return { stroke: "#111", width: 3, dash: [4, 2] };
        if (box.id === "row-1") return { stroke: "#111", dash: [] };
        return {};
      },
    });
    const shapes = paint({ zoom: 0.5 }, looks, pictureWith([FAR, TOPIC, ROW_1, ROW_2]));
    expect(shapes).toEqual([
      { type: "shape", outline: { kind: "rect", x: 0, y: 300, w: 100, h: 40, radius: 0 }, fill: "#eee", opacity: 1 },
      { type: "shape", outline: { kind: "ellipse", cx: 330, cy: 50, rx: 30, ry: 30 }, stroke: "#111", lineWidth: 6, dash: [8, 4], opacity: 1 },
      { type: "shape", outline: { kind: "rect", x: 10, y: 30, w: 180, h: 25, radius: 0 }, stroke: "#111", lineWidth: 2, opacity: 1 },
    ]);
    // A box with no border has no line width, and an empty list of dashes is no dash.
    expect(shapes.map((shape) => (shape.type === "shape" ? [shape.lineWidth, shape.dash] : []))).toEqual([
      [undefined, undefined],
      [6, [8, 4]],
      [2, undefined],
    ]);
  });
});

describe("the shapes of a route", () => {
  const arrow = { shape: "arrow", size: 8 } as const;

  it("gives the line of a route the width and the dashes of its look, in units of the look", () => {
    const looks = looksWith({ route: () => ({ stroke: "#222", width: 2, dash: [6, 3] }) });
    expect(paint({ zoom: 0.5 }, looks, pictureWith([], [ASIDE]))).toEqual([{ type: "shape", outline: { kind: "path", path: ASIDE.path }, stroke: "#222", lineWidth: 4, dash: [12, 6], opacity: 1 }]);
    expect(paint({ zoom: 4 }, looks, pictureWith([], [ASIDE]))).toEqual([{ type: "shape", outline: { kind: "path", path: ASIDE.path }, stroke: "#222", lineWidth: 2, dash: [6, 3], opacity: 1 }]);
  });

  it("puts an arrow at the target of a route: two lines from the end of the path back to each side", () => {
    const half = 8 * ARROW_SPREAD;
    expect(paint({}, plainLooks({ end: arrow }), pictureWith([], [LINK]))).toEqual([
      LINK_LINE,
      {
        type: "shape",
        outline: {
          kind: "path",
          path: [
            { kind: "move", to: { x: 292, y: 50 + half } },
            { kind: "line", to: { x: 300, y: 50 } },
            { kind: "line", to: { x: 292, y: 50 - half } },
          ],
        },
        stroke: theme.route,
        lineWidth: 1.25,
        opacity: 1,
      },
    ]);
  });

  it("puts a sign at each end that the look gives, larger in a small picture", () => {
    const looks = looksWith({ route: () => ({ stroke: "#222", start: arrow, end: { shape: "dot", size: 3 } }) });
    // The route starts at (330, 80) and goes down, so the arrow at its source points up.
    const half = 16 * ARROW_SPREAD;
    expect(paint({ zoom: 0.5 }, looks, pictureWith([], [ASIDE]))).toEqual([
      { type: "shape", outline: { kind: "path", path: ASIDE.path }, stroke: "#222", lineWidth: 2.5, opacity: 1 },
      {
        type: "shape",
        outline: {
          kind: "path",
          path: [
            { kind: "move", to: { x: 330 + half, y: 96 } },
            { kind: "line", to: { x: 330, y: 80 } },
            { kind: "line", to: { x: 330 - half, y: 96 } },
          ],
        },
        stroke: "#222",
        lineWidth: 2.5,
        opacity: 1,
      },
      { type: "shape", outline: { kind: "ellipse", cx: 100, cy: 320, rx: 6, ry: 6 }, fill: "#222", opacity: 1 },
    ]);
  });

  it("gives the signs of a route the color and the share of the route", () => {
    const looks = looksWith({ route: () => ({ stroke: "#222", opacity: 0.5, start: { shape: "dot", size: 2 }, end: arrow }) });
    const shapes = paint({ focus: focusOf(index, ["far"]) }, looks, pictureWith([], [LINK]));
    expect(shapes).toHaveLength(3);
    // The route is out of the focus of the far box.
    expect(shapes.map((shape) => shape.opacity)).toEqual(new Array(3).fill(0.5 * FOCUS_OPACITY.out));
  });

  it("makes no arrow for a path with no length, and no sign with no size", () => {
    const point: PictureRoute = {
      id: "point",
      source: "a",
      target: "a",
      path: pathOf([
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ]),
    };
    const line: PaintOutlined = { type: "shape", outline: { kind: "path", path: point.path }, stroke: "#222", lineWidth: 1.25, opacity: 1 };
    const dot: PaintOutlined = { type: "shape", outline: { kind: "ellipse", cx: 5, cy: 5, rx: 3, ry: 3 }, fill: "#222", opacity: 1 };
    const looks = looksWith({ route: () => ({ stroke: "#222", start: arrow, end: { shape: "dot", size: 3 } }) });
    expect(paint({}, looks, pictureWith([], [point]))).toEqual([line, dot]);
    const none = looksWith({ route: () => ({ stroke: "#222", start: { shape: "arrow", size: 0 }, end: { shape: "dot", size: 0 } }) });
    expect(paint({}, none, pictureWith([], [point]))).toEqual([line]);
  });
});

describe("the shapes of a label", () => {
  it("makes one text for each line that is not empty, at the middle of the height of the line", () => {
    const label: PictureLabel = { id: "gaps", x: 5, y: 0, w: 50, h: 60, lines: ["", "   ", "Last"], lineHeight: 20, font: "12px sans-serif" };
    expect(paint({}, plain, pictureWith([], [], [label]))).toEqual([{ type: "text", text: "Last", x: 5, y: 50, font: "12px sans-serif", align: "left", fill: theme.text, opacity: 1 }]);
  });

  it("makes a bar for each line of a text that is too small to read", () => {
    // At the zoom 1, the lines of the label of the first row are 10 pixels high.
    const tall = 10 * BAR_HEIGHT;
    const bar = (y: number, w: number): PaintOutlined => ({ type: "shape", outline: { kind: "rect", x: 16, y: y - tall / 2, w, h: tall, radius: tall / 2 }, fill: theme.containerLine, opacity: 1 });
    // With no measure, a bar has the width of its label.
    expect(paint({ zoom: 1 })).toEqual([CARD_BODY, CARD_TEXT, LINK_LINE, CURVE_LINE, ASIDE_LINE, ROW_1_BODY, bar(37, 160), bar(47, 160), ROW_2_BODY, TOPIC_BODY, FAR_BODY, LINK_TEXT, NOTE_TEXT]);
    const asked: string[] = [];
    const measured = paint({
      zoom: 1,
      measure(font, text) {
        asked.push(`${font}: ${text}`);
        return text.length * 4;
      },
    });
    expect(measured.slice(6, 8)).toEqual([bar(37, 40), bar(47, 24)]);
    expect(asked).toEqual(["8px sans-serif: First line", "8px sans-serif: Second"]);
    // A bar is not wider than its label.
    expect(paint({ zoom: 1, measure: () => 500 }).slice(6, 8)).toEqual([bar(37, 160), bar(47, 160)]);
  });

  it("puts a bar at the left, the middle or the right of its label, as the text", () => {
    // At the zoom 0.5, each text of the sample is a bar. The text of the route has 4 letters, and the note has 6 letters.
    const tall = 16 * BAR_HEIGHT;
    const shapes = paint({ zoom: 0.5, measure: (_font, text) => text.length * 4 });
    expect(shapes.slice(-2)).toEqual([
      { type: "shape", outline: { kind: "rect", x: 225 + 0.5 * (40 - 16), y: 50 - tall / 2, w: 16, h: tall, radius: tall / 2 }, fill: theme.containerLine, opacity: 1 },
      { type: "shape", outline: { kind: "rect", x: 400 + (120 - 24), y: 8 - tall / 2, w: 24, h: tall, radius: tall / 2 }, fill: theme.containerLine, opacity: 1 },
    ]);
  });

  it("gives a bar of a label with no width the width of the measure, and no bar with no measure", () => {
    const label: PictureLabel = { id: "free", x: 5, y: 0, w: 0, h: 8, lines: ["A long line"], lineHeight: 8, font: "6px sans-serif" };
    const tall = 8 * BAR_HEIGHT;
    const only = pictureWith([], [], [label]);
    expect(paint({ zoom: 1, measure: () => 70 }, plain, only)).toEqual([{ type: "shape", outline: { kind: "rect", x: 5, y: 4 - tall / 2, w: 70, h: tall, radius: tall / 2 }, fill: theme.containerLine, opacity: 1 }]);
    expect(paint({ zoom: 1 }, plain, only)).toEqual([]);
    // A bar that is less wide than high has round ends of half its width.
    expect(outlines(paint({ zoom: 1, measure: () => 2 }, plain, only))).toEqual([{ kind: "rect", x: 5, y: 4 - tall / 2, w: 2, h: tall, radius: 1 }]);
  });
});

describe("the state of a record", () => {
  it("has a key for each record, and a box and a route with the same id have different keys", () => {
    expect(recordKey("box", "a")).toBe("box:a");
    expect(recordKey("route", "a")).toBe("route:a");
  });

  it("gives the state of a box and of a route for their looks", () => {
    const state: PaintState = { zoom: 3, highlight: highlights({ card: 1, link: 2 }), focus: focusOf(index, ["row-1"]) };
    expect(boxState(index, CARD, state)).toEqual({ highlight: 1, focus: "in", zoom: 3, container: true });
    expect(boxState(index, FAR, state)).toEqual({ highlight: 0, focus: "out", zoom: 3, container: false });
    expect(routeState(LINK, state)).toEqual({ highlight: 2, focus: "in", zoom: 3, container: false });
    expect(routeState(CURVE, { zoom: 1, highlight: highlights() })).toEqual({ highlight: 0, focus: "all", zoom: 1, container: false });
  });
});
