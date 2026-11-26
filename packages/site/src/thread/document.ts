import type { LayoutBox, LayoutEdge } from "@mark1russell7/layout-contract";

/** The free data of a record. */
type Data = Readonly<Record<string, unknown>> | undefined;

/** A record with free data: a box or an edge of a document, or a box or a route of a picture. */
interface WithData {
  readonly data?: Data;
}

/**
 * One box of a thread document: a box of `layout-input/1`. The view measures each box, so a size in the document has no effect.
 * A panel is different: its `w` is its width, and its `h` is its height until the page gives it content.
 */
export type ThreadBox = Omit<LayoutBox, "w" | "h"> & { readonly w?: number | undefined; readonly h?: number | undefined };

/**
 * A thread document: the messages of a conversation, the parts of each message and the topics that the parts touch.
 * It has the form of a `layout-input/1` document with no sizes and no places.
 *
 * - A box has `data.label` (one line), `data.kinds` (the main kind first), and can have `data.text`, `data.at` and `data.ref`.
 * - A box can have `data.actions`: a list of buttons, each with an `id` and a `title`. The card of the box shows them.
 * - A part has its message as `parent`.
 * - A topic has `topic` as its first kind. Its second kind is a tag, and its `data.state` can be `done`.
 * - An entry is a box with no box in it that is not a part, a topic or a panel. Its tag is its second kind.
 * - An entry can have `data.waits`: the id of who the entry waits on, for example a person. The entry stands out in the picture.
 * - An entry can have `data.image`: the address of an image, for example a small picture of the page of its `data.ref`.
 * - An entry with `data.topics: false` takes no topic. It only collects other boxes of the page, so its card shows no topics.
 * - A panel has `panel` as its first kind, and no parent. It is the place of a form of the page, next to the box of its `data.of`.
 * - An edge has `data.kind`: `reply`, `part`, `touches`, `relates` or `panel`. An edge `relates` can have `data.relation`.
 * - An edge of a sorter has also `data.state`, `data.rank`, `data.score`, `data.choice` and `data.by`.
 * - An edge `panel` joins a box to its panel. It is a line of dashes, and it pulls no box.
 *
 * A box can contain other boxes, to each depth: each of them has it as `parent`.
 *
 * - A container that is not a message is a group: a frame around its boxes, with its name in a header. A topic can be a group.
 * - A group can have `data.layout`: the name of a strategy of the layout engine, or an object with the name `type` and the options.
 * - A group with no `data.layout` gets a layout from the number of its boxes.
 * - A container with `data.closed` as `true` is closed at the start: the picture shows it as one box, with no box in it.
 */
export interface ThreadDocument {
  readonly id: string;
  readonly boxes: readonly ThreadBox[];
  readonly edges?: readonly LayoutEdge[] | undefined;
}

/** The names of the kinds and of the relations of a document, for the legend and the tags. A document does not contain them. */
export interface ThreadLegend {
  readonly kinds?: readonly LegendName[] | undefined;
  readonly relations?: readonly LegendName[] | undefined;
  /** The names of who an entry waits on: the ids of `data.waits`. With no name, the view shows the id. */
  readonly waits?: readonly LegendName[] | undefined;
}

/** The title of one id of a legend. */
export interface LegendName {
  readonly id: string;
  readonly title: string;
}

/**
 * The kinds of the boxes of a thread document. A message is a card with a row for each part, and an entry is a card with one text.
 * A panel is an empty box for a form of the page. A group is a frame around the boxes in it.
 */
export const THREAD_KINDS = ["message", "part", "topic", "entry", "panel", "group"] as const;

/** The kind of a box of a thread document. */
export type ThreadKind = (typeof THREAD_KINDS)[number];

/** The kinds of the edges of a thread document. */
export const EDGE_KINDS = ["reply", "part", "touches", "relates", "panel"] as const;

/** The kind of an edge of a thread document. */
export type ThreadEdgeKind = (typeof EDGE_KINDS)[number];

/** The states of an edge from a part to a topic. */
export const CHOICE_STATES = ["proposed", "chosen", "refused"] as const;

/** The state of an edge from a part to a topic. */
export type ChoiceState = (typeof CHOICE_STATES)[number];

/** The state of the topic of a part. `partStates` tells what each value is. */
export type PartState = "sorted" | "changed" | "open";

