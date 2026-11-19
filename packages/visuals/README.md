# @mark1russell7/visuals

3D stages for data. A stage is one canvas of three.js with a camera that a person moves. The content of the stage is your data.

The package has eight entries and two style sheets:

- The entry `.` has the camera maths and the model of a replay. It needs no browser, and it does not need `three`.
- The entry `/marks` has the marks that a viewer draws, as plain data. It needs no browser, and it does not need `three`.
- The entry `/three` has the stage. It needs the package `three`, version 0.187.0 or later.
- The entry `/globe` has a content that shows the Earth as a globe, with areas and points on it. It also needs `three`.
- The entry `/markers` has a content that draws the marks on a stage. It also needs `three`.
- The entry `/scrubber` has a control that sets the time of a picture. It needs a browser, and it does not need `three`.
- The file `/scrubber.css` is the style sheet of the scrubber.
- The entry `/labels` has the labels of a stage: a short text next to a point, as an element of the page. It needs a browser.
- The file `/labels.css` is the style sheet of the labels.
- The entry `/graph` has the stage of a flat picture, for example a graph of boxes and edges. It does not need `three`.

## Install

```sh
npm install @mark1russell7/visuals three
```

A package that uses only the entries `.`, `/marks`, `/scrubber` and `/graph` does not install `three`.

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
  paint: (_theme, highlight) => void material.color.set(highlight("box") === 0 ? "#4f7cac" : "#e0a03a"),
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

`stageSupported` of the entry `.` tells if the browser has WebGL 2. Use it before a dynamic `import()` of the module that makes the stage. Then a browser with no WebGL 2 does not load `three`.

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
| `paint` | The colors of each part, from the theme and the highlight of its record. |
| `step` | The parts that change with the camera or with the time, before each picture. It is optional. |
| `dispose` | The release of the memory of the graphics card. |

`stackContents` makes one content from a list of contents. The first content gives the extent, and a pick asks the last content first.

A pick can have a `distance` from the start of the ray. The stack then also asks the earlier contents, and the nearest pick is the record. A pick with no distance is above each record of the earlier contents.

A record has a name. The highlight of a record is 0, 1 or 2: no highlight, a record under the pointer, the selected record. `highlight` and `select` set the highlights from the page.

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

- In a drag, the surface at the middle of the picture follows the pointer, at each height of the camera. So a small region does not go out of the picture with one drag.
- Near the surface, an arrow key moves the surface by one eighth of the height of the picture.
- The zoom becomes slower near the surface.
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
- A style with `dash` draws the edge of its areas as a dashed line. `dash` has the length of a dash and of a gap, in CSS pixels. The edge of a highlight keeps the dash.
- The pointer finds a point first, then the last area of the list. The pointer ignores a part with `pick: false`.
- `show` hides each part that a test refuses, for example the records that are not active at a time.
- `placeAt` gives the place on the Earth under the pointer.
- The globe uses no map tiles and no service. Give the land to it as an area.

The views of a globe:

- `globeView(place, degrees)` shows the cap of the Earth around a place. The default shows a half of the Earth.
- `regionView(regions)` shows each region of a list, from above their middle. The regions fill the width or the height of the picture.

The functions of the globe maths have no state. A test in Node.js uses them:

| Function | What it gives |
| --- | --- |
| `globePoint`, `globePlace` | The point of the globe for a place on the Earth, and the place for a point. |
| `regionSurface` | The triangles of the surface of a region. No edge is longer than 1.25 steps. |
| `regionEdges` | The lines of the outline of a region. A cut on the antimeridian or at a pole gives no line. |
| `gridLines` | The meridians and the parallels of a grid. |
| `rayBall`, `inSight` | The first point of a ball on a ray, and if a camera sees a point of the ball. |
| `pointRadius` | The radius of the mark of a point: a half of its dot, and its ring. A label uses it as its `clear`. |

```ts
import { globePoint, regionSurface } from "@mark1russell7/visuals/globe";

globePoint({ lat: 0, lon: 0 }); // => { x: 0, y: 0, z: 1 }: the axis z goes to latitude 0 and longitude 0, and the axis y to the north pole

const surface = regionSurface(storm.region, 2);
surface.corners.length / 2; // => 43: the corners of the outline with a step of 2 degrees, and the corners in the surface
surface.triangles.length / 3; // => 70
```

## Labels

