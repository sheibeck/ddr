// src/browser/settings.js
//
// The single source of truth for the seven persisted UX settings (UX-07,
// plus 04-DR9's `handedness`) plus the pure text-scaling (UX-08) and
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
// All seven fields are persisted as ONE JSON object under a single
// versioned key (SETTINGS_STORAGE_KEY) — one storage.js write-queue entry
// per settings change, never seven separate keys racing each other.
//
// Fail-open posture (matches engineAdapter.js's persist()/boot()/getBest()):
// a missing key, a blocked/private store, or a corrupt/malformed JSON blob
// all just mean readSettings() returns SETTINGS_DEFAULTS — this module never
// throws.

import { getItem, setItem } from "./storage.js";

/** Single versioned key all seven settings fields are persisted under. */
export const SETTINGS_STORAGE_KEY = "ddr.settings.v1";

/** The seven UX-07 fields and their defaults (04-UI-SPEC.md / 04-CONTEXT.md). */
export const SETTINGS_DEFAULTS = Object.freeze({
  sound: true,
  haptics: true,
  textSize: "M",
  // Device-review revision (04-CONTEXT.md "Device-review revisions
  // (2026-09-08)" #2): the on-screen D-pad is now the sole, always-visible
  // control (REVERSES the earlier tap-to-move-default decision). "tap"
  // stays a valid stored value (controls.js's tap->cell code stays
  // importable/dormant) but is no longer wired to movement in the crawl
  // screen regardless of this setting.
  controlScheme: "dpad",
  confirmBeforeQuit: true,
  diceMode: "on tap",
  // 04-DR11 ("D-pad ALWAYS centered; handedness moves only MAKE CAMP"):
  // supersedes 04-DR9's swap-both-sides layout. The D-pad is now
  // horizontally CENTERED in the MAP tab's bottom bar regardless of this
  // setting — handedness controls ONLY which side MAKE CAMP floats to.
  // "left" (left-handed, the DEFAULT per user device-review direction)
  // puts MAKE CAMP on the LEFT; "right" (right-handed) puts it on the
  // RIGHT. See mazeworld.html's `#app[data-handedness=...]` CSS rules for
  // the live layout.
  handedness: "left",
});

// Allowed value sets per field — writeSetting() validates against these
// before persisting (T-04-04: an adversarial/malformed value like
// textSize:'XL' can never reach storage).
const ALLOWED_VALUES = {
  sound: [true, false],
  haptics: [true, false],
  textSize: ["S", "M", "L"],
  controlScheme: ["tap", "dpad"],
  confirmBeforeQuit: [true, false],
  diceMode: ["on tap", "always", "never"],
  handedness: ["left", "right"],
};

function isValidSettingValue(key, value) {
  const allowed = ALLOWED_VALUES[key];
  return Array.isArray(allowed) && allowed.includes(value);
}

/**
 * readSettings() — resolves the full seven-field settings object: persisted
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
  }
  return merged;
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
 * setting can push the fixed pixel-art chrome (HUD numbers, tab bar, D-pad)
 * outside the locked bound.
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
