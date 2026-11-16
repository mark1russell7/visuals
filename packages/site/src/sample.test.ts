import { isLive } from "@mark1russell7/visuals";
import { regionSurface } from "@mark1russell7/visuals/globe";
import { describe, expect, it } from "vitest";
import { LAND_RINGS } from "./land.ts";
import { AREAS, CHANGES, HISTORY, KINDS, QUAKES, RECORDS, TIME_LABELS, VERSIONS, landRegion, nameOf, recordsAt, timeText, versionAt, versionsOf, type SampleRecord } from "./sample.ts";

const record = (name: string): SampleRecord => {
  const found = RECORDS.find((one) => one.record === name);
  if (found === undefined) throw new Error(`The sample has no record ${name}.`);
  return found;
};

describe("the sample records", () => {
  it("gives each record a different name", () => {
    const names = RECORDS.map((one) => one.record);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain("land");
    expect(RECORDS.length).toBe(AREAS.length + QUAKES.length);
  });

  it("lists the records of the present from the highest level, then the earthquakes from the largest", () => {
    const present = recordsAt(HISTORY.to);
    const ranks = present.map((version) => KINDS.indexOf(version.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const magnitudes = present.flatMap((version) => (version.record.type === "quake" ? [version.record.magnitude] : []));
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));
    expect(magnitudes.length).toBe(QUAKES.length);
  });

  it("has a record of each kind of the legend at the present", () => {
    expect(new Set(recordsAt(HISTORY.to).map((version) => version.kind))).toEqual(new Set(KINDS));
  });

  it("gives each version of an area a closed outline on the Earth, and a surface for the globe", () => {
    const versions = AREAS.flatMap(versionsOf);
    expect(versions.length).toBeGreaterThan(AREAS.length);
    for (const version of versions) {
      const outline = version.region?.coordinates[0] ?? [];
      expect(outline.length).toBeGreaterThanOrEqual(4);
      expect(outline.at(-1)).toEqual(outline[0]);
      for (const [lon = 0, lat = 0] of outline) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
      expect(version.region === undefined ? 0 : regionSurface(version.region, 2).triangles.length).toBeGreaterThan(0);
    }
  });

  it("puts each earthquake at a place on the Earth, at a time of the demo", () => {
    for (const quake of QUAKES) {
      expect(Math.abs(quake.at.lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(quake.at.lat)).toBeLessThanOrEqual(90);
      expect(quake.depth).toBeGreaterThan(0);
      expect(quake.time).toBeGreaterThan(HISTORY.from);
      expect(quake.time).toBeLessThan(HISTORY.to);
    }
  });

  it("names a record for a person, with its level at the time", () => {
    const gale = record("gale-biscay");
    const name = (one: SampleRecord, at: number): string | undefined => {
      const version = versionAt(one, at);
      return version === undefined ? undefined : nameOf(version);
    };
    expect(name(gale, 0)).toBe("Gale warning, Bay of Biscay");
    expect(name(gale, -30)).toBe("Gale watch, Bay of Biscay");
    expect(name(gale, -50)).toBe("Gale advisory, Bay of Biscay");
    expect(name(gale, -60)).toBeUndefined();
    expect(name(record("quake-aleutian"), 0)).toBe("Earthquake, Aleutian Islands");
  });
});

describe("the history of the sample", () => {
  it("gives the states of each area in the sequence of time, in the time of the demo", () => {
    for (const area of AREAS) {
      const starts = area.states.map((state) => state.from);
      expect(starts.length).toBeGreaterThan(0);
      expect(starts).toEqual([...new Set(starts)].sort((a, b) => a - b));
      expect(starts[0]).toBeGreaterThan(HISTORY.from);
      expect(starts.at(-1)).toBeLessThan(area.to ?? HISTORY.to);
      expect(area.to ?? HISTORY.to).toBeLessThanOrEqual(HISTORY.to);
    }
  });

  it("ends a version of an area at the start of the next version, and the last version at the end of the area", () => {
    for (const area of AREAS) {
      const versions = versionsOf(area);
      versions.forEach((version, index) => {
        expect(version.life.to).toBe(versions[index + 1]?.life.from ?? area.to);
      });
    }
  });

  it("has one version or no version of a record at each time", () => {
    const times = [HISTORY.from, ...CHANGES, HISTORY.to].flatMap((time, index, all) => [time, (time + (all[index + 1] ?? time)) / 2]);
    for (const at of times) {
      for (const one of RECORDS) {
        expect(VERSIONS.filter((version) => version.record === one && isLive(version.life, at)).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("shows no record at the start, and each record with no end at the present", () => {
    expect(recordsAt(HISTORY.from)).toEqual([]);
    expect(recordsAt(HISTORY.to).length).toBe(16);
    expect(versionAt(record("fog-channel"), -60)?.kind).toBe("advisory");
    expect(versionAt(record("fog-channel"), HISTORY.to)).toBeUndefined();
    expect(versionAt(record("thunder-po"), -36)?.kind).toBe("warning");
    expect(versionAt(record("thunder-po"), -35)).toBeUndefined();
  });

  it("gives the records of a time in the past with their levels at that time", () => {
    const past = recordsAt(-36);
    expect(past.map((version) => `${version.record.record}: ${version.kind}`)).toEqual([
      "flood-mississippi: warning",
      "cyclone-bengal: warning",
      "thunder-po: warning",
      "gale-biscay: watch",
      "heat-iberia: advisory",
      "quake-fiji: quake",
      "quake-chile: quake",
      "quake-oaxaca: quake",
    ]);
  });

  it("moves the area of a storm to the north", () => {
    const north = versionsOf(record("cyclone-bengal")).map((version) => Math.max(...(version.region?.coordinates[0] ?? []).map(([, lat = 0]) => lat)));
    expect(north.length).toBe(3);
    expect(north).toEqual([...north].sort((a, b) => a - b));
    expect(new Set(north).size).toBe(3);
  });

  it("gives the globe the areas from the lowest level, then the earthquakes", () => {
    const ranks = VERSIONS.map((version) => ["advisory", "watch", "warning", "quake"].indexOf(version.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(VERSIONS.length).toBe(RECORDS.flatMap(versionsOf).length);
  });

  it("has each change in the time of the demo, in sequence", () => {
    expect(CHANGES.length).toBeGreaterThan(20);
    expect(CHANGES).toEqual([...new Set(CHANGES)].sort((a, b) => a - b));
    expect(CHANGES[0]).toBeGreaterThan(HISTORY.from);
    expect(CHANGES.at(-1)).toBeLessThan(HISTORY.to);
  });

  it("puts each label of the axis in the time of the demo", () => {
    for (const label of TIME_LABELS) {
      expect(label.at).toBeGreaterThanOrEqual(HISTORY.from);
      expect(label.at).toBeLessThanOrEqual(HISTORY.to);
    }
    expect(TIME_LABELS.at(-1)).toEqual({ at: HISTORY.to, text: "Now" });
  });

  it("tells a time in full hours before the present", () => {
    expect(timeText(0)).toBe("Now");
    expect(timeText(-0.4)).toBe("Now");
    expect(timeText(-1)).toBe("1 hour ago");
    expect(timeText(-37.6)).toBe("38 hours ago");
    expect(timeText(HISTORY.from)).toBe("72 hours ago");
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
