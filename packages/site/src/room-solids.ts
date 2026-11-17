import { BoxGeometry, BufferGeometry, Color, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, PlaneGeometry, type Object3D } from "three";
import type { StageTheme } from "@mark1russell7/visuals";
import type { MarkersTheme } from "@mark1russell7/visuals/markers";
import type { StageContent } from "@mark1russell7/visuals/three";
import type { RoomSolid } from "./room-sample.ts";

/** The colors of the surfaces of the room. Each color is a CSS hex color. */
export interface SolidsTheme extends StageTheme {
  readonly wall: string;
  readonly floor: string;
  /** The color of a box. */
  readonly solid: string;
  /** The color of the lines along the edges of the surfaces. */
  readonly edge: string;
  /** The color of the edges of a box whose record has a highlight. */
  readonly accent: string;
}

/** The colors of the room demo: the surfaces of the room, and the marks on them. */
export interface RoomTheme extends SolidsTheme, MarkersTheme {}

/** The size of a room: its width along the x axis, its height along the y axis and its depth along the z axis. */
export interface RoomSize {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

/** The part of the color of the highlight in a box, for each highlight. */
const TINT: readonly [number, number, number] = [0, 0.1, 0.2];

/** The parts of the picture of one record: its boxes have one material, and their edges have one material. */
interface Part {
  readonly fill: MeshLambertMaterial;
  readonly line: LineBasicMaterial;
}

/**
 * This function makes the content of a stage that shows a room: a floor, a back wall, a left wall and boxes.
 *
 * - The space has the y axis up. The back wall is the plane z = 0, and the left wall is the plane x = 0.
 * - A wall has one side. Thus a camera behind a wall sees into the room.
 * - A box is a record, and a pick gives its distance. A stack then finds the nearest of a box and a mark.
 * - The floor and the walls are no records.
 */
export function createSolids(room: RoomSize, solids: readonly RoomSolid[]): StageContent<RoomSolid, SolidsTheme> {
  const geometries: BufferGeometry[] = [];
  const objects: Object3D[] = [];
  const keep = <G extends BufferGeometry>(geometry: G): G => {
    geometries.push(geometry);
    return geometry;
  };
  // The surfaces are a small distance behind their depth. Thus a line or a mark on a surface is in front of it.
  const surface = (): MeshLambertMaterial => new MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const wall = surface();
  const floor = surface();
  const edge = new LineBasicMaterial();

  /** This function adds a flat surface and the lines along its edges. `turn` puts the plane in its position. */
  const plane = (width: number, height: number, material: MeshLambertMaterial, turn: (object: Object3D) => void): void => {
    const geometry = keep(new PlaneGeometry(width, height));
    for (const object of [new Mesh(geometry, material), new LineSegments(keep(new EdgesGeometry(geometry)), edge)]) {
      turn(object);
      objects.push(object);
    }
  };
  plane(room.width, room.depth, floor, (object) => {
    object.rotation.x = -Math.PI / 2;
    object.position.set(room.width / 2, 0, room.depth / 2);
  });
  plane(room.width, room.height, wall, (object) => {
    object.position.set(room.width / 2, room.height / 2, 0);
  });
  plane(room.depth, room.height, wall, (object) => {
    object.rotation.y = Math.PI / 2;
    object.position.set(0, room.height / 2, room.depth / 2);
  });

  const parts = new Map<string, Part>();
  const boxes: Mesh[] = [];
  const solidOf = new Map<Object3D, RoomSolid>();
  for (const solid of solids) {
    let part = parts.get(solid.record);
    if (part === undefined) {
      part = { fill: surface(), line: new LineBasicMaterial() };
      parts.set(solid.record, part);
    }
    const geometry = keep(new BoxGeometry(solid.high.x - solid.low.x, solid.high.y - solid.low.y, solid.high.z - solid.low.z));
    const box = new Mesh(geometry, part.fill);
    const lines = new LineSegments(keep(new EdgesGeometry(geometry)), part.line);
    for (const object of [box, lines]) {
      object.position.set((solid.low.x + solid.high.x) / 2, (solid.low.y + solid.high.y) / 2, (solid.low.z + solid.high.z) / 2);
      objects.push(object);
    }
    boxes.push(box);
    solidOf.set(box, solid);
  }
  // A ray finds a box only after the box has its matrix. The boxes do not move, so one calculation is sufficient.
  for (const object of objects) object.updateMatrixWorld();

  const corners = [0, room.width].flatMap((x) => [0, room.height].flatMap((y) => [0, room.depth].map((z) => ({ x, y, z }))));
  const tint = new Color();

  return {
    objects,
    extent: { corners, center: { x: room.width / 2, y: room.height * 0.4, z: room.depth / 2 } },
    has: (record) => parts.has(record),
    pick(ray) {
      const [hit] = ray.intersectObjects(boxes, false);
      const solid = hit === undefined ? undefined : solidOf.get(hit.object);
      return hit === undefined || solid === undefined ? undefined : { record: solid.record, value: solid, distance: hit.distance };
    },
    paint(theme, highlight): void {
      wall.color.set(theme.wall);
      floor.color.set(theme.floor);
      edge.color.set(theme.edge);
      for (const [record, part] of parts) {
        const lit = highlight(record);
        part.fill.color.set(theme.solid).lerp(tint.set(theme.accent), TINT[lit]);
        part.line.color.set(lit === 0 ? theme.edge : theme.accent);
      }
    },
    dispose(): void {
      for (const geometry of geometries) geometry.dispose();
      for (const material of [wall, floor, edge]) material.dispose();
      for (const part of parts.values()) {
        part.fill.dispose();
        part.line.dispose();
      }
    },
  };
}
