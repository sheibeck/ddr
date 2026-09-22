# v1.7 Pixel 7 device round — Phase 55 (Human DR Round)

**Build:** debug APK from HEAD `9bae7b6` (post-Phase 54: the fitted global difficulty model, DIALS = fit evaluation #13), built 2026-09-22 02:55 and installed on the Pixel 7 (`adb install -r` + relaunch, `lastUpdateTime 02:56`).

**Protocol:** deferred-UAT — no device pause was taken in Phases 50–54; this is the one batched session. Record the verdict verbatim; the milestone closes only on a recorded "tuned" result or an explicit deferral (TUNE-09). Findings become quick tasks (fourteen are already queued from the 2026-09-21 session on the *identity* build — the ones about difficulty feel are superseded by this build; the UI/engine bugs still stand).

**Suggested order:** the four-run DR checklist first (it is the acceptance bar), then the Phase 54 feel items during those same runs, then Phases 50–53 as they come up, then whatever of v1.5/v1.6 you have appetite for.

## A. The four-run DR checklist (TUNE-09 acceptance bar)

The runs, the "what should be true" text and the note tables are in `docs/DIFFICULTY-RETUNE.md` under `#### Run 1 — forced 20 (the acceptance bar)`, `#### Run 2 — forced 35`, `#### Run 3 — forced 50`, `#### Run 4 — natural (floor 1 onward)` (ledger lines ~7170–7250). Start-at-depth runs use the dev Settings row (`#### Starting a run at depth N`). For this build the bot's own numbers to judge against: natural start p50 death floor 7, p90 12, reach≥5 80 %, reach≥8 47 %, reach-20 1.5 %; forced 20 — every crit capped ≈ 31–34 hp.

| Run | Verdict (tuned / tune-again / defer) | Notes |
|---|---|---|
| 1 — forced 20 | | |
| 2 — forced 35 | | |
| 3 — forced 50 | | |
| 4 — natural | | |

## B. Phase 54 — Four-Band Retune (8)

| # | Check | Result |
|---|---|---|
| 54-1 | Natural run dies around floors 6–9, not 3–4; floors 1–3 feel meaningfully safer (a floor-1 death is rare) | |
| 54-2 | Table-4 +25 / -15 / +10 HP rows are a flat, predictable swing (scaled once by your tankiness) — never a 140-hp toll or a 330-HP pool | |
| 54-3 | Foes hit softer per swing but take slightly longer to kill; no single hit spikes past the curve | |
| 54-4 | Arriving on a fresh floor visibly restores some HP without camping; the line reads in voice | |
| 54-5 | (dev start 20) Herman / Drarl / Vampire / Djinni / Drake never one-shot — crits ≈ 31–34 | |
| 54-6 | A failed climb / crevice leap lands you on the far side, hurt, with the new line; a fatal fall still dies in place | |
| 54-7 | Descend SP line, Table-4 dot lines, floorRegen / draggedOver lines: deadpan, no raw numbers | |
| 54-8 | Class spread is the hand you're dealt (Pilfer / Elven MU weak, Ninja / Wilmsry Wizard deep) — not a bug | |

## C. Phase 53 — Joiner Level Cap (3)

| # | Check | Result |
|---|---|---|
| 53-1 | Joiner on floor 1 reads "skill level I" on the rail card and in the Company panel; floor 2 never exceeds II | |
| 53-2 | An old save with a level-V ally still shows level V (only NEW Joiners are capped) | |
| 53-3 | joinerMet / Wilmsry refusal / recruitment lines read exactly as before | |

## D. Phase 52 — Foe Cadence & Damage Curve (4)

| # | Check | Result |
|---|---|---|
| 52-1 | Bat/Rat or China Wolf at depth 5: at most 2 foe attack lines between two of your actions | |
| 52-2 | A Stalka Beast turn is EITHER two swings OR one bolt/heal — never both | |
| 52-3 | (dev start 5–8) Herman crit ≤ 37, never one-shots a full-HP level-5 hero; ordinary hit 26–31 | |
| 52-4 | Tier-5 crits read ~27–37, not 50–60; ordinary hits unchanged | |

## E. Phase 51 — Initiative Once Per Combat (5)

| # | Check | Result |
|---|---|---|
| 51-1 | Across a 3+ round fight the exchange is strictly you/them or them/you — never two foe turns between yours | |
| 51-2 | A Samurai / Fridgian fight opens with the foe's turn once, then alternates; the YOU/THEY MOVE FIRST reading holds all fight | |
| 51-3 | Exactly one "Initiative — you N, them M." line per fight (Oracle + fight log) | |
| 51-4 | Tapping the fight-log initiative entry reveals both d20s | |
| 51-5 | "Samurai honour — they go first." / "Foresight — you go first." / "Acute Hearing — you go first." wording | |

## F. Phase 50 — Character Roller Fix (5)

| # | Check | Result |
|---|---|---|
| 50-1 | Normal roll: reels lock race → class → sub → name + quirk → DESCEND → Hero tab matches the reels | |
| 50-2 | Double-tap ENTER: reels restart and lock once; Hero tab matches the second reels only | |
| 50-3 | Die → CONFIRM → ENTER → fresh reels → Hero tab matches | |
| 50-4 | Dead Hero tab "New Character" → fresh reels → Hero tab matches | |
| 50-5 | Not a bug: the dev Start-at-depth row rolls a FRESH character by design | |

## G. Still open from earlier milestones

- `docs/UAT-v1.6.md` (26 checks) and `docs/UAT-v1.5.md` (140 checks) — never run on device; stand separately, run what you have appetite for in the same sitting.

## Verdict (fill in — TUNE-09)

> _the user's words, verbatim:_
