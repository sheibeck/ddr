"use strict";
// The eight scenes: how the page is brought to each one, and what must be in frame.
//
// Every scene is { resume, run(page, ctx), spec(ctx), extra(page, ctx) }:
//   resume   true when the scene boots from a saved run (capture.js writes the save)
//   run      drives the real page to the scene; all waits are on DOM conditions
//   spec     the frame-guard spec (expected text, selectors, allowed overlays, layout)
//   extra    optional page-side checks that return [{ name, ok, detail }]
//
// ctx = { size, def, tablet, seed, seeds } where `seed` is seeds.json's entry for the
// scene. Saves are resumed (the shell revalidates them); states that carry an overlay
// (the store, the death panel) are injected and photographed. Nothing here edits a pixel
// or adds text: the page draws everything.
const SHOT_DEBUG = !!process.env.SHOTS_DEBUG;

const wait = (page, ms) => page.waitForTimeout(ms);

// ---------------------------------------------------------------- small helpers

const norm = (s) => String(s).replace(/\s+/g, " ").trim();

// A visible, enabled button whose normalised text equals (or starts with) the label.
function clickButton(page, label, prefix) {
  return page.evaluate(
    ({ label, prefix }) => {
      const n = (s) => String(s).replace(/\s+/g, " ").trim().toUpperCase();
      const want = n(label);
      const vis = (b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden";
      };
      const b = [...document.querySelectorAll("button")].filter((x) => vis(x) && !x.disabled).find((x) => {
        const t = n(x.innerText);
        return prefix ? t.startsWith(want) : t === want;
      });
      if (!b) return false;
      b.click();
      return true;
    },
    { label, prefix: !!prefix }
  );
}

async function waitButton(page, label, prefix, timeout) {
  await page.waitForFunction(
    ({ label, prefix }) => {
      const n = (s) => String(s).replace(/\s+/g, " ").trim().toUpperCase();
      const want = n(label);
      return [...document.querySelectorAll("button")].some((x) => {
        const r = x.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0) || x.disabled) return false;
        const t = n(x.innerText);
        return prefix ? t.startsWith(want) : t === want;
      });
    },
    { label, prefix: !!prefix },
    { timeout: timeout || 30000 }
  );
}

async function buttonLabels(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !b.disabled;
      })
      .map((b) => (b.id || b.className.split(" ")[0]) + ":" + b.innerText.trim().replace(/\s+/g, " ").slice(0, 40))
  );
}

