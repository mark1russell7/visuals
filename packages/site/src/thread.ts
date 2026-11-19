/**
 * The view of a conversation and its topics, for a page that has a document of boxes and edges.
 *
 * The file `vite.thread.config.ts` makes one module of this entry, with each engine in it.
 */
export { chooseTopic, type TopicChoiceEvent } from "./thread/card.ts";
export type { ThreadAction, ThreadBox, ThreadDocument, ThreadLegend } from "./thread/document.ts";
export { DARK_THREAD_THEME, LIGHT_THREAD_THEME, type ThreadTheme } from "./thread/looks.ts";
export { mountThreadView, type ThreadActionEvent, type ThreadView, type ThreadViewOptions } from "./thread/mount.ts";
export { THREAD_FEATURES } from "./thread/nest.ts";
export type { ThreadPhase, ThreadPhaseEvent } from "./thread/phases.ts";
export { SAMPLE_IMAGE, SAMPLE_LEGEND, sampleThread, withSampleImage } from "./thread/sample.ts";
