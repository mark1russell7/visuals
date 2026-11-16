import { REPLAY_DURATION, REPLAY_SPEEDS, replayAdvance, replayKey, replayNextSpeed, replayPause, replaySeek, replayToggle, spanPart, spanTime, type Replay } from "../replay.ts";
import { TICK_BOX, labelPlaces, tickPath, tickPlaces, type ScrubberLabel } from "./ticks.ts";

/** The words of a scrubber. A page in a different language gives its own words. */
export interface ScrubberWords {
  /** The name of the button that starts the replay. */
  readonly play: string;
  /** The name of the button that stops the replay. */
  readonly pause: string;
  /** The text on the button of the speed, for example "2×". */
  readonly speed: (speed: number) => string;
  /** The name of the button of the speed for a person who does not see it. */
  readonly speedName: (speed: number) => string;
}

/** The English words of a scrubber. */
export const SCRUBBER_WORDS: ScrubberWords = {
  play: "Play",
  pause: "Pause",
  speed: (speed) => `${String(speed)}×`,
  speedName: (speed) => `Change the speed. The speed is ${String(speed)}.`,
};

/** The options of a scrubber. */
export interface ScrubberOptions {
  /** The name of the control for a person who does not see it, for example "The time of the map". */
  readonly label: string;
  /** The first state: the range, the time of the picture and the speed. */
  readonly replay: Replay;
  /** This function gives the text of a time, for example "14:05" or "Now". The control shows it, and a screen reader says it. */
  readonly format: (at: number, replay: Replay) => string;
  /** This function starts after each change that a person or the replay makes. Draw the picture of `replay.at` in it. */
  readonly onChange: (replay: Replay) => void;
  /** The sorted times at which the picture changes. The control shows a tick at each time, and the arrow keys go to them. */
  readonly times?: readonly number[] | undefined;
  /** The labels of the axis. */
  readonly labels?: readonly ScrubberLabel[] | undefined;
  /** The time in which a replay with the speed 1 goes through the range, in milliseconds. The default is `REPLAY_DURATION`. */
  readonly duration?: number | undefined;
  /** The speeds that the button of the speed goes through. The default is `REPLAY_SPEEDS`. */
  readonly speeds?: readonly number[] | undefined;
  /** The words of the control. The default is `SCRUBBER_WORDS`. */
  readonly words?: Partial<ScrubberWords> | undefined;
}

/** A scrubber: a control with which a person sets the time of a picture, and replays how the picture changes. */
export interface Scrubber {
  /** The element of the control. It is in the container. */
  readonly element: HTMLElement;
  /** This function gives the state. */
  replay(): Replay;
  /** This function sets the state from the page, for example a new range after new data. It does not start `onChange`. */
  setReplay(replay: Replay): void;
  /** This function sets the times at which the picture changes. */
  setTimes(times: readonly number[]): void;
  /** This function sets the labels of the axis. */
  setLabels(labels: readonly ScrubberLabel[]): void;
  /** This function stops the replay and removes the control from the page. */
  dispose(): void;
}

/**
 * The longest time of one step of a replay, in milliseconds.
 * A browser makes no picture for a page that is not in view. With this limit, the replay continues from its time when the page comes back.
 */
export const FRAME_LIMIT = 250;

const SVG = "http://www.w3.org/2000/svg";

/** The outlines of the signs of the first button, in a box of 16 units. */
const PLAY_SIGN = "M5 2.5v11l9-5.5z";
const PAUSE_SIGN = "M3.5 2.5h3.25v11H3.5zM9.25 2.5h3.25v11H9.25z";

/** The height of the picture of the ticks, in the units of its `viewBox`. One unit is one sixteenth of the font size of the page. */
const TICK_HEIGHT = 28;

/** The height of the line of the axis in the picture. The ticks of the changes are above it, and the ticks of the labels are below it. */
const AXIS = 20;

