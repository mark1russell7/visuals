import { boxTree, siblingEdges, type BoxNode, type LayoutBox, type Rect } from "@mark1russell7/layout-contract";
import { createEngine, type EdgeSpec, type Engine, type LayoutRef, type NodeSpec } from "ireko";
import { forceStrategy, relaxForces, type RelaxNode } from "ireko/strategies/force";
import { isSpring, threadKinds, type ThreadBox, type ThreadDocument } from "./document.ts";
import { GROUP_LOOK, IMAGE_LOOK, MESSAGE_LOOK, type LeafSize } from "./sizes.ts";

/**
 * The options of the strategy `force` of `ireko` for the cards and the topics of a thread picture.
 * The default spring of the strategy is too long for cards, so the springs here are shorter.
 */
export const THREAD_FORCE = { iterations: 300, gap: 56, padding: 32, springLength: 240 } as const;

/** The options of `placeThread`. */
export interface PlaceOptions {
  /** More options of the strategy `force` of `ireko`. Each option replaces the option of `THREAD_FORCE` with the same name. */
  readonly force?: Readonly<Record<string, number>> | undefined;
  /**
   * The shape of the area that shows the picture: its width divided by its height. The picture gets about this shape.
   * A value out of `ASPECT_RANGE` becomes the nearest limit. With no value, the forces give the shape.
   */
  readonly aspect?: number | undefined;
  /**
   * The places of the cards and the topics before a change of the document, by the id of each box.
   * After a small change, each of these cards and topics keeps its top left corner. `keepsPlaces` tells if a change is small.
   * A box that is then on a different box moves, and each new box gets a place between them.
   * After a large change, each box gets a new place.
   */
  readonly before?: ReadonlyMap<string, Rect> | undefined;
}

/**
 * The least share of the cards and the topics that keep their place, for a change of a document that moves no box.
 * The share is of the boxes before the change, and of the boxes after it.
 */
export const KEEP_SHARE = 0.5;

/** The limits of the option `aspect` of `placeThread`. */
export const ASPECT_RANGE = { least: 0.4, most: 2.5 } as const;

/** The limits of the scale of the heights in the search of `placeThread`. */
const SCALE_RANGE = { least: 0.2, most: 8 } as const;

/**
 * The shape that the forces give to a picture of many cards with no scale: its width divided by its height.
 * It is the measure of pictures with 71, 136 and 278 cards: 0.58, 0.64 and 0.68.
 */
const FREE_SHAPE = 0.6;

/**
 * The limits of the first scale of the search of `placeThread`.
 * Below 1, a picture has much empty space. Above 3, a picture of many cards does not get wider.
 */
const FIRST_SCALE = { least: 1, most: 3 } as const;

/** The most layouts of the search of `placeThread`. */
const MOST_ROUNDS = 5;

/** The search of `placeThread` stops at this ratio between the shape of the picture and the shape of the area. */
const NEAR = 1.1;

/**
 * The work that the search of `placeThread` can use. One layout uses the square of the number of the cards and the topics.
 * Thus 100 cards get each layout of the search, and more than 158 cards get one layout.
 */
const SEARCH_WORK = MOST_ROUNDS * 100 ** 2;

/**
 * The option `theta` of the strategy `force` for a picture of many cards. A far group of boxes then pushes a box as one box.
 * Thus the time of the forces grows much less than the square of the number of the cards and the topics.
 */
export const FAR_THETA = 0.9;

/** The most cards and topics of a picture in which the forces read each pair of boxes. Such a picture keeps its exact places. */
export const EXACT_MOST = 150;

/** The id of the box that contains each box with no parent. A document cannot contain it. */
const ROOT = "\u0000root";

/** The end of the id of the text of an entry. An entry is a card with one row, and that row is not a box of the document. */
const TEXT = "\u0000text";

/** The layout of a card: one column of rows below a header. */
const CARD = { type: "grid", columns: 1, header: MESSAGE_LOOK.header, padding: MESSAGE_LOOK.padding, gap: MESSAGE_LOOK.gap } as const;

/** The layout of the first step of `placeThread`: one column of the cards and the topics. */
const COLUMN = { type: "grid", columns: 1, header: 0, padding: 0, gap: 0 } as const;

/** The settings of each layout of `placeThread`. */
const SETTINGS = { treeEdges: "none", audit: false, header: 0 } as const;

