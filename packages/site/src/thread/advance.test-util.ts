import type { AdvanceFn } from "@mark1russell7/layout-contract/text";

/** This function gives the width of a text for a test, with no browser. Each character has 0.52 of the size of the font. */
export const fakeAdvance: AdvanceFn = (text, font) => text.length * 0.52 * Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "13");