The entry `/labels` has a layer of labels. A label is a short text next to a point of a stage, for example the name of a place.

```ts
import { globePoint, inSight, pointRadius } from "@mark1russell7/visuals/globe";
import { createLabels } from "@mark1russell7/visuals/labels";
import { createStage, stackContents } from "@mark1russell7/visuals/three";
import "@mark1russell7/visuals/labels.css";

const labels = createLabels(box, {
  labels: [{ record: "city", at: globePoint({ lat: 32.8, lon: -96.8 }), text: "Dallas", rank: 1, clear: pointRadius(8) }],
  visible: (point, eye) => inSight(point, eye, 1),
});
const stage = createStage(box, { content: stackContents([globe, labels]), theme, label: "The Earth with the name of one city" });

labels.show((label) => label.record !== "city"); // The name of the city goes out of the picture.
stage?.refresh();
```

- The layer is a content of a stage with no three.js object. `stackContents` shows it with the content that it names.
- Give the container of the stage `position: relative`. The layer then fills the picture, above the canvas.
- Each label is an HTML element. So its text is sharp at each size, and it has the font of the page.
- No text is on a different text, on the mark of a different label, or out of the picture.
- When two texts have one place, the label of a highlighted record stays. Then the label with the higher `rank` stays.
- A label tries its sides in this sequence: right, left, above, below. The field `sides` gives a different sequence.
- Use the side `center` for the name of an area: the middle of the text is then on the point.
- `clear` is the radius of the mark at the point. The text stays off the mark, at the gap from it.
- `visible` tells if the camera sees a point. For a globe, `inSight` removes each name on the far side of the Earth.
- The places are a function of the picture. While the picture does not move, a highlight moves no text.
- The pointer goes through the layer to the picture. A screen reader ignores the layer, so give the names in the page too.
- The layer writes no inline style attribute, so it works under a strict content security policy.

`placeLabels` is the pure function that gives each text its place. A test in Node.js and a different renderer use the same function.

```ts
import { placeLabels } from "@mark1russell7/visuals/labels";

// Two labels at one point, each with a text of 60 by 16 pixels and a dot with a radius of 5 pixels.
const label = { x: 100, y: 100, width: 60, height: 16, clear: 5 };
placeLabels([label, label], { width: 400, height: 300 });
// => [{ side: "right", box: { x: 109, y: 92, w: 60, h: 16 } }, { side: "left", box: { x: 31, y: 92, w: 60, h: 16 } }]
```

The style sheet is plain CSS. A label takes its font from the page.

| Variable | What it sets | Default |
| --- | --- | --- |
| `--labels-ink` | The color of the text. | `CanvasText` |
| `--labels-halo` | The color around each letter. Give it the color behind the picture. | `Canvas` |
| `--labels-size` | The size of the text. | `0.8125rem` |

Each text has the kind of its label in `data-kind` and its side in `data-side`. A style sheet of the page gives each kind a look.

## A scrubber

The entry `/scrubber` has a control with which a person sets the time of a picture, and replays its changes.

```ts
import { changeTimes, isLive, replayOf, type Lifetime } from "@mark1russell7/visuals";
import { createScrubber } from "@mark1russell7/visuals/scrubber";
import "@mark1russell7/visuals/scrubber.css";

// The value of each part of a globe is its lifetime, in hours.
const lives: readonly Lifetime[] = [{ from: 6, to: 18 }, { from: 12 }];

const scrubber = createScrubber(document.body, {
  label: "Time of the picture",
  replay: replayOf({ from: 0, to: 24 }),
  times: changeTimes(lives), // => [6, 12, 18]
  labels: [
    { at: 0, text: "00:00" },
    { at: 12, text: "12:00" },
  ],
  format: (at) => `${String(Math.floor(at)).padStart(2, "0")}:00`,
  onChange: ({ at }) => {
    globe.show((part) => isLive(part.value, at));
    stage.refresh();
  },
});
```

- The control has a button for the replay, the text of the time, a slider on an axis and a button for the speed.
- The axis has a tick at each time of `times`. The ticks of the time that passed have the color of the ink.
- The slider is an `input` of the type `range`. A pointer, a touch screen, a keyboard and a screen reader use it.
- The arrow keys go from one change to the next change. The keys `PageUp` and `PageDown` go a tenth of the range.
- The keys `Home` and `End` go to the ends of the range. The key Space starts and stops the replay.
- A replay at the end of its range starts again from the start. A replay stops at the end.
- `onChange` gets each new state. The control knows nothing about the picture, so it works with each stage and each page.
- `setReplay`, `setTimes` and `setLabels` change the control from the page, for example after new data.
- The control writes no inline style and no inline script, so it works under a strict content security policy.

