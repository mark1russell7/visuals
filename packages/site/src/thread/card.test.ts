import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { cardOf, chooseTopic, MOST_CHOICES, relationNames } from "./card.ts";
import { choicesOf, partStates } from "./document.ts";
import { panelId, withPanels } from "./panel.test-util.ts";
import { threadPicture } from "./picture.ts";
import { SAMPLE_LEGEND, sampleThread } from "./sample.ts";
import { flatSample } from "./sample.test-util.ts";

const sample = flatSample();
const options = { legend: SAMPLE_LEGEND, timeZone: "UTC" } as const;
const thread = threadPicture(sample, fakeAdvance, options);

describe("cardOf", () => {
  it("gives the topics of a part in the order of the sorter", () => {
    const card = cardOf(thread, "m01#0", options);
    expect(card).toMatchObject({ kind: "part", title: "Part 1 of 2", date: "Sep 2, 08:14", text: "The north beds are under water again after the rain on Monday.", by: "sorter", parts: [] });
    expect(card?.choices.map((choice) => [choice.id, choice.label, choice.chosen, choice.rank, choice.score, choice.edge])).toEqual([
      ["water", "Water and drainage", true, 1, 0.91, "touches:m01#0:water"],
      ["north", "North beds", false, 2, 0.74, "touches:m01#0:north"],
      ["trench", "Trench by the fence", false, 3, 0.31, "touches:m01#0:trench"],
    ]);
  });

  it("names each other topic that is not done", () => {
    const others = cardOf(thread, "m01#0", options)?.others.map((topic) => topic.id);
    expect(others).toEqual(["tomatoes", "compost", "shed", "seeds", "rota", "market"]);
  });

  it("tells who chose the topic of a part that a person changed", () => {
    const card = cardOf(thread, "m04#1", options);
    expect(card?.by).toBe("Rosa");
    expect(card?.choices.map((choice) => [choice.id, choice.chosen])).toEqual([
      ["compost", false],
      ["tomatoes", true],
    ]);
  });

  it("gives no topics for an entry that takes no topic", () => {
    const box = { id: "unsorted", data: { label: "Not sorted", kinds: ["unsorted"], topics: false } };
    const document = { ...sample, boxes: [...sample.boxes, box] };
    const card = cardOf(threadPicture(document, fakeAdvance), "unsorted");
    expect(card).toMatchObject({ kind: "entry", choosable: false, choices: [], others: [] });
    const open = cardOf(threadPicture({ ...sample, boxes: [...sample.boxes, { ...box, data: { ...box.data, topics: true } }] }, fakeAdvance), "unsorted");
    expect(open?.choosable).toBe(true);
    expect(open?.others.length).toBeGreaterThan(0);
  });

  it("can give a topic to a part", () => {
    expect(cardOf(thread, "m01#0", options)?.choosable).toBe(true);
  });

  it("shows the chosen topic and 3 proposals at most", () => {
    const edges = [...(sample.edges ?? []), ...["shed", "seeds", "rota"].map((target, i) => ({ id: `more:${target}`, source: "m01#0", target, data: { kind: "touches", state: "proposed", choice: "m01#0", rank: 4 + i, score: 0.1 } }))];
    const card = cardOf(threadPicture({ ...sample, edges }, fakeAdvance), "m01#0");
    expect(card?.choices).toHaveLength(1 + MOST_CHOICES);
    expect(card?.others.map((topic) => topic.id)).toContain("rota");
  });

  it("gives the parts and the entries of a topic", () => {
    const card = cardOf(thread, "trench", options);
    expect(card).toMatchObject({ kind: "topic", title: "Task", label: "Trench by the fence", done: false, link: "#trench", choices: [], others: [] });
    expect(card?.parts.map((part) => part.id)).toEqual(["m02#0", "m12#0", "e01", "e02", "e04"]);
    expect(cardOf(thread, "fence", options)?.done).toBe(true);
    expect(cardOf(thread, "trench")?.title).toBe("task");
  });

  it("gives the parts of a message", () => {
    const card = cardOf(thread, "m01", options);
    expect(card).toMatchObject({ kind: "message", title: "Message", date: "Sep 2, 08:14" });
    expect(card?.parts).toEqual([
      { id: "m01#0", label: "The north beds are under water again after the rain on Monday." },
      { id: "m01#1", label: "Can we move the tomatoes to bed 6 before they rot?" },
    ]);
  });

  it("gives the tag and the topic of an entry", () => {
    const card = cardOf(thread, "e03", options);
    expect(card).toMatchObject({ kind: "entry", title: "Decision", date: "Sep 3, 10:10" });
    expect(card?.choices.map((choice) => [choice.id, choice.chosen])).toEqual([["tomatoes", true]]);
  });

  it("tells who an entry waits on, with the name of the legend or the id", () => {
    expect(cardOf(thread, "e04", options)?.waits).toBe("you");
    expect(cardOf(thread, "e04", { timeZone: "UTC" })?.waits).toBe("reader");
    expect(cardOf(thread, "e01", options)?.waits).toBeUndefined();
    expect(cardOf(thread, "m01", options)?.waits).toBeUndefined();
  });

  it("gives no card for an id that is not a box", () => {
    expect(cardOf(thread, "nowhere")).toBeUndefined();
  });

  it("gives no card for a panel, and no card names a panel", () => {
    const withPanel = threadPicture(withPanels(sample, "e01", "water"), fakeAdvance, options);
    expect(withPanel.kinds.get(panelId("e01"))).toBe("panel");
    expect(cardOf(withPanel, panelId("e01"), options)).toBeUndefined();
    for (const id of ["e01", "water", "m01", "m01#0"]) expect(cardOf(withPanel, id, options)).toEqual(cardOf(thread, id, options));
  });
});

