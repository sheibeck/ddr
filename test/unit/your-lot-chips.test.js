// test/unit/your-lot-chips.test.js
//
// Phase 77 (CMBUI-13), plan 77-08 — the live effect chips under the hero and
// each party member in YOUR LOT, proven on the REAL combat screen
// (mazeworld.html#renderEncounter / renderYourLot in the shell sandbox).
//
// The user's report (2026-09-25): "When I use the ability smoke, I have no
// indication on myself or the enemies that it's active ... Abilities and
// spells all need to have some sort of active indicator while in combat."
//
//   (a) Smoke on the hero: "Smoke · n" (tone good) the moment it is used,
//       matching conditionsOf's remaining; gone once the effect ends;
//   (b) a member's live Sidestep shows under the member's card, not the
//       hero's; a summoned ally card has no chip row;
//   (c) a Smoke chip tap raises window.mzConditionCard once with the
//       measured lead, Smoke's own text, the rounds left and the source; it
//       never aims, acts or dispatches; the arm window guards it;
//   (d) Dazed honesty: the Dazed chip's tap names "−2 to hit (… instead of
//       …)" and its rounds; the Weakened chip's says half damage;
//   (e) mid-beat, the chips read the beat's view state; settled, S; a chip
//       tap mid-beat opens the card and never hurries the round;
//   (f) a relaunch mid-fight through the adapter's boot() shows the same
//       chips as before it;
//   (g) the HUD strip and YOUR LOT show the same labels and the same tap
//       text, and no chip anywhere shows a raw key.
//
// engineCombatAction lives in the module script (not in this classic-only
// sandbox), so the rounds are applied with the real engine's applyAction
// and the beat handoff is reproduced as combat-beat-shell.test.js does.

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { applyAction, newRun } from "../../engine/engine.js";
import { conditionsOf, memberConditionsOf } from "../../engine/derived.js";
import { startCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { serializeRun } from "../../engine/saveState.js";
import { boot } from "../../src/browser/engineAdapter.js";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import { planBeat, beatEndMs } from "../../src/browser/combatBeat.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { HERO_CONDITIONS, lotChips } from "../../src/browser/heroConditions.js";
import { ABILITY_BY_ID } from "../../content/abilities.js";

// ─── fixtures ──────────────────────────────────────────────────────────────

function fixedHero(overrides = {}) {
  return {
    cls: "Thief", sub: "Burglar", race: "Human", level: 3, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Sword", prof: 2, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, abilities: ["smoke"], timers: {},
    ...overrides,
  };
}

/** fightState(opts) — a lit 3x3 floor and a joined fight with one foe too tough to fall in a few rounds. */
function fightState({ c = {}, party = [], combat = {}, rngState = 5 } = {}) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState,
    c: fixedHero(c),
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party,
    dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: [{ name: "Stone Ox", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 900, maxWP: 900, alive: true, asleep: 0, sp: {}, lives: 1 }],
      type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you",
      ...combat,
    },
  };
}

const live = (left) => ({ cadence: "rounds", left, phase: "effect", cd: 4 });

function member(overrides = {}) {
  return { name: "Joiner", cls: "Fighter", sub: "Soldier", lvl: 1, wp: 30, maxWP: 30, status: "ok", timers: {}, ...overrides };
}

/**
 * rig() — the sandbox, a fake clock and a recording mzConditionCard. The
 * module script's real window.mzConditionCard is not in this sandbox; the
 * spy records each call and changes nothing, so a test can prove the chip
 * tap only asks for the card.
 */
function rig({ reducedMotion = true } = {}) {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock, reducedMotion });
  const w = sandbox.context.window;
  const cards = [];
  w.mzConditionCard = (title, text) => { cards.push({ title, text }); };
  // Every combat dispatch bridge the shell could reach: a chip tap must call none.
  const dispatched = [];
  for (const name of ["mzAttack", "mzCastSpell", "mzSing", "mzDrinkPotion", "mzReadScroll", "mzUseAbility", "mzUseItem", "mzFlee", "mzParley", "mzLoseTurn", "mzFight"]) {
    w[name] = (...args) => { dispatched.push({ name, args }); };
  }
  return { clock, doc, sandbox, w, ctx: sandbox.context, cards, dispatched };
}

const byId = (doc, id) => doc.document.getElementById(id);

/** lotCards(doc) — the YOUR LOT card elements, hero first. */
function lotCards(doc) {
  return Array.from(byId(doc, "enc-body").querySelectorAll(".cb-lot-card"));
}

