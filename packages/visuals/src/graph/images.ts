/** An image that is ready for a paint. */
export interface ReadyImage {
  /** The image, for the function `drawImage` of a canvas. */
  readonly source: CanvasImageSource;
  /** The width of the image, in pixels. */
  readonly width: number;
  /** The height of the image, in pixels. */
  readonly height: number;
  /** This function releases the memory of the image. An image store starts it when it removes the image. */
  readonly close?: (() => void) | undefined;
}

/**
 * This function gives the image of an address when the image is ready for a paint. For each other address, it gives `undefined`.
 * The function `get` of an image store has this type.
 */
export type ImageSource = (src: string) => ReadyImage | undefined;

/** The state of an address in an image store. */
export type ImageState = "loading" | "ready" | "failed";

/** The options of `createImageStore`. */
export interface ImageStoreOptions {
  /** The store starts this function when the image of an address becomes ready. Start `refresh` of the stage in it. */
  readonly onReady?: ((src: string) => void) | undefined;
  /** This function loads the image of an address. The default is `loadImage`. */
  readonly load?: ((src: string) => Promise<ReadyImage>) | undefined;
  /** The most addresses that the store keeps. The default is `MOST_IMAGES`. */
  readonly most?: number | undefined;
}

/** The most addresses that an image store keeps, when its options give no number. */
export const MOST_IMAGES = 64;

/** The images of a picture, by their addresses. */
export interface ImageStore {
  /**
   * This function gives the image of an address when the image is ready. For each other address, it gives `undefined`.
   * It starts the load of an address that the store does not have.
   */
  readonly get: ImageSource;
  /** This function gives the state of an address. It gives `undefined` for an address that the store does not have. */
  state(src: string): ImageState | undefined;
  /** This function removes each image of the store. After it, the store loads no image, and it does not start `onReady`. */
  dispose(): void;
}

/** One address of an image store. */
interface StoredImage {
  state: ImageState;
  image?: ReadyImage | undefined;
  /** The paint that used the address last. */
  used: number;
}

/**
 * This function loads an image in a browser. The request has no credentials, so it sends no cookie of the person.
 *
 * - An image of a different origin needs the CORS headers of its server.
 * - A reply with a status that is not good gives an error.
 * - The browser makes a bitmap from the bytes. For an image that has no bitmap, for example an SVG image, an image element shows the bytes.
 */
export async function loadImage(src: string): Promise<ReadyImage> {
  const response = await fetch(src, { credentials: "omit" });
  if (!response.ok) throw new Error(`The image ${src} has the status ${String(response.status)}.`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => {
          bitmap.close();
        },
      };
    } catch {
      // Some browsers make no bitmap from an SVG image. An image element shows it.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) throw new Error(`The image ${src} has no size.`);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    // The element keeps the image, so the address of the bytes can go.
    URL.revokeObjectURL(url);
  }
}

/**
 * This function makes an image store: the images of a picture, by their addresses.
 *
 * - `get` starts the load of a new address, and gives the image when it is ready. `onReady` tells the page to draw the picture again.
 * - An address whose load fails keeps the state `failed`. The store does not load it again while it has the address.
 * - A full store removes the address that it used the longest time ago. It does not remove an address of the paint that continues.
 * - Thus a paint with more images than the store keeps shows the first images, and each address has one load.
 *
 * Give `get` to the option `images` of a picture content. Start `dispose` of the store when the page removes the stage.
 */
export function createImageStore(options: ImageStoreOptions = {}): ImageStore {
  const load = options.load ?? loadImage;
  const most = Math.max(1, Math.floor(options.most ?? MOST_IMAGES));
  /** The addresses of the store. The first address is the address that the store used the longest time ago. */
  const stored = new Map<string, StoredImage>();
  let disposed = false;
  /** The number of the paint that continues. Each `get` of one task of the browser has the same number. */
  let paint = 0;
  /** This value is true when a change of `paint` waits for the end of the task. */
  let waits = false;

  const release = (image: ReadyImage | undefined): void => {
    try {
      image?.close?.();
    } catch {
      // An image that cannot release its memory stays for the browser to remove.
    }
  };

  /** This function gives the number of the paint that continues, and it makes the next task a new paint. */
  const paintNow = (): number => {
    if (!waits) {
      waits = true;
      queueMicrotask(() => {
        waits = false;
        paint += 1;
      });
    }
    return paint;
  };

  /** This function makes room for one more address. It tells if the store has room. */
  const makeRoom = (at: number): boolean => {
    while (stored.size >= most) {
      const oldest = stored.entries().next().value;
      // Each address is of the paint that continues, so no address can go.
      if (oldest === undefined || oldest[1].used === at) return false;
      release(oldest[1].image);
      stored.delete(oldest[0]);
    }
    return true;
  };

  const start = (src: string, at: number): void => {
    if (!makeRoom(at)) return;
    const entry: StoredImage = { state: "loading", used: at };
    stored.set(src, entry);
    let pending: Promise<ReadyImage>;
    try {
      pending = load(src);
    } catch (error) {
      pending = Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    void pending.then(
      (image) => {
        // The store removed the address while the load continued.
        if (disposed || stored.get(src) !== entry) {
          release(image);
          return;
        }
        entry.state = "ready";
        entry.image = image;
        options.onReady?.(src);
      },
      () => {
        if (stored.get(src) === entry) entry.state = "failed";
      },
    );
  };

  return {
    get(src) {
      if (disposed || src === "") return undefined;
      const at = paintNow();
      const entry = stored.get(src);
      if (entry === undefined) {
        start(src, at);
        return undefined;
      }
      // The address goes to the end of the order: it is the address of the last use.
      entry.used = at;
      stored.delete(src);
      stored.set(src, entry);
      return entry.image;
    },
    state: (src) => stored.get(src)?.state,
    dispose() {
      disposed = true;
      for (const entry of stored.values()) release(entry.image);
      stored.clear();
    },
  };
}
