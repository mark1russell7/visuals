import { GeoError, type LatLon, type Position, type Region } from "@mark1russell7/geo";
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Raycaster, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Object3D } from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { describe, expect, it } from "vitest";
import type { Highlight } from "../highlight.ts";
import type { StageFrame } from "../stage/stage.ts";
import { createGlobe, type GlobeArea, type GlobeContent, type GlobePoint, type GlobeTheme } from "./content.ts";
import { surfaceSag } from "./mesh.ts";
import { globePoint } from "./space.ts";

const theme: GlobeTheme = {
  sky: "#ffffff",
  ground: "#808080",
  ball: "#0b1d2e",
  grid: "#29425a",
  shade: "#000000",
  styles: {
    land: { fill: "#336644" },
    warning: { fill: "#ff8000", opacity: 0.4, line: "#ff0000" },
    outline: { line: "#00ffcc" },
    nothing: {},
    city: { fill: "#ffffff", line: "#000000" },
    plain: { fill: "#0000ff" },
  },
  other: { fill: "#808080", opacity: 0.5 },
  hovered: "#ffff00",
  selected: "#ff00ff",
};

const noHighlight = (): Highlight => 0;

/** This function makes a region with four corners. */
function square(west: number, south: number, east: number, north: number): Region {
  const ring: Position[] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

const area = (record: string, kind: string, region: Region, pick?: boolean): GlobeArea<string> => ({ record, kind, region, value: `value of ${record}`, pick });
const point = (record: string, kind: string, place: LatLon, more: { readonly size?: number; readonly pick?: boolean } = {}): GlobePoint<string> => ({
  record,
  kind,
  place,
  value: `value of ${record}`,
  ...more,
});

/** This function makes the ray from a camera above `above` to a place on the Earth. The camera is 4 radii from the center. */
function rayTo(place: LatLon, above: LatLon = { lat: 0, lon: 0 }, radius: number = 1): Raycaster {
  const eye = globePoint(above, radius * 4);
  const goal = globePoint(place, radius);
  const direction = new Vector3(goal.x - eye.x, goal.y - eye.y, goal.z - eye.z).normalize();
  return new Raycaster(new Vector3(eye.x, eye.y, eye.z), direction);
}

/** This function gives the frame of a picture with a height, in CSS pixels. */
const frameOf = (height: number): StageFrame => ({ camera: new PerspectiveCamera(), seconds: 0, settle: true, height, fieldOfView: 32 });

/** The objects of a globe, each with its type. */
interface Parts {
  readonly ball: Mesh;
  readonly grid: LineSegments2;
  readonly fills: Mesh;
  readonly edges: LineSegments2;
  readonly shade: Mesh;
  readonly highlighted: LineSegments2;
  readonly dots: Points;
}

function meshOf(object: Object3D | undefined): Mesh {
  if (!(object instanceof Mesh)) throw new Error("The object is not a mesh.");
  return object;
}

function linesOf(object: Object3D | undefined): LineSegments2 {
  if (!(object instanceof LineSegments2)) throw new Error("The object is not a list of line segments.");
  return object;
}

function partsOf(globe: GlobeContent<string>): Parts {
  const [ball, grid, fills, edges, shade, highlighted, dots] = globe.objects;
  if (!(dots instanceof Points)) throw new Error("The last object is not a list of points.");
  return { ball: meshOf(ball), grid: linesOf(grid), fills: meshOf(fills), edges: linesOf(edges), shade: meshOf(shade), highlighted: linesOf(highlighted), dots };
}

/** This function gives the numbers of one item of an attribute. */
function itemOf(attribute: BufferAttribute | InterleavedBufferAttribute, index: number): number[] {
  const values = [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
  return attribute.itemSize > 3 ? [...values, attribute.getW(index)] : values;
}

/** This function gives the color of a material as text, for example `0b1d2e`. */
function colorOf(mesh: Mesh): string {
  const { material } = mesh;
  if (!(material instanceof MeshBasicMaterial)) throw new Error("The material has no color.");
  return material.color.getHexString();
}

/** The numbers of a CSS hex color in a buffer of three.js. */
function linear(hex: string): number[] {
  const material = new MeshBasicMaterial({ color: hex });
  return [material.color.r, material.color.g, material.color.b];
}

const close = (values: readonly number[]): unknown[] => values.map((value) => expect.closeTo(value, 6));

describe("createGlobe", () => {
  it("gives the objects in the sequence of the picture", () => {
    const globe = createGlobe<string>();
    expect(globe.objects).toHaveLength(7);
    expect(globe.objects.map((object) => object.renderOrder)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    partsOf(globe);
  });

  it("gives the extent of a ball, with the nearest camera above the surface", () => {
    expect(createGlobe<string>().extent).toEqual({ center: { x: 0, y: 0, z: 0 }, corners: [], surface: 1, minDistance: 1.005 });
    const large = createGlobe<string>({ radius: 3, nearest: 0.1 }).extent;
    expect(large.surface).toBe(3);
    expect(large.minDistance).toBeCloseTo(3.3, 12);
    expect(createGlobe<string>({ nearest: -1 }).extent.minDistance).toBeGreaterThan(1);
  });

  it("has each record of its areas and its points", () => {
    const globe = createGlobe({ areas: [area("land", "land", square(0, 0, 10, 10))], points: [point("city", "city", { lat: 5, lon: 5 })] });
    expect(globe.has("land")).toBe(true);
    expect(globe.has("city")).toBe(true);
    expect(globe.has("sea")).toBe(false);
  });

  it("shows only the ball, the shade and the grid for a globe with no data", () => {
    const globe = createGlobe<string>();
    globe.paint(theme, noHighlight);
    const { grid, fills, edges, highlighted, dots } = partsOf(globe);
    expect(grid.visible).toBe(true);
    expect(fills.visible).toBe(false);
    expect(edges.visible).toBe(false);
    expect(highlighted.visible).toBe(false);
    expect(dots.visible).toBe(false);
    expect(globe.pick(rayTo({ lat: 5, lon: 5 }))).toBeUndefined();
  });

  it("has no grid for the spacing 0", () => {
    expect(partsOf(createGlobe<string>({ grid: 0 })).grid.visible).toBe(false);
    expect(partsOf(createGlobe<string>({ grid: 30 })).grid.geometry.instanceCount).toBeGreaterThan(0);
  });

  it("puts the layer of the areas above the ball, and nearer for a smaller step", () => {
    const heightOf = (step: number): number => {
      const { fills } = partsOf(createGlobe({ areas: [area("land", "land", square(0, 0, 10, 10))], step }));
      const [x = 0, y = 0, z = 0] = itemOf(fills.geometry.getAttribute("position"), 0);
      return Math.hypot(x, y, z) - 1;
    };
    expect(heightOf(1)).toBeCloseTo(0.0005, 6);
    expect(heightOf(5)).toBeGreaterThan(heightOf(1));
    // The layer is at two times the largest height of a flat triangle below the ball.
    expect(heightOf(5)).toBeCloseTo(surfaceSag(5) * 2, 6);
  });

  it("throws an error with the name of the record for an area that is not correct", () => {
    const bad = area("storm-7", "warning", square(0, 80, 10, 95));
    expect(() => createGlobe({ areas: [area("land", "land", square(0, 0, 10, 10)), bad] })).toThrow(/^The area of the record storm-7 is not correct: /);
    try {
      createGlobe({ areas: [bad] });
      expect("no error").toBe("an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) expect(error.cause).toBeInstanceOf(GeoError);
    }
  });
});

describe("paint", () => {
  const land = area("land", "land", square(0, 0, 10, 10));
  const storm = area("storm", "warning", square(20, 0, 30, 10));

  it("gives the ball, the grid and the shade the colors of the theme", () => {
    const globe = createGlobe<string>();
    globe.paint(theme, noHighlight);
    const { ball, grid } = partsOf(globe);
    expect(colorOf(ball)).toBe("0b1d2e");
    expect(grid.material.color.getHexString()).toBe("29425a");
    globe.paint({ ...theme, ball: "#ffffff", grid: "#101010" }, noHighlight);
    expect(colorOf(ball)).toBe("ffffff");
    expect(grid.material.color.getHexString()).toBe("101010");
  });

  it("gives each corner of an area the color and the opacity of its kind", () => {
    const globe = createGlobe({ areas: [land, storm] });
    globe.paint(theme, noHighlight);
    const { fills } = partsOf(globe);
    const colors = fills.geometry.getAttribute("color");
    const count = colors.count;
    expect(itemOf(colors, 0)).toEqual(close([...linear("#336644"), 1]));
    expect(itemOf(colors, count - 1)).toEqual(close([...linear("#ff8000"), 0.4]));
    expect(fills.visible).toBe(true);
    expect(fills.geometry.drawRange.count).toBe(fills.geometry.getIndex()?.count);
  });

  it("uses the style for other kinds for a kind that the theme does not have", () => {
    const globe = createGlobe({ areas: [area("new", "a new kind", square(0, 0, 10, 10))] });
    globe.paint(theme, noHighlight);
    expect(itemOf(partsOf(globe).fills.geometry.getAttribute("color"), 0)).toEqual(close([...linear("#808080"), 0.5]));
  });

  it("draws the surface of an area only for a kind with a color, and its edge only for a kind with a line color", () => {
    const outline = createGlobe({ areas: [area("zone", "outline", square(0, 0, 10, 10))] });
    outline.paint(theme, noHighlight);
    expect(partsOf(outline).fills.visible).toBe(false);
    expect(partsOf(outline).fills.geometry.drawRange.count).toBe(0);
    expect(partsOf(outline).edges.visible).toBe(true);
    // A square of 10 degrees has 40 segments at a step of 1 degree.
    expect(partsOf(outline).edges.geometry.instanceCount).toBe(40);
    expect(itemOf(partsOf(outline).edges.geometry.getAttribute("instanceColorStart"), 0)).toEqual(close(linear("#00ffcc")));

    const filled = createGlobe({ areas: [land] });
    filled.paint(theme, noHighlight);
    expect(partsOf(filled).fills.visible).toBe(true);
    expect(partsOf(filled).edges.visible).toBe(false);
    expect(partsOf(filled).edges.geometry.instanceCount).toBe(0);

    const nothing = createGlobe({ areas: [area("zone", "nothing", square(0, 0, 10, 10))] });
    nothing.paint(theme, noHighlight);
    expect(partsOf(nothing).fills.visible).toBe(false);
    expect(partsOf(nothing).edges.visible).toBe(false);
  });

  it("draws the edge of a record with a highlight in the color of the highlight, and adds opacity to its surface", () => {
    const globe = createGlobe({ areas: [land, storm] });
    const { fills, highlighted } = partsOf(globe);
    const last = fills.geometry.getAttribute("color").count - 1;
    globe.paint(theme, (record) => (record === "storm" ? 1 : 0));
    expect(highlighted.visible).toBe(true);
    expect(highlighted.geometry.instanceCount).toBe(40);
    expect(itemOf(highlighted.geometry.getAttribute("instanceColorStart"), 0)).toEqual(close(linear("#ffff00")));
    expect(itemOf(fills.geometry.getAttribute("color"), last)[3]).toBeCloseTo(0.56, 6);

    globe.paint(theme, (record) => (record === "storm" ? 2 : 0));
    expect(itemOf(highlighted.geometry.getAttribute("instanceColorStart"), 0)).toEqual(close(linear("#ff00ff")));

    // An area with no line color gets an edge when it has a highlight.
    globe.paint(theme, (record) => (record === "land" ? 1 : 0));
    expect(highlighted.geometry.instanceCount).toBe(40);
    expect(itemOf(fills.geometry.getAttribute("color"), last)[3]).toBeCloseTo(0.4, 6);
    expect(itemOf(fills.geometry.getAttribute("color"), 0)[3]).toBe(1);

    globe.paint(theme, noHighlight);
    expect(highlighted.visible).toBe(false);
  });

  it("gives each area the colors of a new theme", () => {
    const globe = createGlobe({ areas: [land] });
    globe.paint(theme, noHighlight);
    globe.paint({ ...theme, styles: { land: { fill: "#ff0000", opacity: 0.25, line: "#0000ff" } } }, noHighlight);
    const { fills, edges } = partsOf(globe);
    expect(itemOf(fills.geometry.getAttribute("color"), 0)).toEqual(close([1, 0, 0, 0.25]));
    expect(edges.geometry.instanceCount).toBe(40);
    expect(itemOf(edges.geometry.getAttribute("instanceColorStart"), 0)).toEqual(close([0, 0, 1]));
  });

  it("gives each point its size, its color and its ring", () => {
    const globe = createGlobe({
      points: [
        point("city", "city", { lat: 5, lon: 5 }),
        point("town", "plain", { lat: 5, lon: 15 }, { size: 4 }),
        point("ghost", "nothing", { lat: 5, lon: 25 }),
        point("camp", "city", { lat: 5, lon: 35 }),
      ],
    });
    const { dots } = partsOf(globe);
    expect(dots.visible).toBe(true);
    globe.paint(theme, (record) => (record === "camp" ? 2 : 0));
    const sizes = dots.geometry.getAttribute("size");
    expect(sizes.getX(0)).toBe(9);
    expect(sizes.getX(1)).toBe(4);
    // A point of a kind with no color is not in the picture.
    expect(sizes.getX(2)).toBe(0);
    expect(sizes.getX(3)).toBeCloseTo(9 * 1.35, 5);
    expect(itemOf(dots.geometry.getAttribute("fill"), 0)).toEqual(close([1, 1, 1]));
    expect(itemOf(dots.geometry.getAttribute("ring"), 0)).toEqual(close([0, 0, 0]));
    // A point with no line color has a ring of its own color. A point with a highlight has a ring of the color of the highlight.
    expect(itemOf(dots.geometry.getAttribute("ring"), 1)).toEqual(close([0, 0, 1]));
    expect(itemOf(dots.geometry.getAttribute("ring"), 3)).toEqual(close(linear("#ff00ff")));
  });

  it("uses the size of the option for a point with no size", () => {
    const globe = createGlobe({ points: [point("city", "city", { lat: 5, lon: 5 })], pointSize: 14 });
    globe.paint(theme, noHighlight);
    expect(partsOf(globe).dots.geometry.getAttribute("size").getX(0)).toBe(14);
  });
});

describe("pick", () => {
  const land = area("land", "land", square(0, 0, 10, 10));

  it("finds the area under the pointer", () => {
    const globe = createGlobe({ areas: [land] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 5, lon: 5 }))).toEqual({ record: "land", value: "value of land" });
    expect(globe.pick(rayTo({ lat: 9.5, lon: 0.5 }))).toEqual({ record: "land", value: "value of land" });
    expect(globe.pick(rayTo({ lat: 5, lon: 12 }))).toBeUndefined();
    expect(globe.pick(rayTo({ lat: -1, lon: 5 }))).toBeUndefined();
  });

  it("finds an area on a globe of each radius", () => {
    const globe = createGlobe({ areas: [land], radius: 40 });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 5, lon: 5 }, { lat: 20, lon: -20 }, 40))?.record).toBe("land");
    expect(globe.pick(rayTo({ lat: 5, lon: 12 }, { lat: 20, lon: -20 }, 40))).toBeUndefined();
  });

  it("finds no area for a ray that does not find the Earth", () => {
    const globe = createGlobe({ areas: [land] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(new Raycaster(new Vector3(0, 0, 4), new Vector3(0, 1, 0)))).toBeUndefined();
    expect(globe.pick(new Raycaster(new Vector3(0, 3, 4), new Vector3(0, 0, -1)))).toBeUndefined();
  });

  it("finds only the side of the Earth that the camera sees", () => {
    const globe = createGlobe({ areas: [area("far", "land", square(170, -10, 179, 10))] });
    globe.paint(theme, noHighlight);
    // This ray goes through the Earth to the area on the far side.
    expect(globe.pick(rayTo({ lat: 0, lon: 175 }))).toBeUndefined();
    expect(globe.pick(rayTo({ lat: 0, lon: 175 }, { lat: 0, lon: 150 }))?.record).toBe("far");
  });

  it("finds the last area of the list first", () => {
    const storm = area("storm", "warning", square(5, 5, 15, 15));
    const globe = createGlobe({ areas: [land, storm] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 7, lon: 7 }))?.record).toBe("storm");
    expect(globe.pick(rayTo({ lat: 2, lon: 2 }))?.record).toBe("land");
    expect(globe.pick(rayTo({ lat: 12, lon: 12 }))?.record).toBe("storm");
  });

  it("finds the area below an area that the pointer does not find", () => {
    const globe = createGlobe({ areas: [land, area("shade", "warning", square(5, 5, 15, 15), false)] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 7, lon: 7 }))?.record).toBe("land");
    expect(globe.pick(rayTo({ lat: 12, lon: 12 }))).toBeUndefined();
  });

  it("finds an area with only an edge, and no area of a kind with no color", () => {
    const globe = createGlobe({ areas: [area("zone", "outline", square(0, 0, 10, 10)), area("ghost", "nothing", square(20, 0, 30, 10))] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 5, lon: 5 }))?.record).toBe("zone");
    expect(globe.pick(rayTo({ lat: 5, lon: 25 }))).toBeUndefined();
  });

  it("finds a hole of an area as no area", () => {
    const outer = square(0, 0, 12, 12);
    const hole = square(4, 4, 8, 8);
    const ring: Region = { type: "Polygon", coordinates: [...(outer.type === "Polygon" ? outer.coordinates : []), ...(hole.type === "Polygon" ? hole.coordinates : [])] };
    const globe = createGlobe({ areas: [area("ring", "land", ring)] });
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 2, lon: 2 }))?.record).toBe("ring");
    expect(globe.pick(rayTo({ lat: 6, lon: 6 }))).toBeUndefined();
  });

  it("finds a point before an area, and the point nearest to the pointer", () => {
    const globe = createGlobe({ areas: [land], points: [point("south", "city", { lat: 5, lon: 5 }), point("north", "city", { lat: 6, lon: 5 })] });
    globe.paint(theme, noHighlight);
    globe.step?.(frameOf(600));
    expect(globe.pick(rayTo({ lat: 5.3, lon: 5 }))).toEqual({ record: "south", value: "value of south" });
    expect(globe.pick(rayTo({ lat: 5.7, lon: 5 }))?.record).toBe("north");
    // This place is 3 degrees from the nearest point: 18 pixels in a picture of 600 pixels. So the pointer finds the area.
    expect(globe.pick(rayTo({ lat: 9, lon: 5 }))?.record).toBe("land");
  });

  it("finds a point in the distance of its size, in the pixels of the picture", () => {
    const globe = createGlobe({ points: [point("city", "city", { lat: 0, lon: 0 }, { size: 20 })] });
    globe.paint(theme, noHighlight);
    // One degree at the middle of this picture is 6 pixels in a picture of 600 pixels, and 1.2 pixels in a picture of 120 pixels.
    // The pointer finds this point at 14 pixels or less: a half of its size, and a margin of 4 pixels.
    const beside = rayTo({ lat: 0, lon: 3 });
    expect(globe.step?.(frameOf(600))).toBe(false);
    expect(globe.pick(beside)).toBeUndefined();
    expect(globe.pick(rayTo({ lat: 0, lon: 1 }))?.record).toBe("city");
    globe.step?.(frameOf(120));
    expect(globe.pick(beside)?.record).toBe("city");
  });

  it("finds no point on the far side of the Earth, no point of a kind with no color, and no point that the pointer does not find", () => {
    const globe = createGlobe({
      areas: [land],
      points: [point("far", "city", { lat: 5, lon: 175 }), point("ghost", "nothing", { lat: 5, lon: 5 }), point("label", "city", { lat: 5, lon: 5 }, { pick: false })],
    });
    globe.paint(theme, noHighlight);
    globe.step?.(frameOf(600));
    expect(globe.pick(rayTo({ lat: 5, lon: 5 }))?.record).toBe("land");
    // The ray to the point on the far side finds the near side of the Earth first, at 3 degrees north and 3 degrees east.
    expect(globe.pick(rayTo({ lat: 5, lon: 175 }))?.record).toBe("land");
    expect(globe.pick(rayTo({ lat: 5, lon: 175 }, { lat: 0, lon: 150 }))?.record).toBe("far");
  });
});

