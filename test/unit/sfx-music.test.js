// test/unit/sfx-music.test.js
//
// Quick task 260924-51h: the title-theme player in src/browser/sfx.js.
//
// ORCHESTRATOR OVERRIDE (recorded in the SUMMARY): the theme is STREAMED
// through one HTMLAudioElement (loop = true) routed into the existing Web
// Audio device via ctx.createMediaElementSource(el) -> a music GainNode
// (MUSIC_GAIN) -> masterGain — never decodeAudioData'd whole (~50 MB of PCM
// per title visit). So the backend's optional music surface is
// startLoop(handle, trackId, gain) / resumeLoop(handle, voice) /
// fadeOut(handle, voice, ms), with no load() step for music at all.
//
// Two halves:
//  - Part A drives the player logic (startMusic / stopMusic / stopAllSfx /
//    the Sound-Off teardown) through the same injected fake-backend shape as
//    test/unit/sfx-settings.test.js (globalThis.__mzSfxBackendOverride).
//  - Part B drives the REAL DEFAULT_BACKEND music path with a fake Audio
//    element (globalThis.Audio) and a fake AudioContext on a fake `window`,
//    so the element wiring (createMediaElementSource once, gain ramp fade,
//    pause, restart from the top, silent play() rejection, the no-graph
//    fallback) is pinned without a browser.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  CLIP_IDS,
  MUSIC_IDS,
  MUSIC_GAIN,
  isSfxUnlocked,
  unlockSfx,
  startMusic,
  stopMusic,
  stopAllSfx,
  applySfxSettings,
  playForDispatch,
} from "../../src/browser/sfx.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function flushMicrotasks(times = 8) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

function resetSfxState() {
  stopAllSfx();
  applySfxSettings({ sound: false });
  applySfxSettings({ sound: true });
}

// ─── Part A: fake backend ────────────────────────────────────────────────

function makeFakeBackend({ music = true, fade = true } = {}) {
  const calls = {
    opens: 0,
    loads: [],
    starts: [],
    stops: [],
    closes: 0,
    loops: [],
    resumes: [],
    fades: [],
    order: [],
  };
  let nextHandle = 0;
  let nextVoice = 0;
  const backend = {
    async open() {
      calls.opens++;
      return { fakeHandle: ++nextHandle };
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      return clipId;
    },
    start(handle, buffer) {
      calls.starts.push(buffer);
      return { oneShot: ++nextVoice };
    },
    stop(voice) {
      calls.stops.push(voice);
      calls.order.push({ kind: "stop", voice });
    },
    close(handle) {
      calls.closes++;
      calls.order.push({ kind: "close", handle });
    },
  };
  let loopImpl = (handle, trackId) => ({ loop: ++nextVoice, trackId, handle });
  if (music) {
    backend.startLoop = (handle, trackId, gain) => {
      calls.loops.push({ handle, trackId, gain });
      calls.order.push({ kind: "startLoop" });
      return loopImpl(handle, trackId, gain);
    };
    backend.resumeLoop = (handle, voice) => {
      calls.resumes.push({ handle, voice });
    };
    if (fade) {
      backend.fadeOut = (handle, voice, ms) => {
        calls.fades.push({ handle, voice, ms });
        calls.order.push({ kind: "fadeOut", ms });
      };
    }
  }
  return {
    calls,
    backend,
    setLoopImpl(fn) {
      loopImpl = fn;
    },
  };
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

async function unlocked(fake) {
  applySfxSettings({ sound: true });
  await unlockSfx();
  await flushMicrotasks();
}

test("sfx-music: MUSIC_IDS is frozen ['theme'], disjoint from CLIP_IDS, and every id has an sfx/<id>.mp3", () => {
  assert.deepEqual([...MUSIC_IDS], ["theme"]);
  assert.ok(Object.isFrozen(MUSIC_IDS));
  for (const id of MUSIC_IDS) {
    assert.equal(CLIP_IDS.includes(id), false);
    assert.ok(fs.existsSync(path.join(REPO_ROOT, "sfx", `${id}.mp3`)), `sfx/${id}.mp3 must exist`);
  }
});

test("sfx-music: MUSIC_GAIN is 0.5 — below the one-shot level (R-09)", () => {
  assert.equal(MUSIC_GAIN, 0.5);
  assert.ok(MUSIC_GAIN > 0 && MUSIC_GAIN < 1);
});

test("sfx-music: isSfxUnlocked() is false before unlock, true after, false again after Sound Off", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    assert.equal(isSfxUnlocked(), false);
    await unlocked(fake);
    assert.equal(isSfxUnlocked(), true);
    applySfxSettings({ sound: false });
    assert.equal(isSfxUnlocked(), false);
  });
});

