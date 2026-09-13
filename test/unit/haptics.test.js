// test/unit/haptics.test.js
//
// maybeHaptic() is the guarded, fail-open haptics seam (src/browser/haptics.js)
// behind the Settings "Haptics" toggle (UX-07). `@capacitor/haptics` is now an
// installed + vendored dependency, but node --test must never resolve the bare
// specifier — so the CALL-ASSERTION tests inject a fake plugin through the
// `__mzHapticsImportOverride` hook (mirroring nativeChrome.js's
// `__mzAppImportOverride`) and prove impact() actually fires when the setting
// is ON and does NOT fire when it is OFF / off-device. The remaining tests keep
// proving it never throws under any settings / Capacitor-presence combination.

import test from "node:test";
import assert from "node:assert/strict";

import { maybeHaptic } from "../../src/browser/haptics.js";

// A fake @capacitor/haptics module: records every impact({style}) call. The
// ImpactStyle map mirrors the real plugin enum (Light/Medium/Heavy → the
// uppercased platform strings) so we can assert the style key mapping too.
function makeFakeHaptics() {
  const calls = [];
  return {
    calls,
    module: {
      Haptics: { impact: async ({ style } = {}) => { calls.push(style); } },
      ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
    },
  };
}

// Runs `fn` with a native-platform Capacitor + an injected fake plugin, then
// restores both globals no matter what.
async function withNativeFakePlugin(fake, fn) {
  const prevCap = globalThis.Capacitor;
  const prevOverride = globalThis.__mzHapticsImportOverride;
  globalThis.Capacitor = { isNativePlatform: () => true };
  globalThis.__mzHapticsImportOverride = async () => fake.module;
  try {
    await fn();
  } finally {
    if (prevCap === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = prevCap;
    if (prevOverride === undefined) delete globalThis.__mzHapticsImportOverride;
    else globalThis.__mzHapticsImportOverride = prevOverride;
  }
}

test("maybeHaptic: resolves without throwing when haptics is off", async () => {
  await assert.doesNotReject(() => maybeHaptic({ haptics: false }));
});

test("maybeHaptic: resolves without throwing when haptics is on but not native (no globalThis.Capacitor)", async () => {
  assert.equal(globalThis.Capacitor, undefined);
  await assert.doesNotReject(() => maybeHaptic({ haptics: true }));
});

test("maybeHaptic: resolves without throwing when settings is missing/undefined", async () => {
  await assert.doesNotReject(() => maybeHaptic(undefined));
  await assert.doesNotReject(() => maybeHaptic(null));
});

test("maybeHaptic: resolves without throwing even when isNativePlatform() reports true (real bare-specifier import path, no override)", async () => {
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = { isNativePlatform: () => true };
  try {
    await assert.doesNotReject(() => maybeHaptic({ haptics: true }));
  } finally {
    if (previous === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = previous;
  }
});

// --- call-assertion: the setting actually gates a real impact() ---------------

test("maybeHaptic: CALLS the plugin's impact() when haptics ON + native", async () => {
  const fake = makeFakeHaptics();
  await withNativeFakePlugin(fake, async () => {
    await maybeHaptic({ haptics: true }, "Medium");
  });
  assert.deepEqual(fake.calls, ["MEDIUM"], "impact() should fire once with the mapped style");
});

test("maybeHaptic: does NOT call impact() when the haptics setting is OFF", async () => {
  const fake = makeFakeHaptics();
  await withNativeFakePlugin(fake, async () => {
    await maybeHaptic({ haptics: false }, "Medium");
  });
  assert.equal(fake.calls.length, 0, "a disabled haptics setting must never reach the plugin");
});

test("maybeHaptic: does NOT call impact() when not on a native platform, even with the fake plugin present", async () => {
  const fake = makeFakeHaptics();
  const prevOverride = globalThis.__mzHapticsImportOverride;
  const prevCap = globalThis.Capacitor;
  globalThis.__mzHapticsImportOverride = async () => fake.module;
  globalThis.Capacitor = { isNativePlatform: () => false };
  try {
    await maybeHaptic({ haptics: true }, "Heavy");
  } finally {
    if (prevOverride === undefined) delete globalThis.__mzHapticsImportOverride;
    else globalThis.__mzHapticsImportOverride = prevOverride;
    if (prevCap === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = prevCap;
  }
  assert.equal(fake.calls.length, 0, "off-device must never reach the plugin");
});

test("maybeHaptic: maps each ImpactStyle key and defaults to Light", async () => {
  const fake = makeFakeHaptics();
  await withNativeFakePlugin(fake, async () => {
    await maybeHaptic({ haptics: true }, "Heavy");
    await maybeHaptic({ haptics: true }, "Light");
    await maybeHaptic({ haptics: true }); // default style
  });
  assert.deepEqual(fake.calls, ["HEAVY", "LIGHT", "LIGHT"]);
});
