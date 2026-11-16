// The probe of the home page for the command `site-pages check`. The check runs this code in the page, at each width.
// It tests the interactive core: the list selects a record, the legend filters the records, the scrubber sets the time,
// and the pointer finds a record in the picture.
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
const GALE = '.record[data-record="gale-biscay"]';
const SUMATRA = '.record[data-record="quake-sumatra"]';
const SAHEL = '.record[data-record="dust-sahel"]';
const QUAKES = '.kind[data-kind="quake"]';

// The globe needs WebGL 2. A browser with no WebGL 2 gets a flat map.
const picture = await until(() => $("#globe canvas") ?? $("#globe svg.flat"), 15000);
check("the page shows the Earth as a globe or as a flat map", picture, "The picture has no canvas and no map.");
const height = (picture as Element | null)?.getBoundingClientRect().height ?? 0;
check("the picture has a height of 150 pixels or more", height >= 150, height);

check("the list has each sample record of the present", rows() === 16, rows());
check("the legend has a button for each kind, and each kind is on", $$('.kind[aria-pressed="true"]').length === 4, $$(".kind").length);
check("the line of the name is empty before a selection", text("#readout") === "", text("#readout"));

click(GALE);
check("a record of the list shows its text", await until(() => pressed(GALE) === "true" && shown(`${GALE} .record-more`)), pressed(GALE));
check("the picture names the selected record", text("#readout") === "Gale warning, Bay of Biscay", text("#readout"));

click(SUMATRA);
check("a second record replaces the first record", await until(() => pressed(SUMATRA) === "true" && pressed(GALE) === "false"), [pressed(SUMATRA), pressed(GALE)]);
check("only one record is selected", $$('.record[aria-pressed="true"]').length === 1, $$('.record[aria-pressed="true"]').length);
check("the text of the first record is not in view", !shown(`${GALE} .record-more`), shown(`${GALE} .record-more`));

click(QUAKES);
check("the legend hides the records of a kind", await until(() => rows() === 10 && pressed(QUAKES) === "false"), rows());
check("a hidden record is not selected", $$('.record[aria-pressed="true"]').length === 0 && text("#readout") === "", text("#readout"));
click(QUAKES);
check("the legend shows the records of the kind again", await until(() => rows() === 16 && pressed(QUAKES) === "true"), rows());

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
check("the legend counts the records of that time", text('.kind[data-kind="warning"] .count') === "3" && text(`${QUAKES} .count`) === "3", [text('.kind[data-kind="warning"] .count'), text(`${QUAKES} .count`)]);

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

  // The turn of a drag is in proportion to the height of the picture.
  const far = canvas.getBoundingClientRect().height * 0.3;
  send("pointerdown", x, y, 1);
  for (let step = 1; step <= 8; step += 1) send("pointermove", x + (far * step) / 8, y, 1);
  const cursor = canvas.style.cursor;
  send("pointerup", x + far, y, 0);
  send("pointerleave", 0, 0, 0);
  check("the cursor shows a drag, and only during the drag", cursor === "grabbing" && canvas.style.cursor !== "grabbing", [cursor, canvas.style.cursor]);
  check("a drag keeps the selected record", pressed(SAHEL) === "true" && text("#readout") === "Dust advisory, Western Sahel", text("#readout"));

  // The area is not at the center after the drag. The name of the selected record stays in the line.
  click('#views button[data-view="atlantic"]');
  click(SAHEL);
  check("a second click on the record removes the selection", await until(() => pressed(SAHEL) === "false" && text("#readout") === ""), text("#readout"));
}

export {};
