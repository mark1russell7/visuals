import type { Rect } from "@mark1russell7/layout-contract";
import { describe, expect, it } from "vitest";
import { UNIT_VIEW } from "./camera.ts";
import { stackPictureContents } from "./stack.ts";
import type { PickAt, PictureContent, PictureFrame } from "./stage.ts";

interface Fake extends PictureContent<string, string> {
  bounds: Rect;
}

/** This function makes a content that writes each use of it in a list. */
function fake(name: string, calls: string[], options: { readonly records?: readonly string[]; readonly pick?: string; readonly active?: boolean } = {}): Fake {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 50 },
    has: (record) => options.records?.includes(record) ?? false,
    pick: () => {
      calls.push(`${name}.pick`);
      return options.pick === undefined ? undefined : { record: options.pick, value: name };
    },
    draw: (_context, _frame, theme, highlight) => {
      calls.push(`${name}.draw:${theme}:${String(highlight("a"))}`);
      return options.active ?? false;
    },
    dispose: () => void calls.push(`${name}.dispose`),
  };
}

/** This function makes the part of a context of a canvas that the stack uses. It writes each use in the list. */
function contextOf(calls: string[]): CanvasRenderingContext2D {
  return { save: () => void calls.push("save"), restore: () => void calls.push("restore") } as unknown as CanvasRenderingContext2D;
}

const frame = {} as PictureFrame;
const at: PickAt = { point: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, view: UNIT_VIEW, slack: 5 };

describe("stackPictureContents", () => {
  it("has the bounds of the first content, also after the first content changes them", () => {
    const calls: string[] = [];
    const first = fake("first", calls);
    const second = fake("second", calls);
    second.bounds = { x: 0, y: 0, w: 900, h: 900 };
    const stack = stackPictureContents([first, second]);
    expect(stack.bounds).toBe(first.bounds);
    first.bounds = { x: 5, y: 5, w: 10, h: 10 };
    expect(stack.bounds).toBe(first.bounds);
  });

  it("has a record that one of its contents has", () => {
    const calls: string[] = [];
    const stack = stackPictureContents([fake("first", calls, { records: ["a"] }), fake("second", calls, { records: ["b"] })]);
    expect(stack.has("a")).toBe(true);
    expect(stack.has("b")).toBe(true);
    expect(stack.has("c")).toBe(false);
  });

  it("asks the last content for a pick first, and stops at the first record", () => {
    const calls: string[] = [];
    const stack = stackPictureContents([fake("first", calls, { pick: "below" }), fake("second", calls, { pick: "above" }), fake("third", calls)]);
    expect(stack.pick(at)).toEqual({ record: "above", value: "second" });
    expect(calls).toEqual(["third.pick", "second.pick"]);
  });

  it("gives no pick when no content has a record below the pointer", () => {
    const calls: string[] = [];
    expect(stackPictureContents([fake("first", calls), fake("second", calls)]).pick(at)).toBeUndefined();
    expect(calls).toEqual(["second.pick", "first.pick"]);
  });

  it("draws each content in the sequence of the contents, with the same theme and the same highlights", () => {
    const calls: string[] = [];
    const stack = stackPictureContents([fake("first", calls), fake("second", calls)]);
    expect(stack.draw(contextOf(calls), frame, "dark", (record) => (record === "a" ? 2 : 0))).toBe(false);
    // A content does not get the state of the canvas of the content before it.
    expect(calls).toEqual(["save", "first.draw:dark:2", "restore", "save", "second.draw:dark:2", "restore"]);
  });

  it("draws each content after a content that continues to change, and continues while one content continues", () => {
    const calls: string[] = [];
    const stack = stackPictureContents([fake("first", calls, { active: true }), fake("second", calls), fake("third", calls)]);
    expect(stack.draw(contextOf([]), frame, "light", () => 0)).toBe(true);
    expect(calls).toEqual(["first.draw:light:0", "second.draw:light:0", "third.draw:light:0"]);
    expect(stackPictureContents([fake("first", calls), fake("second", calls, { active: true })]).draw(contextOf([]), frame, "light", () => 0)).toBe(true);
  });

  it("disposes each content, also next to a content that keeps nothing", () => {
    const calls: string[] = [];
    const plain: PictureContent<string, string> = { bounds: { x: 0, y: 0, w: 1, h: 1 }, has: () => false, pick: () => undefined, draw: () => false };
    stackPictureContents([fake("first", calls), plain, fake("third", calls)]).dispose?.();
    expect(calls).toEqual(["first.dispose", "third.dispose"]);
  });
});
