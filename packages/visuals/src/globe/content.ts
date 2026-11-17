import { pointLocator, type LatLon, type PointLocator, type Region } from "@mark1russell7/geo";
import type { Point3 } from "@mark1russell7/layout-contract";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  FrontSide,
  Group,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  Vector3,
  type Object3D,
  type Raycaster,
} from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { Highlight } from "../highlight.ts";
import type { StageContent, StageFrame, StagePick } from "../stage/stage.ts";
import type { StageTheme } from "../theme.ts";
import { gridLines, regionEdges, regionSurface, surfaceSag } from "./mesh.ts";
import { globePlace, globePoint, inSight, rayBall } from "./space.ts";

/** The look of the areas and the points of one kind. Each color is a CSS hex color. */
export interface GlobeStyle {
  /** The color of the surface of an area, or of a point. An area with no color has no surface, and a point with no color is not in the picture. */
  readonly fill?: string | undefined;
  /** The part of the light that the surface of an area stops, from 0 to 1. The default is 1. */
  readonly opacity?: number | undefined;
  /** The color of the edge of an area, or of the ring around a point. An area with no color has no edge. */
  readonly line?: string | undefined;
  /**
   * The lengths of a dash and of a gap of the edge of an area, in CSS pixels. An edge with no `dash` is a solid line.
   * The lengths are correct on the surface below the camera, at each distance of the camera. Near the rim of the Earth, a dash is shorter in the picture.
   * A length that is not more than 0 gives a solid line.
   * The edge of a record with a highlight keeps the dash, and the ring of a point has no dash.
   */
  readonly dash?: readonly [dash: number, gap: number] | undefined;
}

/** The colors of a globe. Each color is a CSS hex color. */
export interface GlobeTheme extends StageTheme {
  /** The color of the Earth where it has no area, for example the sea. */
  readonly ball: string;
  /** The color of the meridians and the parallels. */
  readonly grid: string;
  /** The color of the shade at the rim of the Earth. */
  readonly shade: string;
  /** The style of each kind of area or point, by the name of the kind. */
  readonly styles: Readonly<Record<string, GlobeStyle>>;
  /** The style of a kind that `styles` does not have. */
  readonly other: GlobeStyle;
  /** The color of the edge of a record under the pointer, or in the highlighted list. */
  readonly hovered: string;
  /** The color of the edge of the selected record. */
  readonly selected: string;
}

/** An area of a globe: a region of the Earth that belongs to a record. */
export interface GlobeArea<P> {
  /** The name of the record. Two parts with one name are one record: the stage highlights them together. */
  readonly record: string;
  /** The region, with edges that are straight lines in longitude and latitude, as in `@mark1russell7/geo`. */
  readonly region: Region;
  /** The name of the style of the area in the theme. */
  readonly kind: string;
  /** The value that a pick of the area gives to the page. */
  readonly value: P;
  /** This value is false for an area that the pointer does not find. The default is true. */
  readonly pick?: boolean | undefined;
}

/** A point of a globe: a place on the Earth that belongs to a record. The picture shows it as a dot of a constant size. */
export interface GlobePoint<P> {
  /** The name of the record. Two parts with one name are one record: the stage highlights them together. */
  readonly record: string;
  readonly place: LatLon;
  /** The name of the style of the point in the theme. */
  readonly kind: string;
  /** The value that a pick of the point gives to the page. */
  readonly value: P;
  /** The width of the dot, in CSS pixels. The default is the option `pointSize` of the globe. */
  readonly size?: number | undefined;
  /** This value is false for a point that the pointer does not find. The default is true. */
  readonly pick?: boolean | undefined;
}

