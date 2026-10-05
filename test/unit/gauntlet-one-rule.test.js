// test/unit/gauntlet-one-rule.test.js
//
// Phase 93.1 plan 01 (ITEM-09): the Gauntlet of the Giant has ONE rule, and
// every place that states it says the same thing. Player report #6 (2.1.0):
// "Enlarge potion send worthless. +2 damage to get hit now often? Should be
// more in alignment with troll +11 to damage." The owner's comment: "Same thing
// with Gauntlet of the Giant." Enlarge was fixed in 2.3.0 (Phase 89); the user's
// ruling of 2026-10-03 for the Gauntlet: +6 damage in all (the size step's +2
// plus +4 bulk, "smaller, reusable"), foes still +1 to hit the wearer, still
// fifty squares on and fifty to recharge, still 1,200. This guard fails the day
// the item text, its card line, the engine's damage terms, the Enlarged chip,
// the start lines, a Joiner's round-1 use, an old save, the ITEM-AUDIT row or
// the 2.4.0 patch notes disagree.
//
// Helpers mirror the per-file convention (copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { JEWELRY, ACTIVATION_OF } from "../../content/index.js";
import { useItem, unequipSlot, endSourceEffects } from "../../engine/items.js";
import { alliesTurn } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import {
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
  conditionsOf,
  memberConditionsOf,
  foeToHitVs,
  heroSize,
  weaponDamageTerms,
} from "../../engine/derived.js";
import { itemStatLines } from "../../src/browser/viewModels.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { validatePatchNotes } from "../../tools/lib/patch-notes.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const plain = (html) => String(html).replace(/<[^>]+>/g, "");

const G = "Gauntlet of the Giant";
const ROW = JEWELRY.find((r) => r.n === G);
const TXT = ROW.txt;
const WANT_TXT = "used, you are one size larger for fifty squares: +6 damage, and foes +1 to hit you; then fifty squares before it will do it again";

// ─── helpers ────────────────────────────────────────────────────────────────

const MISS = 20; // roll-high: a raw 20 mirrors to the bottom face, a miss

/** fakeRng(seq) — `.d()` pops the next value and THROWS on underflow; `draws` counts what was consumed. */
function fakeRng(seq = [], cursor = 4242) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => cursor,
    get draws() {
      return i;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState(cOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides), floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

const gauntletItem = () => ({ kind: "jewel", ...ROW });

/** A Joiner sheet: a classed Knight with a Club, 30 hp, nothing worn unless given. */
function member(overrides = {}) {
  return {
    name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 30, maxWP: 30, status: "ok",
    weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0,
    potions: 2, worn: {},
    ...overrides,
  };
}

/** A live fight with the given Joiner sheets, each synced into C.allies. */
function fightWith(sheets, { foes = [fixedFoe()], round = 1 } = {}) {
  const state = fixedState();
  state.party = sheets;
  state.c = fixedFighter({ potions: 7 });
  state.combat = {
    foes, type: foes[0]?.type || "Humans", round, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    allies: sheets.map((s, i) => ({ partyIdx: i, name: s.name, lvl: s.level ?? 1, sub: s.sub, wp: s.wp, maxWP: s.maxWP })),
  };
  return state;
}

/** pair(race) — a fighter of `race` with a live Gauntlet record, and the same fighter without. */
function pair(race = "Human") {
  const plain = fixedFighter({ race });
  const big = fixedFighter({ race });
  startEffect(big, `item:${G}`, { squares: 50, cd: 50 });
  return { plain, big };
}

/** damageDelta(race) — the weapon damage terms' bonus the Gauntlet adds, read from the engine. */
function damageDelta(race = "Human") {
  const { plain, big } = pair(race);
  return weaponDamageTerms(big).bonus - weaponDamageTerms(plain).bonus;
}

/** toHitDelta(race) — how many more faces every foe wins on against the wearer, read from the engine. */
function toHitDelta(race = "Human") {
  const { plain, big } = pair(race);
  return foeToHitVs({ c: big, combat: { foes: [{ alive: true }] } }) - foeToHitVs({ c: plain, combat: { foes: [{ alive: true }] } });
}

/** The Enlarged chip's explanation, read through the shell sandbox. */
function chipExplain() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion: true });
  return vm.runInContext("CONDITION_EXPLAIN.giant", sandbox.context);
}

