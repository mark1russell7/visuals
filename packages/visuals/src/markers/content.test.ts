import fc from "fast-check";
import { Color, PerspectiveCamera, Raycaster, Vector3, type BufferGeometry, type DataTexture, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from "three";
import { describe, expect, it } from "vitest";
import type { Highlight } from "../highlight.ts";
import type { Mark, PointMark, RunMark } from "../marks/mark.ts";
import { FIELD, LINK, METER, POINT, RUN, SAMPLE_MARKS } from "../marks/sample.ts";
import type { StageFrame } from "../stage/stage.ts";
import { SIGN_RADIUS, createMarkers, signReach, type MarkersContent, type MarkersTheme } from "./content.ts";

const theme: MarkersTheme = {
  sky: "#ffffff",
  ground: "#808080",
  levels: { unknown: "#55677a", ok: "#1f5fa8", near: "#d9662f", over: "#c62f2f" },
  halo: "#ffffff",
  accent: "#f2b705",
  field: ["#000000", "#ff0000", "#ffffff"],
};

const noHighlight = (): Highlight => 0;
const only =
  (record: string, highlight: Highlight) =>
  (name: string): Highlight =>
    name === record ? highlight : 0;

/** The length of one CSS pixel at the distance 1 from a camera with the angle 32 and a picture of 600 pixels. */
const PIXEL = (2 * Math.tan((32 * Math.PI) / 360)) / 600;

/** This function gives the meshes of a content with one render order. */
function meshesAt(content: MarkersContent, order: number): Mesh[] {
  return (content.objects as readonly Mesh[]).filter((mesh) => mesh.renderOrder === order);
}

/** This function gives the mesh of a content with one render order. */
function meshAt<M extends Mesh = Mesh>(content: MarkersContent, order: number): M {
  const [mesh] = meshesAt(content, order);
  if (mesh === undefined) throw new Error(`no mesh with the render order ${String(order)}`);
  return mesh as M;
}

const segmentsOf = (content: MarkersContent): BufferGeometry => meshAt(content, 9).geometry;
const signsOf = (content: MarkersContent): BufferGeometry => meshAt(content, 11).geometry;
const fieldOf = (content: MarkersContent): Mesh<BufferGeometry, MeshBasicMaterial> => meshAt(content, 7);

/** This function gives the values of one instance of an attribute. */
function row(geometry: BufferGeometry, name: string, index: number): number[] {
  const attribute = geometry.getAttribute(name);
  return Array.from(attribute.array.slice(index * attribute.itemSize, (index + 1) * attribute.itemSize));
}

/** This function examines a list of numbers that an attribute keeps with 32 bits. */
function near(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 5);
  });
}

/** This function gives the three values that an attribute has for a color. */
function rgb(hex: string): number[] {
  const color = new Color(hex);
  return [color.r, color.g, color.b];
}

