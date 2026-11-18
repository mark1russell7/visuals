// The probe of the home page for the command `site-pages check`. The check runs this code in the page, at each width.
// It tests the interactive core: the list selects a record, the legend filters the records, the scrubber sets the time,
// and the pointer finds a record in the picture. Then it tests the room: its list, its legend and the marks under the pointer.
declare const check: (name: string, ok: unknown, detail?: unknown) => boolean;
declare const $: (selector: string) => HTMLElement | null;
declare const $$: (selector: string) => HTMLElement[];
declare const click: (element: Element | string) => void;
declare const until: (fn: () => unknown, ms?: number) => Promise<unknown>;
declare const wait: (ms: number) => Promise<void>;

const text = (selector: string): string => $(selector)?.textContent ?? "";
const pressed = (selector: string): string | null => $(selector)?.getAttribute("aria-pressed") ?? null;
const shown = (selector: string): boolean => {
  const element = $(selector);
  return element !== null && getComputedStyle(element).display !== "none";
};
const rows = (): number => $$("#records li").filter((item) => !item.hidden).length;
// The globe checks name their own list and legend, because the room has a list and a legend too.
const GALE = '#records .record[data-record="gale-biscay"]';
const SUMATRA = '#records .record[data-record="quake-sumatra"]';
const SAHEL = '#records .record[data-record="dust-sahel"]';
const QUAKES = '#legend .kind[data-kind="quake"]';
const WARNINGS = '#legend .kind[data-kind="warning"]';
const SELECTED = '#records .record[aria-pressed="true"]';
/** The number of frames after which the turn of a drag stopped. The stage decreases the turn that remains by 14 parts in 100 at each frame. */
const TURN_FRAMES = 45;
/** This function waits for `count` frames of the page. Thus a wait does not change with the speed of the browser. */
const frames = (count: number): Promise<void> =>
  new Promise((done) => {
    const next = (left: number): void => {
      if (left <= 0) done();
      else requestAnimationFrame(() => next(left - 1));
    };
    next(count);
  });
/** The names of the places that are in the picture. */
const names = (): HTMLElement[] => $$("#globe .visuals-label").filter((name) => !name.classList.contains("visuals-label-off"));

// The globe needs WebGL 2. A browser with no WebGL 2 gets a flat map.
const picture = await until(() => $("#globe canvas") ?? $("#globe svg.flat"), 15000);
check("the page shows the Earth as a globe or as a flat map", picture, "The picture has no canvas and no map.");
const height = (picture as Element | null)?.getBoundingClientRect().height ?? 0;
check("the picture has a height of 150 pixels or more", height >= 150, height);

check("the list has each sample record of the present", rows() === 16, rows());

// The names of the places are HTML elements above the 3D picture. The flat map has no names.
const globe = $("#globe canvas") === null ? null : $("#globe");
if (globe !== null) {
  check("the globe names the place of an earthquake", await until(() => names().length > 0, 8000), $$("#globe .visuals-label").length);
  const frame = globe.getBoundingClientRect();
  const boxes = names().map((name) => name.getBoundingClientRect());
  const out = boxes.filter((box) => box.left < frame.left - 1 || box.top < frame.top - 1 || box.right > frame.right + 1 || box.bottom > frame.bottom + 1);
  check("each name is in the picture", out.length === 0, out.map((box) => [box.left, box.top, box.right, box.bottom]));
  const crossed = boxes.filter((box, at) => boxes.some((other, to) => to > at && box.left < other.right - 1 && other.left < box.right - 1 && box.top < other.bottom - 1 && other.top < box.bottom - 1));
  check("no name is on a different name", crossed.length === 0, crossed.length);
  const texts = names().map((name) => name.textContent);
  check("a name is the place of its record", texts.every((name) => $$(".record-place").some((place) => place.textContent === name)), texts);
}
check("the legend has a button for each kind, and each kind is on", $$('#legend .kind[aria-pressed="true"]').length === 4, $$("#legend .kind").length);
check("the line of the name is empty before a selection", text("#readout") === "", text("#readout"));

click(GALE);
check("a record of the list shows its text", await until(() => pressed(GALE) === "true" && shown(`${GALE} .record-more`)), pressed(GALE));
check("the picture names the selected record", text("#readout") === "Gale warning, Bay of Biscay", text("#readout"));

