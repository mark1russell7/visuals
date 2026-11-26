import { describe, expect, it } from "vitest";
import { controlsTop, legendOpenAt, placeControls, type PartParent } from "./controls.ts";
import { THREAD_FEATURES } from "./nest.ts";

/** A parent that keeps its children in a list. */
const parent = (): PartParent<string> & { readonly kids: string[] } => {
  const kids: string[] = [];
  return { kids, append: (...nodes) => kids.push(...nodes) };
};
const wrap = (part: string): string => `wrapper(${part})`;

describe("placeControls", () => {
  it("keeps the jumps and the tools in the row of the view when the page gives no host", () => {
    const row = parent();
    const places = placeControls({ jumps: "jumps", tools: "tools" }, {}, row, wrap);
    expect(row.kids).toEqual(["jumps", "tools"]);
    expect(places).toEqual({ wrappers: [], inRow: 2 });
  });

  it("puts the tools row into its host element and not on the canvas", () => {
    const row = parent();
    const host = parent();
    const places = placeControls({ jumps: "jumps", tools: "tools" }, { tools: host }, row, wrap);
    expect(row.kids).toEqual(["jumps"]);
    expect(host.kids).toEqual(["wrapper(tools)"]);
    expect(places).toEqual({ wrappers: ["wrapper(tools)"], inRow: 1 });
  });

  it("puts each part into its own host, so the row is empty and covers no part of the view", () => {
    const row = parent();
    const jumpsHost = parent();
    const toolsHost = parent();
    const places = placeControls({ jumps: "jumps", tools: "tools" }, { jumps: jumpsHost, tools: toolsHost }, row, wrap);
    expect(row.kids).toEqual([]);
    expect([jumpsHost.kids, toolsHost.kids]).toEqual([["wrapper(jumps)"], ["wrapper(tools)"]]);
    expect(controlsTop(places.inRow, false, 40)).toBe(0);
  });
});

describe("legendOpenAt", () => {
  it("starts closed when the page asks for it, also on a wide view", () => {
    expect(legendOpenAt(false, 1280, 700)).toBe(false);
    expect(legendOpenAt(true, 390, 700)).toBe(true);
  });

  it("keeps the old start with no option: open on a wide view, closed on a narrow view", () => {
    expect(legendOpenAt(undefined, 1280, 700)).toBe(true);
    expect(legendOpenAt(undefined, 700, 700)).toBe(false);
  });
});

describe("controlsTop", () => {
  it("covers the height of a button, or the end of a row of two lines", () => {
    expect(controlsTop(2, false, 0)).toBe(52);
    expect(controlsTop(1, true, 0)).toBe(56);
    expect(controlsTop(2, true, 90)).toBe(90);
  });
});

describe("THREAD_FEATURES", () => {
  it("tells a page that the build has the start state of the legend and the hosts of the controls", () => {
    expect(THREAD_FEATURES).toContain("legend-open");
    expect(THREAD_FEATURES).toContain("hosts");
  });
});
