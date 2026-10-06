"use strict";
// What is in frame, decided mechanically, and what must never be.
//
//   attachGuards(context, origin)  abort and record every request that leaves the origin,
//                                  collect page errors and failed same-origin requests
//   visibleText(page)              the text a person could read in the viewport, NFC, one line
//   frameReport(page, guards, spec) every generic check plus the scene's own, as a list
//   node frame-guard.js --self-test proves each guard on small pages in the installed Chrome
//
// Text counts only when its box intersects the viewport (after every scrolling
// or clipping ancestor) and no ancestor hides it. The expected strings come in
// through `spec`, computed by seed.mjs from the game's own copy modules; none
// is typed here. This file touches playwright-core only through the page and
// context objects it is handed (the self-test launches the browser itself).

const NFC = (s) => String(s).normalize("NFC");
const squash = (s) => NFC(s).replace(/\s+/g, " ").trim();
const noSpace = (s) => NFC(s).replace(/\s+/g, "");

// ---------------------------------------------------------------- request guard

/**
 * attachGuards(context, origin) — every request that is not the origin, data:,
 * blob: or about: is aborted and its URL recorded in `blocked`. Page errors
 * and console errors land in `errors`; same-origin requests that fail or come
 * back with a status of 400 or more land in `failed`. Await it: the route is
 * installed before it returns.
 */
async function attachGuards(context, origin) {
  const blocked = [];
  const errors = [];
  const failed = [];
  const isLocal = (url) => url === origin || url.startsWith(origin + "/");
  const isInline = (url) => /^(data|blob|about):/i.test(url);

  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (isLocal(url) || isInline(url)) return route.continue();
    blocked.push(url);
    return route.abort();
  });

  const watch = (page) => {
    page.on("pageerror", (e) => errors.push("pageerror: " + (e && e.message ? e.message : String(e))));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const loc = msg.location();
      // The browser's own line about an aborted request is already in `blocked`.
      if (loc && loc.url && blocked.includes(loc.url)) return;
      errors.push("console: " + msg.text());
    });
  };
  for (const page of context.pages()) watch(page);
  context.on("page", watch);
  context.on("requestfailed", (req) => {
    if (isLocal(req.url())) failed.push(req.url() + " " + ((req.failure() && req.failure().errorText) || "failed"));
  });
  context.on("response", (res) => {
    if (isLocal(res.url()) && res.status() >= 400) failed.push(res.url() + " status " + res.status());
  });

  return {
    blocked,
    errors,
    failed,
    reset() {
      blocked.length = 0;
      errors.length = 0;
      failed.length = 0;
    },
  };
}

// ------------------------------------------------------------ the page-side probe

// Runs inside the page. Self-contained: it is serialised by page.evaluate.
function probe(arg) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const inView = (r) => r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh && r.width > 0 && r.height > 0;

  // A rect clipped by every ancestor that scrolls or clips; null when nothing is left.
  const clipped = (rect, el) => {
    let r = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || cs.opacity === "0") return null;
      if (a.hidden && cs.display === "none") return null;
      const clips = (v) => v !== "visible";
      if (a !== document.body && (clips(cs.overflowX) || clips(cs.overflowY))) {
        const b = a.getBoundingClientRect();
        if (clips(cs.overflowX)) {
          r.left = Math.max(r.left, b.left);
          r.right = Math.min(r.right, b.right);
        }
        if (clips(cs.overflowY)) {
          r.top = Math.max(r.top, b.top);
          r.bottom = Math.min(r.bottom, b.bottom);
        }
      }
    }
    r.width = r.right - r.left;
    r.height = r.bottom - r.top;
    return r.width > 0 && r.height > 0 ? r : null;
  };

  const elementVisible = (el) => {
    if (!el) return false;
    const r = clipped(el.getBoundingClientRect(), el);
    return !!r && inView(r);
  };

  // Visible text, in document order.
  const pieces = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const value = n.nodeValue;
    if (!value || !value.trim()) continue;
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
    range.selectNodeContents(n);
    let seen = false;
    for (const rect of range.getClientRects()) {
      const r = clipped(rect, parent);
      if (r && inView(r)) {
        seen = true;
        break;
      }
    }
    if (seen) pieces.push(value);
  }

  const devEls = [...document.querySelectorAll('[id^="mw-dev-"]')].map((el) => ({ id: el.id, visible: elementVisible(el) }));

  let stateDev = null;
  try {
    const s = window.__mzState && window.__mzState.get ? window.__mzState.get() : null;
    stateDev = s && typeof s === "object" ? s.dev === true : null;
  } catch (e) {
    stateDev = null;
  }

  // A sheet is a panel, not a control: the death panel's own FINAL SHEET button is `btn-death-sheet`.
  const sheets = [...document.querySelectorAll('[id$="-sheet"]')].filter((el) => !/^(BUTTON|A|INPUT)$/.test(el.tagName)).filter(elementVisible).map((el) => el.id);

  let rail = { up: false, kind: null, title: "" };
  const railEl = document.getElementById("mw-rail");
  if (railEl && elementVisible(railEl)) {
    const titleEl = document.getElementById("mw-rail-title");
    const title = titleEl ? titleEl.textContent.trim() : "";
    const idle = railEl.dataset.idle === "1";
    rail = { up: !idle && title.length > 0, kind: railEl.dataset.cardKind || null, title };
  }

  // The title and the roller are full-screen layers: if either is up, whatever is behind it is not the shot.
  const cover = ["mw-title-screen", "mw-roller-screen"].filter((id) => elementVisible(document.getElementById(id)));

  const imgs = [...document.images].filter(elementVisible).map((im) => ({ src: im.currentSrc || im.src, ok: im.complete && im.naturalWidth > 0 }));

  const selectors = (arg.selectors || []).map((sel) => ({ sel, n: [...document.querySelectorAll(sel)].filter(elementVisible).length }));
  const mins = (arg.min || []).map((m) => ({ sel: m.selector, need: m.n, n: [...document.querySelectorAll(m.selector)].filter(elementVisible).length }));

  return {
    pieces,
    devEls,
    stateDev,
    sheets,
    rail,
    cover,
    imgs,
    layout: document.documentElement.dataset.mwLayout || null,
    selectors,
    mins,
    viewport: [vw, vh],
  };
}

