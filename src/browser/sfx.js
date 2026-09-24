// src/browser/sfx.js
//
// AUD-01/02/03 pure audio seam (Phase 56). This is the Phase 56 audio seam:
// presentation-only, and it never touches engine/ or content/ (it only
// READS content/bestiary.js's BESTIARY keys, via the test file, to prove
// FAMILY_CRY's totality — this module itself imports nothing).
//
// Variation is a counter-driven round-robin with NO pseudo-random source
// anywhere in this file — no JS built-in PRNG call, no crypto random-bytes
// call, not a draw off the engine's rng stream. That is deliberate: a shuffle-bag
// driven by a plain counter cannot perturb engine determinism no matter how
// it is called, so this module is free to sit on the dispatch path without
// touching parity. (See 56-CONTEXT.md "Event mapping & variation".)
//
// This half of the module (56-02) is the pure core only: clip vocabulary,
// event->group table, family->cry map, and (Task 2) the two resolver
// functions. It holds no audio API, no DOM access, no timer, and imports
// nothing, so `node --test` can pin all of it directly. 56-03 appends the
// Web Audio backend (decode/play/voice management) to this same file, per
// CONTEXT's "Module shape inside src/browser/sfx.js" discretion — one
// module, two passes. Like haptics.js, cosmetic/presentation code here must
// never throw.

// CLIP_IDS — the 30 one-shot clip basenames (no extension); sfx/ also
// holds the MUSIC_IDS track (quick task 260924-51h, the title theme — see
// the section at the bottom of this file). Copied to www/sfx/ via
// copySfx(). This list is asserted 1:1 against sfx/'s one-shot clips by
// test/unit/sfx-map.test.js AND
// against test/unit/sfx-assets.test.js's own manifest (56-01) — two
// independent pins on the same 30 filenames.
export const CLIP_IDS = Object.freeze([
  "walk1", "walk2", "walk3",
  "walk-water1", "walk-water2", "walk-water3",
  "hit1", "hit2",
  "miss1", "miss2",
  "hurt1", "hurt2", "hurt3",
  "foe-die",
  "enemy-beast", "enemy-demon", "enemy-human", "enemy-undead",
  "spell",
  "resist",
  "heal",
  "drink",
  "chest",
  "gold",
  "trap",
  "jump",
  "stairs",
  "levelup",
  "death",
  "ui-tap",
]);

// CLIP_GAIN — Phase 71 (POLISH-05, D-01): THE one hand-tunable per-clip
// balance table, keyed by the sfx/ file names (the CLIP_IDS above). Each
// one-shot voice plays through its own gain node at clipGain(id), then the
// effects bus, then the device master — so a clip that is too loud or too
// soft is fixed HERE, never by re-exporting its mp3. A clip with no entry
// plays at the 1.0 default; values are capped at 2.0 (clipGain clamps) so no
// entry can drive a voice into clipping. test/unit/sfx-levels.test.js pins
// every key to a real CLIP_IDS id and every value into (0, 2].
//
// Starting values, from the 2026-09-24 Pixel 7 device round: the hero-death
// cue (`death`, the `died` event) was too loud, the footsteps (dry and
// water) too soft. `foe-die` is deliberately ABSENT — it is the foeKilled
// cue, not the hero's death (R-03), so it keeps the 1.0 default.
export const CLIP_GAIN = Object.freeze({
  "walk1": 1.6,
  "walk2": 1.6,
  "walk3": 1.6,
  "walk-water1": 1.6,
  "walk-water2": 1.6,
  "walk-water3": 1.6,
  "death": 0.5,
});

// CLIP_GAIN_MAX — the per-clip cap (D-01).
const CLIP_GAIN_MAX = 2.0;

/**
 * clipGain(id) — PURE. The per-voice gain for one clip: CLIP_GAIN[id]
 * clamped into (0, CLIP_GAIN_MAX], or the 1.0 default for any clip with no
 * entry, an unknown id, or a non-string. Own keys only, so an id like
 * "toString" never reads the prototype. Never throws.
 */
export function clipGain(id) {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(CLIP_GAIN, id)) return 1.0;
  const v = CLIP_GAIN[id];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 1.0;
  return Math.min(CLIP_GAIN_MAX, v);
}

/**
 * volumeLevel(v) — internal. One 0-100 integer slider value as a gain in
 * [0, 1]; anything else (missing, non-integer, out of range, a string, NaN)
 * reads the 100 default, i.e. 1.0.
 */
function volumeLevel(v) {
  return Number.isInteger(v) && v >= 0 && v <= 100 ? v / 100 : 1.0;
}

/**
 * volumeLevels(settings) — PURE, exported. Phase 71 (D-03): the three
 * player volume sliders (settings.js's volMaster / volMusic / volEffects,
 * integers 0-100, default 100) as frozen gains { master, music, effects }.
 * 0 is exact silence on that bus, 100 is unity. A missing or null settings
 * object, or any invalid value, reads 1.0 — the same tolerant posture as
 * settings.js's own validator (re-checked here, since a tampered blob must
 * never over-drive the graph).
 */
export function volumeLevels(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  return Object.freeze({
    master: volumeLevel(s.volMaster),
    music: volumeLevel(s.volMusic),
    effects: volumeLevel(s.volEffects),
  });
}

