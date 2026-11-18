import type { PictureBox, PictureLabel, PictureRoute } from "@mark1russell7/layout-contract";
import type { Highlight } from "../highlight.ts";
import type { FocusLevel } from "./focus.ts";
import type { PictureRecord } from "./records.ts";

/** What a look knows about a record at the time of a picture. */
export interface RecordState {
  /** The highlight of the record. A label has the highlight of the record that it names. */
  readonly highlight: Highlight;
  /** How near the record is to the focus of the picture. */
  readonly focus: FocusLevel;
  /** The zoom of the camera: the number of CSS pixels for one unit of the picture. */
  readonly zoom: number;
  /** This value is true for a box with children, and for a label of such a box. */
  readonly container: boolean;
}

/**
 * This function gives the size of one unit of a look, in the unit of the picture.
 * The widths of the lines, the dashes and the sizes of the signs of a look are in this unit.
 *
 * At the zoom 1 or less, one unit is one CSS pixel. Thus a thin line stays clear in a small picture.
 * Above the zoom 1, one unit is one unit of the picture. Thus a line grows with its box.
 */
export function lookUnit(zoom: number): number {
  return zoom > 0 && zoom < 1 ? 1 / zoom : 1;
}

/** A line around a box, off its border. A page shows a selection with it. */
export interface BoxRing {
  readonly color: string;
  /** The width of the line, in units of a look. */
  readonly width: number;
  /** The distance from the border of the box to the line, in units of a look. A polygon has the line on its border. */
  readonly gap: number;
}

/** A small sign in a box, for example for the state of its record. */
export interface BoxMark {
  /** A `dot` is a full circle, and a `ring` is the line of a circle. */
  readonly shape: "dot" | "ring";
  /** The middle of the sign from the left edge of the box, in the unit of the picture. */
  readonly x: number;
  /** The middle of the sign from the top edge of the box, in the unit of the picture. */
  readonly y: number;
  /** The radius of the sign, in units of a look. */
  readonly radius: number;
  readonly color: string;
  /** The width of the line of a ring, in units of a look. The default is 1.5. */
  readonly width?: number | undefined;
}

/** The look of a box. A box with no `fill` and no `stroke` shows only its ring and its signs. */
export interface BoxLook {
  /** The color of the inside. */
  readonly fill?: string | undefined;
  /** The color of the border. */
  readonly stroke?: string | undefined;
  /** The width of the border, in units of a look. The default is 1. */
  readonly width?: number | undefined;
  /** The lengths of the dashes and the gaps of the border, in units of a look. */
  readonly dash?: readonly number[] | undefined;
  /** The radius of the corners of a rectangle, in the unit of the picture. The default is 0. */
  readonly radius?: number | undefined;
  /** The share of its color that the box keeps, from 0 to 1. The focus of the picture decreases it more. The default is 1. */
  readonly opacity?: number | undefined;
  readonly ring?: BoxRing | undefined;
  readonly marks?: readonly BoxMark[] | undefined;
}

/** The sign at an end of a route. */
export interface RouteEnd {
  /** An `arrow` points along the route, out of it. A `dot` is a full circle. */
  readonly shape: "arrow" | "dot";
  /** The length of an arrow or the radius of a dot, in units of a look. */
  readonly size: number;
}

/** The look of a route. */
export interface RouteLook {
  readonly stroke: string;
  /** The width of the line, in units of a look. The default is 1.25. */
  readonly width?: number | undefined;
  /** The lengths of the dashes and the gaps, in units of a look. */
  readonly dash?: readonly number[] | undefined;
  /** The share of its color that the route keeps, from 0 to 1. The default is 1. */
  readonly opacity?: number | undefined;
  /** The sign at the source of the route. */
  readonly start?: RouteEnd | undefined;
  /** The sign at the target of the route. */
  readonly end?: RouteEnd | undefined;
}

/** The look of a label. */
export interface LabelLook {
  readonly color: string;
  /** The share of its color that the label keeps, from 0 to 1. The default is 1. */
  readonly opacity?: number | undefined;
  /** The color of a line around each letter. A text on a route is clear with the color of the page. */
  readonly halo?: string | undefined;
  /** With `bars`, each line is a bar of its width: a person sees the form of a text that is too small to read. The default is `text`. */
  readonly as?: "text" | "bars" | undefined;
  /**
   * The smallest height of a line of the label on the screen, in CSS pixels. Use it for a name that a person reads in a far view.
   * At a zoom with a smaller line, the text keeps this height. It becomes larger about its place, and it is on top of each other shape.
   *
   * Two such texts do not overlap. The text of a record with a highlight has the first choice, then the text of the larger box.
   * A text with no free place has no paint. The value is at most `MOST_KEPT_LINE`, and it has no effect on bars.
   */
  readonly least?: number | undefined;
}

/** The largest height on the screen that a label keeps with `least`, in CSS pixels. A larger value of `least` becomes this value. */
export const MOST_KEPT_LINE = 32;

