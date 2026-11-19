import type { LayoutBox, LayoutEdge } from "@mark1russell7/layout-contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { holdsOf, isMessageBox, isTopicBox, panelOf, soundDocument, threadKinds, type ThreadBox, type ThreadDocument, type ThreadKind } from "./document.ts";
import { ancestorsOf, closedOf, containersOf, flatHides, hasGroups, isLifted, liftedOf, openFor, routeGround, shownDocument, THREAD_FEATURES } from "./nest.ts";
import { panelBox, panelEdge } from "./panel.test-util.ts";
import { sampleThread } from "./sample.ts";

const sample = sampleThread();

/** One made box of a tree: the place of its parent, its first kind, and its state at the start. */
interface MadeBox {
  readonly above: number;
  readonly kind: string;
  readonly closed: boolean;
}

/** One made edge: the places of its ends, its kind, its state and its relation type. */
interface MadeEdge {
  readonly from: number;
  readonly to: number;
  readonly kind: string;
  readonly state: string | undefined;
  readonly relation: string | undefined;
}

/** A made tree of boxes with edges between them, and the containers that a person closed or opened. */
interface Made {
  readonly document: ThreadDocument;
  readonly closed: ReadonlySet<string>;
  /** The place of one box of the tree. */
  readonly at: number;
}

const idOf = (place: number): string => `b${String(place)}`;

/**
 * The trees of boxes, to each depth. The parent of a box comes before the box, so a tree has no loop.
 * A box has no parent when the number of its parent gives its own place.
 */
const made: fc.Arbitrary<Made> = fc
  .record({
    boxes: fc.array(fc.record({ above: fc.nat(), kind: fc.constantFrom("topic", "thread", "entry", "message", "group"), closed: fc.boolean() }), { minLength: 1, maxLength: 24 }),
    edges: fc.array(
      fc.record({
        from: fc.nat(),
        to: fc.nat(),
        kind: fc.constantFrom("reply", "touches", "relates"),
        state: fc.constantFrom(undefined, "chosen", "proposed"),
        relation: fc.constantFrom(undefined, "sub"),
      }),
      { maxLength: 40 },
    ),
    shut: fc.array(fc.nat(), { maxLength: 12 }),
    at: fc.nat(),
  })
  .map(({ boxes, edges, shut, at }: { boxes: MadeBox[]; edges: MadeEdge[]; shut: number[]; at: number }): Made => {
    const count = boxes.length;
    const document: ThreadDocument = {
      id: "made",
      boxes: boxes.map((box, place): ThreadBox => {
        const above = box.above % (place + 1);
        return { id: idOf(place), ...(above === place ? {} : { parent: idOf(above) }), data: { kinds: [box.kind], label: idOf(place), ...(box.closed ? { closed: true } : {}) } };
      }),
      edges: edges.map(
        (edge, place): LayoutEdge => ({
          id: `e${String(place)}`,
          source: idOf(edge.from % count),
          target: idOf(edge.to % count),
          data: { kind: edge.kind, ...(edge.state === undefined ? {} : { state: edge.state }), ...(edge.relation === undefined ? {} : { relation: edge.relation }) },
        }),
      ),
    };
    const containers = containersOf(document);
    return { document, closed: new Set(shut.map((place) => idOf(place % count)).filter((id) => containers.has(id))), at: at % count };
  });

/** This function gives the box that a picture shows for a box: the closed container above it that is nearest to the top, or the box. */
function shownAs(document: ThreadDocument, closed: ReadonlySet<string>, id: string): string {
  return (
    ancestorsOf(document, id)
      .filter((box) => closed.has(box))
      .at(-1) ?? id
  );
}

