---
phase: 72-roll-direction-sign-audit-fixes
plan: 01
subsystem: docs (roll-direction audit ledger)
tags: [roll-01, audit, ledger, difficulty-readout]
dependency-graph:
  requires: []
  provides:
    - "docs/ROLL-LEDGER.md — the ROLL-01 audited ledger (site inventory, modifier ledger, known fixes, new findings, rulings, Phase 74/79 handoffs)"
    - "docs/DIFFICULTY-RETUNE.md#v2.1-roll-direction-pass — the Phase 72 BEFORE bot readout"
  affects:
    - "72-02, 72-03 (direction tests cite the ledger's [site:source] ids)"
    - "72-04, 72-05, 72-06, 72-07 (fix plans cite the ledger's known-fixes and new-findings sections)"
    - "Phase 73 (roll-high mirror; reads the Phase 73 reading column)"
    - "Phase 74 (display-sign handoffs)"
    - "Phase 79 (roll-direction phrasing handoffs)"
tech-stack:
  added: []
  patterns:
    - "Ledger extends (not redoes) a prior phase's audit, carrying forward its site numbering in a dedicated column"
    - "Modifier-ledger rows keyed by shared [site:source] ids so a direction test and a ledger doc stay in sync"
key-files:
  created:
    - docs/ROLL-LEDGER.md
  modified:
    - docs/DIFFICULTY-RETUNE.md
decisions:
  - "F1 (member/ally to-hit rules), F3 (Shadow daggerOnly) and F4 (frenzy-swing-only) ruled FIX by the user, pre-supplied 2026-09-24; landed by 72-07/72-05, not this plan"
  - "F2 (Acute Hearing's dead unseen-hit clause) ruled TEXT: drop the clause; the replacement 'Hear the next room' mechanic is deferred to Phase 78 (HUD-07), out of Phase 72 scope"
  - "F5 (PARLEY_NEED_MOD sign, discovered mid-audit) classified SIGN BUG, text-backed and local — fixed by 72-07 without a ruling, per CONTEXT's rule"
  - "No new NEEDS-RULING findings turned up beyond F1-F4, so Task 3's checkpoint:decision resolved without stopping"
metrics:
  duration: "~1 session"
  completed: 2026-09-24
status: complete
---

# Phase 72 Plan 01: Roll-direction audit ledger + BEFORE readout Summary

Built `docs/ROLL-LEDGER.md`, the ROLL-01 audited inventory of every die check and every modifier that feeds one in today's roll-under engine, extending Phase 31's 34-site combat-only audit to 48 sites across combat, soak, thrown spells, resistance, initiative, flee, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons and crits — with zero engine/content/src changes.

## What was built