async function snapshot(page, spec) {
  return page.evaluate(probe, { selectors: (spec && spec.selectors) || [], min: (spec && spec.min) || [] });
}

/** visibleText(page) — the readable text in the viewport, NFC, whitespace collapsed. */
async function visibleText(page) {
  const snap = await snapshot(page, null);
  return squash(snap.pieces.join(" "));
}

// ------------------------------------------------------------------ the report

/**
 * frameReport(page, guards, spec) — { ok, failures, checks, text, allowedBlocked }.
 * spec: { text: [], selectors: [], min: [{ selector, n }], sheets: [ids],
 * allowRail: false | true | "achievement", allowBlocked: [{ url, reason }],
 * layout: "compact" | ... }. Every check is listed with its pass or fail so the
 * manifest can record it.
 */
async function frameReport(page, guards, spec) {
  const sp = spec || {};
  const snap = await snapshot(page, sp);
  const text = squash(snap.pieces.join(" "));
  const tight = noSpace(snap.pieces.join(" "));
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || "" });

  const devUp = snap.devEls.filter((d) => d.visible).map((d) => d.id);
  add("no dev UI in frame", devUp.length === 0, devUp.join(", "));
  add("the run is not a dev run", snap.stateDev !== true, snap.stateDev === true ? "state.dev is true" : "");
  const devLine = /\bA dev run\b/i.exec(text);
  add("no dev-run log line in frame", !devLine, devLine ? devLine[0] : "");

  const allowedSheets = new Set(sp.sheets || []);
  const strays = snap.sheets.filter((id) => !allowedSheets.has(id));
  add("no unexpected sheet is up", strays.length === 0, strays.join(", "));
  const missingSheets = [...allowedSheets].filter((id) => !snap.sheets.includes(id));
  if (allowedSheets.size) add("every expected sheet is up", missingSheets.length === 0, missingSheets.join(", "));

  const allow = sp.allowRail === true ? "any" : sp.allowRail === "achievement" ? "achievement" : "none";
  const achievementUp = snap.rail.up && snap.rail.kind === "achievement";
  add("no unexpected achievement card", !achievementUp || allow === "any" || allow === "achievement", achievementUp ? snap.rail.title : "");
  add("no unexpected rail card", !snap.rail.up || achievementUp || allow === "any", snap.rail.up && !achievementUp ? snap.rail.title : "");

  const covers = sp.title === true ? [] : snap.cover;
  add("no title or roller screen covers the frame", covers.length === 0, covers.join(", "));

  const brokenImgs = snap.imgs.filter((i) => !i.ok).map((i) => i.src);
  add("every visible image is decoded", brokenImgs.length === 0, brokenImgs.join(", "));

  const allowedBlocked = [];
  const strayBlocked = [];
  for (const url of guards.blocked) {
    const rule = (sp.allowBlocked || []).find((a) => url.includes(a.url));
    if (rule) allowedBlocked.push({ url, reason: rule.reason });
    else strayBlocked.push(url);
  }
  add("no request left the origin", strayBlocked.length === 0, strayBlocked.join(", "));
  add("no page error", guards.errors.length === 0, guards.errors.join(" | "));
  add("no same-origin request failed", guards.failed.length === 0, guards.failed.join(" | "));

  if (sp.layout) add("layout class matches the size", snap.layout === sp.layout, `page says ${snap.layout}, size says ${sp.layout}`);

  for (const want of sp.text || []) {
    const w = squash(want);
    const inText = text.includes(w);
    const inTight = !inText && tight.includes(noSpace(w));
    add("text in frame: " + w.slice(0, 60), inText || inTight, inTight ? "matched with spacing ignored" : "");
  }
  for (const s of snap.selectors) add("selector visible: " + s.sel, s.n >= 1, `${s.n} visible`);
  for (const m of snap.mins) add(`at least ${m.need} visible: ${m.sel}`, m.n >= m.need, `${m.n} visible`);

  const failures = checks.filter((c) => !c.ok).map((c) => c.name + (c.detail ? " (" + c.detail + ")" : ""));
  return { ok: failures.length === 0, failures, checks, text, allowedBlocked, viewport: snap.viewport };
}

