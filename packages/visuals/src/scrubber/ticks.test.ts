import { describe, expect, it } from "vitest";
import type { TimeSpan } from "../replay.ts";
import { LABEL_EDGE, TICK_BOX, labelPlaces, tickPath, tickPlaces } from "./ticks.ts";

const SPAN: TimeSpan = { from: 100, to: 300 };

describe("tickPlaces", () => {
  it("gives the place of each time, from 0 at the start to the width of the box at the end", () => {
    expect(tickPlaces(SPAN, [100, 150, 300])).toEqual([0, 250, TICK_BOX]);
  });

  it("gives the places in sequence, and one place for two times that are near", () => {
    expect(tickPlaces(SPAN, [250, 150, 150.004, 150])).toEqual([250, 750]);
  });

  it("leaves out a time that is out of the range", () => {
    expect(tickPlaces(SPAN, [99, 200, 301, Number.NaN])).toEqual([500]);
  });

  it("gives no place for a range with no length", () => {
    expect(tickPlaces({ from: 5, to: 5 }, [5])).toEqual([]);
  });
});

describe("tickPath", () => {
  it("gives one vertical line for each place", () => {
    expect(tickPath([0, 250.5], 2, 9)).toBe("M0 2V9M250.5 2V9");
    expect(tickPath([], 2, 9)).toBe("");
  });
});

describe("labelPlaces", () => {
  it("gives the part of each label, with its middle at its tick", () => {
    expect(labelPlaces(SPAN, [{ at: 200, text: "middle" }])).toEqual([{ text: "middle", part: 0.5, align: "center" }]);
  });

  it("keeps a label near an end in the axis", () => {
    const places = labelPlaces(SPAN, [
      { at: 100, text: "start" },
      { at: 100 + 200 * (LABEL_EDGE / 2), text: "near the start" },
      { at: 300, text: "end" },
    ]);
    expect(places.map((place) => place.align)).toEqual(["start", "start", "end"]);
  });

  it("leaves out a label that is out of the range, and each label of a range with no length", () => {
    expect(labelPlaces(SPAN, [{ at: 50, text: "before" }, { at: 301, text: "after" }])).toEqual([]);
    expect(labelPlaces({ from: 5, to: 5 }, [{ at: 5, text: "all" }])).toEqual([]);
  });
});
