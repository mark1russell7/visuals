import { topBoxes, type LayoutEdge, type Rect } from "@mark1russell7/layout-contract";
import { pushCascade, Rect as PushRect } from "@mark1russell7/packing/push";
import { edgeKind, panelOf, type ThreadAction, type ThreadBox, type ThreadDocument, type ThreadKind } from "./document.ts";
import { sizedBoxes } from "./place.ts";
import type { LeafSize } from "./sizes.ts";

/** The space between a panel and its box, and between a panel and each box that the panel pushes. */
export const PANEL_GAP = 24;

/** The sides of a box for its panel, in the order of the search for a free side. */
export const PANEL_SIDES = ["right", "below", "left", "above"] as const;

/** The side of a box that has its panel. */
export type PanelSide = (typeof PANEL_SIDES)[number];

/** A small length for the rounding of a sum. Two rectangles at the gap are not too near. */
const ROUNDING = 1e-6;

/** This function gives the id of the panel of an action of a box. */
export function panelId(of: string, action: string): string {
  return `panel:${action}:${of}`;
}

/**
 * This function gives a document with the panel of an action of a box. The function does not change the document of the argument.
 *
 * - The panel is an empty box after the boxes of the document. It has the name of the action.
 * - An edge of the kind `panel` goes from the box to the panel.
 * - The result is the document of the argument when it has the panel, and for an id that is not a box.
 */
export function withPanel(document: ThreadDocument, of: string, action: ThreadAction): ThreadDocument {
  const id = panelId(of, action.id);
  if (document.boxes.some((box) => box.id === id) || !document.boxes.some((box) => box.id === of)) return document;
  return {
    ...document,
    boxes: [...document.boxes, { id, data: { kinds: ["panel"], label: action.title, of } }],
    edges: [...(document.edges ?? []), { id: `to:${id}`, source: of, target: id, data: { kind: "panel" } }],
  };
}

/** A document in two parts: its panels with their edges, and each other record. */
export interface PanelSplit {
  /** The document with no panel and no edge of a panel. It is the document itself when the document has none. */
  readonly plain: ThreadDocument;
  /** The panels, in the order of the document. */
  readonly panels: readonly ThreadBox[];
  /** The edges of the panels: each edge of the kind `panel`, and each edge with a panel at an end. */
  readonly edges: readonly LayoutEdge[];
}

/**
 * This function takes the panels and their edges out of a document. `kinds` has the kind of each box.
 * The layout and the routes of the other boxes read the document with no panel, so a panel changes no place and no line of them.
 */
export function splitPanels(document: ThreadDocument, kinds: ReadonlyMap<string, ThreadKind>): PanelSplit {
  const isPanel = (id: string): boolean => kinds.get(id) === "panel";
  const panels = document.boxes.filter((box) => isPanel(box.id));
  const edges = (document.edges ?? []).filter((edge) => edgeKind(edge) === "panel" || isPanel(edge.source) || isPanel(edge.target));
  if (panels.length === 0 && edges.length === 0) return { plain: document, panels, edges };
  const own = new Set(edges);
  return { plain: { ...document, boxes: document.boxes.filter((box) => !isPanel(box.id)), edges: (document.edges ?? []).filter((edge) => !own.has(edge)) }, panels, edges };
}

/** The places of the boxes of a document with panels. */
export interface PanelPlaces {
  /** The rectangle of each box, by its id: each panel, and each other box after the pushes of the panels. */
  readonly places: ReadonlyMap<string, Rect>;
  /** The side of each panel, by its id. */
  readonly sides: ReadonlyMap<string, PanelSide>;
}

/**
 * This function gives the rectangle of a panel on a side of a card. `row` is the box in the card that the panel is for.
 * On the right and on the left, the top of the panel is the top of the row. Below and above, its left is the left of the card.
 */
function panelRect(side: PanelSide, card: Rect, row: Rect, size: Pick<LeafSize, "w" | "h">): Rect {
  const { w, h } = size;
  if (side === "right") return { x: card.x + card.w + PANEL_GAP, y: row.y, w, h };
  if (side === "left") return { x: card.x - PANEL_GAP - w, y: row.y, w, h };
  if (side === "below") return { x: card.x, y: card.y + card.h + PANEL_GAP, w, h };
  return { x: card.x, y: card.y - PANEL_GAP - h, w, h };
}

/** This function tells if a rectangle is nearer than the gap to a rectangle of a list. */
function isNear(rect: Rect, others: Iterable<Rect>): boolean {
  const reach = PANEL_GAP - ROUNDING;
  for (const other of others) {
    if (rect.x < other.x + other.w + reach && other.x < rect.x + rect.w + reach && rect.y < other.y + other.h + reach && other.y < rect.y + rect.h + reach) return true;
  }
  return false;
}

/**
 * This function moves each rectangle that is nearer than the gap to a placed rectangle. It gives the move of each moved rectangle, by its id.
 * The moves come from the push cascade of `packing`. A rectangle goes along the axis of its smaller overlap, away from the pusher.
 * A moved rectangle pushes the next rectangles in the same direction. The cascade has a limit of 8 moves for each rectangle.
 */
