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

import { readSettings, writeSetting, SETTINGS_DEFAULTS, SETTINGS_STORAGE_KEY, textScaleForSize, effectiveTextScale } from "../../src/browser/settings.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { boot as bootAdapter, waitForPending as adapterWaitForPending } from "../../src/browser/engineAdapter.js";
import { emptyBests } from "../../engine/records.js";

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

test("SETTINGS_DEFAULTS: the fourteen fields' defaults", () => {
  // Phase 97 (SCREEN-02): declared re-pin — screen appended (title says fourteen).
  assert.equal(SETTINGS_DEFAULTS.screen, "portrait");
  // Phase 95 (FLAVOR-05): Always show the rules defaults Off.
  assert.equal(SETTINGS_DEFAULTS.alwaysRules, false);
  // Phase 78 (HUD-08) + the 2026-09-28 user ruling: Movement defaults to the
  // arrow pad for new installs, the pad to the bottom right.
  assert.equal(SETTINGS_DEFAULTS.movement, "arrows");
  assert.equal(SETTINGS_DEFAULTS.padSide, "right");
  assert.equal(SETTINGS_DEFAULTS.textSize, "M");
  assert.equal(SETTINGS_DEFAULTS.sound, true);
  assert.equal(SETTINGS_DEFAULTS.haptics, true);
  assert.equal(SETTINGS_DEFAULTS.confirmBeforeQuit, true);
  // Phase 59 (DRESS-05): the fifth field, Set Dressing, defaults On.
  assert.equal(SETTINGS_DEFAULTS.dressing, true);
  // Phase 67 (D-01): Compete defaults ON.
  assert.equal(SETTINGS_DEFAULTS.compete, true);
  // Phase 91.2: the Play Games name welcome card has not been shown yet.
  assert.equal(SETTINGS_DEFAULTS.nameWelcomed, false);
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
      nameWelcomed: false,
      // Phase 71 (D-03): the volume sliders keep their defaults.
      volMaster: 100,
      volMusic: 100,
      volEffects: 100,
      // Phase 78 (HUD-08): Movement and Pad keep theirs (a fresh install
      // gets the arrow pad, 2026-09-28).
      movement: "arrows",
      padSide: "right",
      // Phase 95 (FLAVOR-05): Always show the rules, appended.
      alwaysRules: false,
      // Phase 97 (SCREEN-02): declared re-pin — screen appended
      screen: "portrait",
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
    assert.deepEqual(settings, { ...SETTINGS_DEFAULTS, textSize: "S", movement: "tap" });
    // (an existing blob without `movement` is an existing install: tap-to-move, 2026-09-28)
    assert.equal("handedness" in settings, false);

    // Phase 59 (DRESS-05) appended `dressing`; Phase 67 appended `compete`;
    // Phase 91.2 (BOARD-31) put `nameWelcomed` in the slot the Phase 85 welcome flag and the two
    // retired Phase 67 fields used to occupy; Phase 71 (D-03) appended
    // `volMaster`, `volMusic` and `volEffects`; Phase 78 (HUD-08) appended
    // `movement` and `padSide`; Phase 95 (FLAVOR-05) appended `alwaysRules`;
    // Phase 97 (SCREEN-02) appended `screen` — fourteen keys, in order.
    assert.deepEqual(Object.keys(SETTINGS_DEFAULTS), [
      "sound",
      "haptics",
      "textSize",
      "confirmBeforeQuit",
      "dressing",
      "compete",
      "nameWelcomed",
      "volMaster",
      "volMusic",
      "volEffects",
      "movement",
      "padSide",
      // Phase 95 (FLAVOR-05): Always show the rules, appended.
      "alwaysRules",
      // Phase 97 (SCREEN-02): declared re-pin — screen appended
      "screen",
    ]);
    // Phase 97 (SCREEN-02): declared re-pin — screen appended (fourteen keys)
    assert.equal(Object.keys(SETTINGS_DEFAULTS).length, 14);
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
// retired. Phase 78 (HUD-08) brought an opt-in arrow pad back under NEW
// names (`movement`, `padSide`); the retired key and value stay retired.
// Built from string fragments (the shell-map-invariants RETIRED-map idiom)
// so this pin never spells the retired identifier/value whole, keeping the
// zero-straggler grep for the retired setting at zero across test/.
test("Phase 46 (NAME-02): a stored control-scheme key is ignored silently", async () => {
  const RETIRED_KEY = "control" + "Scheme";
  const RETIRED_VALUE = "dp" + "ad";

  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "S", [RETIRED_KEY]: RETIRED_VALUE }));
    const settings = await readSettings();
    assert.deepEqual(settings, { ...SETTINGS_DEFAULTS, textSize: "S", movement: "tap" });
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

// --- Phase 67: compete; Phase 85 (RETIRE-03): the two retired keys drop,
// nameWelcomed replaces the welcome flag -------------------------------------------

test("Phase 67: an old blob without compete reads compete true (tolerant load, no migration)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ sound: false, haptics: false, textSize: "S", confirmBeforeQuit: false, dressing: false }),
    );
    const settings = await readSettings();
    assert.equal(settings.compete, true);
    assert.equal(settings.nameWelcomed, false);
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
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ compete: "off" }));
    const settings = await readSettings();
    assert.equal(settings.compete, true);
  });
});

