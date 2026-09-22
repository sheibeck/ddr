// test/unit/sfx-cues.test.js
//
// Phase 58 (MOTION-03/05), Plan 02, D-12 — pins src/browser/sfx.js's
// cuesForDispatch/playClipIds split: clipsForDispatch is now the clip
// projection of cuesForDispatch (never drifting, by construction), each
// cue carries its source event's own index, and playClipIds plays an
// already-resolved clip list through the same device/Sound-Off-guarded
// playClips() path every other clip uses.
//
// Reuses test/unit/sfx.test.js's fake-backend shape
// (globalThis.__mzSfxBackendOverride) and isolates module state the same
// way (an explicit OFF->ON settings round-trip in a `finally`) — the
// established per-file duplication convention in this suite (see
// test/unit/sfx-settings.test.js's own copy of the same helper).

import test from "node:test";
import assert from "node:assert/strict";

import { BESTIARY } from "../../content/bestiary.js";
import {
  CLIP_GROUPS,
  EVENT_CLIP_GROUP,
  createVariation,
  groupsForDispatch,
  cuesForDispatch,
  clipsForDispatch,
  unlockSfx,
  applySfxSettings,
  playClipIds,
  stopAllSfx,
} from "../../src/browser/sfx.js";

// ─── Fake backend (mirrors test/unit/sfx.test.js's makeFakeBackend) ──────

function makeFakeBackend() {
  const calls = { opens: 0, loads: [], starts: [], stops: [], closes: 0 };
  let nextVoice = 0;
  const backend = {
    async open() {
      calls.opens++;
      return { fakeHandle: true };
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      return clipId; // the "buffer" IS the clip id string
    },
    start(handle, buffer) {
      calls.starts.push(buffer);
      return ++nextVoice;
    },
    stop(voice) {
      calls.stops.push(voice);
    },
    close() {
      calls.closes++;
    },
  };
  return { calls, backend };
}

function flushMicrotasks(times = 5) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

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

// ─── Corpus ────────────────────────────────────────────────────────────

function buildCorpus() {
  const cases = [];

  for (const type of Object.keys(EVENT_CLIP_GROUP)) {
    cases.push({ name: `event ${type} alone`, actionType: "combatAction", events: [{ type }], ctx: {} });
  }

  for (const family of Object.keys(BESTIARY)) {
    cases.push({
      name: `combatJoined family ${family}`,
      actionType: "fight",
      events: [{ type: "combatJoined" }],
      ctx: { combatType: family },
    });
  }

  cases.push({ name: "stepped move, no wade", actionType: "move", events: [], ctx: { stepped: true } });
  cases.push({ name: "stepped move, waded", actionType: "move", events: [{ type: "waded" }], ctx: { stepped: true } });
  cases.push({
    name: "stepped move suppressed by a leap",
    actionType: "move",
    events: [{ type: "leaptOver" }],
    ctx: { stepped: true },
  });

  cases.push({
    name: "duplicate struck events de-dupe",
    actionType: "combatAction",
    events: [{ type: "struck" }, { type: "struck" }],
    ctx: {},
  });

  cases.push({
    name: "five mapped events hitting the 3-cap",
    actionType: "combatAction",
    events: [
      { type: "struck" }, { type: "foeKilled" }, { type: "leveled" }, { type: "goldGained" }, { type: "healed" },
    ],
    ctx: {},
  });

  cases.push({ name: "empty events", actionType: "combatAction", events: [], ctx: {} });
  cases.push({ name: "null events", actionType: "combatAction", events: null, ctx: {} });
  cases.push({
    name: "garbage events",
    actionType: "combatAction",
    events: [{}, { foo: "bar" }, "not-an-object", null],
    ctx: {},
  });

  return cases;
}

// ─── cuesForDispatch <-> clipsForDispatch ────────────────────────────────

test("sfx-cues: cuesForDispatch's clip sequence is identical to clipsForDispatch's over a corpus, each given its own fresh variation", () => {
  const cases = buildCorpus();
  for (const { name, actionType, events, ctx } of cases) {
    const vCues = createVariation();
    const vClips = createVariation();
    const cueClips = cuesForDispatch(actionType, events, ctx, vCues).map((c) => c.clip);
    const clips = clipsForDispatch(actionType, events, ctx, vClips);
    assert.deepEqual(cueClips, clips, `${name}: cuesForDispatch's clip projection must equal clipsForDispatch`);
  }
});

