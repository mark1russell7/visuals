import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Plane,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Object3D,
} from "three";
import type { Point3 } from "@mark1russell7/layout-contract";
import type { Highlight } from "../highlight.ts";
import { SHAPE_OUTLINES, levelShape, type Level, type ShapeOutline } from "../marks/levels.ts";
import { fieldRowStep, fieldValue, type FieldMark, type LinkMark, type Mark, type PointMark, type RunMark } from "../marks/mark.ts";
import type { StageContent, StageFrame, StagePick } from "../stage/stage.ts";
import type { StageTheme } from "../theme.ts";
import { FIELD_OF_VIEW } from "../view.ts";

/** The colors of the marks of a stage. Each color is a CSS hex color, for example `#22364a`. */
export interface MarkersTheme extends StageTheme {
  /** The color of the marks of each level. */
  readonly levels: Readonly<Record<Level, string>>;
  /** The color of the line around a sign and around a run. Give the color of the page, so a mark is clear on each solid. */
  readonly halo: string;
  /** The color of the line around a mark whose record has a highlight. */
  readonly accent: string;
  /**
   * The colors of a field, from the value `min` of its scale to the value `max`.
   * A value between two colors gets a mix of them. A list with no color gives the color of the level of the field.
   */
  readonly field: readonly string[];
  /** The part of a field that is not clear, from 0 to 1. The default is 0.8. */
  readonly fieldOpacity?: number | undefined;
}

/** The options of the marks of a stage. */
export interface MarkersOptions {
  /** The radius of the sign of a point with no size, in CSS pixels. The default is `SIGN_RADIUS`. */
  readonly signRadius?: number | undefined;
  /** The width of the line of a link, in CSS pixels. The default is 2. */
  readonly linkWidth?: number | undefined;
  /** The lengths of a dash and of a gap of a link, in CSS pixels. The default is a dash of 6 and a gap of 4. */
  readonly linkDash?: readonly [dash: number, gap: number] | undefined;
  /**
   * The distance of a sign and of a field from their surface, in the unit of the space.
   * It is only for the test of what hides a mark: the surface of a mark does not hide it.
   * The default is 1/400 of the size of the space of the marks.
   */
  readonly lift?: number | undefined;
}

/** The content of a stage that draws marks. The value of a pick is the mark. */
export interface MarkersContent extends StageContent<Mark, MarkersTheme> {
  /**
   * This function shows only the marks that a test accepts, for example the marks of one kind. A mark that the picture does not show gets no pick.
   * Start `refresh` of the stage after it. A test that accepts each mark shows all of them again.
   */
  show(test: (mark: Mark) => boolean): void;
}

/** The radius of the sign of a point with no size, in CSS pixels. The sign of a disc has this radius. */
export const SIGN_RADIUS = 7;

/** The width of the line around a sign, as a part of the radius of the sign. */
const HALO = 0.36;

/** The width of the line around a run, in CSS pixels, for each highlight. */
const CASING: readonly [number, number, number] = [1.5, 2.5, 3];

/** The size of a sign for each highlight, as a multiple of its size. */
const HIGHLIGHT_SIZE: readonly [number, number, number] = [1, 1.15, 1.3];

/** The half of the width of the line around a field with a highlight, in CSS pixels, for each highlight. */
const BORDER: readonly [number, number, number] = [0, 1, 1.5];

/** The half of the smallest width of a run in the picture, in CSS pixels. Thus a thin run far from the camera stays in the picture. */
const LEAST_RUN = 1;

/** The part of a mark that is not clear while a solid hides it. */
const HIDDEN_OPACITY = 0.45;

/** The distance around a mark where the pointer finds it, in CSS pixels. */
const PICK_MARGIN = 4;

/** An outline with more sides than this value is a circle in the picture. The shaders have the same value. */
const ROUND_SIDES = 12;

/** This function gives the radius of the circle around an outline and its line, for a disc with the radius 1. */
function reachOf(outline: ShapeOutline): number {
  if (outline.sides > ROUND_SIDES) return outline.radius + HALO;
  const inner = Math.cos(Math.PI / outline.sides);
  return (outline.radius * inner + HALO) / inner;
}

