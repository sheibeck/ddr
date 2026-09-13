---
slug: enemy-status-effects
created: 2026-09-09
mode: quick
---

# Quick Task: Show status on enemies in combat

**Request:** Show status on enemies. For instance, if they are stunned, or
slept, or taking acid damage, etc.

## Scope

Render the per-foe status the engine already tracks as visible badges on each
enemy row in the combat encounter panel, so the player can see at a glance
which enemies are incapacitated, taking damage-over-time, or dangerous.

## Approach

- `foeStatusBadges(f)` (mazeworld.html, classic scope) maps the engine's own
  per-foe status fields to labeled chips:
  - `asleep > 0` → **Asleep** (doze/stun/gas — a single incapacitated label,
    since the engine collapses sleep/stun into one `asleep` counter)
  - `frozen` → **Frozen** (freeze/ice)
  - `acid.rounds > 0` → **Acid · N** (the damage-over-time tick, N rounds left)
  - `blind` → **Blind**
  - `stupid` → **Stupefied** (Stupidity, intel→1)
  - `shrunk` → **Shrunk**
  - `fixated` → **Fixated**
  - `frenzied` → **Frenzied** (flagged RED — a foe DANGER buff: it swings twice)
- The foe row in `renderEncounter()` renders the chips in a `.fstatus` row
  (only for living foes) and the old inline "· asleep" was removed from `.fmeta`.
- `.fchip` styling: `-good` (green, debuffs in your favor), `-acid` (gold, active
  DoT), `-bad` (red, the frenzied danger).

## Verification

- `foeStatusBadges` output confirmed in-browser for multi-status, all-status,
  and no-status foes.
- `npm run test:quick` green (presentation-only; no engine changes).
- Deployed to the Pixel 7 debug build.
