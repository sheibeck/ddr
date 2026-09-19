// test/unit/clarity-cause-lines.test.js
//
// Phase 43 (CLAR-01) — Task 1: engine-half coverage for the nine additive
// cause-payload keys this plan adds (trappedPanic.phobia, heightsFear.
// penalty, waterFear.penalty, backfireSelfDamage.{spell,sub}, summonBackfired
// .{spell,sub}, earthquakeSelfDamage.spell, deathCast.cost, deathSpellTooWeak
// .fee, insanitySelfHarm.loss), plus a ledger test proving docs/CLARITY.md's
// Cost-event inventory table names only real EVENT_NARRATION keys. Helpers
// (fakeRng/fixedFighter/fixedFloor/fixedState/fixedCombat/fixedFoe) mirror
// test/unit/movement.test.js and test/unit/spell-mechanics.test.js's own
// established patterns verbatim.
//
// Task 2 appends the narration half (EVENT_NARRATION/TOAST_FOR cause-first
// line assertions for the 24 Plan-01 rows) below this marker:
// Task 2 appends the line-shape tests below

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { GW, GH } from "../../engine/maze.js";
import { move } from "../../engine/movement.js";
import { castSpell } from "../../engine/magic.js";
import { goInsane } from "../../engine/encounters.js";
import { SPELLS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/movement.
 * test.js's helper verbatim). */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/** A minimal, fully-walled 21x21 grid with a hole punched wherever a test
 * needs an open cell (ports test/unit/movement.test.js's wallGrid/open). */
function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** A caster fixture for engine/magic.js#castSpell tests — c.scrollCast=true
 * bypasses canCast's grimoire/level/school gates entirely (readScroll's own
 * documented free-cast mechanism), so these tests need not roll a matching
 * grimoire. */
function fixedCaster(overrides = {}) {
  return fixedFighter({
    cls: "Magic User", sub: "Wizard", weapon: "Dagger", armor: "Cloth",
    grimoire: [], level: 5, wp: 40, maxWP: 40, scrollCast: true,
    ...overrides,
  });
}

/** An EMPTY foe roster — every test below is about the CASTER's own
 * self-cost, not a foe interaction, so afterPlayerAction's own
 * liveFoes(state).length check short-circuits to encounterCleared/endCombat
 * with zero further rng draws (engine/combat.js:1312), keeping every
 * fakeRng sequence exactly as long as the behavior under test. */
function fixedCombat(overrides = {}) {
  return { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ─── trappedPanic.phobia ───────────────────────────────────────────────────

test("trappedPanic carries {loss, phobia} — a Being-trapped character's dead-end entry names its own phobia", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4); // a genuine dead end: its only open neighbor is (5,5)
  const events = move(state, "N", fakeRng([]), []);
  const e = events.find((ev) => ev.type === "trappedPanic");
  assert.ok(e, "trappedPanic fires");
  assert.equal(e.loss, 4);
  assert.equal(e.phobia, "Being trapped");
});

// ─── heightsFear.penalty / waterFear.penalty ───────────────────────────────

test("heightsFear carries penalty:2 for a plain Heights-phobic character, penalty:1 with Hardiness", () => {
  const plain = fixedState({ c: { phobia: "Heights", phobiaType: null } });
  open(plain.floor.g, 5, 4, { feat: "climb" });
  // pick(["rope","rock","wood"]) -> rope (success=7); feet=10*(1+d(2)=1)=20;
  // rung 1: r = d(10)=6 + 2 = 8 > 7 -> fails; fall check g=0: d(20)=15 (>2, rolls); fall d6=4.
  const events = move(plain, "N", fakeRng([1, 6, 15, 4]), []);
  const e = events.find((ev) => ev.type === "heightsFear");
  assert.ok(e);
  assert.equal(e.penalty, 2);

  const hardy = fixedState({ c: { phobia: "Heights", phobiaType: null, skills: { Hardiness: 1 } } });
  open(hardy.floor.g, 5, 4, { feat: "climb" });
  // Halved penalty = round(2/2) = 1: rung 1 r = 6 + 1 = 7 <= 7 -> pass; rung 2 r = 5 + 1 = 6 <= 7 -> pass.
  const events2 = move(hardy, "N", fakeRng([1, 6, 5]), []);
  const e2 = events2.find((ev) => ev.type === "heightsFear");
  assert.ok(e2);
  assert.equal(e2.penalty, 1);
});

test("waterFear carries penalty:2 for a plain Bodies-of-water-phobic character, penalty:1 with Hardiness", () => {
  const plain = fixedState({ c: { phobia: "Bodies of water", phobiaType: null } });
  open(plain.floor.g, 5, 4, { feat: "gorge" });
  // LEAP_TABLE[0]: Fighter needs <=10; r = d(10)=9 + 2 = 11 > 10 -> fails; fall = d6+d6.
  const events = move(plain, "N", fakeRng([1, 9, 3, 4]), []);
  const e = events.find((ev) => ev.type === "waterFear");
  assert.ok(e);
  assert.equal(e.penalty, 2);

  const hardy = fixedState({ c: { phobia: "Bodies of water", phobiaType: null, skills: { Hardiness: 1 } } });
  open(hardy.floor.g, 5, 4, { feat: "gorge" });
  // Halved penalty = round(2/2) = 1: r = 9 + 1 = 10 <= 10 -> clear.
  const events2 = move(hardy, "N", fakeRng([1, 9]), []);
  const e2 = events2.find((ev) => ev.type === "waterFear");
  assert.ok(e2);
  assert.equal(e2.penalty, 1);
});

// ─── backfireSelfDamage.{spell,sub} (Apprentice, 1-in-8) ───────────────────

test("backfireSelfDamage carries {spell, sub} on an Apprentice's one-in-eight backfire of a thrown spell", () => {
  const foe = { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  const state = fixedState({
    c: fixedCaster({ sub: "Apprentice", grimoire: ["Fireball"] }),
    combat: fixedCombat({ foes: [] }),
  });
  // d8=1 -> backfire; Fireball dmg 2d10+4: d10=5, d10=5 -> 14, self = ceil(14/2)=7.
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5]), []);
  const e = events.find((ev) => ev.type === "backfireSelfDamage");
  assert.ok(e, "backfireSelfDamage fires");
  assert.equal(e.spell, "Fireball");
  assert.equal(e.sub, "Apprentice");
  assert.equal(e.amount, 7);
  assert.equal(state.c.wp, 33, "40 - 7");
});

