import type { CurveOptions } from "@mark1russell7/highways";
import { pictureOf, topBoxes, type LayoutBox, type LayoutEdge, type LayoutPicture, type PictureLabel, type PictureRoute, type PictureRouteSource, type Rect } from "@mark1russell7/layout-contract";
import type { AdvanceFn } from "@mark1russell7/layout-contract/text";
import { choiceOf, edgeKind, isDrawn, isProposal, partStates, soundDocument, tagOf, threadKinds, timeOf, waitsOf, type PartState, type ThreadBox, type ThreadDocument, type ThreadKind, type ThreadLegend } from "./document.ts";
import { placePanels, splitPanels, type PanelSide } from "./panels.ts";
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
  /** The height of the content of each panel, by the id of the panel. A panel with no height here has the height of its `h`. */
  readonly panels?: ReadonlyMap<string, number> | undefined;
}

/** The options that the routes and the labels of a thread picture read. */
export type ThreadLineOptions = Pick<ThreadPictureOptions, "router" | "proposalRouter" | "curve" | "legend" | "locale" | "timeZone">;

/** A thread document as a picture, with the facts of each box that the looks and the page read. */
export interface ThreadPicture {
  /** The document that the picture shows: the result of `soundDocument`. */
  readonly document: ThreadDocument;
  /** The document with no panel and no edge of a panel. It is `document` when the document has none. */
  readonly plain: ThreadDocument;
  readonly picture: LayoutPicture;
  /** The kind of each box, by its id. */
  readonly kinds: ReadonlyMap<string, ThreadKind>;
  /** The measured text of each box with no box in it, by its id. */
  readonly sizes: ReadonlyMap<string, LeafSize>;
  /** The rectangle of each box, by its id. */
  readonly places: ReadonlyMap<string, Rect>;
  /** The rectangle of each box that is not a panel, before a panel pushes it, by its id. */
  readonly base: ReadonlyMap<string, Rect>;
  /** The side of each panel at its box, by the id of the panel. */
  readonly sides: ReadonlyMap<string, PanelSide>;
  /** The state of the topic of each part, by the id of the part. */
  readonly states: ReadonlyMap<string, PartState>;
  /** The proposals that have a route in the picture. */
  readonly proposals: Proposals;
  /** The options of the routes and the labels of the picture. */
  readonly made: ThreadLineOptions;
}

/** The names of the labels of a box. A look reads `data.role` of a label. */
export const LABEL_ROLES = ["text", "count", "date", "tag", "waits"] as const;

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

/** The space between two texts of the header of a card. */
export const HEADER_GAP = 8;

/** This function gives the text that tells who a box waits on, with the name of the legend. With no name, the text has the id. */
export function waitsText(waits: string, legend?: ThreadLegend): string {
  return `Waits on ${titleOf(legend?.waits, waits)}`;
}

/**
 * This function gives the labels of the header of a card. The tag of an entry is on the left, then who the entry waits on.
 * The date is on the right. With no text on the left, the date is on the left. A header with no room for the date has no date.
 */