/** The Items & gear bullet that starts "- Gauntlet of the Giant:" in the 2.4.0 draft. */
function notesGauntletBullet(md) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Items & gear");
  assert.ok(start >= 0, "the 2.4.0 notes have an Items & gear section");
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const body = end === -1 ? rest : rest.slice(0, end);
  const bullet = body.find((l) => l.startsWith("- Gauntlet of the Giant:"));
  assert.ok(bullet, "the Items & gear section carries the Gauntlet bullet");
  return bullet;
}

/** The ITEM-AUDIT row of the Gauntlet, as its six cells. */
function auditCells() {
  const line = read("docs/ITEM-AUDIT.md").split("\n").find((l) => l.startsWith("| Gauntlet of the Giant |"));
  assert.ok(line, "docs/ITEM-AUDIT.md has a Gauntlet of the Giant row");
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  assert.equal(cells.length, 6);
  return cells;
}

/** A hero wearing the Gauntlet, used once: the events of the real use. */
function heroUse() {
  const state = fixedState({ worn: { jewelry1: gauntletItem() } });
  const rng = { d() { throw new Error("the main rng must not be drawn"); }, pick: (a) => a[0], shuffle: (a) => a };
  const events = useItem(state, { slot: "jewelry1" }, rng, []);
  return { state, events, started: events.find((e) => e.type === "itemEffectStarted") };
}

/** A Joiner's real round-1 use: the state and the events of its turn. */
function joinerUse() {
  const s = fightWith([member({ worn: { jewelry1: gauntletItem() } })]);
  const rng = fakeRng([MISS]);
  const events = alliesTurn(s, rng, []);
  return { s, rng, events, started: events.find((e) => e.type === "itemEffectStarted") };
}

// ─── the focused checks ─────────────────────────────────────────────────────

test("content: the Gauntlet is one size step plus +4 bulk, 50 squares on and 50 to recharge, priced 1,200, and its card prints its text", () => {
  assert.deepStrictEqual(ACTIVATION_OF[G], { kind: "giant", effect: 50, cd: 50, eff: { size: 1, dmg: 4 } });
  assert.equal(TXT, WANT_TXT);
  // the price is unchanged: TREASURE_BASE_VALUES is module-private, so read the source
  assert.ok(read("engine/economy.js").includes(`"${G}": 1200,`), "the Gauntlet is still priced 1,200");
  const effect = itemStatLines({ kind: "jewel", ...ROW }).find((l) => l.key === "effect");
  assert.ok(effect, "the Gear, store and find cards print an effect line");
  assert.equal(effect.text, TXT);
});

test("engine: a Human's damage terms rise by exactly 6 (the step's 2 and the bulk's 4) and every foe is exactly +1 to hit the wearer", () => {
  assert.equal(damageDelta("Human"), SIZE_DAMAGE_PER_STEP * ACTIVATION_OF[G].eff.size + ACTIVATION_OF[G].eff.dmg);
  assert.equal(damageDelta("Human"), 6);
  assert.equal(toHitDelta("Human"), SIZE_FACES_PER_STEP);
  assert.equal(toHitDelta("Human"), 1);
});

test("a Troll wearing it stacks: its damage terms rise by exactly 6 (+11 to +17 over a Human) and its size steps Large to Huge", () => {
  const { plain, big } = pair("Troll");
  const human = fixedFighter({ race: "Human" });
  assert.equal(weaponDamageTerms(plain).bonus - weaponDamageTerms(human).bonus, 11, "a Troll is +11 on its own");
  assert.equal(weaponDamageTerms(big).bonus - weaponDamageTerms(human).bonus, 17);
  assert.equal(damageDelta("Troll"), 6);
  assert.equal(heroSize(plain).name, "Large");
  assert.equal(heroSize(big).name, "Huge");
});

