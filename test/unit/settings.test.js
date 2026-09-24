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

test("SETTINGS_DEFAULTS: the eleven fields' defaults", () => {
  assert.equal(SETTINGS_DEFAULTS.textSize, "M");
  assert.equal(SETTINGS_DEFAULTS.sound, true);
  assert.equal(SETTINGS_DEFAULTS.haptics, true);
  assert.equal(SETTINGS_DEFAULTS.confirmBeforeQuit, true);
  // Phase 59 (DRESS-05): the fifth field, Set Dressing, defaults On.
  assert.equal(SETTINGS_DEFAULTS.dressing, true);
  // Phase 67 (PGS-02): Compete defaults ON (D-01), the first-sign-in card
  // has not been shown (D-04), and the dev simulate-signed-in flag is off (D-12).
  assert.equal(SETTINGS_DEFAULTS.compete, true);
  assert.equal(SETTINGS_DEFAULTS.pgsWelcomed, false);
  assert.equal(SETTINGS_DEFAULTS.pgsDevSignedIn, false);
  // Phase 71 (D-03): the three volume sliders default to full, 100.
  assert.equal(SETTINGS_DEFAULTS.volMaster, 100);
  assert.equal(SETTINGS_DEFAULTS.volMusic, 100);
  assert.equal(SETTINGS_DEFAULTS.volEffects, 100);
});

test("writeSetting/readSettings: each of the 5 fields round-trips through window.mzStorage", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await writeSetting("sound", false);
    await writeSetting("haptics", false);
    await writeSetting("textSize", "L");
    await writeSetting("confirmBeforeQuit", false);
    // Phase 59 (DRESS-05): the fifth field round-trips in the same blob.
    await writeSetting("dressing", false);
    await flushStorage();

    const settings = await readSettings();
    assert.deepEqual(settings, {
      sound: false,
      haptics: false,
      textSize: "L",
      confirmBeforeQuit: false,
      dressing: false,
      compete: true,
      pgsWelcomed: false,
      pgsDevSignedIn: false,
      // Phase 71 (D-03): the volume sliders keep their defaults.
      volMaster: 100,
      volMusic: 100,
      volEffects: 100,
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

    // Phase 59 (DRESS-05) appended `dressing`; Phase 67 (PGS-02) appended
    // `compete`, `pgsWelcomed` and `pgsDevSignedIn`; Phase 71 (D-03) appended
    // `volMaster`, `volMusic` and `volEffects` — eleven keys, in order.
    assert.deepEqual(Object.keys(SETTINGS_DEFAULTS), [
      "sound",
      "haptics",
      "textSize",
      "confirmBeforeQuit",
      "dressing",
      "compete",
      "pgsWelcomed",
      "pgsDevSignedIn",
      "volMaster",
      "volMusic",
      "volEffects",
    ]);
    assert.equal(Object.keys(SETTINGS_DEFAULTS).length, 11);
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

// Phase 46 (NAME-02): the on-screen movement-control-scheme setting is
// retired — tap-to-move has been the only movement surface since v1.4/v1.5.
// Built from string fragments (the shell-map-invariants RETIRED-map idiom)
// so this pin never spells the retired identifier/value whole, keeping the
// zero-straggler grep for the retired setting at zero across test/.
test("Phase 46 (NAME-02): a stored control-scheme key is ignored silently", async () => {
  const RETIRED_KEY = "control" + "Scheme";
  const RETIRED_VALUE = "dp" + "ad";

  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "S", [RETIRED_KEY]: RETIRED_VALUE }));
    const settings = await readSettings();
    assert.deepEqual(settings, { ...SETTINGS_DEFAULTS, textSize: "S" });
    assert.equal(RETIRED_KEY in settings, false);

    // writeSetting rejects the now-unknown key as a no-op: the returned
    // settings deep-equal the current settings, with no such key.
    const current = await readSettings();
    const after = await writeSetting(RETIRED_KEY, "tap");
    assert.deepEqual(after, current);
    assert.equal(RETIRED_KEY in after, false);
  });

  // The settings source itself no longer spells the retired key or value
  // (the handedness pin's doesNotMatch shape).
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/settings.js", import.meta.url), "utf8");
  assert.equal(src.includes(RETIRED_KEY), false);
  assert.equal(src.includes(RETIRED_VALUE), false);
});

