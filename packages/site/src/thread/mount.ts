import { pictureBounds, type Rect } from "@mark1russell7/layout-contract";
import { canvasAdvance } from "@mark1russell7/layout-contract/text";
import { h, svg } from "@mark1russell7/site-pages/chrome";
import { aimAll, aimReveal, createPictureContent, createPictureStage, freeArea, rectToScreen, revealRects, type Insets, type PictureAim, type PictureContent, type PictureRecord, type PictureStage, type PictureView } from "@mark1russell7/visuals/graph";
import { anchorRect } from "./anchor.ts";
import { cardOf, relationNames, type CardChoice, type CardModel, type CardName, type TopicChoiceEvent } from "./card.ts";
import { choiceOf, edgeKind, edgeState, isChosen, isProposal, labelOf, waitsOf, type ThreadBox, type ThreadDocument, type ThreadLegend } from "./document.ts";
import { TEXT_ZOOM, threadLooks, type ThreadLookState, type ThreadTheme } from "./looks.ts";
import { phaseTeller, type ThreadPhaseEvent } from "./phases.ts";
import { routedProposals, threadPicture, waitsText, withProposals, type ThreadPicture, type ThreadPictureOptions } from "./picture.ts";
import style from "./thread.css?inline";

/** A person used a button of the card of a box: an action of `data.actions`. */
export interface ThreadActionEvent {
  /** The box of the card. */
  readonly box: ThreadBox;
  /** The id of the action: the `id` of a record of `data.actions`. */
  readonly action: string;
  /**
   * The rectangle of the box in the viewport of the page, in the form of `getBoundingClientRect`.
   * The camera shows the box before the event, so a form at the rectangle is next to the box.
   * It is `undefined` for a view that cannot draw.
   */
  readonly anchor: DOMRect | undefined;
}

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
  /**
   * The view starts this function when a person uses a button of the card of a box. The view has no form and writes no data.
   * The page does the action, for example with a form at the anchor of the event. With no function, a card has no buttons.
   */
  readonly onAction?: ((event: ThreadActionEvent) => void) | undefined;
  /**
   * The view starts this function after each change of the camera, one time for each drawing at most.
   * A page that keeps a form at a box reads `anchorOf` again. A scroll of the page gives no event.
   */
  readonly onCamera?: ((view: PictureView) => void) | undefined;
  /**
   * The view starts this function at the end of each step of a picture: the layout, then the first drawing.
   * An event with an error tells that the step stopped. The view does not throw that error: it shows a note.
   */
  readonly onPhase?: ((event: ThreadPhaseEvent) => void) | undefined;
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
  /**
   * This function gives the rectangle of a box in the viewport of the page at this time, in the form of `getBoundingClientRect`.
   * It gives `undefined` for an id that is not a box, and when no part of the box is in the picture.
   */
  anchorOf(id: string): DOMRect | undefined;
  /**
   * This function moves the camera until the free area shows a box. The camera stays when it shows the box.
   * `covered` has more parts of the view that the page covers at this time, for example a form at the bottom.
   * For a panel, the view measures the content of the panel first, so the camera shows the full panel.
   */
  reveal(id: string, covered?: Partial<Insets>): void;
  /**
   * This function gives the element of a panel. The page puts the content of the panel in it, and the element moves with the camera.
   * The same element stays for the same id until the document has no such panel. Thus the content keeps its focus and its text.
   * The view sets the width of the element, and it gives the panel the height of the content.
   * It gives `undefined` for an id that is not a panel of the picture, and for a view that cannot draw.
   */
  slot(id: string): HTMLElement | undefined;
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
  waits: "--thread-waits",
  waitsFill: "--thread-waits-fill",
};

/** The largest width of a narrow view, in CSS pixels. The style has the same number. */
const NARROW = 700;

/**
 * The smallest zoom of the camera for a selected topic. A topic shows where its parts are, so a far view is correct for it.
 * A narrow view shows the parts of a topic only at a small zoom. Below this zoom, the camera shows the topic alone.
 */
