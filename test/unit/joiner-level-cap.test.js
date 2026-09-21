// test/unit/joiner-level-cap.test.js
//
// Phase 53 (JOIN-02) — meetJoiner's Level Table roll is now clamped to the
// floor it is met on: `const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1],
// state.floor.depth);` (engine/encounters.js). The d10 is still drawn FIRST,
// so the draw count and the delegate rng cursor stay byte-identical whether
// or not the cap actually bites — every downstream read (grantLevelAbilities,
// both `20 * lvl + d20` wp rolls, c.joiner, pendingJoiner, joinerMet/
// joinerRefused) takes the ONE capped `lvl` binding.
//
// SC1 = the cap itself + the unchanged draw count/cursor.
// SC2 = grantLevelAbilities and the wp formula both receive the capped level
//       — a floor-2 capped Joiner is deepStrictEqual to a natively-rolled
//       level-2 Joiner from the same stream.
// SC3 = joinerMet/joinerRefused narration, payload key sets, and the rail-
//       card / Company-panel source reads are byte-identical to today.
//
// THE RULE (mirrors test/unit/foe-turn-draw-count.test.js): a draw-count or
// cursor mismatch here means meetJoiner's draw ORDER changed — that is a bug
// in the engine edit, never a reason to touch a pinned number in this file.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { meetJoiner } from "../../engine/encounters.js";
import { rollCharacter, grantLevelAbilities } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";
import { SPELL_LEVEL_TABLE } from "../../content/misc-tables.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- fixedFighter/fixedFloor/fixedState — copied verbatim from
// test/unit/joiner-acquisition.test.js, with identity-world.test.js's
// `pendingJoiner: null` default folded in (this file's own refusal test
// needs a real `null` to assert against, not `undefined`). ------------------
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
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

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "", pendingJoiner: null,
    ...rest,
  };
}

// --- countingRng(inner) — copied verbatim from
// test/unit/foe-turn-draw-count.test.js. ------------------------------------
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// --- scriptedFirstD10(first, seed) — a rng whose FIRST d(sides) call MUST be
// the Level Table d10 (asserted), returning `first` WITHOUT touching the
// delegate; every OTHER call (d/pick/shuffle/next/getState/setState) forwards
// to a private `makeRng(seed)`. So a capped roll (first = a high value) and a
// native roll (first = the floor's own value) share the IDENTICAL
// rollCharacter/wp-d20 stream off the same seed — the only way to prove SC2
// by deepStrictEqual. ---------------------------------------------------
function scriptedFirstD10(first, seed) {
  const delegate = makeRng(seed);
  let usedFirst = false;
  return {
    d(sides) {
      if (!usedFirst) {
        usedFirst = true;
        assert.equal(sides, 10, "scriptedFirstD10: the very first d() call must be meetJoiner's Level Table d10");
        return first;
      }
      return delegate.d(sides);
    },
    pick: (arr) => delegate.pick(arr),
    shuffle: (arr) => delegate.shuffle(arr),
    next: () => delegate.next(),
    getState: () => delegate.getState(),
    setState: (s) => delegate.setState(s),
  };
}

// --- SEED_FT / SEED_MU — measured ONCE by a search loop while writing this
// test (1..500), pinned as named constants:
//   SEED_FT = 1  — the smallest seed whose rollCharacter(makeRng(seed)).cls
//                  is Fighter or Thief (a Knight, Fridgian) — non-vacuous
//                  abilities assertion (a Magic User's pool is empty).
//   SEED_MU = 7  — the smallest seed whose class is Magic User (a Wizard,
//                  Human) — for the Wilmsry refusal payload.
const SEED_FT = 1;
const SEED_MU = 7;

// ─── SC1: the cap ────────────────────────────────────────────────────────

test("SC1: a d10 of 9 (Level Table 5) met on floor 2 arrives as level 2 — pendingJoiner.lvl/level, c.joiner.lvl and joinerMet.lvl all read 2", () => {
  assert.equal(SPELL_LEVEL_TABLE[8], 5, "d10 of 9 indexes SPELL_LEVEL_TABLE[8] = 5 (the roll really meant 5)");
  const state = fixedState({ floor: { depth: 2 } });
  const events = meetJoiner(state, scriptedFirstD10(9, SEED_FT), []);
  assert.equal(state.pendingJoiner.lvl, 2, "pendingJoiner.lvl is capped to the floor");
  assert.equal(state.pendingJoiner.level, 2, "pendingJoiner.level mirrors lvl");
  assert.equal(state.c.joiner.lvl, 2, "c.joiner.lvl is capped to the floor");
  const met = events.find((e) => e.type === "joinerMet");
  assert.ok(met, "joinerMet fires");
  assert.equal(met.lvl, 2, "joinerMet.lvl is capped to the floor");
});

