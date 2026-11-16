import type { Point, Point3 } from "@mark1russell7/layout-contract";
import type { StageExtent } from "../extent.ts";
import type { Highlight } from "../highlight.ts";
import { screenPoint } from "../screen.ts";
import type { StageContent, StageFrame } from "../stage/stage.ts";
import { LABEL_SIDES, placeLabels, type LabelAnchor, type LabelPlace, type LabelSide } from "./place.ts";

/** A label of a stage: a short text next to a point of the world. */
export interface StageLabel {
  /** The name of the record that the label names. The label gets the highlight of this record. */
  readonly record: string;
  /** The point of the world that the label names. */
  readonly at: Point3;
  readonly text: string;
  /** The kind of the label. The element of the label has it in `data-kind`, so a style sheet gives each kind a look. */
  readonly kind?: string | undefined;
  /**
   * The importance of the label. When two texts cannot be in the picture together, the label with the higher rank stays.
   * The default is 0. A label of a highlighted record is before each other label.
   */
  readonly rank?: number | undefined;
  /** The radius of the mark at the point, in CSS pixels, for example a half of the width of a dot. The default is 0. */
  readonly clear?: number | undefined;
  /** The sides that the text can have, in the sequence of the tries. The default is `LABEL_SIDES`. Use `["center"]` for the name of an area. */
  readonly sides?: readonly LabelSide[] | undefined;
}

/** The options of a layer of labels. */
export interface LabelsOptions {
  readonly labels: readonly StageLabel[];
  /**
   * This function tells if the camera sees a point of the world from its position.
   * For a globe, use `inSight`: a point on the far side of the Earth then has no label. The default shows each point.
   */
  readonly visible?: ((at: Point3, eye: Point3) => boolean) | undefined;
  /** The distance between a mark and the text of its label, in CSS pixels. The default is `LABEL_GAP`. */
  readonly gap?: number | undefined;
  /** The smallest distance between a text and an edge of the picture, in CSS pixels. The default is 0. */
  readonly edge?: number | undefined;
}

/**
 * A layer of labels: a content of a stage with no three.js object. Use `stackContents` to show it with the content that it names.
 * The layer has no pick: the pointer goes through each text to the picture.
 */
export interface LabelsContent extends StageContent<never> {
  /** The element of the layer. It is in the container. */
  readonly element: HTMLElement;
  /** This function shows the labels that a test accepts, and it removes the other labels from the picture. */
  show(test: (label: StageLabel) => boolean): void;
}

/** One label with its element and its state in the picture. */
interface Part {
  readonly label: StageLabel;
  readonly index: number;
  readonly element: HTMLElement;
  /** The size of the text, in CSS pixels. It is 0 until the browser gives the size. */
  width: number;
  height: number;
  /** This value is false for a label that `show` removed. */
  shown: boolean;
  highlight: Highlight;
  /** The anchor in the picture, or `undefined` for a point that the camera does not see. */
  point: Point | undefined;
  /** The last side of the text. While the picture does not move, the label tries it first, so a highlight moves no text. */
  side: LabelSide | undefined;
  /** This value is true while the text is in the picture. */
  on: boolean;
  /** The position of the text in the picture, in whole CSS pixels. */
  left: number;
  top: number;
}

/** This function gives the space that labels fill: each point, around the middle of the points. */
function extentOf(labels: readonly StageLabel[]): StageExtent {
  const count = Math.max(labels.length, 1);
  const sum = labels.reduce((to, label) => ({ x: to.x + label.at.x, y: to.y + label.at.y, z: to.z + label.at.z }), { x: 0, y: 0, z: 0 });
  const center = { x: sum.x / count, y: sum.y / count, z: sum.z / count };
  return { center, corners: labels.length === 0 ? [center] : labels.map((label) => label.at) };
}

/**
 * This function makes a layer of labels in a container of a page. The style sheet `@mark1russell7/visuals/labels.css` draws it.
 *
 * - Use the container of the stage, and give it `position: relative`. The layer then fills the picture, above the canvas.
 * - Each label is an HTML element, so its text is sharp at each size and it uses the font of the page.
 * - Before each picture, the layer puts each text next to its point. `placeLabels` keeps each text off each other text and off each mark.
 * - The places are a function of the picture: after a move of the camera, each label tries its sides from the first side.
 * - While the picture does not move, a label keeps its side. So a highlight or a change of `show` moves no other text.
 * - The layer writes no inline style attribute. It sets each position through the CSS object model, so a strict content security policy permits it.
 * - A screen reader ignores the layer. Give the names of the records in the page, for example in a list.
 */
