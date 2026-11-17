import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const entry = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("the home page", () => {
  it("names the package and gives the install command", () => {
    expect(page).toContain("<title>visuals</title>");
    expect(page).toContain("npm install @mark1russell7/visuals three");
  });

  it("links to the pages of site-pages and to the repository", () => {
    expect(page).toContain('href="./releases/"');
    expect(page).toContain('href="./status/"');
    expect(page).toContain('href="https://github.com/mark1russell7/visuals"');
  });

  it("has each element that the entry of the page uses", () => {
    const ids = [...entry.matchAll(/byId(?:<[^>]+>)?\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids).toContain("time");
    for (const id of ids) expect(page).toContain(`id="${id}"`);
  });

  it("shows how to put a scrubber in a page, with its style sheet", () => {
    expect(page).toContain('import { createScrubber } from "@mark1russell7/visuals/scrubber";');
    expect(page).toContain('import "@mark1russell7/visuals/scrubber.css";');
  });

  it("shows how to put labels on a stage, with their style sheet", () => {
    expect(page).toContain('import { createLabels } from "@mark1russell7/visuals/labels";');
    expect(page).toContain('import "@mark1russell7/visuals/labels.css";');
    expect(page).toContain("stackContents([globe, labels])");
  });

  it("shows how to put marks on a scene", () => {
    expect(page).toContain('import { createMarkers } from "@mark1russell7/visuals/markers";');
    expect(page).toContain("stackContents([room, markers])");
  });

  it("has the room, and tells that the room is sample data", () => {
    const ids = [...entry.matchAll(/byId(?:<[^>]+>)?\("(room[^"]*)"\)/g)].map((match) => match[1]);
    expect(ids).toHaveLength(8);
    expect(page).toContain("Sample data. The room and each value are made up.");
  });

  it("tells that the records are sample data, and names the source of the land", () => {
    expect(page).toContain("Sample data. The warnings and the earthquakes are made up.");
    expect(page).toContain('href="https://www.naturalearthdata.com/"');
  });
});
