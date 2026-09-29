// src/browser/settings.js
//
// The single source of truth for the thirteen persisted settings (UX-07;
// DR18/DR15-E removed the `diceMode` field, Phase 33 UIF-05 removed the
// former control-bar side option, Phase 46 NAME-02 removed the on-screen
// movement-control-scheme field; Phase 59 DRESS-05 added `dressing`, the Set
// Dressing On/Off row; Phase 67 PGS-02 added the three Play Games fields
// below; Phase 71 D-03 added the three volume levels; Phase 78 HUD-08 added
// `movement` and `padSide`, the opt-in arrow pad) plus the pure
// text-scaling (UX-08) and
// confirm-before-quit-gate helpers. All persistence goes through
// src/browser/storage.js's shared async abstraction (which itself installs
// `window.mzStorage` for the classic non-module script) — never any raw
// browser-native key/value store directly (T-04-03, 04-RESEARCH.md
// data-integrity threat). This module is the ONLY writer of the settings
// keys: mirrors src/browser/engineAdapter.js's `import * as storage from
// "./storage.js"` pattern rather than reaching for the global, so this also
// loads cleanly under a plain `node --test` process that never bootstraps
// `window` at all.
//
// All thirteen fields are persisted as ONE JSON object under a single
// versioned key (SETTINGS_STORAGE_KEY) — one storage.js write-queue entry
// per settings change, never thirteen separate keys racing each other.
//
// Phase 67 (PGS-02) fields:
//   - `compete` (D-01, D-02): the Compete toggle, default ON on a fresh
//     install; OFF means the Play Games provider is never called at all.
//   - `pgsWelcomed` (D-04): the one-time first-sign-in card has been shown.
//   - `pgsDevSignedIn` (D-12): dev-only; seeds the in-memory fake Play Games
//     provider as signed in, in the browser dev loop only — ignored on native.
//
// Phase 71 (POLISH-05, D-03) fields: `volMaster`, `volMusic`, `volEffects`
// — the MASTER / MUSIC / EFFECTS volume sliders under the Sound row, each an
// integer 0-100, default 100. src/browser/sfx.js#volumeLevels turns them into
// gains (MASTER the device master, MUSIC times MUSIC_GAIN on the theme,
// EFFECTS the one-shots' bus). They are validated by a predicate (an
// integer from 0 to 100 inclusive) rather than an allowed-values list.
//
// Phase 78 (HUD-08, the user's 2026-09-25 request) fields: `movement`
// ("tap" | "arrows") and `padSide` ("left" | "right", default
// "right"). ARROWS shows an on-screen pad (src/browser/arrowPad.js) in the
// chosen bottom corner, with map taps no longer stepping; TAP TO MOVE is the
// other, complete mode. The default is "arrows" since 2026-09-28 (user:
// "Default to arrow movement instead of tap to move", new installs only): an
// existing install keeps "tap" (LEGACY_MOVEMENT) — see readSettings. These
// are NEW names; the Phase 46 retired key and
// value stay retired (settings.test.js pins both).
//
// Fail-open posture (matches engineAdapter.js's persist()/boot()):
// a missing key, a blocked/private store, or a corrupt/malformed JSON blob
// all just mean readSettings() returns SETTINGS_DEFAULTS — this module never
// throws. Phase 33 (UIF-05): the former handed-layout field was removed; a
// persisted blob that still carries it is ignored on read because
// readSettings only merges SETTINGS_DEFAULTS keys, and writeSetting rejects
// unknown keys — no migration needed. Phase 59 (DRESS-05): the same tolerant
// posture covers `dressing` going forward — an OLD blob with no `dressing`
// key at all reads as On (its default) through this exact merge, no
// migration step needed either. Phase 67 (PGS-02): the same again for
// `compete`, `pgsWelcomed` and `pgsDevSignedIn` — an old blob without them
// reads their defaults (true / false / false), no migration. Phase 71
// (D-03): the three volume levels read their default 100 from an old blob
// through the same tolerant merge — and a non-integer, out-of-range or
// string stored value reads 100 too — with no migration. Phase 78 (HUD-08):
// an old blob without `movement`/`padSide`, or with a tampered value, reads
// "tap"/"right" through the same merge, so an unknown movement falls back to
// tap-to-move.

import { getItem, setItem } from "./storage.js";

/** Single versioned key all thirteen settings fields are persisted under. */
export const SETTINGS_STORAGE_KEY = "ddr.settings.v1";