test("use: started carries step 1, sizeDmg 2 and dmgTotal 6 with no rng draw, the Enlarged chip carries dmgTotal 6, and taking it off ends it", () => {
  const { state, started } = heroUse();
  assert.ok(started, "the use starts the effect");
  assert.equal(started.kind, "giant");
  assert.equal(started.step, 1);
  assert.equal(started.sizeDmg, 2);
  assert.equal(started.dmgTotal, 6);
  const chip = conditionsOf(state).find((x) => x.key === "giant");
  assert.ok(chip, "the Enlarged chip is painted");
  assert.equal(chip.step, 1);
  assert.equal(chip.size, "Large");
  assert.equal(chip.dmgTotal, 6);

  const plainSheet = { ...state.c, timers: {} };
  assert.equal(weaponDamageTerms(state.c).bonus - weaponDamageTerms(plainSheet).bonus, 6, "live: +6");
  const off = unequipSlot(state, "jewelry1", []);
  const ended = off.filter((e) => e.type === "itemEffectEnded");
  assert.equal(ended.length, 1);
  assert.equal(ended[0].kind, "giant");
  assert.equal(weaponDamageTerms(state.c).bonus - weaponDamageTerms({ ...state.c, timers: {} }).bonus, 0, "taken off: the +6 is gone");
});

test("Joiner: a Joiner's round-1 Gauntlet use gets the same +6 and foes +1 on its own sheet, its chip reads 6, and ending its source ends it", () => {
  const { s, rng, events, started } = joinerUse();
  assert.deepEqual(events.map((e) => e.type), ["itemUsed", "itemEffectStarted", "allyMissed"]);
  assert.equal(rng.draws, 1, "only the strike draws");
  assert.equal(started.member, "Ada");
  assert.equal(started.kind, "giant");
  assert.equal(started.dmgTotal, 6);
  assert.equal(started.step, 1);
  assert.ok(!s.c.timers || !s.c.timers[`item:${G}`], "the hero's own sheet gets nothing");

  const sheet = s.party[0];
  assert.ok(sheet.timers[`item:${G}`], "the record lives on the Joiner's sheet");
  assert.equal(weaponDamageTerms(sheet).bonus - weaponDamageTerms({ ...sheet, timers: {} }).bonus, 6);
  const chip = memberConditionsOf(s, 0).find((x) => x.key === "giant");
  assert.ok(chip, "the Joiner's chip is painted");
  assert.equal(chip.dmgTotal, 6);
  assert.equal(foeToHitVs({ c: sheet, combat: { foes: [{ alive: true }] } }) - foeToHitVs({ c: { ...sheet, timers: {} }, combat: { foes: [{ alive: true }] } }), 1);
  assert.match(plain(EVENT_NARRATION.itemEffectStarted(started)), /\+6 damage, and foes \+1 to hit them/);

  const ended = endSourceEffects(s, sheet, [], { slots: ["jewelry1"], why: "off" }).filter((e) => e.type === "itemEffectEnded");
  assert.equal(ended.length, 1);
  assert.equal(ended[0].member, "Ada");
  assert.equal(weaponDamageTerms(sheet).bonus - weaponDamageTerms({ ...sheet, timers: {} }).bonus, 0);
});

test("old save: a saved Gauntlet with the old text and old eff loads with the new text and gives the full +6 when used", () => {
  const run = newRun(11);
  const OLD_TXT = "used, you are one size larger for fifty squares: +2 damage, and foes +1 to hit you; then fifty squares before it will do it again";
  run.c.items.push({ kind: "jewel", n: G, slot: "jewelry", eff: { size: 1 }, txt: OLD_TXT });
  const result = validateSave(JSON.stringify(serializeRun(run)));
  assert.equal(result.ok, true, result.reason);
  const loaded = result.value.c.items.find((i) => i.n === G);
  assert.ok(loaded, "the saved Gauntlet survives the load");
  assert.equal(loaded.txt, TXT, "its text is refreshed to the content row's");
  assert.deepStrictEqual(loaded.eff, { size: 1 }, "its own eff map is inert");
  // a hand-edited eff map on the saved item grants nothing extra: the engine reads the content activation by name
  const c = result.value.c;
  const before = weaponDamageTerms(c).bonus;
  startEffect(c, `item:${G}`, { squares: 50, cd: 50 });
  assert.equal(weaponDamageTerms(c).bonus - before, 6);
  const tampered = JSON.parse(JSON.stringify(serializeRun(run)));
  tampered.c.items.find((i) => i.n === G).eff = { size: 1, dmg: 400 };
  const t = validateSave(JSON.stringify(tampered));
  assert.equal(t.ok, true, t.reason);
  const tc = t.value.c;
  const tBefore = weaponDamageTerms(tc).bonus;
  startEffect(tc, `item:${G}`, { squares: 50, cd: 50 });
  assert.equal(weaponDamageTerms(tc).bonus - tBefore, 6, "a tampered eff map yields nothing extra");
});

