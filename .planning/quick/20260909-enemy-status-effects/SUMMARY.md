---
slug: enemy-status-effects
status: complete
completed: 2026-09-09
---

# Summary: Show status on enemies in combat

Each living enemy in the combat panel now shows its active status effects as
labeled chips, driven by the engine's own per-foe fields.

## Changes (mazeworld.html)

- **`foeStatusBadges(f)`** — new classic-scope helper mapping foe status fields
  to `{label, tone}` chips: Asleep (`asleep`), Frozen (`frozen`), Acid · N
  (`acid.rounds`, the DoT tick), Blind (`blind`), Stupefied (`stupid`), Shrunk
  (`shrunk`), Fixated (`fixated`), and **Frenzied** (`frenzied`) flagged red as a
  foe-danger buff.
- **`renderEncounter()` foe row** — renders a `.fstatus` chip row for living
  foes; removed the old inline "· asleep" from `.fmeta`.
- **CSS** — `.fstatus` / `.fchip` (`-good` green, `-acid` gold, `-bad` red).

## Verification

- `foeStatusBadges` output confirmed in-browser (multi-status, all-status, none).
- `npm run test:quick` 406/406 green (presentation-only; no engine changes).
- Built + installed to the Pixel 7 (debug), app force-relaunched.

## Notes

- Sleep and stun share one engine `asleep` counter, so both read "Asleep" — the
  engine has no separate stun field to distinguish them.
