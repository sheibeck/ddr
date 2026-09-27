// test/unit/shell-gear-39.test.js
//
// Phase 39 (GEAR-02/GEAR-05), Plan 05 — mazeworld.html has no ESM surface a
// test can import directly, so — mirroring test/unit/shell-abilities.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   1. the two surviving read-only bridges (__mzHasTool/__mzToolIndex) +
//      their imports; the three Phase 39 bridges Phase 47 retired
//      (__mzToHit/__mzStrikeDie/__mzItemRowState) are pinned absent;
//   2. window.mzUseTool + the stepNow -> stepWith(action) refactor;
//   3. the wall/crevice decision card (the S.pendingHazard branch, built by
//      src/browser/hazardCard.js since Phase 78) in renderRail, the retired
//      post-fall retry card, and the dark card's torch offer;
//   4. the Gear-tab row builders in gearTab.js call itemRowState(state, it)
//      directly and no longer carry the retired it.every cooldown expression;
//   5. the chip copy tables (CONDITION_TONE/CONDITION_EXPLAIN) + the new
//      explainCondition(cn, label) helper;
//   6. the Hero tab's engine-routed to-hit/strike-die;
//   7. voice safety of the new copy;
//   8. the build artefact (www/index.html) carries the new surface.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, then block comments — same
// order-sensitive approach as every sibling shell-*.test.js file) ──────────
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
// Phase 47 (SHELL-01), Plan 03, Task 2: wornSlotRow/renderCarriedList moved
// into src/browser/gearTab.js.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-02), Plan 04, Task 2: the Hero tab's engine-routed
// to-hit/strike-die readouts moved into src/browser/heroTab.js.
const HERO_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n"));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── 1. Bridges ──────────────────────────────────────────────────────────

