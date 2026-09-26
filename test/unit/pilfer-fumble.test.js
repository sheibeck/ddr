// test/unit/pilfer-fumble.test.js
//
// RULES-09 (Phase 75.1, user 2026-09-24/25): the Pilfer's magic-item fumble.
// The heal-only refusal (`useItem` `reason: "pilfer"`) is gone — a Pilfer
// uses jewelry, cloaks and staves like anyone else, but each USE of one of
// those three kinds rolls a d20 through `rollCheck` at `atLeastFor(19, 20)`:
// a 1 fails the use, blasts the Pilfer for a d10 (no armor/ward soak) and
// dusts the item (gone from its bag index or worn slot). Potions, scrolls,
// tools and equipping never roll; every refusal fires before the draw.
//
// This suite exercises `PILFER_FUMBLE_KINDS`, `pilferFumbles`,
// `pilferFumbleRng` and the fumble step in `useItem` directly. Local fixture
// helpers mirror the established per-file convention (this file does not
// import another test file's helpers, so it reads standalone).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollCheck, atLeastFor } from "../../engine/dice.js";
import { useItem, pilferFumbles, pilferFumbleRng, PILFER_FUMBLE_KINDS } from "../../engine/items.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { SUB_NOTE } from "../../content/flavor.js";
import { EPITAPHS, CAUSE_TEXT } from "../../content/epitaphs.js";

const SEED = 4242;

/** noDrawRng() — an rng whose `.d()` always throws, proving "no rng draw
 * expected" by construction (mirrors test/unit/item-wiring.test.js's own
 * helper of the same name). */
function noDrawRng() {
  return { d: () => { throw new Error("noDrawRng: no rng draw expected"); }, pick: (a) => a[0], shuffle: (a) => a };
}

/** fixedChar(overrides) — a minimal, fixed level-1 character carrying every
 * field useItem's refusal ladder and the fumble step touch. Defaults to a
 * Pilfer (a Thief) — override sub/cls for a control character. */
function fixedChar(overrides = {}) {
  return {
    cls: "Thief", sub: "Pilfer", race: "Human", level: 1,
    wp: 40, maxWP: 40, might: 0, gold: 50, kills: 0,
    weapon: "Fists", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    ward: null, regen: false, mirror: 0, affliction: null, halfNext: false,
    items: [], worn: {}, skills: {}, timers: {}, darkFor: 0,
    name: "Test Delver", motive: "Money",
    ...overrides,
  };
}

/** fixedState(overrides) — floor.g/py/px is present so inDark(state) never
 * throws walking `f.g[f.py][f.px]`, even when the test relies only on
 * `c.darkFor` (the persistent counter). */
function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedChar(cOverrides),
    floor: { depth: 1, py: 0, px: 0, g: [[{ wall: false, dark: false }]] },
    day: 1, steps: 0, combat: null, acts: 0, dead: false,
    ...rest,
  };
}

/**
 * findActsWithRoll(seed, itemName, wantRoll, maxActs) — searches
 * `state.acts` from 0 upward, with a REAL `makeRng(seed)` main rng (never
 * mocked, never advanced by the search itself — `pilferFumbleRng` only ever
 * READS its cursor), until `pilferFumbleRng(...)`'s first d20 draw (via
 * `rollCheck`, `atLeastFor(19, 20)`) equals `wantRoll` exactly. Bounded;
 * throws past `maxActs`.
 */
function findActsWithRoll(seed, itemName, wantRoll, maxActs = 5000) {
  const mainRng = makeRng(seed);
  for (let acts = 0; acts <= maxActs; acts++) {
    const stream = pilferFumbleRng({ acts }, mainRng, { n: itemName });
    const chk = rollCheck(stream, 20, atLeastFor(19, 20));
    if (chk.roll === wantRoll) return acts;
  }
  throw new Error(`no acts <= ${maxActs} gives roll ${wantRoll} for "${itemName}" (seed ${seed})`);
}

