// test/unit/sfx-levels.test.js
//
// Phase 71 (POLISH-05; D-01, D-02, D-03): the sound-level layer in
// src/browser/sfx.js.
//
//  - D-01: ONE frozen CLIP_GAIN table keyed by clip id (death 0.5, the six
//    step clips 1.6, everything else the 1.0 default), read through
//    clipGain(id), applied per voice BEFORE the effects bus. foe-die keeps
//    the default: the hero-death cue is `death` (the `died` event), and
//    foe-die is `foeKilled` (R-03).
//  - D-02: MUSIC_GAIN is 0.9, still below the one-shots' unity level.
//  - D-03: volumeLevels(settings) turns the volMaster / volMusic / volEffects
//    integers (0-100) into gains; the device gets them through the OPTIONAL
//    backend.setLevels, a live loop through the OPTIONAL backend.setLoopLevel,
//    and startMusic passes MUSIC_GAIN * music to startLoop.
//
// Part A drives the module through an injected fake backend
// (globalThis.__mzSfxBackendOverride); Part B drives the REAL DEFAULT_BACKEND
// against a fake AudioContext / Audio on a fake `window`. The fake shapes are
// copied from test/unit/sfx-music.test.js (never imported from another test
// file), with a createBufferSource added for the one-shot path.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CLIP_IDS,
  CLIP_GAIN,
  clipGain,
  volumeLevels,
  MUSIC_GAIN,
  unlockSfx,
  startMusic,
  stopMusic,
  stopAllSfx,
  applySfxSettings,
  playClipIds,
  playUiTap,
  playForDispatch,
} from "../../src/browser/sfx.js";

function flushMicrotasks(times = 16) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

function resetSfxState() {
  stopAllSfx();
  applySfxSettings({ sound: false });
  applySfxSettings({ sound: true });
}

// ─── D-01: CLIP_GAIN / clipGain ──────────────────────────────────────────

test("sfx-levels (D-01): CLIP_GAIN is frozen, keyed only by real CLIP_IDS, every value finite in (0, 2]", () => {
  assert.ok(Object.isFrozen(CLIP_GAIN));
  for (const [id, v] of Object.entries(CLIP_GAIN)) {
    assert.ok(CLIP_IDS.includes(id), `CLIP_GAIN key ${id} must be a real clip id`);
    assert.equal(typeof v, "number");
    assert.ok(Number.isFinite(v), `${id} is finite`);
    assert.ok(v > 0 && v <= 2, `${id} = ${v} must sit in (0, 2]`);
  }
});

test("sfx-levels (D-01): death is 0.5, the six step clips are 1.6, foe-die has no entry (R-03)", () => {
  assert.equal(CLIP_GAIN.death, 0.5);
  for (const id of ["walk1", "walk2", "walk3", "walk-water1", "walk-water2", "walk-water3"]) {
    assert.equal(CLIP_GAIN[id], 1.6, `${id} is 1.6`);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(CLIP_GAIN, "foe-die"), false);
  assert.equal(clipGain("foe-die"), 1.0);
});

test("sfx-levels (D-01): clipGain reads the table, defaults to 1.0 for any other id or garbage", () => {
  assert.equal(clipGain("death"), 0.5);
  assert.equal(clipGain("walk2"), 1.6);
  assert.equal(clipGain("hit1"), 1.0);
  assert.equal(clipGain("ui-tap"), 1.0);
  for (const bad of ["nope", "", null, undefined, 42, {}, [], "toString", "__proto__", "constructor"]) {
    assert.equal(clipGain(bad), 1.0, `clipGain(${String(bad)}) is 1.0`);
  }
  for (const id of CLIP_IDS) {
    const g = clipGain(id);
    assert.ok(Number.isFinite(g) && g > 0 && g <= 2, `${id} resolves into (0, 2]`);
  }
});

// ─── D-02: MUSIC_GAIN ────────────────────────────────────────────────────

test("sfx-levels (D-02): MUSIC_GAIN is 0.9, still below the one-shots' unity level", () => {
  assert.equal(MUSIC_GAIN, 0.9);
  assert.ok(MUSIC_GAIN > 0 && MUSIC_GAIN < 1);
});

// ─── D-03: volumeLevels ──────────────────────────────────────────────────

