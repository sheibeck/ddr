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
import { validateSave, rehydrate, serializeRun, resumeEventsFor } from "../../engine/saveState.js";
import { bury, buildRunSummary } from "../../engine/death.js";
// Phase 78 (78-05): the charge count for stampBookRefill's refill line
// (eventNarration.js never imports engine/, so the adapter hands it in).
import { maxCharges } from "../../engine/movement.js";
// Phase 65 (RUN-02/RUN-03): the pure bests-record operations — this adapter
// owns the durable ddr.bests.v1 storage, engine/records.js owns the shape.
import { emptyBests, sanitizeBests, updateBests, backfillBests, reconcileBests } from "../../engine/records.js";
// Phase 84 (BOARD-26): YOUR DEAD's own durable per-run history (ddr.runs.v1),
// separate from the 60-stone graveyard and the bests-only board record —
// see src/browser/runHistory.js's header comment for the full picture.
import {
  RUN_HISTORY_KEY,
  historyRecordOf,
  sanitizeHistory,
  appendRun,
  mergeHistories,
  importLegacy,
  newBestsAgainst,
  serializeHistory,
} from "./runHistory.js";
// 04-04: the data-driven event->narration lookup table (UX-05) that replaces
// this file's former ~26-case monolithic switch. EVENT_NARRATION covers the
// full ~162-type engine vocabulary; test/unit/formatEventsCoverage.test.js
// derives that vocabulary from engine/*.js source at runtime and fails if
// any engine-emitted type has no entry, closing 04-RESEARCH.md's Pitfall 4
// (a silently-dropped combat/economy log line once those domains route
// through dispatch() — 04-07).
import { EVENT_NARRATION, stampScrollCopyNotes, stampBookRefill } from "./eventNarration.js";
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
// Phase 99 (TRACK-02..05): the lifetime achievements record and its pure
// tracker. This adapter owns the durable ddr.achievements.v1 storage and the
// hooks; the two modules own the shape and the rules (no DOM, no storage).
import { ACHIEVEMENTS_KEY, parseRecord, serializeRecord } from "./achievementRecord.js";
import { beginRun, foldAction } from "./achievementTracker.js";

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

// SAV-06/SAV-07 (Phase 76): the one-shot boot-time resume events
// (engine/saveState.js#resumeEventsFor, computed once when boot() rehydrates
// a save). Adapter-side, module-level, NEVER serialized, the same posture as
// bootWornReport above. Cleared to null the moment takeBootResumeEvents()
// reads it, and by initRun(), so the shell narrates a resumed fight or
// store at most once per boot. null when boot() rehydrated nothing (no
// save, or a corrupt save that fell back to a fresh run); [] for a quiet
// save.
let bootResumeEvents = null;

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

// Phase 84 (BOARD-26): the in-memory per-run history (src/browser/
// runHistory.js), and the app version stamp every non-dev death's history
// record carries. `runHistory` is null until loadRunHistory() has run at
// least once this session (boot() calls it once, right after
// loadGraveyard()); `appVersion` defaults to "dev" until the shell calls
// setAppVersion() with the stamped #mw-app-version text, so a Node test or
// a dev-loop session with no shell wiring still produces a valid record.
let runHistory = null;
let appVersion = "dev";
const APP_VERSION_MAX_CHARS = 64; // matches src/browser/runDoc.js's VERSION_MAX_CHARS bound

// Phase 66 (BOARD-02, D-08/D-15): the in-memory { graves, total } the
// Leaderboards panel and the title's VIEW THE DEAD gate read; adapter-owned
// cross-run data, never GameState (mirrors `bests`'s posture above). Null
// until loadGraveyard() runs. Replaced (never mutated) on every change so an
// earlier reference stays a stable snapshot.
let graveyard = null;

