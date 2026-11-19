import type { PictureBox, PictureLabel, PictureRoute } from "@mark1russell7/layout-contract";
import { KEPT_GAP, type RecordState } from "@mark1russell7/visuals/graph";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { DONE_OPACITY, FAR_LINE_OPACITY, farNameLine, GROUP_LIT_OPACITY, GROUP_NAME_LEAST, GROUP_NAME_LINE, GROUP_OPACITY, GROUP_RADIUS, groupNameLine, INNER_TOPIC_LINE, LIGHT_THREAD_THEME, PANEL_DASH, PANEL_NAME_LINE, PANEL_RADIUS, PROPOSAL_OPACITY, TEXT_ZOOM, threadLooks, TOPIC_NAME_PAD, WAITS_WIDTH, waitsColor, type ThreadLookState } from "./looks.ts";
import { panelId, withPanels } from "./panel.test-util.ts";
import { labelId, threadPicture } from "./picture.ts";
import { sampleThread } from "./sample.ts";
import { flatSample } from "./sample.test-util.ts";
import { GROUP_LOOK, isTopicLook, MESSAGE_LOOK } from "./sizes.ts";

const thread = threadPicture(flatSample(), fakeAdvance, { timeZone: "UTC" });
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
    // A topic has the same colors at each zoom: in a far view, its pill becomes larger around its name.
    expect(looks.box(box("water"), far, theme)).toEqual(looks.box(box("water"), near, theme));
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