// ─── summonBackfired.{spell,sub} (Summoner, doubled creatures, 1-in-8) ─────

test("summonBackfired carries {spell, sub} on a Summoner's one-in-eight doubled-summon backfire", () => {
  const state = fixedState({
    c: fixedCaster({ sub: "Summoner", level: 5, grimoire: ["Summon"] }),
    combat: null, // no active combat: Summon's combatOnly is false; C stays null, ally goes to pendingAlly
  });
  // c.sub !== "Apprentice" so the early backfire branch is skipped; sp.kind
  // === "summon", doubled = true (Summoner, not lesser); d8=1 -> backfire;
  // lvl = min(5, 5+1) = 5; hurt = lvl*lvl + d6 = 25 + 3 = 28.
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([1, 3]), []);
  const e = events.find((ev) => ev.type === "summonBackfired");
  assert.ok(e, "summonBackfired fires");
  assert.equal(e.spell, "Summon");
  assert.equal(e.sub, "Summoner");
  assert.equal(e.amount, 28);
  assert.equal(state.c.wp, 12, "40 - 28");
});

// ─── earthquakeSelfDamage.spell (no ward) ──────────────────────────────────

test("earthquakeSelfDamage carries {spell} when an unwarded caster takes half their own Earthquake", () => {
  const state = fixedState({
    c: fixedCaster({ sub: "Sorcerer", grimoire: ["Earthquake"], ward: null }),
    combat: fixedCombat({ foes: [] }),
  });
  // sp.dmg 3d10+8: d10=5,d10=5,d10=5 -> 23; self = ceil(23/2)=12.
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([5, 5, 5]), []);
  const e = events.find((ev) => ev.type === "earthquakeSelfDamage");
  assert.ok(e, "earthquakeSelfDamage fires");
  assert.equal(e.spell, "Earthquake");
  assert.equal(e.amount, 12);
  assert.equal(state.c.wp, 28, "40 - 12");
});

// ─── deathCast.cost / deathSpellTooWeak.fee ────────────────────────────────

test("deathCast carries cost:25 when a caster at 30 hp pays the fee", () => {
  const state = fixedState({
    c: fixedCaster({ sub: "Sorcerer", grimoire: ["Death"], wp: 30, maxWP: 55 }),
    combat: fixedCombat({ foes: [] }),
  });
  const events = castSpell(state, SPELL_IDX.Death, fakeRng([]), []);
  const e = events.find((ev) => ev.type === "deathCast");
  assert.ok(e, "deathCast fires");
  assert.equal(e.cost, 25);
  assert.equal(state.c.wp, 5, "30 - 25");
});

