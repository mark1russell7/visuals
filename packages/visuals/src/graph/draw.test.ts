import { describe, expect, it } from "vitest";
import { drawShapes, imageRect } from "./draw.ts";
import type { ImageSource } from "./images.ts";
import { LIGHT_PICTURE_THEME, plainLooks } from "./looks.ts";
import { paintPicture, type PaintOutlined, type PaintShape, type PaintText } from "./paint.ts";
import { indexPicture } from "./records.ts";
import { fakeContext, linesOf, PICTURE, type FakeContextOptions } from "./sample.ts";

const VIEW = { x: 10, y: 20, k: 2 };

/** The first lines of each drawing: the view of the camera, and the styles that each shape uses. */
const HEAD = ["save", "transform 2 0 0 2 10 20", "lineJoin = round", "lineCap = round", "textBaseline = middle"];

/** This function draws a paint list, and gives the lines of the context between the first lines and the last line. */
function drawn(shapes: readonly PaintShape[], options: FakeContextOptions = {}, images?: ImageSource): string[] {
  const { context, calls } = fakeContext(options);
  drawShapes(context, shapes, VIEW, images);
  expect(calls.slice(0, HEAD.length)).toEqual(HEAD);
  expect(calls.at(-1)).toBe("restore");
  return calls.slice(HEAD.length, -1);
}

/** This function gives a square with a line, and with the parts that the test gives. */
function square(more: Partial<PaintOutlined> = {}): PaintOutlined {
  return { type: "shape", outline: { kind: "rect", x: 0, y: 0, w: 10, h: 10, radius: 0 }, stroke: "#000", lineWidth: 1, opacity: 1, ...more };
}

/** The lines of a square with a line and no dash. */
const SQUARE = ["globalAlpha = 1", "beginPath", "rect 0 0 10 10", "strokeStyle = #000", "lineWidth = 1", "stroke"];

const PLAIN_TEXT: PaintText = { type: "text", text: "A note", x: 520, y: 8, font: "12px sans-serif", align: "right", fill: "#111", opacity: 1 };
const HALO_TEXT: PaintText = { type: "text", text: "uses", x: 245, y: 50, font: "12px sans-serif", align: "center", fill: "#111", halo: { color: "#fff", width: 4 }, opacity: 0.5 };

