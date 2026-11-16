import { densify, type Position, type Region } from "@mark1russell7/geo";
import { ShapeUtils, Vector2 } from "three";

/**
 * The surface of a region as triangles. The region and the triangles are in the plane of longitude and latitude,
 * as the polygon tests of `@mark1russell7/geo` are. So a triangle does not go across the antimeridian.
 */
export interface RegionSurface {
  /** The longitude and the latitude of each corner, in degrees: two numbers for each corner. */
  readonly corners: Float64Array;
  /** The three corners of each triangle, as indices of corners. Each triangle is counterclockwise in the plane, with east on the right and north up. */
  readonly triangles: Uint32Array;
}

/** The largest count of corners of the surface of one region. A smaller step gives more corners. */
export const MAX_SURFACE_CORNERS = 2_000_000;

/**
 * The longest edge in a surface, as a factor of the step. An edge of the outline is not longer than the step.
 * An edge in the surface can be longer by this factor, so the count of the passes has a small limit.
 */
const LONG_EDGE = 1.25;

/**
 * The smallest length of a degree of longitude in the size of an edge, as a part of a degree at the equator.
 * Near a pole, a degree of longitude is short, and an edge can go across many of them. This limit keeps such an edge to 5 steps of longitude.
 * A straight edge on the Earth is not a straight line in longitude and latitude. The two are far apart for an edge across many degrees.
 */
const MIN_WIDTH = 0.25;

/** The largest count of passes that divide the long edges. Each pass makes the longest edge shorter by almost a half. */
const MAX_PASSES = 48;

/** The factor of the first corner in the key of an edge. A key is an exact integer for each pair of corners below this count. */
const KEY = 2 ** 26;

/** The largest distance of a corner from an edge that it is on, as a part of the length of the edge. */
const ON_EDGE = 1e-12;

/** The largest distance of a longitude from 180 degrees, or of a latitude from 90 degrees, that is on the antimeridian or on a pole. */
const ON_LINE = 1e-9;

const RADIANS = Math.PI / 180;

/** This function gives one number of a list. The index is always in the list, so the default 0 has no use. */
function at(list: ArrayLike<number>, index: number): number {
  return list[index] ?? 0;
}

function edgeKey(a: number, b: number): number {
  return a < b ? a * KEY + b : b * KEY + a;
}

/**
 * This function gives the height of the flat triangles of a surface below a ball of radius 1, at most.
 * A layer at this height above a ball does not go into the ball. `step` is the step of the surface, in degrees.
 */
export function surfaceSag(step: number): number {
  // A triangle with no edge longer than `a` on a ball is below the ball by 1 - cos(a / sqrt 3) at most.
  // An edge with a step of `s` in longitude and in latitude has the length s * sqrt 2 at most.
  return 1 - Math.cos((step * RADIANS * LONG_EDGE * Math.SQRT2) / Math.sqrt(3));
}

/** This function gives the points of a ring, each one time. A point is different from the point before it, and the last point is different from the first point. */
function openRing(ring: readonly Position[]): Vector2[] {
  const points: Vector2[] = [];
  for (const position of ring) {
    const last = points[points.length - 1];
    if (last === undefined || last.x !== position[0] || last.y !== position[1]) points.push(new Vector2(position[0], position[1]));
  }
  const first = points[0];
  while (points.length > 1 && first !== undefined && points[points.length - 1]?.equals(first) === true) points.pop();
  return points;
}

/**
 * This function gives the size of an edge for the division of a surface, in degrees. The size is the larger of its steps in latitude and in longitude.
 * A step of longitude is as long as it is on the Earth, at the end of the edge that is nearer to the equator.
 */
function edgeSize(lon: readonly number[], lat: readonly number[], a: number, b: number): number {
  const latA = at(lat, a);
  const latB = at(lat, b);
  const wide = Math.abs(at(lon, a) - at(lon, b)) * Math.max(Math.cos(Math.min(Math.abs(latA), Math.abs(latB)) * RADIANS), MIN_WIDTH);
  return Math.max(Math.abs(latA - latB), wide);
}

/** This function gives, for each edge of a list of faces, a face that has it. An edge of an outline has only one face. */
function ownersOf(faces: readonly (readonly number[])[]): Map<number, number> {
  const owner = new Map<number, number>();
  faces.forEach((face, index) => {
    for (let side = 0; side < face.length; side++) owner.set(edgeKey(at(face, side), at(face, (side + 1) % face.length)), index);
  });
  return owner;
}

