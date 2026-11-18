import { PICTURE_SCHEMA, type LayoutPicture } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import type { Highlight } from "../highlight.ts";
import { approach } from "../motion.ts";
import type { PictureView } from "./camera.ts";
import { createPictureContent, FOCUS_FADE, type LayoutPictureContent } from "./content.ts";
import { drawShapes } from "./draw.ts";
import { FOCUS_OPACITY, focusOf } from "./focus.ts";
import { LIGHT_PICTURE_THEME, plainLooks, SMALLEST_TEXT_LINE, type PictureLooks, type PictureTheme } from "./looks.ts";
import { BAR_HEIGHT, HALO_WIDTH, paintPicture } from "./paint.ts";
import { indexPicture } from "./records.ts";
import { CARD, FAR, fakeContext, linesOf, LINK, PICTURE, ROW_1 } from "./sample.ts";
import type { PickAt, PictureFrame } from "./stage.ts";

const theme = LIGHT_PICTURE_THEME;
const plain = plainLooks();

/** A view that shows all of the sample picture in a frame of 1200 by 800, with each text large enough to read. */
const VIEW: PictureView = { x: 0, y: 0, k: 2 };

/** The time between two pictures, in seconds. */
const SECONDS = 0.016;

/** A picture with no record. */
const EMPTY: LayoutPicture = { schema: PICTURE_SCHEMA, boxes: [], routes: [], labels: [] };

const { beside, out } = FOCUS_OPACITY;

/** The share of each shape of the sample picture with no focus, in the order of the paint. */
const CLEAR = new Array<number>(13).fill(1);

/** The shares with the focus of the first row. The second and third routes are below the first route, and they are out of the focus. */
const ROW_FOCUS = [1, 1, out, out, 1, 1, 1, 1, beside, 1, out, 1, out];

/** The shares with the focus of the far box. The first route is out of the focus, and the first row is beside it. */
const FAR_FOCUS = [1, 1, out, 1, 1, beside, beside, beside, 1, 1, 1, out, out];

/** This function gives the frame of one picture of a stage. */
function frame(more: Partial<PictureFrame> = {}): PictureFrame {
  return { view: VIEW, width: 1200, height: 800, area: { x: 0, y: 0, w: 1200, h: 800 }, pixelRatio: 1, seconds: SECONDS, settle: false, ...more };
}

/** This function draws a content one time. It gives the lines of the context, and the answer of the content. */
function draw(content: LayoutPictureContent<PictureTheme>, more: Partial<PictureFrame> = {}, table: Readonly<Record<string, Highlight>> = {}): { readonly calls: string[]; readonly again: boolean } {
  const { context, calls } = fakeContext();
  const again = content.draw(context, frame(more), theme, (record) => table[record] ?? 0);
  return { calls, again };
}

/** This function gives the share of each shape of a drawing, in the order of the paint. */
function alphas(calls: readonly string[]): number[] {
  return linesOf(calls, "globalAlpha").map((call) => Number(call.slice("globalAlpha = ".length)));
}

/** This function gives a pointer at a point of the picture. */
function at(x: number, y: number, more: Partial<PickAt> = {}): PickAt {
  const view = more.view ?? VIEW;
  return { point: { x, y }, screen: { x: x * view.k + view.x, y: y * view.k + view.y }, view, slack: 0, ...more };
}