The style sheet is plain CSS. A bundler takes it from the import. A page with no bundler links to the file of the package.
The control takes its font and the color of its text from the page.

| Variable | What it sets | Default |
| --- | --- | --- |
| `--scrubber-ink` | The color of the handle, the ticks of the time that passed, and the button of the replay. | The color of the text |
| `--scrubber-quiet` | The color of the labels of the axis. | 68% of the color of the text |
| `--scrubber-line` | The color of the ticks of the time to come, and of the border of the button of the speed. | 45% of the color of the text |
| `--scrubber-surface` | The color in the ring of the handle. Give it the color behind the control. | `Canvas` |
| `--scrubber-focus` | The color of the focus ring. | `Highlight` |
| `--scrubber-time-width` | The width of the text of the time in a control with one row. Thus the axis does not move. | `11rem` |

A narrow control has two rows. A control that is 44 rem wide or more has one row. The width is the width of its container.

## The replay

A replay is a value: a range of time, the time of the picture, the speed, and if the time goes. Each function gives a new value.

```ts
import { changeIndex, changeTimes, isLive, replayAdvance, replayKey, replayOf, replayPlay } from "@mark1russell7/visuals";

const times = changeTimes([{ from: 6, to: 18 }, { from: 12 }]); // => [6, 12, 18]
isLive({ from: 6, to: 18 }, 18); // => false: a part is not in the picture at its end

const replay = replayOf({ from: 0, to: 24 }); // The picture is at the end of the range, and the time does not go.
const start = replayPlay(replay); // The replay starts again from the start of the range.
replayAdvance(start, 5000, 20_000).at; // => 6: a quarter of the duration is a quarter of the range
replayKey("ArrowLeft", replay, times)?.at; // => 18: the last change before the time
changeIndex(times, 13); // => 2: draw the picture again only when this count changes
```

| Function | What it gives |
| --- | --- |
| `isLive` | If a part with a lifetime is in the picture at a time. |
| `changeTimes`, `spanOfTimes` | The sorted times at which a picture changes, and the range from the first time to the last time. |
| `changeAfter`, `changeBefore`, `changeIndex` | The next change, the change before, and the count of the changes that are not after a time. |
| `spanPart`, `spanTime` | The place of a time in a range from 0 to 1, and the time at a place. |
| `replayOf`, `replaySeek`, `replaySpan` | A replay of a range, a replay at a time, and a replay with a new range. |
| `replayPlay`, `replayPause`, `replayToggle` | A replay that goes, and a replay that does not go. |
| `replayAdvance` | The replay after a time of the clock. |
| `replayNextSpeed`, `replayKey` | The replay with the next speed, and the replay after a key. |

A time is a number in a unit that the page chooses. `replaySpan` keeps a picture of the present at the present when the range becomes longer.

## The marks

A mark is a record that a viewer draws. A mark is plain data with no topic, so each viewer draws the marks of each producer.

```ts
import { checkMarks, levelShape, shapeRing, type Mark } from "@mark1russell7/visuals/marks";

const marks: readonly Mark[] = [
  {
    type: "point",
    record: "outlet-1",
    kind: "outlet",
    level: "near",
    label: "Outlet 1",
    frame: { at: { x: 1, y: 0, z: 0.3 }, out: { x: 0, y: 1, z: 0 } },
  },
  { type: "meter", record: "circuit-1", kind: "circuit", level: "over", label: "Circuit 1", value: 1900, limit: 1440, unit: "W" },
];

checkMarks(marks); // => []: the list has no fault
levelShape("near"); // => "triangle"
shapeRing("triangle").length; // => 3: the corners of the sign, counter-clockwise
```

| Mark | Data | Example |
| --- | --- | --- |
| `point` | A frame and a size | An outlet, a tap, a lamp |
| `run` | A list of frames and a width | A cable, a pipe, a duct |
| `link` | Two ends, each with a record name and a point | A power line from an outlet to a computer |
| `field` | A grid of values on a plane, and a scale | Light in lux, sound in decibels, heat |
| `meter` | A value, the text of the unit, and a limit when there is one | The load of a circuit against its limit |