test("sfx-music: unlockSfx alone never touches the theme — loads are exactly the 30 CLIP_IDS and no loop starts", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    assert.deepEqual([...fake.calls.loads].sort(), [...CLIP_IDS].sort());
    assert.equal(fake.calls.loops.length, 0);
  });
});

test("sfx-music: startMusic before unlock, under Sound Off, or with an unknown id starts nothing and throws nothing", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    assert.doesNotThrow(() => startMusic());
    applySfxSettings({ sound: false });
    await unlockSfx();
    assert.doesNotThrow(() => startMusic());
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();
    assert.doesNotThrow(() => startMusic("not-a-track"));
    assert.doesNotThrow(() => startMusic("walk1"), "a one-shot clip id is never a music track");
    assert.equal(fake.calls.loops.length, 0);
    assert.equal(fake.calls.loads.includes("theme"), false, "music never goes through load()");
  });
});

test("sfx-music: after unlock, startMusic streams the theme once — startLoop(handle, 'theme', MUSIC_GAIN)", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    startMusic();
    assert.equal(fake.calls.loops.length, 1);
    assert.deepEqual(fake.calls.loops[0].handle, { fakeHandle: 1 });
    assert.equal(fake.calls.loops[0].trackId, "theme");
    assert.equal(fake.calls.loops[0].gain, MUSIC_GAIN);
    assert.equal(fake.calls.loads.includes("theme"), false, "the theme is streamed, never loaded/decoded");
  });
});

test("sfx-music: startMusic while the loop is live never restarts it — it only nudges a stalled loop (resumeLoop)", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    startMusic();
    startMusic();
    startMusic();
    assert.equal(fake.calls.loops.length, 1);
    assert.equal(fake.calls.resumes.length, 2);
    assert.equal(fake.calls.resumes[0].voice.trackId, "theme", "the nudge targets the live loop");
    assert.deepEqual(fake.calls.resumes[0].handle, { fakeHandle: 1 });
  });
});

test("sfx-music: stopMusic({ fadeMs: 500 }) fades the live loop once; with no live loop it calls nothing", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    stopMusic({ fadeMs: 500 });
    assert.equal(fake.calls.fades.length, 0, "nothing live — nothing to fade");
    startMusic();
    const voice = { ...fake.calls.loops[0] };
    stopMusic({ fadeMs: 500 });
    assert.equal(fake.calls.fades.length, 1);
    assert.equal(fake.calls.fades[0].ms, 500);
    assert.equal(fake.calls.fades[0].voice.trackId, voice.trackId);
    stopMusic({ fadeMs: 500 });
    assert.equal(fake.calls.fades.length, 1, "a second stop has nothing live to fade");
  });
});

test("sfx-music: a non-finite or negative fadeMs becomes 0; no argument is 0", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    for (const arg of [{ fadeMs: NaN }, { fadeMs: -20 }, { fadeMs: Infinity }, { fadeMs: "500" }, undefined]) {
      startMusic();
      stopMusic(arg);
    }
    assert.deepEqual(fake.calls.fades.map((f) => f.ms), [0, 0, 0, 0, 0]);
  });
});

test("sfx-music: stop then start again restarts through startLoop (a new title visit)", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    startMusic();
    stopMusic({ fadeMs: 500 });
    startMusic();
    assert.equal(fake.calls.loops.length, 2);
  });
});

test("sfx-music: a startLoop that returns null or throws leaves nothing live and throws nothing; a later startMusic retries", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    fake.setLoopImpl(() => null);
    assert.doesNotThrow(() => startMusic());
    fake.setLoopImpl(() => {
      throw new Error("boom");
    });
    assert.doesNotThrow(() => startMusic());
    stopMusic({ fadeMs: 500 });
    assert.equal(fake.calls.fades.length, 0, "nothing was live");
    fake.setLoopImpl((handle, trackId) => ({ loop: "ok", trackId }));
    startMusic();
    assert.equal(fake.calls.loops.length, 3);
    stopMusic();
    assert.equal(fake.calls.fades.length, 1);
  });
});

test("sfx-music: stopAllSfx cuts a live loop at once — fadeOut(handle, voice, 0)", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    startMusic();
    stopAllSfx();
    assert.equal(fake.calls.fades.length, 1);
    assert.equal(fake.calls.fades[0].ms, 0);
    startMusic();
    assert.equal(fake.calls.loops.length, 2, "after a cut, the next start is a fresh loop");
  });
});

