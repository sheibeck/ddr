// src/browser/fightLog.js
//
// Phase 34 (CSCR-04) — the whole-fight, newest-first, tap-to-reveal fight
// log (it replaced the Phase 32 Round Card).
//
// Decision 1 (34-01-PLAN.md objective, RESEARCH Open Question 1): the
// fight log's lines are sourced from `linesForAction(type, events, ctx,
// { limit: Infinity, withIdx: true })` — the SAME folded/deduped pipeline —
// rather than from raw `formatEvents()` output.
// 34-CONTEXT.md pins "log line count = folded count" (the worst-case
// fight-log round test pins line count = folded count), so the
// folding/dedup pipeline must stay the ONE source; sourcing lines from raw
// per-event HTML would yield one
// line per narrated event and break both that pin and the 400-seed fold
// proof. A folded multi-event entry reveals the dice of its FIRST
// constituent event (`events[idx]`, via `narrateEvent`/`oracleDetailText`)
// — the Oracle stays the complete per-swing log (CSCR-04: "the Oracle
// stays the complete log").
//
// PRESENTATION ONLY, pure module: no DOM/global access, no timers, no
// storage anywhere in this file. Every export is a plain function
// returning plain data — the shell's own presentation-only global bridge
// (mazeworld.html) is where the caller stores this module's output; this
// module never touches `S`/`state`.

import { linesForAction, PRIORITY, narrativeLineText, oracleDetailText } from "./narrationLines.js";
import { narrateEvent } from "./eventNarration.js";

/** FIGHT_LOG_TONES — the two tones a fight-log entry carries. */
export const FIGHT_LOG_TONES = Object.freeze(["narrative", "dull"]);

/**
 * fightLogLinesFor(type, events, ctx = {}) — one fight-log line per folded
 * linesForAction entry (uncapped, per the Decision 1 fold-preserving
 * source). Each line is `{ text, tone, roll }`:
 *   - text: the folded line's own text (narrativeLineText-normalized —
 *     already roll-free from LINE_FOR/ctx.narrate, this is a defensive
 *     pass so the fight log never renders a stray tag).
 *   - tone: "dull" when the entry's priority is PRIORITY.block (a
 *     refusal/rejection), else "narrative".
 *   - roll: the folded entry's FIRST constituent event's Oracle sentence
 *     (dice kept), via `oracleDetailText(narrateEvent(events[idx]))`, or
 *     null when that event has no roll span to reveal.
 */
export function fightLogLinesFor(type, events, ctx = {}) {
  const lines = linesForAction(type, events, ctx, { limit: Infinity, withIdx: true });
  return lines.map((t) => ({
    text: narrativeLineText(t.text) || t.text,
    tone: t.priority === PRIORITY.block ? "dull" : "narrative",
    roll: oracleDetailText(narrateEvent(events[t.idx])) || null,
  }));
}

/** emptyFightLog() — the fight log's zero state. */
export function emptyFightLog() {
  return { seq: 0, nextId: 1, entries: [] };
}

/**
 * dullFightLogLine(text) — a manually-built dull entry (no fold pipeline
 * involved), for shell call sites that need to inject a single dull line
 * directly (mirrors the shape fightLogLinesFor produces).
 */
export function dullFightLogLine(text) {
  return { text: String(text ?? ""), tone: "dull", roll: null };
}

/**
 * appendFightLog(log, lines, round) — appends `lines` (fightLogLinesFor's
 * output, or dullFightLogLine's) to `log` as a new batch, returning a NEW
 * log object (never mutates `log`). A null/undefined `log` is treated as
 * `emptyFightLog()`. Each appended entry gets a strictly-increasing `id`,
 * the batch's `seq` (log.seq + 1), the given `round`, and `show: false`.
 */
export function appendFightLog(log, lines, round) {
  const base = log || emptyFightLog();
  const seq = base.seq + 1;
  const entries = lines.map((l, k) => ({
    id: base.nextId + k,
    seq,
    text: l.text,
    tone: l.tone,
    roll: l.roll ?? null,
    round: round ?? null,
    show: false,
  }));
  return {
    seq,
    nextId: base.nextId + lines.length,
    entries: [...base.entries, ...entries],
  };
}

/** fightLogRows(log) — entries newest-first (last appended first); [] for a null log. Never mutates. */
export function fightLogRows(log) {
  if (!log || !Array.isArray(log.entries)) return [];
  return [...log.entries].reverse();
}

/**
 * toggleFightLogEntry(log, id) — flips the `show` flag of the entry whose
 * `id` matches; returns a NEW log object (seq unchanged). When no entry
 * matches, returns the input log unchanged (same reference).
 */
export function toggleFightLogEntry(log, id) {
  if (!log || !Array.isArray(log.entries)) return log;
  if (!log.entries.some((e) => e.id === id)) return log;
  return {
    ...log,
    entries: log.entries.map((e) => (e.id === id ? { ...e, show: !e.show } : e)),
  };
}

/**
 * fightLogAnnouncement(log, announcedSeq) — the aria-live announcer's next
 * text: every entry whose `seq` is greater than `announcedSeq`, joined by
 * a single space in append order. Returns `{ seq: log.seq, text }`; for a
 * null/empty log (or when nothing is newer than `announcedSeq`), `text` is
 * "" and `seq` is `log.seq` (0 for a null log).
 */
export function fightLogAnnouncement(log, announcedSeq) {
  if (!log || !Array.isArray(log.entries)) return { seq: 0, text: "" };
  const text = log.entries
    .filter((e) => e.seq > announcedSeq)
    .map((e) => e.text)
    .join(" ");
  return { seq: log.seq, text };
}
