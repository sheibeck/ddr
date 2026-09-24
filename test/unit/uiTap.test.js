// test/unit/uiTap.test.js
//
// Phase 71 (POLISH-10, D-15), Plan 07, Task 1 — the UI tap sound's press
// decision (uiTapShouldPlay) and its one-sound-per-press deferral
// (createUiTapSound), pinned against plain fake elements, plus an event-path
// proof over a tiny fake dispatcher that runs the listeners in the real
// browser order: window capture, then document capture, then the target's
// own handler, then bubbling ancestors — honouring stopPropagation.
//
// The long-press case uses the REAL createLongPress (71-04's recognizer),
// never a re-implementation, behind a window capture-phase suppressor shaped
// exactly like the shell's.
//
// Rulings pinned here: D-15 (click, not touch), R-24 (a guarded element's
// sound follows its guard, not its possibly-stale aria-disabled marker),
// R-25 (a skip tap mid-beat is silent), R-26 (one sound per press), R-27 (a
// long press never clicks).

import test from "node:test";
import assert from "node:assert/strict";

import { UI_TAP_SELECTOR, uiTapShouldPlay, createUiTapSound } from "../../src/browser/uiTap.js";
import { createLongPress } from "../../src/browser/longPress.js";
import { HOLD_MS } from "../../src/browser/tapStep.js";

// ─── Fake elements ───────────────────────────────────────────────────────

/** matchesSimple(el, sel) — tag, #id, [attr] and [attr="value"] only. */
function matchesSimple(el, sel) {
  const s = sel.trim();
  if (s.startsWith("#")) return el.id === s.slice(1);
  const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(s);
  if (attr) {
    const v = el.getAttribute(attr[1]);
    if (v === null) return false;
    return attr[2] === undefined ? true : v === attr[2];
  }
  return el.tag === s.toLowerCase();
}

function matches(el, selector) {
  return selector.split(",").some((part) => matchesSimple(el, part));
}

/**
 * fakeEl({ tag, id, attrs, parent, disabled }) — a plain element with a
 * parent chain, closest(), getAttribute/setAttribute and an onclick slot.
 */
function fakeEl({ tag = "div", id = "", attrs = {}, parent = null, disabled } = {}) {
  const attributes = new Map(Object.entries(attrs));
  const el = {
    tag,
    id,
    parent,
    onclick: null,
    listeners: {},
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    closest(selector) {
      for (let n = el; n; n = n.parent) if (matches(n, selector)) return n;
      return null;
    },
    addEventListener(type, fn) {
      (el.listeners[type] ||= []).push(fn);
    },
  };
  if (disabled !== undefined) el.disabled = disabled;
  return el;
}

// ─── uiTapShouldPlay ─────────────────────────────────────────────────────

test("uiTap (D-15): UI_TAP_SELECTOR is exactly today's match set", () => {
  assert.equal(UI_TAP_SELECTOR, 'button, [role="button"]');
});

test("uiTap (D-15): no button in the chain is silent — map canvas, plain div, range input, null, a text-node-like object", () => {
  const canvas = fakeEl({ tag: "canvas", id: "maze" });
  const div = fakeEl({ tag: "div" });
  const range = fakeEl({ tag: "input", attrs: { type: "range" } });
  const textNode = { nodeType: 3, data: "GO DOWN" };
  for (const t of [canvas, div, range, null, undefined, textNode]) {
    assert.equal(uiTapShouldPlay(t, {}), false);
  }
});

test("uiTap (D-15): a plain button, a role=button element and a span inside a button all sound", () => {
  const btn = fakeEl({ tag: "button" });
  const card = fakeEl({ tag: "div", attrs: { role: "button" } });
  const inner = fakeEl({ tag: "span", parent: btn });
  assert.equal(uiTapShouldPlay(btn, {}), true);
  assert.equal(uiTapShouldPlay(card, {}), true);
  assert.equal(uiTapShouldPlay(inner, {}), true);
});

test("uiTap (D-15): a disabled button is silent", () => {
  assert.equal(uiTapShouldPlay(fakeEl({ tag: "button", disabled: true }), {}), false);
  assert.equal(uiTapShouldPlay(fakeEl({ tag: "button", disabled: false }), {}), true);
});

test("uiTap (D-15): data-locked on the button or on an ancestor (#cb-act) is silent", () => {
  const own = fakeEl({ tag: "button", attrs: { "data-locked": "1" } });
  const host = fakeEl({ tag: "div", id: "cb-act", attrs: { "data-locked": "1" } });
  const child = fakeEl({ tag: "button", parent: host });
  assert.equal(uiTapShouldPlay(own, {}), false);
  assert.equal(uiTapShouldPlay(child, {}), false);
});