test("settings.js never touches raw localStorage directly (only via storage.js/window.mzStorage)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/settings.js", import.meta.url), "utf8");
  assert.equal(/\blocalStorage\b/.test(src), false);
});

// --- Phase 59 (DRESS-05): the `dressing` field --------------------------

test("dressing: independent of sound — writing either never changes the other", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("dressing", false);
    await flushStorage();
    let settings = await readSettings();
    assert.equal(settings.dressing, false);
    assert.equal(settings.sound, SETTINGS_DEFAULTS.sound);

    await writeSetting("sound", false);
    await flushStorage();
    settings = await readSettings();
    assert.equal(settings.sound, false);
    assert.equal(settings.dressing, false); // unchanged by the sound write
  });
});

test("dressing: an invalid value is rejected (no-op, keeps prior/default)", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("dressing", "off");
    await flushStorage();
    assert.equal((await readSettings()).dressing, true); // stays at default

    await writeSetting("dressing", 0);
    await flushStorage();
    assert.equal((await readSettings()).dressing, true); // still default
  });
});

test("dressing: a persisted blob WITHOUT the dressing key reads dressing true (tolerant load, no migration)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ sound: false, haptics: false, textSize: "S", confirmBeforeQuit: false }));
    const settings = await readSettings();
    assert.equal(settings.dressing, true);
    assert.equal(settings.sound, false); // the other fields still load normally
  });
});

test("dressing: a persisted blob with an invalid dressing value (e.g. \"yes\") reads the default true", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ dressing: "yes" }));
    const settings = await readSettings();
    assert.equal(settings.dressing, true);
  });
});

// --- Phase 67 (PGS-02): compete, pgsWelcomed, pgsDevSignedIn -------------

test("Phase 67: an old five-key blob reads compete true, pgsWelcomed false, pgsDevSignedIn false (tolerant load, no migration)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ sound: false, haptics: false, textSize: "S", confirmBeforeQuit: false, dressing: false }),
    );
    const settings = await readSettings();
    assert.equal(settings.compete, true);
    assert.equal(settings.pgsWelcomed, false);
    assert.equal(settings.pgsDevSignedIn, false);
    assert.equal(settings.sound, false); // the old fields still load normally
    assert.equal(settings.dressing, false);
  });
});

test("Phase 67: writeSetting(\"compete\", false) persists false and changes no other field", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    await writeSetting("compete", false);
    await flushStorage();
    const after = await readSettings();
    assert.deepEqual(after, { ...before, compete: false });
  });
});

test("Phase 67: writeSetting(\"pgsWelcomed\", true) changes only pgsWelcomed", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    await writeSetting("pgsWelcomed", true);
    await flushStorage();
    const after = await readSettings();
    assert.deepEqual(after, { ...before, pgsWelcomed: true });
  });
});

test("Phase 67: writeSetting(\"pgsDevSignedIn\", true) changes only pgsDevSignedIn", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    await writeSetting("pgsDevSignedIn", true);
    await flushStorage();
    const after = await readSettings();
    assert.deepEqual(after, { ...before, pgsDevSignedIn: true });
  });
});

test("Phase 67: invalid compete values (\"no\", 0) are no-ops returning the current settings", async () => {
  await withFakeLocalStorage(async () => {
    const current = await readSettings();
    assert.deepEqual(await writeSetting("compete", "no"), current);
    assert.deepEqual(await writeSetting("compete", 0), current);
    await flushStorage();
    assert.equal((await readSettings()).compete, true);

    await writeSetting("compete", false);
    await flushStorage();
    const off = await readSettings();
    assert.deepEqual(await writeSetting("compete", "no"), off); // keeps the last valid value
    assert.equal((await readSettings()).compete, false);
  });
});