describe("drawShapes", () => {
  it("does not use the context for an empty list", () => {
    const { context, calls } = fakeContext();
    drawShapes(context, [], VIEW);
    expect(calls).toEqual([]);
  });

  it("applies the view of the camera, and puts the state of the context back at the end", () => {
    const { context, calls } = fakeContext();
    drawShapes(context, [square(), square()], VIEW);
    expect(calls).toEqual([...HEAD, ...SQUARE, ...SQUARE, "restore"]);
  });

  it("draws the inside of a shape, then its line", () => {
    const shape: PaintShape = { type: "shape", outline: { kind: "rect", x: 1, y: 2, w: 30, h: 40, radius: 6 }, fill: "#fff", stroke: "#000", lineWidth: 2, opacity: 0.5 };
    expect(drawn([shape])).toEqual(["globalAlpha = 0.5", "beginPath", "roundRect 1 2 30 40 6", "fillStyle = #fff", "fill evenodd", "strokeStyle = #000", "lineWidth = 2", "stroke"]);
  });

  it("draws a rectangle with sharp corners for a radius of 0, and in a browser with no round rectangle", () => {
    const sharp: PaintShape = { type: "shape", outline: { kind: "rect", x: 1, y: 2, w: 30, h: 40, radius: 0 }, fill: "#fff", opacity: 1 };
    expect(drawn([sharp])).toEqual(["globalAlpha = 1", "beginPath", "rect 1 2 30 40", "fillStyle = #fff", "fill evenodd"]);
    const round: PaintShape = { type: "shape", outline: { kind: "rect", x: 1, y: 2, w: 30, h: 40, radius: 6 }, fill: "#fff", opacity: 1 };
    expect(drawn([round], { roundRect: false })).toEqual(["globalAlpha = 1", "beginPath", "rect 1 2 30 40", "fillStyle = #fff", "fill evenodd"]);
  });

  it("draws an ellipse as one full turn", () => {
    const shape: PaintShape = { type: "shape", outline: { kind: "ellipse", cx: 5, cy: 6, rx: 7, ry: 8 }, fill: "#0a0", opacity: 1 };
    expect(drawn([shape])).toEqual(["globalAlpha = 1", "beginPath", `ellipse 5 6 7 8 0 0 ${2 * Math.PI}`, "fillStyle = #0a0", "fill evenodd"]);
  });

  it("closes each ring of a polygon, so a hole stays empty", () => {
    const shape: PaintShape = {
      type: "shape",
      outline: {
        kind: "polygon",
        rings: [
          [
            [0, 0],
            [40, 0],
            [20, 30],
          ],
          [
            [15, 5],
            [25, 5],
            [20, 12],
          ],
        ],
      },
      fill: "#eee",
      opacity: 1,
    };
    expect(drawn([shape])).toEqual(["globalAlpha = 1", "beginPath", "moveTo 0 0", "lineTo 40 0", "lineTo 20 30", "closePath", "moveTo 15 5", "lineTo 25 5", "lineTo 20 12", "closePath", "fillStyle = #eee", "fill evenodd"]);
  });

  it("draws each segment of a path: a move, a line, a curve and an arc in each direction", () => {
    const shape: PaintShape = {
      type: "shape",
      outline: {
        kind: "path",
        path: [
          { kind: "move", to: { x: 1, y: 2 } },
          { kind: "line", to: { x: 3, y: 4 } },
          { kind: "cubic", c1: { x: 5, y: 6 }, c2: { x: 7, y: 8 }, to: { x: 9, y: 10 } },
          { kind: "arc", center: { x: 10, y: 20 }, radius: 5, start: 0, sweep: 1.5, to: { x: 0, y: 0 } },
          { kind: "arc", center: { x: 10, y: 20 }, radius: 5, start: 1, sweep: -0.5, to: { x: 0, y: 0 } },
        ],
      },
      stroke: "#222",
      lineWidth: 1.25,
      opacity: 1,
    };
    expect(drawn([shape])).toEqual(["globalAlpha = 1", "beginPath", "moveTo 1 2", "lineTo 3 4", "bezierCurveTo 5 6 7 8 9 10", "arc 10 20 5 0 1.5 false", "arc 10 20 5 1 0.5 true", "strokeStyle = #222", "lineWidth = 1.25", "stroke"]);
  });

  it("draws no line for a shape with no line width, or with a width of 0", () => {
    const outline = ["globalAlpha = 1", "beginPath", "rect 0 0 10 10"];
    expect(drawn([square({ lineWidth: 0 })])).toEqual(outline);
    expect(drawn([square({ lineWidth: undefined })])).toEqual(outline);
    expect(drawn([square({ stroke: undefined })])).toEqual(outline);
    // A line that the function does not draw does not change the dashes of the context.
    expect(drawn([square({ lineWidth: 0, dash: [8, 4] })])).toEqual(outline);
  });

  it("sets the dashes before the line of a shape with dashes", () => {
    expect(drawn([square({ dash: [8, 4] })])).toEqual(["globalAlpha = 1", "beginPath", "rect 0 0 10 10", "setLineDash [8,4]", "strokeStyle = #000", "lineWidth = 1", "stroke"]);
  });

  it("removes the dashes before the next line with no dash, and not for each shape", () => {
    const shapes = [square({ dash: [8, 4] }), square({ dash: [2, 2] }), square(), square(), square({ dash: [] }), square({ dash: [6, 3] })];
    expect(linesOf(drawn(shapes), "setLineDash")).toEqual(["setLineDash [8,4]", "setLineDash [2,2]", "setLineDash []", "setLineDash [6,3]"]);
    // A list with no dash does not use the dashes of the context.
    expect(linesOf(drawn([square(), square({ dash: [] }), PLAIN_TEXT, HALO_TEXT]), "setLineDash")).toEqual([]);
  });

  it("draws a text at its point, with its font and its side", () => {
    expect(drawn([PLAIN_TEXT])).toEqual(["globalAlpha = 1", "font = 12px sans-serif", "textAlign = right", "fillStyle = #111", "fillText A note 520 8"]);
  });

  it("draws the line around the letters of a text below the letters", () => {
    expect(drawn([HALO_TEXT])).toEqual(["globalAlpha = 0.5", "font = 12px sans-serif", "textAlign = center", "strokeStyle = #fff", "lineWidth = 4", "strokeText uses 245 50", "fillStyle = #111", "fillText uses 245 50"]);
  });

  it("removes the dashes before the line around the letters of a text", () => {
    const calls = drawn([square({ dash: [8, 4] }), PLAIN_TEXT, HALO_TEXT, square()]);
    expect(calls).toEqual([
      "globalAlpha = 1",
      "beginPath",
      "rect 0 0 10 10",
      "setLineDash [8,4]",
      "strokeStyle = #000",
      "lineWidth = 1",
      "stroke",
      // A text with no line around its letters does not use the dashes.
      "globalAlpha = 1",
      "font = 12px sans-serif",
      "textAlign = right",
      "fillStyle = #111",
      "fillText A note 520 8",
      "globalAlpha = 0.5",
      "font = 12px sans-serif",
      "textAlign = center",
      "setLineDash []",
      "strokeStyle = #fff",
      "lineWidth = 4",
      "strokeText uses 245 50",
      "fillStyle = #111",
      "fillText uses 245 50",
      // The context has no dash at this time.
      ...SQUARE,
    ]);
  });

  it("draws a text with a factor larger about its point: the point becomes the origin for the text", () => {
    expect(drawn([{ ...PLAIN_TEXT, scale: 2 }])).toEqual(["globalAlpha = 1", "font = 12px sans-serif", "textAlign = right", "save", "translate 520 8", "scale 2 2", "fillStyle = #111", "fillText A note 0 0", "restore"]);
  });

  it("gives the line around the letters of a larger text its width after the factor", () => {
    // The width of the line is 4 units of the picture, and the context multiplies each width by 4.
    expect(drawn([{ ...HALO_TEXT, scale: 4 }])).toEqual([
      "globalAlpha = 0.5",
      "font = 12px sans-serif",
      "textAlign = center",
      "save",
      "translate 245 50",
      "scale 4 4",
      "strokeStyle = #fff",
      "lineWidth = 1",
      "strokeText uses 0 0",
      "fillStyle = #111",
      "fillText uses 0 0",
      "restore",
    ]);
  });

  it("draws a text with the factor 1, or with a factor that is not above 0, at its point", () => {
    const plain = drawn([PLAIN_TEXT]);
    expect(drawn([{ ...PLAIN_TEXT, scale: 1 }])).toEqual(plain);
    expect(drawn([{ ...PLAIN_TEXT, scale: 0 }])).toEqual(plain);
    expect(drawn([{ ...PLAIN_TEXT, scale: -2 }])).toEqual(plain);
    expect(drawn([{ ...PLAIN_TEXT, scale: Number.NaN }])).toEqual(plain);
  });

  it("removes the dashes before it keeps the state of the context for a larger text, so they do not come back", () => {
    const calls = drawn([square({ dash: [8, 4] }), { ...HALO_TEXT, scale: 2 }, square()]);
    expect(calls.slice(7)).toEqual([
      "globalAlpha = 0.5",
      "font = 12px sans-serif",
      "textAlign = center",
      "setLineDash []",
      "save",
      "translate 245 50",
      "scale 2 2",
      "strokeStyle = #fff",
      "lineWidth = 2",
      "strokeText uses 0 0",
      "fillStyle = #111",
      "fillText uses 0 0",
      "restore",
      // The context has no dash at this time.
      ...SQUARE,
    ]);
  });

  it("draws the paint list of a picture in its order", () => {
    const shapes = paintPicture(indexPicture(PICTURE), plainLooks(), LIGHT_PICTURE_THEME, { zoom: 2, highlight: () => 0 });
    const calls = drawn(shapes);
    expect(linesOf(calls, "globalAlpha")).toEqual(new Array(13).fill("globalAlpha = 1"));
    expect(linesOf(calls, "fillText")).toEqual(["fillText Card 10 15", "fillText First line 16 37", "fillText Second 16 47", "fillText uses 245 50", "fillText A note 520 8"]);
    expect(linesOf(calls, "strokeText")).toEqual(["strokeText uses 245 50"]);
    // The card and the three boxes with no shape are round rectangles, and the topic is a circle.
    expect(linesOf(calls, "roundRect")).toEqual(["roundRect 0 0 200 100 6", "roundRect 10 30 180 25 6", "roundRect 10 65 180 25 6", "roundRect 0 300 100 40 6"]);
    expect(linesOf(calls, "ellipse")).toEqual([`ellipse 330 50 30 30 0 0 ${2 * Math.PI}`]);
    expect(linesOf(calls, "bezierCurveTo")).toEqual(["bezierCurveTo 100 200 50 200 50 300"]);
    // The lines are those of the card, the three routes and the four boxes with no child.
    expect(linesOf(calls, "stroke")).toHaveLength(8);
    expect(linesOf(calls, "fill")).toEqual(new Array(5).fill("fill evenodd"));
    expect(linesOf(calls, "setLineDash")).toEqual([]);
  });

  /** The image of a shape, in the middle of its outline. */
  const MIDDLE = { src: "a.png", fit: "contain", alignX: 0.5, alignY: 0.5 } as const;

  /** This function gives the image of the address `a.png`: 200 pixels by 100 pixels. It writes each address that a drawing asks for. */
  function sourceOf(asked: string[] = []): ImageSource {
    return (src) => {
      asked.push(src);
      return src === "a.png" ? { source: "bitmap" as unknown as CanvasImageSource, width: 200, height: 100 } : undefined;
    };
  }

  it("draws the image of a shape in its outline, above its inside and below its line", () => {
    const shape = square({ outline: { kind: "rect", x: 0, y: 0, w: 100, h: 100, radius: 8 }, fill: "#eee", image: MIDDLE });
    expect(drawn([shape], {}, sourceOf())).toEqual([
      "globalAlpha = 1",
      "beginPath",
      "roundRect 0 0 100 100 8",
      "fillStyle = #eee",
      "fill evenodd",
      // The outline cuts the image, and the context gets its state back before the line.
      "save",
      "clip",
      "imageSmoothingQuality = high",
      "drawImage bitmap 0 25 100 50",
      "restore",
      "strokeStyle = #000",
      "lineWidth = 1",
      "stroke",
    ]);
  });

  it("fills the outline with an image that has the fit `cover`, from the place that the shape gives", () => {
    const outline = { kind: "rect", x: 0, y: 0, w: 100, h: 100, radius: 0 } as const;
    const cover = (alignX: number): string[] => linesOf(drawn([square({ outline, image: { ...MIDDLE, fit: "cover", alignX } })], {}, sourceOf()), "drawImage");
    expect(cover(0.5)).toEqual(["drawImage bitmap -50 0 200 100"]);
    expect(cover(0)).toEqual(["drawImage bitmap 0 0 200 100"]);
    expect(cover(1)).toEqual(["drawImage bitmap -100 0 200 100"]);
  });

  it("draws the image of an ellipse in the bounds of the ellipse", () => {
    const shape: PaintShape = { type: "shape", outline: { kind: "ellipse", cx: 50, cy: 50, rx: 50, ry: 25 }, image: MIDDLE, opacity: 1 };
    expect(drawn([shape], {}, sourceOf())).toEqual(["globalAlpha = 1", "beginPath", `ellipse 50 50 50 25 0 0 ${2 * Math.PI}`, "save", "clip", "imageSmoothingQuality = high", "drawImage bitmap 0 25 100 50", "restore"]);
  });

  it("draws a shape with no image when the image is not ready, and in a drawing with no images", () => {
    const asked: string[] = [];
    expect(drawn([square({ image: { ...MIDDLE, src: "later.png" } })], {}, sourceOf(asked))).toEqual(SQUARE);
    expect(asked).toEqual(["later.png"]);
    expect(drawn([square({ image: MIDDLE })])).toEqual(SQUARE);
  });

  it("asks for no image for an outline that is a polygon or a path", () => {
    const asked: string[] = [];
    const polygon: PaintShape = { type: "shape", outline: { kind: "polygon", rings: [[[0, 0], [10, 0], [0, 10]]] }, fill: "#eee", image: MIDDLE, opacity: 1 };
    const path: PaintShape = { type: "shape", outline: { kind: "path", path: [{ kind: "move", to: { x: 0, y: 0 } }, { kind: "line", to: { x: 10, y: 10 } }] }, stroke: "#000", lineWidth: 1, image: MIDDLE, opacity: 1 };
    const calls = drawn([polygon, path], {}, sourceOf(asked));
    expect(linesOf(calls, "drawImage")).toEqual([]);
    expect(linesOf(calls, "clip")).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("keeps the inside and the line of a shape whose image the context cannot draw", () => {
    const { context, calls } = fakeContext();
    const broken = new Proxy(context, {
      get(target, name) {
        if (name !== "drawImage") return Reflect.get(target, name) as unknown;
        return (): void => {
          calls.push("drawImage error");
          throw new Error("The image is not good.");
        };
      },
    });
    drawShapes(broken, [square({ fill: "#eee", image: MIDDLE }), square()], VIEW, sourceOf());
    expect(calls.slice(HEAD.length)).toEqual([
      "globalAlpha = 1",
      "beginPath",
      "rect 0 0 10 10",
      "fillStyle = #eee",
      "fill evenodd",
      "save",
      "clip",
      "imageSmoothingQuality = high",
      "drawImage error",
      "restore",
      "strokeStyle = #000",
      "lineWidth = 1",
      "stroke",
      ...SQUARE,
      "restore",
    ]);
  });
});

describe("imageRect", () => {
  const AREA = { x: 10, y: 20, w: 100, h: 100 };
  const MIDDLE = { fit: "contain", alignX: 0.5, alignY: 0.5 } as const;

  it("puts all of an image in the area with the fit `contain`, and keeps the ratio of its sides", () => {
    // A wide image has the width of the area, and a tall image has its height.
    expect(imageRect(AREA, 200, 100, MIDDLE)).toEqual({ x: 10, y: 45, w: 100, h: 50 });
    expect(imageRect(AREA, 50, 200, MIDDLE)).toEqual({ x: 47.5, y: 20, w: 25, h: 100 });
    // A small image becomes larger.
    expect(imageRect(AREA, 10, 10, MIDDLE)).toEqual({ x: 10, y: 20, w: 100, h: 100 });
  });

  it("fills the area with the fit `cover`: a part of the image is out of the area", () => {
    expect(imageRect(AREA, 200, 100, { ...MIDDLE, fit: "cover" })).toEqual({ x: -40, y: 20, w: 200, h: 100 });
    expect(imageRect(AREA, 50, 200, { ...MIDDLE, fit: "cover" })).toEqual({ x: 10, y: -130, w: 100, h: 400 });
  });

  it("puts the image at the start, the middle or the end of each axis", () => {
    expect(imageRect(AREA, 200, 100, { fit: "contain", alignX: 0.5, alignY: 0 })).toEqual({ x: 10, y: 20, w: 100, h: 50 });
    expect(imageRect(AREA, 200, 100, { fit: "contain", alignX: 0.5, alignY: 1 })).toEqual({ x: 10, y: 70, w: 100, h: 50 });
    expect(imageRect(AREA, 200, 100, { fit: "cover", alignX: 0, alignY: 0.5 })).toEqual({ x: 10, y: 20, w: 200, h: 100 });
    expect(imageRect(AREA, 200, 100, { fit: "cover", alignX: 1, alignY: 0.5 })).toEqual({ x: -90, y: 20, w: 200, h: 100 });
  });

  it("gives the area for an image with no size, and for an area with no size", () => {
    expect(imageRect(AREA, 0, 100, MIDDLE)).toEqual(AREA);
    expect(imageRect(AREA, 200, Number.NaN, MIDDLE)).toEqual(AREA);
    expect(imageRect({ x: 1, y: 2, w: 0, h: 50 }, 200, 100, MIDDLE)).toEqual({ x: 1, y: 2, w: 0, h: 50 });
    expect(imageRect({ x: 1, y: 2, w: 50, h: 0 }, 200, 100, MIDDLE)).toEqual({ x: 1, y: 2, w: 50, h: 0 });
  });
});
