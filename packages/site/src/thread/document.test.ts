import { describe, expect, it } from "vitest";
import { choiceOf, choicesOf, edgeKind, isChosen, isDone, isDrawn, isProposal, isSpring, labelOf, linkOf, partStates, relationOf, soundDocument, tagOf, textOf, threadKinds, topicCounts, type ThreadDocument } from "./document.ts";
import { sampleThread } from "./sample.ts";

const sample = sampleThread();
const edges = sample.edges ?? [];
const edge = (id: string) => {
  const found = edges.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no edge ${id}`);
  return found;
};
const box = (id: string) => {
  const found = sample.boxes.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no box ${id}`);
  return found;
};

describe("the kinds of the boxes", () => {
  it("takes the kind of a box from its place in the tree, then from its first kind", () => {
    const kinds = threadKinds(sample);
    expect(kinds.get("m01")).toBe("message");
    expect(kinds.get("m01#0")).toBe("part");
    expect(kinds.get("water")).toBe("topic");
    expect(kinds.get("e01")).toBe("entry");
    expect(kinds.size).toBe(sample.boxes.length);
  });

  it("gives an entry to a message with no part", () => {
    const kinds = threadKinds({ id: "d", boxes: [{ id: "a", data: { kinds: ["message"] } }] });
    expect(kinds.get("a")).toBe("entry");
  });

  it("gives the tag of a topic and of an entry", () => {
    expect(tagOf(box("water"))).toBe("theme");
    expect(tagOf(box("e03"))).toBe("decision");
    expect(tagOf(box("m01"))).toBeUndefined();
    expect(tagOf({ data: { kinds: ["decision"] } })).toBe("decision");
    expect(tagOf({})).toBeUndefined();
  });

  it("reads the name, the text, the state and the address of a box", () => {
    expect(labelOf(box("water"))).toBe("Water and drainage");
    expect(labelOf({ id: "x" })).toBe("x");
    expect(textOf(box("m01"))).toContain("Can we move the tomatoes");
    expect(isDone(box("fence"))).toBe(true);
    expect(isDone(box("water"))).toBe(false);
    expect(linkOf(box("water"))).toBe("#water");
    expect(linkOf({ data: { ref: "#a", url: "https://example.com/a" } })).toBe("https://example.com/a");
  });
});

describe("the edges", () => {
  it("tells the kind and the state of an edge", () => {
    expect(edgeKind(edge("reply:m01:m02"))).toBe("reply");
    expect(edgeKind({ data: { kind: "other" } })).toBeUndefined();
    expect(isChosen(edge("touches:m01#0:water"))).toBe(true);
    expect(isProposal(edge("touches:m01#0:north"))).toBe(true);
    expect(isChosen({ data: { kind: "touches" } })).toBe(true);
    expect(relationOf(edge("relates:trench:water"))).toBe("sub");
    expect(choiceOf(edge("touches:m01#0:water"))).toBe("m01#0");
    expect(choiceOf({ id: "e", source: "m01", target: "water" })).toBe("m01");
  });

  it("makes a spring of a reply, a relation and a chosen topic", () => {
    expect(isSpring(edge("reply:m01:m02"))).toBe(true);
    expect(isSpring(edge("relates:fence:trench"))).toBe(true);
    expect(isSpring(edge("touches:m01#0:water"))).toBe(true);
    expect(isSpring(edge("touches:m01#0:north"))).toBe(false);
    expect(isSpring(edge("part:m01#0"))).toBe(false);
  });

  it("draws no line for a part edge and for a refused proposal", () => {
    expect(isDrawn(edge("part:m01#0"))).toBe(false);
    expect(isDrawn({ data: { kind: "touches", state: "refused" } })).toBe(false);
    expect(isDrawn(edge("touches:m01#0:north"))).toBe(true);
  });

  it("counts the parts of each topic", () => {
    const counts = topicCounts(edges);
    expect(counts.get("trench")).toBe(5);
    expect(counts.get("north")).toBeUndefined();
  });

  it("tells the state of the topic of each part", () => {
    const states = partStates(edges);
    expect(states.get("m01#0")).toBe("sorted");
    expect(states.get("m04#1")).toBe("changed");
    expect(states.get("m05#1")).toBe("open");
    expect(states.get("e01")).toBe("sorted");
    expect(states.has("m01")).toBe(false);
  });

  it("tells that a topic is not the first proposal from the ranks, and not from the name of who chose it", () => {
    const touch = (target: string, data: Record<string, unknown>) => ({ id: `t:${target}`, source: "p", target, data: { kind: "touches", choice: "p", ...data } });
    expect(partStates([touch("a", { state: "chosen", rank: 1, by: "Tom" }), touch("b", { state: "proposed", rank: 2 })]).get("p")).toBe("sorted");
    expect(partStates([touch("a", { state: "proposed", rank: 1 }), touch("b", { state: "chosen", rank: 2, by: "sorter" })]).get("p")).toBe("changed");
    expect(partStates([touch("a", { state: "proposed", rank: 1 }), touch("c", { state: "chosen" })]).get("p")).toBe("changed");
    expect(partStates([touch("a", { state: "refused", rank: 1 }), touch("b", { state: "chosen", rank: 2 })]).get("p")).toBe("changed");
    expect(partStates([touch("c", { state: "chosen", by: "Tom" })]).get("p")).toBe("sorted");
    expect(partStates([touch("a", { state: "refused", rank: 1 })]).has("p")).toBe(false);
  });

  it("gives the topics of a part in the order of the sorter", () => {
    const choices = choicesOf(edges, "m04#1");
    expect(choices.map((choice) => choice.target)).toEqual(["compost", "tomatoes"]);
    expect(choices.map((choice) => choice.chosen)).toEqual([false, true]);
    expect(choices[1]?.by).toBe("Rosa");
    expect(choices[0]?.score).toBe(0.7);
    expect(choicesOf([...edges, { id: "r", source: "m04#1", target: "shed", data: { kind: "touches", state: "refused", rank: 3 } }], "m04#1")).toHaveLength(2);
  });
});

describe("soundDocument", () => {
  const loose: ThreadDocument = {
    id: "loose",
    boxes: [
      { id: "a" },
      { id: "a", data: { label: "second" } },
      { id: "b", parent: "nowhere" },
      { id: "c", parent: "d" },
      { id: "d", parent: "c" },
      { id: "e", parent: "a" },
    ],
    edges: [
      { id: "1", source: "a", target: "b" },
      { id: "1", source: "b", target: "a" },
      { id: "2", source: "a", target: "nowhere" },
    ],
  };

  it("keeps the first box of an id and removes a parent that is not a box", () => {
    const sound = soundDocument(loose);
    expect(sound.boxes.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(sound.boxes.find((entry) => entry.id === "b")?.parent).toBeUndefined();
    expect(sound.boxes.find((entry) => entry.id === "e")?.parent).toBe("a");
  });

  it("removes the parent of each box of a loop", () => {
    const sound = soundDocument(loose);
    expect(sound.boxes.find((entry) => entry.id === "c")?.parent).toBeUndefined();
    expect(sound.boxes.find((entry) => entry.id === "d")?.parent).toBeUndefined();
  });

  it("removes an edge with an end that is not a box, and keeps the first edge of an id", () => {
    expect(soundDocument(loose).edges).toEqual([{ id: "1", source: "a", target: "b" }]);
  });

  it("does not change a sound document", () => {
    const sound = soundDocument(sample);
    expect(sound.boxes).toEqual(sample.boxes);
    expect(sound.edges).toEqual(sample.edges);
  });
});
