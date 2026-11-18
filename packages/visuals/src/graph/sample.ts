import { PICTURE_SCHEMA, pathOf, type LayoutPicture, type PictureBox, type PictureLabel, type PictureRoute } from "@mark1russell7/layout-contract";

// The picture and the 2D context of the tests. The entry does not export them.

/** A card: a box with two rows. */
export const CARD: PictureBox = { id: "card", x: 0, y: 0, w: 200, h: 100 };

/** The first row of the card. */
export const ROW_1: PictureBox = { id: "row-1", parent: "card", x: 10, y: 30, w: 180, h: 25 };

/** The second row of the card. */
export const ROW_2: PictureBox = { id: "row-2", parent: "card", x: 10, y: 65, w: 180, h: 25 };

/** A box with the form of a circle, at the right of the card. The middle of the circle is at (330, 50), and its radius is 30. */
export const TOPIC: PictureBox = { id: "topic", x: 300, y: 20, w: 60, h: 60, shape: { kind: "circle", cx: 30, cy: 30, r: 30 } };

/** A box with no child, far below the card. */
export const FAR: PictureBox = { id: "far", x: 0, y: 300, w: 100, h: 40 };

/** A straight route from the first row to the topic. */
export const LINK: PictureRoute = {
  id: "link",
  source: "row-1",
  target: "topic",
  path: pathOf([
    { x: 190, y: 50 },
    { x: 300, y: 50 },
  ]),
};

/** A route with a curve from the second row to the far box. */
export const CURVE: PictureRoute = {
  id: "curve",
  source: "row-2",
  target: "far",
  path: [
    { kind: "move", to: { x: 100, y: 90 } },
    { kind: "cubic", c1: { x: 100, y: 200 }, c2: { x: 50, y: 200 }, to: { x: 50, y: 300 } },
  ],
};

/** A route with a corner from the topic to the far box. */
export const ASIDE: PictureRoute = {
  id: "aside",
  source: "topic",
  target: "far",
  path: pathOf([
    { x: 330, y: 80 },
    { x: 330, y: 320 },
    { x: 100, y: 320 },
  ]),
};

/** The name of the card, in its header. */
export const CARD_LABEL: PictureLabel = { id: "card-label", box: "card", x: 10, y: 6, w: 100, h: 18, lines: ["Card"], lineHeight: 18, font: "13px sans-serif" };

/** The text of the first row: two lines. */
export const ROW_LABEL: PictureLabel = { id: "row-label", box: "row-1", x: 16, y: 32, w: 160, h: 20, lines: ["First line", "Second"], lineHeight: 10, font: "8px sans-serif" };

/** The name of the straight route, at its middle. */
export const LINK_LABEL: PictureLabel = { id: "link-label", route: "link", x: 225, y: 42, w: 40, h: 16, lines: ["uses"], lineHeight: 16, font: "12px sans-serif", align: "center" };

/** A label that names no record. */
export const NOTE: PictureLabel = { id: "note", x: 400, y: 0, w: 120, h: 16, lines: ["A note"], lineHeight: 16, font: "12px sans-serif", align: "right" };

/** The picture of the tests. Its bounds are 520 by 340, from the origin. */
export const PICTURE: LayoutPicture = {
  schema: PICTURE_SCHEMA,
  boxes: [CARD, ROW_1, ROW_2, TOPIC, FAR],
  routes: [LINK, CURVE, ASIDE],
  labels: [CARD_LABEL, ROW_LABEL, LINK_LABEL, NOTE],
};

/** A 2D context for the tests, with no browser. */
export interface FakeContext {
  readonly context: CanvasRenderingContext2D;
  /** Each use of a function and each change of a property, in order. */
  readonly calls: string[];
}

/** The options of `fakeContext`. */
export interface FakeContextOptions {
  /** With false, the context has no round rectangle, as an old browser. */
  readonly roundRect?: boolean | undefined;
  /** The width of each letter of a text that the context measures. The default is 6. */
  readonly letter?: number | undefined;
}

const show = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

/**
 * This function makes a 2D context that writes each use of it in a list.
 * A function is a line with its name and its values. A property is a line with its name, `=` and its value.
 */
export function fakeContext(options: FakeContextOptions = {}): FakeContext {
  const calls: string[] = [];
  const letter = options.letter ?? 6;
  const state: Record<string, unknown> = {
    font: "10px sans-serif",
    measureText(text: string): { readonly width: number } {
      calls.push(`measureText ${text}`);
      return { width: text.length * letter };
    },
  };
  if (options.roundRect === false) state["roundRect"] = undefined;
  const context = new Proxy(state, {
    get(target, name) {
      if (typeof name !== "string") return undefined;
      if (name in target) return target[name];
      return (...values: unknown[]): void => void calls.push([name, ...values.map(show)].join(" "));
    },
    set(target, name, value: unknown) {
      if (typeof name !== "string") return false;
      target[name] = value;
      calls.push(`${name} = ${show(value)}`);
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

/** This function gives the lines of one name from the list of a context: the uses of one function, or the changes of one property. */
export function linesOf(calls: readonly string[], name: string): string[] {
  return calls.filter((call) => call === name || call.startsWith(`${name} `));
}
