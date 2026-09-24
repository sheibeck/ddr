---
phase: 71-device-round-polish-ii
plan: 03
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, combat, conditions, input-lock, milestone-v2.0]
requirements: [POLISH-09, POLISH-07]
requires:
  - engine/abilities.js apply* (Pommel, Dirty Trick, Poison, Hamstring, Mark) — read only
  - src/browser/combatPanel.js foeListViewModel opts.chipsFor (Phase 34)
  - src/browser/combatMenu.js combatMenuViewModel (Phase 34/38)
  - Phase 58 beat runner, encArmed, beatHurryTap; Phase 32 arm sweep; Phase 70 R-C
provides:
  - src/browser/foeConditions.js FOE_CONDITIONS, FOE_CONDITION_COPY, foeConditionChips(foe, state)
  - window.__mzFoeConditions = { chips } (bridge registry entry)
  - combatMenuViewModel(state, { locked }) + COMBAT_MENU_COPY.resolving
  - the #cb-act data-locked lock (shell + CSS) and the :not([data-locked]) arm-sweep exclusion
affects:
  - combat foe cards' condition tag line (now every foe condition)
  - the combat action area while a round's beats play
  - 71-04 (the long-press foe card reads FOE_CONDITIONS)
  - 71-05 (round-summary band; closes the combat-lock todo's item 2)
tech-stack:
  added: []
  patterns:
    - "one pure condition table, guarded by an engine-source scan with a test-owned reasoned exclusion list"
    - "view-model opts flag ({ locked }) that leaves the default output deep-equal"
    - "a tiny selector matcher standing in for the sandbox's stubbed document.querySelectorAll, to run the real sweep selector"
key-files:
  created:
    - src/browser/foeConditions.js
    - test/unit/foe-conditions.test.js
    - test/unit/combat-lock-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/combatMenu.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/combatMenu.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/hp-not-wp.test.js
decisions:
  - "D-14: foe condition chips come from ONE pure table, src/browser/foeConditions.js; the shell's foeStatusBadges(f, V) is a thin reader fed the beat's frame state"
  - "D-14 tones: every foe debuff is tone good (Acid/Poison/Ice moved from the old 'acid' tone to 'good'); Frenzied alone is bad. The chips render as text only today, so there is no visible change"
  - "R-11: the coverage guard scans six engine files as text (abilities, magic, combat, foeAbilities, items, plus foeDamage) and never edits the engine"
  - "D-05/R-10: while a round plays, the prompt reads the mock's 'HOLD · THE DICE ARE STILL OUT' in #8f856f; #cb-act and its actions carry data-locked + aria-disabled; locked actions are dimmed (.45), flat and pointer-inert"
  - "R-08: no second tap listener; a tap on a locked action falls through to the action area and Phase 58's single beatHurryTap lands the round"
metrics:
  duration: "~16 min"
  completed: 2026-09-24
  tasks: 3
  files: 12
---

# Phase 71 Plan 03: Foe condition chips and the combat input lock Summary

Every foe condition now shows as a chip from one pure table, `src/browser/foeConditions.js`. Hamstring, Mark, Pommel's Stunned and Dirty Trick's timed Blind were missing before. A build-failing engine-scan guard backs the table. While a round's beats play, the combat actions are visibly locked: data-locked, dimmed, flat, pointer-inert and aria-disabled, with the mock's "HOLD · THE DICE ARE STILL OUT" prompt. A tap only lands the round and never acts or replays.

## Source todos

- **D-14 has no todo file.** It comes from the user's 2026-09-24 report in 71-CONTEXT D-14 ("the hamstring ability doesn't show up on enemies as a condition chit").
- This plan **partially closes** `.planning/todos/pending/2026-09-24-combat-lock-actions-while-a-round-plays-and-keep-the-round-summary-visible.md`: **item 1 of 2** (the input lock, D-05/D-06). Item 2 (the round-summary band, D-07) belongs to 71-05. The orchestrator should move that todo only after 71-05 lands.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | foeConditions.js: one chip table plus the engine-scan coverage guard (D-14) | fe4c1b2 (RED), 2bb8ecd (GREEN) |
| 2 | The shell's chips read the table; the combat actions lock while a round plays (D-14, D-05) | 382b007 (RED), fb02b43 (GREEN) |
| 3 | The lock, skip and no-replay proof on a real resolved round (D-05, D-06) | b3a96fb |

## The final FOE_CONDITIONS table (chip order)

| # | key | Label | Tone | Shows while | Rounds | Engine source |
|---|-----|-------|------|-------------|--------|---------------|
| 1 | stunned | Stunned | good | `f.stunned` | none | applyPommel; foeTurn consumes it |
| 2 | blind | Blind | good | `f.blind` or `f.blindFor > 0` | `blindFor` | Dirty Trick (blindFor 2, ticked, deleted at 0); the Blind spell |
| 3 | hamstrung | Hamstrung | good | `f.hamstrung` | none | applyHamstring |
| 4 | marked | Marked | good | `f.marked` | none | applyMark |
| 5 | asleep | Asleep | good | `f.asleep > 0` | `asleep` | Sleep/Doze, Sing, items (a countdown) |
| 6 | frozen | Frozen | good | `f.frozen` | none | Freeze/Ice/Petrify (on a live foe it only shows defensively; the engine clears it when a foe stands back up) |
| 7 | acid | Acid | good | `f.acid.rounds > 0` | `acid.rounds` | the Acid spell |
| 8 | dot | Poison, or Ice when `by === "ice"` | good | `f.dot.left > 0` | `dot.left` | Poisoned Edge (applyPoison), Ice |
| 9 | stupid | Stupefied | good | `f.stupid` | none | magic.js |
| 10 | shrunk | Shrunk | good | `f.shrunk` | none | magic.js |
| 11 | fixated | Fixated | good | `f.fixated` | none | magic.js |
| 12 | frenzied | Frenzied | **bad** | `f.frenzied` | none | magic.js (the one foe buff) |
| 13 | weakened | Weakened | good | `state.combat.weakened` (combat-wide) | hero's `c.timers["spell:weaken"].left` when > 0, else the bare label | magic.js, combat.js, items.js |

`foeConditionChips(foe, state)` returns a frozen array of frozen `{ key, label, tone, rounds, text }`. A dead or non-object foe gives `[]`. A null or malformed state drops only Weakened. A throwing getter drops only the chip that read it.

## NOT_A_CONDITION (test-owned, with reasons)

| Field | Reason |
|-------|--------|
| wp | hit points: the card's HP line shows them |
| maxWP | max hit points: the card's HP line shows them |
| alive | life itself: a dead card reads DOWN, and chips render only for live foes |
| fled | set together with alive = false: the foe has left the fight |
| lives | kill-twice bookkeeping, not a status the player applied |
| turned | R-12: Turn Undead and Gate set it together with alive = false, so the card reads DOWN |
| cd | the foe's own ability cooldowns (foeAbilities.js), not a condition on it |
| uses | the foe's own ability use counts (foeAbilities.js), not a condition on it |
| foeToHitPenalty | the to-hit half of Weaken, shown by the Weakened chip |
| afraid | the HERO's fear, not a foe condition |
| braced | the hero's Brace stance |
| inspired | the hero's Inspire, a hero buff |
| abilityStrike | the hero's pending ability strike for this round |
| ally | the hero's summoned ally |
| allies | the party members' combat sheets |
| first | initiative: who swings first |
| target | the hero's aim |
| round | the round counter the header shows |
| cut | the Cutthroat's once-a-fight crit is spent (hero-side) |
| opened | the Cat Burglar/Ninja free opener is spent (hero-side) |
| opened2 | the hero's opening strike has landed (opening-crit and Cloaker-vanish bookkeeping) — found by the scan |
| spellOpen | the spell submenu's open flag |
| parleyTried | the one parley attempt is spent |
| parleyInsulted | the parley went badly; a fight-wide flag, not a foe status |
| pendingFoes | summoned foes waiting to join the fight |
| pending | the pre-join encounter marker (`delete C.pending`) |

The guard's self-check requires the scan to find hamstrung, marked, stunned, blindFor, weakened and the other known fields. A synthetic `t.newHex = true` / `C.hexStorm = 2` source is reported as uncovered. Comparisons, arrows and comment-only mentions do not count as assignments.

## Rulings recorded

- **R-08 (D-06 already exists):** Phase 58's `beatHurryTap` is the one capture-phase click listener on `#enc-panel`. Phase 70 R-C hurries on ☰ open or tab switch. This plan adds no second listener (CSCR-08 plus a new pin: exactly one `getElementById("enc-panel")?.addEventListener(`). Locked buttons take `pointer-events:none`, so a tap on one lands on the action area inside `#enc-panel` and beatHurryTap catches it. combat-lock (3) pins a hurry tap targeted at a locked `#cb-strike`. This does not conflict with Phase 63's combat lock, which is the Gear sheet's mid-fight equip refusal.
- **R-09 (what locks):** only the action area (`#cb-act`: the grid, a submenu's rows and its BACK chip). Foe cards, YOUR LOT and the log keep their look (combat-lock (7) checks this in the sandbox and in the CSS). The Phase 32 250 ms arm window after the settle stays as the ghost-tap guard: it swallows and never queues (combat-lock (5)).
- **R-10 (the busy prompt):** `COMBAT_MENU_COPY.resolving = "HOLD · THE DICE ARE STILL OUT"`, drawn in `#8f856f`. It is voice-scanned by combatMenu.test.js and walked by hp-not-wp. Only the text and colour change; the position and size stay the same. The round-summary strip and its RESOLVING label are 71-05's.
- **R-11:** the coverage guard reads the engine as text and never edits it. It scans a sixth file, `engine/foeDamage.js` (the foe-damage seam, which writes only `wp`), beyond the five the plan named.
- **R-12:** `turned` is on NOT_A_CONDITION because it is always set with alive = false.

## Deviations from Plan

1. **[Rule 2 - Coverage] The scan also finds `opened2`.** engine/combat.js sets `C.opened2 = true` (opening-strike bookkeeping), which the plan's list did not name. It went on NOT_A_CONDITION with its reason, as the plan allows ("plus anything the scan truthfully finds"). The same goes for `cd`, `uses` (foeAbilities.js) and `pending` (`delete C.pending`). Commit 2bb8ecd.
2. **[Rule 2 - Test teeth] The sandbox's arm sweep was a silent no-op.** The recording DOM hard-stubs `document.querySelectorAll` to `[]`, so behavior (2) would have passed vacuously. combat-lock-shell installs a small matcher that runs the sweep's REAL selector string, with a live foe card as the control that the sweep does strip. A mutation check confirmed it: removing `:not([data-locked])` from mazeworld.html fails case (2), and the file was restored afterwards. Commit b3a96fb.
3. **Tones.** Per the plan's "every foe debuff is tone good", Acid and Poison/Ice moved from the old `"acid"` tone to `"good"`. `chipsFor` maps only the text today, so nothing visible changes.
4. **The sandbox chip test lives in shell-combat-screen.test.js** (section k, Hamstrung/Marked with Blind · 2/Stunned/DOWN), next to the source pins it complements.

No engine/, content/ or test/parity/ change. `paint()`/`draw()` are byte-identical (the reduced-motion SHA-256 pins pass). beatHurryTap and its listener are untouched.

## Verification

- `node --test` on the Task 1–3 files plus combat-beat-shell, shell-input-guards, shell-dead-foe-target, bridge-registry, shell-no-content-copies, reduced-motion, hud-menu-layout, gear-sheet-shell, hp-not-wp and combatPanel: all green.
- `node tools/bridge-doc.mjs --check`: exit 0. docs/SHELL-MODULES.md was saved with LF.
- `npm test`: **5318 pass, 7 fail**. The 7 are the known worktree CRLF doc-ledger failures (Outliers/AFTER/Handoff/v1.5 AFTER plus the three flee-table rows); there are no others.

## Human verification (deferred)

Deferred to the Phase 71 device round (71-06 folds these into docs/UAT-v2.0.md section M):

1. In a multi-foe fight, press STRIKE and watch the round type out. The four action buttons should go dim at once, lose their raised shadow and not depress when tapped. The prompt should read "HOLD · THE DICE ARE STILL OUT", and the buttons come back the moment the round finishes.
2. Spam STRIKE while a round types. The first tap should land the whole round at once, with no extra strike afterwards.
3. Tap a foe card or the log while a round types. The round should land at once, and the aim should not change.
4. Use Hamstring, Mark, Pommel Strike and Dirty Trick on a foe. Each should show its chip on that foe's card (Blind with its rounds) and disappear when it wears off. Weaken should still show Weakened with its rounds on every foe.
5. Open the ☰ mid-round. The round should land first, as before.

## Threat Flags

None. There is no new network, auth, file-access or trust-boundary surface. T-71-05 is mitigated by combat-lock (3)(4)(6), and T-71-06 by the coverage guard.

## Self-Check: PASSED

- FOUND: src/browser/foeConditions.js, test/unit/foe-conditions.test.js, test/unit/combat-lock-shell.test.js
- FOUND commits: fe4c1b2, 2bb8ecd, 382b007, fb02b43, b3a96fb
