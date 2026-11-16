# @mark1russell7/visuals

3D stages for data. A stage is one canvas of three.js with a camera that a person moves. The content of the stage is your data.

The package has three entries:

- The entry `.` has the camera maths: views, places, moves, keys and marks. It needs no browser, and it does not need `three`.
- The entry `/three` has the stage. It needs the package `three`, version 0.187.0 or later.
- The entry `/globe` has a content that shows the Earth as a globe, with areas and points on it. It also needs `three`.

## Install

```sh
npm install @mark1russell7/visuals three
```

## A stage

```ts
import { fitView } from "@mark1russell7/visuals";
import { createStage, type StageContent } from "@mark1russell7/visuals/three";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";

const material = new MeshStandardMaterial();
const box = new Mesh(new BoxGeometry(2, 1, 3), material);

const content: StageContent<string> = {
  objects: [box],
  extent: {
    center: { x: 0, y: 0, z: 0 },
    corners: [-1, 1].flatMap((x) => [-0.5, 0.5].flatMap((y) => [-1.5, 1.5].map((z) => ({ x, y, z })))),
  },
  has: (record) => record === "box",
  pick: (ray) => (ray.intersectObject(box).length > 0 ? { record: "box", value: "the box" } : undefined),
  paint: (_theme, mark) => void material.color.set(mark("box") === 0 ? "#4f7cac" : "#e0a03a"),
  dispose: () => {
    box.geometry.dispose();
    material.dispose();
  },
};

const stage = createStage(document.body, {
  content,
  theme: { sky: "#ffffff", ground: "#8a8f98" },
  label: "A box that turns",
  views: { home: fitView({ polar: 0.9, azimuth: 0.6 }), top: fitView({ polar: 0, azimuth: 0 }) },
  home: "home",
  keys: { t: "top" },
  onSelect: (value) => console.log(value), // => "the box" after a click on the box
});
```

`createStage` gives `undefined` for a browser with no WebGL 2. It does not throw. Then show a different picture of the same data.

## What a stage does

- A drag turns the content. The wheel changes the distance after a click in the picture, so the page scrolls until then.
- The arrow keys turn the content, and the keys `+` and `-` change the distance. The key `Home` shows the first view.
- A click selects the record under the pointer. The stage tells the page with `onSelect` and `onHover`.
- A view has a name. `setView` moves the camera to a view, with a short move.
- The stage makes a picture only after a change. A page with no motion uses no processor time.
- A new size of the container keeps the view, until a person moves the camera.
- The stage makes no move for a person who asks for less motion.

## The content

A stage knows nothing about the data. The content gives it these parts:

| Part | What it gives |
| --- | --- |
| `objects` | The three.js objects of the content. |
| `extent` | The space that the content fills: the point that the camera looks at, and the corners that a view shows. |
| `pick` | The record that a ray from the camera finds first. |
| `paint` | The colors of each part, from the theme and the mark of its record. |
| `step` | The parts that change with the camera or with the time, before each picture. It is optional. |
| `dispose` | The release of the memory of the graphics card. |

A record has a name. The mark of a record is 0, 1 or 2: no mark, a record under the pointer, the selected record. `highlight` and `select` set the marks from the page.

## Views

A view is a function that gives the place of the camera for a picture. So a view fits each size of the picture.

- `fitView(angles)` shows each corner of the content from one direction.
- `capView(angles, angle)` shows a part of a ball: a cap around the point below the camera.
- Your own function gives a place from the extent, the angle of the picture and its shape.

```ts
import { fitView, type StageView } from "@mark1russell7/visuals";

const front: StageView = fitView({ polar: Math.PI / 2, azimuth: 0 });
const near: StageView = (frame) => ({ ...front(frame), distance: 4 });
```

## A ball

An extent with the field `surface` has a ball around its center, for example a globe. The camera stays out of the ball.

- The turn and the zoom become slower near the surface. So a small region does not go out of the picture with one drag.
- A move between two views changes the height above the surface by a constant factor in each step.
- `capView` shows a cap of the ball. A cap of half of the ball shows all of the ball.

```ts
import { capView, type StageExtent } from "@mark1russell7/visuals";

const globe: StageExtent = { center: { x: 0, y: 0, z: 0 }, corners: [], surface: 1 };
const all = capView({ polar: 1, azimuth: 0.4 }, Math.PI / 2);
const region = capView({ polar: 0.8, azimuth: -1.3 }, 0.05);

all({ extent: globe, fieldOfView: 32, aspect: 1.5 }).distance; // => 3.79: the outline of the ball fills the height
region({ extent: globe, fieldOfView: 32, aspect: 1.5 }).distance; // => 1.18: a cap of 0.05 radians fills the height
```