test("uiTap (R-25): mid-beat, a button inside #enc-panel is the skip tap and is silent; outside the panel it still sounds", () => {
  const panel = fakeEl({ tag: "div", id: "enc-panel" });
  const inPanel = fakeEl({ tag: "button", parent: panel });
  const outside = fakeEl({ tag: "button" });
  const beat = { beatActive: () => true };
  assert.equal(uiTapShouldPlay(inPanel, beat), false);
  assert.equal(uiTapShouldPlay(outside, beat), true);
  assert.equal(uiTapShouldPlay(inPanel, { beatActive: () => false }), true);
});

test("uiTap (R-24): a guarded element follows its guard — false is silent, true sounds even with a stale aria-disabled marker", () => {
  const chip = fakeEl({ tag: "button", attrs: { "aria-disabled": "true" } });
  assert.equal(uiTapShouldPlay(chip, { armedFor: () => false }), false);
  assert.equal(uiTapShouldPlay(chip, { armedFor: () => true }), true, "the stale marker must never mute a live guarded button");
  const clean = fakeEl({ tag: "button" });
  assert.equal(uiTapShouldPlay(clean, { armedFor: () => false }), false, "a swallowed guarded tap is silent");
});

test("uiTap (R-24): an unguarded element (armedFor null/undefined/missing) is judged by its own aria-disabled", () => {
  const off = fakeEl({ tag: "button", attrs: { "aria-disabled": "true" } });
  const on = fakeEl({ tag: "button", attrs: { "aria-disabled": "false" } });
  const plain = fakeEl({ tag: "button" });
  for (const deps of [{ armedFor: () => null }, { armedFor: () => undefined }, {}, undefined]) {
    assert.equal(uiTapShouldPlay(off, deps), false);
    assert.equal(uiTapShouldPlay(on, deps), true);
    assert.equal(uiTapShouldPlay(plain, deps), true);
  }
});

test("uiTap (T-71-14): a throwing dep or element method is silent and never throws", () => {
  const btn = fakeEl({ tag: "button" });
  assert.equal(uiTapShouldPlay(btn, { armedFor: () => { throw new Error("x"); } }), false);
  assert.equal(uiTapShouldPlay(btn, { beatActive: () => { throw new Error("x"); } }), false);
  const bad = { closest: () => { throw new Error("x"); } };
  assert.equal(uiTapShouldPlay(bad, {}), false);
  const badAttr = fakeEl({ tag: "button" });
  badAttr.getAttribute = () => { throw new Error("x"); };
  assert.doesNotThrow(() => uiTapShouldPlay(badAttr, {}));
  assert.equal(uiTapShouldPlay(badAttr, {}), false);
});

// ─── createUiTapSound ────────────────────────────────────────────────────

/** makeSound(overrides) — a createUiTapSound over counters and a manual queue. */
function makeSound(overrides = {}) {
  const state = { plays: 0, clips: 0, beat: false, queue: [] };
  const deps = {
    play: () => { state.plays++; },
    clipCount: () => state.clips,
    beatActive: () => state.beat,
    armedFor: () => null,
    schedule: (fn) => { state.queue.push(fn); },
    ...overrides,
  };
  const sound = createUiTapSound(deps);
  const flush = () => {
    while (state.queue.length) state.queue.shift()();
  };
  return { state, sound, flush };
}

function clickOn(target) {
  const e = {
    target,
    stopped: false,
    prevented: false,
    stopPropagation() { this.stopped = true; },
    preventDefault() { this.prevented = true; },
  };
  return e;
}

test("uiTap (D-15): an ineligible target schedules nothing", () => {
  const { state, sound } = makeSound();
  sound.onClick(clickOn(fakeEl({ tag: "canvas" })));
  sound.onClick(clickOn(fakeEl({ tag: "button", disabled: true })));
  assert.equal(state.queue.length, 0);
});

test("uiTap (R-26): an eligible target schedules exactly once and plays once when nothing else sounded", () => {
  const { state, sound, flush } = makeSound();
  sound.onClick(clickOn(fakeEl({ tag: "button" })));
  assert.equal(state.queue.length, 1);
  assert.equal(state.plays, 0, "the tap is deferred, never played in the capture phase");
  flush();
  assert.equal(state.plays, 1);
});

test("uiTap (R-26): a one-shot started by the press's own handler plays nothing more", () => {
  const { state, sound, flush } = makeSound();
  sound.onClick(clickOn(fakeEl({ tag: "button" })));
  state.clips += 1; // GO DOWN's stairs clip
  flush();
  assert.equal(state.plays, 0);
});

test("uiTap (R-26): a round begun by the press (beat false then true) plays nothing", () => {
  const { state, sound, flush } = makeSound();
  sound.onClick(clickOn(fakeEl({ tag: "button" })));
  state.beat = true;
  flush();
  assert.equal(state.plays, 0);
});

