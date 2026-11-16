import { DirectionalLight, HemisphereLight, PerspectiveCamera, Raycaster, Scene as World, Vector2, WebGLRenderer, type Object3D } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { nearDepth, stageLimits, surfaceOf, type StageExtent, type StageLimits, type StageView, type ViewFrame } from "../extent.ts";
import { keyAction } from "../keys.ts";
import { isClick, highlightOf, NO_HIGHLIGHTS, type Highlight, type Highlights } from "../highlight.ts";
import { moveAt, type Move } from "../motion.ts";
import type { StageTheme } from "../theme.ts";
import { cameraPosition, clampPlace, FIELD_OF_VIEW, speedAt, turnAcross, viewOf, type Place } from "../view.ts";

export { FIELD_OF_VIEW };

/** The record under the pointer: its name, and the value that the content gives for it. */
export interface StagePick<P> {
  /** The name of the record. The highlights of the stage use this name. */
  readonly record: string;
  /** The value of the record for the page, for example its kind and its source. */
  readonly value: P;
}

/** One picture of a stage, for the step of its content. */
export interface StageFrame {
  readonly camera: PerspectiveCamera;
  /** The time since the last picture, in seconds. */
  readonly seconds: number;
  /**
   * This value is true for the first picture of a content, and for a person who asks for less motion.
   * Each change then has no time: the content sets each value to its goal immediately.
   */
  readonly settle: boolean;
  /** The height of the picture, in CSS pixels. */
  readonly height: number;
  /** The vertical angle of the picture, in degrees. */
  readonly fieldOfView: number;
}

/**
 * The content of a stage: the three.js objects of one scene, and what the stage asks of them.
 * `P` is the type of the value of a pick, and `T` is the type of the theme.
 */
export interface StageContent<P, T extends StageTheme = StageTheme> {
  /** The three.js objects of the content. The stage adds them to its world, and removes them. */
  readonly objects: readonly Object3D[];
  /** The space that the content fills. */
  readonly extent: StageExtent;
  /** This function tells if the content has a record with a name. */
  has(record: string): boolean;
  /** This function gives the record that a ray from the camera finds first, or `undefined` for no record. */
  pick(ray: Raycaster): StagePick<P> | undefined;
  /** This function gives each part its colors, from the theme and the highlight of its record. */
  paint(theme: T, highlight: (record: string) => Highlight): void;
  /**
   * This function changes the parts that depend on the camera or on the time, before each picture.
   * It gives true while a part continues to change. The stage then makes the next picture.
   */
  step?(frame: StageFrame): boolean;
  /** This function releases the memory of the graphics card that the content uses. */
  dispose(): void;
}

/** The lights of a stage. A content with materials that use no light ignores them. */
export interface StageLights {
  /** The strength of the light from above and below. */
  readonly sky: number;
  /** The strength of the light from one direction. */
  readonly sun: number;
  /** The position that the light from one direction comes from. */
  readonly from: { readonly x: number; readonly y: number; readonly z: number };
}

/** The options of a stage. */
export interface StageOptions<P, T extends StageTheme = StageTheme> {
  /** The first content. The stage disposes each content that it gets. */
  readonly content: StageContent<P, T>;
  readonly theme: T;
  /** The name of the picture for a screen reader. */
  readonly label: string;
  /** The views of the stage, each with a name. */
  readonly views: Readonly<Record<string, StageView>>;
  /** The name of the first view. The keys `Home` and `0` show it. */
  readonly home: string;
  /** The name of the view of a key, for example `{ t: "top" }`. A letter has no case. */
  readonly keys?: Readonly<Record<string, string>> | undefined;
  /** The vertical angle of the picture, in degrees. A small angle gives the look of a drawing. The default is 32. */
  readonly fieldOfView?: number | undefined;
  /** The smallest and the largest polar angle of the camera, in radians. The default keeps the camera above the plane of the target. */
  readonly polar?: { readonly min?: number | undefined; readonly max?: number | undefined } | undefined;
  /** This value is true if a person can move the target with a drag of the second button. The default is true. */
  readonly pan?: boolean | undefined;
  readonly lights?: StageLights | undefined;
  /** The stage starts this function when the pointer goes to a different record, or to no record. */
  readonly onHover?: ((pick: P | undefined) => void) | undefined;
  /** The stage starts this function when a person selects a record with the pointer, or selects no record. */
  readonly onSelect?: ((pick: P | undefined) => void) | undefined;
}