/**
 * This function divides the face with the edge from `a` to `b` at each corner of `run`. The corners of `run` are on the edge, in the sequence from `a` to `b`.
 * Each new face has the third corner of the face, and the direction of the face. An edge with no face changes nothing.
 */
function divideAt(faces: number[][], owner: Map<number, number>, a: number, b: number, run: readonly number[]): void {
  const index = owner.get(edgeKey(a, b));
  const face = index === undefined ? undefined : faces[index];
  const c = face?.find((corner) => corner !== a && corner !== b);
  if (index === undefined || face === undefined || c === undefined || run.length === 0) return;
  const forward = face[(face.indexOf(a) + 1) % 3] === b;
  const chain = [a, ...run, b];
  for (let piece = 0; piece + 1 < chain.length; piece++) {
    const from = at(chain, piece);
    const to = at(chain, piece + 1);
    const place = piece === 0 ? index : faces.length;
    faces[place] = forward ? [from, to, c] : [to, from, c];
    owner.set(edgeKey(from, to), place);
    if (piece === 0) owner.set(edgeKey(a, c), place);
    if (piece === chain.length - 2) owner.set(edgeKey(b, c), place);
  }
}

/**
 * This function gives the corners that are on the edge from `u` to `v`, between its ends, in the sequence from `u` to `v`.
 * `byLon` has each corner, from the smallest longitude to the largest.
 */
