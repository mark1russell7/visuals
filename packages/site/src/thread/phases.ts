import { countOf, errorMessage } from "@mark1russell7/text";

/** A step of a picture of a thread view. The step `layout` makes the picture from a document. The step `paint` draws it for the first time. */
export type ThreadPhase = "layout" | "paint";

/** The end of one step of a picture, for a page that measures a thread view. */
export interface ThreadPhaseEvent {
  readonly phase: ThreadPhase;
  /** The number of the picture, from 1. The view makes a new picture from each new document and from each new legend. */
  readonly picture: number;
  /** The number of boxes of the document of the picture. */
  readonly boxes: number;
  /** The time of the step, in milliseconds. */
  readonly ms: number;
  /** The time at the end of the step, in milliseconds on the clock of `performance.now()`. */
  readonly at: number;
  /** The text of the error that stopped the step. A step that ended has no error. */
  readonly error?: string | undefined;
  /** The number of findings of the layout engine about the layouts of the groups. An event of a layout with no finding does not have it. */
  readonly issues?: number | undefined;
}

/** This function gives the times of one picture as a sentence for a person: its layout, then its first drawing. */
export function phaseText(layout: ThreadPhaseEvent, paint: ThreadPhaseEvent): string {
  const time = (event: ThreadPhaseEvent): string => (event.ms < 1 ? "less than 1 ms" : `${String(Math.round(event.ms))} ms`);
  return `The view made this picture of ${countOf(layout.boxes, "box", "boxes")} in ${time(layout)}, and drew it in ${time(paint)}.`;
}

/** The options of `phaseTeller`. */
export interface PhaseTellerOptions {
  /** The function that gets each event. An error of this function does not stop a step. */
  readonly onPhase?: ((event: ThreadPhaseEvent) => void) | undefined;
  /** The clock, in milliseconds. The default is `performance.now()`. */
  readonly now?: (() => number) | undefined;
  /** The function that gets each thrown value. The default is `reportError`, so the console of the browser shows the error. */
  readonly report?: ((error: unknown) => void) | undefined;
}

/** The teller of the steps of the pictures of one thread view. */
export interface PhaseTeller {
  /**
   * This function makes the layout of the next picture and tells its time. `boxes` is the number of boxes of its document.
   * It gives the result of `work`, or `undefined` after an error. `issues` gives the number of findings of the result.
   */
  layout<T>(boxes: number, work: () => T, issues?: (made: T) => number): T | undefined;
  /**
   * This function draws a picture. The first drawing after each layout tells its time.
   * It gives the result of `work`, which is true while a part continues to change. It gives false after an error of a first drawing.
   */
  paint(work: () => boolean): boolean;
  /** This function tells that the picture gets no drawing, with the cause. */
  noPaint(cause: string): void;
}

/**
 * This function makes the teller of the steps of the pictures of one thread view.
 *
 * An error in a step does not go to the caller of the step. The teller gives the thrown value to `report`,
 * and the event of the step has the text of the error. Thus a page learns which step stopped, and why.
 */
export function phaseTeller(options: PhaseTellerOptions = {}): PhaseTeller {
  const now = options.now ?? ((): number => performance.now());
  const report =
    options.report ??
    ((error: unknown): void => {
      globalThis.reportError(error);
    });
  let picture = 0;
  let boxes = 0;
  /** This value is true from the layout of a picture to its first drawing. */
  let waiting = false;

  const tell = (phase: ThreadPhase, ms: number, at: number, error?: string, issues = 0): void => {
    try {
      options.onPhase?.({ phase, picture, boxes, ms, at, ...(error === undefined ? {} : { error }), ...(issues > 0 ? { issues } : {}) });
    } catch (thrown) {
      report(thrown);
    }
  };

  /** This function does the work of a step and tells its time. It gives `undefined` after an error. */
  const step = <T>(phase: ThreadPhase, work: () => T, issues?: (made: T) => number): T | undefined => {
    const from = now();
    try {
      const made = work();
      const at = now();
      tell(phase, at - from, at, undefined, issues?.(made));
      return made;
    } catch (thrown) {
      const at = now();
      report(thrown);
      tell(phase, at - from, at, errorMessage(thrown));
      return undefined;
    }
  };

  return {
    layout(count, work, issues) {
      picture += 1;
      boxes = count;
      const made = step("layout", work, issues);
      waiting = made !== undefined;
      return made;
    },
    paint(work) {
      if (!waiting) return work();
      waiting = false;
      return step("paint", work) ?? false;
    },
    noPaint(cause) {
      waiting = false;
      tell("paint", 0, now(), cause);
    },
  };
}