/** lotChipEls(card) — a card's chip buttons ([] when it has no chip row). */
function lotChipEls(card) {
  const row = card.children.find((el) => el.className === "cb-lot-chips");
  return row ? row.children.filter((el) => el.className === "cb-lot-chip") : [];
}

const chipTexts = (card) => lotChipEls(card).map((el) => el.textContent);

function render(r, state) {
  r.w.__mzState.set(state);
  r.ctx.renderEncounter();
  return lotCards(r.doc);
}

/** smokeUsed() — a real useAbility smoke through the engine, from a fight with no effect live. */
function smokeUsed() {
  const before = fightState();
  const result = applyAction(before, { type: "useAbility", key: "smoke" });
  assert.ok(result.events.some((e) => e.type === "smokeThrown"), "the engine threw the smoke");
  return { before, after: result.state, events: result.events };
}

// ─── (a) Smoke on the hero ─────────────────────────────────────────────────

test("(a) Smoke: the hero card shows 'Smoke · n' (good) the round it is used, matching conditionsOf; gone once the effect ends", () => {
  const r = rig();
  const { before, after } = smokeUsed();
  assert.deepEqual(chipTexts(render(r, before)[0]), [], "no chip before the smoke");

  const remaining = conditionsOf(after).find((cn) => cn.key === "ability" && cn.ability === "smoke").remaining;
  // Quick 260928-hrs (user report 2026-09-28, "the chit shows 1 rds"): the
  // chip reads Smoke's full two rounds the moment it is thrown.
  assert.equal(remaining, 2);
  const cards = render(r, after);
  assert.deepEqual(chipTexts(cards[0]), [`Smoke · ${remaining}`]);
  const [chip] = lotChipEls(cards[0]);
  assert.equal(chip.dataset.tone, "good");
  assert.equal(chip.dataset.key, "ability");
  assert.equal(chip.tagName, "button");

  // Play rounds until the effect phase ends; the chip goes the same render.
  let s = after;
  for (let i = 0; i < 4 && conditionsOf(s).some((cn) => cn.key === "ability"); i++) {
    s = applyAction(s, { type: "attack" }).state;
    assert.ok(s.combat && !s.dead, "the fight is still on");
    const left = conditionsOf(s).find((cn) => cn.key === "ability");
    assert.deepEqual(chipTexts(render(r, s)[0]), left ? [`Smoke · ${left.remaining}`] : [], `round ${i + 1}`);
  }
  assert.equal(conditionsOf(s).some((cn) => cn.key === "ability"), false, "the smoke has cleared");
  assert.equal(lotCards(r.doc)[0].children.some((el) => el.className === "cb-lot-chips"), false, "no empty chip row");
});

// ─── (b) members and the ally ──────────────────────────────────────────────

test("(b) a member's live Sidestep shows under the member's card, not the hero's; the ally card has no chip row", () => {
  const r = rig();
  const state = fightState({
    party: [member({ timers: { "ability:sidestep": live(1) } })],
    combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30 }], ally: { name: "Bound Djinn", rounds: 3, lvl: 2 } },
  });
  const cards = render(r, state);
  assert.equal(cards.length, 3, "hero, member, ally");
  assert.deepEqual(chipTexts(cards[0]), [], "the hero has no chip of the member's");
  assert.deepEqual(chipTexts(cards[1]), ["Sidestep · 1"]);
  assert.equal(cards[2].children.some((el) => el.className === "cb-lot-chips"), false, "a summoned ally has no chip row");

  // The member's tap sheet has no hero lead and says "their", not "your".
  r.clock.advance(ARM_DELAY_MS + 10);
  lotChipEls(cards[1])[0].onclick();
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].title, "SIDESTEP");
  assert.ok(r.cards[0].text.startsWith("Two rounds of not being where the blade is"), r.cards[0].text);
  assert.match(r.cards[0].text, /1 more round, from their Sidestep\.$/);
  assert.doesNotMatch(r.cards[0].text, /vs their swings/, "the measured lead is the hero's, never a member's");
});

// ─── (c) the Smoke chip's tap sheet ────────────────────────────────────────

