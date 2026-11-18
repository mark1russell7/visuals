import { pictureBounds, type Rect } from "@mark1russell7/layout-contract";
import { canvasAdvance } from "@mark1russell7/layout-contract/text";
import { h, svg } from "@mark1russell7/site-pages/chrome";
import { aimAll, aimReveal, createPictureContent, createPictureStage, type Insets, type PictureAim, type PictureRecord, type PictureStage } from "@mark1russell7/visuals/graph";
import { cardOf, relationNames, type CardChoice, type CardModel, type CardName, type TopicChoiceEvent } from "./card.ts";
import { choiceOf, edgeKind, edgeState, isChosen, isProposal, labelOf, type ThreadBox, type ThreadDocument, type ThreadLegend } from "./document.ts";
import { TEXT_ZOOM, threadLooks, type ThreadLookState, type ThreadTheme } from "./looks.ts";
import { threadPicture, type ThreadPicture, type ThreadPictureOptions } from "./picture.ts";
import style from "./thread.css?inline";

/** The options of `mountThreadView`. */
export interface ThreadViewOptions extends Pick<ThreadPictureOptions, "router" | "proposalRouter" | "curve" | "force" | "locale" | "timeZone"> {
  readonly document: ThreadDocument;
  /** The names of the kinds and of the relations. With no legend, the view shows the ids. */
  readonly legend?: ThreadLegend | undefined;
  readonly theme: ThreadTheme;
  /** The name of the picture for a screen reader. */
  readonly label?: string | undefined;
  /** The parts of the view that the page covers, from each edge, in CSS pixels. */
  readonly covered?: Partial<Insets> | undefined;
  /** With `true`, each proposal has a line from the start. The default is `false`: only the proposals of the selected part have lines. */
  readonly proposals?: boolean | undefined;
  /** The view starts this function when a person selects a box, or selects no box. */
  readonly onPick?: ((box: ThreadBox | undefined) => void) | undefined;
  /** The view starts this function when the pointer goes to a different box, or to no box. */
  readonly onHover?: ((box: ThreadBox | undefined) => void) | undefined;
  /**
   * The view starts this function when a person gives a topic to a part. The view writes no data.
   * The page writes the choice, then gives the new document with `setDocument`. With no function, a person cannot change a topic.
   */
  readonly onChoose?: ((event: TopicChoiceEvent) => void) | undefined;
}

/** A thread view in a page. */
export interface ThreadView {
  /** This function shows a different document. A document with the same boxes keeps the place of each box, the selection and the camera. */
  setDocument(document: ThreadDocument): void;
  /** This function changes the names of the kinds and of the relations. */
  setLegend(legend: ThreadLegend | undefined): void;
  /** This function changes the colors. */
  setTheme(theme: ThreadTheme): void;
  /** This function selects a box by its id, as a click does, and moves the camera to it. It does not start `onPick`. */
  select(id: string | undefined): void;
  /** This function removes the view from the page. */
  dispose(): void;
}

/** The custom property of each color of a theme. The style of the view reads them. */
const THEME_PROPERTIES: Readonly<Record<keyof ThreadTheme, string>> = {
  background: "--thread-background",
  surface: "--thread-surface",
  tray: "--thread-tray",
  stroke: "--thread-stroke",
  text: "--thread-text",
  muted: "--thread-muted",
  edge: "--thread-edge",
  edgeStrong: "--thread-edge-strong",
  accent: "--thread-accent",
  topicFill: "--thread-topic-fill",
  topicText: "--thread-topic-text",
  open: "--thread-open",
  quiet: "--thread-quiet",
};

/** The largest width of a narrow view, in CSS pixels. The style has the same number. */
const NARROW = 700;

/** The smallest zoom of the camera for a selected topic. A topic shows where its parts are, so a far view is correct for it. */
const TOPIC_ZOOM = 0.3;

/** The largest zoom of the camera for a selection. */
const MOST_ZOOM = 1.25;

/** The factor of one step of a zoom button. */
const ZOOM_STEP = 1.4;