- Each mark has a record name, a kind, a level and a label. The kind is a word of the producer for the legend and the filter.
- A frame is a point of a surface and the unit vector out of the surface.
- The level of a mark is `unknown`, `ok`, `near` or `over`. The producer calculates it, because each topic has its own limits.
- A mark has no shape and no color. `levelShape` gives each level its shape, and the theme of a viewer gives its color.
- Thus a person who does not see a color reads the level from the shape: a ring, a disc, a triangle or a square.
- A viewer draws the marks in the sequence of `levelRank`, so the worst level is always in view.
- A field has its values row by row, with `null` for a cell with no value. `fieldValue` and `fieldCellCenter` read a cell.
- A meter has no place. A page draws it in a panel, and a 3D view ignores it.
- A meter with no limit has no `limit`. A page shows only its value and its unit.
- Each point of a list of marks is in one space. The producer tells the unit and the axes of that space.
- `transformMarks` gives the marks in a different space. It moves each point, and it turns each direction.

```ts
import { transformMarks } from "@mark1russell7/visuals/marks";

// The marks of a room have the z axis up. A stage has the y axis up: a turn of a quarter about the x axis.
const onStage = transformMarks(marks, { position: { x: 0, y: 0, z: 0 }, rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } });
```

A transform is a `Transform3` of `@mark1russell7/layout-contract`. It has no scale, so each length of a mark stays.

`checkMarks` gives the faults of a list, each with a code, the index of its mark and the part with the fault. It examines the values that the types do not hold:

- A number that is not finite, and a direction that is not a unit vector.
- A size, a width or a cell that is not more than 0.
- The grid, the values and the scale of a field, and a run with fewer than 2 points.
- An empty name, an empty label, and a level or a type that is not known.

Use it as a gate in the tests of a producer. A viewer uses it on a list that it did not make. It does not examine the form of a mark, so read a list from JSON through a schema first.

## The marks on a stage

The entry `/markers` has a content that draws a list of marks. Put it after the content of the solids in `stackContents`.

```ts
import { fitView } from "@mark1russell7/visuals";
import { createMarkers, type MarkersTheme } from "@mark1russell7/visuals/markers";
import { createStage, stackContents } from "@mark1russell7/visuals/three";

const theme: MarkersTheme = {
  sky: "#ffffff",
  ground: "#ffffff",
  levels: { unknown: "#55677a", ok: "#1f5fa8", near: "#c9740a", over: "#b81d3a" },
  halo: "#ffffff",
  accent: "#111111",
  field: ["#eef4f1", "#8fcab7", "#1d7f69"],
};

const markers = createMarkers(marks);
const stage = createStage(box, {
  // The content `room` has the solids. The marks are on top of them.
  content: stackContents([room, markers]),
  theme,
  label: "A room with its marks",
  views: { corner: fitView({ polar: 1, azimuth: 0.7 }) },
  home: "corner",
  onHover: (mark) => console.log(mark?.label),
});

// The legend of a page shows only the marks of some kinds.
markers.show((mark) => mark.kind !== "cable");
stage?.refresh();
```

| Mark | Picture |
| --- | --- |
| `point` | A sign with the shape and the color of its level. The sign looks at the camera. |
| `run` | A round line with its width in the space, and a thin line of the color `halo` around it. |
| `link` | A dashed line. It is in the picture while its record, or the record of one of its ends, has a highlight. |
| `field` | A grid of colors on its plane. A cell with no value is clear. |
| `meter` | No picture, because a meter has no place. |

- A point with no `size` has a sign with a radius of `SIGN_RADIUS` pixels at each distance. A size is in the unit of the space.
- A mark behind a solid stays in the picture with less color. A mark with a highlight stays solid.
- A sign gets the pick before each solid, also behind a solid. Thus the pointer finds an outlet behind a desk.
- A run and a field give the distance of their pick, so a solid in front of them gets the pick. A run gets the pick before a field.
- The theme gives the color of each level, the colors of a field from `min` to `max`, and the color `halo` around a mark.
- A record with a highlight gets a larger sign, and a line of the color `accent` around it.
- `signReach` gives the radius of a sign with its line. Give it to the field `clear` of a label.
- The pick of a field gives the mark. `fieldValue` reads the value of a cell.
- The content draws the marks in the space of the stage. `transformMarks` moves the marks of a different space into it.

## A flat picture