describe("createPictureContent", () => {
  it("has the bounds of its picture, and bounds with no size for a picture with no record", () => {
    expect(createPictureContent(PICTURE, { looks: plain }).bounds).toEqual({ x: 0, y: 0, w: 520, h: 340 });
    expect(createPictureContent(EMPTY, { looks: plain }).bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it("has each box and each route of its picture by its id, and no label", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    expect(["card", "row-1", "far", "link", "aside"].map((id) => content.has(id))).toEqual([true, true, true, true, true]);
    expect(["card-label", "note", "none", ""].map((id) => content.has(id))).toEqual([false, false, false, false]);
  });

  it("draws the paint list of its picture in the view of the frame", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const { calls, again } = draw(content);
    const direct = fakeContext();
    drawShapes(direct.context, paintPicture(indexPicture(PICTURE), plain, theme, { zoom: 2, highlight: () => 0 }), VIEW);
    expect(calls).toEqual(direct.calls);
    expect(alphas(calls)).toEqual(CLEAR);
    expect(again).toBe(false);
  });

  it("does not use the context for a picture with no record", () => {
    const { calls, again } = draw(createPictureContent(EMPTY, { looks: plain }), {}, { none: 2 });
    expect(calls).toEqual([]);
    expect(again).toBe(false);
  });

  it("makes shapes only for the records in the view of the frame", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    // This frame shows the topic and the area around it: the part from 280 to 400 on the x axis, and from 0 to 100 on the y axis.
    const { calls } = draw(content, { view: { x: -560, y: 0, k: 2 }, width: 240, height: 200 });
    expect(calls[1]).toBe("transform 2 0 0 2 -560 0");
    expect(linesOf(calls, "fillText")).toEqual(["fillText uses 245 50", "fillText A note 520 8"]);
    expect(linesOf(calls, "roundRect")).toEqual([]);
    expect(linesOf(calls, "ellipse")).toHaveLength(1);
    // The lines are those of two routes and of the topic.
    expect(linesOf(calls, "stroke")).toHaveLength(3);
  });

  it("gives the looks the theme and the highlights of the frame", () => {
    const content = createPictureContent(PICTURE, { looks: plain, focus: "none" });
    const { calls } = draw(content, {}, { "row-1": 2, link: 1 });
    const direct = fakeContext();
    const highlight = (record: string): Highlight => (record === "row-1" ? 2 : record === "link" ? 1 : 0);
    drawShapes(direct.context, paintPicture(indexPicture(PICTURE), plain, theme, { zoom: 2, highlight }), VIEW);
    expect(calls).toEqual(direct.calls);
    expect(linesOf(calls, "strokeStyle")).toContain(`strokeStyle = ${theme.accent}`);
  });
});

describe("the width of a bar", () => {
  /** At the zoom 1, the two lines of the label of the first row are too small to read. */
  const near: PictureView = { x: 0, y: 0, k: 1 };

  it("comes from the context, and the content puts the font of the context back", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const { calls } = draw(content, { view: near });
    expect(calls.slice(0, 7)).toEqual(["font = 8px sans-serif", "measureText First line", "font = 10px sans-serif", "font = 8px sans-serif", "measureText Second", "font = 10px sans-serif", "save"]);
    // The context of the tests gives 6 units for each letter. The bars are after the card and the first row.
    const tall = 10 * BAR_HEIGHT;
    expect(linesOf(calls, "roundRect").slice(2, 4)).toEqual([`roundRect 16 ${37 - tall / 2} 60 ${tall} ${tall / 2}`, `roundRect 16 ${47 - tall / 2} 36 ${tall} ${tall / 2}`]);
  });

  it("is measured one time for each font and text, until the content releases what it keeps", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const first = draw(content, { view: near });
    const second = draw(content, { view: near });
    expect(linesOf(second.calls, "measureText")).toEqual([]);
    // The second drawing is the first drawing with no measure.
    expect(second.calls).toEqual(first.calls.slice(6));
    content.dispose?.();
    expect(linesOf(draw(content, { view: near }).calls, "measureText")).toEqual(["measureText First line", "measureText Second"]);
  });
});

