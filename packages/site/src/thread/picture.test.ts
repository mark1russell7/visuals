import { checkPicture } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { chooseTopic } from "./card.ts";
import { labelId, ROUTED_MOST, routedProposals, threadPicture, timeText, titleOf, withProposals, type ThreadPicture } from "./picture.ts";
import { SAMPLE_LEGEND, sampleThread } from "./sample.ts";

const sample = sampleThread();
const options = { legend: SAMPLE_LEGEND, timeZone: "UTC" } as const;
const thread = threadPicture(sample, fakeAdvance, options);
const label = (id: string) => thread.picture.labels.find((entry) => entry.id === id);

describe("threadPicture", () => {
  it("makes a good picture with each box of the document", () => {
    expect(checkPicture(thread.picture)).toEqual([]);
    expect(thread.picture.id).toBe("garden-chat");
    expect(thread.picture.boxes).toHaveLength(sample.boxes.length);
    expect(thread.picture.boxes.find((box) => box.id === "m01#0")?.parent).toBe("m01");
  });

  it("routes each reply, each relation and each topic of a part, and no part edge", () => {
    const drawn = (sample.edges ?? []).filter((edge) => edge.data?.["kind"] !== "part").map((edge) => edge.id);
    expect(thread.picture.routes.map((route) => route.id).sort()).toEqual(drawn.sort());
    expect(thread.picture.routes.find((route) => route.id === "touches:m01#0:water")?.data?.["state"]).toBe("chosen");
  });

  it("puts the routes of the proposals behind the other routes", () => {
    const states = thread.picture.routes.map((route) => route.data?.["state"] === "proposed");
    expect(states.lastIndexOf(true)).toBeLessThan(states.indexOf(false));
  });

  it("gives no route to a refused proposal", () => {
    const edges = [...(sample.edges ?? []), { id: "no", source: "m02#0", target: "shed", data: { kind: "touches", state: "refused", choice: "m02#0" } }];
    const picture = threadPicture({ ...sample, edges }, fakeAdvance).picture;
    expect(picture.routes.some((route) => route.id === "no")).toBe(false);
  });

  it("gives the text of each part, entry and topic, and the count of a topic with parts", () => {
    expect(label(labelId("text", "m01#0"))?.lines.join(" ")).toBe("The north beds are under water again after the rain on Monday.");
    expect(label(labelId("text", "e01"))?.box).toBe("e01");
    expect(label(labelId("text", "water"))?.lines).toEqual(["Water and drainage"]);
    expect(label(labelId("count", "trench"))?.lines).toEqual(["5"]);
    expect(label(labelId("count", "north"))).toBeUndefined();
    expect(label(labelId("text", "m01"))).toBeUndefined();
  });

  it("gives the date of a message, and the tag and the date of an entry", () => {
    expect(label(labelId("date", "m01"))?.lines).toEqual(["Sep 2, 08:14"]);
    expect(label(labelId("tag", "m01"))).toBeUndefined();
    expect(label(labelId("tag", "e01"))?.lines).toEqual(["Question"]);
    expect(label(labelId("date", "e01"))?.align).toBe("right");
    expect(threadPicture(sample, fakeAdvance).picture.labels.find((entry) => entry.id === labelId("tag", "e01"))?.lines).toEqual(["ask"]);
  });

  it("puts each label of a box in the box", () => {
    for (const entry of thread.picture.labels) {
      const place = thread.places.get(entry.box ?? "");
      expect(place).toBeDefined();
      if (place === undefined) continue;
      expect(entry.x).toBeGreaterThanOrEqual(place.x);
      expect(entry.y).toBeGreaterThanOrEqual(place.y);
      expect(entry.y + entry.h).toBeLessThanOrEqual(place.y + place.h + 1e-6);
    }
  });

  it("keeps the place of each box after a change of an edge", () => {
    const next = threadPicture(chooseTopic(sample, { choice: "m05#1", target: "north" }), fakeAdvance, { ...options, keep: thread });
    expect(next.places).toBe(thread.places);
    expect(next.states.get("m05#1")).toBe("changed");
    expect(next.sizes.get("north")?.count).toBe(1);
    expect(checkPicture(next.picture)).toEqual([]);
  });

  it("gives a new box a place, and moves no box of before", () => {
    const boxes = [...sample.boxes, { id: "new", data: { kinds: ["topic"], label: "Bees" } }];
    const next = threadPicture({ ...sample, boxes }, fakeAdvance, { ...options, keep: thread });
    expect(next.places).not.toBe(thread.places);
    expect(next.places.has("new")).toBe(true);
    for (const [id, place] of thread.places) expect(next.places.get(id)).toEqual(place);
    expect(checkPicture(next.picture)).toEqual([]);
  });

  it("moves no box when a box goes away", () => {
    const boxes = sample.boxes.filter((box) => box.id !== "e04");
    const edges = (sample.edges ?? []).filter((edge) => edge.source !== "e04" && edge.target !== "e04");
    const next = threadPicture({ ...sample, boxes, edges }, fakeAdvance, { ...options, keep: thread });
    expect(next.places.has("e04")).toBe(false);
    for (const [id, place] of next.places) expect(place).toEqual(thread.places.get(id));
    expect(checkPicture(next.picture)).toEqual([]);
  });

  it("gives the same picture for the same document", () => {
    expect(threadPicture(sample, fakeAdvance, options).picture).toEqual(thread.picture);
  });

  it("reads a document with records that point at no box", () => {
    const loose = {
      id: "loose",
      boxes: [...sample.boxes, { id: "alone", parent: "nowhere", data: { label: "A box with no home" } }],
      edges: [...(sample.edges ?? []), { id: "dangling", source: "m01#0", target: "nowhere", data: { kind: "touches", state: "chosen" } }],
    };
    const picture = threadPicture(loose, fakeAdvance).picture;
    expect(checkPicture(picture)).toEqual([]);
    expect(picture.boxes.some((box) => box.id === "alone")).toBe(true);
    expect(picture.routes.some((route) => route.id === "dangling")).toBe(false);
  });

  it("makes an empty picture of an empty document", () => {
    const empty = threadPicture({ id: "empty", boxes: [] }, fakeAdvance);
    expect(empty.picture.boxes).toEqual([]);
    expect(empty.picture.routes).toEqual([]);
  });
});

