import type { Point, Rect } from "@mark1russell7/layout-contract";
import { CLICK_DISTANCE, highlightOf, NO_HIGHLIGHTS, type Highlight, type Highlights } from "../highlight.ts";
import { lessMotion, MOVE_TIME } from "../motion.ts";
import { aimAll, type AimFrame, type PictureAim } from "./aim.ts";
import {
  clampZoom,
  freeArea,
  keepRect,
  middleOf,
  pictureMoveAt,
  sameView,
  toPicture,
  UNIT_VIEW,
  viewAt,
  wheelFactor,
  ZOOM_LIMITS,
  zoomLimitsFor,
  zoomView,
  type Insets,
  type PictureMove,
  type PictureView,
  type ZoomLimits,
} from "./camera.ts";
import { pictureKeyAction } from "./keys.ts";
import { NO_POINTERS, pointerCancel, pointerDown, pointerMove, pointerUp, TOUCH_CLICK_DISTANCE, type Pointers } from "./pointers.ts";

/** The record below the pointer of a flat picture: its name, and the value that the content gives for it. */
export interface PicturePick<P> {
  /** The name of the record. The highlights of the stage use this name. */
  readonly record: string;
  /** The value of the record for the page, for example its kind and its source. */
  readonly value: P;
}

/** The position of a pointer on a flat picture, for the pick of a content. */
export interface PickAt {
  /** The point of the picture below the pointer. */
  readonly point: Point;
  /** The position of the pointer on the screen, in CSS pixels from the top left corner of the picture. */
  readonly screen: Point;
  /** The view of the camera. */
  readonly view: PictureView;
  /** The distance from the pointer at which a thin part is below the pointer, in CSS pixels. A finger has a larger distance than a mouse. */
  readonly slack: number;
}

/** One picture of a flat stage, for the drawing of its content. */
export interface PictureFrame {
  /** The view of the camera. */
  readonly view: PictureView;
  /** The width of the picture, in CSS pixels. */
  readonly width: number;
  /** The height of the picture, in CSS pixels. */
  readonly height: number;
  /** The part of the picture that the page does not cover, in CSS pixels. */
  readonly area: Rect;
  /** The number of pixels of the canvas for one CSS pixel. */
  readonly pixelRatio: number;
  /** The time since the last picture, in seconds. */
  readonly seconds: number;
  /**
   * This value is true for the first picture of a content, and for a person who asks for less motion.
   * Each change then has no time: the content sets each value to its goal immediately.
   */
  readonly settle: boolean;
}

/**
 * The content of a flat stage: what the stage draws, and what the stage asks of it.
 * `P` is the type of the value of a pick, and `T` is the type of the theme.
 */
export interface PictureContent<P, T> {
  /** The bounds of the content, in the unit of the picture. The views and the limits of the camera come from them. */
  readonly bounds: Rect;
  /** This function tells if the content has a record with a name. */
  has(record: string): boolean;
  /** This function gives the record below a pointer, or `undefined` for no record. */
  pick(at: PickAt): PicturePick<P> | undefined;
  /**
   * This function draws the content on a clear canvas. The unit of the context is the CSS pixel: the view is in the frame.
   * `highlight` gives the highlight of a record. The function gives true while a part continues to change.
   * The stage then makes the next picture.
   */
  draw(context: CanvasRenderingContext2D, frame: PictureFrame, theme: T, highlight: (record: string) => Highlight): boolean;
  /** This function releases what the content keeps, for example its images. */
  dispose?(): void;
}

/** The options of a flat stage. */
export interface PictureStageOptions<P, T> {
  /** The first content. The stage disposes each content that it gets. */
  readonly content: PictureContent<P, T>;
  readonly theme: T;
  /** The name of the picture for a screen reader. */
  readonly label: string;
  /** The views of the stage, each with a name. The view `all` shows all of the picture, if the options do not give a different one. */
  readonly views?: Readonly<Record<string, PictureAim>> | undefined;
  /** The name of the first view. The keys `Home` and `0` show it. The default is `all`. */
  readonly home?: string | undefined;
  /** The name of the view of a key, for example `{ f: "focus" }`. A letter has no case. */
  readonly keys?: Readonly<Record<string, string>> | undefined;
  /** The limits of the zoom. The default is `ZOOM_LIMITS`. A very large picture gets a smaller least zoom, so a person can show all of it. */
  readonly limits?: ZoomLimits | undefined;
  /** The parts of the picture that the page covers, from each edge, in CSS pixels. */
  readonly insets?: Partial<Insets> | undefined;
  /**
   * When the wheel changes the zoom. With `in-use`, the wheel moves the page until a person uses the picture.
   * With `always`, the wheel changes the zoom at each time. The default is `in-use`. A pinch on a touch pad changes the zoom always.
   */
  readonly wheel?: "always" | "in-use" | undefined;
  /** The stage starts this function when the pointer goes to a different record, or to no record. */
  readonly onHover?: ((pick: P | undefined) => void) | undefined;
  /** The stage starts this function when a person selects a record with the pointer, or selects no record. */
  readonly onSelect?: ((pick: P | undefined) => void) | undefined;
  /** The stage starts this function after a change of the view, one time for each picture at most. */
  readonly onView?: ((view: PictureView) => void) | undefined;
}

