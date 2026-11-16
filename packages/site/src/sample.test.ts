import { regionSurface } from "@mark1russell7/visuals/globe";
import { describe, expect, it } from "vitest";
import { LAND_RINGS } from "./land.ts";
import { AREAS, KINDS, LEVELS, QUAKES, RECORDS, kindOf, landRegion, nameOf, regionOf } from "./sample.ts";

describe("the sample records", () => {
  it("gives each record a different name", () => {
    const names = RECORDS.map((record) => record.record);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain("land");
    expect(RECORDS.length).toBe(AREAS.length + QUAKES.length);
  });

  it("lists the areas from the highest level, then the earthquakes from the largest", () => {
    const areas = RECORDS.filter((record) => record.type === "area");
    const ranks = areas.map((area) => LEVELS.indexOf(area.level));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    const magnitudes = RECORDS.filter((record) => record.type === "quake").map((quake) => quake.magnitude);
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));
    expect(RECORDS.findIndex((record) => record.type === "quake")).toBe(areas.length);
  });

  it("has a record of each kind of the legend", () => {
    expect(new Set(RECORDS.map(kindOf))).toEqual(new Set(KINDS));
  });

  it("gives each area a closed outline on the Earth, and a surface for the globe", () => {
    for (const area of AREAS) {
      const first = area.outline[0];
      const last = area.outline.at(-1);
      expect(area.outline.length).toBeGreaterThanOrEqual(4);
      expect(last).toEqual(first);
      for (const [lon, lat] of area.outline) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
      expect(regionSurface(regionOf(area), 2).triangles.length).toBeGreaterThan(0);
    }
  });

  it("puts each earthquake at a place on the Earth", () => {
    for (const quake of QUAKES) {
      expect(Math.abs(quake.at.lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(quake.at.lat)).toBeLessThanOrEqual(90);
      expect(quake.depth).toBeGreaterThan(0);
    }
  });

  it("names a record for a person", () => {
    const gale = AREAS.find((area) => area.record === "gale-biscay");
    const largest = QUAKES[0];
    expect(gale === undefined ? "" : nameOf(gale)).toBe("Gale warning, Bay of Biscay");
    expect(largest === undefined ? "" : nameOf(largest)).toBe("Earthquake, Aleutian Islands");
  });
});

describe("the land", () => {
  it("is one region with each polygon of the data, in degrees", () => {
    const land = landRegion();
    expect(land.coordinates.length).toBe(LAND_RINGS.length);
    expect(land.coordinates.length).toBeGreaterThan(100);
    let corners = 0;
    for (const polygon of land.coordinates) {
      for (const ring of polygon) {
        expect(ring.at(-1)).toEqual(ring[0]);
        for (const [lon, lat] of ring) {
          corners += 1;
          expect(Math.abs(lon)).toBeLessThanOrEqual(180);
          expect(Math.abs(lat)).toBeLessThanOrEqual(90);
        }
      }
    }
    expect(corners).toBeGreaterThan(5000);
  });

  it("gives a surface for the globe at the step of the demo", () => {
    const surface = regionSurface(landRegion(), 2);
    expect(surface.triangles.length / 3).toBeGreaterThan(10_000);
  });
});
