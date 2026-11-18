import type { PictureBox, PictureLabel, PictureRoute } from "@mark1russell7/layout-contract";
import type { RecordState } from "@mark1russell7/visuals/graph";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { DONE_OPACITY, FAR_LINE_OPACITY, farNameLine, LIGHT_THREAD_THEME, PROPOSAL_OPACITY, TEXT_ZOOM, threadLooks, WAITS_WIDTH, waitsColor, type ThreadLookState } from "./looks.ts";
import { labelId, threadPicture } from "./picture.ts";
import { sampleThread } from "./sample.ts";
import { isTopicLook, MESSAGE_LOOK } from "./sizes.ts";

const thread = threadPicture(sampleThread(), fakeAdvance, { timeZone: "UTC" });
const theme = LIGHT_THREAD_THEME;
const near: RecordState = { highlight: 0, focus: "all", zoom: 1, container: false };
const far: RecordState = { ...near, zoom: TEXT_ZOOM / 2 };

let state: ThreadLookState = { thread, proposals: false };
const looks = threadLooks(() => state);
const withState = <T>(next: Partial<ThreadLookState>, read: () => T): T => {
  state = { thread, proposals: false, ...next };
  try {
    return read();
  } finally {
    state = { thread, proposals: false };
  }
};

const box = (id: string): PictureBox => {
  const found = thread.picture.boxes.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no box ${id}`);
  return found;
};
const route = (id: string): PictureRoute => {
  const found = thread.picture.routes.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no route ${id}`);
  return found;
};
const label = (id: string): PictureLabel => {
  const found = thread.picture.labels.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no label ${id}`);
  return found;
};
const labelLook = (id: string, of: string, at: RecordState) => looks.label(label(id), at, theme, { type: "box", id: of, box: box(of) });

describe("the look of a box", () => {
  it("makes a card of a message and of an entry, and a row of a part", () => {
    expect(looks.box(box("m01"), near, theme)).toEqual({ fill: theme.tray, stroke: theme.stroke, width: 1, radius: 9 });
    expect(looks.box(box("e01"), near, theme)).toMatchObject({ fill: theme.surface, stroke: theme.stroke, radius: 9, marks: [] });
    expect(looks.box(box("m01#0"), near, theme)).toEqual({ fill: theme.surface, radius: 6, marks: [] });
  });

  it("shows the state of the topic of a part with a sign at the left end of its row", () => {
    const changed = looks.box(box("m04#1"), near, theme)?.marks;
    const open = looks.box(box("m05#1"), near, theme)?.marks;
    expect(changed).toEqual([{ shape: "dot", x: 6, y: box("m04#1").h / 2, radius: 2.5, color: theme.accent }]);
    expect(open).toEqual([{ shape: "ring", x: 6, y: box("m05#1").h / 2, radius: 2.75, color: theme.open, width: 1.5 }]);
  });

  it("puts the sign of an entry in its text row", () => {
    const first = { id: "touches:e01:water", source: "e01", target: "water", data: { kind: "touches", choice: "e01", state: "proposed", rank: 1 } };
    const next = threadPicture({ ...thread.document, edges: [...(thread.document.edges ?? []), first] }, fakeAdvance, { keep: thread });
    const mark = withState({ thread: next }, () => looks.box(box("e01"), near, theme)?.marks?.[0]);
    expect(mark?.x).toBe(MESSAGE_LOOK.padding + 6);
    expect(mark?.y).toBeGreaterThan(MESSAGE_LOOK.header);
    expect(mark?.y).toBeLessThan(box("e01").h);
  });

  it("makes a pill of a topic, with less color when the topic is done", () => {
    const size = thread.sizes.get("water");
    const radius = size !== undefined && isTopicLook(size.look) ? size.look.radius : undefined;
    expect(looks.box(box("water"), near, theme)).toEqual({ fill: theme.topicFill, radius, opacity: 1, ring: undefined });
    expect(looks.box(box("fence"), near, theme)?.opacity).toBe(DONE_OPACITY);
    expect(looks.box(box("water"), far, theme)?.fill).toBe(theme.edge);
  });

  it("puts a ring around a topic with a highlight, and around the topic that the page points at", () => {
    const ring = { color: theme.accent, width: 2, gap: 3 };
    expect(looks.box(box("water"), { ...far, highlight: 1 }, theme)).toMatchObject({ fill: theme.topicFill, ring });
    expect(withState({ hint: { topic: "water" } }, () => looks.box(box("water"), near, theme)?.ring)).toEqual(ring);
    expect(withState({ hint: { topic: "water" } }, () => looks.box(box("north"), near, theme)?.ring)).toBeUndefined();
  });

  it("gives the accent to the border of a box with a highlight", () => {
    expect(looks.box(box("m01"), { ...near, highlight: 2 }, theme)).toMatchObject({ stroke: theme.accent, width: 2 });
    expect(looks.box(box("m01#0"), { ...near, highlight: 1 }, theme)).toMatchObject({ stroke: theme.accent, width: 1 });
  });

  it("makes an entry that waits stand out, with all its inside in the color in a far view", () => {
    expect(looks.box(box("e04"), near, theme)).toEqual({ fill: theme.waitsFill, stroke: theme.waits, width: WAITS_WIDTH, radius: 9, marks: [] });
    expect(looks.box(box("e04"), far, theme)).toMatchObject({ fill: theme.waits, stroke: theme.waits, width: WAITS_WIDTH });
    expect(looks.box(box("e04"), { ...near, highlight: 2 }, theme)).toMatchObject({ fill: theme.waitsFill, stroke: theme.accent });
    expect(looks.box(box("e01"), far, theme)).toMatchObject({ fill: theme.surface, stroke: theme.stroke });
  });

  it("uses the colors of a part with no topic and of a row for a theme with no colors of an entry that waits", () => {
    const { waits: _waits, waitsFill: _fill, ...old } = theme;
    expect(waitsColor(old)).toBe(theme.open);
    expect(looks.box(box("e04"), near, old)).toMatchObject({ fill: theme.surface, stroke: theme.open, width: WAITS_WIDTH });
    expect(looks.box(box("e04"), far, old)).toMatchObject({ fill: theme.open });
  });
});

describe("the look of a route", () => {
  it("shows a chosen topic, a reply and a relation", () => {
    expect(looks.route(route("touches:m01#0:water"), near, theme)).toEqual({ stroke: theme.edge, width: 1.25, start: { shape: "dot", size: 2.75 } });
    expect(looks.route(route("reply:m01:m02"), near, theme)).toEqual({ stroke: theme.edgeStrong, width: 1.5, end: { shape: "arrow", size: 7 } });
    expect(looks.route(route("relates:trench:water"), near, theme)).toEqual({ stroke: theme.edge, width: 1.5, dash: [1, 5], end: { shape: "arrow", size: 6 } });
    expect(looks.route(route("relates:fence:trench"), near, theme)?.end).toBeUndefined();
  });

  it("makes the line of a chosen topic thin and light in a far view, and keeps the accent of a highlight", () => {
    const chosen = route("touches:m01#0:water");
    expect(looks.route(chosen, far, theme)).toEqual({ stroke: theme.edge, width: 1, opacity: FAR_LINE_OPACITY });
    expect(looks.route(chosen, { ...far, highlight: 1 }, theme)).toEqual({ stroke: theme.accent, width: 2, start: { shape: "dot", size: 2.75 } });
    expect(looks.route(route("reply:m01:m02"), far, theme)).toEqual(looks.route(route("reply:m01:m02"), near, theme));
  });

  it("hides a proposal until a person shows each proposal or selects its part", () => {
    const proposal = route("touches:m01#0:north");
    expect(looks.route(proposal, near, theme)).toBeUndefined();
    expect(withState({ proposals: true }, () => looks.route(proposal, near, theme))).toEqual({ stroke: theme.edge, width: 1.25, dash: [5, 5], opacity: PROPOSAL_OPACITY });
    expect(withState({ part: "m01#0" }, () => looks.route(proposal, near, theme))?.opacity).toBe(1);
    expect(withState({ part: "m01#1" }, () => looks.route(proposal, near, theme))).toBeUndefined();
  });

  it("gives the accent to a route of the focus, a route with a highlight and the route that the page points at", () => {
    const chosen = route("touches:m01#0:water");
    const lit = { stroke: theme.accent, width: 2 };
    expect(looks.route(chosen, { ...near, focus: "in" }, theme)).toMatchObject(lit);
    expect(looks.route(chosen, { ...near, highlight: 1 }, theme)).toMatchObject(lit);
    expect(withState({ hint: { topic: "water", edge: chosen.id } }, () => looks.route(chosen, near, theme))).toMatchObject(lit);
    expect(looks.route(chosen, { ...near, focus: "beside" }, theme)?.stroke).toBe(theme.edge);
  });

  it("gives no look to a part edge and to a refused proposal", () => {
    const base = { id: "x", source: "m01", target: "m01#0", path: [] };
    expect(looks.route({ ...base, data: { kind: "part" } }, near, theme)).toBeUndefined();
    expect(withState({ proposals: true }, () => looks.route({ ...base, data: { kind: "touches", state: "refused" } }, near, theme))).toBeUndefined();
  });
});

describe("the look of a label", () => {
  it("shows the text of a near view", () => {
    expect(labelLook(labelId("text", "m01#0"), "m01#0", near)).toEqual({ color: theme.text });
    expect(labelLook(labelId("date", "m01"), "m01", near)).toEqual({ color: theme.muted });
    expect(labelLook(labelId("text", "water"), "water", near)).toEqual({ color: theme.topicText });
    expect(labelLook(labelId("count", "water"), "water", near)).toEqual({ color: theme.topicText, opacity: 0.72 });
  });

  it("tells who an entry waits on in a near view only, in the color of that entry", () => {
    expect(labelLook(labelId("waits", "e04"), "e04", near)).toEqual({ color: theme.waits });
    expect(labelLook(labelId("waits", "e04"), "e04", far)).toBeUndefined();
  });

  it("makes bars of the text of a part in a far view, and no paint of a very small text", () => {
    expect(labelLook(labelId("text", "m01#0"), "m01#0", far)).toEqual({ color: theme.quiet, as: "bars" });
    expect(labelLook(labelId("text", "m01#0"), "m01#0", { ...near, zoom: 0.1 })).toBeUndefined();
    expect(labelLook(labelId("date", "m01"), "m01", far)).toBeUndefined();
  });

  it("keeps the name of a topic at a height that a person reads in a far view", () => {
    const size = thread.sizes.get("trench");
    const least = farNameLine(size !== undefined && isTopicLook(size.look) ? size.look.size : 0);
    expect(labelLook(labelId("text", "trench"), "trench", far)).toEqual({ color: theme.text, halo: theme.background, least, opacity: 1 });
    expect(labelLook(labelId("text", "trench"), "trench", { ...far, highlight: 1 })?.color).toBe(theme.accent);
    expect(labelLook(labelId("text", "fence"), "fence", far)?.opacity).toBe(0.6);
    expect(labelLook(labelId("count", "trench"), "trench", far)).toBeUndefined();
    expect(farNameLine(24)).toBeGreaterThan(farNameLine(15));
  });
});
