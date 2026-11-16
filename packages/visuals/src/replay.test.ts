import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  REPLAY_DURATION,
  REPLAY_SPEEDS,
  changeAfter,
  changeBefore,
  changeIndex,
  changeTimes,
  isLive,
  replayAdvance,
  replayKey,
  replayNextSpeed,
  replayOf,
  replayPause,
  replayPlay,
  replaySeek,
  replaySpan,
  replayToggle,
  spanOfTimes,
  spanPart,
  spanTime,
  type Lifetime,
  type TimeSpan,
} from "./replay.ts";

const SPAN: TimeSpan = { from: 100, to: 300 };

/** A span with a length. */
const spans = fc
  .tuple(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.double({ min: 1e-3, max: 1e6, noNaN: true }))
  .map(([from, length]): TimeSpan => ({ from, to: from + length }));

describe("isLive", () => {
  it("has a part in the picture from its start to the time before its end", () => {
    const life: Lifetime = { from: 10, to: 20 };
    expect([9, 10, 15, 20, 21].map((at) => isLive(life, at))).toEqual([false, true, true, false, false]);
  });

  it("keeps a part with no end in the picture", () => {
    expect(isLive({ from: 10 }, 1e12)).toBe(true);
    expect(isLive({ from: 10 }, 9)).toBe(false);
  });

  it("shows one of two parts when the second part starts at the end of the first part", () => {
    const first: Lifetime = { from: 0, to: 5 };
    const second: Lifetime = { from: 5, to: 9 };
    for (const at of [0, 4.999, 5, 8]) expect([first, second].filter((life) => isLive(life, at)).length, String(at)).toBe(1);
  });
});

describe("changeTimes", () => {
  it("gives each start and each end once, in sequence", () => {
    expect(changeTimes([{ from: 30, to: 50 }, { from: 10 }, { from: 10, to: 30 }])).toEqual([10, 30, 50]);
    expect(changeTimes([])).toEqual([]);
  });

  it("leaves out a time that is not finite", () => {
    expect(changeTimes([{ from: Number.NEGATIVE_INFINITY, to: 5 }, { from: 1, to: Number.NaN }])).toEqual([1, 5]);
  });

  it("gives a sorted list with no time twice, and the picture does not change between two of its times", () => {
    const lives = fc.array(
      fc
        .tuple(fc.integer({ min: 0, max: 50 }), fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }))
        .map(([from, length]): Lifetime => ({ from, to: length === undefined ? undefined : from + length })),
    );
    fc.assert(
      fc.property(lives, (list) => {
        const times = changeTimes(list);
        expect([...times].sort((a, b) => a - b)).toEqual(times);
        expect(new Set(times).size).toBe(times.length);
        const shown = (at: number): string => list.map((life) => (isLive(life, at) ? "1" : "0")).join("");
        times.forEach((time, index) => {
          const next = times[index + 1];
          if (next !== undefined) expect(shown((time + next) / 2)).toBe(shown(time));
        });
      }),
    );
  });
});

describe("spanOfTimes", () => {
  it("gives the range from the first time to the last time", () => {
    expect(spanOfTimes([10, 30, 50])).toEqual({ from: 10, to: 50 });
    expect(spanOfTimes([7])).toEqual({ from: 7, to: 7 });
    expect(spanOfTimes([])).toBeUndefined();
  });
});

describe("changeAfter and changeBefore", () => {
  const times = [10, 30, 50];

  it("gives the nearest different time on each side", () => {
    expect(changeAfter(times, 30)).toBe(50);
    expect(changeAfter(times, 29)).toBe(30);
    expect(changeBefore(times, 30)).toBe(10);
    expect(changeBefore(times, 31)).toBe(30);
  });

  it("gives undefined after the last time and before the first time", () => {
    expect(changeAfter(times, 50)).toBeUndefined();
    expect(changeBefore(times, 10)).toBeUndefined();
    expect(changeAfter([], 0)).toBeUndefined();
  });
});

describe("changeIndex", () => {
  const times = [10, 30, 50];

  it("gives the count of the times that are not after a time", () => {
    expect([9, 10, 29, 30, 49, 50, 99].map((at) => changeIndex(times, at))).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(changeIndex([], 5)).toBe(0);
  });

  it("gives the same count for two times with the same picture", () => {
    const lives: readonly Lifetime[] = [{ from: 10, to: 30 }, { from: 30 }, { from: 20, to: 50 }];
    const all = changeTimes(lives);
    const shown = (at: number): string => lives.map((life) => (isLive(life, at) ? "1" : "0")).join("");
    fc.assert(
      fc.property(fc.double({ min: 0, max: 60, noNaN: true }), fc.double({ min: 0, max: 60, noNaN: true }), (a, b) => {
        if (changeIndex(all, a) === changeIndex(all, b)) expect(shown(a)).toBe(shown(b));
      }),
    );
  });
});

