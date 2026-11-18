import { h } from "@mark1russell7/site-pages/chrome";
import { onThemeChange, threadTheme } from "./colors.ts";
import { chooseTopic } from "./thread/card.ts";
import { labelOf, threadKinds, topicCounts, type ThreadDocument } from "./thread/document.ts";
import { mountThreadView, type ThreadActionEvent, type ThreadView } from "./thread/mount.ts";
import { phaseText, type ThreadPhaseEvent } from "./thread/phases.ts";
import { answerEntry, SAMPLE_LEGEND, sampleThread } from "./thread/sample.ts";

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

/** The space between the form of an answer and its entry, and between the form and the border of the picture, in pixels. */
const FORM_GAP = 8;

/** A page of this width or less has the form of an answer at the bottom of the picture. */
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

  // The form of an answer. The view tells the action and the place of its entry, and the page has the form.
  const form = elements.form;
  const title = h("p", { class: "thread-form-title", id: "thread-form-title" });
  const field = h("textarea", { id: "thread-answer", rows: "2", maxlength: "200", required: "" });
  const cancel = h("button", { type: "button" }, "Cancel");
  form.setAttribute("aria-labelledby", title.id);
  form.append(title, h("label", { for: field.id }, "Your answer"), field, h("div", { class: "thread-form-buttons" }, h("button", { type: "submit", class: "main" }, "Add the answer"), cancel));
  const narrow = matchMedia(NARROW);
  /** The id of the entry of the open form. */
  let answering: string | undefined;

  /** This function puts the form at the rectangle of its entry: on its right, or on its left when the right has no room. */
  const placeForm = (anchor = answering === undefined ? undefined : view.anchorOf(answering)): void => {
    // A narrow page has the form at the bottom of the picture. An entry with no rectangle keeps the form at its last place.
    if (answering === undefined || anchor === undefined || narrow.matches) return;
    const frame = elements.picture.getBoundingClientRect();
    const right = anchor.right - frame.left + FORM_GAP;
    const left = right + form.offsetWidth <= frame.width - FORM_GAP ? right : Math.max(FORM_GAP, anchor.left - frame.left - FORM_GAP - form.offsetWidth);
    const top = Math.max(FORM_GAP, Math.min(anchor.top - frame.top, frame.height - form.offsetHeight - FORM_GAP));
    form.style.left = `${String(Math.round(left))}px`;
    form.style.top = `${String(Math.round(top))}px`;
  };
  const closeForm = (): void => {
    answering = undefined;
    form.hidden = true;
  };
  const openForm = (event: ThreadActionEvent): void => {
    answering = event.box.id;
    title.textContent = labelOf(event.box);
    field.value = "";
    form.removeAttribute("style");
    form.hidden = false;
    // The card of the entry closes, so the form and the card do not cover the same part of the picture.
    selected = undefined;
    view.select(undefined);
    paint();
    if (narrow.matches) view.reveal(answering, { bottom: form.offsetHeight + 2 * FORM_GAP });
    else placeForm(event.anchor);
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
    onCamera: () => {
      placeForm();
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (answering === undefined || text === "") return;
    // The answer is a new entry of the copy of the page: a reply to the entry, which waits on no one after it.
    current = answerEntry(current, answering, text, new Date().toISOString(), PERSON);
    closeForm();
    view.setDocument(current);
    const made = current.boxes.at(-1)?.id;
    if (made !== undefined) view.reveal(made);
    paint();
  });
  cancel.addEventListener("click", closeForm);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeForm();
  });
  // A new size of the page moves the entry in the picture, and the view gives no event of the camera for it.
  addEventListener("resize", () => {
    placeForm();
  });

  onThemeChange(() => {
    view.setTheme(threadTheme());
  });
  paint();
  return view;
}