click(SUMATRA);
check("a second record replaces the first record", await until(() => pressed(SUMATRA) === "true" && pressed(GALE) === "false"), [pressed(SUMATRA), pressed(GALE)]);
check("only one record is selected", $$(SELECTED).length === 1, $$(SELECTED).length);
check("the text of the first record is not in view", !shown(`${GALE} .record-more`), shown(`${GALE} .record-more`));

click(QUAKES);
check("the legend hides the records of a kind", await until(() => rows() === 10 && pressed(QUAKES) === "false"), rows());
check("a hidden record is not selected", $$(SELECTED).length === 0 && text("#readout") === "", text("#readout"));
if (globe !== null) check("the legend also hides the names of the kind", await until(() => names().length === 0), names().length);
click(QUAKES);
check("the legend shows the records of the kind again", await until(() => rows() === 16 && pressed(QUAKES) === "true"), rows());
if (globe !== null) check("the legend shows the names of the kind again", await until(() => names().length > 0), names().length);

// The time of the picture. The sample has 72 hours, so the middle of the slider is 36 hours before the present.
const slider = $("#time input[type=range]") as HTMLInputElement | null;
const time = (): string => text("#time .visuals-scrubber-time");
const label = (selector: string): string | null => $(selector)?.getAttribute("aria-label") ?? null;
const key = (name: string): void => {
  slider?.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
};
const PLAY = "#time .visuals-scrubber-play";
const SPEED = "#time .visuals-scrubber-speed";
check("the page has a control of the time, at the present", slider !== null && time() === "Now" && label(PLAY) === "Play", [time(), label(PLAY)]);

if (slider !== null) {
  slider.value = "0.5";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
}
check("the slider sets the time of the picture", await until(() => time() === "36 hours ago" && rows() === 8), [time(), rows()]);
check("the slider tells its time to a screen reader", slider?.getAttribute("aria-valuetext") === "36 hours ago", slider?.getAttribute("aria-valuetext"));
check("a record of the list has its level at that time", text(`${GALE} .record-name`) === "Gale watch", text(`${GALE} .record-name`));
check("the legend counts the records of that time", text(`${WARNINGS} .count`) === "3" && text(`${QUAKES} .count`) === "3", [text(`${WARNINGS} .count`), text(`${QUAKES} .count`)]);

key("ArrowRight");
check("an arrow key goes to the next change", await until(() => time() === "35 hours ago" && rows() === 7), [time(), rows()]);

click(SPEED);
check("the button of the speed goes to the next speed", await until(() => text(SPEED) === "2×"), text(SPEED));

// A replay at the present starts again from the start of the time. The picture has no record there.
key("End");
click(PLAY);
check("the button of the replay starts the replay from the start", await until(() => label(PLAY) === "Pause" && time() !== "Now" && rows() < 16, 8000), [label(PLAY), time(), rows()]);
click(PLAY);
check("the button stops the replay", await until(() => label(PLAY) === "Play"), label(PLAY));
const stopped = time();
await wait(300);
check("a stopped replay keeps its time", time() === stopped, [stopped, time()]);
key("End");
check("the key End goes to the present", await until(() => time() === "Now" && rows() === 16), [time(), rows()]);

const flat = $("#globe svg.flat");
if (flat !== null) {
  const shapes = [...flat.querySelectorAll<SVGElement>("[data-record]")].filter((shape) => shape.style.display !== "none").length;
  check("the flat map shows a shape for each record of the present", shapes === 16, shapes);
  check("the page tells why it shows a flat map", text("#hint").includes("WebGL 2"), text("#hint"));
}

