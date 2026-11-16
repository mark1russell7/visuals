import { PerspectiveCamera, Raycaster } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Highlight } from "../highlight.ts";
import type { StageFrame } from "../stage/stage.ts";
import type { StageTheme } from "../theme.ts";
import { createLabels, type LabelsContent, type LabelsOptions, type StageLabel } from "./layer.ts";

/** The part of an element of a page that the layer uses. The tests have no browser. */
class FakeElement {
  readonly classes = new Set<string>();
  readonly dataset: Record<string, string> = {};
  readonly style: { transform?: string } = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly ownerDocument = { createElement: (tag: string): FakeElement => new FakeElement(tag) };
  parent: FakeElement | undefined;
  textContent = "";
  readonly classList = {
    add: (name: string): void => void this.classes.add(name),
    remove: (name: string): void => void this.classes.delete(name),
    toggle: (name: string, on: boolean): void => void (on ? this.classes.add(name) : this.classes.delete(name)),
  };

  readonly tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  set className(names: string) {
    this.classes.clear();
    for (const name of names.split(" ")) this.classes.add(name);
  }

  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

/** The observers of the size of an element that are in use. */
const observers = new Set<FakeObserver>();

/** The report of an observer: the size of each element that changed. */
type Report = (entries: readonly { target: FakeElement; borderBoxSize: readonly { inlineSize: number; blockSize: number }[] }[]) => void;

class FakeObserver {
  readonly targets: FakeElement[] = [];
  readonly report: Report;

  constructor(report: Report) {
    this.report = report;
    observers.add(this);
  }

  observe(target: FakeElement): void {
    this.targets.push(target);
  }

  disconnect(): void {
    observers.delete(this);
  }
}

/** This function gives each observed text a size, as a browser does after the first layout of a page. */
function measure(width: number = 60, height: number = 16): void {
  for (const observer of observers) observer.report(observer.targets.map((target) => ({ target, borderBoxSize: [{ inlineSize: width, blockSize: height }] })));
}

const theme: StageTheme = { sky: "#ffffff", ground: "#808080" };

/** The scale of the picture of `frameAt`: the CSS pixels of one unit of the world, at the plane of the labels. */
const UNIT = 200 / (10 * Math.tan((25 * Math.PI) / 180));

/**
 * This function makes a picture of 800 by 400 pixels from a camera that looks along the axis `z`.
 * The point of the world below the camera is in the middle of the picture.
 */
function frameAt(x: number = 0, y: number = 0): StageFrame {
  const camera = new PerspectiveCamera(50, 2, 0.1, 100);
  camera.position.set(x, y, 10);
  camera.lookAt(x, y, 0);
  return { camera, seconds: 0, settle: false, height: 400, fieldOfView: 50 };
}

/** This function gives the look of each text: its side, or `off` for a text that is not in the picture. */
function sides(layer: FakeElement): string[] {
  return layer.children.map((text) => (text.classes.has("visuals-label-off") ? "off" : (text.dataset["side"] ?? "none")));
}

function start(labels: readonly StageLabel[], more: Partial<LabelsOptions> = {}): { readonly content: LabelsContent; readonly container: FakeElement; readonly layer: FakeElement } {
  const container = new FakeElement("div");
  const content = createLabels(container as unknown as HTMLElement, { labels, ...more });
  const layer = container.children[0];
  if (layer === undefined) throw new Error("The container has no layer.");
  return { content, container, layer };
}

const origin = { x: 0, y: 0, z: 0 };
const city: StageLabel = { record: "city", at: origin, text: "A city", kind: "place", clear: 5 };

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  observers.clear();
});