/** predictFumble(seed, itemName, acts) — a FRESH pilferFumbleRng with the
 * SAME key predicts the check and (on a fumble) the d10 blast, without
 * re-using the live instance the real useItem() call draws from. */
function predictFumble(seed, itemName, acts) {
  const mainRng = makeRng(seed);
  const stream = pilferFumbleRng({ acts }, mainRng, { n: itemName });
  const chk = rollCheck(stream, 20, atLeastFor(19, 20));
  const dmg = chk.ok ? null : stream.d(10); // roll:amount (test-side prediction, mirrors useItem's own draw)
  return { chk, dmg };
}

// ============================================================
// Task 1 — the fumble in useItem
// ============================================================

test("a fumble on a worn jewel: pilferFumbled with roll 1/atLeast 2/dieN 20, exact dmg, slot emptied, wp dropped by dmg, no itemUsed/itemEffectStarted/timer", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const acts = findActsWithRoll(SEED, ring.n, 1);
  const { chk, dmg } = predictFumble(SEED, ring.n, acts);
  assert.equal(chk.roll, 1);
  assert.equal(chk.atLeast, 2);
  assert.equal(chk.dieN, 20);

  const state = fixedState({ acts, c: { worn: { jewelry1: ring }, wp: 40, maxWP: 40 } });
  const events = useItem(state, { slot: "jewelry1" }, makeRng(SEED), []);

  const fumbled = events.find((e) => e.type === "pilferFumbled");
  assert.ok(fumbled, "expected a pilferFumbled event");
  assert.equal(fumbled.item, "Ring of Power");
  assert.equal(fumbled.slot, "jewelry1");
  assert.equal(fumbled.roll, 1);
  assert.equal(fumbled.atLeast, 2);
  assert.equal(fumbled.dieN, 20);
  assert.equal(fumbled.dmg, dmg);

  assert.equal(state.c.worn.jewelry1, undefined, "the ring is gone from the worn slot");
  assert.equal(state.c.wp, 40 - dmg);
  assert.equal(events.some((e) => e.type === "itemUsed"), false, "no itemUsed on a fumble");
  assert.equal(events.some((e) => e.type === "itemEffectStarted"), false, "no effect record starts on a fumble");
  assert.equal(state.c.timers["item:Ring of Power"], undefined, "no c.timers record for the item");
});

test("a worn cloak fumble empties c.worn.cloak; a bagged cloak fumble with NO c.worn key removes it from c.items and carries its index", () => {
  const cloak = { kind: "cloak", n: "Cloak of Strength" };
  const acts = findActsWithRoll(SEED, cloak.n, 1);

  const worn = fixedState({ acts, c: { worn: { cloak }, wp: 40, maxWP: 40 } });
  const events1 = useItem(worn, { slot: "cloak" }, makeRng(SEED), []);
  assert.equal(worn.c.worn.cloak, undefined, "the cloak is gone from the worn slot");
  assert.ok(events1.some((e) => e.type === "pilferFumbled" && e.slot === "cloak"));

  // A test state with no c.worn key at all — bag use of a cloak is still
  // allowed (the legacy-state precedent); a Pilfer's fumble on it removes it
  // from c.items and pilferFumbled carries its bag index.
  const bagged = fixedState({ acts, c: { items: [{ ...cloak }], wp: 40, maxWP: 40 } });
  delete bagged.c.worn;
  const events2 = useItem(bagged, 0, makeRng(SEED), []);
  const fumbled2 = events2.find((e) => e.type === "pilferFumbled");
  assert.ok(fumbled2, "expected a pilferFumbled event for the bagged cloak");
  assert.equal(fumbled2.index, 0);
  assert.equal(fumbled2.slot, undefined);
  assert.equal(bagged.c.items.length, 0, "the cloak is gone from the bag");
});

