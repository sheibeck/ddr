#!/usr/bin/env node
// tools/layout-check.mjs
//
// Phase 97 (SCREEN-03..06): dependency-free headless-Chrome CDP layout check
// across every screen shape the game supports. It replaces the Phase 80
// letterbox check: the 480 px column it measured no longer exists.
// Node built-ins ONLY (node:http, node:fs, node:path, node:os, node:url,
// node:child_process and the global WebSocket / fetch) plus the repo's own
// modules (src/browser/layoutClass.js and the engine). No playwright, no
// puppeteer, no npm install, no --dump-dom (environment-blocked on this
// machine, STATE Phase 50). Scaffolding (static server, browser resolution,
// CdpClient, devtools-page wait, profile cleanup, launch/teardown,
// uncaught-exception capture) is copied from tools/letterbox-check.mjs and
// tools/roller-repro.mjs.
//
// Usage:
//   node tools/layout-check.mjs [--chrome <path>] [--port <n>]
//     [--devtools-port <n>] [--out <dir>] [--no-shots] [--only a,b]
//     [--json] [--keep-profile]
//   npm run layout:check
//
// Behaviour:
//   ONE headless Chrome serves the whole run. For each of thirteen PROFILES
//   (phone, 360dp phone on its side, 7" and 10" tablets both ways, a foldable
//   folded / unfolded / unfolded upright, two Chromebook windows) it sets
//   Emulation.setDeviceMetricsOverride, seeds the settings (Compete off, so
//   the page makes no network call), reloads, and walks eighteen scenes: title,
//   roller, map, map with a rail card, Settings, Hero, Gear, Oracle, the
//   leaderboards (Dead), a pending encounter, a combat round, the store, the
//   Make Camp sheet and, from Phase 100, the achievements sheet (one track
//   expanded), a real achievement card on the rail (raised through
//   window.__mzAchBanner.onEvent) and the death panel's Earned strip (a dead
//   engine state plus six unlocks). Combat, store and dead states are built in
//   node with the engine (newRun, startCombat, openStore, die) and injected
//   through window.__mzState.set + paint(). Each scene is measured in one
//   synchronous page pass and one PNG per scene is saved to the gitignored
//   output dir.
//
//   A scene fails on: horizontal overflow (the document, or any auto/scroll
//   container other than the two strips built to scroll sideways); a clipped
//   control (a button, menu row, input, link or HUD counter outside the
//   window, cut by a hidden-overflow ancestor, or below the window with no
//   scroller to reach it); a page exception; a request that leaves the
//   machine; a wrong html[data-mw-layout]; or a broken layout SHAPE for its
//   size class (app spans the window, tab bar along the bottom or in a left
//   rail, Hero centred at 640 or less in medium, a 360-560 px pane beside the
//   map in expanded, panel and docked card right of the map, the arrow pad
//   clear of a docked card, and so on). The achievements sheet adds its own
//   shape rules (the panel and its scroller inside the window, a vertical
//   scroller that never scrolls sideways, one column on compact phones, two or
//   more from 840 px, the rows in view order, icons loaded). From Phase 101
//   the check shows the VIEW IN PLAY GAMES row (and its failure line, the
//   widest the row gets) before it measures: the button must sit inside the
//   window, at least 48 px tall and above the scrolling body, which must
//   still scroll on its own and never sideways. From quick 261005-vhn the
//   achievements scene also opens the LARGE VIEW of an earned icon (the page
//   is seeded with a lifetime record holding two Depth tiers and the single
//   achievement with the longest name and line), twice: the overlay must cover
//   the sheet, show a loaded 320 px icon of at most 240 px beside its name,
//   line and "Earned" date, fit without scrolling or overflowing sideways, and
//   close on a tap with focus back on the icon button; the achievement
//   card must show a loaded icon and sit like any other docked card; the
//   Earned strip must stay bounded and clear of the death panel's buttons.
//
//   Mid-combat and mid-store the window is turned (width and height swapped,
//   no reload) and turned back: S.combat / S.store must be byte-identical
//   after each turn, the panel still up with its controls, the tab unchanged,
//   and the panel's box back where it was (SCREEN-05).
//
//   Seven boundary probes (915x479 / 915x480, 599x900 / 600x900, 839x900 /
//   840x900, 840x479) prove CSS and JS agree one step either side of every
//   threshold: html[data-mw-layout] must equal layoutClassFor(width, height).
//   At each probe the achievements sheet is also opened and measured (inside
//   the window, no overflow, no clipped control, a column count that follows
//   the window width), then closed; the probe passes only when both hold.
//
//   CDP emulation has no system bars or cutouts (every inset is 0), so this
//   proves layout and overflow, not inset clearance: insets are on the
//   device rows of the build gate.
//
// Exit codes: 0 every profile, scene and probe passed; 1 any failure or page
// exception; 2 no browser (or static server) could be started or driven (the
// reason is printed to stderr).
//
// This tool adds NOTHING to the shipped app: no permanent console trace, no
// dev Oracle line. It only reads DOM/CSS the app already exposes and injects
// engine states through hooks the app already has (window.__mzState,
// window.mzOpenAchievements, window.__mzAchBanner).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import url from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { layoutClassFor, LAYOUT_SIDE_WIDTH, LAYOUT_READABLE_MAX_PX } from "../src/browser/layoutClass.js";
import { newRun } from "../engine/state.js";
import { startCombat } from "../engine/combat.js";
import { applyAction } from "../engine/engine.js";
import { openStore } from "../engine/economy.js";
import { ACHIEVEMENTS_SHEET_COPY, tracksOf } from "../src/browser/achievementsSheet.js";
import { ACHIEVEMENTS } from "../content/achievements.js";
import { die } from "../engine/death.js";
import { makeRng } from "../engine/rng.js";
import { PATCH_NOTES } from "../src/browser/patchNotesData.js";
import { buildAchievementsView } from "../src/browser/achievementsSheet.js";
import { emptyRecord, serializeRecord, ACHIEVEMENTS_KEY } from "../src/browser/achievementRecord.js";

// Quick 261005-vhn: the lifetime record the page boots with, so the achievements
// sheet has earned icons to open large: two Depth tiers (a track head and a
// rung) and the single achievement whose name plus line is longest (the worst
// case for the overlay's text).
const SINGLE_IDS = new Set(tracksOf().filter((t) => t.entries.length === 1).map((t) => t.entries[0].id));
const WORST_SINGLE = ACHIEVEMENTS.filter((e) => SINGLE_IDS.has(e.id)).sort(
  (a, b) => b.name.length + b.line.length - (a.name.length + a.line.length) || (a.id < b.id ? -1 : 1),
)[0];
const SEED_RECORD = (() => {
  const rec = JSON.parse(serializeRecord(emptyRecord()));
  rec.unlocked = { depth_t1: Date.UTC(2026, 9, 1, 12), depth_t2: Date.UTC(2026, 9, 2, 12), [WORST_SINGLE.id]: Date.UTC(2026, 9, 3, 12) };
  return JSON.stringify(rec);
})();

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const DEFAULT_CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const TOL_PX = 1;

// How long a cold page boot may take before a run fails. 45 s by default;
// LAYOUT_CHECK_BOOT_MS raises it for a slow machine (a reload re-fetches the
// ~180 modules, and on a loaded box that has taken over a minute).
const BOOT_WAIT_MS = Number(process.env.LAYOUT_CHECK_BOOT_MS) > 0 ? Number(process.env.LAYOUT_CHECK_BOOT_MS) : 45000;

// ---------------------------------------------------------------------------
// Profiles and probes (exported; pinned by test/unit/layout-check.test.js)
// ---------------------------------------------------------------------------

function profile(name, width, height, expect, mobile = true) {
  return Object.freeze({ name, width, height, mobile, expect });
}

export const PROFILES = Object.freeze([
  profile("phone-portrait", 412, 915, "compact"),
  profile("phone-landscape", 915, 412, "short"),
  profile("phone-landscape-360", 800, 360, "short"),
  profile("tablet7-portrait", 600, 960, "medium"),
  profile("tablet7-landscape", 960, 600, "expanded"),
  // Quick 261006-1js: the same 7" tablet on its side with the system bars taking 60 px (a 960 x 540 CSS window).
  profile("tablet7-landscape-short", 960, 540, "expanded"),
  profile("tablet10-portrait", 800, 1280, "medium"),
  profile("tablet10-landscape", 1280, 800, "expanded"),
  profile("foldable-folded", 411, 797, "compact"),
  profile("foldable-unfolded", 841, 701, "expanded"),
  profile("foldable-unfolded-portrait", 701, 841, "medium"),
  profile("chromebook-window", 1366, 768, "expanded", false),
  profile("chromebook-half", 683, 768, "medium", false),
]);

function probe(width, height, expect) {
  return Object.freeze({ name: `${width}x${height}`, width, height, expect });
}

export const BOUNDARY_PROBES = Object.freeze([
  probe(915, 479, "short"),
  probe(915, 480, "expanded"),
  probe(599, 900, "compact"),
  probe(600, 900, "medium"),
  probe(839, 900, "medium"),
  probe(840, 900, "expanded"),
  probe(840, 479, "short"),
]);

export const SCENES = Object.freeze([
  "title",
  "roller",
  "map",
  "map-card",
  "settings",
  "hero",
  "gear",
  "oracle",
  "dead",
  "encounter",
  "combat",
  "combat-turn",
  "store",
  "store-turn",
  "camp",
  "achievements",
  "achievement-card",
  "death-earned",
]);

