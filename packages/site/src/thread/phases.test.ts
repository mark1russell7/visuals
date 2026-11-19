import { describe, expect, it } from "vitest";
import { phaseTeller, phaseText, type ThreadPhaseEvent } from "./phases.ts";

/** This function makes a teller with a clock that a test moves, and the lists of what the teller told. */
function harness(): { teller: ReturnType<typeof phaseTeller>; events: ThreadPhaseEvent[]; reports: unknown[]; pass: (ms: number) => void } {
  const events: ThreadPhaseEvent[] = [];
  const reports: unknown[] = [];
  let time = 100;
  const teller = phaseTeller({
    onPhase: (event) => {
      events.push(event);
    },
    now: () => time,
    report: (error) => {
      reports.push(error);
    },
  });
  return {
    teller,
    events,
    reports,
    pass: (ms) => {
      time += ms;
    },
  };
}

describe("phaseText", () => {
  it("gives the times of a picture as a sentence", () => {
    const layout: ThreadPhaseEvent = { phase: "layout", picture: 1, boxes: 58, ms: 41.4, at: 141.4 };
    const paint: ThreadPhaseEvent = { phase: "paint", picture: 1, boxes: 58, ms: 5.6, at: 160 };
    expect(phaseText(layout, paint)).toBe("The view made this picture of 58 boxes in 41 ms, and drew it in 6 ms.");
  });

  it("names one box, and a time below 1 ms", () => {
    const layout: ThreadPhaseEvent = { phase: "layout", picture: 2, boxes: 1, ms: 0.2, at: 10 };
    const paint: ThreadPhaseEvent = { phase: "paint", picture: 2, boxes: 1, ms: 0.9, at: 20 };
    expect(phaseText(layout, paint)).toBe("The view made this picture of 1 box in less than 1 ms, and drew it in less than 1 ms.");
  });
});

describe("phaseTeller", () => {
  it("tells the time of a layout, and gives its result", () => {
    const { teller, events, reports, pass } = harness();
    const made = teller.layout(40, () => {
      pass(25);
      return "picture";
    });
    expect(made).toBe("picture");
    expect(events).toEqual([{ phase: "layout", picture: 1, boxes: 40, ms: 25, at: 125 }]);
    expect(reports).toEqual([]);
  });

  it("tells the number of the findings of a layout, and no number for a layout with none", () => {
    const { teller, events } = harness();
    const count = (made: readonly string[]): number => made.length;
    teller.layout(3, () => ["unknown layout", "bad option"], count);
    teller.layout(3, (): string[] => [], count);
    const layouts = events.filter((event) => event.phase === "layout");
    expect(layouts.map((event) => event.issues)).toEqual([2, undefined]);
    expect(layouts.map((event) => "issues" in event)).toEqual([true, false]);
  });

  it("tells the first drawing of a picture, and no later drawing", () => {
    const { teller, events, pass } = harness();
    teller.layout(40, () => "picture");
    pass(16);
    const moving = teller.paint(() => {
      pass(4);
      return true;
    });
    expect(moving).toBe(true);
    expect(teller.paint(() => false)).toBe(false);
    expect(events.map((event) => event.phase)).toEqual(["layout", "paint"]);
    expect(events[1]).toEqual({ phase: "paint", picture: 1, boxes: 40, ms: 4, at: 120 });
  });

  it("counts the pictures, and tells the first drawing of each", () => {
    const { teller, events } = harness();
    teller.layout(40, () => "first");
    teller.layout(41, () => "second");
    teller.paint(() => false);
    teller.layout(42, () => "third");
    teller.paint(() => false);
    expect(events.map((event) => [event.phase, event.picture, event.boxes])).toEqual([
      ["layout", 1, 40],
      ["layout", 2, 41],
      ["paint", 2, 41],
      ["layout", 3, 42],
      ["paint", 3, 42],
    ]);
  });

  it("tells nothing for a drawing that has no layout before it", () => {
    const { teller, events } = harness();
    expect(teller.paint(() => true)).toBe(true);
    expect(events).toEqual([]);
  });

  it("tells the error of a layout with its step, and does not throw it", () => {
    const { teller, events, reports, pass } = harness();
    const failure = new Error("no place for the box m1");
    const made = teller.layout(40, (): string => {
      pass(7);
      throw failure;
    });
    expect(made).toBeUndefined();
    expect(events).toEqual([{ phase: "layout", picture: 1, boxes: 40, ms: 7, at: 107, error: "no place for the box m1" }]);
    expect(reports).toEqual([failure]);
  });

  it("tells no drawing for a picture that has no layout", () => {
    const { teller, events } = harness();
    teller.layout(40, (): string => {
      throw new Error("stop");
    });
    teller.paint(() => false);
    expect(events.map((event) => event.phase)).toEqual(["layout"]);
  });

  it("tells the error of a first drawing with its step, and stops the motion", () => {
    const { teller, events, reports } = harness();
    teller.layout(40, () => "picture");
    const moving = teller.paint(() => {
      throw new TypeError("no font");
    });
    expect(moving).toBe(false);
    expect(events[1]).toMatchObject({ phase: "paint", picture: 1, error: "no font" });
    expect(reports).toHaveLength(1);
  });

  it("does not catch the error of a later drawing", () => {
    const { teller, events } = harness();
    teller.layout(40, () => "picture");
    teller.paint(() => false);
    expect(() =>
      teller.paint(() => {
        throw new Error("later");
      }),
    ).toThrow("later");
    expect(events).toHaveLength(2);
  });

  it("tells a picture that gets no drawing, with the cause", () => {
    const { teller, events, reports } = harness();
    teller.layout(40, () => "picture");
    teller.noPaint("The browser gave no canvas.");
    teller.paint(() => false);
    expect(events).toEqual([
      { phase: "layout", picture: 1, boxes: 40, ms: 0, at: 100 },
      { phase: "paint", picture: 1, boxes: 40, ms: 0, at: 100, error: "The browser gave no canvas." },
    ]);
    expect(reports).toEqual([]);
  });

  it("continues after an error of the function of the page", () => {
    const reports: unknown[] = [];
    const failure = new Error("the page stopped");
    const teller = phaseTeller({
      onPhase: () => {
        throw failure;
      },
      now: () => 0,
      report: (error) => {
        reports.push(error);
      },
    });
    expect(teller.layout(1, () => "picture")).toBe("picture");
    expect(teller.paint(() => true)).toBe(true);
    expect(reports).toEqual([failure, failure]);
  });

  it("does its work with no function of a page", () => {
    const teller = phaseTeller({ now: () => 0, report: () => undefined });
    expect(teller.layout(1, () => "picture")).toBe("picture");
    expect(teller.paint(() => true)).toBe(true);
  });
});
