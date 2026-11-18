import type { Rect } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import type { ThreadDocument } from "./document.ts";
import { ASPECT_RANGE, entryRow, firstScale, mostLayouts, placeThread, sizedBoxes } from "./place.ts";
import { sampleThread } from "./sample.ts";
import { MESSAGE_LOOK, threadSizes } from "./sizes.ts";

const sample = sampleThread();
const sizes = threadSizes(sample, fakeAdvance);
const places = placeThread(sample, sizes);

/** This function tells if a rectangle is in a different rectangle, with a tolerance for the sums of floats. */
const inside = (inner: Rect, outer: Rect): boolean => inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 && inner.x + inner.w <= outer.x + outer.w + 1e-6 && inner.y + inner.h <= outer.y + outer.h + 1e-6;

/** This function tells if two rectangles have an area in common. */
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe("placeThread", () => {
  it("places each box of the document", () => {
    expect(places.size).toBe(sample.boxes.length);
    for (const place of places.values()) expect([place.x, place.y, place.w, place.h].every(Number.isFinite)).toBe(true);
  });

  it("puts each part in the card of its message, below the header", () => {
    for (const box of sample.boxes) {
      if (box.parent === undefined) continue;
      const part = places.get(box.id);
      const card = places.get(box.parent);
      expect(part !== undefined && card !== undefined && inside(part, card)).toBe(true);
      expect((part?.y ?? 0) - (card?.y ?? 0)).toBeGreaterThanOrEqual(MESSAGE_LOOK.header - 1e-6);
      expect(part?.w).toBe(sizes.get(box.id)?.w);
      expect(part?.h).toBe(sizes.get(box.id)?.h);
    }
  });

  it("gives an entry a card with a header above its text", () => {
    const card = places.get("e01");
    const size = sizes.get("e01");
    if (card === undefined || size === undefined) throw new Error("no entry");
    const row = entryRow(card, size);
    expect(inside(row, card)).toBe(true);
    expect(row.y - card.y).toBeGreaterThanOrEqual(MESSAGE_LOOK.header - 1e-6);
  });

  it("puts no card and no topic on a different one", () => {
    const top = sample.boxes.filter((box) => box.parent === undefined).map((box) => ({ id: box.id, place: places.get(box.id) }));
    const hits: string[] = [];
    top.forEach((a, i) => {
      for (const b of top.slice(i + 1)) if (a.place !== undefined && b.place !== undefined && overlap(a.place, b.place)) hits.push(`${a.id} on ${b.id}`);
    });
    expect(hits).toEqual([]);
  });

  it("gives the same places for the same document", () => {
    expect([...placeThread(sample, sizes)]).toEqual([...places]);
  });

  it("moves the boxes when the springs are different", () => {
    expect([...placeThread({ ...sample, edges: [] }, sizes)]).not.toEqual([...places]);
  });

  it("gives no place for a document with no box", () => {
    expect(placeThread({ id: "empty", boxes: [] }, new Map()).size).toBe(0);
  });
});

