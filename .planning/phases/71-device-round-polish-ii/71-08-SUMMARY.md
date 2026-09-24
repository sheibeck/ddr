---
phase: 71-device-round-polish-ii
plan: 08
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, combat, rail, conditions, accessibility, milestone-v2.0]
requirements: [POLISH-11]
requires:
  - 71-03 foeConditions.js (the one foe-condition table)
  - 71-04 the combat-legal rail path (foeCardUp, data-over="combat", --mw-rail-lift, window.mzInspectFoe, foeDetails.js)
  - 71-05 the lift measured from #cb-summary first
  - 71-07 tapGuards / window.__mzTapArmed (the tap sound follows a registered guard)
provides:
  - src/browser/rail.js COMBAT_CARD_KINDS, isCombatCard(card), conditionCard(title, line)
  - src/browser/foeConditions.js FOE_CONDITION_DESC and `desc` on every foeConditionChips chip
  - src/browser/foeDetails.js one "<chip text> — <desc>" line per current effect
  - classic combatScreenUp(), condArmedAt/condArmed(), guardInfoTap(btn, fn, armed)
  - module window.mzConditionCard(title, text); isCombatCard on window.__mzRailVM
  - docs/UAT-v2.0.md M35..M41
affects:
  - renderRail's hidden, data-over/lift and hold decisions (foe-only became the combat card kinds)
  - the #mm-conditions chips (own arm guard, no aria-disabled marker, combat routing)
  - the long-press foe card's effects (one line per effect)
tech-stack:
  added: []
  patterns:
    - "a card kind list plus a predicate in the pure rail module decides which cards may show over the combat screen"
    - "an info-tap guard with its own arm stamp, registered in the shared tapGuards registry so the tap sound asks the same predicate"
key-files:
  created:
    - test/unit/status-chit-combat.test.js
    - .planning/phases/71-device-round-polish-ii/71-08-SUMMARY.md
  modified:
    - src/browser/rail.js
    - src/browser/foeConditions.js
    - src/browser/foeDetails.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - docs/UAT-v2.0.md
    - test/unit/rail.test.js
    - test/unit/foe-conditions.test.js
    - test/unit/foeDetails.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-map-hud.test.js
    - test/unit/foe-inspect-shell.test.js
    - test/unit/ui-tap-shell.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-new-best.test.js
    - test/unit/shell-map-invariants.test.js
decisions:
  - "R-28: COMBAT_CARD_KINDS = [foe, cond]; the combat-legal rules apply to both; only the foe card is re-derived live; a cond card is pushed only while the combat screen is up, and out of combat the chip keeps its exact mzRailLine call"
  - "R-29: a chit tap never skips the round; the chips use guardInfoTap with condArmed (the 250 ms window from their own chip-set change), registered in tapGuards, with no aria-disabled marker"
  - "R-30: a foe's chips are text in its card, so a tap on them aims; foe condition descriptions live on the long-press card, one line per effect"
  - "R-31: combatScreenUp() = S.combat or a live beat, so a card raised during the last round's playback stays over the combat screen"
  - "R-32: the hero vocabulary (conditionsOf key literals plus live ACTIVATION_OF kinds, fly as flight) already has a CONDITION_EXPLAIN sentence for every key; no copy was added"
metrics:
  duration: "~50 min"
  completed: 2026-09-24
  tasks: 3
  files: 19
---

# Phase 71 Plan 08: Status chits explain themselves in combat Summary

In a fight, tapping one of your status chits now shows its description. It uses the same combat-legal card as the long-press foe card, above the what-happened strip and the actions, with the same sentence the chit shows outside a fight. It shows at once, a round that is still typing keeps playing, a body tap dismisses it, and a new chit tap or a long press replaces it. Each foe condition now has a one-line description, and the long-press foe card lists every current effect on its own line with that description. Every other rail card still stays hidden in combat.

## Source todo

