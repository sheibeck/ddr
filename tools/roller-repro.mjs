#!/usr/bin/env node
// tools/roller-repro.mjs
//
// Phase 50 / ROLL-01 / SC3 — dependency-free headless-Chrome repro driver
// for the character roller's "reels shown === Hero tab shown" contract.
// Node 22 built-ins ONLY: node:http + node:fs + node:path + node:os +
// node:child_process + the global WebSocket (Chrome DevTools Protocol) —
// no playwright, no puppeteer, no npm install. In the tools/shell-boot-
// check.mjs mould (static server + resolved local Chrome/Edge binary),
// but this driver INTERACTS with the live page over CDP instead of a
// single --dump-dom snapshot: it clicks buttons, waits for reveal, reads
// reel/Hero-tab text, and compares.
//
// Usage:
//   node tools/roller-repro.mjs [--chrome <path>] [--port <n>]
//     [--devtools-port <n>] [--scenario normal|double-tap|play-again|
//     play-again-mid-reveal|all] [--json] [--keep-profiles]
//
// Behaviour:
//   1. Serve the REPO ROOT on 127.0.0.1:<port> (default 8766) — the page
//      URL is http://127.0.0.1:<port>/mazeworld.html. No import map is
//      needed: storage.js's Capacitor imports sit behind isNativePlatform()
//      so the plain browser dev loop never touches them.
//   2. Resolve a local Chrome/Edge binary (--chrome, else $CHROME, else the
//      two default Windows install paths).
//   3. For each scenario: a fresh --user-data-dir profile (a cold, save-
//      less boot every time — no localStorage save survives a scenario),
//      spawn headless, connect over the Chrome DevTools Protocol via the
//      global WebSocket, drive the scenario's click/wait sequence, read
//      the reels + the Hero tab, and record a row.
//   4. Print a markdown table (or --json) with one row per scenario, then
//      a summary line. Exit 0 iff every row matched, 1 if any row
//      mismatched (or the page threw an uncaught exception mid-scenario),
//      2 if the browser could not be resolved or driven at all (the
//      stderr reason is the fallback signal the SUMMARY must quote).
//
// This tool adds NOTHING to the app — no permanent console trace, no dev
// Oracle line. It drives the page only through existing DOM ids and the
// globals the shell already exposes: window.__mzState.get()/set(),
// window.paint(), window.mzReturnToTitle(), window.mzStartRoll().

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

const ALL_SCENARIOS = ["normal", "double-tap", "play-again", "play-again-mid-reveal"];

function parseArgs(argv) {
  const args = {
    port: 8766,
    devtoolsPort: 9333,
    scenario: "all",
    json: false,
    keepProfiles: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chrome") args.chrome = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--devtools-port") args.devtoolsPort = Number(argv[++i]);
    else if (a === "--scenario") args.scenario = argv[++i];
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

// A tiny Chrome DevTools Protocol client over Node 22's built-in WebSocket.
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

  async waitFor(expression, timeoutMs, label) {
    const start = Date.now();
    for (;;) {
      const value = await this.evaluate(expression);
      if (value) return value;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`timeout waiting for ${label}`);
      }
      await sleep(100);
    }
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

function killProcessTree(child) {
  if (!child) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill();
    }
  } catch {
    /* ignore */
  }
}

