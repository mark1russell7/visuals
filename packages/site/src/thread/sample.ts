import type { LayoutEdge } from "@mark1russell7/layout-contract";
import { choiceOf, isChosen, type ThreadAction, type ThreadBox, type ThreadDocument, type ThreadLegend } from "./document.ts";

/** One topic that the sorter of the sample proposed for a part: the id of the topic and its score. */
type Proposal = readonly [topic: string, score: number];

/** One part of a message of the sample. */
interface SamplePart {
  readonly text: string;
  /** The topics of the sorter, the best topic first. */
  readonly topics: readonly Proposal[];
  /** With `true`, the part has proposals and no topic. */
  readonly open?: true;
  /** A choice of a person: the name of the person, and the place of the topic in `topics`. */
  readonly by?: readonly [name: string, place: number];
}

/** One message of the sample. `after` is the message that it is a reply to. */
interface SampleMessage {
  readonly id: string;
  readonly at: string;
  readonly after?: string;
  readonly parts: readonly SamplePart[];
}

/** One topic of the sample: its id, its name, its tag and its state. */
type SampleTopic = readonly [id: string, label: string, tag: string, state?: "done"];

/** One entry of the sample: a box with one text, with a tag and one topic. `after` is the entry that it is a reply to. */
interface SampleEntry {
  readonly id: string;
  readonly tag: string;
  readonly at: string;
  readonly text: string;
  readonly topic: string;
  readonly after?: string;
  /** The id of who the entry waits on. The card of the entry has a button for an answer. */
  readonly waits?: string;
  /** The id of the thread of the entry. The first entry of a thread gives the thread its text, its tag, its time and its topic. */
  readonly thread?: string;
}

const TOPICS: readonly SampleTopic[] = [
  ["water", "Water and drainage", "theme"],
  ["north", "North beds", "area"],
  ["trench", "Trench by the fence", "task"],
  ["tomatoes", "Tomatoes", "crop"],
  ["compost", "Compost", "area"],
  ["shed", "Tool shed", "area"],
  ["seeds", "Seed order", "task"],
  ["fence", "Fence repair", "task", "done"],
  ["rota", "Watering rota", "theme"],
  ["market", "Autumn market", "theme"],
];

/** The relations between the topics of the sample: the narrower topic, the relation type and the wider topic. */
const RELATIONS: readonly (readonly [source: string, relation: string, target: string])[] = [
  ["trench", "sub", "water"],
  ["rota", "sub", "water"],
  ["fence", "related", "trench"],
  ["seeds", "related", "tomatoes"],
];

