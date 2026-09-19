// test/unit/shell-narration-wiring.test.js
//
// Phase 25 (FEED-01..06), Plan 04 — mazeworld.html has no module surface a
// test could import (it is not an ESM module the test runner can load), so
// — mirroring test/unit/foe-effect-chip.test.js / parley-button-mirror.test.js's
// own source-assertion pattern — this file reads the real shipped source
// with fs.readFileSync and asserts against it directly: the single
// dispatchWithNarration(action) routing seam every dispatch call site funnels
// through, and the old per-action switch (plus its spell-name helper) stays
// gone. A behavioural check proves the deleted DR18 hand-written
// equip-rejection toast is replaced, not lost, by importing the real
// linesForAction and running a real equipRejected event through it.
//
// Phase 32 (CMBUI-02): dispatchWithNarration routed in-combat non-refusal
// lines to a Round Card, later (Phase 34, CSCR-04) to the whole-fight
// window.__mzFightLog.
//
// Phase 35 (MAP-03/04): the toast host itself — `window.mzToast`, the
// `.mw-toast-host`/`.mw-toast` CSS, the lifetime bridge, the cap constant's
// one consumer, `CARD_EVENTS`/`FEATURE_EVENT_TITLE`/the lifetime function —
// is retired outright. Out-of-combat lines now fold through src/browser/
// rail.js into the persistent bottom RAIL instead of a toast queue; the
// tests that pinned the toast host's CSS/lifetime/cap contract are gone
// with it (test/unit/shell-map-rail.test.js owns the rail's own pins). The
// tests kept here are the ones that still describe LIVE surface: the single
// dispatch(...)->dispatchWithNarration(...) seam, the retired legacy switch,
// the DR18 toast's real linesForAction replacement, and narrationLines.js's own
// pure `limit` option.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { linesForAction } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping ──────────────────────────────────────────────────
//
// mazeworld.html's doc comments occasionally mention glob-style paths
// (`icons/optimized/*.png`) and scoped-package wildcards (`@capacitor/*`)
// INSIDE ordinary `//` line comments. A naive stripper that removes `/* */`
// block comments BEFORE removing `//` line comments treats that literal
// `/*` substring as an (unterminated) block-comment opener and swallows
// everything up to the next unrelated `*/` — silently deleting real code
// from the scanned text. Stripping `//` line comments FIRST removes those
// substrings before the block-comment pass ever sees them, so this order
// is deliberate, not incidental (see 25-04-SUMMARY.md for how this was
// found). Confirmed safe for this file: no line pairs a `/*` opener with a
// `//` occurring before its own same-line `*/` closer (which would be the
// one case this ordering could still lose a real closing token).
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const CODE = stripComments(HTML);

// ─── dead-name detection without spelling the dead names ───────────────
//
// The prohibition this test enforces (the old switch + its spell-name
// helper must have zero occurrences) should not itself be tripped by any
// future "no dead API names anywhere in the repo" tooling that greps for
// the literal identifier — so both names are assembled from fragments.
const OLD_SWITCH_NAME = ["mz", "Combat", "Feedback"].join("");
const OLD_SPELL_NAME_HELPER = ["mz", "Spell", "Name"].join("");

// ─── single dispatch seam ────────────────────────────────────────────────

test("the module script imports linesForAction from src/browser/narrationLines.js", () => {
  assert.match(CODE, /import \{ linesForAction \} from "\.\/src\/browser\/narrationLines\.js";/);
});