// The pointer in the 3D picture. The picture has no elements to examine.
// So the probe sends pointer events to the canvas, and the page tells the name of the record under each one.
const canvas = $("#globe canvas");
if (canvas !== null) {
  const send = (type: string, x: number, y: number, buttons: number): void => {
    const button = type === "pointermove" ? -1 : 0;
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons }));
  };
  const center = (): readonly [number, number] => {
    const box = canvas.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  };

  // A record of the list moves the camera to its area. Then the area is at the center of the picture.
  // The second click removes the selection, and the camera continues to the area.
  click(SAHEL);
  click(SAHEL);
  const found = await until(async () => {
    await wait(100);
    const [x, y] = center();
    send("pointermove", x, y, 0);
    return text("#readout") === "Dust advisory, Western Sahel";
  }, 8000);
  check("the pointer finds the area at the center of the picture", found, text("#readout"));
  check("the list highlights the record under the pointer", $(SAHEL)?.classList.contains("is-hovered") === true, $(SAHEL)?.className);

  const [x, y] = center();
  send("pointerdown", x, y, 1);
  send("pointerup", x, y, 0);
  check("a click in the picture selects the record under the pointer", await until(() => pressed(SAHEL) === "true"), pressed(SAHEL));

  // The surface follows the pointer in a drag. So the area that was below the pointer at the start is below it at the end.
  // The drag is longer than the way from the middle of the area to its edge. Thus a turn that is too fast moves the area away from the pointer.
  const far = canvas.getBoundingClientRect().height * 0.2;
  send("pointerdown", x, y, 1);
  for (let step = 1; step <= 8; step += 1) send("pointermove", x + (far * step) / 8, y, 1);
  const cursor = canvas.style.cursor;
  send("pointerup", x + far, y, 0);
  const grabbed = canvas.style.cursor;
  // The pointer goes out of the picture, so no record is below it.
  send("pointerleave", 0, 0, 0);
  const left = $(SAHEL)?.classList.contains("is-hovered") === false;
  // The turn continues for some frames after the drag, and the area moves below the pointer during that time.
  // So the pointer comes back to the end of the drag only after the turn stopped.
  await frames(TURN_FRAMES);
  send("pointermove", x + far, y, 0);
  const followed = await until(() => $(SAHEL)?.classList.contains("is-hovered") === true, 2000);
  send("pointerleave", 0, 0, 0);
  check("the cursor shows a drag, and only during the drag", cursor === "grabbing" && grabbed !== "grabbing", [cursor, grabbed]);
  check("the area below the pointer follows the pointer in a drag", left && followed, [left, followed]);
  check("a drag keeps the selected record", pressed(SAHEL) === "true" && text("#readout") === "Dust advisory, Western Sahel", text("#readout"));

  // The area is not at the center after the drag. The name of the selected record stays in the line.
  click('#views button[data-view="atlantic"]');
  click(SAHEL);
  check("a second click on the record removes the selection", await until(() => pressed(SAHEL) === "false" && text("#readout") === ""), text("#readout"));
}

// The room. Its picture needs WebGL 2. A browser with no WebGL 2 gets the list of the marks and no picture.
const roomRows = (): number => $$("#room-records li").filter((item) => !item.hidden).length;
const OUTLET = '#room-records .record[data-record="outlet-3"]';
const OUTLETS = '#room-legend .kind[data-kind="outlet"]';
/** The names of the outlets that are in the picture of the room. */
const outletNames = (): HTMLElement[] => $$("#room .visuals-label").filter((name) => !name.classList.contains("visuals-label-off"));

const room = $("#room canvas");
check("the page shows the room, or it tells why it does not", room !== null || text("#room-hint").includes("WebGL 2"), text("#room-hint"));
check("the list of the room has each sample mark", roomRows() === 8, roomRows());
check("the legend of the room has a button for each kind, and each kind is on", $$('#room-legend .kind[aria-pressed="true"]').length === 5, $$("#room-legend .kind").length);
check("the key of the room has the shape of each level", $$("#room-levels .mark-sign").length === 4, $$("#room-levels .mark-sign").length);
check("the key of the room has the two ends of the scale of the light", text("#room-scale") === "0 lx500 lx", text("#room-scale"));
check("the line of the mark is empty before a selection", text("#room-readout") === "", text("#room-readout"));
if (room !== null) {
  const height = room.getBoundingClientRect().height;
  check("the picture of the room has a height of 150 pixels or more", height >= 150, height);
  check("the room names its outlets", await until(() => outletNames().length > 0, 8000), $$("#room .visuals-label").length);
}

click(OUTLET);
check("a mark of the list is selected", await until(() => pressed(OUTLET) === "true"), pressed(OUTLET));
check("the room names the selected mark", text("#room-readout") === "Outlet 3: 1900 W of 1440 W", text("#room-readout"));
check("a selection in the room keeps the line of the globe", text("#readout") === "", text("#readout"));

click(OUTLETS);
check("the legend of the room hides the marks of a kind", await until(() => roomRows() === 4 && pressed(OUTLETS) === "false"), roomRows());
check("a hidden mark is not selected", $$('#room-records .record[aria-pressed="true"]').length === 0 && text("#room-readout") === "", text("#room-readout"));
if (room !== null) check("the legend of the room also hides the names of the outlets", await until(() => outletNames().length === 0), outletNames().length);
click(OUTLETS);
check("the legend of the room shows the marks of the kind again", await until(() => roomRows() === 8 && pressed(OUTLETS) === "true"), roomRows());

