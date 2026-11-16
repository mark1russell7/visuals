import { describe, expect, it } from "vitest";
import type { StageTheme } from "../theme.ts";
import { fitView } from "../extent.ts";
import { createStage, type StageContent } from "./stage.ts";

/** This function makes a content that counts the calls of the stage. */
function countingContent(): StageContent<string> & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    objects: [],
    extent: { center: { x: 0, y: 0, z: 0 }, corners: [{ x: 1, y: 1, z: 1 }] },
    has: () => false,
    pick: () => undefined,
    paint: () => void calls.push("paint"),
    dispose: () => void calls.push("dispose"),
  };
}

const theme: StageTheme = { sky: "#ffffff", ground: "#808080" };

describe("createStage", () => {
  it("gives undefined for a browser with no WebGL 2, and adds nothing to the page", () => {
    const asked: string[] = [];
    const added: unknown[] = [];
    const canvas = {
      getContext: (kind: string): null => {
        asked.push(kind);
        return null;
      },
    };
    const container = {
      ownerDocument: { createElement: (tag: string): unknown => (tag === "canvas" ? canvas : undefined) },
      append: (...nodes: unknown[]): void => void added.push(...nodes),
    } as unknown as HTMLElement;
    const content = countingContent();

    const stage = createStage(container, { content, theme, label: "A test stage", views: { home: fitView({ polar: 0.9, azimuth: 0.6 }) }, home: "home" });

    expect(stage).toBeUndefined();
    expect(asked).toEqual(["webgl2"]);
    expect(added).toEqual([]);
    // The page keeps the content: it can show the same data in a different picture.
    expect(content.calls).toEqual([]);
  });
});