describe("a name in a far view", () => {
  /** At the zoom 0.5, a line of the name of the card is 9 pixels high: too small to read. Each other text of the sample is a bar. */
  const far: PictureView = { x: 0, y: 0, k: 0.5 };

  it("keeps a height that a person can read: the content draws it larger about its place, after each other shape", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const { calls } = draw(content, { view: far });
    const scale = SMALLEST_TEXT_LINE / (18 * 0.5);
    // The larger text starts 4 units below the top edge of the view. It moves to the distance of 8 units that a name keeps to an edge.
    expect(calls.slice(-13)).toEqual([
      "globalAlpha = 1",
      "font = 13px sans-serif",
      "textAlign = left",
      "save",
      "translate 10 19",
      `scale ${scale} ${scale}`,
      `strokeStyle = ${theme.paper}`,
      `lineWidth = ${(18 * scale * HALO_WIDTH) / scale}`,
      "strokeText Card 0 0",
      `fillStyle = ${theme.mutedText}`,
      "fillText Card 0 0",
      "restore",
      "restore",
    ]);
    expect(linesOf(calls, "fillText")).toEqual(["fillText Card 0 0"]);
    // The content measures the bars, then the name: the width of the name is necessary for its place among the other names.
    expect(linesOf(calls, "measureText")).toEqual(["measureText First line", "measureText Second", "measureText uses", "measureText A note", "measureText Card"]);
  });

  it("does not measure its text again in a different far view", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    draw(content, { view: far });
    const { calls } = draw(content, { view: { x: 0, y: 0, k: 0.375 } });
    expect(linesOf(calls, "measureText")).toEqual([]);
    expect(linesOf(calls, "fillText")).toEqual(["fillText Card 0 0"]);
  });
});

