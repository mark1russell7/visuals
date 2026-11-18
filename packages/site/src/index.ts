import { byId, copyText, setupTheme } from "@mark1russell7/site-pages/chrome";
import { startDemo } from "./demo.ts";
import { startRoom } from "./room.ts";

setupTheme(byId<HTMLButtonElement>("theme"), "theme");

const copy = byId<HTMLButtonElement>("copy");
copy.addEventListener("click", () => {
  void copyText(copy, byId("install").textContent ?? "");
});

startDemo({
  picture: byId("globe"),
  readout: byId("readout"),
  time: byId("time"),
  views: byId("views"),
  hint: byId("hint"),
  legend: byId("legend"),
  records: byId("records"),
});

startRoom({
  picture: byId("room"),
  readout: byId("room-readout"),
  levels: byId("room-levels"),
  scale: byId("room-scale"),
  views: byId("room-views"),
  hint: byId("room-hint"),
  legend: byId("room-legend"),
  records: byId("room-records"),
});

// The conversation has its own layout engines. The page loads them after the two stages, so the globe does not wait.
void import("./thread-demo.ts").then(({ startThread }) => {
  startThread({ picture: byId("thread"), topics: byId("thread-topics"), time: byId("thread-time"), form: byId<HTMLFormElement>("thread-form") });
});