The entry `/graph` is for a flat picture that a person moves and zooms, for example a graph of boxes and edges.
It has a stage on a canvas, and the content for a picture of a layout.
It has the maths of its camera, its pointers and its keys too. It imports no `three`.

```ts
import { aimRects, createPictureStage, type PictureContent } from "@mark1russell7/visuals/graph";

interface Box {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const first: Box = { id: "a", x: 0, y: 0, w: 160, h: 60 };
const boxes: readonly Box[] = [first, { id: "b", x: 240, y: 120, w: 160, h: 60 }];

// A content draws in CSS pixels. The view of the frame has the zoom and the position of the picture.
const content: PictureContent<Box, { readonly box: string; readonly selected: string }> = {
  bounds: { x: 0, y: 0, w: 400, h: 180 },
  has: (record) => boxes.some((box) => box.id === record),
  pick: ({ point }) => {
    const box = boxes.find((b) => point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h);
    return box === undefined ? undefined : { record: box.id, value: box };
  },
  draw(context, { view }, theme, highlight) {
    context.translate(view.x, view.y);
    context.scale(view.k, view.k);
    for (const box of boxes) {
      context.fillStyle = highlight(box.id) === 0 ? theme.box : theme.selected;
      context.fillRect(box.x, box.y, box.w, box.h);
    }
    return false;
  },
};

const stage = createPictureStage(document.body, {
  content,
  theme: { box: "#c8d0d8", selected: "#2f6fd0" },
  label: "Two boxes",
  views: { first: aimRects([first], { least: 0.6 }) },
  keys: { f: "first" },
  onSelect: (box) => console.log(box?.id),
});
stage?.setView("first");
```

The stage fills its container, so give the container a size. `createPictureStage` gives `undefined` when the browser gives no 2D context.

- A drag moves the picture. The wheel, two fingers and a double click change the zoom at the pointer.
- A click selects the record below the pointer, and `onSelect` gets its value. `onHover` gets the record below a mouse or a pen.
- The wheel moves the page until a person uses the picture. Set `wheel` to `always` for a picture that fills the page.
- A view is an aim: a function that gives the view for a picture and a screen.
- `aimAll` shows all of the picture, and `aimRects` shows a group of boxes. `aimReveal` moves the camera only for a selection that is out of view.
- The stage asks the aim again after a change of the size, until a person moves the picture.
- A part of the picture stays in view: `keepRect` keeps 64 pixels of it in the free area.
- A very large picture gets a smaller least zoom from `zoomLimitsFor`, so a person can show all of it.
- `setInsets` tells the stage which parts of the picture the page covers. Each view uses the free area.
- `stackPictureContents` makes one content from layers, for example boxes below routes below labels.
- The stage makes a picture only after a change. A content that continues to change gives true from `draw`.
- A person who asks for less motion gets each view immediately.

| Function of the stage | What it does |
| --- | --- |
| `setContent` | It shows a different content, and disposes the old content. |
| `setTheme` | It changes the colors. |
| `setView` | It moves the camera to a view: a name of the options, or an aim. |
| `setInsets` | It sets the parts of the picture that the page covers. |
| `zoomBy` | It changes the zoom by a factor at the middle of the free area, for the buttons of a page. |
| `view`, `area` | They give the view of the camera, and the free area. |
| `highlight`, `select` | They highlight records by their names, and select one record. |
| `refresh` | It makes a new picture after a change of the content. |
| `dispose` | It removes the canvas, and disposes the content. |

The maths of the camera are pure functions, so a test in Node.js uses them:

```ts
import { fitRect, freeArea, toPicture, viewBetween, zoomView } from "@mark1russell7/visuals/graph";

// A panel of the page covers 300 pixels at the right of a picture of 1000 by 600 pixels.
const area = freeArea({ width: 1000, height: 600 }, { right: 300 }); // => { x: 0, y: 0, w: 700, h: 600 }
const all = fitRect({ x: 0, y: 0, w: 1304, h: 400 }, area); // => { x: 24, y: 200, k: 0.5 }

// A zoom at the middle of the free area: the point of the picture there stays there.
const near = zoomView(all, { x: 350, y: 300 }, 2); // => { x: -302, y: 100, k: 1 }
toPicture(near, { x: 350, y: 300 }); // => { x: 652, y: 200 }
viewBetween(all, near, 0.5).k; // => 0.707: a half of the way is a half of the factor of the zoom
```

