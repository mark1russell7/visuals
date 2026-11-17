import { describe, expect, it } from "vitest";
import { toPicture, type PictureView } from "./camera.ts";
import { pictureKeyAction, type PictureKeyOptions } from "./keys.ts";

const view: PictureView = { x: 10, y: 20, k: 2 };
const area = { x: 100, y: 0, w: 800, h: 400 };
const options: PictureKeyOptions = { home: "all", views: { f: "focus" } };

describe("pictureKeyAction", () => {
  it("moves the camera in the direction of an arrow, by a part of the smaller side of the area", () => {
    // The smaller side is 400, so one step is 50 pixels. The picture moves in the opposite direction of the camera.
    expect(pictureKeyAction("ArrowLeft", view, area, options)).toEqual({ type: "move", to: { x: 60, y: 20, k: 2 } });
    expect(pictureKeyAction("ArrowRight", view, area, options)).toEqual({ type: "move", to: { x: -40, y: 20, k: 2 } });
    expect(pictureKeyAction("ArrowUp", view, area, options)).toEqual({ type: "move", to: { x: 10, y: 70, k: 2 } });
    expect(pictureKeyAction("ArrowDown", view, area, options)).toEqual({ type: "move", to: { x: 10, y: -30, k: 2 } });
  });

  it("zooms at the middle of the area", () => {
    const middle = { x: 500, y: 200 };
    for (const [key, larger] of [
      ["+", true],
      ["=", true],
      ["-", false],
      ["_", false],
    ] as const) {
      const action = pictureKeyAction(key, view, area, options);
      if (action?.type !== "move") throw new Error(`The key ${key} gives no move.`);
      expect(action.to.k > view.k).toBe(larger);
      const before = toPicture(view, middle);
      const after = toPicture(action.to, middle);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
  });

  it("gives the opposite zoom for the keys + and -", () => {
    const larger = pictureKeyAction("+", view, area, options);
    if (larger?.type !== "move") throw new Error("The key + gives no move.");
    const back = pictureKeyAction("-", larger.to, area, options);
    if (back?.type !== "move") throw new Error("The key - gives no move.");
    expect(back.to.x).toBeCloseTo(view.x, 9);
    expect(back.to.y).toBeCloseTo(view.y, 9);
    expect(back.to.k).toBeCloseTo(view.k, 9);
  });

  it("keeps the zoom in the limits", () => {
    const most = pictureKeyAction("+", view, area, { home: "all", limits: { min: 1, max: 2 } });
    expect(most).toEqual({ type: "move", to: view });
    const least = pictureKeyAction("-", { x: 10, y: 20, k: 1 }, area, { home: "all", limits: { min: 1, max: 2 } });
    expect(least).toEqual({ type: "move", to: { x: 10, y: 20, k: 1 } });
  });

  it("shows the home view for the keys Home and 0", () => {
    expect(pictureKeyAction("Home", view, area, options)).toEqual({ type: "view", view: "all" });
    expect(pictureKeyAction("0", view, area, options)).toEqual({ type: "view", view: "all" });
  });

  it("shows the view of a letter, and the case of the letter does not change it", () => {
    expect(pictureKeyAction("f", view, area, options)).toEqual({ type: "view", view: "focus" });
    expect(pictureKeyAction("F", view, area, options)).toEqual({ type: "view", view: "focus" });
  });

  it("gives no action for each other key", () => {
    expect(pictureKeyAction("g", view, area, options)).toBeUndefined();
    expect(pictureKeyAction("Enter", view, area, options)).toBeUndefined();
    expect(pictureKeyAction("Tab", view, area, options)).toBeUndefined();
    expect(pictureKeyAction("f", view, area, { home: "all" })).toBeUndefined();
    // A name of a key with more than one letter is not a key of a view.
    expect(pictureKeyAction("End", view, area, { home: "all", views: { end: "last" } })).toBeUndefined();
  });
});
