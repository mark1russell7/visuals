# Roadmap

This file is the plan of visuals. The Status page of the site reads it, and the tracker of the project mirrors it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| R1 | The stage core | done | `@mark1russell7/visuals` has a stage on three.js: a camera that a person moves, views by name, picking, highlights, themes and a picture only after a change. The camera maths is pure, so a test in Node.js examines it. The stage comes from the viewer of `@mark1russell7/room-view`. Version 0.1.0 is on npm. |
| R2 | The globe | in progress | A content for a stage that shows the Earth: from the whole Earth to one region, with areas and points as data. Version 0.1.1 has it in the entry `/globe`: surfaces that follow the curve of the Earth, outlines, a grid, styles by kind, picking and a filter. The sphere maths is in `@mark1russell7/geo` 0.5.0. The home page of the site shows it with sample data. Next: the place under the pointer. |
| R3 | The time scrubber | open | A control that replays how records change with time, for each stage. |
| R4 | Marks | in progress | The marks that each viewer draws: a point, a run, a link, a field and a meter, each with a level. Version 0.2.0 has them as plain data in the entry `/marks`, with the shape of each level and `checkMarks`. The entry imports no three.js, so a package with no browser gives marks. The state of the pointer and of the selection has the new name highlight. Next: the content that draws the marks on a stage, with the signs that turn to the camera and the dashed links of room-view. |
| R5 | The room viewer on the stage | open | `@mark1russell7/room-view` builds its viewer on the stage, and keeps only the model of a room. |
| R6 | The demo site | in progress | The site becomes a live demo: a stage with sample data that a person turns, selects and replays. The home page has a live globe with sample warnings and earthquakes: a list that selects a record, a legend that filters, and three views. A browser with no WebGL 2 gets a flat map. Next: the replay, with the time scrubber. |
