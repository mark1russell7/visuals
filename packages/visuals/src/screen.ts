import type { Point, Point3 } from "@mark1russell7/layout-contract";

/** This function gives one row of the product of a matrix and a vector of four values. The matrix has 16 numbers, one column after the other. */
function row(matrix: ArrayLike<number>, at: number, x: number, y: number, z: number, w: number): number {
  return (matrix[at] ?? 0) * x + (matrix[at + 4] ?? 0) * y + (matrix[at + 8] ?? 0) * z + (matrix[at + 12] ?? 0) * w;
}

/**
 * This function gives the point of a picture that shows a point of the world, in CSS pixels from the top left corner.
 * It gives `undefined` for a point that is not in front of a camera with perspective.
 *
 * - `view` is the matrix from the world to the camera: `matrixWorldInverse.elements` of a three.js camera.
 * - `projection` is the matrix of the lens of the camera: `projectionMatrix.elements` of a three.js camera.
 * - Each matrix has 16 numbers, one column after the other. This is the sequence of three.js and of WebGL.
 * - A point to the side of the picture gives a position out of the picture. The function does not remove it.
 */
export function screenPoint(point: Point3, view: ArrayLike<number>, projection: ArrayLike<number>, width: number, height: number): Point | undefined {
  const x = row(view, 0, point.x, point.y, point.z, 1);
  const y = row(view, 1, point.x, point.y, point.z, 1);
  const z = row(view, 2, point.x, point.y, point.z, 1);
  const w = row(view, 3, point.x, point.y, point.z, 1);
  const depth = row(projection, 3, x, y, z, w);
  if (!(depth > 0)) return undefined;
  return {
    x: ((row(projection, 0, x, y, z, w) / depth + 1) / 2) * width,
    y: ((1 - row(projection, 1, x, y, z, w) / depth) / 2) * height,
  };
}
