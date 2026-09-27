// test/unit/shell-spells-40.test.js
//
// Phase 40 (SPELL-01/02/05/06), Plan 05 — mazeworld.html has no ESM surface
// a test can import directly, so — mirroring test/unit/shell-gear-39.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   (a) the five new CONDITION_COPY/CONDITION_TONE/CONDITION_EXPLAIN rows
//       (mirror/senses/regen/foresight/reveal);
//   (b) the Hero-tab kit's ward row now reads pool AND rounds (SPELL-06);
//   (c) the four new Hero-tab kit rows (Mirror Self/Sense Presence/Sense
//       Danger/Map the Floor);
//   (d) foeStatusBadges reads the hero's spell:weaken record and a foe's
//       f.dot record;
//   (e) draw() paints a spellSeen cell in the borrowed-sight tint, and the
//       fallback palette literal's hex matches MAP_PALETTE.floorSpell;
//   (f) voice safety of every new literal;
//   (g) the build artefact carries the new surface.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { MAP_PALETTE } from "../../src/browser/mapMarks.js";
import { gearKitRows } from "../../src/browser/gearTab.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";

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
// Phase 47 (SHELL-01), Plan 03, Task 2: the Hero-tab kit rows (#s-kit,
// "ALSO ON YOU") moved into src/browser/gearTab.js#renderGearTab.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── (a) CONDITION_COPY / CONDITION_TONE / CONDITION_EXPLAIN rows ─────────

test("CONDITION_COPY: the five new chip rows (mirror/senses/regen/foresight/reveal)", () => {
  assert.match(CODE, /mirror: \{ label: "Mirrored", unit: "rds" \}/);
  assert.match(CODE, /senses: \{ label: "Senses" \}/);
  assert.match(CODE, /regen: \{ label: "Regenerating" \}/);
  assert.match(CODE, /foresight: \{ label: "Forewarned" \}/);
  // Plan 76-06 (user ruling 2026-09-26): a fixed "until you move" detail, no squares unit.
  assert.match(CODE, /reveal: \{ label: "Mapped", detail: "until you move" \}/);
});

test("CONDITION_TONE: the five new chip keys", () => {
  const toneMatch = CODE.match(/const CONDITION_TONE = \{[^}]*\};/);
  assert.ok(toneMatch, "CONDITION_TONE literal not found");
  assert.match(toneMatch[0], /mirror: "good"/);
  assert.match(toneMatch[0], /senses: "good"/);
  assert.match(toneMatch[0], /regen: "good"/);
  assert.match(toneMatch[0], /foresight: "odd"/);
  assert.match(toneMatch[0], /reveal: "odd"/);
});

test("CONDITION_EXPLAIN: the five new chip keys, each with a non-empty, banned-word-clear sentence", () => {
  const explainMatch = CODE.match(/const CONDITION_EXPLAIN = \{[\s\S]*?\n\};/);
  assert.ok(explainMatch, "CONDITION_EXPLAIN literal not found");
  for (const key of ["mirror", "senses", "regen", "foresight", "reveal"]) {
    const re = new RegExp(`${key}: "([^"]+)"`);
    const m = explainMatch[0].match(re);
    assert.ok(m, `CONDITION_EXPLAIN is missing the "${key}" key`);
    assert.ok(m[1].length > 0, `CONDITION_EXPLAIN.${key} must be non-empty`);
  }
});

test("CONDITION_COPY/TONE/EXPLAIN: each new key appears exactly once in mazeworld.html (no accidental double-paste)", () => {
  for (const key of ["mirror", "senses", "regen", "foresight", "reveal"]) {
    assert.equal((CODE.match(new RegExp(`\\b${key}: \\{ label:`, "g")) || []).length, 1, `${key}'s CONDITION_COPY row must appear exactly once`);
  }
});

// ─── (b) Hero-tab ward row: pool AND rounds ────────────────────────────────

// Phase 62 (GSCR-01..06), Plan 02: the ALSO ON YOU block's rows (formerly
// the classic "#s-kit"/ON YOU-panel `rows.push([...])` array) are now built
// by ONE pure model, gearKitRows(state) — these two tests become behavioral
// pins on it rather than a source-literal match.
test("Hero-tab kit: the Shield row reads pool AND rounds (SPELL-06)", () => {
  const c = { ward: { name: "Shield", pool: 9, rounds: 3 }, rations: 0, kills: 0 };
  const row = gearKitRows({ c }).find((r) => r.label === "Shield");
  assert.equal(row.value, "9 hp left · 3 rds");
});

// ─── (c) Hero-tab kit: the four new utility rows ───────────────────────────

test("Hero-tab kit: Mirror Self / Sense Presence / Sense Danger (armed) / Map the Floor rows, in Sense Danger < Map the Floor < Kills order", () => {
  const c = {
    rations: 0, kills: 5,
    mirror: 3, senses: true, foresight: true,
    timers: { "spell:reveal": { phase: "effect", left: 12 } },
  };
  const rows = gearKitRows({ c });
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel["Mirror Self"], "3 rds");
  assert.equal(byLabel["Sense Presence"], "till the fight ends");
  assert.equal(byLabel["Sense Danger"], "armed");
  // Plan 76-06 (user ruling 2026-09-26): the row reads a fixed value (was "12 sq").
  assert.equal(byLabel["Map the Floor"], "until you move");
  const labels = rows.map((r) => r.label);
  assert.ok(labels.indexOf("Sense Danger") < labels.indexOf("Map the Floor"), "Sense Danger sits before Map the Floor");
  assert.ok(labels.indexOf("Map the Floor") < labels.indexOf("Kills"), "Map the Floor sits before Kills");
});

