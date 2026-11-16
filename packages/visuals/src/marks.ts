/** The mark of a record. 0 is no mark. 1 is a record under the pointer or in the marked list. 2 is the selected record. */
export type Mark = 0 | 1 | 2;

/** The records of a stage that have a mark. Each record has a name. */
export interface Marks {
  /** The name of the record under the pointer. */
  readonly hovered: string | undefined;
  /** The name of the selected record. */
  readonly selected: string | undefined;
  /** The names of the records that the page marks. */
  readonly marked: ReadonlySet<string>;
}

/** The marks of a stage with no pointer on it and no selected record. */
export const NO_MARKS: Marks = { hovered: undefined, selected: undefined, marked: new Set() };

/** This function gives the mark of a record. The selected record has the highest mark. */
export function markOf(marks: Marks, record: string): Mark {
  if (record === marks.selected) return 2;
  return record === marks.hovered || marks.marked.has(record) ? 1 : 0;
}

/** A pointer that moves this distance or less between down and up makes a click, in CSS pixels. */
export const CLICK_DISTANCE = 4;

/**
 * This function tells if a pointer that went down and up made a click. A pointer that moved more than `limit` made a drag.
 * The positions and the limit are in CSS pixels.
 */
export function isClick(down: { readonly x: number; readonly y: number }, up: { readonly x: number; readonly y: number }, limit: number = CLICK_DISTANCE): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= limit;
}