/** The style sheet of each document and of each shadow tree that has a view. */
const sheets = new WeakMap<Document | ShadowRoot, CSSStyleSheet>();

/** This function adds the style of the view to the document or to the shadow tree of an element, one time. */
function addStyle(element: HTMLElement): void {
  const home = element.getRootNode();
  const target = home instanceof ShadowRoot ? home : element.ownerDocument;
  if (sheets.has(target)) return;
  const sheet = new (element.ownerDocument.defaultView ?? globalThis).CSSStyleSheet();
  sheet.replaceSync(style);
  target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
  sheets.set(target, sheet);
}

/** This function makes a button with a function for its click. */
function button(className: string, attrs: Readonly<Record<string, string | boolean | undefined>>, children: readonly (Node | string | false | undefined)[], onClick: () => void): HTMLButtonElement {
  const node = h("button", { type: "button", class: className, ...attrs }, ...children);
  node.addEventListener("click", onClick);
  return node;
}

/** This function makes the small picture of a line for the legend. */
function lineSample(options: { readonly dash?: string; readonly arrow?: boolean; readonly dot?: boolean; readonly strong?: boolean }): SVGSVGElement {
  const tone = options.strong === true ? "is-strong" : undefined;
  return svg(
    "svg",
    { width: 28, height: 10, viewBox: "0 0 28 10", "aria-hidden": "true" },
    svg("path", { class: tone, d: options.arrow === true ? "M1 5h20" : "M1 5h26", "stroke-dasharray": options.dash, "stroke-linecap": "round" }),
    options.arrow === true && svg("path", { class: tone ?? "is-end", d: "M27 5l-6.5-3.5v7z" }),
    options.dot === true && svg("circle", { class: "is-end", cx: 3, cy: 5, r: 2.75 }),
  );
}

/** This function makes the small picture of a sign of a part for the legend. */
function signSample(className: string): SVGSVGElement {
  return svg("svg", { width: 28, height: 10, viewBox: "0 0 28 10", "aria-hidden": "true" }, svg("circle", { class: className, cx: 14, cy: 5, r: 3 }));
}

/**
 * This function puts a thread view in an element: the picture of a thread document that a person moves, reads and changes.
 *
 * - The element gives the size of the view. Give it a height.
 * - A person moves the picture with a pointer, the wheel or the keys. A click on a box shows its card.
 * - The card of a part shows the topics that the sorter proposed. A click on a topic starts `onChoose`.
 * - A switch shows the line of each proposal. A button goes to the next part with no topic.
 *
 * The view writes no data: the page keeps the document.
 */
