import { spanPart, type TimeSpan } from "../replay.ts";

/** The width of the picture of the ticks of a scrubber, in the units of its `viewBox`. */
export const TICK_BOX = 1000;

/** A label of the axis of a scrubber: a text at a time. */
export interface ScrubberLabel {
  readonly at: number;
  /** The text, for example "12:00" or "1 day". Keep it short: the axis of a phone is narrow. */
  readonly text: string;
}

/** The place of a label on the axis of a scrubber. */
export interface LabelPlace {
  readonly text: string;
  /** The place of the tick of the label, from 0 at the start of the axis to 1 at its end. */
  readonly part: number;
  /** The side of the text that is at the tick. A label near an end of the axis stays in the axis. */
  readonly align: "start" | "center" | "end";
}

/** The part of the axis at each end in which a label does not have its middle at its tick. */
export const LABEL_EDGE = 0.08;

/**
 * This function gives the places of the ticks of a list of times on an axis, in the units of `TICK_BOX`.
 * A time out of the range has no tick. Two times with less than 0.1 unit between them have one tick.
 */
export function tickPlaces(span: TimeSpan, times: readonly number[]): readonly number[] {
  if (!(span.to > span.from)) return [];
  const places = new Set<number>();
  for (const time of times) {
    if (time >= span.from && time <= span.to) places.add(Math.round(spanPart(span, time) * TICK_BOX * 10) / 10);
  }
  return [...places].sort((a, b) => a - b);
}

/** This function gives the path of the ticks of an SVG picture: one vertical line from `top` to `bottom` at each place. */
export function tickPath(places: readonly number[], top: number, bottom: number): string {
  return places.map((place) => `M${String(place)} ${String(top)}V${String(bottom)}`).join("");
}

/** This function gives the place of each label of an axis. A label out of the range is not in the result. */
export function labelPlaces(span: TimeSpan, labels: readonly ScrubberLabel[]): readonly LabelPlace[] {
  if (!(span.to > span.from)) return [];
  return labels
    .filter((label) => label.at >= span.from && label.at <= span.to)
    .map((label) => {
      const part = spanPart(span, label.at);
      return { text: label.text, part, align: part < LABEL_EDGE ? "start" : part > 1 - LABEL_EDGE ? "end" : "center" };
    });
}
