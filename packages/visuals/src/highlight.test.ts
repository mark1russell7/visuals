import { describe, expect, it } from "vitest";
import { CLICK_DISTANCE, isClick, highlightOf, NO_HIGHLIGHTS, type Highlights } from "./highlight.ts";

describe("highlightOf", () => {
  const highlights: Highlights = { hovered: "desk", selected: "rack", highlighted: new Set(["lamp", "rack"]) };

  it("gives 2 for the selected record, also when it has a different highlight", () => {
    expect(highlightOf(highlights, "rack")).toBe(2);
    expect(highlightOf({ ...highlights, hovered: "rack" }, "rack")).toBe(2);
  });

  it("gives 1 for the record under the pointer and for each highlighted record", () => {
    expect(highlightOf(highlights, "desk")).toBe(1);
    expect(highlightOf(highlights, "lamp")).toBe(1);
  });

  it("gives 0 for each other record", () => {
    expect(highlightOf(highlights, "door")).toBe(0);
    expect(highlightOf(NO_HIGHLIGHTS, "rack")).toBe(0);
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
