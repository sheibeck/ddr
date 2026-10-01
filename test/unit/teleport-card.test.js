// test/unit/teleport-card.test.js
//
// Phase 91 (IDENT-14), plan 91-04: the Illusionist's teleport decision card.
// src/browser/teleportCard.js#teleportCardViewModel builds the whole card
// (title, the count line, the reach in plain words, the one LET IT CHOOSE
// button) from the engine's own pending record (`state.pendingTeleport`, set
// by a real `move` onto a teleport square through applyAction) and the
// engine's own `teleportTargets`. Every state here is a real engine state: a
// hand-built floor with a tele square next to an Illusionist, stepped onto
// through applyAction. Report #3: "I have a deserved illusionist. It says I
// choose where teleports takes me, but when I stepped on a teleport I didn't
// get to choose."

import test from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "../../engine/engine.js";
import { newRun } from "../../engine/state.js";
import { GW, GH } from "../../engine/maze.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { TELEPORT_REACH, teleportTargets } from "../../engine/movement.js";
import { TELEPORT_CARD_COPY, teleportCardViewModel, teleportPickAction } from "../../src/browser/teleportCard.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ---------------------------------------------------------------- helpers

const wallGrid = () => Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({ wall: true, seen: false, feat: null })));
const openCell = (g, x, y, extra = {}) => {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
};

/** An Illusionist standing at (px, py) on a hand-built floor: `seen` squares explored, the rest floor but fogged. */
function standing({ px = 7, py = 10, sub = "Illusionist", cls = "Magic User", seen = true, seed = 3 } = {}) {
  const state = newRun(seed, [], { force: { cls, sub } });
  const g = wallGrid();
  for (let y = 1; y <= GH - 2; y++) for (let x = 1; x <= GW - 2; x++) openCell(g, x, y, { seen });
  state.floor = { g, px, py, depth: 1 };
  state.combat = null;
  return state;
}

/** Steps an Illusionist onto a teleport square through applyAction: a real pending pick. */
function pickOpen(opts = {}) {
  const state = standing(opts);
  const f = state.floor;
  openCell(f.g, f.px, f.py - 1, { feat: "tele", seen: true });
  openCell(f.g, f.px, f.py, { seen: true });
  const out = applyAction(state, { type: "move", dir: "N" });
  assert.ok(out.state.pendingTeleport, "the engine opened a pick");
  return out.state;
}

// ---------------------------------------------------------------- no pick

test("No pick: the view model is null with no pendingTeleport, for a null state, a combat, an open store and a dead hero", () => {
  const state = pickOpen();
  assert.ok(teleportCardViewModel(state));
  const cleared = structuredClone(state);
  delete cleared.pendingTeleport;
  assert.equal(teleportCardViewModel(cleared), null);
  assert.equal(teleportCardViewModel(standing()), null, "a fresh Illusionist has no pick");
  assert.equal(teleportCardViewModel(null), null);
  assert.equal(teleportCardViewModel(undefined), null);
  assert.equal(teleportCardViewModel({ ...state, combat: { pending: true, foes: [] } }), null);
  assert.equal(teleportCardViewModel({ ...state, store: { stock: [] } }), null);
  assert.equal(teleportCardViewModel({ ...state, dead: true }), null);
});

// ---------------------------------------------------------------- the card

test("Card: an Illusionist on a teleport gets the card, kind teleport, the count of glowing squares, the reach in plain words and exactly one button, LET IT CHOOSE", () => {
  const state = pickOpen();
  const vm = teleportCardViewModel(state);
  const n = teleportTargets(state).length;
  assert.ok(n > 1, "an open explored room: several squares glow");
  assert.equal(vm.kind, "teleport");
  assert.equal(vm.title, "THE TELEPORT WAITS");
  assert.equal(vm.count, n, "the same number teleportTargets returns");
  assert.ok(vm.intro.startsWith(`${n} squares glow`), vm.intro);
  assert.match(vm.intro, /Tap one/);
  assert.ok(vm.lines.some((l) => l.text === `Reach: up to ${TELEPORT_REACH} squares, straight or diagonal, explored floor only.`));
  assert.match(vm.lines.map((l) => l.text).join(" "), /up to 12 squares, straight or diagonal/);
  assert.equal(vm.buttons.length, 1);
  assert.equal(vm.buttons[0].label, "LET IT CHOOSE");
  assert.deepStrictEqual(vm.buttons[0].dispatch, { type: "teleportPick", auto: true });
  assert.equal(vm.buttons[0].id, "a-teleport-auto");
  assert.ok(vm.lines.some((l) => l.text.startsWith("LET IT CHOOSE:")), "the button's own line explains it");
});

test("Card: one glowing square reads in the singular, none reads its own line (LET IT CHOOSE is the only vote)", () => {
  // One explored square in reach: fog everything, then explore just one floor square east.
  const one = pickOpen({ seen: false });
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) one.floor.g[y][x].seen = false;
  one.floor.g[one.floor.py][one.floor.px + 3].seen = true;
  assert.equal(teleportTargets(one).length, 1);
  const vmOne = teleportCardViewModel(one);
  assert.equal(vmOne.count, 1);
  assert.match(vmOne.intro, /^One square glows/);
  assert.doesNotMatch(vmOne.intro, /\d+ squares glow/);

  const none = pickOpen({ seen: false });
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) none.floor.g[y][x].seen = false;
  assert.equal(teleportTargets(none).length, 0);
  const vmNone = teleportCardViewModel(none);
  assert.equal(vmNone.count, 0);
  assert.equal(vmNone.intro, TELEPORT_CARD_COPY.intro.none);
  assert.equal(vmNone.buttons.length, 1, "LET IT CHOOSE is still offered");
  assert.deepStrictEqual(vmNone.buttons[0].dispatch, { type: "teleportPick", auto: true });
});