describe("the features of the view", () => {
  it("names the containers, so a page gives a document with containers only to a build that draws them", () => {
    expect(THREAD_FEATURES).toContain("nests");
    expect(new Set(THREAD_FEATURES).size).toBe(THREAD_FEATURES.length);
  });

  it("names the change of the covered parts, so a page starts `setCovered` only on a build that has it", () => {
    expect(THREAD_FEATURES).toContain("covered");
  });

  it("names the image of an entry, so a page gives `data.image` only to a build that shows it", () => {
    expect(THREAD_FEATURES).toContain("images");
  });
});

describe("the tree of a document", () => {
  it("gives the containers of the sample: each message, the two topics with boxes in them, and the thread", () => {
    const containers = containersOf(sample);
    expect([...containers].filter((id) => !id.startsWith("m")).sort()).toEqual(["t01", "trench", "water"]);
    expect([...containers].filter((id) => id.startsWith("m"))).toHaveLength(12);
  });

  it("gives the boxes above a box, the nearest box first", () => {
    expect(ancestorsOf(sample, "e02")).toEqual(["t01", "trench", "water"]);
    expect(ancestorsOf(sample, "rota")).toEqual(["water"]);
    expect(ancestorsOf(sample, "water")).toEqual([]);
    expect(ancestorsOf(sample, "nowhere")).toEqual([]);
  });

  it("tells that a document has a group only when a container is not a message", () => {
    expect(hasGroups(sample)).toBe(true);
    expect(hasGroups(shownDocument(sample, { flat: true }))).toBe(false);
    expect(hasGroups({ id: "empty", boxes: [] })).toBe(false);
  });

  it("tells which boxes the flat view does not show: a container that is not a message and not a topic", () => {
    expect(flatHides(sample, "t01")).toBe(true);
    expect(flatHides(sample, "water")).toBe(false);
    expect(flatHides(sample, "m01")).toBe(false);
    expect(flatHides(sample, "e01")).toBe(false);
    expect(flatHides(sample, "nowhere")).toBe(false);
  });
});

describe("the flat form of a document", () => {
  const flat = shownDocument(sample, { flat: true });

  it("keeps each topic with no box in it, and takes the thread out", () => {
    expect(flat.boxes.map((box) => box.id)).toEqual(sample.boxes.filter((box) => box.id !== "t01").map((box) => box.id));
    for (const id of ["trench", "rota", "e01", "e02"]) expect(flat.boxes.find((box) => box.id === id)?.parent).toBeUndefined();
    expect(threadKinds(flat).get("water")).toBe("topic");
    expect(threadKinds(flat).get("e01")).toBe("entry");
  });

  it("keeps the parts of each message, and each edge", () => {
    expect(flat.boxes.find((box) => box.id === "m01#0")?.parent).toBe("m01");
    expect(flat.edges).toEqual(sample.edges);
  });

  it("gives the same document for a document with no group", () => {
    expect(shownDocument(flat, { flat: true })).toBe(flat);
    expect(shownDocument(flat)).toBe(flat);
    expect(shownDocument(sample)).toBe(sample);
    expect(shownDocument(sample, { closed: new Set() })).toBe(sample);
  });

  it("has only messages as containers, and each edge between two of its boxes, for each tree", () => {
    fc.assert(
      fc.property(made, ({ document }) => {
        const sound = soundDocument(document);
        const result = shownDocument(sound, { flat: true });
        const byId = new Map(result.boxes.map((box) => [box.id, box]));
        expect(byId.size).toBe(result.boxes.length);
        for (const box of result.boxes) {
          const parent = box.parent === undefined ? undefined : byId.get(box.parent);
          expect(box.parent === undefined || (parent !== undefined && isMessageBox(parent))).toBe(true);
        }
        // A topic stays, and each box with no box in it stays.
        const containers = containersOf(sound);
        for (const box of sound.boxes) expect(byId.has(box.id)).toBe(!containers.has(box.id) || isMessageBox(box) || isTopicBox(box));
        for (const edge of result.edges ?? []) expect(byId.has(edge.source) && byId.has(edge.target)).toBe(true);
        expect(shownDocument(result, { flat: true })).toBe(result);
      }),
    );
  });
});

