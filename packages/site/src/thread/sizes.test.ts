import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { chooseTopic } from "./card.ts";
import { sampleThread } from "./sample.ts";
import { isTopicLook, PART_LOOK, threadSizes, topicLook } from "./sizes.ts";

const sample = sampleThread();
const sizes = threadSizes(sample, fakeAdvance);

describe("threadSizes", () => {
  it("measures each box with no box in it", () => {
    expect(sizes.has("m01")).toBe(false);
    expect(sizes.size).toBe(19 + 10 + 4);
    expect(sizes.get("m01#0")?.kind).toBe("part");
    expect(sizes.get("e01")?.kind).toBe("entry");
  });

  it("gives each part the same width and a height for its lines", () => {
    const part = sizes.get("m01#0");
    const lines = part?.text.lineCount ?? 0;
    expect(part?.w).toBe(PART_LOOK.width);
    expect(lines).toBeGreaterThan(1);
    expect(lines).toBeLessThanOrEqual(PART_LOOK.maxLines);
    expect(part?.h).toBe(lines * PART_LOOK.lineHeight + 2 * PART_LOOK.padY);
    for (const width of part?.text.widths ?? []) expect(width).toBeLessThanOrEqual(PART_LOOK.wrapWidth);
  });

  it("gives a topic with more parts a larger text", () => {
    const large = sizes.get("trench");
    const small = sizes.get("north");
    expect(large?.count).toBe(5);
    expect(small?.count).toBe(0);
    expect(large !== undefined && isTopicLook(large.look) ? large.look.size : 0).toBe(topicLook(1).size);
    expect(small !== undefined && isTopicLook(small.look) ? small.look.size : 0).toBe(topicLook(0).size);
    expect(topicLook(1).size).toBeGreaterThan(topicLook(0).size);
  });

  it("gives each topic the same text when the topics have the same number of parts", () => {
    const equal = threadSizes({ id: "d", boxes: [{ id: "a", data: { kinds: ["topic"] } }, { id: "b", data: { kinds: ["topic"] } }] }, fakeAdvance);
    expect(equal.get("a")?.look).toEqual(equal.get("b")?.look);
  });

  it("keeps the lines and the size of a box, and counts the parts of a topic again", () => {
    const next = chooseTopic(sample, { choice: "m05#1", target: "north" });
    const kept = threadSizes(next, fakeAdvance, sizes);
    expect(kept.get("north")?.count).toBe(1);
    expect(kept.get("north")?.look).toBe(sizes.get("north")?.look);
    expect(kept.get("north")?.w).toBe(sizes.get("north")?.w);
    expect(kept.get("m01#0")?.text).toBe(sizes.get("m01#0")?.text);
  });

  it("measures a box again when its name is different", () => {
    const boxes = sample.boxes.map((box) => (box.id === "north" ? { ...box, data: { ...box.data, label: "North and east beds" } } : box));
    const next = threadSizes({ ...sample, boxes }, fakeAdvance, sizes);
    expect(next.get("north")?.label).toBe("North and east beds");
    expect(next.get("north")?.w).toBeGreaterThan(sizes.get("north")?.w ?? 0);
  });
});