/**
 * This function gives the radius of the sign of a level with the line around it, in CSS pixels.
 * `radius` is the radius of the sign of a disc. Give the result to the field `clear` of a label, so the text stays off the sign.
 */
export function signReach(level: Level, radius: number = SIGN_RADIUS): number {
  return radius * reachOf(SHAPE_OUTLINES[levelShape(level)]);
}

// The two shaders draw each mark as a square that looks at the camera. A fragment calculates its distance from the
// edge of the shape, so one draw has each shape with a soft edge, at each size.
// `shade` has two values: the part that is not clear in sight, and the same part behind a solid.
// The pass `behind` draws with no depth test, and the second pass draws on it with the depth test.

const SIGN_VERTEX = `
uniform float pixelAngle;
uniform float halo;
uniform float behind;
attribute vec3 center;
attribute vec3 lifted;
attribute vec4 outline;
attribute vec3 fill;
attribute vec3 ring;
attribute vec4 look;
varying vec2 vPlace;
varying vec4 vOutline;
varying vec3 vFill;
varying vec3 vRing;
varying float vOpacity;
void main() {
  vOpacity = mix(look.z, look.w, behind);
  vOutline = outline;
  vFill = fill;
  vRing = ring;
  vec4 inView = modelViewMatrix * vec4(center, 1.0);
  float pixel = max(-inView.z, 0.0001) * pixelAngle;
  float radius = look.y > 0.0 ? look.y : look.x * pixel;
  float inner = outline.y > ${ROUND_SIDES.toFixed(1)} ? 1.0 : cos(3.141592653589793 / outline.y);
  // The square has the outline, the line around it and one pixel for the soft edge.
  float reach = (outline.x * inner + halo) / inner + pixel / max(radius, 0.000001);
  vPlace = position.xy * reach;
  vec3 above = (modelViewMatrix * vec4(lifted, 1.0)).xyz;
  // The direction out of the surface, in the space of the camera. Its length is the lift.
  vec3 normal = above - inView.xyz;
  inView.xy += position.xy * reach * radius;
  gl_Position = projectionMatrix * inView;
  // Each corner has the depth of the point of the lifted surface that is behind it, as a picture on the surface has.
  // Thus the surface of the sign hides no part of the sign, and a solid in front of the surface hides the sign.
  float slope = dot(normal, inView.xyz);
  float along = abs(slope) > 0.000000001 ? clamp(dot(normal, above) / slope, 0.5, 2.0) : 1.0;
  vec4 depthAt = projectionMatrix * vec4(inView.xyz * along, 1.0);
  gl_Position.z = depthAt.z / depthAt.w * gl_Position.w;
  if (vOpacity <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SIGN_FRAGMENT = `