/**
 * rectsIntersect(a, b): true only when the overlap width AND height are both
 * at least 0.5 px (a 0.5 px overlap counts; 0 and anything below does not).
 * Touching edges and sub-pixel rounding are no overlap.
 */
export function rectsIntersect(a, b) {
  if (!a || !b) return false;
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w >= 0.5 && h >= 0.5;
}

// ---------------------------------------------------------------------------
// Scaffolding (copied from letterbox-check.mjs / roller-repro.mjs)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    port: 8768,
    devtoolsPort: 9249,
    out: null,
    shots: true,
    only: null,
    json: false,
    keepProfile: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chrome") args.chrome = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--devtools-port") args.devtoolsPort = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--no-shots") args.shots = false;
    else if (a === "--only") args.only = String(argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--json") args.json = true;
    else if (a === "--keep-profile") args.keepProfile = true;
  }
  return args;
}

function resolveBrowser(args) {
  if (args.chrome) {
    if (fs.existsSync(args.chrome)) return args.chrome;
    console.error(`ERROR: --chrome path does not exist: ${args.chrome}`);
    return null;
  }
  if (process.env.CHROME) {
    if (fs.existsSync(process.env.CHROME)) return process.env.CHROME;
    console.error(`ERROR: $CHROME path does not exist: ${process.env.CHROME}`);
    return null;
  }
  for (const p of DEFAULT_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  console.error(
    "ERROR: no Chrome/Edge binary found. Pass --chrome <path> (or set $CHROME) to point at your local install."
  );
  return null;
}

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/mazeworld.html";
    const f = path.join(root, p);
    fs.readFile(f, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[path.extname(f)] || "application/octet-stream",
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A tiny Chrome DevTools Protocol client over Node 22's built-in WebSocket.
// Besides uncaught page exceptions it records every network request the page
// starts, so a request leaving the machine fails the run.
class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    this.requests = [];
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || "CDP error"));
        else resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params?.exceptionDetails;
        const text = d?.exception?.description || d?.exception?.value || d?.text || "unknown exception";
        this.exceptions.push(String(text).split("\n")[0]);
      } else if (msg.method === "Network.requestWillBeSent") {
        this.requests.push(String(msg.params?.request?.url || ""));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error(d.exception?.description?.split("\n")[0] || d.text || "evaluate exception");
    }
    return result.result?.value;
  }
}

// Swallows transient evaluate() errors: a reload destroys the execution
// context momentarily, and a poll landing in that window would otherwise
// abort the run instead of retrying on the next tick.
async function waitForStable(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    let value = null;
    try {
      value = await cdp.evaluate(expression);
    } catch {
      value = null;
    }
    if (value) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout waiting for ${label}`);
    }
    await sleep(100);
  }
}

async function waitForDevtoolsPage(devtoolsPort, pageUrl, timeoutMs) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`);
      const list = await res.json();
      const entry = list.find((e) => e.type === "page" && e.url && e.url.startsWith(pageUrl));
      if (entry) return entry;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout waiting for devtools page at port ${devtoolsPort}`);
    }
    await sleep(200);
  }
}

// Kill every chrome.exe process whose command line references this run's
// --user-data-dir profile directory (PID-based taskkill is unreliable on this
// machine; see roller-repro.mjs).
function killByProfileDir(profileDir) {
  if (process.platform !== "win32") return;
  try {
    spawnSync(
      "wmic",
      ["process", "where", `CommandLine like "%${profileDir}%"`, "call", "terminate"],
      { windowsHide: true }
    );
  } catch {
    /* ignore */
  }
}

async function launchAndConnect({ chromePath, pageUrl, devtoolsPort, keepProfile }) {
  // Forward slashes only: a Windows-style backslash path breaks
  // killByProfileDir's WMI LIKE match (backslash is WQL's LIKE-escape).
  const profileDir = fs.mkdtempSync(`${os.tmpdir().replace(/\\/g, "/")}/mz-layout-`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${devtoolsPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${profileDir}`,
    "--window-size=1400,1400",
    pageUrl,
  ];
  const child = spawn(chromePath, args, { windowsHide: true, stdio: "ignore" });
  void child;

  async function cleanup() {
    killByProfileDir(profileDir);
    await sleep(400); // let the process family fully exit before rmSync
    if (!keepProfile) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch {
        /* ignore: a lingering crashpad handle is not this tool's concern */
      }
    }
  }

  let entry;
  try {
    entry = await waitForDevtoolsPage(devtoolsPort, pageUrl, 15000);
  } catch (err) {
    await cleanup();
    throw err;
  }

  const ws = new WebSocket(entry.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CdpClient(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  async function teardown() {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    await cleanup();
  }

  return { cdp, teardown };
}

// ---------------------------------------------------------------------------
// Page-side code. These are real functions, serialised with toString() into
// Runtime.evaluate, so they are syntax-checked with the rest of the file and
// must reference nothing from node.
// ---------------------------------------------------------------------------

// One synchronous pass. Returns by value.
function measurePage() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const vis = (el) => {
    if (!el) return false;
    let v = false;
    try {
      v = el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    } catch {
      v = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
    if (!v) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      width: r.width, height: r.height, visible: vis(el),
    };
  };
  const q = (sel) => document.querySelector(sel);
  const label = (el) =>
    el.id ? "#" + el.id : el.classList && el.classList.length ? "." + el.classList[0] : el.tagName.toLowerCase();
  const num = (v) => Math.round(v * 10) / 10;

  const rects = {
    app: box(q("#app")),
    hud: box(q("#mw-hud")),
    tabbar: box(q("#mw-tabbar")),
    stage: box(q("#mw-stage")),
    screens: box(q("#mw-screens")),
    viewport: box(q("#mw-maze-viewport")),
    pad: box(q("#mw-arrow-pad")),
    rail: box(q("#mw-rail")),
    enc: box(q("#enc-panel")),
    hero: box(q("#screen-hero")),
    sprite: box(q("#mw-party-sprite")),
    campPanel: box(q("#mw-camp-sheet .mw-legend-panel")),
  };
  // The usable span of #mw-screens: a desktop window (a Chromebook) shows a
  // classic scrollbar that is inside its box but not part of its content.
  const screensEl = q("#mw-screens");
  const screensInner = screensEl
    ? (() => {
        const sr = screensEl.getBoundingClientRect();
        return { left: sr.left + screensEl.clientLeft, right: sr.left + screensEl.clientLeft + screensEl.clientWidth };
      })()
    : null;
  const stageEl = q("#mw-stage");
  const stagePadRight = stageEl ? parseFloat(getComputedStyle(stageEl).paddingRight) || 0 : 0;

  const STRIPS = ".mw-cond-strip, .cb-lot-strip";
  const SKIP_CLIP = "#mw-maze-viewport, " + STRIPS;
  const all = Array.from(document.querySelectorAll("body, body *"));

  // HSCROLL: a visible auto/scroll container whose content is wider than it.
  const hscroll = [];
  const vscrollers = [];
  for (const el of all) {
    if (el.closest(STRIPS)) continue;
    const cs = getComputedStyle(el);
    const ox = cs.overflowX;
    const oy = cs.overflowY;
    const xs = ox === "auto" || ox === "scroll";
    const ys = oy === "auto" || oy === "scroll";
    if (!xs && !ys) continue;
    if (!vis(el)) continue;
    if (xs && el.scrollWidth > el.clientWidth + 1) {
      hscroll.push(label(el) + " scrollWidth " + el.scrollWidth + " > clientWidth " + el.clientWidth);
    }
    if (ys && el !== document.body && el !== document.documentElement) {
      const r = el.getBoundingClientRect();
      // Quick 261006-1js: a scroller inside a panel that itself scrolls (the death panel's Earned list)
      // may sit below the fold until that panel scrolls; the panel's own box is checked on its own turn.
      let host = el.parentElement;
      let inScrolledHost = false;
      while (host && host !== document.body && host !== document.documentElement) {
        const hy = getComputedStyle(host).overflowY;
        if ((hy === "auto" || hy === "scroll") && host.scrollHeight > host.clientHeight + 1) { inScrolledHost = true; break; }
        host = host.parentElement;
      }
      if (inScrolledHost && r.left >= -1 && r.right <= W + 1) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) {
        vscrollers.push(
          label(el) + " box [" + num(r.left) + "," + num(r.top) + "," + num(r.right) + "," + num(r.bottom) + "] leaves the " + W + "x" + H + " window"
        );
      }
    }
  }
  const docOverflow = document.documentElement.scrollWidth > W + 1
    ? "document scrollWidth " + document.documentElement.scrollWidth + " > window " + W
    : null;

  // CLIPPED: a visible control that cannot be reached or seen.
  const clipped = [];
  const controls = document.querySelectorAll(
    'button, [role="menuitem"], input, select, textarea, a[href], .mw-hud-item'
  );
  for (const el of controls) {
    if (el.closest(SKIP_CLIP)) continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const why = [];
    if (r.left < -1 || r.right > W + 1) {
      why.push("outside the window horizontally [" + num(r.left) + "," + num(r.right) + "] of " + W);
    }
    let scroller = false;
    // Once a scroller sits between the control and an outer hidden-overflow
    // ancestor the control is reachable by scrolling: from there up it is the
    // scroller's own box that must stay inside the ancestor.
    let sx = r;
    let sy = r;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      const hx = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const hy = cs.overflowY === "hidden" || cs.overflowY === "clip";
      if (hx && (sx.right > ar.right + 1 || sx.left < ar.left - 1)) {
        why.push("cut by " + label(a) + " horizontally (box [" + num(sx.left) + "," + num(sx.right) + "], ancestor [" + num(ar.left) + "," + num(ar.right) + "])");
      }
      if (hy && (sy.bottom > ar.bottom + 1 || sy.top < ar.top - 1)) {
        why.push("cut by " + label(a) + " vertically (box [" + num(sy.top) + "," + num(sy.bottom) + "], ancestor [" + num(ar.top) + "," + num(ar.bottom) + "])");
      }
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
        scroller = true;
        sy = ar;
      }
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") sx = ar;
    }
    if (!scroller && (r.top < -1 || r.bottom > H + 1)) {
      why.push("outside the window vertically [" + num(r.top) + "," + num(r.bottom) + "] of " + H + " with no scroller");
    }
    if (why.length) clipped.push(label(el) + ": " + why.join("; "));
  }

  const cbButtons = Array.from(document.querySelectorAll("#cb-act button"))
    .filter(vis)
    .map((b) => {
      const r = b.getBoundingClientRect();
      return { id: label(b), top: r.top, bottom: r.bottom };
    });
  const activeTab = q(".mw-tab.active");
  const screenRow = q("#mw-screen-row");
  return {
    innerWidth: W,
    innerHeight: H,
    layout: document.documentElement.dataset.mwLayout || null,
    rects,
    stagePadRight,
    screensInner,
    docOverflow,
    hscroll,
    vscrollers,
    clipped,
    cbButtons,
    tab: activeTab ? activeTab.dataset.tab || null : null,
    railShown: q("#mw-rail") ? q("#mw-rail").dataset.shown || null : null,
    screenRowVisible: vis(screenRow),
    cbActPresent: !!q("#cb-act"),
    leaveVisible: vis(q("#a-leave")),
  };
}

