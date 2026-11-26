import { PICTURE_SCHEMA, pathOf, type PictureBox, type PictureLabel, type PictureRoute } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import type { Highlight } from "../highlight.ts";
import { FOCUS_OPACITY, focusOf } from "./focus.ts";
import { LIGHT_PICTURE_THEME, MOST_KEPT_LINE, plainLooks, SMALLEST_TEXT_LINE, type BoxLook, type LabelLook, type PictureLooks, type PictureTheme, type RecordState } from "./looks.ts";
import { ARROW_SPREAD, BAR_HEIGHT, boxState, FREE_LABELS, HALO_WIDTH, KEPT_GAP, paintPicture, recordKey, routeState, VIEW_MARGIN, type PaintOutline, type PaintOutlined, type PaintShape, type PaintState, type PaintText } from "./paint.ts";
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

  it("puts the image of a box above its inside and below its signs, from its top left corner", () => {
    const marks = [{ shape: "dot", x: 8, y: 8, radius: 3, color: "#0a0" }] as const;
    const image = { src: "/pictures/far.png", x: 4, y: 6, w: 92, h: 20 };
    const looks = looksWith({ box: (box, state, t) => ({ ...plain.box(box, state, t), image, marks }) });
    const shape: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 4, y: 306, w: 92, h: 20, radius: 0 }, image: { src: "/pictures/far.png", fit: "contain", alignX: 0.5, alignY: 0.5 }, opacity: 1 };
    expect(paint({}, looks, pictureWith([FAR]))).toEqual([FAR_BODY, shape, { type: "shape", outline: { kind: "ellipse", cx: 8, cy: 308, rx: 3, ry: 3 }, fill: "#0a0", opacity: 1 }]);
    // The area of the image is in the unit of the picture, so it has the same place in a small picture.
    expect(paint({ zoom: 0.5 }, looksWith({ box: () => ({ image }) }), pictureWith([FAR]))).toEqual([shape]);
  });

  it("gives the image of a box its fit, its place, its corners and its color", () => {
    const of = (more: Partial<NonNullable<BoxLook["image"]>>): PaintShape[] => paint({}, looksWith({ box: () => ({ image: { src: "a.png", x: 0, y: 0, w: 100, h: 20, ...more } }) }), pictureWith([FAR]));
    const area = { kind: "rect", x: 0, y: 300, w: 100, h: 20, radius: 0 } as const;
    expect(of({ fit: "cover", alignX: 0, alignY: 1, fill: "#eee" })).toEqual([{ type: "shape", outline: area, fill: "#eee", image: { src: "a.png", fit: "cover", alignX: 0, alignY: 1 }, opacity: 1 }]);
    // A place is a share from 0 to 1. A value that is not a number gives the middle.
    expect(of({ alignX: -2, alignY: 3 })).toEqual([{ type: "shape", outline: area, image: { src: "a.png", fit: "contain", alignX: 0, alignY: 1 }, opacity: 1 }]);
    expect(of({ alignX: Number.NaN })).toEqual([{ type: "shape", outline: area, image: { src: "a.png", fit: "contain", alignX: 0.5, alignY: 0.5 }, opacity: 1 }]);
    // The radius of the corners is at most a half of the smaller side.
    expect(outlines(of({ radius: 4 }))).toEqual([{ ...area, radius: 4 }]);
    expect(outlines(of({ radius: 30 }))).toEqual([{ ...area, radius: 10 }]);
  });

  it("gives the image of a box the share of the color of the box", () => {
    const looks = looksWith({ box: (box, state, t) => ({ ...plain.box(box, state, t), opacity: 0.5, image: { src: "a.png", x: 0, y: 0, w: 100, h: 20 } }) });
    expect(paint({}, looks, pictureWith([FAR])).map((shape) => shape.opacity)).toEqual([0.5, 0.5]);
  });

  it("makes no shape for an image with no address or no area", () => {
    const of = (image: NonNullable<BoxLook["image"]>): PaintShape[] => paint({}, looksWith({ box: () => ({ image }) }), pictureWith([FAR]));
    expect(of({ src: "", x: 0, y: 0, w: 100, h: 20 })).toEqual([]);
    expect(of({ src: "a.png", x: 0, y: 0, w: 0, h: 20 })).toEqual([]);
    expect(of({ src: "a.png", x: 0, y: 0, w: 100, h: -1 })).toEqual([]);
    expect(of({ src: "a.png", x: 0, y: 0, w: Number.NaN, h: 20 })).toEqual([]);
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
    // At the zoom 0.5, each text of the sample is a bar, but not the name of the card: it keeps its height, on top of each other shape.
    // The text of the route has 4 letters, and the note has 6 letters.
    const tall = 16 * BAR_HEIGHT;
    const shapes = paint({ zoom: 0.5, measure: (_font, text) => text.length * 4 });
    expect(shapes.slice(-3, -1)).toEqual([
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

describe("a label that keeps a height on the screen", () => {
  const FONT = "16px sans-serif";
  /** A label with one line of 20 units. At the zoom 0.25, the line is 5 pixels high. */
  const NAME: PictureLabel = { id: "name", x: 100, y: 50, w: 80, h: 20, lines: ["Group"], lineHeight: 20, font: FONT };
  /** The text of the name with a least height of 10 pixels, at the zoom 0.25: it is 2 times larger about the middle of its height. */
  const NAME_TEXT: PaintText = { type: "text", text: "Group", x: 100, y: 60, font: FONT, align: "left", fill: "#111", opacity: 1, scale: 2 };
  const only = pictureWith([], [], [NAME]);

  /** This function gives the plain looks with one look for each label. */
  function labelLooks(look: LabelLook | (() => LabelLook)): PictureLooks<PictureTheme> {
    return looksWith({ label: () => (typeof look === "function" ? look() : look) });
  }

  /** The looks in which each label keeps a height of 10 pixels. */
  const least10 = labelLooks({ color: "#111", least: 10 });
  const inPlace = labelLooks({ color: "#111" });

  /** This function gives the paint list at the zoom 0.25, where one unit of a look is 4 units of the picture. */
  function far(of: PictureIndex, state: Partial<PaintState> = {}, looks: PictureLooks<PictureTheme> = least10): PaintShape[] {
    return paint({ zoom: 0.25, ...state }, looks, of);
  }

  /** This function gives the text of each text of a paint list. */
  function texts(shapes: readonly PaintShape[]): string[] {
    return shapes.flatMap((shape) => (shape.type === "text" ? [shape.text] : []));
  }

  it("makes the text larger about the middle of its height, so that a line has the least height", () => {
    expect(far(only)).toEqual([NAME_TEXT]);
    expect(far(only, {}, labelLooks({ color: "#111", least: 20 }))).toEqual([{ ...NAME_TEXT, scale: 4 }]);
  });

  it("leaves a text that is high enough at its place, with no factor", () => {
    const atPlace: PaintText = { type: "text", text: "Group", x: 100, y: 60, font: FONT, align: "left", fill: "#111", opacity: 1 };
    // At the zoom 0.5, the line is 10 pixels high.
    const shapes = paint({ zoom: 0.5 }, least10, only);
    expect(shapes).toEqual([atPlace]);
    expect(shapes[0]).not.toHaveProperty("scale");
    expect(paint({ zoom: 2 }, least10, only)[0]).not.toHaveProperty("scale");
    // A zoom that is not above 0 gives no factor.
    expect(paint({ zoom: 0 }, least10, only)[0]).not.toHaveProperty("scale");
  });

  it("keeps the left end, the middle or the right end of a line, as the label aligns it", () => {
    for (const [align, x] of [
      ["left", 100],
      ["center", 140],
      ["right", 180],
    ] as const) {
      expect(far(pictureWith([], [], [{ ...NAME, align }]))).toEqual([{ ...NAME_TEXT, align, x }]);
    }
  });

  it("puts the lines of a text about the middle of the height of all the lines", () => {
    const two: PictureLabel = { ...NAME, h: 40, lines: ["One", "Two"] };
    expect(far(pictureWith([], [], [two]))).toEqual([
      { ...NAME_TEXT, text: "One", y: 50 },
      { ...NAME_TEXT, text: "Two", y: 90 },
    ]);
    // A line that is empty has no text, and it keeps its place in the label.
    expect(far(pictureWith([], [], [{ ...two, lines: ["", "Two"] }]))).toEqual([{ ...NAME_TEXT, text: "Two", y: 90 }]);
    expect(far(pictureWith([], [], [{ ...two, lines: ["", " "] }]))).toEqual([]);
  });

  it("gives the line around the letters the width of the larger text", () => {
    expect(far(only, {}, labelLooks({ color: "#111", halo: "#fff", least: 10 }))).toEqual([{ ...NAME_TEXT, halo: { color: "#fff", width: 40 * HALO_WIDTH } }]);
  });

  it("keeps a height of `MOST_KEPT_LINE` at most", () => {
    // A line of this label is 4 pixels high.
    const small: PictureLabel = { id: "top", x: 0, y: 0, w: 50, h: 16, lines: ["Top"], lineHeight: 16, font: FONT };
    const shapes = far(pictureWith([], [], [small]), {}, labelLooks({ color: "#111", least: 100 }));
    expect(shapes).toEqual([{ type: "text", text: "Top", x: 0, y: 8, font: FONT, align: "left", fill: "#111", opacity: 1, scale: MOST_KEPT_LINE / 4 }]);
  });

  it("does not change bars, and gives no text to a label with no color", () => {
    const bars = far(only, {}, labelLooks({ color: "#111", as: "bars", least: 10 }));
    expect(outlines(bars)).toEqual([{ kind: "rect", x: 100, y: 60 - (20 * BAR_HEIGHT) / 2, w: 80, h: 20 * BAR_HEIGHT, radius: (20 * BAR_HEIGHT) / 2 }]);
    expect(far(only, {}, labelLooks({ color: "#111", least: 10, opacity: 0 }))).toEqual([]);
    expect(far(only, { fade: () => 0 })).toEqual([]);
    // The opacity of the look and the share of the focus multiply, as for a text at its place.
    expect(far(only, { fade: () => 0.5 }, labelLooks({ color: "#111", least: 10, opacity: 0.5 }))).toEqual([{ ...NAME_TEXT, opacity: 0.25 }]);
  });

  it("puts the text on top of each other shape", () => {
    // At the zoom 0.5, a line of the name of the card is 9 pixels high, and each other text of the sample is a bar.
    const shapes = paint({ zoom: 0.5 });
    const scale = SMALLEST_TEXT_LINE / (18 * 0.5);
    expect(shapes.at(-1)).toEqual({ ...CARD_TEXT, halo: { color: theme.paper, width: 18 * scale * HALO_WIDTH }, scale });
    expect(texts(shapes)).toEqual(["Card"]);
    // The body of the card is first, and the next shape is a route: the name is not at its place.
    expect(shapes[0]).toEqual({ ...CARD_BODY, lineWidth: 2 });
    expect(shapes[1]).toEqual({ ...LINK_LINE, lineWidth: 2.5 });
  });

  describe("with more labels", () => {
    const small: PictureBox = { id: "small", x: 0, y: 0, w: 100, h: 100 };
    const large: PictureBox = { id: "large", x: 0, y: 0, w: 300, h: 300 };
    const smallName: PictureLabel = { id: "small-name", box: "small", x: 10, y: 10, w: 60, h: 20, lines: ["Small"], lineHeight: 20, font: FONT };
    const largeName: PictureLabel = { id: "large-name", box: "large", x: 20, y: 20, w: 60, h: 20, lines: ["Large"], lineHeight: 20, font: FONT };
    const way: PictureRoute = {
      id: "way",
      source: "small",
      target: "large",
      path: pathOf([
        { x: 0, y: 400 },
        { x: 100, y: 400 },
      ]),
    };
    const wayName: PictureLabel = { id: "way-name", route: "way", x: 20, y: 390, w: 60, h: 20, lines: ["Way"], lineHeight: 20, font: FONT };

    it("gives no paint to a text on a text that has its place, and the first choice to the label of the larger box", () => {
      // The two larger texts overlap. The small box is first in the picture.
      const crowd = pictureWith([small, large], [], [smallName, largeName]);
      expect(texts(far(crowd))).toEqual(["Large"]);
      // Two labels of the same rank are in the order of the picture.
      const same = pictureWith([], [], [NAME, { ...NAME, id: "second", lines: ["Second"] }]);
      expect(texts(far(same))).toEqual(["Group"]);
    });

    it("gives the first choice to the label of a record with a highlight", () => {
      const crowd = pictureWith([small, large], [], [smallName, largeName]);
      expect(texts(far(crowd, { highlight: highlights({ small: 1 }) }))).toEqual(["Small"]);
      expect(texts(far(crowd, { highlight: highlights({ small: 1, large: 2 }) }))).toEqual(["Large"]);
    });

    it("puts the texts with free places in the order of their rank: the boxes from large to small, then the routes", () => {
      const apart = pictureWith([small, large], [way], [wayName, smallName, { ...largeName, y: 200 }]);
      expect(texts(far(apart))).toEqual(["Large", "Small", "Way"]);
      expect(texts(far(apart, { highlight: highlights({ way: 1 }) }))).toEqual(["Way", "Large", "Small"]);
    });

    it("keeps a distance of `KEPT_GAP` units of a look between two texts", () => {
      // The larger text of the name is from 40 to 80 on the y axis. A larger text starts 10 units above its label.
      const gap = KEPT_GAP * 4;
      const below = (y: number): PictureIndex => pictureWith([], [], [NAME, { ...NAME, id: "below", y, lines: ["Below"] }]);
      expect(texts(far(below(80 + gap + 10)))).toEqual(["Group", "Below"]);
      expect(texts(far(below(80 + gap + 9)))).toEqual(["Group"]);
    });

    it("uses the measured width of the widest line, to the width of the label at most", () => {
      // With no measure, a text has the width of its label: the two larger texts overlap.
      const pair = pictureWith([], [], [NAME, { ...NAME, id: "beside", x: 180, lines: ["Beside"] }]);
      expect(texts(far(pair))).toEqual(["Group"]);
      expect(texts(far(pair, { measure: () => 20 }))).toEqual(["Group", "Beside"]);
      expect(texts(far(pair, { measure: () => 500 }))).toEqual(["Group"]);
      const lines = pictureWith([], [], [
        { ...NAME, h: 40, lines: ["A", "Wide line"] },
        { ...NAME, id: "beside", x: 180, lines: ["Beside"] },
      ]);
      expect(texts(far(lines, { measure: (_font, text) => text.length * 2 }))).toEqual(["A", "Wide line", "Beside"]);
      expect(texts(far(lines, { measure: (_font, text) => text.length * 8 }))).toEqual(["A", "Wide line"]);
    });

    it("measures each line with the font of its label", () => {
      const asked: string[] = [];
      far(pictureWith([], [], [{ ...NAME, h: 60, lines: ["One", "", "Two"] }]), {
        measure(font, text) {
          asked.push(`${font}: ${text}`);
          return 20;
        },
      });
      expect(asked).toEqual([`${FONT}: One`, `${FONT}: Two`]);
    });

    it("takes the place of a larger text from the side of its label that the text keeps", () => {
      // Each text is 40 units wide. The text at the left is from 60 to 100 on the x axis.
      const left: PictureLabel = { ...NAME, id: "left", x: 60, lines: ["Left"] };
      const measure = (): number => 20;
      // The name starts at 100: the two texts are too near.
      expect(texts(far(pictureWith([], [], [NAME, left]), { measure }))).toEqual(["Group"]);
      // The name is from 120 to 160 about its middle, and from 140 to 180 from its right end.
      expect(texts(far(pictureWith([], [], [{ ...NAME, align: "center" }, left]), { measure }))).toEqual(["Group", "Left"]);
      expect(texts(far(pictureWith([], [], [{ ...NAME, align: "right" }, left]), { measure }))).toEqual(["Group", "Left"]);
    });
  });

  describe("and the view", () => {
    /** This function gives the paint list for a view of 100 by 100 units that starts at a place on the x axis. */
    const from = (x: number, looks: PictureLooks<PictureTheme> = least10, of: PictureIndex = only): PaintShape[] => far(of, { visible: { x, y: 0, w: 100, h: 100 } }, looks);
    /** The margin of the view at the zoom 0.25, in the unit of the picture. */
    const margin = 4 * VIEW_MARGIN;

    it("shows a text whose larger rectangle is in the view, and not a text out of it", () => {
      // The label ends at 180 on the x axis, and its larger text ends at 260.
      expect(from(180 + margin + 1)).toEqual([NAME_TEXT]);
      expect(from(260 + margin)).toEqual([NAME_TEXT]);
      expect(from(260 + margin + 1)).toEqual([]);
    });

    it("gives a text at its place the view of its place", () => {
      expect(from(180 + margin, inPlace)).toHaveLength(1);
      expect(from(180 + margin + 1, inPlace)).toEqual([]);
    });

    it("shows the larger text of a box that is out of the view, with no shape for the box", () => {
      const group: PictureBox = { id: "g", x: 0, y: 0, w: 200, h: 100 };
      const picture = pictureWith([group], [], [{ ...NAME, box: "g" }]);
      // The box ends at 200 on the x axis.
      expect(from(200 + margin, least10, picture)).toHaveLength(2);
      expect(from(200 + margin + 1, least10, picture)).toEqual([NAME_TEXT]);
    });

    describe("that an edge cuts", () => {
      /** The larger text is 40 units wide and 40 units high: from 100 to 140 on the x axis, and from 40 to 80 on the y axis. */
      const measure = (): number => 20;
      /** The distance that stays between a text and an edge of the view, at the zoom 0.25. */
      const pad = KEPT_GAP * 4;
      const cut = (visible: PaintState["visible"], of: PictureIndex = only, state: Partial<PaintState> = { measure }): PaintShape[] => far(of, { visible, ...state });

      it("moves the text into the view, with a distance of `KEPT_GAP` units of a look to the edge", () => {
        // The right edge is at 130, the left edge at 120, the top edge at 60 and the bottom edge at 76.
        expect(cut({ x: 0, y: 0, w: 130, h: 200 })).toEqual([{ ...NAME_TEXT, x: 130 - pad - 40 }]);
        expect(cut({ x: 120, y: 0, w: 200, h: 200 })).toEqual([{ ...NAME_TEXT, x: 120 + pad }]);
        expect(cut({ x: 0, y: 60, w: 400, h: 200 })).toEqual([{ ...NAME_TEXT, y: 60 + pad + 20 }]);
        expect(cut({ x: 0, y: 0, w: 400, h: 76 })).toEqual([{ ...NAME_TEXT, y: 76 - pad - 20 }]);
        // A corner of the view moves the text on the two axes.
        expect(cut({ x: 0, y: 60, w: 130, h: 200 })).toEqual([{ ...NAME_TEXT, x: 130 - pad - 40, y: 60 + pad + 20 }]);
      });

      it("moves the point of a line with its text, for each alignment", () => {
        // About its middle, the text is from 120 to 160. From its right end, it is from 140 to 180. It moves to the place from 94 to 134.
        expect(cut({ x: 0, y: 0, w: 150, h: 200 }, pictureWith([], [], [{ ...NAME, align: "center" }]))).toEqual([{ ...NAME_TEXT, align: "center", x: 114 }]);
        expect(cut({ x: 0, y: 0, w: 150, h: 200 }, pictureWith([], [], [{ ...NAME, align: "right" }]))).toEqual([{ ...NAME_TEXT, align: "right", x: 134 }]);
      });

      it("moves each line of a text by the same distance", () => {
        const two: PictureLabel = { ...NAME, h: 40, lines: ["One", "Two"] };
        // The two lines are from 30 to 110 on the y axis. The top edge is at 50.
        expect(cut({ x: 0, y: 50, w: 130, h: 200 }, pictureWith([], [], [two]))).toEqual([
          { ...NAME_TEXT, text: "One", x: 130 - pad - 40, y: 50 + pad + 20 },
          { ...NAME_TEXT, text: "Two", x: 130 - pad - 40, y: 50 + pad + 60 },
        ]);
      });

      it("leaves a text that is longer than the view on an axis at its place on that axis", () => {
        // With no measure, the text is 160 units wide.
        expect(cut({ x: 0, y: 0, w: 130, h: 200 }, only, {})).toEqual([NAME_TEXT]);
        expect(cut({ x: 0, y: 60, w: 130, h: 200 }, only, {})).toEqual([{ ...NAME_TEXT, y: 60 + pad + 20 }]);
        // The text is 40 units high, and the view has 39 units between its two distances.
        expect(cut({ x: 0, y: 30, w: 400, h: 39 + 2 * pad })).toEqual([NAME_TEXT]);
        expect(cut({ x: 0, y: 30, w: 400, h: 40 + 2 * pad })).toEqual([{ ...NAME_TEXT, y: 30 + pad + 20 }]);
      });

      it("leaves a text with no part in the view at its place", () => {
        // The text ends at 140 on the x axis. It is in the margin of the view, so it has its paint.
        expect(cut({ x: 140, y: 0, w: 200, h: 200 })).toEqual([NAME_TEXT]);
        expect(cut({ x: 141, y: 0, w: 200, h: 200 })).toEqual([NAME_TEXT]);
        expect(cut({ x: 139, y: 0, w: 200, h: 200 })).toEqual([{ ...NAME_TEXT, x: 139 + pad }]);
      });

      it("leaves a text that is all in the view, at the distance or more, at its place", () => {
        expect(cut({ x: 100 - pad, y: 40 - pad, w: 40 + 2 * pad, h: 40 + 2 * pad })).toEqual([NAME_TEXT]);
        expect(cut({ x: 0, y: 0, w: 400, h: 400 })).toEqual([NAME_TEXT]);
      });

      it("takes the place of the text after the move", () => {
        // The second text is from 30 to 70 on the x axis: it is 30 units from the name.
        const other: PictureLabel = { ...NAME, id: "other", x: 30, lines: ["Other"] };
        const pair = pictureWith([], [], [NAME, other]);
        expect(texts(cut({ x: 0, y: 0, w: 400, h: 200 }, pair))).toEqual(["Group", "Other"]);
        // The name moves to the place from 74 to 114: it is 4 units from the second text, and it has the first choice.
        expect(texts(cut({ x: 0, y: 0, w: 130, h: 200 }, pair))).toEqual(["Group"]);
      });
    });

    describe("with a control of the page on a part of it", () => {
      /** The larger text is 40 units wide and 40 units high: from 100 to 140 on the x axis, and from 40 to 80 on the y axis. */
      const measure = (): number => 20;
      /** The distance that stays between a text and an edge of the free area, at the zoom 0.25. */
      const pad = KEPT_GAP * 4;
      /** This function gives the paint list for a view of 400 by 400 units. A control of the page covers the part of the view above `top`. */
      const below = (top: number, of: PictureIndex = only): PaintShape[] => far(of, { visible: { x: 0, y: 0, w: 400, h: 400 }, free: { x: 0, y: top, w: 400, h: 400 - top }, measure });

      it("leaves a text in the free area at its place", () => {
        expect(below(0)).toEqual([NAME_TEXT]);
        expect(below(40 - pad)).toEqual([NAME_TEXT]);
      });

      it("moves a text that an edge of the free area cuts into the area", () => {
        expect(below(60)).toEqual([{ ...NAME_TEXT, y: 60 + pad + 20 }]);
        expect(below(79)).toEqual([{ ...NAME_TEXT, y: 79 + pad + 20 }]);
      });

      it("gives no paint to a text below the control", () => {
        // The text ends at 80 on the y axis.
        expect(below(80)).toEqual([]);
        expect(below(300)).toEqual([]);
      });

      it("leaves a text out of the view at its place, in the margin of the view", () => {
        // The view starts at 140 on the x axis, where the text ends.
        expect(far(only, { visible: { x: 140, y: 0, w: 200, h: 200 }, free: { x: 140, y: 100, w: 200, h: 100 }, measure })).toEqual([NAME_TEXT]);
      });

      describe("and the name of a box", () => {
        /** This function gives a picture of a box that starts at 90 and 30, with a height, and its name. */
        const group = (h: number): PictureIndex => pictureWith([{ id: "g", x: 90, y: 30, w: 200, h }], [], [{ ...NAME, box: "g" }]);

        it("moves the name into the part of its box in the free area, with the distance to the edge of the area", () => {
          // The free area starts at 100 on the y axis, below the name. The name keeps its place on the x axis.
          const shapes = below(100, group(300));
          expect(shapes).toHaveLength(2);
          expect(shapes[1]).toEqual({ ...NAME_TEXT, y: 100 + pad + 20 });
        });

        it("gives no paint to the name, when the part of its box in the free area has no room for it", () => {
          // The text is 40 units high. A box of 126 units ends 40 units below the distance to the edge of the area.
          expect(below(100, group(126))[1]).toEqual({ ...NAME_TEXT, y: 100 + pad + 20 });
          expect(texts(below(100, group(125)))).toEqual([]);
          expect(below(100, group(125))).toHaveLength(1);
        });

        it("moves the name of a box that the view shows a part of, when its name is out of the view", () => {
          // The view starts at 150 on the x axis, 10 units after the end of the name.
          const shapes = far(group(300), { visible: { x: 150, y: 0, w: 400, h: 400 }, measure });
          expect(shapes[1]).toEqual({ ...NAME_TEXT, x: 150 + pad });
        });
      });
    });

    it("does not ask the look of a label that cannot be in the view at the largest height", () => {
      let asked = 0;
      const counting = labelLooks(() => {
        asked += 1;
        return { color: "#111", least: 10 };
      });
      // At the largest height of 32 pixels, the text is 6.4 times larger: it ends at 612 on the x axis.
      expect(from(612 + margin - 1, counting)).toEqual([]);
      expect(asked).toBe(1);
      expect(from(612 + margin + 1, counting)).toEqual([]);
      expect(asked).toBe(1);
    });
  });

  describe("with a box that becomes larger around it", () => {
    /** A pill of 60 by 20 units, with its middle at 230 and 110. At the zoom 0.25, it is 15 by 5 pixels. */
    const pill: PictureBox = { id: "pill", x: 200, y: 100, w: 60, h: 20 };
    const pillName: PictureLabel = { id: "pill-name", box: "pill", x: 205, y: 100, w: 50, h: 20, lines: ["Topic"], lineHeight: 20, font: FONT };
    const picture = pictureWith([pill], [], [pillName]);
    /** The larger text is 60 units wide and 40 units high. */
    const measure = (): number => 30;
    /** The name keeps 10 pixels. Its box keeps 2 pixels at its sides and 1 pixel above and below it: 8 units and 4 units at the zoom 0.25. */
    const nameLook: LabelLook = { color: "#fff", least: 10, boxed: { x: 2, y: 1 } };
    const pillLook: BoxLook = { fill: "#222", radius: 10 };
    const pillLooks = (box: BoxLook = pillLook, label: LabelLook = nameLook): PictureLooks<PictureTheme> => looksWith({ box: () => box, label: () => label });
    const grown = (state: Partial<PaintState> = {}, looks: PictureLooks<PictureTheme> = pillLooks(), of: PictureIndex = picture): PaintShape[] => far(of, { measure, ...state }, looks);
    /** The pill at its place. */
    const PILL: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 200, y: 100, w: 60, h: 20, radius: 10 }, fill: "#222", opacity: 1 };
    /** The larger pill: the text with the distances around it, about the middle of the pill. Its radius is 2 times larger, as the text is. */
    const LARGER: PaintOutlined = { type: "shape", outline: { kind: "rect", x: 192, y: 86, w: 76, h: 48, radius: 20 }, fill: "#222", opacity: 1, box: "pill" };
    const TOPIC_TEXT: PaintText = { type: "text", text: "Topic", x: 200, y: 110, font: FONT, align: "left", fill: "#fff", opacity: 1, scale: 2 };
    /** The name at its place in the pill, at the size of the picture. */
    const SMALL_TEXT: PaintText = { type: "text", text: "Topic", x: 205, y: 110, font: FONT, align: "left", fill: "#fff", opacity: 1 };

    it("makes the box larger around the text, with the text at the middle of the box", () => {
      // The box at its place has no paint: the larger box has its look, and the id of the box.
      expect(grown()).toEqual([LARGER, TOPIC_TEXT]);
    });

    it("puts the text at the middle of the box for each alignment", () => {
      for (const [align, x] of [
        ["center", 230],
        ["right", 260],
      ] as const) {
        expect(grown({}, pillLooks(), pictureWith([pill], [], [{ ...pillName, align }]))).toEqual([LARGER, { ...TOPIC_TEXT, align, x }]);
      }
    });

    it("keeps the size of a box on an axis where the box is larger than the text with its distances", () => {
      const wide = pictureWith([{ ...pill, x: 130, w: 200 }], [], [pillName]);
      expect(grown({}, pillLooks(), wide)).toEqual([{ ...LARGER, outline: { kind: "rect", x: 130, y: 86, w: 200, h: 48, radius: 20 } }, TOPIC_TEXT]);
    });

    it("gives the larger box the ring, the signs and the share of color of its box", () => {
      const look: BoxLook = { ...pillLook, opacity: 0.5, ring: { color: "#00f", width: 2, gap: 3 }, marks: [{ shape: "dot", x: 5, y: 10, radius: 2, color: "#f00" }] };
      // One unit of a look is 4 units of the picture: the middle of the ring is 16 units out of the larger box.
      expect(grown({}, pillLooks(look))).toEqual([
        { type: "shape", outline: { kind: "rect", x: 176, y: 70, w: 108, h: 80, radius: 36 }, stroke: "#00f", lineWidth: 8, opacity: 0.5 },
        { ...LARGER, opacity: 0.5 },
        { type: "shape", outline: { kind: "ellipse", cx: 205, cy: 110, rx: 8, ry: 8 }, fill: "#f00", opacity: 0.5 },
        TOPIC_TEXT,
      ]);
      // The focus of the picture decreases the color of the larger box and of its text.
      expect(grown({ fade: () => 0.5 })).toEqual([
        { ...LARGER, opacity: 0.5 },
        { ...TOPIC_TEXT, opacity: 0.5 },
      ]);
    });

    it("takes the place of the larger box, so that no other text is on it", () => {
      // The larger box ends at 134 on the y axis. The larger text of the second name starts 10 units above its label.
      const gap = KEPT_GAP * 4;
      const other = (y: number): PictureIndex => pictureWith([pill], [], [pillName, { id: "free", x: 200, y, w: 50, h: 20, lines: ["Free"], lineHeight: 20, font: FONT }]);
      expect(texts(grown({}, pillLooks(), other(134 + gap + 10)))).toEqual(["Topic", "Free"]);
      expect(texts(grown({}, pillLooks(), other(134 + gap + 9)))).toEqual(["Topic"]);
    });

    it("comes in the order of the texts by its larger size", () => {
      // The larger pill is 76 by 48 units. The larger text of the second box is on it.
      const other = (w: number): PictureIndex =>
        pictureWith([pill, { id: "mid", x: 200, y: 140, w, h: 40 }], [], [pillName, { id: "mid-name", box: "mid", x: 200, y: 130, w: 50, h: 20, lines: ["Mid"], lineHeight: 20, font: FONT }]);
      const looks = looksWith({ box: () => pillLook, label: (label) => (label.id === "pill-name" ? nameLook : { color: "#111", least: 10 }) });
      // A box of 50 by 40 units is larger than the pill at its place, and smaller than the larger pill.
      expect(texts(grown({}, looks, other(50)))).toEqual(["Topic"]);
      // A box of 100 by 40 units is larger than the larger pill, so its text comes first.
      const second = grown({}, looks, other(100));
      expect(texts(second)).toEqual(["Topic", "Mid"]);
      expect(second).toContainEqual(SMALL_TEXT);
    });

    it("leaves a box with no room for its larger size as it is, with its name at its place", () => {
      // The box around the pill is larger than the larger pill, so its name comes first. The larger pill has no place.
      const first = pictureWith([{ id: "wide", x: 150, y: 60, w: 200, h: 100 }, pill], [], [{ id: "wide-name", box: "wide", x: 200, y: 100, w: 50, h: 20, lines: ["Wide"], lineHeight: 20, font: FONT }, pillName]);
      const looks = looksWith({ box: () => pillLook, label: (label) => (label.id === "pill-name" ? nameLook : { color: "#111", least: 10 }) });
      const shapes = grown({}, looks, first);
      // The pill and its name are below the texts that keep a height.
      expect(shapes.slice(1)).toEqual([PILL, SMALL_TEXT, { ...TOPIC_TEXT, text: "Wide", fill: "#111", y: 110 }]);
      expect(shapes.some((shape) => "box" in shape && shape.box !== undefined)).toBe(false);
      // The focus of the picture decreases the color of the name with the color of its box.
      expect(grown({ fade: () => 0.5 }, looks, first)[2]).toEqual({ ...SMALL_TEXT, opacity: 0.5 });
    });

    it("keeps a text that an edge of the free area moves in its box: the larger box is around the box and the text", () => {
      // The text with its distances is from 192 to 268 on the x axis. The right edge of the view is at 250.
      const x = 250 - KEPT_GAP * 4 - 76;
      // The larger box goes from the left edge of the text with its distance to the right edge of the box at its place.
      expect(grown({ visible: { x: 0, y: 0, w: 250, h: 400 } })).toEqual([{ ...LARGER, outline: { kind: "rect", x, y: 86, w: 260 - x, h: 48, radius: 20 } }, { ...TOPIC_TEXT, x: x + 8 }]);
      // A control of the page above the box moves the text down. The larger box starts at the top edge of the box at its place.
      const y = 100 + KEPT_GAP * 4;
      expect(grown({ visible: { x: 0, y: 0, w: 400, h: 400 }, free: { x: 0, y: 100, w: 400, h: 300 } })).toEqual([
        { ...LARGER, outline: { kind: "rect", x: 192, y: 100, w: 76, h: y + 48 - 100, radius: 20 } },
        { ...TOPIC_TEXT, y: y + 24 },
      ]);
    });

    it("leaves a box below a control of the page as it is, with its name at its place", () => {
      expect(grown({ visible: { x: 0, y: 0, w: 400, h: 400 }, free: { x: 0, y: 140, w: 400, h: 260 } })).toEqual([PILL, SMALL_TEXT]);
    });

    it("has no effect on a text that is high enough, and on a label that names no box", () => {
      // At the zoom 0.5, the line is 10 pixels high: the box and its name are at their places.
      const near = paint({ zoom: 0.5, measure }, pillLooks(), picture);
      expect(near).toEqual([PILL, SMALL_TEXT]);
      expect(near[0]).not.toHaveProperty("box");
      expect(far(only, {}, pillLooks())).toEqual([{ ...NAME_TEXT, fill: "#fff" }]);
    });

    describe("with clear", () => {
      const clearLook: LabelLook = { ...nameLook, clear: true };
      /** A box with no child 2 units right of the pill. The larger pill ends at 268 on the x axis, so it covers the box. */
      const near: PictureBox = { id: "near", x: 262, y: 105, w: 10, h: 10 };
      const crowded = (more: PictureBox = near): PictureIndex => pictureWith([pill, more], [], [pillName]);

      it("gives no place over a box with no child, and no name at its place", () => {
        expect(texts(grown({}, pillLooks(pillLook, clearLook), crowded()))).toEqual([]);
        const shapes = grown({}, pillLooks(pillLook, clearLook), crowded());
        expect(shapes).toContainEqual(PILL);
        expect(shapes.some((shape) => "box" in shape && shape.box !== undefined)).toBe(false);
        // Without clear, the larger pill covers the box.
        expect(texts(grown({}, pillLooks(), crowded()))).toEqual(["Topic"]);
      });

      it("covers its own box, a box out of the larger pill and a container", () => {
        expect(grown({}, pillLooks(pillLook, clearLook))).toEqual([LARGER, TOPIC_TEXT]);
        expect(texts(grown({}, pillLooks(pillLook, clearLook), crowded({ ...near, x: 300 })))).toEqual(["Topic"]);
        // A box with boxes in it is not a box with no child.
        const framed = pictureWith([{ id: "frame", x: 100, y: 50, w: 300, h: 200 }, { ...pill, parent: "frame" }], [], [pillName]);
        expect(texts(grown({}, pillLooks(pillLook, clearLook), framed))).toEqual(["Topic"]);
      });

      it("finds a box in each cell of the grid that the larger pill touches", () => {
        // At the zoom 0.25, a cell has 512 units. The larger pill from 442 to 518 is in two cells, and a box from 514 to 524 is only in the second cell.
        const far = pictureWith([{ ...pill, x: 450 }, { ...near, x: 514 }], [], [{ ...pillName, box: "pill", x: 455 }]);
        expect(texts(grown({}, pillLooks(pillLook, clearLook), pictureWith([{ ...pill, x: 450 }, { ...near, x: 530 }], [], [{ ...pillName, box: "pill", x: 455 }])))).toEqual(["Topic"]);
        expect(texts(grown({}, pillLooks(pillLook, clearLook), far))).toEqual([]);
      });
    });

    it("comes before a larger box with a higher rank", () => {
      const first = pictureWith([{ id: "wide", x: 150, y: 60, w: 200, h: 100 }, pill], [], [{ id: "wide-name", box: "wide", x: 200, y: 100, w: 50, h: 20, lines: ["Wide"], lineHeight: 20, font: FONT }, pillName]);
      const ranked = (rank: number): PictureLooks<PictureTheme> => looksWith({ box: () => pillLook, label: (label) => (label.id === "pill-name" ? { ...nameLook, rank } : { color: "#111", least: 10 }) });
      // With the same rank, the larger box comes first: the pill keeps its name at its place.
      expect(grown({}, ranked(0), first)).toContainEqual(SMALL_TEXT);
      // With a higher rank, the pill becomes larger first, and the name of the larger box has no place.
      const shapes = grown({}, ranked(1), first);
      expect(texts(shapes)).toEqual(["Topic"]);
      expect(shapes).toContainEqual(TOPIC_TEXT);
    });
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