// Resume a saved run: tap ENTER and wait for the map and a live state.
async function resume(page) {
  await page.evaluate(() => document.getElementById("mw-title-enter").click());
  await page.waitForFunction(
    () => {
      const s = window.__mzState && window.__mzState.get && window.__mzState.get();
      const maze = document.getElementById("maze");
      if (!(s && s.c && s.floor && maze)) return false;
      const r = maze.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    null,
    { timeout: 60000 }
  );
  await wait(page, 500);
}

// Inject a full state and redraw, with no rail card left standing.
async function inject(page, stateJson) {
  await page.evaluate((st) => {
    window.__mzState.set(JSON.parse(st));
    window.paint();
    if (window.draw) window.draw();
    if (window.mzCenterMap) window.mzCenterMap();
    if (window.renderEncounter) window.renderEncounter();
    window.__mzRail = Object.assign({}, window.__mzRail, { card: null, pending: null });
    window.renderRail();
  }, stateJson);
  await wait(page, 400);
}

async function clearRail(page) {
  await page.evaluate(() => {
    window.__mzRail = Object.assign({}, window.__mzRail, { card: null, pending: null });
    window.renderRail();
  });
}

async function showTab(page, name) {
  await page.evaluate((n) => window.__mzShowTab(n), name);
  await wait(page, 500);
}

async function stateOf(page) {
  return page.evaluate(() => {
    const s = window.__mzState.get();
    return { dead: !!s.dead, combat: !!s.combat, depth: s.floor && s.floor.depth, dev: s.dev === true, steps: s.steps };
  });
}

// ---------------------------------------------------------------- spec helpers

// What every scene shares: the layout class for the size, no stray overlay, no rail card.
function baseSpec(ctx, extra) {
  return Object.assign({ text: [], selectors: [], min: [], sheets: [], allowRail: false, layout: ctx.def.layoutClass }, extra || {});
}

// On a tablet the map has to stay up beside the panel.
function mapBesideOnTablet(ctx, spec) {
  if (ctx.tablet) spec.selectors = (spec.selectors || []).concat(["#maze"]);
  return spec;
}

const ABILITY_WORD = /READY IN \d+|READY · ONCE PER FIGHT|SPENT THIS FIGHT|READY/g;

// ------------------------------------------------------------------- the scenes

const SCENES = {};

SCENES.title = {
  resume: false,
  async run(page) {
    await wait(page, 300);
  },
  spec(ctx) {
    return baseSpec(ctx, { selectors: ["#mw-title-enter"], title: true });
  },
};

// Tap a combat button the way a thumb does: wait until the shell's own arm window has passed
// (window.__mzTapArmed) and no round is still playing, then click it. `find` is a selector or a
// button label prefix.
async function armedClick(page, find) {
  const arg = { find, label: !find.startsWith("#") };
  await page.waitForFunction((a) => {
    const n = (t) => String(t).replace(/\s+/g, " ").trim().toUpperCase();
    const el = a.label
      ? [...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().width > 0 && !b.disabled && n(b.innerText).startsWith(n(a.find)))
      : document.querySelector(a.find);
    if (!el || el.disabled) return false;
    if (window.__mzBeat && window.__mzBeat.active && window.__mzBeat.active()) return false;
    return !window.__mzTapArmed || window.__mzTapArmed(el) === true;
  }, arg, { timeout: 60000 });
  await page.evaluate((a) => {
    const n = (t) => String(t).replace(/\s+/g, " ").trim().toUpperCase();
    const el = a.label
      ? [...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().width > 0 && !b.disabled && n(b.innerText).startsWith(n(a.find)))
      : document.querySelector(a.find);
    el.click();
  }, arg);
}

// One round of the real fight has finished playing: the busy prompt is gone, the action area is
// back with its strike button, and the hero and the fight are both still standing.
async function roundSettled(page) {
  await page.waitForFunction(() => {
    const st = window.__mzState.get();
    if (!st || st.dead || !st.combat) return false;
    if (document.body.innerText.indexOf("THE DICE ARE STILL OUT") !== -1) return false;
    if (window.__mzBeat && window.__mzBeat.active && window.__mzBeat.active()) return false;
    return !!document.getElementById("cb-strike");
  }, null, { timeout: 60000 });
  await wait(page, 500);
}

async function openAbilities(page, key) {
  await armedClick(page, "#cb-spells");
  await page.waitForSelector("#cb-row-ability-" + key, { state: "visible", timeout: 30000 });
  await wait(page, 400);
}

SCENES.combat = {
  resume: true,
  async run(page, ctx) {
    const key = ctx.seed.abilityKey;
    await resume(page);
    await clearRail(page);
    await page.evaluate((d) => window.move(d), ctx.seed.dir);
    await waitButton(page, "FIGHT IT OUT", true, 30000);
    await wait(page, 400);
    await armedClick(page, "FIGHT IT OUT");
    await roundSettled(page);
    await openAbilities(page, key);
    // the saved ability: a real use of it, so its row reads a recharge afterwards
    await armedClick(page, "#cb-row-ability-" + key);
    await roundSettled(page);
    await armedClick(page, "#cb-strike");
    await roundSettled(page);
    await openAbilities(page, key);
    if (SHOT_DEBUG) console.log("  combat buttons", await buttonLabels(page));
  },
  spec(ctx) {
    const spec = baseSpec(ctx, { min: [{ selector: ".cb-log-entry, .cb-sum-line", n: 2 }] });
    // the foe cards and the ability rows are the shot's subject
    spec.selectors = [".cb-foe", ".cb-row"];
    return mapBesideOnTablet(ctx, spec);
  },
  // Real ability-state words from the game's own rows (never typed here), at least two distinct, one not plain READY;
  // the hero alive and the fight still running.
  async extra(page, ctx) {
    const info = await page.evaluate(() => {
      const vis = (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      };
      const words = [...document.querySelectorAll('[id^="cb-row-ability-"] .cb-row-cost')].filter(vis).map((e) => e.textContent.trim());
      const st = window.__mzState.get();
      return { words, dead: !!st.dead, combat: !!st.combat };
    });
    const distinct = [...new Set(info.words)];
    return [
      { name: "two distinct ability-state words, one not plain READY", ok: distinct.length >= 2 && distinct.some((w) => w !== "READY"), detail: distinct.join(" | ") },
      { name: "the hero is alive and the fight is still running", ok: !info.dead && info.combat, detail: "" },
    ];
  },
};

SCENES.deep = {
  resume: true,
  async run(page, ctx) {
    await resume(page);
    await showTab(page, "maze");
    await page.evaluate(() => window.mzCenterMap && window.mzCenterMap());
    await clearRail(page);
    await wait(page, 300);
  },
  spec(ctx) {
    return mapBesideOnTablet(ctx, baseSpec(ctx, { text: [String(ctx.seed.expect.depth)], selectors: ["#maze"] }));
  },
};

SCENES.achievements = {
  resume: true,
  async run(page, ctx) {
    await resume(page);
    await clearRail(page);
    await page.evaluate(() => window.mzOpenAchievements());
    await page.waitForFunction(() => {
      const s = document.getElementById("mw-achievements-sheet");
      return s && !s.hidden && document.querySelectorAll(".mw-ach-row").length > 0;
    }, null, { timeout: 30000 });
    await wait(page, 500);
    // Open the first track (its rungs show the earned date and the progress); the scroll stays at the top.
    await page.evaluate(() => {
      const head = document.querySelector("#mw-achievements-sheet button.mw-ach-head");
      if (head) head.click();
    });
    await wait(page, 500);
  },
  spec(ctx) {
    const e = ctx.seed.expect;
    return baseSpec(ctx, { text: e.text, sheets: ["mw-achievements-sheet"], min: [{ selector: ".mw-ach-rung", n: 3 }] });
  },
  async extra(page, ctx, report) {
    const t = report.text;
    return [
      { name: "an earned row shows its date", ok: /\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/.test(t), detail: "" },
      { name: "a progress fraction is in view", ok: /\b\d+ \/ \d+\b/.test(t), detail: "" },
      { name: "a locked row is in view", ok: /\bLocked\b/.test(t), detail: "" },
    ];
  },
};

SCENES.death = {
  resume: true,
  saveFrom: "deep",
  async run(page, ctx) {
    await resume(page);
    await inject(page, ctx.seed.state);
    await showTab(page, "maze");
    await page.evaluate((ids) => {
      window.__mzAchBanner.onEvent({ unlocks: ids.map((id, i) => ({ id, at: 1 + i })), reveals: [], progress: [] });
      window.paint();
    }, ctx.seed.stripIds);
    await page.waitForSelector("#cb-over-earned", { state: "visible", timeout: 20000 });
    await wait(page, 500);
  },
  spec(ctx) {
    const e = ctx.seed.expect;
    return baseSpec(ctx, { text: e.text.concat([e.epitaph]), selectors: ["#cb-over-earned"] });
  },
};

SCENES.hero = {
  resume: true,
  async run(page, ctx) {
    await resume(page);
    await clearRail(page);
    await showTab(page, "hero");
    await wait(page, 400);
    // Scroll the hero screen to its first flavour line (the skills and abilities block), a
    // little below the top so its heading shows. The scroller is found, never assumed.
    await page.evaluate((lines) => {
      const sq = (t) => String(t).replace(/\s+/g, " ").trim();
      const want = new Set(lines.map(sq));
      const screen = document.getElementById("screen-hero");
      const hits = [...screen.querySelectorAll("*")].filter((e) => e.children.length === 0 && want.has(sq(e.textContent)));
      if (!hits.length) return;
      hits.sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top);
      const el = hits[0];
      let sc = el.parentElement;
      while (sc && !(/auto|scroll/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight + 2)) sc = sc.parentElement;
      if (!sc) return;
      const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      sc.scrollTop += top - 120;
    }, ctx.seed.expect.text);
    await wait(page, 400);
  },
  spec(ctx) {
    return mapBesideOnTablet(ctx, baseSpec(ctx));
  },
  // At least two of the game's own flavour lines have to be readable in the frame.
  async extra(page, ctx, report) {
    const sq = (t) => String(t).normalize("NFC").replace(/\s+/g, " ").trim();
    const seen = ctx.seed.expect.text.filter((l) => report.text.includes(sq(l)));
    return [{ name: "at least two flavour lines in view", ok: seen.length >= 2, detail: seen.length + " in view" }];
  },
};

SCENES.store = {
  resume: true,
  saveFrom: "deep",
  async run(page, ctx) {
    await resume(page);
    await inject(page, ctx.seed.state);
    await wait(page, 400);
  },
  spec(ctx) {
    return baseSpec(ctx);
  },
};

SCENES.board = {
  resume: true,
  async run(page, ctx) {
    await resume(page);
    await clearRail(page);
    await showTab(page, "dead");
    await page.waitForFunction(() => document.querySelectorAll(".mw-lb-row").length >= 6, null, { timeout: 30000 });
    await wait(page, 400);
  },
  spec(ctx) {
    return mapBesideOnTablet(ctx, baseSpec(ctx, { text: ctx.seed.expect.text, min: [{ selector: ".mw-lb-row", n: 6 }] }));
  },
};

module.exports = { SCENES, helpers: { clickButton, waitButton, buttonLabels, resume, inject, clearRail, showTab, stateOf, norm, ABILITY_WORD } };
