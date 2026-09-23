// src/browser/combatBeat.js
//
// Phase 58 (MOTION-03/05) — the pure combat-beat core. The engine still
// resolves a whole combat round in ONE dispatch: your blow, every foe's
// blow, deaths, level-ups, all at once. This module changes nothing about
// what the engine resolves or when — it only decides when the shell SHOWS
// each exchange, one fight-log line at a time, per D-09 ("the engine
// resolves at once and the shell reveals one exchange at a time, numbers
// moving with their line where the event carries them"), D-10 (the first
// exchange lands immediately, then ~600 ms between), D-11 (tap to hurry,
// buttons arm only after the last line, nothing lost) and D-17 (reduced
// motion resolves the whole beat instantly with nothing lost).
//
// PRESENTATION ONLY, pure module (the timed half closes over injected
// setTimeout/clearTimeout, never reads a global timer or window/document):
// no engine/ or content/ import, no pseudo-random source anywhere in this
// file, and no argument passed to any export is ever mutated — every
// derived object below is a new one. Every number a mid-beat frame shows
// comes only from the event payload that line folded (a struck/allyStruck
// dmg, a struckByFoe dmg, a foeKilled naming exactly one foe still
// standing); an ambiguous or numberless event changes nothing, and
// whatever it would have shown settles when the round's last line lands.
//
// Imports nothing but the two pure modules whose output this module
// sequences: fightLogLinesFor/appendFightLog (src/browser/fightLog.js) and
// linesForAction (src/browser/narrationLines.js).

import { fightLogLinesFor, appendFightLog } from "./fightLog.js";
import { linesForAction } from "./narrationLines.js";

/**
 * BEAT_GAP_MS — D-10. The floor on the gap between two consecutive
 * fight-log lines revealing: about 600 ms, never less (a longer-typing
 * line pushes the NEXT line out further, per beatOffsets below, but never
 * cuts one short).
 */
export const BEAT_GAP_MS = 600;

