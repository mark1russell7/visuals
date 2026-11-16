import { countOverlaps, type LayoutBox } from "@mark1russell7/layout-contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LABEL_GAP, LABEL_SIDES, labelBox, placeLabels, type LabelAnchor, type LabelFrame, type LabelPlace, type LabelSide } from "./place.ts";

const FRAME: LabelFrame = { width: 400, height: 300 };

/** This function makes a label with a text of 60 by 16 pixels. */
const label = (x: number, y: number, more: Partial<LabelAnchor> = {}): LabelAnchor => ({ x, y, width: 60, height: 16, ...more });

/** This function gives the boxes of the placed texts as the records of the layout contract, so `countOverlaps` examines them. */
const boxes = (places: readonly (LabelPlace | undefined)[]): LayoutBox[] =>
  places.flatMap((place, index) => (place === undefined ? [] : [{ id: String(index), w: place.box.w, h: place.box.h, x: place.box.x, y: place.box.y }]));

describe("labelBox", () => {
  it("puts the text on each side of the mark, at the gap from it", () => {
    const one = label(100, 100, { clear: 5 });
    expect(labelBox(one, "right", 4)).toEqual({ x: 109, y: 92, w: 60, h: 16 });
    expect(labelBox(one, "left", 4)).toEqual({ x: 31, y: 92, w: 60, h: 16 });
    expect(labelBox(one, "above", 4)).toEqual({ x: 70, y: 75, w: 60, h: 16 });
    expect(labelBox(one, "below", 4)).toEqual({ x: 70, y: 109, w: 60, h: 16 });
  });

  it("puts the middle of the text on the anchor for the side center", () => {
    expect(labelBox(label(100, 100, { clear: 5 }), "center")).toEqual({ x: 70, y: 92, w: 60, h: 16 });
  });

  it("uses the default gap", () => {
    expect(labelBox(label(100, 100), "right").x).toBe(100 + LABEL_GAP);
  });
});

describe("placeLabels", () => {
  it("gives a lone label its first side", () => {
    expect(placeLabels([label(100, 100, { clear: 5 })], FRAME)).toEqual([{ side: "right", box: { x: 109, y: 92, w: 60, h: 16 } }]);
    expect(placeLabels([label(100, 100, { sides: ["below", "right"] })], FRAME)[0]?.side).toBe("below");
  });

  it("gives no label for an empty list", () => {
    expect(placeLabels([], FRAME)).toEqual([]);
  });

  it("tries the next side at an edge of the picture", () => {
    // The text does not fit on the right of an anchor near the right edge.
    expect(placeLabels([label(380, 100)], FRAME)[0]?.side).toBe("left");
    // Near the top right corner, the text fits on the left. In the corner, it fits on no side.
    expect(placeLabels([label(390, 10)], FRAME)[0]?.side).toBe("left");
    expect(placeLabels([label(390, 4)], FRAME)[0]).toBeUndefined();
    // In a picture as wide as the text, only the sides above and below fit.
    expect(placeLabels([label(30, 4)], { width: 60, height: 300 })[0]?.side).toBe("below");
    expect(placeLabels([label(30, 296)], { width: 60, height: 300 })[0]?.side).toBe("above");
  });

  it("keeps the space of the edge", () => {
    const at = label(330, 100);
    expect(placeLabels([at], FRAME)[0]?.side).toBe("right");
    expect(placeLabels([at], { ...FRAME, edge: 10 })[0]?.side).toBe("left");
  });

  it("moves the second of two labels that have one place", () => {
    const places = placeLabels([label(100, 100), label(100, 100)], FRAME);
    expect(places.map((place) => place?.side)).toEqual(["right", "left"]);
  });

  it("removes a label with no free side, and keeps the first label", () => {
    // With a mark of 10 pixels, the four texts around one anchor do not touch.
    const five = [0, 1, 2, 3, 4].map(() => label(100, 100, { clear: 10 }));
    const places = placeLabels(five, FRAME);
    expect(places.map((place) => place?.side)).toEqual([...LABEL_SIDES, undefined]);
    // With no mark, the text above is on the texts of the two sides.
    const plain = [0, 1, 2].map(() => label(100, 100));
    expect(placeLabels(plain, FRAME).map((place) => place?.side)).toEqual(["right", "left", undefined]);
  });

  it("keeps a text off the mark of each other label", () => {
    // The text of the first label does not fit on the right: the dot of the second label is there.
    const places = placeLabels([label(100, 100, { clear: 5 }), label(140, 100, { clear: 5 })], FRAME);
    expect(places[0]?.side).toBe("left");
    expect(places[1]?.side).toBe("right");
  });

  it("keeps the texts away from the mark of a label that has no place", () => {
    // The second label has an anchor out of the picture, and its mark comes into the picture.
    const places = placeLabels([label(330, 100), label(410, 100, { clear: 30 })], FRAME);
    expect(places[1]).toBeUndefined();
    expect(places[0]?.side).toBe("left");
  });

  it("removes a label with an anchor out of the picture, with a text of no size, or with a number that is not finite", () => {
    const not = [label(-1, 100), label(100, 301), label(100, 100, { width: 0 }), label(100, 100, { height: 0 }), label(Number.NaN, 100), label(100, 100, { width: Number.POSITIVE_INFINITY })];
    expect(placeLabels(not, FRAME)).toEqual(not.map(() => undefined));
  });

  it("lets the text of an area be on its anchor", () => {
    const places = placeLabels([label(200, 150, { sides: ["center"] })], FRAME);
    expect(places).toEqual([{ side: "center", box: { x: 170, y: 142, w: 60, h: 16 } }]);
  });
});