describe("spanPart and spanTime", () => {
  it("gives 0 at the start, 1 at the end, and the ends for a time out of the range", () => {
    expect([100, 200, 300, 50, 900].map((at) => spanPart(SPAN, at))).toEqual([0, 0.5, 1, 0, 1]);
    expect([0, 0.25, 1, -1, 2].map((part) => spanTime(SPAN, part))).toEqual([100, 150, 300, 100, 300]);
  });

  it("gives 0 for a range with no length", () => {
    expect(spanPart({ from: 5, to: 5 }, 5)).toBe(0);
    expect(spanTime({ from: 5, to: 5 }, 0.5)).toBe(5);
  });

  it("gives the same time after a conversion to a part and back", () => {
    fc.assert(
      fc.property(spans, fc.double({ min: 0, max: 1, noNaN: true }), (span, part) => {
        const at = spanTime(span, part);
        expect(spanTime(span, spanPart(span, at))).toBeCloseTo(at, 6);
        expect(at).toBeGreaterThanOrEqual(span.from);
        expect(at).toBeLessThanOrEqual(span.to);
      }),
    );
  });
});

describe("replayOf", () => {
  it("shows the end of the range, and it does not go", () => {
    expect(replayOf(SPAN)).toEqual({ span: SPAN, at: 300, playing: false, speed: 1 });
  });

  it("puts a time in the range", () => {
    expect(replayOf(SPAN, 150).at).toBe(150);
    expect(replayOf(SPAN, 0).at).toBe(100);
    expect(replayOf(SPAN, 999).at).toBe(300);
  });
});

describe("replaySeek", () => {
  it("puts the picture at a time of the range, and keeps the other parts", () => {
    const playing = replayPlay(replayOf(SPAN, 150));
    expect(replaySeek(playing, 250)).toEqual({ ...playing, at: 250 });
    expect(replaySeek(playing, -5).at).toBe(100);
    expect(replaySeek(playing, 1e9).at).toBe(300);
  });

  it("gives the same value for the same time", () => {
    const replay = replayOf(SPAN, 150);
    expect(replaySeek(replay, 150)).toBe(replay);
  });
});

describe("replayPlay, replayPause and replayToggle", () => {
  it("starts from the time of the picture", () => {
    expect(replayPlay(replayOf(SPAN, 150))).toMatchObject({ at: 150, playing: true });
  });

  it("starts again from the start when the picture is at the end", () => {
    expect(replayPlay(replayOf(SPAN))).toMatchObject({ at: 100, playing: true });
  });

  it("does not start a replay of a range with no length", () => {
    const replay = replayOf({ from: 5, to: 5 });
    expect(replayPlay(replay)).toBe(replay);
  });

  it("stops at the time of the picture", () => {
    const playing = replayPlay(replayOf(SPAN, 150));
    expect(replayPause(playing)).toMatchObject({ at: 150, playing: false });
    expect(replayToggle(playing).playing).toBe(false);
    expect(replayToggle(replayToggle(playing)).playing).toBe(true);
  });

  it("gives the same value when nothing changes", () => {
    const stopped = replayOf(SPAN, 150);
    const playing = replayPlay(stopped);
    expect(replayPause(stopped)).toBe(stopped);
    expect(replayPlay(playing)).toBe(playing);
  });
});

describe("replayAdvance", () => {
  it("goes through the range in the duration, with the speed 1", () => {
    const playing = replayPlay(replayOf(SPAN, 100));
    expect(replayAdvance(playing, REPLAY_DURATION / 4).at).toBeCloseTo(150, 9);
    expect(replayAdvance(playing, 500, 1000).at).toBeCloseTo(200, 9);
  });

  it("goes faster with a higher speed", () => {
    const fast = { ...replayPlay(replayOf(SPAN, 100)), speed: 2 };
    expect(replayAdvance(fast, 250, 1000).at).toBeCloseTo(200, 9);
  });

  it("stops at the end of the range", () => {
    const playing = replayPlay(replayOf(SPAN, 290));
    expect(replayAdvance(playing, 5000, 1000)).toEqual({ span: SPAN, at: 300, playing: false, speed: 1 });
  });

  it("gives the same value for a replay that does not go, and for no time", () => {
    const stopped = replayOf(SPAN, 150);
    const playing = replayPlay(stopped);
    expect(replayAdvance(stopped, 1000)).toBe(stopped);
    expect(replayAdvance(playing, 0)).toBe(playing);
    expect(replayAdvance(playing, -20)).toBe(playing);
    expect(replayAdvance(playing, Number.NaN)).toBe(playing);
  });

  it("goes to the end immediately with no duration", () => {
    expect(replayAdvance(replayPlay(replayOf(SPAN, 100)), 16, 0)).toMatchObject({ at: 300, playing: false });
  });

  it("gives the same time for two steps and for one step of their sum", () => {
    const step = fc.double({ min: 0.1, max: 5000, noNaN: true });
    fc.assert(
      fc.property(spans, fc.double({ min: 0, max: 0.5, noNaN: true }), step, step, (span, part, first, second) => {
        const playing = replayPlay(replayOf(span, spanTime(span, part)));
        const two = replayAdvance(replayAdvance(playing, first), second);
        const one = replayAdvance(playing, first + second);
        expect(two.at).toBeCloseTo(one.at, 4);
        expect(one.at).toBeGreaterThanOrEqual(playing.at);
        expect(one.at).toBeLessThanOrEqual(span.to);
      }),
    );
  });
});

