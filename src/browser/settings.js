// src/browser/settings.js
//
// The single source of truth for the six persisted UX settings (UX-07) plus
// the pure text-scaling (UX-08) and confirm-before-quit-gate helpers. All
// persistence goes through src/browser/storage.js's shared async
// abstraction (which itself installs `window.mzStorage` for the classic
// non-module script) — never any raw browser-native key/value store directly
// (T-04-03, 04-RESEARCH.md data-integrity threat). This module is the ONLY
// writer of the settings keys: mirrors src/browser/engineAdapter.js's
// `import * as storage from "./storage.js"` pattern rather than reaching for
// the global, so this also loads cleanly under a plain `node --test` process
// that never bootstraps `window` at all.
//
// All six fields are persisted as ONE JSON object under a single versioned
// key (SETTINGS_STORAGE_KEY) — one storage.js write-queue entry per settings
// change, never six separate keys racing each other.
//
// Fail-open posture (matches engineAdapter.js's persist()/boot()/getBest()):
// a missing key, a blocked/private store, or a corrupt/malformed JSON blob
// all just mean readSettings() returns SETTINGS_DEFAULTS — this module never
// throws.

import { getItem, setItem } from "./storage.js";

/** Single versioned key all six settings fields are persisted under. */
export const SETTINGS_STORAGE_KEY = "mazeworld.settings.v1";

/** The six UX-07 fields and their defaults (04-UI-SPEC.md / 04-CONTEXT.md). */
export const SETTINGS_DEFAULTS = Object.freeze({
  sound: true,
  haptics: true,
  textSize: "M",
  controlScheme: "tap",
  confirmBeforeQuit: true,
  diceMode: "on tap",
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
};

function isValidSettingValue(key, value) {
  const allowed = ALLOWED_VALUES[key];
  return Array.isArray(allowed) && allowed.includes(value);
}

/**
 * readSettings() — resolves the full six-field settings object: persisted
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
