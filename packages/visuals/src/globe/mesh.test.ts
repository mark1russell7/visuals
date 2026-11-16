import { densify, type Position, type Region } from "@mark1russell7/geo";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gridLines, regionEdges, regionSurface, surfaceSag, type RegionSurface } from "./mesh.ts";

const RADIANS = Math.PI / 180;

/** This function closes a list of positions into a ring. */
const ringOf = (positions: readonly Position[]): Position[] => [...positions, ...positions.slice(0, 1)];

/** This function makes a region with four corners. */
const square = (west: number, south: number, east: number, north: number): Position[] =>
  ringOf([
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ]);

const polygon = (...rings: Position[][]): Region => ({ type: "Polygon", coordinates: rings });

/** This function gives the area of a ring in the plane of longitude and latitude. The area is positive for each direction of the ring. */
function ringArea(ring: readonly Position[]): number {
  let sum = 0;
  for (let index = 0; index + 1 < ring.length; index++) {
    const from = ring[index];
    const to = ring[index + 1];
    if (from !== undefined && to !== undefined) sum += from[0] * to[1] - to[0] * from[1];
  }
  return Math.abs(sum) / 2;
}

const keyOf = (lon: number, lat: number): string => `${lon},${lat}`;

/** The measures of a surface that the tests examine. */
interface Measures {
  /** The sum of the areas of the triangles in the plane. */
  readonly area: number;
  /** The smallest area of a triangle in the plane, with its sign: a negative value is a clockwise triangle. */
  readonly smallest: number;
  /** The largest size of an edge, as the division of a surface measures it. */
  readonly longest: number;
  /** The edges that only one triangle has, as text of the places of their two ends. */
  readonly outline: string[];
  /** The largest count of triangles that have one edge. Two corners at one place are different corners. */
  readonly mostAtOneEdge: number;
}

function measure(surface: RegionSurface): Measures {
  const lon = (corner: number): number => surface.corners[corner * 2] ?? Number.NaN;
  const lat = (corner: number): number => surface.corners[corner * 2 + 1] ?? Number.NaN;
  const counts = new Map<string, { count: number; ends: string }>();
  let area = 0;
  let smallest = Infinity;
  let longest = 0;
  for (let index = 0; index < surface.triangles.length; index += 3) {
    const corners = [surface.triangles[index] ?? 0, surface.triangles[index + 1] ?? 0, surface.triangles[index + 2] ?? 0];
    const [a = 0, b = 0, c = 0] = corners;
    const one = ((lon(b) - lon(a)) * (lat(c) - lat(a)) - (lon(c) - lon(a)) * (lat(b) - lat(a))) / 2;
    area += one;
    smallest = Math.min(smallest, one);
    for (let side = 0; side < 3; side++) {
      const from = corners[side] ?? 0;
      const to = corners[(side + 1) % 3] ?? 0;
      // A degree of longitude counts as a quarter of a degree at least, so an edge near a pole does not go across many degrees.
      const wide = Math.abs(lon(from) - lon(to)) * Math.max(Math.cos(Math.min(Math.abs(lat(from)), Math.abs(lat(to))) * RADIANS), 0.25);
      longest = Math.max(longest, Math.abs(lat(from) - lat(to)), wide);
      const key = from < to ? `${from} ${to}` : `${to} ${from}`;
      const found = counts.get(key) ?? { count: 0, ends: [keyOf(lon(from), lat(from)), keyOf(lon(to), lat(to))].sort().join(" ") };
      found.count += 1;
      counts.set(key, found);
    }
  }
  const outline: string[] = [];
  let mostAtOneEdge = 0;
  for (const { count, ends } of counts.values()) {
    mostAtOneEdge = Math.max(mostAtOneEdge, count);
    if (count === 1) outline.push(ends);
  }
  return { area, smallest, longest, outline: outline.sort(), mostAtOneEdge };
}

