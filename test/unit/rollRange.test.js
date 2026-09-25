// test/unit/rollRange.test.js
//
// Phase 73 Plan 03 (ROLL-05): the contract for src/browser/rollRange.js's
// rangeText/rollVsText — the ONE place a winning range is written on every
// event-driven roll line from Phase 73-04 on. Every example here is
// transcribed from 73-03-PLAN.md's <behavior> list.
//
// Phase 74 Plan 02 (ROLL-02/03): extends the contract with the ONE
// player-side signed-modifier formatter (signedText/ROLLERS/playerDelta/
// MOD_LABEL/modLabel/modText/modsText/modsClause/ROLL_COPY/toHitText) and
// the faces-to-range/die-name/full-hit-range helpers (facesRangeText/
// dieText/hitRangeText). Every example here is transcribed from
// 74-02-PLAN.md's <behavior> lists.

import test from "node:test";
import assert from "node:assert/strict";
import {
  rangeText,
  rollVsText,
  signedText,
  ROLLERS,
  playerDelta,
  MOD_LABEL,
  modLabel,
  modText,
  modsText,
  modsClause,
  ROLL_COPY,
  toHitText,
  facesRangeText,
  dieText,
  hitRangeText,
} from "../../src/browser/rollRange.js";

test("rangeText: a wide winning range reads lo–hi with the U+2013 en dash", () => {
  assert.equal(rangeText(16, 20), "16–20");
  assert.equal(rangeText(18, 20), "18–20");
  assert.equal(rangeText(2, 6), "2–6");
  assert.equal(rangeText(1, 2), "1–2");
});

test("rangeText: a single winning face reads as just the face", () => {
  assert.equal(rangeText(20, 20), "20");
  assert.equal(rangeText(2, 2), "2");
});

test("rangeText: no winning face reads 'nothing'", () => {
  assert.equal(rangeText(21, 20), "nothing");
});

test("rangeText: atLeast at or below 1 reads the full die as 1–N", () => {
  assert.equal(rangeText(1, 20), "1–20");
  assert.equal(rangeText(-3, 20), "1–20");
});

test("rangeText: a missing or non-numeric field reads '?'", () => {
  assert.equal(rangeText(undefined, 20), "?");
  assert.equal(rangeText(16, undefined), "?");
  assert.equal(rangeText(NaN, 20), "?");
});

test("rangeText: no hyphen-minus ever appears in the output", () => {
  const samples = [
    rangeText(16, 20),
    rangeText(18, 20),
    rangeText(20, 20),
    rangeText(21, 20),
    rangeText(1, 20),
    rangeText(-3, 20),
    rangeText(2, 6),
    rangeText(2, 2),
    rangeText(1, 2),
  ];
  for (const s of samples) {
    assert.ok(!s.includes("-"), `expected no hyphen-minus in "${s}"`);
  }
});

test("rollVsText: joins the roll and the winning range with 'vs'", () => {
  assert.equal(rollVsText(17, 18, 20), "17 vs 18–20");
});

test("rollVsText: a missing roll reads '?'", () => {
  assert.equal(rollVsText(undefined, 16, 20), "? vs 16–20");
});

// ─── Phase 74 Plan 02, Task 1: signedText / ROLLERS / playerDelta / MOD_LABEL / modLabel / modText / modsText / modsClause / ROLL_COPY / toHitText ───

test("signedText: a positive number reads '+n'", () => {
  assert.equal(signedText(2), "+2");
});

test("signedText: a negative number reads U+2212 minus, not the ASCII hyphen", () => {
  const s = signedText(-2);
  assert.equal(s, "−2");
  assert.equal(s.codePointAt(0), 0x2212);
});

test("signedText: zero and negative zero both read '0'", () => {
  assert.equal(signedText(0), "0");
  assert.equal(signedText(-0), "0");
});

test("signedText: a non-finite value reads '?'", () => {
  assert.equal(signedText(NaN), "?");
  assert.equal(signedText(undefined), "?");
});

