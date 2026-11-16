import { describe, expect, it } from "vitest";
import { KEY_TURN, KEY_ZOOM, keyAction, type KeyAction } from "./keys.ts";
import type { Place } from "./view.ts";

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

  it("turns in smaller steps near the surface", () => {
    // At the distance 10 from the center of a ball of radius 9, the height is the part 0.1 of the distance.
    const near = placeOf(keyAction("ArrowRight", now, { ...options, surface: 9 }));
    expect(near.azimuth - now.azimuth).toBeCloseTo(KEY_TURN * 0.1, 12);
    const far = placeOf(keyAction("ArrowRight", { ...now, distance: 900 }, { ...options, surface: 9 }));
    expect(far.azimuth - now.azimuth).toBeCloseTo(KEY_TURN * 0.99, 12);
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
