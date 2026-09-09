// test/unit/haptics.test.js
//
// 04-DR9: maybeHaptic() is a guarded, fail-open no-op today (`@capacitor/
// haptics` is not installed/vendored — see src/browser/haptics.js's header
// comment). These tests prove it never throws and never touches anything
// under any settings/Capacitor-presence combination reachable in this repo
// right now (node --test has no `Capacitor` global at all).

import test from "node:test";
import assert from "node:assert/strict";

import { maybeHaptic } from "../../src/browser/haptics.js";

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

test("maybeHaptic: resolves without throwing even when isNativePlatform() reports true (plugin not installed/vendored yet)", async () => {
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = { isNativePlatform: () => true };
  try {
    await assert.doesNotReject(() => maybeHaptic({ haptics: true }));
  } finally {
    if (previous === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = previous;
  }
});
