import { h } from "@mark1russell7/site-pages/chrome";
import { onThemeChange, threadTheme } from "./colors.ts";
import { chooseTopic } from "./thread/card.ts";
import { labelOf, threadKinds, topicCounts, type ThreadDocument } from "./thread/document.ts";
import { mountThreadView, type ThreadView } from "./thread/mount.ts";
import { phaseText, type ThreadPhaseEvent } from "./thread/phases.ts";
import { SAMPLE_LEGEND, sampleThread } from "./thread/sample.ts";

/** The elements of the page that the conversation demo uses. */
export interface ThreadElements {
  /** The box of the picture. It has a size before the demo starts. */
  readonly picture: HTMLElement;
  /** The box of the topics. The demo puts one button for each topic in it. */
  readonly topics: HTMLElement;
  /** The line of the times of the picture. It is hidden until the view draws its first picture. */
  readonly time: HTMLElement;
}

/** The name of the person of the page, for a topic that the person gives to a part. */
const PERSON = "you";

/**
 * This function starts the conversation demo: a made-up conversation, the parts of its messages and their topics.
 * A person gives a part its topic. The page changes only its own copy of the sample.
 */
export function startThread(elements: ThreadElements): ThreadView {
  let current: ThreadDocument = sampleThread();
  let selected: string | undefined;
  /** The layout of the last picture. Its first drawing completes the line of the times. */
  let made: ThreadPhaseEvent | undefined;

  const kinds = threadKinds(current);
  const rows = current.boxes
    .filter((box) => kinds.get(box.id) === "topic")
    .map((topic) => {
      const count = h("span", { class: "count" });
      const button = h("button", { class: "kind", type: "button", "data-topic": topic.id, "aria-pressed": "false" }, `${labelOf(topic)} `, count);
      elements.topics.append(button);
      return { id: topic.id, button, count };
    });

  /** This function shows the number of parts of each topic, and the selected topic, in the list. */
  const paint = (): void => {
    const counts = topicCounts(current.edges ?? []);
    for (const row of rows) {
      row.count.textContent = String(counts.get(row.id) ?? 0);
      row.button.setAttribute("aria-pressed", String(row.id === selected));
    }
  };

  const view = mountThreadView(elements.picture, {
    document: current,
    legend: SAMPLE_LEGEND,
    theme: threadTheme(),
    label: "A made-up conversation, the parts of its messages and their topics",
    // The sample has its times in UTC, so each person gets the same texts.
    timeZone: "UTC",
    onPick: (box) => {
      selected = box?.id;
      paint();
    },
    onChoose: (event) => {
      current = chooseTopic(current, event, PERSON);
      view.setDocument(current);
      paint();
    },
    // The view shows a note for a step with an error, so the line keeps the times of the last good picture.
    onPhase: (event) => {
      if (event.error !== undefined) return;
      if (event.phase === "layout") {
        made = event;
      } else if (made?.picture === event.picture) {
        elements.time.textContent = phaseText(made, event);
        elements.time.hidden = false;
      }
    },
  });

  for (const row of rows) {
    row.button.addEventListener("click", () => {
      selected = selected === row.id ? undefined : row.id;
      // The function `select` does not start `onPick`, so the list changes here.
      view.select(selected);
      paint();
    });
  }

  onThemeChange(() => {
    view.setTheme(threadTheme());
  });
  paint();
  return view;
}