describe("the proposals of a picture", () => {
  const isProposed = (route: { readonly data?: Readonly<Record<string, unknown>> | undefined }): boolean => route.data?.["state"] === "proposed";
  const proposed = (of: ThreadPicture): string[] => of.picture.routes.filter(isProposed).map((route) => route.id).sort();
  const others = (of: ThreadPicture) => of.picture.routes.filter((route) => !isProposed(route));
  const none = threadPicture(sample, fakeAdvance, { ...options, proposals: [] });
  const one = threadPicture(sample, fakeAdvance, { ...options, proposals: ["m12#1"] });

  it("routes each proposal with no option, and only the proposals of the parts of the option", () => {
    expect(thread.proposals).toBe("each");
    expect(proposed(thread).length).toBeGreaterThan(2);
    expect(proposed(none)).toEqual([]);
    expect(proposed(one)).toEqual(["touches:m12#1:shed", "touches:m12#1:trench"]);
    for (const some of [none, one]) {
      expect(checkPicture(some.picture)).toEqual([]);
      expect(others(some)).toEqual(others(thread));
      expect(some.picture.boxes).toEqual(thread.picture.boxes);
      expect(some.picture.labels).toEqual(thread.picture.labels);
    }
  });

  it("adds the routes of the proposals of a part to a picture, behind the other routes", () => {
    const next = withProposals(none, ["m12#1"]);
    expect(next.proposals).toEqual(["m12#1"]);
    expect(next.picture).toEqual(one.picture);
    expect(next.picture.boxes).toBe(none.picture.boxes);
    expect(next.picture.labels).toBe(none.picture.labels);
    expect(checkPicture(next.picture)).toEqual([]);
    const states = next.picture.routes.map(isProposed);
    expect(states.lastIndexOf(true)).toBeLessThan(states.indexOf(false));
  });

  it("replaces the routes of the proposals of a different part", () => {
    const next = withProposals(withProposals(none, ["m12#1"]), ["m11#0"]);
    expect(proposed(next)).toEqual(["touches:m11#0:shed"]);
    expect(others(next)).toEqual(others(thread));
  });

  it("gives the same picture when the picture has the routes", () => {
    const next = withProposals(none, ["m12#1"]);
    expect(withProposals(next, ["m12#1"])).toBe(next);
    expect(withProposals(next, [])).toBe(next);
    expect(withProposals(none, [])).toBe(none);
    expect(withProposals(thread, ["m12#1"])).toBe(thread);
    expect(withProposals(thread, "each")).toBe(thread);
  });

  it("gives each proposal a route, as a picture with no option", () => {
    const all = withProposals(none, "each");
    expect(all.proposals).toBe("each");
    expect(all.picture).toEqual(thread.picture);
  });

  it("routes each proposal of a document with few proposals, and only the shown proposals of a document with many", () => {
    const edges = Array.from({ length: ROUTED_MOST + 1 }, (_, at) => ({ id: `p${String(at)}`, source: "m01#0", target: "water", data: { kind: "touches", state: "proposed", choice: "m01#0" } }));
    const many = { ...sample, edges };
    expect(routedProposals(sample, ["m01#0"])).toBe("each");
    expect(routedProposals({ ...sample, edges: edges.slice(1) }, ["m01#0"])).toBe("each");
    expect(routedProposals(many, ["m01#0"])).toEqual(["m01#0"]);
    expect(routedProposals(many, [])).toEqual([]);
    expect(routedProposals(many, [], true)).toBe("each");
    expect(routedProposals({ id: "empty", boxes: [] }, [])).toBe("each");
  });
});

describe("the texts of a picture", () => {
  it("gives a short text of a time, and keeps a text that is not a time", () => {
    expect(timeText("2026-11-16T14:05:00Z", "en-US", "UTC")).toBe("Nov 16, 14:05");
    expect(timeText("soon")).toBe("soon");
  });

  it("gives the title of an id of a legend, or the id", () => {
    expect(titleOf(SAMPLE_LEGEND.kinds, "ask")).toBe("Question");
    expect(titleOf(SAMPLE_LEGEND.kinds, "other")).toBe("other");
    expect(titleOf(undefined, "ask")).toBe("ask");
  });
});