describe("a closed container", () => {
  it("is one box that tells the number of the boxes in it", () => {
    const shown = shownDocument(sample, { closed: new Set(["water"]) });
    const ids = new Set(shown.boxes.map((box) => box.id));
    for (const id of ["trench", "rota", "t01", "e01", "e02"]) expect(ids.has(id)).toBe(false);
    expect(shown.boxes).toHaveLength(sample.boxes.length - 5);
    const water = shown.boxes.find((box) => box.id === "water");
    expect(holdsOf(water ?? {})).toBe(5);
    // A closed topic is a pill again, and a closed thread is the card of an entry.
    expect(threadKinds(shown).get("water")).toBe("topic");
    const thread = shownDocument(sample, { closed: new Set(["t01"]) });
    expect(threadKinds(thread).get("t01")).toBe("entry");
    expect(holdsOf(thread.boxes.find((box) => box.id === "t01") ?? {})).toBe(2);
  });

  it("takes each edge into it, and has no edge between two of its boxes", () => {
    const shown = shownDocument(sample, { closed: new Set(["water"]) });
    const edges = shown.edges ?? [];
    expect(edges.find((edge) => edge.id === "relates:trench:water")).toBeUndefined();
    expect(edges.find((edge) => edge.id === "reply:e01:e02")).toBeUndefined();
    const fence = edges.find((edge) => edge.id === "relates:fence:trench");
    expect(fence).toMatchObject({ source: "fence", target: "water", data: { kind: "relates", relation: "related", lifted: ["relates:fence:trench"] } });
    expect(isLifted(fence ?? {})).toBe(true);
    // An edge of the sorter keeps the part of its choice.
    const waits = edges.find((edge) => edge.id === "touches:e04:trench");
    expect(waits).toMatchObject({ source: "e04", target: "water", data: { kind: "touches", state: "chosen", choice: "e04" } });
    // An edge with no end in the container is the edge of the document.
    const other = sample.edges?.find((edge) => edge.id === "relates:seeds:tomatoes");
    expect(edges.find((edge) => edge.id === "relates:seeds:tomatoes")).toBe(other);
    expect(liftedOf(other ?? {})).toEqual([]);
  });

  it("makes one edge of the edges with the same ends, kind, state, relation and choice", () => {
    const document: ThreadDocument = {
      id: "one",
      boxes: [{ id: "a" }, { id: "g", data: { kinds: ["group"] } }, { id: "x", parent: "g" }, { id: "y", parent: "g" }],
      edges: [
        { id: "ax", source: "a", target: "x", data: { kind: "relates" } },
        { id: "ay", source: "a", target: "y", data: { kind: "relates" } },
        { id: "ya", source: "y", target: "a", data: { kind: "relates" } },
        { id: "az", source: "a", target: "y", data: { kind: "relates", relation: "sub" } },
      ],
    };
    const edges = shownDocument(document, { closed: new Set(["g"]) }).edges ?? [];
    expect(edges.map((edge) => [edge.id, edge.source, edge.target, liftedOf(edge)])).toEqual([
      ["ax", "a", "g", ["ax", "ay"]],
      ["ya", "g", "a", ["ya"]],
      ["az", "a", "g", ["az"]],
    ]);
  });

  it("names the container in the choice of an edge from a box in it", () => {
    const shown = shownDocument(sample, { closed: new Set(["t01"]) });
    const lifted = (shown.edges ?? []).filter((edge) => edge.source === "t01");
    expect(lifted).toHaveLength(1);
    expect(lifted[0]).toMatchObject({ target: "trench", data: { kind: "touches", state: "chosen", choice: "t01", lifted: ["touches:e01:trench", "touches:e02:trench"] } });
  });

  it("gets the panel of a box in it", () => {
    const withPanel: ThreadDocument = { ...sample, boxes: [...sample.boxes, panelBox("e02")], edges: [...(sample.edges ?? []), panelEdge("e02")] };
    const shown = shownDocument(withPanel, { closed: new Set(["trench"]) });
    const panel = shown.boxes.find((box) => box.id === panelBox("e02").id);
    expect(panelOf(panel ?? {})).toBe("trench");
    expect((shown.edges ?? []).find((edge) => edge.id === panelEdge("e02").id)).toMatchObject({ source: "trench", data: { kind: "panel" } });
    // The panel of a box that the picture shows does not change.
    const open = shownDocument(withPanel, { closed: new Set(["m01"]) });
    expect(open.boxes.find((box) => box.id === panelBox("e02").id)).toBe(withPanel.boxes.at(-1));
  });

  it("has each edge that crosses its border in one lifted edge, one time, for each tree", () => {
    fc.assert(
      fc.property(made, ({ document, closed }) => {
        const shown = shownDocument(document, { closed });
        const as = (id: string): string => shownAs(document, closed, id);
        // The picture shows a box when no closed container is above it.
        expect(shown.boxes.map((box) => box.id)).toEqual(document.boxes.filter((box) => as(box.id) === box.id).map((box) => box.id));
        for (const box of shown.boxes) {
          const below = document.boxes.filter((other) => other.id !== box.id && as(other.id) === box.id).length;
          expect(holdsOf(box)).toBe(below === 0 ? undefined : below);
        }
        const ids = new Set(shown.boxes.map((box) => box.id));
        const edges = shown.edges ?? [];
        for (const edge of edges) {
          expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
          if (isLifted(edge)) expect(edge.source).not.toBe(edge.target);
        }
        /** The lifted edges that have the id of an edge of the document. */
        const homes = new Map<string, LayoutEdge[]>();
        for (const edge of edges) for (const id of liftedOf(edge)) homes.set(id, [...(homes.get(id) ?? []), edge]);
        let crossing = 0;
        for (const edge of document.edges ?? []) {
          const source = as(edge.source);
          const target = as(edge.target);
          const home = homes.get(edge.id) ?? [];
          if (source === edge.source && target === edge.target) {
            // No end is in a closed container: the edge stays as it is.
            expect(edges).toContain(edge);
            expect(home).toEqual([]);
          } else if (source === target) {
            // The two ends are in one closed container: the picture has no line for the edge.
            expect(edges.some((other) => other.id === edge.id)).toBe(false);
            expect(home).toEqual([]);
          } else {
            crossing += 1;
            expect(home).toHaveLength(1);
            expect(home[0]).toMatchObject({ source, target });
            expect(home[0]?.data?.["kind"]).toBe(edge.data?.["kind"]);
            expect(home[0]?.data?.["state"]).toBe(edge.data?.["state"]);
            expect(home[0]?.data?.["relation"]).toBe(edge.data?.["relation"]);
          }
        }
        // No edge is in two lifted edges, and no lifted edge has an id two times.
        expect(edges.flatMap(liftedOf)).toHaveLength(crossing);
        expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
      }),
    );
  });
});