const MESSAGES: readonly SampleMessage[] = [
  {
    id: "m01",
    at: "2026-09-02T08:14:00Z",
    parts: [
      {
        text: "The north beds are under water again after the rain on Monday.",
        topics: [
          ["water", 0.91],
          ["north", 0.74],
          ["trench", 0.31],
        ],
      },
      {
        text: "Can we move the tomatoes to bed 6 before they rot?",
        topics: [
          ["tomatoes", 0.88],
          ["north", 0.52],
        ],
      },
    ],
  },
  {
    id: "m02",
    at: "2026-09-02T08:31:00Z",
    after: "m01",
    parts: [
      {
        text: "A trench along the fence is the cheapest fix. I can dig on Saturday.",
        topics: [
          ["trench", 0.86],
          ["water", 0.6],
          ["fence", 0.4],
        ],
      },
    ],
  },
  {
    id: "m03",
    at: "2026-09-02T09:02:00Z",
    parts: [
      { text: "The compost bins are full. The left bin is ready to use.", topics: [["compost", 0.93]] },
      {
        text: "Who has the key of the tool shed? The lock is stiff again.",
        topics: [
          ["shed", 0.9],
          ["fence", 0.22],
        ],
      },
    ],
  },
  {
    id: "m04",
    at: "2026-09-02T09:20:00Z",
    after: "m03",
    parts: [
      { text: "I have the key. I oil the lock this evening.", topics: [["shed", 0.84]] },
      {
        text: "Take compost from the left bin for the tomatoes.",
        topics: [
          ["compost", 0.7],
          ["tomatoes", 0.66],
        ],
        by: ["Rosa", 1],
      },
    ],
  },
  {
    id: "m05",
    at: "2026-09-02T10:05:00Z",
    parts: [
      { text: "The seed order closes on Friday. Send me your lists.", topics: [["seeds", 0.95]] },
      {
        text: "I want two more rows of beans next year.",
        topics: [
          ["seeds", 0.48],
          ["north", 0.33],
          ["market", 0.2],
        ],
        open: true,
      },
    ],
  },
  {
    id: "m06",
    at: "2026-09-02T10:40:00Z",
    after: "m05",
    parts: [{ text: "Garlic and broad beans for me, please.", topics: [["seeds", 0.82]] }],
  },
  {
    id: "m07",
    at: "2026-09-02T11:15:00Z",
    parts: [
      {
        text: "The fence post at the gate is fixed. Thank you, Tom.",
        topics: [
          ["fence", 0.9],
          ["trench", 0.25],
        ],
      },
    ],
  },
  {
    id: "m08",
    at: "2026-09-02T12:00:00Z",
    parts: [
      {
        text: "The rota for August had gaps on each Sunday.",
        topics: [
          ["rota", 0.9],
          ["water", 0.5],
        ],
      },
      { text: "Can two people share the Sunday slot?", topics: [["rota", 0.8]] },
    ],
  },
  {
    id: "m09",
    at: "2026-09-02T12:30:00Z",
    after: "m08",
    parts: [{ text: "I can do each second Sunday.", topics: [["rota", 0.77]] }],
  },
  {
    id: "m10",
    at: "2026-09-02T14:10:00Z",
    parts: [
      { text: "The market is on the last Saturday of October. We need a table and a sign.", topics: [["market", 0.92]] },
      {
        text: "Let us sell the spare tomato plants there.",
        topics: [
          ["market", 0.55],
          ["tomatoes", 0.5],
          ["seeds", 0.2],
        ],
        open: true,
      },
    ],
  },
  {
    id: "m11",
    at: "2026-09-02T15:00:00Z",
    after: "m10",
    parts: [
      {
        text: "I have a folding table in the shed.",
        topics: [
          ["market", 0.6],
          ["shed", 0.58],
        ],
      },
    ],
  },
  {
    id: "m12",
    at: "2026-09-02T16:20:00Z",
    parts: [
      {
        text: "After the trench, where does the water go?",
        topics: [
          ["trench", 0.7],
          ["water", 0.68],
        ],
      },
      {
        text: "Does the ditch behind the shed still drain?",
        topics: [
          ["water", 0.72],
          ["shed", 0.41],
          ["trench", 0.4],
        ],
      },
    ],
  },
];

const ENTRIES: readonly SampleEntry[] = [
  { id: "e01", tag: "ask", at: "2026-09-03T09:00:00Z", text: "Who pays for the gravel of the trench?", topic: "trench", thread: "t01" },
  { id: "e02", tag: "comment", at: "2026-09-03T09:25:00Z", text: "The repair fund pays. It has 140 left.", topic: "trench", after: "e01", thread: "t01" },
  { id: "e03", tag: "decision", at: "2026-09-03T10:10:00Z", text: "The tomatoes move to bed 6 this week.", topic: "tomatoes" },
  { id: "e04", tag: "request", at: "2026-09-03T11:40:00Z", text: "Order two cubic meters of gravel before Saturday.", topic: "trench", waits: "reader" },
];

/** The action of an entry of the sample that waits: an answer. A page with a function for the actions gets a button for it. */
export const SAMPLE_ANSWER: ThreadAction = { id: "answer", title: "Answer" };

/** The name of the sorter in `data.by` of an edge. */
const SORTER = "sorter";

/** The relation type of a topic that is a part of a wider topic. The box of the topic is in the box of the wider topic. */
const PART_OF = "sub";

/** The first kind of the box of a thread: an entry and its replies in one box. */
const THREAD = "thread";