describe("placeThread with a shape", () => {
  const top = sample.boxes.filter((box) => box.parent === undefined);

  /** This function gives the width of the cards and the topics of a result divided by their height. */
  const shapeOf = (result: ReadonlyMap<string, Rect>): number => {
    const rects = top.flatMap((box) => result.get(box.id) ?? []);
    const width = Math.max(...rects.map((rect) => rect.x + rect.w)) - Math.min(...rects.map((rect) => rect.x));
    const height = Math.max(...rects.map((rect) => rect.y + rect.h)) - Math.min(...rects.map((rect) => rect.y));
    return width / height;
  };

  const wide = placeThread(sample, sizes, { aspect: 2 });
  const tall = placeThread(sample, sizes, { aspect: 0.5 });

  it("makes a wide picture for a wide area and a tall picture for a tall area", () => {
    expect(shapeOf(wide)).toBeGreaterThan(1.4);
    expect(shapeOf(tall)).toBeLessThan(0.75);
    expect(shapeOf(wide)).toBeGreaterThan(shapeOf(places));
    expect(shapeOf(tall)).toBeLessThan(shapeOf(places));
  });

  it("keeps the size of each box, each part in its card, and no card on a different one", () => {
    for (const result of [wide, tall]) {
      expect(result.size).toBe(sample.boxes.length);
      const hits: string[] = [];
      top.forEach((a, i) => {
        for (const b of top.slice(i + 1)) if (overlap(result.get(a.id) ?? { x: 0, y: 0, w: 0, h: 0 }, result.get(b.id) ?? { x: 0, y: 0, w: 0, h: 0 })) hits.push(`${a.id} on ${b.id}`);
      });
      expect(hits).toEqual([]);
      for (const box of sample.boxes) {
        const place = result.get(box.id);
        expect([place?.w, place?.h]).toEqual([places.get(box.id)?.w, places.get(box.id)?.h]);
        if (box.parent === undefined) continue;
        const card = result.get(box.parent);
        expect(place !== undefined && card !== undefined && inside(place, card)).toBe(true);
      }
    }
  });

  it("gives the same places for the same shape, and uses the nearest limit for a shape out of the range", () => {
    expect([...placeThread(sample, sizes, { aspect: 2 })]).toEqual([...wide]);
    expect([...placeThread(sample, sizes, { aspect: 100 })]).toEqual([...placeThread(sample, sizes, { aspect: ASPECT_RANGE.most })]);
    expect([...placeThread(sample, sizes, { aspect: Number.NaN })]).toEqual([...places]);
  });
});

describe("the search of placeThread", () => {
  it("starts at the scale 1 for a tall area or no shape, and at a larger scale for a wide area", () => {
    expect(firstScale(undefined)).toBe(1);
    expect(firstScale(Number.NaN)).toBe(1);
    expect(firstScale(0.4)).toBe(1);
    expect(firstScale(0.6)).toBe(1);
    expect(firstScale(1.2)).toBeCloseTo(2, 9);
    expect(firstScale(1.9)).toBe(3);
    expect(firstScale(100)).toBe(3);
  });

  it("gives each layout to a small picture and one layout to a picture of many cards", () => {
    expect([0, 1, 71, 100].map(mostLayouts)).toEqual([5, 5, 5, 5]);
    expect([101, 112, 130, 158].map(mostLayouts)).toEqual([4, 3, 2, 2]);
    expect([159, 300, 5000].map(mostLayouts)).toEqual([1, 1, 1]);
  });

  it("gives a picture of many cards a wider shape for a wide area, with no card on a different one", () => {
    const many: ThreadDocument = { id: "many", boxes: Array.from({ length: 170 }, (_, at) => ({ id: `entry-${String(at).padStart(3, "0")}`, data: { kinds: ["entry", "ask"], text: `The entry ${String(at)} of a test` } })), edges: [] };
    const manySizes = threadSizes(many, fakeAdvance);
    const shapeOf = (result: ReadonlyMap<string, Rect>): number => {
      const rects = [...result.values()];
      const width = Math.max(...rects.map((rect) => rect.x + rect.w)) - Math.min(...rects.map((rect) => rect.x));
      const height = Math.max(...rects.map((rect) => rect.y + rect.h)) - Math.min(...rects.map((rect) => rect.y));
      return width / height;
    };
    const free = placeThread(many, manySizes);
    const wide = placeThread(many, manySizes, { aspect: 1.9 });
    expect(wide.size).toBe(170);
    expect(shapeOf(wide)).toBeGreaterThan(shapeOf(free));
    const rects = [...wide.values()];
    expect(rects.flatMap((a, i) => rects.slice(i + 1).filter((b) => overlap(a, b))).length).toBe(0);
  });
});

describe("sizedBoxes", () => {
  it("gives each box its measured size, and 0 for a box with no measure", () => {
    const boxes = sizedBoxes(sample, sizes);
    expect(boxes.find((box) => box.id === "m01#0")).toMatchObject({ w: sizes.get("m01#0")?.w, h: sizes.get("m01#0")?.h });
    expect(boxes.find((box) => box.id === "m01")).toMatchObject({ w: 0, h: 0 });
  });
});