test("sfx-levels (D-03): volumeLevels divides each 0-100 integer by 100 and freezes the result", () => {
  const lv = volumeLevels({ volMaster: 40, volMusic: 50, volEffects: 20 });
  assert.deepEqual({ ...lv }, { master: 0.4, music: 0.5, effects: 0.2 });
  assert.ok(Object.isFrozen(lv));
  assert.deepEqual({ ...volumeLevels({ volMaster: 0, volMusic: 0, volEffects: 0 }) }, { master: 0, music: 0, effects: 0 });
  assert.deepEqual({ ...volumeLevels({ volMaster: 100, volMusic: 100, volEffects: 100 }) }, { master: 1, music: 1, effects: 1 });
});

test("sfx-levels (D-03): a missing key, null/undefined settings, or a non-integer/out-of-range/string/NaN value reads 1.0", () => {
  for (const s of [null, undefined, {}, { sound: true }, "nope", 7]) {
    assert.deepEqual({ ...volumeLevels(s) }, { master: 1, music: 1, effects: 1 });
  }
  for (const bad of [50.5, -1, 101, "50", NaN, Infinity, null, true]) {
    const lv = volumeLevels({ volMaster: bad, volMusic: bad, volEffects: bad });
    assert.deepEqual({ ...lv }, { master: 1, music: 1, effects: 1 }, `value ${String(bad)} reads 1.0`);
  }
});

test("sfx-levels (D-03): volumeLevels is pure — same input, deep-equal output, input untouched", () => {
  const s = { sound: true, volMaster: 30, volMusic: 70, volEffects: 90 };
  const copy = { ...s };
  assert.deepEqual(volumeLevels(s), volumeLevels(s));
  assert.deepEqual(s, copy);
});

// ─── Part A: fake backend ────────────────────────────────────────────────

function makeFakeBackend({ levels = true, music = true, gainArg = true } = {}) {
  const calls = { order: [], starts: [], loads: [], levels: [], loopLevels: [], loops: [], fades: [], closes: 0, opens: 0 };
  let nextHandle = 0;
  let nextVoice = 0;
  const backend = {
    async open() {
      calls.opens++;
      const h = { fakeHandle: ++nextHandle };
      calls.order.push({ kind: "open", handle: h });
      return h;
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      calls.order.push({ kind: "load", clipId });
      return clipId;
    },
    start: gainArg
      ? (handle, buffer, gain) => {
          calls.starts.push({ buffer, gain });
          return { oneShot: ++nextVoice };
        }
      : (handle, buffer) => {
          calls.starts.push({ buffer });
          return { oneShot: ++nextVoice };
        },
    stop() {},
    close() {
      calls.closes++;
    },
  };
  if (levels) {
    backend.setLevels = (handle, lv) => {
      calls.levels.push({ handle, lv: { ...lv } });
      calls.order.push({ kind: "setLevels" });
    };
    backend.setLoopLevel = (handle, voice, gain) => {
      calls.loopLevels.push({ handle, voice, gain });
    };
  }
  if (music) {
    backend.startLoop = (handle, trackId, gain) => {
      calls.loops.push({ handle, trackId, gain });
      return { loop: ++nextVoice, trackId };
    };
    backend.resumeLoop = () => {};
    backend.fadeOut = (handle, voice, ms) => {
      calls.fades.push({ voice, ms });
    };
  }
  return { calls, backend };
}

async function withFakeBackend(fake, fn) {
  const prev = globalThis.__mzSfxBackendOverride;
  globalThis.__mzSfxBackendOverride = () => fake.backend;
  try {
    await fn();
  } finally {
    resetSfxState();
    if (prev === undefined) delete globalThis.__mzSfxBackendOverride;
    else globalThis.__mzSfxBackendOverride = prev;
  }
}

async function unlockedWith(settings) {
  applySfxSettings(settings);
  await unlockSfx();
  await flushMicrotasks();
}

test("sfx-levels (D-01): every one-shot path hands start() its clipGain as the third argument", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true });
    playClipIds(["death"]);
    playClipIds(["walk2"]);
    playClipIds(["hit1"]);
    assert.deepEqual(fake.calls.starts.map((s) => [s.buffer, s.gain]), [
      ["death", 0.5],
      ["walk2", 1.6],
      ["hit1", 1.0],
    ]);

    fake.calls.starts.length = 0;
    playUiTap();
    assert.equal(fake.calls.starts.length, 1);
    assert.equal(fake.calls.starts[0].gain, clipGain(fake.calls.starts[0].buffer));

    fake.calls.starts.length = 0;
    playForDispatch("move", [], { stepped: true });
    assert.equal(fake.calls.starts.length, 1);
    assert.ok(fake.calls.starts[0].buffer.startsWith("walk"));
    assert.equal(fake.calls.starts[0].gain, 1.6);

    fake.calls.starts.length = 0;
    playForDispatch("move", [{ type: "waded" }], { stepped: true });
    assert.ok(fake.calls.starts[0].buffer.startsWith("walk-water"));
    assert.equal(fake.calls.starts[0].gain, 1.6);
  });
});

