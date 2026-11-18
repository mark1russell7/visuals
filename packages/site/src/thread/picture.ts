import type { CurveOptions } from "@mark1russell7/highways";
import { pictureOf, type LayoutBox, type LayoutPicture, type PictureLabel, type PictureRouteSource, type Rect } from "@mark1russell7/layout-contract";
import type { AdvanceFn } from "@mark1russell7/layout-contract/text";
import { choiceOf, isDrawn, isProposal, partStates, soundDocument, tagOf, threadKinds, timeOf, type PartState, type ThreadBox, type ThreadDocument, type ThreadKind, type ThreadLegend } from "./document.ts";
import { entryRow, placeThread, sizedBoxes, type PlaceOptions } from "./place.ts";
import { routeThread } from "./route.ts";
import { isTopicLook, MESSAGE_LOOK, PART_LOOK, widestLine, threadSizes, type LeafSize } from "./sizes.ts";

/** The proposals of a thread picture that have a route: `each` proposal, or the proposals of a list of parts and entries. */
export type Proposals = "each" | readonly string[];

/**
 * The most proposals of a document for which a view routes each proposal at its start.
 * For a document with more proposals, a view routes only the proposals that it shows. `withProposals` adds them.
 */
export const ROUTED_MOST = 100;

/** The options of the routes of a thread picture. */
export interface ThreadRouteOptions {
  /** The router of `highways` for the replies, the relations and the chosen topics. The default is `shared`: the edges to one topic have one trunk. */
  readonly router?: string | undefined;
  /** The router of `highways` for the proposals. The default is `corners`. */
  readonly proposalRouter?: string | undefined;
  /** The curve of each route. The default is `spline`. */
  readonly curve?: CurveOptions["type"] | undefined;
}

/** The options of `threadPicture`. */
export interface ThreadPictureOptions extends PlaceOptions, ThreadRouteOptions {
  /** The proposals that get a route. The default is `each`. A list of parts and entries saves the time of the other routes. */
  readonly proposals?: Proposals | undefined;
  /** The names of the kinds, for the tag of an entry. With no legend, a tag is the id of its kind. */
  readonly legend?: ThreadLegend | undefined;
  /** The language of the dates, as a BCP 47 tag. The default is `en-US`. */
  readonly locale?: string | undefined;
  /** The time zone of the dates, as an IANA name. The default is the time zone of the computer. */
  readonly timeZone?: string | undefined;
  /**
   * The picture before a change of the document. Each box keeps its place and its size when the new document has the same boxes with the same names.
   * Thus a change of an edge moves no box. A small change of the boxes moves no card and no topic of this picture.
   * A new box gets a place near the boxes that its edges join it to. `keepsPlaces` tells if a change is small.
   */
  readonly keep?: ThreadPicture | undefined;
}

/** A thread document as a picture, with the facts of each box that the looks and the page read. */
export interface ThreadPicture {
  /** The document that the picture shows: the result of `soundDocument`. */
  readonly document: ThreadDocument;
  readonly picture: LayoutPicture;
  /** The kind of each box, by its id. */
  readonly kinds: ReadonlyMap<string, ThreadKind>;
  /** The measured text of each box with no box in it, by its id. */
  readonly sizes: ReadonlyMap<string, LeafSize>;
  /** The rectangle of each box, by its id. */
  readonly places: ReadonlyMap<string, Rect>;
  /** The state of the topic of each part, by the id of the part. */
  readonly states: ReadonlyMap<string, PartState>;
  /** The proposals that have a route in the picture. */
  readonly proposals: Proposals;
}

/** The names of the labels of a box. A look reads `data.role` of a label. */
export const LABEL_ROLES = ["text", "count", "date", "tag"] as const;

/** The role of a label of a thread picture. */
export type LabelRole = (typeof LABEL_ROLES)[number];

/** The font of the tag of an entry. */
export const TAG_FONT = `600 ${MESSAGE_LOOK.dateFont}`;

/** This function gives the id of a label of a box. */
export function labelId(role: LabelRole, box: string): string {
  return `${role}:${box}`;
}

/** This function gives the text of a time for the header of a card, for example `Nov 16, 14:05`. A text that is not a time stays as it is. */
export function timeText(at: string, locale = "en-US", timeZone?: string): string {
  const time = new Date(at);
  if (Number.isNaN(time.getTime())) return at;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone === undefined ? {} : { timeZone }) }).format(time);
}

/** This function gives the title of an id of a legend list, or the id. */
export function titleOf(names: readonly { readonly id: string; readonly title: string }[] | undefined, id: string): string {
  return names?.find((name) => name.id === id)?.title ?? id;
}