/** A rule of the layout of a group that names no layout. */
export interface LayoutRule {
  /** The most boxes in a group of this rule. */
  readonly most: number;
  /** The layout: the name of a strategy of the layout engine, with its options. */
  readonly layout: { readonly type: string; readonly [option: string]: unknown };
}

/**
 * The layout of a group that names none, by the number of the boxes in it. The first rule with room for the boxes is the rule of a group.
 * A few boxes are one column. More boxes are a grid with approximately as many columns as rows.
 */
export const GROUP_RULES: readonly LayoutRule[] = [
  { most: 3, layout: { type: "grid", columns: 1, justify: "start", align: "start" } },
  { most: Number.POSITIVE_INFINITY, layout: { type: "grid", columns: 0, justify: "start", align: "start" } },
];

/** This function makes the layout engine of a thread picture: the strategies of `ireko`, and its strategy `force`. */
export function threadEngine(): Engine {
  return createEngine({ strategies: [forceStrategy] });
}

/**
 * This function gives the layout of a group, for the layout engine. `count` is the number of the boxes in the group.
 *
 * - `data.layout` of the box is the name of a strategy of the engine, or an object with the name `type` and the options.
 * - A group with no `data.layout` gets the layout of the first rule with room for its boxes.
 * - The padding and the gap of `GROUP_LOOK` are the defaults. The header is always the header of `GROUP_LOOK`, because the picture draws the name there.
 *
 * The engine examines the name and the options. A `data.layout` of a different type goes to the engine as a layout with no name.
 * Thus a layout that is not good is a finding of the engine, and it is not a different layout with no sign.
 */
export function groupLayout(box: Pick<ThreadBox, "data">, count: number, rules: readonly LayoutRule[] = GROUP_RULES): LayoutRef {
  const own: unknown = box.data?.["layout"];
  const named: Readonly<Record<string, unknown>> =
    own === undefined || own === null ? { ...rules.find((rule) => count <= rule.most)?.layout } : typeof own === "string" ? { type: own } : typeof own === "object" && !Array.isArray(own) ? { ...own } : {};
  // A layout with no name has no `type`. The type of the engine does not have that form, and the engine gives a finding for it.
  return { padding: GROUP_LOOK.padding, gap: GROUP_LOOK.gap, ...named, header: GROUP_LOOK.header } as unknown as LayoutRef;
}

/** A finding of the layout engine about the layout of a box, for example a name that is not a strategy. */
export interface PlaceIssue {
  /** The id of the box. */
  readonly box: string;
  /** The code of the finding in the layout engine, for example `UNKNOWN_LAYOUT` or `INVALID_OPTION`. */
  readonly code: string;
  /** With `error`, the engine used a different layout. With `warning`, it used the default of an option. */
  readonly severity: string;
  /** The text of the finding, from the layout engine. */
  readonly message: string;
}

/** The result of `layoutThread`. */
export interface ThreadPlaces {
  /** The rectangle of each box, by the id of the box. */
  readonly places: Map<string, Rect>;
  /** The findings of the layout engine about the layouts of the groups. A document with no group has none. */
  readonly issues: PlaceIssue[];
}

/** The places of the cards and the topics after one layout of the second step of `placeThread`. */
interface Arrangement {
  /** The top left corner of each card and each topic, by its id. */
  readonly corners: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
  /** The width of the picture divided by its height. */
  readonly shape: number;
}

/**
 * This function gives the first scale of the heights for the shape of an area. With no shape, the scale is 1.
 * The scale is the shape of the area divided by `FREE_SHAPE`, in the limits of `FIRST_SCALE`.
 */
export function firstScale(aspect: number | undefined): number {
  if (aspect === undefined || !Number.isFinite(aspect)) return 1;
  return Math.min(FIRST_SCALE.most, Math.max(FIRST_SCALE.least, aspect / FREE_SHAPE));
}

/**
 * This function gives the most layouts of the search of `placeThread` from the count of the cards and the topics.
 * The time of one layout grows with the square of that count, so a picture of many cards gets one layout.
 */
export function mostLayouts(count: number): number {
  return Math.min(MOST_ROUNDS, Math.max(1, Math.floor(SEARCH_WORK / (count * count))));
}

/**
 * This function gives the option `theta` of the strategy `force` from the count of the cards and the topics.
 * It is 0 for `EXACT_MOST` boxes or fewer, and `FAR_THETA` for more.
 */
export function farTheta(count: number): number {
  return count > EXACT_MOST ? FAR_THETA : 0;
}

