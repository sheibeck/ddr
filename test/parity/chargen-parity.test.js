// ENG-05 chargen parity: the extracted engine rolls a character byte-identical
// to the frozen prototype for the same seed. Both sides consume the SAME
// mulberry32 stream (the sandbox seeds Math.random with it; the engine reads it
// via makeRng), in the SAME order (rollCharacter → genFloor(1)), so the rolled
// adventurer must match field-for-field.
//
// Comparison is scoped to the character subtree (state.c), which is the domain
// this plan extracts. Maze/floor parity is proven separately by the 01-04 maze
// suite. Volatile wall-clock fields are stripped by diffState before comparison
// (a fresh character carries none, but the helper keeps this consistent with
// the rest of the parity harness).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import { chargenDivergenceFor, stripDeclaredFields, stripReauthoredEveryField, stripCloakArmorTxt, dropEmptyWorn } from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.chargen.json"), "utf8"),
);
const SEEDS = FIXTURE.seeds;

// The gameplay-relevant character fields to compare. This is the full stored
// character shape both sides build from the same object literal; listing it
// explicitly documents the parity surface (and guards against a stray extra
// field on either side going unnoticed). Any field the prototype computes only
// in narration (never stored on S.c) is out of scope — there are none: the
// prototype's `if(log)` branch only reads already-stored fields.
const CHARACTER_FIELDS = [
  "cls", "sub", "race", "intel", "level", "sp", "maxWP", "wp", "skills", "vp",
  "weapon", "prof", "magicWpn", "armor", "ar", "armorMin", "armorWP", "armorMax",
  "patches", "temperament", "motive", "phobia", "phobiaType", "potions", "rations",
  "gold", "scrolls", "affliction", "joiner",
  "items", "grimoire", "spellsUsed", "kills", "might", "ward", "regen", "mirror",
  "foresight",
  // Phase 39 (GEAR-02, greenfield retirement): the four scattered item-
  // duration counters are REMOVED from this field list entirely — the
  // engine no longer BUILDS these fields at all (they retired into
  // c.timers item-effect records). The frozen prototype still initialises
  // all four to 0, so they are stripped off `protoC` before the diff
  // instead (below) — the harness carve-out `stripRetiredCounterFields` in
  // comparables.js does the same job for the movement/combat/magic/economy
  // comparables.
  // audit-batch1 (2026-09-09, A2) + Phase 39 (GEAR-02): the Cloak-of-Flying
  // charge/cooldown pair is ALSO removed entirely (not just stripped
  // below) — the engine no longer builds either field (its effect/cooldown
  // now rides a c.timers record); the frozen prototype never built them in
  // the first place, so there is nothing left to strip.
  // DR-name-generator (2026-09-09): "name" is DELIBERATELY carved out of the
  // parity comparison. nameFor now builds a GENERATIVE first × surname name
  // (content/names.js), which is a cosmetic divergence from the frozen
  // prototype's flat-pool pick — it has NO mechanical effect and, crucially,
  // makes the SAME single rng draw (rng.d(combos) === one gen.next(), same as
  // the old rng.pick), so the draw ORDER is unchanged and EVERY OTHER chargen
  // field stays byte-identical. The engine still BUILDS c.name, so it is
  // appended to the shape assertion below and stripped from BOTH sides before
  // diffState (see the destructure further down).
  // PHOBIA-01 (04.1-05): a brand-new, engine-only persistent darkness
  // counter (see engine/character.js's rollCharacter) with NO prototype-
  // side equivalent — stripped out again below before diffState compares
  // against the frozen prototype's S.c, mirroring how RATION-01 handles
  // engine-only additions elsewhere in this parity suite.
  "darkFor",
  // ECON-01 (Phase 12, Economy A): a brand-new, engine-only class-derived
  // carry-capacity bag key (see engine/character.js's rollCharacter) with NO
  // prototype-side equivalent — set as a PLAIN assignment (no rng draw), so
  // every other chargen field stays byte-identical; stripped again below
  // before diffState, same treatment as darkFor/flight above.
  "bag",
  // Phase 38 (ABIL-01/02/03): a brand-new, engine-only ordered array of
  // catalog ability ids (see engine/character.js's rollCharacter/
  // splitTableAbilities) with NO prototype-side equivalent at all — stripped
  // again below before diffState, same treatment as bag/darkFor/flight above.
  "abilities",
  // Phase 45 (HEDGE-01): a brand-new, engine-only worn-slot map (see
  // engine/derived.js#reconcileWorn), lazily created on EVERY fresh roll —
  // `{}` for a Fighter/Magic User, a Thief's starting cloak worn. An empty
  // map is dropped before diffState (dropEmptyWorn, the engine's spelling
  // of the prototype's "no worn model"); a populated one is declared per
  // seed in `divergences` (seeds 2/3/4) with `items`/`worn` before/after.
  "worn",
];

