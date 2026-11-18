import type { Rect } from "@mark1russell7/layout-contract";
import { MAX_THETA } from "ireko/strategies/force";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import type { ThreadDocument } from "./document.ts";
import { ASPECT_RANGE, entryRow, EXACT_MOST, FAR_THETA, farTheta, firstScale, KEEP_SHARE, keepsPlaces, mostLayouts, placeThread, sizedBoxes, THREAD_FORCE } from "./place.ts";
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

  const many: ThreadDocument = { id: "many", boxes: Array.from({ length: 170 }, (_, at) => ({ id: `entry-${String(at).padStart(3, "0")}`, data: { kinds: ["entry", "ask"], text: `The entry ${String(at)} of a test` } })), edges: [] };
  const manySizes = threadSizes(many, fakeAdvance);

  it("reads each pair of boxes in a small picture, and groups the far boxes in a picture of many cards", () => {
    expect([0, 1, 100, EXACT_MOST].map(farTheta)).toEqual([0, 0, 0, 0]);
    expect([EXACT_MOST + 1, 800, 5000].map(farTheta)).toEqual([FAR_THETA, FAR_THETA, FAR_THETA]);
    expect(FAR_THETA).toBeGreaterThan(0);
    expect(FAR_THETA).toBeLessThanOrEqual(MAX_THETA);
  });

  it("gives a picture of many cards other places than a test of each pair, and the option force replaces theta", () => {
    const far = placeThread(many, manySizes);
    const exact = placeThread(many, manySizes, { force: { theta: 0 } });
    expect(far.size).toBe(170);
    expect([...far]).not.toEqual([...exact]);
    expect([...placeThread(many, manySizes, { force: { theta: FAR_THETA } })]).toEqual([...far]);
    // The sample is a small picture, so the option changes nothing there.
    expect([...placeThread(sample, sizes, { force: { theta: 0 } })]).toEqual([...places]);
  });

  it("gives a picture of many cards a wider shape for a wide area, with no card on a different one", () => {
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

describe("placeThread after a change of the document", () => {
  /** This function gives the places of the cards and the topics of a document: the boxes that are in no box. */
  const topOf = (document: ThreadDocument, result: ReadonlyMap<string, Rect>): Map<string, Rect> => {
    const out = new Map<string, Rect>();
    for (const box of document.boxes) {
      const place = result.get(box.id);
      if (box.parent === undefined && place !== undefined) out.set(box.id, place);
    }
    return out;
  };
  /** This function gives the pairs of cards and topics of a result that have an area in common. */
  const hitsOf = (document: ThreadDocument, result: ReadonlyMap<string, Rect>): string[] => {
    const top = [...topOf(document, result)];
    return top.flatMap(([a, at], i) => top.slice(i + 1).flatMap(([b, other]) => (overlap(at, other) ? [`${a} on ${b}`] : [])));
  };
  const before = topOf(sample, places);
  /** The sample with one more entry: a reply to the entry `e04`, with the topic of that entry. */
  const reply: ThreadDocument = {
    ...sample,
    boxes: [...sample.boxes, { id: "e99", data: { kinds: ["entry", "comment"], text: "The gravel comes on Friday.", at: "2026-09-03T12:00:00Z" } }],
    edges: [
      ...(sample.edges ?? []),
      { id: "reply:e04:e99", source: "e04", target: "e99", data: { kind: "reply" } },
      { id: "touches:e99:trench", source: "e99", target: "trench", data: { kind: "touches", choice: "e99", state: "chosen", by: "sorter" } },
    ],
  };
  const replySizes = threadSizes(reply, fakeAdvance);
  const after = placeThread(reply, replySizes, { before });

  /** This function gives the boxes of `places` that have a different top left corner in a result. */
  const movedIn = (result: ReadonlyMap<string, Rect>): string[] => [...places].flatMap(([id, place]) => (result.get(id)?.x === place.x && result.get(id)?.y === place.y ? [] : [id]));

  it("moves no box of before when one entry is new", () => {
    expect(after.size).toBe(reply.boxes.length);
    expect(movedIn(after)).toEqual([]);
    // The new entry changes the count of its topic, so the sizes of some topics are different. A message has the same parts, so its card is the same.
    expect(after.get("m01")).toEqual(places.get("m01"));
    expect(after.get("m01#0")).toEqual(places.get("m01#0"));
    expect(hitsOf(reply, after)).toEqual([]);
  });

  it("puts the new entry in the first free place below the entry of its reply, when no side of that entry is free", () => {
    // The cards of the sample are the gap apart near the entry `e04`, so no side of it has room for a card.
    const entry = after.get("e99");
    const parent = after.get("e04");
    if (entry === undefined || parent === undefined) throw new Error("no entry");
    const bottom = Math.max(...[...before.values()].map((place) => place.y + place.h));
    expect(entry.y).toBeGreaterThan(parent.y + parent.h);
    expect(entry.y).toBeLessThanOrEqual(bottom + THREAD_FORCE.gap);
    expect(Math.abs(entry.x + entry.w / 2 - parent.x - parent.w / 2)).toBeLessThan(parent.w);
    expect(hitsOf(reply, after)).toEqual([]);
  });

  it("puts a new entry at the gap below the entry of its reply, when that side is free", () => {
    const entry = (id: string, text: string) => ({ id, data: { kinds: ["entry", "comment"], label: text, text } });
    const two: ThreadDocument = { id: "two", boxes: [entry("a", "Bed 6."), entry("b", "Bed 2.")], edges: [] };
    const size = placeThread(two, threadSizes(two, fakeAdvance)).get("a");
    if (size === undefined) throw new Error("no card");
    const apart = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: size.w, h: size.h }],
      ["b", { x: 1000, y: 0, w: size.w, h: size.h }],
    ]);
    const three: ThreadDocument = { ...two, boxes: [...two.boxes, entry("n", "Bed 4.")], edges: [{ id: "reply:a:n", source: "a", target: "n", data: { kind: "reply" } }] };
    const result = placeThread(three, threadSizes(three, fakeAdvance), { before: apart });
    expect(result.get("a")).toEqual(apart.get("a"));
    expect(result.get("b")).toEqual(apart.get("b"));
    expect(result.get("n")).toEqual({ x: 0, y: size.h + THREAD_FORCE.gap, w: size.w, h: size.h });
  });

  it("gives the same places for the same change", () => {
    expect([...placeThread(reply, replySizes, { before })]).toEqual([...after]);
  });

  it("moves no box when a box goes away", () => {
    const back = placeThread(sample, sizes, { before: topOf(reply, after) });
    expect([...back]).toEqual([...places]);
  });

  it("gives a place to a new box with no spring, and moves no box of before", () => {
    const alone: ThreadDocument = { ...sample, boxes: [...sample.boxes, { id: "bees", data: { kinds: ["topic"], label: "Bees" } }] };
    const result = placeThread(alone, threadSizes(alone, fakeAdvance), { before });
    expect(result.has("bees")).toBe(true);
    expect(movedIn(result)).toEqual([]);
    expect(hitsOf(alone, result)).toEqual([]);
  });

  it("keeps the corner of a box that has a different size", () => {
    const shorter: ThreadDocument = { ...sample, boxes: sample.boxes.map((box) => (box.id === "e03" ? { ...box, data: { ...box.data, label: "Bed 6.", text: "Bed 6." } } : box)) };
    const result = placeThread(shorter, threadSizes(shorter, fakeAdvance), { before });
    expect(result.get("e03")?.h).toBeLessThan(places.get("e03")?.h ?? 0);
    expect(movedIn(result)).toEqual([]);
    expect(hitsOf(shorter, result)).toEqual([]);
  });

  it("moves a box that is on a different box after a change of its size, and no other box", () => {
    const entry = (id: string, text: string) => ({ id, data: { kinds: ["entry", "comment"], label: text, text } });
    const short: ThreadDocument = { id: "three", boxes: [entry("a", "Bed 6."), entry("b", "Bed 2."), entry("c", "Bed 4.")], edges: [] };
    const long: ThreadDocument = { ...short, boxes: [entry("a", "The tomatoes move to bed 6 this week, and the beans go to bed 2."), entry("b", "Bed 2."), entry("c", "Bed 4.")] };
    const shortSizes = threadSizes(short, fakeAdvance);
    const cards = placeThread(short, shortSizes);
    const size = cards.get("a");
    if (size === undefined) throw new Error("no card");
    // The card `b` is 10 below the card `a`, so a higher card `a` is on it.
    const stack = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: size.w, h: size.h }],
      ["b", { x: 0, y: size.h + 10, w: size.w, h: size.h }],
      ["c", { x: size.w + 100, y: 0, w: size.w, h: size.h }],
    ]);
    const result = placeThread(long, threadSizes(long, fakeAdvance), { before: stack });
    expect(result.get("a")?.h).toBeGreaterThan(size.h + 10);
    expect(result.get("b")).toEqual(stack.get("b"));
    expect(result.get("c")).toEqual(stack.get("c"));
    expect(hitsOf(long, result)).toEqual([]);
  });

  it("gives each box a new place after a large change", () => {
    const few: ThreadDocument = { ...sample, boxes: sample.boxes.filter((box) => box.parent === undefined).slice(0, 4), edges: [] };
    const fewSizes = threadSizes(few, fakeAdvance);
    expect(few.boxes.length).toBeLessThan(KEEP_SHARE * before.size);
    expect([...placeThread(few, fewSizes, { before })]).toEqual([...placeThread(few, fewSizes)]);
  });

  it("tells that a change is small when the kept boxes are half of the boxes before and after, or more", () => {
    expect(keepsPlaces(294, 294, 295)).toBe(true);
    expect(keepsPlaces(20, 40, 20)).toBe(true);
    expect(keepsPlaces(20, 20, 40)).toBe(true);
    expect(keepsPlaces(19, 40, 19)).toBe(false);
    expect(keepsPlaces(40, 40, 300)).toBe(false);
    expect(keepsPlaces(40, 300, 40)).toBe(false);
    expect(keepsPlaces(0, 0, 0)).toBe(false);
  });
});

describe("sizedBoxes", () => {
  it("gives each box its measured size, and 0 for a box with no measure", () => {
    const boxes = sizedBoxes(sample, sizes);
    expect(boxes.find((box) => box.id === "m01#0")).toMatchObject({ w: sizes.get("m01#0")?.w, h: sizes.get("m01#0")?.h });
    expect(boxes.find((box) => box.id === "m01")).toMatchObject({ w: 0, h: 0 });
  });
});
