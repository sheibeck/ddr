// src/browser/titleMusic.js
//
// Quick task 260924-51h: the play/stop decision for the title theme
// (sfx/theme.mp3), per rulings R-03..R-07 and R-11. This is the PURE half:
// it imports nothing and reads no window, document, timer or audio API, so
// `node --test` pins all of it directly (test/unit/titleMusic.test.js) —
// the same split as the pure halves of motion.js and sfx.js.
//
// DOM/audio wiring lives in mazeworld.html (a MutationObserver on the title
// screen and the title-mode Leaderboards marker, the first-gesture unlock,
// the Sound settings tap and the app lifecycle hooks feed update()); the
// actual playback lives in sfx.js (startMusic / stopMusic). Like every
// other presentation module here, nothing in this file may ever throw.

// MUSIC_FADE_MS — the title-exit fade. R-04 asks for ~400–600 ms when the
// player leaves the title for the roller or the map; reduced motion, Sound
// Off, backgrounding and device loss all cut at once instead (stop(0)).
export const MUSIC_FADE_MS = 500;

const INPUT_KEYS = Object.freeze(["titleVisible", "unlocked", "soundOn", "appActive"]);

/**
 * shouldPlayTitleMusic(inputs) — PURE. True only when all four inputs are
 * strictly `true`: the title (or its title-mode panel) is showing, the audio
 * device has been unlocked by a gesture, Sound is on, and the app is in the
 * foreground. Anything else — a missing argument, a non-object, a truthy
 * non-boolean — is false.
 */
export function shouldPlayTitleMusic(inputs) {
  if (!inputs || typeof inputs !== "object") return false;
  return (
    inputs.titleVisible === true &&
    inputs.unlocked === true &&
    inputs.soundOn === true &&
    inputs.appActive === true
  );
}

function safeCall(fn, ...args) {
  try {
    if (typeof fn === "function") return fn(...args);
  } catch {
    // cosmetic polish — a failing callback never escapes the controller.
  }
  return undefined;
}

/**
 * createTitleMusic({ start, stop, reduced }) — the edge-triggered
 * controller. Returns a frozen `{ update, isPlaying, inputs }`.
 *
 *  - update(patch): copies only the four known keys, and only boolean
 *    values; then on a rising edge of shouldPlayTitleMusic calls start()
 *    once, and on a falling edge calls stop(ms). ms is MUSIC_FADE_MS only
 *    when the title alone went away (unlocked, soundOn and appActive still
 *    true) and reduced() is not true; every other falling edge is stop(0),
 *    because background, Sound Off and device loss must cut at once.
 *    Returns isPlaying().
 *  - isPlaying(): whether the controller last asked for the theme to play.
 *  - inputs(): a frozen copy of the four inputs.
 */
export function createTitleMusic({ start, stop, reduced } = {}) {
  const state = { titleVisible: false, unlocked: false, soundOn: false, appActive: true };
  let playing = false;

  function isReduced() {
    return safeCall(reduced) === true;
  }

  function update(patch) {
    if (patch && typeof patch === "object") {
      for (const key of INPUT_KEYS) {
        if (typeof patch[key] === "boolean") state[key] = patch[key];
      }
    }
    const want = shouldPlayTitleMusic(state);
    if (want && !playing) {
      playing = true;
      safeCall(start);
    } else if (!want && playing) {
      playing = false;
      const titleOnlyExit = state.unlocked && state.soundOn && state.appActive;
      const ms = titleOnlyExit && !isReduced() ? MUSIC_FADE_MS : 0;
      safeCall(stop, ms);
    }
    return playing;
  }

  return Object.freeze({
    update,
    isPlaying: () => playing,
    inputs: () => Object.freeze({ ...state }),
  });
}
