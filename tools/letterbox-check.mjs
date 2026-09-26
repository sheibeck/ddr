#!/usr/bin/env node
// tools/letterbox-check.mjs
//
// Phase 80 (DROID-03) — dependency-free headless-Chrome CDP layout check
// and screenshot driver for the large-screen letterboxed portrait column.
// Node 22 built-ins ONLY: node:http + node:fs + node:path + node:os +
// node:child_process + the global WebSocket (Chrome DevTools Protocol) —
// no playwright, no puppeteer, no npm install. Scaffolding (static server,
// browser resolution, CdpClient, devtools-page wait, profile cleanup,
// launch/teardown, uncaught-exception capture) is copied from
// tools/roller-repro.mjs.
//
// Usage:
//   node tools/letterbox-check.mjs [--chrome <path>] [--port <n>]
//     [--devtools-port <n>] [--shots <dir>] [--json] [--keep-profiles]
//
// Behaviour:
//   For each of five viewports (phone 412x915, phone-max 480x1000, tablet
//   800x1280, foldable 700x840, chromebook 1280x800) a fresh headless
//   Chrome/Edge boots mazeworld.html, Emulation.setDeviceMetricsOverride
//   sets the viewport, Page.navigate reloads the page at that size, and
//   once the title screen is ready a single synchronous page-side
//   expression measures: innerWidth; the rects (left/width/right) of
//   #app, .mw-maze-viewport and every element whose computed position is
//   "fixed" (an element with the hidden attribute is un-hidden, measured
//   and restored inside the same expression so hidden sheets/overlays are
//   still checked); which fixed elements are inset:0 overlays (computed
//   top/right/bottom/left all "0px"); body's computed contain/transform;
//   and the root element's computed background-color.
//
//   phone and phone-max are "full" viewports: #app and every inset-0
//   overlay must span left 0, width === innerWidth, and body's computed
//   contain must be "none" (tolerance 1px). tablet/foldable/chromebook are
//   "column" viewports: #app and every inset-0 overlay must be exactly
//   COLUMN_PX wide, centred at left (innerWidth - COLUMN_PX) / 2; every
//   OTHER fixed element and .mw-maze-viewport must lie inside that column;
//   the root element's computed background must be rgb(8, 7, 5).
//
//   With --shots <dir>, for every viewport this tool captures
//   browser-<name>-title.png (as booted, title screen showing) then hides
//   the title screen and captures browser-<name>-app.png. The directory is
//   created if it does not exist.
//
//   Prints a markdown table (viewport, innerWidth, mode, #app left/width,
//   overlays checked, verdict), or the raw JSON with --json, then a
//   summary line.
//
// Exit codes: 0 every viewport passed; 1 a viewport mismatched or the page
// threw an uncaught exception; 2 no browser could be resolved or driven
// (the reason is printed to stderr).
//
// This tool adds NOTHING to the shipped app — no permanent console trace,
// no dev Oracle line. It only reads existing DOM/CSS the app already
// exposes.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

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

// Must match the @media (min-width:481px) / max-width:480px pair in
// mazeworld.html's <style id="mw-letterbox"> block — the two files are
// declared as changing together in that block's own comment.
const COLUMN_PX = 480;
const BREAKPOINT_PX = 481;

const TOL_PX = 1;

const VIEWPORTS = [
  { name: "phone", width: 412, height: 915, mode: "full" },
  { name: "phone-max", width: 480, height: 1000, mode: "full" },
  { name: "tablet", width: 800, height: 1280, mode: "column" },
  { name: "foldable", width: 700, height: 840, mode: "column" },
  { name: "chromebook", width: 1280, height: 800, mode: "column" },
];

function parseArgs(argv) {
  const args = {
    port: 8767,
    devtoolsPort: 9239,
    shots: null,
    json: false,
    keepProfiles: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chrome") args.chrome = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--devtools-port") args.devtoolsPort = Number(argv[++i]);
    else if (a === "--shots") args.shots = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--keep-profiles") args.keepProfiles = true;
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

// A tiny Chrome DevTools Protocol client over Node 22's built-in WebSocket
// (copied from tools/roller-repro.mjs).
class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
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
        this.exceptions.push(msg.params?.exceptionDetails?.text || "unknown exception");
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
      throw new Error(result.exceptionDetails.text || "evaluate exception");
    }
    return result.result?.value;
  }
}