const MEASURE = `(${measurePage.toString()})()`;

// Phase 100: the achievements sheet, measured in one synchronous pass (page
// side, like measurePage: no node references).
function measureSheet() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const q = (sel) => document.querySelector(sel);
  const vis = (el) => {
    if (!el) return false;
    let v = false;
    try {
      v = el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    } catch {
      v = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
    if (!v) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const sheet = q("#mw-achievements-sheet");
  const panel = q("#mw-achievements-sheet .mw-legend-panel");
  const body = q("#mw-achievements-body");
  const list = body ? body.querySelector(".mw-ach-list") : null;
  let cols = 0;
  let gap = 0;
  let listWidth = 0;
  if (list) {
    const cs = getComputedStyle(list);
    cols = cs.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    gap = parseFloat(cs.columnGap) || 0;
    listWidth = list.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  }
  const bodyCs = body ? getComputedStyle(body) : null;
  const firstBlock = body ? body.querySelector(".mw-ach-block") : null;
  const keys = firstBlock
    ? Array.from(firstBlock.querySelectorAll(".mw-ach-row")).map((li) => li.getAttribute("data-key"))
    : [];
  const playBtn = q("#mw-achievements-play-btn");
  const playNote = q("#mw-achievements-play-note");
  const head = body ? body.querySelector("button.mw-ach-head") : null;
  let expanded = null;
  if (head) {
    const next = head.nextElementSibling;
    expanded = {
      ariaExpanded: head.getAttribute("aria-expanded"),
      rungsAfter: !!(next && next.tagName === "UL" && next.classList.contains("mw-ach-rungs")),
      rungCount: next && next.tagName === "UL" ? next.querySelectorAll("li").length : 0,
    };
  }
  const bb = body ? body.getBoundingClientRect() : null;
  let iconsInView = 0;
  const iconsNotLoaded = [];
  if (body && bb) {
    for (const img of body.querySelectorAll("img.mw-ach-icon")) {
      const r = img.getBoundingClientRect();
      if (r.bottom <= bb.top || r.top >= bb.bottom || r.width <= 0) continue;
      iconsInView++;
      if (!(img.complete && img.naturalWidth > 0)) iconsNotLoaded.push(img.getAttribute("src"));
    }
  }
  return {
    innerWidth: W,
    innerHeight: H,
    layout: document.documentElement.dataset.mwLayout || null,
    sheetVisible: vis(sheet),
    panel: box(panel),
    body: box(body),
    playBtn: box(playBtn),
    playBtnVisible: vis(playBtn),
    playBtnText: playBtn ? playBtn.textContent : null,
    playNote: box(playNote),
    playNoteVisible: vis(playNote),
    bodyOverflowY: bodyCs ? bodyCs.overflowY : null,
    bodyScrollHeight: body ? body.scrollHeight : 0,
    bodyClientHeight: body ? body.clientHeight : 0,
    bodyScrollWidth: body ? body.scrollWidth : 0,
    bodyClientWidth: body ? body.clientWidth : 0,
    cols,
    gap,
    listWidth,
    keys,
    expanded,
    iconsInView,
    iconsNotLoaded,
  };
}

const MEASURE_SHEET = `(${measureSheet.toString()})()`;

// Quick 261005-vhn: the open large view, measured in one synchronous page pass.
function measureLarge() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const q = (sel) => document.querySelector(sel);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const overlay = q("#mw-achievements-large");
  const img = q("#mw-ach-large-img");
  const shown = !!overlay && !overlay.hidden && overlay.getClientRects().length > 0;
  return {
    innerWidth: W,
    innerHeight: H,
    shown,
    overlay: box(overlay),
    sheet: box(q("#mw-achievements-sheet")),
    art: box(img),
    imgLoaded: !!img && img.complete && img.naturalWidth > 0,
    imgNaturalWidth: img ? img.naturalWidth : 0,
    imgSrc: img ? img.getAttribute("src") : null,
    name: q("#mw-ach-large-name") ? q("#mw-ach-large-name").textContent : "",
    line: q("#mw-ach-large-line") ? q("#mw-ach-large-line").textContent : "",
    date: q("#mw-ach-large-date") ? q("#mw-ach-large-date").textContent : "",
    nameBox: box(q("#mw-ach-large-name")),
    lineBox: box(q("#mw-ach-large-line")),
    dateBox: box(q("#mw-ach-large-date")),
    scrollHeight: overlay ? overlay.scrollHeight : 0,
    clientHeight: overlay ? overlay.clientHeight : 0,
    scrollWidth: overlay ? overlay.scrollWidth : 0,
    clientWidth: overlay ? overlay.clientWidth : 0,
    focusOnOverlay: !!overlay && document.activeElement === overlay,
  };
}

const MEASURE_LARGE = `(${measureLarge.toString()})()`;

// Phase 100: the achievement card on the rail.
function measureCard() {
  const rail = document.querySelector("#mw-rail");
  const img = document.querySelector("#mw-rail-icon img");
  const title = document.querySelector("#mw-rail-title");
  const lines = document.querySelector("#mw-rail-lines");
  return {
    kind: rail ? rail.dataset.cardKind || null : null,
    hasImg: !!img,
    imgLoaded: !!(img && img.complete && img.naturalWidth > 0),
    imgNaturalWidth: img ? img.naturalWidth : 0,
    title: title ? title.textContent.trim() : null,
    railScrollHeight: rail ? rail.scrollHeight : 0,
    railClientHeight: rail ? rail.clientHeight : 0,
    linesScrollHeight: lines ? lines.scrollHeight : 0,
    linesClientHeight: lines ? lines.clientHeight : 0,
  };
}

const MEASURE_CARD = `(${measureCard.toString()})()`;

