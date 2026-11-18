import { describe, expect, it } from "vitest";
import { actionsOf, soundDocument, threadKinds, topicCounts, waitsOf } from "./document.ts";
import { answerEntry, SAMPLE_ANSWER, SAMPLE_LEGEND, sampleThread } from "./sample.ts";

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
});