function cornersOn(points: readonly Vector2[], byLon: readonly number[], u: number, v: number): number[] {
  const from = points[u];
  const to = points[v];
  if (from === undefined || to === undefined) return [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const square = dx * dx + dy * dy;
  if (!(square > 0)) return [];
  const slack = Math.sqrt(square) * ON_EDGE;
  const low = Math.min(from.x, to.x) - slack;
  const high = Math.max(from.x, to.x) + slack;
  let first = 0;
  let end = byLon.length;
  while (first < end) {
    const middle = (first + end) >> 1;
    if ((points[at(byLon, middle)]?.x ?? Infinity) < low) first = middle + 1;
    else end = middle;
  }
  const found: { readonly corner: number; readonly part: number }[] = [];
  for (let index = first; index < byLon.length; index++) {
    const corner = at(byLon, index);
    const point = points[corner];
    if (point === undefined || point.x > high) break;
    if (corner === u || corner === v) continue;
    const px = point.x - from.x;
    const py = point.y - from.y;
    const part = (px * dx + py * dy) / square;
    if (part > 0 && part < 1 && Math.abs(px * dy - py * dx) <= square * ON_EDGE) found.push({ corner, part });
  }
  return found.sort((one, other) => one.part - other.part).map(({ corner }) => corner);
}

/**
 * This function divides a polygon into triangles. Each ring has no point two times in sequence. The faces have indices of the points of the rings, as one list.
 *
 * The division ignores a corner on the straight line between its two neighbors. A face then has an edge with a corner on it,
 * and the face on the other side of that corner has a different edge. The function divides such a face at each corner on its edge,
 * so two faces with a common border have a common edge.
 */
function facesOf(rings: readonly (readonly Vector2[])[]): number[][] {
  const [outer = [], ...holes] = rings;
  const faces = ShapeUtils.triangulateShape(
    [...outer],
    holes.map((hole) => [...hole]),
  );
  const points = rings.flat();
  const ringOf: number[] = [];
  const spotOf: number[] = [];
  rings.forEach((ring, index) => {
    for (let spot = 0; spot < ring.length; spot++) {
      ringOf.push(index);
      spotOf.push(spot);
    }
  });
  const owner = new Map<number, number>();
  const counts = new Map<number, number>();
  faces.forEach((face, index) => {
    for (let side = 0; side < face.length; side++) {
      const key = edgeKey(at(face, side), at(face, (side + 1) % face.length));
      owner.set(key, index);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  let byLon: number[] | undefined;
  for (const [key, count] of counts) {
    if (count !== 1) continue;
    const u = Math.floor(key / KEY);
    const v = key % KEY;
    const ring = at(ringOf, u);
    const gap = Math.abs(at(spotOf, u) - at(spotOf, v));
    // An edge between two neighbors of a ring is an edge of the outline. It has only one face, and no corner on it.
    if (ring === at(ringOf, v) && (gap === 1 || gap === (rings[ring]?.length ?? 0) - 1)) continue;
    byLon ??= points.map((_, index) => index).sort((one, other) => (points[one]?.x ?? 0) - (points[other]?.x ?? 0));
    divideAt(faces, owner, u, v, cornersOn(points, byLon, u, v));
  }
  return faces;
}

/**
 * This function gives the place of each point of a ring in the same ring with more points on its edges.
 * It gives `undefined` for a ring whose points are not in the other ring, in the same sequence.
 */
function placesIn(dense: readonly Vector2[], own: readonly Vector2[]): number[] | undefined {
  const places: number[] = [];
  let index = 0;
  for (const point of own) {
    while (index < dense.length && dense[index]?.equals(point) !== true) index++;
    if (index >= dense.length) return undefined;
    places.push(index);
    index += 1;
  }
  return places;
}

/**
 * This function divides each triangle that has a long edge, at the middle of each long edge. It gives the new triangles,
 * or `undefined` when no edge is long. Two triangles with one edge get the same middle, so the surface has no hole.
 */
function dividePass(triangles: readonly number[], lon: number[], lat: number[], limit: number, middles: Map<number, number>): number[] | undefined {
  const next: number[] = [];
  let divided = false;
  const middle = (a: number, b: number): number => {
    const key = edgeKey(a, b);
    const found = middles.get(key);
    if (found !== undefined) return found;
    lon.push((at(lon, a) + at(lon, b)) / 2);
    lat.push((at(lat, a) + at(lat, b)) / 2);
    middles.set(key, lon.length - 1);
    return lon.length - 1;
  };
  for (let index = 0; index < triangles.length; index += 3) {
    const a = at(triangles, index);
    const b = at(triangles, index + 1);
    const c = at(triangles, index + 2);
    const ab = edgeSize(lon, lat, a, b) > limit;
    const bc = edgeSize(lon, lat, b, c) > limit;
    const ca = edgeSize(lon, lat, c, a) > limit;
    const count = Number(ab) + Number(bc) + Number(ca);
    if (count === 0) {
      next.push(a, b, c);
      continue;
    }
    divided = true;
    if (count === 3) {
      const mab = middle(a, b);
      const mbc = middle(b, c);
      const mca = middle(c, a);
      next.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      continue;
    }
    // The corners turn to `p`, `q` and `r`. With one long edge, it is from `p` to `q`. With two long edges, the short edge is from `r` to `p`.
    let p = a;
    let q = b;
    let r = c;
    if (count === 1 ? bc : !ab) {
      p = b;
      q = c;
      r = a;
    } else if (count === 1 ? ca : !bc) {
      p = c;
      q = a;
      r = b;
    }
    const mpq = middle(p, q);
    if (count === 1) {
      next.push(p, mpq, r, mpq, q, r);
      continue;
    }
    const mqr = middle(q, r);
    next.push(mpq, q, mqr);
    // The part with four corners gets the shorter of its two diagonals.
    if (edgeSize(lon, lat, p, mqr) <= edgeSize(lon, lat, mpq, r)) next.push(p, mpq, mqr, p, mqr, r);
    else next.push(p, mpq, r, mpq, mqr, r);
  }
  return divided ? next : undefined;
}

/**
 * This function divides the surface of a region into triangles that follow the curve of the Earth.
 *
 * `step` is the largest step of an edge of the outline in longitude or latitude, in degrees. The outline is the outline of `densify` with this step:
 * each edge of the outline of the surface is an edge of that outline. So a line through the points of `densify` is exactly on the outline of the surface.
 * An edge in the surface is not longer than 1.25 steps. A step of longitude is as long as it is on the Earth at that latitude, and a quarter of a step at least.
 *
 * A straight edge in the plane is a curve on the Earth. So a flat triangle on a globe is not exactly the triangle in the plane.
 * The difference is small for a small step. It is largest near a pole.
 *
 * The function throws a `GeoError` for a region or a step that is not correct, and a `RangeError` for a surface with too many corners.
 */
export function regionSurface(region: Region, step: number, maxCorners: number = MAX_SURFACE_CORNERS): RegionSurface {
  const dense = densify(region, step);
  const ownPolygons = region.type === "Polygon" ? [region.coordinates] : region.coordinates;
  const densePolygons = dense.type === "Polygon" ? [dense.coordinates] : dense.coordinates;
  const lon: number[] = [];
  const lat: number[] = [];
  let triangles: number[] = [];
  ownPolygons.forEach((polygon, polygonIndex) => {
    // The division into triangles gets the corners of the region only. The corners that `densify` adds are on straight lines, and the division ignores some of them.
    const own: Vector2[][] = [];
    const more: Vector2[][] = [];
    const spots: number[][] = [];
    for (let index = 0; index < polygon.length; index++) {
      const ring = openRing(polygon[index] ?? []);
      if (ring.length < 3) {
        // A polygon whose outer ring has no area has no surface. Its holes are in the outer ring, so they have no surface also.
        if (index === 0) return;
        continue;
      }
      const added = openRing(densePolygons[polygonIndex]?.[index] ?? []);
      const places = placesIn(added, ring);
      own.push(ring);
      more.push(places === undefined ? ring : added);
      spots.push(places ?? ring.map((_, spot) => spot));
    }
    const base = lon.length;
    /** The corner of the surface for each corner of the region, as an index from `base`. */
    const cornerOf: number[] = [];
    const starts: number[] = [];
    more.forEach((ring, index) => {
      const start = lon.length - base;
      starts.push(start);
      for (const spot of spots[index] ?? []) cornerOf.push(start + spot);
      for (const point of ring) {
        lon.push(point.x);
        lat.push(point.y);
      }
    });
    if (lon.length > maxCorners) throw tooManyCorners(maxCorners);
    const faces = facesOf(own).map((face) => face.map((corner) => at(cornerOf, corner)));
    // Each edge of the outline gets the corners that `densify` added to it.
    const owner = ownersOf(faces);
    more.forEach((ring, index) => {
      const places = spots[index] ?? [];
      const start = at(starts, index);
      places.forEach((place, spot) => {
        const next = at(places, (spot + 1) % places.length);
        const run: number[] = [];
        for (let between = (place + 1) % ring.length; between !== next; between = (between + 1) % ring.length) run.push(start + between);
        divideAt(faces, owner, start + place, start + next, run);
      });
    });
    // East is on the right of a person who looks at the Earth from outside with north up. So a counterclockwise triangle in the plane has its front outside.
    // The faces of one polygon have one direction. Their sum tells it, also for a face with almost no area.
    const turnOf = ([a = 0, b = 0, c = 0]: readonly number[]): number =>
      (at(lon, base + b) - at(lon, base + a)) * (at(lat, base + c) - at(lat, base + a)) - (at(lon, base + c) - at(lon, base + a)) * (at(lat, base + b) - at(lat, base + a));
    let turn = 0;
    for (const face of faces) turn += turnOf(face);
    for (const [a = 0, b = 0, c = 0] of faces) {
      if (turn >= 0) triangles.push(base + a, base + b, base + c);
      else triangles.push(base + a, base + c, base + b);
    }
  });
  const limit = step * LONG_EDGE;
  const middles = new Map<number, number>();
  for (let pass = 0; ; pass++) {
    const next = dividePass(triangles, lon, lat, limit, middles);
    if (next === undefined) break;
    triangles = next;
    if (lon.length > maxCorners) throw tooManyCorners(maxCorners);
    if (pass >= MAX_PASSES) throw new RangeError(`The surface of the region has edges longer than ${limit} degrees after ${MAX_PASSES} passes.`);
  }
  const corners = new Float64Array(lon.length * 2);
  for (let index = 0; index < lon.length; index++) {
    corners[index * 2] = at(lon, index);
    corners[index * 2 + 1] = at(lat, index);
  }
  return { corners, triangles: Uint32Array.from(triangles) };
}

function tooManyCorners(maxCorners: number): RangeError {
  return new RangeError(`The surface of the region has more than ${maxCorners} corners. Use a larger step.`);
}

/** A range of latitudes of an edge on the antimeridian. */
interface Cut {
  readonly low: number;
  readonly high: number;
}

/** This function gives 1 for a longitude of 180 degrees east, -1 for 180 degrees west, and 0 for each other longitude. */
function sideOf(position: Position): number {
  if (Math.abs(position[0] - 180) <= ON_LINE) return 1;
  return Math.abs(position[0] + 180) <= ON_LINE ? -1 : 0;
}

/** This function gives 1 for the north pole, -1 for the south pole, and 0 for each other latitude. */
function poleOf(position: Position): number {
  if (position[1] >= 90 - ON_LINE) return 1;
  return position[1] <= -90 + ON_LINE ? -1 : 0;
}

/**
 * This function gives the edges of a region as lines, for the outline that a person sees. Each line is a list of longitudes and latitudes, in degrees:
 * two numbers for each point.
 *
 * `step` is the largest step of a line in longitude or latitude, in degrees. The points are the points of `densify`, so they are corners of `regionSurface`.
 * An edge that is only a cut gets no line. A cut is an edge along a pole, or an edge on the antimeridian with an edge of the region on its other side.
 */
export function regionEdges(region: Region, step: number): Float64Array[] {
  const polygons = region.type === "Polygon" ? [region.coordinates] : region.coordinates;
  const east: Cut[] = [];
  const west: Cut[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let index = 0; index + 1 < ring.length; index++) {
        const from = ring[index];
        const to = ring[index + 1];
        if (from === undefined || to === undefined) continue;
        const side = sideOf(from);
        if (side === 0 || side !== sideOf(to)) continue;
        (side > 0 ? east : west).push({ low: Math.min(from[1], to[1]), high: Math.max(from[1], to[1]) });
      }
    }
  }
  const isCut = (from: Position, to: Position): boolean => {
    const pole = poleOf(from);
    if (pole !== 0 && pole === poleOf(to)) return true;
    const side = sideOf(from);
    if (side === 0 || side !== sideOf(to)) return false;
    const low = Math.min(from[1], to[1]);
    const high = Math.max(from[1], to[1]);
    return (side > 0 ? west : east).some((cut) => Math.min(cut.high, high) > Math.max(cut.low, low));
  };
  const lines: Float64Array[] = [];
  const add = (run: readonly Position[]): void => {
    if (run.length < 2) return;
    const dense = densify({ type: "LineString", coordinates: [...run] }, step).coordinates;
    const line = new Float64Array(dense.length * 2);
    dense.forEach((position, index) => {
      line[index * 2] = position[0];
      line[index * 2 + 1] = position[1];
    });
    lines.push(line);
  };
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const count = ring.length - 1;
      if (count < 1) continue;
      const cut: boolean[] = [];
      for (let index = 0; index < count; index++) {
        const from = ring[index];
        const to = ring[index + 1];
        cut.push(from === undefined || to === undefined || isCut(from, to));
      }
      const first = cut.indexOf(true);
      if (first < 0) {
        add(ring);
        continue;
      }
      // The walk starts after a cut and goes one time around the ring. So it ends at that cut, and each run of edges is complete.
      let run: Position[] = [];
      for (let steps = 1; steps <= count; steps++) {
        const edge = (first + steps) % count;
        const from = ring[edge];
        const to = ring[edge + 1];
        if (cut[edge] === true || from === undefined || to === undefined) {
          add(run);
          run = [];
          continue;
        }
        if (run.length === 0) run.push(from);
        run.push(to);
      }
    }
  }
  return lines;
}

