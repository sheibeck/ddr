// test/unit/roll-display-lines.test.js
//
// Phase 74 (ROLL-02/03, "Roll Display & Modifier Honesty"), plan 74-03 —
// the per-line sign contract for every roll-carrying Oracle, fight-log,
// dice-reveal and rail line: a "+" always reads as good news for the
// player, a "−" always reads as bad news, on every surface, regardless of
// who rolled. Task 1 covers the Oracle builders in
// src/browser/eventNarration.js (EVENT_NARRATION) and the fight-log's
// dice-reveal reuse (oracleDetailText(narrateEvent(e))). Task 2 (74-03)
// extends this file with the rail-line (LINE_FOR) cases from
// src/browser/narrationLines.js.

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION, narrateEvent } from "../../src/browser/eventNarration.js";
import { narrativeLineText, oracleDetailText, LINE_FOR } from "../../src/browser/narrationLines.js";

/** Recursively freeze a plain object tree (proves narrateEvent never mutates). */
function deepFreeze(o) {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

// ─── Foe-rolled lines: mods negate (a foe's bonus reads as a minus to you) ──

test("EVENT_NARRATION.foeMissed: Sidestep −2/insulted +1 (foe-signed) reads Sidestep +2, insulted −1 (player-signed)", () => {
  const line = EVENT_NARRATION.foeMissed({
    type: "foeMissed",
    name: "Zit",
    roll: 12,
    atLeast: 19,
    dieN: 20,
    mods: [
      { name: "Sidestep", delta: -2 },
      { name: "insulted", delta: 1 },
    ],
  });
  assert.match(line, /<span class="roll">12<\/span> vs 19–20 \(Sidestep \+2, insulted −1\), and misses\.$/);
});

test("EVENT_NARRATION.struckByFoe: Guard −1 reads (Guard +1); the Weaken cap's 'penalty' name relabels", () => {
  const guard = EVENT_NARRATION.struckByFoe({
    type: "struckByFoe",
    name: "Dante",
    roll: 18,
    atLeast: 17,
    dieN: 20,
    dmg: 4,
    mods: [{ name: "Guard", delta: -1 }],
  });
  assert.match(guard, /\(Guard \+1\)/);

  const weaken = EVENT_NARRATION.struckByFoe({
    type: "struckByFoe",
    name: "Dante",
    roll: 18,
    atLeast: 17,
    dieN: 20,
    dmg: 4,
    mods: [{ name: "penalty", delta: -2 }],
  });
  assert.match(weaken, /\(Weaken \+2\)/);
});

test("EVENT_NARRATION.memberStruck: Smoke −4/insulted +1 (foe-signed) reads Smoke +4, insulted −1 (player-signed)", () => {
  const line = EVENT_NARRATION.memberStruck({
    type: "memberStruck",
    name: "Zit",
    member: "Grunk",
    roll: 15,
    atLeast: 16,
    dieN: 20,
    dmg: 3,
    mods: [
      { name: "Smoke", delta: -4 },
      { name: "insulted", delta: 1 },
    ],
  });
  assert.match(line, /\(Smoke \+4, insulted −1\)/);
});

// ─── Hero/ally-rolled lines: mods pass through unchanged ───────────────────

test("EVENT_NARRATION.strikeMissed: afraid −3 (hero-signed) stays afraid −3 (player-signed, no flip)", () => {
  const line = EVENT_NARRATION.strikeMissed({
    type: "strikeMissed",
    target: "Dante",
    roll: 7,
    atLeast: 16,
    dieN: 20,
    mods: [{ name: "afraid", delta: -3 }],
  });
  assert.match(line, /\(afraid −3\)/);
});

test("EVENT_NARRATION.struck: overhead −2 relabels to 'Overhead Blow −2', hero-signed unchanged", () => {
  const line = EVENT_NARRATION.struck({
    type: "struck",
    target: "Dante",
    roll: 18,
    atLeast: 17,
    dieN: 20,
    dmg: 5,
    mods: [{ name: "overhead", delta: -2 }],
  });
  assert.match(line, /\(Overhead Blow −2\)/);
});

test("EVENT_NARRATION.spellThrown: school +3 (hero-signed) stays school +3", () => {
  const line = EVENT_NARRATION.spellThrown({
    type: "spellThrown",
    spell: "Fireball",
    target: "Dante",
    roll: 15,
    atLeast: 13,
    dieN: 20,
    mods: [{ name: "school", delta: 3 }],
  });
  assert.match(line, /\(school \+3\)/);
});

test("EVENT_NARRATION.allyMissed: overhead −2 relabels to 'Overhead Blow −2' on an ally-rolled line", () => {
  const line = EVENT_NARRATION.allyMissed({
    type: "allyMissed",
    name: "Grunk",
    target: "Dante",
    roll: 4,
    atLeast: 16,
    dieN: 20,
    mods: [{ name: "overhead", delta: -2 }],
  });
  assert.match(line, /\(Overhead Blow −2\)/);
});

test("EVENT_NARRATION.fleeRolled: Thief +5, Mail −1 (hero-signed) reads unchanged", () => {
  const line = EVENT_NARRATION.fleeRolled({
    type: "fleeRolled",
    roll: 8,
    atLeast: 10,
    dieN: 20,
    mods: [
      { name: "Thief", delta: 5 },
      { name: "Mail", delta: -1 },
    ],
  });
  assert.match(line, /\(Thief \+5, Mail −1\)/);
});

// ─── parleyRolled's fluency clause ──────────────────────────────────────────

test("EVENT_NARRATION.parleyRolled: fluency 1 reads '(+2 for the tongue)'", () => {
  const line = EVENT_NARRATION.parleyRolled({ type: "parleyRolled", roll: 15, atLeast: 8, dieN: 20, fluency: 1 });
  assert.match(line, /\(\+2 for the tongue\)/);
});

// ─── heightsFear / waterFear: the player-signed check cost ─────────────────

test("EVENT_NARRATION.heightsFear: penalty 2 reads '−2 on the climb.' after narrativeLineText", () => {
  const text = narrativeLineText(narrateEvent({ type: "heightsFear", penalty: 2 }));
  assert.equal(text, "Heights: your stomach reaches the ground well before your feet do. −2 on the climb.");
});

test("EVENT_NARRATION.waterFear: penalty 1 ends '−1 on the leap.'", () => {
  const text = narrativeLineText(narrateEvent({ type: "waterFear", penalty: 1 }));
  assert.match(text, /−1 on the leap\.$/);
});

// ─── The fight log's dice-reveal reuses the Oracle sentence ────────────────

test("oracleDetailText(narrateEvent(foeMissed)) carries the same player-signed tokens as the Oracle line", () => {
  const e = {
    type: "foeMissed",
    name: "Zit",
    roll: 12,
    atLeast: 19,
    dieN: 20,
    mods: [
      { name: "Sidestep", delta: -2 },
      { name: "insulted", delta: 1 },
    ],
  };
  const detail = oracleDetailText(narrateEvent(e));
  assert.match(detail, /Sidestep \+2, insulted −1/);
});

// ─── Idempotency: narrating a frozen event twice never mutates it ──────────

test("narrateEvent: a deep-frozen foeMissed event narrates identically twice and never throws", () => {
  const e = deepFreeze({
    type: "foeMissed",
    name: "Zit",
    roll: 12,
    atLeast: 19,
    dieN: 20,
    mods: [
      { name: "Sidestep", delta: -2 },
      { name: "insulted", delta: 1 },
    ],
  });
  const first = narrateEvent(e);
  const second = narrateEvent(e);
  assert.equal(first, second);
  assert.match(first, /Sidestep \+2, insulted −1/);
});

// ═════════════════════════════════════════════════════════════════════════
// Task 2 (74-03): the rail lines (LINE_FOR), the would-have-hit names, and
// the fleeRolled line's shared modsText call — src/browser/narrationLines.js
// ═════════════════════════════════════════════════════════════════════════

test("LINE_FOR.heightsFear: penalty 2 reads 'Heights: −2 on the climb.'", () => {
  assert.equal(LINE_FOR.heightsFear({ type: "heightsFear", penalty: 2 }).text, "Heights: −2 on the climb.");
});

test("LINE_FOR.waterFear: penalty 1 reads 'Bodies of water: −1 on the leap.'", () => {
  assert.equal(LINE_FOR.waterFear({ type: "waterFear", penalty: 1 }).text, "Bodies of water: −1 on the leap.");
});

test("LINE_FOR.foeMissed: a would-have-hit Weaken cap ('penalty') names 'Weaken', not the raw engine name", () => {
  const text = LINE_FOR.foeMissed({
    type: "foeMissed",
    name: "Zit",
    roll: 16,
    atLeast: 17,
    mods: [{ name: "penalty", delta: -2 }],
  }).text;
  assert.match(text, /Weaken/);
  assert.doesNotMatch(text, /penalty/);
});

test("LINE_FOR.fleeRolled: Thief +5, Mail −1 still reads unchanged through the shared formatter", () => {
  const text = LINE_FOR.fleeRolled({
    type: "fleeRolled",
    roll: 8,
    atLeast: 10,
    dieN: 20,
    mods: [
      { name: "Thief", delta: 5 },
      { name: "Mail", delta: -1 },
    ],
  }).text;
  assert.equal(text, "Flee: 8 vs 10–20 (Thief +5, Mail −1)");
});