test("engine chargen matches the frozen prototype for every fixture seed", () => {
  assert.ok(Array.isArray(SEEDS) && SEEDS.length > 0, "fixture must carry a non-empty seeds array");

  for (const seed of SEEDS) {
    // Prototype side: loading the sandbox already runs the prototype's boot
    // (`load() || newGame()`), and with no save present that calls newGame()
    // once, consuming the seeded stream from position 0 — exactly what the
    // engine's newRun(seed) does. So read the rolled S.c directly; calling
    // newGame() again would draw from the advanced stream and diverge.
    const ctx = loadPrototypeSandbox({ seed });
    const protoC = ctx.S.c;

    // Engine side: newRun consumes the identical stream in the identical order.
    const engineC = newRun(seed).c;

    // Compare the full stored character on both sides. "name" is carved out
    // of the parity FIELD LIST (DR-name-generator) but the engine still builds
    // it, so the full engine shape is CHARACTER_FIELDS + "name".
    assert.deepStrictEqual(
      Object.keys(engineC).sort(),
      [...CHARACTER_FIELDS, "name"].sort(),
      `seed ${seed}: engine character shape drifted from the documented field set`,
    );

    // PHOBIA-01 (04.1-05): strip the engine-only darkFor field (always 0 at
    // chargen) before comparing against the prototype, which never carries
    // this field at all — see the CHARACTER_FIELDS comment above.
    // DR-name-generator (2026-09-09): strip the generative "name" from BOTH
    // sides — it is a deliberate cosmetic divergence (the prototype's flat-pool
    // name differs from the engine's first × surname build), with no mechanical
    // effect and no change to the rng draw count/order, so every OTHER field
    // still compares byte-identical.
    const { name: _engineName, darkFor, bag, abilities, ...engineCForDiff0 } = engineC;
    // Phase 39 (GEAR-02): the prototype still carries haste/invis/ether/
    // acute (all 0 at chargen) — strip them off protoC only, since the
    // engine side no longer builds them at all.
    const { name: _protoName, haste, invis, ether, acute, ...protoCForDiff0 } = protoC;
    let engineCForDiff = engineCForDiff0;
    let protoCForDiff = protoCForDiff0;

    // FID-06 (Phase 23): seeds 15 and 24 carry a declared, measured chargen
    // divergence (see test/parity/fixtures/action-script.chargen.json's
    // `divergences` map) — assert the before/after values BEFORE stripping
    // the declared fields from both sides. Every other seed has no record
    // and is compared byte-identically with NO strip.
    // Phase 39 (GEAR-02, once-a-day rule): strip the three re-authored
    // treasure rows' `every` cooldown value off BOTH sides — a chargen roll
    // landing a Cloak of Ether in a Thief's starting bag (seed 3) is the
    // measured, affected seed; see harness/comparables.js's
    // stripReauthoredEveryField for the full rationale.
    protoCForDiff = stripReauthoredEveryField(protoCForDiff);
    engineCForDiff = stripReauthoredEveryField(engineCForDiff);

    // Phase 43 (CLAR-01 HP-not-WP sweep): strip the REWORDED_TXT_ITEMS'
    // reworded `txt` unit word off BOTH sides — a chargen roll landing a
    // Cloak of Regeneration (seeds 2 and 4) is the measured, affected case;
    // see harness/comparables.js's stripCloakArmorTxt for the full rationale.
    protoCForDiff = stripCloakArmorTxt(protoCForDiff);
    engineCForDiff = stripCloakArmorTxt(engineCForDiff);

    // Phase 45 (HEDGE-01/03): drop an empty c.worn map (the engine's
    // spelling of the prototype's "no worn model") — a populated one (a
    // Thief's starting cloak, seeds 2/3/4) reaches the diff below and must
    // be declared on this seed's `divergences` record instead.
    engineCForDiff = dropEmptyWorn(engineCForDiff);

    const record = chargenDivergenceFor(FIXTURE, seed);
    let strippedProto = protoCForDiff;
    let strippedEngine = engineCForDiff;
    if (record) {
      for (const field of record.fields) {
        // NOTE: `protoCForDiff` fields live in the vm sandbox's realm (see
        // sandboxPrototype.js), so a bare assert.deepStrictEqual against a
        // main-realm value (record.before/after, from JSON.parse) fails
        // Node's cross-realm reference-equality check even when the values
        // are structurally identical. diffState (used everywhere else in
        // this harness for exactly this prototype-vs-engine comparison)
        // strips via structuredClone first, sidestepping that; reuse it here.
        assert.equal(
          diffState(protoCForDiff[field], record.before[field]),
          null,
          `seed ${seed}: prototype ${field} does not match the fixture's declared "before" value`,
        );
        assert.equal(
          diffState(engineCForDiff[field], record.after[field]),
          null,
          `seed ${seed}: engine ${field} does not match the fixture's declared "after" value`,
        );
      }
      strippedProto = stripDeclaredFields(protoCForDiff, record.fields);
      strippedEngine = stripDeclaredFields(engineCForDiff, record.fields);
    }

    const divergence = diffState(strippedProto, strippedEngine);
    assert.equal(
      divergence,
      null,
      `seed ${seed} (${protoC.cls}/${protoC.sub}/${protoC.race}): character diverges at ${divergence}`,
    );
  }
});