// CLIP_GROUPS — group id -> ordered, frozen array of clip ids. Five
// multi-clip groups get counter-driven variation (see createVariation() in
// Task 2); the thirteen single-clip groups are one-element arrays so the
// same resolver code path handles them without a branch. The enemy-* cries
// are deliberately NOT a group here — they resolve directly through
// FAMILY_CRY, one cry per BESTIARY family, never rotated.
export const CLIP_GROUPS = Object.freeze({
  walk: Object.freeze(["walk1", "walk2", "walk3"]),
  water: Object.freeze(["walk-water1", "walk-water2", "walk-water3"]),
  hit: Object.freeze(["hit1", "hit2"]),
  miss: Object.freeze(["miss1", "miss2"]),
  hurt: Object.freeze(["hurt1", "hurt2", "hurt3"]),
  foeDie: Object.freeze(["foe-die"]),
  spell: Object.freeze(["spell"]),
  resist: Object.freeze(["resist"]),
  heal: Object.freeze(["heal"]),
  drink: Object.freeze(["drink"]),
  chest: Object.freeze(["chest"]),
  gold: Object.freeze(["gold"]),
  trap: Object.freeze(["trap"]),
  jump: Object.freeze(["jump"]),
  stairs: Object.freeze(["stairs"]),
  levelup: Object.freeze(["levelup"]),
  death: Object.freeze(["death"]),
  uiTap: Object.freeze(["ui-tap"]),
});

// EVENT_CLIP_GROUP — engine event type -> CLIP_GROUPS key. Every key here
// is verified (by read, at plan time) against src/browser/eventNarration.js's
// LINE_FOR vocabulary, the authoritative list of real engine event types.
//
// Every OTHER engine event type is deliberately unmapped: silence is the
// design here, not an omission — this phase maps the 18 AUD-01 actions and
// nothing else. In particular "waded" is deliberately ABSENT from this
// table: water walking is resolved by the synthesized step rule in
// groupsForDispatch() (Task 2) instead (actionType "move" + ctx.stepped +
// a "waded" event present -> the "water" group), not by an
// EVENT_CLIP_GROUP entry — mapping "waded" here too would fire two sounds
// for one step.
export const EVENT_CLIP_GROUP = Object.freeze({
  struck: "hit",
  strikeMissed: "miss",
  struckByFoe: "hurt",
  fellClimbing: "hurt",
  fellInGorge: "hurt",
  foeKilled: "foeDie",
  spellThrown: "spell",
  scrollCast: "spell",
  wardRaised: "spell",
  strengthCast: "spell",
  regenerationCast: "spell",
  deathCast: "spell",
  heroResisted: "resist",
  spellResisted: "resist",
  darknessResisted: "resist",
  healed: "heal",
  secondWindHealed: "heal",
  potionDrunk: "drink",
  chestOpened: "chest",
  goldGained: "gold",
  trapSprung: "trap",
  leaptOver: "jump",
  climbedOver: "jump",
  floorChanged: "stairs",
  leveled: "levelup",
  died: "death",
});

// FAMILY_CRY — BESTIARY family name -> enemy-* clip id. Total over all six
// BESTIARY families (Beasts, Demons, Humans, Lair Beasts, Magical, Walking
// Dead) against the four delivered enemy-* clips, with two deliberate
// shares: Lair Beasts SHARES enemy-human because its roster (Dog Face,
// Goblin, Hobgoblin, M&M, Pogo, Hair, Trachea) is humanoid lair-dwellers who
// carry swords and wilmst, not animals. Magical SHARES enemy-demon as the
// nearest fit — no delivered clip matches Drekk / Shadow / Werebeast /
// Drudge cleanly. A family resolving to nothing would be a DEFECT, not a
// default; totality is proven by test against content/bestiary.js's own
// BESTIARY keys, never by hand.
//
// BINDING USER RULING (2026-09-22): this six-family table IS the whole
// foe-cry layer. There is to be NO per-creature override in front of it —
// Bat/Rat sounds like the rest of Beasts. (The user also deleted the
// creature-specific enemy-batrat.mp3 outright on 2026-09-22, so sfx/ holds
// 30 clips and every one of them is mapped.) Do not add a per-creature
// layer back on top of this map.
export const FAMILY_CRY = Object.freeze({
  "Beasts": "enemy-beast",
  "Demons": "enemy-demon",
  "Humans": "enemy-human",
  "Lair Beasts": "enemy-human",
  "Magical": "enemy-demon",
  "Walking Dead": "enemy-undead",
});

// STEP_SUPPRESSING_EVENTS — when any of these event types is present in a
// dispatch's event list, the synthesized step clip (walk/water) is
// suppressed: a leap sounds like a leap, not a leap plus a footfall.
export const STEP_SUPPRESSING_EVENTS = new Set([
  "leaptOver",
  "climbedOver",
  "flownOver",
  "phasedThrough",
  "teleported",
]);

// DISPATCH_CLIP_CAP — the per-dispatch voice cap (CONTEXT: "Every mapped
// event in a dispatch fires its clip, in event order ... capped at 3 voices
// per dispatch"). Deliberately NOT the haptics "one strongest beat" model:
// a round where you strike, kill and level up should sound like three
// things happening.
export const DISPATCH_CLIP_CAP = 3;

/**
 * groupEntriesForDispatch(actionType, events, ctx) — PURE, internal. Phase
 * 58 (D-12): the entry projection groupsForDispatch(...) below is now
 * itself a thin projection of this function, which pairs each pushed
 * group/clip id with the source EVENT INDEX that produced it (idx -1 for
 * the synthesized step clip, which has no source event). Follows the exact
 * same order of operations groupsForDispatch documents. De-duplicates on
 * `entry`, keeping the FIRST occurrence (and that occurrence's idx), then
 * truncates to DISPATCH_CLIP_CAP. This is what lets a combat beat
 * (src/browser/combatBeat.js#cueLines) know which fight-log line a clip
 * belongs to.
 */