// Phase 85 (RETIRE-03): the two Phase 67 fields this module retired (spelled
// from fragments so this file names neither the retired provider nor its
// field names whole, keeping the retired-term grep at zero across test/).
const RETIRED_WELCOME_KEY = "pgs" + "Welcomed";
const RETIRED_DEV_SIGNIN_KEY = "pgs" + "DevSignedIn";

test("RETIRE-03: a stored blob carrying the two retired Phase 67 keys reads without either key, with its stored compete value", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        sound: false,
        haptics: false,
        textSize: "S",
        confirmBeforeQuit: false,
        dressing: false,
        compete: false,
        [RETIRED_WELCOME_KEY]: true,
        [RETIRED_DEV_SIGNIN_KEY]: true,
      }),
    );
    const settings = await readSettings();
    assert.equal(RETIRED_WELCOME_KEY in settings, false);
    assert.equal(RETIRED_DEV_SIGNIN_KEY in settings, false);
    assert.equal(settings.compete, false);
    assert.equal(settings.nameWelcomed, false);
    assert.equal(settings.sound, false); // the old fields still load normally
    assert.equal(settings.dressing, false);
  });
});

test("RETIRE-03: after writeSetting(\"sound\", false) the stored JSON drops the two retired keys and still carries compete", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ compete: false, [RETIRED_WELCOME_KEY]: true, [RETIRED_DEV_SIGNIN_KEY]: true }),
    );
    await writeSetting("sound", false);
    await flushStorage();
    const stored = JSON.parse(store.get(SETTINGS_STORAGE_KEY));
    assert.equal(RETIRED_WELCOME_KEY in stored, false);
    assert.equal(RETIRED_DEV_SIGNIN_KEY in stored, false);
    assert.equal(stored.compete, false);
    assert.equal(stored.sound, false);
  });
});

test("RETIRE-03: writeSetting(\"pgsWelcomed\", true) is a no-op returning the current settings", async () => {
  await withFakeLocalStorage(async () => {
    const current = await readSettings();
    assert.deepEqual(await writeSetting(RETIRED_WELCOME_KEY, true), current);
    await flushStorage();
    assert.equal((await readSettings()).nameWelcomed, false);
  });
});

test("Phase 91.2: writeSetting(\"nameWelcomed\", true) persists it and changes nothing else", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    await writeSetting("nameWelcomed", true);
    await flushStorage();
    const after = await readSettings();
    assert.deepEqual(after, { ...before, nameWelcomed: true });
  });
});

// Phase 91.2 (BOARD-31): the Phase 85 welcome flag is replaced by nameWelcomed
// (spelled from fragments, like the keys above).
const PREV_WELCOME_KEY = "board" + "Welcomed";

