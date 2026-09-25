// test/unit/status-chit-combat.test.js
//
// Phase 71 (POLISH-11, D-16), Plan 08, Task 2 — a hero status chit tapped in
// combat shows its description. The user's report (2026-09-21 todo
// status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba): "when I'm in
// combat and I tap on a status chit the rail does not show up, so I have no
// way to see my status effect descriptions in combat."
//
// Sandbox (the REAL classic script, the REAL renderRail through
// loadShellSandbox({ stubRail: false }), a fake clock). The module-script
// entry points (window.mzConditionCard, window.mzRailLine, window.mzInspectFoe)
// are not in the sandbox, so this file installs mirrors of their bodies
// built on the same rail.js/foeDetails.js exports; the source pins below
// hold the module's real bodies to that shape.
//   (a) combat + Afraid: the chip's tap pushes one kind "cond" card, title
//       the label in capitals, line the shipped explainCondition text; the
//       rail shows over the combat screen (data-over "combat");
//   (b) no combat: the chip's tap pushes the plain typed line card, as before;
//   (c) mid-round (a live beat): the tap still raises the card, never calls
//       the beat's hurry, and __mzTapArmed(chip) follows the chip's own arm
//       window (R-29, and the 71-07 tap sound follows);
//   (d) a non-combat card pushed in combat keeps the rail hidden (R-28);
//   (e) a second chit tap replaces the card; a long press (mzInspectFoe)
//       replaces a cond card and a chit tap replaces a foe card;
//   (f) a #mw-rail body tap after the arm window dismisses a cond card;
//   (g) the fight over and no beat: data-over goes and one hold starts; a
//       beat still playing with S.combat already null keeps data-over (R-31);
//   (h) R-32: every key conditionsOf can emit has its own description;
//   (i) a foe card tap only aims and pushes no card (R-30).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { railPush, railLineCard, conditionCard, isCombatCard, holdForCard, RAIL_HOLD } from "../../src/browser/rail.js";
import { foeDetailsCard } from "../../src/browser/foeDetails.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { ACTIVATION_OF } from "../../content/activations.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);
const DERIVED = fs.readFileSync(path.join(REPO_ROOT, "engine", "derived.js"), "utf8").replace(/\r\n/g, "\n");

// ─── fixtures ──────────────────────────────────────────────────────────────