// Phase 68 / Phase 85: the one run-recorded listener; the shell hands each
// non-dev death to boardSync. dispatch()'s non-dev death branch hands it a
// frozen copy of the run summary exactly once per death. Dev start-at-depth
// deaths never reach it, and a listener failure (sync throw or async
// rejection) is swallowed so it can never reach dispatch()'s fail-closed
// catch or touch the tombstone/bests writes.
let runRecordedListener = null;

/**
 * setRunRecordedListener(fn) — Phase 68 / Phase 85: the one run-recorded
 * listener; the shell hands each non-dev death to boardSync. Registers the
 * one run-recorded listener (replacing any earlier one). A non-function
 * (e.g. null) unregisters it.
 */
export function setRunRecordedListener(fn) {
  runRecordedListener = typeof fn === "function" ? fn : null;
}

function notifyRunRecorded(summary) {
  if (!runRecordedListener || !summary) return;
  try {
    const result = runRecordedListener(Object.freeze({ ...summary }));
    if (result && typeof result.then === "function") {
      Promise.resolve(result).catch(() => {});
    }
  } catch {
    // swallowed: a listener bug must never change the death flow
  }
}

// Phase 99 (TRACK-02..05): the lifetime achievements record. Adapter-owned
// cross-run data like `bests` and `graveyard`, NEVER part of GameState, and
// stored under its own key (ACHIEVEMENTS_KEY, ddr.achievements.v1), apart from
// the run save. `achievementRecord` is null until the first load; the record
// is deep-frozen and replaced (never mutated) on every change.
// `achievementQueue` holds ops (a run start or a dispatched action) that
// arrived before the record loaded, or while a reload is in flight; they fold
// into the stored record in order, so a lazy dispatch can never overwrite what
// is on disk. `achievementLoad` is the in-flight load promise, or null.
// `achievementListener` mirrors runRecordedListener: Phase 100 (the unlock
// banner and the list) and Phase 101 (the Play mirror) register it. Dev runs
// and the tuning bot never reach any of this: dispatch() and startNewRun()
// queue nothing for a dev state, and tools/ never imports this file.
let achievementRecord = null;
let achievementListener = null;
let achievementLoad = null;
const achievementQueue = [];

/**
 * setAchievementListener(fn) — Phase 99: the one achievements listener. It is
 * handed each action's frozen { unlocks, reveals, progress } once, for every
 * action that produced any of them. Replaces any earlier listener; a
 * non-function (e.g. null) unregisters it. With no listener the record still
 * updates and is still saved.
 */
export function setAchievementListener(fn) {
  achievementListener = typeof fn === "function" ? fn : null;
}

/**
 * getAchievementRecord() — Phase 99: the current lifetime record (deep-frozen,
 * replaced on every change), or null before the first loadAchievements().
 */
export function getAchievementRecord() {
  return achievementRecord;
}

function notifyAchievements(result) {
  if (!achievementListener || !result) return;
  const { unlocks, reveals, progress } = result;
  if (!unlocks.length && !reveals.length && !progress.length) return;
  try {
    const out = achievementListener(Object.freeze({ unlocks, reveals, progress }));
    if (out && typeof out.then === "function") {
      Promise.resolve(out).catch(() => {});
    }
  } catch {
    // swallowed: a listener bug must never change a run
  }
}

// One op through the tracker, inside its own try/catch: a tracker or storage
// failure can never reach dispatch()'s fail-closed catch (which would replace
// the run) or stop the death recording. A changed record is written once, in
// the same write that carries any unlock it earned, enqueued synchronously so
// storage.flush() sees it.
function applyAchievementOp(op) {
  try {
    const opts = { now: op.now };
    const result =
      op.kind === "begin"
        ? beginRun(achievementRecord, op.state, opts)
        : foldAction(achievementRecord, op.events, op.before, op.after, opts);
    if (result.changed) {
      achievementRecord = result.record;
      try {
        storage.setItem(ACHIEVEMENTS_KEY, serializeRecord(achievementRecord));
      } catch {
        // swallowed: storage.setItem never throws, and a failure here must not stop the notify
      }
    }
    notifyAchievements(result);
  } catch {
    // swallowed: nothing achievement-related may change a run
  }
}

