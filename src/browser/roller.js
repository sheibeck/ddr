// src/browser/roller.js
//
// Phase 50 (ROLL-01) — the character-roll screen ("THE TABLES DECIDE"): one
// real engine roll per start(), a cosmetic reel flicker that locks in
// sequence on the REAL rolled race/class/sub-class/name/quirk, and a CTA
// that commits exactly the state the reels showed. Contract:
// createRoller(options) — see docs/SHELL-MODULES.md. No window/document
// globals: the injected doc + deps only.
//
// Closes two structural weaknesses the Phase 50 scout found in the inline
// mazeworld.html roller block this module replaces (Plan 03 swaps the
// mount): (1) un-guarded re-entry — overlapping start() calls each pushed
// their own lock/reveal timers, and a first roll's awaited `startNewRun`
// could resolve after a second roll had already reset the screen; fixed by
// a monotonic roll token (`rollSeq`) checked before every write, plus a
// serialized `startNewRun` promise chain so the adapter is never asked to
// roll twice concurrently. (2) the reels locking on a `sheet` captured once
// at await time while the CTA committed `rollerPendingState` — identical
// only by construction; fixed by having every lock step AND the reveal read
// `sheetFor(rollerPendingState)` fresh, inside their own timer callback, and
// by having `commit()` hand `onCommit` that same object.

import { RACES, CLASSES } from "../../content/index.js";

// ─── frozen tables ──────────────────────────────────────────────────────

export const ROLLER_IDS = Object.freeze({
  screen: "mw-roller-screen",
  cta: "mw-roller-cta",
  reveal: "mw-roller-reveal",
  name: "mw-roller-name",
  quirk: "mw-roller-quirk",
  race: "mw-roller-race",
  cls: "mw-roller-class",
  sub: "mw-roller-sub",
});

// Matches design/Mazeworld Mobile.dc.html's own startRoll() timeline exactly
// (900/1650/2400ms lock steps, 3050ms full reveal, 70ms flicker) — unchanged
// from the inline block this module replaces.
export const ROLLER_TIMELINE = Object.freeze({
  lock: Object.freeze({ race: 900, cls: 1650, sub: 2400 }),
  reveal: 3050,
  spin: 70,
});

export const ROLLER_COPY = Object.freeze({
  falling: "THE DICE ARE STILL FALLING",
  ready: "DESCEND",
});

export const ROLLER_CSS = Object.freeze({
  locked: "mw-roller-locked",
  revealed: "mw-roller-revealed",
  ready: "mw-roller-ready",
});

/**
 * reelWordLists() — the cosmetic reel-flicker word lists, built from
 * content/index.js's read-only race/class/subclass tables. Cosmetic strings
 * only, never fed into the engine or any rng draw — the REAL race/class/
 * subclass shown once each reel locks comes from sheetFor(rollerPendingState)
 * inside createRoller, reading the actual GameState the engine already
 * rolled.
 */
export function reelWordLists() {
  return {
    race: Object.keys(RACES),
    cls: Object.keys(CLASSES),
    sub: Object.values(CLASSES).flatMap((cls) => cls.subs),
  };
}

// ─── module-private helpers ─────────────────────────────────────────────

function noop() {}

function pickDisplay(list, random) {
  return list[Math.floor(random() * list.length)];
}

function setReel(doc, id, value, locked) {
  const el = doc.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.classList.toggle(ROLLER_CSS.locked, !!locked);
}

// Display-only global timers by default — the engine's real rng is never
// read here (the same invariant the inline block's own pickDisplay carried:
// presentation must never touch GameState.rngState). Tests inject
// deterministic timers and a deterministic `random` instead.
function defaultTimers() {
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };
}

/**
 * createRoller(options) — the roller screen's presentation seam.
 *
 * options:
 *   doc         — the document to read/write ids through (never a global).
 *   startNewRun — the injected roll function, called with no arguments;
 *                 returns a Promise<GameState> (the adapter's real seam).
 *   sheetFor    — the injected view-model reader, e.g.
 *                 characterSheetViewModel(state) -> { raceLabel, classLabel,
 *                 subLabel, name, quirk: { text } }.
 *   onCommit    — called with the committed GameState once the CTA fires.
 *   timers      — { setTimeout, clearTimeout, setInterval, clearInterval };
 *                 defaults to the bare global timer functions.
 *   random      — a () => number in [0, 1); defaults to the global random
 *                 source.
 *   words       — { race, cls, sub } cosmetic word lists; defaults to
 *                 reelWordLists().
 *
 * Returns Object.freeze({ start, commit, pending, dispose }).
 */
