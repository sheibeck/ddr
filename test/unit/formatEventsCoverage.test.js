// test/unit/formatEventsCoverage.test.js
//
// Standing coverage guardrail for UX-05 (04-04-PLAN.md Task 1). The engine
// (`engine/*.js`) emits roughly ~160 distinct `{type, ...}` event shapes
// across combat/magic/economy/encounters/items/movement/character/death, but
// `src/browser/engineAdapter.js#formatEvent` historically hand-wrote cases
// for only ~26 of them (04-RESEARCH.md Pitfall 4). Once combat/economy are
// engine-routed (04-07), any gap here becomes a SILENT missing log line, not
// an obviously-broken one — this test makes that gap impossible to
// reintroduce by deriving the authoritative type set directly from engine
// source at runtime (never a hand-copied frozen list) and asserting
// `formatEvents()` never drops a real engine-emitted type.
//
// Derivation strategy (mirrors test/determinism/rng-no-math-random.test.js's
// established comment-stripping pattern in this codebase):
//   1. Read every engine/*.js file, strip block + line comments so a
//      commented-out `type: "..."` sample is never counted.
//   2. Regex-extract every literal `type: "SomeType"` occurrence — this
//      covers the overwhelming majority (the engine pushes almost all events
//      as inline object literals).
//   3. Union in the handful of types engine/events.js defines via factory
//      functions that reference `EVENT_TYPES.X` indirection rather than a
//      literal string at the push site (`died`, `won`, `leveled`,
//      `floorChanged` — `struck`/`moved`/`spGained`/`teleported` are also
//      touched by EVENT_TYPES but already appear as literals elsewhere, or
//      (moved only) are a deliberate silent no-narration event by design —
//      see the exclusion note below).
//
// DELIBERATE EXCLUSION: "moved" is NOT part of the canonical set. A plain
// step is intentionally silent (no log line) per engineAdapter.js's own
// design ("a plain step needs no narration line of its own") — proven by
// test/unit/engineAdapter.test.js's existing
// "formatEvents maps known event types to HTML and drops unknown ones
// silently" test, which asserts a `moved` event contributes ZERO html lines.
// Requiring a narration line for "moved" here would contradict that already-
// locked behavior, so it is excluded from the coverage requirement by name,
// not by accident.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { formatEvents } from "../../src/browser/engineAdapter.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_DIR = path.join(REPO_ROOT, "engine");

// Types engine/events.js defines via `type: EVENT_TYPES.X` indirection
// (never a literal `type: "..."` string at the actual push site) that must
// still be unioned into the canonical set. "moved" is deliberately NOT
// listed here — see the module header's exclusion note.
const KNOWN_INDIRECT_TYPES = ["died", "won", "leveled", "spGained", "floorChanged", "teleported"];

/**
 * stripComments(source) — strips /* *\/ block comments and // line comments,
 * preserving line breaks inside removed block comments so line numbers of
 * subsequent code stay accurate. Identical approach to
 * test/determinism/rng-no-math-random.test.js's stripComments, adapted here
 * to return a single joined string (this test regex-scans across the whole
 * file rather than line by line).
 */
function stripComments(source) {
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ""));
  return noBlockComments
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

/** collectJsFiles(dir) — every top-level .js file in `dir` (engine/ has no subdirectories). */
function collectJsFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(dir, entry.name));
}

/**
 * deriveCanonicalEventTypes() — the authoritative event-type vocabulary,
 * derived from engine/*.js source at runtime (never a hand-copied frozen
 * list, so it cannot silently rot as new event types land).
 */
function deriveCanonicalEventTypes() {
  const types = new Set(KNOWN_INDIRECT_TYPES);
  for (const file of collectJsFiles(ENGINE_DIR)) {
    const stripped = stripComments(fs.readFileSync(file, "utf8"));
    // Capture the whole expression after `type:` up to the next `,`/`}` —
    // not just a single trailing string literal — then pull every quoted
    // string out of that expression. This also catches engine/movement.js's
    // ternary-typed pushes (`type: climbing ? "climbedOver" : "leaptOver"`,
    // `type: climbing ? "fellClimbing" : "fellInGorge"`), which a bare
    // `type:\s*"([A-Za-z]+)"` match would silently miss (both branches sit
    // after a `?`/`:`, not directly after `type:`).
    for (const exprMatch of stripped.matchAll(/type:\s*([^,}]+)/g)) {
      for (const strMatch of exprMatch[1].matchAll(/"([A-Za-z]+)"/g)) {
        types.add(strMatch[1]);
      }
    }
  }
  return types;
}

test("formatEvents narrates every engine-emitted event type (derived from engine/*.js source)", () => {
  const canonical = deriveCanonicalEventTypes();
  assert.ok(canonical.size > 100, `expected the derived event-type set to be large (~160); got ${canonical.size}`);

  const missing = [];
  for (const type of canonical) {
    const html = formatEvents([{ type }]);
    if (!html.length || typeof html[0] !== "string" || html[0].trim() === "") {
      missing.push(type);
    }
  }

  assert.deepStrictEqual(
    missing,
    [],
    `formatEvents() produced no narration line for ${missing.length} engine-emitted event type(s):\n` +
      missing.sort().join("\n"),
  );
});

test("EVENT_NARRATION has no entries for event types the engine never emits", async () => {
  const canonical = deriveCanonicalEventTypes();
  // Dynamic import: src/browser/eventNarration.js does not exist until Task 2
  // lands (this test file is created in Task 1, before it does) — a bare
  // static import would fail the whole file to LOAD rather than reporting a
  // clean per-test failure. Awaiting the import inside the test body means
  // Task 1's RED state surfaces here as an ordinary failing assertion (module
  // not found), while the coverage test above still runs and lists the real
  // per-type gaps.
  const mod = await import("../../src/browser/eventNarration.js");
  const extra = Object.keys(mod.EVENT_NARRATION).filter((type) => !canonical.has(type));
  assert.deepStrictEqual(extra, [], `EVENT_NARRATION has dead/typo entries not emitted by the engine: ${extra.join(", ")}`);
});