describe("the focus of a picture content", () => {
  /** This function gives the share of a record after one picture of a change from clear to a goal. */
  const step = (goal: number): number => approach(1, goal, SECONDS, FOCUS_FADE);

  it("gives less color to the records out of the focus of the selected box, with no change in time at the first picture", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const { calls, again } = draw(content, {}, { "row-1": 2 });
    expect(alphas(calls)).toEqual(ROW_FOCUS);
    expect(again).toBe(false);
  });

  it("takes the focus from a selected route too, and not from a record below the pointer", () => {
    expect(alphas(draw(createPictureContent(PICTURE, { looks: plain }), {}, { link: 2 }).calls)).toEqual(ROW_FOCUS);
    expect(alphas(draw(createPictureContent(PICTURE, { looks: plain }), {}, { "row-1": 1, link: 1 }).calls)).toEqual(CLEAR);
  });

  it("changes the colors in a short time after a change of the selection", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    draw(content);
    let last = draw(content, {}, { "row-1": 2 });
    expect(last.again).toBe(true);
    expect(alphas(last.calls)).toEqual([1, 1, step(out), step(out), 1, 1, 1, 1, step(beside), 1, step(out), 1, step(out)]);
    expect(step(out)).toBeLessThan(1);
    expect(step(out)).toBeGreaterThan(out);
    // The content asks for a next picture until each color is at its goal.
    let pictures = 1;
    while (last.again && pictures < 100) {
      last = draw(content, {}, { "row-1": 2 });
      pictures += 1;
    }
    expect(last.again).toBe(false);
    expect(alphas(last.calls)).toEqual(ROW_FOCUS);
    expect(pictures).toBeGreaterThan(5);
    expect(pictures).toBeLessThan(60);
    // The colors stay at their goals.
    const after = draw(content, {}, { "row-1": 2 });
    expect(after.again).toBe(false);
    expect(alphas(after.calls)).toEqual(ROW_FOCUS);
  });

  it("continues a change from its value when the selection changes again", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    draw(content);
    draw(content, {}, { "row-1": 2 });
    const back = draw(content);
    expect(back.again).toBe(true);
    // The far box is the 11th shape of a picture with no focus. Its color does not go to the share of the old focus first.
    expect(alphas(back.calls)[10]).toBe(approach(step(out), 1, SECONDS, FOCUS_FADE));
  });

  it("sets each color to its goal immediately in a frame with no motion", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    draw(content);
    const settled = draw(content, { settle: true }, { "row-1": 2 });
    expect(settled.again).toBe(false);
    expect(alphas(settled.calls)).toEqual(ROW_FOCUS);
    // A frame with no motion also ends a change that continues.
    expect(draw(content).again).toBe(true);
    const end = draw(content, { settle: true });
    expect(end.again).toBe(false);
    expect(alphas(end.calls)).toEqual(CLEAR);
  });

  it("uses the records of `setFocus` in place of the selection", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    const list = ["row-1"];
    content.setFocus(list);
    // A later change of the list of the page does not change the focus.
    list[0] = "far";
    expect(alphas(draw(content).calls)).toEqual(ROW_FOCUS);
    // An empty list gives no focus, with a selected record too.
    content.setFocus([]);
    expect(alphas(draw(content, { settle: true }, { far: 2 }).calls)).toEqual(CLEAR);
    // A name that the picture does not have gives no focus.
    content.setFocus(["none"]);
    expect(alphas(draw(content, { settle: true }, { far: 2 }).calls)).toEqual(CLEAR);
    // `undefined` gives the focus of the selection again.
    content.setFocus(undefined);
    expect(alphas(draw(content, { settle: true }, { far: 2 }).calls)).toEqual(FAR_FOCUS);
  });

  it("does not bring a box into the focus by a route that the looks do not show", () => {
    const looks: PictureLooks<PictureTheme> = { ...plain, route: (route, state, colors) => (route.id === "link" ? undefined : plain.route(route, state, colors)) };
    const { calls } = draw(createPictureContent(PICTURE, { looks }), {}, { "row-1": 2 });
    const index = indexPicture(PICTURE);
    const focus = focusOf(index, ["row-1"], { routes: (route) => route.id !== "link" });
    // The topic is at the other end of the hidden route, so it is out of the focus.
    expect(focus?.boxes.has("topic")).toBe(false);
    const direct = fakeContext();
    drawShapes(direct.context, paintPicture(index, looks, theme, { zoom: 2, highlight: (record) => (record === "row-1" ? 2 : 0), focus }), VIEW);
    expect(calls).toEqual(direct.calls);
    expect(alphas(calls).filter((share) => share === out).length).toBeGreaterThan(ROW_FOCUS.filter((share) => share === out).length);
  });

  it("has no focus from the selection with the option `none`", () => {
    const content = createPictureContent(PICTURE, { looks: plain, focus: "none" });
    expect(alphas(draw(content, {}, { "row-1": 2 }).calls)).toEqual(CLEAR);
    content.setFocus(["far"]);
    expect(alphas(draw(content, { settle: true }, { "row-1": 2 }).calls)).toEqual(FAR_FOCUS);
    content.setFocus(undefined);
    expect(alphas(draw(content, { settle: true }, { "row-1": 2 }).calls)).toEqual(CLEAR);
  });
});

