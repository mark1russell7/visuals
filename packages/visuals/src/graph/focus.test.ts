import { describe, expect, it } from "vitest";
import { boxFocus, FOCUS_OPACITY, focusOf, routeFocus, type PictureFocus } from "./focus.ts";
import { indexPicture } from "./records.ts";
import { ASIDE, CARD, CURVE, FAR, LINK, PICTURE, ROW_1, ROW_2, TOPIC } from "./sample.ts";

const index = indexPicture(PICTURE);

/** This function gives the ids of a focus in the order of the letters, for a comparison. */
function idsOf(focus: PictureFocus | undefined): { readonly boxes: string[]; readonly routes: string[] } | undefined {
  return focus === undefined ? undefined : { boxes: [...focus.boxes].sort(), routes: [...focus.routes].sort() };
}

describe("focusOf", () => {
  it("gives no focus for an empty list, and for a name that the picture does not have", () => {
    expect(focusOf(index, [])).toBeUndefined();
    expect(focusOf(index, ["none"])).toBeUndefined();
  });

  it("brings the routes at a box, the boxes at their other ends and the boxes above the box", () => {
    expect(idsOf(focusOf(index, ["row-1"]))).toEqual({ boxes: ["card", "row-1", "topic"], routes: ["link"] });
  });

  it("does not bring the routes of the box at the other end of a route", () => {
    // The topic is in the focus of the first row, and the route from the topic to the far box is not.
    expect(focusOf(index, ["row-1"])?.routes.has("aside")).toBe(false);
    expect(focusOf(index, ["row-1"])?.boxes.has("far")).toBe(false);
  });

  it("brings each box below a box, with the routes at each of them", () => {
    expect(idsOf(focusOf(index, ["card"]))).toEqual({ boxes: ["card", "far", "row-1", "row-2", "topic"], routes: ["curve", "link"] });
  });

  it("brings the two boxes of a route, and the boxes above them", () => {
    expect(idsOf(focusOf(index, ["curve"]))).toEqual({ boxes: ["card", "far", "row-2"], routes: ["curve"] });
  });

  it("brings each route at a box with two routes", () => {
    expect(idsOf(focusOf(index, ["topic"]))).toEqual({ boxes: ["card", "far", "row-1", "topic"], routes: ["aside", "link"] });
  });

  it("joins the focus of each name of the list, and ignores a name that the picture does not have", () => {
    expect(idsOf(focusOf(index, ["row-1", "none", "curve", "row-1"]))).toEqual({ boxes: ["card", "far", "row-1", "row-2", "topic"], routes: ["curve", "link"] });
  });

  it("keeps a route whose box the picture does not have", () => {
    const less = indexPicture({ ...PICTURE, boxes: [CARD, ROW_1] });
    expect(idsOf(focusOf(less, ["link"]))).toEqual({ boxes: ["card", "row-1"], routes: ["link"] });
  });

  it("stops the way up at a box whose parent the picture does not have", () => {
    const less = indexPicture({ ...PICTURE, boxes: [ROW_1, TOPIC] });
    expect(idsOf(focusOf(less, ["row-1"]))).toEqual({ boxes: ["row-1", "topic"], routes: ["link"] });
  });
});

describe("boxFocus", () => {
  it("gives the level of each box for a focus", () => {
    const focus = focusOf(index, ["row-1"]);
    expect(boxFocus(focus, ROW_1)).toBe("in");
    expect(boxFocus(focus, CARD)).toBe("in");
    expect(boxFocus(focus, TOPIC)).toBe("in");
    // The second row is not in the focus, and its card is.
    expect(boxFocus(focus, ROW_2)).toBe("beside");
    expect(boxFocus(focus, FAR)).toBe("out");
  });

  it("gives the level all for each box of a picture with no focus", () => {
    expect(boxFocus(undefined, ROW_1)).toBe("all");
    expect(boxFocus(undefined, FAR)).toBe("all");
  });
});

describe("routeFocus", () => {
  it("gives the level of each route for a focus, and all for no focus", () => {
    const focus = focusOf(index, ["row-1"]);
    expect(routeFocus(focus, LINK)).toBe("in");
    expect(routeFocus(focus, CURVE)).toBe("out");
    expect(routeFocus(focus, ASIDE)).toBe("out");
    expect(routeFocus(undefined, ASIDE)).toBe("all");
  });
});

describe("FOCUS_OPACITY", () => {
  it("keeps a record of the focus clear, and gives less color to each step away from it", () => {
    expect(FOCUS_OPACITY.all).toBe(1);
    expect(FOCUS_OPACITY.in).toBe(1);
    expect(FOCUS_OPACITY.beside).toBeLessThan(1);
    expect(FOCUS_OPACITY.out).toBeLessThan(FOCUS_OPACITY.beside);
    expect(FOCUS_OPACITY.out).toBeGreaterThan(0);
  });
});