describe("createLabels", () => {
  it("makes one element for each label, in a layer that a screen reader ignores", () => {
    const { content, layer } = start([city, { record: "town", at: { x: 1, y: 0, z: 0 }, text: "A town" }]);
    expect(content.element).toBe(layer);
    expect([...layer.classes]).toEqual(["visuals-labels"]);
    expect(layer.attributes.get("aria-hidden")).toBe("true");
    expect(layer.children.map((text) => [text.tag, text.textContent, text.dataset["kind"]])).toEqual([
      ["span", "A city", "place"],
      ["span", "A town", undefined],
    ]);
  });

  it("shows no text before the browser gives the size of the text", () => {
    const { content, layer } = start([city]);
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["off"]);
    expect(layer.children[0]?.style.transform).toBeUndefined();
  });

  it("puts each text next to its point, at whole pixels", () => {
    const { content, layer } = start([city]);
    content.step?.(frameAt());
    measure();
    // The point is in the middle of the picture. The text is to the right of the mark, at the default gap.
    expect(sides(layer)).toEqual(["right"]);
    expect(layer.children[0]?.style.transform).toBe("translate(409px, 192px)");
  });

  it("moves each text with the camera", () => {
    const { content, layer } = start([city]);
    measure();
    content.step?.(frameAt());
    // The camera goes one unit to the right, so the point goes to the left in the picture.
    content.step?.(frameAt(1));
    expect(layer.children[0]?.style.transform).toBe(`translate(${String(Math.round(400 - UNIT + 9))}px, 192px)`);
  });

  it("gives no step a reason for a second picture", () => {
    const { content } = start([city]);
    expect(content.step?.(frameAt())).toBe(false);
  });

  it("removes the text of a point that the camera does not see", () => {
    const hidden = start([city], { visible: (at, eye) => at.z < eye.z - 20 });
    measure();
    hidden.content.step?.(frameAt());
    expect(sides(hidden.layer)).toEqual(["off"]);
    // A point behind the camera has no place in the picture.
    const behind = start([{ ...city, at: { x: 0, y: 0, z: 11 } }]);
    measure();
    behind.content.step?.(frameAt());
    expect(sides(behind.layer)).toEqual(["off"]);
  });

  it("gives the test of the option visible the point and the position of the camera", () => {
    const visible = vi.fn(() => true);
    const { content } = start([city], { visible });
    content.step?.(frameAt(2, 3));
    expect(visible).toHaveBeenCalledWith(origin, expect.objectContaining({ x: 2, y: 3, z: 10 }));
  });

  it("uses the gap and the edge of the options", () => {
    const { content, layer } = start([city], { gap: 10, edge: 3 });
    measure();
    content.step?.(frameAt());
    expect(layer.children[0]?.style.transform).toBe("translate(415px, 192px)");
    // The point is 2 pixels from the right edge of the picture after this move: no side keeps the space of the edge on the right.
    content.step?.(frameAt(-(400 - 2) / UNIT));
    expect(sides(layer)).toEqual(["left"]);
  });

  it("keeps the label of the higher rank when two texts have one place", () => {
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town", sides: ["right"] },
      { record: "city", at: origin, text: "A city", sides: ["right"], rank: 1 },
    ]);
    measure();
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["off", "right"]);
  });

  it("gives the first label the first choice when the ranks are equal", () => {
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town" },
      { record: "city", at: origin, text: "A city" },
    ]);
    measure();
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["right", "left"]);
  });

  it("shows the highlight of a record on its label", () => {
    const { content, layer } = start([city, { record: "town", at: { x: 2, y: 2, z: 0 }, text: "A town" }]);
    const look = (): string[][] => layer.children.map((text) => [...text.classes].filter((name) => name !== "visuals-label" && name !== "visuals-label-off"));
    content.paint(theme, (record): Highlight => (record === "city" ? 1 : 0));
    expect(look()).toEqual([["visuals-label-hovered"], []]);
    content.paint(theme, (record): Highlight => (record === "town" ? 2 : 0));
    expect(look()).toEqual([[], ["visuals-label-selected"]]);
    content.paint(theme, () => 0);
    expect(look()).toEqual([[], []]);
  });

  it("moves no text for a highlight while the picture does not move", () => {
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town" },
      { record: "city", at: origin, text: "A city" },
    ]);
    measure();
    content.step?.(frameAt());
    const before = layer.children.map((text) => text.style.transform);
    content.paint(theme, (record): Highlight => (record === "city" ? 1 : 0));
    // The stage makes a picture after a highlight. The camera did not move.
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["right", "left"]);
    expect(layer.children.map((text) => text.style.transform)).toEqual(before);
  });

  it("gives a highlighted record the first choice after a move of the camera", () => {
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town" },
      { record: "city", at: origin, text: "A city" },
    ]);
    measure();
    content.step?.(frameAt());
    content.paint(theme, (record): Highlight => (record === "city" ? 1 : 0));
    content.step?.(frameAt(0.5));
    expect(sides(layer)).toEqual(["left", "right"]);
  });

  it("shows the label of a highlighted record in place of a label of a higher rank", () => {
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town", sides: ["right"] },
      { record: "city", at: origin, text: "A city", sides: ["right"], rank: 1 },
    ]);
    measure();
    content.step?.(frameAt());
    content.paint(theme, (record): Highlight => (record === "town" ? 2 : 0));
    expect(sides(layer)).toEqual(["right", "off"]);
  });

  it("tries the sides from the first side again after a move of the camera", () => {
    const { content, layer } = start([city]);
    measure();
    // The point is 20 pixels from the right edge of the picture: the text is on the left.
    content.step?.(frameAt(-(400 - 20) / UNIT));
    expect(sides(layer)).toEqual(["left"]);
    // The camera goes back. The places are a function of the picture, so the text is on the right again.
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["right"]);
  });

  it("tries the sides from the first side again after a change of the size of the picture", () => {
    const { content, layer } = start([{ ...city, at: { x: 8.5, y: 0, z: 0 } }]);
    measure();
    const narrow = frameAt();
    content.step?.(narrow);
    expect(sides(layer)).toEqual(["left"]);
    // A wider picture of the same height keeps the scale, and it has space on the right of the point.
    const wide = frameAt();
    wide.camera.aspect = 3;
    wide.camera.updateProjectionMatrix();
    content.step?.(wide);
    expect(sides(layer)).toEqual(["right"]);
  });

  it("shows only the labels that the test of show accepts, and gives their places to the other labels", () => {
    // The two texts have one place, so only one of them is in the picture.
    const { content, layer } = start([
      { record: "town", at: origin, text: "A town", sides: ["right"] },
      { record: "city", at: origin, text: "A city", sides: ["right"] },
    ]);
    measure();
    content.step?.(frameAt());
    expect(sides(layer)).toEqual(["right", "off"]);
    content.show((label) => label.record === "city");
    expect(sides(layer)).toEqual(["off", "right"]);
    content.show(() => true);
    // The first label has the first choice again.
    expect(sides(layer)).toEqual(["right", "off"]);
  });

  it("gives each text a new place after a change of its size", () => {
    const { content, layer } = start([{ ...city, sides: ["left"] }]);
    measure();
    content.step?.(frameAt());
    expect(layer.children[0]?.style.transform).toBe("translate(331px, 192px)");
    measure(100, 20);
    expect(layer.children[0]?.style.transform).toBe("translate(291px, 190px)");
  });

  it("has the records of its labels, no object and no pick", () => {
    const { content } = start([city]);
    expect(content.has("city")).toBe(true);
    expect(content.has("town")).toBe(false);
    expect(content.objects).toEqual([]);
    expect(content.pick(new Raycaster())).toBeUndefined();
  });

  it("has the points of its labels as its extent", () => {
    const { content } = start([
      { record: "a", at: { x: 2, y: 0, z: 0 }, text: "A" },
      { record: "b", at: { x: 0, y: 4, z: 6 }, text: "B" },
    ]);
    expect(content.extent.center).toEqual({ x: 1, y: 2, z: 3 });
    expect(content.extent.corners).toEqual([
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 4, z: 6 },
    ]);
    expect(start([]).content.extent).toEqual({ center: origin, corners: [origin] });
  });

  it("removes its layer from the page, and stops the observer of the sizes", () => {
    const { content, container } = start([city]);
    expect(observers.size).toBe(1);
    content.dispose();
    expect(container.children).toEqual([]);
    expect(observers.size).toBe(0);
  });
});