async function launchAndConnect({ chromePath, pageUrl, devtoolsPort, keepProfiles }) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "mz-roller-"));
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

  let entry;
  try {
    entry = await waitForDevtoolsPage(devtoolsPort, pageUrl, 15000);
  } catch (err) {
    killProcessTree(child);
    if (!keepProfiles) fs.rmSync(profileDir, { recursive: true, force: true });
    throw err;
  }

  const ws = new WebSocket(entry.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CdpClient(ws);
  await cdp.send("Runtime.enable");

  async function teardown() {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    killProcessTree(child);
    if (!keepProfiles) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch {
        /* ignore */
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
  clickId: (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.click(); return true; })()`,
  rollerRevealed: `(() => {
    const cta = document.getElementById("mw-roller-cta");
    const screen = document.getElementById("mw-roller-screen");
    return !!(cta && cta.disabled === false && cta.textContent.trim() === "DESCEND" && screen && screen.hidden === false);
  })()`,
  readReels: `(() => ({
    race: (document.getElementById("mw-roller-race") || {}).textContent?.trim() || "",
    cls: (document.getElementById("mw-roller-class") || {}).textContent?.trim() || "",
    sub: (document.getElementById("mw-roller-sub") || {}).textContent?.trim() || "",
    name: (document.getElementById("mw-roller-name") || {}).textContent?.trim() || "",
    quirk: (document.getElementById("mw-roller-quirk") || {}).textContent?.trim() || "",
  }))()`,
  clickHeroTab: `(() => {
    const el = document.querySelector('button.mw-tab[data-tab="hero"]');
    if (!el) return false;
    el.click();
    return true;
  })()`,
  readHero: `(() => {
    const st = window.__mzState.get();
    const c = st && st.c ? st.c : {};
    return {
      sName: (document.getElementById("s-name") || {}).textContent?.trim() || "",
      sTag: (document.getElementById("s-tag") || {}).textContent?.trim() || "",
      dossWho: (document.getElementById("doss-who") || {}).textContent?.trim() || "",
      c: { race: c.race || "", cls: c.cls || "", sub: c.sub || "", name: c.name || "" },
    };
  })()`,
  markDead: `(() => {
    const s = window.__mzState.get();
    s.dead = true;
    window.__mzState.set(s);
    window.paint();
    return true;
  })()`,
  returnToTitle: `(() => { window.mzReturnToTitle(); return true; })()`,
  startRollAgain: `(() => { window.mzStartRoll(); return true; })()`,
};

function heroTagFor(reels) {
  return `${reels.race} ${reels.sub} · ${reels.cls}`;
}

function computeMatch(reels, hero) {
  return (
    reels.race === hero.c.race &&
    reels.cls === hero.c.cls &&
    reels.sub === hero.c.sub &&
    reels.name === hero.c.name &&
    hero.sName === reels.name &&
    hero.sTag === heroTagFor(reels)
  );
}

async function runScenario(name, { chromePath, pageUrl, devtoolsPort, keepProfiles }) {
  const { cdp, teardown } = await launchAndConnect({ chromePath, pageUrl, devtoolsPort, keepProfiles });
  const notes = [];
  try {
    let reels;
    let hero;
    let match;

    if (name === "normal") {
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed");
      await sleep(300);
      reels = await cdp.evaluate(EXPR.readReels);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.clickHeroTab);
      await sleep(300);
      hero = await cdp.evaluate(EXPR.readHero);
      match = computeMatch(reels, hero);
    } else if (name === "double-tap") {
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await sleep(80);
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      const firstReveal = await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed");
      const reelsFirst = firstReveal ? await cdp.evaluate(EXPR.readReels) : null;
      await sleep(3300);
      reels = await cdp.evaluate(EXPR.readReels);
      const changed = reelsFirst
        ? JSON.stringify(reelsFirst) !== JSON.stringify(reels)
        : false;
      notes.push(`reels changed after reveal: ${changed ? "yes" : "no"}`);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.clickHeroTab);
      await sleep(300);
      hero = await cdp.evaluate(EXPR.readHero);
      match = computeMatch(reels, hero);
    } else if (name === "play-again") {
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed (first roll)");
      await sleep(300);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.markDead);
      await cdp.evaluate(EXPR.returnToTitle);
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready (after death)");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed (play again)");
      await sleep(300);
      reels = await cdp.evaluate(EXPR.readReels);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.clickHeroTab);
      await sleep(300);
      hero = await cdp.evaluate(EXPR.readHero);
      match = computeMatch(reels, hero);
    } else if (name === "play-again-mid-reveal") {
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed (first roll)");
      await sleep(300);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.markDead);
      await cdp.evaluate(EXPR.returnToTitle);
      await cdp.waitFor(EXPR.titleReady, 15000, "title ready (after death)");
      await cdp.evaluate(EXPR.clickId("mw-title-enter"));
      await sleep(1000);
      const reelsBeforeSupersede = await cdp.evaluate(EXPR.readReels);
      await cdp.evaluate(EXPR.startRollAgain);
      await cdp.waitFor(EXPR.rollerRevealed, 20000, "roller revealed (mid-reveal supersede)");
      await sleep(3300);
      reels = await cdp.evaluate(EXPR.readReels);
      const changed = JSON.stringify(reelsBeforeSupersede) !== JSON.stringify(reels);
      notes.push(`reels changed after reveal: ${changed ? "yes" : "no"}`);
      await cdp.evaluate(EXPR.clickId("mw-roller-cta"));
      await sleep(300);
      await cdp.evaluate(EXPR.clickHeroTab);
      await sleep(300);
      hero = await cdp.evaluate(EXPR.readHero);
      match = computeMatch(reels, hero);
    } else {
      throw new Error(`unknown scenario: ${name}`);
    }

    if (cdp.exceptions.length) {
      match = false;
      notes.push(`uncaught exception(s): ${cdp.exceptions.join(" | ")}`);
    }

    return { scenario: name, reels, hero, match, notes };
  } catch (err) {
    return {
      scenario: name,
      reels: null,
      hero: null,
      match: false,
      notes: [`error: ${err.message}`, ...(cdp.exceptions.length ? [`uncaught exception(s): ${cdp.exceptions.join(" | ")}`] : [])],
    };
  } finally {
    await teardown();
  }
}

function printTable(rows) {
  const header =
    "| Scenario | Reels shown (race / class / sub · name) | Hero tab shown (#s-tag · #s-name) | state.c (race / cls / sub · name) | Match? | Notes |";
  const sep = "| --- | --- | --- | --- | --- | --- |";
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    const reelsCell = row.reels
      ? `${row.reels.race} / ${row.reels.cls} / ${row.reels.sub} · ${row.reels.name}`
      : "(none)";
    const heroCell = row.hero ? `${row.hero.sTag} · ${row.hero.sName}` : "(none)";
    const cCell = row.hero
      ? `${row.hero.c.race} / ${row.hero.c.cls} / ${row.hero.c.sub} · ${row.hero.c.name}`
      : "(none)";
    const matchCell = row.match ? "yes" : "NO";
    const notesCell = row.notes.length ? row.notes.join("; ") : "";
    console.log(`| ${row.scenario} | ${reelsCell} | ${heroCell} | ${cCell} | ${matchCell} | ${notesCell} |`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chromePath = resolveBrowser(args);
  if (!chromePath) {
    process.exit(2);
    return;
  }

  const scenarios = args.scenario === "all" ? ALL_SCENARIOS : [args.scenario];
  for (const s of scenarios) {
    if (!ALL_SCENARIOS.includes(s)) {
      console.error(`ERROR: unknown --scenario "${s}". Expected one of: ${ALL_SCENARIOS.join(", ")}, all`);
      process.exit(2);
      return;
    }
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
    for (const name of scenarios) {
      const row = await runScenario(name, {
        chromePath,
        pageUrl,
        devtoolsPort: args.devtoolsPort,
        keepProfiles: args.keepProfiles,
      });
      rows.push(row);
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

  const matched = rows.filter((r) => r.match).length;
  console.log(`roller-repro: ${matched}/${rows.length} matched`);
  process.exit(matched === rows.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
