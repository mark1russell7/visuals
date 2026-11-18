import type { PathSegment } from "@mark1russell7/layout-contract";
import type { PictureView } from "./camera.ts";
import type { PaintOutline, PaintShape } from "./paint.ts";

const TURN = 2 * Math.PI;

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
 */
export function drawShapes(context: CanvasRenderingContext2D, shapes: readonly PaintShape[], view: PictureView): void {
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
      if (shape.halo !== undefined) {
        if (dashed) {
          context.setLineDash([]);
          dashed = false;
        }
        context.strokeStyle = shape.halo.color;
        context.lineWidth = shape.halo.width;
        context.strokeText(shape.text, shape.x, shape.y);
      }
      context.fillStyle = shape.fill;
      context.fillText(shape.text, shape.x, shape.y);
      continue;
    }
    trace(context, shape.outline);
    if (shape.fill !== undefined) {
      context.fillStyle = shape.fill;
      // A hole of a polygon stays empty with this rule.
      context.fill("evenodd");
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