describe("the closed containers of a view", () => {
  const document: ThreadDocument = {
    id: "state",
    boxes: [{ id: "g", data: { kinds: ["group"], closed: true } }, { id: "a", parent: "g", data: { closed: true } }, { id: "h", data: { kinds: ["group"] } }, { id: "b", parent: "h" }],
  };

  it("starts with each container that has `data.closed`", () => {
    expect([...closedOf(document)]).toEqual(["g"]);
    expect([...closedOf(sample)]).toEqual([]);
  });

  it("takes a change of a person before the data of the box", () => {
    expect([...closedOf(document, new Map([["g", false]]))]).toEqual([]);
    expect([...closedOf(document, new Map([["h", true]]))]).toEqual(["g", "h"]);
    // A box with no box in it is not a container, so a change does not close it.
    expect([...closedOf(document, new Map([["b", true]]))]).toEqual(["g"]);
  });

  it("opens the way to a box of the sample: each container above the box", () => {
    const closed = new Set(["water", "trench", "t01", "m01"]);
    expect([...openFor(sample, closed, "e02")]).toEqual(["m01"]);
    expect([...openFor(sample, closed, "trench")].sort()).toEqual(["m01", "t01", "trench"]);
    expect(openFor(sample, closed, "north")).toBe(closed);
    expect(openFor(sample, closed, "nowhere")).toBe(closed);
  });

  it("opens exactly the containers above a box, and then the picture shows the box, for each tree", () => {
    fc.assert(
      fc.property(made, ({ document, closed, at }) => {
        const id = idOf(at);
        const above = new Set(ancestorsOf(document, id));
        const open = openFor(document, closed, id);
        // Each closed container above the box opens. Each other container keeps its state.
        expect([...open].sort()).toEqual([...closed].filter((box) => !above.has(box)).sort());
        expect(open === closed).toBe([...closed].every((box) => !above.has(box)));
        const shown = shownDocument(document, { closed: open });
        expect(shown.boxes.some((box) => box.id === id)).toBe(true);
        // A box that the picture showed before stays in the picture.
        const before = shownDocument(document, { closed });
        const after = new Set(shown.boxes.map((box) => box.id));
        for (const box of before.boxes) expect(after.has(box.id)).toBe(true);
      }),
    );
  });
});