describe("replayNextSpeed", () => {
  it("goes through the speeds, and then to the first speed again", () => {
    let replay = replayOf(SPAN);
    const seen = REPLAY_SPEEDS.map(() => {
      replay = replayNextSpeed(replay);
      return replay.speed;
    });
    expect(seen).toEqual([2, 4, 0.5, 1]);
  });

  it("gives the next higher speed for a speed that is not in the list", () => {
    expect(replayNextSpeed({ ...replayOf(SPAN), speed: 3 }).speed).toBe(4);
    expect(replayNextSpeed({ ...replayOf(SPAN), speed: 9 }).speed).toBe(0.5);
  });

  it("gives the same value for an empty list, and for a list of the speed only", () => {
    const replay = replayOf(SPAN);
    expect(replayNextSpeed(replay, [])).toBe(replay);
    expect(replayNextSpeed(replay, [1])).toBe(replay);
  });
});

describe("replaySpan", () => {
  it("keeps a picture of the present at the present", () => {
    expect(replaySpan(replayOf(SPAN), { from: 100, to: 400 })).toMatchObject({ at: 400, playing: false });
  });

  it("keeps a different time, in the new range", () => {
    expect(replaySpan(replayOf(SPAN, 150), { from: 100, to: 400 }).at).toBe(150);
    expect(replaySpan(replayOf(SPAN, 150), { from: 200, to: 400 }).at).toBe(200);
  });

  it("keeps a replay that goes, and stops it in a range with no length", () => {
    const playing = replayPlay(replayOf(SPAN, 150));
    expect(replaySpan(playing, { from: 100, to: 400 }).playing).toBe(true);
    expect(replaySpan(playing, { from: 150, to: 150 }).playing).toBe(false);
  });
});

describe("replayKey", () => {
  const times = [100, 140, 220, 300];
  const replay = replayOf(SPAN, 200);

  it("goes to the next change and to the change before with the arrow keys", () => {
    expect(replayKey("ArrowRight", replay, times)?.at).toBe(220);
    expect(replayKey("ArrowUp", replay, times)?.at).toBe(220);
    expect(replayKey("ArrowLeft", replay, times)?.at).toBe(140);
    expect(replayKey("ArrowDown", replay, times)?.at).toBe(140);
  });

  it("goes to the end of the range when no change is on that side", () => {
    expect(replayKey("ArrowRight", replayOf(SPAN, 250), [100, 140])?.at).toBe(300);
    expect(replayKey("ArrowLeft", replayOf(SPAN, 120), [140, 220])?.at).toBe(100);
  });

  it("goes a hundredth of the range with an arrow key when it has no times", () => {
    expect(replayKey("ArrowRight", replay)?.at).toBeCloseTo(202, 9);
    expect(replayKey("ArrowLeft", replay)?.at).toBeCloseTo(198, 9);
  });

  it("goes a tenth of the range with the page keys, and to the ends with Home and End", () => {
    expect(replayKey("PageUp", replay, times)?.at).toBeCloseTo(220, 9);
    expect(replayKey("PageDown", replay, times)?.at).toBeCloseTo(180, 9);
    expect(replayKey("Home", replay, times)?.at).toBe(100);
    expect(replayKey("End", replay, times)?.at).toBe(300);
  });

  it("stops a replay that goes", () => {
    expect(replayKey("ArrowRight", replayPlay(replay), times)).toMatchObject({ at: 220, playing: false });
  });

  it("starts and stops the replay with the key Space, at the same time", () => {
    expect(replayKey(" ", replay, times)).toMatchObject({ at: 200, playing: true });
    expect(replayKey(" ", replayPlay(replay), times)).toMatchObject({ at: 200, playing: false });
  });

  it("gives undefined for a key with no action", () => {
    expect(replayKey("a", replay, times)).toBeUndefined();
    expect(replayKey("Enter", replay, times)).toBeUndefined();
  });

  it("keeps the time in the range for each key", () => {
    const keys = fc.constantFrom("ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End");
    fc.assert(
      fc.property(keys, fc.double({ min: 0, max: 1, noNaN: true }), (key, part) => {
        const next = replayKey(key, replayOf(SPAN, spanTime(SPAN, part)), times);
        expect(next?.at).toBeGreaterThanOrEqual(SPAN.from);
        expect(next?.at).toBeLessThanOrEqual(SPAN.to);
      }),
    );
  });
});