test("ROLLERS: frozen {you, ally, foe}", () => {
  assert.deepEqual(ROLLERS, { you: "you", ally: "ally", foe: "foe" });
  assert.ok(Object.isFrozen(ROLLERS));
});

test("playerDelta: 'foe' negates the delta", () => {
  assert.equal(playerDelta(-2, "foe"), 2);
  assert.equal(playerDelta(1, "foe"), -1);
});

test("playerDelta: a zero delta on 'foe' never reads -0", () => {
  const v = playerDelta(0, "foe");
  assert.equal(v, 0);
  assert.ok(!Object.is(v, -0));
});

test("playerDelta: 'you', 'ally', or a missing roller pass the delta through unchanged", () => {
  assert.equal(playerDelta(-2, "you"), -2);
  assert.equal(playerDelta(-2, "ally"), -2);
  assert.equal(playerDelta(-2), -2);
});

test("modLabel: the two engine names a player cannot read get relabelled", () => {
  assert.equal(modLabel("penalty"), "Weaken");
  assert.equal(modLabel("overhead"), "Overhead Blow");
});

test("modLabel: any other name passes through as-is", () => {
  assert.equal(modLabel("Sidestep"), "Sidestep");
});

test("modLabel: own-property lookup only, not the inherited prototype chain", () => {
  assert.equal(modLabel("constructor"), "constructor");
});

test("modLabel: a missing name reads '?'", () => {
  assert.equal(modLabel(undefined), "?");
});

test("modsText: player-signed per roller, relabelled", () => {
  const mods = [
    { name: "Sidestep", delta: -2 },
    { name: "insulted", delta: 1 },
  ];
  assert.equal(modsText(mods, "foe"), "Sidestep +2, insulted −1");
  assert.equal(modsText(mods, "you"), "Sidestep −2, insulted +1");
  assert.equal(modsText([{ name: "penalty", delta: -2 }], "foe"), "Weaken +2");
  assert.equal(modsText([{ name: "Guard", delta: -1 }], "foe"), "Guard +1");
  assert.equal(modsText([{ name: "afraid", delta: -3 }], "you"), "afraid −3");
});

test("modsClause: wraps modsText in a leading-space parenthetical, or '' when empty/absent", () => {
  const mods = [
    { name: "Sidestep", delta: -2 },
    { name: "insulted", delta: 1 },
  ];
  assert.equal(modsClause(mods, "foe"), " (Sidestep +2, insulted −1)");
  assert.equal(modsClause([], "foe"), "");
  assert.equal(modsClause(undefined, "you"), "");
  assert.equal(modsText(null, "foe"), "");
});

test("toHitText: fills ROLL_COPY.toHit with the already player-signed delta", () => {
  assert.equal(toHitText(-2), "−2 to hit");
  assert.equal(toHitText(1), "+1 to hit");
});

test("Rendering a deep-frozen mods list twice is idempotent and never mutates the input", () => {
  const mods = Object.freeze([
    Object.freeze({ name: "Sidestep", delta: -2 }),
    Object.freeze({ name: "insulted", delta: 1 }),
  ]);
  const first = modsText(mods, "foe");
  const second = modsText(mods, "foe");
  assert.equal(first, second);
  assert.equal(mods[0].delta, -2);
  assert.equal(mods[1].delta, 1);
});

// ─── Module purity: no imports, no rng, frozen copy banks ────────────────────

test("rollRange.js source has no import statement and no Math.random/Date.now", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "rollRange.js"), "utf8");
  // Strip line + block comments first — this file's OWN doc comments describe
  // the purity contract in prose (mentioning "import"/"Math.random"/"Date.now"
  // as words), which must not trip the scan of the real executable source.
  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const src = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /^\s*import\s/m, "rollRange.js must have zero import statements");
  assert.doesNotMatch(src, /Math\.random/);
  assert.doesNotMatch(src, /Date\.now/);
});

test("ROLLERS, MOD_LABEL and ROLL_COPY are frozen", () => {
  assert.ok(Object.isFrozen(ROLLERS));
  assert.ok(Object.isFrozen(MOD_LABEL));
  assert.ok(Object.isFrozen(ROLL_COPY));
});
