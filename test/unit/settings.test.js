// Task 1 (TDD) — Settings schema + read/write round-trip over window.mzStorage.
//
// RED-first: this file imports src/browser/settings.js, which does not exist
// yet, so `node --test` fails to load it. Implementing that module (GREEN)
// turns it green.
//
// Proves (04-02-PLAN.md must_haves): all 6 settings round-trip through
// window.mzStorage (src/browser/storage.js's shared abstraction) and read
// back with correct defaults when unset; an invalid value is rejected
// (no-op, keeps prior/default); a corrupt persisted blob yields full
// defaults rather than throwing.
//
// Mirrors test/unit/engineAdapter.test.js's withFakeLocalStorage pattern:
// storage.js's isNative() returns false whenever `window` doesn't exist at
// all (as in this plain `node --test` process), so it falls straight
// through to its browser branch, which reads/writes globalThis.localStorage
// — installing a fake there is enough, no separate window.mzStorage/
// Capacitor setup needed in this file.

import test from "node:test";
import assert from "node:assert/strict";

import { readSettings, writeSetting, SETTINGS_DEFAULTS, SETTINGS_STORAGE_KEY } from "../../src/browser/settings.js";
import { flush as flushStorage } from "../../src/browser/storage.js";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage, store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test("readSettings(): unset store yields full defaults", async () => {
  await withFakeLocalStorage(async () => {
    const settings = await readSettings();
    assert.deepEqual(settings, SETTINGS_DEFAULTS);
  });
});

test("SETTINGS_DEFAULTS: controlScheme defaults to 'dpad'", () => {
  assert.equal(SETTINGS_DEFAULTS.controlScheme, "dpad");
  assert.equal(SETTINGS_DEFAULTS.textSize, "M");
  assert.equal(SETTINGS_DEFAULTS.sound, true);
  assert.equal(SETTINGS_DEFAULTS.haptics, true);
  assert.equal(SETTINGS_DEFAULTS.confirmBeforeQuit, true);
});

test("writeSetting/readSettings: each of the 5 fields round-trips through window.mzStorage", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await writeSetting("sound", false);
    await writeSetting("haptics", false);
    await writeSetting("textSize", "L");
    await writeSetting("controlScheme", "dpad");
    await writeSetting("confirmBeforeQuit", false);
    await flushStorage();

    const settings = await readSettings();
    assert.deepEqual(settings, {
      sound: false,
      haptics: false,
      textSize: "L",
      controlScheme: "dpad",
      confirmBeforeQuit: false,
    });

    // Persisted as ONE JSON blob under a single versioned key, not raw
    // localStorage reads/writes bypassing storage.js.
    assert.equal(store.has(SETTINGS_STORAGE_KEY), true);
  });
});

test("readSettings(): haptics boolean round-trips (haptics-call injection seam)", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("haptics", false);
    await flushStorage();
    assert.equal((await readSettings()).haptics, false);

    await writeSetting("haptics", true);
    await flushStorage();
    assert.equal((await readSettings()).haptics, true);
  });
});

test("writeSetting(): invalid value is rejected (no-op, keeps prior/default)", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("textSize", "XL"); // not in {S,M,L}
    await flushStorage();
    assert.equal((await readSettings()).textSize, "M"); // stays at default

    await writeSetting("textSize", "L");
    await flushStorage();
    await writeSetting("textSize", "NOPE"); // invalid again, after a valid write
    await flushStorage();
    assert.equal((await readSettings()).textSize, "L"); // keeps the last valid value

    await writeSetting("controlScheme", "keyboard"); // not in {tap,dpad}
    await flushStorage();
    assert.equal((await readSettings()).controlScheme, "dpad");
  });
});

test("readSettings(): corrupt JSON blob yields full defaults, never throws", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, "{not valid json");
    const settings = await readSettings();
    assert.deepEqual(settings, SETTINGS_DEFAULTS);
  });
});

test("readSettings(): partial persisted blob merges over defaults", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "S" }));
    const settings = await readSettings();
    assert.equal(settings.textSize, "S");
    assert.equal(settings.sound, SETTINGS_DEFAULTS.sound);
    assert.equal(settings.confirmBeforeQuit, SETTINGS_DEFAULTS.confirmBeforeQuit);
  });
});

// Phase 33 (UIF-05): a stored handed-layout key is ignored silently — no
// migration, no error. readSettings only merges SETTINGS_DEFAULTS keys, so
// a leftover `handedness` value in an old persisted blob never reaches the
// returned settings object; writeSetting rejects the now-unknown key as a
// no-op.
test("Phase 33 (UIF-05): a stored handed-layout key is ignored silently", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "S", handedness: "right" }));
    const settings = await readSettings();
    assert.deepEqual(settings, { ...SETTINGS_DEFAULTS, textSize: "S" });
    assert.equal("handedness" in settings, false);

    assert.deepEqual(Object.keys(SETTINGS_DEFAULTS), ["sound", "haptics", "textSize", "controlScheme", "confirmBeforeQuit"]);
    assert.equal(Object.keys(SETTINGS_DEFAULTS).length, 5);
    assert.equal(Object.keys(SETTINGS_DEFAULTS).includes("handedness"), false);

    // writeSetting rejects the now-unknown key as a no-op: the returned
    // settings are unchanged and nothing is (re-)persisted for it — a fresh
    // store (no prior blob) still has no key written after the call.
    store.delete(SETTINGS_STORAGE_KEY);
    const before = await readSettings();
    const after = await writeSetting("handedness", "right");
    assert.deepEqual(after, before);
    assert.equal(store.has(SETTINGS_STORAGE_KEY), false);
  });
});

test("settings.js never touches raw localStorage directly (only via storage.js/window.mzStorage)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/settings.js", import.meta.url), "utf8");
  assert.equal(/\blocalStorage\b/.test(src), false);
});
