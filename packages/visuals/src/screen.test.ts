import fc from "fast-check";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { screenPoint } from "./screen.ts";

/** This function makes a camera at a position that looks at a target, with its matrices set. */
function cameraAt(eye: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, fieldOfView: number, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(fieldOfView, aspect, 0.1, 500);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld();
  return camera;
}

describe("screenPoint", () => {
  const camera = cameraAt({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 0 }, 60, 2);
  const view = camera.matrixWorldInverse.elements;
  const projection = camera.projectionMatrix.elements;

  it("puts the point that the camera looks at in the middle of the picture", () => {
    const at = screenPoint({ x: 0, y: 0, z: 0 }, view, projection, 800, 400);
    expect(at?.x).toBeCloseTo(400, 9);
    expect(at?.y).toBeCloseTo(200, 9);
  });

  it("has the y axis of the picture down, and the x axis to the right", () => {
    const up = screenPoint({ x: 0, y: 1, z: 0 }, view, projection, 800, 400);
    const right = screenPoint({ x: 1, y: 0, z: 0 }, view, projection, 800, 400);
    expect(up?.y).toBeLessThan(200);
    expect(up?.x).toBeCloseTo(400, 9);
    expect(right?.x).toBeGreaterThan(400);
    expect(right?.y).toBeCloseTo(200, 9);
  });

  it("puts a point on the top edge of the view at the top of the picture", () => {
    // At a distance of 10 and a vertical angle of 60 degrees, the top edge is at the height 10 tan 30.
    const top = screenPoint({ x: 0, y: 10 * Math.tan(Math.PI / 6), z: 0 }, view, projection, 800, 400);
    expect(top?.y).toBeCloseTo(0, 9);
  });

  it("gives undefined for a point behind the camera, and for a point at the camera", () => {
    expect(screenPoint({ x: 0, y: 0, z: 11 }, view, projection, 800, 400)).toBeUndefined();
    expect(screenPoint({ x: 0, y: 0, z: 10 }, view, projection, 800, 400)).toBeUndefined();
  });

  it("gives a position out of the picture for a point to the side of the view", () => {
    const side = screenPoint({ x: 100, y: 0, z: 0 }, view, projection, 800, 400);
    expect(side?.x).toBeGreaterThan(800);
  });

  it("agrees with the projection of three.js", () => {
    const coordinate = fc.double({ min: -20, max: 20, noNaN: true });
    const anyPoint = fc.record({ x: coordinate, y: coordinate, z: coordinate });
    fc.assert(
      fc.property(anyPoint, anyPoint, anyPoint, fc.double({ min: 10, max: 90, noNaN: true }), fc.double({ min: 0.4, max: 3, noNaN: true }), (eye, target, point, angle, aspect) => {
        const toTarget = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
        // A camera needs a direction. A view along the up axis has no stable right side in three.js.
        fc.pre(toTarget > 0.5 && Math.hypot(target.x - eye.x, target.z - eye.z) > 0.1);
        const lens = cameraAt(eye, target, angle, aspect);
        const depth = new Vector3(point.x, point.y, point.z).applyMatrix4(lens.matrixWorldInverse).z;
        // Near the plane of the camera, a small change of the point gives a large change of the picture.
        fc.pre(Math.abs(depth) > 0.01);
        const width = 600 * aspect;
        const ours = screenPoint(point, lens.matrixWorldInverse.elements, lens.projectionMatrix.elements, width, 600);
        if (depth > 0) {
          expect(ours).toBeUndefined();
          return;
        }
        const theirs = new Vector3(point.x, point.y, point.z).project(lens);
        const scale = Math.max(1, Math.abs(theirs.x), Math.abs(theirs.y));
        expect(Math.abs((ours?.x ?? Number.NaN) - ((theirs.x + 1) / 2) * width)).toBeLessThan(1e-6 * width * scale);
        expect(Math.abs((ours?.y ?? Number.NaN) - ((1 - theirs.y) / 2) * 600)).toBeLessThan(1e-6 * 600 * scale);
      }),
    );
  });
});
