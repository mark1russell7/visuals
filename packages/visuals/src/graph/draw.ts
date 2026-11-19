import type { PathSegment, Rect } from "@mark1russell7/layout-contract";
import type { PictureView } from "./camera.ts";
import type { ImageSource } from "./images.ts";
import type { PaintImage, PaintOutline, PaintShape } from "./paint.ts";

const TURN = 2 * Math.PI;

/**
 * This function gives the rectangle of an image in an area. `width` and `height` are the size of the image, in pixels.
 *
 * - With the fit `contain`, all of the image is in the area. With `cover`, the image fills the area, and a part of it can be out of the area.
 * - `alignX` and `alignY` give the place of the image on each axis. With 0, the image starts at the start of the area. With 1, it ends at its end.
 *
 * The image keeps the ratio of its width to its height. An image with no size gets the area, and an area with no size too.
 */
export function imageRect(area: Rect, width: number, height: number, image: Pick<PaintImage, "fit" | "alignX" | "alignY">): Rect {
  if (!(width > 0) || !(height > 0) || !(area.w > 0) || !(area.h > 0)) return { x: area.x, y: area.y, w: area.w, h: area.h };
  const scale = image.fit === "cover" ? Math.max(area.w / width, area.h / height) : Math.min(area.w / width, area.h / height);
  const w = width * scale;
  const h = height * scale;
  return { x: area.x + (area.w - w) * image.alignX, y: area.y + (area.h - h) * image.alignY, w, h };
}

/** This function gives the bounds of an outline that can have an image: a rectangle or an ellipse. */
function imageArea(outline: PaintOutline): Rect | undefined {
  if (outline.kind === "rect") return { x: outline.x, y: outline.y, w: outline.w, h: outline.h };
  if (outline.kind === "ellipse") return { x: outline.cx - outline.rx, y: outline.cy - outline.ry, w: 2 * outline.rx, h: 2 * outline.ry };
  return undefined;
}

/** This function adds a path of the picture to the path of a context. */
function tracePath(context: CanvasRenderingContext2D, path: readonly PathSegment[]): void {
  for (const segment of path) {
    switch (segment.kind) {
      case "move":
        context.moveTo(segment.to.x, segment.to.y);
        break;
      case "line":
        context.lineTo(segment.to.x, segment.to.y);
        break;
      case "cubic":
        context.bezierCurveTo(segment.c1.x, segment.c1.y, segment.c2.x, segment.c2.y, segment.to.x, segment.to.y);
        break;
      case "arc":
        context.arc(segment.center.x, segment.center.y, segment.radius, segment.start, segment.start + segment.sweep, segment.sweep < 0);
        break;
    }
  }
}

/** This function makes the path of an outline in a context. */
function trace(context: CanvasRenderingContext2D, outline: PaintOutline): void {
  context.beginPath();
  switch (outline.kind) {
    case "rect":
      // An old browser has no round rectangle: its boxes get sharp corners.
      if (outline.radius > 0 && typeof context.roundRect === "function") context.roundRect(outline.x, outline.y, outline.w, outline.h, outline.radius);
      else context.rect(outline.x, outline.y, outline.w, outline.h);
      break;
    case "ellipse":
      context.ellipse(outline.cx, outline.cy, outline.rx, outline.ry, 0, 0, TURN);
      break;
    case "polygon":
      for (const ring of outline.rings) {
        ring.forEach(([x, y], i) => (i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
        context.closePath();
      }
      break;
    case "path":
      tracePath(context, outline.path);
      break;
  }
}

/**
 * This function draws a paint list on a canvas, in the order of the list. `paintPicture` makes the list.
 *
 * The unit of the context is the CSS pixel, as a flat stage gives it: the function applies the view of the camera.
 * The function keeps the state of the context: after it, the context has the transform and the styles that it had before.
 *
 * `images` gives the image of a shape by its address, for example `get` of an image store.
 * A shape whose image is not ready has no image in this drawing, and also each shape of a drawing with no `images`.
 */
export function drawShapes(context: CanvasRenderingContext2D, shapes: readonly PaintShape[], view: PictureView, images?: ImageSource): void {
  if (shapes.length === 0) return;
  context.save();
  context.transform(view.k, 0, 0, view.k, view.x, view.y);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.textBaseline = "middle";
  /** This value is true while the context has dashes. Most shapes have none, so the function sets them only at a change. */
  let dashed = false;
  for (const shape of shapes) {
    context.globalAlpha = shape.opacity;
    if (shape.type === "text") {
      context.font = shape.font;
      context.textAlign = shape.align;
      if (shape.halo !== undefined && dashed) {
        context.setLineDash([]);
        dashed = false;
      }
      const scale = shape.scale !== undefined && shape.scale > 0 ? shape.scale : 1;
      let { x, y } = shape;
      if (scale !== 1) {
        // The text is larger about its point: the point becomes the origin of the context.
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        x = 0;
        y = 0;
      }
      if (shape.halo !== undefined) {
        context.strokeStyle = shape.halo.color;
        context.lineWidth = shape.halo.width / scale;
        context.strokeText(shape.text, x, y);
      }
      context.fillStyle = shape.fill;
      context.fillText(shape.text, x, y);
      if (scale !== 1) context.restore();
      continue;
    }
    trace(context, shape.outline);
    if (shape.fill !== undefined) {
      context.fillStyle = shape.fill;
      // A hole of a polygon stays empty with this rule.
      context.fill("evenodd");
    }
    // An outline with no bounds for an image asks for no image.
    const area = shape.image === undefined || images === undefined ? undefined : imageArea(shape.outline);
    const ready = shape.image === undefined || images === undefined || area === undefined ? undefined : images(shape.image.src);
    if (shape.image !== undefined && area !== undefined && ready !== undefined) {
      const at = imageRect(area, ready.width, ready.height, shape.image);
      // The outline cuts the image. The path of the outline is not a part of the saved state, so it stays for the line.
      context.save();
      try {
        context.clip();
        context.imageSmoothingQuality = "high";
        context.drawImage(ready.source, at.x, at.y, at.w, at.h);
      } catch {
        // An image that the browser cannot draw has no paint. The shape keeps its inside and its line.
      }
      context.restore();
    }
    if (shape.stroke !== undefined && shape.lineWidth !== undefined && shape.lineWidth > 0) {
      const dash = shape.dash;
      const next = dash !== undefined && dash.length > 0;
      if (next || dashed) {
        context.setLineDash(next ? [...dash] : []);
        dashed = next;
      }
      context.strokeStyle = shape.stroke;
      context.lineWidth = shape.lineWidth;
      context.stroke();
    }
  }
  context.restore();
}
