# Roadmap

This file is the plan of visuals. The Status page of the site reads it, and the tracker of the project mirrors it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| R1 | The stage core | in progress | `@mark1russell7/visuals` has a stage on three.js: a camera that a person moves, views by name, picking, marks, themes and a picture only after a change. The camera maths is pure, so a test in Node.js examines it. The stage comes from the viewer of `@mark1russell7/room-view`. Next: the first release on npm. |
| R2 | The globe | open | A content for a stage that shows the Earth: from the whole Earth to one region, with areas, points and levels as data. The sphere maths goes to `@mark1russell7/geo`. The site shows it with sample data. |
| R3 | The time scrubber | open | A control that replays how records change with time, for each stage. |
| R4 | Markers and links | open | The signs that turn to the camera and the dashed links of room-view move to this package. |
| R5 | The room viewer on the stage | open | `@mark1russell7/room-view` builds its viewer on the stage, and keeps only the model of a room. |
| R6 | The demo site | open | The site becomes a live demo: a stage with sample data that a person turns, selects and replays. |
