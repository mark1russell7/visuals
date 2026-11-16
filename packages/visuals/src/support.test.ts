import { describe, expect, it } from "vitest";
import { stageSupported } from "./support.ts";

/** This function makes a document whose canvas gives `context` for WebGL 2. It records each tag and each kind of context that the function asks for. */
const pageWith = (context: () => unknown): { readonly page: Document; readonly tags: string[]; readonly kinds: string[] } => {
  const tags: string[] = [];
  const kinds: string[] = [];
  const page = {
    createElement: (tag: string): unknown => {
      tags.push(tag);
      return {
        getContext: (kind: string): unknown => {
          kinds.push(kind);
          return context();
        },
      };
    },
  } as unknown as Document;
  return { page, tags, kinds };
};

describe("stageSupported", () => {
  it("gives false where there is no document", () => {
    // A test in Node.js has no document.
    expect(globalThis.document).toBeUndefined();
    expect(stageSupported()).toBe(false);
    expect(stageSupported(undefined)).toBe(false);
  });

  it("gives false for a browser with no WebGL 2", () => {
    const { page, tags, kinds } = pageWith(() => null);
    expect(stageSupported(page)).toBe(false);
    // It asks one canvas for the context that a stage needs.
    expect(tags).toEqual(["canvas"]);
    expect(kinds).toEqual(["webgl2"]);
  });

  it("gives true for a browser with WebGL 2, and releases the context", () => {
    const names: string[] = [];
    let lost = 0;
    const context = {
      getExtension: (name: string): unknown => {
        names.push(name);
        return { loseContext: (): void => void (lost += 1) };
      },
    };
    const { page, kinds } = pageWith(() => context);
    expect(stageSupported(page)).toBe(true);
    expect(kinds).toEqual(["webgl2"]);
    expect(names).toEqual(["WEBGL_lose_context"]);
    expect(lost).toBe(1);
  });

  it("gives true for a context that the browser cannot release", () => {
    const { page } = pageWith(() => ({ getExtension: (): null => null }));
    expect(stageSupported(page)).toBe(true);
  });

  it("gives false, and does not throw, for a browser that stops the request", () => {
    const { page } = pageWith(() => {
      throw new Error("the browser gives no context");
    });
    expect(stageSupported(page)).toBe(false);
  });
});