function queueAchievementOp(op) {
  try {
    if (achievementRecord !== null && achievementLoad === null && achievementQueue.length === 0) {
      applyAchievementOp(op);
      return;
    }
    achievementQueue.push(op);
    if (achievementLoad === null) track(loadAchievements());
  } catch {
    // swallowed: see applyAchievementOp
  }
}

/**
 * loadAchievements() — Phase 99 (TRACK-02): loads the durable
 * ddr.achievements.v1 record into memory. A missing, corrupt or older-shape
 * value loads as all zeros (parseRecord is tolerant). Never rejects. When a
 * load is already in flight it returns that promise. Each call re-reads
 * storage and storage reads are not queued behind writes, so a caller that
 * reloads mid-session flushes first. Ops queued while loading fold into the
 * loaded record in order before the promise resolves. boot() calls this once.
 */
export function loadAchievements() {
  if (achievementLoad) return achievementLoad;
  achievementLoad = (async () => {
    let raw = null;
    try {
      raw = await storage.getItem(ACHIEVEMENTS_KEY);
    } catch {
      raw = null;
    }
    achievementRecord = parseRecord(raw);
    const ops = achievementQueue.splice(0);
    for (const op of ops) applyAchievementOp(op);
    achievementLoad = null;
    return achievementRecord;
  })();
  return achievementLoad;
}

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
 *
 * Phase 81 (BOARD-15): once a stored record is parsed, it is reconciled
 * against the stored ddr.graveyard.v1 stones via engine/records.js#
 * reconcileBests — a boot-time backstop for persistGrave()'s independent,
 * non-atomic BESTS_KEY/GRAVE_KEY writes (a device process suspension mid-
 * write can let the graveyard write for a death land while its bests write
 * is lost). The stored record is rewritten only when reconciliation actually
 * changed it, so a boot over already-consistent stores never touches
 * BESTS_KEY. The backfill path below never needs this extra pass —
 * backfillBests already folds every graveyard stone in — and this never
 * touches deathRecord, runRecordedListener or the graveyard keys.
 */