/**
 * The looks of a picture: one function for each type of record. `T` is the type of the theme.
 * Each function gives the look of a record in a state, or `undefined` for a record that the picture does not show.
 * A box that the picture does not show takes its labels with it, and a person cannot point at it.
 */
export interface PictureLooks<T> {
  box(box: PictureBox, state: RecordState, theme: T): BoxLook | undefined;
  route(route: PictureRoute, state: RecordState, theme: T): RouteLook | undefined;
  /** `of` is the record that the label names, or `undefined` for a label that names no record. */
  label(label: PictureLabel, state: RecordState, theme: T, of: PictureRecord | undefined): LabelLook | undefined;
}

/** The colors of a plain picture. */
export interface PictureTheme {
  /** The inside of a box with no child. */
  readonly box: string;
  /** The border of a box with no child. */
  readonly boxLine: string;
  /** The inside of a box with children. */
  readonly container: string;
  /** The border of a box with children, and the bars of a text that is too small to read. */
  readonly containerLine: string;
  readonly text: string;
  /** The text of a box with children. */
  readonly mutedText: string;
  readonly route: string;
  /** The color of a record with a highlight. */
  readonly accent: string;
  /** The color of the page behind the picture. The line around the text of a route has it. */
  readonly paper: string;
}

/** The colors of a plain picture on a light page. */
export const LIGHT_PICTURE_THEME: PictureTheme = {
  box: "#ffffff",
  boxLine: "#454f67",
  container: "#eef1f6",
  containerLine: "#aeb6c7",
  text: "#151c2e",
  mutedText: "#5f6880",
  route: "#7a8399",
  accent: "#2346c4",
  paper: "#f5f6f9",
};

/** The colors of a plain picture on a dark page. */
export const DARK_PICTURE_THEME: PictureTheme = {
  box: "#151a2b",
  boxLine: "#b3bad0",
  container: "#1c2236",
  containerLine: "#46507a",
  text: "#e6e9f3",
  mutedText: "#949cb3",
  route: "#6f7aa3",
  accent: "#93abff",
  paper: "#0e1220",
};

/** The smallest height of a line of text on the screen that a person can read, in CSS pixels. A smaller line is a bar in a plain picture. */
export const SMALLEST_TEXT_LINE = 11;

/** The smallest height of a line of text on the screen that a plain picture shows as a bar, in CSS pixels. */
export const SMALLEST_BAR_LINE = 2.5;

/** The smallest width on the screen of a box with children whose name stays a text in a plain picture, in CSS pixels. */
export const SMALLEST_NAMED_BOX = 48;

/** The options of `plainLooks`. */
export interface PlainLookOptions {
  /** The radius of the corners of each box, in the unit of the picture. The default is 6. */
  readonly radius?: number | undefined;
  /** The sign at the target of each route. The default is no sign. */
  readonly end?: RouteEnd | undefined;
}

/**
 * This function gives the looks of a plain picture: boxes with a border, routes as lines and the text of the labels.
 *
 * - A record below the pointer has the color `accent`. The selected record has a wider line too.
 * - A box with children has the colors of a container, and its label has the muted color.
 * - The label of a route has a line of the color `paper` around its letters.
 * - A text that is too small to read is a row of bars. A text that is smaller than a bar has no paint.
 * - The name of a box with children stays a text in a far view, while the box is `SMALLEST_NAMED_BOX` wide or more on the screen.
 *   The name of such a box with a highlight stays a text at each size.
 */
export function plainLooks(options: PlainLookOptions = {}): PictureLooks<PictureTheme> {
  const radius = options.radius ?? 6;
  return {
    box(_box, state, theme) {
      const plain = state.container ? theme.containerLine : theme.boxLine;
      return {
        fill: state.container ? theme.container : theme.box,
        stroke: state.highlight > 0 ? theme.accent : plain,
        width: state.highlight === 2 ? 2 : 1,
        radius,
      };
    },
    route(_route, state, theme) {
      return { stroke: state.highlight > 0 ? theme.accent : theme.route, width: state.highlight === 2 ? 2 : 1.25, end: options.end };
    },
    label(label, state, theme, of) {
      const tall = label.lineHeight * state.zoom;
      // The name of a group keeps a height that a person can read, until the group is small. The pointer shows the name of a small group.
      if (tall < SMALLEST_TEXT_LINE && state.container && of?.type === "box" && (state.highlight > 0 || of.box.w * state.zoom >= SMALLEST_NAMED_BOX)) {
        return { color: theme.mutedText, halo: theme.paper, least: SMALLEST_TEXT_LINE };
      }
      if (tall < SMALLEST_BAR_LINE) return undefined;
      if (tall < SMALLEST_TEXT_LINE) return { color: theme.containerLine, as: "bars" };
      if (of?.type === "route") return { color: theme.text, halo: theme.paper };
      return { color: state.container ? theme.mutedText : theme.text };
    },
  };
}