// ------------------------------------------------------------------- self-test

async function selfTest() {
  const { chromium } = require("playwright-core");
  const { launchOptions } = require("./config.js");
  let n = 0;
  const bad = (msg) => {
    console.error("SELF-TEST FAIL: " + msg);
    process.exitCode = 1;
  };
  const expect = (label, cond, extra) => {
    n += 1;
    if (!cond) {
      bad(label + (extra ? " " + extra : ""));
      throw new Error("self-test failed: " + label);
    }
  };

  let browser;
  try {
    browser = await chromium.launch(launchOptions());
  } catch (e) {
    console.error("Cannot launch Chrome: " + e.message);
    console.error("Set CHROME_PATH to chrome.exe, or install Chrome. Stopping: this is a blocker, not a test result.");
    process.exit(2);
  }
  try {
    const context = await browser.newContext({ viewport: { width: 400, height: 600 } });
    const guards = await attachGuards(context, "http://127.0.0.1:8765");
    const page = await context.newPage();
    const run = async (html, spec) => {
      guards.reset();
      await page.setContent(html);
      return frameReport(page, guards, spec || {});
    };
    const failed = (r, needle) => !r.ok && r.failures.some((f) => f.includes(needle));

    // 1. a visible dev chip is flagged, a hidden one is not
    let r = await run('<main>Hello</main><span id="mw-dev-chip">DEV</span>');
    expect("a visible mw-dev-chip is flagged", failed(r, "no dev UI in frame"), r.failures.join("; "));
    r = await run('<main>Hello</main><span id="mw-dev-chip" hidden>DEV</span><div id="mw-dev-row" style="display:none">x</div>');
    expect("a hidden mw-dev-chip is not flagged", r.ok, r.failures.join("; "));

    // 2. composed and decomposed spellings match, both ways round
    const composed = "Café Zoë";
    const decomposed = "Café Zoë";
    r = await run(`<p>${composed}</p>`, { text: [decomposed] });
    expect("a decomposed expectation matches composed page text", r.ok, r.failures.join("; "));
    r = await run(`<p>${decomposed}</p>`, { text: [composed] });
    expect("a composed expectation matches decomposed page text", r.ok, r.failures.join("; "));

    // 3. the middle dot and collapsed whitespace
    r = await run("<button>1   ·\n STRIKE</button><span>READY · ONCE PER FIGHT</span>", { text: ["1 · STRIKE", "READY · ONCE PER FIGHT"] });
    expect("the middle dot and collapsed whitespace match", r.ok, r.failures.join("; "));
    r = await run("<p>nothing to see</p>", { text: ["something else"] });
    expect("a missing string fails", failed(r, "text in frame"), r.failures.join("; "));

    // 4. an off-origin request is aborted and recorded, and the frame fails
    r = await run('<p>pic</p><img src="http://blocked.example.test/x.png" width="20" height="20">');
    await page.waitForTimeout(250);
    r = await frameReport(page, guards, {});
    expect("an off-origin request is recorded", guards.blocked.some((u) => u.startsWith("http://blocked.example.test/")), JSON.stringify(guards.blocked));
    expect("an off-origin request fails the frame", failed(r, "no request left the origin"), r.failures.join("; "));
    r = await frameReport(page, guards, { allowBlocked: [{ url: "blocked.example.test", reason: "self-test allowance" }] });
    expect("an allowed block is listed with its reason, not hidden", r.allowedBlocked.length === 1 && r.allowedBlocked[0].reason === "self-test allowance", JSON.stringify(r.allowedBlocked));

    // 5. a line scrolled out of the viewport is not counted, and counts once scrolled in
    await page.setContent('<div style="height:2400px">top</div><p id="low">Far Below Line</p>');
    let t = await visibleText(page);
    expect("a line scrolled below the viewport is not visible", !t.includes("Far Below Line") && t.includes("top"), t);
    await page.evaluate(() => document.getElementById("low").scrollIntoView());
    t = await visibleText(page);
    expect("the same line scrolled into view is visible", t.includes("Far Below Line"), t);

    // 6. text clipped inside a scroll box is not counted
    await page.setContent('<div style="height:30px;overflow:auto"><p>First Row</p><p style="margin-top:400px">Hidden In Box</p></div>');
    t = await visibleText(page);
    expect("text clipped by a scrolling box is not visible", t.includes("First Row") && !t.includes("Hidden In Box"), t);

    // 7. a hidden ancestor hides its text
    await page.setContent('<div hidden><p>Under Hidden</p></div><div style="visibility:hidden"><p>Under Invisible</p></div><p>Plain</p>');
    t = await visibleText(page);
    expect("text under a hidden ancestor is not visible", t === "Plain", t);

    // 8. a page error is caught
    guards.reset();
    await page.setContent("<p>boom</p>");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("planted failure");
      }, 0);
    });
    await page.waitForTimeout(150);
    r = await frameReport(page, guards, {});
    expect("a page error is caught and fails the frame", guards.errors.length >= 1 && failed(r, "no page error"), r.failures.join("; "));

    // 9. an unexpected sheet, then an expected one
    r = await run('<div id="mw-stray-sheet" style="width:200px;height:100px">stray</div>');
    expect("an unexpected sheet fails the frame", failed(r, "no unexpected sheet is up"), r.failures.join("; "));
    r = await run('<div id="mw-stray-sheet" style="width:200px;height:100px">stray</div>', { sheets: ["mw-stray-sheet"] });
    expect("an expected sheet passes", r.ok, r.failures.join("; "));

    // 10. a surprise achievement card on the rail
    const railHtml = '<div id="mw-rail" data-idle="0" data-card-kind="achievement" style="width:200px;height:60px"><span id="mw-rail-title">ACHIEVEMENT</span></div>';
    r = await run(railHtml);
    expect("an unexpected achievement card fails the frame", failed(r, "no unexpected achievement card"), r.failures.join("; "));
    r = await run(railHtml, { allowRail: "achievement" });
    expect("an allowed achievement card passes", r.ok, r.failures.join("; "));

    // 11. the live state's dev flag
    r = await run('<p>x</p><script>window.__mzState = { get() { return { dev: true }; } };<\/script>');
    expect("a dev state fails the frame", failed(r, "the run is not a dev run"), r.failures.join("; "));
    r = await run("<p>A dev run. The graveyard has agreed to look the other way.</p>");
    expect("the dev-run log line fails the frame", failed(r, "no dev-run log line in frame"), r.failures.join("; "));

    // 12. layout class and selector counts
    await page.setContent('<p class="row">a</p><p class="row">b</p><p class="row" hidden>c</p>');
    await page.evaluate(() => {
      delete window.__mzState; // the window outlives setContent
      document.documentElement.dataset.mwLayout = "compact";
    });
    r = await frameReport(page, guards, { layout: "expanded", selectors: [".row", ".nothing"], min: [{ selector: ".row", n: 2 }, { selector: ".row", n: 3 }] });
    expect("a wrong layout class fails", failed(r, "layout class matches the size"), r.failures.join("; "));
    expect("a missing selector fails", failed(r, "selector visible: .nothing"), r.failures.join("; "));
    expect("a hidden element does not count towards a minimum", failed(r, "at least 3 visible") && !failed(r, "at least 2 visible"), r.failures.join("; "));
    r = await frameReport(page, guards, { layout: "compact", selectors: [".row"], min: [{ selector: ".row", n: 2 }] });
    expect("the right layout class and counts pass", r.ok, r.failures.join("; "));

    // 13. a broken image is flagged
    r = await run('<img src="data:image/png;base64,AAAA" width="20" height="20">');
    expect("an undecodable image fails the frame", failed(r, "every visible image is decoded"), r.failures.join("; "));

    await context.close();
    console.log("frame-guard self-test: " + n + " cases passed");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    console.error("usage: node frame-guard.js --self-test");
    process.exit(2);
  }
}

module.exports = { attachGuards, visibleText, frameReport };