/** A stage in a page: one canvas with a camera that a person moves, and one content. */
export interface Stage<P, T extends StageTheme = StageTheme> {
  /** The canvas of the stage. It is in the container. */
  readonly canvas: HTMLCanvasElement;
  /** This function shows a different content, and disposes the old content. The view stays if a person moved it. */
  setContent(content: StageContent<P, T>): void;
  /** This function changes the colors. */
  setTheme(theme: T): void;
  /** This function moves the camera to a view: a name of the options, or a view function. `animate` has the default true. */
  setView(view: string | StageView, animate?: boolean): void;
  /** This function gives the place of the camera. */
  place(): Place;
  /** This function highlights records by their names, as the pointer does. An empty list removes the highlights. */
  highlight(records: readonly string[]): void;
  /** This function selects one record by its name, or no record. It does not start `onSelect`. */
  select(record: string | undefined): void;
  /** This function paints the content again and makes a new picture. Use it after a change of the content. */
  refresh(): void;
  /** This function removes the canvas and releases the memory of the graphics card. It disposes the content. */
  dispose(): void;
}

/** The default lights: a strong light from above and below, and a light from the front left. */
export const STAGE_LIGHTS: StageLights = { sky: 2.2, sun: 1.5, from: { x: -10, y: 24, z: 15 } };

/** The time of the move between two views, in milliseconds. */
const MOVE_TIME = 380;

/**
 * The largest turn of the camera for a drag across the height of the picture, as a part of a full turn.
 * A camera far from a ball, or with no ball, turns by this part.
 */
const TURN_SPEED = 0.9;

/** The smallest polar angle. At 0, the azimuth of a camera has no meaning. */
const SMALLEST_POLAR = 0.0005;

/** The default largest polar angle: the camera stays above the plane of the target. */
const LARGEST_POLAR = Math.PI / 2 - 0.05;

/** This function tells if the person asks for less motion. */
function lessMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * This function makes a stage in a container of a page. The stage fills the container, so give the container a size.
 *
 * A person turns the content with a drag, and moves nearer with the wheel after a click in the picture.
 * A click selects the record under the pointer. With the keyboard, the arrow keys turn the content, `+` and `-` change the distance,
 * and `Home` shows the first view. The stage makes a picture only after a change.
 *
 * The function gives `undefined` when the browser has no WebGL 2. It does not throw, and it writes no error to the console.
 * The page then shows a different picture of the same data.
 */