function headerLabels(box: ThreadBox, card: Rect, options: ThreadPictureOptions, advance: AdvanceFn, waits?: string): PictureLabel[] {
  const at = timeOf(box);
  const tag = tagOf(box);
  const band = { x: card.x + MESSAGE_LOOK.padding + PART_LOOK.padX, y: card.y + (MESSAGE_LOOK.header - MESSAGE_LOOK.dateLine) / 2 + 1, w: Math.max(1, card.w - 2 * (MESSAGE_LOOK.padding + PART_LOOK.padX)), h: MESSAGE_LOOK.dateLine, lineHeight: MESSAGE_LOOK.dateLine };
  const out: PictureLabel[] = [];
  /** The width that the texts on the left use, with the space after each of them. */
  let used = 0;
  const left = (role: LabelRole, text: string): void => {
    out.push({ id: labelId(role, box.id), box: box.id, ...band, x: band.x + used, w: Math.max(1, band.w - used), lines: [text], font: TAG_FONT, data: { role } });
    used += Math.ceil(advance(text, TAG_FONT)) + HEADER_GAP;
  };
  if (tag !== undefined) left("tag", titleOf(options.legend?.kinds, tag));
  if (waits !== undefined) left("waits", waitsText(waits, options.legend));
  if (at === undefined) return out;
  const date = timeText(at, options.locale, options.timeZone);
  if (used > 0 && used + Math.ceil(advance(date, MESSAGE_LOOK.dateFont)) > band.w) return out;
  out.push({ id: labelId("date", box.id), box: box.id, ...band, lines: [date], font: MESSAGE_LOOK.dateFont, ...(used === 0 ? {} : { align: "right" as const }), data: { role: "date" } });
  return out;
}

/**
 * This function gives the labels of a thread picture.
 * They are the text of each part, entry and topic, the count of each topic and the header of each card.
 */
function threadLabels(document: ThreadDocument, kinds: ReadonlyMap<string, ThreadKind>, sizes: ReadonlyMap<string, LeafSize>, places: ReadonlyMap<string, Rect>, options: ThreadPictureOptions, advance: AdvanceFn): PictureLabel[] {
  const out: PictureLabel[] = [];
  for (const box of document.boxes) {
    const place = places.get(box.id);
    const kind = kinds.get(box.id);
    if (place === undefined || kind === undefined) continue;
    const size = sizes.get(box.id);
    if (kind === "message") out.push(...headerLabels(box, place, options, advance));
    if (size === undefined) continue;
    if (kind === "part") out.push(textLabel(box.id, place, size));
    if (kind === "entry") out.push(...headerLabels(box, place, options, advance, waitsOf(box)), textLabel(box.id, entryRow(place, size), size));
    if (kind !== "topic") continue;
    const { look, text } = size;
    out.push({ id: labelId("text", box.id), box: box.id, x: place.x + look.padX, y: place.y + look.padY, w: Math.max(1, widestLine(text)), h: Math.max(1, text.lineCount) * look.lineHeight, lines: text.lines, lineHeight: look.lineHeight, font: look.font, data: { role: "text" } });
    if (size.count === 0 || !isTopicLook(look)) continue;
    out.push({ id: labelId("count", box.id), box: box.id, x: place.x + place.w - look.padX - size.countWidth, y: place.y + (place.h - look.lineHeight) / 2, w: Math.max(1, size.countWidth), h: look.lineHeight, lines: [String(size.count)], lineHeight: look.lineHeight, font: look.countFont, align: "right", data: { role: "count" } });
  }
  return out;
}

/** This function gives the label of each panel: its name. The looks show it in a far view, where the content of the page is not visible. */
function panelLabels(panels: readonly ThreadBox[], sizes: ReadonlyMap<string, LeafSize>, places: ReadonlyMap<string, Rect>): PictureLabel[] {
  return panels.flatMap((panel): PictureLabel[] => {
    const place = places.get(panel.id);
    const size = sizes.get(panel.id);
    return place === undefined || size === undefined ? [] : [textLabel(panel.id, place, size)];
  });
}

/**
 * This function tells if a picture has a place for each box of a document with no panel.
 * Each box must have the kind and the size that it has in that picture.
 */
function keeps(keep: ThreadPicture, plain: ThreadDocument, kinds: ReadonlyMap<string, ThreadKind>, sizes: ReadonlyMap<string, LeafSize>): boolean {
  if (keep.base.size !== plain.boxes.length) return false;
  return plain.boxes.every((box) => {
    if (!keep.base.has(box.id) || keep.kinds.get(box.id) !== kinds.get(box.id)) return false;
    const now = sizes.get(box.id);
    const then = keep.sizes.get(box.id);
    return now === undefined ? then === undefined : then !== undefined && now.w === then.w && now.h === then.h;
  });
}

