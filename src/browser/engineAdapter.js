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
import { bury, buildRunSummary } from "../../engine/death.js";
// Phase 65 (RUN-02/RUN-03): the pure bests-record operations — this adapter
// owns the durable ddr.bests.v1 storage, engine/records.js owns the shape.
import { emptyBests, sanitizeBests, updateBests, backfillBests } from "../../engine/records.js";
// 04-04: the data-driven event->narration lookup table (UX-05) that replaces
// this file's former ~26-case monolithic switch. EVENT_NARRATION covers the
// full ~162-type engine vocabulary; test/unit/formatEventsCoverage.test.js
// derives that vocabulary from engine/*.js source at runtime and fails if
// any engine-emitted type has no entry, closing 04-RESEARCH.md's Pitfall 4
// (a silently-dropped combat/economy log line once those domains route
// through dispatch() — 04-07).
import { EVENT_NARRATION } from "./eventNarration.js";
// Phase 25 (FEED-05): the fledgling-miss quip corpus + its pure decorator.
// dispatch() below is the ONE site that stamps a quip onto a strikeMissed
// event, so the Oracle line and the narration line share the same quip.
import { decorateMisses } from "./missLines.js";
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

// ddr.best.v1 is retired in Phase 65 (RUN-02/RUN-03, D-09, greenfield
// ruling): the single best-depth key is never written or read here anymore —
// a bare floor number carries no run details to render a row from. Any value
// already on a device's disk stays there untouched (storage.js's LEGACY_KEYS
// migration still copies it unchanged; nothing here ever reads it back).

// CR-01: matches mazeworld.html's own `const GRAVE_KEY = "ddr.graveyard.v1";`
// (mazeworld.html line ~2946) so both the classic combat/store code path
// (still un-ported, per 03-CONTEXT.md/03-REVIEW.md) and this engine-routed
// path accumulate tombstones into ONE persistent graveyard, both now via the
// SAME storage.js abstraction (02-03 dual-write convergence). Deliberately a
// SEPARATE storage key from SAVE_KEY, and deliberately NOT part of
// GameState — 03-CONTEXT.md locks the graveyard as adapter-side cross-run
// accumulation (SAV-05 — durable Capacitor Preferences).
const GRAVE_KEY = "ddr.graveyard.v1";

// audit-batch E12 (2026-09-09) — the graveyard rework's two new adapter-owned
// keys, both routed through the SAME storage.js abstraction as GRAVE_KEY and,
// like GRAVE_KEY, deliberately SEPARATE from SAVE_KEY and NOT part of
// GameState (cross-run accumulation, mirroring the graveyard).
//
//  - GRAVE_TOTAL_KEY: a running count of EVERY death ever, incremented on each
//    persistGrave() and NEVER trimmed (the graveyard array itself is capped at
//    GRAVE_CAP; this counter is the true lifetime total the Dead screen shows).
//  - RECENT_NAMES_KEY: the last RECENT_NAMES_CAP dead characters' names,
//    capped SEPARATELY from the grave cap so names survive as graves trim.
//    Read on a fresh roll and passed as the name-dedup exclusion (part 4).
const GRAVE_TOTAL_KEY = "ddr.graveyard.total.v1";
const RECENT_NAMES_KEY = "ddr.graveyard.names.v1";

// Phase 65 (CONTEXT, RUN-02) deliberately reverses audit-batch E12 part 1.
// The mock's GRAVEYARD board lists everyone you have rolled and lost,
// deepest first, so the adapter stores up to 60 stones, matching
// engine/death.js#bury's own cap. The running total (GRAVE_TOTAL_KEY) still
// conveys the true all-time body count. The recent-name dedup window is
// wider (part 4) so a name stays "recently used" long after its tombstone
// has aged out of the visible 60.
const GRAVE_CAP = 60;
const RECENT_NAMES_CAP = 25;

