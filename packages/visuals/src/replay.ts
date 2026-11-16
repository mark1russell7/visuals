/**
 * A range of time, with its two ends. Each time of this file is a number in one unit that the page chooses, for example milliseconds.
 * A range is also a lifetime that has an end.
 */
export interface TimeSpan {
  readonly from: number;
  /** The end of the range. It is not before `from`. */
  readonly to: number;
}

/** The time in which a part of a content is in the picture. */
export interface Lifetime {
  /** The first time of the part. */
  readonly from: number;
  /** The first time after the part. A part with no `to` has no end. */
  readonly to?: number | undefined;
}

/** This function tells if a part is in the picture at a time. A part is in the picture at `from`, and it is not in the picture at `to`. */
export function isLive(life: Lifetime, at: number): boolean {
  return life.from <= at && (life.to === undefined || at < life.to);
}

/**
 * This function gives the times at which a picture changes: each start and each end of a lifetime.
 * The result has each time once, from the first time to the last time. A time that is not finite is not in the result.
 */
export function changeTimes(lives: Iterable<Lifetime>): readonly number[] {
  const times = new Set<number>();
  for (const life of lives) {
    if (Number.isFinite(life.from)) times.add(life.from);
    if (life.to !== undefined && Number.isFinite(life.to)) times.add(life.to);
  }
  return [...times].sort((a, b) => a - b);
}

/** This function gives the range from the first change to the last change of a sorted list of times. A list with no time gives `undefined`. */
export function spanOfTimes(times: readonly number[]): TimeSpan | undefined {
  const from = times[0];
  const to = times[times.length - 1];
  return from === undefined || to === undefined ? undefined : { from, to };
}

/** This function gives the first time after `at` in a sorted list of times, or `undefined` when no time is after it. */
export function changeAfter(times: readonly number[], at: number): number | undefined {
  return times.find((time) => time > at);
}

/** This function gives the last time before `at` in a sorted list of times, or `undefined` when no time is before it. */
export function changeBefore(times: readonly number[], at: number): number | undefined {
  return times.findLast((time) => time < at);
}

/**
 * This function gives the count of the times of a sorted list that are not after `at`.
 * The picture of two times with the same count is the same picture, so a page draws again only after a new count.
 */
export function changeIndex(times: readonly number[], at: number): number {
  return times.findLastIndex((time) => time <= at) + 1;
}

/** This function gives the place of a time in a range, from 0 at the start to 1 at the end. A range with no length gives 0. */
export function spanPart(span: TimeSpan, at: number): number {
  const length = span.to - span.from;
  return length > 0 ? Math.min(Math.max((at - span.from) / length, 0), 1) : 0;
}

/** This function gives the time at a place of a range. `part` goes from 0 at the start to 1 at the end. */
export function spanTime(span: TimeSpan, part: number): number {
  return span.from + (span.to - span.from) * Math.min(Math.max(part, 0), 1);
}

/** The state of a replay: a control shows the picture of one time of a range, and it can go through the range. */
export interface Replay {
  readonly span: TimeSpan;
  /** The time of the picture. It is in the range. */
  readonly at: number;
  /** This value is true while the time goes forward. */
  readonly playing: boolean;
  /** The speed, as a factor. A replay with the speed 1 goes through the range in the duration that `replayAdvance` gets. */
  readonly speed: number;
}

/** The time in which a replay with the speed 1 goes through its range, in milliseconds. */
export const REPLAY_DURATION = 20_000;

/** The speeds of a replay that a control offers, from the slowest to the fastest. */
export const REPLAY_SPEEDS: readonly number[] = [0.5, 1, 2, 4];

/** The part of a range that the keys `PageUp` and `PageDown` go. */
export const REPLAY_PAGE = 0.1;

/** The part of a range that an arrow key goes when the replay has no times of change. */
export const REPLAY_STEP = 0.01;

/**
 * This function gives a replay that does not go. With no time, the picture is at the end of the range.
 * The end of a range is the present for a content that shows live data.
 */