/**
 * This function tells if a change of a document is small. `kept` is the count of the cards and the topics that the document had before and has after.
 * A change is small when `kept` is `KEEP_SHARE` or more of the count `before` the change, and of the count `after` it.
 */
export function keepsPlaces(kept: number, before: number, after: number): boolean {
  return kept > 0 && kept >= KEEP_SHARE * Math.max(before, after);
}

/** A card or a topic of `placeAround`: its id and its size. */
interface Sized {
  readonly id: string;
  readonly w: number;
  readonly h: number;
}

/** A spring between two cards or topics of `placeAround`. */
interface Spring {
  readonly source: string;
  readonly target: string;
}

/**
 * This function gives the boxes that keep their corner after a small change of a document, with that corner.
 * `stays` has the cards and the topics that the picture had before, with their size of this time.
 *
 * - A box with the same size keeps its corner.
 * - A box with a different size keeps its corner too, if it is then on no box that keeps its corner.
 *
 * Thus a topic that gets one more entry, and a card that gets one more line, do not move.
 */
function heldCorners(stays: readonly Sized[], before: ReadonlyMap<string, Rect>): Map<string, { x: number; y: number }> {
  const held = new Map<string, { x: number; y: number }>();
  const rects: Rect[] = [];
  const changed: (Sized & { readonly x: number; readonly y: number })[] = [];
  for (const box of stays) {
    const was = before.get(box.id);
    if (was === undefined) continue;
    if (was.w !== box.w || was.h !== box.h) {
      changed.push({ ...box, x: was.x, y: was.y });
      continue;
    }
    held.set(box.id, { x: was.x, y: was.y });
    rects.push(was);
  }
  for (const box of changed) {
    if (rects.some((rect) => box.x < rect.x + rect.w && rect.x < box.x + box.w && box.y < rect.y + rect.h && rect.y < box.y + box.h)) continue;
    held.set(box.id, { x: box.x, y: box.y });
    rects.push(box);
  }
  return held;
}

/**
 * This function gives the corner of each card and each topic after a small change of a document.
 * Each box of `held` stays at its corner.
 *
 * - A new box goes to a free side of a box that its springs join it to: below, right, left or above, at the gap.
 *   The side with the smallest sum of the distances to those boxes is its place.
 * - A new box with no such box goes below the picture.
 * - A new box with no free side starts below those boxes. A box of `before` that is not held starts at its corner of `before`.
 *   The relaxation of `ireko` moves these boxes, and no other box. It has no pull to the center of the picture.
 *
 * No box that gets a place here is on a different box in the result.
 */