test("(c) a Smoke chip tap raises one card: the measured lead, Smoke's own text, the rounds left and the source; it never aims, acts or dispatches", () => {
  const r = rig();
  const { after } = smokeUsed();
  const cards = render(r, after);
  const [chip] = lotChipEls(cards[0]);

  assert.equal(r.w.__mzTapArmed(chip), false, "inside the chip's own arm window");
  chip.onclick();
  assert.equal(r.cards.length, 0, "an unarmed tap does nothing");

  r.clock.advance(ARM_DELAY_MS + 10);
  assert.equal(r.w.__mzTapArmed(chip), true);
  const stateRef = r.w.__mzState.get();
  const snapshot = JSON.stringify(stateRef);
  const target = stateRef.combat.target;
  chip.onclick();

  assert.equal(r.cards.length, 1, "exactly one card");
  const { title, text } = r.cards[0];
  assert.equal(title, "SMOKE");
  assert.match(text, /^\+\d+ vs their swings\. /, "the measured lead first");
  const smokeTxt = ABILITY_BY_ID.smoke.txt;
  assert.ok(text.includes(smokeTxt[0].toUpperCase() + smokeTxt.slice(1)), "Smoke's own content text");
  // Quick 260928-hrs (user ruling 2026-09-28): Smoke's two rounds are both
  // still ahead right after the throw.
  assert.match(text, /2 more rounds, from your Smoke\.$/, "the rounds left and where it came from");
  const cn = conditionsOf(after).find((x) => x.key === "ability");
  assert.equal(text, r.ctx.conditionTapText(cn, "Smoke", after), "the one shared composition");

  assert.equal(r.w.__mzState.get(), stateRef, "the state was not replaced");
  assert.equal(JSON.stringify(r.w.__mzState.get()), snapshot, "nothing in the state changed");
  assert.equal(r.w.__mzState.get().combat.target, target, "the tap never aims");
  assert.deepEqual(r.dispatched, [], "the tap never dispatches");
});

// ─── (d) Dazed honesty ─────────────────────────────────────────────────────

test("(d) the Dazed chip's tap names −2 to hit with the range it moves and its rounds; the Weakened chip's says half damage", () => {
  const r = rig();
  const dazed = fightState({ c: { cls: "Fighter", sub: "Soldier", abilities: [], level: 1, weapon: "Club", prof: 0, foeEffect: { kind: "dazed", rounds: 2 } } });
  let cards = render(r, dazed);
  assert.deepEqual(chipTexts(cards[0]), ["Dazed · 2"]);
  assert.equal(lotChipEls(cards[0])[0].dataset.tone, "bad");
  r.clock.advance(ARM_DELAY_MS + 10);
  lotChipEls(cards[0])[0].onclick();
  const d = r.cards.at(-1);
  assert.equal(d.title, "DAZED");
  assert.ok(d.text.includes("−2 to hit ("), d.text);
  assert.ok(d.text.includes("instead of"), d.text);
  assert.match(d.text, /2 more rounds, from a foe's power\.$/);
  assert.match(d.text, /harder|better roll to hit/);

  const weak = fightState({ c: { foeEffect: { kind: "weakened", rounds: 3 } } });
  cards = render(r, weak);
  assert.deepEqual(chipTexts(cards[0]), ["Weakened · 3"]);
  r.clock.advance(ARM_DELAY_MS + 10);
  lotChipEls(cards[0])[0].onclick();
  const wk = r.cards.at(-1);
  assert.equal(wk.title, "WEAKENED");
  assert.match(wk.text, /half damage/);
  assert.match(wk.text, /3 more rounds, from a foe's power\.$/);
});

// ─── (e) the beat's view state ─────────────────────────────────────────────

const durationFor = (text) => typeDurationMs(String(text ?? "").length);

test("(e) mid-beat the chips read the beat's view state, once settled S; a chip tap mid-beat opens the card and never hurries the round", () => {
  const r = rig({ reducedMotion: false });
  // Quick 260928-hrs: Smoke reads 2 right after the throw and 1 after the
  // next round, so one attack brings it to its last round.
  const { after: used } = smokeUsed();
  const { state: before } = applyAction(used, { type: "attack" }); // Smoke · 1 is live going into this round
  assert.ok(before.combat, "the fight is still on after the first attack");
  const { state: after, events } = applyAction(before, { type: "attack" });
  assert.ok(after.combat, "a mid-fight round");
  assert.equal(conditionsOf(after).some((cn) => cn.key === "ability"), false, "the round ends the smoke");

  // engineCombatAction's own handoff (combat-beat-shell.test.js#driveHandoff).
  const w = r.w;
  const beforeLog = w.__mzFightLog;
  w.__mzState.set(after);
  w.__mzFightLog = appendFightLog(beforeLog, fightLogLinesFor("attack", events, {}), before.combat.round);
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog, afterLog: w.__mzFightLog, ctx: {} });
  assert.ok(plan && plan.count >= 2, "a beat of at least two lines, so one frame is mid-round");
  assert.equal(r.sandbox.beatRunner.start(plan), true);

  // Line 1 is a frame of `before`: the smoke is still on the hero there.
  assert.deepEqual(chipTexts(lotCards(r.doc)[0]), ["Smoke · 1"], "mid-beat: the beat's view state");

  // A chip tap mid-beat is an inspection: the capture-phase hurry lets it through.
  const chip = lotChipEls(lotCards(r.doc)[0])[0];
  let stopped = false;
  r.ctx.beatHurryTap({ target: { closest: (sel) => (sel === ".cb-lot-chip" ? chip : null) }, stopPropagation: () => { stopped = true; }, preventDefault() {} });
  assert.equal(stopped, false, "a chip tap never hurries the round");
  assert.equal(w.__mzBeat.active(), true, "the beat keeps playing");
  r.clock.advance(ARM_DELAY_MS + 10);
  chip.onclick();
  assert.equal(r.cards.length, 1, "the card rises mid-beat");
  assert.equal(w.__mzBeat.active(), true, "and the round keeps playing");

  r.clock.advance(beatEndMs(plan.texts, durationFor) + 1000);
  assert.equal(w.__mzBeat.active(), false, "the beat settled");
  r.ctx.renderEncounter();
  assert.deepEqual(chipTexts(lotCards(r.doc)[0]), [], "settled: S, where the smoke has cleared");
});