test("uiTap (T-71-13): onClick never stops or prevents the click", () => {
  const { sound } = makeSound();
  for (const t of [fakeEl({ tag: "button" }), fakeEl({ tag: "canvas" })]) {
    const e = clickOn(t);
    sound.onClick(e);
    assert.equal(e.stopped, false);
    assert.equal(e.prevented, false);
  }
});

test("uiTap (T-71-14): onClick never throws when play, clipCount or schedule throw", () => {
  const boom = () => { throw new Error("boom"); };
  for (const key of ["play", "clipCount", "schedule", "beatActive", "armedFor"]) {
    const { sound, flush } = makeSound({ [key]: boom });
    assert.doesNotThrow(() => sound.onClick(clickOn(fakeEl({ tag: "button" }))), key);
    assert.doesNotThrow(() => flush(), key);
  }
  assert.doesNotThrow(() => createUiTapSound().onClick(clickOn(fakeEl({ tag: "button" }))));
  assert.doesNotThrow(() => createUiTapSound({}).onClick(null));
});

// ─── Event path ──────────────────────────────────────────────────────────

/**
 * makeWorld() — a fake window/document with capture-phase listeners, a
 * fake clock for the real createLongPress, a manual one-task scheduler, and
 * the shell's listener set:
 *  - window capture click: 71-04's suppressor (consumeClick, then
 *    stopPropagation + preventDefault);
 *  - document capture pointerdown: the unlock stand-in only (D-15);
 *  - document capture click: uiTapSound.onClick;
 *  - #enc-panel pointerdown (bubble): foeLongPress.down on a foe card;
 *  - document capture pointermove/pointerup/pointercancel: the recognizer.
 */
function makeWorld() {
  const w = { time: 0, timers: [], queue: [], plays: 0, unlocks: 0, clips: 0, beat: false, armed: new Map() };
  const win = { capture: {} };
  const doc = { capture: {} };
  const on = (host, type, fn) => { (host.capture[type] ||= []).push(fn); };

  const clock = {
    setTimeout: (fn, ms) => { const t = { due: w.time + ms, fn }; w.timers.push(t); return t; },
    clearTimeout: (t) => { w.timers = w.timers.filter((x) => x !== t); },
    now: () => w.time,
  };
  const advance = (ms) => {
    w.time += ms;
    const due = w.timers.filter((t) => t.due <= w.time);
    w.timers = w.timers.filter((t) => t.due > w.time);
    for (const t of due) t.fn();
  };

  const panel = fakeEl({ tag: "div", id: "enc-panel" });
  const inspected = [];
  const foeLongPress = createLongPress({ ...clock, onLongPress: (i) => inspected.push(i) });

  const uiTapSound = createUiTapSound({
    play: () => { w.plays++; },
    clipCount: () => w.clips,
    beatActive: () => w.beat,
    armedFor: (el) => (w.armed.has(el) ? w.armed.get(el)() : null),
    schedule: (fn) => { w.queue.push(fn); },
  });

  on(win, "click", (e) => {
    if (!foeLongPress.consumeClick()) return;
    e.stopPropagation();
    e.preventDefault();
  });
  on(doc, "pointerdown", () => { w.unlocks++; });
  on(doc, "click", (e) => uiTapSound.onClick(e));
  on(doc, "pointermove", (e) => foeLongPress.move({ id: e.pointerId, x: e.clientX, y: e.clientY }));
  on(doc, "pointerup", (e) => foeLongPress.up({ id: e.pointerId, x: e.clientX, y: e.clientY }));
  on(doc, "pointercancel", () => foeLongPress.cancel());
  panel.addEventListener("pointerdown", (e) => {
    const card = e.target.closest("[data-foe]");
    if (!card) { foeLongPress.cancel(); return; }
    foeLongPress.down({ id: e.pointerId, x: e.clientX, y: e.clientY, foe: Number(card.getAttribute("data-foe")) });
  });

  function dispatch(type, target, props = {}) {
    const e = {
      type, target, pointerId: 1, clientX: 0, clientY: 0, ...props,
      stopped: false, defaultPrevented: false,
      stopPropagation() { this.stopped = true; },
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const fn of win.capture[type] || []) { fn(e); if (e.stopped) return e; }
    for (const fn of doc.capture[type] || []) { fn(e); if (e.stopped) return e; }
    if (type === "click" && typeof target.onclick === "function") target.onclick(e);
    if (e.stopped) return e;
    for (let n = target; n; n = n.parent) {
      for (const fn of n.listeners[type] || []) fn(e);
      if (e.stopped) return e;
    }
    return e;
  }
  /** flush() — the one task after the click: every deferred tap runs. */
  const flush = () => { while (w.queue.length) w.queue.shift()(); };
  const tap = (target) => {
    dispatch("pointerdown", target);
    dispatch("pointerup", target);
    dispatch("click", target);
    flush();
  };
  return { w, panel, inspected, dispatch, advance, flush, tap };
}