A view has the zoom `k` and the screen position of the origin of the picture. A point `p` shows at `p * k + (x, y)`.

| Function | What it gives |
| --- | --- |
| `toPicture`, `toScreen`, `rectToScreen` | The point of the picture at a screen point, and the screen position of a point or a rectangle. |
| `viewAt`, `panView`, `zoomView` | The view that shows a point at a screen point, the view after a move, and the view after a zoom at a screen point. |
| `wheelFactor` | The factor of the zoom for one event of a wheel, also for a pinch on a touch pad. |
| `pinchView` | The view after the two pointers of a pinch move. Each pointer keeps its point of the picture. |
| `freeArea` | The part of a picture that the page does not cover. A camera shows a selection there. |
| `fitRect` | The view that shows a rectangle in an area, as large as the area permits. |
| `zoomLimitsFor` | The limits of the zoom for a picture, with a least zoom that shows all of it. |
| `keepRect` | The view that keeps a part of a rectangle in an area, so a person cannot lose the picture. |
| `aimAll`, `aimRects`, `aimReveal` | The aims of a stage: all of the picture, a group of boxes, and a selection. |
| `stackPictureContents` | One content from a list of contents. The last content is on top. |
| `frameRects` | The view for the first rectangle of a list that the area shows at a least zoom or more. |
| `showsRect` | True when a view shows all of a rectangle in an area. |
| `revealRects` | The view that shows a selection. It is the view of the camera when the selection is in view, so the camera stays. |
| `viewBetween`, `pictureMoveAt` | A view on the way between two views, and the view at a time of a move. |
| `pointerDown`, `pointerMove`, `pointerUp`, `pointerCancel` | The pointers that are down on a picture, the view after a pointer moved, and the answer if a pointer made a click. |
| `pictureKeyAction` | The action of a key: a move of the camera, or a view by its name. |

The pointers of a picture are a value. Each event of a pointer gives the next value:

```ts
import { NO_POINTERS, UNIT_VIEW, pointerDown, pointerMove, pointerUp, toPicture } from "@mark1russell7/visuals/graph";

let pointers = NO_POINTERS;
let view = UNIT_VIEW;
const at = (event: PointerEvent) => ({ x: event.offsetX, y: event.offsetY });

canvas.addEventListener("pointerdown", (event) => {
  pointers = pointerDown(pointers, event.pointerId, at(event));
});
canvas.addEventListener("pointermove", (event) => {
  // One pointer moves the picture. Two pointers make a pinch.
  ({ pointers, view } = pointerMove(pointers, event.pointerId, at(event), view));
});
canvas.addEventListener("pointerup", (event) => {
  const up = pointerUp(pointers, event.pointerId, at(event));
  pointers = up.pointers;
  if (up.click) select(toPicture(view, at(event)));
});
```

- One pointer moves the picture, and the point of the picture below the pointer stays there. Two pointers make a pinch.
- A click is one pointer that goes up near its start. A drag and a pinch make no click.
- A finger moves more than a mouse. Give `TOUCH_CLICK_DISTANCE` to `pointerUp` for an event with the pointer type `touch`.
- An arrow key moves the camera. The keys `+` and `-` zoom at the middle of the free area, and `Home` shows the home view.
- A move between two views is a zoom at one screen point. Each point of the picture moves along a straight line, in one direction.
- The zoom of a move changes by an equal factor for each equal step, so it has one speed in the picture.
- `frameRects` gets the bounds of groups of boxes, the largest group first. It takes the first group that a person can read.
- The zoom stays in `ZOOM_LIMITS`. Each function with a zoom takes different limits as a parameter.

## The picture of a layout

`createPictureContent` makes the content of a flat stage from a picture of `@mark1russell7/layout-contract`: its boxes, its routes and its labels.
A layout engine gives the picture. The content draws the picture, and it does not change it.