test("sfx-levels: a legacy five-method fake whose start ignores the gain still plays", async () => {
  const fake = makeFakeBackend({ levels: false, music: false, gainArg: false });
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 10, volEffects: 10 });
    assert.doesNotThrow(() => playClipIds(["death", "hit1"]));
    assert.deepEqual(fake.calls.starts.map((s) => s.buffer), ["death", "hit1"]);
    assert.doesNotThrow(() => applySfxSettings({ sound: true, volMaster: 50 }));
    assert.doesNotThrow(() => startMusic());
  });
});

test("sfx-levels (D-03): the unlock hands the new device its levels right after open, before the clip loads", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 40, volMusic: 50, volEffects: 20 });
    assert.equal(fake.calls.levels.length, 1);
    assert.deepEqual(fake.calls.levels[0].handle, { fakeHandle: 1 });
    assert.deepEqual(fake.calls.levels[0].lv, { master: 0.4, effects: 0.2 });
    const kinds = fake.calls.order.map((e) => e.kind);
    assert.ok(kinds.indexOf("open") < kinds.indexOf("setLevels"));
    assert.ok(kinds.indexOf("setLevels") < kinds.indexOf("load"), "levels land before the first clip load");
  });
});

test("sfx-levels (D-03): a changed vol key while the device is open re-applies setLevels at once", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 40, volMusic: 50, volEffects: 20 });
    applySfxSettings({ sound: true, volMaster: 0, volMusic: 50, volEffects: 100 });
    const last = fake.calls.levels.at(-1);
    assert.deepEqual(last.lv, { master: 0, effects: 1 });
    assert.deepEqual(last.handle, { fakeHandle: 1 });
  });
});

test("sfx-levels (D-03): with no device open, a settings change calls nothing", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true, volMaster: 10 });
    assert.equal(fake.calls.levels.length, 0);
  });
});

test("sfx-levels (D-03): startMusic passes MUSIC_GAIN * music; no vol keys pass exactly MUSIC_GAIN", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 40, volMusic: 50, volEffects: 20 });
    startMusic();
    assert.equal(fake.calls.loops.length, 1);
    assert.equal(fake.calls.loops[0].gain, MUSIC_GAIN * 0.5);
    assert.equal(fake.calls.loops[0].gain, 0.45);
    stopMusic();
    applySfxSettings({ sound: true });
    startMusic();
    assert.equal(fake.calls.loops[1].gain, MUSIC_GAIN);
  });
});

test("sfx-levels (D-03): a changed volMusic re-levels a live loop through setLoopLevel; a fading loop is never re-levelled", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMusic: 100 });
    startMusic();
    assert.equal(fake.calls.loops.length, 1);
    applySfxSettings({ sound: true, volMusic: 0 });
    assert.equal(fake.calls.loopLevels.length, 1);
    assert.equal(fake.calls.loopLevels[0].gain, 0);
    assert.equal(fake.calls.loopLevels[0].voice.trackId, "theme");
    assert.deepEqual(fake.calls.loopLevels[0].handle, { fakeHandle: 1 });
    applySfxSettings({ sound: true, volMusic: 50 });
    assert.equal(fake.calls.loopLevels.at(-1).gain, MUSIC_GAIN * 0.5);

    stopMusic({ fadeMs: 500 });
    const before = fake.calls.loopLevels.length;
    applySfxSettings({ sound: true, volMusic: 100 });
    assert.equal(fake.calls.loopLevels.length, before, "a fading (stopped) loop is never re-levelled");
  });
});

test("sfx-levels (D-03): a backend without setLevels/setLoopLevel never throws on a level change", async () => {
  const fake = makeFakeBackend({ levels: false });
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 40 });
    startMusic();
    assert.doesNotThrow(() => applySfxSettings({ sound: true, volMaster: 0, volMusic: 0, volEffects: 0 }));
    assert.equal(fake.calls.loops[0].gain, MUSIC_GAIN);
  });
});

