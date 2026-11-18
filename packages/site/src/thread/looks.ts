import type { BoxLook, BoxMark, LabelLook, PictureLooks, RouteLook } from "@mark1russell7/visuals/graph";
import { choiceOf, edgeKind, edgeState, isDone, isProposal, relationOf, waitsOf } from "./document.ts";
import { isPanelLine, type ThreadPicture } from "./picture.ts";
import { entryRow } from "./place.ts";
import { isTopicLook, MESSAGE_LOOK } from "./sizes.ts";

/** The colors of a thread picture. */
export interface ThreadTheme {
  /** The color of the page behind the picture. */
  readonly background: string;
  /** The inside of a row: a part, or an entry. */
  readonly surface: string;
  /** The inside of the card of a message, behind its rows. */
  readonly tray: string;
  /** The border of a card. */
  readonly stroke: string;
  readonly text: string;
  /** The text of a date and of a tag. */
  readonly muted: string;
  /** The line of a chosen topic, of a proposal and of a relation, and a topic in a far view. */
  readonly edge: string;
  /** The line of a reply. */
  readonly edgeStrong: string;
  /** The selection, the record below the pointer and the sign of a part with a topic that is not the first proposal. */
  readonly accent: string;
  /** The inside of a topic. */
  readonly topicFill: string;
  /** The text of a topic. */
  readonly topicText: string;
  /** The sign of a part with proposals and no topic. */
  readonly open: string;
  /** The bars of a text that is too small to read. */
  readonly quiet: string;
  /** The border and the text of an entry that waits, and its inside in a far view. The default is the color `open`. */
  readonly waits?: string | undefined;
  /** The inside of an entry that waits, in a near view. The default is the color `surface`. */
  readonly waitsFill?: string | undefined;
}

/** The colors of a thread picture on a light page. */
export const LIGHT_THREAD_THEME: ThreadTheme = {
  background: "#f5f6f9",
  surface: "#ffffff",
  tray: "#e9ecf3",
  stroke: "#c3c9d6",
  text: "#151c2e",
  muted: "#5f6880",
  edge: "#a9b0c2",
  edgeStrong: "#5f6880",
  accent: "#2346c4",
  topicFill: "#1c2540",
  topicText: "#ffffff",
  open: "#a55a00",
  quiet: "#d3d8e3",
  waits: "#b0235f",
  waitsFill: "#fdeef4",
};

/** The colors of a thread picture on a dark page. */
export const DARK_THREAD_THEME: ThreadTheme = {
  background: "#0e1220",
  surface: "#171d30",
  tray: "#1f2640",
  stroke: "#3a4365",
  text: "#e6e9f3",
  muted: "#949cb3",
  edge: "#4d5779",
  edgeStrong: "#949cb3",
  accent: "#93abff",
  topicFill: "#dfe4f3",
  topicText: "#0e1220",
  open: "#f0b45a",
  quiet: "#2f3855",
  waits: "#f783ac",
  waitsFill: "#3a1c2f",
};

/** The zoom at which a person reads the text of a part. Below it, the text of a part is a row of bars, and the name of a topic keeps its height. */
export const TEXT_ZOOM = 0.7;

/** The smallest height on the screen of a bar of text, in CSS pixels. A smaller text has no paint. */
const SMALLEST_BAR = 2.5;

/** The share of its color that a topic keeps when it is done. */
export const DONE_OPACITY = 0.45;

/** The share of its color that a proposal keeps when a person shows each proposal. */
export const PROPOSAL_OPACITY = 0.55;

/** The share of its color that the line of a chosen topic keeps in a far view. A far view has many lines, so each line is light. */
export const FAR_LINE_OPACITY = 0.6;

/** The width of the border of an entry that waits. */
export const WAITS_WIDTH = 2;

/** The radius of the corners of a panel. */
export const PANEL_RADIUS = 10;

/** The dashes of the line from a box to its panel. */
export const PANEL_DASH: readonly number[] = [3, 4];

/** The height on the screen of the name of a panel in a far view. */
export const PANEL_NAME_LINE = 15;

/** This function gives the color of an entry that waits: the color `waits` of a theme, or its color `open`. */
export function waitsColor(theme: ThreadTheme): string {
  return theme.waits ?? theme.open;
}

/** What the looks of a thread picture read at the time of each paint. */
export interface ThreadLookState {
  /** The picture that the stage shows. */
  readonly thread: ThreadPicture;
  /** With `true`, each proposal has a line. With `false`, only the proposals of `part` have lines. */
  readonly proposals: boolean;
  /** The selected part or entry. */
  readonly part?: string | undefined;
  /** The topic that a row of the card of the page points at. The topic gets a ring, and its edge gets the accent. */
  readonly hint?: { readonly topic: string; readonly edge?: string | undefined } | undefined;
}

/** This function gives the height on the screen of the names of a topic in a far view, from the size of its text. A larger topic keeps a larger name. */
export function farNameLine(size: number): number {
  return Math.round((12 + (size - 15) / 3) * 1.28);
}