describe("chooseTopic", () => {
  it("gives a proposed topic to a part, and makes a proposal of the topic that it had", () => {
    const next = chooseTopic(sample, { choice: "m01#0", target: "north" }, "Tom");
    expect(choicesOf(next.edges ?? [], "m01#0").map((choice) => [choice.target, choice.chosen, choice.by])).toEqual([
      ["water", false, undefined],
      ["north", true, "Tom"],
      ["trench", false, undefined],
    ]);
    expect(partStates(next.edges ?? []).get("m01#0")).toBe("changed");
    expect(next.edges).toHaveLength(sample.edges?.length ?? 0);
  });

  it("makes an edge for a topic that the sorter did not propose", () => {
    const next = chooseTopic(sample, { choice: "m05#1", target: "rota" });
    const made = next.edges?.find((edge) => edge.id === "touches:m05#1:rota");
    expect(made).toEqual({ id: "touches:m05#1:rota", source: "m05#1", target: "rota", data: { kind: "touches", state: "chosen", choice: "m05#1", by: "person" } });
    expect(next.edges).toHaveLength((sample.edges?.length ?? 0) + 1);
  });

  it("removes a chosen edge that has no rank", () => {
    const first = chooseTopic(sample, { choice: "m05#1", target: "rota" });
    const second = chooseTopic(first, { choice: "m05#1", target: "seeds" });
    expect(second.edges?.some((edge) => edge.id === "touches:m05#1:rota")).toBe(false);
    expect(choicesOf(second.edges ?? [], "m05#1").find((choice) => choice.chosen)?.target).toBe("seeds");
  });

  it("does not change the document of the argument, or the edges of a different part", () => {
    const before = JSON.stringify(sample);
    const next = chooseTopic(sample, { choice: "m01#0", target: "north" });
    expect(JSON.stringify(sample)).toBe(before);
    expect(choicesOf(next.edges ?? [], "m01#1")).toEqual(choicesOf(sample.edges ?? [], "m01#1"));
    expect(next.boxes).toBe(sample.boxes);
  });
});

describe("the buttons of a card", () => {
  it("gives the actions of the box, and no action for a box with no list", () => {
    const actions = [
      { id: "answer", title: "Answer" },
      { id: "comment", title: "Comment" },
    ];
    const boxes = sample.boxes.map((box) => (box.id === "water" ? { ...box, data: { ...box.data, actions } } : box));
    const withActions = threadPicture({ ...sample, boxes }, fakeAdvance, options);
    expect(cardOf(withActions, "water", options)?.actions).toEqual(actions);
    expect(cardOf(withActions, "m01#0", options)?.actions).toEqual([]);
    expect(cardOf(thread, "water", options)?.actions).toEqual([]);
  });
});

describe("relationNames", () => {
  it("gives the title of each relation type of the document, or its id", () => {
    expect(relationNames(sample, SAMPLE_LEGEND)).toEqual([
      { id: "sub", label: "Part of" },
      { id: "related", label: "Related" },
    ]);
    expect(relationNames(sample).map((name) => name.label)).toEqual(["sub", "related"]);
    expect(relationNames({ id: "d", boxes: [], edges: [{ id: "r", source: "a", target: "b", data: { kind: "relates" } }] })).toEqual([{ id: "related", label: "related" }]);
  });
});