test("Card: building the card rolls nothing and mutates nothing; deps.teleportTargets overrides the engine's", () => {
  const state = pickOpen();
  const before = structuredClone(state);
  const a = teleportCardViewModel(state);
  const b = teleportCardViewModel(state);
  assert.deepStrictEqual(state, before);
  assert.deepStrictEqual(a, b);
  const injected = teleportCardViewModel(state, { teleportTargets: () => [{ x: 1, y: 1, dir: "N", dist: 1 }] });
  assert.equal(injected.count, 1);
  assert.match(injected.intro, /^One square glows/);
});

// ---------------------------------------------------------------- relaunch

test("Relaunch: the same card comes back through serializeRun / validateSave / rehydrate", () => {
  for (const seed of [3, 11, 29]) {
    const state = pickOpen({ seed, px: 8 + (seed % 3), py: 9 + (seed % 4) });
    const card = teleportCardViewModel(state);
    const json = JSON.stringify(serializeRun(state));
    const validated = validateSave(json);
    assert.ok(validated.ok, `seed ${seed}: the save validates`);
    assert.deepStrictEqual(teleportCardViewModel(validated.value), card, `seed ${seed}: validateSave`);
    assert.deepStrictEqual(teleportCardViewModel(rehydrate(JSON.parse(json))), card, `seed ${seed}: rehydrate`);
  }
});

test("Commit: after either answer the record is gone and no card survives; a second answer dispatches nothing", () => {
  for (const pick of [{ auto: true }, "square"]) {
    const state = pickOpen();
    const answer = pick === "square" ? { x: teleportTargets(state)[0].x, y: teleportTargets(state)[0].y } : pick;
    const action = teleportPickAction(state, answer);
    assert.ok(action, "a live pick yields an action");
    const out = applyAction(state, action);
    assert.equal(out.state.pendingTeleport, undefined);
    assert.equal(teleportCardViewModel(out.state), null);
    assert.equal(teleportPickAction(out.state, answer), null, "a second tap dispatches nothing");
    assert.ok(out.events.some((e) => e.type === "teleported"));
  }
});

// ---------------------------------------------------------------- teleportPickAction

test("teleportPickAction: auto and a listed square map to the engine's two action shapes, anything else is null", () => {
  const state = pickOpen();
  assert.deepStrictEqual(teleportPickAction(state, { auto: true }), { type: "teleportPick", auto: true });
  assert.deepStrictEqual(teleportPickAction(state, { x: 9, y: 4 }), { type: "teleportPick", x: 9, y: 4 });
  assert.equal(teleportPickAction(state, { x: 9 }), null);
  assert.equal(teleportPickAction(state, { x: 1.5, y: 2 }), null);
  assert.equal(teleportPickAction(state, { auto: 1 }), null, "only auto === true");
  assert.equal(teleportPickAction(state, null), null);
  assert.equal(teleportPickAction(state, undefined), null);
  assert.equal(teleportPickAction(null, { auto: true }), null);
  assert.equal(teleportPickAction({ ...state, combat: { pending: true, foes: [] } }, { auto: true }), null);
  assert.equal(teleportPickAction({ ...state, store: { stock: [] } }, { auto: true }), null);
  const noPick = structuredClone(state);
  delete noPick.pendingTeleport;
  assert.equal(teleportPickAction(noPick, { auto: true }), null);
});

// ---------------------------------------------------------------- voice

function leaves(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) leaves(v, out);
  return out;
}

test("voice: every TELEPORT_CARD_COPY leaf is non-empty, clear of BANNED, never says WP, never says face, and has no ASCII hyphen as a minus or range", () => {
  const escaped = BANNED.filter((w) => !ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bannedRe = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  const all = leaves(TELEPORT_CARD_COPY);
  assert.ok(all.length >= 6);
  for (const s of all) {
    assert.ok(s.trim().length > 0);
    assert.doesNotMatch(s, bannedRe, s);
    assert.doesNotMatch(s, /(?<![\w.$-])(wp|WP)(?![\w:])/, s);
    assert.doesNotMatch(s, /\bfaces?\b/i, s);
    assert.doesNotMatch(s, /\d-\d|(^|\s)-\d/, s);
  }
});

test("voice: the interpolated card has no 'undefined', 'NaN' or unfilled {placeholder} on any of its lines", () => {
  const states = [pickOpen()];
  const one = pickOpen({ seen: false });
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) one.floor.g[y][x].seen = false;
  one.floor.g[one.floor.py][one.floor.px + 2].seen = true;
  states.push(one);
  const none = pickOpen({ seen: false });
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) none.floor.g[y][x].seen = false;
  states.push(none);
  for (const s of states) {
    const vm = teleportCardViewModel(s);
    const text = [vm.title, vm.intro, ...vm.lines.map((l) => l.text), ...vm.buttons.map((b) => b.label)].join("\n");
    assert.doesNotMatch(text, /undefined|NaN|\{\w+\}/);
  }
});
