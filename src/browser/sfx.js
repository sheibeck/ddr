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

// CLIP_IDS — the 30 delivered clip basenames (no extension), exactly
// matching every file in sfx/ (and, after build, www/sfx/ via copySfx()).
// This list is asserted 1:1 against sfx/ by test/unit/sfx-map.test.js AND
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
//   start(handle, buffer)  -> voice|null              start one voice off an
//                             already-decoded buffer, immediately.
//   stop(voice)             -> void                    stop one in-flight
//                             voice.
//   close(handle)            -> void                    tear the device down.
//
// Every DEFAULT_BACKEND method individually swallows its own failure and
// returns null/void instead of propagating a throw — sound is cosmetic
// polish and must never break a dispatch, matching haptics.js's posture.
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
      if (typeof ctx.resume === "function") await ctx.resume();
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      return { ctx, masterGain };
    } catch {
      return null;
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

  start(handle, buffer) {
    try {
      if (!handle?.ctx || !buffer) return null;
      const source = handle.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(handle.masterGain || handle.ctx.destination);
      // No lead-in, no lookahead, no delay constant — starts at the
      // context's current time. Combat/rail pacing is Phase 58's concern,
      // not this backend's.
      source.start(handle.ctx.currentTime);
      return source;
    } catch {
      return null;
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
let currentSettings = null;
let deviceHandle = null;
const bufferCache = new Map();
let unlockInFlight = false;
const liveVoices = [];

function soundIsOff() {
  return !!(currentSettings && currentSettings.sound === false);
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
 */
export async function unlockSfx() {
  try {
    if (soundIsOff()) return;
    if (deviceHandle) return;
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
      const voice = backend.start(deviceHandle, buffer);
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
 */
export function applySfxSettings(settings) {
  try {
    const wasOff = soundIsOff();
    currentSettings = settings || null;
    const isOff = soundIsOff();

    if (!wasOff && isOff) {
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
  } catch {
    // never throw.
  }
  return undefined;
}
