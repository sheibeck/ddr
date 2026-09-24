// test/unit/sfx.test.js
//
// Phase 56 Plan 03's player pin — drives unlockSfx()/playForDispatch()/
// playUiTap()/stopAllSfx()/applySfxSettings() entirely through an injected
// fake backend (globalThis.__mzSfxBackendOverride), mirroring
// test/unit/haptics.test.js's structure: a makeFake*() helper recording
// calls, a with*() wrapper that saves and restores every global it touches
// in a `finally`, and one named test per behaviour with explicit teeth.
//
// This file never touches window, never constructs a real audio device, and
// never reaches the filesystem for audio bytes — the fake backend's load()
// resolves the requested clip id string itself as the "buffer" (so
// `calls.starts` is a readable, ordered list of the clip ids that actually
// started a voice), and start() returns a unique incrementing voice token
// (so `calls.stops` can be compared by identity to prove which voice, in
// creation order, was evicted).

import test from "node:test";
import assert from "node:assert/strict";

import {
  CLIP_IDS,
  VOICE_CAP,
  unlockSfx,
  applySfxSettings,
  playForDispatch,
  playUiTap,
  stopAllSfx,
  sfxClipCount,
  startMusic,
} from "../../src/browser/sfx.js";

// ─── Fake backend ────────────────────────────────────────────────────────

/**
 * makeFakeBackend(opts) — a backend implementing the same five-method
 * surface as src/browser/sfx.js's DEFAULT_BACKEND, entirely in-memory:
 *  - opts.nullLoadClips: Set of clip ids whose load() resolves null (the
 *    runtime half of a missing/undecodable asset).
 *  - opts.neverResolveClips: Set of clip ids whose load() returns a promise
 *    that never settles (a still-decoding clip).
 *  - opts.openResolvesNull: open() resolves null (audio unavailable).
 *  - opts.throwEverything: every method throws synchronously.
 */
function makeFakeBackend(opts = {}) {
  const {
    nullLoadClips = new Set(),
    neverResolveClips = new Set(),
    openResolvesNull = false,
    throwEverything = false,
  } = opts;

  const calls = { opens: 0, loads: [], starts: [], stops: [], closes: 0 };
  let nextVoice = 0;

  const backend = {
    async open() {
      calls.opens++;
      if (throwEverything) throw new Error("fake open() throws");
      return openResolvesNull ? null : { fakeHandle: true };
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      if (throwEverything) throw new Error("fake load() throws");
      if (neverResolveClips.has(clipId)) return new Promise(() => {});
      if (nullLoadClips.has(clipId)) return null;
      return clipId; // the "buffer" IS the clip id string
    },
    start(handle, buffer) {
      if (throwEverything) throw new Error("fake start() throws");
      calls.starts.push(buffer);
      return ++nextVoice; // a unique, order-revealing voice token
    },
    stop(voice) {
      if (throwEverything) throw new Error("fake stop() throws");
      calls.stops.push(voice);
    },
    close(handle) {
      calls.closes++;
      if (throwEverything) throw new Error("fake close() throws");
    },
  };

  return { calls, backend };
}

/**
 * flushMicrotasks(times) — unlockSfx() deliberately does NOT await its 30
 * backend.load() calls (decode is off the critical path), so a test that
 * needs the buffer cache populated must let those already-kicked-off
 * promise chains settle first. A handful of microtask ticks is enough for
 * every fake load()/`.then()` pair above to land.
 */
function flushMicrotasks(times = 5) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

/**
 * withFakeBackend(fake, fn) — installs the fake via
 * globalThis.__mzSfxBackendOverride, runs `fn`, and in a `finally` both
 * restores the override AND fully resets sfx.js's module-level state: an
 * explicit OFF->ON settings round-trip forces applySfxSettings' OFF branch
 * to fire (closing the device, clearing the buffer cache) regardless of
 * what state the test left things in. Without this, a later test's
 * unlockSfx() would see a still-truthy deviceHandle left over from THIS
 * test's fake and would never call the next fake's open() at all.
 */
async function withFakeBackend(fake, fn) {
  const prevOverride = globalThis.__mzSfxBackendOverride;
  globalThis.__mzSfxBackendOverride = () => fake.backend;
  try {
    await fn();
  } finally {
    stopAllSfx();
    applySfxSettings({ sound: false });
    applySfxSettings({ sound: true });
    if (prevOverride === undefined) delete globalThis.__mzSfxBackendOverride;
    else globalThis.__mzSfxBackendOverride = prevOverride;
  }
}

// ─── Unlock ──────────────────────────────────────────────────────────────

