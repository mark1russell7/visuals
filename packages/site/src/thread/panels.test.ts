import type { Rect } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { fakeAdvance } from "./advance.test-util.ts";
import { threadKinds, type ThreadDocument } from "./document.ts";
import { panelBox, panelEdge, panelId, withPanels } from "./panel.test-util.ts";
import { PANEL_GAP, PANEL_SIDES, panelId as idOf, placePanels, splitPanels, withPanel, type PanelPlaces, type PanelSide } from "./panels.ts";
import { placeThread } from "./place.ts";
import { SAMPLE_ANSWER, sampleThread } from "./sample.ts";
import { PANEL_LOOK, threadSizes } from "./sizes.ts";

/** A tolerance for the sums of floats of a push. */
const CLOSE = 1e-3;

/** This function gives the space between two rectangles on the axis that has more space. It is below 0 for two rectangles with an area in common. */
const space = (a: Rect, b: Rect): number => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));

/** This function tells if a rectangle is in a different rectangle, with a tolerance for the sums of floats. */
const inside = (inner: Rect, outer: Rect): boolean => inner.x >= outer.x - CLOSE && inner.y >= outer.y - CLOSE && inner.x + inner.w <= outer.x + outer.w + CLOSE && inner.y + inner.h <= outer.y + outer.h + CLOSE;

/** This function places the panels of a document on the places `base` of its other boxes. */
const place = (document: ThreadDocument, base: ReadonlyMap<string, Rect>, before?: ReadonlyMap<string, PanelSide>): PanelPlaces => {
  const { panels } = splitPanels(document, threadKinds(document));
  return placePanels(document, panels, threadSizes(document, fakeAdvance), base, before);
};

/** This function gives the boxes that are in no box, with their places. */
const tops = (document: ThreadDocument, places: ReadonlyMap<string, Rect>): [string, Rect][] =>
  document.boxes.flatMap((box): [string, Rect][] => {
    const at = places.get(box.id);
    return box.parent === undefined && at !== undefined ? [[box.id, at]] : [];
  });

/** This function gives each pair of boxes that are in no box and have an area in common. */
const hits = (document: ThreadDocument, places: ReadonlyMap<string, Rect>): string[] => {
  const top = tops(document, places);
  return top.flatMap(([a, at], i) => top.slice(i + 1).flatMap(([b, other]) => (space(at, other) < -CLOSE ? [`${a} on ${b}`] : [])));
};

const card = (x: number, y: number): Rect => ({ x, y, w: 100, h: 50 });

/** An entry `a` with one entry at each side of it, each at the gap of a panel. */
const CROSS: readonly (readonly [string, Rect])[] = [
  ["a", card(0, 0)],
  ["right", card(100 + PANEL_GAP, 0)],
  ["below", card(0, 50 + PANEL_GAP)],
  ["left", card(-100 - PANEL_GAP, 0)],
  ["above", card(0, -50 - PANEL_GAP)],
];

/** This function gives the document and the places of `CROSS` with no entry of `gone`, and with a panel of `a`. */
const cross = (...gone: readonly string[]): { document: ThreadDocument; base: Map<string, Rect> } => {
  const kept = CROSS.filter(([id]) => !gone.includes(id));
  return { document: { id: "cross", boxes: [...kept.map(([id]) => ({ id, data: { label: id } })), panelBox("a")], edges: [panelEdge("a")] }, base: new Map(kept) };
};

const panel = panelId("a");
const size = { w: PANEL_LOOK.width, h: PANEL_LOOK.height };

describe("withPanel", () => {
  const sample = sampleThread();

  it("adds the panel of an action and its edge after the records of the document", () => {
    const next = withPanel(sample, "e01", SAMPLE_ANSWER);
    expect(next).toEqual(withPanels(sample, "e01"));
    expect(next.boxes.at(-1)).toEqual({ id: "panel:answer:e01", data: { kinds: ["panel"], label: "Answer", of: "e01" } });
    expect(next.edges?.at(-1)).toEqual({ id: "to:panel:answer:e01", source: "e01", target: "panel:answer:e01", data: { kind: "panel" } });
    expect(idOf("m01#0", "comment")).toBe("panel:comment:m01#0");
    expect(threadKinds(next).get(idOf("e01", SAMPLE_ANSWER.id))).toBe("panel");
  });

  it("does not change the document of the argument, and gives it for a panel that it has and for an id that is not a box", () => {
    const before = JSON.stringify(sample);
    const next = withPanel(sample, "e01", SAMPLE_ANSWER);
    expect(JSON.stringify(sample)).toBe(before);
    expect(withPanel(next, "e01", SAMPLE_ANSWER)).toBe(next);
    expect(withPanel(sample, "nowhere", SAMPLE_ANSWER)).toBe(sample);
    expect(withPanel(next, "e01", { id: "comment", title: "Comment" }).boxes).toHaveLength(next.boxes.length + 1);
  });
});

