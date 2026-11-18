import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { cardOf, chooseTopic, MOST_CHOICES, relationNames } from "./card.ts";
import { choicesOf, partStates } from "./document.ts";
import { threadPicture } from "./picture.ts";
import { SAMPLE_LEGEND, sampleThread } from "./sample.ts";

const sample = sampleThread();
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

  it("gives no card for an id that is not a box", () => {
    expect(cardOf(thread, "nowhere")).toBeUndefined();
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
