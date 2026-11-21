import { createMeasurer, layoutText, type AdvanceFn, type TextLayout } from "@mark1russell7/layout-contract/text";
import { imageOf, labelOf, threadKinds, topicCounts, type ThreadDocument, type ThreadKind } from "./document.ts";

/** The font family of the text of a thread picture: the font of the system. */
export const THREAD_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/** The measures of the text of a box. */
export interface TextLook {
  /** The font, as the CSS property `font`. */
  readonly font: string;
  /** The height of one line. */
  readonly lineHeight: number;
  /** The largest width of a line. */
  readonly wrapWidth: number;
  /** The largest number of lines. A longer text ends with an ellipsis. */
  readonly maxLines: number;
  /** The space on the left and on the right of the text. */
  readonly padX: number;
  /** The space above and below the text. */
  readonly padY: number;
}

/** The measures of a part: one row of the card of its message. Each row has the same width. */
export const PART_LOOK: TextLook & { readonly width: number } = {
  font: `13px ${THREAD_FAMILY}`,
  lineHeight: 18,
  wrapWidth: 232,
  maxLines: 3,
  padX: 12,
  padY: 8,
  width: 256,
};

/** The measures of the card of a message: the height of its header, the space around its rows and the space between two rows. */
export const MESSAGE_LOOK = {
  header: 24,
  padding: 5,
  gap: 3,
  /** The font of the date in the header. */
  dateFont: `11px ${THREAD_FAMILY}`,
  /** The height of the line of the date. */
  dateLine: 14,
} as const;

/**
 * The measures of the image of an entry. The image has the width of a row, and it is above the text of the entry.
 * `height` is its height, `gap` is the space between the image and the text, and `radius` is the radius of its corners.
 * `least` is the smallest height of the image on the screen, in CSS pixels. A smaller image has no paint.
 */
export const IMAGE_LOOK = {
  height: 160,
  gap: 3,
  radius: 5,
  least: 12,
} as const;

/**
 * The measures of a panel. `width` is its width when the document gives none, and `height` is its height before the page gives it content.
 * `least` is the smallest width and height of a panel. The text is the name of the panel, for a far view.
 */
export const PANEL_LOOK: TextLook & { readonly width: number; readonly height: number; readonly least: number } = {
  font: `600 13px ${THREAD_FAMILY}`,
  lineHeight: 18,
  wrapWidth: 296,
  maxLines: 1,
  padX: 12,
  padY: 10,
  width: 320,
  height: 160,
  least: 40,
};

/**
 * The measures of a group: the frame around the boxes in it. The text is the name of the group, on one line in its header.
 * `header` is the height of the header, `padding` is the space around the boxes and `gap` is the space between two boxes.
 */
export const GROUP_LOOK: TextLook & { readonly header: number; readonly padding: number; readonly gap: number } = {
  font: `600 13px ${THREAD_FAMILY}`,
  lineHeight: 18,
  wrapWidth: 360,
  maxLines: 1,
  padX: 14,
  padY: 8,
  header: 34,
  padding: 14,
  gap: 14,
};

/** The measures of a topic. They add the count of the parts of the topic to the measures of a text. */
export interface TopicLook extends TextLook {
  /** The size of the font of the name, in pixels. */
  readonly size: number;
  /** The font of the count. */
  readonly countFont: string;
  /** The space between the name and the count. */
  readonly countGap: number;
  /** The radius of the corners. */
  readonly radius: number;
}

/** The share of the largest topic that each topic has, when all the topics have the same number of parts. */
const EQUAL_SHARE = 0.4;

/**
 * This function gives the measures of a topic. `share` is the place of the topic between the smallest and the largest topic, from 0 to 1.
 * A topic with more parts has larger text, so the large topics are the landmarks of the picture.
 */
export function topicLook(share: number): TopicLook {
  const size = Math.round(15 + 9 * Math.sqrt(Math.min(1, Math.max(0, share))));
  return {
    font: `600 ${String(size)}px ${THREAD_FAMILY}`,
    countFont: `500 ${String(Math.round(size * 0.72))}px ${THREAD_FAMILY}`,
    size,
    lineHeight: Math.round(size * 1.28),
    wrapWidth: size * 12,
    maxLines: 2,
    padX: Math.round(size * 0.9),
    padY: Math.round(size * 0.55),
    countGap: Math.round(size * 0.5),
    radius: Math.round(size * 0.75),
  };
}

/** The measured text and the size of one box with no box in it. For a group, the size is the size of its header with its name. */
export interface LeafSize {
  readonly kind: ThreadKind;
  /** The short name of the box, before the measure. */
  readonly label: string;
  /** The lines of the short name of the box. */
  readonly text: TextLayout;
  readonly look: TextLook | TopicLook;
  /** The number of parts of a topic. A box that is not a topic has 0. */
  readonly count: number;
  /** The width of the text of the count. A box that is not a topic has 0. */
  readonly countWidth: number;
  /** The width of the text with the space around it. It is the width of a part and of a topic, and of the row of an entry. */
  readonly w: number;
  /** The height of the text with the space around it. For an entry with an image, it includes `image`. */
  readonly h: number;
  /** The height of the image of an entry with the gap below it. An entry with no image has no value. */
  readonly image?: number | undefined;
}

