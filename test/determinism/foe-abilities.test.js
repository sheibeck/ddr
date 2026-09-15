// test/determinism/foe-abilities.test.js
//
// FOE-09 / D-15: the determinism proof for the five caster encounters the
// parity fixture suite never exercises. test/parity/FIXTURE-INVENTORY.md's
// frozen fixtures cover only Beasts tier 1 and Humans tier 1 (no `abilities`
// kit lives at either tier) — every caster this phase added (Krupke, Drudge,
// Djinni, Vampire, Stalka Beast) is reachable ONLY through a forced-type,
// forced-tier encounter this file builds itself.
//
// WHY the parity suite alone cannot cover this: the frozen prototype master
// (test/parity/prototype-master.js.txt) was captured before Phase 19 and can
// never be regenerated with a caster's abilities firing without breaking the
// "frozen forever" contract (17-RESEARCH.md, D-14). So the ONLY way to prove
// a caster fight is deterministic — same seed in, same events/state/draws
// out, every time — is a dedicated determinism suite that forces the
// encounter directly, the same way test/determinism/same-seed-same-result.js
// already does for newRun() itself.
//
// PROVENANCE: every seed and every pinned number below was MEASURED against
// the post-19-03 engine (engine/foeAbilities.js + engine/combat.js's ability
// gate) on 2026-09-13, by running the exact helpers below (setupEncounter /
// runFullFight / runVisits) against the real engine and recording what came
// out. Nothing here was hand-traced or guessed.
//
// THE RULE (same as test/unit/foe-turn-draw-count.test.js's): a mismatch
// against any pin below means the engine's draw order, roster, or ability
// gating CHANGED since this suite was written — that is an ENGINE bug (or an
// intentional, escalated, rationale-bearing divergence), never a reason to
// "adjust" a pin here to make a red run green. Test 1 re-derives every seed
// itself on every run, specifically so a roster/kit/chargen-draw drift fails
// at THAT test first, loudly, rather than silently desyncing every later pin.
//
// No test in this file reads ambient randomness or the wall clock — every
// seed and every expected value below is a literal constant.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { startCombat, playerStrike, foeTurn } from "../../engine/combat.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";

// --- countingRng: verbatim copy of test/unit/foe-turn-draw-count.test.js's
// helper — a test file cannot import another test file without running its
// tests, so this wrapper is duplicated here rather than shared. -------------

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

// --- Encounter specs (D-15) -------------------------------------------------
//
// Tier is forced through startCombat's own arithmetic (`maxLvl = clamp(min(
// c.level, floor.depth), 1, 5)`, each foe's `lvl` a d4-gated one-tier drop),
// so setting `state.c.level = state.floor.depth = tier` after `newRun(seed)`
// makes the wanted roster reachable — no engine change, no fixture. A spec's
// `seed` is the FIRST seed in 1..SEED_SEARCH_LIMIT whose post-startCombat
// roster contains a foe named `want` with a non-empty `abilities` array; test
// 1 below re-derives this from scratch every run.

const ENCOUNTERS = [
  { key: "humans-t2", type: "Humans", tier: 2, want: "Krupke", seed: 1 },
  { key: "magical-t4", type: "Magical", tier: 4, want: "Drudge", seed: 1 },
  { key: "demons-t5", type: "Demons", tier: 5, want: "Djinni", seed: 1 },
  { key: "walking-dead-t5", type: "Walking Dead", tier: 5, want: "Vampire", seed: 1 },
  { key: "beasts-t5", type: "Beasts", tier: 5, want: "Stalka Beast", seed: 1 },
];
const SEED_SEARCH_LIMIT = 300;
const VISITS = 12;

// --- Helpers -----------------------------------------------------------------

/** setupEncounter(spec, seed) — builds a fresh forced-type/forced-tier
 * combat the same way a real run would (newRun -> force level/depth to the
 * spec's tier -> startCombat with the forced type), returning the counting
 * rng that drove it so callers can keep drawing from the same cursor. */
function setupEncounter(spec, seed) {
  const state = newRun(seed);
  state.c.level = spec.tier;
  state.floor.depth = spec.tier;
  const start = state.rngState;
  const rng = countingRng(makeRng(start));
  const events = [];
  startCombat(state, false, spec.type, rng, events);
  return { state, rng, events, start };
}