// ─── (f) relaunch ──────────────────────────────────────────────────────────

const SAVE_KEY = "ddr.delve.v1";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test("(f) a relaunch mid-fight (Phase 76) through the adapter's boot() shows the same YOUR LOT chips as before it", async () => {
  // A real run's joined fight with Smoke live, so the save validates exactly as a device save would.
  let s = newRun(4254);
  s.c.abilities = [...new Set([...(s.c.abilities || []), "smoke"])];
  startCombat(s, false, null, makeRng(s.rngState));
  s = applyAction(s, { type: "fight" }).state;
  assert.ok(s.combat && !s.combat.pending, "a joined fight");
  s = applyAction(s, { type: "useAbility", key: "smoke" }).state;
  assert.ok(s.combat, "the fight is still on");
  assert.ok(conditionsOf(s).some((cn) => cn.key === "ability" && cn.ability === "smoke"), "Smoke is live");

  const r = rig();
  const beforeChips = render(r, s).map(chipTexts);
  assert.ok(beforeChips[0].some((t) => t.startsWith("Smoke · ")), "the hero shows Smoke before the relaunch");

  await withFakeLocalStorage(async (store) => {
    store.set(SAVE_KEY, JSON.stringify(serializeRun(s)));
    const booted = await boot(1);
    assert.ok(booted.combat, "the fight came back");
    const r2 = rig();
    const afterChips = render(r2, booted).map(chipTexts);
    assert.deepEqual(afterChips, beforeChips, "the same chips on every card after the relaunch");
  });
});

// ─── (g) one label, one tap text, never a raw key ──────────────────────────

test("(g) the HUD strip and YOUR LOT show the same labels and the same tap text for a shared chip, and no chip shows a raw key", () => {
  const r = rig();
  const state = fightState({ c: { timers: { "ability:smoke": live(2) }, foeEffect: { kind: "dazed", rounds: 2 }, ward: { name: "Shield", pool: 9, rounds: 3 } } });
  render(r, state);
  r.ctx.paint();
  const hud = byId(r.doc, "mm-conditions").children.filter((el) => el.className === "mw-cond");
  const lot = lotChipEls(lotCards(r.doc)[0]);
  assert.deepEqual(lot.map((el) => el.textContent).sort(), ["Dazed · 2", "Shield · 3", "Smoke · 2"], "Smoke, Shield and Dazed under the hero");

  r.clock.advance(ARM_DELAY_MS + 10);
  for (const el of lot) {
    const label = el.textContent.replace(/ · \d+$/, "");
    const twin = hud.find((h) => h.textContent === label);
    assert.ok(twin, `the HUD strip shows ${label} too`);
    const n = r.cards.length;
    el.onclick();
    twin.onclick();
    assert.equal(r.cards.length, n + 2);
    assert.deepEqual(r.cards[n], r.cards[n + 1], `${label}: the same title and text from both surfaces`);
  }

  const keys = new Set(HERO_CONDITIONS.map((e) => e.key));
  for (const el of [...hud, ...lot]) assert.equal(keys.has(el.textContent.replace(/ · \d+$/, "")), false, `raw key shown: ${el.textContent}`);
});