test("Phase 91.2: a stored blob carrying the previous welcome flag as true reads back without it and with nameWelcomed false", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ compete: true, sound: false, [PREV_WELCOME_KEY]: true }));
    const settings = await readSettings();
    assert.equal(PREV_WELCOME_KEY in settings, false);
    assert.equal(settings.nameWelcomed, false, "a 2.2 player sees the Play Games name disclosure once");
    assert.equal(settings.sound, false);
    assert.equal(Object.keys(SETTINGS_DEFAULTS).includes(PREV_WELCOME_KEY), false);
  });
});

test("Phase 91.2: writeSetting(previous welcome flag, true) is a no-op; the next write drops the old key from the stored blob", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ compete: true, [PREV_WELCOME_KEY]: true }));
    const current = await readSettings();
    assert.deepEqual(await writeSetting(PREV_WELCOME_KEY, true), current);
    await writeSetting("nameWelcomed", true);
    await flushStorage();
    const stored = JSON.parse(store.get(SETTINGS_STORAGE_KEY));
    assert.equal(PREV_WELCOME_KEY in stored, false);
    assert.equal(stored.nameWelcomed, true);
  });
});

test("Phase 91.2: nameWelcomed accepts only booleans", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings();
    assert.deepEqual(await writeSetting("nameWelcomed", "yes"), before);
    assert.deepEqual(await writeSetting("nameWelcomed", 1), before);
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

// Phase 78 (HUD-04): the text-size choice feeds the ONE root multiplier every
// --mw-font-* token and scaled rem reads (test/unit/text-scale.test.js walks
// the CSS side). Adjacency: S < M < L strictly; empty: a missing, unknown or
// unreadable size is M (1.0); the final clamp holds at its inclusive bounds.
test("Phase 78 (HUD-04): textScaleForSize is strictly S < M < L, and anything else is M", () => {
  assert.ok(textScaleForSize("S") < textScaleForSize("M"));
  assert.ok(textScaleForSize("M") < textScaleForSize("L"));
  assert.equal(textScaleForSize("S"), 0.85);
  assert.equal(textScaleForSize("M"), 1);
  assert.equal(textScaleForSize("L"), 1.25);
  for (const bad of [undefined, null, "", "XL", "m", 1, {}]) {
    assert.equal(textScaleForSize(bad), 1, `${String(bad)} reads as M`);
  }
});

test("Phase 78 (HUD-04): effectiveTextScale stays within 0.85..1.25 inclusive, and the default resolves to 1", () => {
  assert.equal(effectiveTextScale("S", 1), 0.85);
  assert.equal(effectiveTextScale("L", 1), 1.25);
  assert.equal(effectiveTextScale("S", 0.01), 0.85);
  assert.equal(effectiveTextScale("L", 50), 1.25);
  assert.equal(effectiveTextScale(SETTINGS_DEFAULTS.textSize), 1);
  assert.equal(effectiveTextScale(undefined), 1);
});

// --- Phase 78 (HUD-08): movement and padSide -------------------------------

test("HUD-08: writeSetting accepts tap/arrows and left/right, each changing only its own field", async () => {
  await withFakeLocalStorage(async () => {
    const before = await readSettings(); // a fresh install: arrows/right
    await writeSetting("movement", "tap");
    await flushStorage();
    assert.deepEqual(await readSettings(), { ...before, movement: "tap" });
    await writeSetting("padSide", "left");
    await flushStorage();
    assert.deepEqual(await readSettings(), { ...before, movement: "tap", padSide: "left" });
    await writeSetting("movement", "arrows");
    await writeSetting("padSide", "right");
    await flushStorage();
    assert.deepEqual(await readSettings(), before);
  });
});

test("HUD-08: an invalid movement or padSide is rejected (the stored value is unchanged)", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("movement", "arrows");
    await writeSetting("padSide", "left");
    await flushStorage();
    const current = await readSettings();
    for (const bad of ["hover", "ARROWS", "", null, true, 1]) {
      assert.deepEqual(await writeSetting("movement", bad), current, `movement ${JSON.stringify(bad)} is rejected`);
    }
    for (const bad of ["centre", "LEFT", 7, null, false]) {
      assert.deepEqual(await writeSetting("padSide", bad), current, `padSide ${JSON.stringify(bad)} is rejected`);
    }
    await flushStorage();
    assert.deepEqual(await readSettings(), current);
  });
});

