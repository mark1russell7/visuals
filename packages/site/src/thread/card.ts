import type { LayoutEdge } from "@mark1russell7/layout-contract";
import { actionsOf, choiceOf, choicesOf, edgeKind, edgeState, isChosen, isDone, labelOf, linkOf, tagOf, textOf, timeOf, waitsOf, type ThreadAction, type ThreadDocument, type ThreadKind, type ThreadLegend } from "./document.ts";
import { timeText, titleOf, type ThreadPicture, type ThreadPictureOptions } from "./picture.ts";

/** A box that a card names: its id and its short name. */
export interface CardName {
  readonly id: string;
  readonly label: string;
}

/** One topic of the list of a part, in the order of the sorter. */
export interface CardChoice extends CardName {
  /** The id of the edge of the document for the topic, or `undefined` for a topic with no edge. */
  readonly edge: string | undefined;
  readonly chosen: boolean;
  /** The place of the topic in the list of the sorter, from 1. */
  readonly rank: number | undefined;
  /** The score of the sorter, from 0 to 1. */
  readonly score: number | undefined;
}

/** What the card of a selected box shows. */
export interface CardModel extends CardName {
  readonly kind: ThreadKind;
  /** The line above the text: the place of a part in its message, the kind of a topic or the tag of an entry. */
  readonly title: string;
  /** The date of the box, or of the message of a part. */
  readonly date: string | undefined;
  /** The full text of the box. */
  readonly text: string;
  /** The address of the box. */
  readonly link: string | undefined;
  /** This value is true for a topic that is done. */
  readonly done: boolean;
  /** The name of who an entry waits on: the title of the legend, or the id. A box that waits on no one has `undefined`. */
  readonly waits: string | undefined;
  /** The topics of a part or of an entry, in the order of the sorter. A different box has an empty list. */
  readonly choices: readonly CardChoice[];
  /** The name of who chose the topic of the part. */
  readonly by: string | undefined;
  /** Each topic that is not in `choices`, in the order of the document. A box that cannot have a topic has an empty list. */
  readonly others: readonly CardName[];
  /** The parts of a message, or the parts and entries of a topic. */
  readonly parts: readonly CardName[];
  /** The buttons of the card, in the order of `data.actions` of the box. */
  readonly actions: readonly ThreadAction[];
}

/** The largest number of topics in the list of the sorter that a card shows before the other topics. */
export const MOST_CHOICES = 3;

/**
 * This function gives the content of the card of a box, or `undefined` for an id that is not a box of the picture.
 * A part and an entry get the list of their topics. A topic gets the list of its parts, and a message gets its parts.
 */
