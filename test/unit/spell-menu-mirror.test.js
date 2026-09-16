// test/unit/spell-menu-mirror.test.js
//
// Phase 31 (CMB-02, threat T-31-08) — mazeworld.html's classic in-combat
// SPELLS menu filter, `function canCast(sp)`, no longer re-implements the
// grimoire/level/school gate (the Phase 23 IDENT-03/04 regression this
// phase closes: a level-1 Summoner's Summon and a level-1 Illusionist's
// Phantom Host were literally absent from the combat spell list because the
// classic copy checked `sp.lvl` directly and never learned
// content/spell-level-overrides.js). It now delegates to a single bridge,
// `window.__mzCanCast`, wired to engine/derived.js#canCast. This file
// extracts the real shipped classic `canCast(sp)` with fs.readFileSync
// (mirroring test/unit/parley-button-mirror.test.js's own extraction/replay
// pattern — mazeworld.html has no module surface a test could import) and
// walks the SAME (sub, spell, level) diff-walk shape as
// test/unit/spell-level-overrides.test.js's canCast diff walk, proving the
// classic shim and the engine predicate can never disagree for ANY cell —
// not just the two spell-level-overrides.js cells Phase 23 patched.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { canCast as engineCanCast } from "../../engine/derived.js";
import { SPELLS, CLASSES } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// --- extraction ---------------------------------------------------------

const canCastMatches = HTML.match(/\nfunction canCast\(sp\) \{\n[\s\S]*?\n\}\n/g) || [];
assert.equal(canCastMatches.length, 1, "classic function canCast(sp) { ... } must appear exactly once in mazeworld.html");
const canCastSrc = canCastMatches[0];

assert.match(canCastSrc, /__mzCanCast/, "the classic canCast(sp) must delegate through window.__mzCanCast");
assert.doesNotMatch(canCastSrc, /sp\.lvl > S\.c\.level/, "the classic canCast(sp) must not re-check sp.lvl directly");

const buildCanCast = new Function("window", "S", `${canCastSrc}\nreturn canCast;`);

/** classicFor(state) — binds the extracted classic canCast(sp) against a
 * given engine state, wiring window.__mzCanCast to engineCanCast exactly as
 * the real module script does. */
function classicFor(state) {
  const win = { __mzCanCast: (s, sp) => engineCanCast(s, sp) };
  return buildCanCast(win, state);
}

function stateFor(sub, level, grimoire, extra = {}) {
  return { c: { sub, level, grimoire, spellsUsed: 0, ...extra } };
}

const MU_SUBS = CLASSES["Magic User"].subs;

// --- module bridge pin ----------------------------------------------------

test("CMB-02: the module script bridges window.__mzCanCast = canCast", () => {
  assert.match(HTML, /window\.__mzCanCast = canCast;/);
});

// --- named pins (the Phase 23 regression, closed) --------------------------

test("CMB-02: a level-1 Summoner with Summon in the grimoire — classic canCast agrees with the engine (true)", () => {
  const state = stateFor("Summoner", 1, ["Summon"]);
  assert.equal(engineCanCast(state, SPELLS.find((sp) => sp.n === "Summon")), true);
  assert.equal(classicFor(state)(SPELLS.find((sp) => sp.n === "Summon")), true);
});

test("CMB-02: a level-1 Illusionist with Phantom Host in the grimoire — classic canCast agrees with the engine (true)", () => {
  const state = stateFor("Illusionist", 1, ["Phantom Host"]);
  assert.equal(engineCanCast(state, SPELLS.find((sp) => sp.n === "Phantom Host")), true);
  assert.equal(classicFor(state)(SPELLS.find((sp) => sp.n === "Phantom Host")), true);
});

test("CMB-02: a level-1 Wizard with Fireball in the grimoire — classic canCast agrees with the engine (false)", () => {
  const state = stateFor("Wizard", 1, ["Fireball"]);
  assert.equal(engineCanCast(state, SPELLS.find((sp) => sp.n === "Fireball")), false);
  assert.equal(classicFor(state)(SPELLS.find((sp) => sp.n === "Fireball")), false);
});

// --- full cell-by-cell mirror walk -----------------------------------------

test("CMB-02: the classic canCast(sp) and engine/derived.js#canCast never disagree, for every (sub, spell, level 1-5) cell with the spell in the grimoire", () => {
  let cases = 0;
  for (const sub of MU_SUBS) {
    for (let level = 1; level <= 5; level++) {
      for (const sp of SPELLS) {
        cases++;
        const state = stateFor(sub, level, [sp.n]);
        const engineResult = engineCanCast(state, sp);
        const classicResult = classicFor(state)(sp);
        assert.equal(classicResult, engineResult, `sub=${sub} spell=${sp.n} level=${level}`);
      }
    }
  }
  assert.equal(cases, MU_SUBS.length * 5 * SPELLS.length);
});

test("CMB-02: with an empty grimoire, the classic canCast(sp) agrees with the engine (false) for every (sub, spell, level)", () => {
  for (const sub of MU_SUBS) {
    for (let level = 1; level <= 5; level++) {
      for (const sp of SPELLS) {
        const state = stateFor(sub, level, []);
        assert.equal(engineCanCast(state, sp), false);
        assert.equal(classicFor(state)(sp), false, `sub=${sub} spell=${sp.n} level=${level}`);
      }
    }
  }
});