function placeAround(top: readonly Sized[], held: ReadonlyMap<string, { readonly x: number; readonly y: number }>, before: ReadonlyMap<string, Rect>, springs: readonly Spring[], force: Readonly<Record<string, number>>): Map<string, { x: number; y: number }> {
  if (held.size === top.length) return new Map(held);
  const sizes = new Map(top.map((box) => [box.id, box]));
  const starts = new Map<string, { x: number; y: number }>(held);
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const grow = (corner: { readonly x: number; readonly y: number }, box: Sized): void => {
    bounds.left = Math.min(bounds.left, corner.x);
    bounds.top = Math.min(bounds.top, corner.y);
    bounds.right = Math.max(bounds.right, corner.x + box.w);
    bounds.bottom = Math.max(bounds.bottom, corner.y + box.h);
  };
  const gap = force["margin"] !== undefined && force["margin"] > 0 ? force["margin"] : (force["gap"] ?? THREAD_FORCE.gap);
  // The boxes that do not move: the held boxes, then each new box that gets a free place. `placed` has their rectangles.
  const fixed = new Map<string, { x: number; y: number }>(held);
  const placed: Rect[] = [];
  const settle = (box: Sized, corner: { readonly x: number; readonly y: number }): void => {
    fixed.set(box.id, { x: corner.x, y: corner.y });
    starts.set(box.id, { x: corner.x, y: corner.y });
    placed.push({ x: corner.x, y: corner.y, w: box.w, h: box.h });
    grow(corner, box);
  };
  for (const box of top) {
    const corner = held.get(box.id);
    if (corner !== undefined) settle(box, corner);
  }
  // A place is free when each placed box is the gap or more from it. The small number is for the rounding of a sum.
  const reach = gap - 1e-6;
  const isFree = (corner: { readonly x: number; readonly y: number }, box: Sized): boolean =>
    !placed.some((rect) => corner.x < rect.x + rect.w + reach && rect.x < corner.x + box.w + reach && corner.y < rect.y + rect.h + reach && rect.y < corner.y + box.h + reach);
  const loose: Sized[] = [];
  for (const box of top) {
    if (held.has(box.id)) continue;
    const was = before.get(box.id);
    if (was !== undefined) {
      starts.set(box.id, { x: was.x, y: was.y });
      loose.push(box);
      continue;
    }
    // The boxes at the other end of the springs of this box, if they have a start.
    const near = springs.flatMap((spring): { x: number; y: number; box: Sized }[] => {
      const other = spring.source === box.id ? spring.target : spring.target === box.id ? spring.source : undefined;
      const at = other === undefined || other === box.id ? undefined : starts.get(other);
      const size = other === undefined ? undefined : sizes.get(other);
      return at === undefined || size === undefined ? [] : [{ ...at, box: size }];
    });
    if (near.length === 0) {
      settle(box, { x: (bounds.left + bounds.right - box.w) / 2, y: bounds.bottom + gap });
      continue;
    }
    // The four sides of each of those boxes, at the gap. The free side that is nearest to all of them is the place.
    const far = (corner: { readonly x: number; readonly y: number }): number => near.reduce((sum, at) => sum + Math.hypot(corner.x + box.w / 2 - at.x - at.box.w / 2, corner.y + box.h / 2 - at.y - at.box.h / 2), 0);
    let best: { x: number; y: number } | undefined;
    let least = Infinity;
    for (const at of near) {
      const middle = { x: at.x + (at.box.w - box.w) / 2, y: at.y + (at.box.h - box.h) / 2 };
      const sides = [
        { x: middle.x, y: at.y + at.box.h + gap },
        { x: at.x + at.box.w + gap, y: middle.y },
        { x: at.x - gap - box.w, y: middle.y },
        { x: middle.x, y: at.y - gap - box.h },
      ];
      for (const side of sides) {
        const sum = far(side);
        if (sum < least && isFree(side, box)) {
          least = sum;
          best = side;
        }
      }
    }
    if (best !== undefined) {
      settle(box, best);
      continue;
    }
    starts.set(box.id, { x: near.reduce((sum, at) => sum + at.x + at.box.w / 2, 0) / near.length - box.w / 2, y: Math.max(...near.map((at) => at.y + at.box.h)) + gap });
    loose.push(box);
  }
  if (loose.length === 0) return fixed;
  for (const box of loose) grow(starts.get(box.id) ?? { x: 0, y: 0 }, box);

  // The relaxation keeps each free box in the width of its bound and below its top. So the bound has room on each side of the picture.
  const springLength = force["springLength"] ?? THREAD_FORCE.springLength;
  const room = springLength + gap + Math.max(...loose.map((box) => Math.max(box.w, box.h)));
  const origin = { x: bounds.left - room, y: bounds.top - room };
  const nodes = top.map((box): RelaxNode => {
    const at = starts.get(box.id) ?? { x: 0, y: 0 };
    return { id: box.id, rect: { x: at.x - origin.x, y: at.y - origin.y, width: box.w, height: box.h }, fixed: fixed.has(box.id) };
  });
  const strength = force["strength"] ?? forceStrategy.options.strength.default;
  const moved = relaxForces(
    nodes,
    springs.map((spring) => ({ from: spring.source, to: spring.target, strength })),
    {
      iterations: force["iterations"] ?? THREAD_FORCE.iterations,
      springLength,
      repulsion: force["repulsion"] !== undefined && force["repulsion"] > 0 ? force["repulsion"] : springLength * springLength,
      margin: gap,
      inset: 0,
      centering: 0,
      theta: force["theta"] ?? farTheta(top.length),
      bound: { width: bounds.right - bounds.left + 2 * room, height: bounds.bottom - bounds.top + 2 * room },
    },
  );
  // A box that does not move has its corner, with no sum of floats.
  const out = new Map<string, { x: number; y: number }>();
  for (const box of top) {
    const stay = fixed.get(box.id);
    const to = moved.get(box.id);
    if (stay !== undefined) out.set(box.id, { x: stay.x, y: stay.y });
    else if (to !== undefined) out.set(box.id, { x: to.x + origin.x, y: to.y + origin.y });
  }
  return out;
}

