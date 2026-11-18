import type { PictureContent, PicturePick } from "./stage.ts";

/**
 * This function makes one content from a list of contents, for a flat stage that shows them together.
 * An example is a layer of boxes below a layer of routes and a layer of labels.
 *
 * - The first content gives the bounds: the views and the limits of the camera come from it.
 * - The stack draws the contents in their sequence, so the last content is on top.
 * - A pick asks the last content first. The first record that a content gives is the record.
 * - A record that two contents have is one record: each of them gets its highlight.
 * - A content does not get the state of the canvas of an earlier content: the stack restores it.
 * - The stage disposes the stack, and the stack disposes each content.
 */
export function stackPictureContents<P, T>(contents: readonly [PictureContent<P, T>, ...PictureContent<P, T>[]]): PictureContent<P, T> {
  const [first] = contents;
  return {
    get bounds() {
      return first.bounds;
    },
    has: (record) => contents.some((content) => content.has(record)),
    pick(at): PicturePick<P> | undefined {
      for (let index = contents.length - 1; index >= 0; index -= 1) {
        const pick = contents[index]?.pick(at);
        if (pick !== undefined) return pick;
      }
      return undefined;
    },
    draw(context, frame, theme, highlight): boolean {
      let active = false;
      // Each content has its picture, also after a content that continues to change.
      for (const content of contents) {
        context.save();
        active = content.draw(context, frame, theme, highlight) || active;
        context.restore();
      }
      return active;
    },
    dispose(): void {
      for (const content of contents) content.dispose?.();
    },
  };
}
