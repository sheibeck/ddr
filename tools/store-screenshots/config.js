"use strict";
// The one place that names the export sizes, the eight scenes, the port and
// the storage keys the harness seeds. Nothing here imports repo code, and
// nothing in this folder ships in the app.
const path = require("path");

// Each size renders the shipped web build in a browser window of `css` CSS
// pixels at device scale `dpr`, so the PNG is round(css * dpr) on each side.
//
// Phone: 432 x 768 at 2.5 gives 1080 x 1920, portrait, layout class compact.
//
// Tablets are landscape so the v2.4 two-pane layout (map left, hero or Oracle
// right) shows. The CSS sizes follow real tablet widths in dp, cropped to 16:9:
//   7-inch:  960 x 540 at 2.5 gives 2400 x 1350.
//   10-inch: 1280 x 720 at 2.25 gives 2880 x 1620 (a scale of 2.25 is legal:
//            Chrome takes any positive device scale factor, and 1280 * 2.25
//            and 720 * 2.25 are whole numbers, so no pixel is resampled).
// Both are at least 840 x 480 CSS px, so src/browser/layoutClass.js picks the
// expanded class (width 840 or more and height 480 or more) for them.
const SIZES = {
  phone: {
    folder: "phone",
    label: "Phone",
    css: [432, 768],
    dpr: 2.5,
    px: [1080, 1920],
    orientation: "portrait",
    layoutClass: "compact",
  },
  tab7: {
    folder: "tablet-7in",
    label: "7-inch tablet",
    css: [960, 540],
    dpr: 2.5,
    px: [2400, 1350],
    orientation: "landscape",
    layoutClass: "expanded",
  },
  tab10: {
    folder: "tablet-10in",
    label: "10-inch tablet",
    css: [1280, 720],
    dpr: 2.25,
    px: [2880, 1620],
    orientation: "landscape",
    layoutClass: "expanded",
  },
};

// The shot list, in the order the user agreed (phase 102 CONTEXT).
const SCENES = [
  { n: 1, id: "title", file: "01-title.png", title: "Title" },
  { n: 2, id: "combat", file: "02-combat.png", title: "Combat: damage lines and ability states" },
  { n: 3, id: "deep", file: "03-deep.png", title: "A deep floor on the map" },
  { n: 4, id: "achievements", file: "04-achievements.png", title: "The Achievements list" },
  { n: 5, id: "death", file: "05-death.png", title: "Death: the epitaph and the Earned strip" },
  { n: 6, id: "hero", file: "06-hero.png", title: "The Hero tab and its flavour text" },
  { n: 7, id: "store", file: "07-store.png", title: "A store" },
  { n: 8, id: "board", file: "08-board.png", title: "The leaderboard" },
];

const PORT = 8765;
// The numeric form, as tools/layout-check.mjs uses, so the loopback bind of
// the static server and the page agree.
const ORIGIN = "http://127.0.0.1:" + PORT;

const OUT_DIR = path.resolve(__dirname, "out");
const STORE_DIR = path.resolve(__dirname, "..", "..", "store-listing", "screenshots");

// Storage keys the harness seeds. The achievements key is deliberately not
// here: seed.mjs imports it from the game and hands it over in seeds.json.
const KEYS = {
  save: "ddr.delve.v1",
  settings: "ddr.settings.v1",
  notesSeen: "ddr.notes.seen.v1",
};

// The installed Chrome, no browser download. CHROME_PATH overrides it.
function launchOptions() {
  if (process.env.CHROME_PATH) {
    return { executablePath: process.env.CHROME_PATH, headless: true };
  }
  return { channel: "chrome", headless: true };
}

module.exports = { SIZES, SCENES, PORT, ORIGIN, OUT_DIR, STORE_DIR, KEYS, launchOptions };