export function createStage<P, T extends StageTheme = StageTheme>(container: HTMLElement, options: StageOptions<P, T>): Stage<P, T> | undefined {
  const canvas = container.ownerDocument.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: "default" });
  if (context === null) return undefined;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch {
    return undefined;
  }
  renderer.setClearColor(0x000000, 0);

  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", options.label);
  container.append(canvas);

  const fieldOfView = options.fieldOfView ?? FIELD_OF_VIEW;
  const polar = { min: options.polar?.min ?? SMALLEST_POLAR, max: options.polar?.max ?? LARGEST_POLAR };
  const lights = options.lights ?? STAGE_LIGHTS;
  const world = new World();
  const sky = new HemisphereLight("#ffffff", "#ffffff", lights.sky);
  const sun = new DirectionalLight("#ffffff", lights.sun);
  sun.position.set(lights.from.x, lights.from.y, lights.from.z);
  world.add(sky, sun);
  const camera = new PerspectiveCamera(fieldOfView, 1, 0.05, 1000);

  let content = options.content;
  let theme = options.theme;
  for (const object of content.objects) world.add(object);

  let highlights: Highlights = NO_HIGHLIGHTS;
  let view: string | StageView = options.home;
  let move: Move | undefined;
  /** This value is true after a person moved the view. Then a new size of the container does not move the camera. */
  let moved = false;
  /** This value is true until the content had a step with no time. */
  let settle = true;
  /** The height of the picture, in CSS pixels. */
  let height = 1;
  let frame = 0;
  let lastTime = 0;
  let disposed = false;

  const invalidate = (): void => {
    if (frame === 0 && !disposed) frame = requestAnimationFrame(tick);
  };

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !lessMotion();
  controls.dampingFactor = 0.14;
  controls.minPolarAngle = polar.min;
  controls.maxPolarAngle = polar.max;
  controls.rotateSpeed = TURN_SPEED;
  controls.screenSpacePanning = true;
  controls.enablePan = options.pan ?? true;
  // The wheel moves the page until a person uses the picture. Thus the picture does not stop a person who reads down the page.
  controls.enableZoom = false;

  const viewFrame = (): ViewFrame => ({ extent: content.extent, fieldOfView, aspect: camera.aspect });
  let limits: StageLimits = stageLimits(viewFrame(), Object.values(options.views), polar);

  const paint = (): void => {
    const now = highlights;
    content.paint(theme, (record) => highlightOf(now, record));
    invalidate();
  };

  /**
   * This function sets the turn speed and the zoom speed from the height of the camera above the surface.
   * The surface of a ball at the middle of the picture follows the pointer in a drag.
   */
  const setSpeed = (): void => {
    const distance = camera.position.distanceTo(controls.target);
    const surface = surfaceOf(content.extent);
    // The controls turn the camera by a full turn times the speed for a drag across the height of the picture.
    controls.rotateSpeed = Math.min(TURN_SPEED, turnAcross(distance, surface, fieldOfView) / (2 * Math.PI));
    controls.zoomSpeed = speedAt(distance, surface);
  };
  const placeNow = (): Place => {
    const target = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
    return { target, ...viewOf(camera.position, target) };
  };
  const put = (to: Place): void => {
    const next = clampPlace(to, limits);
    const eye = cameraPosition(next.target, next, next.distance);
    controls.target.set(next.target.x, next.target.y, next.target.z);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(controls.target);
    setSpeed();
  };
  /** This function gives the view function of a view, or `undefined` for a name that the options do not have. */
  const viewFunction = (of: string | StageView): StageView | undefined => (typeof of === "string" ? options.views[of] : of);

  /**
   * This function sets the nearest depth that the camera draws, from the distance of the camera to the content.
   * A camera far from the content then has small steps of depth at the content, so a layer near a surface stays above it.
   */
  const setDepth = (): void => {
    const { center } = content.extent;
    const distance = Math.hypot(camera.position.x - center.x, camera.position.y - center.y, camera.position.z - center.z);
    const near = nearDepth(limits, content.extent, distance);
    if (near === camera.near && limits.far === camera.far) return;
    camera.near = near;
    camera.far = limits.far;
    camera.updateProjectionMatrix();
  };
  /** This function sets the limits of the camera from the content and the shape of the picture. */
  const setLimits = (): void => {
    limits = stageLimits(viewFrame(), Object.values(options.views), polar);
    controls.minDistance = limits.minDistance;
    controls.maxDistance = limits.maxDistance;
    setDepth();
  };
  /**
   * This function stops the turn that continues after a drag. The camera stays where it is.
   * Without it, the camera continues to turn after a move to a view, and the view is not exact.
   */
  const stopDrift = (): void => {
    if (!controls.enableDamping) return;
    const now = placeNow();
    // With no damping, an update of the controls uses all of the turn that remains. The camera then goes back.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    put(now);
  };
  const goTo = (next: string | StageView, animate: boolean): void => {
    const found = viewFunction(next);
    if (found === undefined) return;
    view = next;
    moved = false;
    stopDrift();
    const to = found(viewFrame());
    if (animate && !lessMotion()) {
      move = { from: placeNow(), to, start: performance.now(), duration: MOVE_TIME };
    } else {
      move = undefined;
      put(to);
    }
    invalidate();
  };

  /** This function sets the size of the picture from the size of the container. It gives false for a container with no size. */
  const setSize = (): boolean => {
    const width = container.clientWidth;
    const tall = container.clientHeight;
    if (width === 0 || tall === 0) return false;
    height = tall;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    renderer.setSize(width, tall, false);
    camera.aspect = width / tall;
    camera.updateProjectionMatrix();
    return true;
  };

  /** This function moves the camera one step of a move between two views. It gives true while the move continues. */
  const stepMove = (now: number): boolean => {
    if (move === undefined) return false;
    const step = moveAt(move, now, surfaceOf(content.extent));
    put(step.place);
    if (step.done) move = undefined;
    return true;
  };

  function tick(now: number): void {
    frame = 0;
    if (disposed) return;
    const seconds = lastTime === 0 ? 1 / 60 : Math.min((now - lastTime) / 1000, 0.1);
    let active = stepMove(now);
    setSpeed();
    active = controls.update() || active;
    setDepth();
    const stepped = content.step?.({ camera, seconds, settle: settle || lessMotion(), height, fieldOfView }) ?? false;
    settle = false;
    renderer.render(world, camera);
    active = stepped || active;
    lastTime = active ? now : 0;
    if (active) invalidate();
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  /** This function gives the record under a pointer. */
  const pickAt = (event: PointerEvent): StagePick<P> | undefined => {
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return undefined;
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, 1 - ((event.clientY - box.top) / box.height) * 2);
    raycaster.setFromCamera(pointer, camera);
    return content.pick(raycaster);
  };

  const setHover = (pick: StagePick<P> | undefined): void => {
    const record = pick?.record;
    if (record === highlights.hovered) return;
    highlights = { ...highlights, hovered: record };
    canvas.style.cursor = record === undefined ? "grab" : "pointer";
    paint();
    options.onHover?.(pick?.value);
  };

  const listeners = new AbortController();
  const signal = listeners.signal;
  let down: { readonly id: number; readonly x: number; readonly y: number } | undefined;
  const setInUse = (inUse: boolean): void => {
    controls.enableZoom = inUse;
  };
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      setInUse(true);
      canvas.focus({ preventScroll: true });
      down = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (event.buttons === 0 && event.pointerType !== "touch") setHover(pickAt(event));
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      const start = down;
      down = undefined;
      if (start === undefined || start.id !== event.pointerId) return;
      if (!isClick(start, { x: event.clientX, y: event.clientY })) return;
      const pick = pickAt(event);
      highlights = { ...highlights, selected: pick?.record };
      paint();
      options.onSelect?.(pick?.value);
    },
    { signal },
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      down = undefined;
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    (event) => {
      setHover(undefined);
      if (event.pointerType === "mouse") setInUse(false);
    },
    { signal },
  );
  canvas.addEventListener("blur", () => setInUse(false), { signal });
  canvas.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const action = keyAction(event.key, placeNow(), { home: options.home, views: options.keys, surface: surfaceOf(content.extent), fieldOfView });
      if (action === undefined) return;
      event.preventDefault();
      setInUse(true);
      if (action.type === "view") {
        goTo(action.view, true);
        return;
      }
      moved = true;
      move = undefined;
      stopDrift();
      put(action.place);
      invalidate();
    },
    { signal },
  );
  canvas.addEventListener("webglcontextlost", (event) => event.preventDefault(), { signal });
  canvas.addEventListener("webglcontextrestored", invalidate, { signal });

  controls.addEventListener("start", () => {
    moved = true;
    move = undefined;
    canvas.style.cursor = "grabbing";
    invalidate();
  });
  controls.addEventListener("end", () => {
    canvas.style.cursor = highlights.hovered === undefined ? "grab" : "pointer";
  });
  controls.addEventListener("change", invalidate);

  const applyTheme = (): void => {
    sky.color.set(theme.sky);
    sky.groundColor.set(theme.ground);
    paint();
  };

  const observer = new ResizeObserver(() => {
    if (disposed || !setSize()) return;
    setLimits();
    if (!moved) goTo(view, false);
    invalidate();
  });

  setSize();
  setLimits();
  goTo(options.home, false);
  applyTheme();
  observer.observe(container);

  return {
    canvas,
    setContent(next: StageContent<P, T>): void {
      if (disposed || next === content) return;
      for (const object of content.objects) world.remove(object);
      content.dispose();
      content = next;
      for (const object of content.objects) world.add(object);
      const selected = highlights.selected !== undefined && content.has(highlights.selected) ? highlights.selected : undefined;
      highlights = { ...highlights, hovered: undefined, selected };
      settle = true;
      setLimits();
      if (!moved) goTo(view, false);
      paint();
    },
    setTheme(next: T): void {
      theme = next;
      applyTheme();
    },
    setView(next: string | StageView, animate: boolean = true): void {
      goTo(next, animate);
    },
    place: placeNow,
    highlight(records: readonly string[]): void {
      highlights = { ...highlights, highlighted: new Set(records) };
      paint();
    },
    select(record: string | undefined): void {
      highlights = { ...highlights, selected: record };
      paint();
    },
    refresh: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      listeners.abort();
      controls.dispose();
      for (const object of content.objects) world.remove(object);
      content.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