function groupEntriesForDispatch(actionType, events, ctx) {
  const list = Array.isArray(events) ? events : [];
  const out = [];

  const hasSuppressor = list.some(
    (e) => e && typeof e === "object" && STEP_SUPPRESSING_EVENTS.has(e.type)
  );
  if (actionType === "move" && ctx?.stepped && !hasSuppressor) {
    const waded = list.some((e) => e && typeof e === "object" && e.type === "waded");
    out.push({ entry: waded ? "water" : "walk", idx: -1 });
  }

  list.forEach((e, idx) => {
    if (!e || typeof e !== "object" || !e.type) return;
    if (e.type === "combatJoined") {
      const cry = FAMILY_CRY[ctx?.combatType];
      if (cry) out.push({ entry: cry, idx });
      return;
    }
    const group = EVENT_CLIP_GROUP[e.type];
    if (group) out.push({ entry: group, idx });
  });

  const deduped = [];
  const seen = new Set();
  for (const item of out) {
    if (seen.has(item.entry)) continue;
    seen.add(item.entry);
    deduped.push(item);
  }

  return deduped.slice(0, DISPATCH_CLIP_CAP);
}

/**
 * groupsForDispatch(actionType, events, ctx) — PURE. Resolves an ordered,
 * de-duplicated, capped list of group ids (or raw enemy-* clip ids for the
 * combat cry) for one dispatch. Never throws on malformed input. Phase 58
 * (D-12): this is now the ENTRY PROJECTION of groupEntriesForDispatch — the
 * two can never drift because one is derived from the other.
 *
 * Order of operations:
 *  1. Guard: a non-array `events` is treated as empty.
 *  2. Synthesized step clip, emitted FIRST: when actionType is "move" AND
 *     ctx.stepped is true AND no event type in the list is in
 *     STEP_SUPPRESSING_EVENTS, push "water" if any event is "waded",
 *     otherwise push "walk". Exactly one step clip, never both.
 *  3. Walk `events` in array order: a "combatJoined" resolves the cry via
 *     FAMILY_CRY[ctx.combatType] (pushing nothing when combatType is
 *     absent/unknown — the one silent, engine-impossible branch); any other
 *     type is looked up in EVENT_CLIP_GROUP and pushed when found.
 *  4. De-duplicate by pushed identity, keeping the FIRST occurrence.
 *  5. Truncate to DISPATCH_CLIP_CAP entries.
 *  6. An empty/all-unmapped/garbage `events` argument returns [] and
 *     touches no state.
 */
export function groupsForDispatch(actionType, events, ctx) {
  return groupEntriesForDispatch(actionType, events, ctx).map((g) => g.entry);
}

/**
 * createVariation() — factory for a counter-driven round-robin shuffle-bag.
 * Returns { next(groupId) }, closing over a plain Map of per-group
 * counters. This modulo round-robin IS the shuffle-bag: for a size-2 group
 * it strictly alternates, for a size-3 group it cycles 0,1,2 and never
 * repeats back-to-back. A counter, not a draw, is what keeps this phase
 * incapable of perturbing engine determinism.
 *
 * next(groupId):
 *  - unknown group id -> null, no throw, map untouched.
 *  - group of size 1 -> that one clip, no throw, map untouched (no
 *    no-repeat guarantee is attempted or needed).
 *  - otherwise -> reads the counter (default 0), returns
 *    group[counter % group.length], stores counter + 1.
 */
export function createVariation() {
  const counters = new Map();
  return {
    next(groupId) {
      const group = CLIP_GROUPS[groupId];
      if (!group) return null;
      if (group.length === 1) return group[0];
      const counter = counters.get(groupId) ?? 0;
      const clip = group[counter % group.length];
      counters.set(groupId, counter + 1);
      return clip;
    },
  };
}

// Module-level default variation instance, used by clipsForDispatch() when
// no variation is passed in, so shell callers never have to thread state
// themselves. Tests construct and pass their own instance so no global
// state leaks between test cases.
const defaultVariation = createVariation();

/**
 * cuesForDispatch(actionType, events, ctx, variation) — PURE, exported.
 * Phase 58 (D-12). Resolves a dispatch straight through to an ordered
 * array of `{ clip, idx }` cues: `idx` is the source event's own array
 * index (-1 for the synthesized step clip), so a combat beat can own each
 * clip with the fight-log line that folded its source event
 * (src/browser/combatBeat.js#cueLines). Group entries are resolved via
 * variation.next(); raw clip ids (the enemy-* cries) pass through
 * unchanged. Any null result (unknown group) is dropped. An empty group
 * list returns [] having advanced no counter.
 */
export function cuesForDispatch(actionType, events, ctx, variation = defaultVariation) {
  const entries = groupEntriesForDispatch(actionType, events, ctx);
  const cues = [];
  for (const { entry, idx } of entries) {
    const resolved = CLIP_GROUPS[entry] ? variation.next(entry) : entry;
    if (resolved) cues.push({ clip: resolved, idx });
  }
  return cues;
}

/**
 * clipsForDispatch(actionType, events, ctx, variation) — resolves a
 * dispatch straight through to an ordered array of concrete clip ids.
 * Phase 58 (D-12): this is now the CLIP PROJECTION of cuesForDispatch —
 * the two can never drift because one is derived from the other, so "the
 * per-dispatch clip set is unchanged, only its timing moves" holds by
 * construction.
 */