describe("show", () => {
  const land = area("land", "land", square(0, 0, 10, 10));
  const storm = area("storm", "warning", square(5, 5, 15, 15));
  const city = point("city", "city", { lat: 2, lon: 2 });

  it("shows only the parts that the test accepts, and the pointer finds only them", () => {
    const globe = createGlobe({ areas: [land, storm], points: [city] });
    globe.paint(theme, noHighlight);
    globe.step?.(frameOf(600));
    const { fills, edges, dots } = partsOf(globe);
    const all = fills.geometry.drawRange.count;
    expect(edges.geometry.instanceCount).toBe(40);

    globe.show((part) => part.kind === "land");
    expect(fills.geometry.drawRange.count).toBeGreaterThan(0);
    expect(fills.geometry.drawRange.count).toBeLessThan(all);
    expect(edges.visible).toBe(false);
    expect(dots.geometry.getAttribute("size").getX(0)).toBe(0);
    expect(globe.pick(rayTo({ lat: 7, lon: 7 }))?.record).toBe("land");
    expect(globe.pick(rayTo({ lat: 12, lon: 12 }))).toBeUndefined();
    expect(globe.pick(rayTo({ lat: 2, lon: 2 }))?.record).toBe("land");

    globe.show(() => true);
    expect(fills.geometry.drawRange.count).toBe(all);
    expect(edges.geometry.instanceCount).toBe(40);
    expect(dots.geometry.getAttribute("size").getX(0)).toBe(9);
    expect(globe.pick(rayTo({ lat: 7, lon: 7 }))?.record).toBe("storm");
    expect(globe.pick(rayTo({ lat: 2, lon: 2 }))?.record).toBe("city");
  });

  it("draws the triangles of the shown areas only", () => {
    const globe = createGlobe({ areas: [land, storm] });
    globe.paint(theme, noHighlight);
    const { fills } = partsOf(globe);
    const index = fills.geometry.getIndex();
    const corners = fills.geometry.getAttribute("position").count;
    globe.show((part) => part.record === "storm");
    // The corners of the second area are after the corners of the first area. The two squares have the same count of corners.
    for (let at = 0; at < fills.geometry.drawRange.count; at++) expect(index?.getX(at)).toBeGreaterThanOrEqual(corners / 2);
    expect(fills.geometry.drawRange.count).toBe((index?.count ?? 0) / 2);
  });

  it("hides the edge of a record with a highlight that the test refuses", () => {
    const globe = createGlobe({ areas: [land, storm] });
    globe.paint(theme, () => 1);
    const { highlighted } = partsOf(globe);
    expect(highlighted.geometry.instanceCount).toBe(80);
    globe.show((part) => part.record === "land");
    expect(highlighted.geometry.instanceCount).toBe(40);
    globe.show(() => false);
    expect(highlighted.visible).toBe(false);
  });

  it("keeps the test for the first paint", () => {
    const globe = createGlobe({ areas: [land, storm] });
    globe.show((part) => part.record === "land");
    globe.paint(theme, noHighlight);
    expect(globe.pick(rayTo({ lat: 12, lon: 12 }))).toBeUndefined();
    expect(globe.pick(rayTo({ lat: 7, lon: 7 }))?.record).toBe("land");
  });
});