This plan closes `.planning/todos/pending/2026-09-21-status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba.md` (2026-09-21, status-chit tap in combat, POLISH-11, D-16). Moving it to `.planning/todos/done/` is the orchestrator's job after the merge (D-13). This plan did not move it. It also closes backlog 999.5's "status chit in combat shows nothing" item, which docs/SHELL-MODULES.md now records.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | The condition card kind, and foe condition descriptions on the long-press card (R-28, R-30) | 87ca030 (RED), e961754 (GREEN) |
| 2 | Shell wiring: the chit card over the combat screen, read mid-round, every hero description pinned (R-28, R-29, R-31, R-32) | c27fbb7 (RED), e5349fa (GREEN) |
| 3 | UAT section M rows, phase gates, this SUMMARY | a977962, plus the SUMMARY commit |

## What was built

- **rail.js:**
  - `COMBAT_CARD_KINDS` is frozen `["foe", "cond"]`.
  - `isCombatCard(card)` is true only for an object whose kind is in that list. It never throws.
  - `conditionCard(title, line)` is `railLineCard(title, line, "info", RAIL_HOLD.default, "·")` plus `kind: "cond"`.
- **foeConditions.js:** `FOE_CONDITION_DESC` holds one sentence per label key. Each table entry carries `desc`, and the dot entry has `descFor`, which picks the poison or ice sentence. Every chip is now `{ key, label, tone, rounds, text, desc }`. The first five fields are unchanged, so the foe cards' chip text is byte-identical.
- **foeDetails.js:** `effectsLine` became `effectLines`, which gives one `<chip text> — <chip desc>` line per chip in table order, or the one `noEffects` line.
- **mazeworld.html, classic script:**
  - `combatScreenUp()` (R-31).
  - `let condArmedAt`, stamped in paintConditions' key gate next to the kept `armEncounterButtons()` call.
  - `condArmed()`: `isArmed(condArmedAt, Date.now())`. It fails open and never reads the beat or `encRenderedAt`.
  - `guardInfoTap(btn, fn, armed)` sits after guardTap. It calls `tapGuards.set`, sets the onclick and stamps no aria-disabled.
  - Each chip is wired `guardInfoTap(btn, () => (combatScreenUp() ? window.mzConditionCard?.(…) : window.mzRailLine?.(label.toUpperCase(), explainText, "info", 8400, "·")), condArmed)`.
  - renderRail gains `combatCardUp`, which now drives hidden, data-over/lift and both hold branches. `foeCardUp` stays for the foe-only live re-derive.
- **mazeworld.html, module script:**
  - `conditionCard` and `isCombatCard` are imported. They are placed before `wornReconcileCard, abilityPoolCard`, so the existing shell-abilities and shell-worn-slots import pins stay green.
  - `isCombatCard` is added to `window.__mzRailVM`.
  - `window.mzConditionCard(title, text)` sits after `window.mzInspectFoe`. It returns without pushing when `dungeonVisible()` is false, when there is no state, or when there is neither a fight nor a live beat.
- **bridge.js / SHELL-MODULES.md:** the `__mzRailVM` purpose and consumers name `isCombatCard`. The bridge table was regenerated, and a D-16 paragraph was added after 71-04's combat-legal rail paragraph.

## Rulings recorded (R-28..R-32)

- **R-28, the condition card:**
  - The 71-04 foe-card rules now apply to any card whose kind is in `COMBAT_CARD_KINDS`: it shows over the combat screen, is lifted above the strip and actions, shows at once without typing, holds while the combat screen is up, and gets its normal hold once the combat screen is gone.
  - Only the foe card is re-derived live.
  - A cond card is pushed only while the combat screen is up. Out of combat the chip's `mzRailLine(…, "info", 8400, "·")` call is unchanged, so that card still types and holds as before.