const TOPIC_ZOOM = 0.06;

/** The largest zoom of the camera for a selection. */
const MOST_ZOOM = 1.25;

/** The factor of one step of a zoom button. */
const ZOOM_STEP = 1.4;

/** The aim that keeps the view of the camera. The stage has it when no box is selected, so the aim of the last selection ends. */
const aimStay: PictureAim = (frame) => frame.view;

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

/** This function makes the small picture of an entry that waits for the legend. */
function waitsSample(): SVGSVGElement {
  return svg("svg", { width: 28, height: 10, viewBox: "0 0 28 10", "aria-hidden": "true" }, svg("rect", { class: "is-waits", x: 7, y: 1, width: 14, height: 8, rx: 2.5 }));
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
 * - A panel of the document is an empty box next to its box. `slot` gives the element for its content, for example a form of the page.
 * - A key, a pointer or a wheel in the content of a panel starts no move of the picture and no selection.
 *
 * The view writes no data: the page keeps the document.
 */
export function mountThreadView(element: HTMLElement, options: ThreadViewOptions): ThreadView {
  addStyle(element);
  const page = element.ownerDocument;
  const stageBox = h("div", { class: "thread-stage" });
  // The layer of the slots is after the stage, so the content of a panel is above the picture and below the tools and the card.
  const slotLayer = h("div", { class: "thread-slots" });
  const note = h("p", { class: "thread-note", hidden: true });
  /** This function selects the next box of a list. The walk goes on after the selected box, in the order of the document. */
  const walk = (ids: readonly string[]): void => {
    const among = new Set(ids);
    const order = thread.document.boxes.map((box) => box.id);
    const from = order.indexOf(selected ?? "") + 1;
    const next = [...order.slice(from), ...order.slice(0, from)].find((id) => among.has(id));
    if (next !== undefined) show(next, true, true);
  };
  // The walk goes on after the selected box. Thus a part that got a topic does not start the walk again.
  const openButton = button("thread-jump thread-open", { hidden: true }, [], () => {
    walk(openParts());
  });
  const waitsButton = button("thread-jump thread-waits", { hidden: true }, [], () => {
    walk(waitingEntries());
  });
  const jumps = h("div", { class: "thread-jumps" }, waitsButton, openButton);
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
  const root = h("div", { class: "thread" }, stageBox, slotLayer, note, jumps, tools, card, legendBox, tip);

  // A theme with no value for a color has no property for it, so the style uses its default.
  const setColors = (theme: ThreadTheme): void => {
    for (const [key, property] of Object.entries(THEME_PROPERTIES)) {
      const color = theme[key as keyof ThreadTheme];
      if (color === undefined) root.style.removeProperty(property);
      else root.style.setProperty(property, color);
    }
  };
  setColors(options.theme);
  element.append(root);

  /** This function gives the parts of the view that the page and the card cover. `more` has parts that the page covers for one move of the camera. */
  const insetsNow = (more: Partial<Insets> = {}): Insets => {
    const narrow = root.clientWidth <= NARROW;
    // The two buttons of the walks are in two rows in a view that has no room for them in one row.
    const top = Math.max(narrow ? 56 : 52, jumps.offsetHeight === 0 ? 0 : jumps.offsetTop + jumps.offsetHeight + 4);
    const own = narrow ? { top, right: 0, bottom: card.hidden ? 0 : card.offsetHeight, left: 0 } : { top, right: card.hidden ? 0 : card.offsetWidth + 20, bottom: 0, left: 0 };
    const outer = options.covered ?? {};
    const most = (edge: keyof Insets): number => Math.max(own[edge], outer[edge] ?? 0, more[edge] ?? 0);
    return { top: most("top"), right: most("right"), bottom: most("bottom"), left: most("left") };
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
  let proposals = options.proposals ?? false;
  let selected: string | undefined;
  /** This function gives the options of the picture of a document. `shown` has the parts and the entries whose proposals the looks show. */
  const making = (document: ThreadDocument, shown: readonly string[] = []): ThreadPictureOptions => ({
    router: options.router,
    proposalRouter: options.proposalRouter,
    curve: options.curve,
    force: options.force,
    aspect,
    locale: options.locale,
    timeZone: options.timeZone,
    legend,
    proposals: routedProposals(document, shown, proposals),
  });
  const advance = measure === null ? (text: string): number => text.length * 7 : canvasAdvance(measure);
  const phases = phaseTeller({ onPhase: options.onPhase });
  /** The element of each panel of the picture, by the id of the panel. The page puts the content of the panel in it. */
  const slots = new Map<string, HTMLElement>();
  /** The height of the content of each panel that has content, by the id of the panel. */
  const heights = new Map<string, number>();
  /** The heights of the content of the panels that the last picture has. */
  let usedHeights: ReadonlyMap<string, number> = new Map();
  /**
   * This function reads the height of the content of each panel. A slot with no content has no height, so its panel has the height of the document.
   * A slot of a view that the page hides has the height 0. Its panel keeps the last height.
   */
  const slotHeights = (): Map<string, number> => {
    for (const [id, slot] of slots) {
      if (slot.childNodes.length === 0) heights.delete(id);
      else if (slot.offsetHeight > 0) heights.set(id, slot.offsetHeight);
    }
    return new Map(heights);
  };
  /** This value is true when the last document has no picture. The note tells it. */
  let failed = false;
  /**
   * This function makes the picture of a document, and tells its time. With `keep`, each box of that picture keeps its place if the boxes are the same.
   * A document that has no picture gives the picture of no boxes.
   */
  const pictureFor = (document: ThreadDocument, shown: readonly string[] = [], keep?: ThreadPicture): ThreadPicture => {
    usedHeights = slotHeights();
    const made = phases.layout(document.boxes.length, () => threadPicture(document, advance, { ...making(document, shown), keep, panels: usedHeights }));
    failed = made === undefined;
    return made ?? threadPicture({ id: document.id, boxes: [] }, advance);
  };
  let thread: ThreadPicture = pictureFor(options.document);
  let boxes = new Map(thread.document.boxes.map((box) => [box.id, box]));
  let hint: ThreadLookState["hint"];
  /** The position of the pointer in the view, in CSS pixels from its top left corner. */
  let pointer = { x: 0, y: 0 };
  let hovered: ThreadBox | undefined;
  /** The insets of the stage at its start. The stage has them from its first picture, so the camera does not move after the start. */
  const firstInsets = insetsNow();
  /** The insets that the stage has, as a text. */
  let insetsText = JSON.stringify(firstInsets);
  /** The last document that the page gave, as a text. The same document again changes nothing. */
  let documentText = JSON.stringify(options.document);
  /** This value is true until the view had a size. */
  let first = true;
  /** This value is true when the page has the view. Before that, the page cannot use the view in a function of the options. */
  let mounted = false;
  proposalsInput.checked = proposals;

  /** This function gives the selected box if a person can give a topic to it: a part, or an entry. */
  const chooser = (): string | undefined => {
    const kind = selected === undefined ? undefined : thread.kinds.get(selected);
    return kind === "part" || kind === "entry" ? selected : undefined;
  };

  /** This function gives the parts and the entries whose proposals the looks show with the switch off: the selected part or entry. */
  const shownParts = (): readonly string[] => {
    const part = chooser();
    return part === undefined ? [] : [part];
  };

  const content = createPictureContent(thread.picture, { looks: threadLooks(() => ({ thread, proposals, part: chooser(), hint })) });

  /**
   * This function gives the picture the routes of the proposals that the looks show. It tells if the picture changed.
   * A picture of many proposals has a route only for the proposals that a person looks at.
   */
  const routeProposals = (): boolean => {
    const next = withProposals(thread, routedProposals(thread.document, shownParts(), proposals), { proposalRouter: options.proposalRouter, curve: options.curve });
    if (next === thread) return false;
    thread = next;
    content.setPicture(thread.picture);
    return true;
  };

  /** The content that the stage draws: `content`, with the time of the first drawing of each picture. */
  const timed: PictureContent<PictureRecord, ThreadTheme> = {
    get bounds() {
      return content.bounds;
    },
    has: (record) => content.has(record),
    pick: (at) => content.pick(at),
    draw: (context, frame, theme, highlight) => phases.paint(() => content.draw(context, frame, theme, highlight)),
    dispose: () => {
      content.dispose?.();
    },
  };

  // The variable is here before the stage, so a function that the stage starts in its making reads `undefined`.
  let stage: PictureStage<PictureRecord, ThreadTheme> | undefined;
  stage = createPictureStage<PictureRecord, ThreadTheme>(stageBox, {
    content: timed,
    theme: options.theme,
    label: options.label ?? "The messages of a conversation and their topics",
    views: { all: aimAll({ most: 1 }) },
    insets: firstInsets,
    onHover: (pick) => {
      hovered = pick?.type === "box" ? boxes.get(pick.id) : undefined;
      showTip();
      options.onHover?.(hovered);
    },
    onSelect: (pick) => {
      show(pick?.type === "box" ? pick.id : undefined, true, true);
    },
    onView: (view) => {
      showTip();
      placeSlots(view);
      if (mounted) options.onCamera?.(view);
    },
  });
  if (stage === undefined) phases.noPaint("The browser gave no 2D context for a canvas.");

  /**
   * This function puts each slot on the box of its panel for a view of the camera. The slot has the width of the panel and the scale of the camera.
   * In a far view, and for a panel with no place, the slot is not visible.
   */
  function placeSlots(view: PictureView | undefined = stage?.view()): void {
    for (const [id, slot] of slots) {
      const place = thread.places.get(id);
      if (view === undefined || place === undefined) {
        slot.classList.add("is-far");
        continue;
      }
      const at = rectToScreen(view, place);
      slot.classList.toggle("is-far", view.k < TEXT_ZOOM);
      slot.style.width = `${String(place.w)}px`;
      slot.style.transform = `translate(${String(at.x)}px, ${String(at.y)}px) scale(${String(view.k)})`;
    }
  }

  /** This function makes the picture again when the content of a panel has a different height. */
  const measureSlots = (): void => {
    const now = slotHeights();
    if ([...slots.keys()].some((id) => now.get(id) !== usedHeights.get(id))) remake(thread.document);
  };

  // The content of a panel can grow, for example a text area or a message of a form. Its panel gets the new height.
  const slotObserver = new ResizeObserver(measureSlots);

  /**
   * This function makes the slot of each panel of the picture, and removes the slot of each panel that the picture does not have.
   * A panel keeps its slot. A view that cannot draw has no slots, and a document with no picture keeps the slots that it has.
   */
  const syncSlots = (): void => {
    if (stage === undefined) return;
    if (!failed) {
      for (const [id, slot] of slots) {
        if (thread.kinds.get(id) === "panel") continue;
        slotObserver.unobserve(slot);
        slot.remove();
        slots.delete(id);
        heights.delete(id);
      }
      for (const box of thread.document.boxes) {
        if (thread.kinds.get(box.id) !== "panel") continue;
        let slot = slots.get(box.id);
        if (slot === undefined) {
          slot = h("div", { class: "thread-slot", role: "group", "data-panel": box.id });
          slots.set(box.id, slot);
          slotLayer.append(slot);
          slotObserver.observe(slot);
        }
        slot.setAttribute("aria-label", labelOf(box));
      }
    }
    placeSlots();
  };

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
      // The last group is the part alone. Thus a card that is larger than the free area does not hide its selected part.
      groups = [[...base, ...chosen, ...own.filter(isProposal).map((edge) => edge.target)], [...base, ...chosen], base, [id]];
    }
    const rects = groups.map(boundsOf).filter((rect): rect is Rect => rect !== undefined);
    return aimReveal(rects, { least: kind === "topic" ? TOPIC_ZOOM : TEXT_ZOOM, most: MOST_ZOOM, margin: 24 });
  };

  /**
   * This function gives the view that shows a box in the free area, or `undefined` for an id with no place.
   * The result is the view of the camera when that view shows the box. `covered` has more parts that the page covers.
   */
  const viewOf = (id: string, covered?: Partial<Insets>): PictureView | undefined => {
    const place = thread.places.get(id);
    if (stage === undefined || place === undefined) return undefined;
    const area = freeArea({ width: stage.canvas.clientWidth, height: stage.canvas.clientHeight }, insetsNow(covered));
    return revealRects(stage.view(), [place], area, { least: thread.kinds.get(id) === "topic" ? TOPIC_ZOOM : TEXT_ZOOM, most: MOST_ZOOM, margin: 24 });
  };

  /** This function moves the camera to the view that shows a box, and gives that view. The camera stays when it shows the box. */
  const bring = (id: string, covered?: Partial<Insets>): PictureView | undefined => {
    const to = viewOf(id, covered);
    const at = stage?.view();
    if (to !== undefined && at !== undefined && (to.x !== at.x || to.y !== at.y || to.k !== at.k)) stage?.setView(() => to);
    return to;
  };

  /** This function gives the rectangle of a box in the viewport of the page for a view of the camera. */
  const anchorAt = (id: string, view: PictureView): DOMRect | undefined => {
    const place = thread.places.get(id);
    if (stage === undefined || place === undefined) return undefined;
    const frame = stage.canvas.getBoundingClientRect();
    const rect = anchorRect(view, place, { x: frame.left, y: frame.top, w: frame.width, h: frame.height });
    return rect === undefined ? undefined : new DOMRect(rect.x, rect.y, rect.w, rect.h);
  };

  /** This function tells the page an action of the card of a box. The camera shows the box first, so the anchor is in the picture. */
  const act = (id: string, action: string): void => {
    const box = boxes.get(id);
    if (box === undefined) return;
    const to = bring(id);
    options.onAction?.({ box, action, anchor: to === undefined ? undefined : anchorAt(id, to) });
  };

  /** This function gives the parts and the entries that have proposals and no topic, in the order of the document. */
  const openParts =(): string[] => thread.document.boxes.filter((box) => thread.states.get(box.id) === "open").map((box) => box.id);

  /** This function gives the entries that wait, in the order of the document. */
  const waitingEntries = (): string[] => thread.document.boxes.filter((box) => thread.kinds.get(box.id) === "entry" && waitsOf(box) !== undefined).map((box) => box.id);

  /** This function gives who the entries of the document wait on, when it is one id for each of them. Entries that wait on two ids or more give `undefined`. */
  const waitedOn = (): string | undefined => {
    const ids = new Set(thread.document.boxes.filter((box) => thread.kinds.get(box.id) === "entry").map((box) => waitsOf(box)));
    ids.delete(undefined);
    const [only] = ids;
    return ids.size === 1 ? only : undefined;
  };

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
      delete card.dataset["chosen"];
      card.replaceChildren();
      return;
    }
    // A choice moves its row to the first list. The card goes to its top, so a person reads the new topic of the part.
    const chosen = model.kind === "topic" || model.kind === "message" ? "" : (model.choices.find((choice) => choice.chosen)?.id ?? "");
    if (card.dataset["box"] !== model.id || card.dataset["chosen"] !== chosen) card.scrollTop = 0;
    card.dataset["box"] = model.id;
    card.dataset["chosen"] = chosen;
    const close = button("thread-close", { "aria-label": "Close" }, ["×"], () => {
      show(undefined, true, false);
      stage?.canvas.focus({ preventScroll: true });
    });
    const refocus = (): void => {
      if (!held) return;
      const same = key === undefined ? undefined : [...card.querySelectorAll<HTMLElement>("[data-key]")].find((node) => node.dataset["key"] === key);
      (same ?? close).focus({ preventScroll: true });
    };
    const meta = h(
      "p",
      { class: "thread-meta" },
      [model.title, model.date, model.done && "done"].filter((text): text is string => typeof text === "string").join(", "),
      model.waits !== undefined && h("span", { class: "thread-waiting" }, `Waits on ${model.waits}`),
    );
    const link = model.link !== undefined && h("a", { class: "thread-link", href: model.link }, "Open");
    // A page with no function for an action gets no button: a button that does nothing misleads a person.
    const actions =
      options.onAction !== undefined &&
      model.actions.length > 0 &&
      h(
        "div",
        { class: "thread-actions", role: "group", "aria-label": "Actions" },
        model.actions.map((action) =>
          button("thread-action", { "data-key": `action:${action.id}` }, [action.title], () => {
            act(model.id, action.id);
          }),
        ),
      );
    if (model.kind === "topic" || model.kind === "message") {
      const about = model.kind === "topic" && model.text !== model.label && h("p", { class: "thread-about" }, model.text);
      card.replaceChildren(
        close,
        meta,
        h("p", { class: model.kind === "topic" ? "thread-text is-name" : "thread-text" }, model.kind === "topic" ? model.label : model.text),
        ...[about, link, actions].filter((node): node is HTMLParagraphElement | HTMLAnchorElement | HTMLDivElement => node !== false),
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
      ...(actions === false ? [] : [actions]),
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
    const waiting = waitingEntries();
    const on = waitedOn();
    legendList.replaceChildren(
      ...(edges.some(isChosen) ? [item(lineSample({ dot: true }), "Topic of a part")] : []),
      ...(edges.some(isProposal) ? [item(lineSample({ dash: "5 4" }), "Proposal")] : []),
      ...(edges.some((edge) => edgeKind(edge) === "reply") ? [item(lineSample({ arrow: true, strong: true }), "Reply")] : []),
      ...relationNames(thread.document, legend).map((relation) => item(lineSample({ dash: "1 5", arrow: relation.id === "sub" }), relation.label)),
      ...(states.has("changed") ? [item(signSample("is-changed"), "Not the first proposal")] : []),
      ...(states.has("open") ? [item(signSample("is-open"), "No topic yet")] : []),
      ...(waiting.length > 0 ? [item(waitsSample(), on === undefined ? "Waits on a person" : waitsText(on, legend))] : []),
    );
    legendBox.hidden = legendList.childElementCount === 0;
    proposalsSwitch.hidden = !edges.some(isProposal);
    waitsButton.hidden = waiting.length === 0;
    // A narrow view hides some of the words, so the label has each word.
    const words = on === undefined ? "Waiting" : waitsText(on, legend);
    const [verb = words, ...rest] = words.split(" ");
    waitsButton.replaceChildren(h("span", { class: "thread-jump-words" }, verb, rest.length > 0 && h("span", { class: "thread-jump-more" }, ` ${rest.join(" ")}`), ": "), String(waiting.length));
    waitsButton.setAttribute("aria-label", `${words}: ${String(waiting.length)}. Go to the next entry that waits.`);
    const open = openParts();
    openButton.hidden = open.length === 0;
    // A narrow view hides some of the words, so the label has each word.
    openButton.replaceChildren(h("span", { class: "thread-jump-words" }, "No topic", h("span", { class: "thread-jump-more" }, " yet"), ": "), String(open.length));
    openButton.setAttribute("aria-label", `No topic yet: ${String(open.length)}. Go to the next part with no topic.`);
    const empty = thread.document.boxes.length === 0;
    note.hidden = !empty && stage !== undefined;
    note.textContent = stage === undefined ? "This browser cannot draw the picture." : failed ? "The view cannot make the picture of this conversation." : "No messages yet.";
    tools.hidden = empty || stage === undefined;
  };

  /** This function selects a box, or no box. `tell` starts `onPick`, and `move` moves the camera to the box. */
  function show(id: string | undefined, tell: boolean, move: boolean): void {
    // A panel has no card: the page gives its content. The camera goes to the panel, and the selection stays.
    if (id !== undefined && thread.kinds.get(id) === "panel") {
      measureSlots();
      stage?.select(selected);
      bring(id);
      return;
    }
    selected = id !== undefined && thread.kinds.has(id) ? id : undefined;
    hint = undefined;
    hovered = undefined;
    routeProposals();
    stage?.select(selected);
    drawCard();
    showTip();
    // With no selection, the camera stays where it is: a change of the free area does not start the aim of the last selection.
    if (selected === undefined) stage?.setView(aimStay, false);
    setInsets();
    if (selected !== undefined && move) stage?.setView(aimOf(selected));
    stage?.refresh();
    if (tell) options.onPick?.(selected === undefined ? undefined : boxes.get(selected));
  }

  /** This function makes the picture again from a document. Each box keeps its place when the boxes are the same and `fresh` is not true. */
  const remake = (document: ThreadDocument, fresh = false): void => {
    const before = selected === undefined ? undefined : JSON.stringify(boundsOf([selected]));
    thread = pictureFor(document, shownParts(), fresh ? undefined : thread);
    boxes = new Map(thread.document.boxes.map((box) => [box.id, box]));
    content.setPicture(thread.picture);
    syncSlots();
    const gone = selected !== undefined && !thread.kinds.has(selected);
    if (gone) selected = undefined;
    hint = undefined;
    stage?.select(selected);
    drawFrame();
    drawCard();
    if (gone) stage?.setView(aimStay, false);
    setInsets();
    // The aim of the stage has the places of the old picture. A selected box with a different place gets the camera again.
    if (selected !== undefined && JSON.stringify(boundsOf([selected])) !== before) stage?.setView(aimOf(selected));
    stage?.refresh();
    // The page did not select: the view tells it that the selected box is not in the new document.
    if (gone) options.onPick?.(undefined);
  };

  proposalsInput.addEventListener("change", () => {
    proposals = proposalsInput.checked;
    // The focus of the picture depends on the lines that the looks show, so the content finds it again.
    if (!routeProposals()) content.setPicture(thread.picture);
    stage?.refresh();
  });
  stageBox.addEventListener("pointermove", (event) => {
    const box = root.getBoundingClientRect();
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    showTip();
  });
  // The key Escape closes the card from each part of the view: the picture, a tool or the card.
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || selected === undefined) return;
    // A key in the content of a panel is a key of the page: its form can close on Escape.
    if (event.target instanceof Node && slotLayer.contains(event.target)) return;
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
  // The card of a narrow view covers the bottom of the picture. Its height changes when a person opens a list in it.
  observer.observe(card);
  drawFrame();
  setInsets();
  syncSlots();
  mounted = true;

  return {
    setDocument(document) {
      const text = JSON.stringify(document);
      if (text === documentText) return;
      documentText = text;
      remake(document);
    },
    setLegend(next) {
      if (JSON.stringify(next) === JSON.stringify(legend)) return;
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
    anchorOf(id) {
      return stage === undefined ? undefined : anchorAt(id, stage.view());
    },
    reveal(id, covered) {
      // The page can put the content of a panel in its slot and show the panel in one step. The observer of the slots tells the height later.
      if (thread.kinds.get(id) === "panel") measureSlots();
      bring(id, covered);
    },
    slot(id) {
      return slots.get(id);
    },
    dispose() {
      observer.disconnect();
      slotObserver.disconnect();
      stage?.dispose();
      root.remove();
    },
  };
}
