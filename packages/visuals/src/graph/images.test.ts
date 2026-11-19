import { afterEach, describe, expect, it, vi } from "vitest";
import { createImageStore, loadImage, MOST_IMAGES, type ReadyImage } from "./images.ts";

/** This function gives an image of a test, with a list of the names of the images that released their memory. */
function imageOf(name: string, closed: string[] = []): ReadyImage {
  return { source: name as unknown as CanvasImageSource, width: 200, height: 100, close: () => void closed.push(name) };
}

/** This function waits for the end of the task: each result of a load arrives, and the next `get` is of a new paint. */
function turn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** This function makes a loader whose loads end when the test tells them to. */
function loader(): {
  readonly load: (src: string) => Promise<ReadyImage>;
  readonly asked: string[];
  done(src: string, image: ReadyImage): void;
  fail(src: string): void;
} {
  const asked: string[] = [];
  const pending = new Map<string, { resolve(image: ReadyImage): void; reject(error: Error): void }>();
  return {
    asked,
    load(src) {
      asked.push(src);
      return new Promise<ReadyImage>((resolve, reject) => {
        pending.set(src, { resolve, reject });
      });
    },
    done: (src, image) => pending.get(src)?.resolve(image),
    fail: (src) => pending.get(src)?.reject(new Error(`no ${src}`)),
  };
}