test("sfx: unlockSfx() with sound on calls open() once and issues exactly 30 load() calls", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    assert.equal(fake.calls.opens, 1);
    assert.equal(fake.calls.loads.length, 30);
    assert.deepEqual([...fake.calls.loads].sort(), [...CLIP_IDS].sort());
  });
});

test("sfx: unlockSfx() is idempotent — three calls still yield exactly one open()", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await unlockSfx();
    await unlockSfx();
    assert.equal(fake.calls.opens, 1);
    assert.equal(fake.calls.loads.length, 30, "a repeat unlock must not re-issue the 30 loads");
  });
});

test("sfx: unlockSfx() throws nothing when open() resolves null, leaves plays silent, and a later call retries open()", async () => {
  const fake = makeFakeBackend({ openResolvesNull: true });
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await assert.doesNotReject(() => unlockSfx());
    assert.equal(fake.calls.opens, 1);
    assert.equal(fake.calls.loads.length, 0, "a null handle must never trigger any load()");

    playForDispatch("combatAction", [{ type: "trapSprung" }], {});
    assert.equal(fake.calls.starts.length, 0, "no device means no voice can start");

    await unlockSfx();
    assert.equal(fake.calls.opens, 2, "a subsequent unlockSfx() must retry open()");
  });
});

// ─── EDGE empty ──────────────────────────────────────────────────────────

test("sfx: EDGE empty — a dispatch carrying zero/unmapped/null events starts zero voices and touches no state", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("move", [], { stepped: false });
    playForDispatch("combatAction", [{ type: "combatEnded" }, { type: "storeOpened" }], {});
    playForDispatch("combatAction", null, {});
    playForDispatch("combatAction", [{}, { foo: "bar" }], {});

    assert.equal(fake.calls.starts.length, 0);
    assert.equal(fake.calls.stops.length, 0);
    assert.equal(fake.calls.closes, 0);
  });
});

// ─── EDGE ordering ───────────────────────────────────────────────────────

test("sfx: EDGE ordering — a multi-event dispatch starts voices in event-array order, never alphabetised", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    // trap/chest/gold alphabetise as chest, gold, trap — deliberately NOT
    // the array order below.
    playForDispatch("combatAction", [
      { type: "trapSprung" }, { type: "chestOpened" }, { type: "goldGained" },
    ], {});
    assert.deepEqual(fake.calls.starts, ["trap", "chest", "gold"]);
  });
});

// ─── EDGE adjacency ──────────────────────────────────────────────────────

test("sfx: EDGE adjacency — two identical events in one dispatch start a single voice; the same event across dispatches rotates", async () => {
  // "hit"'s variation counter is a module-level shared instance (56-02's
  // defaultVariation), so this test asserts the RELATIVE rotation contract
  // (one voice per duplicate, a different sample next dispatch) rather than
  // hardcoding which of hit1/hit2 comes first — a hard-coded literal here
  // would be order-dependent on every other test in this file that also
  // resolves a "struck" event.
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "struck" }, { type: "struck" }], {});
    assert.equal(fake.calls.starts.length, 1, "two struck events in ONE dispatch must start only one voice");
    const first = fake.calls.starts[0];
    assert.ok(["hit1", "hit2"].includes(first));

    playForDispatch("combatAction", [{ type: "struck" }], {});
    assert.equal(fake.calls.starts.length, 2);
    const second = fake.calls.starts[1];
    assert.ok(["hit1", "hit2"].includes(second));
    assert.notEqual(second, first, "the same event across two consecutive dispatches must not sound identical");
  });
});

// ─── EDGE cap boundary ───────────────────────────────────────────────────

test("sfx: EDGE cap boundary — the 9th voice stops the oldest; 12 total leaves 4 stopped and 8 live", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    // Nine distinct single-clip groups via nine separate dispatches — a
    // single dispatch is bounded at DISPATCH_CLIP_CAP (3), so repeated
    // single-event dispatches are used instead of one over-cap dispatch.
    const nine = ["foeKilled", "spellThrown", "trapSprung", "leaptOver", "floorChanged", "leveled", "died", "potionDrunk", "healed"];
    for (const type of nine) playForDispatch("combatAction", [{ type }], {});

    assert.equal(fake.calls.starts.length, 9);
    assert.equal(fake.calls.stops.length, 1, "starting the 9th voice must stop exactly one");
    assert.equal(fake.calls.stops[0], 1, "the stopped voice must be voice token 1 — the FIRST one started");

    const three = ["chestOpened", "goldGained", "struck"];
    for (const type of three) playForDispatch("combatAction", [{ type }], {});

    assert.equal(fake.calls.starts.length, 12);
    assert.equal(fake.calls.stops.length, 4);
    assert.equal(fake.calls.starts.length - fake.calls.stops.length, 8, "8 voices should remain live");
    assert.deepEqual(fake.calls.stops, [1, 2, 3, 4], "eviction order must follow start order, oldest first");
  });
});

