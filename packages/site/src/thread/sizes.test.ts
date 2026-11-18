import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { chooseTopic } from "./card.ts";
import { sampleThread } from "./sample.ts";
import { panelBox, panelId, withPanels } from "./panel.test-util.ts";
import { isTopicLook, PANEL_LOOK, PART_LOOK, threadSizes, topicLook } from "./sizes.ts";

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

describe("the size of a panel", () => {
  const id = panelId("e01");
  const document = withPanels(sample, "e01");

  it("gives a panel the default width and height, and its name on one line", () => {
    const size = threadSizes(document, fakeAdvance).get(id);
    expect(size).toMatchObject({ kind: "panel", label: "Answer", w: PANEL_LOOK.width, h: PANEL_LOOK.height, count: 0 });
    expect(size?.text.lines).toEqual(["Answer"]);
    expect(threadSizes(document, fakeAdvance).size).toBe(sizes.size + 1);
  });

  it("takes the width and the height of the box of a panel, and the measured height of its content first", () => {
    const sized = { ...sample, boxes: [...sample.boxes, { ...panelBox("e01"), w: 400.2, h: 90 }] };
    expect(threadSizes(sized, fakeAdvance).get(id)).toMatchObject({ w: 401, h: 90 });
    expect(threadSizes(sized, fakeAdvance, undefined, new Map([[id, 212.4]])).get(id)).toMatchObject({ w: 401, h: 213 });
    expect(threadSizes(document, fakeAdvance, undefined, new Map([[id, 212.4]])).get(id)?.h).toBe(213);
    // A height of a different panel, and a height that is not a length, change no size.
    expect(threadSizes(document, fakeAdvance, undefined, new Map([[panelId("e02"), 300]])).get(id)?.h).toBe(PANEL_LOOK.height);
    expect(threadSizes(document, fakeAdvance, undefined, new Map([[id, Number.NaN]])).get(id)?.h).toBe(PANEL_LOOK.height);
    expect(threadSizes(document, fakeAdvance, undefined, new Map([[id, 0]])).get(id)?.h).toBe(PANEL_LOOK.height);
  });

  it("keeps a panel at the smallest size or more", () => {
    const small = { ...sample, boxes: [...sample.boxes, { ...panelBox("e01"), w: 8, h: 8 }] };
    expect(threadSizes(small, fakeAdvance).get(id)).toMatchObject({ w: PANEL_LOOK.least, h: PANEL_LOOK.least });
    expect(threadSizes(small, fakeAdvance, undefined, new Map([[id, 3]])).get(id)?.h).toBe(PANEL_LOOK.least);
  });

  it("gives a panel its new height when the sizes of before have the panel", () => {
    const before = threadSizes(document, fakeAdvance);
    const next = threadSizes(document, fakeAdvance, before, new Map([[id, 250]]));
    expect(next.get(id)?.h).toBe(250);
    expect(next.get(id)?.text).toBe(before.get(id)?.text);
    expect(next.get("m01#0")?.text).toBe(before.get("m01#0")?.text);
  });
});