function fixedState() {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, timers: {},
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

const foe = (name, extra = {}) => ({ name, type: "Beasts", lvl: 2, size: "S", intel: 4, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" }, lives: 1, ...extra });

function combatState({ afraid = 2 } = {}) {
  const s = fixedState();
  s.combat = {
    foes: [foe("Wolf"), foe("Cave Bear", { size: "L", wp: 25, maxWP: 25 })],
    type: "Beasts", round: 2, target: 1, spellOpen: false, tracked: false, first: "you", afraid,
  };
  return s;
}

function rig({ reducedMotion = true } = {}) {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion });
  const w = sandbox.context.window;
  // Mirrors of the module script's entry points (pinned below).
  w.mzRailLine = (title, line, tone, hold, icon, iconKey = null) => {
    w.__mzRail = railPush(w.__mzRail, railLineCard(title, line, tone, hold, icon, iconKey));
    w.renderRail?.();
  };
  w.mzConditionCard = (title, text) => {
    const live = w.__mzState?.get?.();
    if (!live || !(live.combat || w.__mzBeat?.active?.())) return;
    w.__mzRail = railPush(w.__mzRail, conditionCard(title, text));
    w.renderRail?.();
  };
  w.mzInspectFoe = (i) => {
    const live = w.__mzState?.get?.();
    if (!live) return;
    w.__mzRail = railPush(w.__mzRail, foeDetailsCard(i, live));
    w.renderRail?.();
  };
  const railEl = () => doc.document.getElementById("mw-rail");
  const lineTexts = () => doc.document.getElementById("mw-rail-lines").children.map((el) => el.textContent);
  const chips = () => doc.document.getElementById("mm-conditions").children.filter((c) => c.className === "mw-cond");
  const chip = (key) => chips().find((c) => c.dataset.key === key);
  const explain = (cn, label) => sandbox.context.explainCondition(cn, label);
  const descriptor = (key) => w.__mzConditionsOf(w.__mzState.get()).find((cn) => cn.key === key);
  return { clock, doc, sandbox, w, railEl, lineTexts, chips, chip, explain, descriptor, renderRail: () => sandbox.context.renderRail() };
}

// ─── (a) the chit card in combat ───────────────────────────────────────────

// Phase 74 (ROLL-02/03), plan 74-07: the chip-tap card now leads with the
// chip's measured effect. This hero is a level-3 Human Fighter Soldier
// (strike die d10; its weapon "Sword" is not a WEAPONS key, so need 0),
// so the Afraid lead here reads "−3 to hit (now 9–10)" — pinned below and
// cross-checked against window.__mzConditionEffect (the real bridge) so a
// drift in the engine's own numbers fails this test, not silently passes.
const AFRAID_LEAD = "−3 to hit (now 9–10)";

test("(a) combat + Afraid: the chip's tap raises one kind 'cond' card, the label in capitals and the effect lead + out-of-combat sentence, over the combat screen", () => {
  const r = rig();
  r.w.__mzState.set(combatState());
  r.sandbox.paint();
  const c = r.chip("afraid");
  assert.ok(c, "paint() built the Afraid chip");
  r.clock.advance(ARM_DELAY_MS + 10);
  c.onclick();
  const card = r.w.__mzRail.card;
  assert.equal(card?.kind, "cond");
  assert.equal(card.title, "AFRAID");
  assert.equal(card.lines.length, 1);
  assert.equal(
    card.lines[0].text,
    `${r.w.__mzConditionEffect(r.descriptor("afraid"), r.w.__mzState.get())}. ${r.explain(r.descriptor("afraid"), "Afraid")}`
  );
  assert.equal(card.lines[0].text, `${AFRAID_LEAD}. ${r.explain(r.descriptor("afraid"), "Afraid")}`);
  assert.equal(
    card.lines[0].text,
    `${AFRAID_LEAD}. ${vm.runInContext("CONDITION_EXPLAIN.afraid", r.sandbox.context)}`,
    "the same CONDITION_EXPLAIN source"
  );
  r.renderRail();
  assert.equal(r.railEl().hidden, false);
  assert.equal(r.railEl().dataset.over, "combat");
  assert.deepEqual(r.lineTexts(), [card.lines[0].text]);
});

// ─── (b) out of combat, unchanged ──────────────────────────────────────────

test("(b) no combat: the chip's tap pushes the plain line card (no kind, 8400 hold, typed) exactly as before", () => {
  const r = rig({ reducedMotion: false });
  const s = fixedState();
  s.c.might = 2;
  r.w.__mzState.set(s);
  r.sandbox.paint();
  const c = r.chip("might");
  assert.ok(c, "the Strong chip");
  r.clock.advance(ARM_DELAY_MS + 10);
  c.onclick();
  const card = r.w.__mzRail.card;
  assert.equal(card.kind, undefined);
  assert.equal(card.title, "STRONG");
  assert.equal(card.hold, 8400);
  assert.equal(card.tone, "info");
  assert.equal(card.lines[0].text, r.explain(r.descriptor("might"), "Strong"));
  assert.equal(r.w.__mzTypewriter.active("rail"), true, "the out-of-combat card still types");
});

// ─── (c) mid-round: read without skipping ──────────────────────────────────

test("(c) a live beat: the chip's tap still raises the card, never hurries the round, and __mzTapArmed follows the chip's own window", () => {
  const r = rig();
  r.w.__mzState.set(combatState());
  r.sandbox.paint();
  const c = r.chip("afraid");
  let hurried = 0;
  const realBeat = r.w.__mzBeat;
  r.w.__mzBeat = { ...realBeat, active: () => true, hurry: () => { hurried++; } };
  try {
    assert.equal(r.w.__mzTapArmed(c), false, "inside the chip's own arm window");
    r.clock.advance(ARM_DELAY_MS + 10);
    assert.equal(r.sandbox.context.encArmed(), false, "encArmed is false for the whole beat");
    assert.equal(r.w.__mzTapArmed(c), true, "the chip's guard is not the beat gate");
    c.onclick();
    assert.equal(r.w.__mzRail.card?.kind, "cond");
    assert.equal(hurried, 0, "reading a status never skips the round");
    assert.equal(r.railEl().dataset.over, "combat");
  } finally {
    r.w.__mzBeat = realBeat;
  }
});

test("(c) the chip's arm window is measured from its own chip-set change, not from each encounter render", () => {
  const r = rig();
  r.w.__mzState.set(combatState());
  r.sandbox.paint();
  r.clock.advance(ARM_DELAY_MS + 10);
  r.sandbox.context.armEncounterButtons(); // a beat line's render re-arms the panel
  const c = r.chip("afraid");
  assert.equal(r.w.__mzTapArmed(c), true, "a panel re-arm never locks the chips");
  assert.equal(c.getAttribute("aria-disabled"), null, "no stale aria-disabled marker on a chip (R-29)");
  // A new chip set restarts the window.
  r.w.__mzState.get().c.might = 2;
  r.sandbox.paint();
  assert.equal(r.w.__mzTapArmed(r.chip("might")), false);
});

// ─── (d) every other card stays hidden in combat ───────────────────────────

test("(d) a non-combat line card pushed in combat keeps the rail hidden", () => {
  const r = rig();
  r.w.__mzState.set(combatState());
  r.w.__mzRail = railPush(r.w.__mzRail, railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  r.renderRail();
  assert.equal(r.railEl().hidden, true);
  assert.equal(r.railEl().dataset.over, undefined);
});

// ─── (e) replace rules ─────────────────────────────────────────────────────

test("(e) a second chit replaces the card; a long press replaces a cond card; a chit replaces a foe card", () => {
  const r = rig();
  const s = combatState();
  s.c.might = 2;
  r.w.__mzState.set(s);
  r.sandbox.paint();
  r.clock.advance(ARM_DELAY_MS + 10);
  r.chip("afraid").onclick();
  const first = r.w.__mzRail.card;
  r.chip("might").onclick();
  assert.equal(r.w.__mzRail.card.kind, "cond");
  assert.equal(r.w.__mzRail.card.title, "STRONG");
  assert.ok(r.w.__mzRail.card.seq > first.seq);
  r.w.mzInspectFoe(0);
  assert.equal(r.w.__mzRail.card.kind, "foe");
  assert.equal(r.railEl().dataset.over, "combat");
  r.chip("afraid").onclick();
  assert.equal(r.w.__mzRail.card.kind, "cond");
  assert.equal(r.w.__mzRail.card.title, "AFRAID");
  assert.equal(r.railEl().hidden, false);
});

// ─── (f) a body tap dismisses it ───────────────────────────────────────────

test("(f) a #mw-rail body tap after the arm window dismisses a cond card in combat", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.sandbox.paint();
  r.clock.advance(ARM_DELAY_MS + 10);
  r.chip("afraid").onclick();
  r.clock.advance(ARM_DELAY_MS + 10);
  r.railEl().onclick({ target: { closest: () => null } });
  assert.equal(r.w.__mzRail.card, null);
  assert.equal(r.railEl().hidden, true);
  assert.equal(r.railEl().dataset.over, undefined);
  assert.equal(s.combat.target, 1, "the aim is unchanged");
});

// ─── (g) the fight ends / the last beat (R-31) ─────────────────────────────

test("(g) the fight over and no beat: data-over goes, ONE hold starts, and it clears the cond card", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.sandbox.paint();
  r.clock.advance(ARM_DELAY_MS + 10);
  const before = r.clock.pending();
  r.chip("afraid").onclick();
  assert.equal(r.clock.pending(), before, "no hold while the combat screen is up");
  s.combat = null;
  r.renderRail();
  assert.equal(r.railEl().dataset.over, undefined);
  assert.equal(r.railEl().hidden, false);
  assert.equal(r.clock.pending(), before + 1, "exactly one hold timer starts");
  r.renderRail();
  assert.equal(r.clock.pending(), before + 1, "a repaint never re-arms it");
  r.clock.advance(holdForCard(r.w.__mzRail.card) + 5);
  assert.equal(r.w.__mzRail.card, null);
});

