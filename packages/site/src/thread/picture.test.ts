import { checkPicture } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { chooseTopic } from "./card.ts";
import { labelId, threadPicture, timeText, titleOf } from "./picture.ts";
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

  it("places the boxes again when the boxes are different", () => {
    const boxes = [...sample.boxes, { id: "new", data: { kinds: ["topic"], label: "Bees" } }];
    const next = threadPicture({ ...sample, boxes }, fakeAdvance, { ...options, keep: thread });
    expect(next.places).not.toBe(thread.places);
    expect(next.places.has("new")).toBe(true);
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
