import type { Rect } from "@mark1russell7/layout-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Highlight } from "../highlight.ts";
import { KEY_ZOOM } from "../keys.ts";
import { MOVE_TIME } from "../motion.ts";
import { aimRects } from "./aim.ts";
import { fitRect, pictureMoveAt, pinchView, showsRect, toPicture, wheelFactor, ZOOM_LIMITS, zoomView, type PictureView } from "./camera.ts";
import { createPictureStage, DOUBLE_CLICK_ZOOM, PICK_SLACK, TOUCH_PICK_SLACK, type PickAt, type PictureContent, type PictureFrame, type PictureStage, type PictureStageOptions } from "./stage.ts";

/** The fields of an event that the stage reads. The tests have no browser. */
interface EventFields {
  button: number;
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
}

interface FakeEvent extends EventFields {
  /** This value is true after a listener stopped the default action of the browser. */
  prevented: boolean;
  preventDefault(): void;
}

type Listener = (event: FakeEvent) => void;

/** The part of a 2D context that the stage uses. It writes each use in a list. */
class FakeContext {
  readonly calls: string[] = [];

  setTransform(...values: number[]): void {
    this.calls.push(`setTransform ${values.join(" ")}`);
  }

  clearRect(...values: number[]): void {
    this.calls.push(`clearRect ${values.join(" ")}`);
  }
}

/** The part of a canvas of a page that the stage uses. */
class FakeCanvas {
  readonly style: { display?: string; width?: string; height?: string; cursor?: string; touchAction?: string } = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<Listener>>();
  /** The option `passive` of the listeners of each type of event. */
  readonly passive = new Map<string, boolean | undefined>();
  /** The pointers that the canvas captured. */
  readonly captured: number[] = [];
  /** The options of each focus. */
  readonly focused: unknown[] = [];
  /** The position of the canvas in the window. */
  box = { left: 0, top: 0 };
  /** With this value, the browser gives no capture of a pointer. */
  captureFails = false;
  tabIndex = -1;
  width = 300;
  height = 150;
  parent: FakeContainer | undefined;
  readonly context: FakeContext | null;

  constructor(context: FakeContext | null) {
    this.context = context;
  }

  getContext(): FakeContext | null {
    return this.context;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener, options: { readonly signal?: AbortSignal; readonly passive?: boolean } = {}): void {
    const list = this.listeners.get(type) ?? new Set<Listener>();
    this.listeners.set(type, list);
    list.add(listener);
    this.passive.set(type, options.passive);
    options.signal?.addEventListener("abort", () => void list.delete(listener));
  }

  getBoundingClientRect(): { readonly left: number; readonly top: number } {
    return this.box;
  }

  focus(options: unknown): void {
    this.focused.push(options);
  }

  setPointerCapture(id: number): void {
    if (this.captureFails) throw new Error("The browser does not know the pointer.");
    this.captured.push(id);
  }

  remove(): void {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }

  /** This function gives an event to each listener of its type, as a browser does. It gives the event. */
  fire(type: string, fields: Partial<EventFields> = {}): FakeEvent {
    const event: FakeEvent = {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 0,
      clientY: 0,
      deltaY: 0,
      deltaMode: 0,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      key: "",
      ...fields,
      prevented: false,
      preventDefault: () => {
        event.prevented = true;
      },
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }
}

/** The part of the container of a stage that the stage uses. */
class FakeContainer {
  clientWidth: number;
  clientHeight: number;
  readonly children: FakeCanvas[] = [];
  /** The 2D context of each canvas of the page, or `null` for a browser that gives none. */
  context: FakeContext | null = new FakeContext();
  readonly ownerDocument = { createElement: (): FakeCanvas => new FakeCanvas(this.context) };

  constructor(width: number, height: number) {
    this.clientWidth = width;
    this.clientHeight = height;
  }

  append(child: FakeCanvas): void {
    child.parent = this;
    this.children.push(child);
  }
}

/** The observers of the size of an element that are in use. */
const observers = new Set<FakeObserver>();

class FakeObserver {
  readonly report: () => void;

  constructor(report: () => void) {
    this.report = report;
    observers.add(this);
  }

  observe(): void {
    // The tests report each size by hand.
  }