const anySides: fc.Arbitrary<readonly LabelSide[] | undefined> = fc.option(fc.subarray(["right", "left", "above", "below", "center"] as const, { minLength: 1 }), { nil: undefined });
/** A text has no size, or a size of one pixel or more. A rectangle with a side near the smallest number has no inside for the overlap rule. */
const anySize = (max: number): fc.Arbitrary<number> => fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 9, arbitrary: fc.double({ min: 1, max, noNaN: true }) });
const anyLabel: fc.Arbitrary<LabelAnchor> = fc.record({
  x: fc.double({ min: -20, max: 420, noNaN: true }),
  y: fc.double({ min: -20, max: 320, noNaN: true }),
  width: anySize(120),
  height: anySize(30),
  clear: fc.option(fc.double({ min: 0, max: 12, noNaN: true }), { nil: undefined }),
  sides: anySides,
});
const anyFrame: fc.Arbitrary<LabelFrame> = fc.record({
  width: fc.constant(400),
  height: fc.constant(300),
  gap: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: undefined }),
  edge: fc.option(fc.double({ min: 0, max: 12, noNaN: true }), { nil: undefined }),
});

describe("the properties of placeLabels", () => {
  it("gives one value for each label, and each placed text is in the picture, on one of its sides", () => {
    fc.assert(
      fc.property(fc.array(anyLabel, { maxLength: 24 }), anyFrame, (labels, frame) => {
        const places = placeLabels(labels, frame);
        expect(places).toHaveLength(labels.length);
        const edge = frame.edge ?? 0;
        places.forEach((place, index) => {
          const one = labels[index];
          if (place === undefined || one === undefined) return;
          expect(one.sides ?? LABEL_SIDES).toContain(place.side);
          expect(place.box).toEqual(labelBox(one, place.side, frame.gap));
          expect(place.box.x).toBeGreaterThanOrEqual(edge);
          expect(place.box.y).toBeGreaterThanOrEqual(edge);
          expect(place.box.x + place.box.w).toBeLessThanOrEqual(frame.width - edge);
          expect(place.box.y + place.box.h).toBeLessThanOrEqual(frame.height - edge);
        });
      }),
    );
  });

  it("puts no text on a different text", () => {
    fc.assert(
      fc.property(fc.array(anyLabel, { maxLength: 24 }), anyFrame, (labels, frame) => {
        // The count of the layout contract is a second opinion on the overlap rule.
        expect(countOverlaps(boxes(placeLabels(labels, frame)), 0)).toBe(0);
      }),
    );
  });

  it("puts no text on the mark of a different label", () => {
    fc.assert(
      fc.property(fc.array(anyLabel, { maxLength: 24 }), anyFrame, (labels, frame) => {
        const places = placeLabels(labels, frame);
        places.forEach((place, index) => {
          if (place === undefined) return;
          labels.forEach((other, at) => {
            const clear = other.clear ?? 0;
            if (at === index || !(clear > 0)) return;
            const apartX = Math.max(place.box.x - (other.x + clear), other.x - clear - (place.box.x + place.box.w));
            const apartY = Math.max(place.box.y - (other.y + clear), other.y - clear - (place.box.y + place.box.h));
            // The two sums of the test and of the function round in different sequences.
            expect(Math.max(apartX, apartY)).toBeGreaterThanOrEqual(-1e-9);
          });
        });
      }),
    );
  });

  it("gives a label the same place with and without the labels after it, when no label has a mark", () => {
    const plain = anyLabel.map((one) => ({ ...one, clear: undefined }));
    fc.assert(
      fc.property(fc.array(plain, { minLength: 1, maxLength: 24 }), fc.nat(), anyFrame, (labels, cut, frame) => {
        const count = cut % (labels.length + 1);
        expect(placeLabels(labels.slice(0, count), frame)).toEqual(placeLabels(labels, frame).slice(0, count));
      }),
    );
  });

  it("places a label when it is alone and one of its sides is in the picture", () => {
    fc.assert(
      fc.property(anyLabel, anyFrame, (one, frame) => {
        const edge = frame.edge ?? 0;
        const fits = (one.sides ?? LABEL_SIDES).some((side) => {
          const box = labelBox(one, side, frame.gap);
          return box.x >= edge && box.y >= edge && box.x + box.w <= frame.width - edge && box.y + box.h <= frame.height - edge;
        });
        const inside = one.x >= 0 && one.x <= frame.width && one.y >= 0 && one.y <= frame.height && one.width > 0 && one.height > 0;
        expect(placeLabels([one], frame)[0] !== undefined).toBe(fits && inside);
      }),
    );
  });
});