describe("the card of a container", () => {
  const source = sampleThread();
  const nested = threadPicture(source, fakeAdvance, options);
  const ids = (names: readonly { readonly id: string }[] | undefined): string[] | undefined => names?.map((name) => name.id);

  it("lists the boxes of a topic with topics in it, and the parts of the topic", () => {
    const card = cardOf(nested, "water", options);
    const flat = cardOf(thread, "water", options);
    expect(card).toMatchObject({ kind: "group", topic: true, container: true, closed: false, label: "Water and drainage", title: flat?.title });
    expect(ids(card?.boxes)).toEqual(["trench", "rota"]);
    expect(card?.parts).toEqual(flat?.parts);
    expect(card?.parts.length).toBeGreaterThan(0);
    expect(card?.choices).toEqual([]);
    expect(card?.others).toEqual([]);
  });

  it("names a thread, with its entries and no part", () => {
    const card = cardOf(nested, "t01", options);
    expect(card).toMatchObject({ kind: "group", topic: false, container: true, closed: false, title: "Thread", parts: [], choices: [], others: [] });
    expect(ids(card?.boxes)).toEqual(["e01", "e02"]);
    // A group with a tag that the legend does not name has the tag as its title, and a group with no tag is a group.
    expect(cardOf(nested, "t01")?.title).toBe("thread");
    const plain = threadPicture({ id: "d", boxes: [{ id: "g", data: { kinds: ["group"] } }, { id: "x", parent: "g", data: { kinds: ["entry"] } }] }, fakeAdvance, options);
    expect(cardOf(plain, "g", options)).toMatchObject({ kind: "group", title: "Group", container: true });
    expect(ids(cardOf(plain, "g", options)?.boxes)).toEqual(["x"]);
  });

  it("keeps the lists of a closed container, and tells that it is closed", () => {
    const closed = threadPicture(source, fakeAdvance, { ...options, closed: new Set(["water"]) });
    const card = cardOf(closed, "water", options);
    expect(card).toMatchObject({ kind: "topic", topic: true, container: true, closed: true });
    expect(ids(card?.boxes)).toEqual(["trench", "rota"]);
    expect(card?.parts).toEqual(cardOf(nested, "water", options)?.parts);
    // A box in a closed container is not in the picture, so it has no card.
    expect(cardOf(closed, "trench", options)).toBeUndefined();
    expect(cardOf(closed, "e01", options)).toBeUndefined();
  });

  it("gives a closed thread the card of a container, with no choice of a topic", () => {
    const closed = threadPicture(source, fakeAdvance, { ...options, closed: new Set(["t01"]) });
    const card = cardOf(closed, "t01", options);
    expect(card).toMatchObject({ kind: "entry", topic: false, container: true, closed: true, title: "Thread", choices: [], others: [], parts: [] });
    expect(ids(card?.boxes)).toEqual(["e01", "e02"]);
  });

  it("gives the flat view a topic with no box in it, and no card for a thread", () => {
    const flat = threadPicture(source, fakeAdvance, { ...options, flat: true });
    const card = cardOf(flat, "water", options);
    expect(card).toMatchObject({ kind: "topic", topic: true, container: false, closed: false, boxes: [] });
    expect(card?.parts).toEqual(cardOf(thread, "water", options)?.parts);
    expect(cardOf(flat, "t01", options)).toBeUndefined();
    expect(cardOf(flat, "e01", options)).toEqual(cardOf(thread, "e01", options));
  });

  it("offers a topic that is a group to a part and to an entry in a thread", () => {
    const part = cardOf(nested, "m01#0", options);
    expect(part?.choices.map((choice) => choice.id)).toEqual(["water", "north", "trench"]);
    expect(part?.others.map((topic) => topic.id)).toEqual(["tomatoes", "compost", "shed", "seeds", "rota", "market"]);
    const entry = cardOf(nested, "e01", options);
    expect(entry).toMatchObject({ kind: "entry", container: false, closed: false, boxes: [] });
    expect(entry?.choices).toEqual(cardOf(thread, "e01", options)?.choices);
    expect(entry?.others).toEqual(cardOf(thread, "e01", options)?.others);
  });
});
