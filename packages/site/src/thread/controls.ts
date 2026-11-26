// The place of the controls of the thread view and the start state of its legend (V23).
// A page can give a host element for the buttons of the walks (`jumps`) and for the tools (`tools`): the switches, the zoom and the button that shows all.
// A part with a host goes into a wrapper in that host, not into the row on the canvas. The wrapper has the class `thread`, so the style and the colors of the view apply.
// This module has no DOM code. The mount gives the elements, and the tests give plain objects.

/** A parent of the parts: an element of the page, or a plain object in a test. */
export interface PartParent<T> {
  append(...nodes: T[]): void;
}

/** The parts of the row of the controls. */
export interface ControlParts<T> {
  readonly jumps: T;
  readonly tools: T;
}

/** The host elements that a page gives. A part with no host stays in the row of the view. */
export interface ControlHosts<T> {
  readonly jumps?: PartParent<T> | undefined;
  readonly tools?: PartParent<T> | undefined;
}

/** The place of the parts: the wrappers in the hosts, and the count of the parts that stay in the row. */
export interface ControlPlaces<T> {
  readonly wrappers: readonly T[];
  readonly inRow: number;
}

/**
 * This function puts each part into the row of the view, or into a wrapper in its host. The order in the row does not change: the jumps, then the tools.
 * `wrap` makes the wrapper of a part, with the part in it.
 */
export function placeControls<T>(parts: ControlParts<T>, hosts: ControlHosts<T>, row: PartParent<T>, wrap: (part: T) => T): ControlPlaces<T> {
  const wrappers: T[] = [];
  let inRow = 0;
  for (const name of ["jumps", "tools"] as const) {
    const host = hosts[name];
    if (host === undefined) {
      row.append(parts[name]);
      inRow += 1;
    } else {
      const wrapper = wrap(parts[name]);
      host.append(wrapper);
      wrappers.push(wrapper);
    }
  }
  return { wrappers, inRow };
}

/** This function gives the start state of the legend: the option of the page, or open on a view wider than `narrow`. */
export function legendOpenAt(option: boolean | undefined, width: number, narrow: number): boolean {
  return option ?? width > narrow;
}

/**
 * This function gives the top part of the view that the row of the controls covers, in CSS pixels.
 * A row with no part covers nothing. Else the row covers the height of a button, or the end of the row when its buttons take two rows.
 */
export function controlsTop(inRow: number, narrow: boolean, rowEnd: number): number {
  return inRow === 0 ? 0 : Math.max(narrow ? 56 : 52, rowEnd);
}
