import { describe, expect, it } from "vitest";
import { KEY_PART, KEY_TURN, KEY_ZOOM, keyAction, type KeyAction } from "./keys.ts";
import { FIELD_OF_VIEW, turnAcross, type Place } from "./view.ts";

const now: Place = { target: { x: 1, y: 2, z: 3 }, polar: 0.9, azimuth: 0.6, distance: 10 };
const options = { home: "home", views: { t: "top" } };

/** This function gives the place of a key that moves the camera. */
function placeOf(action: KeyAction | undefined): Place {
  if (action?.type !== "place") throw new Error("The key does not move the camera.");
  return action.place;
}

describe("keyAction", () => {
  it("turns the camera around the target with the arrow keys", () => {
    expect(placeOf(keyAction("ArrowLeft", now, options))).toEqual({ ...now, azimuth: 0.6 - KEY_TURN });
    expect(placeOf(keyAction("ArrowRight", now, options))).toEqual({ ...now, azimuth: 0.6 + KEY_TURN });
    expect(placeOf(keyAction("ArrowUp", now, options))).toEqual({ ...now, polar: 0.9 - KEY_TURN });
    expect(placeOf(keyAction("ArrowDown", now, options))).toEqual({ ...now, polar: 0.9 + KEY_TURN });
  });

  it("moves the camera nearer with the key + and away with the key -", () => {
    expect(placeOf(keyAction("+", now, options)).distance).toBeCloseTo(10 * KEY_ZOOM, 12);
    expect(placeOf(keyAction("=", now, options)).distance).toBeCloseTo(10 * KEY_ZOOM, 12);
    expect(placeOf(keyAction("-", now, options)).distance).toBeCloseTo(10 / KEY_ZOOM, 12);
    expect(placeOf(keyAction("_", now, options)).distance).toBeCloseTo(10 / KEY_ZOOM, 12);
  });

  it("comes back to the same distance after the key + and the key -", () => {
    const near = placeOf(keyAction("+", now, { ...options, surface: 4 }));
    expect(placeOf(keyAction("-", near, { ...options, surface: 4 })).distance).toBeCloseTo(10, 12);
  });

  it("changes the height above the surface, so the camera stays out of the ball", () => {
    const above = { ...options, surface: 9 };
    // The height above a ball of radius 9 is 1.
    expect(placeOf(keyAction("+", now, above)).distance).toBeCloseTo(9 + KEY_ZOOM, 12);
    expect(placeOf(keyAction("-", now, above)).distance).toBeCloseTo(9 + 1 / KEY_ZOOM, 12);
    let place = now;
    for (let step = 0; step < 200; step += 1) place = placeOf(keyAction("+", place, above));
    expect(place.distance).toBeGreaterThanOrEqual(9);
  });

  it("moves the surface of a ball by a part of the height of the picture, near the ball", () => {
    // At the distance 9.09 from the center of a ball of radius 9, the picture shows a small part of the ball.
    const from = { ...now, distance: 9.09 };
    const near = placeOf(keyAction("ArrowRight", from, { ...options, surface: 9 }));
    const step = near.azimuth - from.azimuth;
    expect(step).toBeCloseTo(KEY_PART * turnAcross(9.09, 9, FIELD_OF_VIEW), 12);
    expect(step).toBeLessThan(KEY_TURN / 10);
    // The height of the picture shows this angle of the ball, to 2 parts in 100. A step is the part KEY_PART of it.
    const shown = (2 * 0.09 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / 9;
    expect(step / (KEY_PART * shown)).toBeGreaterThan(0.98);
    expect(step / (KEY_PART * shown)).toBeLessThan(1.02);
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowDown"]) {
      const next = placeOf(keyAction(key, from, { ...options, surface: 9 }));
      expect(Math.abs(next.azimuth - from.azimuth) + Math.abs(next.polar - from.polar)).toBeCloseTo(step, 12);
    }
  });

  it("turns by the largest step far from a ball", () => {
    const far = placeOf(keyAction("ArrowRight", { ...now, distance: 900 }, { ...options, surface: 9 }));
    expect(far.azimuth).toBe(now.azimuth + KEY_TURN);
  });

  it("uses the angle of the picture: a wider picture shows more of the ball, so a step is larger", () => {
    const from = { ...now, distance: 9.09 };
    const step = (fieldOfView: number): number => placeOf(keyAction("ArrowRight", from, { ...options, surface: 9, fieldOfView })).azimuth - from.azimuth;
    expect(step(60)).toBeGreaterThan(step(32));
    expect(step(32)).toBe(placeOf(keyAction("ArrowRight", from, { ...options, surface: 9 })).azimuth - from.azimuth);
  });

  it("never turns by more than the largest step", () => {
    for (const distance of [8, 9, 9.0001, 9.5, 12, 40, 900]) {
      const next = placeOf(keyAction("ArrowDown", { ...now, distance }, { ...options, surface: 9 }));
      expect(next.polar - now.polar).toBeGreaterThan(0);
      expect(next.polar - now.polar).toBeLessThanOrEqual(KEY_TURN + 1e-12);
    }
  });

  it("shows the home view with the keys Home and 0", () => {
    expect(keyAction("Home", now, options)).toEqual({ type: "view", view: "home" });
    expect(keyAction("0", now, options)).toEqual({ type: "view", view: "home" });
  });

  it("shows the view of a key from the options, for a letter of each case", () => {
    expect(keyAction("t", now, options)).toEqual({ type: "view", view: "top" });
    expect(keyAction("T", now, options)).toEqual({ type: "view", view: "top" });
  });

  it("gives no action for each other key", () => {
    expect(keyAction("x", now, options)).toBeUndefined();
    expect(keyAction("Tab", now, options)).toBeUndefined();
    expect(keyAction("Enter", now, options)).toBeUndefined();
    expect(keyAction("t", now, { home: "home" })).toBeUndefined();
  });

  it("does not use a name of a key as a letter", () => {
    expect(keyAction("Tab", now, { home: "home", views: { tab: "top" } })).toBeUndefined();
  });

  it("does not change the place that it gets", () => {
    const before = structuredClone(now);
    keyAction("ArrowLeft", now, options);
    keyAction("+", now, options);
    expect(now).toEqual(before);
  });
});