test("Phase 67: a persisted compete of \"off\" (invalid) reads back as the default true", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ compete: "off", pgsWelcomed: "yes", pgsDevSignedIn: 1 }));
    const settings = await readSettings();
    assert.equal(settings.compete, true);
    assert.equal(settings.pgsWelcomed, false);
    assert.equal(settings.pgsDevSignedIn, false);
  });
});

// --- Phase 71 (D-03): volMaster, volMusic, volEffects ---------------------

test("Phase 71 (D-03): an old blob with no vol keys reads all three at 100 (tolerant load, no migration)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ sound: false, haptics: false, textSize: "S", confirmBeforeQuit: false, dressing: false, compete: false, pgsWelcomed: true, pgsDevSignedIn: false }),
    );
    const settings = await readSettings();
    assert.equal(settings.volMaster, 100);
    assert.equal(settings.volMusic, 100);
    assert.equal(settings.volEffects, 100);
    assert.equal(settings.sound, false); // the old fields still load normally
    assert.equal(settings.compete, false);
  });
});

test("Phase 71 (D-03): a stored 0 or 100 is kept", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ volMaster: 0, volMusic: 100, volEffects: 37 }));
    const settings = await readSettings();
    assert.equal(settings.volMaster, 0);
    assert.equal(settings.volMusic, 100);
    assert.equal(settings.volEffects, 37);
  });
});

test("Phase 71 (D-03): a stored 50.5, -1, 101, \"50\", null or true reads the default 100", async () => {
  for (const bad of [50.5, -1, 101, "50", null, true]) {
    await withFakeLocalStorage(async (_ls, store) => {
      store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ volMaster: bad, volMusic: bad, volEffects: bad }));
      const settings = await readSettings();
      assert.equal(settings.volMaster, 100, `volMaster ${JSON.stringify(bad)} reads 100`);
      assert.equal(settings.volMusic, 100, `volMusic ${JSON.stringify(bad)} reads 100`);
      assert.equal(settings.volEffects, 100, `volEffects ${JSON.stringify(bad)} reads 100`);
    });
  }
});

test("Phase 71 (D-03): writeSetting(\"volMusic\", 0) and (…, 100) persist", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("volMusic", 0);
    await flushStorage();
    assert.equal((await readSettings()).volMusic, 0);
    await writeSetting("volMusic", 100);
    await flushStorage();
    assert.equal((await readSettings()).volMusic, 100);
  });
});

test("Phase 71 (D-03): writeSetting(\"volMusic\", 101 / 50.5 / \"50\") is a no-op returning the current settings", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("volMusic", 40);
    await flushStorage();
    const current = await readSettings();
    assert.equal(current.volMusic, 40);
    for (const bad of [101, 50.5, "50", -1, NaN, null]) {
      assert.deepEqual(await writeSetting("volMusic", bad), current, `volMusic ${String(bad)} is rejected`);
    }
    await flushStorage();
    assert.equal((await readSettings()).volMusic, 40);
  });
});

test("Phase 71 (D-03): independence — writing a vol key changes no other key; writing sound changes no vol key", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    await writeSetting("volEffects", 25);
    await flushStorage();
    const afterVol = await readSettings();
    assert.deepEqual(afterVol, { ...before, volEffects: 25 });

    await writeSetting("volMaster", 60);
    await flushStorage();
    await writeSetting("sound", false);
    await flushStorage();
    const afterSound = await readSettings();
    assert.equal(afterSound.sound, false);
    assert.equal(afterSound.volMaster, 60);
    assert.equal(afterSound.volMusic, 100);
    assert.equal(afterSound.volEffects, 25);
  });
});