// Phase 100: the death panel's Earned strip against the window and the buttons.
function measureEarned() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const vis = (el) => {
    if (!el) return false;
    let v = false;
    try {
      v = el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    } catch {
      v = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
    if (!v) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const strip = document.querySelector("#cb-over-earned");
  const list = strip ? strip.querySelector(".cb-over-earned-list") : null;
  const hint = document.querySelector("#cb-over-hint");
  // Quick 261006-1js: the epitaph block (.cb-over-lines inside #cb-mid) and the scroller that carries the whole panel.
  const mid = document.querySelector("#cb-mid");
  const lines = document.querySelector("#cb-mid .cb-over-lines");
  const epi = document.querySelector("#cb-mid .cb-epitaph");
  const body = document.querySelector("#enc-body");
  const bodyRect = body ? rect(body) : null;
  const scrollTopNow = body ? body.scrollTop : 0;
  const lastBtn = document.querySelector("#cb-over .cb-over-actions button:last-child");
  const buttons = Array.from(document.querySelectorAll("#cb-over .cb-over-actions button")).map((b) => ({
    id: b.id || b.className,
    visible: vis(b),
    box: rect(b),
  }));
  return {
    innerWidth: W,
    innerHeight: H,
    stripVisible: vis(strip),
    strip: strip ? rect(strip) : null,
    items: strip ? strip.querySelectorAll(".cb-over-earned-item").length : 0,
    listMaxHeight: list ? getComputedStyle(list).maxHeight : null,
    listOverflowY: list ? getComputedStyle(list).overflowY : null,
    hintVisible: vis(hint),
    hint: hint ? rect(hint) : null,
    hintText: hint ? hint.textContent : "",
    epitaph: {
      midHeight: mid ? mid.getBoundingClientRect().height : 0,
      linesHeight: lines ? lines.getBoundingClientRect().height : 0,
      lineCount: lines ? lines.querySelectorAll("p").length : 0,
      epitaphHeight: epi ? epi.getBoundingClientRect().height : 0,
      epitaphText: epi ? epi.textContent : "",
      epitaphVisible: vis(epi),
      // The epitaph's bottom in the scrolled content (viewport top + scroll offset), against the content height.
      epitaphBottomInContent: epi && bodyRect ? epi.getBoundingClientRect().bottom - bodyRect.top + scrollTopNow : 0,
      bodyScrollHeight: body ? body.scrollHeight : 0,
      bodyClientHeight: body ? body.clientHeight : 0,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : null,
      midOverflowY: mid ? getComputedStyle(mid).overflowY : null,
      lastButtonBottomInContent: lastBtn && bodyRect ? lastBtn.getBoundingClientRect().bottom - bodyRect.top + scrollTopNow : 0,
    },
    hintScrollHeight: hint ? hint.scrollHeight : 0,
    hintClientHeight: hint ? hint.clientHeight : 0,
    buttons,
  };
}

const MEASURE_EARNED = `(${measureEarned.toString()})()`;

function visibleExpr(sel) {
  return `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; let v = false; try { v = e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); } catch { v = !!e.offsetWidth; } return !!(v && e.getBoundingClientRect().width > 0); })()`;
}

const EXPR = {
  titleReady: `(() => {
    if (window.__mzLC) return false;
    const enter = document.getElementById("mw-title-enter");
    const screen = document.getElementById("mw-title-screen");
    return !!(enter && !enter.disabled && screen && !screen.hidden);
  })()`,
  rollerReady: `(() => {
    const cta = document.getElementById("mw-roller-cta");
    return !!(cta && !cta.disabled && cta.classList.contains("mw-roller-ready"));
  })()`,
  clickSel: (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`,
  hiddenBoth: `(() => {
    const a = document.getElementById("mw-roller-screen");
    const b = document.getElementById("mw-title-screen");
    return !!(a && a.hidden && b && b.hidden);
  })()`,
  // The settings turn Compete off (no board, identity or feed call) and the
  // notes key is the bundled version, so the what's-new sheet stays shut.
  seed: `(() => { localStorage.clear(); localStorage.setItem("ddr.settings.v1", JSON.stringify({ compete: false, movement: "arrows", padSide: "right", nameWelcomed: true, sound: false })); localStorage.setItem("ddr.notes.seen.v1", ${JSON.stringify(String(PATCH_NOTES.version))}); localStorage.setItem(${JSON.stringify(ACHIEVEMENTS_KEY)}, ${JSON.stringify(SEED_RECORD)}); window.__mzLC = 1; return true; })()`,
  inject: (json) => `(() => { window.__mzState.set(JSON.parse(${JSON.stringify(json)})); window.paint(); if (window.mzCenterMap) window.mzCenterMap(); window.__mzRail = Object.assign({}, window.__mzRail, { card: null, pending: null }); window.renderRail(); return true; })()`,
  showTab: (name) => `(() => { window.__mzShowTab(${JSON.stringify(name)}); return true; })()`,
  railCard: `(() => { window.mzRailLine("LAYOUT CHECK", "A card for the side panel.", "info", 60000); return true; })()`,
  railClear: `(() => { window.__mzRail = Object.assign({}, window.__mzRail, { card: null, pending: null }); window.renderRail(); return true; })()`,
  subject: (key) => `(() => { const s = window.__mzState.get(); return JSON.stringify(s && s.${key}); })()`,
  settle: `new Promise((resolve) => { let done = false; const fin = () => { if (!done) { done = true; resolve(true); } }; setTimeout(fin, 1500); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fin, 350))); })`,
  settleShort: `new Promise((resolve) => { let done = false; const fin = () => { if (!done) { done = true; resolve(true); } }; setTimeout(fin, 1500); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fin, 60))); })`,
  layoutNow: `document.documentElement.dataset.mwLayout || null`,
  // Phase 100: the app's own names only (window.mzOpenAchievements,
  // window.__mzAchBanner); nothing here exists for the check's sake.
  openSheet: `(() => { if (!window.mzOpenAchievements) return false; window.mzOpenAchievements(); return true; })()`,
  // Phase 101: the VIEW IN PLAY GAMES row, shown with its failure line (the
  // widest the row gets) and hidden again; the app's own ids and copy only.
  showPlayRow: `(() => { const row = document.querySelector("#mw-achievements-play"); if (!row) return false; row.hidden = false; const note = document.querySelector("#mw-achievements-play-note"); if (note) { note.textContent = ${JSON.stringify(ACHIEVEMENTS_SHEET_COPY.play.failed)}; note.hidden = false; } return true; })()`,
  hidePlayRow: `(() => { const row = document.querySelector("#mw-achievements-play"); if (!row) return false; row.hidden = true; const note = document.querySelector("#mw-achievements-play-note"); if (note) { note.textContent = ""; note.hidden = true; } return true; })()`,
  // Quick 261005-vhn: the large view, through the app's own buttons and overlay.
  clickLargeLabel: (label) => `(() => { const b = Array.from(document.querySelectorAll("#mw-achievements-body .mw-ach-large-open")).find((x) => x.getAttribute("aria-label") === ${JSON.stringify(label)}); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; })()`,
  tapLarge: `(() => { const o = document.querySelector("#mw-achievements-large"); if (!o) return false; o.click(); return true; })()`,
  activeLabel: `(() => { const a = document.activeElement; return a && a.getAttribute ? a.getAttribute("aria-label") : null; })()`,
  expandFirstTrack: `(() => { const b = document.querySelector("#mw-achievements-body button.mw-ach-head"); if (!b) return false; if (b.getAttribute("aria-expanded") !== "true") b.click(); return true; })()`,
  achUnlock: `(() => { window.__mzAchBanner.onEvent({ unlocks: [{ id: "depth_t1", at: 1 }], reveals: [], progress: [] }); return true; })()`,
  deathUnlocks: `(() => { window.__mzAchBanner.onEvent({ unlocks: ${JSON.stringify(["depth_t1", "depth_t2", "kills_beasts_t1", "party_animal_t1", "unicorn", "tourist"].map((id, i) => ({ id, at: 1 + i })))}, reveals: ["special_snowflake"], progress: [] }); window.paint(); return true; })()`,
  clearStrip: `(() => { window.__mzAchBanner.clearStrip(); return true; })()`,
};

// ---------------------------------------------------------------------------
// Engine states, built once in node
// ---------------------------------------------------------------------------

function buildStates() {
  // A Knight turns away foes under 5 WP and a Con Artist or Court Mage can
  // too, so a floor-1 "Beasts" fight can clear itself before it starts. Take
  // the first Fighter seed from 7 up whose fight really begins: the search is
  // deterministic and the engine is only called through its exports.
  let base = null;
  let combat = null;
  for (let seed = 7; seed < 60 && !combat; seed++) {
    const candidate = newRun(seed, [], { force: { cls: "Fighter" } });
    const attempt = structuredClone(candidate);
    startCombat(attempt, false, "Beasts", makeRng(42), []);
    if (attempt.combat) {
      base = candidate;
      combat = attempt;
    }
  }
  if (!combat) throw new Error("layout-check: no Fighter seed in 7..59 starts a Beasts fight");
  // The joined fight (the pending encounter's FIGHT step already taken, in
  // node: the page's own adapter holds a different run, so clicking through
  // the live page would not advance the injected state).
  const round = applyAction(structuredClone(combat), { type: "fight" }).state;
  if (!round.combat) throw new Error("layout-check: the injected fight ended on its FIGHT step");
  const store = structuredClone(base);
  openStore(store, makeRng(5), []);
  // The dead state (the dead-lockdown recipe): a real run taken through
  // engine/death.js#die, so the death panel is the real one.
  const dead = structuredClone(base);
  dead.c.wp = dead.c.maxWP;
  die(dead, "combat", "a rat", makeRng(4), [], () => 1);
  if (dead.dead !== true) throw new Error("layout-check: die() left the injected run alive");
  return {
    base: JSON.stringify(base),
    combat: JSON.stringify(combat),
    round: JSON.stringify(round),
    store: JSON.stringify(store),
    dead: JSON.stringify(dead),
  };
}

// ---------------------------------------------------------------------------
// Driver helpers
// ---------------------------------------------------------------------------

async function setMetrics(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
}

async function settle(cdp) {
  await cdp.evaluate(EXPR.settle);
}

async function shot(cdp, ctx, name) {
  if (!ctx.outDir) return;
  const data = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ctx.outDir, `${ctx.profile.name}-${name}.png`), Buffer.from(data.data, "base64"));
}

const near = (a, b, tol = TOL_PX) => Math.abs(a - b) <= tol;
const f1 = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : n);

// Generic failures: overflow, clipping.
function genericFailures(m) {
  const out = [];
  if (m.docOverflow) out.push(`horizontal overflow: ${m.docOverflow}`);
  for (const s of m.hscroll) out.push(`horizontal overflow: ${s}`);
  for (const s of m.clipped) out.push(`clipped control ${s}`);
  for (const s of m.vscrollers) out.push(`scroller out of window: ${s}`);
  return out;
}

// Shape checks per class and scene (D-Area2 / D-Area3 and the CONTEXT sketches).
function shapeFailures(cls, scene, m) {
  const out = [];
  const r = m.rects;
  const W = m.innerWidth;
  const H = m.innerHeight;
  if (m.layout !== cls) out.push(`html[data-mw-layout] is "${m.layout}", expected "${cls}"`);
  if (r.app && r.app.visible) {
    if (!near(r.app.left, 0) || !near(r.app.width, W)) {
      out.push(`#app left ${f1(r.app.left)} width ${f1(r.app.width)}, expected left 0 width ${W} (no letterbox, no stretched column)`);
    }
  }
  const side = cls === "short" || cls === "expanded";
  const onTabbarScene = scene === "map" || scene === "hero";
  if (onTabbarScene) {
    if (!r.tabbar || !r.tabbar.visible) {
      out.push("#mw-tabbar not visible");
    } else if (side) {
      if (!near(r.tabbar.left, 0)) out.push(`#mw-tabbar left ${f1(r.tabbar.left)}, expected a left rail at 0`);
      if (!(r.tabbar.height > r.tabbar.width)) out.push(`#mw-tabbar ${f1(r.tabbar.width)}x${f1(r.tabbar.height)} is not a vertical rail`);
    } else {
      if (!near(r.tabbar.bottom, H)) out.push(`#mw-tabbar bottom ${f1(r.tabbar.bottom)}, expected the window bottom ${H}`);
      if (!near(r.tabbar.width, W)) out.push(`#mw-tabbar width ${f1(r.tabbar.width)}, expected the window width ${W}`);
    }
  }
  if (cls === "medium" && scene === "hero" && r.hero && r.hero.visible && r.screens) {
    if (r.hero.width > LAYOUT_READABLE_MAX_PX + 1) out.push(`#screen-hero width ${f1(r.hero.width)} exceeds ${LAYOUT_READABLE_MAX_PX}`);
    const inner = m.screensInner || { left: r.screens.left, right: r.screens.right };
    const gl = r.hero.left - inner.left;
    const gr = inner.right - r.hero.right;
    if (Math.abs(gl - gr) > 2) out.push(`#screen-hero not centred in #mw-screens (left gap ${f1(gl)}, right gap ${f1(gr)})`);
  }
  if (cls === "short" && scene === "map" && r.hud && r.hud.height > 72) {
    out.push(`#mw-hud is ${f1(r.hud.height)} px tall in a short window, expected one row (72 or less)`);
  }
  if (side && scene === "map" && r.viewport && r.viewport.visible && r.stage) {
    const edge = r.stage.right - m.stagePadRight;
    if (!near(r.viewport.right, edge)) {
      out.push(`#mw-maze-viewport right ${f1(r.viewport.right)} does not reach the stage edge ${f1(edge)} with nothing up`);
    }
  }
  if (side && (scene === "map-card" || scene === "achievement-card")) {
    if (!r.rail || !r.rail.visible) {
      out.push("#mw-rail card not visible");
    } else {
      if (r.viewport && r.rail.left < r.viewport.right - 1) {
        out.push(`#mw-rail left ${f1(r.rail.left)} is left of the map's right edge ${f1(r.viewport.right)} (card must sit beside the map)`);
      }
      if (r.pad && r.pad.visible && rectsIntersect(r.pad, r.rail)) {
        out.push("the arrow pad and the docked rail card overlap");
      }
    }
  }
  if (cls === "expanded" && scene === "hero") {
    if (!r.viewport || !r.viewport.visible) {
      out.push("the map is not visible beside the Hero pane");
    } else {
      if (r.viewport.width < W * 0.4) out.push(`map ${f1(r.viewport.width)} px is under 40% of the window ${W}`);
      if (r.hero && r.hero.left < r.viewport.right - 1) out.push(`#screen-hero left ${f1(r.hero.left)} is left of the map's right edge ${f1(r.viewport.right)}`);
    }
    if (r.hero && (r.hero.width < 359 || r.hero.width > 561)) out.push(`#screen-hero pane is ${f1(r.hero.width)} px wide, expected 360-560 (${LAYOUT_SIDE_WIDTH.expanded})`);
  }
  if (side && scene === "encounter") {
    if (!r.enc || !r.enc.visible) {
      out.push("#enc-panel not visible");
    } else if (r.viewport && r.enc.left < r.viewport.right - 1) {
      out.push(`#enc-panel left ${f1(r.enc.left)} is left of the map's right edge ${f1(r.viewport.right)}`);
    }
    if (!r.sprite || !r.sprite.visible) out.push("#mw-party-sprite not visible beside the panel");
  }
  if (cls === "short" && scene === "combat") {
    for (const b of m.cbButtons) {
      if (b.top < -1 || b.bottom > H + 1) out.push(`combat action ${b.id} [${f1(b.top)},${f1(b.bottom)}] is outside the ${H} px window`);
    }
  }
  if (side && scene === "camp") {
    const p = r.campPanel;
    if (!p || !p.visible) {
      out.push("Make Camp panel not visible");
    } else {
      if (!near(p.right, W)) out.push(`camp panel right ${f1(p.right)}, expected docked at the window edge ${W}`);
      if (!(p.width < W * 0.6)) out.push(`camp panel ${f1(p.width)} px is not under 60% of ${W}`);
    }
  }
  return out;
}