/** This function gives the labels of the lines of a text in a row: a part, or the row of an entry. */
function textLabel(box: string, row: Rect, size: LeafSize): PictureLabel {
  const { look, text } = size;
  return { id: labelId("text", box), box, x: row.x + look.padX, y: row.y + look.padY, w: Math.max(1, row.w - 2 * look.padX), h: Math.max(1, text.lineCount) * look.lineHeight, lines: text.lines, lineHeight: look.lineHeight, font: look.font, data: { role: "text" } };
}

/** This function gives the labels of the header of a card: the tag of an entry on the left and the date. With no tag, the date is on the left. */
function headerLabels(box: ThreadBox, card: Rect, options: ThreadPictureOptions): PictureLabel[] {
  const at = timeOf(box);
  const tag = tagOf(box);
  const band = { x: card.x + MESSAGE_LOOK.padding + PART_LOOK.padX, y: card.y + (MESSAGE_LOOK.header - MESSAGE_LOOK.dateLine) / 2 + 1, w: Math.max(1, card.w - 2 * (MESSAGE_LOOK.padding + PART_LOOK.padX)), h: MESSAGE_LOOK.dateLine, lineHeight: MESSAGE_LOOK.dateLine };
  const out: PictureLabel[] = [];
  if (tag !== undefined) out.push({ id: labelId("tag", box.id), box: box.id, ...band, lines: [titleOf(options.legend?.kinds, tag)], font: TAG_FONT, data: { role: "tag" } });
  if (at !== undefined) out.push({ id: labelId("date", box.id), box: box.id, ...band, lines: [timeText(at, options.locale, options.timeZone)], font: MESSAGE_LOOK.dateFont, ...(tag === undefined ? {} : { align: "right" as const }), data: { role: "date" } });
  return out;
}

/**
 * This function gives the labels of a thread picture.
 * They are the text of each part, entry and topic, the count of each topic and the header of each card.
 */
function threadLabels(document: ThreadDocument, kinds: ReadonlyMap<string, ThreadKind>, sizes: ReadonlyMap<string, LeafSize>, places: ReadonlyMap<string, Rect>, options: ThreadPictureOptions): PictureLabel[] {
  const out: PictureLabel[] = [];
  for (const box of document.boxes) {
    const place = places.get(box.id);
    const kind = kinds.get(box.id);
    if (place === undefined || kind === undefined) continue;
    const size = sizes.get(box.id);
    if (kind === "message") out.push(...headerLabels(box, place, options));
    if (size === undefined) continue;
    if (kind === "part") out.push(textLabel(box.id, place, size));
    if (kind === "entry") out.push(...headerLabels(box, place, options), textLabel(box.id, entryRow(place, size), size));
    if (kind !== "topic") continue;
    const { look, text } = size;
    out.push({ id: labelId("text", box.id), box: box.id, x: place.x + look.padX, y: place.y + look.padY, w: Math.max(1, widestLine(text)), h: Math.max(1, text.lineCount) * look.lineHeight, lines: text.lines, lineHeight: look.lineHeight, font: look.font, data: { role: "text" } });
    if (size.count === 0 || !isTopicLook(look)) continue;
    out.push({ id: labelId("count", box.id), box: box.id, x: place.x + place.w - look.padX - size.countWidth, y: place.y + (place.h - look.lineHeight) / 2, w: Math.max(1, size.countWidth), h: look.lineHeight, lines: [String(size.count)], lineHeight: look.lineHeight, font: look.countFont, align: "right", data: { role: "count" } });
  }
  return out;
}

/** This function tells if a picture has a place for each box of a document. Each box must have the kind and the size that it has in that picture. */
function keeps(keep: ThreadPicture, document: ThreadDocument, kinds: ReadonlyMap<string, ThreadKind>, sizes: ReadonlyMap<string, LeafSize>): boolean {
  if (keep.places.size !== document.boxes.length) return false;
  return document.boxes.every((box) => {
    if (!keep.places.has(box.id) || keep.kinds.get(box.id) !== kinds.get(box.id)) return false;
    const now = sizes.get(box.id);
    const then = keep.sizes.get(box.id);
    return now === undefined ? then === undefined : then !== undefined && now.w === then.w && now.h === then.h;
  });
}

/** This function gives the places of the cards and the topics of a picture: each box that is in no box. */
function topPlaces(keep: ThreadPicture): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const box of keep.document.boxes) {
    const place = keep.places.get(box.id);
    if (box.parent === undefined && place !== undefined) out.set(box.id, place);
  }
  return out;
}