export function replayOf(span: TimeSpan, at: number = span.to): Replay {
  return { span, at: Math.min(Math.max(at, span.from), span.to), playing: false, speed: 1 };
}

/** This function puts the picture of a replay at a time. A time out of the range becomes the nearest end of the range. */
export function replaySeek(replay: Replay, at: number): Replay {
  const next = Math.min(Math.max(at, replay.span.from), replay.span.to);
  return next === replay.at ? replay : { ...replay, at: next };
}

/** This function starts a replay. A replay at the end of its range starts again from the start of the range. */
export function replayPlay(replay: Replay): Replay {
  if (replay.playing || !(replay.span.to > replay.span.from)) return replay;
  return { ...replay, at: replay.at >= replay.span.to ? replay.span.from : replay.at, playing: true };
}

/** This function stops a replay at its time. */
export function replayPause(replay: Replay): Replay {
  return replay.playing ? { ...replay, playing: false } : replay;
}

/** This function starts a replay that does not go, and it stops a replay that goes. */
export function replayToggle(replay: Replay): Replay {
  return replay.playing ? replayPause(replay) : replayPlay(replay);
}

/**
 * This function moves a replay that goes by a time of the clock. `elapsed` and `duration` are in milliseconds.
 * The replay stops at the end of its range. A replay that does not go stays the same value.
 */
export function replayAdvance(replay: Replay, elapsed: number, duration: number = REPLAY_DURATION): Replay {
  if (!replay.playing || !(elapsed > 0)) return replay;
  const length = replay.span.to - replay.span.from;
  const next = duration > 0 ? replay.at + (elapsed / duration) * length * replay.speed : replay.span.to;
  return next >= replay.span.to ? { ...replay, at: replay.span.to, playing: false } : { ...replay, at: next };
}

/**
 * This function gives a replay with the next speed of a list. After the last speed comes the first speed.
 * A speed that is not in the list gets the first speed that is higher, or the first speed of the list.
 */
export function replayNextSpeed(replay: Replay, speeds: readonly number[] = REPLAY_SPEEDS): Replay {
  const next = speeds.find((speed) => speed > replay.speed) ?? speeds[0];
  return next === undefined || next === replay.speed ? replay : { ...replay, speed: next };
}

/**
 * This function gives a replay a new range, for example after new data. A replay at the end of the old range stays at the end.
 * Thus a picture of the present stays the picture of the present. A different time stays the same, in the new range.
 */
export function replaySpan(replay: Replay, span: TimeSpan): Replay {
  const atEnd = replay.at >= replay.span.to;
  const at = atEnd ? span.to : Math.min(Math.max(replay.at, span.from), span.to);
  return { ...replay, span, at, playing: replay.playing && span.to > span.from };
}

/**
 * This function gives the replay after a key of a slider, or `undefined` for a key with no action.
 *
 * The keys `ArrowRight` and `ArrowUp` go to the next change of `times`, and `ArrowLeft` and `ArrowDown` go to the change before.
 * The keys `PageUp` and `PageDown` go a tenth of the range. The keys `Home` and `End` go to the ends.
 * Each of these keys stops a replay that goes, because the person sets the time.
 * The key Space starts a replay that does not go, and it stops a replay that goes.
 */
export function replayKey(key: string, replay: Replay, times: readonly number[] = []): Replay | undefined {
  const { span } = replay;
  const length = span.to - span.from;
  const to = (at: number): Replay => replaySeek(replayPause(replay), at);
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return to(times.length > 0 ? (changeAfter(times, replay.at) ?? span.to) : replay.at + length * REPLAY_STEP);
    case "ArrowLeft":
    case "ArrowDown":
      return to(times.length > 0 ? (changeBefore(times, replay.at) ?? span.from) : replay.at - length * REPLAY_STEP);
    case "PageUp":
      return to(replay.at + length * REPLAY_PAGE);
    case "PageDown":
      return to(replay.at - length * REPLAY_PAGE);
    case "Home":
      return to(span.from);
    case "End":
      return to(span.to);
    case " ":
      return replayToggle(replay);
    default:
      return undefined;
  }
}
