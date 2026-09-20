// test/unit/shell-abilities.test.js
//
// Phase 38 (ABIL-01/04), Plan 05 — mazeworld.html has no ESM surface a test
// can import directly, so — mirroring test/unit/shell-worn-slots.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   1. COMBAT_DISPATCH.useAbility + window.mzUseAbility, the shell dispatch
//      bridge for the ABILITIES submenu's real action;
//   2. the #s-abilities Hero-tab markup sits directly after #s-skills;
//   3. renderAbilityRows(c): createElement/textContent only (T-38-11 — no
//      innerHTML in the region), the Magic User "Spells are the trick." none
//      row, the source->tag mapping, called exactly once from paint();
//   4. window.__mzAbilities is retired (heroTab.js-local view models);
//   5. surfaceAbilityPool(state) — its body, and that it is the LAST
//      statement of commitRolledState and is also called from
//      window.mzDevStartAtDepth;
//   6. mzCombatReport's "New trick:" line + noteCombat's learned field;
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

// Phase 47 (SHELL-02), Plan 04: renderAbilityRows and the Hero-tab abilities
// list moved out of the classic script's paint() into src/browser/
// heroTab.js — this file's region reads follow.
const HERO_TAB_RAW = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n");
const HERO_SRC = stripComments(HERO_TAB_RAW);

// Phase 50 (ROLL-01), Plan 03: the shell's own RACES/CLASSES import moved to
// src/browser/roller.js (the roller mount's reelWordLists()) — the pin below
// re-points to it instead of asserting the shell still imports them.
const ROLLER_RAW = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "roller.js"), "utf8").replace(/\r\n/g, "\n");
const ROLLER_SRC = stripComments(ROLLER_RAW);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function abilityRowsRegion() {
  return sliceBetween(HERO_SRC, "function renderAbilityRows(doc, state) {", "\nfunction renderGrimoire(");
}

// ─── 1. COMBAT_DISPATCH.useAbility + window.mzUseAbility ───────────────────

test("COMBAT_DISPATCH.useAbility maps to window.mzUseAbility?.(d.key); window.mzUseAbility dispatches the useAbility { key } action", () => {
  const start = CODE.indexOf("const COMBAT_DISPATCH = {");
  const end = CODE.indexOf("\n};", start);
  const region = CODE.slice(start, end + "\n};".length);
  assert.match(region, /useAbility:\s*\(d\)\s*=>\s*window\.mzUseAbility\?\.\(d\.key\)/);
  assert.match(CODE, /window\.mzUseAbility = \(key\) => engineCombatAction\("useAbility", \{ key \}\);/);
});

// ─── 2. #s-abilities markup ─────────────────────────────────────────────────

test("#s-abilities markup sits directly after #s-skills in the Hero tab", () => {
  const iSkills = HTML.indexOf('id="s-skills"');
  const iAbilities = HTML.indexOf('id="s-abilities"');
  assert.ok(iSkills !== -1 && iAbilities !== -1, "both markers found");
  assert.ok(iAbilities > iSkills, "#s-abilities sits after #s-skills");
  // Phase 47 (SHELL-02), Plan 04: #s-skills' own passives-only render loop
  // moved into src/browser/heroTab.js along with the rest of the Hero sheet.
  assert.match(HERO_SRC, /No skills bought\./);
  assert.doesNotMatch(CODE, /No skills bought\./);
});

// ─── 3. renderAbilityRows ────────────────────────────────────────────────────