// ─── EDGE decode-in-flight ───────────────────────────────────────────────

test("sfx: EDGE decode-in-flight — a clip still decoding is dropped, not queued, and never played once it belatedly resolves", async () => {
  // "spell" is a size-1 group (single clip "spell"), so its resolved clip
  // id is stable regardless of any other test's shared-counter state —
  // unlike a multi-clip group such as "hit", it needs no rotation-order
  // reasoning to pin exactly which clip id is the one still decoding.
  const fake = makeFakeBackend({ neverResolveClips: new Set(["spell"]) });
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "spellThrown" }, { type: "foeKilled" }], {});
    assert.deepEqual(fake.calls.starts, ["foe-die"], "spell (still decoding) must be dropped; foe-die must still start");

    // Waiting longer does not cause a delayed start — the drop is
    // permanent, not a queue.
    await flushMicrotasks(10);
    assert.deepEqual(fake.calls.starts, ["foe-die"], "a still-decoding clip must never start late");

    // A later dispatch for the SAME event is dropped again too — never
    // replayed from some retry queue.
    playForDispatch("combatAction", [{ type: "spellThrown" }], {});
    assert.deepEqual(fake.calls.starts, ["foe-die"], "the still-decoding clip must be dropped again, never replayed");
  });
});

// ─── EDGE missing asset ──────────────────────────────────────────────────

test("sfx: EDGE missing asset — a clip whose load() resolves null is silently skipped while the rest still start", async () => {
  const fake = makeFakeBackend({ nullLoadClips: new Set(["gold"]) });
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "goldGained" }, { type: "chestOpened" }], {});
    assert.deepEqual(fake.calls.starts, ["chest"], "gold's null-resolving load() must never start a voice");
  });
});

// ─── playUiTap ───────────────────────────────────────────────────────────

test("sfx: playUiTap() plays the uiTap group through the same playClips() path", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playUiTap();
    assert.deepEqual(fake.calls.starts, ["ui-tap"]);
  });
});

// ─── stopAllSfx ──────────────────────────────────────────────────────────

test("sfx: stopAllSfx() stops every live voice and empties the FIFO", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "struck" }, { type: "foeKilled" }, { type: "goldGained" }], {});
    assert.equal(fake.calls.starts.length, 3);
    assert.equal(fake.calls.stops.length, 0);

    stopAllSfx();
    assert.equal(fake.calls.stops.length, 3, "every live voice must be stopped");

    // The FIFO is now empty — a fresh 9-voice burst evicts only once again,
    // proving stopAllSfx() actually cleared the pool rather than merely
    // silencing it.
    const nine = ["foeKilled", "spellThrown", "trapSprung", "leaptOver", "floorChanged", "leveled", "died", "potionDrunk", "healed"];
    for (const type of nine) playForDispatch("combatAction", [{ type }], {});
    assert.equal(fake.calls.stops.length, 4, "3 (drained) + 1 (fresh 9th-voice eviction)");
  });
});

// ─── applySfxSettings toggle boundary ───────────────────────────────────

test("sfx: applySfxSettings OFF stops in-flight voices immediately and tears the device down; ON before a gesture stays silent", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    playForDispatch("combatAction", [{ type: "struck" }], {});
    assert.equal(fake.calls.starts.length, 1);
    assert.equal(fake.calls.stops.length, 0);
    assert.equal(fake.calls.closes, 0);

    applySfxSettings({ sound: false });
    assert.equal(fake.calls.stops.length, 1, "the in-flight voice must stop IMMEDIATELY on the OFF transition");
    assert.equal(fake.calls.closes, 1, "the device must be torn down on the OFF transition");

    // Flipping back ON must NOT reopen anything by itself — silent but
    // error-free until the next user-gesture-driven unlockSfx() call.
    applySfxSettings({ sound: true });
    assert.equal(fake.calls.opens, 1, "an ON transition alone must never call open() again");
    playForDispatch("combatAction", [{ type: "struck" }], {});
    assert.equal(fake.calls.starts.length, 1, "no device is open, so no new voice can start yet");
  });
});

// ─── Never throws ────────────────────────────────────────────────────────

test("sfx: playForDispatch/playUiTap/stopAllSfx/applySfxSettings never throw before any unlock", () => {
  assert.doesNotThrow(() => playForDispatch("combatAction", [{ type: "struck" }], {}));
  assert.doesNotThrow(() => playUiTap());
  assert.doesNotThrow(() => stopAllSfx());
  assert.doesNotThrow(() => applySfxSettings({ sound: true }));
  assert.doesNotThrow(() => applySfxSettings(undefined));
});