test("sfx-music: the Sound-Off transition cuts the loop BEFORE close(); Off then On needs a fresh unlock, which streams on the NEW handle", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    playForDispatch("combatAction", [{ type: "struck" }], {});
    startMusic();
    applySfxSettings({ sound: false });
    const kinds = fake.calls.order.map((e) => e.kind);
    const fadeIdx = kinds.indexOf("fadeOut");
    const closeIdx = kinds.indexOf("close");
    assert.ok(fadeIdx > -1 && closeIdx > -1);
    assert.ok(fadeIdx < closeIdx, "the loop is cut before the device closes");
    assert.equal(fake.calls.fades[0].ms, 0);

    applySfxSettings({ sound: true });
    startMusic();
    assert.equal(fake.calls.loops.length, 1, "On alone opens nothing, so there is nothing to stream on");

    await unlockSfx();
    await flushMicrotasks();
    startMusic();
    assert.equal(fake.calls.loops.length, 2);
    assert.deepEqual(fake.calls.loops[1].handle, { fakeHandle: 2 });
  });
});

test("sfx-music: a legacy five-method backend (no startLoop/fadeOut) has no music — nothing starts, nothing throws", async () => {
  const fake = makeFakeBackend({ music: false });
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    assert.doesNotThrow(() => startMusic());
    assert.doesNotThrow(() => stopMusic({ fadeMs: 500 }));
    assert.equal(fake.calls.loads.includes("theme"), false);
    assert.equal(fake.calls.stops.length, 0);
  });
});

test("sfx-music: a backend with startLoop but no fadeOut stops the loop through stop(voice)", async () => {
  const fake = makeFakeBackend({ fade: false });
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    startMusic();
    stopMusic({ fadeMs: 500 });
    assert.equal(fake.calls.stops.length, 1);
    assert.equal(fake.calls.stops[0].trackId, "theme");
  });
});

test("sfx-music: unlockSfx on an already-open device asks the backend to resume it (a suspended context wakes on the next gesture)", async () => {
  const fake = makeFakeBackend();
  const resumed = [];
  fake.backend.resume = (handle) => resumed.push(handle);
  await withFakeBackend(fake, async () => {
    await unlocked(fake);
    assert.equal(resumed.length, 0, "the opening unlock does not also call resume");
    await unlockSfx();
    assert.equal(fake.calls.opens, 1, "never a second open");
    assert.equal(resumed.length, 1);
    fake.backend.resume = () => {
      throw new Error("boom");
    };
    await assert.doesNotReject(() => unlockSfx());
  });
});

// ─── Part B: the real DEFAULT_BACKEND with a fake Audio element ─────────

function makeFakeParam(initial) {
  const param = {
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
  return param;
}

function makeAudioWorld({ mediaSource = true, playRejects = false, resumeHangs = false } = {}) {
  const world = { contexts: [], elements: [], sources: [] };

  class FakeAudioContext {
    constructor() {
      this.state = resumeHangs ? "suspended" : "running";
      this.currentTime = 10;
      this.destination = { destination: true };
      this.closed = false;
      this.resumeCalls = 0;
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
          world.sources.push({ ctx: this, src });
          return src;
        };
      }
      world.contexts.push(this);
    }
    resume() {
      this.resumeCalls++;
      if (resumeHangs) return new Promise(() => {});
      this.state = "running";
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
    close() {
      this.closed = true;
    }
  }

  class FakeAudio {
    constructor() {
      this.loop = false;
      this.preload = "none";
      this.src = "";
      this.paused = true;
      this.currentTime = 0;
      this.volume = 1;
      this.plays = 0;
      this.pauses = 0;
      this.removedSrc = false;
      world.elements.push(this);
    }
    play() {
      this.plays++;
      if (playRejects) {
        this.paused = true;
        return Promise.reject(new Error("NotAllowedError"));
      }
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.pauses++;
      this.paused = true;
    }
    removeAttribute(name) {
      if (name === "src") this.removedSrc = true;
    }
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
  globalThis.fetch = async () => ({ ok: false });
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

test("sfx-music (default backend): the first start creates ONE looping element on ./sfx/theme.mp3, routed once through createMediaElementSource -> gain(MUSIC_GAIN) -> masterGain, and plays it", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    assert.equal(world.elements.length, 0, "the element is created lazily, only when music is first wanted");
    startMusic();
    assert.equal(world.elements.length, 1);
    const el = world.elements[0];
    assert.equal(el.loop, true);
    assert.equal(el.src, "./sfx/theme.mp3");
    assert.equal(el.preload, "auto");
    assert.equal(el.plays, 1);
    assert.equal(el.paused, false);
    assert.equal(world.sources.length, 1);
    const ctx = world.contexts[0];
    const masterGain = ctx.gains[0];
    const musicGain = ctx.gains[1];
    assert.equal(world.sources[0].src.el, el);
    assert.equal(world.sources[0].src.connectedTo, musicGain);
    assert.equal(musicGain.connectedTo, masterGain);
    assert.equal(musicGain.gain.value, MUSIC_GAIN);
  });
});