/** The options of a globe. Each width is in CSS pixels. */
export interface GlobeOptions<P> {
  /** The areas, in the sequence of the picture: a later area is above an earlier area, and the pointer finds it first. */
  readonly areas?: readonly GlobeArea<P>[] | undefined;
  /** The points. Each point is above each area. */
  readonly points?: readonly GlobePoint<P>[] | undefined;
  /** The radius of the globe, in the units of the stage. The default is 1. */
  readonly radius?: number | undefined;
  /** The largest step of an edge in longitude or latitude, in degrees. A smaller step follows the curve of the Earth better. The default is 1. */
  readonly step?: number | undefined;
  /** The angle between two lines of the grid, in degrees. The value 0 gives no grid. The default is 15. */
  readonly grid?: number | undefined;
  /** The smallest height of the camera above the surface, as a part of the radius. The default is 0.005. */
  readonly nearest?: number | undefined;
  /** The width of the edge of an area. The default is 1.25. */
  readonly lineWidth?: number | undefined;
  /** The width of the edge of a record with a highlight. The default is 2.5. */
  readonly highlightWidth?: number | undefined;
  /** The width of a line of the grid. The default is 1. */
  readonly gridWidth?: number | undefined;
  /** The width of the dot of a point. The default is 9. */
  readonly pointSize?: number | undefined;
  /** The strength of the shade at the rim of the Earth, from 0 to 1. The default is 0.4. */
  readonly shade?: number | undefined;
}

/** The content of a stage that shows the Earth as a globe, with areas and points on it. */
export interface GlobeContent<P> extends StageContent<P, GlobeTheme> {
  /**
   * This function shows only the areas and the points that a test accepts. A part that the picture does not show gets no pick.
   * Start `refresh` of the stage after it. A test that accepts each part shows all of them again.
   */
  show(test: (part: GlobeArea<P> | GlobePoint<P>) => boolean): void;
  /** This function gives the place on the Earth that a ray from the camera finds. A ray that does not find the Earth gives `undefined`. */
  placeAt(ray: Raycaster): LatLon | undefined;
}

/** The smallest height of the layer of the areas above the ball, as a part of the radius. */
const MIN_LIFT = 0.0005;

/** The opacity that a highlight adds to the surface of an area. */
const HIGHLIGHT_OPACITY = 0.16;

/** The factor of the width of a point with a highlight. */
const HIGHLIGHT_SIZE = 1.35;

/** The width of the ring around a point, in CSS pixels. */
const RING_WIDTH = 1.5;

/**
 * This function gives the radius of the mark of a point of a globe, in CSS pixels. The mark is the dot, and the ring around it.
 * `size` is the width of the dot. Give the result to the field `clear` of a label, so the text stays off the mark.
 */
export function pointRadius(size: number): number {
  return size / 2 + RING_WIDTH;
}

/** The distance around a point where the pointer finds it, in CSS pixels. */
const PICK_MARGIN = 4;

/** The exponent of the shade at the rim. A large value keeps the shade near the rim. */
const SHADE_POWER = 2.6;

const BALL_SEGMENTS = 128;

const SHADE_VERTEX = `
varying vec3 vNormal;
varying vec3 vToEye;
void main() {
  vec4 inView = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vToEye = -inView.xyz;
  gl_Position = projectionMatrix * inView;
}`;

const SHADE_FRAGMENT = `
uniform vec3 shade;
uniform float strength;
uniform float power;
varying vec3 vNormal;
varying vec3 vToEye;
void main() {
  float facing = clamp(dot(normalize(vNormal), normalize(vToEye)), 0.0, 1.0);
  gl_FragColor = vec4(shade, strength * pow(1.0 - facing, power));
  #include <colorspace_fragment>
}`;

const POINT_VERTEX = `
uniform float pixelRatio;
uniform float ringWidth;
attribute vec3 fill;
attribute vec3 ring;
attribute float size;
varying vec3 vFill;
varying vec3 vRing;
varying float vFade;
varying float vInner;
void main() {
  vec4 inWorld = modelMatrix * vec4(position, 1.0);
  vec3 up = normalize(inWorld.xyz - modelMatrix[3].xyz);
  float facing = dot(up, normalize(cameraPosition - inWorld.xyz));
  vFill = fill;
  vRing = ring;
  vFade = smoothstep(0.0, 0.1, facing);
  vInner = size / (size + 2.0 * ringWidth);
  gl_PointSize = (size + 2.0 * ringWidth) * pixelRatio;
  gl_Position = projectionMatrix * viewMatrix * inWorld;
  // A point on the far side of the Earth, and a point that the picture does not show, goes out of the picture.
  if (facing <= 0.0 || size <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const POINT_FRAGMENT = `
