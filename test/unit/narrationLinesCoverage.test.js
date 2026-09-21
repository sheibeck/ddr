// test/unit/narrationLinesCoverage.test.js
//
// Phase 25 Plan 05 — standing guard that locks the phase's two invariants:
//
//   1. Nothing new can slip in silently. Every engine event type either has a
//      LINE_FOR builder or is explicitly Oracle-only (listed in
//      ORACLE_ONLY with a reason). The partition is exact — LINE_FOR and
//      ORACLE_ONLY are disjoint, and neither contains a type the engine never
//      emits (no dead/typo entries — the same "no dead entries" guard
//      test/unit/formatEventsCoverage.test.js already enforces for
//      EVENT_NARRATION).
//   2. The feature manifest is honest. Every FEATURE_EVENTS entry has BOTH a
//      LINE_FOR builder and an Oracle line, and the manifest covers every event
//      name test/unit/identity-contract.test.js asserts — derived from that
//      file's source at runtime, never hand-copied.
//
// This file duplicates deriveCanonicalEventTypes (and its helpers) from
// test/unit/formatEventsCoverage.test.js verbatim (same KNOWN_INDIRECT_TYPES,
// same regexes). The two files are DELIBERATELY not sharing a module: each
// coverage guard reads engine/*.js standalone, so a refactor that breaks one
// derivation cannot silently disable the other by way of a shared, possibly
// stale helper module. If the derivation strategy ever changes, update both
// files together.
//
// Source-scan safety note (25-04's pitfall): a naive stripComments() that
// strips /* block */ comments BEFORE // line comments will misread any `//`
// comment that happens to contain a `/*`-looking substring (e.g. a mention of
// `@capacitor/*` or `icons/optimized/*.png`) as an unterminated block-comment
// opener, silently swallowing real code up to the next unrelated `*/`. Every
// stripComments() in this file strips line comments FIRST, then block
// comments, which is immune to that failure mode (test/unit/shell-narration-
// wiring.test.js established this pattern for the same reason).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { LINE_FOR, ORACLE_ONLY, FEATURE_EVENTS, linesForAction } from "../../src/browser/narrationLines.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_DIR = path.join(REPO_ROOT, "engine");

// ─── shared helpers (line-comments-first stripComments; safe order) ────────

/**
 * stripComments(source) — strips // line comments first, then /* block *\/
 * comments, preserving line breaks inside removed block comments. Line-
 * comments-first is the safe order: see the module header's pitfall note.
 */
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ""));
}

/** collectJsFiles(dir) — every top-level .js file in `dir` (engine/ has no subdirectories). */
function collectJsFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(dir, entry.name));
}

// Types engine/events.js defines via `type: EVENT_TYPES.X` indirection (never
// a literal `type: "..."` string at the actual push site). Copied verbatim
// from test/unit/formatEventsCoverage.test.js — "moved" is deliberately NOT
// listed (a plain step is intentionally silent by design).
const KNOWN_INDIRECT_TYPES = ["died", "leveled", "spGained", "floorChanged", "teleported", "floorRegen"];

/**
 * deriveCanonicalEventTypes() — the authoritative event-type vocabulary,
 * derived from engine/*.js source at runtime (never a hand-copied frozen
 * list). Identical derivation strategy to
 * test/unit/formatEventsCoverage.test.js's own helper of the same name.
 */
function deriveCanonicalEventTypes() {
  const types = new Set(KNOWN_INDIRECT_TYPES);
  for (const file of collectJsFiles(ENGINE_DIR)) {
    const stripped = stripComments(fs.readFileSync(file, "utf8"));
    for (const exprMatch of stripped.matchAll(/type:\s*([^,}]+)/g)) {
      for (const strMatch of exprMatch[1].matchAll(/"([A-Za-z]+)"/g)) {
        types.add(strMatch[1]);
      }
    }
    // Phase 31 (CMB-01): refuseIfPending(state, events, "someType", extra)
    // constructs its event from a PARAMETER, not a literal `type: "..."`
    // object key — see formatEventsCoverage.test.js's identical addition.
    for (const m of stripped.matchAll(/refuseIfPending\(\s*state,\s*events,\s*"([A-Za-z]+)"/g)) {
      types.add(m[1]);
    }
  }
  return types;
}