```ts
import { PICTURE_SCHEMA, pathOf, type LayoutPicture } from "@mark1russell7/layout-contract";
import { LIGHT_PICTURE_THEME, createPictureContent, createPictureStage, plainLooks } from "@mark1russell7/visuals/graph";

const picture: LayoutPicture = {
  schema: PICTURE_SCHEMA,
  boxes: [
    { id: "card", x: 0, y: 0, w: 200, h: 100 },
    { id: "row", parent: "card", x: 10, y: 30, w: 180, h: 25 },
    { id: "topic", x: 300, y: 20, w: 60, h: 60, shape: { kind: "circle", cx: 30, cy: 30, r: 30 } },
  ],
  routes: [
    {
      id: "link",
      source: "row",
      target: "topic",
      path: pathOf([
        { x: 190, y: 42 },
        { x: 300, y: 50 },
      ]),
    },
  ],
  labels: [{ id: "name", box: "card", x: 10, y: 6, w: 100, h: 18, lines: ["Card"], lineHeight: 18, font: "13px sans-serif" }],
};

const content = createPictureContent(picture, { looks: plainLooks({ end: { shape: "arrow", size: 8 } }) });
const stage = createPictureStage(document.body, {
  content,
  theme: LIGHT_PICTURE_THEME,
  label: "A card and a topic",
  onSelect: (record) => console.log(record?.id),
});

// A new layout gives a new picture. The stage shows it after a refresh.
content.setPicture({ ...picture, routes: [] });
stage?.refresh();
```

- The looks give the colors, the lines and the signs of each record. `plainLooks` gives the looks of a plain picture.
- `LIGHT_PICTURE_THEME` and `DARK_PICTURE_THEME` are the themes of the plain looks.
- A look gets the state of its record: its highlight, its focus level, the zoom, and if the box has children.
- A look of `undefined` hides a record. A hidden box takes its labels with it, and a person cannot point at it.
- A box is a rectangle with round corners, a circle, an ellipse or a polygon. Its look can add a ring off its border, and small signs.
- A route is a path of lines, curves and arcs. Its look can add an arrow or a dot at each end.
- A label has the lines and the place that the layout gives. The content breaks no line.
- In `plainLooks`, a text that is too small to read becomes bars. A text below `SMALLEST_BAR_LINE` pixels goes.
- A label look with `least` keeps the height of a line on the screen in a far view. Such a text is larger about its place, on top of each other shape.
- Two such texts do not overlap. The text of a record with a highlight comes first, then the text of the larger box.
- Such a text that an edge of the free area of the view cuts moves into the area. A text that is wider than the area keeps its place.
- Such a text stays out from below the controls of a page. The stage gives the free area from its insets.
- The name of a box in view moves into the part of its box in the free area. Thus a large box keeps its name in view.
- A label look with `boxed` makes the box of the label larger around such a text. Thus the name stays in its box at each zoom.
- A person points at a box through its larger box. The larger box has the look of its box, on top of each other shape.
- In the order of such texts, a box that is larger around its name has its larger size.
- A name that moves into the free area stays in its box: the larger box is around the box at its place and the name.
- A box with no room for its larger size stays as it is, with its name at its place.
- In `plainLooks`, the name of a box with children keeps a height that a person can read, until the box is small on the screen.
- In `plainLooks`, a box with children that has a highlight keeps its name at each size.
- At the zoom 1 or less, the lines and the signs keep their size on the screen. Above it, they grow with the boxes.
- The selected record and the records at it stay clear. Each other record has less color, and the colors change in a short time.
- `setFocus` sets the records of the focus from the page. The option `focus: "none"` stops the focus of the selection.
- A route that the looks do not show brings no box into the focus. The option `routes` of `focusOf` does the same in a test.
- A person points at the top box below the pointer. A box with no child comes before the box around it.
- The option `picks` tells which records a person can point at, for example the routes too.
- The content makes shapes only for the records in view.
- `setPicture` shows a different picture. Start `refresh` of the stage after it.
- With the option `fade` of `setPicture`, the colors change in a short time, and a new record comes into the picture. Use it for more routes between the same boxes.

A box can show an image, for example a small picture of a page. Its look gives the address of the image and its area in the box:

```ts
import { LIGHT_PICTURE_THEME, createImageStore, createPictureContent, createPictureStage, plainLooks, type PictureLooks, type PictureTheme } from "@mark1russell7/visuals/graph";

const plain = plainLooks();
// The box `card` shows an image in its top half.
const looks: PictureLooks<PictureTheme> = {
  ...plain,
  box: (box, state, theme) => {
    const look = plain.box(box, state, theme);
    if (look === undefined || box.id !== "card") return look;
    return { ...look, image: { src: "/pictures/card.png", x: 0, y: 0, w: box.w, h: box.h / 2, fit: "cover", fill: "#d3d8e3" } };
  },
};

const images = createImageStore({ onReady: () => pictured?.refresh() });
const pictured = createPictureStage(document.body, {
  content: createPictureContent(picture, { looks, images: images.get }),
  theme: LIGHT_PICTURE_THEME,
  label: "A card with an image",
});

// The page removes the stage, then the images.
pictured?.dispose();
images.dispose();
```

