import { Object3D, Raycaster } from "three";
import { describe, expect, it } from "vitest";
import type { StageExtent } from "../extent.ts";
import type { StageTheme } from "../theme.ts";
import { stackContents } from "./stack.ts";
import type { StageContent, StageFrame } from "./stage.ts";

interface Fake extends StageContent<string> {
  readonly calls: string[];
  extent: StageExtent;
}

/** This function makes a content that writes each call of the stage in a list. */
function fake(name: string, calls: string[], options: { readonly records?: readonly string[]; readonly pick?: string; readonly distance?: number; readonly step?: boolean } = {}): Fake {
  const content: Fake = {
    calls,
    objects: [new Object3D()],
    extent: { center: { x: 0, y: 0, z: 0 }, corners: [{ x: 1, y: 1, z: 1 }] },
    has: (record) => options.records?.includes(record) ?? false,
    pick: () => {
      calls.push(`${name}.pick`);
      if (options.pick === undefined) return undefined;
      return options.distance === undefined ? { record: options.pick, value: name } : { record: options.pick, value: name, distance: options.distance };
    },
    paint: (_theme, highlight) => void calls.push(`${name}.paint:${String(highlight("a"))}`),
    dispose: () => void calls.push(`${name}.dispose`),
  };
  if (options.step === undefined) return content;
  const active = options.step;
  return {
    ...content,
    step: () => {
      calls.push(`${name}.step`);
      return active;
    },
  };
}

const theme: StageTheme = { sky: "#ffffff", ground: "#808080" };
const frame = {} as StageFrame;
const ray = new Raycaster();

describe("stackContents", () => {
  it("has the objects of each content, in the sequence of the contents", () => {
    const calls: string[] = [];
    const first = fake("first", calls);
    const second = fake("second", calls);
    expect(stackContents([first, second]).objects).toEqual([...first.objects, ...second.objects]);
  });

  it("has the extent of the first content, also after the first content changes it", () => {
    const calls: string[] = [];
    const first = fake("first", calls);
    const stack = stackContents([first, fake("second", calls)]);
    expect(stack.extent).toBe(first.extent);
    first.extent = { center: { x: 5, y: 0, z: 0 }, corners: [{ x: 6, y: 1, z: 1 }] };
    expect(stack.extent).toBe(first.extent);
  });

  it("has a record that one of its contents has", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { records: ["a"] }), fake("second", calls, { records: ["b"] })]);
    expect(stack.has("a")).toBe(true);
    expect(stack.has("b")).toBe(true);
    expect(stack.has("c")).toBe(false);
  });

  it("asks the last content for a pick first, and stops at the first record with no distance", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { pick: "below" }), fake("second", calls, { pick: "above" }), fake("third", calls)]);
    expect(stack.pick(ray)).toEqual({ record: "above", value: "second" });
    expect(calls).toEqual(["third.pick", "second.pick"]);
  });

  it("gives the nearest record when each pick has a distance", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { pick: "near", distance: 2 }), fake("second", calls, { pick: "far", distance: 5 }), fake("third", calls, { pick: "middle", distance: 3 })]);
    expect(stack.pick(ray)).toEqual({ record: "near", value: "first", distance: 2 });
    expect(calls).toEqual(["third.pick", "second.pick", "first.pick"]);
  });

  it("gives the content on top the pick when two distances are equal", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { pick: "below", distance: 4 }), fake("second", calls, { pick: "above", distance: 4 })]);
    expect(stack.pick(ray)?.record).toBe("above");
  });

  it("keeps a pick with a distance when a content below it has a pick with no distance", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { pick: "skipped", distance: 1 }), fake("second", calls, { pick: "solid" }), fake("third", calls, { pick: "mark", distance: 9 })]);
    expect(stack.pick(ray)).toEqual({ record: "mark", value: "third", distance: 9 });
    // The pick with no distance ends the search.
    expect(calls).toEqual(["third.pick", "second.pick"]);
  });

  it("gives a pick with no distance when no content above it has a record", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { pick: "skipped", distance: 1 }), fake("second", calls, { pick: "solid" }), fake("third", calls)]);
    expect(stack.pick(ray)).toEqual({ record: "solid", value: "second" });
    expect(calls).toEqual(["third.pick", "second.pick"]);
  });

  it("gives no pick when no content has a record on the ray", () => {
    const calls: string[] = [];
    expect(stackContents([fake("first", calls), fake("second", calls)]).pick(ray)).toBeUndefined();
    expect(calls).toEqual(["second.pick", "first.pick"]);
  });

  it("paints each content with the same highlights", () => {
    const calls: string[] = [];
    stackContents([fake("first", calls), fake("second", calls)]).paint(theme, (record) => (record === "a" ? 2 : 0));
    expect(calls).toEqual(["first.paint:2", "second.paint:2"]);
  });

  it("gives each content its step, and continues while one content continues", () => {
    const calls: string[] = [];
    const stack = stackContents([fake("first", calls, { step: true }), fake("second", calls), fake("third", calls, { step: false })]);
    expect(stack.step?.(frame)).toBe(true);
    expect(calls).toEqual(["first.step", "third.step"]);
    expect(stackContents([fake("first", calls, { step: false }), fake("second", calls)]).step?.(frame)).toBe(false);
  });

  it("disposes each content", () => {
    const calls: string[] = [];
    stackContents([fake("first", calls), fake("second", calls)]).dispose();
    expect(calls).toEqual(["first.dispose", "second.dispose"]);
  });
});