// Phase 100: the expected key order of the list's first block, from the pure
// view of an empty record (the page's own record only changes the rows' text,
// never their order).
function expectedFirstBlockKeys() {
  const view = buildAchievementsView(emptyRecord(), { tzOffset: 0 });
  return view.blocks[0].rows.map((r) => r.key);
}

const COLUMN_MIN_PX = 300;

// The open achievements sheet's shape. `opts.expectExpanded` adds the checks
// for the scene that expands the first track. `m` comes from measureSheet().
function sheetFailures(cls, m, opts = {}) {
  const out = [];
  const W = m.innerWidth;
  const H = m.innerHeight;
  if (!m.sheetVisible) {
    out.push("the achievements sheet is not visible");
    return out;
  }
  const inside = (b, label) => {
    if (!b) {
      out.push(`${label} not found`);
      return;
    }
    if (b.left < -TOL_PX || b.right > W + TOL_PX || b.top < -TOL_PX || b.bottom > H + TOL_PX) {
      out.push(`${label} box [${f1(b.left)},${f1(b.top)},${f1(b.right)},${f1(b.bottom)}] leaves the ${W}x${H} window`);
    }
  };
  inside(m.panel, "the sheet panel");
  inside(m.body, "#mw-achievements-body");
  if (m.bodyOverflowY !== "auto" && m.bodyOverflowY !== "scroll") {
    out.push(`#mw-achievements-body overflow-y is "${m.bodyOverflowY}", expected a vertical scroller (auto or scroll)`);
  }
  if (!(m.bodyScrollHeight > m.bodyClientHeight)) {
    out.push(`#mw-achievements-body holds no more than its box (scrollHeight ${m.bodyScrollHeight}, clientHeight ${m.bodyClientHeight}): the list should scroll on its own`);
  }
  if (m.bodyScrollWidth > m.bodyClientWidth + 1) {
    out.push(`#mw-achievements-body scrolls sideways (scrollWidth ${m.bodyScrollWidth} > clientWidth ${m.bodyClientWidth})`);
  }
  if (opts.expectPlay) {
    // Phase 101 (AUI-04): the row was shown before the measurement.
    if (!m.playBtnVisible) {
      out.push("the VIEW IN PLAY GAMES button is not visible with its row shown");
    } else {
      inside(m.playBtn, "the VIEW IN PLAY GAMES button");
      if (m.playBtn.height < 48 - TOL_PX) out.push(`the VIEW IN PLAY GAMES button is ${f1(m.playBtn.height)} px tall, expected at least 48`);
      if (m.body && m.playBtn.bottom > m.body.top + TOL_PX) {
        out.push(`the VIEW IN PLAY GAMES button bottom ${f1(m.playBtn.bottom)} runs into the scrolling body (top ${f1(m.body.top)})`);
      }
      if (m.playBtnText !== ACHIEVEMENTS_SHEET_COPY.play.view) out.push(`the button reads "${m.playBtnText}", expected "${ACHIEVEMENTS_SHEET_COPY.play.view}"`);
    }
    if (!m.playNoteVisible) out.push("the failure line is not visible with its note shown");
    else inside(m.playNote, "the failure line");
  }
  if (m.layout !== cls) out.push(`html[data-mw-layout] is "${m.layout}", expected "${cls}"`);
  const want = Math.max(1, Math.floor((m.listWidth + m.gap) / (COLUMN_MIN_PX + m.gap)));
  if (m.cols !== want) {
    out.push(`the list shows ${m.cols} column(s), expected ${want} (list width ${f1(m.listWidth)}, gap ${f1(m.gap)}, minimum ${COLUMN_MIN_PX})`);
  }
  if (cls === "compact" && m.cols !== 1) out.push(`a compact window shows ${m.cols} columns, expected exactly 1`);
  if (W >= 840 && m.cols < 2) out.push(`a ${W} px window shows ${m.cols} column, expected at least 2`);
  const keys = expectedFirstBlockKeys();
  if (JSON.stringify(m.keys) !== JSON.stringify(keys)) {
    out.push(`the first block's rows read ${JSON.stringify(m.keys)}, expected the view's order ${JSON.stringify(keys)}`);
  }
  if (!(m.iconsInView > 0)) out.push("no achievement icon is in view in the list");
  for (const src of m.iconsNotLoaded) out.push(`list icon did not load: ${src}`);
  if (opts.expectExpanded) {
    const e = m.expanded;
    if (!e) {
      out.push("no expandable track button in the list");
    } else {
      if (e.ariaExpanded !== "true") out.push(`the first track's aria-expanded is "${e.ariaExpanded}", expected "true"`);
      if (!e.rungsAfter) out.push("the expanded track has no ul.mw-ach-rungs right after its button");
      if (e.rungCount !== 4) out.push(`the expanded track lists ${e.rungCount} rungs, expected 4`);
    }
  }
  return out;
}

