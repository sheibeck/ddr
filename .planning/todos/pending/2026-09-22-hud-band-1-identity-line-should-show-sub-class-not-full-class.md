---
created: 2026-09-22T22:52:00.000Z
title: HUD band-1 identity line should show the sub-class, not the full "Race Class (Sub)" text
area: ui
resolves_phase: 78
files:
  - src/browser/hudBands.js:85-94 (identityParts — builds `line` as
    `${raceClass}${subGroup} · Lvl ${level}`, i.e. "Race Class (Sub) · Lvl N")
  - src/browser/hudBands.js:96-120ish (identityLine — composes `name` + em
    dash + identityParts(c).line for the same rendered string)
---

## Problem

Reported on the Pixel 7 (2026-09-22, Phase 60 device session), user's words: "Only show the sub class on top rail, not the full class, we dont have enough room for both."

Band 1's identity line currently renders the full class plus its sub-class in parentheses (e.g. "Dwarf Pickpocket (Thief) · Lvl 3" — race + class, then the sub-class group). The user wants band 1 to show only the sub-class, not both class and sub-class — there isn't room for both.

**Ruling (user, 2026-09-22):** keep the race, drop the parent class. Target format is **Race + Sub-class + level**, e.g. **"Dwarf Pickpocket · Lvl 3"** — no parent class, no parentheses around the sub-class. (This resolves the open question this todo originally left unanswered.)

## Solution

Change `identityParts`'s `line` composition so it uses **race + sub-class** (falling back to the base class when a character has no sub, same as today's omission rule for a falsy `c.sub`) instead of joining race + class + "(sub)". Result: `${race} ${sub || cls} · Lvl ${level}` — no parentheses, no parent class shown when a sub exists. Keep the level suffix and separators unchanged. Verify against `test/unit/hudBands.test.js`'s existing identity-line pinning tests (all seven will need updating for the new expected strings) and re-check the mock's never-truncated name span vs. the dimmed/ellipsis-truncating line span still make sense with the shorter text. Post-milestone UI quick task, presentation-only.