describe("splitPanels", () => {
  const sample = sampleThread();

  it("gives the document itself for a document with no panel", () => {
    const split = splitPanels(sample, threadKinds(sample));
    expect(split.plain).toBe(sample);
    expect(split.panels).toEqual([]);
    expect(split.edges).toEqual([]);
  });

  it("takes each panel and each edge of a panel out of the document", () => {
    const loose = { id: "loose", source: "m01#0", target: panelId("e01"), data: { kind: "relates" } };
    const named = { id: "named", source: "m01#0", target: "water", data: { kind: "panel" } };
    const document = { ...withPanels(sample, "e01", "m02#0"), edges: [...(withPanels(sample, "e01", "m02#0").edges ?? []), loose, named] };
    const split = splitPanels(document, threadKinds(document));
    expect(split.plain.boxes).toEqual(sample.boxes);
    expect(split.plain.edges).toEqual(sample.edges);
    expect(split.plain.id).toBe(sample.id);
    expect(split.panels.map((box) => box.id)).toEqual([panelId("e01"), panelId("m02#0")]);
    expect(split.edges).toEqual([panelEdge("e01"), panelEdge("m02#0"), loose, named]);
  });
});

describe("placePanels", () => {
  it("gives the places of the argument for a document with no panel", () => {
    const base = new Map(CROSS);
    const made = placePanels({ id: "cross", boxes: CROSS.map(([id]) => ({ id })) }, [], new Map(), base);
    expect(made.places).toBe(base);
    expect(made.sides.size).toBe(0);
  });

  it("puts a panel at the gap on the first free side of its box", () => {
    const cases: readonly (readonly [readonly string[], PanelSide, Rect])[] = [
      [["right", "below", "left", "above"], "right", { x: 100 + PANEL_GAP, y: 0, ...size }],
      [["below"], "below", { x: 0, y: 50 + PANEL_GAP, ...size }],
      [["left"], "left", { x: -PANEL_GAP - size.w, y: 0, ...size }],
      [["above"], "above", { x: 0, y: -PANEL_GAP - size.h, ...size }],
    ];
    for (const [gone, side, rect] of cases) {
      const { document, base } = cross(...gone);
      const made = place(document, base);
      expect(made.sides.get(panel)).toBe(side);
      expect(made.places.get(panel)).toEqual(rect);
      // A panel on a free side moves no box: each other box has the rectangle of the argument.
      for (const [id, at] of base) expect(made.places.get(id)).toBe(at);
    }
    expect(PANEL_SIDES).toEqual(["right", "below", "left", "above"]);
  });

  it("puts the top of a panel at the top of its row, at the side of the card of the row", () => {
    const document: ThreadDocument = { id: "rows", boxes: [{ id: "m" }, { id: "m#0", parent: "m", data: { label: "one" } }, { id: "m#1", parent: "m", data: { label: "two" } }, panelBox("m#1")], edges: [panelEdge("m#1")] };
    const base = new Map<string, Rect>([
      ["m", { x: 0, y: 0, w: 200, h: 120 }],
      ["m#0", { x: 10, y: 40, w: 180, h: 30 }],
      ["m#1", { x: 10, y: 80, w: 180, h: 30 }],
    ]);
    expect(place(document, base).places.get(panelId("m#1"))).toEqual({ x: 200 + PANEL_GAP, y: 80, ...size });
  });

  it("keeps the side of a panel of before", () => {
    const { document, base } = cross("right", "below", "left", "above");
    for (const side of PANEL_SIDES) expect(place(document, base, new Map([[panel, side]])).sides.get(panel)).toBe(side);
    expect(place(document, base, new Map([[panel, "left"]])).places.get(panel)).toEqual({ x: -PANEL_GAP - size.w, y: 0, ...size });
  });

  it("pushes the boxes that are too near when no side is free, and does not change the places of the argument", () => {
    const { document, base } = cross();
    const made = place(document, base);
    const at = made.places.get(panel) ?? card(0, 0);
    // Each side has one entry, so each push moves one box: the first side is the side.
    expect(made.sides.get(panel)).toBe("right");
    expect(at).toEqual({ x: 100 + PANEL_GAP, y: 0, ...size });
    // The entry at the right goes along the axis of its smaller overlap, away from the center of the panel.
    const pushed = made.places.get("right");
    expect(pushed?.x).toBe(100 + PANEL_GAP);
    expect(pushed?.y).toBeCloseTo(-50 - PANEL_GAP, 3);
    for (const id of ["a", "below", "left", "above"]) expect(made.places.get(id)).toBe(base.get(id));
    for (const [id, rect] of tops(document, made.places)) if (id !== panel) expect(space(at, rect)).toBeGreaterThanOrEqual(PANEL_GAP - CLOSE);
    expect(hits(document, made.places)).toEqual([]);
    expect([...base]).toEqual(CROSS);
  });

  it("goes to the side where it pushes the fewest boxes", () => {
    // The right has 2 entries in the area of the panel, and each other side has 1 entry.
    const more = [...CROSS, ["far", card(100 + PANEL_GAP, 50 + PANEL_GAP)] as const];
    const document: ThreadDocument = { id: "more", boxes: [...more.map(([id]) => ({ id, data: { label: id } })), panelBox("a")], edges: [panelEdge("a")] };
    const made = place(document, new Map(more));
    expect(made.sides.get(panel)).toBe("left");
    expect(hits(document, made.places)).toEqual([]);
  });

  it("moves the parts of a pushed card with the card", () => {
    const document: ThreadDocument = {
      id: "parts",
      boxes: [{ id: "a", data: { label: "a" } }, { id: "m" }, { id: "m#0", parent: "m", data: { label: "one" } }, { id: "m#1", parent: "m", data: { label: "two" } }, panelBox("a")],
      edges: [panelEdge("a")],
    };
    const base = new Map<string, Rect>([
      ["a", card(0, 0)],
      ["m", { x: 100 + PANEL_GAP, y: 0, w: 200, h: 120 }],
      ["m#0", { x: 110 + PANEL_GAP, y: 40, w: 180, h: 30 }],
      ["m#1", { x: 110 + PANEL_GAP, y: 80, w: 180, h: 30 }],
    ]);
    const made = place(document, base, new Map([[panel, "right"]]));
    const move = (id: string): { dx: number; dy: number } => ({ dx: (made.places.get(id)?.x ?? 0) - (base.get(id)?.x ?? 0), dy: (made.places.get(id)?.y ?? 0) - (base.get(id)?.y ?? 0) });
    expect(Math.abs(move("m").dx) + Math.abs(move("m").dy)).toBeGreaterThan(PANEL_GAP);
    for (const part of ["m#0", "m#1"]) {
      expect(move(part).dx).toBeCloseTo(move("m").dx, 6);
      expect(move(part).dy).toBeCloseTo(move("m").dy, 6);
    }
    expect(space(made.places.get(panel) ?? card(0, 0), made.places.get("m") ?? card(0, 0))).toBeGreaterThanOrEqual(PANEL_GAP - CLOSE);
  });

  it("gives the second panel of a box the next free side", () => {
    const { document, base } = cross("right", "below", "left", "above");
    const two: ThreadDocument = { ...document, boxes: [...document.boxes, panelBox("a", "close")], edges: [...(document.edges ?? []), panelEdge("a", "close")] };
    const made = place(two, base);
    // The first panel is at the right, and it is taller than the entry. Thus the place below the entry is not free.
    expect(made.sides.get(panel)).toBe("right");
    expect(made.sides.get(panelId("a", "close"))).toBe("left");
    expect(made.places.get("a")).toBe(base.get("a"));
    expect(hits(two, made.places)).toEqual([]);
  });

  it("puts a panel with no box of its field next to the first card", () => {
    const { document, base } = cross("right", "below", "left", "above");
    const lost: ThreadDocument = { id: "lost", boxes: [...document.boxes.filter((box) => box.id !== panel), panelBox("gone")] };
    expect(place(lost, base).places.get(panelId("gone"))).toEqual({ x: 100 + PANEL_GAP, y: 0, ...size });
  });

  it("holds the gap and the cards for a panel at each side of each box of the sample", () => {
    const sample = sampleThread();
    const kinds = threadKinds(sample);
    const base = placeThread(sample, threadSizes(sample, fakeAdvance));
    expect(hits(sample, base)).toEqual([]);
    const sides: readonly (PanelSide | undefined)[] = [undefined, ...PANEL_SIDES];
    const problems: string[] = [];
    let pushes = 0;
    for (const box of sample.boxes) {
      if (kinds.get(box.id) === "message") continue;
      const document = withPanels(sample, box.id);
      const id = panelId(box.id);
      for (const side of sides) {
        const made = place(document, base, side === undefined ? undefined : new Map([[id, side]]));
        const name = `${box.id} ${side ?? "free"}`;
        const at = made.places.get(id);
        if (at === undefined || made.places.size !== base.size + 1) {
          problems.push(`${name}: no place`);
          continue;
        }
        if (sample.boxes.some((other) => made.places.get(other.id) !== base.get(other.id))) pushes += 1;
        for (const [other, rect] of tops(document, made.places)) if (other !== id && space(at, rect) < PANEL_GAP - CLOSE) problems.push(`${name}: near ${other}`);
        for (const hit of hits(document, made.places)) problems.push(`${name}: ${hit}`);
        for (const other of sample.boxes) {
          const rect = made.places.get(other.id);
          const before = base.get(other.id);
          const parent = other.parent === undefined ? undefined : made.places.get(other.parent);
          if (rect === undefined || before === undefined || rect.w !== before.w || rect.h !== before.h) problems.push(`${name}: size of ${other.id}`);
          else if (parent !== undefined && !inside(rect, parent)) problems.push(`${name}: ${other.id} out of its card`);
        }
      }
    }
    expect(problems).toEqual([]);
    // The sample is dense, so many of these panels push a box.
    expect(pushes).toBeGreaterThan(20);
  });
});
