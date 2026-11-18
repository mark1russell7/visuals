import { describe, expect, it } from "vitest";
import { DARK_PICTURE_THEME, LIGHT_PICTURE_THEME, lookUnit, plainLooks, SMALLEST_BAR_LINE, SMALLEST_NAMED_BOX, SMALLEST_TEXT_LINE, type RecordState } from "./looks.ts";
import { CARD, CARD_LABEL, LINK, LINK_LABEL, NOTE, ROW_1, ROW_LABEL } from "./sample.ts";

const theme = LIGHT_PICTURE_THEME;

/** This function gives the state of a record with no highlight in a picture with no focus, at the zoom 1. */
function state(more: Partial<RecordState> = {}): RecordState {
  return { highlight: 0, focus: "all", zoom: 1, container: false, ...more };
}

describe("lookUnit", () => {
  it("is one CSS pixel at the zoom 1 or less, and one unit of the picture above it", () => {
    expect(lookUnit(1)).toBe(1);
    expect(lookUnit(0.5)).toBe(2);
    expect(lookUnit(0.1)).toBe(10);
    expect(lookUnit(2)).toBe(1);
    expect(lookUnit(8)).toBe(1);
  });

  it("is 1 for a zoom that is not above 0", () => {
    expect(lookUnit(0)).toBe(1);
    expect(lookUnit(-2)).toBe(1);
    expect(lookUnit(Number.NaN)).toBe(1);
  });
});

