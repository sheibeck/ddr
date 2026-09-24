// test/unit/titleMusic.test.js
//
// Quick task 260924-51h: the pure title-music state machine
// (src/browser/titleMusic.js). The controller decides WHEN the title theme
// starts and stops (rulings R-03..R-07); it never touches audio or the DOM,
// so every case here drives it with plain recording fakes for start/stop and
// a switchable reduced-motion flag.

import test from "node:test";
import assert from "node:assert/strict";

import { MUSIC_FADE_MS, shouldPlayTitleMusic, createTitleMusic } from "../../src/browser/titleMusic.js";

const ALL_ON = Object.freeze({ titleVisible: true, unlocked: true, soundOn: true, appActive: true });

function makeRig({ reducedInit = false } = {}) {
  const starts = [];
  const stops = [];
  let reducedFlag = reducedInit;
  const music = createTitleMusic({
    start: () => starts.push(true),
    stop: (ms) => stops.push(ms),
    reduced: () => reducedFlag,
  });
  return {
    music,
    starts,
    stops,
    setReduced(v) {
      reducedFlag = v;
    },
  };
}

// ─── shouldPlayTitleMusic ────────────────────────────────────────────────

test("titleMusic: MUSIC_FADE_MS is 500 (R-04 asks for ~400–600 ms)", () => {
  assert.equal(MUSIC_FADE_MS, 500);
});

test("titleMusic: shouldPlayTitleMusic truth table — true only when all four inputs are true (16 rows)", () => {
  const B = [false, true];
  let rows = 0;
  for (const titleVisible of B) {
    for (const unlocked of B) {
      for (const soundOn of B) {
        for (const appActive of B) {
          rows++;
          const expected = titleVisible && unlocked && soundOn && appActive;
          assert.equal(
            shouldPlayTitleMusic({ titleVisible, unlocked, soundOn, appActive }),
            expected,
            JSON.stringify({ titleVisible, unlocked, soundOn, appActive })
          );
        }
      }
    }
  }
  assert.equal(rows, 16);
});

test("titleMusic: shouldPlayTitleMusic is false for no argument, null, non-objects and non-boolean truthy values", () => {
  assert.equal(shouldPlayTitleMusic(), false);
  assert.equal(shouldPlayTitleMusic(null), false);
  assert.equal(shouldPlayTitleMusic("yes"), false);
  assert.equal(shouldPlayTitleMusic(42), false);
  assert.equal(shouldPlayTitleMusic({ ...ALL_ON, titleVisible: "yes" }), false);
  assert.equal(shouldPlayTitleMusic({ ...ALL_ON, unlocked: 1 }), false);
  assert.equal(shouldPlayTitleMusic({ ...ALL_ON, soundOn: "true" }), false);
  assert.equal(shouldPlayTitleMusic({ ...ALL_ON, appActive: {} }), false);
});

// ─── createTitleMusic: initial state ─────────────────────────────────────

test("titleMusic: a fresh controller starts with title hidden, locked, sound off, app active, not playing", () => {
  const { music, starts, stops } = makeRig();
  assert.deepEqual({ ...music.inputs() }, { titleVisible: false, unlocked: false, soundOn: false, appActive: true });
  assert.equal(music.isPlaying(), false);
  assert.equal(starts.length, 0);
  assert.equal(stops.length, 0);
});

test("titleMusic: inputs() returns a frozen copy", () => {
  const { music } = makeRig();
  const a = music.inputs();
  assert.ok(Object.isFrozen(a));
  music.update({ titleVisible: true });
  assert.equal(a.titleVisible, false, "an earlier copy never changes");
  assert.equal(music.inputs().titleVisible, true);
});

// ─── rising edge ─────────────────────────────────────────────────────────

test("titleMusic: rising edge calls start() exactly once; repeating the update or an empty patch calls nothing more", () => {
  const { music, starts, stops } = makeRig();
  assert.equal(music.update(ALL_ON), true);
  assert.equal(starts.length, 1);
  assert.equal(music.update(ALL_ON), true);
  assert.equal(music.update({}), true);
  assert.equal(starts.length, 1);
  assert.equal(stops.length, 0);
  assert.equal(music.isPlaying(), true);
});

// ─── falling edges ───────────────────────────────────────────────────────

test("titleMusic: leaving the title alone fades out — stop(MUSIC_FADE_MS)", () => {
  const { music, stops } = makeRig();
  music.update(ALL_ON);
  assert.equal(music.update({ titleVisible: false }), false);
  assert.deepEqual(stops, [MUSIC_FADE_MS]);
  assert.equal(music.isPlaying(), false);
});

test("titleMusic: leaving the title under reduced motion cuts at once — stop(0)", () => {
  const rig = makeRig();
  rig.music.update(ALL_ON);
  rig.setReduced(true);
  rig.music.update({ titleVisible: false });
  assert.deepEqual(rig.stops, [0]);
});