test("sfx-levels (D-03): a throwing setLevels/setLoopLevel is swallowed", async () => {
  const fake = makeFakeBackend();
  fake.backend.setLevels = () => {
    throw new Error("boom");
  };
  fake.backend.setLoopLevel = () => {
    throw new Error("boom");
  };
  await withFakeBackend(fake, async () => {
    await unlockedWith({ sound: true, volMaster: 40 });
    startMusic();
    assert.doesNotThrow(() => applySfxSettings({ sound: true, volMusic: 10 }));
    playClipIds(["hit1"]);
    assert.equal(fake.calls.starts.length, 1, "the device still plays after a failed level write");
  });
});

test("sfx-levels (D-03): Sound Off then On then unlock — the Off still closes the device, On opens nothing, and the NEW device gets the saved levels", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    const saved = { volMaster: 30, volMusic: 60, volEffects: 70 };
    await unlockedWith({ sound: true, ...saved });
    applySfxSettings({ sound: false, ...saved });
    assert.equal(fake.calls.closes, 1);
    const levelsAfterOff = fake.calls.levels.length;
    applySfxSettings({ sound: true, ...saved });
    assert.equal(fake.calls.opens, 1, "On alone opens nothing");
    assert.equal(fake.calls.levels.length, levelsAfterOff, "no device, no level write");
    await unlockSfx();
    await flushMicrotasks();
    assert.equal(fake.calls.opens, 2);
    const last = fake.calls.levels.at(-1);
    assert.deepEqual(last.handle, { fakeHandle: 2 });
    assert.deepEqual(last.lv, { master: 0.3, effects: 0.7 });
  });
});

// ─── Part B: the real DEFAULT_BACKEND ───────────────────────────────────

function makeFakeParam(initial) {
  return {
    value: initial,
    log: [],
    cancelScheduledValues(t) {
      this.log.push(["cancel", t]);
    },
    setValueAtTime(v, t) {
      this.log.push(["set", v, t]);
      this.value = v;
    },
    linearRampToValueAtTime(v, t) {
      this.log.push(["ramp", v, t]);
    },
  };
}

function makeAudioWorld({ mediaSource = true } = {}) {
  const world = { contexts: [], elements: [], mediaSources: [], bufferSources: [] };

  class FakeAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 10;
      this.destination = { destination: true };
      this.gains = [];
      if (mediaSource) {
        this.createMediaElementSource = (el) => {
          const src = {
            el,
            connectedTo: null,
            connect(node) {
              this.connectedTo = node;
            },
          };
          world.mediaSources.push(src);
          return src;
        };
      }
      world.contexts.push(this);
    }
    resume() {
      return Promise.resolve();
    }
    createGain() {
      const node = {
        gain: makeFakeParam(1),
        connectedTo: null,
        connect(n) {
          this.connectedTo = n;
        },
      };
      this.gains.push(node);
      return node;
    }
    createBufferSource() {
      const src = {
        buffer: null,
        connectedTo: null,
        started: null,
        connect(n) {
          this.connectedTo = n;
        },
        start(t) {
          this.started = t;
        },
        stop() {},
      };
      world.bufferSources.push(src);
      return src;
    }
    async decodeAudioData(bytes) {
      return { decoded: bytes.clip };
    }
    close() {}
  }

  class FakeAudio {
    constructor() {
      this.loop = false;
      this.src = "";
      this.paused = true;
      this.currentTime = 0;
      this.volume = 1;
      world.elements.push(this);
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {}
    load() {}
  }

  world.FakeAudioContext = FakeAudioContext;
  world.FakeAudio = FakeAudio;
  return world;
}

async function withDefaultBackend(world, fn) {
  const prevWindow = globalThis.window;
  const prevAudio = globalThis.Audio;
  const prevFetch = globalThis.fetch;
  const prevOverride = globalThis.__mzSfxBackendOverride;
  delete globalThis.__mzSfxBackendOverride;
  globalThis.window = { AudioContext: world.FakeAudioContext };
  globalThis.Audio = world.FakeAudio;
  globalThis.fetch = async (u) => {
    const clip = String(u).replace("./sfx/", "").replace(".mp3", "");
    return { ok: true, arrayBuffer: async () => ({ clip }) };
  };
  try {
    await fn();
  } finally {
    resetSfxState();
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = prevAudio;
    globalThis.fetch = prevFetch;
    if (prevOverride !== undefined) globalThis.__mzSfxBackendOverride = prevOverride;
  }
}

