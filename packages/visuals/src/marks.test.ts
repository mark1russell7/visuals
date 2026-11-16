import { describe, expect, it } from "vitest";
import { CLICK_DISTANCE, isClick, markOf, NO_MARKS, type Marks } from "./marks.ts";

describe("markOf", () => {
  const marks: Marks = { hovered: "desk", selected: "rack", marked: new Set(["lamp", "rack"]) };

  it("gives 2 for the selected record, also when it has a different mark", () => {
    expect(markOf(marks, "rack")).toBe(2);
    expect(markOf({ ...marks, hovered: "rack" }, "rack")).toBe(2);
  });

  it("gives 1 for the record under the pointer and for each marked record", () => {
    expect(markOf(marks, "desk")).toBe(1);
    expect(markOf(marks, "lamp")).toBe(1);
  });

  it("gives 0 for each other record", () => {
    expect(markOf(marks, "door")).toBe(0);
    expect(markOf(NO_MARKS, "rack")).toBe(0);
  });
});

describe("isClick", () => {
  it("tells that a pointer that stayed in its place made a click", () => {
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 12, y: 13 })).toBe(true);
  });

  it("tells that a pointer that moved more than the limit made a drag", () => {
    expect(isClick({ x: 10, y: 10 }, { x: 10 + CLICK_DISTANCE, y: 10 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 10 + CLICK_DISTANCE + 0.5, y: 10 })).toBe(false);
    expect(isClick({ x: 10, y: 10 }, { x: 13, y: 13 })).toBe(false);
  });

  it("uses the limit that it gets", () => {
    expect(isClick({ x: 0, y: 0 }, { x: 9, y: 0 }, 10)).toBe(true);
    expect(isClick({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBe(false);
  });
});
