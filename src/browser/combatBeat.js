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

