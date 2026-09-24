---
phase: 71-device-round-polish-ii
plan: 04
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, combat, rail, gesture, accessibility, milestone-v2.0]
requirements: [POLISH-08]
requires:
  - src/browser/foeConditions.js foeConditionChips (71-03, D-14's one table)
  - engine/combat.js foeLevelBase, engine/difficulty.js difficultyCurve/foeHitFor (read only, all already exported)
  - src/browser/tapStep.js HOLD_MS / TAP_MAX_TRAVEL_PX
  - src/browser/rail.js railPush / holdForCard / RAIL_HOLD
  - Phase 58 beatHurryTap and beat runner; Phase 57 rail dismiss; 71-03 combat lock
provides:
  - src/browser/foeDetails.js foeDetailsCard(i, state), FOE_DETAILS_COPY, detailsLabel(name)
  - src/browser/longPress.js createLongPress(opts), CLICK_SUPPRESS_MS
  - src/browser/combatPanel.js playerNote(text) (R-16)
  - window.__mzFoeInspect = { card, label } (bridge registry entry) and window.mzInspectFoe(i)
  - the combat-legal rail path (#mw-rail[data-over="combat"], foeCardUp in renderRail)
affects:
  - the combat foe cards (long press, Details sibling, no selection/callout/context menu)
  - the foe card meta line (Bat/Rat and Viper now read HP)
  - renderRail's hidden predicate (one combat exception)
  - backlog 999.5's status-chit card (can reuse the combat-legal path)
tech-stack:
  added: []
  patterns:
    - "a pure gesture recognizer with an injected clock, plus a once-only window capture click suppressor"
    - "a rail card kept live by re-deriving it through a bridged pure view model on every repaint, with the same key"
    - "engine formulas reached only through the engine's own exported pure helpers, fed sanitized values"
key-files:
  created:
    - src/browser/foeDetails.js
    - src/browser/longPress.js
    - test/unit/foeDetails.test.js
    - test/unit/longPress.test.js
    - test/unit/foe-inspect-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/combatPanel.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/combatPanel.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-new-best.test.js
decisions:
  - "R-13: the long press attaches to every rendered .cb-foe[data-foe] on the combat screen (live round and beat frame); the pending-combat MAJOR OVERLAY has no per-foe element"
  - "R-14: the foe card is the one combat-legal rail card: z-index 8 via #mw-rail[data-over=combat], painted above the overlay by DOM order, bottom lifted to the top of #cb-act"
  - "R-15: while S.combat is set, renderRail re-derives the card from the beat frame's state or S, never re-rising, re-announcing or typing; the latest view is written back onto the rail parcel so the card keeps the last live values after the fight"
  - "R-16: combatPanel.js playerNote rewrites a standalone wp/WP to HP; the foe card meta and foeDetails.js both use it (one import direction)"
  - "R-17: a long press during a beat is not a tap; the window capture suppressor swallows its trailing click before beatHurryTap"
  - "The defence line says 'Hit only on a n or under' (the engine hits on a low roll), not 'n+'"
  - "Ability names live in FOE_DETAILS_COPY.abilities, keyed by the FOE_ABILITIES id's tail; the descriptors carry no player name"
metrics:
  duration: "~55 min"
  completed: 2026-09-24
  tasks: 3
  files: 16
---

# Phase 71 Plan 04: Long-press a foe for its details card Summary

Holding a combat foe card for 450 ms now opens one rail card for that foe, with a light buzz. The card shows name and family, HP (never WP), defence, attacks with a per-swing damage range, abilities, resistances, current effects and a deadpan flavour line. It is the one rail card allowed over the combat screen. It sits above the action buttons, updates as the fight goes on, and closes with a tap. A visually hidden "Details: NAME" button after each foe card lets TalkBack users open the same card. A long press never aims and never skips a round. The foe card meta's WP leak on Bat/Rat and Viper is fixed.

## Source todo

This plan closes `.planning/todos/pending/2026-09-24-long-press-an-enemy-for-a-detailed-rail-card.md` (POLISH-08). The orchestrator moves it to `done/` on merge.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | foeDetails.js, the pure long-press card view model (D-09, D-12), plus playerNote (R-16) | 642b8e1 (RED), f7a673f (GREEN) |
| 2 | longPress.js, the long-press recognizer (D-08) | c533544 (RED), 8bfd959 (GREEN) |
| 3 | Shell wiring: gesture, haptic, the combat-legal rail card and the Details action (D-08, D-10, D-11) | 609fe25 (RED), a712583 (GREEN), 55c7999 (RUN-04 pin) |

## What the card shows (D-09)

Lines in order, each `{ text, roll: null }`:
1. family and size (`HUMANS · SIZE H`);
2. `HP cur / max`, or `DOWN` for a dead foe;
3. defence: `AR n`, `Hit only on a n or under`, `Only magic touches it`, `Only a dagger or magic touches it`, `Takes half damage`, joined. The line is left out when none of these apply;
4. attack: `1 swing` / `n swings`, the dice (`d6+2`, `a flat 1`), `hits for a–b before armour`, and `your armour is no help` for noArmor. A never_melee caster reads `Never swings; casts instead`;
5. abilities (player words for the FOE_ABILITIES kit) and the bestiary note through playerNote, or `No tricks worth mentioning`;
6. `INT n`, the DAMAGE_MULTIPLIERS rows in plain words (`Cleric spells do double`, `Spells do double`, `Fighter blows do double`), and `Kill it twice · n lives left` when lives > 1;
7. current effects from `foeConditionChips` (71-03's one table), or `Nothing on it yet. Give it time.`;
8. a family flavour line, or the fallback.

The damage range goes only through `foeLevelBase`, `difficultyCurve(state.floor.depth)` and `foeHitFor`. It is per swing, before armour, crits and effects. **Engine-helper gap: none.** All three helpers were already exported, so the numeric range ships.

Deliberately hidden: `sp.fleesBelow`, `sp.every` and every ability `every`/`uses`, live `f.cd`/`f.uses`, `sp.caster`, rng details, and flags that only the note describes. The tests assert that the Djinni card never mentions 0.25, a flee threshold or a cadence.

## Rulings recorded

- **R-13 (what counts as a foe surface):** every rendered `.cb-foe[data-foe]` on the combat screen, both in a live round and in a beat's frame. The pending-combat MAJOR OVERLAY names its foes in one prose line with no per-foe element, so there is nothing to press there. FIGHT IT OUT is one tap away.
- **R-14 (the combat-legal rail):** `railEl.hidden = !!((S.combat && !foeCardUp) || S.dead) || idle`. While `S.combat` is set and the foe card is up, `#mw-rail[data-over="combat"]` sets z-index 8. That ties `.mw-overlay`, and `#mw-rail` follows `#mw-screens` in the markup, so the rail paints above. The ☰ scrim (9) and wrap (10) stay above the rail. The rail's bottom sits at `--mw-rail-lift`, measured at render time from the stage's bottom edge to the top of `#cb-act`. `max-height:45%` and `overflow-y:auto` apply, with no new motion. Every other card stays hidden in combat.
- **R-15 (live card):** while `S.combat` is set, each repaint re-derives the card through `window.__mzFoeInspect.card(rail.card.foe, V)`, where V is the beat frame's state or S. The key is unchanged, so there is no re-rise, no re-announce and no re-arm. The card is never typed. The re-derived view is written back onto `window.__mzRail`, so after the fight the card keeps the last live values rather than the push-time snapshot. When `S.combat` clears with the card up, one holdForCard timer starts, and later repaints leave it alone.
- **R-16 (HP never WP):** `combatPanel.js` exports `playerNote`, which uses the hp-not-wp PLAYER_WP token rule. The foe card meta and `foeDetails.js` both use it. The import runs one way: foeDetails imports combatPanel, never the reverse.
- **R-17 (a long press during a beat):** the suppressor is a `window` capture-phase click listener, so it runs before `#enc-panel`'s `beatHurryTap`. The card rises and the round keeps playing.

## 999.5 status-chit note

Backlog 999.5's "status chit in combat shows nothing" todo stays in 999.5. It can reuse this plan's combat-legal path: give its card its own `kind` and add that kind to the `foeCardUp`-style exception in `renderRail`. The `data-over="combat"` CSS and the `#cb-act` lift then apply unchanged. docs/SHELL-MODULES.md records this.

## Deviations from Plan

1. **[Rule 1 - Correctness] Defence wording.** The plan wrote "hit only on n+". In the engine, `sp.toHit` caps the hero's need, and a strike hits on a roll at or under the need (`roll <= need`). The card therefore says "Hit only on a n or under", which matches the Zit note "hittable only on a 4". Commit f7a673f.
2. **[Rule 2 - Missing data] Ability names.** FOE_ABILITIES descriptors carry no name, only `id`/`kind`/`txt`. The player words live in `FOE_DETAILS_COPY.abilities`, keyed by the id's tail (`krupkeWeaken` → Weaken, `vampireSummon` → Raises the dead, `drakeBreath` → Fire breath). A test pins that every FOE_ABILITIES id resolves to one of those labels and never shows the raw id. Commit f7a673f.
3. **[Rule 1 - Correctness] Attack line flags.** A `never_melee` caster (Drudge) would otherwise show a swing and range it never uses, so it reads "Never swings; casts instead". `noArmor` adds "your armour is no help". Both facts are already in the creatures' notes. Commit f7a673f.
4. **[Rule 3 - Blocking pins] Four existing pins updated outside the plan's file list:**
   - shell-map-rail (o) and shell-new-best RUN-04 pinned the old hidden predicate verbatim. Both now pin the new one, and S.dead still hides unconditionally.
   - 71-03's "exactly one `getElementById("enc-panel")?.addEventListener(`" pin now counts click listeners on `#enc-panel` (still exactly one, beatHurryTap) and names the only allowed types: click, contextmenu and pointerdown. CSCR-08's own beatHurryTap pin is untouched.
   Commits 609fe25 and 55c7999.
5. **The rail parcel write-back (R-15 detail).** Without it, the card would revert to its push-time HP once `S.combat` cleared. See R-15. Commit a712583.
6. **The lift is written through `style.setProperty` only when it exists.** The sandbox's recording DOM has a plain `style` object; the CSS falls back to `0px`. Commit a712583.
7. **Two regex slips in my own new pins**, fixed in the GREEN commit: one paren too many, and reading only the first `<style>` block. a712583.
8. docs/SHELL-MODULES.md was saved with LF after the edit tool wrote CRLF, so `bridge-doc --check` exits 0.

No engine/, content/ or test/parity/ change. `paint()`/`draw()` are byte-identical (the reduced-motion SHA-256 pins pass). `#enc-panel` still has exactly one capture click listener (beatHurryTap).

## Threat model check

- T-71-07 (a stray act from a gesture): mitigated. The once-only window capture suppressor swallows the trailing click, bounded by `CLICK_SUPPRESS_MS` (700 ms after the lift) and cleared by the next down. The Details handler only calls `mzInspectFoe`, which pushes a presentation card and never touches state or the aim. longPress.test and foe-inspect-shell (e) pin this.
- T-71-08 (hidden values): mitigated. The view model reads only the listed fields. foeDetails.test (c) asserts that fleesBelow and cadence details never appear.
- No new surface beyond the plan: no network, storage or schema change.

## Verification

- Task 1: `node --test` foeDetails, combatPanel, hp-not-wp and foe-conditions all pass (79 tests).
- Task 2: longPress.test.js passes (13 tests).
- Task 3: foe-inspect-shell, shell-combat-screen, hud-menu-layout, rail-overlay, rail-dismiss, shell-map-rail, rail, combat-beat-shell, combat-lock-shell, shell-input-guards, reduced-motion, bridge-registry, shell-no-content-copies, hp-not-wp, typed-text and panel-motion all pass (240 tests). `node tools/bridge-doc.mjs --check` exits 0.
- `npm test`: **5372 tests, 5365 pass, 7 fail**. The 7 are the known worktree CRLF doc-ledger failures: Outliers, AFTER/Outliers/Handoff, Handoff to Phase 27, v1.5 AFTER, and the three flee-table rows. There are no other failures.

## Human verification (deferred)

These are deferred to the Phase 71 device round, folded into docs/UAT-v2.0.md section M by 71-06:

1. In a multi-foe fight, long-press each foe in turn. You get a light buzz, then one rail card for that foe: name and family, HP (never WP), defence, attacks and damage range, abilities, resistances, current effects and a flavour line. Each new long press replaces the card.
2. A short tap on a foe still aims at it, and a long press never changes the aim. No text-selection handles or context menu ever appear on a foe card.
3. The card sits above the action buttons, never over them, at text sizes M and L. It stays up through several rounds while its HP and effects update. A tap on the card dismisses it.
4. Kill the last foe with the card up: the card clears on its own after its normal hold.
5. Long-press a foe while a round is still typing: the card appears and the round keeps playing (it is not skipped).
6. With TalkBack on, swipe through a foe card: the next stop is "Details: <name>". Double-tap it and the same card appears, with the aim unchanged.
7. With Haptics Off in Settings, the long press still works, with no buzz.

## Self-Check: PASSED

- FOUND: src/browser/foeDetails.js, src/browser/longPress.js, test/unit/foeDetails.test.js, test/unit/longPress.test.js, test/unit/foe-inspect-shell.test.js
- FOUND commits: 642b8e1, f7a673f, c533544, 8bfd959, 609fe25, a712583, 55c7999
