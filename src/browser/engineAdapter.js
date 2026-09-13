// src/browser/engineAdapter.js
//
// The walking skeleton's browser adapter (ENG-01, SKELETON.md "Browser
// render"). This is presentation/persistence GLUE, not engine code — it is
// the one place allowed to touch persistence (via src/browser/storage.js's
// shared abstraction, since 02-03 — see below) and to be imported as a
// browser `<script type="module">`. It holds the live engine `GameState`,
// drives it forward one `applyAction` call at a time, and translates the
// structured `events` applyAction returns into the same HTML narration
// strings the prototype's `logLine()` already knows how to render — so
// mazeworld.html's existing `paint()`/`draw()`/`logLine()` functions can
// keep doing the rendering, unmodified, from engine-shaped state.
//
// Per ARCHITECTURE.md's suggested build order, this is explicitly a
// TEMPORARY adapter: it maps a still-small vocabulary of event types to
// hand-written copy. A later phase's presentation rewrite
// (`presentation/render/log.ts`, per SKELETON.md) replaces it wholesale —
// this file's job is only to prove the seam works end-to-end and keep the
// dev loop playable while later plans extract the rest of the rules.

import { newRun, applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";
import { bury } from "../../engine/death.js";
// 04-04: the data-driven event->narration lookup table (UX-05) that replaces
// this file's former ~26-case monolithic switch. EVENT_NARRATION covers the
// full ~162-type engine vocabulary; test/unit/formatEventsCoverage.test.js
// derives that vocabulary from engine/*.js source at runtime and fails if
// any engine-emitted type has no entry, closing 04-RESEARCH.md's Pitfall 4
// (a silently-dropped combat/economy log line once those domains route
// through dispatch() — 04-07).
import { EVENT_NARRATION } from "./eventNarration.js";
// 02-03: the shared async Storage abstraction (window.mzStorage) — closes
// 02-RESEARCH.md's dual-write hazard (this adapter and mazeworld.html's
// classic script previously each hand-rolled their own raw localStorage
// reads/writes on the SAME three keys, independently). Both paths now
// converge on this one module's exported get/set/remove/migrate surface.
import * as storage from "./storage.js";

// Mirrors mazeworld.html's `const SAVE_KEY = "ddr.delve.v1";` (line
// ~488). Deliberately duplicated as a literal rather than imported — the
// classic <script> that owns SAVE_KEY is not a module and exports nothing;
// keeping the string in sync here is a documented, temporary coupling this
// adapter's replacement will resolve.
const SAVE_KEY = "ddr.delve.v1";

// The durable best-depth high score (RUN-05 / 03-CONTEXT.md "score = deepest
// floor reached"). Deliberately a SEPARATE storage key from SAVE_KEY, and
// deliberately NOT part of GameState — folding it into GameState would break
// the save round-trip/parity comparables this phase's difficulty work
// depends on staying stable. 02-03 routes this key through storage.js (SAV-04
// — durable Capacitor Preferences on native, localStorage in the dev loop).
const BEST_KEY = "ddr.best.v1";

// CR-01: matches mazeworld.html's own `const GRAVE_KEY = "ddr.graveyard.v1";`
// (mazeworld.html line ~2946) so both the classic combat/store code path
// (still un-ported, per 03-CONTEXT.md/03-REVIEW.md) and this engine-routed
// path accumulate tombstones into ONE persistent graveyard, both now via the
// SAME storage.js abstraction (02-03 dual-write convergence). Deliberately a
// SEPARATE storage key from SAVE_KEY/BEST_KEY, and deliberately NOT part of
// GameState — 03-CONTEXT.md locks the graveyard as adapter-side cross-run
// accumulation (SAV-05 — durable Capacitor Preferences, mirroring BEST_KEY).
const GRAVE_KEY = "ddr.graveyard.v1";

// audit-batch E12 (2026-09-09) — the graveyard rework's two new adapter-owned
// keys, both routed through the SAME storage.js abstraction as GRAVE_KEY and,
// like GRAVE_KEY, deliberately SEPARATE from SAVE_KEY/BEST_KEY and NOT part of
// GameState (cross-run accumulation, mirroring the graveyard).
//
//  - GRAVE_TOTAL_KEY: a running count of EVERY death ever, incremented on each
//    persistGrave() and NEVER trimmed (the graveyard array itself is capped at
//    GRAVE_CAP; this counter is the true lifetime total the Dead screen shows).
//  - RECENT_NAMES_KEY: the last RECENT_NAMES_CAP dead characters' names,
//    capped SEPARATELY from the 5-grave cap so names survive as graves trim.
//    Read on a fresh roll and passed as the name-dedup exclusion (part 4).
const GRAVE_TOTAL_KEY = "ddr.graveyard.total.v1";
const RECENT_NAMES_KEY = "ddr.graveyard.names.v1";

// Only the 5 most-recent tombstones are stored/shown (part 1); the running
// total (GRAVE_TOTAL_KEY) is what conveys the true body count. The recent-name
// dedup window is wider (part 4) so a name stays "recently used" long after its
// tombstone has aged out of the visible 5.
const GRAVE_CAP = 5;
const RECENT_NAMES_CAP = 25;

let currentState = null;

/** getState() — the adapter's current engine GameState (or null before boot). */
export function getState() {
  return currentState;
}

// CR-02 (02-REVIEW.md): storage.js's flush() can only await writes that have
// already reached its own writeQueues Map — a caller mid-way through a
// read-then-write sequence (persistGrave() below awaits storage.getItem()
// BEFORE its storage.setItem()) is invisible to flush() for the entire
// duration of that read. track()/waitForPending() close that gap: any
// fire-and-forget async operation this adapter starts that a lifecycle
// pause/background handler needs to survive gets added here, and
// nativeChrome.js's flushOnBackground() awaits waitForPending() ALONGSIDE
// storage.flush() so a backgrounding event can't resolve "successfully"
// while, e.g., a just-died player's tombstone write hasn't even started yet.
const pending = new Set();
function track(promise) {
  const settled = promise.catch(() => {}).finally(() => pending.delete(settled));
  pending.add(settled);
  return promise;
}

/**
 * waitForPending() — awaits every adapter-started operation currently
 * tracked via track() (see persistGrave()'s call site in dispatch() below).
 * Loops the same way storage.js#flush() does, so a NEW tracked operation
 * started while this is already awaiting (e.g. another death mid-drain) is
 * also caught rather than missed. Never throws (each tracked promise is
 * already wrapped to swallow its own rejection before being added here).
 */
export async function waitForPending() {
  let snapshot;
  do {
    snapshot = [...pending];
    await Promise.all(snapshot);
    // Each settled entry above already removed itself from `pending` (its
    // .finally() runs before the tracked/wrapped promise itself resolves) —
    // so anything still in `pending` now was added DURING this await and
    // needs its own pass.
  } while ([...pending].some((p) => !snapshot.includes(p)));
}

/**
 * initRun(seed, exclude) — starts a brand-new run from an integer seed,
 * replacing whatever state (if any) the adapter was holding. `exclude`
 * (audit-batch E12, part 4) is an optional recent-names list forwarded to
 * newRun → rollCharacter → nameFor for name dedup; it defaults to empty, so
 * every existing caller/test that calls initRun(seed) is unaffected and the
 * roll stays byte-identical.
 */
export function initRun(seed, exclude = []) {
  currentState = newRun(seed, exclude);
  return currentState;
}

/**
 * readRecentNames() — audit-batch E12 (part 4): the last RECENT_NAMES_CAP dead
 * characters' names from storage, for the fresh-roll name-dedup exclusion.
 * Fail-open to [] (private window, blocked storage, corrupt JSON, non-array) —
 * a missing/broken list just means no dedup this roll, never a throw, mirroring
 * getBest()'s fail-open-to-zero posture.
 */
async function readRecentNames() {
  try {
    const raw = await storage.getItem(RECENT_NAMES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * getBest() — the best (deepest) floor.depth reached across runs, per
 * 03-CONTEXT.md's "score = deepest floor reached" (descent is one-way, so
 * floor.depth at any point in a run IS the deepest floor reached so far).
 * Resolves 0 if nothing is stored, the stored value is not a finite number,
 * or storage is blocked (private window, quota) — never throws/rejects
 * (matches boot()/persist()'s fail-open-to-zero posture; T-03-06 accepts a
 * self-tampered value since this is single-player with no leaderboard).
 * Async: 02-03 routes this through storage.js's shared abstraction rather
 * than raw localStorage.
 */
export async function getBest() {
  try {
    const raw = await storage.getItem(BEST_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * recordBest(depth) — module-internal: writes max(stored best, depth) back
 * to BEST_KEY. Never throws (private window/quota just means the new best
 * won't persist, matching persist()'s own posture). Reads-then-writes, so it
 * is awaited by its only caller (startNewRun) rather than fired-and-forgotten
 * — storage.js's getItem() is deliberately NOT queued behind in-flight writes
 * (see storage.js's own doc comment), so a caller needing read-after-write
 * ordering must sequence it itself; startNewRun() is not the rapid-fire
 * per-action hot path dispatch() is, so awaiting here is cheap and correct.
 */
async function recordBest(depth) {
  try {
    const prev = await getBest();
    const next = Math.max(prev, Number.isFinite(depth) ? depth : 0);
    await storage.setItem(BEST_KEY, String(next));
  } catch {
    /* private window, blocked storage — the new best just won't persist */
  }
}

/**
 * persistGrave(state, cause) — CR-01: builds this death's tombstone via
 * engine/death.js#bury() (which already has state.deathNote/state.epitaph
 * set by die()) and appends it to the adapter-owned graveyard at GRAVE_KEY.
 * Mirrors recordBest()'s try/catch-and-swallow posture: a private window or
 * a full storage quota just means the tombstone won't persist, matching
 * persist()/recordBest()'s own fail-safe contract — never throws.
 *
 * `cause` is read from the `died` event dispatch() just pushed (see below)
 * rather than from `state` itself, because GameState has no persisted
 * `cause` field (only `deathNote`/`epitaph`, already derived from it by
 * die()) — the event is the only place the raw cause string is still
 * available by the time dispatch() returns.
 */
async function persistGrave(state, cause) {
  try {
    // Read all three graveyard keys up front. getItem() is NOT queued behind
    // in-flight writes (storage.js contract), so a caller needing read-after-
    // write ordering across deaths flushes between them (see the adapter test);
    // reading them together here keeps the subsequent writes contiguous.
    const [rawGraves, rawTotal, rawRecent] = await Promise.all([
      storage.getItem(GRAVE_KEY),
      storage.getItem(GRAVE_TOTAL_KEY),
      storage.getItem(RECENT_NAMES_KEY),
    ]);

    // Part 1 — append the tombstone, then TRIM to the most-recent GRAVE_CAP.
    // bury() unshifts newest-first (and caps at 60); slice(0, GRAVE_CAP) keeps
    // the newest 5 that remain shown/stored.
    let prevGraves = rawGraves ? JSON.parse(rawGraves) : [];
    if (!Array.isArray(prevGraves)) prevGraves = [];
    const graves = bury(state, cause, null, prevGraves).slice(0, GRAVE_CAP);

    // Part 2 — the never-trimmed running total of ALL dead. Migration-safe: a
    // pre-E12 player has graves but no total key yet, so seed the base from the
    // existing grave count rather than 0 (Number(null) is a finite 0, so the
    // null check is required to tell "missing key" from a real stored "0").
    const parsedTotal = Number(rawTotal);
    const prevTotal =
      rawTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : prevGraves.length;
    const total = prevTotal + 1;

    // Part 4 — the wider recent-names dedup window, capped SEPARATELY from the
    // 5-grave cap so a name stays excluded long after its tombstone trims away.
    let recent = rawRecent ? JSON.parse(rawRecent) : [];
    if (!Array.isArray(recent)) recent = [];
    const name = state.c && state.c.name;
    if (name) recent = [name, ...recent].slice(0, RECENT_NAMES_CAP);

    // Enqueue all three writes back-to-back (no await between them) so a single
    // flush()/waitForPending() drain settles the whole tombstone atomically.
    await Promise.all([
      storage.setItem(GRAVE_KEY, JSON.stringify(graves)),
      storage.setItem(GRAVE_TOTAL_KEY, String(total)),
      storage.setItem(RECENT_NAMES_KEY, JSON.stringify(recent)),
    ]);
  } catch {
    /* private window, blocked storage — the tombstone just won't persist */
  }
}

/**
 * startNewRun(seed) — the one-tap new-run entry point (RUN-05; 03-RESEARCH.md
 * "one-tap new run" Option A: the adapter calls the engine's newRun(seed)
 * factory directly, no new engine action type required). If a run is already
 * live, its ending floor.depth is recorded as a candidate best-depth BEFORE
 * it's replaced (descent is one-way, so the ending floor.depth is that run's
 * score). `seed` is guarded to an integer with a Date.now() fallback so a
 * malformed/adversarial seed can never reach newRun() unchecked (Security
 * Domain V5; threat T-03-05) — mirrors the seed-recovery guard dispatch()
 * already uses on its fail-closed path.
 */
export async function startNewRun(seed) {
  if (currentState) {
    await recordBest(currentState.floor.depth);
  }
  const safeSeed = Number.isInteger(seed) ? seed : Date.now();
  // audit-batch E12 (part 4): thread the recent-names dedup window into the
  // fresh roll so a new adventurer avoids reusing the last ~25 dead names.
  const exclude = await readRecentNames();
  const state = initRun(safeSeed, exclude);
  persist();
  return state;
}

/**
 * boot(freshSeed) — the adapter's load-on-page-open entry point (threat
 * T-01-07a). Runs the one-time legacy-key migration (storage.js's
 * migrateLegacyKeys, idempotent — safe to call on every boot), then reads the
 * active-run save through the shared storage abstraction and validates it via
 * engine/saveState.js's fail-closed `validateSave`; a missing, corrupt, or
 * tampered save (or a storage exception) falls back to a brand-new run seeded
 * with `freshSeed` — it never throws. Async: 02-03 routes this through
 * storage.js rather than raw localStorage.
 */
export async function boot(freshSeed) {
  await storage.migrateLegacyKeys();
  let raw = null;
  try {
    raw = await storage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    const check = validateSave(raw, { freshSeed });
    if (check.ok) {
      currentState = rehydrate(check.value);
      return currentState;
    }
  }
  // No valid save → a brand-new run. audit-batch E12 (part 4): apply the same
  // recent-names dedup the one-tap startNewRun() path uses, so a first roll
  // after a death (or a cold boot with no active save) also avoids reusing the
  // last ~25 dead names. The rehydrate path above never rolls a character, so
  // it needs no exclusion.
  const exclude = await readRecentNames();
  return initRun(freshSeed, exclude);
}

/** persist() — best-effort save of the current state, routed through the
 * shared storage abstraction. Deliberately fire-and-enqueue (NOT awaited by
 * its callers): dispatch() renders synchronously from the state it already
 * has, and storage.js's per-key write queue guarantees a rapid burst of
 * same-key writes settles in order with the last write winning (SAV-01) —
 * blocking the render path on every write's round-trip would only add
 * latency without improving correctness. storage.setItem() itself never
 * throws/rejects (storage.js's own fail-safe contract), so there is nothing
 * to catch here. */
function persist() {
  if (!currentState) return;
  storage.setItem(SAVE_KEY, JSON.stringify(serializeRun(currentState)));
}

/**
 * dispatch(action) — the adapter's core seam: runs `action` through
 * engine/engine.js's `applyAction`, swaps in the resulting state, persists
 * it, and pre-formats its events into the HTML lines `logLine()` expects.
 * Returns `{ state, events, html }` so a caller can render from `state`,
 * inspect the structured `events`, or just push `html` straight to the log.
 */
export function dispatch(action) {
  if (!currentState) {
    throw new Error("engineAdapter.dispatch: call boot()/initRun() before dispatch()");
  }
  try {
    const { state, events } = applyAction(currentState, action);
    currentState = state;
    persist();
    // 03-REVIEW.md CR-01: every engine-routed death (combat, starve,
    // fall/gorge, trap, poison, self-inflicted "maze"/"insanity" deaths, ...)
    // pushes a `died` event via engine/death.js#die() regardless of which
    // rule module called it — this is the ONE choke point that catches all
    // of them, so bury() runs here rather than only from startNewRun()
    // (which would miss a death the player never returns to start a new run
    // from, and has no access to the raw `cause` string once dispatch()
    // returns — see persistGrave()'s doc comment).
    const diedEvent = events.find((e) => e.type === "died");
    // persistGrave() is async (storage.js-routed) but deliberately not
    // awaited here — same fire-and-enqueue posture as persist() above;
    // storage.js's per-key write queue still orders it correctly, and
    // persistGrave()'s own try/catch means this can never become an
    // unhandled rejection. CR-02: it IS wrapped in track() so
    // waitForPending() (awaited by nativeChrome.js's flushOnBackground
    // alongside storage.flush()) can still catch this write even while it's
    // still in its pre-setItem() getItem() read phase — storage.js's own
    // flush() has no visibility into an operation that hasn't reached
    // storage.setItem() yet.
    if (diedEvent) track(persistGrave(currentState, diedEvent.cause));
    return { state: currentState, events, html: formatEvents(events) };
  } catch (err) {
    // Defense in depth (CR-01): engine/saveState.js#validateSave already
    // rejects a structurally-malformed save before it ever reaches here, but
    // if a future bug or schema change still lets a bad state slip through
    // and a rule module throws, fail closed to a fresh run rather than let
    // the uncaught exception crash the page — the same fail-closed contract
    // boot() already guarantees for a corrupt save.
    const seed = typeof currentState.seed === "number" ? currentState.seed : Date.now();
    currentState = initRun(seed);
    persist();
    return { state: currentState, events: [], html: [] };
  }
}

/**
 * formatEvents(events) — maps a structured `events` array to the prototype's
 * span-class HTML narration copy. Delegates to EVENT_NARRATION
 * (eventNarration.js), a data-driven type->builder table covering the
 * engine's full event vocabulary (04-04, UX-05). Unrecognized event types
 * are still silently dropped rather than crashing the render loop (01-
 * RESEARCH.md Open Question 1) — but test/unit/formatEventsCoverage.test.js
 * enforces that no ENGINE-EMITTED type can ever hit that fallback, so the
 * only types that legitimately reach it are genuinely new/unknown ones a
 * later engine change hasn't been narrated for yet.
 */
export function formatEvents(events) {
  return events.map(formatEvent).filter((html) => html !== null);
}

// A plain step is deliberately silent — no narration line of its own — by
// design (not an omission the coverage guard should flag). See
// eventNarration.js's header comment and
// test/unit/formatEventsCoverage.test.js's exclusion note for the full
// rationale; test/unit/engineAdapter.test.js locks this behavior with an
// explicit assertion.
const NO_NARRATION_TYPES = new Set(["moved"]);

function formatEvent(e) {
  if (NO_NARRATION_TYPES.has(e.type)) return null;
  const build = EVENT_NARRATION[e.type];
  if (!build) return null;
  const html = build(e);
  return html || null;
}