varying vec3 vFill;
varying vec3 vRing;
varying float vFade;
varying float vInner;
void main() {
  float distance = length(gl_PointCoord * 2.0 - 1.0);
  float soft = fwidth(distance);
  float dot = 1.0 - smoothstep(1.0 - soft, 1.0, distance);
  float middle = 1.0 - smoothstep(vInner - soft, vInner, distance);
  gl_FragColor = vec4(mix(vRing, vFill, middle), dot * vFade);
  if (gl_FragColor.a <= 0.0) discard;
  #include <colorspace_fragment>
}`;

/** The lengths of a dash and of a gap of a line, in CSS pixels. */
type Dash = readonly [dash: number, gap: number];

/** This function gives the dash of a style. A style with no dash gives `undefined`, and so does a length that is not more than 0. */
function dashOf(style: GlobeStyle): Dash | undefined {
  const [dash, gap] = style.dash ?? [0, 0];
  return Number.isFinite(dash) && Number.isFinite(gap) && dash > 0 && gap > 0 ? [dash, gap] : undefined;
}

/** This function adds an area to the areas with the same pattern of a dash. */
function addPattern<T>(patterns: Map<string, T[]>, dash: Dash, part: T): void {
  const pattern = dash.join(" ");
  const same = patterns.get(pattern);
  if (same === undefined) patterns.set(pattern, [part]);
  else same.push(part);
}

/** An area with the place of its data in the buffers of the globe. */
interface AreaPart<P> {
  readonly area: GlobeArea<P>;
  readonly locate: PointLocator | undefined;
  readonly firstCorner: number;
  readonly cornerCount: number;
  readonly firstIndex: number;
  readonly indexCount: number;
  readonly firstSegment: number;
  readonly segmentCount: number;
  shown: boolean;
  filled: boolean;
  lined: boolean;
  /** The dash of the edge, or `undefined` for a solid line. */
  dash: Dash | undefined;
  highlight: Highlight;
}

/** A point with its place on the globe. */
interface PointPart<P> {
  readonly point: GlobePoint<P>;
  readonly at: Point3;
  readonly size: number;
  shown: boolean;
  filled: boolean;
  highlight: Highlight;
}

/** This function gives the text of a thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * This function writes the points of lines into a list of segments on a ball: six numbers for each segment. It gives the count of the segments.
 * With `lengths`, it also writes two numbers for each segment: the length of the line to the start of the segment, and to its end.
 */
function addSegments(lines: readonly Float64Array[], radius: number, to: number[], lengths?: number[]): number {
  let count = 0;
  for (const line of lines) {
    let from: Point3 | undefined;
    let length = 0;
    for (let index = 0; index + 1 < line.length; index += 2) {
      const next = globePoint({ lat: line[index + 1] ?? 0, lon: line[index] ?? 0 }, radius);
      if (from !== undefined) {
        to.push(from.x, from.y, from.z, next.x, next.y, next.z);
        if (lengths !== undefined) {
          const end = length + Math.hypot(next.x - from.x, next.y - from.y, next.z - from.z);
          lengths.push(length, end);
          length = end;
        }
        count += 1;
      }
      from = next;
    }
  }
  return count;
}

/** This function makes the geometry of thick line segments from a buffer of positions and a buffer of colors: six numbers for each segment. */
function segmentGeometry(positions: InstancedInterleavedBuffer, colors: InstancedInterleavedBuffer | undefined, count: number, bounds: Sphere): LineSegmentsGeometry {
  const geometry = new LineSegmentsGeometry();
  geometry.setAttribute("instanceStart", new InterleavedBufferAttribute(positions, 3, 0));
  geometry.setAttribute("instanceEnd", new InterleavedBufferAttribute(positions, 3, 3));
  if (colors !== undefined) {
    geometry.setAttribute("instanceColorStart", new InterleavedBufferAttribute(colors, 3, 0));
    geometry.setAttribute("instanceColorEnd", new InterleavedBufferAttribute(colors, 3, 3));
  }
  geometry.instanceCount = count;
  geometry.boundingSphere = bounds;
  return geometry;
}

/**
 * This function makes the content of a stage that shows the Earth as a globe. The center of the globe is the origin of the stage.
 *
 * The materials use no light, so each color in the picture is the color of the theme. Use `GLOBE_POLAR` and no pan in the options of the stage.
 * The function throws an `Error` with the name of the record for an area that is not correct. Its cause is the error of `@mark1russell7/geo`.
 */
export function createGlobe<P>(options: GlobeOptions<P> = {}): GlobeContent<P> {
  const radius = options.radius ?? 1;
  const step = options.step ?? 1;
  const layer = radius * (1 + Math.max(MIN_LIFT, surfaceSag(step) * 2));
  const bounds = new Sphere(new Vector3(0, 0, 0), layer);
  const color = new Color();

  // The ball, and the shade at its rim.
  const ballGeometry = new SphereGeometry(radius, BALL_SEGMENTS, BALL_SEGMENTS / 2);
  const ballMaterial = new MeshBasicMaterial();
  const ball = new Mesh(ballGeometry, ballMaterial);
  const shadeColor = { value: new Color() };
  const shadeMaterial = new ShaderMaterial({
    uniforms: { shade: shadeColor, strength: { value: Math.min(Math.max(options.shade ?? 0.4, 0), 1) }, power: { value: SHADE_POWER } },
    vertexShader: SHADE_VERTEX,
    fragmentShader: SHADE_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: FrontSide,
  });
  const shade = new Mesh(ballGeometry, shadeMaterial);
  shade.renderOrder = 4;

  // The grid.
  const gridList: number[] = [];
  const gridCount = addSegments(gridLines(options.grid ?? 15, step), layer, gridList);
  const gridMaterial = new LineMaterial({ linewidth: options.gridWidth ?? 1, transparent: true, depthWrite: false });
  const grid = new LineSegments2(segmentGeometry(new InstancedInterleavedBuffer(Float32Array.from(gridList), 6, 1), undefined, gridCount, bounds), gridMaterial);
  grid.renderOrder = 1;
  grid.visible = gridCount > 0;
  grid.frustumCulled = false;

  // The areas: one surface and one list of segments for all of them.
  const surfaces: { readonly corners: Float64Array; readonly triangles: Uint32Array }[] = [];
  const segmentList: number[] = [];
  const lengthList: number[] = [];
  const areaParts: AreaPart<P>[] = [];
  let cornerTotal = 0;
  let indexTotal = 0;
  let segmentTotal = 0;
  for (const area of options.areas ?? []) {
    try {
      const surface = regionSurface(area.region, step);
      const segmentCount = addSegments(regionEdges(area.region, step), layer, segmentList, lengthList);
      areaParts.push({
        area,
        locate: area.pick === false ? undefined : pointLocator(area.region),
        firstCorner: cornerTotal,
        cornerCount: surface.corners.length / 2,
        firstIndex: indexTotal,
        indexCount: surface.triangles.length,
        firstSegment: segmentTotal,
        segmentCount,
        shown: true,
        filled: false,
        lined: false,
        dash: undefined,
        highlight: 0,
      });
      surfaces.push(surface);
      cornerTotal += surface.corners.length / 2;
      indexTotal += surface.triangles.length;
      segmentTotal += segmentCount;
    } catch (error) {
      throw new Error(`The area of the record ${area.record} is not correct: ${messageOf(error)}`, { cause: error });
    }
  }
  const fillPositions = new Float32Array(cornerTotal * 3);
  const allIndices = new Uint32Array(indexTotal);
  surfaces.forEach((surface, index) => {
    const part = areaParts[index];
    if (part === undefined) return;
    for (let corner = 0; corner < part.cornerCount; corner++) {
      const point = globePoint({ lat: surface.corners[corner * 2 + 1] ?? 0, lon: surface.corners[corner * 2] ?? 0 }, layer);
      fillPositions.set([point.x, point.y, point.z], (part.firstCorner + corner) * 3);
    }
    for (let at = 0; at < part.indexCount; at++) allIndices[part.firstIndex + at] = (surface.triangles[at] ?? 0) + part.firstCorner;
  });
  const fillColors = new BufferAttribute(new Float32Array(cornerTotal * 4), 4);
  const fillIndices = new BufferAttribute(new Uint32Array(indexTotal), 1);
  const fillGeometry = new BufferGeometry();
  fillGeometry.setAttribute("position", new BufferAttribute(fillPositions, 3));
  fillGeometry.setAttribute("color", fillColors);
  fillGeometry.setIndex(fillIndices);
  fillGeometry.boundingSphere = bounds;
  const fillMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: FrontSide });
  const fills = new Mesh(fillGeometry, fillMaterial);
  fills.renderOrder = 2;
  fills.frustumCulled = false;

  // The edges of the areas. The picture draws the segments at the start of the buffers, so the segments of the shown areas are there.
  const allSegments = Float32Array.from(segmentList);
  const allSegmentColors = new Float32Array(allSegments.length);
  const edgePositions = new InstancedInterleavedBuffer(new Float32Array(allSegments.length), 6, 1);
  const edgeColors = new InstancedInterleavedBuffer(new Float32Array(allSegments.length), 6, 1);
  const edgeGeometry = segmentGeometry(edgePositions, edgeColors, 0, bounds);
  const edgeMaterial = new LineMaterial({ linewidth: options.lineWidth ?? 1.25, vertexColors: true, transparent: true, depthWrite: false });
  const edges = new LineSegments2(edgeGeometry, edgeMaterial);
  edges.renderOrder = 3;
  edges.frustumCulled = false;

  // The edges with dashes. A line material has one pattern, so each pattern of the theme gets an object of its own in this group.
  // The group keeps the order 0. Thus three.js sorts its objects with the other objects of the globe, by their own order.
  // The areas with a dash and a highlight get one more object for each pattern, with the order and the width of the highlight.
  const allLengths = Float32Array.from(lengthList);
  const dashed = new Group();
  let dashedLines: LineSegments2[] = [];
  let litLines: LineSegments2[] = [];
  /** The text of the dashed edges of the last picture. The globe makes the objects again only for a different text. */
  let dashedText = "[]";
  /** The count of CSS pixels of one unit of the stage, on the surface below the camera. */
  let dashScale = 1;

  // The solid edges of the records with a highlight, above the other edges.
  const highlightMaterial = new LineMaterial({ linewidth: options.highlightWidth ?? 2.5, vertexColors: true, transparent: true, depthWrite: false });
  const highlighted = new LineSegments2(new LineSegmentsGeometry(), highlightMaterial);
  highlighted.renderOrder = 5;
  highlighted.frustumCulled = false;
  highlighted.visible = false;

  // The points.
  const pointSize = options.pointSize ?? 9;
  const pointParts: PointPart<P>[] = (options.points ?? []).map((point) => ({
    point,
    at: globePoint(point.place, layer),
    size: point.size ?? pointSize,
    shown: true,
    filled: false,
    highlight: 0,
  }));
  const pointPositions = new Float32Array(pointParts.length * 3);
  pointParts.forEach((part, index) => pointPositions.set([part.at.x, part.at.y, part.at.z], index * 3));
  const pointFills = new BufferAttribute(new Float32Array(pointParts.length * 3), 3);
  const pointRings = new BufferAttribute(new Float32Array(pointParts.length * 3), 3);
  const pointSizes = new BufferAttribute(new Float32Array(pointParts.length), 1);
  const pointGeometry = new BufferGeometry();
  pointGeometry.setAttribute("position", new BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute("fill", pointFills);
  pointGeometry.setAttribute("ring", pointRings);
  pointGeometry.setAttribute("size", pointSizes);
  pointGeometry.boundingSphere = bounds;
  const pixelRatio = { value: 1 };
  const pointMaterial = new ShaderMaterial({
    uniforms: { pixelRatio, ringWidth: { value: RING_WIDTH } },
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const dots = new Points(pointGeometry, pointMaterial);
  dots.renderOrder = 6;
  dots.frustumCulled = false;
  dots.visible = pointParts.length > 0;
  // The size of a dot is in CSS pixels, and the picture can have more than one pixel for each CSS pixel.
  dots.onBeforeRender = (renderer): void => {
    pixelRatio.value = renderer.getPixelRatio();
  };

  const records = new Set<string>([...areaParts.map((part) => part.area.record), ...pointParts.map((part) => part.point.record)]);
  let painted: GlobeTheme | undefined;
  /** The angle of one CSS pixel at the middle of the picture, in radians. */
  let pixelAngle = 0.001;

  const styleOf = (theme: GlobeTheme, kind: string): GlobeStyle => theme.styles[kind] ?? theme.other;
  const highlightColor = (theme: GlobeTheme, highlight: Highlight): string => (highlight === 2 ? theme.selected : theme.hovered);

  /** This function writes the colors of an area into the buffers. */
  const paintArea = (part: AreaPart<P>, theme: GlobeTheme): void => {
    const style = styleOf(theme, part.area.kind);
    part.filled = style.fill !== undefined;
    part.lined = style.line !== undefined;
    part.dash = dashOf(style);
    if (style.fill !== undefined) {
      color.set(style.fill);
      const opacity = Math.min(Math.max(style.opacity ?? 1, 0), 1);
      const alpha = part.highlight === 0 ? opacity : Math.min(opacity + HIGHLIGHT_OPACITY, 1);
      const values = [color.r, color.g, color.b, alpha];
      for (let corner = 0; corner < part.cornerCount; corner++) fillColors.array.set(values, (part.firstCorner + corner) * 4);
      fillColors.needsUpdate = true;
    }
    if (style.line !== undefined) {
      color.set(style.line);
      const values = [color.r, color.g, color.b, color.r, color.g, color.b];
      for (let segment = 0; segment < part.segmentCount; segment++) allSegmentColors.set(values, (part.firstSegment + segment) * 6);
    }
  };

  /** This function releases objects of the edges with dashes, and removes them from the picture. */
  const release = (lines: readonly LineSegments2[]): void => {
    for (const line of lines) {
      line.geometry.dispose();
      line.material.dispose();
      dashed.remove(line);
    }
  };

  /**
   * This function makes one object of edges with dashes for each pattern, from the segments of the areas of the pattern.
   * `paint` writes the colors of the segments of an area into a list, from a position of the list.
   */
  const dashedObjects = (
    patterns: ReadonlyMap<string, readonly AreaPart<P>[]>,
    width: number,
    order: number,
    paint: (part: AreaPart<P>, colors: Float32Array, at: number) => void,
  ): LineSegments2[] => {
    const lines: LineSegments2[] = [];
    for (const parts of patterns.values()) {
      const dash = parts[0]?.dash;
      if (dash === undefined) continue;
      const count = parts.reduce((sum, part) => sum + part.segmentCount, 0);
      const positions = new Float32Array(count * 6);
      const colors = new Float32Array(count * 6);
      const lengths = new Float32Array(count * 2);
      let at = 0;
      for (const part of parts) {
        const to = part.firstSegment + part.segmentCount;
        positions.set(allSegments.subarray(part.firstSegment * 6, to * 6), at * 6);
        paint(part, colors, at * 6);
        lengths.set(allLengths.subarray(part.firstSegment * 2, to * 2), at * 2);
        at += part.segmentCount;
      }
      const geometry = segmentGeometry(new InstancedInterleavedBuffer(positions, 6, 1), new InstancedInterleavedBuffer(colors, 6, 1), count, bounds);
      const distances = new InstancedInterleavedBuffer(lengths, 2, 1);
      geometry.setAttribute("instanceDistanceStart", new InterleavedBufferAttribute(distances, 1, 0));
      geometry.setAttribute("instanceDistanceEnd", new InterleavedBufferAttribute(distances, 1, 1));
      const material = new LineMaterial({ linewidth: width, vertexColors: true, transparent: true, depthWrite: false, dashed: true, dashSize: dash[0], gapSize: dash[1], dashScale });
      const line = new LineSegments2(geometry, material);
      line.renderOrder = order;
      line.frustumCulled = false;
      dashed.add(line);
      lines.push(line);
    }
    return lines;
  };

  /** This function makes the objects of the edges with dashes: one object for each pattern, with the segments of its areas. */
  const syncDashed = (patterns: ReadonlyMap<string, readonly AreaPart<P>[]>, theme: GlobeTheme): void => {
    const text = JSON.stringify([...patterns].map(([pattern, parts]) => [pattern, parts.map((part) => [part.firstSegment, styleOf(theme, part.area.kind).line])]));
    if (text === dashedText) return;
    dashedText = text;
    release(dashedLines);
    dashedLines = dashedObjects(patterns, options.lineWidth ?? 1.25, 3, (part, colors, at) => {
      colors.set(allSegmentColors.subarray(part.firstSegment * 6, (part.firstSegment + part.segmentCount) * 6), at);
    });
  };

  /**
   * This function makes the dashed edges of the records with a highlight: one object for each pattern, above the other edges.
   * They are few, and a record changes its highlight only on an act of a person. So the globe makes them again at each change.
   */
  const syncLit = (patterns: ReadonlyMap<string, readonly AreaPart<P>[]>, theme: GlobeTheme): void => {
    release(litLines);
    litLines = dashedObjects(patterns, options.highlightWidth ?? 2.5, 5, (part, colors, at) => {
      color.set(highlightColor(theme, part.highlight));
      const values = [color.r, color.g, color.b, color.r, color.g, color.b];
      for (let segment = 0; segment < part.segmentCount; segment++) colors.set(values, at + segment * 6);
    });
  };

  /** This function puts the data of the shown parts at the start of the buffers that the picture draws. */
  const sync = (theme: GlobeTheme): void => {
    let indexCount = 0;
    let segmentCount = 0;
    let highlightCount = 0;
    const patterns = new Map<string, AreaPart<P>[]>();
    const lit = new Map<string, AreaPart<P>[]>();
    for (const part of areaParts) {
      if (!part.shown) continue;
      if (part.filled) {
        fillIndices.array.set(allIndices.subarray(part.firstIndex, part.firstIndex + part.indexCount), indexCount);
        indexCount += part.indexCount;
      }
      if (part.lined && part.dash !== undefined) {
        addPattern(patterns, part.dash, part);
      } else if (part.lined) {
        const from = part.firstSegment * 6;
        const to = from + part.segmentCount * 6;
        edgePositions.array.set(allSegments.subarray(from, to), segmentCount * 6);
        edgeColors.array.set(allSegmentColors.subarray(from, to), segmentCount * 6);
        segmentCount += part.segmentCount;
      }
      // The edge of a highlight keeps the dash of its area.
      if (part.highlight !== 0 && part.dash !== undefined) addPattern(lit, part.dash, part);
      else if (part.highlight !== 0) highlightCount += part.segmentCount;
    }
    fillIndices.needsUpdate = true;
    fillGeometry.setDrawRange(0, indexCount);
    fills.visible = indexCount > 0;
    edgePositions.needsUpdate = true;
    edgeColors.needsUpdate = true;
    edgeGeometry.instanceCount = segmentCount;
    edges.visible = segmentCount > 0;
    syncDashed(patterns, theme);
    syncLit(lit, theme);

    // The solid edges of the records with a highlight get a new geometry. They are few, and a record changes its highlight only on an act of a person.
    const highlightPositions = new Float32Array(highlightCount * 6);
    const highlightColors = new Float32Array(highlightCount * 6);
    let at = 0;
    for (const part of areaParts) {
      if (!part.shown || part.highlight === 0 || part.dash !== undefined) continue;
      color.set(highlightColor(theme, part.highlight));
      const values = [color.r, color.g, color.b, color.r, color.g, color.b];
      highlightPositions.set(allSegments.subarray(part.firstSegment * 6, (part.firstSegment + part.segmentCount) * 6), at * 6);
      for (let segment = 0; segment < part.segmentCount; segment++) highlightColors.set(values, (at + segment) * 6);
      at += part.segmentCount;
    }
    highlighted.geometry.dispose();
    highlighted.geometry =
      highlightCount > 0 ? segmentGeometry(new InstancedInterleavedBuffer(highlightPositions, 6, 1), new InstancedInterleavedBuffer(highlightColors, 6, 1), highlightCount, bounds) : new LineSegmentsGeometry();
    highlighted.visible = highlightCount > 0;

    pointParts.forEach((part, index) => {
      const style = styleOf(theme, part.point.kind);
      part.filled = style.fill !== undefined;
      const visible = part.shown && style.fill !== undefined;
      pointSizes.array[index] = visible ? part.size * (part.highlight === 0 ? 1 : HIGHLIGHT_SIZE) : 0;
      if (style.fill === undefined) return;
      color.set(style.fill);
      pointFills.array.set([color.r, color.g, color.b], index * 3);
      color.set(part.highlight === 0 ? (style.line ?? style.fill) : highlightColor(theme, part.highlight));
      pointRings.array.set([color.r, color.g, color.b], index * 3);
    });
    pointSizes.needsUpdate = true;
    pointFills.needsUpdate = true;
    pointRings.needsUpdate = true;
  };

  return {
    objects: [ball, grid, fills, edges, dashed, shade, highlighted, dots] satisfies Object3D[],
    extent: { center: { x: 0, y: 0, z: 0 }, corners: [], surface: radius, minDistance: radius * (1 + Math.max(options.nearest ?? 0.005, 1e-6)) },
    has: (record) => records.has(record),
    pick(ray): StagePick<P> | undefined {
      const { origin, direction } = ray.ray;
      let found: PointPart<P> | undefined;
      let nearest = Infinity;
      for (const part of pointParts) {
        if (!part.shown || !part.filled || part.point.pick === false || !inSight(part.at, origin, radius)) continue;
        const x = part.at.x - origin.x;
        const y = part.at.y - origin.y;
        const z = part.at.z - origin.z;
        const cosine = (x * direction.x + y * direction.y + z * direction.z) / Math.hypot(x, y, z);
        const angle = Math.acos(Math.min(Math.max(cosine, -1), 1));
        if (angle > (part.size / 2 + PICK_MARGIN) * pixelAngle || angle >= nearest) continue;
        found = part;
        nearest = angle;
      }
      if (found !== undefined) return { record: found.point.record, value: found.point.value };
      const hit = rayBall(origin, direction, radius);
      const place = hit === undefined ? undefined : globePlace(hit);
      if (place === undefined) return undefined;
      for (let index = areaParts.length - 1; index >= 0; index--) {
        const part = areaParts[index];
        if (part === undefined || !part.shown || part.locate === undefined || !(part.filled || part.lined)) continue;
        if (part.locate(place) !== "outside") return { record: part.area.record, value: part.area.value };
      }
      return undefined;
    },
    paint(theme, highlight): void {
      const all = theme !== painted;
      painted = theme;
      if (all) {
        ballMaterial.color.set(theme.ball);
        gridMaterial.color.set(theme.grid);
        shadeColor.value.set(theme.shade);
      }
      for (const part of areaParts) {
        const next = highlight(part.area.record);
        if (!all && next === part.highlight) continue;
        part.highlight = next;
        paintArea(part, theme);
      }
      for (const part of pointParts) part.highlight = highlight(part.point.record);
      sync(theme);
    },
    step(frame: StageFrame): boolean {
      pixelAngle = (2 * Math.tan((frame.fieldOfView * Math.PI) / 360)) / Math.max(frame.height, 1);
      // A dash has a constant length in the picture. So its scale follows the height of the camera above the surface.
      const height = Math.max(frame.camera.position.length() - radius, radius * 1e-6);
      dashScale = 1 / (pixelAngle * height);
      for (const line of dashedLines) line.material.dashScale = dashScale;
      for (const line of litLines) line.material.dashScale = dashScale;
      return false;
    },
    show(test): void {
      for (const part of areaParts) part.shown = test(part.area);
      for (const part of pointParts) part.shown = test(part.point);
      if (painted !== undefined) sync(painted);
    },
    placeAt(ray): LatLon | undefined {
      const hit = rayBall(ray.ray.origin, ray.ray.direction, radius);
      return hit === undefined ? undefined : globePlace(hit);
    },
    dispose(): void {
      ballGeometry.dispose();
      ballMaterial.dispose();
      shadeMaterial.dispose();
      grid.geometry.dispose();
      gridMaterial.dispose();
      fillGeometry.dispose();
      fillMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      release(dashedLines);
      release(litLines);
      dashedLines = [];
      litLines = [];
      highlighted.geometry.dispose();
      highlightMaterial.dispose();
      pointGeometry.dispose();
      pointMaterial.dispose();
    },
  };
}