describe("the pick of a picture content", () => {
  it("gives the record below the pointer, with the record as the value", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    expect(content.pick(at(50, 40))).toEqual({ record: "row-1", value: { type: "box", id: "row-1", box: ROW_1 } });
    expect(content.pick(at(50, 10))).toEqual({ record: "card", value: { type: "box", id: "card", box: CARD } });
    expect(content.pick(at(600, 600))).toBeUndefined();
  });

  it("uses the slack of the pointer, which is in CSS pixels", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    // The point is between the two rows of the card, 4 units from the first row.
    expect(content.pick(at(50, 59, { slack: 10 }))?.record).toBe("row-1");
    expect(content.pick(at(50, 59, { slack: 6 }))?.record).toBe("card");
    // In a far view, one CSS pixel is 2 units of the picture.
    const far: PictureView = { x: 0, y: 0, k: 0.5 };
    expect(content.pick(at(50, 59, { slack: 3, view: far }))?.record).toBe("row-1");
    expect(content.pick(at(50, 59, { slack: 1, view: far }))?.record).toBe("card");
  });

  it("permits each box and no route, or the records of the option `picks`", () => {
    expect(createPictureContent(PICTURE, { looks: plain }).pick(at(250, 50, { slack: 4 }))).toBeUndefined();
    const each = createPictureContent(PICTURE, { looks: plain, picks: () => true });
    expect(each.pick(at(250, 50))).toEqual({ record: "link", value: { type: "route", id: "link", route: LINK } });
    const routes = createPictureContent(PICTURE, { looks: plain, picks: (record) => record.type === "route" });
    expect(routes.pick(at(50, 40))).toBeUndefined();
  });

  it("does not give a record that the last picture did not show", () => {
    const looks: PictureLooks<PictureTheme> = { ...plain, box: (box, state, t) => (box.id === "row-1" ? undefined : plain.box(box, state, t)), route: () => undefined };
    const content = createPictureContent(PICTURE, { looks, picks: () => true });
    // Before the first picture, the content permits each record.
    expect(content.pick(at(50, 40))?.record).toBe("row-1");
    expect(content.pick(at(250, 50))?.record).toBe("link");
    draw(content);
    expect(content.pick(at(50, 40))?.record).toBe("card");
    expect(content.pick(at(250, 50))).toBeUndefined();
    // A different picture and a release permit each record again, until the next picture.
    content.setPicture(PICTURE);
    expect(content.pick(at(50, 40))?.record).toBe("row-1");
    draw(content);
    expect(content.pick(at(50, 40))?.record).toBe("card");
    content.dispose?.();
    expect(content.pick(at(250, 50))?.record).toBe("link");
  });

  it("asks the looks with the zoom of the pointer and the highlights of the last picture", () => {
    // These looks hide a box with no child in a far view, and a box below the pointer.
    const looks: PictureLooks<PictureTheme> = { ...plain, box: (box, state, t) => ((state.zoom < 1 && !state.container) || state.highlight === 1 ? undefined : plain.box(box, state, t)) };
    const content = createPictureContent(PICTURE, { looks });
    draw(content);
    expect(content.pick(at(50, 40))?.record).toBe("row-1");
    expect(content.pick(at(50, 40, { view: { x: 0, y: 0, k: 0.5 } }))?.record).toBe("card");
    draw(content, {}, { "row-1": 1 });
    expect(content.pick(at(50, 40))?.record).toBe("card");
  });
});

describe("setPicture", () => {
  const next: LayoutPicture = { schema: PICTURE_SCHEMA, boxes: [FAR], routes: [], labels: [] };

  it("shows a different picture, with its bounds and its records", () => {
    const content = createPictureContent(PICTURE, { looks: plain });
    draw(content);
    content.setPicture(next);
    expect(content.bounds).toEqual({ x: 0, y: 300, w: 100, h: 40 });
    expect(content.has("far")).toBe(true);
    expect(content.has("card")).toBe(false);
    expect(content.pick(at(50, 40))).toBeUndefined();
    expect(content.pick(at(50, 320))?.record).toBe("far");
    const { calls } = draw(content);
    expect(linesOf(calls, "roundRect")).toEqual(["roundRect 0 300 100 40 6"]);
    expect(alphas(calls)).toEqual([1]);
    content.setPicture(EMPTY);
    expect(content.bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(draw(content).calls).toEqual([]);
  });

  it("starts with no change in time: the first picture of a different picture has its colors at their goals", () => {
    const content = createPictureContent(next, { looks: plain });
    draw(content);
    content.setPicture(PICTURE);
    const first = draw(content, {}, { "row-1": 2 });
    expect(first.again).toBe(false);
    expect(alphas(first.calls)).toEqual(ROW_FOCUS);
    // A different picture ends a change that continues.
    expect(draw(content).again).toBe(true);
    content.setPicture(PICTURE);
    const second = draw(content);
    expect(second.again).toBe(false);
    expect(alphas(second.calls)).toEqual(CLEAR);
  });
});