/**
 * The five UX-07 fields plus the three Phase 67 fields, and their defaults
 * (04-UI-SPEC.md / 04-CONTEXT.md; 67-CONTEXT.md D-01, D-04, D-12).
 * Phase 59 (DRESS-05): `dressing` (Set Dressing On/Off, default true) is the
 * fifth field, persisted in this SAME blob as `sound` and every other field
 * — but fully independent of it: writing one never changes the other (see
 * the settings.test.js "independence" pin). It's read by
 * src/browser/dressing.js#createDressingArt's lazy-load controller, so
 * turning it Off both draws nothing AND never loads the 54 dressing images.
 * Phase 67 (PGS-02): `compete` (D-01, default true), `pgsWelcomed` (D-04,
 * default false) and `pgsDevSignedIn` (D-12, default false, browser dev loop
 * only) are appended after `dressing`, in that order.
 * Phase 71 (D-03): `volMaster`, `volMusic` and `volEffects` (integers 0-100,
 * default 100) are appended after `pgsDevSignedIn`, in that order.
 * Phase 78 (HUD-08): `movement` (default "arrows" since 2026-09-28; existing
 * installs keep "tap" through readSettings) and `padSide`
 * (default "right", the arrow pad's bottom corner, read only in arrow mode)
 * are appended after `volEffects`, in that order.
 */
export const SETTINGS_DEFAULTS = Object.freeze({
  sound: true,
  haptics: true,
  textSize: "M",
  confirmBeforeQuit: true,
  dressing: true,
  compete: true,
  pgsWelcomed: false,
  pgsDevSignedIn: false,
  volMaster: 100,
  volMusic: 100,
  volEffects: 100,
  movement: "arrows",
  padSide: "right",
});

// Allowed values per field — writeSetting() validates against these before
// persisting (T-04-04: an adversarial/malformed value like textSize:'XL' can
// never reach storage). Each entry is either an allowed-values array (every
// pre-Phase-71 field) or a predicate (Phase 71 D-03: the volume levels,
// which accept only an integer from 0 to 100 inclusive — T-71-01).
function isVolumeLevel(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

const ALLOWED_VALUES = {
  sound: [true, false],
  haptics: [true, false],
  textSize: ["S", "M", "L"],
  confirmBeforeQuit: [true, false],
  dressing: [true, false],
  compete: [true, false],
  pgsWelcomed: [true, false],
  pgsDevSignedIn: [true, false],
  volMaster: isVolumeLevel,
  volMusic: isVolumeLevel,
  volEffects: isVolumeLevel,
  movement: ["tap", "arrows"],
  padSide: ["left", "right"],
};

/** LEGACY_MOVEMENT — what an existing install keeps when it has no valid
 * stored `movement` (user, 2026-09-28: the arrow default is for new installs
 * only). */
export const LEGACY_MOVEMENT = "tap";

/** EXISTING_INSTALL_KEYS — durable keys that prove this device played a build
 * before the arrow default (the same proof patchNotes.js uses): a save, a
 * graveyard or a bests record. The settings blob itself is checked first. */
export const EXISTING_INSTALL_KEYS = Object.freeze(["ddr.delve.v1", "ddr.graveyard.v1", "ddr.bests.v1"]);

function isValidSettingValue(key, value) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_VALUES, key)) return false;
  const allowed = ALLOWED_VALUES[key];
  if (typeof allowed === "function") return allowed(value) === true;
  return Array.isArray(allowed) && allowed.includes(value);
}

/**
 * readSettings() — resolves the full thirteen-field settings object: persisted
 * values merged over SETTINGS_DEFAULTS. Never throws: an unset key, a
 * storage error, or a corrupt/non-object JSON blob all yield full defaults.
 * Only recognized keys with a value in that field's allowed set are pulled
 * from the persisted blob — an unrecognized/invalid stored value falls back
 * to its default rather than propagating a tampered value.
 */