/** This function gives the boxes of a document with the size of each measured box. A box with no measure gets the size 0. */
export function sizedBoxes(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>): LayoutBox[] {
  return document.boxes.map((box): LayoutBox => {
    const { w: _w, h: _h, ...rest } = box;
    const size = sizes.get(box.id);
    return { ...rest, w: size?.w ?? 0, h: size?.h ?? 0 };
  });
}

/**
 * This function places the boxes of a document with `ireko`. It gives the rectangle of each box, by the id of the box.
 *
 * 1. The strategy `grid` makes each card: the parts of a message in one column. An entry is a card with one row, for its image and its text.
 * 2. The strategy `force` places the cards and the topics. A reply, a relation and a chosen topic are springs.
 * 3. Each part moves with its card.
 *
 * `siblingEdges` moves the spring of a part to the card of the part.
 *
 * With the option `aspect`, the second step multiplies each height by a scale, and divides each y of the result by that scale.
 * Thus the scale changes the shape of the picture, and no two boxes overlap.
 * `firstScale` gives the scale of the first layout. A short search then moves the scale to the shape of the area.
 * `mostLayouts` gives the most layouts of the search: a picture of many cards gets only the first layout.
 * `farTheta` gives the option `theta` of the forces: in a picture of many cards, a far group of boxes pushes as one box.
 *
 * With the option `before`, a small change of the document moves no card and no topic of the picture before.
 * A new box gets a place near the boxes of its springs. The second step then has no search and no shape of an area.
 *
 * The same document and the same options give the same places. `layoutThread` gives the places with the findings of the engine.
 */
export function placeThread(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>, options: PlaceOptions = {}): Map<string, Rect> {
  return layoutThread(document, sizes, options).places;
}

/**
 * This function places the boxes of a document as `placeThread` does, and it gives the findings of the layout engine too.
 *
 * - A group is a frame around the boxes in it. `groupLayout` gives the layout of each group: a strategy of the engine, as data.
 * - A spring between two boxes of one group goes to the strategy of that group. A spring across groups pulls the boxes at the top.
 * - A group at the top is one box of the second step, so the forces move it with each box in it.
 * - A finding tells a group with a layout that the engine does not have, or with an option that is not good.
 */
