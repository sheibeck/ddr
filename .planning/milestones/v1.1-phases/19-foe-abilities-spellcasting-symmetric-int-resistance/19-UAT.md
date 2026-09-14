---
status: complete
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
source: [19-VERIFICATION.md]
started: 2026-09-14T11:09:20Z
updated: 2026-09-14T11:09:20Z
---

## Current Test

number: 1
name: On-device foeEffect chip renders and counts down
expected: |
  During a caster fight (Krupke or Drudge -> "Weakened"; Djinni -> "Dazed"), the chip appears in the
  existing condition row with the in-voice label (never the raw `foeEffect` key or an ability id),
  its rounds count down each combat visit, and it disappears when the debuff fades or combat ends.
  A successful Intelligence resist shows a heroResisted line instead of the chip.
awaiting: none

## Tests

### 1. On-device foeEffect chip renders and counts down
expected: Weakened/Dazed chip appears with the in-voice label, counts down, and clears on fade / end of combat; never shows a raw key or ability id.
result: pass — approved by the user on-device (2026-09-14)

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