/** This function tells if a look is the look of a topic. */
export function isTopicLook(look: TextLook | TopicLook): look is TopicLook {
  return "countFont" in look;
}

/** This function gives the width of the longest line of a text, as a whole number. */
export function widestLine(text: TextLayout): number {
  return Math.ceil(Math.max(0, ...text.widths));
}

/**
 * This function measures each box of a document that has no box in it. It gives the lines and the size of the box, by its id.
 * `advance` gives the width of a text in a font: `canvasAdvance` of `@mark1russell7/layout-contract/text` gives it for a canvas.
 * A group gets the measure of its header: the name of the group on one line. A message gets no measure.
 *
 * With `keep`, a box of that map keeps its lines, its look and its size. Only the count of a topic is new.
 * Thus a change of an edge does not change the size of a box.
 *
 * A panel has the width of its `w`, or the width of `PANEL_LOOK`. `panels` gives the height of the content of a panel, by its id.
 * A panel with no such height has the height of its `h`, or the height of `PANEL_LOOK`.
 */
export function threadSizes(document: ThreadDocument, advance: AdvanceFn, keep?: ReadonlyMap<string, LeafSize>, panels?: ReadonlyMap<string, number>): Map<string, LeafSize> {
  const measurer = createMeasurer(advance);
  const kinds = threadKinds(document);
  const counts = topicCounts(document.edges ?? []);
  const topics = document.boxes.filter((box) => kinds.get(box.id) === "topic").map((box) => counts.get(box.id) ?? 0);
  const least = Math.min(...topics);
  const most = Math.max(...topics);
  const out = new Map<string, LeafSize>();
  for (const box of document.boxes) {
    const kind = kinds.get(box.id) ?? "topic";
    if (kind === "message") continue;
    const count = kind === "topic" ? (counts.get(box.id) ?? 0) : 0;
    const label = labelOf(box);
    const kept = keep?.get(box.id);
    if (kind === "panel") {
      const look = PANEL_LOOK;
      const text = kept !== undefined && kept.kind === kind && kept.label === label ? kept.text : layoutText(label, { font: look.font, measurer, lineHeight: look.lineHeight, wrapWidth: look.wrapWidth, maxLines: look.maxLines, wordBreak: "anywhere" });
      const side = (...lengths: readonly (number | undefined)[]): number => Math.max(look.least, Math.ceil(lengths.find((length) => length !== undefined && Number.isFinite(length) && length > 0) ?? 0));
      out.set(box.id, { kind, label, text, look, count: 0, countWidth: 0, w: side(box.w, look.width), h: side(panels?.get(box.id), box.h, look.height) });
      continue;
    }
    // An entry whose image comes or goes gets a new size, so the layout gives its card a new height.
    const image = kind === "entry" && imageOf(box) !== undefined ? IMAGE_LOOK.height + IMAGE_LOOK.gap : undefined;
    if (kept !== undefined && kept.kind === kind && kept.label === label && kept.image === image) {
      const countWidth = isTopicLook(kept.look) ? Math.ceil(advance(String(count), kept.look.countFont)) : 0;
      out.set(box.id, { ...kept, count, countWidth });
      continue;
    }
    if (kind === "group") {
      const look = GROUP_LOOK;
      const text = layoutText(label, { font: look.font, measurer, lineHeight: look.lineHeight, wrapWidth: look.wrapWidth, maxLines: look.maxLines, wordBreak: "anywhere" });
      out.set(box.id, { kind, label, text, look, count: 0, countWidth: 0, w: widestLine(text) + 2 * look.padX, h: look.header });
      continue;
    }
    if (kind === "topic") {
      const look = topicLook(most === least ? EQUAL_SHARE : (count - least) / (most - least));
      const text = layoutText(label, { font: look.font, measurer, lineHeight: look.lineHeight, wrapWidth: look.wrapWidth, maxLines: look.maxLines, wordBreak: "anywhere" });
      const countWidth = Math.ceil(advance(String(count), look.countFont));
      out.set(box.id, { kind, label, text, look, count, countWidth, w: widestLine(text) + look.countGap + countWidth + 2 * look.padX, h: Math.max(1, text.lineCount) * look.lineHeight + 2 * look.padY });
      continue;
    }
    const look = PART_LOOK;
    const text = layoutText(label, { font: look.font, measurer, lineHeight: look.lineHeight, wrapWidth: look.wrapWidth, maxLines: look.maxLines, wordBreak: "anywhere" });
    const lines = Math.max(1, text.lineCount) * look.lineHeight + 2 * look.padY;
    // The image of an entry is above its text, in the same row of the card.
    out.set(box.id, { kind, label, text, look, count: 0, countWidth: 0, w: look.width, h: lines + (image ?? 0), ...(image === undefined ? {} : { image }) });
  }
  return out;
}