/** A flat stage in a page: one canvas with a camera that a person moves, and one content. */
export interface PictureStage<P, T> {
  /** The canvas of the stage. It is in the container. */
  readonly canvas: HTMLCanvasElement;
  /** This function shows a different content, and disposes the old content. The view stays if a person moved it. */
  setContent(content: PictureContent<P, T>): void;
  /** This function changes the colors. */
  setTheme(theme: T): void;
  /** This function moves the camera to a view: a name of the options, or an aim. `animate` has the default true. */
  setView(view: string | PictureAim, animate?: boolean): void;
  /** This function tells the stage which parts of the picture the page covers. The camera goes to its view again if no person moved it. */
  setInsets(insets: Partial<Insets>): void;
  /** This function gives the view of the camera. */
  view(): PictureView;
  /** This function gives the part of the picture that the page does not cover, in CSS pixels. */
  area(): Rect;
  /** This function changes the zoom by a factor, at the middle of the free area. Use it for the buttons of a page. `animate` has the default true. */
  zoomBy(factor: number, animate?: boolean): void;
  /** This function highlights records by their names, as the pointer does. An empty list removes the highlights. */
  highlight(records: readonly string[]): void;
  /** This function selects one record by its name, or no record. It does not start `onSelect`. */
  select(record: string | undefined): void;
  /** This function makes a new picture. Use it after a change of the content. */
  refresh(): void;
  /** This function removes the canvas, and disposes the content. */
  dispose(): void;
}

/** The distance from a mouse at which a thin part is below the pointer, in CSS pixels. */
export const PICK_SLACK = 5;

/** The distance from a finger or a pen at which a thin part is below the pointer, in CSS pixels. */
export const TOUCH_PICK_SLACK = 12;

/** The factor of the zoom for a double click. */
export const DOUBLE_CLICK_ZOOM = 2;

/** The largest number of pixels of the canvas for one CSS pixel. A larger number costs memory, and a person does not see it. */
const LARGEST_PIXEL_RATIO = 3;

/**
 * This function makes a flat stage in a container of a page. The stage fills the container, so give the container a size.
 *
 * A person moves the picture with a drag, and changes the zoom with the wheel, with two fingers or with a double click.
 * A click selects the record below the pointer. With the keyboard, the arrow keys move the camera, `+` and `-` change the zoom,
 * and `Home` shows the first view. The stage makes a picture only after a change.
 *
 * The function gives `undefined` when the browser gives no 2D context for a canvas. It does not throw.
 */