/** This function gives the edges of the rings of a region after `densify`, as text of their two ends. */
function denseOutline(region: Region, step: number): Set<string> {
  const dense = densify(region, step);
  const polygons = dense.type === "Polygon" ? [dense.coordinates] : dense.coordinates;
  const edges = new Set<string>();
  for (const rings of polygons) {
    for (const ring of rings) {
      for (let index = 0; index + 1 < ring.length; index++) {
        const from = ring[index];
        const to = ring[index + 1];
        if (from !== undefined && to !== undefined) edges.add([keyOf(from[0], from[1]), keyOf(to[0], to[1])].sort().join(" "));
      }
    }
  }
  return edges;
}

/** This function examines the laws of a surface: its area, its outline, the direction of its triangles and the size of its edges. */
function expectLaws(region: Region, step: number, area: number): Measures {
  const measures = measure(regionSurface(region, step));
  expect(measures.area, "the area").toBeCloseTo(area, 6);
  // A triangle with no area is not a fault: it comes from three corners on one line. A clockwise triangle is a fault.
  expect(measures.smallest, "the direction").toBeGreaterThanOrEqual(-1e-9);
  expect(measures.longest, "the longest edge").toBeLessThanOrEqual(step * 1.25 + 1e-9);
  // Each edge in the surface is the edge of two triangles, so the surface has no hole and no edge that ends at the middle of a different edge.
  expect(measures.mostAtOneEdge, "the triangles at one edge").toBeLessThanOrEqual(2);
  expect(measures.outline, "the outline").toEqual([...denseOutline(region, step)].sort());
  return measures;
}

describe("surfaceSag", () => {
  it("is the height of the flat triangles below a ball, as a part of the radius", () => {
    // At a step of 1 degree, the Earth of 6371 km is about 1 km above the middle of a triangle.
    expect(surfaceSag(1) * 6371).toBeGreaterThan(0.9);
    expect(surfaceSag(1) * 6371).toBeLessThan(1.1);
  });

  it("is larger for a larger step, and 0 for no step", () => {
    expect(surfaceSag(0)).toBe(0);
    expect(surfaceSag(2)).toBeGreaterThan(surfaceSag(1));
    expect(surfaceSag(0.25)).toBeLessThan(surfaceSag(0.5));
  });

  it("is not less than the height of a triangle of the surface below the ball", () => {
    // The middle of a triangle with three edges of 1.25 steps is the lowest point of a surface.
    const edge = 1.25 * Math.SQRT2 * RADIANS;
    const lowest = 1 - Math.cos(edge / Math.sqrt(3));
    expect(surfaceSag(1)).toBeGreaterThanOrEqual(lowest);
  });
});