/** This function makes a camera at a point that looks at a second point. */
function cameraAt(eye: Vector3, target: Vector3, up: Vector3 = new Vector3(0, 0, 1)): PerspectiveCamera {
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.up.copy(up);
  camera.position.copy(eye);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

const frameOf = (camera: PerspectiveCamera): StageFrame => ({ camera, seconds: 0, settle: true, height: 600, fieldOfView: 32 });

/** This function makes the ray from a point through a second point. */
function rayFrom(eye: Vector3, to: Vector3): Raycaster {
  const ray = new Raycaster();
  ray.set(eye, to.clone().sub(eye).normalize());
  return ray;
}

/** The camera in front of the wall of the sample point, 5 from the point. */
const FRONT = new Vector3(1, 5, 0.3);
const AT_POINT = new Vector3(1, 0, 0.3);
/**
 * This function gives the reach of the pick of the sample run, at a depth in front of the camera.
 * The reach is half of the width of the run, the casing of 1.5 pixels and the margin of 4 pixels.
 */
const reachAt = (depth: number): number => RUN.width / 2 + 5.5 * PIXEL * depth;

/** The camera above the floor of the sample field, 5 from the floor. */
const ABOVE = new Vector3(0.25, 0.25, 5);

/** This function makes the content of the sample marks, with a picture from a camera. */
function sample(eye: Vector3 = FRONT, target: Vector3 = AT_POINT, marks: readonly Mark[] = SAMPLE_MARKS): MarkersContent {
  const content = createMarkers(marks, { lift: 0.01 });
  content.paint(theme, noHighlight);
  content.step?.(frameOf(cameraAt(eye, target, eye === ABOVE ? new Vector3(0, 1, 0) : undefined)));
  return content;
}

describe("createMarkers", () => {
  it("has the records of the marks that have a place", () => {
    const content = createMarkers(SAMPLE_MARKS);
    for (const mark of [POINT, RUN, LINK, FIELD]) expect(content.has(mark.record)).toBe(true);
    expect(content.has(METER.record)).toBe(false);
    expect(content.has("other")).toBe(false);
  });

  it("has the box of the points of the marks as its extent", () => {
    const { extent } = createMarkers(SAMPLE_MARKS);
    expect(extent.center).toEqual({ x: 1, y: 1, z: 1.2 });
    expect(extent.corners).toHaveLength(8);
    expect(extent.corners).toContainEqual({ x: 0, y: 0, z: 0 });
    expect(extent.corners).toContainEqual({ x: 2, y: 2, z: 2.4 });
    expect(extent.corners).toContainEqual({ x: 2, y: 0, z: 2.4 });
  });

  it("has no corner and no picture for a list with no placed mark", () => {
    const content = createMarkers([METER]);
    expect(content.extent).toEqual({ center: { x: 0, y: 0, z: 0 }, corners: [] });
    expect(content.objects).toHaveLength(4);
    for (const mesh of content.objects) expect(mesh.visible).toBe(false);
    content.paint(theme, noHighlight);
    expect(content.pick(rayFrom(FRONT, AT_POINT))).toBeUndefined();
  });

  it("ignores a field with a grid that a texture cannot hold", () => {
    const content = createMarkers([
      { ...FIELD, record: "no-columns", columns: 0 },
      { ...FIELD, record: "half-row", rows: 1.5 },
      { ...FIELD, record: "no-cell", cell: 0 },
    ]);
    expect(content.has("no-columns")).toBe(false);
    expect(content.has("half-row")).toBe(false);
    expect(content.has("no-cell")).toBe(false);
    expect(meshesAt(content, 7)).toHaveLength(0);
  });

  it("draws each mesh two times: behind the solids with no depth test, then in sight", () => {
    const content = createMarkers(SAMPLE_MARKS);
    for (const [behind, front] of [
      [8, 9],
      [10, 11],
    ] as const) {
      const first = meshAt<Mesh<BufferGeometry, ShaderMaterial>>(content, behind);
      const second = meshAt<Mesh<BufferGeometry, ShaderMaterial>>(content, front);
      expect(first.geometry).toBe(second.geometry);
      expect(first.material.depthTest).toBe(false);
      expect(first.material.uniforms["behind"]?.value).toBe(1);
      expect(second.material.depthTest).toBe(true);
      expect(second.material.uniforms["behind"]?.value).toBe(0);
      for (const mesh of [first, second]) {
        expect(mesh.material.depthWrite).toBe(false);
        expect(mesh.material.transparent).toBe(true);
        expect(mesh.frustumCulled).toBe(false);
        expect(mesh.visible).toBe(true);
      }
    }
    // The sequence of the objects is the sequence of the picture: the field, the lines, the signs.
    expect((content.objects as readonly Mesh[]).map((mesh) => mesh.renderOrder)).toEqual([7, 8, 9, 10, 11]);
  });

  describe("a point", () => {
    it("is a sign at its point, with the outline of its level", () => {
      const signs = signsOf(sample());
      expect((signs as BufferGeometry & { instanceCount: number }).instanceCount).toBe(1);
      near(row(signs, "center", 0), [1, 0, 0.3]);
      // The depth of the sign comes from a point above its surface.
      near(row(signs, "lifted", 0), [1, 0.01, 0.3]);
      // The level `ok` is a disc: the radius 1, a circle, no hole.
      near(row(signs, "outline", 0), [1, 40, 0, 0]);
    });

    it("has the color of its level, a line of the color of the page, and less color behind a solid", () => {
      const signs = signsOf(sample());
      near(row(signs, "fill", 0), rgb("#1f5fa8"));
      near(row(signs, "ring", 0), rgb("#ffffff"));
      near(row(signs, "look", 0), [SIGN_RADIUS, 0, 1, 0.45]);
    });

    it("is larger, solid and in the accent color with a highlight", () => {
      const content = sample();
      content.paint(theme, only(POINT.record, 1));
      near(row(signsOf(content), "ring", 0), rgb("#f2b705"));
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS * 1.15, 0, 1, 1]);
      content.paint(theme, only(POINT.record, 2));
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS * 1.3, 0, 1, 1]);
      content.paint(theme, noHighlight);
      near(row(signsOf(content), "ring", 0), rgb("#ffffff"));
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS, 0, 1, 0.45]);
    });

    it("uses the radius of the options for a point with no size", () => {
      const content = createMarkers([POINT], { signRadius: 10 });
      content.paint(theme, noHighlight);
      near(row(signsOf(content), "look", 0), [10, 0, 1, 0.45]);
    });

    it("has its size in the space when the mark has a size", () => {
      const content = createMarkers([{ ...POINT, size: 0.4 }]);
      content.paint(theme, noHighlight);
      near(row(signsOf(content), "look", 0), [0, 0.2, 1, 0.45]);
      content.paint(theme, only(POINT.record, 2));
      near(row(signsOf(content), "look", 0), [0, 0.26, 1, 1]);
    });
  });

  describe("a run", () => {
    it("is a line through its points, at half of its width above its surfaces", () => {
      const segments = segmentsOf(sample());
      // 2 parts of the line around the run, 2 parts of the run, 4 sides of the field and 1 link.
      expect((segments as BufferGeometry & { instanceCount: number }).instanceCount).toBe(9);
      for (const first of [0, 2]) {
        near(row(segments, "start", first), [1, 0.01, 0.3]);
        near(row(segments, "finish", first), [1, 0.01, 2.4]);
        near(row(segments, "start", first + 1), [1, 0.01, 2.4]);
        near(row(segments, "finish", first + 1), [1, 2, 2.39]);
      }
    });

    it("has the color of its level on a line of the color of the page", () => {
      const segments = segmentsOf(sample());
      for (const part of [0, 1]) {
        near(row(segments, "fill", part), rgb("#ffffff"));
        // 1.5 pixels more than the run on each side.
        near(row(segments, "wide", part), [1.5, 0.01, 1]);
        near(row(segments, "shade", part), [1, 0.45]);
        near(row(segments, "dash", part), [0, 0]);
      }
      for (const part of [2, 3]) {
        near(row(segments, "fill", part), rgb("#d9662f"));
        near(row(segments, "wide", part), [0, 0.01, 1]);
        near(row(segments, "shade", part), [1, 0.45]);
      }
    });

    it("has a wider line in the accent color, and is solid, with a highlight", () => {
      const content = sample();
      content.paint(theme, only(RUN.record, 1));
      near(row(segmentsOf(content), "fill", 0), rgb("#f2b705"));
      near(row(segmentsOf(content), "wide", 0), [2.5, 0.01, 1]);
      near(row(segmentsOf(content), "shade", 0), [1, 1]);
      near(row(segmentsOf(content), "fill", 2), rgb("#d9662f"));
      near(row(segmentsOf(content), "shade", 3), [1, 1]);
      content.paint(theme, only(RUN.record, 2));
      near(row(segmentsOf(content), "wide", 1), [3, 0.01, 1]);
    });

    it("has no line for a path of one point", () => {
      const [first] = RUN.path;
      if (first === undefined) throw new Error("the sample run has no point");
      const content = createMarkers([{ ...RUN, path: [first] }]);
      content.paint(theme, noHighlight);
      expect(content.has(RUN.record)).toBe(true);
      expect(meshAt(content, 9).visible).toBe(false);
      expect(content.pick(rayFrom(FRONT, AT_POINT))).toBeUndefined();
    });
  });

  describe("a link", () => {
    it("is a dashed line between its ends, in the color of its level", () => {
      const segments = segmentsOf(sample());
      near(row(segments, "start", 8), [1, 0, 0.3]);
      near(row(segments, "finish", 8), [2, 1, 0.7]);
      near(row(segments, "fill", 8), rgb("#55677a"));
      near(row(segments, "wide", 8), [1, 0, 0]);
      near(row(segments, "dash", 8), [6, 4]);
    });

    it("is in the picture only while its record or the record of one end has a highlight", () => {
      const content = sample();
      near(row(segmentsOf(content), "shade", 8), [0, 0]);
      for (const record of [LINK.record, LINK.from.record, LINK.to.record]) {
        content.paint(theme, only(record, 1));
        // A link is solid also behind a solid: one of its ends can be there.
        near(row(segmentsOf(content), "shade", 8), [1, 1]);
      }
      content.paint(theme, only(RUN.record, 2));
      near(row(segmentsOf(content), "shade", 8), [0, 0]);
    });

    it("uses the width and the dash of the options", () => {
      const content = createMarkers([LINK], { linkWidth: 6, linkDash: [2, 3] });
      content.paint(theme, noHighlight);
      near(row(segmentsOf(content), "wide", 0), [3, 0, 0]);
      near(row(segmentsOf(content), "dash", 0), [2, 3]);
    });

    it("gets no pick", () => {
      const content = createMarkers([LINK]);
      content.paint(theme, only(LINK.record, 2));
      const middle = new Vector3(1.5, 0.5, 0.5);
      expect(content.pick(rayFrom(new Vector3(1.5, 5, 0.5), middle))).toBeUndefined();
    });
  });

  describe("a field", () => {
    it("is a square on its plane, above its surface", () => {
      const mesh = fieldOf(sample());
      const positions = Array.from(mesh.geometry.getAttribute("position").array);
      near(positions, [0, 0, 0.01, 1.5, 0, 0.01, 1.5, 1, 0.01, 0, 1, 0.01]);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.opacity).toBe(0.8);
    });

    it("gives each cell a color between the colors of the theme, and no color for a cell with no value", () => {
      const texture = fieldOf(sample()).material.map as DataTexture;
      expect(texture.image.width).toBe(3);
      expect(texture.image.height).toBe(2);
      // The values 100, 200, 300, 400, no value and 600 on a scale from 0 to 600, with black, red and white.
      expect(Array.from(texture.image.data as Uint8Array)).toEqual([
        ...[85, 0, 0, 255],
        ...[170, 0, 0, 255],
        ...[255, 0, 0, 255],
        ...[255, 85, 85, 255],
        ...[0, 0, 0, 0],
        ...[255, 255, 255, 255],
      ]);
    });

    it("keeps a value out of the scale at the end of the scale", () => {
      const content = createMarkers([{ ...FIELD, values: [-50, 900, 0, 600, 300, 300] }]);
      content.paint(theme, noHighlight);
      const data = Array.from((fieldOf(content).material.map as DataTexture).image.data as Uint8Array);
      expect(data.slice(0, 8)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    });

    it("has the color of its level when the theme has no color for a field", () => {
      const content = createMarkers([FIELD]);
      content.paint({ ...theme, field: [] }, noHighlight);
      const data = Array.from((fieldOf(content).material.map as DataTexture).image.data as Uint8Array);
      expect(data.slice(0, 4)).toEqual([0x1f, 0x5f, 0xa8, 255]);
      expect(data.slice(16, 20)).toEqual([0, 0, 0, 0]);
    });

    it("has one color for each value when the theme has one color for a field", () => {
      const content = createMarkers([FIELD]);
      content.paint({ ...theme, field: ["#336699"] }, noHighlight);
      const data = Array.from((fieldOf(content).material.map as DataTexture).image.data as Uint8Array);
      expect(data.slice(0, 4)).toEqual([0x33, 0x66, 0x99, 255]);
      expect(data.slice(20, 24)).toEqual([0x33, 0x66, 0x99, 255]);
    });

    it("uses the opacity of the theme, from 0 to 1", () => {
      const content = createMarkers([FIELD]);
      content.paint({ ...theme, fieldOpacity: 0.5 }, noHighlight);
      expect(fieldOf(content).material.opacity).toBe(0.5);
      content.paint({ ...theme, fieldOpacity: 4 }, noHighlight);
      expect(fieldOf(content).material.opacity).toBe(1);
    });

    it("writes the colors again only for a new theme", () => {
      const content = createMarkers([FIELD]);
      const texture = fieldOf(content).material.map as DataTexture;
      content.paint(theme, noHighlight);
      const version = texture.version;
      content.paint(theme, only(FIELD.record, 1));
      expect(texture.version).toBe(version);
      content.paint({ ...theme }, noHighlight);
      expect(texture.version).toBeGreaterThan(version);
    });

    it("has a line around it in the accent color only with a highlight", () => {
      const content = sample();
      const corners = [
        [0, 0, 0.01],
        [1.5, 0, 0.01],
        [1.5, 1, 0.01],
        [0, 1, 0.01],
      ] as const;
      corners.forEach((corner, side) => {
        near(row(segmentsOf(content), "start", 4 + side), corner);
        near(row(segmentsOf(content), "finish", 4 + side), corners[(side + 1) % 4] ?? []);
        near(row(segmentsOf(content), "fill", 4 + side), rgb("#f2b705"));
        near(row(segmentsOf(content), "shade", 4 + side), [0, 0]);
      });
      content.paint(theme, only(FIELD.record, 1));
      near(row(segmentsOf(content), "wide", 4), [1, 0, 0]);
      near(row(segmentsOf(content), "shade", 4), [1, 0.45]);
      content.paint(theme, only(FIELD.record, 2));
      near(row(segmentsOf(content), "wide", 7), [1.5, 0, 0]);
      near(row(segmentsOf(content), "shade", 7), [1, 0.45]);
    });
  });

  describe("pick", () => {
    it("gives the sign under the pointer, with no distance", () => {
      const content = sample();
      expect(content.pick(rayFrom(FRONT, AT_POINT))).toEqual({ record: POINT.record, value: POINT });
      // 0.04 from the center: in the radius of 7 pixels and the margin of 4 pixels, which are 0.0526 at this distance.
      expect(content.pick(rayFrom(FRONT, new Vector3(1.04, 0, 0.3)))?.record).toBe(POINT.record);
      expect(11 * PIXEL * 5).toBeCloseTo(0.0526, 4);
    });

    it("gives no record for a pointer on no mark", () => {
      expect(sample().pick(rayFrom(FRONT, new Vector3(1.2, 0, 0.3)))).toBeUndefined();
    });

    it("finds a sign before the first picture", () => {
      const content = createMarkers(SAMPLE_MARKS);
      content.paint(theme, noHighlight);
      expect(content.pick(rayFrom(FRONT, AT_POINT))?.record).toBe(POINT.record);
    });

    it("gives the sign nearest to the pointer", () => {
      const second: PointMark = { ...POINT, record: "second", frame: { ...POINT.frame, at: { x: 1.03, y: 0, z: 0.3 } } };
      const content = sample(FRONT, AT_POINT, [POINT, second]);
      expect(content.pick(rayFrom(FRONT, new Vector3(1.02, 0, 0.3)))?.record).toBe("second");
      expect(content.pick(rayFrom(FRONT, new Vector3(1.005, 0, 0.3)))?.record).toBe(POINT.record);
    });

    it("finds a sign with a size by its size in the space, also with its highlight", () => {
      const sized: PointMark = { ...POINT, size: 0.4 };
      const content = sample(FRONT, AT_POINT, [sized]);
      // The radius is 0.2, and the margin of 4 pixels is 0.019 at this distance.
      expect(content.pick(rayFrom(FRONT, new Vector3(1.21, 0, 0.3)))?.record).toBe(POINT.record);
      expect(content.pick(rayFrom(FRONT, new Vector3(1.25, 0, 0.3)))).toBeUndefined();
      content.paint(theme, only(POINT.record, 2));
      expect(content.pick(rayFrom(FRONT, new Vector3(1.25, 0, 0.3)))?.record).toBe(POINT.record);
    });

    it("gives no record for a sign behind the camera", () => {
      const eye = new Vector3(1, -5, 0.3);
      const content = sample(eye, new Vector3(1, -10, 0.3), [POINT]);
      expect(content.pick(rayFrom(eye, new Vector3(1, -10, 0.3)))).toBeUndefined();
    });

    it("gives a run with the distance to its side that is nearest to the camera", () => {
      const pick = sample().pick(rayFrom(FRONT, new Vector3(1, 0, 1.5)));
      expect(pick?.record).toBe(RUN.record);
      expect(pick?.value).toBe(RUN);
      // The ray goes across the center line of the run 0.01 before the wall, at a depth of 4.99.
      expect(pick?.distance).toBeCloseTo(FRONT.distanceTo(new Vector3(1, 0.01, 0.3 + (1.2 * 4.99) / 5)) - reachAt(4.99), 6);
      expect(reachAt(4.99)).toBeCloseTo(0.0362, 4);
    });

    it("gives a field with the distance to its plane, for a cell with a value", () => {
      const content = sample(ABOVE, new Vector3(0.25, 0.25, 0));
      const pick = content.pick(rayFrom(ABOVE, new Vector3(0.25, 0.25, 0)));
      expect(pick?.record).toBe(FIELD.record);
      expect(pick?.value).toBe(FIELD);
      expect(pick?.distance).toBeCloseTo(4.99, 9);
    });

    it("gives no record for a cell with no value, and for a point out of the grid", () => {
      const content = sample(ABOVE, new Vector3(0.25, 0.25, 0));
      expect(content.pick(rayFrom(ABOVE, new Vector3(0.75, 0.75, 0)))).toBeUndefined();
      expect(content.pick(rayFrom(ABOVE, new Vector3(-0.2, 0.25, 0)))).toBeUndefined();
      expect(content.pick(rayFrom(ABOVE, new Vector3(0.25, 1.2, 0)))).toBeUndefined();
    });

    it("gives a run before a field, also where the ray comes to the field first", () => {
      const onFloor: RunMark = {
        ...RUN,
        record: "on-floor",
        path: [
          { at: { x: 0, y: 0.25, z: 0 }, out: { x: 0, y: 0, z: 1 } },
          { at: { x: 1.5, y: 0.25, z: 0 }, out: { x: 0, y: 0, z: 1 } },
        ],
      };
      const content = createMarkers([FIELD, onFloor], { lift: 0.001 });
      content.paint(theme, noHighlight);
      content.step?.(frameOf(cameraAt(ABOVE, new Vector3(0.25, 0.25, 0), new Vector3(0, 1, 0))));
      const onRun = content.pick(rayFrom(ABOVE, new Vector3(0.25, 0.25, 0)));
      expect(onRun?.record).toBe("on-floor");
      expect(onRun?.distance).toBeCloseTo(4.99 - reachAt(4.99), 9);
      const beside = content.pick(rayFrom(ABOVE, new Vector3(0.25, 0.4, 0)));
      expect(beside?.record).toBe(FIELD.record);
      // From a low camera, the ray comes to the floor before it comes to the center of the run.
      const low = new Vector3(0.25, -3, 1);
      content.step?.(frameOf(cameraAt(low, new Vector3(0.25, 0.25, 0))));
      const ray = rayFrom(low, new Vector3(0.25, 0.24, 0));
      const onFloorFirst = content.pick(ray);
      expect(onFloorFirst?.record).toBe("on-floor");
      const floor = createMarkers([FIELD], { lift: 0.001 });
      floor.paint(theme, noHighlight);
      floor.step?.(frameOf(cameraAt(low, new Vector3(0.25, 0.25, 0))));
      const onField = floor.pick(ray);
      expect(onField?.record).toBe(FIELD.record);
      expect(onField?.distance).toBeLessThan((onFloorFirst?.distance ?? 0) + reachAt(3.4));
    });

    it("gives the sign for each point of a list, from each camera in front of the points", () => {
      const anyPlace = fc.record({ x: fc.integer({ min: -8, max: 8 }), z: fc.integer({ min: -8, max: 8 }) });
      const anyEye = fc.record({ x: fc.double({ min: -3, max: 3, noNaN: true }), y: fc.double({ min: 6, max: 20, noNaN: true }), z: fc.double({ min: -3, max: 3, noNaN: true }) });
      fc.assert(
        fc.property(fc.uniqueArray(anyPlace, { minLength: 1, maxLength: 6, selector: (place) => `${String(place.x)},${String(place.z)}` }), anyEye, (places, at) => {
          const marks = places.map((place, index): PointMark => ({ ...POINT, record: `point-${String(index)}`, frame: { at: { x: place.x / 4, y: 0, z: place.z / 4 }, out: { x: 0, y: 1, z: 0 } } }));
          const eye = new Vector3(at.x, at.y, at.z);
          const content = createMarkers(marks);
          content.paint(theme, noHighlight);
          content.step?.(frameOf(cameraAt(eye, new Vector3(0, 0, 0))));
          for (const mark of marks) {
            const pick = content.pick(rayFrom(eye, new Vector3(mark.frame.at.x, mark.frame.at.y, mark.frame.at.z)));
            expect(pick?.record).toBe(mark.record);
            expect(pick?.distance).toBeUndefined();
          }
        }),
      );
    });
  });

  describe("show", () => {
    it("removes the marks that the test refuses from the picture and from the picks", () => {
      const content = sample();
      content.show((mark) => mark.type !== "point");
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS, 0, 0, 0]);
      // The run starts at the point, so the run is the record there.
      const pick = content.pick(rayFrom(FRONT, AT_POINT));
      expect(pick?.record).toBe(RUN.record);
      expect(pick?.distance).toBeCloseTo(4.99 - reachAt(4.99), 9);
      content.show(() => false);
      expect(content.pick(rayFrom(FRONT, AT_POINT))).toBeUndefined();
      near(row(segmentsOf(content), "shade", 0), [0, 0]);
      near(row(segmentsOf(content), "shade", 2), [0, 0]);
      expect(fieldOf(content).visible).toBe(false);
    });

    it("removes a field from the picks, and its line with a highlight", () => {
      const content = sample(ABOVE, new Vector3(0.25, 0.25, 0));
      content.paint(theme, only(FIELD.record, 2));
      content.show((mark) => mark.type !== "field");
      expect(content.pick(rayFrom(ABOVE, new Vector3(0.25, 0.25, 0)))).toBeUndefined();
      near(row(segmentsOf(content), "shade", 4), [0, 0]);
    });

    it("keeps a link out of the picture when the test refuses it, also with a highlight", () => {
      const content = sample();
      content.show((mark) => mark.type !== "link");
      content.paint(theme, only(LINK.record, 2));
      near(row(segmentsOf(content), "shade", 8), [0, 0]);
      content.show(() => true);
      near(row(segmentsOf(content), "shade", 8), [1, 1]);
    });

    it("keeps the test for the next paint, also when it comes before the first paint", () => {
      const content = createMarkers(SAMPLE_MARKS);
      content.show((mark) => mark.kind !== POINT.kind);
      content.paint(theme, noHighlight);
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS, 0, 0, 0]);
      content.show(() => true);
      near(row(signsOf(content), "look", 0), [SIGN_RADIUS, 0, 1, 0.45]);
      expect(fieldOf(content).visible).toBe(true);
    });
  });

  it("gets the size of a pixel from each picture, and does not ask for a next picture", () => {
    const content = createMarkers(SAMPLE_MARKS);
    expect(content.step?.(frameOf(cameraAt(FRONT, AT_POINT)))).toBe(false);
    for (const order of [8, 9, 10, 11]) {
      expect(meshAt<Mesh<BufferGeometry, ShaderMaterial>>(content, order).material.uniforms["pixelAngle"]?.value).toBeCloseTo(PIXEL, 12);
    }
    content.step?.({ ...frameOf(cameraAt(FRONT, AT_POINT)), height: 300, fieldOfView: 60 });
    expect(meshAt<Mesh<BufferGeometry, ShaderMaterial>>(content, 11).material.uniforms["pixelAngle"]?.value).toBeCloseTo((2 * Math.tan(Math.PI / 6)) / 300, 12);
  });

  it("releases each geometry, each material and each texture", () => {
    const content = createMarkers(SAMPLE_MARKS);
    const released: string[] = [];
    const field = fieldOf(content);
    const watch = (name: string, target: { addEventListener(type: "dispose", listener: () => void): void }): void => {
      target.addEventListener("dispose", () => released.push(name));
    };
    watch("signs", signsOf(content));
    watch("segments", segmentsOf(content));
    for (const order of [8, 9, 10, 11]) watch(`material ${String(order)}`, meshAt<Mesh<BufferGeometry, ShaderMaterial>>(content, order).material);
    watch("field", field.geometry);
    watch("field material", field.material);
    watch("field texture", field.material.map as DataTexture);
    content.dispose();
    expect(released.sort()).toEqual(["field", "field material", "field texture", "material 10", "material 11", "material 8", "material 9", "segments", "signs"]);
  });
});

describe("signReach", () => {
  it("gives the radius of a sign with the line around it", () => {
    // A circle: the radius 1 and the line of 0.36.
    expect(signReach("ok")).toBeCloseTo(SIGN_RADIUS * 1.36, 9);
    expect(signReach("unknown")).toBeCloseTo(SIGN_RADIUS * 1.36, 9);
    // A shape with corners: the line is 0.36 from each side, so its corner is farther from the center.
    expect(signReach("near")).toBeCloseTo(SIGN_RADIUS * (1.3 + 0.36 / Math.cos(Math.PI / 3)), 9);
    expect(signReach("over")).toBeCloseTo(SIGN_RADIUS * (1.25 + 0.36 / Math.cos(Math.PI / 4)), 9);
  });

  it("uses the radius of the caller", () => {
    expect(signReach("ok", 10)).toBeCloseTo(13.6, 9);
  });
});
