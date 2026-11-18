import { checkPicture } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { chooseTopic } from "./card.ts";
import { panelBox, panelEdge, panelId, withPanels } from "./panel.test-util.ts";
import { PANEL_GAP } from "./panels.ts";
import { HEADER_GAP, isPanelLine, labelId, ROUTED_MOST, routedProposals, TAG_FONT, threadPicture, timeText, titleOf, waitsText, withProposals, type ThreadPicture } from "./picture.ts";
import { SAMPLE_LEGEND, sampleThread } from "./sample.ts";
import { PANEL_LOOK } from "./sizes.ts";

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

  it("tells who an entry waits on after its tag, with the name of the legend", () => {
    const tag = label(labelId("tag", "e04"));
    const waits = label(labelId("waits", "e04"));
    expect(waits?.lines).toEqual(["Waits on you"]);
    expect(waits?.x).toBe((tag?.x ?? 0) + Math.ceil(fakeAdvance("Request", TAG_FONT)) + HEADER_GAP);
    expect(label(labelId("date", "e04"))?.align).toBe("right");
    expect(threadPicture(sample, fakeAdvance).picture.labels.find((entry) => entry.id === labelId("waits", "e04"))?.lines).toEqual(["Waits on reader"]);
    expect(waitsText("reader", SAMPLE_LEGEND)).toBe("Waits on you");
    expect(waitsText("the board", SAMPLE_LEGEND)).toBe("Waits on the board");
  });

  it("gives no such text to an entry that waits on no one, and to a message", () => {
    expect(label(labelId("waits", "e01"))).toBeUndefined();
    const message = { ...sample, boxes: sample.boxes.map((box) => (box.id === "m01" ? { ...box, data: { ...box.data, waits: "reader" } } : box)) };
    expect(threadPicture(message, fakeAdvance, options).picture.labels.find((entry) => entry.id === labelId("waits", "m01"))).toBeUndefined();
  });

  it("gives no date to a header with no room for it", () => {
    const long = { ...SAMPLE_LEGEND, waits: [{ id: "reader", title: "the person with the keys of the shed" }] };
    const labels = threadPicture(sample, fakeAdvance, { ...options, legend: long }).picture.labels;
    const ids = labels.filter((entry) => entry.box === "e04").map((entry) => entry.id);
    expect(ids).toContain(labelId("tag", "e04"));
    expect(ids).toContain(labelId("waits", "e04"));
    expect(ids).not.toContain(labelId("date", "e04"));
    expect(labels.some((entry) => entry.id === labelId("date", "e03"))).toBe(true);
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

describe("the panels of a picture", () => {
  /** A part with a free side: its panel pushes no box. */
  const free = "m10#0";
  /** A part with no free side: its panel pushes boxes. */
  const tight = "m02#0";
  const id = panelId(free);
  const document = withPanels(sample, free);
  const made = threadPicture(document, fakeAdvance, options);
  const lines = (of: ThreadPicture) => of.picture.routes.filter((route) => isPanelLine(route, of.kinds));
  const others = (of: ThreadPicture) => of.picture.routes.filter((route) => !isPanelLine(route, of.kinds));
  const moved = (of: ThreadPicture): string[] => of.plain.boxes.filter((box) => of.places.get(box.id) !== of.base.get(box.id)).map((box) => box.id);

  it("has no panel for a document with none", () => {
    expect(thread.plain).toBe(thread.document);
    expect(thread.base).toBe(thread.places);
    expect(thread.sides.size).toBe(0);
    expect(lines(thread)).toEqual([]);
  });

  it("makes a good picture with the panel, its name and its line", () => {
    expect(checkPicture(made.picture)).toEqual([]);
    expect(made.kinds.get(id)).toBe("panel");
    expect(made.plain).toEqual(sample);
    expect(made.sides.get(id)).toBe("right");
    const card = made.places.get("m10");
    const row = made.places.get(free);
    expect(made.picture.boxes.find((box) => box.id === id)).toMatchObject({ x: (card?.x ?? 0) + (card?.w ?? 0) + PANEL_GAP, y: row?.y, w: PANEL_LOOK.width, h: PANEL_LOOK.height });
    expect(label(labelId("text", id))).toBeUndefined();
    expect(made.picture.labels.find((entry) => entry.id === labelId("text", id))).toMatchObject({ box: id, lines: ["Answer"] });
    expect(lines(made).map((route) => [route.id, route.source, route.target, route.data?.["kind"]])).toEqual([[`to:${id}`, free, id, "panel"]]);
  });

  it("makes one straight line of the edge of a panel, from the side of the card to the side of the panel", () => {
    const [line] = lines(made);
    const card = made.places.get("m10");
    const at = made.places.get(id);
    expect(line?.path.map((step) => step.kind)).toEqual(["move", "line"]);
    const [from, to] = (line?.path ?? []).flatMap((step) => ("to" in step ? [step.to] : []));
    expect(from?.x).toBeCloseTo((card?.x ?? 0) + (card?.w ?? 0), 6);
    expect(to?.x).toBeCloseTo(at?.x ?? 0, 6);
    expect(made.picture.routes.at(-1)).toBe(line);
  });

  it("changes no box, no label and no line of a document when its panel pushes no box", () => {
    expect(moved(made)).toEqual([]);
    expect(made.base).toEqual(thread.places);
    expect(others(made)).toEqual(thread.picture.routes);
    expect(made.picture.boxes.filter((box) => box.id !== id)).toEqual(thread.picture.boxes);
    expect(made.picture.labels.filter((entry) => entry.box !== id)).toEqual(thread.picture.labels);
  });

  it("keeps the routes and the labels of the picture of before when the panel pushes no box", () => {
    const next = threadPicture(document, fakeAdvance, { ...options, keep: thread });
    expect(next.picture).toEqual(made.picture);
    expect(checkPicture(next.picture)).toEqual([]);
    expect(next.base).toBe(thread.base);
    for (const [at, route] of thread.picture.routes.entries()) expect(next.picture.routes[at]).toBe(route);
    for (const [at, entry] of thread.picture.labels.entries()) expect(next.picture.labels[at]).toBe(entry);
    // A different option of the lines makes each route again.
    const curved = threadPicture(document, fakeAdvance, { ...options, curve: "smooth", keep: thread });
    expect(curved.picture.routes[0]).not.toBe(thread.picture.routes[0]);
    expect(curved.picture).toEqual(threadPicture(document, fakeAdvance, { ...options, curve: "smooth" }).picture);
  });

  it("gives the picture of before again when the panel goes", () => {
    const back = threadPicture(sample, fakeAdvance, { ...options, keep: made });
    expect(back.picture).toEqual(thread.picture);
    expect(back.sides.size).toBe(0);
    for (const [at, route] of others(made).entries()) expect(back.picture.routes[at]).toBe(route);
  });

  it("gives a panel the height of its content, and keeps the side of the panel", () => {
    const tall = threadPicture(document, fakeAdvance, { ...options, keep: made, panels: new Map([[id, 301]]) });
    expect(tall.picture.boxes.find((box) => box.id === id)).toMatchObject({ w: PANEL_LOOK.width, h: 301 });
    expect(tall.sides.get(id)).toBe("right");
    expect(tall.places.get(id)).toMatchObject({ x: made.places.get(id)?.x, y: made.places.get(id)?.y });
    expect(checkPicture(tall.picture)).toEqual([]);
  });

  it("pushes the boxes that are too near to a panel, and routes each line between the new places", () => {
    const pushed = threadPicture(withPanels(sample, tight), fakeAdvance, options);
    expect(moved(pushed).length).toBeGreaterThan(0);
    expect(checkPicture(pushed.picture)).toEqual([]);
    expect(pushed.base).toEqual(thread.places);
    expect(others(pushed).map((route) => route.id).sort()).toEqual(thread.picture.routes.map((route) => route.id).sort());
    expect(others(pushed)).not.toEqual(thread.picture.routes);
    // The picture with the picture of before is the same picture, and the boxes go back when the panel goes.
    expect(threadPicture(withPanels(sample, tight), fakeAdvance, { ...options, keep: thread }).picture).toEqual(pushed.picture);
    expect(threadPicture(sample, fakeAdvance, { ...options, keep: pushed }).picture).toEqual(thread.picture);
  });

  it("keeps the side of a panel when a different panel comes", () => {
    const two = threadPicture(withPanels(sample, free, tight), fakeAdvance, { ...options, keep: made });
    expect(two.sides.get(id)).toBe(made.sides.get(id));
    expect(two.sides.has(panelId(tight))).toBe(true);
    expect(checkPicture(two.picture)).toEqual([]);
    expect(lines(two)).toHaveLength(2);
  });

  it("makes a good picture for an edge with the id of its panel, and for a panel with no edge", () => {
    const twin = { ...sample, boxes: [...sample.boxes, panelBox("e01")], edges: [...(sample.edges ?? []), { ...panelEdge("e01"), id: panelId("e01") }] };
    expect(checkPicture(threadPicture(twin, fakeAdvance, options).picture)).toEqual([]);
    const alone = threadPicture({ ...sample, boxes: [...sample.boxes, panelBox("e01")] }, fakeAdvance, options);
    expect(checkPicture(alone.picture)).toEqual([]);
    expect(lines(alone)).toEqual([]);
    expect(alone.places.has(panelId("e01"))).toBe(true);
  });

  it("keeps the line of a panel when the picture gets the routes of other proposals", () => {
    const none = threadPicture(document, fakeAdvance, { ...options, proposals: [] });
    const next = withProposals(none, ["m12#1"]);
    expect(next.picture).toEqual(threadPicture(document, fakeAdvance, { ...options, proposals: ["m12#1"] }).picture);
    expect(lines(next)).toEqual(lines(none));
    expect(checkPicture(next.picture)).toEqual([]);
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