// Unlike roller-repro's CdpClient.waitFor, this swallows transient
// evaluate() errors: Page.navigate destroys the current execution context
// momentarily, and a poll landing in that window would otherwise abort the
// whole run instead of retrying on the next tick.
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

// Kill every chrome.exe process whose command line references this
// viewport's --user-data-dir profile directory (see roller-repro.mjs for
// why PID-based taskkill is unreliable on this machine).
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

async function launchAndConnect({ chromePath, pageUrl, devtoolsPort, keepProfiles }) {
  // Forward slashes only (see roller-repro.mjs): a Windows-style backslash
  // path breaks killByProfileDir's WMI LIKE match (backslash is WQL's own
  // LIKE-escape character).
  const profileDir = fs.mkdtempSync(`${os.tmpdir().replace(/\\/g, "/")}/mz-letterbox-`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${devtoolsPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${profileDir}`,
    "--window-size=432,900",
    pageUrl,
  ];
  const child = spawn(chromePath, args, { windowsHide: true, stdio: "ignore" });
  void child;

  let entry;
  try {
    entry = await waitForDevtoolsPage(devtoolsPort, pageUrl, 15000);
  } catch (err) {
    killByProfileDir(profileDir);
    await sleep(400);
    if (!keepProfiles) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch {
        /* ignore — a lingering crashpad handle is not this tool's concern */
      }
    }
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

  async function teardown() {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    killByProfileDir(profileDir);
    await sleep(400); // let the process family fully exit before rmSync
    if (!keepProfiles) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch {
        /* ignore — a lingering crashpad handle is not this tool's concern */
      }
    }
  }

  return { cdp, teardown };
}

// ─── Page-side expression strings ──────────────────────────────────────
const EXPR = {
  titleReady: `(() => {
    const enter = document.getElementById("mw-title-enter");
    const screen = document.getElementById("mw-title-screen");
    return !!(enter && !enter.disabled && screen && !screen.hidden);
  })()`,
  hideTitle: `(() => {
    const el = document.getElementById("mw-title-screen");
    if (el) el.setAttribute("hidden", "");
    return true;
  })()`,
  // Measures #app, .mw-maze-viewport and every position:fixed element in a
  // single synchronous pass. An element carrying the [hidden] attribute is
  // un-hidden, measured, and restored inside this SAME expression so
  // sheets/overlays hidden at the moment of measurement are still checked
  // (Task 1 action item 4).
  measure: `(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const fixed = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const wasHidden = el.hasAttribute("hidden");
      if (wasHidden) el.removeAttribute("hidden");
      const rect = el.getBoundingClientRect();
      const cs2 = getComputedStyle(el);
      const insetZero = cs2.top === "0px" && cs2.right === "0px" && cs2.bottom === "0px" && cs2.left === "0px";
      fixed.push({
        id: el.id || null,
        cls: (el.className || "").toString() || null,
        left: rect.left,
        width: rect.width,
        right: rect.right,
        insetZero,
      });
      if (wasHidden) el.setAttribute("hidden", "");
    }
    const appEl = document.querySelector("#app");
    const appRect = appEl ? appEl.getBoundingClientRect() : null;
    const vpEl = document.querySelector(".mw-maze-viewport");
    const vpRect = vpEl ? vpEl.getBoundingClientRect() : null;
    const bodyCs = getComputedStyle(document.body);
    const rootCs = getComputedStyle(document.documentElement);
    return {
      innerWidth: window.innerWidth,
      app: appRect ? { left: appRect.left, width: appRect.width, right: appRect.right } : null,
      viewport: vpRect ? { left: vpRect.left, width: vpRect.width, right: vpRect.right } : null,
      fixed,
      bodyContain: bodyCs.contain,
      bodyTransform: bodyCs.transform,
      rootBackground: rootCs.backgroundColor,
    };
  })()`,
};

function labelFor(f) {
  return f.id ? `#${f.id}` : f.cls ? `.${String(f.cls).split(/\s+/)[0]}` : "(anonymous fixed element)";
}

