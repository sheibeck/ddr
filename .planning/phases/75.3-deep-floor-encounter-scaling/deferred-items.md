# Phase 75.3 — deferred items

## From 75.3-07

- **A fumbled Weaken scroll weakens the foes, not the reader (Phase 75.1 behavior, not changed).**
  `engine/scrollFumble.js#resolveHarmful`, case `weakened` (content/scroll-fumbles.js marks Weaken
  `side: "harmful"`), sets `C.weakened = true`, `C.foeToHitPenalty = 3` and a `spell:weaken` timer.
  These are the same fields the hero's own landed Weaken sets: `C.weakened` halves the foes' blows
  and `C.foeToHitPenalty` caps the foes' winning faces. So the "harmful" fumble helps the reader,
  while its `fumbleOnReader` event narrates the reader being weakened. The hero-side debuff is
  `c.foeEffect` of kind `weakened` (engine/combat.js). Past floor 12 this path also lands with no
  depth resist; it is recorded as audit row X8 (a fumble effect, exempt in
  test/unit/control-at-depth-rules.test.js). Needs a user ruling on whether the fumble should set the
  hero-side debuff instead.