describe("regionSurface", () => {
  it("fills a square with triangles that have the outline of densify", () => {
    const measures = expectLaws(polygon(square(0, 0, 10, 10)), 1, 100);
    expect(measures.outline).toHaveLength(40);
  });

  it("uses each corner of the outline, also a corner on a straight line between its neighbors", () => {
    // Each corner of this ring but four is on a straight line. The division into triangles ignores them, and the surface puts them back.
    const ring = ringOf([
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [6, 3],
      [6, 6],
      [3, 6],
      [0, 6],
      [0, 4],
      [0, 2],
    ]);
    const surface = regionSurface(polygon(ring), 100);
    const corners = new Set<string>();
    for (const corner of surface.triangles) corners.add(keyOf(surface.corners[corner * 2] ?? Number.NaN, surface.corners[corner * 2 + 1] ?? Number.NaN));
    for (const position of ring) expect(corners.has(keyOf(position[0], position[1])), `the corner ${position[0]}, ${position[1]}`).toBe(true);
    expectLaws(polygon(ring), 100, 36);
  });

  it("keeps a hole open", () => {
    const region = polygon(square(0, 0, 12, 12), square(4, 4, 8, 8));
    const measures = expectLaws(region, 1, 144 - 16);
    expect(measures.outline).toHaveLength(48 + 16);
  });

  it("joins the two sides of the line from a hole to the outline", () => {
    // The division into triangles joins this hole to the corner at 0, 4. That line continues along the bottom edge of the hole.
    const outer = ringOf([
      [0, 0],
      [12, 0],
      [12, 12],
      [0, 12],
      [0, 4],
    ]);
    expectLaws(polygon(outer, square(4, 4, 8, 8)), 100, 144 - 16);
    expectLaws(polygon(outer, square(4, 4, 8, 8)), 1.5, 144 - 16);
    expectLaws(polygon(outer, square(3, 4, 5, 6), square(7, 4, 9, 6)), 0.7, 144 - 8);
  });

  it("uses each corner of an outline with steps, where many corners are on one line", () => {
    const steps: Position[] = [];
    for (let index = 0; index < 6; index++) steps.push([index, index], [index + 0.5, index], [index + 1, index]);
    const ring = ringOf([...steps, [6, 6], [6, 7], [3, 7], [0, 7], [0, 3.5]]);
    expectLaws(polygon(ring), 100, ringArea(ring));
    expectLaws(polygon(ring), 0.4, ringArea(ring));
  });

  it("ignores a corner that the ring has two times in sequence", () => {
    const ring: Position[] = [
      [0, 0],
      [0, 0],
      [5, 0],
      [5, 5],
      [5, 5],
      [5, 5],
      [0, 5],
      [0, 0],
      [0, 0],
    ];
    const measures = measure(regionSurface(polygon(ring), 1));
    expect(measures.area).toBeCloseTo(25, 9);
    expect(measures.mostAtOneEdge).toBe(2);
    expect(measures.outline).toHaveLength(20);
  });

  it("gives the same surface for a ring in each direction", () => {
    const one = square(0, 0, 6, 4);
    expectLaws(polygon(one), 1, 24);
    expectLaws(polygon([...one].reverse()), 1, 24);
  });

  it("fills each polygon of a region with many polygons", () => {
    const region: Region = { type: "MultiPolygon", coordinates: [[square(0, 0, 4, 4)], [square(10, -3, 13, 0), square(11, -2, 12, -1)]] };
    expectLaws(region, 0.5, 16 + 9 - 1);
  });

  it("fills a shape that is not convex", () => {
    const ring = ringOf([
      [0, 0],
      [9, 0],
      [9, 9],
      [6, 9],
      [6, 3],
      [3, 3],
      [3, 9],
      [0, 9],
    ]);
    expectLaws(polygon(ring), 1, 81 - 18);
  });

  it("uses fewer triangles near a pole, where a degree of longitude is short", () => {
    const equator = regionSurface(polygon(square(0, 0, 60, 8)), 1);
    const north = regionSurface(polygon(square(0, 80, 60, 88)), 1);
    expect(north.triangles.length).toBeLessThan(equator.triangles.length);
    expectLaws(polygon(square(0, 80, 60, 88)), 1, 480);
  });

  it("fills a region that goes to a pole and to the antimeridian", () => {
    expectLaws(polygon(square(150, 70, 180, 90)), 2, 600);
    expectLaws(polygon(square(-180, -90, -150, -70)), 2, 600);
  });

  it("has the outline of densify for edges whose added corners are not exactly on one line", () => {
    for (const lat of [40, 0, -40]) {
      const ring = ringOf([
        [2, lat],
        [-0.9999999999999996, lat + 1.7320508075688774],
        [-1.0000000000000009, lat - 1.732050807568877],
      ]);
      expectLaws(polygon(ring), 0.75, ringArea(ring));
    }
  });

  it("gives no triangles for a ring with no area", () => {
    const flat = ringOf([
      [0, 0],
      [5, 0],
    ]);
    expect(regionSurface(polygon(flat), 1).triangles).toHaveLength(0);
  });

  it("throws a RangeError for a surface with too many corners", () => {
    expect(() => regionSurface(polygon(square(0, 0, 40, 40)), 0.5, 500)).toThrow(RangeError);
    expect(() => regionSurface(polygon(square(0, 0, 40, 40)), 0.5, 100)).toThrow("more than 100 corners");
  });

  it("holds its laws for each shape around a point", () => {
    const anyShape = fc
      .record({
        lat: fc.double({ min: -50, max: 50, noNaN: true }),
        lon: fc.double({ min: -120, max: 120, noNaN: true }),
        reaches: fc.array(fc.double({ min: 2, max: 14, noNaN: true }), { minLength: 3, maxLength: 11 }),
      })
      .map(({ lat, lon, reaches }) =>
        ringOf(
          reaches.map((reach, index): Position => {
            const angle = (index / reaches.length) * 2 * Math.PI;
            return [lon + reach * Math.cos(angle), lat + reach * Math.sin(angle)];
          }),
        ),
      );
    fc.assert(
      fc.property(anyShape, fc.constantFrom(0.75, 1, 2.5), (ring, step) => {
        expectLaws(polygon(ring), step, ringArea(ring));
      }),
      { numRuns: 60 },
    );
  });
});

