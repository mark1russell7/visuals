/** The highlight of a record. 0 is no highlight. 1 is a record under the pointer or in the highlighted list. 2 is the selected record. */
export type Highlight = 0 | 1 | 2;

/** The records of a stage that have a highlight. Each record has a name. */
export interface Highlights {
  /** The name of the record under the pointer. */
  readonly hovered: string | undefined;
  /** The name of the selected record. */
  readonly selected: string | undefined;
  /** The names of the records that the page highlights. */
  readonly highlighted: ReadonlySet<string>;
}

/** The highlights of a stage with no pointer on it and no selected record. */
export const NO_HIGHLIGHTS: Highlights = { hovered: undefined, selected: undefined, highlighted: new Set() };

/** This function gives the highlight of a record. The selected record has the highest highlight. */
export function highlightOf(highlights: Highlights, record: string): Highlight {
  if (record === highlights.selected) return 2;
  return record === highlights.hovered || highlights.highlighted.has(record) ? 1 : 0;
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