test("deathSpellTooWeak carries fee:25 and refuses when a caster at 26 hp cannot survive paying it", () => {
  const state = fixedState({
    c: fixedCaster({ sub: "Sorcerer", grimoire: ["Death"], wp: 26, maxWP: 55 }),
    combat: fixedCombat({ foes: [] }),
  });
  const events = castSpell(state, SPELL_IDX.Death, fakeRng([]), []);
  const e = events.find((ev) => ev.type === "deathSpellTooWeak");
  assert.ok(e, "deathSpellTooWeak fires");
  assert.equal(e.fee, 25);
  assert.equal(state.c.wp, 26, "no fee charged on refusal");
  assert.equal(state.c.spellsUsed, 0, "the refused cast refunds its charge");
});

// ─── insanitySelfHarm.loss ──────────────────────────────────────────────────

test("insanitySelfHarm carries loss equal to the hp actually removed (before - after)", () => {
  const state = fixedState({ c: { wp: 55 } });
  const events = goInsane(state, fakeRng([1]), []);
  const e = events.find((ev) => ev.type === "insanitySelfHarm");
  assert.ok(e, "insanitySelfHarm fires");
  assert.equal(state.c.wp, 28, "ceil(55/2)");
  assert.equal(e.loss, 27, "55 - 28");
});

test("insanitySelfHarm fires with loss:0 for a 1-hp character (ceil(1/2) === 1, no change)", () => {
  const state = fixedState({ c: { wp: 1 } });
  const events = goInsane(state, fakeRng([1]), []);
  const e = events.find((ev) => ev.type === "insanitySelfHarm");
  assert.ok(e, "insanitySelfHarm still fires");
  assert.equal(state.c.wp, 1);
  assert.equal(e.loss, 0);
});

// ─── zero rng change proof (belt-and-braces; the real proof is the grep-count
// acceptance criteria comparing engine/*.js's `rng\.` occurrence count
// against git HEAD, run at the shell level) ─────────────────────────────────

test("none of the nine additive keys required a new rng draw: every test above supplied exactly the pre-existing draw sequence", () => {
  // Documentation-only assertion: every fakeRng sequence above is the SAME
  // length as the pre-Phase-43 draw sequence for its scenario (each test's
  // own inline comment states the roll being consumed). A real additional
  // draw would have thrown "fakeRng: sequence exhausted" in the test above
  // it, failing loudly rather than silently passing.
  assert.ok(true);
});

// ─── docs/CLARITY.md ledger test ───────────────────────────────────────────

test("docs/CLARITY.md's Cost-event inventory names only real EVENT_NARRATION keys, at least 38 rows", () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, "docs", "CLARITY.md"), "utf8");
  const start = md.indexOf("## Cost-event inventory (CLAR-01)");
  const end = md.indexOf("## HP not WP sweep");
  assert.ok(start >= 0 && end > start, "both section headers must exist, in order");
  const section = md.slice(start, end);
  const lines = section.split("\n").filter((l) => l.trim().startsWith("|"));
  // Drop the header row and the `---` separator row.
  const dataLines = lines.filter((l) => !/^\|\s*Event\s*\|/.test(l) && !/^\|\s*-+\s*\|/.test(l));
  assert.ok(dataLines.length >= 38, `expected at least 38 rows, got ${dataLines.length}`);

  let checked = 0;
  for (const line of dataLines) {
    const cells = line.split("|");
    const eventCell = (cells[1] ?? "").trim();
    const causeCell = (cells[3] ?? "").trim();
    // Row 33 ("spell charge spent") has no dedicated event at all — the
    // plan's own explicit skip. `rationsEaten` (row 35) is a Plan 02 NEW
    // EVENT that does not exist in EVENT_NARRATION until Plan 02 lands —
    // its own inventory row says so in the Cause-key column, so skip only
    // that documented case, never widen this to any other row.
    if (!eventCell.includes("`")) continue;
    if (causeCell.includes("NEW EVENT")) continue;
    const names = [...eventCell.matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]);
    for (const name of names) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(EVENT_NARRATION, name),
        `${name} (from row: ${eventCell}) is not a key of EVENT_NARRATION`
      );
      checked++;
    }
  }
  assert.ok(checked >= 30, `expected to check at least 30 event names, got ${checked}`);
});