describe("createImageStore", () => {
  it("starts one load for a new address, and gives no image until the image is ready", async () => {
    const { load, asked, done } = loader();
    const ready: string[] = [];
    const store = createImageStore({ load, onReady: (src) => void ready.push(src) });
    expect(store.state("a.png")).toBeUndefined();
    expect(store.get("a.png")).toBeUndefined();
    expect(store.get("a.png")).toBeUndefined();
    expect(store.state("a.png")).toBe("loading");
    await turn();
    expect(store.get("a.png")).toBeUndefined();
    expect(asked).toEqual(["a.png"]);
    expect(ready).toEqual([]);

    const image = imageOf("a");
    done("a.png", image);
    await turn();
    expect(ready).toEqual(["a.png"]);
    expect(store.state("a.png")).toBe("ready");
    expect(store.get("a.png")).toBe(image);
    expect(asked).toEqual(["a.png"]);
  });

  it("keeps an address whose load fails as failed, and does not load it again", async () => {
    const { load, asked, fail } = loader();
    const ready: string[] = [];
    const store = createImageStore({ load, onReady: (src) => void ready.push(src) });
    store.get("a.png");
    fail("a.png");
    await turn();
    expect(store.state("a.png")).toBe("failed");
    expect(store.get("a.png")).toBeUndefined();
    await turn();
    expect(store.get("a.png")).toBeUndefined();
    expect(asked).toEqual(["a.png"]);
    expect(ready).toEqual([]);
  });

  it("keeps an address as failed when its loader throws an error", async () => {
    const store = createImageStore({
      load: () => {
        throw new Error("no loader");
      },
    });
    expect(store.get("a.png")).toBeUndefined();
    await turn();
    expect(store.state("a.png")).toBe("failed");
    // A value that is not an error has the same effect.
    const other = createImageStore({
      load: () => {
        throw "no loader";
      },
    });
    other.get("b.png");
    await turn();
    expect(other.state("b.png")).toBe("failed");
  });

  it("starts no load for an empty address", () => {
    const { load, asked } = loader();
    const store = createImageStore({ load });
    expect(store.get("")).toBeUndefined();
    expect(store.state("")).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it("removes the address of the oldest use when it is full, and releases the memory of its image", async () => {
    const { load, asked, done } = loader();
    const closed: string[] = [];
    const store = createImageStore({ load, most: 2 });
    store.get("a.png");
    store.get("b.png");
    done("a.png", imageOf("a", closed));
    done("b.png", imageOf("b", closed));
    await turn();
    // The paint uses the first address, so the second address has the oldest use.
    expect(store.get("a.png")).toBeDefined();
    await turn();
    expect(store.get("c.png")).toBeUndefined();
    expect(closed).toEqual(["b"]);
    expect(store.state("b.png")).toBeUndefined();
    expect(store.state("a.png")).toBe("ready");
    expect(store.state("c.png")).toBe("loading");
    expect(asked).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("does not remove an address of the paint that continues: a paint with too many images starts each load one time", async () => {
    const { load, asked, done } = loader();
    const closed: string[] = [];
    const store = createImageStore({ load, most: 2 });
    const paint = (): (ReadyImage | undefined)[] => ["a.png", "b.png", "c.png"].map((src) => store.get(src));
    expect(paint()).toEqual([undefined, undefined, undefined]);
    expect(store.state("c.png")).toBeUndefined();
    const a = imageOf("a", closed);
    const b = imageOf("b", closed);
    done("a.png", a);
    done("b.png", b);
    await turn();
    expect(paint()).toEqual([a, b, undefined]);
    await turn();
    expect(paint()).toEqual([a, b, undefined]);
    expect(asked).toEqual(["a.png", "b.png"]);
    expect(closed).toEqual([]);
  });

  it("keeps one address or more, and a whole number of addresses", async () => {
    const one = loader();
    const least = createImageStore({ load: one.load, most: 0 });
    least.get("a.png");
    await turn();
    least.get("b.png");
    expect(least.state("a.png")).toBeUndefined();
    expect(least.state("b.png")).toBe("loading");

    const two = loader();
    const whole = createImageStore({ load: two.load, most: 2.9 });
    whole.get("a.png");
    whole.get("b.png");
    whole.get("c.png");
    expect(two.asked).toEqual(["a.png", "b.png"]);
    expect(MOST_IMAGES).toBe(64);
  });

  it("releases an image that arrives after the store removed its address, and does not tell the page", async () => {
    const { load, done } = loader();
    const closed: string[] = [];
    const ready: string[] = [];
    const store = createImageStore({ load, most: 1, onReady: (src) => void ready.push(src) });
    store.get("a.png");
    await turn();
    store.get("b.png");
    done("a.png", imageOf("a", closed));
    await turn();
    expect(closed).toEqual(["a"]);
    expect(ready).toEqual([]);
    expect(store.state("a.png")).toBeUndefined();
    expect(store.state("b.png")).toBe("loading");
  });

  it("keeps the new load of an address when an old load of the same address fails", async () => {
    const fails: (() => void)[] = [];
    const store = createImageStore({
      most: 1,
      load: (src) =>
        new Promise<ReadyImage>((_resolve, reject) => {
          fails.push(() => {
            reject(new Error(`no ${src}`));
          });
        }),
    });
    store.get("a.png");
    await turn();
    store.get("b.png");
    await turn();
    // The store loads the first address again, then the first load of it fails.
    store.get("a.png");
    expect(fails).toHaveLength(3);
    fails[0]?.();
    await turn();
    expect(store.state("a.png")).toBe("loading");
    fails[2]?.();
    await turn();
    expect(store.state("a.png")).toBe("failed");
  });

  it("releases each image at its end, and has no effect after it", async () => {
    const { load, asked, done } = loader();
    const closed: string[] = [];
    const ready: string[] = [];
    const store = createImageStore({ load, onReady: (src) => void ready.push(src) });
    store.get("a.png");
    store.get("b.png");
    done("a.png", imageOf("a", closed));
    await turn();
    expect(ready).toEqual(["a.png"]);
    store.dispose();
    expect(closed).toEqual(["a"]);
    expect(store.state("a.png")).toBeUndefined();
    // An image that arrives after the end releases its memory, and the page gets no message.
    done("b.png", imageOf("b", closed));
    await turn();
    expect(closed).toEqual(["a", "b"]);
    expect(ready).toEqual(["a.png"]);
    expect(store.get("a.png")).toBeUndefined();
    expect(store.get("c.png")).toBeUndefined();
    expect(asked).toEqual(["a.png", "b.png"]);
  });

  it("continues when an image cannot release its memory, and with an image that has nothing to release", async () => {
    const { load, done } = loader();
    const store = createImageStore({ load });
    store.get("a.png");
    store.get("b.png");
    done("a.png", {
      source: "a" as unknown as CanvasImageSource,
      width: 1,
      height: 1,
      close: () => {
        throw new Error("no close");
      },
    });
    done("b.png", { source: "b" as unknown as CanvasImageSource, width: 1, height: 1 });
    await turn();
    expect(() => {
      store.dispose();
    }).not.toThrow();
  });
});

describe("loadImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** This function gives a reply of a server with some bytes. */
  function reply(ok: boolean, status = 200): { readonly ok: boolean; readonly status: number; blob(): Promise<Blob> } {
    return { ok, status, blob: () => Promise.resolve(new Blob(["bytes"])) };
  }

  it("sends a request with no credentials, and gives the bitmap of the bytes", async () => {
    const requests: unknown[][] = [];
    let closed = 0;
    const bitmap = { width: 320, height: 200, close: () => void (closed += 1) };
    vi.stubGlobal("fetch", (...values: unknown[]) => {
      requests.push(values);
      return Promise.resolve(reply(true));
    });
    vi.stubGlobal("createImageBitmap", () => Promise.resolve(bitmap));
    const image = await loadImage("/pictures/a.png");
    expect(requests).toEqual([["/pictures/a.png", { credentials: "omit" }]]);
    expect(image.source).toBe(bitmap);
    expect([image.width, image.height]).toEqual([320, 200]);
    image.close?.();
    expect(closed).toBe(1);
  });

  it("gives an error for a reply with a status that is not good", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(reply(false, 404)));
    await expect(loadImage("/pictures/none.png")).rejects.toThrow("404");
  });

  /** This function puts a fake image element and fake addresses of bytes in the place of those of a browser. */
  function fakeElements(size: { readonly width: number; readonly height: number }): { readonly made: string[]; readonly revoked: string[] } {
    const made: string[] = [];
    const revoked: string[] = [];
    class FakeImage {
      decoding = "";
      src = "";
      naturalWidth = size.width;
      naturalHeight = size.height;
      decode(): Promise<void> {
        made.push(this.src);
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => void revoked.push(url));
    return { made, revoked };
  }

  it("shows the bytes in an image element when the browser makes no bitmap from them", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(reply(true)));
    vi.stubGlobal("createImageBitmap", () => Promise.reject(new Error("no bitmap")));
    const { made, revoked } = fakeElements({ width: 640, height: 400 });
    const image = await loadImage("/pictures/a.svg");
    expect([image.width, image.height]).toEqual([640, 400]);
    expect(image.close).toBeUndefined();
    expect(made).toEqual(["blob:test"]);
    expect(revoked).toEqual(["blob:test"]);
  });

  it("shows the bytes in an image element in a browser with no bitmap", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(reply(true)));
    vi.stubGlobal("createImageBitmap", undefined);
    const { revoked } = fakeElements({ width: 640, height: 400 });
    const image = await loadImage("/pictures/a.svg");
    expect([image.width, image.height]).toEqual([640, 400]);
    expect(revoked).toEqual(["blob:test"]);
  });

  it("gives an error for an image with no size, and removes the address of its bytes", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(reply(true)));
    vi.stubGlobal("createImageBitmap", undefined);
    const { revoked } = fakeElements({ width: 0, height: 0 });
    await expect(loadImage("/pictures/empty.svg")).rejects.toThrow("no size");
    expect(revoked).toEqual(["blob:test"]);
  });
});
