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
//
// RULES-10 (Phase 75.1): extends the contract once more with
// bottomRangeText — the fumble-band formatter every scroll-fumble line
// prints through.

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
  bottomRangeText,
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

// ─── Phase 74 Plan 02, Task 2: facesRangeText / dieText / hitRangeText ───

test("facesRangeText: converts a winning-faces count to the lo–hi range the way atLeastFor does", () => {
  assert.equal(facesRangeText(5, 20), "16–20");
  assert.equal(facesRangeText(4, 20), "17–20");
  assert.equal(facesRangeText(3, 20), "18–20");
  assert.equal(facesRangeText(2, 20), "19–20");
  assert.equal(facesRangeText(5, 6), "2–6");
  assert.equal(facesRangeText(5, 12), "8–12");
});

test("facesRangeText: a single winning face reads as just the face", () => {
  assert.equal(facesRangeText(1, 20), "20");
});

test("facesRangeText: 0 or fewer winning faces reads 'nothing'", () => {
  assert.equal(facesRangeText(0, 20), "nothing");
  assert.equal(facesRangeText(-1, 20), "nothing");
});

test("facesRangeText: a faces count at or above dieN reads the full die as 1–N", () => {
  assert.equal(facesRangeText(20, 20), "1–20");
  assert.equal(facesRangeText(25, 20), "1–20");
});

test("facesRangeText: a non-finite faces or dieN reads '?'", () => {
  assert.equal(facesRangeText(NaN, 20), "?");
  assert.equal(facesRangeText(5, undefined), "?");
});

test("dieText: names the die, or 'd?' for a non-finite count", () => {
  assert.equal(dieText(20), "d20");
  assert.equal(dieText(undefined), "d?");
});

test("hitRangeText: the range plus the die, with a mods clause only when mods is non-empty", () => {
  assert.equal(hitRangeText(5, 20), "16–20 (d20)");
  assert.equal(
    hitRangeText(4, 20, { mods: [{ name: "Sidestep", delta: -2 }, { name: "insulted", delta: 1 }], roller: "foe" }),
    "17–20 (d20; Sidestep +2, insulted −1)"
  );
  assert.equal(hitRangeText(3, 20, { mods: [], roller: "foe" }), "18–20 (d20)");
  assert.equal(hitRangeText(1, 8), "8 (d8)");
});

test("facesRangeText/hitRangeText output never contains an ASCII hyphen-minus, a '%' sign, or a digit immediately followed by '+'", () => {
  const samples = [
    facesRangeText(5, 20),
    facesRangeText(4, 20),
    facesRangeText(1, 20),
    facesRangeText(0, 20),
    hitRangeText(5, 20),
    hitRangeText(4, 20, { mods: [{ name: "Sidestep", delta: -2 }, { name: "insulted", delta: 1 }], roller: "foe" }),
    hitRangeText(3, 20, { mods: [], roller: "foe" }),
    hitRangeText(1, 8),
  ];
  for (const s of samples) {
    assert.ok(!s.includes("-"), `expected no ASCII hyphen-minus in "${s}"`);
    assert.ok(!s.includes("%"), `expected no percent sign in "${s}"`);
    assert.doesNotMatch(s, /\d\+/, `expected no digit immediately followed by '+' in "${s}"`);
  }
});

// --- bottomRangeText (RULES-10, Phase 75.1) --------------------------------

test("bottomRangeText: the faces strictly below a cutoff, U+2013 dash", () => {
  assert.equal(bottomRangeText(4), "1–3");
  assert.equal(bottomRangeText(11), "1–10");
});

test("bottomRangeText: a cutoff of 2 reads the single face '1'", () => {
  assert.equal(bottomRangeText(2), "1");
});

test("bottomRangeText: a cutoff at or below 1 reads 'nothing' (no face is below the worst)", () => {
  assert.equal(bottomRangeText(1), "nothing");
  assert.equal(bottomRangeText(0), "nothing");
  assert.equal(bottomRangeText(-3), "nothing");
});

test("bottomRangeText: a missing or non-numeric input reads '?'", () => {
  assert.equal(bottomRangeText(undefined), "?");
  assert.equal(bottomRangeText(NaN), "?");
});

test("bottomRangeText output never contains an ASCII hyphen-minus", () => {
  for (const s of [bottomRangeText(4), bottomRangeText(11), bottomRangeText(2), bottomRangeText(1), bottomRangeText(undefined)]) {
    assert.ok(!s.includes("-"), `expected no ASCII hyphen-minus in "${s}"`);
  }
});