// renderAbilityRows(doc, state) lives in src/browser/heroTab.js and reads
// characterSheetViewModel(state) directly (window.__mzAbilities is retired).
test("renderAbilityRows: createElement/textContent only (no innerHTML in the region), Magic User none row, source-tag mapping, called exactly once from renderHeroTab; zero copies remain in the classic script", () => {
  assert.equal((HERO_SRC.match(/function renderAbilityRows\(doc, state\) \{/g) || []).length, 1);
  assert.equal((CODE.match(/function renderAbilityRows\(/g) || []).length, 0);
  const region = abilityRowsRegion();
  assert.doesNotMatch(region, /innerHTML/);
  assert.match(region, /ul\.replaceChildren\(\);/);
  assert.match(region, /Spells are the trick\./);
  assert.match(region, /row\.source === "pool" \? "trick" : "special skill · active"/);
  assert.match(region, /characterSheetViewModel\(state\)\.abilities/);
  assert.equal((HERO_SRC.match(/\n\s*renderAbilityRows\(doc, state\);/g) || []).length, 1, "renderAbilityRows(doc, state) is called exactly once");
});

// ─── 4. window.__mzAbilities is retired ─────────────────────────────────────

// __mzAbilities is pinned absent below; its only reader (renderAbilityRows)
// lives in heroTab.js, which declares characterSheetViewModel in the SAME
// module (no bridge needed for a module reading its own export).
test("window.__mzAbilities is retired; characterSheetViewModel/ABILITY_BY_ID/abilityRoundsLeft/isReady are heroTab.js-local, not classic-script bridges", () => {
  assert.equal((CODE.match(/window\.__mzAbilities/g) || []).length, 0);
  assert.equal((CODE.match(/import \{ abilityRoundsLeft \}/g) || []).length, 0);
  assert.equal((CODE.match(/import \{ isReady \} from "\.\/engine\/effects\.js";/g) || []).length, 0);
  // Phase 50 (ROLL-01), Plan 03: the shell no longer imports RACES/CLASSES —
  // the roller mount (src/browser/roller.js) is their only reader now.
  assert.equal((CODE.match(/import \{ RACES, CLASSES \} from "\.\/content\/index\.js";/g) || []).length, 0);
  assert.match(ROLLER_SRC, /import \{ RACES, CLASSES \} from "\.\.\/\.\.\/content\/index\.js";/);
  assert.match(
    CODE,
    /import \{ characterSheetViewModel, rationsViewModel, eatsLineFor, renderHeroTab \} from "\.\/src\/browser\/heroTab\.js";/,
  );
  assert.match(HERO_SRC, /import \{ abilityRoundsLeft \} from "\.\.\/\.\.\/engine\/abilities\.js";/);
  assert.match(HERO_SRC, /import \{ isReady \} from "\.\.\/\.\.\/engine\/effects\.js";/);
});

// ─── 5. surfaceAbilityPool ───────────────────────────────────────────────────

test("surfaceAbilityPool(state) builds the pool card via rail.js#abilityPoolCard and pushes it via mzRailLine + logLine", () => {
  assert.equal((CODE.match(/function surfaceAbilityPool\(state\) \{/g) || []).length, 1);
  const region = sliceBetween(CODE, "function surfaceAbilityPool(state) {", "\n  }");
  assert.match(region, /abilityPoolCard\(state\.c\)/);
  assert.match(region, /window\.mzRailLine\?\.\(card\.title, card\.line, card\.tone, card\.hold, card\.icon\)/);
  assert.match(region, /window\.logLine\?\.\(card\.line\)/);
  assert.match(CODE, /wornReconcileCard, abilityPoolCard \} from "\.\/src\/browser\/rail\.js";/);
});

test("surfaceAbilityPool(state) is the LAST statement of commitRolledState, and is also called from window.mzDevStartAtDepth", () => {
  const commitFn = sliceBetween(CODE, "function commitRolledState(state) {", "\n  }");
  const lines = commitFn
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  assert.equal(lines[lines.length - 1], "surfaceAbilityPool(state);", "surfaceAbilityPool(state) must be the LAST statement of commitRolledState");

  const devFn = sliceBetween(CODE, "window.mzDevStartAtDepth = async function devStartAtDepth(depth) {", "\n  };");
  assert.match(devFn, /surfaceAbilityPool\(state\);/);
});

// ─── 6. mzCombatReport / noteCombat learned line ────────────────────────────

test("mzCombatReport appends 'New trick: {name}.' per d.learned entry; noteCombat's data carries learned from abilityLearned events", () => {
  const start = CODE.indexOf("window.mzCombatReport = function (d) {");
  const end = CODE.indexOf("\n};", start);
  const region = CODE.slice(start, end);
  assert.match(region, /for \(const n of d\.learned \|\| \[\]\) lines\.push\(`<span class="hit">New trick: \$\{n\}\.<\/span>`\);/);
  assert.match(CODE, /learned: events\.filter\(\(e\) => e\.type === "abilityLearned"\)\.map\(\(e\) => e\.name\),/);
});

// ─── 7. Voice safety ─────────────────────────────────────────────────────────

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

test("Voice: the new Hero-tab/report copy clears the family-friendly safety wordlist", () => {
  for (const phrase of ["special skill · active", "trick", "Spells are the trick.", "New trick:", "Abilities"]) {
    const offenders = findBannedTerms(phrase);
    assert.deepStrictEqual(offenders, [], `Banned copy in "${phrase}": ${JSON.stringify(offenders)}`);
  }
});

// ─── 8. Build artefact sanity ────────────────────────────────────────────────

test("Build artefact: www/index.html carries s-abilities and surfaceAbilityPool (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /s-abilities/);
  assert.match(built, /surfaceAbilityPool/);
});