/** hasCaster(state, want) — true when a live foe named `want` carries a
 * non-empty `abilities` kit (the structural zero-draw gate this whole suite
 * exists to exercise the OTHER side of). */
function hasCaster(state, want) {
  return (
    state.combat &&
    state.combat.foes.some((f) => f.name === want && Array.isArray(f.abilities) && f.abilities.length > 0)
  );
}

/** firstCasterSeed(spec) — the self-deriving half of the D-15 pin: scans
 * seeds 1..SEED_SEARCH_LIMIT and returns the first one whose roster contains
 * the wanted caster. Throws (naming the spec) if none is found within the
 * cap, so a roster change that removes the caster entirely fails loudly
 * instead of silently returning undefined. */
function firstCasterSeed(spec) {
  for (let seed = 1; seed <= SEED_SEARCH_LIMIT; seed++) {
    const { state } = setupEncounter(spec, seed);
    if (hasCaster(state, spec.want)) return seed;
  }
  throw new Error(`firstCasterSeed: no seed in 1..${SEED_SEARCH_LIMIT} rolled a caster ${spec.want} for ${spec.key}`);
}

/** runFullFight(spec) — replays the pinned encounter start-to-finish
 * (startCombat, then playerStrike in a loop until combat resolves or the
 * hero dies), driven by ONE counting rng, and captures a mid-fight
 * `state.combat` snapshot the first action after a `foeCast` fires (FID-04).
 * If the fight ends on the very same action that produced the first
 * foeCast (no further action to snapshot AFTER it), falls back to a
 * snapshot taken immediately after startCombat — that object already
 * carries the Phase-19 shape (`f.abilities`) via startCombat's kit copy, so
 * the FID-04 JSON-round-trip test still has a real, Phase-19-shaped combat
 * object to check. */
function runFullFight(spec) {
  const { state, rng, events, start } = setupEncounter(spec, spec.seed);
  assert.ok(hasCaster(state, spec.want), `${spec.key}: seed ${spec.seed} did not roll its caster`);
  const foeNames = state.combat.foes.map((f) => f.name);
  const afterStartSnapshot = structuredClone(state.combat);
  let snapshot = null;
  let attacks = 0;
  while (state.combat && !state.dead && attacks < 200) {
    const before = events.length;
    playerStrike(state, rng, events);
    attacks++;
    if (!snapshot && state.combat && events.slice(before).some((e) => e.type === "foeCast")) {
      snapshot = structuredClone(state.combat);
    }
  }
  if (!snapshot) snapshot = afterStartSnapshot;
  return {
    state,
    events,
    draws: rng.draws,
    cursor: rng.getState() | 0,
    start,
    attacks,
    foeNames,
    snapshot,
    outcome: state.dead ? "died" : "won",
  };
}

/** runVisits(spec, visits) — replays `visits` direct `foeTurn` calls against
 * an effectively-unkillable hero (`c.wp = c.maxWP = 5000`, the ONLY fields
 * touched) so the per-visit draw log measures the caster's OWN decisions,
 * not hero survival. Returns the per-visit draw-count array plus the
 * cumulative draws/cursor/events for replay-identity comparison. */
function runVisits(spec, visits) {
  const { state, rng, events, start } = setupEncounter(spec, spec.seed);
  state.c.wp = 5000;
  state.c.maxWP = 5000;
  const perVisit = [];
  for (let v = 0; v < visits; v++) {
    const before = rng.draws;
    foeTurn(state, rng, events);
    perVisit.push(rng.draws - before);
    if (!state.combat || state.dead) break;
  }
  return { state, events, perVisit, draws: rng.draws, cursor: rng.getState() | 0, start };
}

// --- Pinned constants (measured, see PROVENANCE above) ----------------------