export function layoutThread(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>, options: PlaceOptions = {}): ThreadPlaces {
  const out = new Map<string, Rect>();
  if (document.boxes.length === 0) return { places: out, issues: [] };
  const kinds = threadKinds(document);
  const boxes = sizedBoxes(document, sizes);
  const leaf = (id: string, of: string): NodeSpec => ({ id, size: { width: sizes.get(of)?.w ?? 0, height: sizes.get(of)?.h ?? 0 } });
  const specOf = (node: BoxNode): NodeSpec => {
    const id = node.box.id;
    if (kinds.get(id) === "group") {
      // The size is the least size of the frame: the header with the name of the group.
      const size = { width: Math.max(1, sizes.get(id)?.w ?? 0), height: GROUP_LOOK.header };
      return { id, mode: "nested", layout: groupLayout(node.box, node.children.length), size, children: node.children.map(specOf) };
    }
    if (node.children.length > 0) return { id, mode: "nested", layout: CARD, children: node.children.map(specOf) };
    if (kinds.get(id) === "entry") return { id, mode: "nested", layout: CARD, children: [leaf(id + TEXT, id)] };
    return leaf(id, id);
  };
  const tree = boxTree(boxes);
  const engine = threadEngine();
  const top = new Set(tree.map((node) => node.box.id));
  const lifted = siblingEdges({ boxes, edges: (document.edges ?? []).filter(isSpring) });
  const specOfEdge = (edge: { readonly id: string; readonly source: string; readonly target: string }): EdgeSpec => ({ id: edge.id, source: edge.source, target: edge.target });
  // A document with no group has no strategy that reads an edge in its first step.
  const grouped = document.boxes.some((box) => kinds.get(box.id) === "group");
  const inner = grouped ? lifted.filter((edge) => !top.has(edge.source) && !top.has(edge.target)).map(specOfEdge) : [];

  const cards = new Map<string, Rect>();
  const column: NodeSpec = { id: ROOT, mode: "nested", layout: COLUMN, children: tree.map(specOf) };
  const first = engine.layout({ root: column, edges: inner }, SETTINGS);
  for (const node of first.nodes) cards.set(node.id, { x: node.x, y: node.y, w: node.width, h: node.height });
  const issues = first.issues.flatMap((issue): PlaceIssue[] =>
    issue.node !== undefined && kinds.get(issue.node) === "group" ? [{ box: issue.node, code: issue.code, severity: issue.severity, message: issue.message }] : [],
  );

  const springs = lifted.filter((edge) => top.has(edge.source) && top.has(edge.target)).map(specOfEdge);
  const arrange = (scale: number): Arrangement => {
    const children = tree.map((node): NodeSpec => ({ id: node.box.id, size: { width: cards.get(node.box.id)?.w ?? 0, height: (cards.get(node.box.id)?.h ?? 0) * scale } }));
    const root: NodeSpec = { id: ROOT, mode: "nested", layout: { type: "force", ...THREAD_FORCE, theta: farTheta(tree.length), header: 0, ...options.force }, children };
    const corners = new Map<string, { x: number; y: number }>();
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const node of engine.layout({ root, edges: springs }, SETTINGS).nodes) {
      const card = cards.get(node.id);
      if (!top.has(node.id) || card === undefined) continue;
      const corner = { x: node.x, y: node.y / scale };
      corners.set(node.id, corner);
      bounds.left = Math.min(bounds.left, corner.x);
      bounds.top = Math.min(bounds.top, corner.y);
      bounds.right = Math.max(bounds.right, corner.x + card.w);
      bounds.bottom = Math.max(bounds.bottom, corner.y + card.h);
    }
    return { corners, shape: Math.max(1, bounds.right - bounds.left) / Math.max(1, bounds.bottom - bounds.top) };
  };

  /** This function gives new corners to each card and each topic: the search of the shape of the area. */
  const search = (): Arrangement["corners"] => {
    const aim = options.aspect !== undefined && Number.isFinite(options.aspect) ? Math.min(ASPECT_RANGE.most, Math.max(ASPECT_RANGE.least, options.aspect)) : undefined;
    let scale = firstScale(aim);
    let best = arrange(scale);
    if (aim === undefined) return best.corners;
    const off = (shape: number): number => Math.max(shape / aim, aim / shape);
    const most = mostLayouts(tree.length);
    let last = best;
    for (let round = 1; round < most && off(best.shape) > NEAR; round++) {
      const next = Math.min(SCALE_RANGE.most, Math.max(SCALE_RANGE.least, (scale * aim) / last.shape));
      // A scale at a limit gives the layout of the round before. The search stops there.
      if (next === scale) break;
      scale = next;
      last = arrange(scale);
      if (off(last.shape) < off(best.shape)) best = last;
    }
    return best.corners;
  };

  const { before } = options;
  const sized = tree.map((node): Sized => ({ id: node.box.id, w: cards.get(node.box.id)?.w ?? 0, h: cards.get(node.box.id)?.h ?? 0 }));
  const stays = before === undefined ? [] : sized.filter((box) => before.has(box.id));
  const corners = before === undefined || !keepsPlaces(stays.length, before.size, tree.length) ? search() : placeAround(sized, heldCorners(stays, before), before, springs, { ...THREAD_FORCE, ...options.force });

  const move = (node: BoxNode, dx: number, dy: number): void => {
    const rect = cards.get(node.box.id);
    if (rect !== undefined) out.set(node.box.id, { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h });
    for (const child of node.children) move(child, dx, dy);
  };
  for (const node of tree) {
    const card = cards.get(node.box.id);
    const to = corners.get(node.box.id);
    if (card !== undefined && to !== undefined) move(node, to.x - card.x, to.y - card.y);
  }
  return { places: out, issues };
}

/**
 * This function gives the rectangle of the text row of an entry, from the rectangle of its card and the size of its text.
 * The row is at the bottom of the card. The image of an entry is above the row.
 */
export function entryRow(card: Rect, size: Pick<LeafSize, "w" | "h" | "image">): Rect {
  const h = size.h - (size.image ?? 0);
  return { x: card.x + MESSAGE_LOOK.padding, y: card.y + card.h - MESSAGE_LOOK.padding - h, w: size.w, h };
}

/**
 * This function gives the rectangle of the image of an entry, from the rectangle of its card and the size of its text.
 * The image is between the header of the card and the text row. An entry with no image gives `undefined`.
 */
export function entryImage(card: Rect, size: Pick<LeafSize, "w" | "h" | "image">): Rect | undefined {
  if (size.image === undefined) return undefined;
  return { x: card.x + MESSAGE_LOOK.padding, y: card.y + card.h - MESSAGE_LOOK.padding - size.h, w: size.w, h: size.image - IMAGE_LOOK.gap };
}