describe("the look of a panel", () => {
  const id = panelId("m10#0");
  const withPanel = threadPicture(withPanels(flatSample(), "m10#0"), fakeAdvance, { timeZone: "UTC" });
  const panelLooks = threadLooks(() => ({ thread: withPanel, proposals: false }));
  const found = <T>(record: T | undefined): T => {
    if (record === undefined) throw new Error("no record of the panel");
    return record;
  };
  const panel = found(withPanel.picture.boxes.find((entry) => entry.id === id));
  const line = found(withPanel.picture.routes.find((entry) => entry.target === id));
  const name = found(withPanel.picture.labels.find((entry) => entry.box === id));

  it("makes an empty card of a panel, with a strong border and the accent of a highlight", () => {
    expect(panelLooks.box(panel, near, theme)).toEqual({ fill: theme.surface, stroke: theme.edgeStrong, width: 1, radius: PANEL_RADIUS });
    expect(panelLooks.box(panel, far, theme)).toEqual({ fill: theme.surface, stroke: theme.edgeStrong, width: 1, radius: PANEL_RADIUS });
    expect(panelLooks.box(panel, { ...near, highlight: 2 }, theme)).toEqual({ fill: theme.surface, stroke: theme.accent, width: 2, radius: PANEL_RADIUS });
  });

  it("makes a line of short dashes of the edge of a panel, in each view and with no proposal shown", () => {
    const dashes = { stroke: theme.edgeStrong, width: 1.25, dash: PANEL_DASH };
    expect(panelLooks.route(line, near, theme)).toEqual(dashes);
    expect(panelLooks.route(line, far, theme)).toEqual(dashes);
    expect(panelLooks.route(line, { ...near, highlight: 1 }, theme)).toEqual({ stroke: theme.accent, width: 2, dash: PANEL_DASH });
    // An edge of a different kind with a panel at an end is a line of a panel also.
    expect(panelLooks.route({ ...line, data: { kind: "relates" } }, near, theme)).toEqual(dashes);
  });

  it("shows the name of a panel only in a far view, where the content of the page is not visible", () => {
    const of = { type: "box", id, box: panel } as const;
    expect(panelLooks.label(name, near, theme, of)).toBeUndefined();
    expect(panelLooks.label(name, far, theme, of)).toEqual({ color: theme.text, halo: theme.surface, least: PANEL_NAME_LINE });
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

  it("keeps the name of a topic in its pill, at a height that a person reads in a far view", () => {
    const size = thread.sizes.get("trench");
    const least = farNameLine(size !== undefined && isTopicLook(size.look) ? size.look.size : 0);
    // The pill becomes larger around the name, so the name has the color of the text of a topic.
    expect(labelLook(labelId("text", "trench"), "trench", far)).toEqual({ color: theme.topicText, least, boxed: TOPIC_NAME_PAD });
    // The ring of the pill shows a highlight, and the pill of a topic that is done has less color.
    expect(labelLook(labelId("text", "trench"), "trench", { ...far, highlight: 1 })).toEqual(labelLook(labelId("text", "trench"), "trench", far));
    expect(labelLook(labelId("text", "fence"), "fence", far)).not.toHaveProperty("opacity");
    expect(labelLook(labelId("count", "trench"), "trench", far)).toBeUndefined();
    expect(farNameLine(24)).toBeGreaterThan(farNameLine(15));
  });
});

describe("the look of a group", () => {
  const source = sampleThread();
  const nested = threadPicture(source, fakeAdvance, { timeZone: "UTC" });
  const lit: RecordState = { ...near, highlight: 1 };
  const looksOf = (picture: typeof nested) => {
    const made = threadLooks(() => ({ thread: picture, proposals: false }));
    const boxOf = (id: string): PictureBox => {
      const found = picture.picture.boxes.find((entry) => entry.id === id);
      if (found === undefined) throw new Error(`no box ${id}`);
      return found;
    };
    return {
      box: (id: string, at: RecordState) => made.box(boxOf(id), at, theme),
      label: (role: "text" | "sign" | "issue", id: string, at: RecordState) => {
        const found = picture.picture.labels.find((entry) => entry.id === labelId(role, id));
        if (found === undefined) throw new Error(`no label ${role} of ${id}`);
        return made.label(found, at, theme, { type: "box", id, box: boxOf(id) });
      },
    };
  };
  const group = looksOf(nested);

  it("is a frame that lets the page show through it, darker with the pointer on it", () => {
    expect(group.box("water", { ...near, container: true })).toEqual({ fill: theme.quiet, stroke: theme.muted, width: 1, radius: GROUP_RADIUS, opacity: GROUP_OPACITY });
    expect(group.box("t01", near)).toEqual(group.box("water", near));
    expect(group.box("water", lit)).toEqual({ fill: theme.quiet, stroke: theme.accent, width: 2, radius: GROUP_RADIUS, opacity: GROUP_LIT_OPACITY });
    expect(GROUP_LIT_OPACITY).toBeGreaterThan(GROUP_OPACITY);
  });

  it("keeps the look of a topic and of an entry in a group", () => {
    expect(group.box("rota", near)).toMatchObject({ fill: theme.topicFill });
    expect(group.box("e01", near)).toMatchObject({ fill: theme.surface, stroke: theme.stroke, radius: 9 });
  });

  it("keeps a smaller name for a topic in a group, in a far view", () => {
    expect(group.label("text", "rota", far)).toEqual({ color: theme.topicText, least: INNER_TOPIC_LINE, boxed: TOPIC_NAME_PAD });
    expect(INNER_TOPIC_LINE).toBeLessThan(farNameLine(15));
  });

  it("keeps the name of a group in a far view, larger for a group at the top", () => {
    expect(group.label("text", "water", near)).toEqual({ color: theme.text });
    expect(group.label("text", "water", lit)).toEqual({ color: theme.accent });
    expect(group.label("text", "water", far)).toEqual({ color: theme.text, halo: theme.background, least: groupNameLine(far.zoom, true) });
    expect(group.label("text", "trench", far)).toEqual({ color: theme.text, halo: theme.background, least: groupNameLine(far.zoom, false) });
    expect(GROUP_NAME_LINE.top).toBeGreaterThan(GROUP_NAME_LINE.inner);
  });

  it("gives the name of a group the height of its header on the screen, between the two limits", () => {
    // At the zoom where a far view starts, the header has room for the largest name.
    expect(groupNameLine(TEXT_ZOOM, true)).toBe(GROUP_NAME_LINE.top);
    expect(groupNameLine(TEXT_ZOOM, false)).toBe(GROUP_NAME_LINE.inner);
    expect(groupNameLine(0.5, true)).toBeCloseTo(GROUP_LOOK.header * 0.5 - KEPT_GAP - 1);
    expect(groupNameLine(0.5, false)).toBe(groupNameLine(0.5, true));
    expect(groupNameLine(0.1, true)).toBe(GROUP_NAME_LEAST);
    expect(groupNameLine(0.1, false)).toBe(GROUP_NAME_LEAST);
  });

  it("gives a group and a group in it room for their two names, down to the smallest name", () => {
    // The names of a group and of a group in it are one header apart. The stage keeps `KEPT_GAP` between two names.
    for (const zoom of [0.69, 0.6, 0.57, 0.5, 0.48]) {
      const apart = GROUP_LOOK.header * zoom;
      expect((groupNameLine(zoom, true) + groupNameLine(zoom, false)) / 2 + KEPT_GAP, String(zoom)).toBeLessThanOrEqual(apart);
      expect(groupNameLine(zoom, false) + KEPT_GAP, String(zoom)).toBeLessThanOrEqual(apart);
    }
  });

  it("gives the finding of a group the color of a sign that asks for work, and hides it in a far view", () => {
    const boxes = source.boxes.map((entry) => (entry.id === "water" ? { ...entry, data: { ...entry.data, layout: "spiral" } } : entry));
    const bad = looksOf(threadPicture({ ...source, boxes }, fakeAdvance, { timeZone: "UTC" }));
    for (const role of ["sign", "issue"] as const) {
      expect(bad.label(role, "water", near)).toEqual({ color: theme.open });
      expect(bad.label(role, "water", far)).toBeUndefined();
    }
    expect(bad.label("text", "water", near)).toEqual({ color: theme.text });
  });
});