test("SC1 control: the same scripted stream on floor 5 is NOT capped (level 5) and on floor 9 stays at the table ceiling (5); a d10 of 1 on floor 5 stays level 1 (the cap never raises)", () => {
  const floor5 = fixedState({ floor: { depth: 5 } });
  meetJoiner(floor5, scriptedFirstD10(9, SEED_FT), []);
  assert.equal(floor5.pendingJoiner.lvl, 5, "floor 5 is not capped below the rolled 5");

  const floor9 = fixedState({ floor: { depth: 9 } });
  meetJoiner(floor9, scriptedFirstD10(9, SEED_FT), []);
  assert.equal(floor9.pendingJoiner.lvl, 5, "the Level Table ceiling (5) still applies past floor 5 — min() never invents a level 6+");

  const floor5Low = fixedState({ floor: { depth: 5 } });
  meetJoiner(floor5Low, scriptedFirstD10(1, SEED_FT), []);
  assert.equal(floor5Low.pendingJoiner.lvl, 1, "a d10 of 1 (level 1) on floor 5 stays level 1 — the cap never RAISES a low roll");
});

test("SC1: the capped meet draws exactly as many rng calls as the uncapped meet and leaves the delegate cursor at the same getState; the draw after meetJoiner equals the hand-replayed control's next draw", () => {
  const cappedRng = countingRng(scriptedFirstD10(9, SEED_FT));
  const cappedState = fixedState({ floor: { depth: 2 } });
  meetJoiner(cappedState, cappedRng, []);

  const uncappedRng = countingRng(scriptedFirstD10(9, SEED_FT));
  const uncappedState = fixedState({ floor: { depth: 5 } });
  meetJoiner(uncappedState, uncappedRng, []);

  assert.equal(cappedRng.draws, uncappedRng.draws, "the same number of rng calls regardless of the cap");
  assert.equal(cappedRng.getState(), uncappedRng.getState(), "the delegate cursor lands at the same place regardless of the cap");

  const rcCounter = countingRng(makeRng(SEED_FT));
  rollCharacter(rcCounter);
  const rollCharacterDraws = rcCounter.draws;
  assert.equal(cappedRng.draws, 1 + rollCharacterDraws + 2, "1 (d10) + rollCharacter's own draws + 2 (the wp d20 x2) — no new draw added by the cap");

  // Hand-replayed control (joiner-acquisition.test.js's own pattern, minus the
  // d10 — scriptedFirstD10 never touches the delegate for its first call):
  const ctrl = makeRng(SEED_FT);
  rollCharacter(ctrl);
  ctrl.d(20);
  ctrl.d(20);
  const ctrlNext = ctrl.d(20);
  assert.equal(cappedRng.d(20), ctrlNext, "the draw following the capped meetJoiner equals the hand-replayed control's next draw");
});

// ─── SC2: abilities/wp receive the capped level ─────────────────────────

test("SC2: wp is 20 * 2 + the FIRST d20 after rollCharacter (maxWP mirrors it) for the floor-2 capped Joiner; the floor-5 uncapped twin reads 20 * 5 + the same d20", () => {
  const ctrl = makeRng(SEED_FT);
  rollCharacter(ctrl);
  const firstD20 = ctrl.d(20);

  const capped = fixedState({ floor: { depth: 2 } });
  meetJoiner(capped, scriptedFirstD10(9, SEED_FT), []);
  assert.equal(capped.pendingJoiner.wp, 40 + firstD20, "wp = 20 * capped lvl(2) + the first d20 after rollCharacter");
  assert.equal(capped.pendingJoiner.maxWP, capped.pendingJoiner.wp, "maxWP mirrors wp (the discarded second roll)");
  assert.equal(capped.c.joiner.wp, capped.c.joiner.maxWP, "c.joiner mirrors the same shape");
  assert.equal(capped.c.joiner.wp, capped.pendingJoiner.wp, "c.joiner and pendingJoiner agree on wp");

  const uncapped = fixedState({ floor: { depth: 5 } });
  meetJoiner(uncapped, scriptedFirstD10(9, SEED_FT), []);
  assert.equal(uncapped.pendingJoiner.wp, 100 + firstD20, "the floor-5 uncapped twin reads 20 * 5 + the SAME d20");
});