export function clipsForDispatch(actionType, events, ctx, variation = defaultVariation) {
  return cuesForDispatch(actionType, events, ctx, variation).map((c) => c.clip);
}

// ============================================================================
// 56-03: the Web Audio backend. Everything below is the bounded player that
// turns clip ids (from clipsForDispatch() above) into overlapping sound.
// Nothing above this line is touched by this half of the module.
// ============================================================================

// Backend interface — the ENTIRE surface the player needs, five methods,
// so a fake for `node --test` is trivial (no `window`, no `AudioContext`):
//
//   open()                 -> Promise<handle|null>   construct/resume the
//                             audio device; null means audio is unavailable.
//   load(handle, clipId)   -> Promise<buffer|null>    fetch + decode one
//                             clip; null on any failure (missing file, bad
//                             bytes, decode error).
//   start(handle, buffer, gain) -> voice|null         start one voice off an
//                             already-decoded buffer, immediately. Phase 71
//                             (D-01): the optional third `gain` is the
//                             clip's CLIP_GAIN level (clipGain(id)); a
//                             five-method fake may simply ignore it.
//   stop(voice)             -> void                    stop one in-flight
//                             voice.
//   close(handle)            -> void                    tear the device down.
//
// Plus OPTIONAL methods (quick task 260924-51h). A backend without them
// simply has no device re-resume and no music, so every existing
// five-method test fake keeps working unchanged:
//
//   resume(handle)                     -> void          wake an open but
//                             suspended device (called by unlockSfx() on a
//                             later gesture).
//   startLoop(handle, trackId, gain)   -> voice|null    start (or restart
//                             from the top) the looping music track at
//                             `gain`, relative to the one-shots' master.
//   resumeLoop(handle, voice)          -> void          make a live loop
//                             actually sound (resume the device, re-play a
//                             stalled element) without rewinding it.
//   fadeOut(handle, voice, ms)         -> void          fade the loop to
//                             silence over `ms` then pause it; ms <= 0
//                             pauses at once.
//
// Phase 71 (D-03) adds two more OPTIONAL methods, for the player's volume
// sliders. A backend without them simply ignores the sliders:
//
//   setLevels(handle, { master, effects }) -> void     set the device master
//                             gain and the one-shots' effects bus, live.
//   setLoopLevel(handle, voice, gain)      -> void     set a live loop's
//                             level (MUSIC_GAIN times the MUSIC slider); a
//                             no-op while that loop is fading out.
//
// Every DEFAULT_BACKEND method individually swallows its own failure and
// returns null/void instead of propagating a throw — sound is cosmetic
// polish and must never break a dispatch, matching haptics.js's posture.

// RESUME_WAIT_MS — how long open() waits for ctx.resume() before handing
// back the (possibly still suspended) device anyway. Quick task 260924-51h
// opens the device at launch on native with no gesture; if the WebView
// ever leaves the context suspended, a resume() promise that never settles
// must not wedge unlockSfx() in flight for the whole session. A suspended
// device is re-resumed by the next gesture (backend.resume below).
const RESUME_WAIT_MS = 1000;

function unrefTimer(timer) {
  // Node's `node --test` only: browser/WebView timer ids are plain numbers.
  if (timer && typeof timer.unref === "function") timer.unref();
  return timer;
}

function wakeContext(ctx) {
  try {
    if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
      Promise.resolve(ctx.resume()).catch(() => {});
    }
  } catch {
    // never throw.
  }
}

// The music element helpers (quick task 260924-51h). `voice` is the
// per-device music record `{ trackId, el, source, gainNode, pauseTimer }`.
function clearPauseTimer(voice) {
  if (voice && voice.pauseTimer) {
    clearTimeout(voice.pauseTimer);
    voice.pauseTimer = null;
  }
}

function pauseElement(el) {
  try {
    el?.pause?.();
  } catch {
    // never throw.
  }
}

function playElement(handle, voice) {
  wakeContext(handle?.ctx);
  try {
    const p = voice.el.play();
    // Autoplay/unlock refusals stay silent: a later gesture nudges the
    // loop again (resumeLoop).
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // never throw.
  }
}