- **R-29, reading a chit never skips:**
  - `#mm-conditions` is outside `#enc-panel` (markup line 2169 against 2242), so beatHurryTap never sees a chip tap.
  - The chips' own `condArmed` window means neither the combat lock nor the beat gate blocks them. The registered guard means the 71-07 tap sound clicks on a chit tap mid-round.
  - No aria-disabled marker is stamped, which fixes TalkBack reading every chip as "disabled". `guardTap`'s head and every decision button are unchanged.
- **R-30, foe chips:** a foe's chips are text inside its card, so a tap on them is a tap on the card and aims. No chip listener was added. Descriptions are read on the long-press card.
- **R-31, "the combat screen is up":** `!!(S && (S.combat || window.__mzBeat?.active?.()))`. It drives the chip's routing and renderRail's data-over/lift and hold decisions. The `hidden` predicate only changed from the foe-only test to the combat card test.
- **R-32, hero descriptions:** the vocabulary is the `key: "…"` literals in engine/derived.js `conditionsOf` plus every ACTIVATION_OF kind with a live effect. A live effect is a positive number or a rolled duration; acute's effect is a dice object. `fly` shows as `flight`. That gives affliction, afraid, darkness, fearArmed, flight, foeEffect, foresight, itemCooldown, might, mirror, regen, reveal, senses, staffCharges, ward, power, giant, glow, unseen, tongue, brace, invis, haste, plate, ether, acute and lit. **Every key already had its own CONDITION_EXPLAIN sentence, so no CONDITION_EXPLAIN or CONDITION_COPY row was added.** status-chit-combat (h) pins this through the shipped `explainCondition` in the sandbox.

### Name mapping against the plan

The merged 71-04/71-05/71-07 names match the plan: `foeCardUp`, `window.__mzFoeInspect`, `window.mzInspectFoe`, `#mw-rail[data-over="combat"]`, `--mw-rail-lift`, foeDetails `effectsLine` (now `effectLines`), `FOE_DETAILS_COPY.noEffects`, `#cb-summary` first in the lift, `tapGuards` and `window.__mzTapArmed`. No remapping was needed.

## FOE_CONDITION_DESC (with engine sources, read only)

| Key | Sentence | Engine source |
|-----|----------|---------------|
| stunned | Seeing stars. It loses its next turn, then remembers where it is. | abilities.js applyPommel; combat.js foeTurn skips one turn and clears `f.stunned` |
| blind | It swings at where you were a moment ago and almost never lands. A count on the chip is how long until it can see again. | abilities.js applyDirtyTrick (`blindFor 2`), magic.js Blind; combat.js foeTurn sets a blind foe's need to 1 and ticks `blindFor` down |
| hamstrung | Its blows do half damage for the rest of the fight. It is limping about it. | abilities.js applyHamstring; combat.js foeTurn halves `f.hamstrung` damage against the hero and the party |
| marked | Every blow that lands on it does 2 more damage for the rest of the fight. It has been studied, and it shows. | abilities.js applyMark; combat.js playerStrike and the ally strike add 2 damage (the Mark text already says +2) |
| asleep | Dozing. It skips its turns until the count runs out, and it is easier to hit while it naps. | magic.js Doze/Stun/Sleep, items.js; combat.js foeTurn skips and counts down; playerStrike raises the need to at least 5 |
| frozen | Frozen solid. As conditions go, this one is fairly final. | magic.js Freeze/Petrify and combat.js Ice's last tick with killFoe; a revived foe is cleared |
| acid | Acid eats at it every round until the count runs out. Its armour is no help to it. | magic.js acid; combat.js foeTurn acid tick through damageFoe kind "spell" (bypasses armour) |
| poison | Poison works on it every round until the count runs out. Its armour is no help to it. | abilities.js applyPoison (Poisoned Edge); combat.js foeTurn `f.dot` tick, kind "spell" |
| ice | The cold bites every round, and if it is still standing when the count runs out, it freezes solid. | magic.js Ice (`dot.by "ice"`); combat.js foeTurn: `dotRanOut && by === "ice" && f.alive` sets frozen and calls killFoe |
| stupid | It does nothing at all for the rest of the fight, and it is easier to hit. Nobody is home. | magic.js Stupidity; combat.js foeTurn skips every turn; playerStrike's need-5 floor |
| shrunk | Cut down to size: half the hit points and half the damage it had, for the rest of the fight. | magic.js shrink halves wp/maxWP; combat.js foeTurn and pursuit halve its damage |
| fixated | It shrugged off the turning and has fixed its attention on you. It fights exactly as before. | magic.js Turn Walking Dead sets `f.fixated` on the undead it could not turn; no engine code reads it |
| frenzied | The madness went the wrong way. It swings twice as often for the rest of the fight. | magic.js Insane (madness roll 5); combat.js foeTurn `(f.frenzied ? 2 : 1)` swings |
| weakened | Every one of them does half damage while it lasts. They are not taking it well. | magic.js Weaken, items.js; combat.js foeTurn and pursuit halve damage under `C.weakened` (the 3-to-hit cap is spell-only, so it is not claimed) |

