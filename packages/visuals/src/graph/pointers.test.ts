import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toPicture, type PictureView } from "./camera.ts";
import { NO_POINTERS, TOUCH_CLICK_DISTANCE, pointerCancel, pointerDown, pointerMove, pointerUp } from "./pointers.ts";

const view: PictureView = { x: 10, y: 20, k: 2 };
const coordinate = fc.double({ min: -2000, max: 2000, noNaN: true });
const anyPoint = fc.record({ x: coordinate, y: coordinate });
const anyView = fc.record({ x: coordinate, y: coordinate, k: fc.double({ min: 0.06, max: 7, noNaN: true }) });

describe("pointerDown", () => {
  it("starts a possible click with the first pointer", () => {
    const one = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    expect(one).toEqual({ at: new Map([[1, { x: 5, y: 6 }]]), start: { x: 5, y: 6 }, many: false });
  });

  it("adds a second pointer and keeps the start of the first pointer", () => {
    const two = pointerDown(pointerDown(NO_POINTERS, 1, { x: 5, y: 6 }), 2, { x: 50, y: 60 });
    expect(two).toEqual({
      at: new Map([
        [1, { x: 5, y: 6 }],
        [2, { x: 50, y: 60 }],
      ]),
      start: { x: 5, y: 6 },
      many: true,
    });
  });

  it("starts again when one pointer goes down two times with no up between", () => {
    const again = pointerDown(pointerDown(NO_POINTERS, 1, { x: 5, y: 6 }), 1, { x: 9, y: 9 });
    expect(again).toEqual({ at: new Map([[1, { x: 9, y: 9 }]]), start: { x: 9, y: 9 }, many: false });
  });

  it("does not change the pointers that it gets", () => {
    const one = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    pointerDown(one, 2, { x: 50, y: 60 });
    expect(NO_POINTERS.at.size).toBe(0);
    expect(one.at.size).toBe(1);
  });
});

describe("pointerMove", () => {
  it("moves the picture with one pointer", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 100, y: 100 });
    const moved = pointerMove(down, 1, { x: 130, y: 90 }, view);
    expect(moved.view).toEqual({ x: 40, y: 10, k: 2 });
    expect(moved.pointers.at.get(1)).toEqual({ x: 130, y: 90 });
    expect(moved.pointers.start).toEqual({ x: 100, y: 100 });
  });

  it("keeps the point of the picture below one pointer", () => {
    fc.assert(
      fc.property(anyView, anyPoint, anyPoint, (now, from, to) => {
        const moved = pointerMove(pointerDown(NO_POINTERS, 1, from), 1, to, now);
        const before = toPicture(now, from);
        const after = toPicture(moved.view, to);
        expect(after.x).toBeCloseTo(before.x, 6);
        expect(after.y).toBeCloseTo(before.y, 6);
      }),
    );
  });

  it("makes a pinch with two pointers, and each pointer keeps its point of the picture", () => {
    const down = pointerDown(pointerDown(NO_POINTERS, 1, { x: 100, y: 100 }), 2, { x: 300, y: 100 });
    const moved = pointerMove(down, 2, { x: 500, y: 100 }, view);
    expect(moved.view).toEqual({ x: -80, y: -60, k: 4 });
    expect(toPicture(moved.view, { x: 100, y: 100 })).toEqual(toPicture(view, { x: 100, y: 100 }));
    expect(toPicture(moved.view, { x: 500, y: 100 })).toEqual(toPicture(view, { x: 300, y: 100 }));
    expect(moved.pointers.at.get(2)).toEqual({ x: 500, y: 100 });
  });

  it("keeps the zoom of a pinch in the limits", () => {
    const down = pointerDown(pointerDown(NO_POINTERS, 1, { x: 100, y: 100 }), 2, { x: 110, y: 100 });
    expect(pointerMove(down, 2, { x: 900, y: 100 }, view).view.k).toBe(8);
    expect(pointerMove(down, 2, { x: 900, y: 100 }, view, { min: 1, max: 3 }).view.k).toBe(3);
  });

  it("does not change the view with three pointers", () => {
    const down = pointerDown(pointerDown(pointerDown(NO_POINTERS, 1, { x: 100, y: 100 }), 2, { x: 300, y: 100 }), 3, { x: 200, y: 300 });
    const moved = pointerMove(down, 3, { x: 250, y: 350 }, view);
    expect(moved.view).toBe(view);
    expect(moved.pointers.at.get(3)).toEqual({ x: 250, y: 350 });
  });

  it("changes nothing for a pointer that is not down", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 100, y: 100 });
    const moved = pointerMove(down, 7, { x: 130, y: 90 }, view);
    expect(moved.pointers).toBe(down);
    expect(moved.view).toBe(view);
    expect(pointerMove(NO_POINTERS, 1, { x: 130, y: 90 }, view)).toEqual({ pointers: NO_POINTERS, view });
  });
});

describe("pointerUp", () => {
  it("makes a click when one pointer goes up near its start", () => {
    const up = pointerUp(pointerDown(NO_POINTERS, 1, { x: 5, y: 6 }), 1, { x: 7, y: 7 });
    expect(up.click).toBe(true);
    expect(up.pointers).toBe(NO_POINTERS);
  });

  it("makes no click after a drag", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    const moved = pointerMove(down, 1, { x: 50, y: 6 }, view);
    expect(pointerUp(moved.pointers, 1, { x: 50, y: 6 })).toEqual({ pointers: NO_POINTERS, click: false });
  });

  it("permits a larger distance for a finger", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    expect(pointerUp(down, 1, { x: 12, y: 6 }).click).toBe(false);
    expect(pointerUp(down, 1, { x: 12, y: 6 }, TOUCH_CLICK_DISTANCE).click).toBe(true);
    expect(pointerUp(down, 1, { x: 16, y: 6 }, TOUCH_CLICK_DISTANCE).click).toBe(false);
  });

  it("makes no click after a second pointer went down", () => {
    const down = pointerDown(pointerDown(NO_POINTERS, 1, { x: 5, y: 6 }), 2, { x: 50, y: 60 });
    const first = pointerUp(down, 2, { x: 50, y: 60 });
    expect(first.click).toBe(false);
    expect([...first.pointers.at.keys()]).toEqual([1]);
    const second = pointerUp(first.pointers, 1, { x: 5, y: 6 });
    expect(second).toEqual({ pointers: NO_POINTERS, click: false });
  });

  it("changes nothing for a pointer that is not down", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    const up = pointerUp(down, 7, { x: 5, y: 6 });
    expect(up.pointers).toBe(down);
    expect(up.click).toBe(false);
  });
});

describe("pointerCancel", () => {
  it("removes the pointer and makes no click", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    const stopped = pointerCancel(down, 1);
    expect(stopped).toBe(NO_POINTERS);
    expect(pointerUp(stopped, 1, { x: 5, y: 6 }).click).toBe(false);
  });

  it("keeps the other pointers, which make no click", () => {
    const down = pointerDown(pointerDown(NO_POINTERS, 1, { x: 5, y: 6 }), 2, { x: 50, y: 60 });
    const stopped = pointerCancel(down, 2);
    expect([...stopped.at.keys()]).toEqual([1]);
    expect(pointerUp(stopped, 1, { x: 5, y: 6 }).click).toBe(false);
  });

  it("changes nothing for a pointer that is not down", () => {
    const down = pointerDown(NO_POINTERS, 1, { x: 5, y: 6 });
    expect(pointerCancel(down, 7)).toBe(down);
  });
});
