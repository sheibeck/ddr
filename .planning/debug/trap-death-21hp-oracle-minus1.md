---
status: investigating
trigger: "DATA_START My Elven Ninja walked into a trap with 21 hitpoints to spare, Oracle shows I took -1 hitpoint, but I died. So, -1 hp took 21 hitpoints in actuality. / I was only floor 2 for the trap, btw DATA_END"
created: 2026-09-22T23:25:00Z
updated: 2026-09-22T23:25:00Z
---

## Symptoms

- **Expected:** A trap that the Oracle narrates as "-1 HP" leaves a 21-HP character alive at 20 HP.
- **Actual:** The character (Elven Ninja, floor 2) died on that trap. The HUD showed 21 HP before the step; the Oracle's trap line showed -1 HP.
- **Error messages:** none (no crash) — a silent death.
- **Timeline:** Seen once, 2026-09-22, on the v1.8 debug APK `d6db678` (Pixel 7), during the user's play after the Phase 60 device session. Not known whether it happens on v1.7.
- **Reproduction:** Unknown exact steps; floor 2, a trap square, ~21 HP displayed.

## Constraints (orchestrator)

- v1.8 is a PRESENTATION-ONLY milestone: `engine/`, `content/`, `test/parity/` are byte-identical to the `v1.7` tag. Any fix that would touch them must STOP and be reported to the user before editing (it is then a declared engine change).
- `npm test` fail 0 (3904/3904 at HEAD `e156bde`); `npm run build:www` green; re-pin tests, never delete; teeth checks only AFTER committing, with `git diff --quiet -- <file>` first, reverted via `git checkout -- <file>`; stage explicit paths only; never `--no-verify`.
- No device access in this session (the phone may be disconnected) — reproduce headless (shell sandbox / engine scripts / the dev start-at-depth path).

## Hypotheses (from the orchestrator, ranked)

1. **Stale HUD HP — possible Phase 58-06 regression.** 58-06 deliberately defers the HUD's `paint()` until a combat beat ends ("the top HP bar doesn't give the outcome away"). If some beat-ending path (hurry-tap, tab switch, flee, the kill/over-panel branch, reduced-motion instant path, a beat superseded by a new dispatch) never performs the deferred repaint, the HUD keeps showing pre-fight HP (21) while `S.c.wp` is ~1 — and the trap's real -1 would be fatal. A preceding fight on floor 2 fits the timeline.
2. **A trap that kills outright** while narrating only its HP line (a fall / secondary effect resolving `die()` without its own line) — pre-existing, engine or narration.
3. **Narration prints the wrong number** (e.g. "-1" for a larger hit — sign/format/field bug in the trap's EVENT_NARRATION entry).

## Current Focus

- hypothesis: 1 (stale HUD HP after a beat)
- next_action: gather initial evidence — read 58-06's HUD-deferral code path (dispatchWithNarration / engineCombatAction beat handoff / where paint() is skipped and where it is re-run), enumerate every beat-ending path, and check each for the catch-up repaint; then read the trap event + narration to rule 2/3 in or out.

## Evidence

## Eliminated

## Resolution