export function cardOf(thread: ThreadPicture, id: string, options: Pick<ThreadPictureOptions, "legend" | "locale" | "timeZone"> = {}): CardModel | undefined {
  const { document, kinds } = thread;
  const box = document.boxes.find((entry) => entry.id === id);
  const kind = kinds.get(id);
  if (box === undefined || kind === undefined) return undefined;
  const edges = document.edges ?? [];
  const byId = new Map(document.boxes.map((entry) => [entry.id, entry]));
  const nameOf = (other: string): CardName => ({ id: other, label: labelOf(byId.get(other) ?? { id: other }) });
  const parent = box.parent === undefined ? undefined : byId.get(box.parent);
  const at = timeOf(box) ?? (parent === undefined ? undefined : timeOf(parent));
  const tag = tagOf(box);
  const siblings = parent === undefined ? [] : document.boxes.filter((entry) => entry.parent === parent.id);
  const title =
    kind === "part"
      ? `Part ${String(siblings.indexOf(box) + 1)} of ${String(siblings.length)}`
      : kind === "topic"
        ? tag === undefined
          ? "Topic"
          : titleOf(options.legend?.kinds, tag)
        : kind === "entry"
          ? tag === undefined
            ? "Entry"
            : titleOf(options.legend?.kinds, tag)
          : "Message";
  const has = kind === "part" || kind === "entry";
  const ranked = has ? choicesOf(edges, id) : [];
  const listed = [...ranked.filter((choice) => choice.chosen), ...ranked.filter((choice) => !choice.chosen).slice(0, MOST_CHOICES)].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const choices = listed.map((choice): CardChoice => ({ ...nameOf(choice.target), edge: choice.edge?.id, chosen: choice.chosen, rank: choice.rank, score: choice.score }));
  const shown = new Set(choices.map((choice) => choice.id));
  const waits = kind === "entry" ? waitsOf(box) : undefined;
  const others = has ? document.boxes.filter((entry) => kinds.get(entry.id) === "topic" && !shown.has(entry.id) && !isDone(entry)).map((entry) => nameOf(entry.id)) : [];
  const parts =
    kind === "message"
      ? document.boxes.filter((entry) => entry.parent === id).map((entry) => nameOf(entry.id))
      : kind === "topic"
        ? edges.filter((edge) => isChosen(edge) && edge.target === id).map((edge) => nameOf(choiceOf(edge)))
        : [];
  return {
    id,
    label: labelOf(box),
    kind,
    title,
    date: at === undefined ? undefined : timeText(at, options.locale, options.timeZone),
    text: textOf(box),
    link: linkOf(box),
    done: isDone(box),
    waits: waits === undefined ? undefined : titleOf(options.legend?.waits, waits),
    choices,
    by: ranked.find((choice) => choice.chosen)?.by,
    others,
    parts,
    actions: actionsOf(box),
  };
}

/** A choice of a person: a part or an entry, and the topic that the person gives to it. */
export interface TopicChoiceEvent {
  /** The id of the part or of the entry. */
  readonly choice: string;
  /** The id of the topic. */
  readonly target: string;
  /** The id of the edge of the document for that topic, or `undefined` for a topic that the sorter did not propose. */
  readonly edge: string | undefined;
}

/**
 * This function gives a document after a choice of a person. The document of the argument does not change.
 *
 * - The edge of the choice to the target becomes `chosen`, with the name `by`. A target with no edge gets a new edge.
 * - The edge that was chosen becomes `proposed` when the sorter gave it a rank. With no rank, it is not in the result.
 *
 * A page with no store uses it, for example a demo. A page with a store writes the choice and gives the new document of its store.
 */
export function chooseTopic(document: ThreadDocument, event: Pick<TopicChoiceEvent, "choice" | "target">, by = "person"): ThreadDocument {
  const { choice, target } = event;
  const out: LayoutEdge[] = [];
  let found = false;
  for (const edge of document.edges ?? []) {
    if (edgeKind(edge) !== "touches" || choiceOf(edge) !== choice) {
      out.push(edge);
      continue;
    }
    if (edge.target === target) {
      found = true;
      out.push({ ...edge, data: { ...edge.data, state: "chosen", by } });
      continue;
    }
    if (!isChosen(edge)) {
      out.push(edge);
      continue;
    }
    if (typeof edge.data?.["rank"] !== "number") continue;
    const { by: _by, ...data } = edge.data;
    out.push({ ...edge, data: { ...data, state: "proposed" } });
  }
  if (!found) out.push({ id: `touches:${choice}:${target}`, source: choice, target, data: { kind: "touches", state: "chosen", choice, by } });
  return { ...document, edges: out };
}

/** This function gives the names of the relation types of a document, for a legend: the titles of the legend, or the ids. */
export function relationNames(document: ThreadDocument, legend?: ThreadLegend): CardName[] {
  const ids = new Set<string>();
  for (const edge of document.edges ?? []) {
    const relation = edge.data?.["relation"];
    if (edgeKind(edge) === "relates" && edgeState(edge) !== "refused") ids.add(typeof relation === "string" && relation !== "" ? relation : "related");
  }
  return [...ids].map((id) => ({ id, label: titleOf(legend?.relations, id) }));
}