/** This function gives the places of the cards and the topics of a picture, before a panel pushes them: each box that is in no box. */
function topPlaces(keep: ThreadPicture): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const box of keep.plain.boxes) {
    const place = keep.base.get(box.id);
    if (box.parent === undefined && place !== undefined) out.set(box.id, place);
  }
  return out;
}

/** This function tells if two lists have the same records. Two records that are not one object are the same when the lists have the same JSON text. */
function sameRecords(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((record, at) => record === b[at]) || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * This function tells if a picture has the routes and the labels of a document with no panel.
 * The boxes, the edges and the options must be the same, and each box must have its place of that picture.
 * Thus a panel that pushes no box changes no line and no label of the other boxes.
 */
function keepsLines(keep: ThreadPicture, plain: ThreadDocument, places: ReadonlyMap<string, Rect>, made: ThreadLineOptions, proposals: Proposals): boolean {
  const was = keep.made;
  if (!hasProposals(keep.proposals, proposals)) return false;
  if (was.router !== made.router || was.proposalRouter !== made.proposalRouter || was.curve !== made.curve || was.locale !== made.locale || was.timeZone !== made.timeZone) return false;
  if (was.legend !== made.legend && JSON.stringify(was.legend) !== JSON.stringify(made.legend)) return false;
  if (!sameRecords(keep.plain.boxes, plain.boxes) || !sameRecords(keep.plain.edges ?? [], plain.edges ?? [])) return false;
  return plain.boxes.every((box) => {
    const now = places.get(box.id);
    const then = keep.places.get(box.id);
    return now === then || (now !== undefined && then !== undefined && now.x === then.x && now.y === then.y && now.w === then.w && now.h === then.h);
  });
}

/** This function gives the boxes of a document with the place and the size of each box that has a place. */
function placedBoxes(document: ThreadDocument, sizes: ReadonlyMap<string, LeafSize>, places: ReadonlyMap<string, Rect>): LayoutBox[] {
  return sizedBoxes(document, sizes).flatMap((box): LayoutBox[] => {
    const place = places.get(box.id);
    return place === undefined ? [] : [{ ...box, x: place.x, y: place.y, w: place.w, h: place.h }];
  });
}

/** This function tells if a route is a line of a panel: a route of the kind `panel`, or a route with a panel at an end. */
export function isPanelLine(route: PictureRoute, kinds: ReadonlyMap<string, ThreadKind>): boolean {
  return edgeKind(route) === "panel" || kinds.get(route.source) === "panel" || kinds.get(route.target) === "panel";
}

/**
 * This function routes the edges of the panels: one straight line for each edge. The router gets only the cards at the ends of these edges.
 * Thus the time of the lines of a panel does not grow with the document.
 */
function panelRoutes(id: string, boxes: readonly LayoutBox[], edges: readonly LayoutEdge[]): PictureRouteSource[] {
  const drawn = edges.filter(isDrawn);
  if (drawn.length === 0) return [];
  const tops = topBoxes(boxes);
  const cards = new Set(drawn.flatMap((edge) => [tops.get(edge.source) ?? edge.source, tops.get(edge.target) ?? edge.target]));
  return routeThread(id, boxes.filter((box) => cards.has(tops.get(box.id) ?? box.id)), drawn, { router: "straight", curve: "straight" });
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
 * 3. `placePanels` puts each panel at a side of its box. The push cascade of `packing` moves the boxes that are too near.
 * 4. `highways` routes the edges between the placed boxes. The routes of the proposals are behind the other routes.
 * 5. `pictureOf` of `layout-contract` puts the boxes, the routes and the labels in one picture.
 *
 * An edge `part` and a refused proposal have no route. The same document and the same options give the same picture.
 * With the option `proposals`, only the proposals of some parts and entries get a route. `withProposals` gives the routes of others later.
 *
 * A panel is no obstacle of a route, and its edge is one straight line. A picture with `keep` keeps the routes and the labels of that picture
 * when no box of them has a different place. Thus a panel that pushes no box costs the time of its own line only.
 */
export function threadPicture(input: ThreadDocument, advance: AdvanceFn, options: ThreadPictureOptions = {}): ThreadPicture {
  const document = soundDocument(input);
  const kinds = threadKinds(document);
  const { keep } = options;
  const sizes = threadSizes(document, advance, keep?.sizes, options.panels);
  const { plain, panels, edges: panelEdges } = splitPanels(document, kinds);
  const base = keep === undefined ? placeThread(plain, sizes, options) : keeps(keep, plain, kinds, sizes) ? keep.base : placeThread(plain, sizes, { ...options, before: topPlaces(keep) });
  const { places, sides } = placePanels(document, panels, sizes, base, keep?.sides);
  const boxes = placedBoxes(document, sizes, places);
  const edges = document.edges ?? [];
  const proposals = options.proposals ?? "each";
  const made: ThreadLineOptions = { router: options.router, proposalRouter: options.proposalRouter, curve: options.curve, legend: options.legend, locale: options.locale, timeZone: options.timeZone };
  const facts = { document, plain, kinds, sizes, places, base, sides, states: partStates(plain.edges ?? []), made };
  const lines = panelRoutes(document.id, boxes, panelEdges);
  const names = panelLabels(panels, sizes, places);
  if (keep !== undefined && keepsLines(keep, plain, places, made, proposals)) {
    // A picture of the boxes and the lines of the panels is good, so its routes go into the picture with the routes of before.
    const next = pictureOf({ id: document.id, boxes, edges: panelEdges }, { routes: lines, labels: names });
    const routes = [...keep.picture.routes.filter((route) => !isPanelLine(route, keep.kinds)), ...next.routes];
    const labels = [...keep.picture.labels.filter((label) => label.box === undefined || keep.kinds.get(label.box) !== "panel"), ...next.labels];
    return { ...facts, picture: { ...next, routes, labels }, proposals: keep.proposals };
  }
  // The routes of the other edges read no panel. Thus a panel is no obstacle of a line, and a picture with a panel has the lines of the picture with none.
  const plainBoxes = plain === document ? boxes : placedBoxes(plain, sizes, places);
  const behind = proposalRoutes(plain, plainBoxes, proposals, options);
  const main = routeThread(document.id, plainBoxes, (plain.edges ?? []).filter((edge) => isDrawn(edge) && !isProposal(edge)), { router: options.router ?? "shared", curve: options.curve, bundle: true });
  const picture = pictureOf({ id: document.id, boxes, edges }, { routes: [...behind, ...main, ...lines], labels: [...threadLabels(plain, kinds, sizes, places, options, advance), ...names] });
  return { ...facts, picture, proposals };
}

/**
 * This function gives a thread picture with the routes of other proposals. Each box, each label and each other route stays.
 * It gives the same picture when that picture has the routes of `proposals`. A picture with each proposal has them always.
 */
export function withProposals(thread: ThreadPicture, proposals: Proposals, options: ThreadRouteOptions = {}): ThreadPicture {
  if (hasProposals(thread.proposals, proposals)) return thread;
  const { plain, picture } = thread;
  const boxes = placedBoxes(plain, thread.sizes, thread.places);
  // `pictureOf` gives each route the ends and the data of its edge. A picture of the boxes and these routes is good, so its routes go into the picture.
  const behind = pictureOf({ id: plain.id, boxes, edges: plain.edges ?? [] }, { routes: proposalRoutes(plain, boxes, proposals, options) }).routes;
  return { ...thread, proposals, picture: { ...picture, routes: [...behind, ...picture.routes.filter((route) => !isProposal(route) || isPanelLine(route, thread.kinds))] } };
}