// Phase 65 (RUN-02): the all-time, season-tagged personal-bests record.
// Adapter-owned cross-run data, never GameState — mirrors GRAVE_KEY's own
// posture. Routed through the SAME storage.js abstraction.
const BESTS_KEY = "ddr.bests.v1";

let currentState = null;

// Phase 37 (GEAR-04): the one-shot boot-time worn-reconciliation report
// (engine/saveState.js#validateSave's `wornReport`, when boot()'s load
// migrated a legacy save). Adapter-side, module-level, NEVER serialized —
// mirrors missSeq's posture immediately below. Cleared to null the moment
// takeBootWornReport() reads it, so Plan 04's resume path (the rail card +
// Oracle line) can only ever surface it once per boot, exactly like a
// one-shot rail card. null when boot() did not migrate at all (no save, a
// corrupt save, or a save that already carried worn); [] when it migrated
// but nothing was wearable.
let bootWornReport = null;

// Phase 25 (FEED-05): the presentation-side rotation counter for the
// fledgling-miss quip corpus (missLines.js#decorateMisses). Deliberately a
// plain module-level integer, NOT serialized into GameState and NOT part of
// state.rngState — it resets to 0 on every page reload by design (the quip
// sequence is flavor, not a game rule) and is never advanced by, or fed
// into, the engine's own seeded rng.
let missSeq = 0;

// Phase 65 (RUN-02/RUN-04): the in-memory personal-bests record, and the
// one-shot death report the death panel reads via takeDeathRecord(). Both
// adapter-side module state, NEVER serialized into GameState. `bests` is
// null until loadBests() has run at least once this session (loadBests()
// never rejects, so this stays null only before the first call);
// `deathRecord` is null until a death folds into a loaded record, and is
// cleared to null the moment takeDeathRecord() reads it, or a new run
// starts — a second call/a new run always sees null, exactly like
// bootWornReport's one-shot posture above.
let bests = null;
let deathRecord = null;

/** getState() — the adapter's current engine GameState (or null before boot). */
export function getState() {
  return currentState;
}

/**
 * loadBests() — Phase 65 (RUN-02, RUN-03): loads the durable ddr.bests.v1
 * record into memory, backfilling from the legacy graveyard when absent or
 * unparseable. Never rejects: any failure resolves to a fresh emptyBests().
 * Idempotent to call more than once (each call re-reads storage); boot()
 * calls this once, right after migrateLegacyKeys(), so the record is in
 * memory before boot() resolves and the death panel can read it
 * synchronously the first time a death happens.
 */
export async function loadBests() {
  try {
    const raw = await storage.getItem(BESTS_KEY);
    if (typeof raw === "string") {
      try {
        bests = sanitizeBests(JSON.parse(raw));
        return bests;
      } catch {
        /* corrupt JSON — fall through to the graveyard backfill below */
      }
    }
    // Absent, or a parse failure: backfill from the legacy graveyard. A
    // corrupt/non-array grave list backfills to an empty record
    // (backfillBests' own contract), never throws.
    const rawGraves = await storage.getItem(GRAVE_KEY);
    let graves = [];
    try {
      graves = rawGraves ? JSON.parse(rawGraves) : [];
    } catch {
      graves = [];
    }
    if (!Array.isArray(graves)) graves = [];
    bests = backfillBests(graves);
    // Fire-and-enqueue, like persist(): the backfilled record is already in
    // memory and returned below regardless of whether this write lands.
    track(storage.setItem(BESTS_KEY, JSON.stringify(bests)));
    return bests;
  } catch {
    bests = emptyBests();
    return bests;
  }
}

/**
 * getBests() — the adapter's current in-memory BestsRecord, or null before
 * the first loadBests()/boot() call this session. Callers treat the
 * returned record as read-only.
 */
export function getBests() {
  return bests;
}

/**
 * takeDeathRecord() — Phase 65 (RUN-04): returns the most recent death's
 * `{ first, newBests, summary }` report exactly once, then resets it to
 * null (consumed on read) — mirrors takeBootWornReport()'s one-shot
 * posture. `null` before any death this session, after a second call for
 * the same death, after a dev run's death (which never enters the bests
 * record), and once initRun()/startNewRun() starts a new run.
 */
