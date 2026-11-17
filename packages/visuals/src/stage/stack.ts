import type { StageTheme } from "../theme.ts";
import type { StageContent, StagePick } from "./stage.ts";

/**
 * This function makes one content from a list of contents, for a stage that shows them together.
 * An example is a globe with a layer of labels, or a room with its marks.
 *
 * - The first content gives the extent: the views and the limits of the camera come from it.
 * - The last content is on top. A pick asks the last content first.
 * - A pick with no distance ends the search, if no earlier pick has a distance. That pick is the record.
 * - A pick with a distance does not end the search. The record is then the pick with the smallest distance.
 * - A record that two contents have is one record: each of them gets its highlight.
 * - The stage disposes the stack, and the stack disposes each content.
 */
export function stackContents<P, T extends StageTheme = StageTheme>(contents: readonly [StageContent<P, T>, ...StageContent<P, T>[]]): StageContent<P, T> {
  const [first] = contents;
  return {
    objects: contents.flatMap((content) => content.objects),
    get extent() {
      return first.extent;
    },
    has: (record) => contents.some((content) => content.has(record)),
    pick(ray): StagePick<P> | undefined {
      // The nearest of the picks that have a distance. A content on top gets the pick when two distances are equal.
      let nearest: StagePick<P> | undefined;
      for (let at = contents.length - 1; at >= 0; at -= 1) {
        const pick = contents[at]?.pick(ray);
        if (pick === undefined) continue;
        // A pick with no distance tells nothing of its depth, so the search stops: a nearer pick of a content on top stays the record.
        if (pick.distance === undefined) return nearest ?? pick;
        if (nearest?.distance === undefined || pick.distance < nearest.distance) nearest = pick;
      }
      return nearest;
    },
    paint(theme, highlight): void {
      for (const content of contents) content.paint(theme, highlight);
    },
    step(frame): boolean {
      let active = false;
      // Each content has its step, also after a content that continues to change.
      for (const content of contents) active = (content.step?.(frame) ?? false) || active;
      return active;
    },
    dispose(): void {
      for (const content of contents) content.dispose();
    },
  };
}