test("sfx-cues: over a sequence of ten dispatches sharing one variation, the counter rotates identically to an independent reference fed the same group-id sequence (walk/hit/hurt preserved)", () => {
  const sequence = [
    { actionType: "combatAction", events: [{ type: "struck" }], ctx: {} },
    { actionType: "combatAction", events: [{ type: "strikeMissed" }], ctx: {} },
    { actionType: "combatAction", events: [{ type: "struckByFoe" }], ctx: {} },
    { actionType: "move", events: [], ctx: { stepped: true } },
    { actionType: "move", events: [{ type: "waded" }], ctx: { stepped: true } },
    { actionType: "combatAction", events: [{ type: "struck" }], ctx: {} },
    { actionType: "fight", events: [{ type: "combatJoined" }], ctx: { combatType: "Beasts" } },
    { actionType: "combatAction", events: [{ type: "struckByFoe" }], ctx: {} },
    { actionType: "combatAction", events: [{ type: "struck" }, { type: "foeKilled" }], ctx: {} },
    { actionType: "move", events: [], ctx: { stepped: true } },
  ];

  // The expected clip sequence, computed independently: groupsForDispatch
  // (unaffected by variation) gives the entry ids for each dispatch; a
  // single reference variation instance resolves them IN ORDER, across the
  // whole sequence, the same way cuesForDispatch/clipsForDispatch would.
  const reference = createVariation();
  const expectedPerDispatch = sequence.map(({ actionType, events, ctx }) => {
    const entries = groupsForDispatch(actionType, events, ctx);
    const clips = [];
    for (const entry of entries) {
      const resolved = CLIP_GROUPS[entry] ? reference.next(entry) : entry;
      if (resolved) clips.push(resolved);
    }
    return clips;
  });

  const vCues = createVariation();
  const vClips = createVariation();
  for (let i = 0; i < sequence.length; i++) {
    const { actionType, events, ctx } = sequence[i];
    const cueClips = cuesForDispatch(actionType, events, ctx, vCues).map((c) => c.clip);
    const clips = clipsForDispatch(actionType, events, ctx, vClips);
    assert.deepEqual(cueClips, expectedPerDispatch[i], `dispatch ${i}: cuesForDispatch must advance its shared counter like the reference`);
    assert.deepEqual(clips, expectedPerDispatch[i], `dispatch ${i}: clipsForDispatch must advance its shared counter like the reference`);
  }
});

test("sfx-cues: every cue idx is -1 for the synthesized step clip, else the source event's own index; de-duplicated repeats keep the FIRST occurrence's index", () => {
  const stepCues = cuesForDispatch("move", [{ type: "waded" }], { stepped: true }, createVariation());
  assert.equal(stepCues[0].idx, -1);

  const events = [{ type: "struck" }, { type: "foeKilled" }, { type: "goldGained" }];
  const cues = cuesForDispatch("combatAction", events, {}, createVariation());
  assert.deepEqual(cues.map((c) => c.idx), [0, 1, 2]);

  const dupEvents = [{ type: "goldGained" }, { type: "struck" }, { type: "goldGained" }];
  const dupCues = cuesForDispatch("combatAction", dupEvents, {}, createVariation());
  assert.deepEqual(
    dupCues.map((c) => c.idx),
    [0, 1],
    "the second goldGained must be de-duplicated away, keeping the FIRST occurrence's idx"
  );
});

test("sfx-cues: groupsForDispatch outputs are unchanged for five representative dispatches", () => {
  assert.deepEqual(groupsForDispatch("move", [], { stepped: true }), ["walk"]);
  assert.deepEqual(groupsForDispatch("move", [{ type: "waded" }], { stepped: true }), ["water"]);
  assert.deepEqual(
    groupsForDispatch("combatAction", [
      { type: "struck" }, { type: "foeKilled" }, { type: "leveled" }, { type: "goldGained" },
    ], {}),
    ["hit", "foeDie", "levelup"]
  );
  assert.deepEqual(groupsForDispatch("fight", [{ type: "combatJoined" }], { combatType: "Walking Dead" }), ["enemy-undead"]);
  assert.deepEqual(groupsForDispatch("combatAction", [], {}), []);
});

// ─── playClipIds ─────────────────────────────────────────────────────────

test("sfx-cues: playClipIds(['hit1']) starts exactly one voice after unlock with Sound on; under Sound Off it starts and opens zero", async () => {
  const fakeOn = makeFakeBackend();
  await withFakeBackend(fakeOn, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    playClipIds(["hit1"]);
    assert.deepEqual(fakeOn.calls.starts, ["hit1"]);
  });

  const fakeOff = makeFakeBackend();
  await withFakeBackend(fakeOff, async () => {
    applySfxSettings({ sound: false });
    await unlockSfx();
    playClipIds(["hit1", "hurt1"]);
    assert.equal(fakeOff.calls.opens, 0, "no audio device may be opened while Sound reads Off");
    assert.equal(fakeOff.calls.starts.length, 0);
  });
});

test("sfx-cues: playClipIds(null), playClipIds(\"x\") and playClipIds([42, null]) throw nothing and return undefined", () => {
  assert.equal(playClipIds(null), undefined);
  assert.equal(playClipIds("x"), undefined);
  assert.equal(playClipIds([42, null]), undefined);
  assert.doesNotThrow(() => playClipIds(undefined));
});

// ─── Teeth ─────────────────────────────────────────────────────────────

test("sfx-cues: playClipIds only starts voices for the string ids in a mixed-garbage list", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    playClipIds(["hit1", 42, null, "hurt1", {}]);
    assert.deepEqual(fake.calls.starts, ["hit1", "hurt1"]);
  });
});