test("Bridges: hasTool/toolIndex imported and bridged read-only; toHit/strikeDie/itemRowState are retired classic bridges", () => {
  // Phase 41 (TERR-03), Plan 04: the shared derived.js import line gained
  // mapViewRadius/inViewWindow as sibling named imports. Phase 47 (SHELL-01),
  // Plan 03, Task 2: slotFor/WORN_SLOTS/WORN_KEYS_OF dropped from this line —
  // their only reader (gearTab.js) imports them from engine/derived.js
  // directly. Phase 47 (SHELL-02), Plan 04, Task 2: eff/toHit/strikeDie
  // dropped too — heroTab.js imports them from engine/derived.js directly.
  assert.match(CODE, /import \{ conditionsOf, hasTool, mapViewRadius, inViewWindow \} from "\.\/engine\/derived\.js";/);
  assert.match(CODE, /import \{ toolIndex \} from "\.\/engine\/items\.js";/);
  // Phase 47 (SHELL-01), Plan 03, Task 1: bagUsage/itemRowState moved to
  // gearTab.js — the shared viewModels.js import line no longer carries them.
  // Phase 47 (SHELL-02), Plan 04, Task 1: characterSheetViewModel/
  // grimoireViewModel moved to heroTab.js.
  assert.match(
    CODE,
    /import \{ armorDisplay, bagArmorText, lootCompare \} from "\.\/src\/browser\/viewModels\.js";/,
  );
  assert.match(CODE, /import \{ bagUsage, renderGearTab, renderCarriedList \} from "\.\/src\/browser\/gearTab\.js";/);
  assert.equal((CODE.match(/window\.__mzHasTool = hasTool;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzToolIndex = toolIndex;/g) || []).length, 1);
  // __mzItemRowState is pinned absent; gearTab.js/combatMenu.js import
  // itemRowState directly.
  assert.equal((CODE.match(/window\.__mzItemRowState = itemRowState;/g) || []).length, 0);
  assert.equal((GEAR_SRC.match(/^export function itemRowState\(/m) || []).length, 1);
  // __mzToHit/__mzStrikeDie are pinned absent; heroTab.js's own
  // strikeDie(c)/toHit(state) reads replace them.
  assert.equal((CODE.match(/window\.__mzToHit = toHit;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzStrikeDie = strikeDie;/g) || []).length, 0);
});

// ─── 2. window.mzUseTool + stepWith(action) refactor ──────────────────────

// Phase 78 (CLIMB-01) re-pin: railLocked() now covers the pending hazard
// itself, so the card's own tool button answers its record directly (a
// pending hazard for this exact tool and dir, nothing covering the map)
// instead of sitting behind the lock it would always trip.
test("window.mzUseTool dispatches useTool via stepWith, only for its own live pending record", () => {
  assert.equal((CODE.match(/window\.mzUseTool = \(tool, dir\) => \{/g) || []).length, 1);
  const region = sliceBetween(CODE, "window.mzUseTool = (tool, dir) => {", "window.__mzDescend = ");
  assert.match(region, /const pend = s && s\.pendingHazard;/);
  assert.match(region, /if \(!pend \|\| pend\.tool !== tool \|\| pend\.dir !== dir \|\| hasActiveEncounter\(\)\) return;/);
  assert.match(region, /stepWith\(\{ type: "useTool", tool, dir \}\);/);
});

test("stepNow(dir) is a thin wrapper over stepWith({ type: 'move', dir }); stepWith is the one dispatch body", () => {
  assert.equal((CODE.match(/function stepWith\(action\) \{/g) || []).length, 1);
  assert.equal((CODE.match(/function stepNow\(dir\) \{/g) || []).length, 1);
  const stepNowRegion = sliceBetween(CODE, "function stepNow(dir) {", "\n  }");
  assert.match(stepNowRegion, /stepWith\(\{ type: "move", dir \}\);/);
  const stepWithRegion = sliceBetween(CODE, "function stepWith(action) {", "function stepNow(dir) {");
  assert.match(stepWithRegion, /dispatchWithNarration\(action\)/);
  assert.match(stepWithRegion, /window\.__mzHasTool\(state\.c, "torch"\)/);
});

// ─── 3. Rail cards: hazard pre-roll, retry tool offer, dark ───────────────

// Phase 78 (CLIMB-01/02) re-pin: the Phase 39 tool-only pre-roll card
// (USE LADDER / USE ROPE plus a roll button that sent a plain move) is now
// the one decision card for every wall and crevice, built by
// src/browser/hazardCard.js; its labels and tool offer are that module's
// (pinned in test/unit/hazard-card.test.js), read here through the bridge.
test("renderRail: the wall/crevice decision card wins over joiner/find, reads vm.hazardCard(S), and its buttons dispatch mzResolveHazard/mzUseTool", () => {
  assert.match(CODE, /const hz = S\.pendingHazard && vm\.hazardCard \? vm\.hazardCard\(S\) : null;/);
  const region = sliceBetween(CODE, "if (hz) {", "} else if (S.pendingJoiner");
  assert.match(region, /title = hz\.title/);
  assert.match(region, /hz\.buttons\.map/);
  assert.match(region, /window\.mzUseTool\(b\.tool, hz\.dir\)/);
  assert.match(region, /window\.mzResolveHazard\(true\)/);
  assert.match(region, /window\.mzResolveHazard\(false\)/);
  assert.doesNotMatch(region, /window\.move\(/);
  assert.match(CODE, /hazardCard: hazardCardViewModel/);
  assert.match(CODE, /import \{ hazardCardViewModel \} from "\.\/src\/browser\/hazardCard\.js";/);
});

// Phase 78 (CLIMB-02) re-pin: the post-fall retry card (and its tool
// offer) is retired — one and done means a failed roll already crossed.
test("renderRail: no post-fall retry card survives; the dark card offers USE TORCH", () => {
  assert.doesNotMatch(CODE, /rail\.pending\.kind === "climb"/);
  assert.doesNotMatch(CODE, /retryTool/);

  assert.match(CODE, /rail\.pending && rail\.pending\.kind === "dark" && S\.c\.darkFor > 0 && window\.__mzHasTool\(S\.c, "torch"\)/);
  const darkRegion = sliceBetween(CODE, 'rail.pending.kind === "dark" && S.c.darkFor', "} else if (rail.card)");
  assert.match(darkRegion, /copy\.dark\.torch/);
  assert.match(darkRegion, /window\.mzUseItem\(window\.__mzToolIndex\(S\.c, "torch"\)\)/);
});

// ─── 4. Gear-tab row builders on itemRowState ─────────────────────────────

test("Gear tab: gearUseCell and renderCarriedList's row builder both read itemRowState(state, it); neither carries the retired it.every cooldown expression", () => {
  // Phase 62 (GSCR-01..06), Plan 02: wornSlotRow is retired with the
  // two-panel renderer — every WORN/bag row's USE cell now derives from
  // gearUseCell(state, it), which itself reads itemRowState(state, it) as
  // its ONE row-state rule, never a restated it.every cooldown gate.
  const useCellRegion = sliceBetween(GEAR_SRC, "export function gearUseCell(state, it) {", "\n}");
  assert.match(useCellRegion, /itemRowState\(state, it\)/);
  assert.doesNotMatch(useCellRegion, /it\.every \?/);

  const rowsRegion = sliceBetween(GEAR_SRC, "rows.forEach(({ it, i }) => {", "for (const a of (opts.actions");
  assert.match(rowsRegion, /itemRowState\(state, it\)/);
  assert.doesNotMatch(rowsRegion, /it\.every \?/);

  assert.equal((GEAR_SRC.match(/itemRowState\(state, it\)/g) || []).length >= 2, true);
});

// ─── 5. Chip copy tables + explainCondition ───────────────────────────────

test("CONDITION_TONE/CONDITION_EXPLAIN carry the three new item-driven chip keys; explainCondition names the item and what's counting", () => {
  const toneMatch = CODE.match(/const CONDITION_TONE = \{[^}]*\};/);
  assert.ok(toneMatch, "CONDITION_TONE literal not found");
  assert.match(toneMatch[0], /itemCooldown: "odd"/);
  assert.match(toneMatch[0], /staffCharges: "odd"/);
  assert.match(toneMatch[0], /lit: "good"/);

  assert.equal((CODE.match(/function explainCondition\(cn, label\) \{/g) || []).length, 1);
  const region = sliceBetween(CODE, "function explainCondition(cn, label) {", "\n}");
  assert.match(region, /cn\.source \|\| cn\.item/);
  assert.match(region, /cn\.cadence === "rounds" \? "rounds" : "squares"/);
  assert.match(region, /"cooling"/);
  assert.match(region, /charges, next in/);

  // Phase 57 (LAYOUT-03): the condition-chip explain card's hold literal
  // was doubled from 4200 to 8400, same ruling as every other RAIL_HOLD key.
  // Phase 57 (LAYOUT-06): the guardTap call site now reads a local
  // `explainText` (the darkness chip's waiver-led text when a waiver is
  // open, else explainCondition(cn, label) unchanged) instead of calling
  // explainCondition(cn, label) inline — re-pinned to the new call site;
  // explainCondition(cn, label) itself is still asserted present two lines
  // above this pin, and is still exactly what non-darkness chips reach.
  assert.match(CODE, /window\.mzRailLine\?\.\(label\.toUpperCase\(\), explainText, "info", 8400, "·"\)/);
});

// ─── 6. Hero tab: engine-routed to-hit/strike-die ─────────────────────────

// The sheet's "s-die"/"s-hit" writes live in heroTab.js, which imports
// strikeDie directly and heroHitOdds (Phase 74, ROLL-02) from
// src/browser/rollOdds.js — the bridge and the classic-script duplicate
// are both pinned absent below.
test('Hero tab: "s-die"/"s-hit" read strikeDie(c)/heroHitOdds(state) directly in heroTab.js, not the classic duplicates', () => {
  assert.match(HERO_SRC, /"s-die"\)\.textContent = "d" \+ strikeDie\(c\);/);
  assert.match(HERO_SRC, /"s-hit"\)\.textContent = heroHitOdds\(state\)\.text;/);
  assert.equal((CODE.match(/"s-die"\)/g) || []).length, 0, "the classic script must no longer write #s-die");
  assert.equal((CODE.match(/"s-hit"\)/g) || []).length, 0, "the classic script must no longer write #s-hit");
});

// ─── 7. Voice safety ───────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

test("Voice: the new hazard/dark/chip copy clears the family-friendly safety wordlist", () => {
  for (const phrase of [
    "A wall. You could climb it. You could also not.",
    "A crevice. Leaping is traditional. Rope is smarter.",
    "You are carrying a light. Darkness will have to wait its turn.",
    "Used, and not ready to be used again. Squares fix that.",
    "The staff is remembering how to do that. Walk it off.",
  ]) {
    const offenders = findBannedTerms(phrase);
    assert.deepStrictEqual(offenders, [], `Banned copy in "${phrase}": ${JSON.stringify(offenders)}`);
  }
});

// ─── 8. Build artefact sanity ────────────────────────────────────────────────

test("Build artefact: www/index.html carries mzUseTool and the hazard card copy (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /mzUseTool/);
  assert.match(built, /USE LADDER/);
});
