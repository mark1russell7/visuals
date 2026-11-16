# visuals

3D stages and viewers for data, on three.js. A stage has the camera, the views, the picking and the highlights. Each viewer puts its own content on a stage. The marks that the viewers draw are plain data.

[`docs/ROADMAP.md`](docs/ROADMAP.md) has the plan.

## The packages

| Package | What it has |
| --- | --- |
| [`@mark1russell7/visuals`](packages/visuals/README.md) | The stage on three.js, the camera maths with no browser, a globe of the Earth, and the marks of the viewers as plain data. |

`@mark1russell7/layout-contract` gives the 3D points. `@mark1russell7/room-view` has the model of a room, and it moves to these stages.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint:ste
```

The license is MIT.