export async function readSettings() {
  let parsed = null;
  try {
    const raw = await getItem(SETTINGS_STORAGE_KEY);
    if (typeof raw === "string") parsed = JSON.parse(raw);
  } catch {
    parsed = null; // corrupt JSON -> fall through to defaults below
  }

  const merged = { ...SETTINGS_DEFAULTS };
  if (parsed && typeof parsed === "object") {
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
      if (isValidSettingValue(key, parsed[key])) merged[key] = parsed[key];
    }
    // An existing settings blob without a valid movement is an existing
    // install: it keeps tap-to-move (new installs only get arrows).
    if (!isValidSettingValue("movement", parsed.movement)) merged.movement = LEGACY_MOVEMENT;
    return merged;
  }
  // No settings blob: a new install unless an older build left a save,
  // graveyard or bests record. An existing install keeps tap-to-move, and
  // that choice is written once so later reads are stable.
  if (await hasPriorInstallData()) {
    merged.movement = LEGACY_MOVEMENT;
    try {
      await setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // never-throw posture: the next read re-derives the same answer
    }
  }
  return merged;
}

async function hasPriorInstallData() {
  for (const key of EXISTING_INSTALL_KEYS) {
    try {
      const raw = await getItem(key);
      if (typeof raw === "string" && raw.length > 0) return true;
    } catch {
      // unreadable key: keep looking
    }
  }
  return false;
}

/**
 * writeSetting(key, value) — validates `value` against `key`'s allowed set;
 * an invalid value (or an unrecognized key) is a no-op that returns the
 * CURRENT settings unchanged (prior/default value is kept). A valid value is
 * merged into the persisted blob and written through storage.js's setItem
 * (queued, per-key ordered — see storage.js header). Returns the resulting
 * full settings object either way.
 */
export async function writeSetting(key, value) {
  const current = await readSettings();
  if (!(key in SETTINGS_DEFAULTS) || !isValidSettingValue(key, value)) {
    return current;
  }
  const next = { ...current, [key]: value };
  try {
    await setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Fail-open: matches storage.js's own never-throw posture — the write
    // just doesn't persist this time.
  }
  return next;
}

// --- Text-scale (UX-08) + confirm-quit gate ---------------------------
//
// Pure functions only below this line: no DOM, no storage, no side effects
// — mirroring src/browser/nativeChrome.js#decideBackAction's pure-gate
// posture. 04-05 (Wave-2 shell) calls effectiveTextScale to set the root
// `--mw-text-scale` custom property; 04-09 (settings screen) calls
// shouldConfirmQuit to gate the Sheet's CUT LOSSES / ROLL ANOTHER action.
//
// RUN AWAY (combat) is deliberately NEVER routed through shouldConfirmQuit
// — per 04-UI-SPEC.md, its mis-tap protection is isolation/sizing/color
// only, not a confirm gate.

const TEXT_SCALE_MIN = 0.85;
const TEXT_SCALE_MAX = 1.25;

const TEXT_SCALE_BY_SIZE = Object.freeze({ S: 0.85, M: 1.0, L: 1.25 });

/**
 * textScaleForSize('S'|'M'|'L') -> 0.85|1.0|1.25 (04-UI-SPEC.md Typography).
 * Any unrecognized input defaults to 1.0 (M, the neutral multiplier).
 */
export function textScaleForSize(size) {
  return TEXT_SCALE_BY_SIZE[size] ?? 1.0;
}

/**
 * clampTextScale(osScale) — clamps any finite number to
 * [TEXT_SCALE_MIN, TEXT_SCALE_MAX]. A non-finite input (NaN, +/-Infinity,
 * a non-number, undefined/null) defaults to the neutral 1.0 rather than
 * propagating garbage into the layout math.
 */
export function clampTextScale(osScale) {
  if (typeof osScale !== "number" || !Number.isFinite(osScale)) return 1.0;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, osScale));
}

/**
 * effectiveTextScale(size, osScale) — multiplies the S/M/L size multiplier
 * by a clamped OS font-scale factor; the FINAL product is itself clamped to
 * [TEXT_SCALE_MIN, TEXT_SCALE_MAX] so no combination of size + an extreme OS
 * setting can push the fixed pixel-art chrome (HUD numbers, tab bar, the
 * MAKE CAMP and gear chips) outside the locked bound.
 */
export function effectiveTextScale(size, osScale) {
  const base = textScaleForSize(size);
  const osFactor = clampTextScale(osScale);
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, base * osFactor));
}

/**
 * shouldConfirmQuit({confirmBeforeQuit}) -> boolean — true only when the
 * setting is truthy. Pure, no side effects; gates the Sheet's CUT LOSSES /
 * ROLL ANOTHER action. Accepts an absent/undefined settings object (treated
 * as confirmBeforeQuit: false, the safest default for a caller that failed
 * to load settings first).
 */
export function shouldConfirmQuit(settings) {
  return !!settings?.confirmBeforeQuit;
}