// Every named legibility event this phase set out to make legible (FEED-06's
// spell/ability resist-and-refuse outcomes) plus every refusal/rejection type
// (FEED-02) — asserted to be in the LINE_FOR table, never the Oracle-only
// allowlist (probe FEED-06 empty; probe FEED-02 empty).
const NAMED_LEGIBILITY_EVENTS = [
  "nothingToThrowAt",
  "noChargesLeft",
  "spellResisted",
  "resistFailed",
  "foeCast",
  "foeBolted",
  "foeDrained",
  "foeDebuffed",
  "foeHealed",
  "foeSummoned",
  "heroResisted",
  "heroResistFailed",
  "scrollRefused",
  "strikeRefused",
  "fleeRefused",
  "parleyRefused",
  "withdrawalDenied",
  "vanishDenied",
  "itemRejected",
  "equipRejected",
  "useRefused",
  "spellNotKnown",
  "spellAboveLevel",
  "spellSchoolLocked",
  "campFailed",
  "joinerRefused",
  "buyFailed",
  "backstabDenied",
];

test("every engine-emitted event type either has a LINE_FOR builder or is explicitly Oracle-only", () => {
  const canonical = deriveCanonicalEventTypes();
  assert.ok(canonical.size > 200, `expected the derived event-type set to be large (~209); got ${canonical.size}`);

  const missing = [...canonical].filter((t) => !(t in LINE_FOR) && !ORACLE_ONLY.has(t));
  assert.deepStrictEqual(
    missing.sort(),
    [],
    `${missing.length} engine event type(s) have neither a LINE_FOR builder nor an ORACLE_ONLY entry:\n${missing.sort().join("\n")}`,
  );
});

test("LINE_FOR and ORACLE_ONLY are disjoint and contain no dead entries", () => {
  const canonical = deriveCanonicalEventTypes();

  const overlap = Object.keys(LINE_FOR).filter((t) => ORACLE_ONLY.has(t));
  assert.deepStrictEqual(overlap, [], `LINE_FOR and ORACLE_ONLY overlap on: ${overlap.join(", ")}`);

  const deadLine = Object.keys(LINE_FOR).filter((t) => !canonical.has(t));
  assert.deepStrictEqual(deadLine, [], `LINE_FOR has dead/typo entries not emitted by the engine: ${deadLine.join(", ")}`);

  const deadAllow = [...ORACLE_ONLY].filter((t) => !canonical.has(t) && t !== "moved");
  assert.deepStrictEqual(deadAllow, [], `ORACLE_ONLY has dead/typo entries not emitted by the engine: ${deadAllow.join(", ")}`);
});

test("the named legibility events live in the table, never the allowlist (probe FEED-06/FEED-02 empty)", () => {
  const wrong = [];
  for (const t of NAMED_LEGIBILITY_EVENTS) {
    if (!(t in LINE_FOR) || ORACLE_ONLY.has(t)) wrong.push(t);
  }
  assert.deepStrictEqual(wrong, [], `these legibility/refusal events are missing a LINE_FOR builder or wrongly allowlisted: ${wrong.join(", ")}`);
});

test("ORACLE_ONLY holds bookkeeping only", () => {
  const featureOverlap = FEATURE_EVENTS.filter((t) => ORACLE_ONLY.has(t));
  assert.deepStrictEqual(featureOverlap, [], `ORACLE_ONLY must never contain a FEATURE_EVENTS entry: ${featureOverlap.join(", ")}`);

  const unnarrated = [...ORACLE_ONLY].filter((t) => t !== "moved" && typeof EVENT_NARRATION[t] !== "function");
  assert.deepStrictEqual(unnarrated, [], `every ORACLE_ONLY type (except "moved") must still have an EVENT_NARRATION entry: ${unnarrated.join(", ")}`);

  assert.ok(ORACLE_ONLY.size >= 10 && ORACLE_ONLY.size <= 40, `ORACLE_ONLY.size (${ORACLE_ONLY.size}) is outside the sane bookkeeping-only band [10, 40]`);
});

test("FEATURE_EVENTS is a subset of LINE_FOR keys intersected with EVENT_NARRATION keys", () => {
  assert.strictEqual(new Set(FEATURE_EVENTS).size, FEATURE_EVENTS.length, "FEATURE_EVENTS contains duplicate entries");

  const missingLine = FEATURE_EVENTS.filter((t) => typeof LINE_FOR[t] !== "function");
  assert.deepStrictEqual(missingLine, [], `FEATURE_EVENTS entries missing a LINE_FOR builder: ${missingLine.join(", ")}`);

  const missingNarration = FEATURE_EVENTS.filter((t) => typeof EVENT_NARRATION[t] !== "function");
  assert.deepStrictEqual(missingNarration, [], `FEATURE_EVENTS entries missing an EVENT_NARRATION entry: ${missingNarration.join(", ")}`);

  const empty = FEATURE_EVENTS.filter((t) => {
    const { text } = LINE_FOR[t]({ type: t });
    return typeof text !== "string" || text.trim() === "";
  });
  assert.deepStrictEqual(empty, [], `FEATURE_EVENTS builders that return empty text for a bare {type} call: ${empty.join(", ")}`);
});