test("chargen fixture divergence records are narrow and well-formed (FID-06)", () => {
  const divergences = FIXTURE.divergences || {};
  const keys = Object.keys(divergences);
  // Phase 23 (FID-06) originally contributed 2 records (seeds 15, 24), both
  // since UPDATED by Phase 40's spell table reshape + day-one damage
  // guarantee (SPELL-04/SPELL-05), which also adds seeds 7 and 29 — see
  // test/parity/FIXTURE-INVENTORY.md's Phase 40 section. Phase 38 (ABIL-02,
  // the Special Skills table reshape) contributes 7 more (seeds 1, 2, 3, 4,
  // 6, 13, 32) — see that file's Phase 38 section for the full measured
  // before/after table. Phase 45 (HEDGE-03) extends seeds 2/3/4 (already
  // among the 11) with `items`/`worn` — no new record, the key count is
  // unchanged.
  assert.ok(keys.length <= 11, `expected at most 11 divergence records, got ${keys.length}`);
  for (const key of keys) {
    assert.ok(SEEDS.includes(Number(key)), `divergence key ${key} is not in the fixture's seeds array`);
    const record = divergences[key];
    assert.ok(record.phase, `divergence ${key}: missing phase`);
    assert.ok(Array.isArray(record.fields) && record.fields.length > 0, `divergence ${key}: fields must be a non-empty array`);
    assert.ok(record.before && typeof record.before === "object", `divergence ${key}: missing before`);
    assert.ok(record.after && typeof record.after === "object", `divergence ${key}: missing after`);
    assert.ok(typeof record.rationale === "string" && record.rationale.length > 0, `divergence ${key}: missing rationale`);
    for (const field of record.fields) {
      assert.notDeepStrictEqual(
        record.before[field],
        record.after[field],
        `divergence ${key}: field "${field}" has no real before/after difference — this looks like a blanket regeneration, not a declared divergence`,
      );
    }
  }
});

test("the fixture seed set collectively exercises all classes, races and a grimoire", () => {
  const classes = new Set();
  const races = new Set();
  let sawGrimoire = false;
  for (const seed of SEEDS) {
    const c = newRun(seed).c;
    classes.add(c.cls);
    races.add(c.race);
    if (c.cls === "Magic User" && c.grimoire.length >= 4) sawGrimoire = true;
  }
  assert.deepStrictEqual([...classes].sort(), ["Fighter", "Magic User", "Thief"]);
  assert.deepStrictEqual(
    [...races].sort(),
    ["Dwarven", "Elven", "Fridgian", "Human", "Troll", "Wilmsry"],
  );
  assert.ok(sawGrimoire, "seed set must include a Magic User with a grimoire");
});