test("with a key giving roll 2 or more, the use proceeds exactly as for a non-Pilfer: itemUsed plus the kind effect, and the item stays", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const acts = findActsWithRoll(SEED, ring.n, 2);
  const { chk } = predictFumble(SEED, ring.n, acts);
  assert.equal(chk.ok, true, "roll 2 against atLeast 2 succeeds");

  const state = fixedState({ acts, c: { worn: { jewelry1: ring }, wp: 40, maxWP: 40 } });
  const events = useItem(state, { slot: "jewelry1" }, makeRng(SEED), []);

  assert.equal(events.some((e) => e.type === "pilferFumbled"), false);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(events.some((e) => e.type === "itemEffectStarted" && e.kind === "power"));
  assert.equal(state.c.worn.jewelry1, ring, "the ring is still worn — nothing was consumed or destroyed");
  assert.equal(state.c.wp, 40, "no hp lost on a successful use");
});

test("adjacency: roll 1 fumbles; roll 2 does not (both keys found by search and pinned)", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const fumbleActs = findActsWithRoll(SEED, ring.n, 1);
  const okActs = findActsWithRoll(SEED, ring.n, 2);
  assert.equal(predictFumble(SEED, ring.n, fumbleActs).chk.ok, false);
  assert.equal(predictFumble(SEED, ring.n, okActs).chk.ok, true);
});

test("boundary: a Pilfer at hp equal to the blast dies (cause pilferFumble, deathNote names the item); at hp equal to the blast plus one, survives on 1 hp", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const acts = findActsWithRoll(SEED, ring.n, 1);
  const { dmg } = predictFumble(SEED, ring.n, acts);

  const dying = fixedState({ acts, c: { worn: { jewelry1: { ...ring } }, wp: dmg, maxWP: 100 } });
  const events1 = useItem(dying, { slot: "jewelry1" }, makeRng(SEED), []);
  assert.equal(dying.c.wp, 0);
  assert.equal(dying.dead, true);
  assert.ok(events1.some((e) => e.type === "died" && e.cause === "pilferFumble"));
  assert.ok(dying.deathNote.includes(ring.n), "the death note names the item");

  const surviving = fixedState({ acts, c: { worn: { jewelry1: { ...ring } }, wp: dmg + 1, maxWP: 100 } });
  const events2 = useItem(surviving, { slot: "jewelry1" }, makeRng(SEED), []);
  assert.equal(surviving.c.wp, 1);
  assert.equal(surviving.dead, false);
  assert.equal(events2.some((e) => e.type === "died"), false);
});

test("a Pilfer's Strength potion and a Pilfer's torch each draw nothing new (no fumble, no cooldown)", () => {
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
  const pilferPotion = fixedState({ c: { items: [strength], might: 0 } });
  const eventsPotion = useItem(pilferPotion, 0, noDrawRng(), []);
  assert.ok(eventsPotion.some((e) => e.type === "itemUsed"));
  assert.equal(eventsPotion.some((e) => e.type === "pilferFumbled"), false);
  assert.equal(eventsPotion.some((e) => e.type === "useRefused"), false);

  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const pilferTorch = fixedState({ c: { items: [torch], darkFor: 5 } });
  const eventsTorch = useItem(pilferTorch, 0, noDrawRng(), []);
  assert.ok(eventsTorch.some((e) => e.type === "torchLit"));
  assert.equal(eventsTorch.some((e) => e.type === "pilferFumbled"), false);
});

test("a Pickpocket using the same jewel draws nothing new and never fumbles", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const state = fixedState({ c: { sub: "Pickpocket", worn: { jewelry1: ring } } });
  const events = useItem(state, { slot: "jewelry1" }, noDrawRng(), []);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.equal(events.some((e) => e.type === "pilferFumbled"), false);
  assert.equal(pilferFumbles(state.c, ring), false, "pilferFumbles is false for any non-Pilfer");
});