describe("the boxes that a router reads", () => {
  const boxes: LayoutBox[] = [
    { id: "g", x: 0, y: 0, w: 300, h: 200 },
    { id: "a", parent: "g", x: 10, y: 40, w: 80, h: 30 },
    { id: "m", parent: "g", x: 110, y: 40, w: 120, h: 90 },
    { id: "p", parent: "m", x: 110, y: 70, w: 120, h: 30 },
    { id: "c", x: 400, y: 0, w: 80, h: 30 },
    { id: "h", x: 0, y: 300, w: 200, h: 20 },
    { id: "d", parent: "h", x: 10, y: 304, w: 80, h: 12 },
  ];
  const kinds = new Map<string, ThreadKind>([
    ["g", "group"],
    ["a", "entry"],
    ["m", "message"],
    ["p", "part"],
    ["c", "entry"],
    ["h", "group"],
    ["d", "entry"],
  ]);
  const edge = (source: string, target: string): LayoutEdge => ({ id: `${source}-${target}`, source, target });

  it("gives the same boxes and edges for a picture with no group", () => {
    const plain = boxes.filter((box) => box.id === "m" || box.id === "p" || box.id === "c");
    const edges = [edge("p", "c")];
    const ground = routeGround(plain, edges, kinds, 34);
    expect(ground.boxes).toBe(plain);
    expect(ground.edges).toBe(edges);
  });

  it("has no frame of a group, and each box of a group as a box with no parent", () => {
    const ground = routeGround(boxes, [edge("a", "c")], kinds, 34);
    expect(ground.boxes.map((box) => [box.id, box.parent])).toEqual([
      ["a", undefined],
      ["m", undefined],
      ["p", "m"],
      ["c", undefined],
      ["d", undefined],
    ]);
  });

  it("has the header of a group that is an end of an edge", () => {
    const ground = routeGround(boxes, [edge("c", "g"), edge("c", "h")], kinds, 34);
    expect(ground.boxes.find((box) => box.id === "g")).toEqual({ id: "g", x: 0, y: 0, w: 300, h: 34 });
    // A frame that is lower than a header keeps its height.
    expect(ground.boxes.find((box) => box.id === "h")).toEqual({ id: "h", x: 0, y: 300, w: 200, h: 20 });
  });

  it("has no edge from a box to a group that contains it", () => {
    const edges = [edge("a", "g"), edge("g", "p"), edge("a", "c"), edge("p", "m")];
    const ground = routeGround(boxes, edges, kinds, 34);
    expect(ground.edges.map((kept) => kept.id)).toEqual(["a-c"]);
    expect(ground.boxes.some((box) => box.id === "g")).toBe(false);
  });
});