function evaluateExpectation(viewportSpec, measurement) {
  const notes = [];
  let pass = true;
  const innerWidth = measurement.innerWidth;
  const near = (a, b) => Math.abs(a - b) <= TOL_PX;
  const overlays = measurement.fixed.filter((f) => f.insetZero);
  const others = measurement.fixed.filter((f) => !f.insetZero);

  if (viewportSpec.mode === "full") {
    if (!measurement.app || !near(measurement.app.left, 0) || !near(measurement.app.width, innerWidth)) {
      pass = false;
      notes.push(
        `#app rect left=${measurement.app?.left} width=${measurement.app?.width}, expected left 0 width ${innerWidth}`
      );
    }
    for (const f of overlays) {
      if (!near(f.left, 0) || !near(f.width, innerWidth)) {
        pass = false;
        notes.push(`${labelFor(f)} rect left=${f.left} width=${f.width}, expected left 0 width ${innerWidth}`);
      }
    }
    if (measurement.bodyContain !== "none") {
      pass = false;
      notes.push(`body computed contain is "${measurement.bodyContain}", expected "none"`);
    }
  } else {
    const columnLeft = (innerWidth - COLUMN_PX) / 2;
    const columnRight = columnLeft + COLUMN_PX;
    if (!measurement.app || !near(measurement.app.left, columnLeft) || !near(measurement.app.width, COLUMN_PX)) {
      pass = false;
      notes.push(
        `#app rect left=${measurement.app?.left} width=${measurement.app?.width}, expected left ${columnLeft} width ${COLUMN_PX}`
      );
    }
    for (const f of overlays) {
      if (!near(f.left, columnLeft) || !near(f.width, COLUMN_PX)) {
        pass = false;
        notes.push(`${labelFor(f)} rect left=${f.left} width=${f.width}, expected left ${columnLeft} width ${COLUMN_PX}`);
      }
    }
    for (const f of others) {
      if (f.left < columnLeft - TOL_PX || f.right > columnRight + TOL_PX) {
        pass = false;
        notes.push(`${labelFor(f)} rect left=${f.left} right=${f.right} lies outside the column [${columnLeft}, ${columnRight}]`);
      }
    }
    if (measurement.rootBackground !== "rgb(8, 7, 5)") {
      pass = false;
      notes.push(`root computed background is "${measurement.rootBackground}", expected "rgb(8, 7, 5)"`);
    }
    if (measurement.viewport) {
      if (measurement.viewport.left < columnLeft - TOL_PX || measurement.viewport.right > columnRight + TOL_PX) {
        pass = false;
        notes.push(
          `.mw-maze-viewport rect left=${measurement.viewport.left} right=${measurement.viewport.right} lies outside the column [${columnLeft}, ${columnRight}]`
        );
      }
    } else {
      pass = false;
      notes.push(".mw-maze-viewport not found in the DOM");
    }
  }

  return {
    pass,
    notes,
    overlaysChecked: overlays.map(labelFor),
    othersChecked: others.map(labelFor),
  };
}