test("uiTap event path (a) D-15: a scroll that starts on a button — pointerdown, move 30 px, pointercancel, no click — unlocks and stays silent", () => {
  const { w, dispatch, flush } = makeWorld();
  const row = fakeEl({ tag: "button" });
  dispatch("pointerdown", row, { clientX: 10, clientY: 10 });
  dispatch("pointermove", row, { clientX: 10, clientY: 40 });
  dispatch("pointercancel", row);
  flush();
  assert.equal(w.unlocks, 1, "the audio unlock still rides the earliest gesture");
  assert.equal(w.plays, 0, "a scroll never fires click, so it never ticks");
});

test("uiTap event path (b) D-15: a real tap on a plain button ticks once, on the click", () => {
  const { w, dispatch, flush, tap } = makeWorld();
  const btn = fakeEl({ tag: "button" });
  dispatch("pointerdown", btn);
  flush();
  assert.equal(w.plays, 0, "the finger landing makes no sound");
  dispatch("pointerup", btn);
  dispatch("click", btn);
  flush();
  assert.equal(w.plays, 1);
  tap(btn);
  assert.equal(w.plays, 2);
});

test("uiTap event path (c) R-27: a long press on a foe card never clicks — the window suppressor stops the trailing click before the tap listener", () => {
  const { w, panel, inspected, dispatch, advance, flush } = makeWorld();
  const card = fakeEl({ tag: "div", attrs: { role: "button", "data-foe": "0" }, parent: panel });
  let aimed = 0;
  card.onclick = () => { aimed++; };
  dispatch("pointerdown", card);
  advance(HOLD_MS);
  assert.deepEqual(inspected, [0], "the long press fired");
  dispatch("pointerup", card);
  dispatch("click", card);
  flush();
  assert.equal(w.plays, 0, "a long press makes no tap sound");
  assert.equal(aimed, 0, "the card's own handler never ran");
});

test("uiTap event path (d) R-27: a short tap on the same card afterwards clicks and aims (the suppressor fires once)", () => {
  const { w, panel, dispatch, advance, flush, tap } = makeWorld();
  const card = fakeEl({ tag: "div", attrs: { role: "button", "data-foe": "0" }, parent: panel });
  let aimed = 0;
  card.onclick = () => { aimed++; };
  dispatch("pointerdown", card);
  advance(HOLD_MS);
  dispatch("pointerup", card);
  dispatch("click", card);
  flush();
  assert.equal(w.plays, 0);
  tap(card);
  assert.equal(w.plays, 1);
  assert.equal(aimed, 1);
});

test("uiTap event path (e) D-15: a keyboard/TalkBack click with no pointer events ticks", () => {
  const { w, dispatch, flush } = makeWorld();
  const btn = fakeEl({ tag: "button" });
  dispatch("click", btn);
  flush();
  assert.equal(w.plays, 1);
  assert.equal(w.unlocks, 0);
});

test("uiTap event path (f) R-26: a handler with its own clip or that starts a round makes one sound; a handler that only opens a sheet ticks", () => {
  const { w, tap } = makeWorld();
  const goDown = fakeEl({ tag: "button" });
  goDown.onclick = () => { w.clips += 1; }; // the stairs clip
  tap(goDown);
  assert.equal(w.plays, 0, "GO DOWN plays only its own clip");

  const strike = fakeEl({ tag: "button" });
  strike.onclick = () => { w.beat = true; w.clips += 1; }; // line 0 fires synchronously
  tap(strike);
  assert.equal(w.plays, 0, "STRIKE plays only the round");
  w.beat = false;

  const roundOnly = fakeEl({ tag: "button" });
  roundOnly.onclick = () => { w.beat = true; }; // a round with a silent first line
  tap(roundOnly);
  assert.equal(w.plays, 0, "a round begun by the press is its own sound");
  w.beat = false;

  const sheet = fakeEl({ tag: "button" });
  sheet.onclick = () => {}; // opens the gear sheet, no clip
  tap(sheet);
  assert.equal(w.plays, 1);
});

test("uiTap event path (g) R-25: mid-beat, a data-locked action and a guarded foe card are silent", () => {
  const { w, panel, dispatch, flush } = makeWorld();
  w.beat = true;
  const act = fakeEl({ tag: "div", id: "cb-act", attrs: { "data-locked": "1" }, parent: panel });
  const strike = fakeEl({ tag: "button", attrs: { "data-locked": "1", "aria-disabled": "true" }, parent: act });
  const card = fakeEl({ tag: "div", attrs: { role: "button", "data-foe": "1" }, parent: panel });
  w.armed.set(card, () => !w.beat); // encArmed() is false mid-beat
  dispatch("click", strike);
  dispatch("click", card);
  flush();
  assert.equal(w.plays, 0);
});