/** This function gives the boxes of a document with the place and the size of each box that has a place. */
function placedBoxes(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>, places: ReadonlyMap<string, Rect>): LayoutBox[] {
  return sizedBoxes(document, sizes).flatMap((box): LayoutBox[] => {
    const place = places.get(box.id);
    return place === undefined ? [] : [{ ...box, x: place.x, y: place.y, w: place.w, h: place.h }];
  });
}

/** This function routes the proposals of a document that `proposals` names, between the placed boxes. */
function proposalRoutes(document: ThreadDocument, boxes: readonly LayoutBox[], proposals: Proposals, options: ThreadRouteOptions): PictureRouteSource[] {
  const of = proposals === "each" ? undefined : new Set(proposals);
  if (of?.size === 0) return [];
  const edges = (document.edges ?? []).filter((edge) => isProposal(edge) && (of === undefined || of.has(choiceOf(edge))));
  return routeThread(document.id, boxes, edges, { router: options.proposalRouter ?? "corners", curve: options.curve });
}

/** This function tells if the routes of the proposals `have` contain the routes of the proposals `want`. */
function hasProposals(have: Proposals, want: Proposals): boolean {
  if (have === "each") return true;
  return want !== "each" && want.every((id) => have.includes(id));
}

/**
 * This function tells which proposals a view of a document routes: `each` proposal, or only the proposals of `shown`.
 * It gives `each` when `all` is true, and for a document with `ROUTED_MOST` proposals or fewer.
 */
export function routedProposals(document: ThreadDocument, shown: readonly string[], all = false): Proposals {
  if (all) return "each";
  let count = 0;
  for (const edge of document.edges ?? []) if (isProposal(edge) && ++count > ROUTED_MOST) return shown;
  return "each";
}

/**
 * This function makes the picture of a thread document. `advance` gives the width of a text in a font.
 *
 * 1. `layoutText` of `layout-contract` measures the text of each box.
 * 2. `ireko` places the boxes: the cards and the topics by forces, the parts of a message in one column.
 * 3. `highways` routes the edges between the placed boxes. The routes of the proposals are behind the other routes.
 * 4. `pictureOf` of `layout-contract` puts the boxes, the routes and the labels in one picture.
 *
 * An edge `part` and a refused proposal have no route. The same document and the same options give the same picture.
 * With the option `proposals`, only the proposals of some parts and entries get a route. `withProposals` gives the routes of others later.
 */
export function threadPicture(input: ThreadDocument, advance: AdvanceFn, options: ThreadPictureOptions = {}): ThreadPicture {
  const document = soundDocument(input);
  const kinds = threadKinds(document);
  const { keep } = options;
  const sizes = threadSizes(document, advance, keep?.sizes);
  const places = keep === undefined ? placeThread(document, sizes, options) : keeps(keep, document, kinds, sizes) ? keep.places : placeThread(document, sizes, { ...options, before: topPlaces(keep) });
  const boxes = placedBoxes(document, sizes, places);
  const edges = document.edges ?? [];
  const proposals = options.proposals ?? "each";
  const behind = proposalRoutes(document, boxes, proposals, options);
  const main = routeThread(document.id, boxes, edges.filter((edge) => isDrawn(edge) && !isProposal(edge)), { router: options.router ?? "shared", curve: options.curve, bundle: true });
  const picture = pictureOf({ id: document.id, boxes, edges }, { routes: [...behind, ...main], labels: threadLabels(document, kinds, sizes, places, options) });
  return { document, picture, kinds, sizes, places, states: partStates(edges), proposals };
}

/**
 * This function gives a thread picture with the routes of other proposals. Each box, each label and each other route stays.
 * It gives the same picture when that picture has the routes of `proposals`. A picture with each proposal has them always.
 */
export function withProposals(thread: ThreadPicture, proposals: Proposals, options: ThreadRouteOptions = {}): ThreadPicture {
  if (hasProposals(thread.proposals, proposals)) return thread;
  const { document, picture } = thread;
  const boxes = placedBoxes(document, thread.sizes, thread.places);
  // `pictureOf` gives each route the ends and the data of its edge. A picture of the boxes and these routes is good, so its routes go into the picture.
  const behind = pictureOf({ id: document.id, boxes, edges: document.edges ?? [] }, { routes: proposalRoutes(document, boxes, proposals, options) }).routes;
  return { ...thread, proposals, picture: { ...picture, routes: [...behind, ...picture.routes.filter((route) => !isProposal(route))] } };
}