## A globe

The entry `/globe` has a content for a stage that shows the Earth. The picture goes from the whole Earth to one region.

```ts
import { GLOBE_POLAR, createGlobe, globeView, regionView, type GlobeArea, type GlobeTheme } from "@mark1russell7/visuals/globe";
import { createStage } from "@mark1russell7/visuals/three";

const storm: GlobeArea<string> = {
  record: "storm",
  kind: "warning",
  value: "A storm warning",
  region: {
    type: "Polygon",
    coordinates: [
      [
        [-98, 30],
        [-90, 30],
        [-90, 36],
        [-98, 36],
        [-98, 30],
      ],
    ],
  },
};

const theme: GlobeTheme = {
  sky: "#ffffff",
  ground: "#8a8f98",
  ball: "#0d2236",
  grid: "#24415c",
  shade: "#02060a",
  styles: {
    warning: { fill: "#f0883e", opacity: 0.35, line: "#f0883e" },
    city: { fill: "#ffffff", line: "#0d2236" },
  },
  other: { fill: "#6b7785", opacity: 0.5 },
  hovered: "#ffd866",
  selected: "#ffffff",
};

const globe = createGlobe({
  areas: [storm],
  points: [{ record: "city", kind: "city", value: "A city", place: { lat: 32.8, lon: -96.8 } }],
});

const stage = createStage(document.body, {
  content: globe,
  theme,
  label: "The Earth with one storm warning",
  views: { earth: globeView({ lat: 35, lon: -95 }), storm: regionView([storm.region]) },
  home: "earth",
  polar: GLOBE_POLAR,
  pan: false,
  onSelect: (value) => console.log(value), // => "A storm warning" after a click on the area
});
```

- An area is a region of `@mark1russell7/geo`: a `Polygon` or a `MultiPolygon` of GeoJSON. A point is a place with a latitude and a longitude.
- The surface of an area follows the curve of the Earth. The option `step` sets the largest step of an edge, in degrees.
- A kind names the style of an area or a point in the theme. A new theme changes each color, and the geometry stays.
- The pointer finds a point first, then the last area of the list. The pointer ignores a part with `pick: false`.
- `show` hides each part that a test refuses, for example the records that are not active at a time.
- `placeAt` gives the place on the Earth under the pointer.
- The globe uses no map tiles and no service. Give the land to it as an area.

The views of a globe:

- `globeView(place, degrees)` shows the cap of the Earth around a place. The default shows a half of the Earth.
- `regionView(regions)` shows each region of a list, from above their middle.

The functions of the globe maths have no state. A test in Node.js uses them:

| Function | What it gives |
| --- | --- |
| `globePoint`, `globePlace` | The point of the globe for a place on the Earth, and the place for a point. |
| `regionSurface` | The triangles of the surface of a region. No edge is longer than 1.25 steps. |
| `regionEdges` | The lines of the outline of a region. A cut on the antimeridian or at a pole gives no line. |
| `gridLines` | The meridians and the parallels of a grid. |
| `rayBall`, `inSight` | The first point of a ball on a ray, and if a camera sees a point of the ball. |

```ts
import { globePoint, regionSurface } from "@mark1russell7/visuals/globe";

globePoint({ lat: 0, lon: 0 }); // => { x: 0, y: 0, z: 1 }: the axis z goes to latitude 0 and longitude 0, and the axis y to the north pole

const surface = regionSurface(storm.region, 2);
surface.corners.length / 2; // => 43: the corners of the outline with a step of 2 degrees, and the corners in the surface
surface.triangles.length / 3; // => 70
```

## The camera maths

The entry `.` has pure functions. A page with no WebGL 2 and a test in Node.js use the same functions as the stage.

| Function | What it gives |
| --- | --- |
| `viewAxes` | The three axes of the camera of a view. |
| `fitDistance`, `capDistance` | The distance at which the camera shows points, or a cap of a ball. |
| `cameraPosition`, `viewOf` | The position of a camera from its place, and the place from its position. |
| `placeBetween`, `moveAt`, `easeInOut` | A place on the way between two places, and the place at a time of a move. |
| `ballView` | A view that shows points on a ball, from above their middle. |
| `clampPlace`, `stageLimits` | A place in the limits of a stage, and the limits from the content. |
| `reachOf`, `nearDepth` | The radius of the ball that holds the content, and the nearest depth that the camera draws. |
| `keyAction` | The action of a key. |
| `markOf`, `isClick` | The mark of a record, and the difference between a click and a drag. |
| `approach` | One step of a value to its goal, for a part that changes with time. |

The space of a stage has the y axis up. A place has a target, a polar angle from the y axis, an azimuth around it and a distance.

The license is MIT.