// The open large view's shape: `want` is the expected { name, line, stateText }
// from the pure view. `m` comes from measureLarge().
function largeFailures(label, m, want) {
  const out = [];
  const W = m.innerWidth;
  const H = m.innerHeight;
  if (!m.shown) {
    out.push(`${label}: the large view is not visible after tapping the icon`);
    return out;
  }
  const inside = (b, what) => {
    if (!b) {
      out.push(`${label}: ${what} not found`);
      return;
    }
    if (b.left < -TOL_PX || b.right > W + TOL_PX || b.top < -TOL_PX || b.bottom > H + TOL_PX) {
      out.push(`${label}: ${what} box [${f1(b.left)},${f1(b.top)},${f1(b.right)},${f1(b.bottom)}] leaves the ${W}x${H} window`);
    }
  };
  inside(m.overlay, "the overlay");
  inside(m.art, "the icon");
  inside(m.nameBox, "the name");
  inside(m.lineBox, "the line");
  inside(m.dateBox, "the date");
  if (m.overlay && m.sheet) {
    const o = m.overlay;
    const sh = m.sheet;
    if (Math.abs(o.left - sh.left) > TOL_PX || Math.abs(o.right - sh.right) > TOL_PX || Math.abs(o.top - sh.top) > TOL_PX || Math.abs(o.bottom - sh.bottom) > TOL_PX) {
      out.push(`${label}: the overlay does not cover the whole sheet`);
    }
  }
  if (m.art) {
    if (m.art.width > 240 + TOL_PX) out.push(`${label}: the icon is ${f1(m.art.width)} px wide, expected at most 240`);
    if (m.art.height > 240 + TOL_PX) out.push(`${label}: the icon is ${f1(m.art.height)} px tall, expected at most 240`);
    if (m.art.width < 63 || m.art.height < 63) out.push(`${label}: the icon shrank to ${f1(m.art.width)} x ${f1(m.art.height)}, expected at least 64`);
  }
  if (!m.imgLoaded) out.push(`${label}: the large icon did not load (${m.imgSrc})`);
  else if (m.imgNaturalWidth !== 320) out.push(`${label}: the large icon is ${m.imgNaturalWidth} px wide, expected the 320 px export`);
  if (!/^achievements\/large\/ach_[a-z0-9_]+\.png$/.test(String(m.imgSrc))) out.push(`${label}: the icon path is "${m.imgSrc}", expected achievements/large/ach_<id>.png`);
  if (m.name !== want.name) out.push(`${label}: the name reads "${m.name}", expected "${want.name}"`);
  if (m.line !== want.line) out.push(`${label}: the line reads "${m.line}", expected "${want.line}"`);
  if (m.date !== want.stateText) out.push(`${label}: the date reads "${m.date}", expected "${want.stateText}"`);
  if (m.scrollHeight > m.clientHeight + 1) out.push(`${label}: the overlay needs scrolling (scrollHeight ${m.scrollHeight} > clientHeight ${m.clientHeight}); its content should fit`);
  if (m.scrollWidth > m.clientWidth + 1) out.push(`${label}: the overlay scrolls sideways (scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth})`);
  if (!m.focusOnOverlay) out.push(`${label}: focus is not on the overlay`);
  return out;
}

// The two large views the achievements scene opens, from the pure view of the
// seeded record: the first Depth track's head (its top earned tier) and the
// single entry with the longest name and line.
function largeTargets() {
  const rec = JSON.parse(SEED_RECORD);
  const view = buildAchievementsView(rec, { tzOffset: 0 });
  const rows = view.blocks.flatMap((b) => b.rows);
  const depth = rows.find((r) => r.kind === "track" && r.large);
  const worst = rows.find((r) => r.kind === "single" && r.large && r.large.name === WORST_SINGLE.name);
  return [
    { label: "Depth head icon", large: depth.large },
    { label: `longest entry "${WORST_SINGLE.id}" icon`, large: worst.large },
  ];
}

// The achievement card on the rail (the shape rules for a docked card come
// from shapeFailures, as for map-card).
function cardFailures(m, g) {
  const out = [];
  // A bottom-docked card (compact, medium) must sit above the tab bar, never
  // under it: the line it carries is meant to be read in full.
  const r = g && g.rects;
  if (r && r.rail && r.rail.visible && r.tabbar && r.tabbar.visible && r.tabbar.width > r.tabbar.height) {
    if (r.rail.bottom > r.tabbar.top + 1) {
      out.push(`#mw-rail bottom ${f1(r.rail.bottom)} runs under the tab bar (top ${f1(r.tabbar.top)})`);
    }
  }
  if (m.kind !== "achievement") out.push(`#mw-rail data-card-kind is "${m.kind}", expected "achievement"`);
  if (!m.hasImg) out.push("#mw-rail-icon holds no img");
  else if (!m.imgLoaded) out.push(`the card's icon did not load (naturalWidth ${m.imgNaturalWidth})`);
  if (m.railScrollHeight > m.railClientHeight + 1 || m.linesScrollHeight > m.linesClientHeight + 1) {
    out.push(`the card's text does not fit without scrolling (rail ${m.railScrollHeight} > ${m.railClientHeight}, lines ${m.linesScrollHeight} > ${m.linesClientHeight})`);
  }
  if ((m.title || "").toUpperCase() !== "ACHIEVEMENT") out.push(`#mw-rail-title reads "${m.title}", expected ACHIEVEMENT`);
  return out;
}

// The Earned strip: bounded, six items, clear of every button on the panel.
function earnedFailures(m) {
  const out = [];
  const W = m.innerWidth;
  if (!m.stripVisible || !m.strip) {
    out.push("#cb-over-earned is not visible");
    return out;
  }
  const b = m.strip;
  if (b.left < -TOL_PX || b.right > W + TOL_PX) {
    out.push(`#cb-over-earned box [${f1(b.left)},${f1(b.right)}] leaves the ${W} px window horizontally`);
  }
  if (m.items !== 6) out.push(`#cb-over-earned holds ${m.items} items, expected 6`);
  if (!m.listMaxHeight || m.listMaxHeight === "none") out.push("the strip's list has no max-height: it could grow the panel");
  if (m.listOverflowY !== "auto" && m.listOverflowY !== "scroll") {
    out.push(`the strip's list overflow-y is "${m.listOverflowY}", expected auto so it scrolls inside itself`);
  }
  // Quick 261005-vn5: the death that reveals Special Snowflake (without earning it) also shows one
  // hint line, clear of the strip and of both buttons; the panel scrolls as a whole, so the line is not a scroller.
  if (!m.hintVisible || !m.hint) {
    out.push("#cb-over-hint is not visible");
  } else {
    const h = m.hint;
    if (h.left < -TOL_PX || h.right > W + TOL_PX) out.push(`#cb-over-hint box [${f1(h.left)},${f1(h.right)}] leaves the ${W} px window horizontally`);
    if (!m.hintText || /snowflake/i.test(m.hintText)) out.push(`#cb-over-hint reads "${m.hintText}": empty, or it names the achievement`);
    if (m.hintScrollHeight > m.hintClientHeight + 1) out.push(`#cb-over-hint clips its own text (scrollHeight ${m.hintScrollHeight} > clientHeight ${m.hintClientHeight})`);
    if (rectsIntersect(h, b)) out.push("#cb-over-hint overlaps the Earned strip");
    for (const btn of m.buttons) {
      if (rectsIntersect(btn.box, h)) out.push(`death panel button ${btn.id} overlaps the hint`);
    }
  }
  // Quick 261006-1js: the epitaph block never collapses, in any window, and the panel scrolls as a whole.
  const e = m.epitaph;
  if (!e || !e.epitaphVisible) {
    out.push("the death panel's epitaph line (.cb-epitaph) is not visible");
  } else {
    if (e.midHeight < 1) out.push("#cb-mid (the epitaph block) collapsed to zero height");
    if (e.linesHeight < 20) out.push(`the epitaph block is ${f1(e.linesHeight)} px tall: collapsed`);
    if (e.lineCount < 3) out.push(`the epitaph block holds ${e.lineCount} lines, expected the cut-down line, the floor line and the epitaph`);
    if (e.epitaphHeight < 10) out.push(`the epitaph line is ${f1(e.epitaphHeight)} px tall`);
    if (!/\S/.test(e.epitaphText)) out.push("the epitaph line is empty");
    if (e.epitaphBottomInContent > e.bodyScrollHeight + 1) out.push("the epitaph line lies outside the scrolled content");
    if (e.midOverflowY === "auto" || e.midOverflowY === "scroll") out.push("#cb-mid is a nested scroller on the death panel: the panel must scroll as one column");
    if (e.lastButtonBottomInContent > e.bodyScrollHeight + 1) out.push("the last death button lies outside the scrolled content, unreachable by scrolling");
    if (e.bodyScrollHeight > e.bodyClientHeight + 1 && e.bodyOverflowY !== "auto" && e.bodyOverflowY !== "scroll") {
      out.push(`#enc-body overflows (${e.bodyScrollHeight} > ${e.bodyClientHeight}) but its overflow-y is "${e.bodyOverflowY}": the panel cannot scroll`);
    }
  }
  if (!m.buttons.length) out.push("the death panel has no buttons under .cb-over-actions");
  for (const btn of m.buttons) {
    if (!btn.visible) out.push(`death panel button ${btn.id} is not visible`);
    if (rectsIntersect(btn.box, b)) out.push(`death panel button ${btn.id} overlaps the Earned strip`);
  }
  return out;
}