describe("the themes of a plain picture", () => {
  it("have a color for each part, and the two themes are different in each part", () => {
    const keys = Object.keys(LIGHT_PICTURE_THEME) as (keyof typeof LIGHT_PICTURE_THEME)[];
    expect(Object.keys(DARK_PICTURE_THEME)).toEqual(keys);
    for (const key of keys) {
      expect(LIGHT_PICTURE_THEME[key]).toMatch(/^#[0-9a-f]{6}$/);
      expect(DARK_PICTURE_THEME[key]).toMatch(/^#[0-9a-f]{6}$/);
      expect(DARK_PICTURE_THEME[key]).not.toBe(LIGHT_PICTURE_THEME[key]);
    }
  });
});

describe("plainLooks", () => {
  const looks = plainLooks();

  it("gives a box with no child the colors of a box, and a box with children the colors of a container", () => {
    expect(looks.box(ROW_1, state(), theme)).toEqual({ fill: theme.box, stroke: theme.boxLine, width: 1, radius: 6 });
    expect(looks.box(CARD, state({ container: true }), theme)).toEqual({ fill: theme.container, stroke: theme.containerLine, width: 1, radius: 6 });
  });

  it("gives a box with a highlight the accent, and the selected box a wider line", () => {
    expect(looks.box(ROW_1, state({ highlight: 1 }), theme)).toEqual({ fill: theme.box, stroke: theme.accent, width: 1, radius: 6 });
    expect(looks.box(CARD, state({ highlight: 2, container: true }), theme)).toEqual({ fill: theme.container, stroke: theme.accent, width: 2, radius: 6 });
  });

  it("uses the colors of the theme that it gets", () => {
    expect(looks.box(ROW_1, state(), DARK_PICTURE_THEME)).toMatchObject({ fill: DARK_PICTURE_THEME.box, stroke: DARK_PICTURE_THEME.boxLine });
    expect(looks.route(LINK, state(), DARK_PICTURE_THEME)).toMatchObject({ stroke: DARK_PICTURE_THEME.route });
  });

  it("uses the radius of the options", () => {
    expect(plainLooks({ radius: 0 }).box(ROW_1, state(), theme)?.radius).toBe(0);
    expect(plainLooks({ radius: 12 }).box(CARD, state({ container: true }), theme)?.radius).toBe(12);
  });

  it("gives a route a thin line, the accent with a highlight and a wider line for the selected route", () => {
    expect(looks.route(LINK, state(), theme)).toEqual({ stroke: theme.route, width: 1.25, end: undefined });
    expect(looks.route(LINK, state({ highlight: 1 }), theme)).toEqual({ stroke: theme.accent, width: 1.25, end: undefined });
    expect(looks.route(LINK, state({ highlight: 2 }), theme)).toEqual({ stroke: theme.accent, width: 2, end: undefined });
  });

  it("puts the sign of the options at the target of each route", () => {
    const end = { shape: "arrow", size: 7 } as const;
    expect(plainLooks({ end }).route(LINK, state(), theme)?.end).toBe(end);
  });

  it("gives the label of a box the color of the text, and the label of a container the muted color", () => {
    expect(looks.label(ROW_LABEL, state({ zoom: 2 }), theme, { type: "box", id: "row-1", box: ROW_1 })).toEqual({ color: theme.text });
    expect(looks.label(CARD_LABEL, state({ container: true }), theme, { type: "box", id: "card", box: CARD })).toEqual({ color: theme.mutedText });
    expect(looks.label(NOTE, state(), theme, undefined)).toEqual({ color: theme.text });
  });

  it("gives the label of a route a line of the color of the page around its letters", () => {
    expect(looks.label(LINK_LABEL, state(), theme, { type: "route", id: "link", route: LINK })).toEqual({ color: theme.text, halo: theme.paper });
  });

  it("shows a text that is too small to read as bars, and a smaller text not at all", () => {
    const bars = { color: theme.containerLine, as: "bars" };
    /** This function gives the look of a label of the first row with lines of a height, at a zoom. */
    const at = (lineHeight: number, zoom = 1): unknown => looks.label({ ...ROW_LABEL, lineHeight }, state({ zoom }), theme, { type: "box", id: "row-1", box: ROW_1 });
    expect(at(SMALLEST_TEXT_LINE)).toEqual({ color: theme.text });
    expect(at(SMALLEST_TEXT_LINE - 0.5)).toEqual(bars);
    expect(at(SMALLEST_BAR_LINE)).toEqual(bars);
    expect(at(SMALLEST_BAR_LINE - 0.25)).toBeUndefined();
    // The height on the screen is the height of the line times the zoom.
    expect(at(18, 2)).toEqual({ color: theme.text });
    expect(at(18, 0.5)).toEqual(bars);
    expect(at(18, 0.125)).toBeUndefined();
    // A highlight does not change the bars of a box with no child.
    expect(looks.label(ROW_LABEL, state({ zoom: 0.5, highlight: 2 }), theme, { type: "box", id: "row-1", box: ROW_1 })).toEqual(bars);
    // The label of a route becomes bars too, with no line around them.
    expect(looks.label(LINK_LABEL, state({ zoom: 0.5 }), theme, { type: "route", id: "link", route: LINK })).toEqual(bars);
  });

  it("keeps the name of a box with children as a text in a far view, while the box is wide enough on the screen", () => {
    const kept = { color: theme.mutedText, halo: theme.paper, least: SMALLEST_TEXT_LINE };
    const bars = { color: theme.containerLine, as: "bars" };
    /** This function gives the look of the label of a card of a width at the zoom 0.25. A line of the label is 4.5 pixels high there. */
    const wide = (w: number, more: Partial<RecordState> = {}): unknown => looks.label(CARD_LABEL, state({ zoom: 0.25, container: true, ...more }), theme, { type: "box", id: "card", box: { ...CARD, w } });
    expect(wide(4 * SMALLEST_NAMED_BOX)).toEqual(kept);
    expect(wide(4 * SMALLEST_NAMED_BOX - 4)).toEqual(bars);
    // At a zoom where a person can read the text, the name is at its place with no change.
    expect(looks.label(CARD_LABEL, state({ container: true }), theme, { type: "box", id: "card", box: CARD })).toEqual({ color: theme.mutedText });
    // A box with no child has bars, and a label that names no box has bars too.
    expect(wide(400, { container: false })).toEqual(bars);
    expect(looks.label(CARD_LABEL, state({ zoom: 0.25, container: true }), theme, undefined)).toEqual(bars);
    expect(looks.label(LINK_LABEL, state({ zoom: 0.25, container: true }), theme, { type: "route", id: "link", route: LINK })).toEqual(bars);
  });

  it("keeps the name of a box with children that has a highlight at each size, also where the text has no bar", () => {
    const kept = { color: theme.mutedText, halo: theme.paper, least: SMALLEST_TEXT_LINE };
    /** This function gives the look of the label of the card at a zoom. The card is 200 wide, and a line of its label is 18 high. */
    const at = (zoom: number, highlight: 0 | 1 | 2): unknown => looks.label(CARD_LABEL, state({ zoom, container: true, highlight }), theme, { type: "box", id: "card", box: CARD });
    // At the zoom 0.125, the card is 25 pixels wide and a line is 2.25 pixels high.
    expect(at(0.125, 0)).toBeUndefined();
    expect(at(0.125, 1)).toEqual(kept);
    expect(at(0.125, 2)).toEqual(kept);
    expect(at(0.03125, 1)).toEqual(kept);
  });
});
