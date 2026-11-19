import { describe, expect, it } from "vitest";
import { actionsOf, choiceOf, choicesOf, EDGE_KINDS, edgeKind, holdsOf, isChosen, isDone, isDrawn, isProposal, isSpring, isTopicBox, labelOf, linkOf, panelOf, partStates, relationOf, soundDocument, tagOf, textOf, THREAD_KINDS, threadKinds, topicCounts, waitsOf, type ThreadDocument } from "./document.ts";
import { SAMPLE_ANSWER, sampleThread } from "./sample.ts";
import { flatSample } from "./sample.test-util.ts";

const sample = flatSample();
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

  it("gives a panel to a box that has the kind of a panel first, and reads the box of a panel", () => {
    const kinds = threadKinds({ id: "d", boxes: [{ id: "a" }, { id: "p", data: { kinds: ["panel"], of: "a" } }, { id: "q", data: { kinds: ["ask", "panel"] } }] });
    expect(kinds.get("p")).toBe("panel");
    expect(kinds.get("q")).toBe("entry");
    expect(THREAD_KINDS).toContain("panel");
    expect(panelOf({ data: { of: "a" } })).toBe("a");
    expect(panelOf({ data: { of: 3 } })).toBeUndefined();
    expect(panelOf({ data: { of: "" } })).toBeUndefined();
    expect(panelOf({})).toBeUndefined();
  });

  it("draws the edge of a panel, and makes no spring of it", () => {
    const line = { data: { kind: "panel" } };
    expect(EDGE_KINDS).toContain("panel");
    expect(edgeKind(line)).toBe("panel");
    expect(isDrawn(line)).toBe(true);
    expect(isSpring(line)).toBe(false);
    expect(isProposal(line)).toBe(false);
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

  it("gives an address only for a value that a link can go to", () => {
    for (const address of ["https://example.com/a", "HTTP://example.com", "/a/page/", "./a", "../a", "#a", "?topic=a"]) {
      expect(linkOf({ data: { ref: address } })).toBe(address);
    }
    // An id is not an address: a link to it goes to no page.
    for (const other of ["water", "chat-1#3", "javascript:alert(1)", "data:text/html,a", "mailto:a@example.com", ""]) {
      expect(linkOf({ data: { ref: other } })).toBeUndefined();
      expect(linkOf({ data: { url: other } })).toBeUndefined();
    }
    expect(linkOf({ data: { ref: "#a", url: "an id" } })).toBe("#a");
    expect(linkOf({})).toBeUndefined();
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

describe("actionsOf", () => {
  it("gives the buttons of a box in the order of the list", () => {
    const actions = [
      { id: "answer", title: "Answer" },
      { id: "comment", title: "Comment" },
    ];
    expect(actionsOf({ data: { actions } })).toEqual(actions);
  });

  it("gives only the id and the title of a record", () => {
    expect(actionsOf({ data: { actions: [{ id: "reply", title: "Reply", form: "<script>" }] } })).toEqual([{ id: "reply", title: "Reply" }]);
  });

  it("gives no button for a record with no id or no title, and one button for an id", () => {
    const actions = [null, "reply", 3, {}, { id: "", title: "Empty" }, { id: "a" }, { id: "a", title: "" }, { id: 4, title: "Four" }, { id: "a", title: "First" }, { id: "a", title: "Second" }];
    expect(actionsOf({ data: { actions } })).toEqual([{ id: "a", title: "First" }]);
  });

  it("gives no button for a box with no list", () => {
    expect(actionsOf({})).toEqual([]);
    expect(actionsOf({ data: {} })).toEqual([]);
    expect(actionsOf({ data: { actions: "reply" } })).toEqual([]);
    expect(actionsOf({ data: { actions: { id: "reply", title: "Reply" } } })).toEqual([]);
    for (const entry of sample.boxes) expect(actionsOf(entry)).toEqual(entry.id === "e04" ? [SAMPLE_ANSWER] : []);
  });
});

describe("waitsOf", () => {
  it("gives the id of who a box waits on", () => {
    expect(waitsOf(box("e04"))).toBe("reader");
    expect(waitsOf({ data: { waits: "the board" } })).toBe("the board");
  });

  it("gives no id for a box that waits on no one, and for a value that is not a text", () => {
    expect(waitsOf(box("e01"))).toBeUndefined();
    expect(waitsOf({})).toBeUndefined();
    expect(waitsOf({ data: { waits: "" } })).toBeUndefined();
    expect(waitsOf({ data: { waits: true } })).toBeUndefined();
    expect(waitsOf({ data: { waits: ["reader"] } })).toBeUndefined();
  });
});

describe("the boxes of a document with groups", () => {
  const nested = sampleThread();
  const kinds = threadKinds(nested);
  const nestedBox = (id: string) => nested.boxes.find((entry) => entry.id === id) ?? {};

  it("makes a group of each box with boxes in it that is not a message", () => {
    expect(kinds.get("water")).toBe("group");
    expect(kinds.get("trench")).toBe("group");
    expect(kinds.get("t01")).toBe("group");
    expect(kinds.get("m01")).toBe("message");
    expect(kinds.get("m01#0")).toBe("part");
  });

  it("gives a box in a group the kind that it has with no group", () => {
    expect(kinds.get("rota")).toBe("topic");
    expect(kinds.get("e01")).toBe("entry");
    // A box with the kind of a group and no box in it is an entry.
    expect(threadKinds({ id: "d", boxes: [{ id: "g", data: { kinds: ["group"] } }] }).get("g")).toBe("entry");
  });

  it("tells a topic by its first kind, also when the topic is a group", () => {
    expect(isTopicBox(nestedBox("water"))).toBe(true);
    expect(isTopicBox(nestedBox("rota"))).toBe(true);
    expect(isTopicBox(nestedBox("t01"))).toBe(false);
    expect(isTopicBox(nestedBox("m01"))).toBe(false);
    expect(isTopicBox({})).toBe(false);
  });

  it("gives a thread the tag `thread`, and counts the parts of a topic in a group", () => {
    expect(tagOf(nestedBox("t01"))).toBe("thread");
    expect(topicCounts(nested.edges ?? [])).toEqual(topicCounts(edges));
  });

  it("reads the number of the boxes in a closed container", () => {
    expect(holdsOf({ data: { holds: 3 } })).toBe(3);
    expect(holdsOf({ data: { holds: 0 } })).toBeUndefined();
    expect(holdsOf({ data: {} })).toBeUndefined();
    expect(holdsOf({})).toBeUndefined();
  });
});