export function createLabels(container: HTMLElement, options: LabelsOptions): LabelsContent {
  const page = container.ownerDocument;
  const visible = options.visible;
  const records = new Set(options.labels.map((label) => label.record));
  let width = 0;
  let height = 0;

  const element = page.createElement("div");
  element.className = "visuals-labels";
  element.setAttribute("aria-hidden", "true");
  const parts: Part[] = options.labels.map((label, index) => {
    const text = page.createElement("span");
    text.className = "visuals-label visuals-label-off";
    if (label.kind !== undefined) text.dataset["kind"] = label.kind;
    text.textContent = label.text;
    element.append(text);
    return { label, index, element: text, width: 0, height: 0, shown: true, highlight: 0, point: undefined, side: undefined, on: false, left: Number.NaN, top: Number.NaN };
  });
  const partOf = new Map<Element, Part>(parts.map((part) => [part.element, part]));

  /** This function puts one text at its place, or removes it from the picture. It changes the page only for a new value. */
  const put = (part: Part, place: LabelPlace | undefined): void => {
    if (place === undefined) {
      if (part.on) part.element.classList.add("visuals-label-off");
      part.on = false;
      return;
    }
    const left = Math.round(place.box.x);
    const top = Math.round(place.box.y);
    if (left !== part.left || top !== part.top) {
      part.left = left;
      part.top = top;
      part.element.style.transform = `translate(${String(left)}px, ${String(top)}px)`;
    }
    if (place.side !== part.side) {
      part.side = place.side;
      part.element.dataset["side"] = place.side;
    }
    if (!part.on) part.element.classList.remove("visuals-label-off");
    part.on = true;
  };

  /** This function gives the sides of a label, with its last side first. */
  const sidesOf = (part: Part): readonly LabelSide[] => {
    const sides = part.label.sides ?? LABEL_SIDES;
    const last = part.side;
    return last === undefined || sides[0] === last || !sides.includes(last) ? sides : [last, ...sides.filter((side) => side !== last)];
  };

  /**
   * This function gives each text its place from the anchors of the last picture.
   * `fresh` is true after a move of the picture: each label then tries its sides from the first side.
   */
  const layout = (fresh: boolean): void => {
    const live = parts.filter((part) => part.shown && part.point !== undefined);
    // A highlighted record is first, then the higher rank, then the sequence of the labels.
    live.sort((a, b) => b.highlight - a.highlight || (b.label.rank ?? 0) - (a.label.rank ?? 0) || a.index - b.index);
    const anchors: LabelAnchor[] = live.map((part) => ({
      x: part.point?.x ?? 0,
      y: part.point?.y ?? 0,
      width: part.width,
      height: part.height,
      clear: part.label.clear,
      sides: fresh ? part.label.sides : sidesOf(part),
    }));
    const places = placeLabels(anchors, { width, height, gap: options.gap, edge: options.edge });
    const placed = new Set<Part>();
    live.forEach((part, at) => {
      placed.add(part);
      put(part, places[at]);
    });
    for (const part of parts) if (!placed.has(part)) put(part, undefined);
  };

  // The browser gives the size of each text one time at the start, and again after a change of the font or of the zoom.
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const part = partOf.get(entry.target);
      const size = entry.borderBoxSize[0];
      if (part === undefined || size === undefined) continue;
      part.width = size.inlineSize;
      part.height = size.blockSize;
    }
    layout(false);
  });
  for (const part of parts) observer.observe(part.element);
  container.append(element);

  return {
    element,
    objects: [],
    extent: extentOf(options.labels),
    has: (record) => records.has(record),
    pick: () => undefined,
    paint(_theme, highlight): void {
      let changed = false;
      for (const part of parts) {
        const next = highlight(part.label.record);
        if (next === part.highlight) continue;
        part.highlight = next;
        part.element.classList.toggle("visuals-label-hovered", next === 1);
        part.element.classList.toggle("visuals-label-selected", next === 2);
        changed = true;
      }
      if (changed) layout(false);
    },
    step(frame: StageFrame): boolean {
      const { camera } = frame;
      // The stage moves the camera before the step, and three.js sets the matrices of the camera only when it makes the picture.
      camera.updateMatrixWorld();
      const nextHeight = frame.height;
      const nextWidth = frame.height * camera.aspect;
      let moved = nextWidth !== width || nextHeight !== height;
      width = nextWidth;
      height = nextHeight;
      const view = camera.matrixWorldInverse.elements;
      const projection = camera.projectionMatrix.elements;
      for (const part of parts) {
        const { at } = part.label;
        const point = visible === undefined || visible(at, camera.position) ? screenPoint(at, view, projection, width, height) : undefined;
        if (point?.x !== part.point?.x || point?.y !== part.point?.y) moved = true;
        part.point = point;
      }
      layout(moved);
      return false;
    },
    show(test): void {
      for (const part of parts) part.shown = test(part.label);
      layout(false);
    },
    dispose(): void {
      observer.disconnect();
      element.remove();
    },
  };
}