test("SC2: a floor-2 capped Joiner (rolled 5) is deepStrictEqual to a natively-rolled level-2 Joiner (d10 of 3) from the same stream — pendingJoiner, c.joiner and the joinerMet event", () => {
  assert.equal(SPELL_LEVEL_TABLE[2], 2, "d10 of 3 indexes SPELL_LEVEL_TABLE[2] = 2 (a NATIVE level-2 roll, no cap applied)");

  const capped = fixedState({ floor: { depth: 2 } });
  const cappedEvents = meetJoiner(capped, scriptedFirstD10(9, SEED_FT), []);

  const native = fixedState({ floor: { depth: 2 } });
  const nativeEvents = meetJoiner(native, scriptedFirstD10(3, SEED_FT), []);

  assert.deepStrictEqual(capped.pendingJoiner, native.pendingJoiner, "pendingJoiner is identical whether the level-2 result was capped or rolled natively");
  assert.deepStrictEqual(capped.c.joiner, native.c.joiner, "c.joiner is identical");
  assert.deepStrictEqual(
    cappedEvents.find((e) => e.type === "joinerMet"),
    nativeEvents.find((e) => e.type === "joinerMet"),
    "the joinerMet event is identical",
  );

  // The direct SC2 statement: grantLevelAbilities received the CAPPED level,
  // reconstructed independently via the same base key meetJoiner itself uses
  // (`joiner:${name}:${depth}` — depth is 2 for both).
  const twin = rollCharacter(makeRng(SEED_FT));
  const twinAdded = grantLevelAbilities(twin, `joiner:${twin.name}:2`, 2);
  assert.deepStrictEqual(capped.pendingJoiner.abilities, twin.abilities, "abilities equal a fresh grantLevelAbilities(..., 2) rebuild from the same stream");
  assert.equal(twinAdded.length, 2, "grantLevelAbilities(..., 2) grants exactly one pool id per level (1 and 2) for a Fighter/Thief");

  // Negative: a level-5 twin (if the roll had been allowed to stand) has
  // STRICTLY MORE ability ids than the capped level-2 Joiner — proving the
  // pre-cap level never leaks into the abilities grant.
  const level5Twin = rollCharacter(makeRng(SEED_FT));
  const level5Added = grantLevelAbilities(level5Twin, `joiner:${level5Twin.name}:2`, 5);
  assert.ok(level5Added.length >= 4, "a Fighter/Thief level-pool grants at least 4 ids by level 5 (Thief pool 4, Fighter pool 5)");
  assert.ok(
    level5Twin.abilities.length > capped.pendingJoiner.abilities.length,
    "the level-5 twin has MORE ability ids than the capped level-2 Joiner",
  );
});

// ─── SC1/SC3: the Wilmsry refusal payload ───────────────────────────────

test("SC1/SC3: a Wilmsry meeting a Magic User Joiner rolled 5 on floor 2 is refused with joinerRefused.lvl 2, pendingJoiner stays null, and the payload key sets are pinned", () => {
  const state = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 2 } });
  const events = meetJoiner(state, scriptedFirstD10(9, SEED_MU), []);
  const met = events.find((e) => e.type === "joinerMet");
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(met, "joinerMet still fires before the refusal");
  assert.ok(refused, "joinerRefused fires");
  assert.equal(refused.lvl, 2, "joinerRefused.lvl is the capped level");
  assert.equal(refused.reason, "wilmsry");
  assert.equal(state.pendingJoiner, null, "pendingJoiner stays null on a refusal");
  assert.deepStrictEqual(Object.keys(met), ["type", "name", "race", "sub", "lvl"], "joinerMet's key set is pinned");
  assert.deepStrictEqual(Object.keys(refused), ["type", "reason", "name", "sub", "cls", "lvl"], "joinerRefused's key set is pinned");
});

// ─── SC3: shapes / narration / rail-card source pins ────────────────────

test("SC3: c.joiner keeps its frozen 7-key shape; pendingJoiner's ONLY new key is lvl — level/wp/maxWP already exist on a rollCharacter sheet and are OVERRIDDEN (not added) to the joiner's combat stats", () => {
  const state = fixedState({ floor: { depth: 2 } });
  meetJoiner(state, scriptedFirstD10(9, SEED_FT), []);
  assert.deepStrictEqual(
    Object.keys(state.c.joiner).sort(),
    ["cls", "lvl", "maxWP", "name", "race", "sub", "wp"],
    "c.joiner's frozen 7-key shape is unchanged",
  );
  // Measured (not assumed): rollCharacter's own sheet ALREADY carries level/
  // wp/maxWP (level: 1, wp/maxWP from the class roll) — meetJoiner's spread
  // OVERRIDES those three to the joiner's own combat stats rather than
  // adding new keys; `lvl` is the only key genuinely absent from a bare
  // rollCharacter sheet.
  const sheetKeys = new Set(Object.keys(rollCharacter(makeRng(SEED_FT))));
  const pendingKeys = new Set(Object.keys(state.pendingJoiner));
  const added = [...pendingKeys].filter((k) => !sheetKeys.has(k));
  assert.deepStrictEqual(added.sort(), ["lvl"], "pendingJoiner's only genuinely NEW key (vs. the key SET already on a rollCharacter sheet) is lvl");
  const overridden = ["level", "wp", "maxWP"].filter((k) => sheetKeys.has(k));
  assert.deepStrictEqual(overridden.sort(), ["level", "maxWP", "wp"], "level/wp/maxWP pre-exist on the sheet and are overridden by the joiner spread, never appended as new keys");
  assert.equal(state.pendingJoiner.level, state.pendingJoiner.lvl, "pendingJoiner.level is overridden to the (capped) joiner lvl");
  assert.equal(state.pendingJoiner.wp, state.pendingJoiner.maxWP, "pendingJoiner.wp/maxWP are overridden to the joiner's own combat wp (the discarded second roll)");
});