describe("regionEdges", () => {
  /** This function gives the positions of a line as text. */
  const textOf = (line: Float64Array): string[] => {
    const out: string[] = [];
    for (let index = 0; index + 1 < line.length; index += 2) out.push(keyOf(line[index] ?? Number.NaN, line[index + 1] ?? Number.NaN));
    return out;
  };

  it("gives one closed line for a ring with no cut, with the points of densify", () => {
    const region = polygon(square(0, 0, 10, 10));
    const lines = regionEdges(region, 1);
    expect(lines).toHaveLength(1);
    const dense = densify(region, 1);
    const ring = dense.type === "Polygon" ? (dense.coordinates[0] ?? []) : [];
    expect(textOf(lines[0] ?? new Float64Array())).toEqual(ring.map((position) => keyOf(position[0], position[1])));
  });

  it("gives a line for each ring of each polygon", () => {
    const region: Region = { type: "MultiPolygon", coordinates: [[square(0, 0, 12, 12), square(4, 4, 8, 8)], [square(20, 0, 24, 4)]] };
    expect(regionEdges(region, 1)).toHaveLength(3);
  });

  it("gives only points that are corners of the surface", () => {
    const region = polygon(square(-7, 31, 5.5, 44.25), square(-3, 35, 1, 40));
    const surface = regionSurface(region, 1);
    const corners = new Set<string>();
    for (let index = 0; index + 1 < surface.corners.length; index += 2) corners.add(keyOf(surface.corners[index] ?? Number.NaN, surface.corners[index + 1] ?? Number.NaN));
    for (const line of regionEdges(region, 1)) for (const point of textOf(line)) expect(corners.has(point), point).toBe(true);
  });

  it("gives no line along the antimeridian for a region that continues on the other side", () => {
    // One region across the antimeridian, cut into a part at 180 east and a part at 180 west.
    const region: Region = { type: "MultiPolygon", coordinates: [[square(170, 0, 180, 10)], [square(-180, 0, -170, 10)]] };
    const lines = regionEdges(region, 1);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const points = textOf(line);
      // Each part keeps its three other edges as one line, from the antimeridian to the antimeridian.
      expect(points).toHaveLength(31);
      expect(points.filter((point) => point.startsWith("180,") || point.startsWith("-180,"))).toHaveLength(2);
    }
  });

  it("keeps a line along the antimeridian for a region that stops there", () => {
    const lines = regionEdges(polygon(square(170, 0, 180, 10)), 1);
    expect(lines).toHaveLength(1);
    expect(textOf(lines[0] ?? new Float64Array())).toHaveLength(41);
  });

  it("keeps the part of the antimeridian where the other side has no edge", () => {
    // The west part is 10 degrees high, and the east part is at different latitudes.
    const region: Region = { type: "MultiPolygon", coordinates: [[square(170, 20, 180, 30)], [square(-180, 0, -170, 10)]] };
    for (const line of regionEdges(region, 1)) expect(textOf(line)).toHaveLength(41);
  });

  it("gives no line along a pole", () => {
    // The top edge of this region is one point of the Earth: the north pole.
    const lines = regionEdges(polygon(square(0, 80, 90, 90)), 5);
    expect(lines).toHaveLength(1);
    const points = textOf(lines[0] ?? new Float64Array());
    expect(points[0]).toBe(keyOf(0, 90));
    expect(points[points.length - 1]).toBe(keyOf(90, 90));
    expect(points.filter((point) => point.endsWith(",90"))).toHaveLength(2);
  });

  it("gives no lines for a region that is all cuts", () => {
    const flat = ringOf([
      [0, 90],
      [50, 90],
      [100, 90],
    ]);
    expect(regionEdges(polygon(flat), 1)).toEqual([]);
  });
});