// Phase 24 (2026-09-14, race pass, IDENT-08 collateral): seed 1's hero is a
// Fridgian Knight (test/parity/FIXTURE-INVENTORY.md/CONTEXT.md both note this
// seed as "a Fridgian Knight (1)"). Three of these five full-fight totals
// (humans-t2, demons-t5, beasts-t5) changed because the frenzy corpse-whiff
// draw was DELIBERATELY removed (engine/combat.js playerStrike) — each of
// these fights kills one of its two same-named foes mid-fight, leaving a
// corpse the OLD code could roll a whiff against on a later frenzy; that
// draw (and the round it could waste) no longer happens, so each fight now
// also resolves one attack sooner. magical-t4 and walking-dead-t5 are
// unaffected (unchanged) and re-measured to confirm. Every number below was
// re-measured live against the patched engine via this file's own
// runFullFight helper, never hand-computed — same "pins are measured, not
// adjusted" rule as test/unit/foe-turn-draw-count.test.js.
const FULL_FIGHT_PINS = {
  "humans-t2": { foeNames: ["Krupke", "Krupke"], totalDraws: 59, attacks: 4, outcome: "won" },
  "magical-t4": { foeNames: ["Drudge", "Drudge"], totalDraws: 46, attacks: 4, outcome: "won" },
  "demons-t5": { foeNames: ["Djinni", "Djinni"], totalDraws: 55, attacks: 4, outcome: "won" },
  "walking-dead-t5": { foeNames: ["Vampire", "Vampire"], totalDraws: 36, attacks: 2, outcome: "died" },
  "beasts-t5": { foeNames: ["Stalka Beast", "Stalka Beast"], totalDraws: 64, attacks: 4, outcome: "died" },
};

const PER_VISIT_PINS = {
  "humans-t2": [4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 5, 5],
  "magical-t4": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4],
  "demons-t5": [4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 5, 5],
  // RE-MEASURED (WR-01, 19-REVIEW-FIX.md): the vampireSummon reinforcement's
  // `lvl` now correctly matches the tier-2 roster it was drawn from (2)
  // instead of the summoner's own lvl (5, via `Math.max(1, f.lvl - 1)` = 4).
  // This is a LEGITIMATE downstream draw-count change, not a regression: the
  // reinforcement's to-hit die (`foeDie`, STRIKE_DICE[lvl-1]) is now a d12
  // instead of a d8, so the SAME underlying rng float at each of its own
  // to-hit rolls (from visit 7 onward, once the Skeleton/Google reinforcements
  // start swinging) now lands on a different side of the hit/miss threshold,
  // cascading into a different damage-roll draw or not. Draws 1-6 (before any
  // reinforcement has taken its own swing) are unchanged. Old pin (pre-fix):
  // [4, 6, 4, 6, 7, 5, 11, 10, 10, 9, 9, 8].
  "walking-dead-t5": [4, 6, 4, 6, 7, 5, 10, 10, 8, 8, 7, 10],
  "beasts-t5": [4, 6, 4, 6, 5, 4, 6, 8, 6, 4, 7, 5],
};

// --- Tests -------------------------------------------------------------------

test("FOE-09 / D-15: each pinned seed is the FIRST seed in 1..300 that rolls its caster with a kit", () => {
  for (const spec of ENCOUNTERS) {
    assert.equal(firstCasterSeed(spec), spec.seed, `${spec.key}: pinned seed drifted from the first-match seed`);
  }
});

for (const spec of ENCOUNTERS) {
  const pin = FULL_FIGHT_PINS[spec.key];
  test(`FOE-09 / D-15 ${spec.key}: a full fight at seed ${spec.seed} is replay-identical and pins ${pin.totalDraws} draws / ${pin.attacks} attacks (${pin.outcome})`, () => {
    const a = runFullFight(spec);
    const b = runFullFight(spec);
    assert.deepStrictEqual(a.events, b.events, `${spec.key}: events diverged across two runs`);
    assert.deepStrictEqual(stripVolatileFields(a.state), stripVolatileFields(b.state), `${spec.key}: state diverged across two runs`);
    assert.equal(a.draws, b.draws);
    assert.equal(a.cursor, b.cursor);
    assert.equal(a.attacks, b.attacks);

    assert.deepStrictEqual(a.foeNames, pin.foeNames);
    assert.equal(a.draws, pin.totalDraws, `${spec.key}: pinned total draws mismatch — an ENGINE change, not a pin to edit`);
    assert.equal(a.attacks, pin.attacks);
    assert.equal(a.outcome, pin.outcome);
    assert.ok(a.attacks < 200, `${spec.key}: hit the 200-attack safety cap — fight never resolved`);
    assert.equal(
      (a.start + Math.imul(a.draws, 0x6d2b79f5)) | 0,
      a.cursor,
      `${spec.key}: counter disagrees with the rng cursor`,
    );
  });
}