test("(g) a beat still playing with S.combat already null keeps the card over the combat screen, with no hold (R-31)", () => {
  const r = rig();
  const s = fixedState();
  r.w.__mzState.set(s);
  const realBeat = r.w.__mzBeat;
  r.w.__mzBeat = { ...realBeat, active: () => true, view: () => null };
  try {
    const before = r.clock.pending();
    r.w.mzConditionCard("AFRAID", "A penalty on every roll until it passes.");
    assert.equal(r.w.__mzRail.card?.kind, "cond", "the last round's playback is still the combat screen");
    assert.equal(r.railEl().hidden, false);
    assert.equal(r.railEl().dataset.over, "combat");
    assert.equal(r.clock.pending(), before, "no hold while the beat plays");
  } finally {
    r.w.__mzBeat = realBeat;
  }
  r.renderRail();
  assert.equal(r.railEl().dataset.over, undefined, "the beat is over");
});

test("(g) mzConditionCard is a no-op with no fight and no beat", () => {
  const r = rig();
  r.w.__mzState.set(fixedState());
  r.w.mzConditionCard("AFRAID", "x");
  assert.equal(r.w.__mzRail.card, null);
});

// ─── (h) R-32: every hero chip has its own description ─────────────────────

function conditionsOfBody() {
  const start = DERIVED.indexOf("export function conditionsOf(state)");
  assert.ok(start !== -1, "conditionsOf found");
  const end = DERIVED.indexOf("\n}\n", start);
  return DERIVED.slice(start, end);
}