function masterOf(ctx) {
  return ctx.gains.find((g) => g.connectedTo === ctx.destination);
}

// The effects bus: the gain wired into the master that is NOT the theme's
// music gain (the one a media-element source feeds).
function effectsOf(ctx, world) {
  const master = masterOf(ctx);
  const musicGains = new Set((world?.mediaSources || []).map((s) => s.connectedTo));
  return ctx.gains.find((g) => g !== master && g.connectedTo === master && !musicGains.has(g));
}

test("sfx-levels (default backend): open() builds master -> destination and effects -> master", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    const ctx = world.contexts[0];
    const master = masterOf(ctx);
    assert.ok(master, "a master gain connected to the destination");
    const effects = ctx.gains.find((g) => g.connectedTo === master);
    assert.ok(effects, "an effects gain connected to the master");
    assert.notEqual(effects, master);
  });
});

test("sfx-levels (default backend): a one-shot routes source -> per-voice gain at clipGain -> effects bus", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks(40);
    const ctx = world.contexts[0];
    const effects = effectsOf(ctx, world);
    assert.ok(effects);

    playClipIds(["death"]);
    assert.equal(world.bufferSources.length, 1);
    const src = world.bufferSources[0];
    assert.deepEqual(src.buffer, { decoded: "death" });
    const voiceGain = src.connectedTo;
    assert.ok(ctx.gains.includes(voiceGain), "the source feeds a gain node");
    assert.equal(voiceGain.gain.value, 0.5);
    assert.equal(voiceGain.connectedTo, effects, "the per-voice gain feeds the effects bus");
    assert.equal(src.started, 10);

    playClipIds(["walk1"]);
    assert.equal(world.bufferSources[1].connectedTo.gain.value, 1.6);
    playClipIds(["hit1"]);
    assert.equal(world.bufferSources[2].connectedTo.gain.value, 1.0);
  });
});

test("sfx-levels (default backend): setLevels writes the master and effects gain values", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    await unlockedWith({ sound: true, volMaster: 40, volEffects: 20 });
    const ctx = world.contexts[0];
    const master = masterOf(ctx);
    const effects = effectsOf(ctx, world);
    assert.equal(master.gain.value, 0.4);
    assert.equal(effects.gain.value, 0.2);
    applySfxSettings({ sound: true, volMaster: 0, volEffects: 100 });
    assert.equal(master.gain.value, 0);
    assert.equal(effects.gain.value, 1);
  });
});

test("sfx-levels (default backend): the theme's gain feeds the master, NOT the effects bus (R-04); setLoopLevel sets it live", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    await unlockedWith({ sound: true, volMusic: 50 });
    startMusic();
    const ctx = world.contexts[0];
    const master = masterOf(ctx);
    const musicGain = world.mediaSources[0].connectedTo;
    assert.equal(musicGain.connectedTo, master);
    assert.equal(musicGain.gain.value, MUSIC_GAIN * 0.5);
    applySfxSettings({ sound: true, volMusic: 100 });
    assert.equal(musicGain.gain.value, MUSIC_GAIN);
    applySfxSettings({ sound: true, volMusic: 0 });
    assert.equal(musicGain.gain.value, 0);
  });
});

test("sfx-levels (default backend): setLoopLevel does nothing while a fade is pending", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    await unlockedWith({ sound: true, volMusic: 100 });
    startMusic();
    const musicGain = world.mediaSources[0].connectedTo;
    stopMusic({ fadeMs: 500 });
    const logLen = musicGain.gain.log.length;
    applySfxSettings({ sound: true, volMusic: 20 });
    assert.equal(musicGain.gain.log.length, logLen, "the fade's ramp is never cancelled by a level write");
    t.mock.timers.tick(500);
  });
});

test("sfx-levels (default backend): the bare-element fallback takes the live music level on el.volume", async () => {
  const world = makeAudioWorld({ mediaSource: false });
  await withDefaultBackend(world, async () => {
    await unlockedWith({ sound: true, volMusic: 50 });
    startMusic();
    const el = world.elements[0];
    assert.equal(el.volume, MUSIC_GAIN * 0.5);
    applySfxSettings({ sound: true, volMusic: 100 });
    assert.equal(el.volume, MUSIC_GAIN);
  });
});