export async function loadBests() {
  try {
    const raw = await storage.getItem(BESTS_KEY);
    if (typeof raw === "string") {
      let parsed = null;
      try {
        parsed = sanitizeBests(JSON.parse(raw));
      } catch {
        parsed = null; // corrupt JSON — fall through to the graveyard backfill below
      }
      if (parsed !== null) {
        const rawGraves = await storage.getItem(GRAVE_KEY);
        let graves = [];
        try {
          graves = rawGraves ? JSON.parse(rawGraves) : [];
        } catch {
          graves = [];
        }
        if (!Array.isArray(graves)) graves = [];
        const reconciled = reconcileBests(parsed, graves);
        bests = reconciled;
        if (JSON.stringify(reconciled) !== JSON.stringify(parsed)) {
          // Fire-and-enqueue, like persist(): the reconciled record is
          // already in memory and returned below regardless of whether this
          // write lands.
          track(storage.setItem(BESTS_KEY, JSON.stringify(bests)));
        }
        return bests;
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
 * loadGraveyard() — Phase 66 (BOARD-02, D-08/D-15): loads the durable
 * GRAVE_KEY stones and GRAVE_TOTAL_KEY lifetime count into the in-memory
 * { graves, total } snapshot getGraveyard() serves. Never rejects: corrupt
 * JSON, a non-array value, or a storage read that throws all resolve to
 * { graves: [], total: 0 }. `graves` keeps only plain non-array entries and
 * is capped at GRAVE_CAP (the newest 60, since the array is stored
 * newest-first). `total` is the stored value only when it is a non-negative
 * integer; otherwise (missing, corrupt, negative, fractional or non-finite)
 * it falls back to the stone count — and either way, never less than the
 * stone count actually present (mirrors persistGrave()'s own total-fallback
 * rule below, using the uncapped stone count exactly as that function does).
 * Idempotent to call more than once; boot() calls this once, right after
 * loadBests(), so the panel and the title gate can read a populated snapshot
 * synchronously the instant boot() resolves.
 */
export async function loadGraveyard() {
  try {
    const [rawGraves, rawTotal] = await Promise.all([
      storage.getItem(GRAVE_KEY),
      storage.getItem(GRAVE_TOTAL_KEY),
    ]);

    let parsed;
    try {
      parsed = rawGraves ? JSON.parse(rawGraves) : [];
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];
    const filtered = parsed.filter((s) => s && typeof s === "object" && !Array.isArray(s));
    const graves = filtered.slice(0, GRAVE_CAP);

    const parsedTotal = Number(rawTotal);
    const storedTotal =
      rawTotal !== null && Number.isInteger(parsedTotal) && parsedTotal >= 0 ? parsedTotal : filtered.length;
    const total = Math.max(storedTotal, filtered.length);

    graveyard = { graves, total };
    return graveyard;
  } catch {
    graveyard = { graves: [], total: 0 };
    return graveyard;
  }
}

/**
 * getGraveyard() — the adapter's current in-memory { graves, total }
 * snapshot, or null before the first loadGraveyard()/boot() call this
 * session. Callers treat the returned object as read-only.
 */
export function getGraveyard() {
  return graveyard;
}

/**
 * setAppVersion(v) — Phase 84 (BOARD-26): stamps the app version every
 * non-dev death's history record carries (the expanded YOUR DEAD row's
 * "Died ... · {version}" line). Called by mazeworld.html with the shell's
 * stamped #mw-app-version text, before boot()'s module script runs. A
 * non-string, empty, or over-APP_VERSION_MAX_CHARS value falls back to
 * "dev" (the default before any call, and the value every Node test/
 * dev-loop session without shell wiring keeps).
 */
export function setAppVersion(v) {
  appVersion = typeof v === "string" && v.length >= 1 && v.length <= APP_VERSION_MAX_CHARS ? v : "dev";
}

/** safeGetItem(key) — module-private: storage.getItem(key), tolerant to a
 * storage read that throws — resolves to null instead, never throws. Used
 * anywhere a single key's read failure must not cascade and abort a
 * Promise.all of otherwise-independent reads (persistGrave()'s
 * RUN_HISTORY_KEY read, below). */
async function safeGetItem(key) {
  try {
    return await storage.getItem(key);
  } catch {
    return null;
  }
}

/** readJsonTolerant(key) — module-private: safeGetItem(key), tolerant also
 * to unparseable JSON — resolves to null either way, never throws. */
async function readJsonTolerant(key) {
  const raw = await safeGetItem(key);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * loadRunHistory() — Phase 84 (BOARD-26): loads the durable ddr.runs.v1
 * per-run history into memory, running the once-only 2.1.0-cutoff import
 * (src/browser/runHistory.js#importLegacy, reading GRAVE_KEY/BESTS_KEY raw
 * and tolerant of corrupt JSON) the first time it finds an absent key,
 * unparseable JSON, or a stored history whose `imported` flag is not
 * `true` — a pre-Phase-84 device, or a corrupt store, both land here and
 * both come out the other side with `imported: true` so a later boot never
 * re-imports. A storage read that throws for RUN_HISTORY_KEY itself is the
 * ONE case that skips the import outright: the in-memory history is left
 * empty and non-imported, and nothing is written — persistGrave()'s own
 * merge-on-write (see below) is the safety net that keeps a later write
 * from losing anything already on disk. Never rejects. Idempotent to call
 * more than once (each call re-reads storage); boot() calls this once,
 * right after loadGraveyard().
 */
export async function loadRunHistory() {
  try {
    let raw;
    try {
      raw = await storage.getItem(RUN_HISTORY_KEY);
    } catch {
      runHistory = sanitizeHistory(null);
      return runHistory;
    }

    let parsed = null;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    if (parsed !== null) {
      const sanitized = sanitizeHistory(parsed);
      if (sanitized.imported === true) {
        runHistory = sanitized;
        return runHistory;
      }
    }

    // Absent key, unparseable JSON, or a stored history whose `imported`
    // flag is not true: run the once-only 2.1.0-cutoff import.
    const bests = await readJsonTolerant(BESTS_KEY);
    const gravesRaw = await readJsonTolerant(GRAVE_KEY);
    const graves = Array.isArray(gravesRaw) ? gravesRaw : [];
    const base = parsed !== null ? sanitizeHistory(parsed) : sanitizeHistory(null);
    const imported = importLegacy(base, { bests, graves });
    runHistory = imported;
    // Fire-and-enqueue, like loadBests()'s own backfill write: the imported
    // history is already in memory and returned below regardless of
    // whether this write lands.
    track(storage.setItem(RUN_HISTORY_KEY, serializeHistory(imported)));
    return runHistory;
  } catch {
    runHistory = sanitizeHistory(null);
    return runHistory;
  }
}

/**
 * getRunHistory() — the adapter's current in-memory per-run history's
 * `runs` array (frozen, newest first), or an empty frozen array before the
 * first loadRunHistory()/boot() call this session. Callers treat the
 * returned array as read-only.
 */
export function getRunHistory() {
  return runHistory !== null ? runHistory.runs : Object.freeze([]);
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

/**
 * takeBootResumeEvents() — SAV-06/SAV-07 (Phase 76): returns the boot-time
 * resume events exactly once, then resets them to null (consumed on read,
 * like takeBootWornReport()). `null` when boot() rehydrated nothing this
 * boot (no save, a corrupt save that fell back to a fresh run) or a run was
 * started since (initRun/startNewRun); `[]` for a quiet save;
 * `[{ type: "fightResumed", round, pending, foes }]` for a resumed fight or
 * `[{ type: "storeResumed" }]` for a resumed store (both narrated by
 * EVENT_NARRATION, Oracle only). 76-05's boot path in mazeworld.html is the
 * intended caller: it formats these through formatEvents() into the
 * Oracle's resume line.
 */
export function takeBootResumeEvents() {
  const events = bootResumeEvents;
  bootResumeEvents = null;
  return events;
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
  // SAV-06/SAV-07 (Phase 76): a new run never inherits unread resume events.
  bootResumeEvents = null;
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
 * recordDeath(state, cause, when) — Phase 65 (RUN-02/RUN-04), Phase 84
 * (BOARD-26): the synchronous in-memory fold of one death into the
 * personal-bests record AND (Phase 84) the per-run history. Synchronous
 * and never throws, so a failure here can never reach dispatch()'s
 * fail-closed catch and replace the dead run with a fresh one — the death
 * panel and the graveyard write must both survive a bug in this path.
 * Builds the SAME summary (via engine/death.js#buildRunSummary) that
 * persistGrave()'s bury() call below also builds — same `state`/`cause`/
 * `when` in, same hash out. Returns `{ summary, bestsJson, historyJson }`:
 * `bestsJson`/`historyJson` are each already JSON.stringify'd (ready for
 * persistGrave() to enqueue, so dispatch() never awaits an extra read
 * there), or null when `bests`/`runHistory` has not been loaded yet this
 * session (persistGrave()'s own lazy paths handle that).
 *
 * The bests fold (updateBests) still runs, unconditionally, exactly as
 * before — the old ddr.bests.v1 store is left untouched by this phase —
 * but it no longer sets `deathRecord`: the death panel's "new best?"
 * question (BOARD-26) now compares against the history instead
 * (newBestsAgainst), via historyRecordOf/appendRun below.
 */
function recordDeath(state, cause, when) {
  try {
    const summary = buildRunSummary(state, cause, when);

    // Phase 66 (BOARD-02, D-08/D-15): fold this death into the in-memory
    // graveyard synchronously, before the bests/history branches below, so
    // it runs whether or not `bests`/`runHistory` have been loaded yet this
    // session. recordDeath() is only reached for non-dev deaths
    // (dispatch()'s caller below excludes dev deaths entirely), so a dev
    // run's death never touches any of this.
    if (graveyard !== null) {
      graveyard = {
        graves: [summary, ...graveyard.graves].slice(0, GRAVE_CAP),
        total: graveyard.total + 1,
      };
    }

    let bestsJson = null;
    if (bests !== null) {
      const r = updateBests(bests, summary);
      bests = r.record;
      bestsJson = JSON.stringify(bests);
    }

    let historyJson = null;
    if (runHistory !== null) {
      const record = historyRecordOf(summary, appVersion);
      if (record) {
        const { first, newBests } = newBestsAgainst(runHistory.runs, record);
        runHistory = appendRun(runHistory, record);
        deathRecord = { first, newBests, summary };
        historyJson = serializeHistory(runHistory);
      } else {
        // Should never happen for a real buildRunSummary() output, but a
        // malformed record must fail closed rather than crash the death
        // path — no report this time, persistGrave()'s lazy path below
        // will retry with a freshly loaded history.
        deathRecord = null;
      }
    } else {
      deathRecord = null;
    }

    return { summary, bestsJson, historyJson };
  } catch {
    deathRecord = null;
    return { summary: null, bestsJson: null, historyJson: null };
  }
}

/**
 * persistGrave(state, cause, when, summary, bestsJson, historyJson) —
 * CR-01: builds this death's tombstone via engine/death.js#bury() (which
 * already has state.deathNote/state.epitaph set by die()) and appends it
 * to the adapter-owned graveyard at GRAVE_KEY, alongside the never-trimmed
 * total (GRAVE_TOTAL_KEY), the recent-names dedup window
 * (RECENT_NAMES_KEY), the personal-bests record (BESTS_KEY, Phase 65
 * RUN-02) and — Phase 84 (BOARD-26) — the per-run history (RUN_HISTORY_KEY).
 * Try/catch-and-swallow, like every other write in this file: a private
 * window or a full storage quota just means the tombstone (and/or the
 * bests/history records) won't persist — never throws.
 *
 * `cause` is read from the `died` event dispatch() just pushed (see below)
 * rather than from `state` itself, because GameState has no persisted
 * `cause` field (only `deathNote`/`epitaph`, already derived from it by
 * die()) — the event is the only place the raw cause string is still
 * available by the time dispatch() returns. `when`/`summary`/`bestsJson`/
 * `historyJson` come from recordDeath()'s synchronous fold, called BEFORE
 * this function (so the death panel can read getBests()/getRunHistory()/
 * takeDeathRecord() the instant dispatch() returns, without waiting on
 * this async write).
 */
async function persistGrave(state, cause, when, summary, bestsJson, historyJson) {
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

    // Phase 84 (BOARD-26): the history's own lazy path, mirroring the
    // bests lazy path immediately above — recordDeath() only appends into
    // the in-memory history when it was already loaded (historyJson !==
    // null); otherwise load (or import) it now and fold this death in.
    if (summary && historyJson === null) {
      await loadRunHistory();
      const record = historyRecordOf(summary, appVersion);
      if (record) runHistory = appendRun(runHistory, record);
    }

    // Read all four keys up front. getItem() is NOT queued behind
    // in-flight writes (storage.js contract), so a caller needing read-after-
    // write ordering across deaths flushes between them (see the adapter test);
    // reading them together here keeps the subsequent writes contiguous.
    // RUN_HISTORY_KEY's own read is wrapped (safeGetItem) so a failure
    // isolated to that one key can never abort the other three reads —
    // mergeHistories() below is the safety net that keeps a failed read
    // from ever shrinking what's already on disk.
    const [rawGraves, rawTotal, rawRecent, rawRunHistory] = await Promise.all([
      storage.getItem(GRAVE_KEY),
      storage.getItem(GRAVE_TOTAL_KEY),
      storage.getItem(RECENT_NAMES_KEY),
      safeGetItem(RUN_HISTORY_KEY),
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

    // Part 5 — Phase 84 (BOARD-26): merge-on-write. The stored history can
    // only ever GROW — never overwritten with just this session's
    // in-memory copy, which may have raced ahead of, fallen behind, or
    // (via safeGetItem's RUN_HISTORY_KEY isolation above) simply failed to
    // read whatever is actually on disk. A malformed/unparseable stored
    // value sanitizes to empty via mergeHistories' own sanitizeHistory
    // call, never throws.
    let storedHistory = null;
    if (typeof rawRunHistory === "string") {
      try {
        storedHistory = JSON.parse(rawRunHistory);
      } catch {
        storedHistory = null;
      }
    }
    const mergedHistory = mergeHistories(storedHistory, runHistory);
    runHistory = mergedHistory;

    // Enqueue all writes back-to-back (no await between them) so a single
    // flush()/waitForPending() drain settles the whole tombstone (and the
    // bests/history records, when present) atomically.
    const writes = [
      storage.setItem(GRAVE_KEY, JSON.stringify(graves)),
      storage.setItem(GRAVE_TOTAL_KEY, String(total)),
      storage.setItem(RECENT_NAMES_KEY, JSON.stringify(recent)),
      storage.setItem(RUN_HISTORY_KEY, serializeHistory(mergedHistory)),
    ];
    if (bestsJson !== null) writes.push(storage.setItem(BESTS_KEY, bestsJson));

    // Phase 66 (BOARD-02, D-08/D-15): a death that raced ahead of boot()'s
    // loadGraveyard() (this function's own lazy `bests` path above, mirrored
    // here) leaves `graveyard` still null; seed it from the graves/total this
    // function just computed so the in-memory view never lags storage.
    if (graveyard === null) {
      graveyard = { graves, total };
    }

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
 *
 * Phase 99 (TRACK-03): a non-dev run started here is handed to the
 * achievements tracker, which records its sub-class for Tourist and resets the
 * current-run progress (a run abandoned later still counted). startNewRun is
 * the one seam every player-started delve passes through (the roller and the
 * dev row). initRun() is deliberately NOT hooked: its other callers are boot()'s
 * never-persisted pre-title fallback run and dispatch()'s fail-closed recovery
 * run, neither a delve the player started.
 */
export async function startNewRun(seed, options = {}) {
  const safeSeed = Number.isInteger(seed) ? seed : Date.now();
  // audit-batch E12 (part 4): thread the recent-names dedup window into the
  // fresh roll so a new adventurer avoids reusing the last ~25 dead names.
  const exclude = await readRecentNames();
  const startDepth = Number.isInteger(options.startDepth) && options.startDepth >= 1 ? options.startDepth : 1;
  const state = initRun(safeSeed, exclude, { startDepth, storeRoll: true });
  persist();
  if (state.dev !== true) queueAchievementOp({ kind: "begin", state, now: Date.now() });
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
 *
 * Phase 84 (BOARD-26): the per-run history (loadRunHistory()) is loaded —
 * running its own once-only 2.1.0-cutoff import the first time — right
 * after the graveyard, so getRunHistory() and the death panel's
 * history-based "new best?" answer are both populated before boot()
 * resolves too.
 *
 * Phase 99 (TRACK-02): the lifetime achievements record (loadAchievements())
 * is loaded right after the run history, so getAchievementRecord() is
 * populated before boot() resolves. boot()'s pre-title fallback run records
 * nothing for Tourist (only startNewRun does).
 */
export async function boot(freshSeed) {
  await storage.migrateLegacyKeys();
  // Phase 65 (RUN-02/RUN-03): the personal-bests record is loaded (or
  // backfilled from the just-migrated graveyard) before boot() resolves, so
  // the death panel can read a synchronous "new best?" answer the very
  // first time a death happens this session.
  await loadBests();
  // Phase 66 (BOARD-02, D-08/D-15): the Leaderboards panel and the title's
  // VIEW THE DEAD gate read the graveyard synchronously via getGraveyard()
  // from here on, so it must be populated before boot() resolves too.
  await loadGraveyard();
  // Phase 84 (BOARD-26): YOUR DEAD's own per-run history, loaded (and
  // once-only imported from the stores above) before boot() resolves.
  await loadRunHistory();
  // Phase 99 (TRACK-02): the lifetime achievements record, tolerant of a
  // missing, corrupt or older-shape value (all zeros), loaded before boot()
  // resolves; the load never rejects.
  await loadAchievements();
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
      // SAV-06/SAV-07 (Phase 76): what this load resumed, for the shell's
      // one Oracle resume line (pure, zero rng).
      bootResumeEvents = resumeEventsFor(currentState);
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
 *
 * Phase 77 (CMBUI-11): then through eventNarration.js#stampScrollCopyNotes —
 * a scrollTooAdvanced directly followed by its scrollCast carries
 * `castFollows` (it prints no Oracle line of its own) and that scrollCast
 * carries `tooAdvanced` (its line reads the cast, then the copy note). Every
 * consumer of the returned `events` (the rail/fight-log fold, the roll
 * lookup) reads the same stamped list.
 *
 * Phase 99 (TRACK-03): the raw engine events (not the decorated copy) and the
 * states either side of the action fold into the lifetime achievements record,
 * synchronously, so getAchievementRecord() reflects the action the instant
 * dispatch() returns. The fold has its own try/catch (applyAchievementOp), so
 * no achievement failure can reach the fail-closed catch below. A dev run
 * (either side) folds nothing.
 */
export function dispatch(action) {
  if (!currentState) {
    throw new Error("engineAdapter.dispatch: call boot()/initRun() before dispatch()");
  }
  try {
    const before = currentState;
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
        // Phase 65 (RUN-02/RUN-04), Phase 84 (BOARD-26): fold the death into
        // the in-memory bests record AND the per-run history SYNCHRONOUSLY
        // (recordDeath, not awaited) so getBests()/getRunHistory()/
        // takeDeathRecord() already reflect it the instant dispatch()
        // returns — the death panel never waits on the storage write below.
        const when = typeof currentState.deathAt === "number" ? currentState.deathAt : Date.now();
        const { summary, bestsJson, historyJson } = recordDeath(currentState, diedEvent.cause, when);
        // Phase 68 / Phase 85: the one run-recorded listener; the shell hands
        // each non-dev death to boardSync, once per non-dev death.
        notifyRunRecorded(summary);
        track(persistGrave(currentState, diedEvent.cause, when, summary, bestsJson, historyJson));
      }
    }
    // Phase 99 (TRACK-03): fold the action into the lifetime achievements
    // record, next to the death recording above; real runs only.
    if (before.dev !== true && currentState.dev !== true) {
      queueAchievementOp({ kind: "fold", events, before, after: currentState, now: Date.now() });
    }
    // Phase 25 (FEED-05): stamp the rotating fledgling-miss quip onto any
    // strikeMissed event, gated on the hero's post-action level, BEFORE
    // formatting the Oracle html — so the Oracle line and the narration line
    // (25-03/25-04) read the exact same quip from this one assignment site.
    const { events: decorated, seq: nextMissSeq } = decorateMisses(events, currentState.c?.level ?? 1, missSeq);
    missSeq = nextMissSeq;
    // CMBUI-11 (Phase 77): a scroll too advanced to copy still cast — stamp
    // the note/cast pair so the Oracle says the cast, then the copy note
    // (presentation only; the engine's events keep their order).
    // Phase 78 (78-05): a fed day that refilled a spent book names it with
    // the count — stamp each refilled sheet (before: the state applyAction
    // was handed, never mutated; after: the new state) onto `rationsEaten`
    // (presentation only; the engine's events and state are untouched).
    const stamped = stampBookRefill(stampScrollCopyNotes(decorated), before, currentState, maxCharges);
    return { state: currentState, events: stamped, html: formatEvents(stamped) };
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