function heroVocabulary() {
  const keys = new Set([...conditionsOfBody().matchAll(/key: "([A-Za-z]+)"/g)].map((m) => m[1]));
  // Every activation kind with a live effect (a positive duration, or a
  // rolled one) makes a chip under its own kind; fly shows as flight.
  // Kinds with effect 0 (half, stone, knit) or none never make a live chip.
  for (const act of Object.values(ACTIVATION_OF)) {
    const e = act && act.effect;
    const live = (typeof e === "number" && e > 0) || (e && typeof e === "object" && e.sides > 0);
    if (live) keys.add(act.kind === "fly" ? "flight" : act.kind);
  }
  return keys;
}

test("(h) R-32 scan self-check: the vocabulary finds afraid, ward, darkness, fearArmed and flight, and no dead kind", () => {
  const keys = heroVocabulary();
  for (const k of ["afraid", "ward", "darkness", "fearArmed", "flight", "haste", "acute", "lit"]) assert.ok(keys.has(k), `the scan sees ${k}`);
  for (const k of ["half", "stone", "knit", "fly"]) assert.ok(!keys.has(k), `${k} never makes a live chip`);
});

test("(h) R-32: every key conditionsOf can emit resolves to its own CONDITION_EXPLAIN sentence, never the default", () => {
  const r = rig();
  const fallback = vm.runInContext("CONDITION_EXPLAIN.default", r.sandbox.context);
  assert.ok(typeof fallback === "string" && fallback.length > 0);
  const labelOf = (k) => vm.runInContext(`CONDITION_COPY[${JSON.stringify(k)}]?.label || ${JSON.stringify(k)}`, r.sandbox.context);
  const missing = [];
  for (const key of heroVocabulary()) {
    const text = r.explain({ key }, labelOf(key));
    assert.ok(typeof text === "string" && text.length > 0, `${key} has text`);
    if (text === fallback) missing.push(key);
  }
  assert.deepEqual(missing, [], `keys with no description of their own: ${missing.join(", ")}`);
});

// ─── (i) a foe card tap only aims ──────────────────────────────────────────

test("(i) a foe card's tap after its arm window aims at that foe and raises no card (R-30)", () => {
  const r = rig();
  const s = combatState();
  s.combat.foes[0].hamstrung = true;
  r.w.__mzState.set(s);
  r.sandbox.context.renderEncounter();
  const body = r.doc.document.getElementById("enc-body");
  const cards = Array.from(body.querySelectorAll(".cb-foe")).filter((el) => el.dataset.foe !== undefined);
  assert.ok(cards.length >= 2, "two foe cards");
  r.clock.advance(ARM_DELAY_MS + 10);
  const wolf = cards.find((el) => el.dataset.foe === "0");
  wolf.onclick();
  assert.equal(r.w.__mzState.get().combat.target, 0, "the tap aims");
  assert.equal(r.w.__mzRail.card, null, "and never raises a card");
});

// ─── source pins ───────────────────────────────────────────────────────────

function fnRegion(head) {
  const start = CODE.indexOf(head);
  assert.ok(start !== -1, `not found: ${head}`);
  return CODE.slice(start, CODE.indexOf("\nfunction ", start + 10));
}

function sliceFrom(source, startMarker, len = 1200) {
  const i = source.indexOf(startMarker);
  assert.ok(i !== -1, `marker not found: ${startMarker}`);
  return source.slice(i, i + len);
}

