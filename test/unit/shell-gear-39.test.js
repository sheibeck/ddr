// test/unit/shell-gear-39.test.js
//
// Phase 39 (GEAR-02/GEAR-05), Plan 05 — mazeworld.html has no ESM surface a
// test can import directly, so — mirroring test/unit/shell-abilities.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   1. the five new read-only bridges (__mzHasTool/__mzToolIndex/__mzToHit/
//      __mzStrikeDie/__mzItemRowState) + their imports;
//   2. window.mzUseTool + the stepNow -> stepWith(action) refactor;
//   3. the hazard pre-roll decision card (S.pendingHazard branch) in
//      renderRail, and the retry/dark cards' tool offers;
//   4. the Gear-tab row builders route through window.__mzItemRowState(S, it)
//      and no longer carry the retired it.every cooldown expression;
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── 1. Bridges ──────────────────────────────────────────────────────────

test("Bridges: hasTool/toolIndex/toHit/strikeDie/itemRowState imported and bridged read-only, once each", () => {
  // Phase 41 (TERR-03), Plan 04: the shared derived.js import line gained
  // mapViewRadius/inViewWindow as sibling named imports.
  assert.match(CODE, /import \{ conditionsOf, canCast, eff, slotFor, WORN_SLOTS, WORN_KEYS_OF, hasTool, toHit, strikeDie, mapViewRadius, inViewWindow \} from "\.\/engine\/derived\.js";/);
  assert.match(CODE, /import \{ toolIndex \} from "\.\/engine\/items\.js";/);
  assert.match(
    CODE,
    /import \{ characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage, itemRowState \} from "\.\/src\/browser\/viewModels\.js";/,
  );
  assert.equal((CODE.match(/window\.__mzHasTool = hasTool;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzToolIndex = toolIndex;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzToHit = toHit;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzStrikeDie = strikeDie;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzItemRowState = itemRowState;/g) || []).length, 1);
});

// ─── 2. window.mzUseTool + stepWith(action) refactor ──────────────────────

test("window.mzUseTool dispatches useTool via stepWith, guarded by railLocked() like every other movement path", () => {
  assert.equal((CODE.match(/window\.mzUseTool = \(tool, dir\) => \{/g) || []).length, 1);
  const region = sliceBetween(CODE, "window.mzUseTool = (tool, dir) => {", "window.__mzDescend = ");
  assert.match(region, /if \(railLocked\(\)\) \{ window\.mzRailPulse\?\.\(\); return; \}/);
  assert.match(region, /stepWith\(\{ type: "useTool", tool, dir \}\);/);
});

test("stepNow(dir) is a thin wrapper over stepWith({ type: 'move', dir }); stepWith is the one dispatch body", () => {
  assert.equal((CODE.match(/function stepWith\(action\) \{/g) || []).length, 1);
  assert.equal((CODE.match(/function stepNow\(dir\) \{/g) || []).length, 1);
  const stepNowRegion = sliceBetween(CODE, "function stepNow(dir) {", "\n  }");
  assert.match(stepNowRegion, /stepWith\(\{ type: "move", dir \}\);/);
  const stepWithRegion = sliceBetween(CODE, "function stepWith(action) {", "function stepNow(dir) {");
  assert.match(stepWithRegion, /dispatchWithToasts\(action\)/);
  assert.match(stepWithRegion, /window\.__mzHasTool\(state\.c, "torch"\)/);
});

// ─── 3. Rail cards: hazard pre-roll, retry tool offer, dark ───────────────

test("renderRail: the hazard pre-roll decision card wins over joiner/find, and its buttons dispatch mzUseTool/move", () => {
  assert.match(CODE, /if \(S\.pendingHazard && !S\.pendingHazard\.declined && !S\.combat && !S\.store\) \{/);
  const region = sliceBetween(CODE, "if (S.pendingHazard && !S.pendingHazard.declined", "} else if (S.pendingJoiner");
  assert.match(region, /copy\.hazard\.title/);
  assert.match(region, /copy\.hazard\.ladder/);
  assert.match(region, /copy\.hazard\.rope/);
  assert.match(region, /copy\.hazard\.climb/);
  assert.match(region, /copy\.hazard\.leap/);
  assert.match(region, /window\.mzUseTool\(tool, dir\)/);
  assert.match(region, /window\.move\(dir\)/);
});

test("renderRail: the climb retry card offers the matching tool when carried; the dark card offers USE TORCH", () => {
  const retryRegion = sliceBetween(CODE, 'rail.pending && rail.pending.kind === "climb"', 'rail.pending && rail.pending.kind === "dark"');
  assert.match(retryRegion, /pend\.feat === "gorge" \? copy\.hazard\.leap : pend\.feat === "climb" \? copy\.hazard\.climb : copy\.climb\.retry/);
  assert.match(retryRegion, /window\.__mzHasTool\(S\.c, retryTool\)/);
  assert.match(retryRegion, /window\.mzUseTool\(retryTool, pend\.dir\)/);

  assert.match(CODE, /rail\.pending && rail\.pending\.kind === "dark" && S\.c\.darkFor > 0 && window\.__mzHasTool\(S\.c, "torch"\)/);
  const darkRegion = sliceBetween(CODE, 'rail.pending.kind === "dark" && S.c.darkFor', "} else if (rail.card)");
  assert.match(darkRegion, /copy\.dark\.torch/);
  assert.match(darkRegion, /window\.mzUseItem\(window\.__mzToolIndex\(S\.c, "torch"\)\)/);
});

// ─── 4. Gear-tab row builders on itemRowState ─────────────────────────────

test("Gear tab: wornSlotRow and renderCarriedList's row builder both read window.__mzItemRowState(S, it); neither carries the retired it.every cooldown expression", () => {
  const wornSlotRegion = sliceBetween(CODE, "const wornSlotRow = (slot, it) => {", "renderCarriedList(carry, items, {");
  assert.match(wornSlotRegion, /window\.__mzItemRowState\(S, it\)/);
  assert.doesNotMatch(wornSlotRegion, /it\.every \?/);

  const rowsRegion = sliceBetween(CODE, "rows.forEach(({ it, i }) => {", "for (const a of (opts.actions");
  assert.match(rowsRegion, /window\.__mzItemRowState\(S, it\)/);
  assert.doesNotMatch(rowsRegion, /it\.every \?/);

  assert.equal((CODE.match(/__mzItemRowState\(S, it\)/g) || []).length >= 2, true);
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

  assert.match(CODE, /window\.mzRailLine\?\.\(label\.toUpperCase\(\), explainCondition\(cn, label\), "info", 4200, "·"\)/);
});

// ─── 6. Hero tab: engine-routed to-hit/strike-die ─────────────────────────

test('Hero tab: "s-die"/"s-hit" read window.__mzStrikeDie(S.c)/window.__mzToHit(S), not the classic duplicates', () => {
  assert.match(CODE, /"s-die"\)\.textContent = "d" \+ window\.__mzStrikeDie\(S\.c\);/);
  assert.match(CODE, /"s-hit"\)\.textContent = "1–" \+ window\.__mzToHit\(S\);/);
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