async function runViewport(viewportSpec, { chromePath, pageUrl, devtoolsPort, keepProfiles, shotsDir }) {
  const { cdp, teardown } = await launchAndConnect({ chromePath, pageUrl, devtoolsPort, keepProfiles });
  try {
    // A generous timeout here: this machine intermittently takes much
    // longer than 15s for a fresh headless Chrome profile to finish its
    // cold boot under load from prior (still-tearing-down) instances —
    // the same class of environment flakiness recorded for
    // tools/shell-boot-check.mjs (.planning STATE.md blockers). This is
    // NOT a code bug; retrying with a longer budget is the mitigation.
    await waitForStable(cdp, EXPR.titleReady, 45000, "title ready (initial boot)");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewportSpec.width,
      height: viewportSpec.height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(150);
    await cdp.send("Page.navigate", { url: pageUrl });
    await waitForStable(cdp, EXPR.titleReady, 20000, "title ready (after navigate at target viewport)");
    await sleep(250);

    const measurement = await cdp.evaluate(EXPR.measure);

    // phone-max exists only to pin the COLUMN_PX boundary in the layout
    // measurement (it is visually identical to "phone" — both full-width);
    // screenshots are captured for phone/tablet/foldable/chromebook only,
    // matching the plan's eight committed PNGs.
    if (shotsDir && viewportSpec.name !== "phone-max") {
      const titleShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(shotsDir, `browser-${viewportSpec.name}-title.png`), Buffer.from(titleShot.data, "base64"));
      await cdp.evaluate(EXPR.hideTitle);
      await sleep(200);
      const appShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(shotsDir, `browser-${viewportSpec.name}-app.png`), Buffer.from(appShot.data, "base64"));
    }

    const verdict = evaluateExpectation(viewportSpec, measurement);
    if (cdp.exceptions.length) {
      verdict.pass = false;
      verdict.notes.push(`uncaught exception(s): ${cdp.exceptions.join(" | ")}`);
    }

    return {
      viewport: viewportSpec.name,
      mode: viewportSpec.mode,
      innerWidth: measurement.innerWidth,
      app: measurement.app,
      verdict,
    };
  } catch (err) {
    return {
      viewport: viewportSpec.name,
      mode: viewportSpec.mode,
      innerWidth: null,
      app: null,
      verdict: { pass: false, notes: [`error: ${err.message}`], overlaysChecked: [], othersChecked: [] },
    };
  } finally {
    await teardown();
  }
}

function printTable(rows) {
  const header = "| Viewport | innerWidth | Mode | #app left/width | Overlays checked | Verdict |";
  const sep = "| --- | --- | --- | --- | --- | --- |";
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    const appCell = row.app ? `${row.app.left.toFixed(1)} / ${row.app.width.toFixed(1)}` : "(none)";
    const overlaysCell = row.verdict.overlaysChecked.length ? row.verdict.overlaysChecked.join(", ") : "(none)";
    const verdictCell = row.verdict.pass ? "PASS" : `FAIL — ${row.verdict.notes.join("; ")}`;
    console.log(`| ${row.viewport} | ${row.innerWidth ?? "?"} | ${row.mode} | ${appCell} | ${overlaysCell} | ${verdictCell} |`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chromePath = resolveBrowser(args);
  if (!chromePath) {
    process.exit(2);
    return;
  }

  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true });
  }

  const root = path.resolve(import.meta.dirname, "..");
  let server;
  try {
    server = await startStaticServer(root, args.port);
  } catch (err) {
    console.error(`ERROR: could not start static server on port ${args.port}: ${err.message}`);
    process.exit(2);
    return;
  }
  const pageUrl = `http://127.0.0.1:${args.port}/mazeworld.html`;

  const rows = [];
  try {
    for (let i = 0; i < VIEWPORTS.length; i++) {
      const viewportSpec = VIEWPORTS[i];
      // A fresh devtools port per viewport — see roller-repro.mjs's own
      // comment: killing the previous viewport's Chrome process is not
      // synchronous with the port being released, so reusing one port
      // races the next viewport's connect against the dying browser.
      const row = await runViewport(viewportSpec, {
        chromePath,
        pageUrl,
        devtoolsPort: args.devtoolsPort + i,
        keepProfiles: args.keepProfiles,
        shotsDir: args.shots,
      });
      rows.push(row);
      // Give the previous viewport's process family time to fully exit
      // before the next launch — reduces contention-driven boot timeouts
      // on this machine (see the comment on the boot-ready wait above).
      await sleep(800);
    }
  } catch (err) {
    console.error(`ERROR: browser could not be driven: ${err.message}`);
    server.close();
    process.exit(2);
    return;
  } finally {
    server.close();
  }

  if (args.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    printTable(rows);
  }

  const passed = rows.filter((r) => r.verdict.pass).length;
  console.log(`letterbox-check: ${passed}/${rows.length} viewports passed (COLUMN_PX=${COLUMN_PX}, BREAKPOINT_PX=${BREAKPOINT_PX})`);
  process.exit(passed === rows.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
