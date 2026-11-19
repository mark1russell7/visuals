import { describe, expect, it } from "vitest";
import { actionsOf, imageOf, soundDocument, threadKinds, topicCounts, waitsOf } from "./document.ts";
import { answerEntry, SAMPLE_ANSWER, SAMPLE_IMAGE, SAMPLE_IMAGE_ENTRY, SAMPLE_IMAGE_MARK, SAMPLE_LEGEND, sampleThread, withSampleImage } from "./sample.ts";

const sample = sampleThread();
const at = "2026-09-03T12:00:00Z";
const boxOf = (document: typeof sample, id: string) => document.boxes.find((box) => box.id === id);

describe("sampleThread", () => {
  it("has one entry that waits, with the action of an answer and a name in the legend", () => {
    const waiting = sample.boxes.filter((box) => waitsOf(box) !== undefined);
    expect(waiting.map((box) => box.id)).toEqual(["e04"]);
    expect(actionsOf(waiting[0] ?? {})).toEqual([SAMPLE_ANSWER]);
    expect(SAMPLE_LEGEND.waits).toEqual([{ id: "reader", title: "you" }]);
  });
});

describe("withSampleImage", () => {
  it("puts the sample image on the entry of the decision, and changes no other box", () => {
    const pictured = withSampleImage(sample);
    expect(pictured.boxes.filter((box) => imageOf(box) !== undefined).map((box) => box.id)).toEqual([SAMPLE_IMAGE_ENTRY]);
    expect(imageOf(boxOf(pictured, SAMPLE_IMAGE_ENTRY) ?? {})).toBe(SAMPLE_IMAGE);
    expect(boxOf(pictured, SAMPLE_IMAGE_ENTRY)?.data?.["text"]).toBe("The tomatoes move to bed 6 this week.");
    expect(pictured.boxes.filter((box) => box.id !== SAMPLE_IMAGE_ENTRY)).toEqual(sample.boxes.filter((box) => box.id !== SAMPLE_IMAGE_ENTRY));
    expect(pictured.edges).toBe(sample.edges);
    expect(soundDocument(pictured).boxes).toEqual(pictured.boxes);
  });

  it("puts the image on a named entry, and gives the document of the argument for an id that is not a box", () => {
    expect(imageOf(boxOf(withSampleImage(sample, "e01"), "e01") ?? {})).toBe(SAMPLE_IMAGE);
    expect(withSampleImage(sample, "nowhere")).toBe(sample);
    const before = JSON.stringify(sample);
    withSampleImage(sample);
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("has an SVG image with a size and the color of its mark, in an address that needs no server", () => {
    const start = "data:image/svg+xml,";
    expect(SAMPLE_IMAGE.startsWith(start)).toBe(true);
    const svg = decodeURIComponent(SAMPLE_IMAGE.slice(start.length));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="512" height="320" viewBox="0 0 512 320"/);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg.match(/<rect x=/g)).toHaveLength(8);
    expect(svg.split(`fill="${SAMPLE_IMAGE_MARK}"`)).toHaveLength(2);
  });
});

describe("answerEntry", () => {
  const next = answerEntry(sample, "e04", "I order it on Thursday.", at, "you");

  it("adds a comment as a reply to the entry, with the topic of the entry", () => {
    const made = next.boxes.at(-1);
    expect(made).toEqual({ id: "answer:e04:1", data: { kinds: ["entry", "comment"], label: "I order it on Thursday.", text: "I order it on Thursday.", at } });
    expect(next.boxes).toHaveLength(sample.boxes.length + 1);
    expect(threadKinds(next).get("answer:e04:1")).toBe("entry");
    expect(next.edges?.slice(sample.edges?.length)).toEqual([
      { id: "reply:e04:answer:e04:1", source: "e04", target: "answer:e04:1", data: { kind: "reply" } },
      { id: "touches:answer:e04:1:trench", source: "answer:e04:1", target: "trench", data: { kind: "touches", choice: "answer:e04:1", state: "chosen", by: "you" } },
    ]);
    expect(topicCounts(next.edges ?? []).get("trench")).toBe((topicCounts(sample.edges ?? []).get("trench") ?? 0) + 1);
  });

  it("makes the entry wait on no one, with no action", () => {
    const entry = boxOf(next, "e04");
    expect(waitsOf(entry ?? {})).toBeUndefined();
    expect(actionsOf(entry ?? {})).toEqual([]);
    expect(entry?.data?.["text"]).toBe("Order two cubic meters of gravel before Saturday.");
    expect(next.boxes.filter((box) => waitsOf(box) !== undefined)).toEqual([]);
  });

  it("gives a sound document, and a new id for each answer", () => {
    const second = answerEntry(next, "e04", "It is here.", at, "you");
    expect(second.boxes.at(-1)?.id).toBe("answer:e04:2");
    expect(soundDocument(second).boxes).toEqual(second.boxes);
    expect(soundDocument(second).edges).toEqual(second.edges);
  });

  it("does not change the document of the argument", () => {
    const before = JSON.stringify(sample);
    answerEntry(sample, "e04", "I order it on Thursday.", at, "you");
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("gives the document of the argument for an id that is not a box, and for an empty text", () => {
    expect(answerEntry(sample, "nowhere", "A text.", at, "you")).toBe(sample);
    expect(answerEntry(sample, "e04", "", at, "you")).toBe(sample);
  });

  it("puts the answer to an entry of a thread in that thread", () => {
    const answered = answerEntry(sample, "e02", "The spade is in the shed.", at, "you");
    expect(answered.boxes.at(-1)).toMatchObject({ id: "answer:e02:1", parent: "t01", data: { kinds: ["entry", "comment"] } });
    expect(threadKinds(answered).get("answer:e02:1")).toBe("entry");
    expect(soundDocument(answered).boxes).toEqual(answered.boxes);
  });
});

describe("the groups of the sample", () => {
  it("has two topics in a wider topic, and a thread of two entries in one of them", () => {
    const inGroups = sample.boxes.filter((box) => box.parent !== undefined && threadKinds(sample).get(box.parent) === "group");
    expect(Object.fromEntries(inGroups.map((box) => [box.id, box.parent]))).toEqual({ trench: "water", rota: "water", t01: "trench", e01: "t01", e02: "t01" });
    expect(boxOf(sample, "t01")?.data).toMatchObject({ kinds: ["thread", "ask"], entries: 2, text: boxOf(sample, "e01")?.data?.["text"], at: boxOf(sample, "e01")?.data?.["at"] });
    expect(SAMPLE_LEGEND.kinds?.find((kind) => kind.id === "thread")).toEqual({ id: "thread", title: "Thread" });
  });

  it("has each container before the boxes in it", () => {
    const before = new Set<string>();
    for (const box of sample.boxes) {
      if (box.parent !== undefined) expect(before.has(box.parent), box.id).toBe(true);
      before.add(box.id);
    }
  });

  it("has the wider topic of each relation `sub` as the container of the narrower topic", () => {
    const narrower = (sample.edges ?? []).filter((edge) => edge.data?.["relation"] === "sub");
    expect(narrower.map((edge) => edge.source).sort()).toEqual(["rota", "trench"]);
    for (const edge of narrower) expect(boxOf(sample, edge.source)?.parent).toBe(edge.target);
  });

  it("keeps the entries with no thread at the top, and the count of each topic", () => {
    expect(boxOf(sample, "e03")?.parent).toBeUndefined();
    expect(boxOf(sample, "e04")?.parent).toBeUndefined();
    expect(topicCounts(sample.edges ?? []).get("trench")).toBe(5);
  });
});