/**
 * This function gives the lines of a grid of meridians and parallels. Each line is a list of longitudes and latitudes, in degrees: two numbers for each point.
 *
 * `spacing` is the angle between two lines, in degrees, and `step` is the largest step of a line. A spacing of 0 or less gives no lines.
 * The meridians at each 90 degrees go to the poles. The other meridians stop one spacing before each pole, so the poles stay clear.
 */
export function gridLines(spacing: number, step: number): Float64Array[] {
  if (!(spacing > 0) || !(step > 0) || !Number.isFinite(spacing)) return [];
  const lines: Float64Array[] = [];
  const add = (fromLon: number, fromLat: number, toLon: number, toLat: number): void => {
    const parts = Math.max(Math.ceil(Math.max(Math.abs(toLon - fromLon), Math.abs(toLat - fromLat)) / step), 1);
    const line = new Float64Array((parts + 1) * 2);
    for (let part = 0; part <= parts; part++) {
      line[part * 2] = fromLon + ((toLon - fromLon) * part) / parts;
      line[part * 2 + 1] = fromLat + ((toLat - fromLat) * part) / parts;
    }
    lines.push(line);
  };
  const top = (Math.ceil(90 / spacing) - 1) * spacing;
  for (let index = 0; index * spacing < 360 - ON_LINE; index++) {
    const lon = -180 + index * spacing;
    const quarter = Math.abs(lon / 90 - Math.round(lon / 90)) <= ON_LINE;
    const end = quarter ? 90 : top;
    if (end > 0) add(lon, -end, lon, end);
  }
  for (let lat = -top; lat <= top + ON_LINE; lat += spacing) add(-180, lat, 180, lat);
  return lines;
}