describe("gridLines", () => {
  /** This function gives the two ends of a line. */
  const endsOf = (line: Float64Array): number[] => [line[0] ?? Number.NaN, line[1] ?? Number.NaN, line[line.length - 2] ?? Number.NaN, line[line.length - 1] ?? Number.NaN];

  it("gives no lines for a spacing of 0 or less", () => {
    expect(gridLines(0, 1)).toEqual([]);
    expect(gridLines(-15, 1)).toEqual([]);
    expect(gridLines(Infinity, 1)).toEqual([]);
    expect(gridLines(15, 0)).toEqual([]);
  });

  it("gives the meridians and the parallels at each spacing", () => {
    const lines = gridLines(30, 1).map(endsOf);
    const meridians = lines.filter(([fromLon, , toLon]) => fromLon === toLon);
    const parallels = lines.filter(([fromLon, , toLon]) => fromLon !== toLon);
    expect(meridians.map(([lon]) => lon)).toEqual([-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]);
    expect(parallels.map(([, lat]) => lat)).toEqual([-60, -30, 0, 30, 60]);
    for (const [fromLon, , toLon] of parallels) expect([fromLon, toLon]).toEqual([-180, 180]);
  });

  it("stops each meridian before the poles, but the meridians at each 90 degrees", () => {
    for (const [lon = Number.NaN, fromLat, , toLat] of gridLines(30, 1)
      .map(endsOf)
      .filter(([fromLon, , toLon]) => fromLon === toLon)) {
      expect([fromLat, toLat], `the meridian ${lon}`).toEqual(lon % 90 === 0 ? [-90, 90] : [-60, 60]);
    }
  });

  it("gives the equator and four meridians for a spacing of 90 degrees", () => {
    const lines = gridLines(90, 5).map(endsOf);
    expect(lines).toEqual([
      [-180, -90, -180, 90],
      [-90, -90, -90, 90],
      [0, -90, 0, 90],
      [90, -90, 90, 90],
      [-180, expect.closeTo(0, 12), 180, expect.closeTo(0, 12)],
    ]);
  });

  it("makes no step of a line longer than the step", () => {
    fc.assert(
      fc.property(fc.constantFrom(10, 15, 22.5, 45), fc.double({ min: 0.5, max: 7, noNaN: true }), (spacing, step) => {
        for (const line of gridLines(spacing, step)) {
          for (let index = 2; index + 1 < line.length; index += 2) {
            const size = Math.max(Math.abs((line[index] ?? 0) - (line[index - 2] ?? 0)), Math.abs((line[index + 1] ?? 0) - (line[index - 1] ?? 0)));
            expect(size).toBeLessThanOrEqual(step + 1e-9);
          }
        }
      }),
    );
  });
});