  disconnect(): void {
    observers.delete(this);
  }
}

/** This function gives a container a size, and reports it, as a browser does after a layout of the page. */
function resize(container: FakeContainer, width: number, height: number): void {
  container.clientWidth = width;
  container.clientHeight = height;
  for (const observer of observers) observer.report();
}

/** The pictures that the page waits for: the function of each request of a frame. */
const frames = new Map<number, (now: number) => void>();
let lastFrame = 0;
/** The time of the page, in milliseconds. */
let clock = 0;
/** This value is true for a person who asks for less motion. */
let less = false;

/** This function makes each picture that the page waits for, at a time in milliseconds. It gives the number of the pictures. */
function paint(now: number): number {
  clock = now;
  const waiting = [...frames.values()];
  frames.clear();
  for (const callback of waiting) callback(now);
  return waiting.length;
}

beforeEach(() => {
  frames.clear();
  observers.clear();
  lastFrame = 0;
  clock = 0;
  less = false;
  vi.stubGlobal("ResizeObserver", FakeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: (now: number) => void): number => {
    lastFrame += 1;
    frames.set(lastFrame, callback);
    return lastFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => void frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: less }));
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface Box {
  readonly record: string;
  readonly rect: Rect;
}

/** A content that writes each use of it in its lists. */
interface Recording extends PictureContent<string, string> {
  bounds: Rect;
  /** Each picture that the stage asked for. */
  readonly frames: PictureFrame[];
  readonly themes: string[];
  /** The highlight of each box, for each picture. */
  readonly highlights: Record<string, Highlight>[];
  readonly picks: PickAt[];
  /** The content continues to change while this value is true. */
  active: boolean;
  disposed: number;
}

/** The bounds of the sample picture. A picture of 800 by 600 pixels shows all of it at the zoom 0.5. */
const BOUNDS: Rect = { x: 0, y: 0, w: 1504, h: 1104 };

/** The view that shows all of the sample picture in 800 by 600 pixels. */
const HOME: PictureView = { x: 24, y: 24, k: 0.5 };

/** The free area of a picture of 800 by 600 pixels that the page does not cover. */
const AREA: Rect = { x: 0, y: 0, w: 800, h: 600 };

/** The home view shows this box at the screen point (74, 74), with a size of 100 by 50 pixels. */
const A: Box = { record: "a", rect: { x: 100, y: 100, w: 200, h: 100 } };

/** The home view shows this box at the screen point (424, 324), with a size of 100 by 50 pixels. */
const B: Box = { record: "b", rect: { x: 800, y: 600, w: 200, h: 100 } };

/** This function makes a content of boxes. The value of a pick is the name of its box after `value:`. */
function recording(boxes: readonly Box[] = [A, B], bounds: Rect = BOUNDS): Recording {
  const content: Recording = {
    bounds,
    frames: [],
    themes: [],
    highlights: [],
    picks: [],
    active: false,
    disposed: 0,
    has: (record) => boxes.some((box) => box.record === record),
    pick(pointer) {
      content.picks.push(pointer);
      const slack = pointer.slack / pointer.view.k;
      const { x, y } = pointer.point;
      const below = boxes.filter(({ rect }) => x >= rect.x - slack && x <= rect.x + rect.w + slack && y >= rect.y - slack && y <= rect.y + rect.h + slack);
      const top = below.at(-1);
      return top === undefined ? undefined : { record: top.record, value: `value:${top.record}` };
    },
    draw(context, frame, theme, highlight) {
      (context as unknown as FakeContext).calls.push("draw");
      content.frames.push(frame);
      content.themes.push(theme);
      content.highlights.push(Object.fromEntries(boxes.map((box) => [box.record, highlight(box.record)] as const)));
      return content.active;
    },
    dispose() {
      content.disposed += 1;
    },
  };
  return content;
}

interface Started {
  readonly stage: PictureStage<string, string>;
  readonly container: FakeContainer;
  readonly canvas: FakeCanvas;
  readonly context: FakeContext;
  readonly content: Recording;
  /** What the stage told the page. */
  readonly events: { readonly hover: (string | undefined)[]; readonly select: (string | undefined)[]; readonly view: PictureView[] };
}

type Options = Partial<Omit<PictureStageOptions<string, string>, "content">> & { readonly content?: Recording };

/** This function makes a stage in a container of 800 by 600 pixels, with the sample picture. */
function start(more: Options = {}, size: { readonly width: number; readonly height: number } = { width: 800, height: 600 }): Started {
  const container = new FakeContainer(size.width, size.height);
  const content = more.content ?? recording();
  const events: Started["events"] = { hover: [], select: [], view: [] };
  const stage = createPictureStage<string, string>(container as unknown as HTMLElement, {
    theme: "light",
    label: "A picture",
    onHover: (pick) => void events.hover.push(pick),
    onSelect: (pick) => void events.select.push(pick),
    onView: (view) => void events.view.push(view),
    ...more,
    content,
  });
  const canvas = container.children[0];
  if (stage === undefined || canvas === undefined || container.context === null) throw new Error("The browser gave no stage.");
  return { stage, container, canvas, context: container.context, content, events };
}

/** This function gives the fields of an event of a pointer at a position in the window. */
function at(x: number, y: number, more: Partial<EventFields> = {}): Partial<EventFields> {
  return { clientX: x, clientY: y, ...more };
}

/** This function makes a pointer go down and up at one position. */
function click(canvas: FakeCanvas, x: number, y: number, more: Partial<EventFields> = {}): void {
  canvas.fire("pointerdown", at(x, y, more));
  canvas.fire("pointerup", at(x, y, more));
}

/** This function makes a pointer go down at one position, move to a different position and go up there. */
function drag(canvas: FakeCanvas, from: readonly [number, number], to: readonly [number, number]): void {
  canvas.fire("pointerdown", at(from[0], from[1]));
  canvas.fire("pointermove", at(to[0], to[1]));
  canvas.fire("pointerup", at(to[0], to[1]));
}

/** The view after a drag of the home view by 40 pixels to the right and 20 pixels down. */
const DRAGGED: PictureView = { x: 64, y: 44, k: 0.5 };

/** A view of the options that shows the box `a`. */
const views = { box: aimRects([A.rect], { least: 0.5 }) };

/** The view that shows the box `a` in 800 by 600 pixels. */
const boxView = fitRect(A.rect, AREA);

describe("createPictureStage", () => {
  describe("the canvas", () => {
    it("gives undefined and adds nothing to the page when the browser gives no 2D context", () => {
      const container = new FakeContainer(800, 600);
      container.context = null;
      const content = recording();
      expect(createPictureStage(container as unknown as HTMLElement, { content, theme: "light", label: "A picture" })).toBeUndefined();
      expect(container.children).toEqual([]);
      expect(frames.size).toBe(0);
      expect(observers.size).toBe(0);
      expect(content.disposed).toBe(0);
    });

    it("puts a canvas that fills the container in the container", () => {
      const { stage, container, canvas } = start();
      expect(container.children).toEqual([canvas]);
      expect(stage.canvas).toBe(canvas);
      expect(canvas.style).toEqual({ display: "block", width: "100%", height: "100%", cursor: "grab", touchAction: "none" });
      expect(canvas.tabIndex).toBe(0);
      expect(Object.fromEntries(canvas.attributes)).toEqual({ role: "application", "aria-label": "A picture" });
      expect([canvas.width, canvas.height]).toEqual([800, 600]);
      // A listener of the wheel that is not passive can stop the scroll of the page.
      expect(canvas.passive.get("wheel")).toBe(false);
    });

    it("gives the canvas the pixels of the screen, 3 for one CSS pixel at most", () => {
      vi.stubGlobal("devicePixelRatio", 2);
      const sharp = start();
      expect([sharp.canvas.width, sharp.canvas.height]).toEqual([1600, 1200]);
      vi.stubGlobal("devicePixelRatio", 5);
      const sharpest = start();
      expect([sharpest.canvas.width, sharpest.canvas.height]).toEqual([2400, 1800]);
    });
  });

  describe("the pictures", () => {
    it("shows all of the picture in the first picture, with no time for a change", () => {
      const { content, context, events } = start();
      expect(paint(1000)).toBe(1);
      expect(content.frames).toEqual([{ view: HOME, width: 800, height: 600, area: AREA, pixelRatio: 1, seconds: 1 / 60, settle: true }]);
      expect(content.themes).toEqual(["light"]);
      // The canvas is clear before the content draws.
      expect(context.calls).toEqual(["setTransform 1 0 0 1 0 0", "clearRect 0 0 800 600", "setTransform 1 0 0 1 0 0", "draw"]);
      expect(events.view).toEqual([HOME]);
      expect(frames.size).toBe(0);
    });

    it("draws in CSS pixels on a canvas with more pixels", () => {
      vi.stubGlobal("devicePixelRatio", 2);
      const { content, context } = start();
      paint(1000);
      expect(context.calls).toEqual(["setTransform 1 0 0 1 0 0", "clearRect 0 0 1600 1200", "setTransform 2 0 0 2 0 0", "draw"]);
      expect(content.frames[0]).toMatchObject({ view: HOME, width: 800, height: 600, pixelRatio: 2 });
    });

    it("makes a picture only after a change, and one picture for many changes", () => {
      const { stage, content } = start();
      paint(1000);
      expect(paint(2000)).toBe(0);
      stage.refresh();
      stage.refresh();
      stage.setTheme("dark");
      expect(paint(3000)).toBe(1);
      expect(content.themes).toEqual(["light", "dark"]);
      expect(content.frames[1]?.settle).toBe(false);
    });

    it("makes the next picture while the content continues to change, with the time between the pictures", () => {
      const { stage, content } = start();
      content.active = true;
      paint(1000);
      expect(paint(1016)).toBe(1);
      // A long pause counts as a tenth of a second at most.
      paint(5000);
      content.active = false;
      expect(paint(5020)).toBe(1);
      expect(paint(5040)).toBe(0);
      stage.refresh();
      paint(9000);
      expect(content.frames.map((frame) => frame.seconds)).toEqual([1 / 60, 0.016, 0.1, 0.02, 1 / 60]);
    });

    it("tells the page the view after a change of the view only", () => {
      const { stage, canvas, events } = start();
      paint(1000);
      stage.refresh();
      paint(1100);
      expect(events.view).toEqual([HOME]);
      drag(canvas, [300, 300], [340, 320]);
      paint(1200);
      expect(events.view).toEqual([HOME, DRAGGED]);
    });

    it("gives the content no time for a change when the person asks for less motion", () => {
      less = true;
      const { stage, content } = start();
      paint(1000);
      stage.refresh();
      paint(1100);
      expect(content.frames.map((frame) => frame.settle)).toEqual([true, true]);
    });

    it("gives the content the highlights of the page, and tells the page nothing", () => {
      const { stage, content, events } = start();
      stage.highlight(["a", "b"]);
      paint(1000);
      stage.select("b");
      paint(1100);
      stage.highlight([]);
      paint(1200);
      stage.select(undefined);
      paint(1300);
      expect(content.highlights).toEqual([
        { a: 1, b: 1 },
        { a: 1, b: 2 },
        { a: 0, b: 2 },
        { a: 0, b: 0 },
      ]);
      expect(events.select).toEqual([]);
    });
  });

  describe("the pointer", () => {
    it("moves the picture in a drag, and selects nothing", () => {
      const { stage, canvas, events } = start();
      paint(1000);
      canvas.fire("pointerdown", at(300, 300));
      expect(canvas.style.cursor).toBe("grab");
      canvas.fire("pointermove", at(340, 320));
      expect(stage.view()).toEqual(DRAGGED);
      expect(canvas.style.cursor).toBe("grabbing");
      expect(frames.size).toBe(1);
      canvas.fire("pointerup", at(340, 320));
      expect(canvas.style.cursor).toBe("grab");
      expect(events.select).toEqual([]);
      // The canvas gets the keyboard, and the drag continues out of the canvas.
      expect(canvas.focused).toEqual([{ preventScroll: true }]);
      expect(canvas.captured).toEqual([1]);
    });

    it("continues a drag when the browser gives no capture of the pointer", () => {
      const { stage, canvas } = start();
      canvas.captureFails = true;
      drag(canvas, [300, 300], [340, 320]);
      expect(stage.view()).toEqual(DRAGGED);
    });

    it("keeps a part of the picture in view in a long drag", () => {
      const { stage, canvas } = start();
      drag(canvas, [300, 300], [5300, 300]);
      // The picture is 752 by 552 pixels on the screen. 64 pixels of it stay in view.
      expect(stage.view()).toEqual({ x: 800 - 64, y: 24, k: 0.5 });
      drag(canvas, [300, 300], [-9700, -9700]);
      expect(stage.view()).toEqual({ x: 64 - 752, y: 64 - 552, k: 0.5 });
    });

    it("selects the record below a click, and no record for a click on no record", () => {
      const { stage, canvas, content, events } = start();
      paint(1000);
      canvas.box = { left: 10, top: 20 };
      click(canvas, 110, 120);
      expect(events.select).toEqual(["value:a"]);
      expect(content.picks).toEqual([{ point: { x: 152, y: 152 }, screen: { x: 100, y: 100 }, view: HOME, slack: PICK_SLACK }]);
      paint(1100);
      expect(content.highlights.at(-1)).toEqual({ a: 2, b: 0 });
      click(canvas, 310, 320);
      expect(events.select).toEqual(["value:a", undefined]);
      paint(1200);
      expect(content.highlights.at(-1)).toEqual({ a: 0, b: 0 });
      expect(stage.view()).toEqual(HOME);
    });

    it("makes a click of a mouse that moves 4 pixels or less", () => {
      const { canvas, events } = start();
      canvas.fire("pointerdown", at(100, 100));
      canvas.fire("pointerup", at(104, 100));
      canvas.fire("pointerdown", at(100, 100));
      canvas.fire("pointerup", at(105, 100));
      expect(events.select).toEqual(["value:a"]);
    });

    it("gives a finger a larger distance for a click and for a pick", () => {
      const { canvas, content, events } = start();
      const finger = { pointerType: "touch" };
      // The box `a` ends at 174 pixels. A finger at 182 pixels is near it, and a mouse there is not.
      canvas.fire("pointerdown", at(190, 100, finger));
      canvas.fire("pointerup", at(182, 100, finger));
      expect(events.select).toEqual(["value:a"]);
      expect(content.picks.at(-1)?.slack).toBe(TOUCH_PICK_SLACK);
      click(canvas, 182, 100);
      expect(events.select).toEqual(["value:a", undefined]);
    });

    it("ignores a button that is not the first button", () => {
      const { canvas, events } = start();
      click(canvas, 100, 100, { button: 2 });
      expect(events.select).toEqual([]);
      expect(canvas.captured).toEqual([]);
    });

    it("shows the record below the pointer", () => {
      const { canvas, content, events } = start();
      paint(1000);
      canvas.fire("pointermove", at(100, 100));
      expect(events.hover).toEqual(["value:a"]);
      expect(canvas.style.cursor).toBe("pointer");
      paint(1100);
      expect(content.highlights.at(-1)).toEqual({ a: 1, b: 0 });
      // A move on the same record changes nothing.
      canvas.fire("pointermove", at(120, 110));
      expect(events.hover).toEqual(["value:a"]);
      expect(frames.size).toBe(0);
      canvas.fire("pointermove", at(450, 350));
      canvas.fire("pointermove", at(300, 300));
      expect(events.hover).toEqual(["value:a", "value:b", undefined]);
      expect(canvas.style.cursor).toBe("grab");
    });

    it("removes the hover when the pointer leaves the picture", () => {
      const { canvas, events } = start();
      const pen = { pointerType: "pen" };
      canvas.fire("pointermove", at(100, 100, pen));
      canvas.fire("pointerleave", pen);
      canvas.fire("pointerleave", pen);
      expect(events.hover).toEqual(["value:a", undefined]);
    });

    it("has no hover for a finger, and no hover while a pointer is down", () => {
      const { canvas, events } = start();
      canvas.fire("pointermove", at(100, 100, { pointerType: "touch" }));
      canvas.fire("pointerdown", at(300, 300));
      canvas.fire("pointermove", at(100, 100, { pointerId: 2 }));
      expect(events.hover).toEqual([]);
    });

    it("changes the zoom with two fingers, and makes no click", () => {
      const { stage, canvas, events } = start();
      const first = { pointerType: "touch", pointerId: 1 };
      const second = { pointerType: "touch", pointerId: 2 };
      canvas.fire("pointerdown", at(300, 300, first));
      canvas.fire("pointerdown", at(500, 300, second));
      canvas.fire("pointermove", at(600, 300, second));
      const still = { x: 300, y: 300 };
      expect(stage.view()).toEqual(pinchView(HOME, [{ x: 500, y: 300 }, still], [{ x: 600, y: 300 }, still]));
      expect(stage.view().k).toBeCloseTo(0.75, 12);
      canvas.fire("pointerup", at(600, 300, second));
      expect(canvas.style.cursor).toBe("grabbing");
      canvas.fire("pointerup", at(300, 300, first));
      expect(canvas.style.cursor).toBe("grab");
      expect(events.select).toEqual([]);
    });

    it("ends a drag when the browser stops the pointer", () => {
      const { canvas, events } = start();
      canvas.fire("pointerdown", at(300, 300));
      canvas.fire("pointermove", at(340, 320));
      canvas.fire("pointercancel");
      expect(canvas.style.cursor).toBe("grab");
      canvas.fire("pointerup", at(340, 320));
      expect(events.select).toEqual([]);
    });

    it("zooms at the pointer for a double click, with a move", () => {
      const { stage, canvas } = start();
      paint(1000);
      expect(canvas.fire("dblclick", at(100, 100)).prevented).toBe(true);
      expect(stage.view()).toEqual(HOME);
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual(zoomView(HOME, { x: 100, y: 100 }, DOUBLE_CLICK_ZOOM));
      expect(stage.view()).toEqual({ x: -52, y: -52, k: 1 });
    });
  });

  describe("the wheel", () => {
    const turn = { clientX: 400, clientY: 300, deltaY: -100 };
    const zoomed = zoomView(HOME, { x: 400, y: 300 }, wheelFactor(-100));

    it("moves the page until a person uses the picture with a pointer", () => {
      const { stage, canvas } = start();
      expect(canvas.fire("wheel", turn).prevented).toBe(false);
      expect(stage.view()).toEqual(HOME);
      click(canvas, 300, 300);
      expect(canvas.fire("wheel", turn).prevented).toBe(true);
      expect(stage.view()).toEqual(zoomed);
      expect(stage.view().k).toBeGreaterThan(0.5);
      canvas.fire("pointerleave");
      expect(canvas.fire("wheel", turn).prevented).toBe(false);
      expect(stage.view()).toEqual(zoomed);
    });

    it("changes the zoom after a key, until the picture loses the keyboard", () => {
      const { stage, canvas } = start();
      canvas.fire("keydown", { key: "Home" });
      expect(canvas.fire("wheel", turn).prevented).toBe(true);
      expect(stage.view()).toEqual(zoomed);
      canvas.fire("blur");
      expect(canvas.fire("wheel", turn).prevented).toBe(false);
    });

    it("changes the zoom for a pinch on a touch pad at each time", () => {
      const { stage, canvas } = start();
      expect(canvas.fire("wheel", { ...turn, deltaY: -10, ctrlKey: true }).prevented).toBe(true);
      expect(stage.view()).toEqual(zoomView(HOME, { x: 400, y: 300 }, wheelFactor(-10, 0, true)));
    });

    it("changes the zoom at each time with the option always, also for a wheel that gives lines", () => {
      const { stage, canvas } = start({ wheel: "always" });
      expect(canvas.fire("wheel", { ...turn, deltaY: 3, deltaMode: 1 }).prevented).toBe(true);
      expect(stage.view()).toEqual(zoomView(HOME, { x: 400, y: 300 }, wheelFactor(3, 1)));
      expect(stage.view().k).toBeLessThan(0.5);
    });

    it("keeps the point of the picture below the pointer", () => {
      const { stage, canvas } = start({ wheel: "always" });
      canvas.box = { left: 10, top: 20 };
      canvas.fire("wheel", { clientX: 110, clientY: 120, deltaY: -240 });
      const point = toPicture(stage.view(), { x: 100, y: 100 });
      expect(point.x).toBeCloseTo(152, 9);
      expect(point.y).toBeCloseTo(152, 9);
    });
  });

  describe("the keys", () => {
    it("moves the camera with an arrow key, and changes the zoom with + and -", () => {
      const { stage, canvas } = start();
      expect(canvas.fire("keydown", { key: "ArrowRight" }).prevented).toBe(true);
      // One step is an eighth of the smaller side of the area: 75 pixels.
      expect(stage.view()).toEqual({ x: -51, y: 24, k: 0.5 });
      canvas.fire("keydown", { key: "ArrowDown" });
      expect(stage.view()).toEqual({ x: -51, y: -51, k: 0.5 });
      canvas.fire("keydown", { key: "+" });
      const nearer = zoomView({ x: -51, y: -51, k: 0.5 }, { x: 400, y: 300 }, 1 / KEY_ZOOM);
      expect(stage.view()).toEqual(nearer);
      canvas.fire("keydown", { key: "-" });
      expect(stage.view()).toEqual(zoomView(nearer, { x: 400, y: 300 }, KEY_ZOOM));
    });

    it("goes to the first view with a move for the key Home", () => {
      const { stage, canvas } = start();
      paint(1000);
      canvas.fire("keydown", { key: "ArrowRight" });
      paint(2000);
      canvas.fire("keydown", { key: "Home" });
      expect(stage.view()).toEqual({ x: -51, y: 24, k: 0.5 });
      expect(paint(2000 + MOVE_TIME / 2)).toBe(1);
      expect(stage.view()).toEqual({ x: -13.5, y: 24, k: 0.5 });
      expect(paint(2000 + MOVE_TIME)).toBe(1);
      expect(stage.view()).toEqual(HOME);
      expect(frames.size).toBe(0);
    });

    it("shows the view of a key of the options, with no case for a letter", () => {
      const { stage, canvas } = start({ views, keys: { b: "box" } });
      paint(1000);
      expect(canvas.fire("keydown", { key: "B" }).prevented).toBe(true);
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual(boxView);
    });

    it("ignores a key with no action, and a key with Alt, Control or Meta", () => {
      const { stage, canvas } = start();
      expect(canvas.fire("keydown", { key: "x" }).prevented).toBe(false);
      expect(canvas.fire("keydown", { key: "ArrowLeft", altKey: true }).prevented).toBe(false);
      expect(canvas.fire("keydown", { key: "+", ctrlKey: true }).prevented).toBe(false);
      expect(canvas.fire("keydown", { key: "0", metaKey: true }).prevented).toBe(false);
      expect(stage.view()).toEqual(HOME);
    });
  });

  describe("the views", () => {
    it("moves the camera to a view in the time of a move", () => {
      const { stage } = start({ views });
      paint(1000);
      stage.setView("box");
      expect(stage.view()).toEqual(HOME);
      const middle = 1000 + MOVE_TIME / 2;
      paint(middle);
      expect(stage.view()).toEqual(pictureMoveAt({ from: HOME, to: boxView, start: 1000, duration: MOVE_TIME }, middle).view);
      expect(stage.view().k).toBeGreaterThan(HOME.k);
      expect(stage.view().k).toBeLessThan(boxView.k);
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual(boxView);
      expect(frames.size).toBe(0);
    });

    it("goes to a view immediately with no animation, and for a person who asks for less motion", () => {
      const { stage } = start({ views });
      paint(1000);
      stage.setView("box", false);
      expect(stage.view()).toEqual(boxView);
      less = true;
      stage.setView("all");
      expect(stage.view()).toEqual(HOME);
    });

    it("goes to an aim that is not in the options", () => {
      const { stage } = start();
      stage.setView(aimRects([B.rect], { least: 0.5 }), false);
      expect(stage.view()).toEqual(fitRect(B.rect, AREA));
    });

    it("ignores a name that the views do not have", () => {
      const { stage } = start();
      paint(1000);
      stage.setView("none");
      expect(stage.view()).toEqual(HOME);
      expect(frames.size).toBe(0);
    });

    it("starts at the home view of the options, and the key Home shows it", () => {
      const { stage, canvas } = start({ views, home: "box" });
      expect(stage.view()).toEqual(boxView);
      stage.setView("all", false);
      canvas.fire("keydown", { key: "Home" });
      paint(MOVE_TIME);
      expect(stage.view()).toEqual(boxView);
    });

    it("uses a view all of the options in place of its own", () => {
      const { stage } = start({ views: { all: aimRects([B.rect], { least: 0.5 }) } });
      expect(stage.view()).toEqual(fitRect(B.rect, AREA));
    });

    it("stops a move when a pointer goes down, and keeps the view of that time", () => {
      const { stage, canvas } = start({ views });
      paint(1000);
      stage.setView("box");
      paint(1000 + MOVE_TIME / 2);
      const stopped = stage.view();
      canvas.fire("pointerdown", at(300, 300));
      expect(paint(1000 + MOVE_TIME)).toBe(1);
      expect(stage.view()).toBe(stopped);
      expect(frames.size).toBe(0);
    });

    it("changes the zoom by a factor at the middle, and adds a second step to the goal of the first step", () => {
      const { stage } = start();
      paint(1000);
      stage.zoomBy(2);
      stage.zoomBy(2);
      expect(stage.view()).toEqual(HOME);
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual({ x: -1104, y: -804, k: 2 });
      // The middle of the picture stays at the middle of the area.
      expect(toPicture(stage.view(), { x: 400, y: 300 })).toEqual({ x: 752, y: 552 });
    });

    it("keeps the zoom of a button in the limits", () => {
      const { stage } = start();
      stage.zoomBy(1000, false);
      expect(stage.view().k).toBe(ZOOM_LIMITS.max);
      stage.zoomBy(0.000_01, false);
      expect(stage.view().k).toBe(ZOOM_LIMITS.min);
      expect(showsRect(stage.view(), BOUNDS, AREA)).toBe(true);
    });
  });

  describe("the size", () => {
    it("aims the camera again after a change of the size, when no person moved the view", () => {
      const { stage, container, canvas } = start();
      paint(1000);
      resize(container, 400, 300);
      const small = { x: 0, y: 0, w: 400, h: 300 };
      expect([canvas.width, canvas.height]).toEqual([400, 300]);
      expect(stage.area()).toEqual(small);
      expect(stage.view()).toEqual(fitRect(BOUNDS, small));
      expect(frames.size).toBe(1);
    });

    it("keeps the middle of a view that a person moved", () => {
      const { stage, container, canvas } = start();
      drag(canvas, [300, 300], [340, 320]);
      const before = toPicture(stage.view(), { x: 400, y: 300 });
      resize(container, 600, 400);
      expect(stage.view()).toEqual({ x: -36, y: -56, k: 0.5 });
      expect(toPicture(stage.view(), { x: 300, y: 200 })).toEqual(before);
    });

    it("keeps the middle of the goal of a move, and ends the move", () => {
      const { stage, container } = start();
      paint(1000);
      stage.zoomBy(2);
      resize(container, 600, 400);
      expect(stage.view()).toEqual({ x: -452, y: -352, k: 1 });
      expect(toPicture(stage.view(), { x: 300, y: 200 })).toEqual({ x: 752, y: 552 });
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual({ x: -452, y: -352, k: 1 });
    });

    it("does nothing for a report with no change of the size", () => {
      const { container } = start();
      paint(1000);
      resize(container, 800, 600);
      expect(frames.size).toBe(0);
    });

    it("makes no picture before the container has a size, then aims the camera in the first size", () => {
      const { stage, container, canvas, content, context, events } = start({ views }, { width: 0, height: 0 });
      expect(paint(1000)).toBe(1);
      expect(content.frames).toEqual([]);
      expect(context.calls).toEqual([]);
      expect(frames.size).toBe(0);
      stage.setView("box");
      resize(container, 800, 600);
      expect([canvas.width, canvas.height]).toEqual([800, 600]);
      expect(stage.view()).toEqual(boxView);
      paint(1016);
      expect(content.frames).toEqual([{ view: boxView, width: 800, height: 600, area: AREA, pixelRatio: 1, seconds: 1 / 60, settle: true }]);
      expect(events.view).toEqual([boxView]);
    });

    it("uses the pixels of a different screen with no report of a size", () => {
      const { stage, canvas, content } = start();
      paint(1000);
      vi.stubGlobal("devicePixelRatio", 2);
      stage.refresh();
      paint(1100);
      expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
      expect(content.frames.at(-1)).toMatchObject({ view: HOME, pixelRatio: 2 });
    });

    it("goes to its view in the free area after a change of the insets", () => {
      const { stage } = start();
      paint(1000);
      stage.setInsets({ left: 200 });
      const free = { x: 200, y: 0, w: 600, h: 600 };
      expect(stage.area()).toEqual(free);
      expect(stage.view()).toEqual(HOME);
      paint(1000 + MOVE_TIME);
      expect(stage.view()).toEqual(fitRect(BOUNDS, free));
    });

    it("starts with the insets of the options", () => {
      const { stage } = start({ insets: { top: 100, right: 300 } });
      const free = { x: 0, y: 100, w: 500, h: 500 };
      expect(stage.area()).toEqual(free);
      expect(stage.view()).toEqual(fitRect(BOUNDS, free));
    });

    it("keeps a view that a person moved after a change of the insets", () => {
      const { stage, canvas } = start();
      drag(canvas, [300, 300], [340, 320]);
      stage.setInsets({ left: 200 });
      expect(stage.view()).toEqual(DRAGGED);
    });

    it("keeps the insets that it got before the container had a size", () => {
      const { stage, container } = start({}, { width: 0, height: 0 });
      paint(1000);
      stage.setInsets({ left: 200 });
      expect(frames.size).toBe(0);
      resize(container, 800, 600);
      expect(stage.view()).toEqual(fitRect(BOUNDS, { x: 200, y: 0, w: 600, h: 600 }));
    });
  });

  describe("the content", () => {
    it("shows a different content immediately, and disposes the old content", () => {
      const { stage, content } = start();
      paint(1000);
      const bounds = { x: 5000, y: 5000, w: 400, h: 300 };
      const next = recording([{ record: "c", rect: bounds }], bounds);
      stage.setContent(next);
      expect(content.disposed).toBe(1);
      expect(next.disposed).toBe(0);
      // No person moved the view: the camera shows all of the new content.
      expect(stage.view()).toEqual(fitRect(bounds, AREA));
      paint(1100);
      expect(next.frames).toEqual([{ view: fitRect(bounds, AREA), width: 800, height: 600, area: AREA, pixelRatio: 1, seconds: 1 / 60, settle: true }]);
      expect(content.frames).toHaveLength(1);
    });

    it("ignores the content that it shows", () => {
      const { stage, content } = start();
      paint(1000);
      stage.setContent(content);
      expect(content.disposed).toBe(0);
      expect(frames.size).toBe(0);
    });

    it("keeps the selected record only if the new content has it, and removes the hover", () => {
      const { stage, canvas, events } = start();
      paint(1000);
      click(canvas, 100, 100);
      canvas.fire("pointermove", at(450, 350));
      expect(canvas.style.cursor).toBe("pointer");
      const same = recording([A]);
      stage.setContent(same);
      expect(canvas.style.cursor).toBe("grab");
      paint(1100);
      expect(same.highlights).toEqual([{ a: 2 }]);
      const other = recording([B]);
      stage.setContent(other);
      paint(1200);
      expect(other.highlights).toEqual([{ b: 0 }]);
      const again = recording([A]);
      stage.setContent(again);
      paint(1300);
      expect(again.highlights).toEqual([{ a: 0 }]);
      expect(events.select).toEqual(["value:a"]);
    });

    it("keeps a view that a person moved, with a part of the new content in view", () => {
      const { stage, canvas } = start();
      drag(canvas, [300, 300], [340, 320]);
      stage.setContent(recording([A]));
      expect(stage.view()).toEqual(DRAGGED);
      const far = { x: 5000, y: 5000, w: 100, h: 100 };
      stage.setContent(recording([], far));
      expect(stage.view()).toEqual({ x: -1750, y: -1950, k: 0.5 });
      expect(showsRect(stage.view(), far, AREA)).toBe(true);
    });

    it("gives a very large picture a smaller least zoom, so a person can show all of it", () => {
      const bounds = { x: -3000, y: 100, w: 1_000_000, h: 40_000 };
      const { stage } = start({ content: recording([], bounds) });
      expect(stage.view().k).toBe(752 / 1_000_000);
      expect(showsRect(stage.view(), bounds, AREA)).toBe(true);
      stage.zoomBy(0.001, false);
      expect(stage.view().k).toBe(752 / 1_000_000);
      stage.zoomBy(1e9, false);
      expect(stage.view().k).toBe(ZOOM_LIMITS.max);
    });

    it("uses the limits of the options, with a smaller least zoom for a large picture", () => {
      const { stage } = start({ limits: { min: 0.5, max: 2 }, content: recording([], { x: 0, y: 0, w: 3008, h: 1104 }) });
      expect(stage.view().k).toBe(0.25);
      stage.zoomBy(100, false);
      expect(stage.view().k).toBe(2);
    });
  });

  describe("the end", () => {
    it("removes the canvas, and disposes the content one time", () => {
      const { stage, container, canvas, content, events } = start();
      stage.dispose();
      stage.dispose();
      expect(container.children).toEqual([]);
      expect(content.disposed).toBe(1);
      expect(frames.size).toBe(0);
      expect(observers.size).toBe(0);
      // The canvas has no listener, and the stage asks for no picture.
      click(canvas, 100, 100);
      canvas.fire("pointermove", at(100, 100));
      canvas.fire("keydown", { key: "ArrowLeft" });
      expect(events).toEqual({ hover: [], select: [], view: [] });
      const next = recording();
      stage.refresh();
      stage.setContent(next);
      stage.setView("all");
      expect(frames.size).toBe(0);
      expect(next.disposed).toBe(0);
    });
  });
});