// Waits for an element to be gone (a closed sheet); returns a message or null.
async function expectHidden(cdp, sel, ms, label) {
  try {
    await waitForStable(cdp, `!(${visibleExpr(sel)})`, ms, label || sel);
    return null;
  } catch (err) {
    return err.message;
  }
}

// Verifies that a scene's required element showed up; returns a message or null.
async function expectVisible(cdp, sel, ms, label) {
  try {
    await waitForStable(cdp, visibleExpr(sel), ms, label || sel);
    return null;
  } catch (err) {
    return err.message;
  }
}

// ---------------------------------------------------------------------------
// One profile
// ---------------------------------------------------------------------------

async function runProfile(cdp, prof, ctx) {
  const scenes = [];
  const record = (name, failures, extra = {}) => {
    scenes.push({ scene: name, failures, ...extra });
  };
  const c = { profile: prof, outDir: ctx.outDir };
  const cls = prof.expect;
  let excMark = cdp.exceptions.length;
  let reqMark = cdp.requests.length;

  // A scene: set up (returns an error message or null), settle, measure,
  // screenshot, run generic + shape checks and the scene's extra checks.
  async function scene(name, setup, extra) {
    const failures = [];
    let m = null;
    try {
      const err = setup ? await setup() : null;
      if (err) failures.push(err);
      await settle(cdp);
      m = await cdp.evaluate(MEASURE);
      await shot(cdp, c, name);
      failures.push(...genericFailures(m));
      failures.push(...shapeFailures(cls, name, m));
      if (extra) failures.push(...(await extra(m)));
    } catch (err) {
      failures.push(`error: ${err.message}`);
    }
    const newExc = cdp.exceptions.slice(excMark);
    excMark = cdp.exceptions.length;
    for (const e of newExc) failures.push(`page exception: ${e}`);
    const newReq = cdp.requests.slice(reqMark).filter((u) => !u.startsWith(ctx.origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:"));
    reqMark = cdp.requests.length;
    for (const u of newReq) failures.push(`network request left the machine: ${u}`);
    record(name, failures);
    return m;
  }

  // Boot at this size.
  await setMetrics(cdp, prof.width, prof.height, prof.mobile);
  await cdp.evaluate(EXPR.seed);
  await cdp.send("Page.reload");
  await waitForStable(cdp, EXPR.titleReady, BOOT_WAIT_MS, `title ready at ${prof.name}`);
  excMark = cdp.exceptions.length; // exceptions of the boot itself are scene "title"
  reqMark = cdp.requests.length;
  await sleep(250);

  await scene("title", null);

  await scene("roller", async () => {
    await cdp.evaluate(EXPR.clickSel("#mw-title-enter"));
    try {
      await waitForStable(cdp, EXPR.rollerReady, 25000, "roller CTA ready");
    } catch (err) {
      return err.message;
    }
    return null;
  });
  try {
    await cdp.evaluate(EXPR.clickSel("#mw-roller-cta"));
    await waitForStable(cdp, EXPR.hiddenBoth, 20000, "roller and title hidden");
  } catch (err) {
    record("roller-exit", [err.message]);
  }
  await sleep(300);

  await scene("map", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.base));
    await cdp.evaluate(EXPR.showTab("maze"));
    return null;
  });

  await scene("map-card", async () => {
    await cdp.evaluate(EXPR.railCard);
    return expectVisible(cdp, "#mw-rail", 3000, "the rail card");
  }, async () => {
    const fails = [];
    await cdp.evaluate(EXPR.railClear);
    await settle(cdp);
    const m2 = await cdp.evaluate(MEASURE);
    if (m2.railShown !== "0") fails.push(`#mw-rail data-shown is "${m2.railShown}" after the card was cleared, expected "0"`);
    return fails;
  });

  await scene("settings", async () => {
    await cdp.evaluate(EXPR.clickSel("#mw-gear-btn"));
    return expectVisible(cdp, "#mw-settings-sheet", 3000, "the Settings sheet");
  }, async (m) => {
    const expectRow = Math.min(prof.width, prof.height) < 600;
    return m.screenRowVisible === expectRow
      ? []
      : [`#mw-screen-row visible=${m.screenRowVisible}, expected ${expectRow} (smallest side ${Math.min(prof.width, prof.height)})`];
  });
  await cdp.evaluate(EXPR.clickSel("#mw-settings-close"));
  await sleep(200);

  for (const tab of ["hero", "gear", "oracle", "dead"]) {
    await scene(tab, async () => {
      await cdp.evaluate(EXPR.showTab(tab));
      return null;
    });
  }

  await scene("encounter", async () => {
    await cdp.evaluate(EXPR.showTab("maze"));
    await cdp.evaluate(EXPR.inject(ctx.states.combat));
    return expectVisible(cdp, "#enc-panel", 5000, "the encounter panel");
  });

  let combatUp = false;
  await scene("combat", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.round));
    const err = await expectVisible(cdp, "#cb-act", 5000, "the combat actions (#cb-act)");
    combatUp = !err;
    return err;
  });

  if (combatUp) {
    await rotationRoundTrip(cdp, prof, c, "combat-turn", "combat", "#cb-act", scenes, ctx);
  } else {
    scenes.push({ scene: "combat-turn", failures: ["skipped: the combat round did not come up"], skipped: true });
  }

  let storeUp = false;
  await scene("store", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.store));
    const err = await expectVisible(cdp, "#a-leave", 5000, "the store (#a-leave)");
    storeUp = !err;
    return err;
  });
  if (storeUp) {
    await rotationRoundTrip(cdp, prof, c, "store-turn", "store", "#a-leave", scenes, ctx);
  } else {
    scenes.push({ scene: "store-turn", failures: ["skipped: the store did not come up"], skipped: true });
  }

  await scene("camp", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.base));
    await cdp.evaluate(EXPR.showTab("maze"));
    await sleep(300);
    await cdp.evaluate(EXPR.clickSel("#btn-camp"));
    return expectVisible(cdp, "#mw-camp-sheet", 3000, "the Make Camp sheet");
  });
  await cdp.evaluate("(() => { if (window.closeCampSheet) window.closeCampSheet(); return true; })()");

  // Phase 100: the achievements sheet with the first track expanded.
  await scene("achievements", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.base));
    await cdp.evaluate(EXPR.showTab("maze"));
    await sleep(200);
    await cdp.evaluate(EXPR.openSheet);
    const err = await expectVisible(cdp, "#mw-achievements-sheet", 3000, "the achievements sheet");
    if (err) return err;
    await settle(cdp);
    // Phase 101: the play row is shown, then measured with the rest.
    if (!(await cdp.evaluate(EXPR.showPlayRow))) return "the VIEW IN PLAY GAMES row is missing from the sheet";
    await cdp.evaluate(EXPR.expandFirstTrack);
    return null;
  }, async () => {
    const ms = await cdp.evaluate(MEASURE_SHEET);
    const fails = sheetFailures(cls, ms, { expectExpanded: true, expectPlay: true });
    // Quick 261005-vhn: the large view, opened and closed twice (a track head and
    // the longest single entry), with focus checked on the way back.
    for (const target of largeTargets()) {
      const clicked = await cdp.evaluate(EXPR.clickLargeLabel(target.large.label));
      if (!clicked) {
        fails.push(`${target.label}: no icon button labelled "${target.large.label}" in the list`);
        continue;
      }
      await sleep(250);
      // The 320 px file is fetched on first use: give a slow machine time to
      // land it before judging it (a failure is still reported by the measure).
      await waitForStable(cdp, `(() => { const i = document.querySelector("#mw-ach-large-img"); return !!(i && i.complete && i.naturalWidth > 0); })()`, 5000, "the large icon to load").catch(() => {});
      fails.push(...largeFailures(target.label, await cdp.evaluate(MEASURE_LARGE), target.large));
      await shot(cdp, c, target.large.key.startsWith("row:") && target.large.name === WORST_SINGLE.name ? "achievement-large-longest" : "achievement-large");
      await cdp.evaluate(EXPR.tapLarge);
      await sleep(150);
      const after = await cdp.evaluate(MEASURE_LARGE);
      if (after.shown) fails.push(`${target.label}: a tap on the overlay did not close it`);
      const active = await cdp.evaluate(EXPR.activeLabel);
      if (active !== target.large.label) fails.push(`${target.label}: focus returned to "${active}", expected the icon button "${target.large.label}"`);
    }
    await cdp.evaluate(EXPR.clickSel("#mw-achievements-close"));
    const err = await expectHidden(cdp, "#mw-achievements-sheet", 3000, "the achievements sheet to close");
    if (err) fails.push(err);
    await cdp.evaluate(EXPR.hidePlayRow);
    return fails;
  });

  // Phase 100: a real unlock raised through the app's own banner bridge, so it
  // takes the real gate and the real icon path.
  await scene("achievement-card", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.base));
    await cdp.evaluate(EXPR.showTab("maze"));
    await sleep(200);
    await cdp.evaluate(EXPR.achUnlock);
    return expectVisible(cdp, "#mw-rail", 3000, "the achievement card");
  }, async (g) => {
    const fails = cardFailures(await cdp.evaluate(MEASURE_CARD), g);
    await cdp.evaluate(EXPR.railClear);
    return fails;
  });

  // Phase 100: the death panel with the Earned strip (six unlocks).
  await scene("death-earned", async () => {
    await cdp.evaluate(EXPR.inject(ctx.states.dead));
    await cdp.evaluate(EXPR.showTab("maze"));
    await sleep(200);
    await cdp.evaluate(EXPR.deathUnlocks);
    return expectVisible(cdp, "#cb-over-earned", 5000, "the Earned strip (#cb-over-earned)");
  }, async () => {
    const fails = earnedFailures(await cdp.evaluate(MEASURE_EARNED));
    await cdp.evaluate(EXPR.clearStrip);
    await cdp.evaluate(EXPR.inject(ctx.states.base));
    await cdp.evaluate(EXPR.showTab("maze"));
    return fails;
  });

  return scenes;
}