test("FEATURE_EVENTS covers every event name test/unit/identity-contract.test.js asserts", () => {
  const canonical = deriveCanonicalEventTypes();
  const identitySource = fs.readFileSync(path.join(REPO_ROOT, "test", "unit", "identity-contract.test.js"), "utf8");
  const stripped = stripComments(identitySource);

  const names = new Set();
  for (const m of stripped.matchAll(/(?:expectEvent|findEvent)\(\s*[A-Za-z0-9_]+\s*,\s*"([A-Za-z]+)"/g)) names.add(m[1]);
  for (const m of stripped.matchAll(/\.type === "([A-Za-z]+)"/g)) names.add(m[1]);
  for (const m of stripped.matchAll(/\{\s*type:\s*"([A-Za-z]+)"/g)) names.add(m[1]);

  // Intersect with the canonical engine event-type set — this drops
  // non-event strings the same three regex shapes can also catch incidental-
  // ly (e.g. an encounter-table type comparison like `.type === "Beasts"`).
  const eventNames = [...names].filter((n) => canonical.has(n));

  assert.ok(eventNames.length >= 30, `expected >= 30 identity-contract event names after intersecting with canonical; got ${eventNames.length}: ${eventNames.sort().join(", ")}`);

  const gaps = eventNames.filter((n) => !FEATURE_EVENTS.includes(n));
  assert.deepStrictEqual(gaps.sort(), [], `FEATURE_EVENTS is missing these identity-contract event names: ${gaps.sort().join(", ")}`);
});

// Exercise the exported aggregation entry point so an accidental future
// change to its signature/purity is caught here too, alongside the coverage
// guards above.
test("linesForAction is exported from narrationLines.js and behaves as a pure function on an empty/garbage input", () => {
  assert.strictEqual(typeof linesForAction, "function");
  assert.deepStrictEqual(linesForAction("attack", [], {}), []);
  assert.deepStrictEqual(linesForAction("attack", null, {}), []);
});

// ─── purity tripwire (T-25-23) ──────────────────────────────────────────────

const PURE_MODULE_FILES = ["src/browser/narrationLines.js", "src/browser/missLines.js"];
const IMPURITY_PATTERNS = [/Math\.random/, /Date\.now/, /\bdocument\./, /\bwindow\./, /\bglobalThis\./, /\blocalStorage\b/, /from\s+["'][^"']*engine\//];

test("presentation narration modules are pure (no Math.random/Date.now/DOM/engine import)", () => {
  const offenses = [];
  for (const rel of PURE_MODULE_FILES) {
    const full = path.join(REPO_ROOT, rel);
    const lines = stripComments(fs.readFileSync(full, "utf8")).split("\n");
    lines.forEach((line, i) => {
      for (const pattern of IMPURITY_PATTERNS) {
        if (pattern.test(line)) {
          offenses.push(`${rel}:${i + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }
  assert.deepStrictEqual(offenses, [], `Found impurity in a presentation module:\n${offenses.join("\n")}`);
});

test("the narration table and the rail do NOT re-export the narration-lines surface, and narrationLines.js never imports eventNarration.js", async () => {
  const eventNarrationMod = await import("../../src/browser/eventNarration.js");
  const railMod = await import("../../src/browser/rail.js");

  for (const mod of [eventNarrationMod, railMod]) {
    assert.strictEqual(mod.LINE_FOR, undefined, "must not re-export LINE_FOR");
    assert.strictEqual(mod.ORACLE_ONLY, undefined, "must not re-export ORACLE_ONLY");
    assert.strictEqual(mod.FEATURE_EVENTS, undefined, "must not re-export FEATURE_EVENTS");
    assert.strictEqual(mod.linesForAction, undefined, "must not re-export linesForAction");
  }

  const linesSource = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "narrationLines.js"), "utf8");
  assert.ok(!stripComments(linesSource).includes('from "./eventNarration.js"'), "narrationLines.js must never import eventNarration.js (would create an import cycle)");
});