export function createPictureStage<P, T>(container: HTMLElement, options: PictureStageOptions<P, T>): PictureStage<P, T> | undefined {
  const canvas = container.ownerDocument.createElement("canvas");
  const made = canvas.getContext("2d");
  if (made === null) return undefined;
  // The functions below use this constant: its type has no `null`.
  const context: CanvasRenderingContext2D = made;

  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", options.label);
  container.append(canvas);

  const views: Readonly<Record<string, PictureAim>> = { all: aimAll(), ...options.views };
  const home = options.home ?? "all";
  const baseLimits = options.limits ?? ZOOM_LIMITS;
  const wheel = options.wheel ?? "in-use";

  let content = options.content;
  let theme = options.theme;
  let insets: Partial<Insets> = options.insets ?? {};
  let highlights: Highlights = NO_HIGHLIGHTS;
  /** The size of the picture, in CSS pixels. */
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  /** This value is true after the container gave a size. A stage with no size makes no picture. */
  let sized = false;
  let area: Rect = freeArea({ width, height }, insets);
  let limits: ZoomLimits = baseLimits;
  let view: PictureView = UNIT_VIEW;
  /** The view that the camera has, or goes to: a name of the views, or an aim. */
  let aim: string | PictureAim = home;
  let move: PictureMove | undefined;
  /** This value is true after a person moved the view. Then a new size of the container does not aim the camera again. */
  let moved = false;
  /** This value is true until the content had a picture with no time. */
  let settle = true;
  /** This value is true while a person uses the picture. The wheel then changes the zoom. */
  let inUse = false;
  let pointers: Pointers = NO_POINTERS;
  /** This value is true while a pointer that is down moves the picture. */
  let dragging = false;
  /** The view that `onView` got last. */
  let told: PictureView | undefined;
  let frame = 0;
  let lastTime = 0;
  let disposed = false;

  const invalidate = (): void => {
    if (frame === 0 && !disposed) frame = requestAnimationFrame(tick);
  };

  const setCursor = (): void => {
    canvas.style.cursor = dragging ? "grabbing" : highlights.hovered === undefined ? "grab" : "pointer";
  };

  /** This function sets the free area and the limits of the zoom, from the size, the insets and the content. */
  const setArea = (): void => {
    area = freeArea({ width, height }, insets);
    limits = zoomLimitsFor(content.bounds, area, baseLimits);
  };

  const aimFrame = (): AimFrame => ({ bounds: content.bounds, area, view, limits });

  /** This function moves the camera to a view, with a move or immediately. A picture with no size has no move. */
  const glide = (to: PictureView, animate: boolean): void => {
    if (animate && sized && !lessMotion() && !sameView(view, to)) {
      move = { from: view, to, start: performance.now(), duration: MOVE_TIME };
    } else {
      move = undefined;
      view = to;
    }
    invalidate();
  };

  const goTo = (next: string | PictureAim, animate: boolean): void => {
    const found = typeof next === "string" ? views[next] : next;
    if (found === undefined) return;
    aim = next;
    moved = false;
    glide(found(aimFrame()), animate);
  };

  /**
   * This function sets a view that a person made, immediately. The zoom stays in its limits, and a part of the picture stays in the free area.
   * A zoom that the limits change keeps the point of the picture at the middle of the free area.
   */
  const hold = (base: PictureView): void => {
    const k = clampZoom(base.k, limits);
    const middle = middleOf(area);
    move = undefined;
    view = keepRect(k === base.k ? base : viewAt(toPicture(base, middle), middle, k), content.bounds, area);
    invalidate();
  };

  /** This function sets a view that a person made with a pointer, the wheel or a key. */
  const steer = (next: PictureView): void => {
    moved = true;
    hold(next);
  };

  /**
   * This function sets the size of the canvas from the size of the container and the pixels of the screen.
   * It gives true after a change. A container with no size changes nothing.
   */
  const setSize = (): boolean => {
    const wide = container.clientWidth;
    const tall = container.clientHeight;
    if (wide === 0 || tall === 0) return false;
    const ratio = Math.min(globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1, LARGEST_PIXEL_RATIO);
    if (wide === width && tall === height && ratio === pixelRatio) return false;
    width = wide;
    height = tall;
    pixelRatio = ratio;
    canvas.width = Math.round(wide * ratio);
    canvas.height = Math.round(tall * ratio);
    return true;
  };

  /** This function sets the camera after a change of the size of the picture. */
  const fitAgain = (): void => {
    const before = area;
    const first = !sized;
    sized = true;
    setArea();
    if (first || !moved) {
      goTo(aim, false);
      return;
    }
    // A person moved the view: the point of the picture at the middle of the free area stays at the middle.
    const base = move?.to ?? view;
    hold(viewAt(toPicture(base, middleOf(before)), middleOf(area), base.k));
  };

  function tick(now: number): void {
    frame = 0;
    if (disposed) return;
    // The pixels of the screen change with no event when a window goes to a different screen.
    if (setSize()) fitAgain();
    if (!sized) return;
    const seconds = lastTime === 0 ? 1 / 60 : Math.min((now - lastTime) / 1000, 0.1);
    let active = false;
    if (move !== undefined) {
      const step = pictureMoveAt(move, now);
      view = step.view;
      if (step.done) move = undefined;
      active = !step.done;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const shown = highlights;
    const drawing = content.draw(context, { view, width, height, area, pixelRatio, seconds, settle: settle || lessMotion() }, theme, (record) => highlightOf(shown, record));
    settle = false;
    active = drawing || active;
    lastTime = active ? now : 0;
    if (told === undefined || !sameView(told, view)) {
      told = view;
      options.onView?.(view);
    }
    if (active) invalidate();
  }

  /** This function gives the position of a pointer in the picture, in CSS pixels from its top left corner. */
  const positionOf = (event: { readonly clientX: number; readonly clientY: number }): Point => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const pickAt = (screen: Point, slack: number): PicturePick<P> | undefined => content.pick({ point: toPicture(view, screen), screen, view, slack });

  const setHover = (pick: PicturePick<P> | undefined): void => {
    const record = pick?.record;
    if (record === highlights.hovered) return;
    highlights = { ...highlights, hovered: record };
    setCursor();
    invalidate();
    options.onHover?.(pick?.value);
  };

  const listeners = new AbortController();
  const signal = listeners.signal;
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      inUse = true;
      canvas.focus({ preventScroll: true });
      try {
        // With the capture, a drag continues when the pointer goes out of the canvas.
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that the browser does not know has no capture. The drag then ends at the edge of the canvas.
      }
      if (move !== undefined) {
        // A pointer stops a move, as a hand stops a thing that moves.
        move = undefined;
        moved = true;
      }
      pointers = pointerDown(pointers, event.pointerId, positionOf(event));
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (pointers.at.has(event.pointerId)) {
        const next = pointerMove(pointers, event.pointerId, positionOf(event), view, limits);
        pointers = next.pointers;
        if (sameView(next.view, view)) return;
        dragging = true;
        setCursor();
        steer(next.view);
        return;
      }
      // A finger is on the picture only while it is down, so it has no record below it before a click.
      if (event.pointerType !== "touch" && pointers.at.size === 0) setHover(pickAt(positionOf(event), PICK_SLACK));
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!pointers.at.has(event.pointerId)) return;
      const mouse = event.pointerType === "mouse";
      const position = positionOf(event);
      const up = pointerUp(pointers, event.pointerId, position, mouse ? CLICK_DISTANCE : TOUCH_CLICK_DISTANCE);
      pointers = up.pointers;
      if (pointers.at.size === 0) {
        dragging = false;
        setCursor();
      }
      if (!up.click) return;
      const pick = pickAt(position, mouse ? PICK_SLACK : TOUCH_PICK_SLACK);
      highlights = { ...highlights, selected: pick?.record };
      invalidate();
      options.onSelect?.(pick?.value);
    },
    { signal },
  );
  canvas.addEventListener(
    "pointercancel",
    (event) => {
      pointers = pointerCancel(pointers, event.pointerId);
      if (pointers.at.size > 0) return;
      dragging = false;
      setCursor();
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    (event) => {
      setHover(undefined);
      if (event.pointerType === "mouse") inUse = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "blur",
    () => {
      inUse = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      // A browser gives a pinch on a touch pad as a wheel with the key `Control`. Without the stage, it changes the zoom of the page.
      if (wheel === "in-use" && !inUse && !event.ctrlKey) return;
      event.preventDefault();
      steer(zoomView(view, positionOf(event), wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), limits));
    },
    { signal, passive: false },
  );
  canvas.addEventListener(
    "dblclick",
    (event) => {
      event.preventDefault();
      moved = true;
      glide(keepRect(zoomView(view, positionOf(event), DOUBLE_CLICK_ZOOM, limits), content.bounds, area), true);
    },
    { signal },
  );
  canvas.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const action = pictureKeyAction(event.key, view, area, { home, views: options.keys, limits });
      if (action === undefined) return;
      event.preventDefault();
      inUse = true;
      if (action.type === "view") goTo(action.view, true);
      else steer(action.to);
    },
    { signal },
  );

  const observer = new ResizeObserver(() => {
    if (!disposed && setSize()) fitAgain();
  });

  if (setSize()) fitAgain();
  observer.observe(container);
  invalidate();

  return {
    canvas,
    setContent(next: PictureContent<P, T>): void {
      if (disposed || next === content) return;
      content.dispose?.();
      content = next;
      const selected = highlights.selected !== undefined && content.has(highlights.selected) ? highlights.selected : undefined;
      highlights = { ...highlights, hovered: undefined, selected };
      settle = true;
      setCursor();
      setArea();
      if (moved) hold(move?.to ?? view);
      else goTo(aim, false);
    },
    setTheme(next: T): void {
      theme = next;
      invalidate();
    },
    setView(next: string | PictureAim, animate: boolean = true): void {
      goTo(next, animate);
    },
    setInsets(next: Partial<Insets>): void {
      insets = next;
      setArea();
      if (!sized) return;
      if (moved) hold(move?.to ?? view);
      else goTo(aim, true);
    },
    view: () => view,
    area: () => area,
    zoomBy(factor: number, animate: boolean = true): void {
      moved = true;
      // A second step of a button starts from the goal of the first step, so each step has its full factor.
      glide(keepRect(zoomView(move?.to ?? view, middleOf(area), factor, limits), content.bounds, area), animate);
    },
    highlight(records: readonly string[]): void {
      highlights = { ...highlights, highlighted: new Set(records) };
      invalidate();
    },
    select(record: string | undefined): void {
      highlights = { ...highlights, selected: record };
      invalidate();
    },
    refresh: invalidate,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      listeners.abort();
      content.dispose?.();
      canvas.remove();
    },
  };
}