/** The height of the top of a tick of a change in the picture. */
const TICK_TOP = 6;

/** The height of the bottom of a tick of a label in the picture. */
const STEP_BOTTOM = 26;

/**
 * This function makes a scrubber in a container of a page. The style sheet `@mark1russell7/visuals/scrubber.css` draws it.
 *
 * The control has a button for the replay, the text of the time, a slider on an axis and a button for the speed.
 * The slider is an `input` of the type `range`, so a pointer, a touch screen, a keyboard and a screen reader use it.
 * The arrow keys go from one change to the next change. The key Space starts and stops the replay.
 * The control knows nothing about the picture: `onChange` gets each new state.
 */
export function createScrubber(container: HTMLElement, options: ScrubberOptions): Scrubber {
  const page = container.ownerDocument;
  const view = page.defaultView;
  const words: ScrubberWords = { ...SCRUBBER_WORDS, ...options.words };
  const duration = options.duration ?? REPLAY_DURATION;
  const speeds = options.speeds ?? REPLAY_SPEEDS;
  let state = options.replay;
  let times = options.times ?? [];
  let labels = options.labels ?? [];
  let frame = 0;
  let last = 0;
  let disposed = false;

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, name: string): HTMLElementTagNameMap[K] => {
    const element = page.createElement(tag);
    element.className = `visuals-scrubber-${name}`;
    return element;
  };
  const draw = (name: string, box: string): { readonly picture: SVGSVGElement; readonly path: (name: string) => SVGPathElement } => {
    const picture = page.createElementNS(SVG, "svg");
    picture.setAttribute("class", `visuals-scrubber-${name}`);
    picture.setAttribute("viewBox", box);
    picture.setAttribute("aria-hidden", "true");
    picture.setAttribute("focusable", "false");
    return {
      picture,
      path: (part) => {
        const path = page.createElementNS(SVG, "path");
        path.setAttribute("class", `visuals-scrubber-${part}`);
        picture.append(path);
        return path;
      },
    };
  };

  const element = page.createElement("div");
  element.className = "visuals-scrubber";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", options.label);
  const row = make("div", "row");

  const play = make("button", "play");
  play.type = "button";
  const sign = draw("sign", "0 0 16 16");
  const signPath = sign.path("sign-shape");
  play.append(sign.picture);

  const time = make("span", "time");

  const rule = make("div", "rule");
  // The axis has two pictures with the same lines: the time to come, and above it the time that passed.
  // The style sheet cuts the second picture at the time of the handle.
  const box = `0 0 ${String(TICK_BOX)} ${String(TICK_HEIGHT)}`;
  const ticks = draw("ticks", box);
  ticks.picture.setAttribute("preserveAspectRatio", "none");
  const ahead = ticks.path("ahead");
  const steps = ticks.path("steps");
  const passed = draw("ticks", box);
  passed.picture.classList.add("visuals-scrubber-passed");
  passed.picture.setAttribute("preserveAspectRatio", "none");
  const past = passed.path("past");
  const range = make("input", "range");
  range.type = "range";
  range.min = "0";
  range.max = "1";
  range.step = "any";
  range.setAttribute("aria-label", options.label);
  const head = make("span", "head");
  head.setAttribute("aria-hidden", "true");
  const axis = make("div", "labels");
  axis.setAttribute("aria-hidden", "true");
  rule.append(ticks.picture, passed.picture, range, head, axis);

  const speed = make("button", "speed");
  speed.type = "button";

  row.append(play, time, rule, speed);
  element.append(row);

  /** This function draws the ticks and the labels again, after a change of the range, of the times or of the labels. */
  function drawAxis(): void {
    const places = labelPlaces(state.span, labels);
    const line = `M0 ${String(AXIS)}H${String(TICK_BOX)}`;
    const changes = tickPath(tickPlaces(state.span, times), TICK_TOP, AXIS);
    ahead.setAttribute("d", line + changes);
    past.setAttribute("d", line + changes);
    steps.setAttribute("d", tickPath([...new Set([0, TICK_BOX, ...places.map((place) => Math.round(place.part * TICK_BOX * 10) / 10)])], AXIS, STEP_BOTTOM));
    axis.replaceChildren(
      ...places.map((place) => {
        const label = make("span", "label");
        label.dataset["align"] = place.align;
        label.style.setProperty("--scrubber-at", place.part.toFixed(5));
        label.textContent = place.text;
        return label;
      }),
    );
  }

  /** This function sets an attribute only when its value changes. A replay shows its state before each picture of the browser. */
  const set = (target: Element, name: string, value: string): void => {
    if (target.getAttribute(name) !== value) target.setAttribute(name, value);
  };
  const write = (target: Element, text: string): void => {
    if (target.textContent !== text) target.textContent = text;
  };

  /** This function shows the state in the control. */
  function show(): void {
    const part = spanPart(state.span, state.at);
    const text = options.format(state.at, state);
    const still = !(state.span.to > state.span.from);
    element.style.setProperty("--scrubber-part", part.toFixed(5));
    set(element, "data-playing", String(state.playing));
    if (Number(range.value) !== part) range.value = String(part);
    set(range, "aria-valuetext", text);
    range.disabled = still;
    write(time, text);
    play.disabled = still;
    set(play, "aria-label", state.playing ? words.pause : words.play);
    set(signPath, "d", state.playing ? PAUSE_SIGN : PLAY_SIGN);
    write(speed, words.speed(state.speed));
    set(speed, "aria-label", words.speedName(state.speed));
  }

  function step(now: number): void {
    frame = 0;
    const elapsed = Math.min(now - last, FRAME_LIMIT);
    last = now;
    change(replayAdvance(state, elapsed, duration), true);
  }

  /** This function asks for the next step of a replay that goes, and stops the steps of a replay that does not go. */
  function run(): void {
    if (view === null || disposed) return;
    if (state.playing && frame === 0) {
      frame = view.requestAnimationFrame(step);
    } else if (!state.playing && frame !== 0) {
      view.cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  /** This function sets a new state. `tell` is true for a change that the page did not make. */
  function change(next: Replay, tell: boolean): void {
    if (next === state) {
      run();
      return;
    }
    const newSpan = next.span !== state.span;
    if (next.playing && !state.playing && view !== null) last = view.performance.now();
    state = next;
    if (newSpan) drawAxis();
    show();
    run();
    if (tell) options.onChange(state);
  }

  const onPlay = (): void => {
    change(replayToggle(state), true);
  };
  const onSpeed = (): void => {
    change(replayNextSpeed(state, speeds), true);
  };
  const onInput = (): void => {
    // The person sets the time, so the replay stops.
    change(replaySeek(replayPause(state), spanTime(state.span, Number(range.value))), true);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = replayKey(event.key, state, times);
    if (next === undefined) return;
    event.preventDefault();
    change(next, true);
  };
  play.addEventListener("click", onPlay);
  speed.addEventListener("click", onSpeed);
  range.addEventListener("input", onInput);
  range.addEventListener("keydown", onKey);

  drawAxis();
  show();
  container.append(element);
  if (state.playing && view !== null) last = view.performance.now();
  run();

  return {
    element,
    replay: () => state,
    setReplay(replay): void {
      change(replay, false);
    },
    setTimes(next): void {
      times = next;
      drawAxis();
    },
    setLabels(next): void {
      labels = next;
      drawAxis();
    },
    dispose(): void {
      if (disposed) return;
      if (frame !== 0) view?.cancelAnimationFrame(frame);
      frame = 0;
      disposed = true;
      play.removeEventListener("click", onPlay);
      speed.removeEventListener("click", onSpeed);
      range.removeEventListener("input", onInput);
      range.removeEventListener("keydown", onKey);
      element.remove();
    },
  };
}