/** This function gives the boxes and the edges of one message of the sample. */
function messageRecords(message: SampleMessage): { boxes: ThreadBox[]; edges: LayoutEdge[] } {
  const text = message.parts.map((part) => part.text).join(" ");
  const boxes: ThreadBox[] = [{ id: message.id, data: { kinds: ["message"], label: message.parts[0]?.text ?? message.id, text, at: message.at } }];
  const edges: LayoutEdge[] = [];
  if (message.after !== undefined) edges.push({ id: `reply:${message.after}:${message.id}`, source: message.after, target: message.id, data: { kind: "reply" } });
  message.parts.forEach((part, place) => {
    const id = `${message.id}#${String(place)}`;
    boxes.push({ id, parent: message.id, data: { kinds: ["part"], label: part.text, text: part.text } });
    edges.push({ id: `part:${id}`, source: message.id, target: id, data: { kind: "part" } });
    const chosen = part.open === true ? -1 : (part.by?.[1] ?? 0);
    part.topics.forEach(([topic, score], rank) => {
      const state = rank === chosen ? { state: "chosen", by: part.by?.[0] ?? SORTER } : { state: "proposed" };
      edges.push({ id: `touches:${id}:${topic}`, source: id, target: topic, data: { kind: "touches", choice: id, rank: rank + 1, score, ...state } });
    });
  });
  return { boxes, edges };
}

/**
 * This function gives the sample of a thread document: a made-up conversation of the people of a shared garden.
 *
 * - It has 12 messages with 19 parts, 10 topics and 4 entries.
 * - A sorter gave a topic to each part, with 3 proposals or fewer. A person changed one topic, and two parts have no topic.
 * - One topic is done. Two topics are parts of a wider topic, and two pairs of topics are related.
 * - One entry waits on the reader of the page, and it has the action of an answer.
 * - The boxes have three levels of containers. The two narrower topics are in their wider topic.
 * - One thread of two entries is a box in the topic of its first entry.
 */
export function sampleThread(): ThreadDocument {
  const wider = new Map(RELATIONS.filter(([, relation]) => relation === PART_OF).map(([source, , target]) => [source, target]));
  const boxes: ThreadBox[] = TOPICS.map(([id, label, tag, state]): ThreadBox => {
    const parent = wider.get(id);
    return { id, ...(parent === undefined ? {} : { parent }), data: { kinds: ["topic", tag], label, ref: `#${id}`, ...(state === undefined ? {} : { state }) } };
  });
  const edges: LayoutEdge[] = RELATIONS.map(([source, relation, target]): LayoutEdge => ({ id: `relates:${source}:${target}`, source, target, data: { kind: "relates", relation } }));
  for (const message of MESSAGES) {
    const records = messageRecords(message);
    boxes.push(...records.boxes);
    edges.push(...records.edges);
  }
  const threads = new Set<string>();
  for (const entry of ENTRIES) {
    const waits = entry.waits === undefined ? {} : { waits: entry.waits, actions: [SAMPLE_ANSWER] };
    // The box of a thread comes before its first entry.
    if (entry.thread !== undefined && !threads.has(entry.thread)) {
      threads.add(entry.thread);
      const count = ENTRIES.filter((other) => other.thread === entry.thread).length;
      boxes.push({ id: entry.thread, parent: entry.topic, data: { kinds: [THREAD, entry.tag], label: entry.text, text: entry.text, at: entry.at, entries: count } });
    }
    boxes.push({ id: entry.id, ...(entry.thread === undefined ? {} : { parent: entry.thread }), data: { kinds: ["entry", entry.tag], label: entry.text, text: entry.text, at: entry.at, ...waits } });
    edges.push({ id: `touches:${entry.id}:${entry.topic}`, source: entry.id, target: entry.topic, data: { kind: "touches", choice: entry.id, state: "chosen", by: SORTER } });
    if (entry.after !== undefined) edges.push({ id: `reply:${entry.after}:${entry.id}`, source: entry.after, target: entry.id, data: { kind: "reply" } });
  }
  return { id: "garden-chat", boxes, edges };
}

/** The names of the kinds and of the relation types of the sample. */
export const SAMPLE_LEGEND: ThreadLegend = {
  kinds: [
    { id: "theme", title: "Theme" },
    { id: "area", title: "Area" },
    { id: "task", title: "Task" },
    { id: "crop", title: "Crop" },
    { id: "ask", title: "Question" },
    { id: "comment", title: "Comment" },
    { id: "decision", title: "Decision" },
    { id: "request", title: "Request" },
    { id: THREAD, title: "Thread" },
  ],
  relations: [
    { id: "sub", title: "Part of" },
    { id: "related", title: "Related" },
  ],
  waits: [{ id: "reader", title: "you" }],
};

/** The start of the id of each answer that `answerEntry` makes. */
const ANSWER = "answer";