// Plan 76-06 (user ruling 2026-09-26): the painted reveal chip, through the
// real paint() in the shell sandbox (modelled on darkness-vignette.test.js's
// paintDarkness / chipDetailText). A live window reads "Mapped · until you
// move" with no squares unit; no record, no chip.
function paintState(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return doc;
}

function revealChip(doc) {
  const host = doc.document.getElementById("mm-conditions");
  return host.children.find((el) => el.dataset && el.dataset.key === "reveal") || null;
}

function chipPart(chip, className) {
  const el = chip.children.find((x) => x.className === className);
  return el ? el.textContent : null;
}

test("(shell) the reveal chip: a live window paints 'Mapped' with the fixed detail 'until you move'; no record, no chip", () => {
  const live = structuredClone(fixedStates().thief);
  live.c.timers = { ...(live.c.timers || {}), "spell:reveal": { cadence: "squares", left: 1, phase: "effect" } };
  const chip = revealChip(paintState(live));
  assert.ok(chip, "the reveal chip is painted");
  // paintConditions sets the label as the button's own text, then appends the
  // detail span (the recording DOM reads the label back as textContent).
  assert.equal(chip.textContent, "Mapped");
  const detail = chipPart(chip, "mw-cond-detail");
  assert.equal(detail, "until you move");
  assert.equal(/\bsq\b|\d/.test(detail), false, "no squares countdown on the chip");

  const none = structuredClone(fixedStates().thief);
  if (none.c.timers) delete none.c.timers["spell:reveal"];
  assert.equal(revealChip(paintState(none)), null);
});

test("CONDITION_EXPLAIN.reveal: the tap card tells the until-you-move truth; the squares sentence is gone", () => {
  assert.ok(
    CODE.includes("You can see the whole floor for exactly as long as you stand still. One step and your focus breaks; whatever you never walked goes dark again."),
  );
  assert.equal(CODE.includes("When the squares run out"), false);
});

// ─── (d) foeStatusBadges: spell:weaken + f.dot ─────────────────────────────

// Phase 71 (D-14): the spell:weaken and f.dot reads moved into the ONE foe
// condition table, src/browser/foeConditions.js; the shell's foeStatusBadges
// is now a thin reader of window.__mzFoeConditions.
test("foeStatusBadges: reads the table through window.__mzFoeConditions; foeConditions.js reads the hero's spell:weaken record and a foe's f.dot record", () => {
  const region = sliceBetween(CODE, "function foeStatusBadges(f, V) {", "\n}");
  assert.match(region, /window\.__mzFoeConditions/);
  assert.equal((CODE.match(/"spell:weaken"/g) || []).length, 0, "the shell no longer reads spell:weaken itself");
  assert.equal((CODE.match(/f\.dot\.by === "ice"/g) || []).length, 0, "the shell no longer maps f.dot itself");
  const FOE_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "foeConditions.js"), "utf8").replace(/\r\n/g, "\n"));
  assert.match(FOE_SRC, /timers\["spell:weaken"\]/);
  assert.match(FOE_SRC, /f\.dot\.left/);
  assert.match(FOE_SRC, /f\.dot\.by === "ice" \? C\.ice : C\.poison/);
});

// ─── (e) draw(): spellSeen tint + fallback palette parity ─────────────────

// DARK-02 (Phase 76): the fill line gained the waived-dark tint; spellSeen
// still takes priority over it.
test("draw(): a spellSeen cell paints P.floorSpell (ahead of the DARK-02 waived-dark tint); the fallback palette literal's hex matches MAP_PALETTE.floorSpell", () => {
  assert.match(CODE, /ctx\.fillStyle = c\.spellSeen \? P\.floorSpell : \(c\.dark \? \(darkLit \? P\.floorDarkLit : P\.floorDark\) : P\.floor\);/);
  assert.equal((CODE.match(/floorSpell/g) || []).length >= 2, true, "expected floorSpell in both the fallback literal and draw()'s read");
  const fallbackMatch = CODE.match(/const P = M \? M\.MAP_PALETTE : \{[^}]*floorSpell: "(#[0-9a-fA-F]{6})"[^}]*\};/);
  assert.ok(fallbackMatch, "fallback palette literal must carry floorSpell");
  assert.equal(fallbackMatch[1], MAP_PALETTE.floorSpell, "the fallback hex must equal the real module's MAP_PALETTE.floorSpell");
});

// ─── (f) Voice safety ───────────────────────────────────────────────────────

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

test("Voice: the new chip/kit-row copy clears the family-friendly safety wordlist", () => {
  for (const phrase of [
    "They swing at a reflection for a few rounds. Try not to look smug.",
    // CMBUI-13 (plan 77-08): "how long" now follows on the tap card, so the sentence no longer repeats it.
    "You fight in the dark at full skill and nothing gets the jump on you.",
    "Wounds close on their own every round of this fight. It is not a licence.",
    "You act first in your next fight, whatever turns up. Whether the warning helps beyond that is up to you.",
    // Plan 76-06 (user ruling 2026-09-26): the reveal sentence is now the until-you-move truth.
    "You can see the whole floor for exactly as long as you stand still. One step and your focus breaks; whatever you never walked goes dark again.",
    "until you move",
  ]) {
    const offenders = findBannedTerms(phrase);
    assert.deepStrictEqual(offenders, [], `Banned copy in "${phrase}": ${JSON.stringify(offenders)}`);
  }
});

// ─── (g) Build artefact sanity ──────────────────────────────────────────────

test("Build artefact: www/index.html carries floorSpell and Mapped (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /floorSpell/);
  assert.match(built, /Mapped/);
});