test("sfx-music (default backend): fade = gain ramp to 0 over fadeMs, then pause; restart reuses the element and source, resets to the top and cancels the pending pause", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    startMusic();
    const el = world.elements[0];
    const musicGain = world.contexts[0].gains[1];
    el.currentTime = 42;

    stopMusic({ fadeMs: 500 });
    const ramp = musicGain.gain.log.find((e) => e[0] === "ramp");
    assert.deepEqual(ramp, ["ramp", 0, 10.5]);
    assert.equal(el.paused, false, "still sounding during the fade");
    t.mock.timers.tick(499);
    assert.equal(el.paused, false);
    t.mock.timers.tick(1);
    assert.equal(el.paused, true, "paused once the fade has run out");

    startMusic();
    assert.equal(world.elements.length, 1, "the element is kept for reuse");
    assert.equal(world.sources.length, 1, "createMediaElementSource is only ever called once per element");
    assert.equal(el.currentTime, 0, "a new title visit restarts from the top");
    assert.equal(el.plays, 2);
    assert.equal(musicGain.gain.value, MUSIC_GAIN, "the level is restored after a fade");

    // Restart DURING a fade: the pending pause must not land afterwards.
    stopMusic({ fadeMs: 500 });
    t.mock.timers.tick(200);
    startMusic();
    t.mock.timers.tick(1000);
    assert.equal(el.paused, false, "a restart mid-fade cancels the fade's pause");
  });
});

test("sfx-music (default backend): fadeMs 0 pauses at once", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    startMusic();
    stopMusic({ fadeMs: 0 });
    assert.equal(world.elements[0].paused, true);
  });
});

test("sfx-music (default backend): a rejected play() is swallowed; the next nudge (startMusic while live) re-plays without restarting", async () => {
  const world = makeAudioWorld({ playRejects: true });
  let unhandled = 0;
  const onUnhandled = () => unhandled++;
  process.on("unhandledRejection", onUnhandled);
  try {
    await withDefaultBackend(world, async () => {
      applySfxSettings({ sound: true });
      await unlockSfx();
      assert.doesNotThrow(() => startMusic());
      await flushMicrotasks();
      const el = world.elements[0];
      assert.equal(el.paused, true);
      el.currentTime = 3;
      startMusic();
      await flushMicrotasks();
      assert.equal(el.plays, 2, "the stalled element is played again");
      assert.equal(el.currentTime, 3, "a nudge never rewinds");
    });
    await new Promise((r) => setImmediate(r));
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.equal(unhandled, 0);
});

test("sfx-music (default backend): without createMediaElementSource it falls back to the bare element — volume = MUSIC_GAIN, stop pauses at once", async () => {
  const world = makeAudioWorld({ mediaSource: false });
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    startMusic();
    const el = world.elements[0];
    assert.equal(el.volume, MUSIC_GAIN);
    assert.equal(el.paused, false);
    stopMusic({ fadeMs: 500 });
    assert.equal(el.paused, true, "no graph, no ramp — the fallback cuts at once");
  });
});

test("sfx-music (default backend): Sound Off pauses and releases the element; the next device gets a fresh element (a source node is bound to one context)", async () => {
  const world = makeAudioWorld();
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    startMusic();
    const first = world.elements[0];
    applySfxSettings({ sound: false });
    assert.equal(first.paused, true);
    assert.equal(first.removedSrc, true);
    assert.equal(world.contexts[0].closed, true);

    applySfxSettings({ sound: true });
    await unlockSfx();
    startMusic();
    assert.equal(world.elements.length, 2);
    assert.equal(world.sources.length, 2);
    assert.equal(world.sources[1].ctx, world.contexts[1]);
  });
});

test("sfx-music (default backend): a resume() that never settles cannot wedge the unlock — the device opens after the bounded wait and a later unlock re-asks resume", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const world = makeAudioWorld({ resumeHangs: true });
  await withDefaultBackend(world, async () => {
    applySfxSettings({ sound: true });
    const p = unlockSfx();
    await flushMicrotasks();
    assert.equal(isSfxUnlocked(), false);
    t.mock.timers.tick(5000);
    await p;
    assert.equal(isSfxUnlocked(), true, "a suspended context still yields a device");
    const ctx = world.contexts[0];
    const before = ctx.resumeCalls;
    await unlockSfx();
    assert.equal(ctx.resumeCalls, before + 1, "the next gesture re-asks the suspended context to resume");
    assert.equal(world.contexts.length, 1, "never a second context");
  });
});
