import { boxTree, siblingEdges, type BoxNode, type LayoutBox, type Rect } from "@mark1russell7/layout-contract";
import { createEngine, type EdgeSpec, type NodeSpec } from "ireko";
import { forceStrategy } from "ireko/strategies/force";
import { isSpring, threadKinds, type ThreadDocument } from "./document.ts";
import { MESSAGE_LOOK, type LeafSize } from "./sizes.ts";

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
}

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
 * 1. The strategy `grid` makes each card: the parts of a message in one column. An entry is a card with one row.
 * 2. The strategy `force` places the cards and the topics. A reply, a relation and a chosen topic are springs.
 * 3. Each part moves with its card.
 *
 * `siblingEdges` moves the spring of a part to the card of the part.
 *
 * With the option `aspect`, the second step multiplies each height by a scale, and divides each y of the result by that scale.
 * Thus the scale changes the shape of the picture, and no two boxes overlap.
 * `firstScale` gives the scale of the first layout. A short search then moves the scale to the shape of the area.
 * `mostLayouts` gives the most layouts of the search: a picture of many cards gets only the first layout.
 *
 * The same document and the same options give the same places.
 */
export function placeThread(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>, options: PlaceOptions = {}): Map<string, Rect> {
  const out = new Map<string, Rect>();
  if (document.boxes.length === 0) return out;
  const kinds = threadKinds(document);
  const boxes = sizedBoxes(document, sizes);
  const leaf = (id: string, of: string): NodeSpec => ({ id, size: { width: sizes.get(of)?.w ?? 0, height: sizes.get(of)?.h ?? 0 } });
  const specOf = (node: BoxNode): NodeSpec => {
    const id = node.box.id;
    if (node.children.length > 0) return { id, mode: "nested", layout: CARD, children: node.children.map(specOf) };
    if (kinds.get(id) === "entry") return { id, mode: "nested", layout: CARD, children: [leaf(id + TEXT, id)] };
    return leaf(id, id);
  };
  const tree = boxTree(boxes);
  const engine = createEngine({ strategies: [forceStrategy] });

  const cards = new Map<string, Rect>();
  const column: NodeSpec = { id: ROOT, mode: "nested", layout: COLUMN, children: tree.map(specOf) };
  for (const node of engine.layout({ root: column, edges: [] }, SETTINGS).nodes) cards.set(node.id, { x: node.x, y: node.y, w: node.width, h: node.height });

  const top = new Set(tree.map((node) => node.box.id));
  const springs = siblingEdges({ boxes, edges: (document.edges ?? []).filter(isSpring) })
    .filter((edge) => top.has(edge.source) && top.has(edge.target))
    .map((edge): EdgeSpec => ({ id: edge.id, source: edge.source, target: edge.target }));
  const arrange = (scale: number): Arrangement => {
    const children = tree.map((node): NodeSpec => ({ id: node.box.id, size: { width: cards.get(node.box.id)?.w ?? 0, height: (cards.get(node.box.id)?.h ?? 0) * scale } }));
    const root: NodeSpec = { id: ROOT, mode: "nested", layout: { type: "force", ...THREAD_FORCE, header: 0, ...options.force }, children };
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

  const aim = options.aspect !== undefined && Number.isFinite(options.aspect) ? Math.min(ASPECT_RANGE.most, Math.max(ASPECT_RANGE.least, options.aspect)) : undefined;
  let scale = firstScale(aim);
  let best = arrange(scale);
  if (aim !== undefined) {
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
  }

  const move = (node: BoxNode, dx: number, dy: number): void => {
    const rect = cards.get(node.box.id);
    if (rect !== undefined) out.set(node.box.id, { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h });
    for (const child of node.children) move(child, dx, dy);
  };
  for (const node of tree) {
    const card = cards.get(node.box.id);
    const to = best.corners.get(node.box.id);
    if (card !== undefined && to !== undefined) move(node, to.x - card.x, to.y - card.y);
  }
  return out;
}

/** This function gives the rectangle of the text row of an entry, from the rectangle of its card and the size of its text. */
export function entryRow(card: Rect, size: Pick<LeafSize, "w" | "h">): Rect {
  return { x: card.x + MESSAGE_LOOK.padding, y: card.y + card.h - MESSAGE_LOOK.padding - size.h, w: size.w, h: size.h };
}