test("dispatchWithNarration(action) is defined exactly once and calls linesForAction(action.type, ...)", () => {
  const defs = CODE.match(/function dispatchWithNarration\(action\)/g) || [];
  assert.equal(defs.length, 1, "dispatchWithNarration must be defined exactly once");
  assert.match(CODE, /linesForAction\(action\.type/);
});

test("every dispatch() call site is routed through dispatchWithNarration — exactly one bare dispatch( survives (inside the helper itself)", () => {
  const bare = CODE.match(/(?<![A-Za-z_$.])dispatch\(/g) || [];
  assert.equal(bare.length, 1, `expected exactly one bare dispatch( call, found ${bare.length}`);
  const routed = CODE.match(/dispatchWithNarration\(/g) || [];
  assert.ok(routed.length >= 9, `expected >= 9 dispatchWithNarration( occurrences (definition + 8 call sites), found ${routed.length}`);
});

test("the old per-action switch and its spell-name helper are gone", () => {
  assert.equal((CODE.match(new RegExp(OLD_SWITCH_NAME, "g")) || []).length, 0);
  assert.equal((CODE.match(new RegExp(OLD_SPELL_NAME_HELPER, "g")) || []).length, 0);
  // mzSpellCharges (a DIFFERENT, still-live helper used by the grimoire
  // renderer) must survive — proves the deletion above was surgical, not a
  // blanket removal of every "mzSpell*" identifier.
  assert.match(CODE, /window\.mzSpellCharges/);
});

test("the DR18 hand-written equip-rejection toast is deleted", () => {
  assert.equal((HTML.match(/You cannot use that\./g) || []).length, 0);
  // 260918-wy1 (jewelry-merge): mzEquipItem gained an optional targeted
  // swap key.
  assert.match(CODE, /window\.mzEquipItem = \(i, slot\) => inventoryAction\(slot === undefined \? \{ type: "equipItem", i \} : \{ type: "equipItem", i, slot \}\);/);
});

test("Phase 34: no shell-side in-combat toast survives — the full-health and no-potion refusals are dull fight-log entries", () => {
  const blockGuards = HTML.match(/Already at full health\.", "block"\)/g) || [];
  assert.equal(blockGuards.length, 0, "the old block-toast literal must be fully gone");
  assert.equal((CODE.match(/fightLogRefuse\(COMBAT_COPY\.fullHealth\)/g) || []).length, 1);
  assert.equal((CODE.match(/fightLogRefuse\(COMBAT_COPY\.noPotions\)/g) || []).length, 1);
});

// ─── behavioural: the deleted hand-written toast is replaced, not lost ──

test("an equipRejected(reason: woodsman) event yields one block toast via linesForAction (proves the deleted DR18 toast has a real replacement)", () => {
  const toasts = linesForAction("equipItem", [{ type: "equipRejected", reason: "woodsman" }], {});
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].tone, "block");
  assert.match(toasts[0].text, /Woodsman/i);
});

// ─── Phase 35 (MAP-03/04): toast-host retirement re-pin ──────────────────

test("Phase 35: the module imports NARRATIVE_ACTIONS on its own line and never imports CARD_EVENTS or a lifetime helper", () => {
  assert.match(CODE, /import \{ NARRATIVE_ACTIONS \} from "\.\/src\/browser\/narrationLines\.js";/);
  const importLines = CODE.match(/import \{[^}]*\} from "\.\/src\/browser\/narrationLines\.js";/g) || [];
  assert.equal(importLines.length, 3, "exactly three import lines pull from narrationLines.js");
  assert.ok(importLines.every((line) => !line.includes("CARD_EVENTS")), "no import line pulls CARD_EVENTS");
});

test("Phase 35: dispatchWithNarration passes ctx.narrate only for NARRATIVE_ACTIONS", () => {
  assert.match(CODE, /NARRATIVE_ACTIONS\.has\(action\.type\) \? \{ narrate: narrateEvent \} : \{\}/);
});

test("Phase 35: the CARD_EVENTS beat-synthesis gate is gone from engineMove and mzMakeCamp (count 0)", () => {
  const gates = CODE.match(/events\.some\(\(e\) => CARD_EVENTS\.has\(e\.type\)\)/g) || [];
  assert.equal(gates.length, 0, `expected zero CARD_EVENTS gates, found ${gates.length}`);
});

test("Phase 35: preDeath survives — the ambush gate collapsed in Phase 31 stays collapsed", () => {
  const preDeathHits = CODE.match(/preDeath: true/g) || [];
  assert.equal(preDeathHits.length, 1, "preDeath: true must appear exactly once");
  assert.doesNotMatch(CODE, /awaitingFight/);
});

// ─── narrationLines.js's own pure option (kept — never retired) ──────────────────

test("Phase 32: narrationLines.js carries the limit option once, and the default is uncapped (no constant-backed cap)", () => {
  const linesSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "narrationLines.js"), "utf8");
  const sigHits = linesSrc.match(/export function linesForAction\(type, events, ctx = \{\}, opts = \{\}\)/g) || [];
  assert.equal(sigHits.length, 1, "linesForAction must accept an opts argument exactly once");
  const limitHits = linesSrc.match(/deduped\.slice\(0, limit\)/g) || [];
  assert.equal(limitHits.length, 1, "the pipeline tail must slice by the new limit exactly once");
  const defaultHits = linesSrc.match(/limit = Infinity/g) || [];
  assert.equal(defaultHits.length, 1, "the default limit must be Infinity exactly once");
  assert.doesNotMatch(linesSrc, /limit = [A-Z_]{2,}/, "the default must not be backed by a named constant");
});
