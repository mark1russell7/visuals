import type { ThreadDocument } from "./document.ts";
import { shownDocument } from "./nest.ts";
import { sampleThread } from "./sample.ts";

/** This function gives the sample with no group, for a test of the flat picture. Each topic is a pill, and the thread is not a box. */
export const flatSample = (): ThreadDocument => shownDocument(sampleThread(), { flat: true });
