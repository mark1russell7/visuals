import { overlapOf, type PictureBox } from "@mark1russell7/layout-contract";
import { indexPicture, paintPicture, type PaintShape, type PaintText } from "@mark1russell7/visuals/graph";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { LIGHT_THREAD_THEME, TEXT_ZOOM, threadLooks } from "./looks.ts";
import { threadPicture } from "./picture.ts";
import { sampleThread } from "./sample.ts";
import { flatSample } from "./sample.test-util.ts";

/** The smallest height on the screen of the letters of a text in a far view, in CSS pixels. A smaller text is too small to read. */
const SMALLEST_FONT = 10;

/** The zooms of a far view that the probe examines, from the farthest view to the start of a near view. */
const FAR_ZOOMS = [0.05, 0.1, 0.2, 0.3, 0.45, 0.6, TEXT_ZOOM - 0.01];

/** This function gives the width of a text in a font: a fixed share of the size of the font for each letter. */
function measure(font: string, text: string): number {
  return text.length * fontSize(font) * 0.55;
}

/** This function gives the size of a font in CSS pixels, from a CSS font such as `600 13px sans-serif`. */
function fontSize(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? Number.NaN);
}

/** This function gives the rectangle of a text, in units of the picture. */
function textRect(shape: PaintText): { x: number; y: number; w: number; h: number } {
  const scale = shape.scale ?? 1;
  const w = measure(shape.font, shape.text) * scale;
  const h = fontSize(shape.font) * scale;
  const x = shape.align === "center" ? shape.x - w / 2 : shape.align === "right" ? shape.x - w : shape.x;
  return { x, y: shape.y - h / 2, w, h };
}

/** This function tells if two rectangles have an area in common. */
function covers(a: { x: number; y: number; w: number; h: number }, b: PictureBox): boolean {
  const overlap = overlapOf(a, b);
  return overlap.x > 0 && overlap.y > 0;
}

describe.each([
  ["the nested sample", sampleThread()],
  ["the flat sample", flatSample()],
])("the names of a far view of %s", (_, document) => {
  const thread = threadPicture(document, fakeAdvance, { timeZone: "UTC" });
  const looks = threadLooks(() => ({ thread, proposals: false }));
  const index = indexPicture(thread.picture);
  const theme = LIGHT_THREAD_THEME;
  const paint = (zoom: number): PaintShape[] => paintPicture(index, looks, theme, { zoom, highlight: () => 0, measure });
  /** The boxes with no child that the view draws at a zoom. */
  const leaves = (zoom: number): PictureBox[] =>
    thread.picture.boxes.filter((box) => !index.children.has(box.id) && looks.box(box, { highlight: 0, focus: "all", zoom, container: false }, theme) !== undefined);

  it.each(FAR_ZOOMS)("has no text too small to read at the zoom %s", (zoom) => {
    const small = paint(zoom).flatMap((shape) => (shape.type === "text" && fontSize(shape.font) * (shape.scale ?? 1) * zoom < SMALLEST_FONT ? [shape.text] : []));
    expect(small).toEqual([]);
  });

  it.each(FAR_ZOOMS)("has no larger box over a box with no child of a different record at the zoom %s", (zoom) => {
    const boxes = leaves(zoom);
    const over = paint(zoom).flatMap((shape) => {
      if (shape.type !== "shape" || shape.box === undefined || shape.outline.kind !== "rect") return [];
      const { outline } = shape;
      return boxes.filter((box) => box.id !== shape.box && covers(outline, box)).map((box) => `${String(shape.box)} over ${box.id}`);
    });
    expect(over).toEqual([]);
  });

  it.each(FAR_ZOOMS)("has no name of a group over a box with no child at the zoom %s", (zoom) => {
    const boxes = leaves(zoom);
    const over = paint(zoom).flatMap((shape) => {
      if (shape.type !== "text" || (shape.scale ?? 1) <= 1 || shape.fill !== theme.text) return [];
      const rect = textRect(shape);
      return boxes.filter((box) => covers(rect, box)).map((box) => `${shape.text} over ${box.id}`);
    });
    expect(over).toEqual([]);
  });

  it("names at least one topic in the farthest view that has room for a name", () => {
    const named = FAR_ZOOMS.some((zoom) => paint(zoom).some((shape) => shape.type === "text" && shape.fill === theme.topicText));
    expect(named).toBe(true);
  });
});
