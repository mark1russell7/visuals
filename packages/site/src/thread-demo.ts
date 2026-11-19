import { h } from "@mark1russell7/site-pages/chrome";
import { onThemeChange, threadTheme } from "./colors.ts";
import { chooseTopic } from "./thread/card.ts";
import { isTopicBox, labelOf, topicCounts, type ThreadDocument } from "./thread/document.ts";
import { mountThreadView, type ThreadActionEvent, type ThreadView } from "./thread/mount.ts";
import { panelId, withPanel } from "./thread/panels.ts";
import { phaseText, type ThreadPhaseEvent } from "./thread/phases.ts";
import { answerEntry, SAMPLE_ANSWER, SAMPLE_LEGEND, sampleThread } from "./thread/sample.ts";

/** The elements of the page that the conversation demo uses. */
export interface ThreadElements {
  /** The box of the picture. It has a size before the demo starts. */
  readonly picture: HTMLElement;
  /** The box of the topics. The demo puts one button for each topic in it. */
  readonly topics: HTMLElement;
  /** The line of the times of the picture. It is hidden until the view draws its first picture. */
  readonly time: HTMLElement;
  /** The empty form of an answer, in the frame of the picture. It is hidden until a person uses the button of an answer. */
  readonly form: HTMLFormElement;
}

/** The name of the person of the page, for a topic that the person gives to a part, and for an answer. */
const PERSON = "you";

/** The space between the sheet of an answer and its entry, and between the sheet and the border of the picture, in pixels. */
const FORM_GAP = 8;

/** A page of this width or less has no room for a panel. Its form of an answer is a sheet at the bottom of the picture. */
const NARROW = "(max-width: 44rem)";

/**
 * This function starts the conversation demo: a made-up conversation, the parts of its messages and their topics.
 * A person gives a part its topic, and answers the entry that waits. The page changes only its own copy of the sample.
 */
export function startThread(elements: ThreadElements): ThreadView {
  let current: ThreadDocument = sampleThread();
  let selected: string | undefined;
  /** The layout of the last picture. Its first drawing completes the line of the times. */
  let made: ThreadPhaseEvent | undefined;

  // A topic with boxes in it is a topic of the list too.
  const rows = current.boxes
    .filter((box) => isTopicBox(box))
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

  // The form of an answer. The view tells the action of an entry, and the page has the form.
  // On a wide page, the form is the content of a panel: an empty box of the picture next to the entry.
  const form = elements.form;
  /** The element of the page that has the form when no panel has it. */
  const home = form.parentElement;
  const title = h("p", { class: "thread-form-title", id: "thread-form-title" });
  const field = h("textarea", { id: "thread-answer", rows: "2", maxlength: "200", required: "" });
  const cancel = h("button", { type: "button" }, "Cancel");
  form.setAttribute("aria-labelledby", title.id);
  form.append(title, h("label", { for: field.id }, "Your answer"), field, h("div", { class: "thread-form-buttons" }, h("button", { type: "submit", class: "main" }, "Add the answer"), cancel));
  const narrow = matchMedia(NARROW);
  /** The id of the entry of the open form. */
  let answering: string | undefined;

  /** This function gives the document of the picture: the copy of the page, and the panel of the open form on a wide page. */
  const shown = (): ThreadDocument => (answering === undefined || narrow.matches ? current : withPanel(current, answering, SAMPLE_ANSWER));

  /**
   * This function shows the document, and puts the form in its place: the panel of its entry.
   * A narrow page has no panel. There, the form is a sheet at the bottom of the picture.
   */
  const seat = (): void => {
    view.setDocument(shown());
    const slot = answering === undefined ? undefined : view.slot(panelId(answering, SAMPLE_ANSWER.id));
    const place = slot ?? home;
    // The form goes only to a different place. Thus a form that stays keeps its focus.
    if (form.parentElement !== place) place?.append(form);
    form.classList.toggle("is-sheet", slot === undefined);
    form.hidden = answering === undefined;
  };

  /** This function moves the camera to the open form: to its panel, or to its entry above the sheet of a narrow page. */
  const aim = (): void => {
    if (answering === undefined) return;
    if (form.classList.contains("is-sheet")) view.reveal(answering, { bottom: form.offsetHeight + 2 * FORM_GAP });
    else view.reveal(panelId(answering, SAMPLE_ANSWER.id));
  };
  const closeForm = (): void => {
    answering = undefined;
    seat();
  };
  const openForm = (event: ThreadActionEvent): void => {
    answering = event.box.id;
    title.textContent = labelOf(event.box);
    field.value = "";
    // The card of the entry closes, so the form and the card do not cover the same part of the picture.
    selected = undefined;
    view.select(undefined);
    paint();
    seat();
    aim();
    field.focus({ preventScroll: true });
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
    onAction: openForm,
    onChoose: (event) => {
      current = chooseTopic(current, event, PERSON);
      view.setDocument(shown());
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (answering === undefined || text === "") return;
    // The answer is a new entry of the copy of the page: a reply to the entry, which waits on no one after it.
    current = answerEntry(current, answering, text, new Date().toISOString(), PERSON);
    const made = current.boxes.at(-1)?.id;
    // The panel goes with the form, and the picture gets the answer.
    closeForm();
    if (made !== undefined) view.reveal(made);
    paint();
  });
  cancel.addEventListener("click", closeForm);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeForm();
  });
  // A page that becomes narrow or wide gives the open form its other place. The form loses its focus when it moves.
  narrow.addEventListener("change", () => {
    if (answering === undefined) return;
    const typing = form.contains(document.activeElement);
    seat();
    aim();
    if (typing) field.focus({ preventScroll: true });
  });

  onThemeChange(() => {
    view.setTheme(threadTheme());
  });
  paint();
  return view;
}