export function takeDeathRecord() {
  const report = deathRecord;
  deathRecord = null;
  return report;
}

/**
 * takeBootWornReport() — Phase 37 (GEAR-04): returns the boot-time worn-
 * reconciliation report exactly once, then resets it to null (consumed on
 * read, exactly like a one-shot rail card) — a second call in the same boot
 * always returns null. `null` when boot() did not migrate anything this
 * boot (no save, a corrupt save that fell back to a fresh run, or a save
 * that already carried its own `worn` key); `[]` when it migrated but
 * nothing was wearable; an array of `{ slot, worn, bagged }` entries when at
 * least one slot was reconciled. Plan 04's resume path is the sole intended
 * caller — it surfaces this as a rail card + Oracle line ONLY when at least
 * one entry has a non-empty `bagged` array.
 */
export function takeBootWornReport() {
  const report = bootWornReport;
  bootWornReport = null;
  return report;
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
 * initRun(seed, exclude, options) — starts a brand-new run from an integer
 * seed, replacing whatever state (if any) the adapter was holding. `exclude`
 * (audit-batch E12, part 4) is an optional recent-names list forwarded to
 * newRun → rollCharacter → nameFor for name dedup; it defaults to empty, so
 * every existing caller/test that calls initRun(seed) is unaffected and the
 * roll stays byte-identical. `options` (Phase 21, TUNE-04, D-13) is forwarded
 * straight through to newRun — `options.startDepth` is the dev-only
 * start-at-depth field; every existing caller omits it, so their rolls stay
 * byte-identical.
 */
export function initRun(seed, exclude = [], options = {}) {
  // Phase 65 (RUN-04): a new run clears any pending one-shot death report —
  // takeDeathRecord() must never hand a later run's caller a stale report
  // from the run this one just replaced.
  deathRecord = null;
  currentState = newRun(seed, exclude, options);
  return currentState;
}

/**
 * readRecentNames() — audit-batch E12 (part 4): the last RECENT_NAMES_CAP dead
 * characters' names from storage, for the fresh-roll name-dedup exclusion.
 * Fail-open to [] (private window, blocked storage, corrupt JSON, non-array) —
 * a missing/broken list just means no dedup this roll, never a throw, matching
 * every other read in this file's fail-safe posture.
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
 * recordDeath(state, cause, when) — Phase 65 (RUN-02/RUN-04): the
 * synchronous in-memory fold of one death into the personal-bests record.
 * Synchronous and never throws, so a failure here can never reach
 * dispatch()'s fail-closed catch and replace the dead run with a fresh one
 * — the death panel and the graveyard write must both survive a bug in this
 * path. Builds the SAME summary (via engine/death.js#buildRunSummary) that
 * persistGrave()'s bury() call below also builds — same `state`/`cause`/
 * `when` in, same hash out. Returns `{ summary, bestsJson }`: `bestsJson`
 * is the record already JSON.stringify'd (ready for persistGrave() to
 * enqueue, so dispatch() never awaits an extra read there), or null if
 * `bests` has not been loaded yet this session (persistGrave()'s lazy path
 * handles that).
 */
function recordDeath(state, cause, when) {
  try {
    const summary = buildRunSummary(state, cause, when);
    if (bests !== null) {
      const r = updateBests(bests, summary);
      bests = r.record;
      deathRecord = { first: r.first, newBests: r.newBests, summary };
      return { summary, bestsJson: JSON.stringify(bests) };
    }
    deathRecord = null;
    return { summary, bestsJson: null };
  } catch {
    deathRecord = null;
    return { summary: null, bestsJson: null };
  }
}

/**
 * persistGrave(state, cause, when, summary, bestsJson) — CR-01: builds this
 * death's tombstone via engine/death.js#bury() (which already has
 * state.deathNote/state.epitaph set by die()) and appends it to the
 * adapter-owned graveyard at GRAVE_KEY, alongside the never-trimmed total
 * (GRAVE_TOTAL_KEY), the recent-names dedup window (RECENT_NAMES_KEY) and
 * — Phase 65 (RUN-02) — the personal-bests record (BESTS_KEY). Try/catch-
 * and-swallow, like every other write in this file: a private window or a
 * full storage quota just means the tombstone (and/or the bests record)
 * won't persist — never throws.
 *
 * `cause` is read from the `died` event dispatch() just pushed (see below)
 * rather than from `state` itself, because GameState has no persisted
 * `cause` field (only `deathNote`/`epitaph`, already derived from it by
 * die()) — the event is the only place the raw cause string is still
 * available by the time dispatch() returns. `when`/`summary`/`bestsJson`
 * come from recordDeath()'s synchronous fold, called BEFORE this function
 * (so the death panel can read getBests()/takeDeathRecord() the instant
 * dispatch() returns, without waiting on this async write).
 */
async function persistGrave(state, cause, when, summary, bestsJson) {
  try {
    // Lazy path: recordDeath() ran before bests was ever loaded this
    // session (a death raced ahead of boot()'s loadBests(), or something
    // called dispatch() without going through boot() first). Load (or
    // backfill) the record now and fold this run in — never overwrite a
    // stored record with a fresh empty one.
    if (summary && bestsJson === null) {
      await loadBests();
      const r = updateBests(bests, summary);
      bests = r.record;
      bestsJson = JSON.stringify(bests);
    }

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
    // the newest 60 that remain shown/stored (Phase 65, RUN-02, D-05). The
    // SAME `when` recordDeath() already built the bests summary from, so the
    // stored stone and the bests record's entry for this run share one hash.
    let prevGraves = rawGraves ? JSON.parse(rawGraves) : [];
    if (!Array.isArray(prevGraves)) prevGraves = [];
    const graves = bury(state, cause, null, prevGraves, () => when).slice(0, GRAVE_CAP);

    // Part 2 — the never-trimmed running total of ALL dead. Migration-safe: a
    // pre-E12 player has graves but no total key yet, so seed the base from the
    // existing grave count rather than 0 (Number(null) is a finite 0, so the
    // null check is required to tell "missing key" from a real stored "0").
    const parsedTotal = Number(rawTotal);
    const prevTotal =
      rawTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : prevGraves.length;
    const total = prevTotal + 1;

    // Part 4 — the wider recent-names dedup window, capped SEPARATELY from the
    // grave cap so a name stays excluded long after its tombstone trims away.
    let recent = rawRecent ? JSON.parse(rawRecent) : [];
    if (!Array.isArray(recent)) recent = [];
    const name = state.c && state.c.name;
    if (name) recent = [name, ...recent].slice(0, RECENT_NAMES_CAP);

    // Enqueue all writes back-to-back (no await between them) so a single
    // flush()/waitForPending() drain settles the whole tombstone (and the
    // bests record, when present) atomically.
    const writes = [
      storage.setItem(GRAVE_KEY, JSON.stringify(graves)),
      storage.setItem(GRAVE_TOTAL_KEY, String(total)),
      storage.setItem(RECENT_NAMES_KEY, JSON.stringify(recent)),
    ];
    if (bestsJson !== null) writes.push(storage.setItem(BESTS_KEY, bestsJson));
    await Promise.all(writes);
  } catch {
    /* private window, blocked storage — the tombstone just won't persist */
  }
}

/**
 * startNewRun(seed, options) — the one-tap new-run entry point (RUN-05;
 * 03-RESEARCH.md "one-tap new run" Option A: the adapter calls the engine's
 * newRun(seed) factory directly, no new engine action type required).
 * `seed` is guarded to an integer with a Date.now() fallback so a malformed/adversarial seed
 * can never reach newRun() unchecked (Security Domain V5; threat T-03-05) —
 * mirrors the seed-recovery guard dispatch() already uses on its fail-closed
 * path. `options.startDepth` (Phase 21, TUNE-04, D-13) is the dev-only
 * start-at-depth field, threaded through to newRun via initRun; a
 * non-integer or sub-1 value is ignored here (Security V5 — a second,
 * adapter-side clamp before the engine's own DEV_START_DEPTH_MAX/
 * difficultyCurve sanitisation).
 *
 * Phase 33 (STORE-01) — every run the player starts from here (including a
 * dev start-at-depth run, which is exactly how the deep-tier stock gets
 * checked on device) carries state.storeRoll: true; boot()'s throwaway
 * pre-title fresh run and dispatch()'s fail-closed recovery run
 * deliberately do NOT pass it (flag-off = the parity-identical store), and
 * tools/ bots call newRun(seed) directly so the mass-playtest ledgers are
 * unchanged by this phase.
 */
export async function startNewRun(seed, options = {}) {
  const safeSeed = Number.isInteger(seed) ? seed : Date.now();
  // audit-batch E12 (part 4): thread the recent-names dedup window into the
  // fresh roll so a new adventurer avoids reusing the last ~25 dead names.
  const exclude = await readRecentNames();
  const startDepth = Number.isInteger(options.startDepth) && options.startDepth >= 1 ? options.startDepth : 1;
  const state = initRun(safeSeed, exclude, { startDepth, storeRoll: true });
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
 *
 * Phase 45 (HEDGE-02) — this IS the shell's real load path; every valid
 * save is reconciled by `validateSave` (unconditional since Phase 45) and
 * its `wornReport` — `[]` when nothing moved, including an already-migrated
 * save — is stashed for `takeBootWornReport()`; the rail card filters on
 * `bagged.length`, so an empty report shows nothing. The fresh-run fallback
 * below leaves it `null`.
 */
export async function boot(freshSeed) {
  await storage.migrateLegacyKeys();
  // Phase 65 (RUN-02/RUN-03): the personal-bests record is loaded (or
  // backfilled from the just-migrated graveyard) before boot() resolves, so
  // the death panel can read a synchronous "new best?" answer the very
  // first time a death happens this session.
  await loadBests();
  let raw = null;
  try {
    raw = await storage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    const check = validateSave(raw, { freshSeed });
    if (check.ok) {
      bootWornReport = check.wornReport;
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
 *
 * Phase 25 (FEED-05): the returned `events` (and therefore `html`) have
 * already been passed through missLines.js#decorateMisses — a strikeMissed
 * event may carry a presentation-only `quip` field the engine itself never
 * sets, present only while the hero's level is <= QUIP_MAX_LEVEL.
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
    // Phase 21 (TUNE-04, D-13) — a dev start-at-depth run is a testing run;
    // its death must not enter the graveyard, the all-time total, the
    // recent-names window, or (Phase 65) the personal-bests record.
    if (diedEvent) {
      if (currentState.dev) {
        deathRecord = null;
      } else {
        // Phase 65 (RUN-02/RUN-04): fold the death into the in-memory bests
        // record SYNCHRONOUSLY (recordDeath, not awaited) so getBests()/
        // takeDeathRecord() already reflect it the instant dispatch()
        // returns — the death panel never waits on the storage write below.
        const when = typeof currentState.deathAt === "number" ? currentState.deathAt : Date.now();
        const { summary, bestsJson } = recordDeath(currentState, diedEvent.cause, when);
        track(persistGrave(currentState, diedEvent.cause, when, summary, bestsJson));
      }
    }
    // Phase 25 (FEED-05): stamp the rotating fledgling-miss quip onto any
    // strikeMissed event, gated on the hero's post-action level, BEFORE
    // formatting the Oracle html — so the Oracle line and the narration line
    // (25-03/25-04) read the exact same quip from this one assignment site.
    const { events: decorated, seq: nextMissSeq } = decorateMisses(events, currentState.c?.level ?? 1, missSeq);
    missSeq = nextMissSeq;
    return { state: currentState, events: decorated, html: formatEvents(decorated) };
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