- **`docs/ROLL-LEDGER.md`** (new, ~800 lines): all twelve required H2 sections —
  - `## How to read this ledger` — the roll-under convention, the Phase 73 roll-high reading (worked example: the insult stack reads as "19–20 on a d20" after the mirror), and the verdict vocabulary.
  - `## The device trigger` — confirms the dropped heavy weapon's "−2 to hit" was a CORRECT penalty; only the presentation was ambiguous (handed to Phase 74).
  - `## Site inventory` — 48 rows: 34 Phase 31 sites carried forward (one, Tracking, marked REMOVED — retired in Phase 38/ABIL-02), 14 new rows this audit's wider scope adds (chargen gates, chest-scroll/cooking/backfire/vapor/fall/lockpick-wear flat gates, and two sites split out of Phase 31 rows for clarity).
  - `## Not-a-check draws` — every remaining non-comment `rng.d(` call catalogued as SELECTION or AMOUNT, with a per-file count table reconciled against the live grep count (147 total: 42 CHECK + 40 SELECTION + 65 AMOUNT, matching exactly across all 13 files carrying `rng.d(`).
  - `## Modifier ledger` — 133 unique `[site:source]` ids (272 occurrences counting cross-references), one row per modifier source per site, matching the id catalogues 72-02/72-03 build their direction-test rows against.
  - `## Known fixes (a)-(d)` — the user's 2026-09-24 rulings quoted verbatim, current-vs-target behaviour in both today's need arithmetic and the Phase 73 face count, and the landing plan (72-04/72-05/72-06).
  - `## New findings` — F1-F5 verified against code and text, O1-O4 classified; every row carries a Class and a disposition.
  - `## Rulings` — the four pre-supplied 2026-09-24 rulings (F1 fix, F2 text + HUD-07 deferral, F3 fix, F4 fix), copied in from `72-RULINGS.md` per the orchestrator's pre-resolution.
  - `## Skeleton shatter scope` — the Claude's-Discretion call: every landed to-hit die aimed at a shatter-flagged foe (hero, member, ally, thrown, ally-thrown), except a Con Artist's warning blow and an untouchable target.
  - `## Handoffs → Phase 74` — `needModsClause` prints the same `+`/`−` sense on hero-need and foe-need lines even though a `+` means opposite things on each.
  - `## Handoffs → Phase 79` — every roll-direction phrase that becomes wrong after the mirror (Mirror Self, Crystal Staff, Weaken, bestiary hard-to-hit notes, Smoke's updated text).
  - `## Bot readout` — pointer to the `docs/DIFFICULTY-RETUNE.md` H2.
- **`docs/DIFFICULTY-RETUNE.md`**: new H2 `## v2.1 roll-direction pass (Phase 72) — bot readouts`, inserted immediately before `## v1.2 retune (Phase 27) — TUNE-05..07` (confirmed still the file's last H2 by `node --test test/unit/difficulty-retune-ledger.test.js`, 13/13 passing). Contains the four rule changes under measurement, the exact command, and the full BEFORE readout verbatim.

## BEFORE readout headline numbers

- **Commit:** `9197002` (`91970020af122246a72e7601eeea93a90ed7af14`) — engine and content untouched at audit start (confirmed via `git status --porcelain -- engine/ content/` empty before the run).
- **Command:** `node tools/tune-difficulty.mjs --seeds=200` (solo bot, start depth 1, no `--party`). Exit 0.
- **Death-depth distribution:** min=1, **p50=7**, **p90=12**, max=30.
- **Reach table:** >=5 80.5%, >=10 23.6%, >=20 1.1%, >=30 0.6%.
- **Four-band readout:** Filter 19.5% / Wall 44.3% / Breakaway 32.2% / Endgame 2.9% / beyond-20 1.1%; mean death depth 7.74.
- **Per-floor survival:** all floors 1-12 inside the USER RULING C pass band.
- Full stdout archived verbatim in `docs/DIFFICULTY-RETUNE.md`'s new H2 for 72-07's AFTER comparison.

## New findings — Class summary

| Fn | Finding | Class | Disposition |
|---|---|---|---|
| F1 | Member/legacy-ally/summoned-ally strikes skip the hero's per-target to-hit rules | SIGN BUG (text-backed, local) | **User ruled FIX** → 72-07 |
| F2 | Acute Hearing's "3 to hit the unseen" is a dead claim (no engine effect) | SIGN BUG (dead claim) | **User ruled TEXT** → 72-07 (drop clause; replacement deferred to Phase 78/HUD-07) |
| F3 | Shadow's `daggerOnly` is inert (no engine site reads it) | SIGN BUG (dead claim) | **User ruled FIX** → 72-07 |
| F4 | Frenzy odds apply to every second attack, not just the actual frenzy swing | NEEDS RULING (canon behaviour, no text claim) | **User ruled FIX** ("frenzy swing only") → 72-05, same edit as known fix (b) |
| F5 | `PARLEY_NEED_MOD` documented "up = harder" but added into a roll-under need (makes parley easier) | SIGN BUG (text-backed, local) | Fixed by 72-07, **no ruling needed** (0 at identity, zero fixtures move) |
| O1 | Mirror Self/invisibility shield the whole party despite "you"-scoped text | OUT OF SCOPE | Recorded only |
| O2 | Member-branch Sidestep applies after the Weaken cap; hero-branch applies it before | OUT OF SCOPE | Recorded only (magnitude/order asymmetry, not a sign inversion) |
| O3 | `needModsClause` prints the same `+`/`−` sense on hero-need and foe-need lines | Display sign | Handed to Phase 74 |
| O4 | Roll-direction phrases (Mirror Self, Crystal Staff, Weaken, hard-to-hit notes) read wrong after the Phase 73 mirror | Phrasing | Handed to Phase 79 |

No new NEEDS-RULING findings turned up beyond F1-F4 during this audit's wider non-combat sweep, so Task 3's `checkpoint:decision` resolved by writing the pre-supplied rulings into `## Rulings` without stopping.

## Ledger scale

- **48 site-inventory rows** (34 carried from Phase 31, 1 marked REMOVED, 14 new/split rows this wider audit adds).
- **133 unique `[site:source]` modifier ids** (272 occurrences including cross-references), well above the 60-id floor the plan requires.
- **147 total non-comment `rng.d(` calls** across `engine/*.js` reconciled: 42 CHECK, 40 SELECTION, 65 AMOUNT — per-file table matches the live grep count exactly in all 13 files.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed autonomously; the batched checkpoint (Task 3) did not need to stop because the pre-supplied rulings covered every NEEDS-RULING finding this audit found.

## Verification

- `node --test test/unit/difficulty-retune-ledger.test.js` — 13/13 passing (the v1.2 H2 remains the file's last H2).
- `git diff --name-only 9197002..HEAD -- engine/ content/ src/` — empty across all three task commits (confirmed after each commit).
- All twelve required H2 headings present (machine-checked via the plan's own verify script).
- `## Modifier ledger` carries 272 bracketed id occurrences (>= the 60 minimum); `## Known fixes` names 72-04/72-05/72-06 and contains the dual-view string "19–20"; `## Handoffs → Phase 74` names `needModsClause`.
- `## Rulings` contains a filled ruling row per NEEDS-RULING finding (F1-F4), each with a ruling (fix/text) and the applying plan.

## Human verification (deferred to end of run)

None for this plan.

## Self-Check

- FOUND: docs/ROLL-LEDGER.md
- FOUND: docs/DIFFICULTY-RETUNE.md (modified, new H2 present)
- FOUND commit 2e01119 (Task 1)
- FOUND commit 3eaa8a8 (Task 2)
- FOUND commit 75498e9 (Task 3)

## Self-Check: PASSED