test("SC3: joinerMet and joinerRefused render byte-identical through narrateEvent and LINE_FOR for a capped vs a natively-rolled Joiner of the same level, and match today's copy verbatim", () => {
  const capped = fixedState({ floor: { depth: 2 } });
  const cappedEvents = meetJoiner(capped, scriptedFirstD10(9, SEED_FT), []);
  const native = fixedState({ floor: { depth: 2 } });
  const nativeEvents = meetJoiner(native, scriptedFirstD10(3, SEED_FT), []);
  assert.equal(
    narrateEvent(cappedEvents.find((e) => e.type === "joinerMet")),
    narrateEvent(nativeEvents.find((e) => e.type === "joinerMet")),
    "joinerMet renders identically for a capped vs a natively-rolled same-level Joiner",
  );

  const cappedWilmsry = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 2 } });
  const cappedRefusedEvents = meetJoiner(cappedWilmsry, scriptedFirstD10(9, SEED_MU), []);
  const nativeWilmsry = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 2 } });
  const nativeRefusedEvents = meetJoiner(nativeWilmsry, scriptedFirstD10(3, SEED_MU), []);
  const cappedRefused = cappedRefusedEvents.find((e) => e.type === "joinerRefused");
  const nativeRefused = nativeRefusedEvents.find((e) => e.type === "joinerRefused");
  assert.equal(narrateEvent(cappedRefused), narrateEvent(nativeRefused), "joinerRefused renders identically for a capped vs a natively-rolled same-level Joiner");
  assert.equal(
    LINE_FOR.joinerRefused(cappedRefused).text,
    LINE_FOR.joinerRefused(nativeRefused).text,
    "LINE_FOR.joinerRefused renders identically for a capped vs a natively-rolled same-level Joiner",
  );

  // Literal snapshots against today's copy (read verbatim from the source
  // files while writing this test):
  assert.equal(
    narrateEvent({ type: "joinerMet", name: "Ada Brook", race: "Human", sub: "Guard", lvl: 2 }),
    '<span class="hit">Ada Brook</span>, a Guard, joins you for a while.',
  );
  assert.equal(
    narrateEvent({ type: "joinerRefused", reason: "wilmsry", name: "Ada Brook", sub: "Apprentice", cls: "Magic User", lvl: 2 }),
    '<span class="beat">Ada Brook, a Magic User, takes one look at a Wilmsry and remembers an appointment elsewhere.</span>',
  );
  assert.equal(
    LINE_FOR.joinerRefused({ type: "joinerRefused", reason: "wilmsry", name: "Ada Brook", sub: "Apprentice", cls: "Magic User", lvl: 2 }).text,
    "Ada Brook takes one look at a Wilmsry and leaves.",
  );
});

test("SC3: the rail card and the Company panel read the SAME capped lvl field — source pins on mazeworld.html and src/browser/heroTab.js", () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  const startMarker = "} else if (S.pendingJoiner && !S.combat && !S.store) {";
  const endMarker = "} else if (S.pendingFind";
  const start = html.indexOf(startMarker);
  assert.ok(start !== -1, "the rail card's joiner branch is present in mazeworld.html");
  const end = html.indexOf(endMarker, start);
  assert.ok(end !== -1 && end > start, "the joiner branch is followed by the pendingFind branch");
  const region = html.slice(start, end);
  assert.match(region, /const lvl = j\.lvl \?\? j\.level \?\? 1;/, "the rail card reads j.lvl ?? j.level ?? 1 — the capped level rides the existing payload");
  assert.match(region, /skill level \$\{window\.__mzTables\.ROMAN\[lvl - 1\] \|\| lvl\}/, "the rail card's roll text renders the capped level unchanged");

  const heroTabSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n");
  assert.match(heroTabSrc, /const lvl = m\.lvl \?\? m\.level \?\? 1;/, "the Company panel reads m.lvl ?? m.level ?? 1 — the same capped level, no shell change needed");
});
