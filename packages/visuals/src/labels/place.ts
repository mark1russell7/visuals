import { overlapOf, type Rect } from "@mark1russell7/layout-contract";

/**
 * The side of an anchor that the text of a label is on.
 * `center` puts the middle of the text on the anchor. Use it for the name of an area.
 */
export type LabelSide = "right" | "left" | "above" | "below" | "center";

/** The default sides of a label, in the sequence in which `placeLabels` tries them. */
export const LABEL_SIDES: readonly LabelSide[] = ["right", "left", "above", "below"];

/** The default distance between the mark of an anchor and the text of its label, in CSS pixels. */
export const LABEL_GAP = 4;

/**
 * One label for `placeLabels`: its anchor in a picture, and the size of its text.
 * Each length is in CSS pixels. A position is from the top left corner of the picture.
 */
export interface LabelAnchor {
  /** The position of the anchor: the point of the picture that the label names. */
  readonly x: number;
  readonly y: number;
  /** The width of the text. */
  readonly width: number;
  /** The height of the text. */
  readonly height: number;
  /**
   * The radius of the mark at the anchor, for example a half of the width of a dot. The default is 0: the anchor has no mark.
   * No text is on the square around a mark.
   */
  readonly clear?: number | undefined;
  /** The sides that the text can have, in the sequence of the tries. The default is `LABEL_SIDES`. */
  readonly sides?: readonly LabelSide[] | undefined;
}

/** The picture that the labels are in. Each length is in CSS pixels. */
export interface LabelFrame {
  readonly width: number;
  readonly height: number;
  /** The distance between a mark and the text of its label. The default is `LABEL_GAP`. */
  readonly gap?: number | undefined;
  /** The smallest distance between a text and an edge of the picture. The default is 0. */
  readonly edge?: number | undefined;
}

/** The place of the text of a label: its side, and its rectangle in the picture. */
export interface LabelPlace {
  readonly side: LabelSide;
  readonly box: Rect;
}

/** This function gives the rectangle of the text of a label on one side of its anchor. `gap` is the distance between the mark and the text. */
export function labelBox(label: LabelAnchor, side: LabelSide, gap: number = LABEL_GAP): Rect {
  const { width: w, height: h } = label;
  const reach = (label.clear ?? 0) + gap;
  const x = side === "right" ? label.x + reach : side === "left" ? label.x - reach - w : label.x - w / 2;
  const y = side === "below" ? label.y + reach : side === "above" ? label.y - reach - h : label.y - h / 2;
  return { x, y, w, h };
}

/** This function tells if the insides of two rectangles overlap. Two rectangles with a common edge do not overlap. */
function overlaps(a: Rect, b: Rect): boolean {
  const overlap = overlapOf(a, b);
  return overlap.x > 0 && overlap.y > 0;
}

/** This function gives the square around the mark of an anchor, or `undefined` for an anchor with no mark. */
function markOf(label: LabelAnchor): Rect | undefined {
  const clear = label.clear ?? 0;
  return clear > 0 ? { x: label.x - clear, y: label.y - clear, w: 2 * clear, h: 2 * clear } : undefined;
}

/**
 * This function gives each label a place for its text, or `undefined` for a label that the picture does not show.
 * The result has one value for each label, in the sequence of the labels.
 *
 * - The first label has the first choice. Thus give the labels from the most important to the least important.
 * - A label tries its sides in sequence. It takes the first side on which its text is in the picture and on no other text and on no mark.
 * - A label with no free side is not in the picture. A label that comes later does not move a label that has a place.
 * - A label with an anchor out of the picture, or with a text of no size, is not in the picture. Its mark continues to keep the texts away.
 *
 * The function compares each label with each other label. It is for some hundreds of labels.
 */
export function placeLabels(labels: readonly LabelAnchor[], frame: LabelFrame): (LabelPlace | undefined)[] {
  const gap = frame.gap ?? LABEL_GAP;
  const edge = frame.edge ?? 0;
  const marks = labels.map(markOf);
  const texts: Rect[] = [];
  return labels.map((label, index) => {
    if (!(label.width > 0 && label.height > 0)) return undefined;
    if (!(label.x >= 0 && label.x <= frame.width && label.y >= 0 && label.y <= frame.height)) return undefined;
    for (const side of label.sides ?? LABEL_SIDES) {
      const box = labelBox(label, side, gap);
      if (!(box.x >= edge && box.y >= edge && box.x + box.w <= frame.width - edge && box.y + box.h <= frame.height - edge)) continue;
      if (texts.some((text) => overlaps(box, text))) continue;
      if (marks.some((mark, other) => mark !== undefined && other !== index && overlaps(box, mark))) continue;
      texts.push(box);
      return { side, box };
    }
    return undefined;
  });
}