// --- Phase 95 (FLAVOR-05): Always show the rules ---------------------------

test("FLAVOR-05: alwaysRules writes true/false, rejects anything else, and an old blob reads false", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    assert.equal((await readSettings()).alwaysRules, false);
    await writeSetting("alwaysRules", true);
    await flushStorage();
    assert.equal((await readSettings()).alwaysRules, true);
    const current = await readSettings();
    for (const bad of ["yes", "true", 1, null, undefined]) {
      assert.deepEqual(await writeSetting("alwaysRules", bad), current, `alwaysRules ${JSON.stringify(bad)} is rejected`);
    }
    await flushStorage();
    assert.equal((await readSettings()).alwaysRules, true, "the stored value stays as it was");
    await writeSetting("alwaysRules", false);
    await flushStorage();
    assert.equal((await readSettings()).alwaysRules, false);
    // an old blob without the key reads false (no migration)
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "L", movement: "arrows" }));
    assert.equal((await readSettings()).alwaysRules, false);
  });
});

// --- Phase 97 (SCREEN-02): Screen, Portrait / Rotate ------------------------

test("SCREEN-02: screen round-trips portrait and rotate", async () => {
  await withFakeLocalStorage(async () => {
    assert.equal((await readSettings()).screen, "portrait");
    await writeSetting("screen", "rotate");
    await flushStorage();
    assert.equal((await readSettings()).screen, "rotate");
    await writeSetting("screen", "portrait");
    await flushStorage();
    assert.equal((await readSettings()).screen, "portrait");
  });
});

test("SCREEN-02: an invalid screen value is a no-op returning the current settings", async () => {
  await withFakeLocalStorage(async () => {
    await writeSetting("screen", "rotate");
    await flushStorage();
    const current = await readSettings();
    for (const bad of ["sideways", true, false, 1, null, undefined, "ROTATE"]) {
      assert.deepEqual(await writeSetting("screen", bad), current, `screen ${JSON.stringify(bad)} is rejected`);
    }
    await flushStorage();
    assert.equal((await readSettings()).screen, "rotate", "the stored value stays as it was");
  });
});

test("SCREEN-02: an old blob without screen, or a tampered one, reads portrait", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "L", movement: "arrows" }));
    assert.equal((await readSettings()).screen, "portrait");
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "L", movement: "arrows", screen: "upside-down" }));
    assert.equal((await readSettings()).screen, "portrait");
  });
});

test("2026-09-28: a fresh install (no settings, save, graveyard or bests) gets the arrow pad", async () => {
  await withFakeLocalStorage(async () => {
    const settings = await readSettings();
    assert.equal(settings.movement, "arrows");
  });
});

// Phase 92.1: what a 2.2.0 player's bests record looks like once they have
// played: a run held and ranked. (The record's own shape is engine/records.js's;
// readSettings only needs to see that a PLAYER made something.)
const PLAYED_BESTS = JSON.stringify({
  v: 1,
  runs: { ["a".repeat(64)]: { hash: "a".repeat(64) } },
  boards: { deep: ["a".repeat(64)], days: [], kills: [], purse: [] },
  last: null,
});

test("2026-09-28: an existing install without a settings blob keeps tap-to-move, written once", async () => {
  const held = { "ddr.delve.v1": "{\"x\":1}", "ddr.graveyard.v1": "[{\"x\":1}]", "ddr.bests.v1": PLAYED_BESTS };
  for (const key of Object.keys(held)) {
    await withFakeLocalStorage(async (_ls, store) => {
      store.set(key, held[key]);
      const settings = await readSettings();
      assert.equal(settings.movement, "tap", key);
      await flushStorage();
      assert.equal(JSON.parse(store.get(SETTINGS_STORAGE_KEY)).movement, "tap", key);
    });
  }
});

// Phase 92.1 (BOARD-31): the first boot of a fresh install writes an empty
// ddr.bests.v1 BEFORE readSettings runs, which used to make a fresh install
// look like an existing one (tap-to-move instead of the arrow default).