describe("placeAt", () => {
  it("gives the place on the Earth under the pointer", () => {
    const globe = createGlobe<string>({ radius: 2 });
    const place = globe.placeAt(rayTo({ lat: 37.5, lon: -122.25 }, { lat: 30, lon: -100 }, 2));
    expect(place?.lat).toBeCloseTo(37.5, 8);
    expect(place?.lon).toBeCloseTo(-122.25, 8);
  });

  it("gives undefined for a ray that does not find the Earth", () => {
    expect(createGlobe<string>().placeAt(new Raycaster(new Vector3(0, 3, 4), new Vector3(0, 0, -1)))).toBeUndefined();
  });
});

describe("dispose", () => {
  it("releases each geometry and each material one time", () => {
    const globe = createGlobe({ areas: [area("land", "land", square(0, 0, 10, 10))], points: [point("city", "city", { lat: 5, lon: 5 })] });
    globe.paint(theme, () => 1);
    const { ball, grid, fills, edges, shade, highlighted, dots } = partsOf(globe);
    const released: string[] = [];
    const watch = (name: string, object: Mesh | LineSegments2 | Points): void => {
      object.geometry.addEventListener("dispose", () => void released.push(`${name} geometry`));
      const { material } = object;
      if (!Array.isArray(material)) material.addEventListener("dispose", () => void released.push(`${name} material`));
    };
    watch("ball", ball);
    watch("grid", grid);
    watch("fills", fills);
    watch("edges", edges);
    watch("highlighted", highlighted);
    watch("dots", dots);
    // The shade uses the geometry of the ball.
    const shadeMaterial = shade.material;
    if (!Array.isArray(shadeMaterial)) shadeMaterial.addEventListener("dispose", () => void released.push("shade material"));
    globe.dispose();
    expect(released.sort()).toEqual(
      [
        "ball geometry",
        "ball material",
        "dots geometry",
        "dots material",
        "edges geometry",
        "edges material",
        "fills geometry",
        "fills material",
        "grid geometry",
        "grid material",
        "highlighted geometry",
        "highlighted material",
        "shade material",
      ].sort(),
    );
  });
});