The only digit in these sentences is the "2" in Marked, which the Mark ability text already shows as +2 (the test allows only 2 and 3). Every sentence is voice-scanned (BANNED) and PLAYER_WP-scanned, in foe-conditions.test.js and in hp-not-wp.test.js's bank walk.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 3 - Blocking pin] foe-inspect-shell (c) in Task 1.** Its behaviour case asserted a bare "Hamstrung" line. With one line per effect, it now checks for a line starting "Hamstrung — ". The file was in Task 2's list; the fix was committed with Task 1's GREEN because Task 1 broke it. Commit e961754.
2. **[Rule 3 - Blocking pins] Three pins outside the plan's file list:**
   - shell-map-rail (o) and shell-new-best RUN-04 pinned the hidden predicate with `foeCardUp` verbatim; they now pin `combatCardUp`, and S.dead still hides unconditionally. Commit c27fbb7.
   - shell-map-invariants "MAP-08: condition chips are wired through guardTap" now pins `guardInfoTap(btn,` and `, condArmed);`. Commit e5349fa.
3. **[Rule 1 - Test shape] the chip-shape test in foe-conditions.test.js.** "rounds: every chip carries { key, label, tone, rounds, text }" deep-equalled the whole chip. It now compares the five original fields and checks `desc` separately. Commit 87ca030.
4. **Import order.** The plan did not fix where the new rail.js names go in the import. Placing them at the end broke the shell-abilities and shell-worn-slots pins (`wornReconcileCard, abilityPoolCard } from`), so they sit before those two. Commit e5349fa.
5. **ui-tap-shell (b)** was split in two, as the plan anticipated. The stale-marker regression now uses a guardTap-wrapped element that the sweep never reaches. A second case checks that a real chip has no marker and that its sound follows its own window. Commit c27fbb7.

### Choices within the plan

- `condArmed()` also catches a throw and returns true (fail-open, as the plan says for a missing bridge).
- The sandbox has no module script, so status-chit-combat.test.js installs mirrors of `mzConditionCard`, `mzRailLine` and `mzInspectFoe` built on the real rail.js/foeDetails.js exports. Its source pins hold the module bodies to that shape.

## UAT fold (section M)

- **Rows added:** M35 to M41, one per check (7 source items, 7 rows). The heading is now 41.
- **Merges:** none. Check 4 needs a condition on a foe, and M15's generic long press may show none, so it got its own if-available row (M38) rather than a clause in M15/M16.
- **Re-worded rows:** none. No L or M row claimed that the rail never shows in combat or that the foe card's effects are one joined line (M15 says "current effects", which still holds).
- **Other updates:** the section M order now ends with the status chits. Sources now lists 71-08 (7), 45 items in all. The Tally line covers the 71-08 fold. The Source map ends with `[71-08-S1]`..`[71-08-S7]`, each once. The **Build:** line was left for the orchestrator.