test("pins: the chip is wired through guardInfoTap with both branches and condArmed; the out-of-combat literal is unchanged", () => {
  const region = fnRegion("function paintConditions(c)");
  assert.match(region, /guardInfoTap\(btn, \(\) => \(combatScreenUp\(\)\s*\?\s*window\.mzConditionCard\?\.\(label\.toUpperCase\(\), explainText\)\s*:\s*window\.mzRailLine\?\.\(label\.toUpperCase\(\), explainText, "info", 8400, "·"\)\), condArmed\);/);
  assert.doesNotMatch(region, /guardTap\(btn/);
  assert.match(region, /condArmedAt = Date\.now\(\);/);
  assert.match(region, /armEncounterButtons\(\);/, "the key gate keeps its re-arm");
});

test("pins: combatScreenUp, condArmed and guardInfoTap; no aria-disabled in guardInfoTap; guardTap's head unchanged", () => {
  assert.match(CODE, /function combatScreenUp\(\) \{\s*return !!\(S && \(S\.combat \|\| window\.__mzBeat\?\.active\?\.\(\)\)\);\s*\}/);
  const armed = fnRegion("function condArmed()");
  assert.match(armed, /window\.__mzInputGuards\.isArmed\(condArmedAt, Date\.now\(\)\)/);
  assert.doesNotMatch(armed, /__mzBeat|encRenderedAt/);
  const info = sliceFrom(CODE, "function guardInfoTap(btn, fn, armed) {", 400);
  const body = info.slice(0, info.indexOf("\n}") + 2);
  assert.match(body, /if \(!btn\) return;/);
  assert.match(body, /tapGuards\.set\(btn, armed\);/);
  assert.match(body, /btn\.onclick = \(\) => \{ if \(armed\(\)\) fn\(\); \};/);
  assert.doesNotMatch(body, /aria-disabled/);
  assert.match(CODE, /function guardTap\(btn, fn\) \{\n  if \(!btn\) return;\n  tapGuards\.set\(btn, encArmed\);\n  btn\.setAttribute\("aria-disabled", "true"\);\n  btn\.onclick = \(\) => \{ if \(encArmed\(\)\) fn\(\); \};\n\}/);
});

test("pins: renderRail reads combatCardUp and combatScreenUp() for hidden, data-over and the hold; the foe re-derive stays foe-only", () => {
  const region = fnRegion("function renderRail()");
  assert.match(region, /const combatCardUp = !!window\.__mzRailVM\?\.isCombatCard\?\.\(rail\.card\) && key === "card:" \+ rail\.card\.seq;/);
  assert.match(region, /const foeCardUp = rail\.card\?\.kind === "foe" && key === "card:" \+ rail\.card\.seq;/);
  assert.match(region, /if \(foeCardUp && S\.combat && window\.__mzFoeInspect\?\.card\)/);
  assert.match(region, /railEl\.hidden = !!\(\(S\.combat && !combatCardUp\) \|\| S\.dead\) \|\| idle;/);
  assert.match(region, /if \(combatScreenUp\(\) && combatCardUp && !railEl\.hidden\) \{/);
  assert.match(region, /if \(combatCardUp\) \{[\s\S]{0,400}?if \(!combatScreenUp\(\)\) startHold\(\);/);
  assert.match(region, /\} else if \(combatCardUp && !combatScreenUp\(\) && railTimer === null\) \{/);
});

test("pins: the module imports conditionCard/isCombatCard, bridges isCombatCard, and window.mzConditionCard is guarded and pushes through railPush", () => {
  const imp = CODE.match(/import \{([^}]*)\} from "\.\/src\/browser\/rail\.js";/);
  assert.ok(imp, "the rail.js import");
  assert.match(imp[1], /\bconditionCard\b/);
  assert.match(imp[1], /\bisCombatCard\b/);
  assert.match(CODE, /window\.__mzRailVM = \{[^}]*\bisCombatCard\b[^}]*\};/);
  const region = sliceFrom(CODE, "window.mzConditionCard = (title, text) => {", 600);
  const body = region.slice(0, region.indexOf("\n  };") + 5);
  assert.match(body, /if \(!dungeonVisible\(\)\) return;/);
  assert.match(body, /live\.combat \|\| window\.__mzBeat\?\.active\?\.\(\)/);
  assert.match(body, /window\.__mzRail = railPush\(window\.__mzRail, conditionCard\(title, text\)\);/);
  assert.match(body, /window\.renderRail\?\.\(\);/);
  assert.doesNotMatch(body, /\.target\s*=|dispatch|hurry/, "an inspection never acts");
  assert.ok(CODE.indexOf("window.mzConditionCard = (title, text) => {") > CODE.indexOf("window.mzInspectFoe = (i) => {"), "beside mzInspectFoe");
});

test("pins: the sandbox harness mirrors isCombatCard on __mzRailVM", () => {
  const harness = fs.readFileSync(path.join(__dirname, "harness", "shellSandbox.js"), "utf8");
  assert.match(harness, /isCombatCard,?/);
  const r = rig();
  assert.equal(r.w.__mzRailVM.isCombatCard, isCombatCard);
});

test("pins: CSCR-08 — no new listener in the renderEncounter render region, and #enc-panel keeps one click listener", () => {
  const region = fnRegion("function renderEncounter()");
  assert.doesNotMatch(region, /mzConditionCard|guardInfoTap/);
  assert.equal((CODE.match(/getElementById\("enc-panel"\)\?\.addEventListener\("click"/g) || []).length, 1);
  assert.equal((CODE.match(/mzConditionCard\?\.\(/g) || []).length, 1, "the chip is the one caller");
});