// The pointer in the picture of the room. The probe moves the pointer across all of the picture, and the page names each record that it finds.
if (room !== null) {
  await until(() => outletNames().length > 0, 8000);
  await frames(2);
  const box = room.getBoundingClientRect();
  const found = new Set<string>();
  /** The distance between two positions of the pointer, in CSS pixels. It is less than the width of the smallest sign. */
  const STEP = 6;
  const move = (type: string, x: number, y: number): void => {
    room.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: -1, buttons: 0 }));
  };
  for (let y = box.top + STEP / 2; y < box.bottom; y += STEP) {
    for (let x = box.left + STEP / 2; x < box.right; x += STEP) {
      move("pointermove", x, y);
      found.add(text("#room-readout"));
    }
  }
  move("pointerleave", 0, 0);
  const marks = [...found].sort();
  check("the pointer finds the sign of an outlet", found.has("Outlet 3: 1900 W of 1440 W") && found.has("Outlet 1: 310 W of 1440 W"), marks);
  check("the pointer finds the sign of the outlet behind the desk", found.has("Outlet 2: 1210 W of 1440 W"), marks);
  check("the pointer finds the sign with a size", found.has("Wall lamp: 12 W"), marks);
  check("the pointer finds the cable", found.has("Cable of outlet 3: 1900 W of 1800 W"), marks);
  check("the pointer finds the light on the floor", marks.some((mark) => mark.startsWith("Light on the floor: ")), marks);
  check("the pointer finds a box of the room", found.has("Computer") && found.has("Desk"), marks);
  check("the pointer finds no link", !found.has("Feed of the computer: from outlet 2"), marks);
  check("the line of the mark is empty after the pointer goes out of the picture", text("#room-readout") === "", text("#room-readout"));
}

// The conversation. Its picture is a canvas, and the card of a box is HTML. So the probe uses the list of the topics and the card.
const CARD = "#thread .thread-card";
const WATER = '#thread-topics .kind[data-topic="water"]';
const cardBox = (): string | undefined => $(CARD)?.dataset["box"];
const partsOf = (topic: string): number => Number(text(`#thread-topics .kind[data-topic="${topic}"] .count`));

$("#thread")?.scrollIntoView();
const thread = await until(() => $("#thread canvas"), 15000);
check("the page shows the conversation", thread, "The picture has no canvas.");
const threadHeight = (thread as Element | null)?.getBoundingClientRect().height ?? 0;
check("the picture of the conversation has a height of 150 pixels or more", threadHeight >= 150, threadHeight);
// The view tells the page the layout and the first drawing of its picture. The line of the times has the two.
check("the view tells the times of its first picture", await until(() => /^The view made this picture of \d+ boxes in .+, and drew it in .+\.$/.test(text("#thread-time"))), text("#thread-time"));
check("the line of the times shows", $("#thread-time")?.hidden === false, $("#thread-time")?.hidden);
check("the list has each topic of the sample", $$("#thread-topics .kind").length === 10, $$("#thread-topics .kind").length);
check("no box is selected at the start", $$('#thread-topics .kind[aria-pressed="true"]').length === 0 && $(CARD)?.hidden === true, cardBox());

click(WATER);
check("a topic of the list is selected, and the card shows it", await until(() => pressed(WATER) === "true" && cardBox() === "water"), cardBox());
check("the card names the topic", text(`${CARD} .thread-text`) === "Water and drainage", text(`${CARD} .thread-text`));
const parts = $$(`${CARD} .thread-part`);
check("the card of a topic has each part of the topic", parts.length > 0 && parts.length === partsOf("water"), [parts.length, partsOf("water")]);

// A part of the card opens the card of the part. There, a person gives the part a different topic.
const part = parts[0];
if (part !== undefined) {
  click(part);
  check("a part of the card opens the card of the part", await until(() => cardBox() !== undefined && cardBox() !== "water"), cardBox());
  check("the list has no selected topic then", pressed(WATER) === "false", pressed(WATER));
  check("the part has one topic", $$(`${CARD} [role="radio"][aria-checked="true"]`).length === 1, $$(`${CARD} [role="radio"]`).length);
  const free = $$(`${CARD} [role="radio"][aria-checked="false"]`)[0];
  const key = free?.dataset["key"] ?? "";
  const topic = key.replace("choice:", "");
  const before = [partsOf(topic), partsOf("water")];
  if (free !== undefined) click(free);
  check("a choice gives the topic to the part", await until(() => $(`${CARD} [data-key="${key}"]`)?.getAttribute("aria-checked") === "true"), key);
  check("the part has one topic after the choice", $$(`${CARD} [role="radio"][aria-checked="true"]`).length === 1, $$(`${CARD} [role="radio"][aria-checked="true"]`).length);
  check("the list counts the part at its new topic", partsOf(topic) === (before[0] ?? 0) + 1 && partsOf("water") === (before[1] ?? 0) - 1, [topic, before, partsOf(topic), partsOf("water")]);
  click(`${CARD} .thread-close`);
  check("the button of the card closes it", await until(() => $(CARD)?.hidden === true), cardBox());
}