test("(g) conditionLabel names every table key (never the raw key), and an ability chip reads its one-word label", () => {
  const r = rig();
  const special = { affliction: { kind: "Poison" }, itemCooldown: { item: "Cloak of Speed" }, staffCharges: { item: "Staff of Fire" }, foeEffect: { kind: "dazed" }, ability: { ability: "smoke" } };
  for (const e of HERO_CONDITIONS) {
    const label = r.ctx.conditionLabel({ key: e.key, polarity: "good", ...(special[e.key] || {}) });
    assert.ok(typeof label === "string" && label.length > 0, `${e.key} has a label`);
    assert.notEqual(label, e.key, `${e.key} is never shown raw`);
  }
  assert.equal(r.ctx.conditionLabel({ key: "ability", ability: "battleRoar" }), "Roaring");
  assert.equal(r.ctx.conditionLabel({ key: "darkness" }), "Dark");
});

// ─── (h) harmful chips first (CHIP-01, Phase 93) ───────────────────────────
//
// The user's report (2026-10-02, on 2.3.0): "Negative affects like
// disease/poison should always be on the far left slot for combat condition
// chits so they don't get pushed off the screen." conditionsOf emits every good
// descriptor first, so the harmful ones sat at the far right. The view layer
// (heroConditions.js#harmfulFirst, applied by paintConditions and by the hero
// branch of yourLotChipsFor) now puts the polarity-bad chips first; the engine's
// own order, lotChips and a Joiner's card are untouched.

/** hudKeys(r) — the dataset.key of each chip on the #mm-conditions strip, left to right. */
const hudKeys = (r) => byId(r.doc, "mm-conditions").children.filter((el) => el.className === "mw-cond").map((el) => el.dataset.key);

/** harmfulFirstKeys(conds) — the polarity-bad keys then the rest, each in conditionsOf's own order. */
const harmfulFirstKeys = (conds) => [...conds.filter((cn) => cn.polarity === "bad"), ...conds.filter((cn) => cn.polarity !== "bad")].map((cn) => cn.key);

test("(h) the hero card in a fight puts Dazed first, then Smoke and Shield in conditionsOf order", () => {
  const r = rig();
  const state = fightState({ c: { timers: { "ability:smoke": live(2) }, foeEffect: { kind: "dazed", rounds: 2 }, ward: { name: "Shield", pool: 9, rounds: 3 } } });
  const conds = conditionsOf(state);
  assert.notEqual(conds[0].key, "foeEffect", "the engine emits the good descriptors before the bad one");
  const goodOrder = conds.filter((cn) => cn.polarity !== "bad" && ["ability", "ward"].includes(cn.key)).map((cn) => (cn.key === "ability" ? "Smoke · 2" : "Shield · 3"));
  assert.equal(goodOrder.length, 2);
  const texts = chipTexts(render(r, state)[0]);
  assert.equal(texts[0], "Dazed · 2", "the harmful chip is the far-left chip");
  assert.deepEqual(texts.slice(1), goodOrder, "the good chips follow in conditionsOf's relative order");
});

test("(h) the HUD strip puts every harmful chip first", () => {
  const r = rig();
  const state = fightState({ c: { timers: { "ability:smoke": live(2) }, foeEffect: { kind: "dazed", rounds: 2 }, ward: { name: "Shield", pool: 9, rounds: 3 } } });
  render(r, state);
  r.ctx.paint();
  const keys = hudKeys(r);
  assert.equal(keys[0], "foeEffect");
  assert.deepEqual(keys, harmfulFirstKeys(conditionsOf(state)));
});

test("(h) the strip shows Poisoned first out of a fight", () => {
  const r = rig();
  const state = fightState({ c: { might: 2, mirror: 1, affliction: { kind: "Poison" }, darkFor: 3 } });
  delete state.combat;
  const conds = conditionsOf(state);
  assert.ok(conds.findIndex((cn) => cn.key === "affliction") >= 2, "at least two good conditions precede the affliction in the engine's order");
  r.w.__mzState.set(state);
  r.ctx.paint();
  const keys = hudKeys(r);
  assert.equal(keys[0], "affliction", "Poisoned is the far-left chip");
  assert.deepEqual(keys, harmfulFirstKeys(conds), "bad first, then the good ones, each group in conditionsOf's order");
});

test("(h) a Joiner's card keeps its old order (control)", () => {
  const r = rig();
  const state = fightState({
    party: [member({ timers: { "ability:sidestep": live(1) } })],
    combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30, braced: true }] },
  });
  const cards = render(r, state);
  assert.equal(cards.length, 2, "the hero and the Joiner");
  const expected = lotChips(memberConditionsOf(state, 0)).map((ch) => r.ctx.conditionLabel(ch.cn));
  assert.deepEqual(chipTexts(cards[1]).map((t) => t.replace(/ · \d+$/, "")), expected, "memberConditionsOf's own order");
});