test("sfx: never throws with a backend whose every method throws", async () => {
  const fake = makeFakeBackend({ throwEverything: true });
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await assert.doesNotReject(() => unlockSfx());
    assert.doesNotThrow(() => playForDispatch("combatAction", [{ type: "struck" }], {}));
    assert.doesNotThrow(() => playUiTap());
    assert.doesNotThrow(() => stopAllSfx());
    assert.doesNotThrow(() => applySfxSettings({ sound: false }));
  });
});

test("sfx: never throws with garbage arguments", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    assert.doesNotThrow(() => playForDispatch(123, "not-an-array", null));
    assert.doesNotThrow(() => playForDispatch(undefined, undefined, undefined));
    assert.doesNotThrow(() => playForDispatch("combatAction", [{ type: 42 }, "garbage", null], {}));
  });
});

// ─── Teeth ───────────────────────────────────────────────────────────────

test("sfx: TEETH — the cap-boundary assertion actually distinguishes a capped pool from an uncapped one", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    assert.equal(VOICE_CAP, 8, "this teeth case assumes the documented cap of 8");

    const nine = ["foeKilled", "spellThrown", "trapSprung", "leaptOver", "floorChanged", "leveled", "died", "potionDrunk", "healed"];
    for (const type of nine) playForDispatch("combatAction", [{ type }], {});

    assert.equal(fake.calls.starts.length, 9, "9 voices should have been requested");
    // The teeth: under a real cap, exactly one stop must have fired. If a
    // future edit silently removed the eviction (an uncapped pool of 9),
    // this is what would catch it — stops.length would read 0, not 1.
    assert.notEqual(fake.calls.stops.length, 0, "an uncapped voice pool would leave stops empty — this must never be true");
    assert.equal(fake.calls.stops.length, 1);
  });
});

// ─── Phase 71 (D-15, R-26): sfxClipCount, the one-sound-per-press probe ──
//
// Module state is shared across this file, so every case asserts DELTAS.

test("sfx (71-07 D-15): sfxClipCount is a whole number that rises by one per started one-shot voice", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    const before0 = sfxClipCount();
    assert.ok(Number.isInteger(before0) && before0 >= 0);
    playUiTap();
    assert.equal(sfxClipCount(), before0, "no device open yet: nothing started, nothing counted");

    await unlockSfx();
    await flushMicrotasks();
    const a = sfxClipCount();
    playUiTap();
    assert.equal(sfxClipCount(), a + 1, "a playUiTap adds 1");
    const b = sfxClipCount();
    playForDispatch("combatAction", [{ type: "trapSprung" }, { type: "chestOpened" }], {});
    assert.equal(fake.calls.starts.slice(-2).length, 2);
    assert.equal(sfxClipCount(), b + 2, "a dispatch that starts 2 voices adds 2");
  });
});

test("sfx (71-07 D-15): sfxClipCount does not move for Sound Off, and Sound Off never resets it", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    playUiTap();
    const a = sfxClipCount();
    applySfxSettings({ sound: false });
    assert.equal(sfxClipCount(), a, "Sound Off does not reset the counter");
    playUiTap();
    playForDispatch("combatAction", [{ type: "struck" }], {});
    assert.equal(sfxClipCount(), a);
  });
});

test("sfx (71-07 D-15): sfxClipCount does not move for a missing buffer", async () => {
  const fake = makeFakeBackend({ nullLoadClips: new Set(["ui-tap"]) });
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    const a = sfxClipCount();
    playUiTap();
    assert.equal(sfxClipCount(), a);
  });
});

test("sfx (71-07 D-15): sfxClipCount does not move when start() throws or returns null", async () => {
  for (const mode of ["throws", "null"]) {
    const fake = makeFakeBackend();
    fake.backend.start = () => {
      if (mode === "throws") throw new Error("fake start() throws");
      return null;
    };
    await withFakeBackend(fake, async () => {
      applySfxSettings({ sound: true });
      await unlockSfx();
      await flushMicrotasks();
      const a = sfxClipCount();
      playUiTap();
      playForDispatch("combatAction", [{ type: "struck" }], {});
      assert.equal(sfxClipCount(), a, mode);
    });
  }
});

test("sfx (71-07 D-15): the title theme's loop is not a one-shot — startMusic never moves sfxClipCount", async () => {
  const fake = makeFakeBackend();
  let loops = 0;
  fake.backend.startLoop = () => { loops++; return { loop: true }; };
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    const a = sfxClipCount();
    startMusic();
    assert.equal(loops, 1, "the loop really started");
    assert.equal(sfxClipCount(), a);
  });
});