for (const key of ["soundOn", "appActive", "unlocked"]) {
  test(`titleMusic: ${key} going false cuts at once — stop(0)`, () => {
    const { music, stops } = makeRig();
    music.update(ALL_ON);
    music.update({ [key]: false });
    assert.deepEqual(stops, [0]);
    assert.equal(music.isPlaying(), false);
  });

  test(`titleMusic: ${key} going false together with the title leaving still cuts at once — stop(0)`, () => {
    const { music, stops } = makeRig();
    music.update(ALL_ON);
    music.update({ [key]: false, titleVisible: false });
    assert.deepEqual(stops, [0]);
  });
}

// ─── restart / ordering edges ────────────────────────────────────────────

test("titleMusic: title hidden then shown again restarts — start() a second time", () => {
  const { music, starts, stops } = makeRig();
  music.update(ALL_ON);
  music.update({ titleVisible: false });
  music.update({ titleVisible: true });
  assert.equal(starts.length, 2);
  assert.deepEqual(stops, [MUSIC_FADE_MS]);
  assert.equal(music.isPlaying(), true);
});

test("titleMusic: unlock landing while the title is hidden never starts; showing the title afterwards does", () => {
  const { music, starts } = makeRig();
  music.update({ soundOn: true, titleVisible: false });
  music.update({ unlocked: true });
  assert.equal(starts.length, 0, "ENTER as the very first tap: the unlock lands after the title is gone");
  music.update({ titleVisible: true });
  assert.equal(starts.length, 1);
});

test("titleMusic: Sound off from the start never starts through any sequence of the other three", () => {
  const { music, starts } = makeRig();
  music.update({ soundOn: false });
  music.update({ titleVisible: true });
  music.update({ unlocked: true });
  music.update({ appActive: false });
  music.update({ appActive: true });
  music.update({ titleVisible: false });
  music.update({ titleVisible: true });
  assert.equal(starts.length, 0);
  music.update({ soundOn: true });
  assert.equal(starts.length, 1, "Sound On with the title up and unlocked starts on that same update");
});

test("titleMusic: appActive false then true with the title up — stop(0) then start()", () => {
  const { music, starts, stops } = makeRig();
  music.update(ALL_ON);
  music.update({ appActive: false });
  music.update({ appActive: true });
  assert.deepEqual(stops, [0]);
  assert.equal(starts.length, 2);
});

test("titleMusic: appActive true while the title is hidden calls nothing", () => {
  const { music, starts, stops } = makeRig();
  music.update({ unlocked: true, soundOn: true, titleVisible: false });
  music.update({ appActive: false });
  music.update({ appActive: true });
  assert.equal(starts.length, 0);
  assert.equal(stops.length, 0);
});

// ─── input hygiene ───────────────────────────────────────────────────────

test("titleMusic: non-boolean patch values and unknown keys are ignored; a null or non-object patch is a no-op", () => {
  const { music, starts } = makeRig();
  music.update({ titleVisible: "yes", unlocked: 1, soundOn: {}, appActive: null, bogus: true });
  assert.deepEqual({ ...music.inputs() }, { titleVisible: false, unlocked: false, soundOn: false, appActive: true });
  assert.equal("bogus" in music.inputs(), false);
  assert.doesNotThrow(() => music.update(null));
  assert.doesNotThrow(() => music.update(undefined));
  assert.doesNotThrow(() => music.update("titleVisible"));
  assert.doesNotThrow(() => music.update(7));
  assert.equal(starts.length, 0);
});

// ─── never throws ────────────────────────────────────────────────────────

test("titleMusic: throwing start/stop never propagate out of update(); isPlaying() still tracks the edge", () => {
  const music = createTitleMusic({
    start: () => {
      throw new Error("boom start");
    },
    stop: () => {
      throw new Error("boom stop");
    },
  });
  assert.equal(music.update(ALL_ON), true);
  assert.equal(music.isPlaying(), true);
  assert.equal(music.update({ titleVisible: false }), false);
  assert.equal(music.isPlaying(), false);
});

test("titleMusic: a throwing reduced() counts as not reduced (fade still used)", () => {
  const stops = [];
  const music = createTitleMusic({
    start: () => {},
    stop: (ms) => stops.push(ms),
    reduced: () => {
      throw new Error("boom reduced");
    },
  });
  music.update(ALL_ON);
  assert.doesNotThrow(() => music.update({ titleVisible: false }));
  assert.deepEqual(stops, [MUSIC_FADE_MS]);
});

test("titleMusic: missing start/stop/reduced functions are a silent no-op", () => {
  const music = createTitleMusic();
  assert.doesNotThrow(() => music.update(ALL_ON));
  assert.equal(music.isPlaying(), true);
  assert.doesNotThrow(() => music.update({ titleVisible: false }));
  assert.equal(music.isPlaying(), false);
  const music2 = createTitleMusic({ start: "nope", stop: 5, reduced: null });
  assert.doesNotThrow(() => music2.update(ALL_ON));
  assert.doesNotThrow(() => music2.update({ soundOn: false }));
});

test("titleMusic: the controller object is frozen", () => {
  const { music } = makeRig();
  assert.ok(Object.isFrozen(music));
});