export function mountThreadView(element: HTMLElement, options: ThreadViewOptions): ThreadView {
  addStyle(element);
  const page = element.ownerDocument;
  const stageBox = h("div", { class: "thread-stage" });
  const note = h("p", { class: "thread-note", hidden: true });
  const openButton = button("thread-open", { hidden: true }, [], () => {
    const open = openParts();
    const next = open[(open.indexOf(selected ?? "") + 1) % open.length];
    if (next !== undefined) show(next, true, true);
  });
  const proposalsInput = h("input", { type: "checkbox" });
  const proposalsSwitch = h("label", { class: "thread-tool thread-switch" }, proposalsInput, h("span", {}, "Proposals"));
  const tools = h(
    "div",
    { class: "thread-tools" },
    proposalsSwitch,
    button("thread-tool thread-zoom", { "aria-label": "Zoom out" }, ["−"], () => stage?.zoomBy(1 / ZOOM_STEP)),
    button("thread-tool thread-zoom", { "aria-label": "Zoom in" }, ["+"], () => stage?.zoomBy(ZOOM_STEP)),
    button("thread-tool", {}, ["Show all"], () => stage?.setView("all")),
  );
  const card = h("aside", { class: "thread-card", hidden: true, "aria-label": "The selected box" });
  const legendList = h("ul");
  const legendBox = h("details", { class: "thread-legend", open: true }, h("summary", {}, "Legend"), legendList);
  const tip = h("div", { class: "thread-tip", role: "tooltip", hidden: true });
  const root = h("div", { class: "thread" }, stageBox, note, openButton, tools, card, legendBox, tip);

  const setColors = (theme: ThreadTheme): void => {
    for (const [key, property] of Object.entries(THEME_PROPERTIES)) root.style.setProperty(property, theme[key as keyof ThreadTheme]);
  };
  setColors(options.theme);
  element.append(root);

  /** This function gives the parts of the view that the page and the card cover. */
  const insetsNow = (): Insets => {
    const narrow = root.clientWidth <= NARROW;
    const own = narrow ? { top: 56, right: 0, bottom: card.hidden ? 0 : card.offsetHeight, left: 0 } : { top: 52, right: card.hidden ? 0 : card.offsetWidth + 20, bottom: 0, left: 0 };
    const outer = options.covered ?? {};
    return { top: Math.max(own.top, outer.top ?? 0), right: Math.max(own.right, outer.right ?? 0), bottom: Math.max(own.bottom, outer.bottom ?? 0), left: Math.max(own.left, outer.left ?? 0) };
  };

  /**
   * This function gives the shape of the area that shows the picture: its width divided by its height, to one decimal place.
   * It gives `undefined` for a view with no size.
   */
  const shapeNow = (): number | undefined => {
    const insets = insetsNow();
    const width = root.clientWidth - insets.left - insets.right;
    const height = root.clientHeight - insets.top - insets.bottom;
    return width > 0 && height > 0 ? Math.round((width / height) * 10) / 10 : undefined;
  };

  const measure = page.createElement("canvas").getContext("2d");
  let legend = options.legend;
  /** The shape of the area at the time of the first picture. A later change of the size keeps the place of each box. */
  let aspect = shapeNow();
  const making = (): ThreadPictureOptions => ({ router: options.router, proposalRouter: options.proposalRouter, curve: options.curve, force: options.force, aspect, locale: options.locale, timeZone: options.timeZone, legend });
  const advance = measure === null ? (text: string): number => text.length * 7 : canvasAdvance(measure);
  let thread: ThreadPicture = threadPicture(options.document, advance, making());
  let boxes = new Map(thread.document.boxes.map((box) => [box.id, box]));
  let proposals = options.proposals ?? false;
  let selected: string | undefined;
  let hint: ThreadLookState["hint"];
  /** The position of the pointer in the view, in CSS pixels from its top left corner. */
  let pointer = { x: 0, y: 0 };
  let hovered: ThreadBox | undefined;
  /** The insets that the stage has, as a text. */
  let insetsText = "";
  /** This value is true until the view had a size. */
  let first = true;
  proposalsInput.checked = proposals;

  /** This function gives the selected box if a person can give a topic to it: a part, or an entry. */
  const chooser = (): string | undefined => {
    const kind = selected === undefined ? undefined : thread.kinds.get(selected);
    return kind === "part" || kind === "entry" ? selected : undefined;
  };

  const content = createPictureContent(thread.picture, { looks: threadLooks(() => ({ thread, proposals, part: chooser(), hint })) });

  // The variable is here before the stage, so a function that the stage starts in its making reads `undefined`.
  let stage: PictureStage<PictureRecord, ThreadTheme> | undefined;
  stage = createPictureStage<PictureRecord, ThreadTheme>(stageBox, {
    content,
    theme: options.theme,
    label: options.label ?? "The messages of a conversation and their topics",
    views: { all: aimAll({ most: 1 }) },
    onHover: (pick) => {
      hovered = pick?.type === "box" ? boxes.get(pick.id) : undefined;
      showTip();
      options.onHover?.(hovered);
    },
    onSelect: (pick) => {
      show(pick?.type === "box" ? pick.id : undefined, true, true);
    },
    onView: () => {
      showTip();
    },
  });

  /** This function tells the stage which parts of the view the page and the card cover, after a change. */
  const setInsets = (): void => {
    const next = insetsNow();
    const text = JSON.stringify(next);
    if (text === insetsText) return;
    insetsText = text;
    stage?.setInsets(next);
  };

  /** This function gives the bounds of a group of boxes. */
  const boundsOf = (ids: readonly string[]): Rect | undefined => {
    const wanted = new Set(ids);
    return pictureBounds({ ...thread.picture, boxes: thread.picture.boxes.filter((box) => wanted.has(box.id)), routes: [], labels: [] });
  };

  /**
   * This function gives the aim of the camera for a selected box. The camera tries the largest group of boxes first.
   * A part needs text that a person reads. A topic shows where its parts are.
   */
  const aimOf = (id: string): PictureAim => {
    const edges = thread.document.edges ?? [];
    const kind = thread.kinds.get(id);
    const topOf = (box: string): string => boxes.get(box)?.parent ?? box;
    let groups: string[][];
    if (kind === "topic") {
      groups = [[id, ...edges.filter((edge) => isChosen(edge) && edge.target === id).map((edge) => topOf(choiceOf(edge)))], [id]];
    } else if (kind === "message") {
      groups = [[id, ...edges.filter((edge) => isChosen(edge) && topOf(choiceOf(edge)) === id).map((edge) => edge.target)], [id]];
    } else {
      const own = edges.filter((edge) => edgeKind(edge) === "touches" && edgeState(edge) !== "refused" && choiceOf(edge) === id);
      const base = [topOf(id), id];
      const chosen = own.filter(isChosen).map((edge) => edge.target);
      groups = [[...base, ...chosen, ...own.filter(isProposal).map((edge) => edge.target)], [...base, ...chosen], base];
    }
    const rects = groups.map(boundsOf).filter((rect): rect is Rect => rect !== undefined);
    return aimReveal(rects, { least: kind === "topic" ? TOPIC_ZOOM : TEXT_ZOOM, most: MOST_ZOOM, margin: 24 });
  };

  /** This function gives the parts and the entries that have proposals and no topic, in the order of the document. */
  const openParts = (): string[] => thread.document.boxes.filter((box) => thread.states.get(box.id) === "open").map((box) => box.id);

  /** This function shows the text of the box below the pointer, when the picture is too small to read. */
  function showTip(): void {
    const text = hovered === undefined || stage === undefined || stage.view().k >= TEXT_ZOOM ? undefined : labelOf(hovered);
    tip.hidden = text === undefined;
    if (text === undefined) return;
    tip.textContent = text;
    const x = Math.min(pointer.x + 14, root.clientWidth - tip.offsetWidth - 8);
    const y = pointer.y + 18 + tip.offsetHeight > root.clientHeight ? pointer.y - tip.offsetHeight - 10 : pointer.y + 18;
    tip.style.transform = `translate(${String(Math.max(8, x))}px, ${String(Math.max(8, y))}px)`;
  }

  /** This function sets the topic that a row of the card points at. The picture shows a ring around that topic. */
  const setHint = (next: ThreadLookState["hint"]): void => {
    if (hint?.topic === next?.topic) return;
    hint = next;
    stage?.refresh();
  };

  /** This function makes one row of a list of topics: a radio button that gives the topic to the part. */
  const choiceRow = (choice: CardName & Partial<CardChoice>, model: CardModel): HTMLLIElement => {
    const on = choice.chosen === true;
    const { score } = choice;
    const bar = h("span", { class: "thread-bar" });
    if (score !== undefined) bar.style.setProperty("--share", String(Math.min(1, Math.max(0, score))));
    const by = model.by === undefined || model.by === "sorter" ? "the sorter" : model.by;
    const node = button(
      "thread-choice",
      { role: "radio", "aria-checked": String(on), disabled: options.onChoose === undefined, "data-key": `choice:${choice.id}` },
      [
        h("span", { class: "thread-mark" }),
        h("span", { class: "thread-name" }, choice.label, on && h("small", {}, `Chosen by ${by}`)),
        score !== undefined && h("span", { class: "thread-score" }, bar, h("span", { class: "thread-score-value" }, score.toFixed(2))),
      ],
      () => {
        if (!on) options.onChoose?.({ choice: model.id, target: choice.id, edge: choice.edge });
      },
    );
    const point = (): void => {
      setHint({ topic: choice.id, edge: choice.edge });
    };
    const leave = (): void => {
      setHint(undefined);
    };
    node.addEventListener("pointerenter", point);
    node.addEventListener("focus", point);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("blur", leave);
    return h("li", { role: "none" }, node);
  };

  /** This function makes the list of the parts of a message or of a topic. A click on a row selects the part. */
  const partList = (parts: readonly CardName[]): HTMLUListElement =>
    h(
      "ul",
      { class: "thread-parts" },
      parts.map((part) =>
        h(
          "li",
          {},
          button("thread-part", { "data-key": `part:${part.id}` }, [part.label], () => {
            show(part.id, true, true);
          }),
        ),
      ),
    );

  /** This function shows the card of the selected box, or no card. */
  const drawCard = (): void => {
    const model = selected === undefined ? undefined : cardOf(thread, selected, { legend, locale: options.locale, timeZone: options.timeZone });
    const others = card.querySelector<HTMLDetailsElement>(".thread-others")?.open === true && card.dataset["box"] === model?.id;
    // The card makes its rows again. A person who uses the keys keeps the row, or goes to the first button of the new card.
    const active = page.activeElement;
    const held = active !== null && card.contains(active);
    const key = held ? (active.getAttribute("data-key") ?? undefined) : undefined;
    card.hidden = model === undefined;
    if (model === undefined) {
      delete card.dataset["box"];
      card.replaceChildren();
      return;
    }
    if (card.dataset["box"] !== model.id) card.scrollTop = 0;
    card.dataset["box"] = model.id;
    const close = button("thread-close", { "aria-label": "Close" }, ["×"], () => {
      show(undefined, true, false);
      stage?.canvas.focus({ preventScroll: true });
    });
    const refocus = (): void => {
      if (!held) return;
      const same = key === undefined ? undefined : [...card.querySelectorAll<HTMLElement>("[data-key]")].find((node) => node.dataset["key"] === key);
      (same ?? close).focus({ preventScroll: true });
    };
    const meta = h("p", { class: "thread-meta" }, [model.title, model.date, model.done && "done"].filter((text): text is string => typeof text === "string").join(", "));
    const link = model.link !== undefined && h("a", { class: "thread-link", href: model.link }, "Open");
    if (model.kind === "topic" || model.kind === "message") {
      const about = model.kind === "topic" && model.text !== model.label && h("p", { class: "thread-about" }, model.text);
      card.replaceChildren(
        close,
        meta,
        h("p", { class: model.kind === "topic" ? "thread-text is-name" : "thread-text" }, model.kind === "topic" ? model.label : model.text),
        ...[about, link].filter((node): node is HTMLParagraphElement | HTMLAnchorElement => node !== false),
        h("h3", { class: "thread-heading" }, `Parts (${String(model.parts.length)})`),
        partList(model.parts),
      );
      refocus();
      return;
    }
    const more = h(
      "details",
      { class: "thread-others", open: others },
      h("summary", {}, `Other topics (${String(model.others.length)})`),
      h(
        "ul",
        { class: "thread-choices", role: "radiogroup", "aria-label": "Other topics" },
        model.others.map((topic) => choiceRow(topic, model)),
      ),
    );
    card.replaceChildren(
      close,
      meta,
      h("p", { class: "thread-text" }, model.text),
      ...(link === false ? [] : [link]),
      h("h3", { class: "thread-heading" }, model.choices.some((choice) => choice.chosen) ? "Topic" : "Choose a topic"),
      h(
        "ul",
        { class: "thread-choices", role: "radiogroup", "aria-label": "Topics of the sorter" },
        model.choices.map((choice) => choiceRow(choice, model)),
      ),
      ...(model.others.length === 0 ? [] : [more]),
    );
    refocus();
  };

  /** This function shows what depends on the document and not on the selection: the legend, the switch, the button and the note. */
  const drawFrame = (): void => {
    const edges = thread.document.edges ?? [];
    const item = (sample: SVGSVGElement, text: string): HTMLLIElement => h("li", {}, sample, text);
    const states = new Set(thread.states.values());
    legendList.replaceChildren(
      ...(edges.some(isChosen) ? [item(lineSample({ dot: true }), "Topic of a part")] : []),
      ...(edges.some(isProposal) ? [item(lineSample({ dash: "5 4" }), "Proposal")] : []),
      ...(edges.some((edge) => edgeKind(edge) === "reply") ? [item(lineSample({ arrow: true, strong: true }), "Reply")] : []),
      ...relationNames(thread.document, legend).map((relation) => item(lineSample({ dash: "1 5", arrow: relation.id === "sub" }), relation.label)),
      ...(states.has("changed") ? [item(signSample("is-changed"), "Not the first proposal")] : []),
      ...(states.has("open") ? [item(signSample("is-open"), "No topic yet")] : []),
    );
    legendBox.hidden = legendList.childElementCount === 0;
    proposalsSwitch.hidden = !edges.some(isProposal);
    const open = openParts();
    openButton.hidden = open.length === 0;
    // A narrow view hides some of the words, so the label has each word.
    openButton.replaceChildren(h("span", { class: "thread-open-words" }, "No topic", h("span", { class: "thread-open-more" }, " yet"), ": "), String(open.length));
    openButton.setAttribute("aria-label", `No topic yet: ${String(open.length)}. Go to the next part with no topic.`);
    const empty = thread.document.boxes.length === 0;
    note.hidden = !empty && stage !== undefined;
    note.textContent = stage === undefined ? "This browser cannot draw the picture." : "No messages yet.";
    tools.hidden = empty || stage === undefined;
  };

  /** This function selects a box, or no box. `tell` starts `onPick`, and `move` moves the camera to the box. */
  function show(id: string | undefined, tell: boolean, move: boolean): void {
    selected = id !== undefined && thread.kinds.has(id) ? id : undefined;
    hint = undefined;
    hovered = undefined;
    stage?.select(selected);
    drawCard();
    showTip();
    setInsets();
    if (selected !== undefined && move) stage?.setView(aimOf(selected));
    stage?.refresh();
    if (tell) options.onPick?.(selected === undefined ? undefined : boxes.get(selected));
  }

  /** This function makes the picture again from a document. Each box keeps its place when the boxes are the same and `fresh` is not true. */
  const remake = (document: ThreadDocument, fresh = false): void => {
    thread = threadPicture(document, advance, fresh ? making() : { ...making(), keep: thread });
    boxes = new Map(thread.document.boxes.map((box) => [box.id, box]));
    content.setPicture(thread.picture);
    if (selected !== undefined && !thread.kinds.has(selected)) selected = undefined;
    hint = undefined;
    stage?.select(selected);
    drawFrame();
    drawCard();
    setInsets();
    stage?.refresh();
  };

  proposalsInput.addEventListener("change", () => {
    proposals = proposalsInput.checked;
    // The focus of the picture depends on the lines that the looks show, so the content finds it again.
    content.setPicture(thread.picture);
    stage?.refresh();
  });
  stageBox.addEventListener("pointermove", (event) => {
    const box = root.getBoundingClientRect();
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    showTip();
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    show(undefined, true, false);
    stage?.canvas.focus({ preventScroll: true });
  });
  const observer = new ResizeObserver(() => {
    if (first && root.clientWidth > 0) {
      first = false;
      legendBox.open = root.clientWidth > NARROW;
      // A view that had no size at its start has a picture with no shape. Its first size gives the shape.
      if (aspect === undefined) {
        aspect = shapeNow();
        if (aspect !== undefined) {
          remake(thread.document, true);
          stage?.setView("all");
        }
      }
    }
    setInsets();
  });
  observer.observe(root);
  drawFrame();
  setInsets();

  return {
    setDocument: remake,
    setLegend(next) {
      legend = next;
      remake(thread.document);
    },
    setTheme(theme) {
      setColors(theme);
      stage?.setTheme(theme);
    },
    select(id) {
      show(id, false, true);
    },
    dispose() {
      observer.disconnect();
      stage?.dispose();
      root.remove();
    },
  };
}