/**
 * This function gives the looks of a thread picture. `read` gives the state at the time of a paint, so a change of the state needs only a new paint.
 *
 * - A message is a card, and each part is a row of it. An entry is a card with one text. A topic is a pill.
 * - A sign at the left end of a row tells the state of its topic. A full dot is a topic that is not the first proposal, and a ring is no topic.
 * - An entry that waits has a border and an inside of the color `waits`, and its header tells who it waits on.
 * - A reply has an arrow. A chosen topic is a thin line with a dot at its part.
 * - A proposal is a line of dashes, and a relation is a line of dots.
 * - A record of the focus, the record below the pointer and the selected record have the accent.
 * - In a far view, the text of a part is a row of bars. The name of a topic keeps a height that a person reads.
 * - In a far view, a topic is the darkest shape, and the line of a chosen topic is thin and light, with no dot.
 * - In a far view, an entry that waits has all its inside in the color `waits`, so a person finds it between many cards.
 * - A panel is an empty card, and a line of short dashes joins it to its box. In a far view, the panel shows its name.
 */
export function threadLooks(read: () => ThreadLookState): PictureLooks<ThreadTheme> {
  return {
    box(box, state, theme): BoxLook | undefined {
      const { thread, hint } = read();
      const kind = thread.kinds.get(box.id);
      const lit = state.highlight > 0;
      const border = { stroke: lit ? theme.accent : theme.stroke, width: state.highlight === 2 ? 2 : 1 };
      if (kind === "message") return { fill: theme.tray, ...border, radius: 9 };
      if (kind === "panel") return { fill: theme.surface, ...border, stroke: lit ? theme.accent : theme.edgeStrong, radius: PANEL_RADIUS };
      const size = thread.sizes.get(box.id);
      if (kind === "topic") {
        const far = state.zoom < TEXT_ZOOM;
        const ring = lit || hint?.topic === box.id ? { color: theme.accent, width: 2, gap: 3 } : undefined;
        const radius = size !== undefined && isTopicLook(size.look) ? size.look.radius : 12;
        return { fill: far && !lit ? theme.edge : theme.topicFill, radius, opacity: isDone(box) ? DONE_OPACITY : 1, ring };
      }
      const sign = thread.states.get(box.id);
      const row = kind === "entry" && size !== undefined ? entryRow(box, size) : box;
      const at = { x: kind === "entry" ? MESSAGE_LOOK.padding + 6 : 6, y: row.y - box.y + row.h / 2 };
      const marks: BoxMark[] = sign === "changed" ? [{ shape: "dot", ...at, radius: 2.5, color: theme.accent }] : sign === "open" ? [{ shape: "ring", ...at, radius: 2.75, color: theme.open, width: 1.5 }] : [];
      if (kind === "entry" && waitsOf(box) !== undefined) {
        const waits = waitsColor(theme);
        const far = state.zoom < TEXT_ZOOM;
        return { fill: far ? waits : (theme.waitsFill ?? theme.surface), stroke: lit ? theme.accent : waits, width: WAITS_WIDTH, radius: 9, marks };
      }
      if (kind === "entry") return { fill: theme.surface, ...border, radius: 9, marks };
      return { fill: theme.surface, ...(lit ? border : {}), radius: 6, marks };
    },

    route(route, state, theme): RouteLook | undefined {
      const { thread, proposals, part, hint } = read();
      const kind = edgeKind(route);
      if (kind === "part" || edgeState(route) === "refused") return undefined;
      const lit = state.highlight > 0 || state.focus === "in" || hint?.edge === route.id;
      const line = lit ? { stroke: theme.accent, width: 2 } : undefined;
      if (isPanelLine(route, thread.kinds)) return { stroke: theme.edgeStrong, width: 1.25, ...line, dash: PANEL_DASH };
      const own = isProposal(route) && choiceOf(route) === part;
      if (isProposal(route) && !proposals && !own) return undefined;
      if (isProposal(route)) return { stroke: theme.edge, width: 1.25, ...line, dash: [5, 5], opacity: own || lit ? 1 : PROPOSAL_OPACITY };
      if (kind === "reply") return { stroke: theme.edgeStrong, width: 1.5, ...line, end: { shape: "arrow", size: 7 } };
      if (kind === "relates") return { stroke: theme.edge, width: 1.5, ...line, dash: [1, 5], end: relationOf(route) === "sub" ? { shape: "arrow", size: 6 } : undefined };
      if (state.zoom < TEXT_ZOOM && !lit) return { stroke: theme.edge, width: 1, opacity: FAR_LINE_OPACITY };
      return { stroke: theme.edge, width: 1.25, ...line, start: { shape: "dot", size: 2.75 } };
    },

    label(label, state, theme, of): LabelLook | undefined {
      const { thread } = read();
      const role = label.data?.["role"];
      const far = state.zoom < TEXT_ZOOM;
      const kind = of?.type === "box" ? thread.kinds.get(of.id) : undefined;
      if (kind === "topic" && of?.type === "box") {
        if (role === "count") return far ? undefined : { color: theme.topicText, opacity: 0.72 };
        if (!far) return { color: theme.topicText };
        const size = thread.sizes.get(of.id);
        const least = farNameLine(size !== undefined && isTopicLook(size.look) ? size.look.size : 15);
        return { color: state.highlight > 0 ? theme.accent : theme.text, halo: theme.background, least, opacity: isDone(of.box) ? 0.6 : 1 };
      }
      // In a near view, the slot of the view has the content of a panel. In a far view the slot is hidden, so the name tells the panel.
      if (kind === "panel") return far ? { color: theme.text, halo: theme.surface, least: PANEL_NAME_LINE } : undefined;
      if (role === "waits") return far ? undefined : { color: waitsColor(theme) };
      if (role === "date" || role === "tag") return far ? undefined : { color: theme.muted };
      if (!far) return { color: theme.text };
      return label.lineHeight * state.zoom < SMALLEST_BAR ? undefined : { color: theme.quiet, as: "bars" };
    },
  };
}