function pushAway(placed: Rect, others: ReadonlyMap<string, Rect>): Map<string, { dx: number; dy: number }> {
  // The cascade reads an overlap. Thus each rectangle grows by one half of the gap: two rectangles that touch are then at the gap.
  const grow = PANEL_GAP / 2 - ROUNDING;
  // The cascade keeps each rectangle at 0 or more. Thus each rectangle starts far from 0, with room for the longest chain of pushes.
  let left = placed.x;
  let top = placed.y;
  let wide = placed.w + PANEL_GAP;
  let high = placed.h + PANEL_GAP;
  for (const rect of others.values()) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    wide += rect.w + PANEL_GAP;
    high += rect.h + PANEL_GAP;
  }
  const shift = { x: 2 * wide - left, y: 2 * high - top };
  const grown = (rect: Rect, id?: string): PushRect<string> => {
    const out = new PushRect<string>();
    if (id !== undefined) out.id = id;
    out.position.set(rect.x + shift.x, rect.y + shift.y);
    out.size.set(rect.w + 2 * grow, rect.h + 2 * grow);
    return out;
  };
  const starts = new Map<PushRect<string>, { x: number; y: number }>();
  const rects = [...others].map(([id, rect]) => {
    const made = grown(rect, id);
    starts.set(made, { x: made.position.x, y: made.position.y });
    return made;
  });
  const out = new Map<string, { dx: number; dy: number }>();
  for (const rect of pushCascade(grown(placed), rects, { gap: 0 })) {
    const start = starts.get(rect);
    // A rectangle that moved on one axis has the move 0 on the other axis, with no sum of floats.
    if (start !== undefined && rect.id !== undefined) out.set(rect.id, { dx: rect.position.x - start.x, dy: rect.position.y - start.y });
  }
  return out;
}

/**
 * This function places the panels of a document. `base` has the place of each other box, and `sizes` has the size of each panel.
 *
 * - A panel goes to a side of the card of its `data.of`, at `PANEL_GAP`. The first free side of `PANEL_SIDES` is its side.
 * - A panel of `before` keeps its side. Thus a change of the document does not move a panel around its box.
 * - A panel with no free side goes to the side where it pushes the fewest boxes: the first such side of `PANEL_SIDES`.
 * - There, the panel pushes each card, topic and panel that is nearer than the gap. The boxes of a pushed card move with it.
 * - Each push starts from `base`, so the boxes go back when the panel goes.
 * - A panel with no box of `data.of` in the picture goes next to the first card of the document.
 *
 * A document with no panel gives `base` itself.
 */
export function placePanels(document: ThreadDocument, panels: readonly ThreadBox[], sizes: ReadonlyMap<string, LeafSize>, base: ReadonlyMap<string, Rect>, before?: ReadonlyMap<string, PanelSide>): PanelPlaces {
  const sides = new Map<string, PanelSide>();
  if (panels.length === 0) return { places: base, sides };
  const tops = topBoxes(sizedBoxes(document, sizes));
  const places = new Map(base);
  /** Each card, topic and placed panel, with its place: the boxes that are in no box. */
  const cards = new Map<string, Rect>();
  /** The boxes in each card, by the id of the card. They move with the card. */
  const within = new Map<string, string[]>();
  for (const box of document.boxes) {
    const place = base.get(box.id);
    if (place === undefined) continue;
    const card = tops.get(box.id) ?? box.id;
    if (card === box.id) cards.set(box.id, place);
    else within.set(card, [...(within.get(card) ?? []), box.id]);
  }
  const [first] = cards.values();
  for (const panel of panels) {
    const size = sizes.get(panel.id);
    if (size === undefined) continue;
    const of = panelOf(panel);
    const own = of === undefined ? undefined : cards.get(tops.get(of) ?? of);
    const card = own ?? first ?? { x: 0, y: 0, w: 0, h: 0 };
    const row = (own === undefined || of === undefined ? undefined : places.get(of)) ?? card;
    const on = (side: PanelSide): Rect => panelRect(side, card, row, size);
    let side = before?.get(panel.id) ?? PANEL_SIDES.find((name) => !isNear(on(name), cards.values()));
    let moves: ReadonlyMap<string, { dx: number; dy: number }> | undefined;
    if (side === undefined) {
      // No side is free. The push of each side tells its cost, and the first side with the fewest moved boxes is the side.
      for (const name of PANEL_SIDES) {
        const pushed = pushAway(on(name), cards);
        if (moves !== undefined && pushed.size >= moves.size) continue;
        side = name;
        moves = pushed;
      }
    }
    side ??= "right";
    const place = on(side);
    for (const [id, move] of moves ?? pushAway(place, cards)) {
      for (const moved of [id, ...(within.get(id) ?? [])]) {
        const rect = places.get(moved);
        if (rect === undefined) continue;
        const next = { x: rect.x + move.dx, y: rect.y + move.dy, w: rect.w, h: rect.h };
        places.set(moved, next);
        if (moved === id) cards.set(id, next);
      }
    }
    places.set(panel.id, place);
    cards.set(panel.id, place);
    sides.set(panel.id, side);
  }
  return { places, sides };
}