for (const spec of ENCOUNTERS) {
  test(`FOE-09 / D-15 ${spec.key}: ${VISITS} foeTurn visits pin per-visit draws [${PER_VISIT_PINS[spec.key].join(",")}] and are replay-identical`, () => {
    const a = runVisits(spec, VISITS);
    const b = runVisits(spec, VISITS);
    assert.deepStrictEqual(a.perVisit, b.perVisit);
    assert.deepStrictEqual(a.events, b.events);
    assert.deepStrictEqual(stripVolatileFields(a.state), stripVolatileFields(b.state));
    assert.equal(a.cursor, b.cursor);

    assert.deepStrictEqual(a.perVisit, PER_VISIT_PINS[spec.key], `${spec.key}: per-visit draw pins mismatch`);
    assert.equal(a.state.dead, false);
    assert.ok(
      a.events.filter((e) => e.type === "foeCast").length >= 1,
      `${spec.key}: no foeCast fired in ${VISITS} visits — vacuous pass`,
    );

    if (spec.key === "magical-t4") {
      // CANON-02: the Drudge is never_melee — it must never swing.
      assert.ok(
        !a.events.some((e) => e.name === "Drudge" && ["foeMissed", "struckByFoe", "armorSoaked"].includes(e.type)),
        "the Drudge (never_melee) logged a melee-shaped event",
      );
    }
    if (spec.key === "walking-dead-t5") {
      // D-12: a queued summon (pending: true) must be followed by its join
      // (pending: false) and the live foe count must have grown.
      const pendingIdx = a.events.findIndex((e) => e.type === "foeSummoned" && e.pending === true);
      if (pendingIdx >= 0) {
        const joinedLater = a.events
          .slice(pendingIdx + 1)
          .some((e) => e.type === "foeSummoned" && e.pending === false);
        assert.ok(joinedLater, "a pending summon never joined C.foes");
        assert.ok(a.state.combat.foes.length > FULL_FIGHT_PINS["walking-dead-t5"].foeNames.length - 1, "foe count did not grow after the summon joined");
      }
    }
  });
}

test("FOE-09 / D-15 coverage: across the five per-visit logs every resistible or queued kind fires — bolt, drain, debuff and summon", () => {
  const kinds = new Set();
  for (const spec of ENCOUNTERS) {
    const r = runVisits(spec, VISITS);
    for (const e of r.events) {
      if (e.type === "foeCast") kinds.add(e.kind);
    }
  }
  for (const wanted of ["bolt", "drain", "debuff", "summon"]) {
    assert.ok(kinds.has(wanted), `no pinned encounter ever cast a "${wanted}" ability in ${VISITS} visits`);
  }
  // heal is exercised by 19-03's unit tests (test/unit/foe-abilities.test.js)
  // via a fixture built specifically below-full-HP; none of these five
  // encounters' foes start below maxWP, so heal never becomes ready here —
  // this is expected, not a gap (see the SUMMARY for the beasts-t5 full-fight
  // exception, where the Stalka Beast DOES heal after taking damage).
});

test("FID-04 / D-14: the mid-fight combat snapshot carrying the new fields is JSON-lossless for every pinned encounter", () => {
  for (const spec of ENCOUNTERS) {
    const { snapshot } = runFullFight(spec);
    assert.ok(snapshot, `${spec.key}: no snapshot captured`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, `${spec.key}: snapshot is not JSON-lossless`);
    assert.ok(
      snapshot.foes.some((f) => Object.hasOwn(f, "abilities")),
      `${spec.key}: snapshot carries no foe with an "abilities" field`,
    );
    for (const f of snapshot.foes) {
      if (f.cd) {
        for (const v of Object.values(f.cd)) {
          assert.ok(Number.isInteger(v) && v >= 0, `${spec.key}: f.cd value ${v} is not a non-negative integer`);
        }
      }
      if (f.uses) {
        for (const v of Object.values(f.uses)) {
          assert.ok(Number.isInteger(v) && v >= 0, `${spec.key}: f.uses value ${v} is not a non-negative integer`);
        }
      }
    }
  }
});