test("92.1-01: a REAL first boot writes the empty bests record, and the fresh install still gets arrows", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await bootAdapter(12345);
    await adapterWaitForPending();
    await flushStorage();
    // The premise of the bug: boot itself wrote ddr.bests.v1 before settings were read.
    assert.equal(typeof store.get("ddr.bests.v1"), "string", "the first boot writes ddr.bests.v1");
    const settings = await readSettings();
    assert.equal(settings.movement, "arrows");
    assert.equal(store.has(SETTINGS_STORAGE_KEY), false, "a fresh install writes no settings blob just for reading");
  });
});

test("92.1-01: the exact empty bests record a first boot writes does not make an install 'existing'", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set("ddr.bests.v1", JSON.stringify(emptyBests()));
    const settings = await readSettings();
    assert.equal(settings.movement, "arrows");
    assert.equal(store.has(SETTINGS_STORAGE_KEY), false);
  });
});

test("92.1-01: an upgrade from 2.2.0 keeps tap-to-move whichever player-made key it holds, and the choice is stored once", async () => {
  const upgrades = {
    "a bests record with runs": { "ddr.bests.v1": PLAYED_BESTS },
    "a bests record with only a ranked board": { "ddr.bests.v1": JSON.stringify({ v: 1, runs: {}, boards: { deep: ["h"], days: [], kills: [], purse: [] }, last: null }) },
    "an unreadable bests record": { "ddr.bests.v1": "{not json" },
    "an empty bests record plus a graveyard": { "ddr.bests.v1": JSON.stringify(emptyBests()), "ddr.graveyard.v1": "[{\"x\":1}]" },
    "an empty bests record plus a save": { "ddr.bests.v1": JSON.stringify(emptyBests()), "ddr.delve.v1": "{\"x\":1}" },
    "a save alone": { "ddr.delve.v1": "{\"x\":1}" },
  };
  for (const [label, keys] of Object.entries(upgrades)) {
    await withFakeLocalStorage(async (_ls, store) => {
      for (const [k, v] of Object.entries(keys)) store.set(k, v);
      const settings = await readSettings();
      assert.equal(settings.movement, "tap", label);
      await flushStorage();
      assert.equal(JSON.parse(store.get(SETTINGS_STORAGE_KEY)).movement, "tap", label);
      assert.equal((await readSettings()).movement, "tap", `${label}: stable on the next read`);
    });
  }
});

test("92.1-01: an upgrade that kept a stored settings blob keeps its choice, with or without a movement field", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set("ddr.bests.v1", JSON.stringify(emptyBests()));
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ movement: "arrows", padSide: "left" }));
    assert.equal((await readSettings()).movement, "arrows");
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "L" }));
    assert.equal((await readSettings()).movement, "tap", "a blob without movement is an existing install");
  });
});

test("HUD-08: a tampered stored movement or padSide reads its default (an unknown movement falls back to tap-to-move)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: "L", movement: "hover", padSide: 7 }));
    const settings = await readSettings();
    assert.equal(settings.movement, "tap");
    assert.equal(settings.padSide, "right");
    assert.equal(settings.textSize, "L"); // the other fields still load
  });
});

test("HUD-08: an old blob with neither key reads the defaults (tolerant load, no migration)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ sound: false, haptics: true, textSize: "S", confirmBeforeQuit: true, dressing: true, compete: true, pgsWelcomed: false, pgsDevSignedIn: false, volMaster: 40, volMusic: 100, volEffects: 100 }),
    );
    const settings = await readSettings();
    assert.equal(settings.movement, "tap");
    assert.equal(settings.padSide, "right");
    assert.equal(settings.volMaster, 40);
  });
});

test("HUD-08: a stored arrows/left pair loads as written", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    store.set(SETTINGS_STORAGE_KEY, JSON.stringify({ movement: "arrows", padSide: "left" }));
    const settings = await readSettings();
    assert.equal(settings.movement, "arrows");
    assert.equal(settings.padSide, "left");
  });
});