test("lines: the hero and Joiner start lines on the Oracle and the rail state +6 damage and foes +1 from a real started event", () => {
  const hero = heroUse().started;
  assert.match(plain(EVENT_NARRATION.itemEffectStarted(hero)), /\+6 damage, and foes \+1 to hit you\./);
  const railHero = LINE_FOR.itemEffectStarted(hero, {});
  assert.equal(railHero.tone, "magic");
  assert.match(railHero.text, /\+6 damage, and foes \+1 to hit you\./);

  const joiner = joinerUse().started;
  assert.match(plain(EVENT_NARRATION.itemEffectStarted(joiner)), /\+6 damage, and foes \+1 to hit them/);
  assert.match(LINE_FOR.itemEffectStarted(joiner, {}).text, /\+6 damage, foes \+1 to hit\./);
});

test("docs: the ITEM-AUDIT row's Text cell is the item text, its verdict is the dated ruling, and Rulings records ITEM-09", () => {
  const cells = auditCells();
  assert.equal(cells[1], `"${TXT}"`);
  assert.equal(cells[4], "ruled (2026-10-03)");
  assert.match(cells[2], /\{ size: 1, dmg: 4 \}/);
  const rulings = read("docs/ITEM-AUDIT.md").split("\n## Rulings")[1];
  assert.ok(rulings && rulings.includes("ITEM-09 (2026-10-03, Phase 93.1)"), "## Rulings carries the dated ITEM-09 entry");
});

test("patch notes: 2.4.0 is agreed (no DRAFT line), validates, and its Gauntlet bullet states +6 damage and foes +1 to hit you", () => {
  const md = read("docs/patch-notes/2.4.0.md");
  assert.ok(!md.includes("**DRAFT, not yet agreed.**")); // release-2.4.0: declared re-pin (the user agreed the notes 2026-10-05)
  assert.deepEqual(validatePatchNotes(md, "2.4.0"), []);
  const bullet = notesGauntletBullet(md);
  assert.match(bullet, /\+6 damage/);
  assert.match(bullet, /foes \+1 to hit you/);
  assert.ok(bullet.includes("→"), "old → new");
});

// ─── the guard ──────────────────────────────────────────────────────────────

test("one rule everywhere: the item text, its card line, the ITEM-AUDIT row, the Enlarged chip explanation and the 2.4.0 patch notes all say +6 damage and foes +1 to hit you", () => {
  const bullet = notesGauntletBullet(read("docs/patch-notes/2.4.0.md"));
  const surfaces = {
    "item text": TXT,
    "card line": itemStatLines({ kind: "jewel", ...ROW }).find((l) => l.key === "effect")?.text ?? "",
    "ITEM-AUDIT Text cell": auditCells()[1],
    "chip explanation": chipExplain(),
    "patch-notes bullet": bullet,
  };
  for (const [name, text] of Object.entries(surfaces)) {
    assert.match(text, /\+6 damage/, `${name}: +6 damage`);
    assert.match(text, /foes \+1 to hit you/, `${name}: foes +1 to hit you`);
    if (name === "patch-notes bullet") {
      // the old side of old → new may name the old number; the new side may not
      const [, after] = text.split("→");
      assert.doesNotMatch(after, /\+2 damage for/, `${name}: the new side never restates the old rule`);
    } else {
      assert.doesNotMatch(text, /\+2 damage/, `${name}: the old number is gone`);
    }
  }
  // the item text and the card line are one string
  assert.equal(surfaces["card line"], surfaces["item text"]);
  assert.equal(surfaces["ITEM-AUDIT Text cell"], `"${surfaces["item text"]}"`);
  // and the number every surface states is the number the engine uses
  assert.equal(damageDelta("Human"), 6);
  assert.equal(toHitDelta("Human"), 1);
});