/** safeDuration(v) — a non-finite or negative durationFor result reads 0. */
function safeDuration(v) {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * beatOffsets(texts, durationFor = () => 0) — D-10. The reveal schedule:
 * the first line lands at 0 ms; each later line lands
 * `max(BEAT_GAP_MS, durationFor(previous line's text))` after the
 * previous line's own offset, so the gap never cuts off a still-typing
 * line. Returns [] for an empty/non-array `texts`.
 */
export function beatOffsets(texts, durationFor = () => 0) {
  const list = Array.isArray(texts) ? texts : [];
  const offsets = [];
  for (let i = 0; i < list.length; i++) {
    if (i === 0) {
      offsets.push(0);
      continue;
    }
    const prevDur = safeDuration(durationFor(list[i - 1]));
    offsets.push(offsets[i - 1] + Math.max(BEAT_GAP_MS, prevDur));
  }
  return offsets;
}

/**
 * beatEndMs(texts, durationFor = () => 0) — D-11. The moment the LAST line
 * has fully landed (its own offset plus its own typing duration) — the
 * moment the action buttons may arm. 0 for an empty/non-array `texts`.
 */
export function beatEndMs(texts, durationFor = () => 0) {
  const list = Array.isArray(texts) ? texts : [];
  if (list.length === 0) return 0;
  const offsets = beatOffsets(list, durationFor);
  const lastDur = safeDuration(durationFor(list[list.length - 1]));
  return offsets[offsets.length - 1] + lastDur;
}

/**
 * lineIdxsFor(actionType, events, ctx = {}) — the SAME
 * `linesForAction(..., { limit: Infinity, withIdx: true })` call
 * fightLogLinesFor makes, reporting only each fold line's first
 * constituent event index. Aligned 1:1 with
 * `fightLogLinesFor(actionType, events, ctx)` by construction (same call,
 * same order, same count). [] for a non-array `events`.
 */
export function lineIdxsFor(actionType, events, ctx = {}) {
  if (!Array.isArray(events)) return [];
  return linesForAction(actionType, events, ctx, { limit: Infinity, withIdx: true }).map((l) => l.idx);
}

/**
 * cueLines(cues, idxs) — Phase 58 discovery note "Cue ownership rule": a
 * cue belongs to the line with the greatest first-event `idx` that is
 * `<=` the cue's own `idx`; a cue earlier than every line (including the
 * synthesized step clip at idx -1) belongs to line 0, the first line
 * revealed; ties go to the earlier line; within a line, cues keep their
 * input order. Returns one clip-id array per entry in `idxs` — the union
 * of every returned array is a permutation of the input clips (nothing is
 * ever dropped). An empty `idxs` puts everything in a single line-0
 * bucket (there being no real line to own it otherwise).
 */
export function cueLines(cues, idxs) {
  const idxList = Array.isArray(idxs) ? idxs : [];
  const cueList = Array.isArray(cues) ? cues : [];

  if (idxList.length === 0) {
    return [cueList.filter((c) => c && typeof c === "object").map((c) => c.clip)];
  }

  const lines = idxList.map(() => []);
  for (const cue of cueList) {
    if (!cue || typeof cue !== "object") continue;
    const cueIdx = cue.idx;
    let owner = 0;
    let best = -Infinity;
    for (let i = 0; i < idxList.length; i++) {
      const lineIdx = idxList[i];
      if (lineIdx <= cueIdx && lineIdx > best) {
        best = lineIdx;
        owner = i;
      }
    }
    lines[owner].push(cue.clip);
  }
  return lines;
}

/**
 * foeFrames(foes, lineEvents) — D-09's discretion clause. One cumulative
 * frame per entry in `lineEvents`, each an array parallel to `foes` of
 * `{ wp, alive, hit }` (`hit` resets to false every line). A frame moves a
 * foe's bar only when that line's event is `struck`/`allyStruck` with a
 * numeric `dmg` and a `target` matching EXACTLY ONE foe still standing (in
 * THIS frame, before the event applies) — or a `foeKilled` naming exactly
 * one such foe. An ambiguous name (two foes sharing it), a non-numeric
 * `dmg`, or an unrecognized event type changes nothing; that entry's frame
 * simply repeats the previous one with `hit` cleared. Never mutates
 * `foes`.
 */
export function foeFrames(foes, lineEvents) {
  const foeList = Array.isArray(foes) ? foes : [];
  const events = Array.isArray(lineEvents) ? lineEvents : [];

  let current = foeList.map((f) => ({ wp: f && typeof f.wp === "number" ? f.wp : 0, alive: !!(f && f.alive) }));
  const frames = [];

  for (const e of events) {
    const frame = current.map((f) => ({ wp: f.wp, alive: f.alive, hit: false }));

    if (e && typeof e === "object") {
      const isFoeHit = (e.type === "struck" || e.type === "allyStruck") && typeof e.dmg === "number" && Number.isFinite(e.dmg);
      const isKill = e.type === "foeKilled";
      if (isFoeHit || isKill) {
        const name = isKill ? e.name : e.target;
        const candidates = [];
        for (let i = 0; i < foeList.length; i++) {
          if (foeList[i] && foeList[i].name === name && frame[i].alive) candidates.push(i);
        }
        if (candidates.length === 1) {
          const i = candidates[0];
          if (isFoeHit) {
            frame[i].wp = Math.max(0, frame[i].wp - e.dmg);
            frame[i].hit = true;
            if (frame[i].wp <= 0) frame[i].alive = false;
          } else {
            frame[i].wp = 0;
            frame[i].alive = false;
            frame[i].hit = true;
          }
        }
      }
    }

    frames.push(frame);
    current = frame.map(({ wp, alive }) => ({ wp, alive }));
  }

  return frames;
}

/**
 * heroFrames(hp, lineEvents) — cumulative hero HP, one entry per
 * `lineEvents` entry, clamped at 0, moved only by a numeric
 * `struckByFoe.dmg`. Never invents a number.
 */
export function heroFrames(hp, lineEvents) {
  const events = Array.isArray(lineEvents) ? lineEvents : [];
  let current = Number.isFinite(hp) ? hp : 0;
  const frames = [];
  for (const e of events) {
    if (e && typeof e === "object" && e.type === "struckByFoe" && typeof e.dmg === "number" && Number.isFinite(e.dmg)) {
      current = Math.max(0, current - e.dmg);
    }
    frames.push(current);
  }
  return frames;
}

/**
 * frameStateFor(base, foeFrame, heroHp) — a presentation-only state-shaped
 * object for one mid-beat frame; NEVER stored to `S`. A new,
 * shallow-copied object: `base` is never mutated, foes carrying a frame
 * entry get that frame's `wp`/`alive` (every other foe field is kept from
 * `base`), and `c.wp` is overridden to `heroHp`. A `base` with no
 * `combat` is returned as-is (nothing to frame).
 */
export function frameStateFor(base, foeFrame, heroHp) {
  if (!base || !base.combat) return base;
  const baseFoes = Array.isArray(base.combat.foes) ? base.combat.foes : [];
  const foes = baseFoes.map((f, i) => {
    const frame = Array.isArray(foeFrame) ? foeFrame[i] : null;
    if (!frame) return f;
    return { ...f, wp: frame.wp, alive: frame.alive };
  });
  return {
    ...base,
    c: { ...base.c, wp: heroHp },
    combat: { ...base.combat, foes },
  };
}

/**
 * planBeat({ actionType, events, before, after, beforeLog, afterLog, ctx,
 * cues }) — D-09/D-10/D-11. Builds the whole reveal plan for one combat
 * round's dispatch. Returns null (no beat, today's behaviour) when the
 * dispatch is not a combat round shown on the combat surface: `before` has
 * no `combat`, `after.combat.pending` is still true (the round has not
 * joined yet), `events` is not an array, or the fold yields zero
 * fight-log lines.
 *
 * Otherwise returns `{ count, texts, log, firstId, before, after, ending,
 * frames, heroHp, cueLines }` covering both a mid-fight round (`after`
 * still has `combat`; `log` is the real `afterLog`, `firstId ===
 * afterLog.nextId - count`) and a combat-ending round (`after.combat` is
 * null — a kill, flee or death; `log` is
 * `appendFightLog(beforeLog, lines, before.combat.round)`, so the killing
 * exchange still reads line by line on the combat body before the
 * over-panel takes over). Never mutates `before`, `after`, `beforeLog`,
 * `afterLog` or `events`.
 */
export function planBeat(opts = {}) {
  const { actionType, events, before, after, beforeLog = null, afterLog = null, ctx = {}, cues = [] } = opts || {};

  if (!before || !before.combat) return null;
  if (after && after.combat && after.combat.pending) return null;
  if (!Array.isArray(events)) return null;

  const lines = fightLogLinesFor(actionType, events, ctx);
  const idxs = lineIdxsFor(actionType, events, ctx);
  if (lines.length === 0) return null;
  if (lines.length !== idxs.length) return null; // defensive

  const texts = lines.map((l) => l.text);
  const lineEvents = idxs.map((i) => events[i]);

  const ending = !(after && after.combat);
  const round = before.combat.round;

  let log;
  let firstId;
  if (ending) {
    log = appendFightLog(beforeLog, lines, round);
    firstId = log.nextId - lines.length;
  } else {
    log = afterLog;
    firstId = (afterLog ? afterLog.nextId : lines.length) - lines.length;
  }

  const frames = foeFrames(before.combat.foes, lineEvents);
  const heroHp = heroFrames(before.c ? before.c.wp : 0, lineEvents);
  // Bugfix (post-58-06, trap-death-21hp-oracle-minus1): lineEvents carries
  // only ONE representative event per folded line (lineIdxsFor's own
  // contract, inherited from narrationLines.js's enemyRound — a foe with
  // 2+ swings this round, or 3+ foes landing together, folds into one line
  // whose TEXT sums every hit but whose `idx` names only the first one).
  // heroFrames, fed that single event, silently under-counts the round's
  // real total whenever such a fold occurs. The gap is invisible on a
  // MID-FIGHT round (viewFor already substitutes the real `after` on its
  // own last line) but not on an ENDING round, where every line — including
  // the last, the one on screen the instant before the over-panel/settle
  // takes over — renders from this frame (D-09). Pin the final entry to
  // the already-known true final hp so the last number a player can see
  // before a beat settles never overstates survival. A no-op whenever
  // heroFrames' cumulative math was already exact (0 or 1 struckByFoe per
  // fold line, the common case).
  if (heroHp.length > 0 && after && after.c && typeof after.c.wp === "number") {
    heroHp[heroHp.length - 1] = Math.max(0, after.c.wp);
  }
  const cueLinesArr = cueLines(cues, idxs);

  return {
    count: lines.length,
    texts,
    log,
    firstId,
    before,
    after,
    ending,
    frames,
    heroHp,
    cueLines: cueLinesArr,
  };
}

// ============================================================================
// The timed half: a timer-driven beat controller (hurry, reduced motion)
// and a render/sound runner. Nothing above this line touches a timer.
// ============================================================================

/**
 * createBeat({ setTimeout, clearTimeout, reduced }) — D-10/D-11/D-17. A
 * timer-driven controller over one reveal `offsets`/`endMs` schedule at a
 * time. `reduced` is `() => boolean`, read live on every scheduled tick so
 * a mid-beat OS preference flip is honoured on the very next tick.
 *
 * Returns `{ start, hurry, cancel, active }`:
 *  - `start(offsets, endMs, { onLine, onEnd })`: if a run is already
 *    active, hurries it to its `onEnd` first. Zero offsets calls `onEnd`
 *    and returns. Under `reduced()` (checked once, at the top of `start`),
 *    every `onLine(k, { hurried: true })` fires in order, then `onEnd()`,
 *    all synchronously — no timer is ever scheduled. Otherwise `onLine(0,
 *    { hurried: false })` fires synchronously and the rest are scheduled:
 *    each later line at its own offset, then `onEnd` at `endMs` (measured
 *    from the last line's own offset — fired synchronously, with no timer,
 *    when that gap is exactly 0). Every scheduled tick re-checks
 *    `reduced()` first and hurries the rest of the run if it now reads
 *    true, rather than firing that line normally.
 *  - `hurry()`: a no-op with no active run. Otherwise clears the pending
 *    timer, fires every remaining line `onLine(k, { hurried: true })` in
 *    order (nothing is lost — D-11), deactivates, and calls `onEnd()`
 *    exactly once.
 *  - `cancel()`: clears the pending timer and deactivates with no further
 *    callback.
 *  - `active()`: true from `start` until `onEnd` fires (by any path), then
 *    false.
 *
 * Every callback is wrapped in a try so a throwing render can never leave
 * the beat active: control still deactivates and `onEnd` still fires.
 */
export function createBeat({ setTimeout: setTimer, clearTimeout: clearTimer, reduced = () => false } = {}) {
  let run = null; // { offsets, endMs, onLine, onEnd, next, timer }

  function fireOnLine(k, hurried) {
    try {
      run.onLine(k, { hurried });
    } catch {
      // a throwing onLine must never strand the beat active.
    }
  }

  function fireOnEnd() {
    const r = run;
    run = null;
    if (!r) return;
    try {
      r.onEnd();
    } catch {
      // a throwing onEnd must never propagate into the timer.
    }
  }

  function hurryRemaining() {
    const r = run;
    for (let k = r.next; k < r.offsets.length; k++) fireOnLine(k, true);
    fireOnEnd();
  }

  function hurry() {
    if (!run) return;
    if (run.timer !== null) {
      clearTimer(run.timer);
      run.timer = null;
    }
    hurryRemaining();
  }

  function scheduleNext() {
    const r = run;
    if (!r) return;

    if (r.next >= r.offsets.length) {
      const lastOffset = r.offsets[r.offsets.length - 1] ?? 0;
      const delay = Math.max(0, r.endMs - lastOffset);
      if (delay === 0) {
        if (reduced()) {
          hurryRemaining();
        } else {
          fireOnEnd();
        }
        return;
      }
      r.timer = setTimer(() => {
        if (!run) return;
        run.timer = null;
        if (reduced()) {
          hurryRemaining();
          return;
        }
        fireOnEnd();
      }, delay);
      return;
    }

    const prevOffset = r.next === 0 ? 0 : r.offsets[r.next - 1];
    const delay = Math.max(0, r.offsets[r.next] - prevOffset);
    r.timer = setTimer(() => {
      if (!run) return;
      run.timer = null;
      if (reduced()) {
        hurryRemaining();
        return;
      }
      const k = run.next;
      run.next += 1;
      fireOnLine(k, false);
      if (run) scheduleNext();
    }, delay);
  }

  function start(offsets, endMs, callbacks) {
    if (run) hurry();

    const { onLine, onEnd } = callbacks || {};
    const offsetList = Array.isArray(offsets) ? offsets : [];

    if (offsetList.length === 0) {
      try {
        onEnd();
      } catch {
        // never propagate.
      }
      return;
    }

    if (reduced()) {
      for (let k = 0; k < offsetList.length; k++) {
        try {
          onLine(k, { hurried: true });
        } catch {
          // never propagate.
        }
      }
      try {
        onEnd();
      } catch {
        // never propagate.
      }
      return;
    }

    run = { offsets: offsetList, endMs, onLine, onEnd, next: 1, timer: null };
    fireOnLine(0, false);
    if (!run) return; // a reentrant hurry()/cancel() from inside onLine already ended this run.
    scheduleNext();
  }

  function cancel() {
    if (!run) return;
    if (run.timer !== null) clearTimer(run.timer);
    run = null;
  }

  function active() {
    return !!run;
  }

  return { start, hurry, cancel, active };
}

/**
 * createBeatRunner({ beat, durationFor, onRender, onSettle, playClips }) —
 * D-12. Sequences render and sound per line over a `planBeat(...)` plan,
 * on top of an injected `createBeat` controller.
 *
 * `start(plan)`: false for a falsy plan (calls nothing). Otherwise
 * computes the schedule from `plan.texts`/`durationFor` and starts the
 * beat; each line's `onLine` (1) plays that line's cues via `playClips`,
 * (2) builds and stores that line's `view()`, and (3) calls `onRender`
 * with it — UNLESS the line arrived hurried and is not the round's last
 * line (a hurried mid-round line still plays its cues and updates the
 * stored view, but only the final render of a hurry paints). `onEnd`
 * clears the stored view and calls `onSettle()` once.
 *
 * `view()` returns the render contract 58-06 consumes: `{ state, log,
 * maxId, typeId, hitFoe, hurried, line, count, ending }`. `state` is
 * `plan.after` (the SAME reference) for a mid-fight round's last line;
 * every other line — and every line of an ending round, including its
 * last — is a presentation-only `frameStateFor(plan.before, ...)` frame,
 * so an ending round's bars never show the combat-less after-state.
 * `typeId` is `null` on a hurried line (nothing to type), else the line's
 * fight-log id. `hitFoe` is the index of the foe whose frame entry has
 * `hit` true on that line, else -1.
 */
export function createBeatRunner({ beat, durationFor = () => 0, onRender = () => {}, onSettle = () => {}, playClips = () => {} } = {}) {
  let currentView = null;

  function viewFor(plan, k, hurried) {
    const isLastLine = k === plan.count - 1;
    const state = isLastLine && !plan.ending ? plan.after : frameStateFor(plan.before, plan.frames[k], plan.heroHp[k]);
    const frame = Array.isArray(plan.frames[k]) ? plan.frames[k] : [];
    let hitFoe = -1;
    for (let i = 0; i < frame.length; i++) {
      if (frame[i] && frame[i].hit) {
        hitFoe = i;
        break;
      }
    }
    return {
      state,
      log: plan.log,
      maxId: plan.firstId + k,
      typeId: hurried ? null : plan.firstId + k,
      hitFoe,
      hurried,
      line: k,
      count: plan.count,
      ending: plan.ending,
    };
  }

  function start(plan) {
    if (!plan) return false;

    const offsets = beatOffsets(plan.texts, durationFor);
    const endMs = beatEndMs(plan.texts, durationFor);

    beat.start(offsets, endMs, {
      onLine(k, info) {
        const hurried = !!(info && info.hurried);
        try {
          playClips(plan.cueLines[k] || []);
        } catch {
          // cosmetic — never throw.
        }
        currentView = viewFor(plan, k, hurried);
        const isLast = k === plan.count - 1;
        if (!hurried || isLast) {
          try {
            onRender(currentView);
          } catch {
            // never propagate a throwing render.
          }
        }
      },
      onEnd() {
        currentView = null;
        try {
          onSettle();
        } catch {
          // never propagate.
        }
      },
    });
    return true;
  }

  return {
    start,
    hurry: () => beat.hurry(),
    active: () => beat.active(),
    view: () => currentView,
  };
}