// SCREEN-05: turn the window mid-fight / mid-store and turn it back.
async function rotationRoundTrip(cdp, prof, c, sceneName, key, controlSel, scenes, ctx) {
  const failures = [];
  const exc0 = cdp.exceptions.length;
  try {
    const snap = async () => {
      const m = await cdp.evaluate(MEASURE);
      const subject = await cdp.evaluate(EXPR.subject(key));
      return { m, subject };
    };
    await settle(cdp);
    const before = await snap();
    const rectBefore = before.m.rects.enc;
    const tabBefore = before.m.tab;

    const check = (label, s, expectCls) => {
      if (s.subject !== before.subject) failures.push(`${label}: S.${key} changed across the turn`);
      if (!s.m.rects.enc || !s.m.rects.enc.visible) failures.push(`${label}: #enc-panel is not visible`);
      const present = key === "combat" ? s.m.cbActPresent : s.m.leaveVisible;
      if (!present) failures.push(`${label}: ${controlSel} is gone`);
      if (s.m.tab !== tabBefore) failures.push(`${label}: active tab changed from "${tabBefore}" to "${s.m.tab}"`);
      if (s.m.layout !== expectCls) failures.push(`${label}: html[data-mw-layout] is "${s.m.layout}", expected "${expectCls}"`);
    };

    // Turn.
    await setMetrics(cdp, prof.height, prof.width, prof.mobile);
    await settle(cdp);
    const turned = await snap();
    await shot(cdp, c, `${sceneName}-turned`);
    check("turned", turned, layoutClassFor(prof.height, prof.width));
    failures.push(...genericFailures(turned.m).map((s) => `turned: ${s}`));

    // Turn back.
    await setMetrics(cdp, prof.width, prof.height, prof.mobile);
    await settle(cdp);
    const back = await snap();
    check("turned back", back, prof.expect);
    failures.push(...genericFailures(back.m).map((s) => `turned back: ${s}`));
    const rb = back.m.rects.enc;
    if (rectBefore && rb) {
      for (const k of ["left", "top", "right", "bottom"]) {
        if (Math.abs(rb[k] - rectBefore[k]) > 1) {
          failures.push(`turned back: #enc-panel ${k} ${f1(rb[k])} differs from ${f1(rectBefore[k])} before the first turn`);
        }
      }
    }
  } catch (err) {
    failures.push(`error: ${err.message}`);
    try {
      await setMetrics(cdp, prof.width, prof.height, prof.mobile);
    } catch {
      /* ignore */
    }
  }
  for (const e of cdp.exceptions.slice(exc0)) failures.push(`page exception: ${e}`);
  scenes.push({ scene: sceneName, failures });
}

// ---------------------------------------------------------------------------
// Boundary probes
// ---------------------------------------------------------------------------

async function runProbes(cdp, ctx = {}) {
  const results = [];
  if (ctx.states) {
    // Back to a plain map state: the sheet opens over whatever the last
    // profile left, and the check should not depend on it.
    try {
      await cdp.evaluate(EXPR.inject(ctx.states.base));
      await cdp.evaluate(EXPR.showTab("maze"));
    } catch {
      /* the probe's own error handling reports a dead page */
    }
  }
  for (const p of BOUNDARY_PROBES) {
    let got = null;
    let err = null;
    const sheet = [];
    const excMark = cdp.exceptions.length;
    try {
      await setMetrics(cdp, p.width, p.height, true);
      await cdp.evaluate(EXPR.settleShort);
      got = await cdp.evaluate(EXPR.layoutNow);
      // Phase 100: the sheet, opened one step either side of the threshold.
      await cdp.evaluate(EXPR.openSheet);
      const shown = await expectVisible(cdp, "#mw-achievements-sheet", 3000, "the achievements sheet");
      if (shown) sheet.push(shown);
      await settle(cdp);
      // Phase 101: the play row is shown for the measurement, hidden after.
      if (!(await cdp.evaluate(EXPR.showPlayRow))) sheet.push("the VIEW IN PLAY GAMES row is missing from the sheet");
      const m = await cdp.evaluate(MEASURE);
      sheet.push(...genericFailures(m));
      sheet.push(...sheetFailures(p.expect, await cdp.evaluate(MEASURE_SHEET), { expectPlay: true }));
      await cdp.evaluate(EXPR.clickSel("#mw-achievements-close"));
      const gone = await expectHidden(cdp, "#mw-achievements-sheet", 3000, "the achievements sheet to close");
      if (gone) sheet.push(gone);
      await cdp.evaluate(EXPR.hidePlayRow);
    } catch (e) {
      err = e.message;
    }
    for (const e of cdp.exceptions.slice(excMark)) sheet.push(`page exception: ${e}`);
    const want = layoutClassFor(p.width, p.height);
    results.push({
      name: p.name,
      width: p.width,
      height: p.height,
      expect: p.expect,
      want,
      got,
      sheet,
      pass: !err && got === want && want === p.expect && sheet.length === 0,
      error: err,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(result, outDir, shotsOn) {
  console.log("| Profile | Size | Class | Scenes passed / run | Verdict |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const p of result.profiles) {
    const run = p.scenes.length;
    const ok = p.scenes.filter((s) => s.failures.length === 0).length;
    console.log(`| ${p.name} | ${p.width}x${p.height} | ${p.expect} | ${ok} / ${run} | ${p.pass ? "PASS" : "FAIL"} |`);
  }
  for (const p of result.profiles) {
    if (p.error) console.log(`${p.name} / (profile): ${p.error}`);
    for (const s of p.scenes) {
      for (const f of s.failures) console.log(`${p.name} / ${s.scene}: ${f}`);
    }
  }
  console.log("");
  console.log("| Boundary probe | Expected | html[data-mw-layout] | Open sheet | Verdict |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const r of result.probes) {
    const sheetCell = r.error ? "-" : (r.sheet || []).length === 0 ? "PASS" : "FAIL";
    console.log(`| ${r.name} | ${r.want} | ${r.error ? "error: " + r.error : r.got} | ${sheetCell} | ${r.pass ? "PASS" : "FAIL"} |`);
  }
  for (const r of result.probes) {
    for (const f of r.sheet || []) console.log(`probe ${r.name} / open sheet: ${f}`);
  }
  const pp = result.profiles.filter((p) => p.pass).length;
  const qp = result.probes.filter((r) => r.pass).length;
  console.log(
    `layout-check: ${pp}/${result.profiles.length} profiles passed, ${qp}/${result.probes.length} boundary probes passed, screenshots in ${shotsOn ? outDir : "(off)"}`
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chromePath = resolveBrowser(args);
  if (!chromePath) {
    process.exit(2);
    return;
  }

  const root = path.resolve(import.meta.dirname, "..");
  const outDir = args.shots ? path.resolve(args.out || path.join(root, "tools", "layout-check-output")) : null;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  let profiles = PROFILES;
  if (args.only) {
    profiles = PROFILES.filter((p) => args.only.includes(p.name));
    if (!profiles.length) {
      console.error(`ERROR: --only matched no profile (known: ${PROFILES.map((p) => p.name).join(", ")})`);
      process.exit(2);
      return;
    }
  }

  let server;
  try {
    server = await startStaticServer(root, args.port);
  } catch (err) {
    console.error(`ERROR: could not start static server on port ${args.port}: ${err.message}`);
    process.exit(2);
    return;
  }
  const origin = `http://127.0.0.1:${args.port}`;
  const pageUrl = `${origin}/mazeworld.html`;
  const states = buildStates();

  let session;
  const result = { profiles: [], probes: [] };
  try {
    session = await launchAndConnect({ chromePath, pageUrl, devtoolsPort: args.devtoolsPort, keepProfile: args.keepProfile });
    const { cdp } = session;
    // A generous first-boot wait: this machine intermittently takes much
    // longer than 15 s for a fresh headless Chrome profile to finish its
    // cold boot (the same class of flakiness recorded for
    // tools/shell-boot-check.mjs, STATE blockers). Not a code bug.
    await waitForStable(cdp, EXPR.titleReady, BOOT_WAIT_MS, "title ready (initial boot)");
    for (const prof of profiles) {
      let scenes = [];
      let error = null;
      try {
        scenes = await runProfile(cdp, prof, { outDir, states, origin });
      } catch (err) {
        error = err.message;
      }
      const pass = !error && scenes.length > 0 && scenes.every((s) => s.failures.length === 0);
      result.profiles.push({ name: prof.name, width: prof.width, height: prof.height, expect: prof.expect, scenes, error, pass });
    }
    result.probes = await runProbes(cdp, { states });
  } catch (err) {
    console.error(`ERROR: browser could not be driven: ${err.message}`);
    if (session) await session.teardown();
    server.close();
    process.exit(2);
    return;
  }
  await session.teardown();
  server.close();

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printReport(result, outDir, !!outDir);

  const ok = result.profiles.every((p) => p.pass) && result.probes.every((r) => r.pass);
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
