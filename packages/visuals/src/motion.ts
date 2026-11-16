import { placeBetween, type Place } from "./view.ts";

/** A move of a camera from one place to a different place. */
export interface Move {
  readonly from: Place;
  readonly to: Place;
  /** The time of the start of the move, in milliseconds. */
  readonly start: number;
  /** The time that the move takes, in milliseconds. */
  readonly duration: number;
}

/** The place of a camera at one time of a move. */
export interface MoveStep {
  readonly place: Place;
  /** This value is true at the end of the move, and after it. */
  readonly done: boolean;
}

/**
 * This function gives a part of a move with a slow start and a slow end. `part` goes from 0 to 1.
 * The result goes from 0 to 1, and it is 0.5 at the middle.
 */
export function easeInOut(part: number): number {
  const clamped = Math.min(Math.max(part, 0), 1);
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/**
 * This function gives the place of a camera at the time `now` of a move, in milliseconds.
 * A move with no duration is at its end immediately. `surface` is the radius of the ball around the target, or 0 for no ball.
 */
export function moveAt(move: Move, now: number, surface: number = 0): MoveStep {
  const part = move.duration > 0 ? Math.min(Math.max((now - move.start) / move.duration, 0), 1) : 1;
  if (part >= 1) return { place: move.to, done: true };
  return { place: placeBetween(move.from, move.to, easeInOut(part), surface), done: false };
}

/**
 * This function moves a value one step to its goal. Each step goes a constant part of the way that remains.
 *
 * `seconds` is the time of the step, and `time` is the time in which the value goes most of the way, in seconds.
 * A step with no time gives the goal. A value nearer to the goal than `snap` becomes the goal, so the steps have an end.
 */
export function approach(value: number, goal: number, seconds: number, time: number, snap: number = 0.01): number {
  if (!(seconds > 0) || !(time > 0)) return goal;
  const next = value + (goal - value) * (1 - Math.exp(0 - seconds / time));
  return Math.abs(goal - next) < snap ? goal : next;
}