- The image is above the inside of its box, and below the signs of the box. Its area can have round corners.
- The fit `contain` shows all of the image in its area. The fit `cover` fills the area, and cuts the image at the edges of the area.
- `alignX` and `alignY` give the place of the image in its area, from 0 to 1. The default is the middle.
- `createImageStore` loads each image one time. Give its function `get` to the option `images` of the content.
- An image that becomes ready starts `onReady`. Start `refresh` of the stage in it.
- `loadImage` is the default loader. Its request has no credentials, so it sends no cookie of the person.
- A box whose image is not ready shows the area of the image in the color `fill`. An image whose load fails stays in that state.
- The store keeps `MOST_IMAGES` addresses. A full store removes the address that it used the longest time ago.
- The content asks only for the images of the boxes in view.
- A box that is larger around its name shows no image (`boxed` of a label look).
- `imageRect` gives the rectangle of an image in its area, for a fit and a place.

The parts of the content are pure functions. A test in Node.js examines a picture with no canvas:

```ts
import { LIGHT_PICTURE_THEME, focusOf, indexPicture, paintPicture, pickRecord, plainLooks } from "@mark1russell7/visuals/graph";

const index = indexPicture(picture);
pickRecord(index, { x: 50, y: 40 })?.id; // => "row"

// The focus of the row has the row, its card, the link and the topic.
const focus = focusOf(index, ["row"]);
const shapes = paintPicture(index, plainLooks(), LIGHT_PICTURE_THEME, { zoom: 1, highlight: () => 0, focus });
shapes.length; // => 5: the card, its name, the link, the row and the topic
```

| Function | What it gives |
| --- | --- |
| `indexPicture` | The tables of a picture: each record by its id, the children of each box, and the routes and the labels of each record. |
| `focusOf`, `boxFocus`, `routeFocus` | The focus of a list of records, and the focus level of a box or a route. `FOCUS_OPACITY` has the color share of each level. |
| `pickRecord`, `boxDistance` | The record at a point of the picture, and the distance from a point to the shape of a box. |
| `routeLine` | The path of a route as a line of points, with its bounds. |
| `plainLooks`, `lookUnit` | The looks of a plain picture, and the size of one unit of a look at a zoom. |
| `paintPicture` | The paint list of a picture: its shapes as plain data, in the order of the paint. |
| `drawShapes`, `imageRect` | The drawing of a paint list on a 2D context, in the view of a camera, and the rectangle of an image in its area. |
| `createImageStore`, `loadImage` | The images of a picture by their addresses, and the load of one image with no credentials. |
| `recordKey`, `boxState`, `routeState` | The key of a record for the function `fade` of a paint, and the state of a record for its look. |

## The camera maths

The entry `.` has pure functions. A page with no WebGL 2 and a test in Node.js use the same functions as the stage.

| Function | What it gives |
| --- | --- |
| `viewAxes` | The three axes of the camera of a view. |
| `fitDistance`, `capDistance` | The distance at which the camera shows points, or a cap of a ball. |
| `cameraPosition`, `viewOf` | The position of a camera from its place, and the place from its position. |
| `placeBetween`, `moveAt`, `easeInOut` | A place on the way between two places, and the place at a time of a move. |
| `ballView` | A view that shows points on a ball, from above their middle. The points fill the width or the height of the picture. |
| `clampPlace`, `stageLimits` | A place in the limits of a stage, and the limits from the content. |
| `reachOf`, `nearDepth` | The radius of the ball that holds the content, and the nearest depth that the camera draws. |
| `keyAction` | The action of a key. |
| `turnAcross`, `speedAt` | The turn that moves the surface of a ball by the height of the picture, and the zoom speed at a height. |
| `screenPoint` | The point of a picture that shows a point of the world, in CSS pixels. |
| `highlightOf`, `isClick` | The highlight of a record, and the difference between a click and a drag. |
| `approach` | One step of a value to its goal, for a part that changes with time. |
| `stageSupported` | True when the browser can show a stage. It gives false in Node.js. |

The space of a stage has the y axis up. A place has a target, a polar angle from the y axis, an azimuth around it and a distance.

The license is MIT.
