# @mark1russell7/visuals

3D stages for data. A stage is one canvas of three.js with a camera that a person moves. The content of the stage is your data.

The package has two entries:

- The entry `.` has the camera maths: views, places, moves, keys and marks. It needs no browser, and it does not need `three`.
- The entry `/three` has the stage. It needs the package `three`, version 0.187.0 or later.

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

## The camera maths

The entry `.` has pure functions. A page with no WebGL 2 and a test in Node.js use the same functions as the stage.

| Function | What it gives |
| --- | --- |
| `viewAxes` | The three axes of the camera of a view. |
| `fitDistance`, `capDistance` | The distance at which the camera shows points, or a cap of a ball. |
| `cameraPosition`, `viewOf` | The position of a camera from its place, and the place from its position. |
| `placeBetween`, `moveAt`, `easeInOut` | A place on the way between two places, and the place at a time of a move. |
| `clampPlace`, `stageLimits` | A place in the limits of a stage, and the limits from the content. |
| `keyAction` | The action of a key. |
| `markOf`, `isClick` | The mark of a record, and the difference between a click and a drag. |
| `approach` | One step of a value to its goal, for a part that changes with time. |

The space of a stage has the y axis up. A place has a target, a polar angle from the y axis, an azimuth around it and a distance.

The license is MIT.
