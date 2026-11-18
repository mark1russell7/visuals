import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { approach, easeInOut, lessMotion, moveAt, partAt, type Move } from "./motion.ts";
import type { Place } from "./view.ts";

const anyPart = fc.double({ min: 0, max: 1, noNaN: true });
const target = { x: 0, y: 0, z: 0 };
const from: Place = { target, polar: 0.4, azimuth: 0, distance: 10 };
const to: Place = { target: { x: 2, y: 0, z: 4 }, polar: 1, azimuth: 1, distance: 40 };

describe("lessMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false in a program with no browser", () => {
    expect(lessMotion()).toBe(false);
  });

  it("gives the answer of the browser", () => {
    const asked: string[] = [];
    vi.stubGlobal("matchMedia", (query: string) => {
      asked.push(query);
      return { matches: true };
    });
    expect(lessMotion()).toBe(true);
    expect(asked).toEqual(["(prefers-reduced-motion: reduce)"]);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(lessMotion()).toBe(false);
  });
});

describe("easeInOut", () => {
  it("starts at 0, is 0.5 at the middle and ends at 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
  });

  it("stays at its ends out of the range", () => {
    expect(easeInOut(-3)).toBe(0);
    expect(easeInOut(7)).toBe(1);
  });

  it("starts slowly and ends slowly", () => {
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  it("does not go back, and its second half is the mirror of its first half", () => {
    fc.assert(
      fc.property(anyPart, anyPart, (first, second) => {
        const early = Math.min(first, second);
        const late = Math.max(first, second);
        expect(easeInOut(early)).toBeLessThanOrEqual(easeInOut(late));
        expect(easeInOut(1 - first)).toBeCloseTo(1 - easeInOut(first), 12);
      }),
    );
  });
});

describe("partAt", () => {
  it("goes from 0 at the start of a move to 1 at its end", () => {
    expect(partAt(1000, 400, 1000)).toBe(0);
    expect(partAt(1000, 400, 1100)).toBe(0.25);
    expect(partAt(1000, 400, 1400)).toBe(1);
  });

  it("stays at its ends before the start and after the end", () => {
    expect(partAt(1000, 400, 0)).toBe(0);
    expect(partAt(1000, 400, 99_999)).toBe(1);
  });

  it("is 1 for a move with no duration", () => {
    expect(partAt(1000, 0, 0)).toBe(1);
    expect(partAt(1000, -5, 1000)).toBe(1);
    expect(partAt(1000, Number.NaN, 1000)).toBe(1);
  });
});

describe("moveAt", () => {
  const move: Move = { from, to, start: 1000, duration: 400 };

  it("gives the first place at the start and before it", () => {
    expect(moveAt(move, 1000)).toEqual({ place: expect.objectContaining({ distance: expect.closeTo(10, 9), polar: expect.closeTo(0.4, 9) }), done: false });
    expect(moveAt(move, 0).place.distance).toBeCloseTo(10, 9);
    expect(moveAt(move, 0).done).toBe(false);
  });

  it("gives the second place at the end and after it, and tells that the move is done", () => {
    expect(moveAt(move, 1400)).toEqual({ place: to, done: true });
    expect(moveAt(move, 99_999)).toEqual({ place: to, done: true });
  });

  it("is at the middle of the way at the middle of the time", () => {
    const { place, done } = moveAt(move, 1200);
    expect(done).toBe(false);
    expect(place.polar).toBeCloseTo(0.7, 9);
    expect(place.azimuth).toBeCloseTo(0.5, 9);
    expect(place.target).toEqual({ x: expect.closeTo(1, 9), y: expect.closeTo(0, 9), z: expect.closeTo(2, 9) });
    // The middle of the distances 10 and 40 by a constant factor is 20.
    expect(place.distance).toBeCloseTo(20, 9);
  });

  it("uses the height above the surface for the distance", () => {
    // The heights above a ball of radius 8 are 2 and 32. Their middle by a constant factor is 8.
    expect(moveAt(move, 1200, 8).place.distance).toBeCloseTo(16, 9);
  });

  it("is at its end immediately when it has no duration", () => {
    expect(moveAt({ from, to, start: 1000, duration: 0 }, 0)).toEqual({ place: to, done: true });
    expect(moveAt({ from, to, start: 1000, duration: -5 }, 1000)).toEqual({ place: to, done: true });
    expect(moveAt({ from, to, start: 1000, duration: Number.NaN }, 1000)).toEqual({ place: to, done: true });
  });
});

describe("approach", () => {
  it("gives the goal for a step with no time", () => {
    expect(approach(3, 9, 0, 0.1)).toBe(9);
    expect(approach(3, 9, 0.016, 0)).toBe(9);
    expect(approach(3, 9, Number.NaN, 0.1)).toBe(9);
  });

  it("goes a constant part of the way that remains", () => {
    // A step of the time `time` goes the part 1 - 1/e of the way.
    expect(approach(0, 1, 0.11, 0.11, 0)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(approach(10, 0, 0.11, 0.11, 0)).toBeCloseTo(10 * Math.exp(-1), 12);
  });

  it("gives the same value for two short steps as for one long step", () => {
    const once = approach(0, 1, 0.2, 0.11, 0);
    const twice = approach(approach(0, 1, 0.1, 0.11, 0), 1, 0.1, 0.11, 0);
    expect(twice).toBeCloseTo(once, 12);
  });

  it("becomes the goal when it is nearer than the snap distance", () => {
    expect(approach(0.995, 1, 0.016, 0.11)).toBe(1);
    expect(approach(0.5, 1, 0.016, 0.11)).not.toBe(1);
    expect(approach(0, 100, 0.016, 0.11, 99)).toBe(100);
  });

  it("stays between the value and the goal, and arrives after some steps", () => {
    fc.assert(
      fc.property(fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: 0.001, max: 0.1, noNaN: true }), (value, goal, seconds) => {
        const next = approach(value, goal, seconds, 0.11);
        expect(next).toBeGreaterThanOrEqual(Math.min(value, goal));
        expect(next).toBeLessThanOrEqual(Math.max(value, goal));
        let now = value;
        for (let step = 0; step < 2000 && now !== goal; step += 1) now = approach(now, goal, seconds, 0.11);
        expect(now).toBe(goal);
      }),
    );
  });
});
