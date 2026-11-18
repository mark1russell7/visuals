import { describe, expect, it } from "vitest";
import { anchorRect } from "./anchor.ts";

const frame = { x: 100, y: 50, w: 800, h: 600 };
const box = { x: 10, y: 20, w: 200, h: 80 };

describe("anchorRect", () => {
  it("gives the rectangle of a box in the viewport, from the view of the camera and the place of the canvas", () => {
    expect(anchorRect({ x: 0, y: 0, k: 1 }, box, frame)).toEqual({ x: 110, y: 70, w: 200, h: 80 });
    expect(anchorRect({ x: 40, y: 30, k: 2 }, box, frame)).toEqual({ x: 160, y: 120, w: 400, h: 160 });
    expect(anchorRect({ x: 40, y: 30, k: 0.5 }, box, frame)).toEqual({ x: 145, y: 90, w: 100, h: 40 });
  });

  it("gives the full box when a part of it is out of the canvas", () => {
    expect(anchorRect({ x: -100, y: -60, k: 1 }, box, frame)).toEqual({ x: 10, y: 10, w: 200, h: 80 });
    expect(anchorRect({ x: 700, y: 550, k: 1 }, box, frame)).toEqual({ x: 810, y: 620, w: 200, h: 80 });
  });

  it("gives no rectangle when no part of the box is in the canvas", () => {
    expect(anchorRect({ x: -210, y: 0, k: 1 }, box, frame)).toBeUndefined();
    expect(anchorRect({ x: 0, y: -100, k: 1 }, box, frame)).toBeUndefined();
    expect(anchorRect({ x: 790, y: 0, k: 1 }, box, frame)).toBeUndefined();
    expect(anchorRect({ x: 0, y: 580, k: 1 }, box, frame)).toBeUndefined();
  });

  it("gives a rectangle for a box that touches the canvas with one pixel", () => {
    expect(anchorRect({ x: -209, y: 0, k: 1 }, box, frame)).toEqual({ x: -99, y: 70, w: 200, h: 80 });
    expect(anchorRect({ x: 789, y: 0, k: 1 }, box, frame)).toEqual({ x: 899, y: 70, w: 200, h: 80 });
  });
});
