import type { LayoutBox, LayoutEdge } from "@mark1russell7/layout-contract";
import { edgeKind, edgeState, isMessageBox, isTopicBox, panelOf, relationOf, type ThreadBox, type ThreadDocument, type ThreadKind } from "./document.ts";

/**
 * The features of the view that a page can ask about, by name. A new feature adds a name, and no name leaves the list.
 * A page gives a document that needs a feature only to a build that has it. A build from before this list has no feature.
 *
 * - `nests`: the view draws a box in its container (`parent` of a box), to each depth.
 * - `covered`: the view has the function `setCovered`, so a page tells it each change of the parts that the page covers.
 */
export const THREAD_FEATURES: readonly string[] = ["nests", "covered"];

/** How a view shows the containers of a document. */
export interface NestState {
  /** The ids of the closed containers. A closed container is one box, and the picture does not show the boxes in it. */
  readonly closed?: ReadonlySet<string> | undefined;
  /** With `true`, the view is flat: a group is not in the picture, and a topic has no box in it. A message keeps its parts. */
  readonly flat?: boolean | undefined;
}

/** This function gives the parent of each box of a document, by the id of the box. A box with no parent has `undefined`. */
function parentsOf(document: ThreadDocument): Map<string, string | undefined> {
  return new Map(document.boxes.map((box) => [box.id, box.parent]));
}

/** This function gives the ids of the containers of a document: each box that has a box in it. */
export function containersOf(document: ThreadDocument): Set<string> {
  const out = new Set<string>();
  for (const box of document.boxes) if (box.parent !== undefined) out.add(box.parent);
  return out;
}

/**
 * This function gives the ids of the boxes above a box of a document, the nearest box first.
 * An id that is not a box gives an empty list. The document must be sound (`soundDocument`).
 */
export function ancestorsOf(document: ThreadDocument, id: string): string[] {
  const parents = parentsOf(document);
  const out: string[] = [];
  for (let at = parents.get(id); at !== undefined; at = parents.get(at)) out.push(at);
  return out;
}

/** This function tells if a document has a group: a container that is not a message. The flat view of such a document is a different picture. */
export function hasGroups(document: ThreadDocument): boolean {
  const containers = containersOf(document);
  return document.boxes.some((box) => containers.has(box.id) && !isMessageBox(box));
}

/** This function tells if the flat view does not show a box of a document. Such a box is a container that is not a message and not a topic. */
export function flatHides(document: ThreadDocument, id: string): boolean {
  const box = document.boxes.find((entry) => entry.id === id);
  return box !== undefined && !isMessageBox(box) && !isTopicBox(box) && document.boxes.some((entry) => entry.parent === id);
}

/** This function gives the ids of the edges that an edge of a shown document is made from: its `data.lifted`. An edge of the document gives an empty list. */
export function liftedOf(edge: Pick<LayoutEdge, "data">): string[] {
  const lifted = edge.data?.["lifted"];
  return Array.isArray(lifted) ? lifted.filter((id): id is string => typeof id === "string") : [];
}

/** This function tells if an edge of a shown document is made from edges into a closed container. */
export function isLifted(edge: Pick<LayoutEdge, "data">): boolean {
  return liftedOf(edge).length > 0;
}

/**
 * This function gives the flat form of a document. The document must be sound.
 *
 * - A message keeps its parts.
 * - A topic stays, and no box is in it.
 * - Each other container is not in the result. The boxes in it stay.
 * - An edge with an end that is not in the result is not in the result.
 */