/** This function gives the text of a field of the data, or `undefined` for a value that is not a text with a character. */
function field(record: WithData, name: string): string | undefined {
  const value = record.data?.[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** This function gives the number of a field of the data, or `undefined` for a value that is not a finite number. */
function count(record: WithData, name: string): number | undefined {
  const value = record.data?.[name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** This function gives the texts of `data.kinds`. A box with no list of kinds has an empty list. */
export function kindsOf(box: WithData): string[] {
  const kinds = box.data?.["kinds"];
  return Array.isArray(kinds) ? kinds.filter((kind): kind is string => typeof kind === "string" && kind !== "") : [];
}

/** This function tells if a box with boxes in it is the card of a message. Such a box has the first kind `message`, or no kind. */
export function isMessageBox(box: WithData): boolean {
  const first = kindsOf(box)[0];
  return first === undefined || first === "message";
}

/**
 * This function tells if a box is a topic: its first kind is `topic`.
 * A topic with boxes in it is a group in the picture. It stays a topic for the choice of a person.
 */
export function isTopicBox(box: WithData): boolean {
  return kindsOf(box)[0] === "topic";
}

/** This function tells if a box can take a topic. A box with `data.topics: false` takes no topic. */
export function takesTopic(box: WithData): boolean {
  return box.data?.["topics"] !== false;
}

/**
 * This function gives the number of the boxes in a closed container: its `data.holds`. `shownDocument` writes it.
 * It gives `undefined` for a box that is not a closed container.
 */
export function holdsOf(box: WithData): number | undefined {
  const holds = count(box, "holds");
  return holds !== undefined && holds > 0 ? holds : undefined;
}

/**
 * This function gives the kind of each box of a document, by the id of the box. The place of a box in the tree comes first.
 *
 * - A box with boxes in it is a message when `isMessageBox` tells so. Each other box with boxes in it is a group.
 * - A box in a message is a part.
 * - A different box with the first kind `topic` is a topic, and one with the first kind `panel` is a panel.
 * - Each other box is an entry. Thus a box in a group has the kind that it has with no group.
 */
export function threadKinds(document: ThreadDocument): Map<string, ThreadKind> {
  const parents = new Set<string>();
  for (const box of document.boxes) if (box.parent !== undefined) parents.add(box.parent);
  const messages = new Set<string>();
  for (const box of document.boxes) if (parents.has(box.id) && isMessageBox(box)) messages.add(box.id);
  const out = new Map<string, ThreadKind>();
  for (const box of document.boxes) {
    const first = kindsOf(box)[0];
    if (messages.has(box.id)) out.set(box.id, "message");
    else if (parents.has(box.id)) out.set(box.id, "group");
    else if (box.parent !== undefined && messages.has(box.parent)) out.set(box.id, "part");
    else out.set(box.id, first === "topic" ? "topic" : first === "panel" ? "panel" : "entry");
  }
  return out;
}

/**
 * This function gives the tag of a box: the kind that tells more than the look. It is the second kind of a topic and of an entry.
 * An entry with a first kind that is not a kind of the view has that kind as its tag.
 */
export function tagOf(box: WithData): string | undefined {
  const kinds = kindsOf(box);
  const first = kinds[0];
  if (first === undefined) return undefined;
  return THREAD_KINDS.some((name) => name === first) ? kinds[1] : first;
}

/** This function tells if a box is done: its `data.state` is `done`. A picture shows a topic that is done with less color. */
export function isDone(box: WithData): boolean {
  return box.data?.["state"] === "done";
}

/** The start of a text that is an address for a link: `http`, `https`, a path, a fragment or a query. */
const ADDRESS = /^(https?:\/\/|\/|\.{1,2}\/|#|\?)/i;

/**
 * This function gives the address of a box: its `data.url`, or its `data.ref`.
 * A value that is not an address gives no result, for example an id or a text with a different scheme.
 * Thus a card has no link that goes to no page, and no link that starts a script.
 */
export function linkOf(box: WithData): string | undefined {
  return [field(box, "url"), field(box, "ref")].find((value) => value !== undefined && ADDRESS.test(value));
}

/** The start of an address for an image: `http`, `https`, a path, or a `data:` address with the bytes of an image. */
const IMAGE_ADDRESS = /^(https?:\/\/|\/|\.{1,2}\/|data:image\/)/i;

/**
 * This function gives the address of the image of a box: its `data.image`.
 * A value that is not an address of an image gives no result, for example an id or a text with a different scheme.
 * The view loads the image with no credentials, and it does not load the page of `data.ref`.
 */
export function imageOf(box: WithData): string | undefined {
  const value = field(box, "image");
  return value !== undefined && IMAGE_ADDRESS.test(value) ? value : undefined;
}

/**
 * This function gives the id of who a box waits on: its `data.waits`.
 * It gives `undefined` for a box that waits on no one, and for a value that is not a text.
 */
export function waitsOf(box: WithData): string | undefined {
  return field(box, "waits");
}

/**
 * This function gives the id of the box of a panel: its `data.of`. The view puts the panel next to that box.
 * It gives `undefined` for a panel with no box, and for a value that is not a text.
 */
export function panelOf(box: WithData): string | undefined {
  return field(box, "of");
}

/** An action of a box: a button of the card of the box. The page does the action, and the view writes no data. */
export interface ThreadAction {
  /** The id of the action, for example `reply`. A page reads it in the event of the view. */
  readonly id: string;
  /** The text of the button. */
  readonly title: string;
}

/**
 * This function gives the actions of a box: its `data.actions`, a list of records with an `id` and a `title`.
 * A record with no id or no title is not in the result. An id that the list has two times is in the result one time.
 */
export function actionsOf(box: WithData): ThreadAction[] {
  const actions: unknown = box.data?.["actions"];
  if (!Array.isArray(actions)) return [];
  const out = new Map<string, ThreadAction>();
  for (const action of actions as readonly unknown[]) {
    if (typeof action !== "object" || action === null) continue;
    const { id, title } = action as { readonly id?: unknown; readonly title?: unknown };
    if (typeof id !== "string" || id === "" || typeof title !== "string" || title === "" || out.has(id)) continue;
    out.set(id, { id, title });
  }
  return [...out.values()];
}

/** This function gives the id of the relation type of an edge `relates`, or `undefined` for an edge with no relation type. */
export function relationOf(edge: WithData): string | undefined {
  return field(edge, "relation");
}

/**
 * This function gives a document that each step of the view can read. The first box of an id stays.
 * A box with a parent that is not a box loses its parent, and each box of a loop of parents loses its parent.
 * An edge with an end that is not a box is not in the result. The first edge of an id stays.
 */
export function soundDocument(document: ThreadDocument): ThreadDocument {
  const parents = new Map<string, string | undefined>();
  const first: ThreadBox[] = [];
  for (const box of document.boxes) {
    if (parents.has(box.id)) continue;
    parents.set(box.id, box.parent);
    first.push(box);
  }
  const inLoop = (id: string): boolean => {
    const seen = new Set<string>();
    for (let at = parents.get(id); at !== undefined && !seen.has(at); at = parents.get(at)) {
      if (at === id) return true;
      seen.add(at);
    }
    return false;
  };
  const boxes = first.map((box): ThreadBox => {
    if (box.parent === undefined || (parents.has(box.parent) && !inLoop(box.id))) return box;
    const { parent: _parent, ...rest } = box;
    return rest;
  });
  const seen = new Set<string>();
  const edges: LayoutEdge[] = [];
  for (const edge of document.edges ?? []) {
    if (seen.has(edge.id) || !parents.has(edge.source) || !parents.has(edge.target)) continue;
    seen.add(edge.id);
    edges.push(edge);
  }
  return { ...document, boxes, edges };
}

/** This function gives the kind of an edge, or `undefined` for an edge with no known kind. */
export function edgeKind(edge: WithData): ThreadEdgeKind | undefined {
  const kind = edge.data?.["kind"];
  return EDGE_KINDS.find((name) => name === kind);
}

/** This function gives the state of an edge from a part to a topic, or `undefined` for an edge with no known state. */
export function edgeState(edge: WithData): ChoiceState | undefined {
  const state = edge.data?.["state"];
  return CHOICE_STATES.find((name) => name === state);
}

/** This function tells if an edge gives a topic to a part: an edge `touches` that is chosen, or that has no state. */
export function isChosen(edge: WithData): boolean {
  if (edgeKind(edge) !== "touches") return false;
  const state = edgeState(edge);
  return state === "chosen" || state === undefined;
}

/** This function tells if an edge is a proposal of a sorter. */
export function isProposal(edge: WithData): boolean {
  return edgeKind(edge) === "touches" && edgeState(edge) === "proposed";
}

/** This function tells if an edge pulls its two ends together in the layout: a reply, a relation and a chosen topic. */
export function isSpring(edge: WithData): boolean {
  const kind = edgeKind(edge);
  return kind === "reply" || kind === "relates" || isChosen(edge);
}

/** This function tells if a picture has a line for an edge. The edge from a message to its part and a refused proposal have no line. */
export function isDrawn(edge: WithData): boolean {
  return edgeKind(edge) !== "part" && edgeState(edge) !== "refused";
}

/** This function gives the short name of a box: its `data.label`, or its id. */
export function labelOf(box: WithData & { readonly id: string }): string {
  return field(box, "label") ?? box.id;
}

/** This function gives the full text of a box: its `data.text`, or its short name. */
export function textOf(box: WithData & { readonly id: string }): string {
  return field(box, "text") ?? labelOf(box);
}

/** This function gives the time of a box as an ISO text, or `undefined` for a box with no time. */
export function timeOf(box: WithData): string | undefined {
  return field(box, "at");
}

/** This function gives the part that an edge `touches` is a choice of: its `data.choice`, or its source. */
export function choiceOf(edge: LayoutEdge): string {
  return field(edge, "choice") ?? edge.source;
}

/** This function gives the number of parts that each topic has, by the id of the topic. A topic with no part is not in the result. */
export function topicCounts(edges: readonly LayoutEdge[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const edge of edges) if (isChosen(edge)) out.set(edge.target, (out.get(edge.target) ?? 0) + 1);
  return out;
}

/**
 * This function gives the state of the topic of each part, by the id of the part.
 * A part with no edge to a topic is not in the result.
 *
 * - `sorted`: the part has the first proposal of the sorter, the edge with the rank 1. A part with no rank also has this state.
 * - `changed`: the part has a topic, and the sorter proposed a different topic first.
 * - `open`: the part has proposals and no topic.
 *
 * The state does not depend on `data.by`. A sorter that makes a mistake and a person who changes a topic give the same state.
 */
export function partStates(edges: readonly LayoutEdge[]): Map<string, PartState> {
  /**
   * The facts of each part. `live`: an edge of the part is not refused. `chosen`: the part has a topic.
   * `first`: its topic has the rank 1. `ranked`: an edge of the part has a rank, also a refused edge.
   */
  const facts = new Map<string, { live: boolean; chosen: boolean; first: boolean; ranked: boolean }>();
  for (const edge of edges) {
    if (edgeKind(edge) !== "touches") continue;
    const part = choiceOf(edge);
    const rank = count(edge, "rank");
    const live = edgeState(edge) !== "refused";
    const chosen = live && isChosen(edge);
    const fact = facts.get(part) ?? { live: false, chosen: false, first: false, ranked: false };
    facts.set(part, { live: fact.live || live, chosen: fact.chosen || chosen, first: fact.first || (chosen && rank === 1), ranked: fact.ranked || rank !== undefined });
  }
  const out = new Map<string, PartState>();
  for (const [part, fact] of facts) {
    if (fact.live) out.set(part, !fact.chosen ? "open" : fact.first || !fact.ranked ? "sorted" : "changed");
  }
  return out;
}

/** One topic that a part can have: the topic, and the edge of the document for it. */
export interface TopicChoice {
  /** The id of the topic. */
  readonly target: string;
  /** The edge from the part to the topic. A topic with no edge is a topic that the sorter did not propose. */
  readonly edge: LayoutEdge | undefined;
  /** This value is true for the topic that the part has. */
  readonly chosen: boolean;
  /** The place of the topic in the list of the sorter, from 1. */
  readonly rank: number | undefined;
  /** The score of the sorter, from 0 to 1. */
  readonly score: number | undefined;
  /** The name of who chose the topic. */
  readonly by: string | undefined;
}

/**
 * This function gives the topics that a sorter or a person gave to a part.
 * A chosen topic with no rank comes first, then the topics in the order of their ranks. A refused proposal is not in the result.
 */
export function choicesOf(edges: readonly LayoutEdge[], part: string): TopicChoice[] {
  const out: TopicChoice[] = [];
  for (const edge of edges) {
    if (edgeKind(edge) !== "touches" || edgeState(edge) === "refused" || choiceOf(edge) !== part) continue;
    out.push({ target: edge.target, edge, chosen: isChosen(edge), rank: count(edge, "rank"), score: count(edge, "score"), by: field(edge, "by") });
  }
  return out.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}