test("empty input: a bag index past the end, or an empty worn slot, is a silent no-op for a Pilfer too (no events, no draws)", () => {
  const state1 = fixedState({ c: { items: [] } });
  assert.deepStrictEqual(useItem(state1, 5, noDrawRng(), []), []);

  const state2 = fixedState({ c: { worn: {} } });
  assert.deepStrictEqual(useItem(state2, { slot: "jewelry1" }, noDrawRng(), []), []);
});

test("ordering: a pending fight, wrongClass, notWorn, combatOnly and cooldown each refuse before any fumble draw (the main rng cursor is unchanged)", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };

  // pending fight -> refuseIfPending fires first, before wrongClass/notWorn/
  // combatOnly/itemReady/the fumble step.
  {
    const state = fixedState({ c: { worn: { jewelry1: ring } }, combat: { pending: true, foes: [] } });
    const rng = makeRng(SEED);
    const before = rng.getState();
    const events = useItem(state, { slot: "jewelry1" }, rng, []);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: ring, reason: "notFought" }]);
    assert.equal(rng.getState(), before);
  }

  // wrongClass — a staff used by a Pilfer (a Thief) always refuses here
  // first, even though pilferFumbles(pilferC, staff) is itself true (the
  // kind carries fumble risk, but this particular use is unreachable).
  {
    const staff = { kind: "staff", n: "Rowan Staff", use: "dome" };
    const state = fixedState({ c: { items: [staff] } });
    const rng = makeRng(SEED);
    const before = rng.getState();
    const events = useItem(state, 0, rng, []);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: staff, reason: "wrongClass" }]);
    assert.equal(rng.getState(), before);
    assert.equal(pilferFumbles(state.c, staff), true);
  }

  // notWorn — a bagged jewel in the worn-slot model.
  {
    const state = fixedState({ c: { items: [ring], worn: {} } });
    const rng = makeRng(SEED);
    const before = rng.getState();
    const events = useItem(state, 0, rng, []);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: ring, reason: "notWorn" }]);
    assert.equal(rng.getState(), before);
  }

  // combatOnly — a targeted kind (Amulet of Stone, kind "stone") worn but
  // used with no active encounter.
  {
    const amulet = { kind: "jewel", n: "Amulet of Stone" };
    const state = fixedState({ c: { worn: { jewelry1: amulet } }, combat: null });
    const rng = makeRng(SEED);
    const before = rng.getState();
    const events = useItem(state, { slot: "jewelry1" }, rng, []);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: amulet, reason: "combatOnly" }]);
    assert.equal(rng.getState(), before);
  }

  // cooldown — a worn cloak already cooling down.
  {
    const cloak = { kind: "cloak", n: "Cloak of Strength" };
    const state = fixedState({
      c: { worn: { cloak }, timers: { "item:Cloak of Strength": { cadence: "squares", left: 30, phase: "cooldown" } } },
    });
    const rng = makeRng(SEED);
    const before = rng.getState();
    const events = useItem(state, { slot: "cloak" }, rng, []);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: cloak, reason: "cooldown", left: 30, phase: "cooldown" }]);
    assert.equal(rng.getState(), before);
  }
});

test("PILFER_FUMBLE_KINDS is exactly jewel, cloak and staff; pilferFumbles is true only for a Pilfer using one of those kinds", () => {
  assert.deepStrictEqual([...PILFER_FUMBLE_KINDS], ["jewel", "cloak", "staff"]);
  const pilferC = fixedChar();
  assert.equal(pilferFumbles(pilferC, { kind: "jewel" }), true);
  assert.equal(pilferFumbles(pilferC, { kind: "cloak" }), true);
  assert.equal(pilferFumbles(pilferC, { kind: "staff" }), true);
  assert.equal(pilferFumbles(pilferC, { kind: "potion" }), false);
  assert.equal(pilferFumbles(pilferC, { kind: "tool" }), false);
  assert.equal(pilferFumbles({ ...pilferC, sub: "Pickpocket" }, { kind: "jewel" }), false);
});