/**
 * This function gives a document after an answer to an entry. The function does not change the document of the argument.
 *
 * - The entry waits on no one, and it has no action.
 * - A new comment is a reply to the entry. It is the last box, and it has each chosen topic of the entry.
 * - The comment is in the container of the entry: an answer to an entry of a thread is in that thread.
 * - The result is the document of the argument for an id that is not a box, and for an empty text.
 *
 * @param at - The time of the answer.
 * @param by - The name of who gave the answer.
 */
export function answerEntry(document: ThreadDocument, entry: string, text: string, at: string, by: string): ThreadDocument {
  const found = document.boxes.find((box) => box.id === entry);
  if (found === undefined || text === "") return document;
  const start = `${ANSWER}:${entry}:`;
  const id = `${start}${String(document.boxes.filter((box) => box.id.startsWith(start)).length + 1)}`;
  const { waits: _waits, actions: _actions, ...data } = found.data ?? {};
  const edges = document.edges ?? [];
  const topics = edges.filter((edge) => isChosen(edge) && choiceOf(edge) === entry).map((edge) => edge.target);
  return {
    ...document,
    boxes: [...document.boxes.map((box) => (box === found ? { ...found, data } : box)), { id, ...(found.parent === undefined ? {} : { parent: found.parent }), data: { kinds: ["entry", "comment"], label: text, text, at } }],
    edges: [
      ...edges,
      { id: `reply:${entry}:${id}`, source: entry, target: id, data: { kind: "reply" } },
      ...topics.map((topic): LayoutEdge => ({ id: `touches:${id}:${topic}`, source: id, target: topic, data: { kind: "touches", choice: id, state: "chosen", by } })),
    ],
  };
}

/** The width and the height of the sample image, in pixels. They have the shape of the image area of an entry. */
const PLAN = { width: 512, height: 320 } as const;

/** The color of the bed that the sample image points at: bed 6. A page can find the image in a picture by this color. */
export const SAMPLE_IMAGE_MARK = "#c8472b";

/** This function gives the sample image as SVG text: a plan of the eight beds of the garden, with bed 6 in a different color. */
function planImage(): string {
  const beds = Array.from({ length: 8 }, (_, at): string => {
    const x = 36 + (at % 4) * 114;
    const y = 52 + Math.floor(at / 4) * 126;
    const fill = at === 5 ? SAMPLE_IMAGE_MARK : "#8fa86a";
    const bed = `<rect x="${String(x)}" y="${String(y)}" width="98" height="104" rx="8" fill="${fill}"/>`;
    return `${bed}<text x="${String(x + 49)}" y="${String(y + 62)}" font-size="30" text-anchor="middle" fill="#ffffff">${String(at + 1)}</text>`;
  });
  const size = `width="${String(PLAN.width)}" height="${String(PLAN.height)}" viewBox="0 0 ${String(PLAN.width)} ${String(PLAN.height)}"`;
  const ground = `<rect width="${String(PLAN.width)}" height="${String(PLAN.height)}" fill="#e7ead9"/>`;
  const title = '<text x="36" y="34" font-size="18" fill="#3d4a2c">Beds 1 to 8</text>';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} font-family="sans-serif" font-weight="600">${ground}${title}${beds.join("")}</svg>`;
}

/**
 * The address of the sample image of an entry: a plan of the beds of the garden.
 * It is an SVG image in a `data:` address, so the sample needs no file and no server.
 */
export const SAMPLE_IMAGE: string = `data:image/svg+xml,${encodeURIComponent(planImage())}`;

/** The entry of the sample that the sample image is for: the decision about the tomatoes. */
export const SAMPLE_IMAGE_ENTRY = "e03";

/**
 * This function gives a document with the sample image on one entry: its `data.image`. The default entry is `SAMPLE_IMAGE_ENTRY`.
 * The function does not change the document of the argument. The result is that document for an id that is not a box.
 */
export function withSampleImage(document: ThreadDocument, entry: string = SAMPLE_IMAGE_ENTRY): ThreadDocument {
  if (!document.boxes.some((box) => box.id === entry)) return document;
  return { ...document, boxes: document.boxes.map((box) => (box.id === entry ? { ...box, data: { ...box.data, image: SAMPLE_IMAGE } } : box)) };
}