export function createRoller(options) {
  const { doc, startNewRun, sheetFor, onCommit, timers = defaultTimers(), random = Math.random, words = reelWordLists() } = options;

  // The monotonic roll token: a resolution or timer callback carrying a
  // stale token is dropped before it touches the reels or rollerPendingState.
  let rollSeq = 0;
  // The serialized roll chain — a second start() while the first is
  // unresolved chains behind it, so the injected roll function is never in
  // flight twice, and the adapter's currentState (the persisted save) after
  // the LAST resolution is the LAST roll's state.
  let chain = Promise.resolve();
  let rollerPendingState = null;
  let revealed = false;
  let spinTimer = null;
  let lockTimers = [];

  function clearTimers() {
    if (spinTimer) {
      timers.clearInterval(spinTimer);
      spinTimer = null;
    }
    for (const id of lockTimers) timers.clearTimeout(id);
    lockTimers = [];
  }

  // The roller's own primary CTA, wired once — the inline block's
  // initRollerScreen IIFE's job, now done at creation.
  const cta = doc.getElementById(ROLLER_IDS.cta);
  if (cta) {
    cta.onclick = () => {
      commit();
    };
  }

  async function start() {
    const token = ++rollSeq;
    clearTimers();
    rollerPendingState = null;
    revealed = false;

    const screen = doc.getElementById(ROLLER_IDS.screen);
    if (!screen) return false;

    const reveal = doc.getElementById(ROLLER_IDS.reveal);
    const nameEl = doc.getElementById(ROLLER_IDS.name);
    const quirkEl = doc.getElementById(ROLLER_IDS.quirk);
    const ctaEl = doc.getElementById(ROLLER_IDS.cta);

    if (reveal) reveal.classList.remove(ROLLER_CSS.revealed);
    if (nameEl) nameEl.textContent = "";
    if (quirkEl) quirkEl.textContent = "";
    if (ctaEl) {
      ctaEl.disabled = true;
      ctaEl.classList.remove(ROLLER_CSS.ready);
      ctaEl.textContent = ROLLER_COPY.falling;
    }
    setReel(doc, ROLLER_IDS.race, pickDisplay(words.race, random), false);
    setReel(doc, ROLLER_IDS.cls, pickDisplay(words.cls, random), false);
    setReel(doc, ROLLER_IDS.sub, pickDisplay(words.sub, random), false);
    screen.hidden = false;

    // The one real roll, serialized: a second start() while this one is
    // unresolved chains behind it — the roll function is never in flight
    // twice.
    const run = chain.then(() => startNewRun());
    chain = run.then(noop, noop);
    const rolledState = await run;

    // Token check FIRST: a superseded roll's resolution is dropped here and
    // touches neither the reels nor the pending state.
    if (token !== rollSeq) return false;

    // Assigned right after the token-validated await — the ONLY assignment
    // of a rolled state to it in the module (SC1: the reel lock and the CTA
    // commit read the same object; no sheet captured at await time and
    // re-used later).
    rollerPendingState = rolledState;

    const locked = { race: false, cls: false, sub: false };
    spinTimer = timers.setInterval(() => {
      if (!locked.race) setReel(doc, ROLLER_IDS.race, pickDisplay(words.race, random), false);
      if (!locked.cls) setReel(doc, ROLLER_IDS.cls, pickDisplay(words.cls, random), false);
      if (!locked.sub) setReel(doc, ROLLER_IDS.sub, pickDisplay(words.sub, random), false);
    }, ROLLER_TIMELINE.spin);

    lockTimers.push(
      timers.setTimeout(() => {
        if (token !== rollSeq) return;
        locked.race = true;
        setReel(doc, ROLLER_IDS.race, sheetFor(rollerPendingState).raceLabel, true);
      }, ROLLER_TIMELINE.lock.race),
    );
    lockTimers.push(
      timers.setTimeout(() => {
        if (token !== rollSeq) return;
        locked.cls = true;
        setReel(doc, ROLLER_IDS.cls, sheetFor(rollerPendingState).classLabel, true);
      }, ROLLER_TIMELINE.lock.cls),
    );
    lockTimers.push(
      timers.setTimeout(() => {
        if (token !== rollSeq) return;
        locked.sub = true;
        setReel(doc, ROLLER_IDS.sub, sheetFor(rollerPendingState).subLabel, true);
      }, ROLLER_TIMELINE.lock.sub),
    );
    lockTimers.push(
      timers.setTimeout(() => {
        if (token !== rollSeq) return;
        if (spinTimer) {
          timers.clearInterval(spinTimer);
          spinTimer = null;
        }
        const sheet = sheetFor(rollerPendingState);
        const finalNameEl = doc.getElementById(ROLLER_IDS.name);
        const finalQuirkEl = doc.getElementById(ROLLER_IDS.quirk);
        const finalRevealEl = doc.getElementById(ROLLER_IDS.reveal);
        const finalCtaEl = doc.getElementById(ROLLER_IDS.cta);
        if (finalNameEl) finalNameEl.textContent = sheet.name;
        if (finalQuirkEl) finalQuirkEl.textContent = sheet.quirk.text;
        if (finalRevealEl) finalRevealEl.classList.add(ROLLER_CSS.revealed);
        revealed = true;
        if (finalCtaEl) {
          finalCtaEl.disabled = false;
          finalCtaEl.classList.add(ROLLER_CSS.ready);
          finalCtaEl.textContent = ROLLER_COPY.ready;
        }
      }, ROLLER_TIMELINE.reveal),
    );

    return true;
  }

  function commit() {
    // The CTA stays inert until the full reveal.
    if (!revealed || !rollerPendingState) return false;
    const state = rollerPendingState;
    rollerPendingState = null;
    revealed = false;
    clearTimers();
    onCommit(state);
    const screen = doc.getElementById(ROLLER_IDS.screen);
    if (screen) screen.hidden = true;
    return true;
  }

  function pending() {
    return rollerPendingState;
  }

  function dispose() {
    rollSeq += 1;
    clearTimers();
    rollerPendingState = null;
    revealed = false;
  }

  return Object.freeze({ start, commit, pending, dispose });
}
