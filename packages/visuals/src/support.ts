/**
 * This function tells if a browser can show a stage. A stage needs WebGL 2.
 *
 * A page uses it before it loads the entry `/three`. Thus a browser with no WebGL 2 shows a different picture, and it does not load `three`.
 * The function asks a canvas that is not in the page for a context, and it releases the context at once.
 * `page` is the document of the page. The default is the document of the browser. With no document, the function gives false.
 *
 * A stage can give `undefined` after this function gave true, so the page keeps its different picture ready.
 */
export function stageSupported(page: Document | undefined = globalThis.document): boolean {
  if (page === undefined) return false;
  try {
    const context = page.createElement("canvas").getContext("webgl2");
    if (context === null) return false;
    // A browser keeps only some contexts. So the function gives this one back.
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