test("stream isolation: after a non-fumbling Pilfer use, the main rng cursor equals the cursor after the same use by a Pickpocket", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const acts = findActsWithRoll(SEED, ring.n, 20); // the best face — comfortably not a fumble

  const pilferState = fixedState({ acts, c: { worn: { jewelry1: { ...ring } } } });
  const rngP = makeRng(SEED);
  useItem(pilferState, { slot: "jewelry1" }, rngP, []);

  const pickpocketState = fixedState({ acts, c: { sub: "Pickpocket", worn: { jewelry1: { ...ring } } } });
  const rngK = makeRng(SEED);
  useItem(pickpocketState, { slot: "jewelry1" }, rngK, []);

  assert.equal(rngP.getState(), rngK.getState());
});

test("armor and ward: a Pilfer in plate with a Shield ward still loses the full blast", () => {
  const ring = { kind: "jewel", n: "Ring of Power" };
  const acts = findActsWithRoll(SEED, ring.n, 1);
  const { dmg } = predictFumble(SEED, ring.n, acts);
  const ward = { pool: 100, rounds: 99, name: "Shield" };
  const state = fixedState({
    acts,
    c: { worn: { jewelry1: ring }, wp: 100, maxWP: 100, ar: 15, armor: "Plate", ward },
  });
  useItem(state, { slot: "jewelry1" }, makeRng(SEED), []);
  assert.equal(state.c.wp, 100 - dmg, "no armor soak on the Pilfer's own hands");
  assert.deepStrictEqual(state.c.ward, ward, "the ward is untouched — it never soaks the blast either");
});

// ============================================================
// Task 2 — voice: SUB_NOTE.Pilfer, the Oracle/rail lines, CAUSE_TEXT and
// EPITAPHS never name a diagnosis
// ============================================================

// Built by concatenation on purpose (RULES-09 prohibition: "MUST NOT name a
// diagnosis or medical condition in any player-facing Pilfer text") — this
// file never spells one of these out whole.
const DIAGNOSIS_TERMS = [
  ["A", "D", "H", "D"].join(""),
  ["attention", " ", "deficit"].join(""),
  ["klepto", "mania"].join(""),
  ["hoarding", " ", "disorder"].join(""),
  ["O", "C", "D"].join(""),
  ["obsessive", "-", "compulsive"].join(""),
  ["impulse", " ", "control", " ", "disorder"].join(""),
  ["neuro", "divergent"].join(""),
  ["a", "u", "t", "i", "s", "t", "i", "c"].join(""),
];

test("voice: SUB_NOTE.Pilfer states both sides (traps/locks and the fumble) and, along with the Oracle/rail fumble lines, CAUSE_TEXT.pilferFumble and every EPITAPHS.pilferFumble line, never names a diagnosis", () => {
  const note = SUB_NOTE.Pilfer.toLowerCase();
  assert.ok(note.includes("trap"), "states the good: traps");
  assert.ok(/lock|sealed/.test(note), "states the good: locks/sealed rooms");
  assert.ok(/comes apart|d10/.test(note), "states the bad: the fumble");

  const evt = { type: "pilferFumbled", item: "Ring of Power", roll: 1, atLeast: 2, dieN: 20, dmg: 6 };
  const oracleLine = EVENT_NARRATION.pilferFumbled(evt);
  const railLine = LINE_FOR.pilferFumbled(evt, {}).text;

  const corpus = [note, oracleLine, railLine, CAUSE_TEXT.pilferFumble, ...EPITAPHS.pilferFumble].join(" ").toLowerCase();
  for (const term of DIAGNOSIS_TERMS) {
    assert.ok(!corpus.includes(term.toLowerCase()), `player-facing Pilfer text must never name "${term}"`);
  }

  assert.ok(oracleLine.includes("Ring of Power"), "the Oracle line names the item");
  assert.ok(railLine.includes("Ring of Power"), "the rail line names the item");
  assert.ok(oracleLine.includes("6"), "the Oracle line states the hp lost");
  assert.ok(railLine.includes("6"), "the rail line states the hp lost");
});