function flatDocument(document: ThreadDocument): ThreadDocument {
  const containers = containersOf(document);
  const byId = new Map(document.boxes.map((box) => [box.id, box]));
  const isCard = (id: string): boolean => {
    const box = byId.get(id);
    return box !== undefined && containers.has(id) && isMessageBox(box);
  };
  const isGroup = (box: ThreadBox): boolean => containers.has(box.id) && !isMessageBox(box) && !isTopicBox(box);
  if (document.boxes.every((box) => box.parent === undefined || isCard(box.parent))) return document;
  const boxes: ThreadBox[] = [];
  for (const box of document.boxes) {
    if (isGroup(box)) continue;
    if (box.parent === undefined || isCard(box.parent)) {
      boxes.push(box);
      continue;
    }
    const { parent: _parent, ...rest } = box;
    boxes.push(rest);
  }
  const ids = new Set(boxes.map((box) => box.id));
  return { ...document, boxes, edges: (document.edges ?? []).filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

/**
 * This function gives a document with each closed container as one box. The document must be sound.
 *
 * - A box in a closed container is not in the result. The container gets `data.holds`: the number of those boxes.
 * - A panel of a box in a closed container becomes a panel of that container: its `data.of` is the container.
 * - An edge with an end in a closed container goes to that container. Such an edge is a lifted edge.
 * - The lifted edges with the same ends, kind, state, relation and choice become one edge. Its `data.lifted` has the ids of its edges.
 * - The lifted edge has the id of its first edge. An edge between two boxes of one closed container is not in the result.
 *
 * Thus each edge that crosses the border of a closed container is in one lifted edge, one time.
 */
function closedDocument(document: ThreadDocument, closed: ReadonlySet<string>): ThreadDocument {
  const parents = parentsOf(document);
  /** The box that the picture shows for each box: the closed container that is nearest to the top of the tree, or the box. */
  const shown = new Map<string, string>();
  const shownAs = (id: string): string => {
    const known = shown.get(id);
    if (known !== undefined) return known;
    const parent = parents.get(id);
    const above = parent === undefined ? undefined : shownAs(parent);
    const out = parent === undefined ? id : above !== parent ? (above ?? id) : closed.has(parent) ? parent : id;
    shown.set(id, out);
    return out;
  };
  const holds = new Map<string, number>();
  for (const box of document.boxes) {
    const as = shownAs(box.id);
    if (as !== box.id) holds.set(as, (holds.get(as) ?? 0) + 1);
  }
  if (holds.size === 0) return document;
  const boxes = document.boxes.flatMap((box): ThreadBox[] => {
    if (shownAs(box.id) !== box.id) return [];
    const count = holds.get(box.id);
    const of = panelOf(box);
    const at = of === undefined ? undefined : shownAs(of);
    if (count === undefined && at === of) return [box];
    return [{ ...box, data: { ...box.data, ...(count === undefined ? {} : { holds: count }), ...(at === of ? {} : { of: at }) } }];
  });
  const edges: LayoutEdge[] = [];
  /** The place in `edges` of each lifted edge, by its ends, its kind, its state and its relation. */
  const lifted = new Map<string, number>();
  for (const edge of document.edges ?? []) {
    const source = shownAs(edge.source);
    const target = shownAs(edge.target);
    if (source === edge.source && target === edge.target) {
      edges.push(edge);
      continue;
    }
    if (source === target) continue;
    const kind = edgeKind(edge);
    const state = edgeState(edge);
    const relation = relationOf(edge);
    // An edge can name the part of its choice. The lifted edge names the box that the picture shows for that part.
    const named: unknown = edge.data?.["choice"];
    const choice = typeof named === "string" ? shownAs(named) : undefined;
    const key = JSON.stringify([source, target, kind, state, relation, choice]);
    const at = lifted.get(key);
    const before = at === undefined ? undefined : edges[at];
    if (at !== undefined && before !== undefined) {
      edges[at] = { ...before, data: { ...before.data, lifted: [...liftedOf(before), edge.id] } };
      continue;
    }
    lifted.set(key, edges.length);
    edges.push({
      id: edge.id,
      source,
      target,
      data: { ...(kind === undefined ? {} : { kind }), ...(state === undefined ? {} : { state }), ...(relation === undefined ? {} : { relation }), ...(choice === undefined ? {} : { choice }), lifted: [edge.id] },
    });
  }
  return { ...document, boxes, edges };
}

/**
 * This function gives the document that a view shows for a state of its containers. The document must be sound.
 * The flat form comes first, then each closed container becomes one box.
 * A state that changes no box gives the same document.
 */
export function shownDocument(document: ThreadDocument, state: NestState = {}): ThreadDocument {
  const flat = state.flat === true ? flatDocument(document) : document;
  return state.closed === undefined || state.closed.size === 0 ? flat : closedDocument(flat, state.closed);
}

/**
 * This function gives the closed containers of a document.
 * A container is closed when its `data.closed` is `true`. A change of a person comes first: `true` closes a container, and `false` opens it.
 * An id that is not a container is not in the result.
 */
export function closedOf(document: ThreadDocument, changes: ReadonlyMap<string, boolean> = new Map()): Set<string> {
  const containers = containersOf(document);
  const out = new Set<string>();
  for (const box of document.boxes) {
    if (containers.has(box.id) && (changes.get(box.id) ?? box.data?.["closed"] === true)) out.add(box.id);
  }
  return out;
}

/** The boxes and the edges that a router reads: the result of `routeGround`. */
export interface RouteGround<E> {
  readonly boxes: readonly LayoutBox[];
  readonly edges: readonly E[];
}

/**
 * This function gives the boxes and the edges that a router reads for a picture with groups. `kinds` tells which boxes are groups.
 *
 * - A group that is an end of an edge is one box: its header, with the height `header`. A different group is no box, so a line goes across it.
 * - Each other box in a group has no parent, so each card is an obstacle of a line. A part keeps its message.
 * - An edge with one end in its other end is not in the result.
 *
 * A picture with no group gives the same boxes and the same edges.
 */
export function routeGround<E extends LayoutEdge>(boxes: readonly LayoutBox[], edges: readonly E[], kinds: ReadonlyMap<string, ThreadKind>, header: number): RouteGround<E> {
  if (!boxes.some((box) => kinds.get(box.id) === "group")) return { boxes, edges };
  const parents = new Map(boxes.map((box) => [box.id, box.parent]));
  const within = (inner: string, outer: string): boolean => {
    for (let at = parents.get(inner); at !== undefined; at = parents.get(at)) if (at === outer) return true;
    return false;
  };
  const kept = edges.filter((edge) => !within(edge.source, edge.target) && !within(edge.target, edge.source));
  const ends = new Set(kept.flatMap((edge) => [edge.source, edge.target]));
  const out: LayoutBox[] = [];
  for (const box of boxes) {
    const { parent, ...rest } = box;
    if (kinds.get(box.id) === "group") {
      if (ends.has(box.id)) out.push({ ...rest, h: Math.min(header, box.h ?? header) });
      continue;
    }
    out.push(parent !== undefined && kinds.get(parent) === "group" ? rest : box);
  }
  return { boxes: out, edges: kept };
}

/**
 * This function gives the closed containers after a view opens the way to a box: each container above the box is open.
 * Each other container keeps its state. A box with no closed container above it gives the same set.
 */
export function openFor(document: ThreadDocument, closed: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const above = ancestorsOf(document, id).filter((box) => closed.has(box));
  if (above.length === 0) return closed;
  const out = new Set(closed);
  for (const box of above) out.delete(box);
  return out;
}