uniform float halo;
varying vec2 vPlace;
varying vec4 vOutline;
varying vec3 vFill;
varying vec3 vRing;
varying float vOpacity;
void main() {
  float radius = length(vPlace);
  // The distance from the edge of the outline: below 0 in the outline.
  float edge = radius - vOutline.x;
  if (vOutline.y <= ${ROUND_SIDES.toFixed(1)}) {
    float sector = 6.283185307179586 / vOutline.y;
    float turn = mod(atan(vPlace.y, vPlace.x) - vOutline.z, sector) - 0.5 * sector;
    edge = radius * cos(turn) - vOutline.x * cos(0.5 * sector);
  }
  float soft = max(fwidth(edge), 0.000001);
  float front = 1.0 - smoothstep(-soft, 0.0, edge);
  if (vOutline.w > 0.0) front *= smoothstep(vOutline.w - soft, vOutline.w, radius);
  float whole = 1.0 - smoothstep(halo - soft, halo, edge);
  gl_FragColor = vec4(mix(vRing, vFill, front), whole * vOpacity);
  if (gl_FragColor.a <= 0.0) discard;
  #include <colorspace_fragment>
}`;

const SEGMENT_VERTEX = `
uniform float pixelAngle;
uniform float behind;
attribute vec3 start;
attribute vec3 finish;
attribute vec3 fill;
attribute vec3 wide;
attribute vec2 shade;
attribute vec2 dash;
varying float vAcross;
varying float vAlong;
varying float vLength;
varying float vBody;
varying float vScale;
varying vec2 vDash;
varying vec3 vFill;
varying float vOpacity;
void main() {
  vOpacity = mix(shade.x, shade.y, behind);
  vFill = fill;
  vDash = dash;
  vec3 from = (modelViewMatrix * vec4(start, 1.0)).xyz;
  vec3 to = (modelViewMatrix * vec4(finish, 1.0)).xyz;
  vec3 here = mix(from, to, position.y);
  vec3 line = to - from;
  vLength = length(line);
  vec3 along = vLength > 0.0 ? line / vLength : vec3(1.0, 0.0, 0.0);
  float pixel = max(-here.z, 0.0001) * pixelAngle;
  // The half of the width: the width in the space, not less than a width in pixels, plus a width in pixels.
  vBody = max(wide.y, wide.z * pixel) + wide.x * pixel;
  float reach = vBody + pixel;
  // The square looks at the camera: its side is at a right angle to the line and to the sight line.
  vec3 side = cross(along, here);
  float sideLength = length(side);
  side = sideLength > 0.000001 ? side / sideLength : vec3(0.0, 1.0, 0.0);
  float cap = position.y * 2.0 - 1.0;
  vAcross = position.x * reach;
  vAlong = position.y * vLength + cap * reach;
  // A dash has its length in pixels at the middle of the line.
  vScale = 1.0 / (max(-0.5 * (from.z + to.z), 0.0001) * pixelAngle);
  gl_Position = projectionMatrix * vec4(here + side * vAcross + along * (cap * reach), 1.0);
  // Each corner has the depth of the side of a tube that is nearest to the camera.
  // Thus the surface below a run does not hide the half of the run that is nearest to it.
  vec4 depthAt = projectionMatrix * vec4(here * max(1.0 - reach / max(length(here), 0.0001), 0.5), 1.0);
  gl_Position.z = depthAt.z / depthAt.w * gl_Position.w;
  if (vOpacity <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SEGMENT_FRAGMENT = `
varying float vAcross;
varying float vAlong;
varying float vLength;
varying float vBody;
varying float vScale;
varying vec2 vDash;
varying vec3 vFill;
varying float vOpacity;
void main() {
  // The distance from the line between the two ends. Thus each end is round.
  float past = max(max(-vAlong, vAlong - vLength), 0.0);
  float away = length(vec2(vAcross, past));
  float soft = max(fwidth(away), 0.000001);
  float alpha = (1.0 - smoothstep(vBody - soft, vBody, away)) * vOpacity;
  if (vDash.x > 0.0 && mod(vAlong * vScale, vDash.x + vDash.y) > vDash.x) alpha = 0.0;
  gl_FragColor = vec4(vFill, alpha);
  if (gl_FragColor.a <= 0.0) discard;
  #include <colorspace_fragment>
}`;

interface SignPart {
  readonly mark: PointMark;
  readonly at: Vector3;
  /** The radius of the sign in the unit of the space. A sign with a radius in pixels has 0. */
  readonly world: number;
  readonly outline: ShapeOutline;
  shown: boolean;
  highlight: Highlight;
}

interface RunPart {
  readonly mark: RunMark;
  /** The points of the center line: each point of the path, at half of the width above its surface. */
  readonly points: readonly Vector3[];
  /** The index of the first segment of the line around the run, and of the run. */
  readonly casing: number;
  readonly body: number;
  shown: boolean;
  highlight: Highlight;
}

interface LinkPart {
  readonly mark: LinkMark;
  readonly segment: number;
  shown: boolean;
}

interface FieldPart {
  readonly mark: FieldMark;
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly texture: DataTexture;
  readonly plane: Plane;
  readonly origin: Vector3;
  readonly across: Vector3;
  readonly down: Vector3;
  /** The index of the first of the four segments around the field. */
  readonly border: number;
  shown: boolean;
  highlight: Highlight;
}

const vector = (point: Point3): Vector3 => new Vector3(point.x, point.y, point.z);

/** This function tells if a field has a grid that a texture can hold. */
function hasGrid(field: FieldMark): boolean {
  return Number.isInteger(field.columns) && Number.isInteger(field.rows) && field.columns >= 1 && field.rows >= 1 && field.cell > 0;
}

/** This function makes the square of two triangles that each instance of a mesh uses. `low` is the y value of its first side. */
function squareOf(low: number): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, low, 0, 1, low, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

/**
 * This function makes the content of a stage that draws marks. Examine the marks with `checkMarks` first.
 *
 * - A point is a sign with the shape and the color of its level. A sign looks at the camera.
 *   A sign with no size keeps its size in the picture.
 * - A run is a round line with its width in the space. Its center is half of its width above its surface.
 * - A link is a dashed line. The picture shows it while its record, or the record of one of its ends, has a highlight.
 * - A field is a grid of colors on its plane. A cell with no value is clear.
 * - A meter has no place, so the content ignores it.
 *
 * A mark that a solid of an earlier content hides is less clear, and a mark with a highlight stays solid.
 * A sign gets a pick before each other record, and a run gets a pick before a field.
 * A run and a field give the distance of their pick.
 * Put the content after the content of the solids in `stackContents`.
 */
export function createMarkers(marks: readonly Mark[], options: MarkersOptions = {}): MarkersContent {
  const signRadius = options.signRadius ?? SIGN_RADIUS;
  const linkHalf = (options.linkWidth ?? 2) / 2;
  const linkDash = options.linkDash ?? [6, 4];
  const points = marks.filter((mark) => mark.type === "point");
  const paths = marks.filter((mark) => mark.type === "run");
  const lines = marks.filter((mark) => mark.type === "link");
  const grids = marks.filter((mark) => mark.type === "field").filter(hasGrid);
  const records = new Set([...points, ...paths, ...lines, ...grids].map((mark) => mark.record));

  // The space of the marks: the extent of the content, and the default of the lift.
  const corners: Vector3[] = [];
  for (const mark of points) corners.push(vector(mark.frame.at));
  for (const mark of paths) for (const frame of mark.path) corners.push(vector(frame.at));
  for (const mark of lines) corners.push(vector(mark.from.at), vector(mark.to.at));
  for (const mark of grids) {
    const origin = vector(mark.frame.at);
    const across = vector(mark.across).multiplyScalar(mark.columns * mark.cell);
    const down = vector(fieldRowStep(mark)).multiplyScalar(mark.rows * mark.cell);
    corners.push(origin, origin.clone().add(across), origin.clone().add(down), origin.clone().add(across).add(down));
  }
  const low = new Vector3(Infinity, Infinity, Infinity);
  const high = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const corner of corners) {
    low.min(corner);
    high.max(corner);
  }
  const some = corners.length > 0;
  const size = some ? high.distanceTo(low) : 0;
  const lift = options.lift ?? (size > 0 ? size / 400 : 0.01);
  const center = some ? low.clone().add(high).multiplyScalar(0.5) : new Vector3();
  const box = some ? [0, 1, 2, 3, 4, 5, 6, 7].map((at) => ({ x: at & 1 ? high.x : low.x, y: at & 2 ? high.y : low.y, z: at & 4 ? high.z : low.z })) : [];

  /** The length of one CSS pixel at the distance 1 from the camera. The first step of the stage gives the correct value. */
  const pixelAngle = { value: (2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / 720 };
  /** The direction of the camera at the last step. */
  let sight: Vector3 | undefined;
  const color = new Color();
  const put = (to: Float32Array, at: number, from: Color): void => {
    to[at * 3] = from.r;
    to[at * 3 + 1] = from.g;
    to[at * 3 + 2] = from.b;
  };

  // The signs: one instance for each point.
  const signs: SignPart[] = points.map((mark) => ({
    mark,
    at: vector(mark.frame.at),
    world: mark.size === undefined ? 0 : Math.max(mark.size, 0) / 2,
    outline: SHAPE_OUTLINES[levelShape(mark.level)],
    shown: true,
    highlight: 0,
  }));
  const signGeometry = squareOf(-1);
  const signCenters = new Float32Array(signs.length * 3);
  const signLifted = new Float32Array(signs.length * 3);
  const signOutlines = new Float32Array(signs.length * 4);
  signs.forEach((part, index) => {
    const above = vector(part.mark.frame.out).multiplyScalar(lift).add(part.at);
    signCenters.set([part.at.x, part.at.y, part.at.z], index * 3);
    signLifted.set([above.x, above.y, above.z], index * 3);
    signOutlines.set([part.outline.radius, part.outline.sides, part.outline.start, part.outline.hole], index * 4);
  });
  const signFills = new InstancedBufferAttribute(new Float32Array(signs.length * 3), 3);
  const signRings = new InstancedBufferAttribute(new Float32Array(signs.length * 3), 3);
  const signLooks = new InstancedBufferAttribute(new Float32Array(signs.length * 4), 4);
  signGeometry.setAttribute("center", new InstancedBufferAttribute(signCenters, 3));
  signGeometry.setAttribute("lifted", new InstancedBufferAttribute(signLifted, 3));
  signGeometry.setAttribute("outline", new InstancedBufferAttribute(signOutlines, 4));
  signGeometry.setAttribute("fill", signFills);
  signGeometry.setAttribute("ring", signRings);
  signGeometry.setAttribute("look", signLooks);
  signGeometry.instanceCount = signs.length;

  // The segments: the line around each run, each run, the line around each field, and each link, in this sequence.
  // A later segment is above an earlier segment. Thus the round end of a line around a run does not go across the run.
  const runSegments = paths.reduce((sum, mark) => sum + Math.max(mark.path.length - 1, 0), 0);
  const segmentCount = runSegments * 2 + grids.length * 4 + lines.length;
  const segmentGeometry = squareOf(0);
  const starts = new Float32Array(segmentCount * 3);
  const finishes = new Float32Array(segmentCount * 3);
  const dashes = new Float32Array(segmentCount * 2);
  const setSegment = (index: number, from: Vector3, to: Vector3): void => {
    starts.set([from.x, from.y, from.z], index * 3);
    finishes.set([to.x, to.y, to.z], index * 3);
  };
  let nextRun = 0;
  const runs: RunPart[] = paths.map((mark) => {
    const line = mark.path.map((frame) => vector(frame.out).multiplyScalar(Math.max(mark.width, 0) / 2).add(vector(frame.at)));
    const part: RunPart = { mark, points: line, casing: nextRun, body: runSegments + nextRun, shown: true, highlight: 0 };
    for (let at = 0; at + 1 < line.length; at += 1) {
      const from = line[at];
      const to = line[at + 1];
      if (from === undefined || to === undefined) continue;
      setSegment(part.casing + at, from, to);
      setSegment(part.body + at, from, to);
    }
    nextRun += Math.max(line.length - 1, 0);
    return part;
  });
  const fields: FieldPart[] = grids.map((mark, index) => {
    const out = vector(mark.frame.out);
    const origin = vector(mark.frame.at);
    const across = vector(mark.across);
    const down = vector(fieldRowStep(mark));
    const width = across.clone().multiplyScalar(mark.columns * mark.cell);
    const height = down.clone().multiplyScalar(mark.rows * mark.cell);
    const first = out.clone().multiplyScalar(lift).add(origin);
    const square = [first, first.clone().add(width), first.clone().add(width).add(height), first.clone().add(height)] as const;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(square.flatMap((corner) => [corner.x, corner.y, corner.z])), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const texture = new DataTexture(new Uint8Array(mark.columns * mark.rows * 4), mark.columns, mark.rows, RGBAFormat, UnsignedByteType);
    texture.colorSpace = SRGBColorSpace;
    // A cell has one color with a sharp edge.
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: DoubleSide }));
    mesh.renderOrder = 7;
    const border = runSegments * 2 + index * 4;
    square.forEach((corner, at) => {
      setSegment(border + at, corner, square[(at + 1) % 4] ?? corner);
    });
    return { mark, mesh, texture, plane: new Plane().setFromNormalAndCoplanarPoint(out, first), origin, across, down, border, shown: true, highlight: 0 };
  });
  const links: LinkPart[] = lines.map((mark, index) => {
    const segment = runSegments * 2 + grids.length * 4 + index;
    setSegment(segment, vector(mark.from.at), vector(mark.to.at));
    dashes.set([Math.max(linkDash[0], 0), Math.max(linkDash[1], 0)], segment * 2);
    return { mark, segment, shown: true };
  });
  const segmentFills = new InstancedBufferAttribute(new Float32Array(segmentCount * 3), 3);
  const segmentWides = new InstancedBufferAttribute(new Float32Array(segmentCount * 3), 3);
  const segmentShades = new InstancedBufferAttribute(new Float32Array(segmentCount * 2), 2);
  segmentGeometry.setAttribute("start", new InstancedBufferAttribute(starts, 3));
  segmentGeometry.setAttribute("finish", new InstancedBufferAttribute(finishes, 3));
  segmentGeometry.setAttribute("dash", new InstancedBufferAttribute(dashes, 2));
  segmentGeometry.setAttribute("fill", segmentFills);
  segmentGeometry.setAttribute("wide", segmentWides);
  segmentGeometry.setAttribute("shade", segmentShades);
  segmentGeometry.instanceCount = segmentCount;

  // Each mesh has two passes. The first pass has no depth test, and it draws the part of a mark that a solid hides.
  const passes = (geometry: InstancedBufferGeometry, vertexShader: string, fragmentShader: string, order: number, count: number): Mesh<InstancedBufferGeometry, ShaderMaterial>[] =>
    [1, 0].map((behind, at) => {
      const material = new ShaderMaterial({
        uniforms: { pixelAngle, halo: { value: HALO }, behind: { value: behind } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: behind === 0,
        depthWrite: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = order + at;
      // The place of each instance comes from its attributes, so the bounds of the square tell nothing.
      mesh.frustumCulled = false;
      mesh.visible = count > 0;
      return mesh;
    });
  const segmentMeshes = passes(segmentGeometry, SEGMENT_VERTEX, SEGMENT_FRAGMENT, 8, segmentCount);
  const signMeshes = passes(signGeometry, SIGN_VERTEX, SIGN_FRAGMENT, 10, signs.length);

  let painted: MarkersTheme | undefined;

  /** This function gives each cell of each field its color. */
  const paintFields = (theme: MarkersTheme): void => {
    const stops = theme.field.map((hex) => color.set(hex).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace));
    for (const part of fields) {
      const { min, max } = part.mark.scale;
      const own = color.set(theme.levels[part.mark.level]).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
      const data = part.texture.image.data as Uint8Array;
      for (let cell = 0; cell < part.mark.columns * part.mark.rows; cell += 1) {
        const value = part.mark.values[cell];
        if (value === null || value === undefined || !Number.isFinite(value)) {
          data.fill(0, cell * 4, cell * 4 + 4);
          continue;
        }
        // The value as a part of the scale, and then as a place in the list of the colors.
        const part01 = max > min ? Math.min(Math.max((value - min) / (max - min), 0), 1) : 0;
        const place = part01 * Math.max(stops.length - 1, 0);
        const before = stops[Math.min(Math.floor(place), Math.max(stops.length - 2, 0))] ?? own;
        const after = stops[Math.min(Math.floor(place), Math.max(stops.length - 2, 0)) + 1] ?? before;
        const mix = place - Math.min(Math.floor(place), Math.max(stops.length - 2, 0));
        data[cell * 4] = Math.round((before.r + (after.r - before.r) * mix) * 255);
        data[cell * 4 + 1] = Math.round((before.g + (after.g - before.g) * mix) * 255);
        data[cell * 4 + 2] = Math.round((before.b + (after.b - before.b) * mix) * 255);
        data[cell * 4 + 3] = 255;
      }
      part.texture.needsUpdate = true;
      part.mesh.material.opacity = Math.min(Math.max(theme.fieldOpacity ?? 0.8, 0), 1);
    }
  };

  /** This function writes the colors, the sizes and the shades of each mark from its highlight and from the filter. */
  const sync = (theme: MarkersTheme): void => {
    signs.forEach((part, index) => {
      const lit = part.highlight !== 0;
      const grow = HIGHLIGHT_SIZE[part.highlight];
      put(signFills.array as Float32Array, index, color.set(theme.levels[part.mark.level]));
      put(signRings.array as Float32Array, index, color.set(lit ? theme.accent : theme.halo));
      // A sign with a highlight is solid also behind a solid, so that a person finds it.
      signLooks.array.set([part.world > 0 ? 0 : signRadius * grow, part.world * grow, part.shown ? 1 : 0, part.shown ? (lit ? 1 : HIDDEN_OPACITY) : 0], index * 4);
    });
    const fills = segmentFills.array as Float32Array;
    const setLook = (segment: number, pixels: number, world: number, least: number, inSight: number, hidden: number): void => {
      segmentWides.array.set([pixels, world, least], segment * 3);
      segmentShades.array.set([inSight, hidden], segment * 2);
    };
    for (const part of runs) {
      const lit = part.highlight !== 0;
      const half = Math.max(part.mark.width, 0) / 2;
      const inSight = part.shown ? 1 : 0;
      const hidden = part.shown ? (lit ? 1 : HIDDEN_OPACITY) : 0;
      for (let at = 0; at + 1 < part.points.length; at += 1) {
        put(fills, part.casing + at, color.set(lit ? theme.accent : theme.halo));
        setLook(part.casing + at, CASING[part.highlight], half, LEAST_RUN, inSight, hidden);
        put(fills, part.body + at, color.set(theme.levels[part.mark.level]));
        setLook(part.body + at, 0, half, LEAST_RUN, inSight, hidden);
      }
    }
    for (const part of fields) {
      const lit = part.shown && part.highlight !== 0;
      part.mesh.visible = part.shown;
      for (let at = 0; at < 4; at += 1) {
        put(fills, part.border + at, color.set(theme.accent));
        setLook(part.border + at, BORDER[part.highlight], 0, 0, lit ? 1 : 0, lit ? HIDDEN_OPACITY : 0);
      }
    }
    for (const part of links) {
      put(fills, part.segment, color.set(theme.levels[part.mark.level]));
      // A link is above each solid: it joins two records, and one of them can be behind a solid.
      setLook(part.segment, linkHalf, 0, 0, part.shown ? 1 : 0, part.shown ? 1 : 0);
    }
    signFills.needsUpdate = true;
    signRings.needsUpdate = true;
    signLooks.needsUpdate = true;
    segmentFills.needsUpdate = true;
    segmentWides.needsUpdate = true;
    segmentShades.needsUpdate = true;
  };

  /** The marks that the filter accepts. A link also needs a highlight, so it has its own state. */
  let accepted: (mark: Mark) => boolean = () => true;
  let lit: (record: string) => Highlight = () => 0;
  const setShown = (): void => {
    for (const part of signs) part.shown = accepted(part.mark);
    for (const part of runs) part.shown = accepted(part.mark);
    for (const part of fields) part.shown = accepted(part.mark);
    for (const part of links) part.shown = accepted(part.mark) && (lit(part.mark.record) !== 0 || lit(part.mark.from.record) !== 0 || lit(part.mark.to.record) !== 0);
  };

  const toMark = new Vector3();
  const onRay = new Vector3();
  const onLine = new Vector3();
  const hit = new Vector3();

  return {
    objects: [...fields.map((part) => part.mesh), ...segmentMeshes, ...signMeshes] satisfies Object3D[],
    extent: { center: { x: center.x, y: center.y, z: center.z }, corners: box },
    has: (record) => records.has(record),
    pick(ray): StagePick<Mark> | undefined {
      const { origin, direction } = ray.ray;
      const forward = sight ?? direction;
      const facing = direction.dot(forward);
      if (facing <= 1e-9) return undefined;
      // A sign is above each solid, so it gets the pick first. The sign nearest to the pointer is the record.
      let sign: SignPart | undefined;
      let nearest = Infinity;
      for (const part of signs) {
        if (!part.shown) continue;
        toMark.subVectors(part.at, origin);
        const depth = toMark.dot(forward);
        if (depth <= 0) continue;
        const pixel = depth * pixelAngle.value;
        const radius = (part.world > 0 ? part.world : signRadius * pixel) * HIGHLIGHT_SIZE[part.highlight] * part.outline.radius + PICK_MARGIN * pixel;
        // The point of the ray in the plane of the sign, from the center of the sign.
        const away = hit.copy(direction).multiplyScalar(depth / facing).sub(toMark).length();
        if (away > radius || away / pixel >= nearest) continue;
        sign = part;
        nearest = away / pixel;
      }
      if (sign !== undefined) return { record: sign.mark.record, value: sign.mark };
      // A run and a field are in the space with the solids, so their pick has a distance.
      let found: Mark | undefined;
      let distance = Infinity;
      for (const part of runs) {
        if (!part.shown) continue;
        for (let at = 0; at + 1 < part.points.length; at += 1) {
          const from = part.points[at];
          const to = part.points[at + 1];
          if (from === undefined || to === undefined) continue;
          const squared = ray.ray.distanceSqToSegment(from, to, onRay, onLine);
          const along = onRay.distanceTo(origin);
          const pixel = along * facing * pixelAngle.value;
          const reach = Math.max(part.mark.width / 2, LEAST_RUN * pixel) + (CASING[0] + PICK_MARGIN) * pixel;
          // The distance is to the side of the run that is nearest to the camera. The picture has the same depth.
          // Thus the surface below a run does not get the pick of the run.
          const side = Math.max(along - reach, 0);
          if (squared > reach * reach || side >= distance) continue;
          found = part.mark;
          distance = side;
        }
      }
      // The picture draws a run above each field. So a run gets the pick before a field.
      if (found !== undefined) return { record: found.record, value: found, distance };
      for (const part of fields) {
        if (!part.shown || ray.ray.intersectPlane(part.plane, hit) === null) continue;
        const along = hit.distanceTo(origin);
        if (along >= distance) continue;
        toMark.subVectors(hit, part.origin);
        const column = Math.floor(toMark.dot(part.across) / part.mark.cell);
        const row = Math.floor(toMark.dot(part.down) / part.mark.cell);
        if (fieldValue(part.mark, column, row) === null) continue;
        found = part.mark;
        distance = along;
      }
      return found === undefined ? undefined : { record: found.record, value: found, distance };
    },
    paint(theme, highlight): void {
      if (theme !== painted) paintFields(theme);
      painted = theme;
      lit = highlight;
      for (const part of signs) part.highlight = highlight(part.mark.record);
      for (const part of runs) part.highlight = highlight(part.mark.record);
      for (const part of fields) part.highlight = highlight(part.mark.record);
      setShown();
      sync(theme);
    },
    step(frame: StageFrame): boolean {
      pixelAngle.value = (2 * Math.tan((frame.fieldOfView * Math.PI) / 360)) / Math.max(frame.height, 1);
      sight = frame.camera.getWorldDirection(sight ?? new Vector3());
      return false;
    },
    show(test): void {
      accepted = test;
      setShown();
      if (painted !== undefined) sync(painted);
    },
    dispose(): void {
      signGeometry.dispose();
      segmentGeometry.dispose();
      for (const mesh of [...segmentMeshes, ...signMeshes]) mesh.material.dispose();
      for (const part of fields) {
        part.mesh.geometry.dispose();
        part.mesh.material.dispose();
        part.texture.dispose();
      }
    },
  };
}