## Phase gates (last Phase 71 plan)

- `npm test`: **5483 tests, 5476 pass, 7 fail.** The 7 are the known worktree CRLF doc-ledger failures: Outliers, AFTER/Outliers/Handoff, Handoff to Phase 27, v1.5 AFTER, and the three flee-table rows. There are no other failures.
- `node tools/bridge-doc.mjs --check`: exit 0.
- Phase-wide `git diff --name-only dd06b3f HEAD` (dd06b3f is the parent of the first 71-01 commit, fd43016):
  - engine/: **0** files;
  - content/: **0** files;
  - test/parity/ (including prototype-master.js.txt): **0** files;
  - sfx/: **0** files;
  - test/unit/fixtures/: **4** files, exactly 71-02's declared snapshots (mu-store.store, thief-store.store, thief.gear-sheet-bag, thief.gear-sheet-worn).
- `paint()` and `draw()` are byte-identical (the reduced-motion SHA-256 pins pass). beatHurryTap, guardTap's head and the arm sweep selector are untouched. `#enc-panel` still has exactly one click listener (CSCR-08).

## Threat model check

- **T-71-15 (a stray act from an inspection tap): mitigated.** The chip handler only pushes a presentation card. It never touches state, is never saved and never dispatches. status-chit-combat (c) pins that a mid-round tap never hurries the beat. (i) pins that a foe card tap only aims and pushes no card. The CSCR-08 pin shows no new listener in renderEncounter and one `#enc-panel` click listener.
- **T-71-16 (hidden rule values): mitigated.** Each description was written from the engine code listed above and states no hidden number. A test limits digits to 2 and 3, the numbers the Mark and Weaken texts already show.
- There is no new surface beyond the plan: no network, storage or schema change.

## Known Stubs

None.

## Human verification (deferred)

These are deferred to the Phase 71 device round, in docs/UAT-v2.0.md section M. The orchestrator installs the debug APK (D-13).

1. **[71-08-S1] (M35)** In a fight, get a status (Afraid from a phobia, or Poisoned) and tap its chit in the strip under the HUD. A card with the same description you would see outside a fight appears above the what-happened strip and the action buttons, covering neither. Tap the card to dismiss it.
2. **[71-08-S2] (M36)** Tap a chit while a round is still typing. The card appears at once, the round keeps playing (it is not skipped), and the tap makes the UI click.
3. **[71-08-S3] (M37)** Tap a chit, then long-press a foe: the foe card replaces the chit card. Tap a chit again: the chit card replaces the foe card.
4. **[71-08-S4] (M38)** Hamstring, Mark or Blind a foe, then long-press it. Each effect is on its own line with a one-line description. A short tap on that foe, even on its chip text, only aims.
5. **[71-08-S5] (M39)** End the fight with a chit card up. It clears on its own after its normal hold.
6. **[71-08-S6] (M40)** Outside a fight, a chit tap works exactly as before (the typed rail card).
7. **[71-08-S7] (M41)** *(edge)* With TalkBack on, a chit is no longer announced as "disabled", and double-tapping it in a fight raises the card.

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(71-08)` RED commit followed by a `feat(71-08)` GREEN commit:
- Task 1 RED failed on the missing exports: 3 rail tests, 4 foe-conditions tests and 3 foeDetails tests failed, and hp-not-wp failed to load.
- Task 2 RED failed 16 cases across status-chit-combat, shell-map-hud, foe-inspect-shell, ui-tap-shell, shell-map-rail and shell-new-best.

## Self-Check: PASSED

- FOUND: src/browser/rail.js, src/browser/foeConditions.js, src/browser/foeDetails.js, test/unit/status-chit-combat.test.js, docs/UAT-v2.0.md
- FOUND commits: 87ca030, e961754, c27fbb7, e5349fa, a977962