// One entry of the sample waits on the person of the page. A button of the view goes to it, and its card has the button of an answer.
const WAITS = "#thread .thread-waits";
const FORM = "#thread-form";
const ANSWER = `${CARD} [data-key="action:answer"]`;
check("the view counts the entries that wait on the person of the page", $(WAITS)?.hidden === false && text(WAITS) === "Waits on you: 1", text(WAITS));
check("the form of an answer is hidden at the start", $(FORM)?.hidden === true, $(FORM)?.hidden);
click(WAITS);
check("the button goes to the entry that waits", await until(() => cardBox() === "e04"), cardBox());
check("the card tells who the entry waits on", text(`${CARD} .thread-waiting`) === "Waits on you", text(`${CARD} .thread-waiting`));
check("the card has the button of an answer", $(ANSWER) !== null, $$(`${CARD} .thread-action`).length);
if ($(ANSWER) !== null) {
  const before = partsOf("trench");
  click(ANSWER);
  check("the button opens the form, and the card closes", await until(() => $(FORM)?.hidden === false && $(CARD)?.hidden === true), [$(FORM)?.hidden, cardBox()]);
  check("the form names the entry", text(`${FORM} .thread-form-title`) === "Order two cubic meters of gravel before Saturday.", text(`${FORM} .thread-form-title`));
  // A wide page has the form in a panel of the picture, next to its entry. A narrow page has the form in a sheet at the bottom.
  const wide = !matchMedia("(max-width: 44rem)").matches;
  const panel = (): HTMLElement | null => $(FORM)?.closest<HTMLElement>(".thread-slot") ?? null;
  const sheet = $(FORM)?.classList.contains("is-sheet") === true;
  check("a wide page has the form in the panel of its entry, and a narrow page has it in a sheet", wide ? panel()?.dataset["panel"] === "panel:answer:e04" && !sheet : panel() === null && sheet, [wide, panel()?.dataset["panel"], $(FORM)?.className]);
  // The camera moves to the form, so the form is in the picture. A form at the start of the page is a form with no place.
  const rects = (): [DOMRect | undefined, DOMRect | undefined] => [$("#thread")?.getBoundingClientRect(), $(FORM)?.getBoundingClientRect()];
  const inside = (): boolean => {
    const [frame, place] = rects();
    return frame !== undefined && place !== undefined && place.width > 0 && place.left >= frame.left && place.right <= frame.right + 1 && place.top >= frame.top && place.bottom <= frame.bottom + 1;
  };
  check(
    "the form is in the picture",
    await until(() => inside() && panel()?.classList.contains("is-far") !== true),
    rects().map((rect) => rect?.toJSON()),
  );
  if (wide) {
    check("the panel has the name of its action", panel()?.getAttribute("role") === "group" && panel()?.getAttribute("aria-label") === "Answer", panel()?.getAttribute("aria-label"));
    // The view makes the picture again for the height of the form. The form stays in the same element, so it keeps its focus.
    check("the field of the form keeps the focus", document.activeElement?.id === "thread-answer", document.activeElement?.id);
  }
  const field = $(`${FORM} textarea`);
  if (field instanceof HTMLTextAreaElement) field.value = "I order it on Thursday.";
  click(`${FORM} button[type="submit"]`);
  check("an answer closes the form, and no entry waits after it", await until(() => $(FORM)?.hidden === true && $(WAITS)?.hidden === true), [$(FORM)?.hidden, text(WAITS)]);
  check("the panel goes with the form", $$("#thread .thread-slot").length === 0 && $(FORM)?.closest(".thread-frame") !== null && panel() === null, [$$("#thread .thread-slot").length, $(FORM)?.parentElement?.className]);
  check("the list counts the answer at the topic of its entry", partsOf("trench") === before + 1, [before, partsOf("trench")]);
}

export {};
