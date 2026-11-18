import type { LayoutEdge } from "@mark1russell7/layout-contract";
import type { ThreadBox, ThreadDocument } from "./document.ts";

/** This function gives the id of the panel of an action of a box, for a test. */
export const panelId = (of: string, action = "answer"): string => `panel:${action}:${of}`;

/** This function gives the box of the panel of an action of a box, for a test. */
export const panelBox = (of: string, action = "answer"): ThreadBox => ({ id: panelId(of, action), data: { kinds: ["panel"], label: "Answer", of } });

/** This function gives the edge from a box to the panel of an action of it, for a test. */
export const panelEdge = (of: string, action = "answer"): LayoutEdge => ({ id: `to:${panelId(of, action)}`, source: of, target: panelId(of, action), data: { kind: "panel" } });

/** This function gives a document with one panel for each box of `ofs`, after the records of the document, for a test. */
export const withPanels = (document: ThreadDocument, ...ofs: readonly string[]): ThreadDocument => ({
  ...document,
  boxes: [...document.boxes, ...ofs.map((of) => panelBox(of))],
  edges: [...(document.edges ?? []), ...ofs.map((of) => panelEdge(of))],
});