// Phase 71 (D-03): set one AudioParam at once — cancel any scheduled
// automation, then pin the value at the context's current time. Never throws.
function setParamNow(handle, param, value) {
  try {
    if (!param || typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
    const now = handle?.ctx?.currentTime ?? 0;
    param.cancelScheduledValues(now);
    param.setValueAtTime(value, now);
  } catch {
    // never throw.
  }
}

function setMusicLevel(handle, voice, gain) {
  try {
    const param = voice.gainNode?.gain;
    if (param) {
      const now = handle?.ctx?.currentTime ?? 0;
      param.cancelScheduledValues(now);
      param.setValueAtTime(gain, now);
    } else {
      voice.el.volume = gain;
    }
  } catch {
    // never throw.
  }
}

const DEFAULT_BACKEND = {
  async open() {
    try {
      if (typeof window === "undefined") return null;
      let ctx = null;
      if (typeof window.AudioContext === "function") {
        ctx = new window.AudioContext();
      } else if (typeof window.webkitAudioContext === "function") {
        ctx = new window.webkitAudioContext();
      }
      if (!ctx) return null;
      if (typeof ctx.resume === "function") {
        let timer = null;
        try {
          await Promise.race([
            Promise.resolve(ctx.resume()).catch(() => {}),
            new Promise((resolve) => {
              timer = unrefTimer(setTimeout(resolve, RESUME_WAIT_MS));
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      // Phase 71 (D-03): the effects bus — every one-shot voice (after its
      // own CLIP_GAIN node) feeds this, and this feeds the master. The theme
      // does NOT go through it (R-04): MASTER scales everything, EFFECTS the
      // one-shots only, MUSIC the theme only.
      let effectsGain = null;
      try {
        effectsGain = ctx.createGain();
        effectsGain.connect(masterGain);
      } catch {
        effectsGain = null; // one-shots fall back to the master directly.
      }
      return { ctx, masterGain, effectsGain };
    } catch {
      return null;
    }
  },

  resume(handle) {
    wakeContext(handle?.ctx);
  },

  // Quick task 260924-51h, ORCHESTRATOR OVERRIDE: the theme is STREAMED
  // through one HTMLAudioElement, never decodeAudioData'd whole (about
  // 145 s of stereo would decode to roughly 50 MB of PCM per title visit).
  // The element is created lazily on the first start (preload set only
  // then — always after a gesture or, on native, after first paint), with
  // loop = true and the same relative ./sfx/<id>.mp3 path the clips use (no
  // fetch call of its own, per the offline gate). It is routed ONCE through
  // ctx.createMediaElementSource(el) -> a music GainNode at `gain` -> the
  // device's masterGain, so it shares the Sound gate, the master level and
  // the teardown with the one-shots. createMediaElementSource may only be
  // called once per element, so the element and its source node are kept
  // on the device handle for reuse across title visits; a new device (after
  // Sound Off/On) gets a fresh element. If the graph is unavailable, the
  // bare element plays at el.volume = gain and stops without a fade.
  startLoop(handle, trackId, gain) {
    try {
      if (!handle) return null;
      let voice = handle.music;
      if (!voice || voice.trackId !== trackId) {
        const AudioCtor = globalThis.Audio;
        if (typeof AudioCtor !== "function") return null;
        const el = new AudioCtor();
        el.loop = true;
        el.preload = "auto";
        el.src = `./sfx/${trackId}.mp3`;
        voice = { trackId, el, source: null, gainNode: null, pauseTimer: null };
        const ctx = handle.ctx;
        if (ctx && typeof ctx.createMediaElementSource === "function") {
          try {
            voice.source = ctx.createMediaElementSource(el);
            const out = handle.masterGain || ctx.destination;
            try {
              const gainNode = ctx.createGain();
              voice.source.connect(gainNode);
              gainNode.connect(out);
              voice.gainNode = gainNode;
            } catch {
              // no gain node: the source still has to reach the output, or
              // the captured element would be silent.
              voice.source.connect(out);
            }
          } catch {
            voice.source = null;
            voice.gainNode = null;
          }
        }
        handle.music = voice;
      }
      clearPauseTimer(voice);
      setMusicLevel(handle, voice, gain);
      try {
        voice.el.currentTime = 0;
      } catch {
        // an element with no metadata yet may refuse a seek — it starts at 0 anyway.
      }
      playElement(handle, voice);
      return voice;
    } catch {
      return null;
    }
  },

  resumeLoop(handle, voice) {
    try {
      if (!voice?.el || voice.pauseTimer) return;
      wakeContext(handle?.ctx);
      if (voice.el.paused) playElement(handle, voice);
    } catch {
      // never throw.
    }
  },

  fadeOut(handle, voice, ms) {
    try {
      if (!voice?.el) return;
      clearPauseTimer(voice);
      const param = voice.gainNode?.gain;
      const ctx = handle?.ctx;
      if (ms > 0 && param && ctx) {
        try {
          const now = ctx.currentTime;
          param.cancelScheduledValues(now);
          param.setValueAtTime(param.value, now);
          param.linearRampToValueAtTime(0, now + ms / 1000);
          voice.pauseTimer = unrefTimer(
            setTimeout(() => {
              voice.pauseTimer = null;
              pauseElement(voice.el);
            }, ms),
          );
          return;
        } catch {
          clearPauseTimer(voice);
          // the ramp failed — fall through to an immediate pause.
        }
      }
      pauseElement(voice.el);
    } catch {
      // never throw.
    }
  },

  async load(handle, clipId) {
    try {
      if (!handle?.ctx) return null;
      // Same-origin RELATIVE path only — the clip lives in the bundled
      // www/sfx/ copy (copySfx(), 56-01); no absolute URL, no host, no
      // scheme, ever, per the offline gate.
      const response = await fetch(`./sfx/${clipId}.mp3`);
      if (!response?.ok) return null;
      const bytes = await response.arrayBuffer();
      const buffer = await handle.ctx.decodeAudioData(bytes);
      return buffer || null;
    } catch {
      return null;
    }
  },

  start(handle, buffer, gain = 1) {
    try {
      if (!handle?.ctx || !buffer) return null;
      const ctx = handle.ctx;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Phase 71 (D-01): source -> a per-voice gain at the clip's CLIP_GAIN
      // level -> the effects bus (or the master, or the destination on an
      // older handle). The returned voice is still the source node, so
      // stop() and the FIFO are unchanged.
      const out = handle.effectsGain || handle.masterGain || ctx.destination;
      const level = typeof gain === "number" && Number.isFinite(gain) && gain >= 0 ? gain : 1;
      let voiceGain = null;
      try {
        voiceGain = ctx.createGain();
        voiceGain.gain.value = level;
        voiceGain.connect(out);
      } catch {
        voiceGain = null; // no per-voice gain — the clip plays at unity.
      }
      source.connect(voiceGain || out);
      // No lead-in, no lookahead, no delay constant — starts at the
      // context's current time. Combat/rail pacing is Phase 58's concern,
      // not this backend's.
      source.start(handle.ctx.currentTime);
      return source;
    } catch {
      return null;
    }
  },

  // Phase 71 (D-03): the MASTER and EFFECTS sliders, applied live.
  setLevels(handle, levels) {
    try {
      setParamNow(handle, handle?.masterGain?.gain, levels?.master);
      setParamNow(handle, handle?.effectsGain?.gain, levels?.effects);
    } catch {
      // never throw.
    }
  },

  // Phase 71 (D-03): the MUSIC slider on a live loop. A loop that is fading
  // out (pauseTimer set) is left alone, so a drag never cancels the fade.
  setLoopLevel(handle, voice, gain) {
    try {
      if (!voice?.el || voice.pauseTimer) return;
      if (typeof gain !== "number" || !Number.isFinite(gain) || gain < 0) return;
      setMusicLevel(handle, voice, gain);
    } catch {
      // never throw.
    }
  },

  stop(voice) {
    try {
      voice?.stop?.(0);
    } catch {
      // an already-ended/spent voice throwing on stop() must never
      // propagate — the FIFO eviction path depends on this being silent.
    }
  },

  close(handle) {
    // Quick task 260924-51h: release the music element with its device — a
    // source node is bound to this context, so the next device builds a
    // fresh element rather than reusing this one.
    try {
      const voice = handle?.music;
      if (voice) {
        clearPauseTimer(voice);
        pauseElement(voice.el);
        voice.el?.removeAttribute?.("src");
        voice.el?.load?.();
        handle.music = null;
      }
    } catch {
      // never throw on teardown.
    }
    try {
      handle?.ctx?.close?.();
    } catch {
      // an already-closed/broken context must never throw on teardown.
    }
  },
};

/**
 * resolveBackend() — read at CALL TIME (never cached) so a test can swap
 * the backend per test via `globalThis.__mzSfxBackendOverride`. Shipped
 * code only ever READS this global; it is never assigned here. Mirrors
 * haptics.js's `__mzHapticsImportOverride` / nativeChrome.js's
 * `__mzAppImportOverride` injection shape.
 */
function resolveBackend() {
  return globalThis.__mzSfxBackendOverride?.() ?? DEFAULT_BACKEND;
}

// VOICE_CAP — CONTEXT's polyphony cap (56-CONTEXT.md "Full polyphony capped
// at 8 concurrent voices"): full overlap is what AUD-04 asks for, but an
// unbounded voice count is a mid-range-phone hazard, so the 9th simultaneous
// voice stops the oldest rather than being refused or throwing.
export const VOICE_CAP = 8;

// Module state for the backend half only:
//  - currentSettings: the settings mirror. null (before applySfxSettings()
//    ever runs) is treated as sound-ON-UNKNOWN — unlockSfx() will proceed —
//    but no device is opened until a gesture actually calls unlockSfx().
//  - deviceHandle: null until a successful unlock; cleared again when Sound
//    flips off mid-session.
//  - bufferCache: clipId -> decoded buffer, filled in as each of the 30
//    parallel loads lands (or left absent for a clip that never resolves or
//    resolves null).
//  - unlockInFlight: guards a second unlockSfx() call while backend.open()
//    is still pending.
//  - liveVoices: FIFO of currently-playing voices, oldest first.
// Phase 71 (D-03): currentSettings also carries the three volume sliders
// (volMaster / volMusic / volEffects); applyLevels() below pushes them to the
// open device and the live loop whenever the mirror changes or a new device
// opens.
let currentSettings = null;
let deviceHandle = null;
const bufferCache = new Map();
let unlockInFlight = false;
const liveVoices = [];

function soundIsOff() {
  return !!(currentSettings && currentSettings.sound === false);
}

/**
 * applyLevels() — internal, Phase 71 (D-03). Pushes volumeLevels(currentSettings)
 * to the open device (optional backend.setLevels: master + effects) and to a
 * live loop on that device (optional backend.setLoopLevel at MUSIC_GAIN *
 * music). A stopped or fading loop is already forgotten by stopMusic(), so it
 * is never re-levelled. A backend without either method is a silent no-op.
 * Never throws.
 */
function applyLevels() {
  try {
    if (!deviceHandle) return;
    const backend = resolveBackend();
    const levels = volumeLevels(currentSettings);
    if (typeof backend.setLevels === "function") {
      try {
        backend.setLevels(deviceHandle, { master: levels.master, effects: levels.effects });
      } catch {
        // a level write is best effort.
      }
    }
    if (musicVoice && musicHandle === deviceHandle && typeof backend.setLoopLevel === "function") {
      try {
        backend.setLoopLevel(deviceHandle, musicVoice, MUSIC_GAIN * levels.music);
      } catch {
        // a level write is best effort.
      }
    }
  } catch {
    // never throw.
  }
}

/**
 * unlockSfx() — exported, async, idempotent, never throws. This is the ONE
 * construction site for the audio device: it bails immediately when Sound
 * is off (the guard that makes "no audio device is opened while Sound is
 * Off" literally true), when a handle already exists, or when an unlock is
 * already in flight. On a successful open() it kicks backend.load() for
 * ALL 30 CLIP_IDS in parallel and does NOT await them — decode is off the
 * critical path, so a clip fired before its own decode lands is dropped by
 * playClips() below, never queued.
 *
 * Quick task 260924-51h: when the device is ALREADY open, a later call asks
 * the backend to resume it (optional backend.resume). The native build opens
 * the device at launch with no gesture; should the WebView leave that
 * context suspended, the next tap wakes it here. Still never a second open.
 */
export async function unlockSfx() {
  try {
    if (soundIsOff()) return;
    if (deviceHandle) {
      try {
        const backend = resolveBackend();
        if (typeof backend.resume === "function") backend.resume(deviceHandle);
      } catch {
        // waking an open device is best effort — never throw.
      }
      return;
    }
    if (unlockInFlight) return;
    unlockInFlight = true;

    const backend = resolveBackend();
    let handle = null;
    try {
      handle = await backend.open();
    } finally {
      unlockInFlight = false;
    }
    if (!handle) return; // audio unavailable — resting state, a later gesture can retry
    deviceHandle = handle;
    // Phase 71 (D-03): the new device takes the saved slider levels at once,
    // before any clip can play on it.
    applyLevels();

    for (const clipId of CLIP_IDS) {
      try {
        Promise.resolve(backend.load(deviceHandle, clipId))
          .then((buffer) => {
            if (buffer) bufferCache.set(clipId, buffer);
          })
          .catch(() => {
            // missing file / bad bytes / decode failure — that one clip
            // degrades to silence, every other clip still decodes.
          });
      } catch {
        // a synchronously-throwing load() must not stop the other 29
        // decodes from being attempted.
      }
    }
  } catch {
    unlockInFlight = false;
  }
}

/**
 * playClips(clipIds) — internal. Starts a voice per id, IN THE ORDER
 * RECEIVED, off already-decoded buffers only:
 *  - no device, Sound off, or an empty/non-array list -> returns having
 *    touched no state.
 *  - a clip whose buffer isn't in the cache yet (still decoding, missing,
 *    or failed to decode) is DROPPED and the rest continue — a late sound
 *    is worse than no sound, so it is never queued or retried.
 *  - a successfully started voice is pushed onto the FIFO; while the FIFO
 *    exceeds VOICE_CAP the OLDEST voice is shifted off and stopped — the
 *    9th simultaneous voice stops the oldest, never refuses the new one.
 */
function playClips(clipIds) {
  if (!deviceHandle) return;
  if (soundIsOff()) return;
  if (!Array.isArray(clipIds) || clipIds.length === 0) return;

  const backend = resolveBackend();
  for (const clipId of clipIds) {
    try {
      const buffer = bufferCache.get(clipId);
      if (!buffer) continue;
      // Phase 71 (D-01): the clip's CLIP_GAIN level rides as the third
      // argument; a five-method fake that ignores it still plays.
      const voice = backend.start(deviceHandle, buffer, clipGain(clipId));
      if (!voice) continue;
      liveVoices.push(voice);
      while (liveVoices.length > VOICE_CAP) {
        const oldest = liveVoices.shift();
        try {
          backend.stop(oldest);
        } catch {
          // stopping the evicted voice must never throw upstream.
        }
      }
    } catch {
      // one clip's backend failure must never cancel the rest of the
      // dispatch's clips.
    }
  }
}

/**
 * playForDispatch(actionType, events, ctx) — exported. The dispatch-path
 * seam: resolves clipsForDispatch()'s ordered clip list and plays it.
 * Always returns undefined, and is wrapped so nothing it does can throw
 * into dispatchWithNarration's render tail.
 */
export function playForDispatch(actionType, events, ctx) {
  try {
    playClips(clipsForDispatch(actionType, events, ctx));
  } catch {
    // cosmetic polish — never throw into the dispatch path.
  }
  return undefined;
}

/**
 * playClipIds(clipIds) — exported. Phase 58 (D-12): plays a list of
 * already-resolved clip ids through the same internal playClips() path
 * (device + Sound-Off guard) that every other clip uses — this is how a
 * combat beat (src/browser/combatBeat.js) plays each exchange's clips
 * together with its own fight-log line, without opening a second audio
 * path. A non-array `clipIds` is treated as empty; non-string entries are
 * dropped. Never throws; always returns undefined.
 */
export function playClipIds(clipIds) {
  try {
    const list = Array.isArray(clipIds) ? clipIds.filter((id) => typeof id === "string") : [];
    playClips(list);
  } catch {
    // cosmetic polish — never throw.
  }
  return undefined;
}

/**
 * playUiTap() — exported. Plays the uiTap group through the same variation
 * (defaultVariation, shared with clipsForDispatch above) and playClips()
 * path used by every other clip. Never throws.
 */
export function playUiTap() {
  try {
    const clip = defaultVariation.next("uiTap");
    if (clip) playClips([clip]);
  } catch {
    // cosmetic polish — never throw.
  }
  return undefined;
}

/**
 * stopAllSfx() — exported. Stops every live voice and empties the FIFO.
 * Quick task 260924-51h: also cuts the title theme at once (no fade), so
 * stopAllSfx silences everything — the app-background path relies on this.
 * Never throws.
 */
export function stopAllSfx() {
  try {
    const backend = resolveBackend();
    while (liveVoices.length > 0) {
      const voice = liveVoices.shift();
      try {
        backend.stop(voice);
      } catch {
        // an already-spent voice must never throw upstream.
      }
    }
    stopMusic({ fadeMs: 0 });
  } catch {
    // never throw.
  }
}

/**
 * applySfxSettings(settings) — exported. Stores the settings mirror.
 *
 * On a transition to Sound OFF: stops every in-flight voice IMMEDIATELY
 * (the pinned toggle-boundary answer — nothing is allowed to finish out),
 * closes the device, and clears the handle + buffer cache, so no audio
 * device stays open while Sound reads Off.
 *
 * On a transition to Sound ON: does NOT open anything here. The next
 * unlockSfx() call — driven by the next user gesture — performs the open
 * and re-decode. This is what keeps "flip Sound on before any gesture"
 * silent-but-errorless instead of attempting a gesture-less open.
 *
 * Phase 71 (D-03): afterwards, for ANY settings, the volume sliders are
 * applied live to the open device and a live loop (applyLevels) — this is
 * how a slider drag reaches a playing theme. With no device open it does
 * nothing; the next unlock applies the saved levels to the new device.
 */
export function applySfxSettings(settings) {
  try {
    const wasOff = soundIsOff();
    currentSettings = settings || null;
    const isOff = soundIsOff();

    if (!wasOff && isOff) {
      // stopAllSfx also cuts the title theme (quick task 260924-51h), so the
      // loop is silenced before the device it plays through is closed.
      stopAllSfx();
      if (deviceHandle) {
        const backend = resolveBackend();
        try {
          backend.close(deviceHandle);
        } catch {
          // an already-broken device must never throw on teardown.
        }
      }
      deviceHandle = null;
      bufferCache.clear();
    }
    applyLevels();
  } catch {
    // never throw.
  }
  return undefined;
}

// ============================================================================
// Quick task 260924-51h: the title theme. A looping music track on the same
// device as the one-shots — same Sound gate, same master level, same
// teardown. Phase 71 (D-02/D-03): its level is MUSIC_GAIN times the MUSIC
// slider, re-applied live while the loop plays (applyLevels). WHEN it plays is decided by the pure controller in
// src/browser/titleMusic.js; mazeworld.html wires the two together.
// ============================================================================

// MUSIC_IDS — the one declared music track: sfx/theme.mp3, beside the clips
// and copied to www/sfx/ by copySfx(). It is never in CLIP_IDS, so
// unlockSfx() never loads it and playClips() can never fire it as a
// one-shot. test/unit/sfx-assets.test.js pins sfx/ as 30 clips + this 1.
export const MUSIC_IDS = Object.freeze(["theme"]);

// MUSIC_GAIN — R-09: the loop still sits below the one-shots' unity level.
// Raised from 0.5 to 0.9 on the 2026-09-24 Pixel 7 device round (Phase 71
// D-02: the theme was too soft). The loop runs through its own gain node
// into the device's masterGain (not the effects bus, R-04); its live level is
// MUSIC_GAIN times the player's MUSIC slider (volumeLevels().music, D-03).
export const MUSIC_GAIN = 0.9;

// Module state for the music half:
//  - musicVoice: the live loop (the backend's voice), or null.
//  - musicHandle: the device handle musicVoice plays on, so a stop always
//    reaches the device the loop actually started on.
// Nothing decoded is ever held here: the theme STREAMS through a media
// element (orchestrator override — about 145 s of stereo decodes to roughly
// 50 MB of PCM, which must not sit resident on a mid-range phone). The
// element starts fetching only when music is first wanted, which is always
// after first paint (R-08); a missing or unplayable file is silent.
let musicVoice = null;
let musicHandle = null;

/**
 * isSfxUnlocked() — exported. True once a device is open (after a
 * successful unlockSfx()), false again after a Sound-Off teardown. The
 * title-music controller's `unlocked` input. Never throws.
 */
export function isSfxUnlocked() {
  return !!deviceHandle;
}

/**
 * startMusic(trackId = MUSIC_IDS[0]) — exported. Starts the looping track
 * from the top on the open device. Silently does nothing for an unknown id,
 * with no device, with Sound Off, or on a backend without startLoop. While
 * a loop is already live on this device it never restarts it: it only
 * nudges it (backend.resumeLoop — resume a suspended device, re-play an
 * element whose play() was refused), which is how a later gesture rescues a
 * launch-time start the WebView declined. Never throws; returns undefined.
 */
export function startMusic(trackId = MUSIC_IDS[0]) {
  try {
    if (!MUSIC_IDS.includes(trackId)) return undefined;
    if (!deviceHandle || soundIsOff()) return undefined;
    const backend = resolveBackend();
    if (typeof backend.startLoop !== "function") return undefined;
    if (musicVoice) {
      if (musicHandle === deviceHandle) {
        try {
          backend.resumeLoop?.(deviceHandle, musicVoice);
        } catch {
          // a nudge is best effort.
        }
        return undefined;
      }
      // a loop left over from a closed device — forget it.
      musicVoice = null;
      musicHandle = null;
    }
    // Phase 71 (D-03): the loop's level is MUSIC_GAIN times the MUSIC slider.
    const voice = backend.startLoop(deviceHandle, trackId, MUSIC_GAIN * volumeLevels(currentSettings).music);
    if (voice) {
      musicVoice = voice;
      musicHandle = deviceHandle;
    }
  } catch {
    // cosmetic polish — never throw.
  }
  return undefined;
}

/**
 * stopMusic({ fadeMs = 0 } = {}) — exported. Stops the live loop: fades it
 * out over fadeMs then pauses (backend.fadeOut), or falls back to
 * backend.stop(voice). A non-finite or negative fadeMs becomes 0 (cut at
 * once). With no live loop it calls nothing. Never throws.
 */
export function stopMusic({ fadeMs = 0 } = {}) {
  try {
    const voice = musicVoice;
    const handle = musicHandle;
    musicVoice = null;
    musicHandle = null;
    if (!voice) return undefined;
    const ms = typeof fadeMs === "number" && Number.isFinite(fadeMs) && fadeMs > 0 ? fadeMs : 0;
    const backend = resolveBackend();
    if (typeof backend.fadeOut === "function") backend.fadeOut(handle, voice, ms);
    else backend.stop(voice);
  } catch {
    // never throw.
  }
  return undefined;
}
