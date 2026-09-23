# Milestones

## v1.9 The Gear Screen (Code-complete: 2026-09-23; Play 1.9.0 / vc8 built for closed testing; device UAT 3/24 walked)

**Closeout type:** override closeout. 15/16 requirements are complete. GSCR-12 (the Pixel 7 batch) is partial: A1–A3 passed in-session over wireless adb, and the other 21 checks are deferred to the user's play sessions (`docs/UAT-v1.9.md`). 4/4 phases `passed`; the audit is `tech_debt` with zero blockers. Known verification overrides: 1 (Phase 64 criteria 1–3 checklisted, not yet walked; see STATE.md Deferred Items).
**Phases completed:** 4 phases, 14 plans, 28 tasks. **Timeline:** 2026-09-23 (one autonomous run). **Tests:** 3,905 → 4,197 green. **Engine Gate:** `engine/` changed in three files (`items.js`, `economy.js`, `derived.js`, all Phase 61) with zero new rng draws. `content/` and `prototype-master.js.txt` are untouched. Exactly one parity fixture moved (economy), declared.

### Known Gaps
- **GSCR-12:** the device batch covering every sheet path, a full bag, staff charges, cooldowns, the combat lock and reduced motion. 3 of 24 checks walked; the rest are deferred to play sessions.

**Ratified during the run:**
- STORE-03 was reworded: the "not an upgrade" verdict is true (the Spiked Staff is `need: -1`, and Magic User kits carry prof 0), so the line now explains itself rather than changing the math.
- GSCR-01 was reworded: a slim ARMOR RATING / WILMST header, because the global HUD already names the hero.
- The combat lock also covers the loot/find take verbs (planner decision, reversible).
- Two tests were made CRLF-tolerant after merges came back with CRLF endings on this Windows checkout.

**Key accomplishments:**

- Engine-level combat gear lock: equipItem/unequipSlot/takeFind/takeLoot/takeAllLoot refuse with one `gearRefused {reason:"combat"}` event while a fight is up, proven by a property test over every ACTION_TYPES entry, with zero moved parity fixtures.
- The one hit-math verdict is unchanged; `gearCompareParts`/`upgradeWhyText` now build the explanation from the SAME derived helpers, and the loot screen + find card show it — the Spiked Staff case reads exactly "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade".
- buyFrom now settles gold/legality/room BEFORE any mutation (`storeBuyRefusal`); a legal not-better weapon/armor/premium buy is charged and bagged (`purchaseBagged { item, why }`) instead of charged and silently rejected, an upgrade still auto-equips and now names the traded-in piece, and exactly one parity fixture (the economy script's Axe) moves — measured, declared, and pinned by a standing guard.
- Every store stock row now reads one new view model, `storeRowState(c, line)`, built directly on the engine's own `storeBuyRefusal` (Plan 03) and `lootCompare` (Plan 02) — a row disables exactly when the engine would refuse, names the reason on the row (never a post-tap message), and shows the explained upgrade-or-not line as advice that never disables BUY; the fix also surfaced and closed a real pre-existing gap where a bag-full lockpicks/tool row looked clickable even though `buyFrom` already refused it.
- Eight pure, DOM-free view models (header, five-row WORN, USE cell, bag meter, bag cards, CONSUMABLES, ALSO ON YOU) built entirely on the existing shared rules — no snapshot moves, `npm test` green at 4047/4054 with the 7 remaining failures reproduced as pre-existing environment noise on the untouched base commit.
- #screen-gear rebuilt to a ten-id, five-section skeleton (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) wired to the Plan 01 view models via createElement/textContent only, with the three gear snapshot fixtures regenerated and every retired two-panel source pin migrated across 9 test files — full suite 4076/4083 (7 documented pre-existing environment-noise failures), build:www and boot:check both green.
- A 14-test agreement sweep (7 states, 17 rendered USE-cell/item pairs, 5 named Edge GSCR-11 truths) plus a comment-stripped no-fork source guard proves the Gear tab, the ITEMS combat submenu, the loot drop shelf and the store can never disagree — docs caught up to the rebuilt tab and GSCR-11 closed; the phase closes at npm test 4090/4097 (7 documented pre-existing failures), build:www and boot:check both green, engine/content/test-parity byte-identical to the wave's base commit.
- Pure `gearSheetModel(state, target)` + frozen `GEAR_SHEET_COPY` deciding every equip/swap/unequip/use/drop action, its engine-sourced greyed reason, and its exact dispatched engine action, for both a WORN slot and a BAG card.
- `renderGearSheet(host, state, target, deps)` — turns Plan 01's `gearSheetModel` into the sheet's DOM: one real accessible `<button>` per action, greyed rows that explain and never dispatch, DROP's tap-again confirm, and a close-then-dispatch order proven for every action shape.
- itemDropped/itemUnequipped moved from ORACLE_ONLY to LINE_FOR so DROP/UNEQUIP/DISCARD reach the rail in voice, plus a 117-dispatch sweep proving `gearSheetModel`'s every greyed reason and every enabled outcome agrees exactly with the real engine, GRULE-02's after-the-fight release included.
- Mounts the GEAR action sheet in the shell on the existing camp-sheet pattern — `#mw-gear-sheet` markup/CSS, `openGearSheet`/`refreshGearSheet`/`closeGearSheet`, a `paint()` re-render that greys the sheet in place when a fight starts, scrim/CANCEL/back-button close paths, the `window.__mzGearSheet` bridge, and two new declared DOM snapshots.
- WORN rows and BAG cards now open the bottom action sheet as accessible openers; the Phase 62 interim in-row Unequip/Bag-full block and per-card harvest are deleted; tests migrated; thief.gear/mu.gear regenerated and thief.gear-confirms retired; docs and REQUIREMENTS.md close out GSCR-07/08/09/10 and GRULE-02.

---

## v1.8 Sound, Motion & Set Dressing (Code-complete: 2026-09-22; device UAT spread over the user's play sessions)

**Closeout type:** verified closeout. 26/26 requirements complete, 5/5 phases `passed`, audit `tech_debt` with zero blockers. The run was autonomous under the deferred-UAT protocol. The one Pixel 7 session was Phase 60, where 56-3 (airplane-mode first launch) passed. The user took the other 30 checks into their own play sessions: *"Generally everything looks good. I'm not going to do in depth uat right now. I'll uat over playing several sessions and report back."* Open items were acknowledged in STATE.md Deferred Items.
**Phases completed:** 5 phases, 24 plans, 71 tasks. **Timeline:** 2026-09-22 (146 commits since `v1.7`). **Tests:** 3,479 → 3,905 green. **Engine Gate:** `engine/`, `content/` and `test/parity/` are byte-identical to `v1.7` across the whole milestone; parity master `a1f4d0dc…` untouched; `package.json` untouched. This was a presentation-only milestone. **Shell:** `mazeworld.html` 5,596 → 6,847 lines, and `src/browser/` went from 26 to 36 modules.
**Ratified during the run:**

- Worktrees came back on (`worktree.baseRef: head`), and 58 and 59 ran their core-module waves in parallel.
- The user's HUD mock (2026-09-22) retired the chip strip for a ☰ menu on the counters band. LAYOUT-04 and LAYOUT-05 were amended to match, keeping the shipped PNG icons and using the mock's icons only in the ☰ menu.
- The Rations clip at text size L was accepted.
- Every smart-discuss decision in 58 and 59 was accepted as recommended.
- Two side-by-side builds (v1.7 tag and HEAD) produced the missing cold-start and AAB baselines.

**Key accomplishments:**

- **Sound (Phase 56):** 30 bundled clips, built byte-identical into `www/`, with a pure `src/browser/sfx.js` mapping. It covers 26 mapped events and a total map from the six BESTIARY families onto four cries, and repeats vary through a counter rather than rng. The Web Audio backend decodes once at unlock and overlaps up to 8 voices. With Sound Off, no `AudioContext` is ever constructed. The airplane-mode first launch passed on the Pixel 7.
- **HUD & rail layout (Phase 57):** the rail is an overlay that can never resize the map, and a body tap dismisses a card that asks for no decision. Rail holds are doubled and scale with line count. Table-7 darkness shows as a map vignette plus a DARK chip that names its waiver. The HUD is stacked bands (identity + HP strip, counters + ☰ menu, conditions) through `hudBands.js`.
- **Motion & pacing (Phase 58):**
  - The camera glides 200 ms and cancels on touch. Every panel opens in 180/160 ms and closes in 120 ms. Rail and encounter text types on at 12 ms/char (700 ms cap).
  - The combat beat reveals a round one exchange at a time. Hero and foe HP move with the line that caused them, and each clip plays on its own line. A tap or tab switch hurries the beat losslessly.
  - Reduced motion collapses all of it to the instant end state, through one predicate.
- **Party animation & set dressing (Phase 59):** the party marker is a DOM sprite with an idle loop. It step-glides in lockstep with the camera, and the dark ring became a soft glow. Seeded `set_dungeon_*` props are dim on paths and full strength on walls, never on a feature, the stairs or the party. Dressing is deterministic per seed and depth, never touches play, and has a Settings toggle.
- **Performance close (Phase 60):**
  - `tools/cold-start.mjs` has a tested judge.
  - On the Pixel 7, same session: cold start **871 → 915 ms** median (+5.1 %), step p95 **22.0 → 16.6 ms** (improved), release AAB **+420,608 B (+4.5 %)**. No PERF-03 threshold was crossed.
- **Post-close device fixes:**
  - `9c1b80f`: HUD counters left-aligned in their reserved slots.
  - `42f0f8d`: the combat beat's last hero-HP frame is pinned to the true final HP. Folded multi-hit lines had under-counted it. This was found while debugging a reported trap death; the engine side was proven consistent.

### Known Gaps (carried forward)

| Item | Gap | Where it lands |
|------|-----|----------------|
| `docs/UAT-v1.8.md` | 30 of 31 device checks un-run (56-3 passed) | The user's own play sessions, alongside the v1.7 (25 + DR bar), v1.6 (26) and v1.5 (140) batches |
| Device findings 2026-09-22 | Water clip only on entering water. Band-1 identity should be Race + Sub-class + Lvl. ☰ menu locked when dead (user: defer). | `.planning/todos/pending/` |
| Debug `trap-death-21hp-oracle-minus1` | awaiting_human_verify. Likeliest reading: a true 1/21 HP. | The user's recollection or next device pass |
| Follow-ups | `.gitattributes` eol=lf pin (worktree CRLF false failures); `cameraGlide.js` reentrancy hardening (unreachable today); mid-round beat frames and `foeFrames` can still under-count a folded line briefly | Quick tasks |

**Archive:** `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-REQUIREMENTS.md`, `.planning/milestones/v1.8-MILESTONE-AUDIT.md`, `.planning/milestones/v1.8-phases/`

---

## v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve (Code-complete: 2026-09-22; device UAT batch deferred by the user)

**Closeout type:** override_closeout (15/15 requirements complete, 6/6 phases `passed`, audit `tech_debt` with zero blockers) — run autonomously under the deferred-UAT protocol. Phase 55 is a zero-plan device round: its VERIFICATION reads `passed` on the user's explicit recorded deferral of the curve verdict (TUNE-09's own stated alternative), but the manager projection cannot mark a plan-less phase `implementation_complete` — hence override, not verified, closeout.
**Phases completed:** 6 phases, 18 plans · **Timeline:** 2026-09-20 → 2026-09-22 (131 commits) · **Tests:** 3,315 → 3,479 green; parity master `a1f4d0dc…` untouched, every fixture mover measured and declared.
**Ratified during the run:** verification agents off (orchestrator-authored VERIFICATION.md per phase); USER RULING D — the floor-range ladder abandoned mid-phase-54 for a global difficulty model (dungeon-wide dials, foe level from depth, a round-damage ceiling); RULINGS E/F/G — fit budget 40, checkpointed blocks (stop on a failure pattern, adjust, restart), the Table-4 HP-dot compounding fixed as an engine adjustment; the 65 remaining damage-curve cells accepted as curve height, not cliffs, each with a written disposition; the tier-3/5 roster kept intact under the round-damage ceiling rather than nerfed.
**Balance verdict (BAND-03):** the fit reached PASS at evaluation #13 — solo 200 seeds, death floor p50 4 → **7**, p90 6 → **12**, reach ≥ 5 33 % → **80.5 %**; all floors 1–12 inside their Ruling C band on the 1,000-seed tail, floors 13–20 within ~2 points of the curve. **Recorded miss:** reach-20 1.5 % vs the 3–5 % band — one `FOE_LEVEL.perDepth` notch is the lever if a later round wants it.

**Key accomplishments:**

- **Character roller fix (Phase 50)** — the reels and the Hero tab now read one `rollerPendingState`: `src/browser/roller.js` with a monotonic roll token that drops a superseded resolution, a serialized `startNewRun()` chain and an inert CTA until reveal; `tools/roller-repro.mjs` (dependency-free headless-Chrome CDP driver) records BEFORE/AFTER 4/4 matched. Shell-only — engine, content and fixtures diff-empty.
- **Initiative once per combat (Phase 51)** — `resolveInitiative` fires once from `fight()`; the per-round re-roll is deleted, so a foe can never take two turns back to back. Narrated exactly once per fight in the Oracle and the fight log through a shared `initiativeVerdictText`. Three measured fixtures declared and regenerated — two of them now end **alive**, which is the bug's shape made visible.
- **Foe cadence & damage curve (Phase 52)** — an ability turn provably contains zero ordinary swings (the reported "two hits plus a bolt" was Phase 51's double turn); a foe crit doubles the dice, not the `lvl² + bonus + dice` sum, and Herman's flat 25 became `strikesAs: 5` — `critMax` 82/100 → 37/37. `tools/cadence-audit.mjs` and `tools/damage-curve-audit.mjs` are standing gates; flagged cells 116 → 65, each surviving one ruled on in `content/BESTIARY-REBALANCE.md`.
- **Joiner level cap (Phase 53)** — a Joiner met on floor N is at most level N, in one line with zero added draws, byte-identical narration and payload shapes, and a **measured MOVED SET of zero** proved three ways.
- **Four-band retune (Phase 54)** — `engine/difficulty.js` rebuilt as a global model (foe level `0.9 + 0.29·d`, `FOE_HIT_SCALE 0.6 + 0.01·d`, `FOE_HP_SCALE 0.9`, hero HP ×1.25, regen 0.25/floor, loot 0.8) fitted by a new `tools/fit-difficulty.mjs` against a fair bot; floor 1 stays parity-exact; the tier-3/5 roster (Herman, Drarl, Vampire, Djinni, Drake) **stays, capped by `ROUND_DAMAGE_CEILING 0.5`**, with zero bestiary dice edits; one-and-done climbs landed alongside; the new `floorFeatureShift` record kind declared across 17 fixture holders.
- **Human DR round (Phase 55)** — a debug APK built from `9bae7b6` and driven on the Pixel 7; the four-run checklist and 25 phase items were presented and the user recorded a verbatim deferral: *"I'm going to defer judgment on the curve for now. It's much better and we'll revisit later after I've had more plays."*

### Known Gaps (carried forward)

| Item | Gap | Where it lands |
|------|-----|----------------|
| `docs/UAT-v1.7.md` | Four-run DR bar + 25 phase checks, presented but un-run | Next device sitting — with the v1.6 (26) and v1.5 (140) batches |
| reach-20 | 1.5 % vs the 3–5 % band (1,000-seed tail) | One `FOE_LEVEL.perDepth` notch, a future tuning round |
| 17 pending todos | Device-session UI/engine bugs captured 2026-09-21/22 on the identity build | ROADMAP Backlog 999.4–999.7 |
| `npm run boot:check` | Environment-blocked on this machine (not a code regression) | Migrate to CDP or re-run in a clean session |

**Archive:** `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-REQUIREMENTS.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`, `.planning/milestones/v1.7-phases/`

---

## v1.6 Shell Debt & Dead Code (Code-complete: 2026-09-20; device UAT batch pending)

**Closeout type:** verified closeout (19/19 requirements complete, 6/6 phases `passed`, audit `tech_debt` with zero blockers) — run autonomously under the deferred-UAT protocol; Phase 49's three Pixel 7 rounds were the only device pauses. The 26-item v1.6 UAT batch (`docs/UAT-v1.6.md`) and the never-run 140-item v1.5 batch are open on APK `c0cdbae`; the v1.0-era quick-task stubs, four deferred todos and one dormant seed were re-acknowledged (STATE.md Deferred Items).
**Phases completed:** 6 phases, 23 plans, 56 tasks · **Timeline:** 2026-09-19 → 2026-09-20 (136 commits) · **Tests:** 2,924 → 3,315 green; parity master `a1f4d0dc…` untouched · **Shell:** `mazeworld.html` 8,710 → 5,682 lines (−35%); 25 modules in `src/browser/`.
**Ratified during the run:** research skipped for all six phases; verification agents off — orchestrator-authored VERIFICATION.md per phase; SHELL-04's "< 5,000 lines" re-baselined to 5,621 (user); `classic script` kept as a live term; Phase 49 measured by in-app dev-gated marks (user), both perf fixes kept at step p95 19.8 ms (user); four rules-change todos captured for the next tuning pass (initiative once, enemy cadence + damage curve, floor 5–7 average, rail overlay).

**Key accomplishments:**

- Retired the classic engine from the shell (Phase 44): 16 mirrors, the classic cold-boot chargen and the `new Function` extraction tripwires gone; `npm run boot:check` (4 checks) and `tools/shell-sweep.mjs refs|orphans` are standing gates; shell 8,710 → 6,356.
- Collapsed the Phase 37 hedges (Phase 45): one worn-model path — `newRun` always wears, load always reconciles, no `wornSlots` option anywhere; exactly 13 fixture sites moved, each declared with before/after (`tools/worn-fixture-scan.mjs`), bot readout byte-equal to the v1.5 pin.
- Honest names and dead exports (Phase 46): `toasts.js` → `narrationLines.js` (`LINE_FOR`/`linesForAction`/`dispatchWithNarration`), `winGame`/`won` removed end to end with tolerant load, the dead `controlScheme` setting and the 04-era `tutorial.js` deleted (UX-06 rebuilds on the modular shell); `tools/ident-sweep.mjs` proves zero retired identifiers.
- Shell modularisation (Phase 47): Gear, Hero and Store render from `src/browser/gearTab.js` / `heroTab.js` / `storeScreen.js` through `render*(host, state, deps)` and one `window.__mzTabs` mount each; 18 dead bridges + 7 classic wrappers deleted; `src/browser/bridge.js` is the one `__mz*` registry (45 names) with a set-equality test and a generated `docs/SHELL-MODULES.md`; a node `node:vm` DOM-snapshot harness proves all seven Gear/Hero/Store renders byte-equal before and after every carve.
- Stale docs, comments and test names purged (Phase 48): `tools/stale-terms.mjs` tripwire (11 rows, classed allow-list, pinned by 5 tests) reads 0 unlisted over shell/src/engine/content/test; 8 engine/content files swept comment-only (stripped diff empty); 47 test files renamed to the line vocabulary under a bounded rule with assertion counts pinned; CLAUDE.md Android-only; `COMBAT-NARRATIVE-DESIGN.md` deleted, nine docs status-noted.
- Measure-first perf pass (Phase 49): dev-gated `performance.now()` rings (step/dispatch/paint/draw) surfaced under the long-press dev row; three Pixel 7 rounds recorded in `docs/PERF-BASELINE.md` — step 14.2 / 28.9 ms → 11.5 / 19.8 (med / p95) after two presentation-only fixes (hidden tabs no longer rebuilt on every map step; the redundant second canvas draw removed), paint halved, no jank; zero instrumentation in a normal run (7 guarded lines in `www/`).

---

## v1.5 Meaningful Choices — Spells, Gear & Abilities (Code-complete: 2026-09-18; device UAT batch pending)

**Closeout type:** standard (36/36 requirements complete, 8/8 phases `passed`, audit `tech_debt` with zero blockers) — run autonomously under the `defer uat to end` protocol: no device pause anywhere; the 140-item Pixel 7 checklist (aggregated from the eight VERIFICATION frontmatters) runs against ONE debug APK built after Phase 43.
**Phases completed:** 8 phases, 37 plans, 107 tasks · **Timeline:** 2026-09-17 → 2026-09-18 · **Tests:** 2179 → 3168 green; parity master `a1f4d0dc…` untouched since v1.2; every declared divergence measured and ledgered (`docs/ABILITIES.md`, `docs/GEAR-BALANCE.md`, `docs/GEAR-SLOTS.md`, `docs/SPELLS.md`, `docs/TERRAIN.md`, `docs/FLEE.md`, `docs/RATIONS.md`, `docs/CLARITY.md`, `test/parity/FIXTURE-INVENTORY.md`)
**Ratified during the run:** greenfield — no dual-path code (2026-09-17); once-a-day rule (100 squares = a day); Map the Floor re-fog provenance; water = one tap, two squares; terrain phobias arm Afraid for the next fight; flee need 14; AFTER-matrix out-of-band policy (accept with reasons, tune only one-knob cases) — all in PROJECT.md Key Decisions.
**Balance verdict (BAL-02):** ONE consolidated AFTER matrix — meanDepth 3.75 → 3.60, reach20 0.1% → 0%, depth-20 target PASS; 26 out-of-band rows accepted with written reasons, zero tuned (`docs/CLASS-PASS.md`).

**Key accomplishments:**

- Pinned the v1.5 milestone's BEFORE class-matrix snapshot (143 cells x 40 natural-start seeds + 143 cells x 10 depth-20 seeds) against engine commit `e69ff07` (byte-identical to tag `v1.4.0`), appended as a new ledger section in `docs/CLASS-PASS.md`, before any other Phase 36 plan touches an engine/content/src/shell byte.
- Landed `engine/effects.js` (seven pure functions, one lazily-created `c.timers` map) and wired its three tick sites behind `if (c.timers)` guards, so v1.5's later timer consumers (ability cooldowns, item effects, timed map reveal) share one shape instead of inventing three — with zero player-visible behaviour and zero parity/draw-count drift.
- One exported `normalizeTarget(combat)` in `engine/combat.js` replaces the two inline dead-target rules in `playerStrike`/`castSpell`; the shell calls it once after every combat dispatch, before the re-render, so a dead foe can never stay the target and the arm-window race that could otherwise land a guarded tap on the wrong foe is closed by a DOM-free simulation — zero rng drift, zero parity fixture movement.
- A Cutthroat can now accept a Joiner like anyone else (the Phase 24 refusal is a declared canon reversal), and each descent with a Joiner carries a stated 1-in-20 chance the Joiner is murdered — a single guarded d20 drawn LAST in `descend()`, narrated with its own event type and six deterministic sarcastic lines so it reads as a joke, not a bug.
- A new no-rng engine action `dismissJoiner` — registered beside `resolveJoiner` — removes a party member and pushes its own `joinerDismissed` event with a deterministic sarcastic parting line, refusing with a named `dismissRefused` reason (noParty/inCombat/badIndex) rather than failing silently, so Plan 06's Company-panel DISMISS control has a complete engine + presentation seam to dispatch into.
- The Hero tab's Company panel is now a real sheet (class/sub/race, HP, weapon, "eats N a rest") with a confirmed two-tap DISMISS control wired through `window.mzDismissJoiner` into the same `dispatchWithToasts` seam as `mzResolveJoiner`; the classic dossier's Cutthroat blurb is synced byte-for-byte to `content/flavor.js`; and Phase 36 closes with a full gate (2276/2276 tests, parity master untouched, the 13-file cumulative footprint verified) plus one aggregated 22-item Pixel 7 checklist for the milestone-close UAT batch.
- Landed the worn-slot data model and the wide-blast-radius `eff()` refactor with zero behaviour change: a name-keyed `SLOT_OF` taxonomy (24 entries) authored on content rows but stripped from the exported item tables, `engine/derived.js`'s `WORN_SLOTS`/`slotFor`/`carriedItems`/`reconcileWorn` plus a two-path `eff()`, and `c.worn` carved out of every parity comparable as a structural tripwire.
- Gave the worn model its behaviours on top of Plan 01's data layer: `equipItem`/`unequipSlot` slot branches with a direct-swap-on-occupied-slot rule, auto-wear at all four take sites, `useItem` slot addressing with a new `notWorn` refusal, and matching toast/Oracle copy — every branch gated on `c.worn` being present so no fixture, bot, or un-migrated save changes by a byte.
- Made the worn model REACHABLE for real players: `newRun`'s shell-only `wornSlots` option creates `c.worn` on a fresh roll (Thief wears the starting cloak), `saveState.js`'s option-gated migration reconciles any illegal pre-Phase-37 save into a legal one-per-slot state with a returned reconciliation report, `engineAdapter` exposes that report once per boot, and `rail.js`/`combatMenu.js` give the shell the copy and the combat-usable rows to surface it — zero fixture/bot/tools byte moves.
- Put the worn model on the screen and closed the phase: the classic script's `eff(key)` duplicate now delegates to the engine's two-path `eff`, worn rows join the Gear tab's existing worn area with Use/Unequip, EQUIP on an occupied slot arms a two-tap `Swap for {worn name}?` confirm mirroring the Phase 33 Drop pattern, `window.mzUseItem`/`COMBAT_DISPATCH` learned the slot form for worn activatables, the ENTER-to-resume path surfaces Plan 03's one-shot reconciliation report as a GEAR rail card + Oracle line, `docs/GEAR-SLOTS.md` declares the canon change, and the phase gate closes green with the aggregated Pixel 7 checklist for all four plans below.
- Reshaped the Fighter/Thief Special Skills tables into 11 active abilities + 10 kept passives, added a 20-entry ability catalog with a per-class level-pool rolled from a derived rng stream (zero main-rng draws), wired `c.abilities` through chargen/level-up/Joiner/tolerant-load, and reconciled the entire parity suite with 20 measured, declared divergence records.
- Deleted every retired passive read (Agility/Death-touch/Kata/Silence/Language/Tracking/Climbing/Leaping) and installed the two seams the dispatcher (Plan 03) will drive: a transient `state.combat.abilityStrike` descriptor `playerStrike` honours per-attack, and three `c.timers`-driven need-shift terms in `foeToHitVs`/`foeToHitBreakdown`.
- `engine/abilities.js#useAbility` — the ABILITIES submenu's real action: a `castSpell`-parallel refusal ladder, Phase 36 `c.timers` cooldowns, and all 20 ability resolutions, wired into `engine/actions.js`/`engine/engine.js` and every foe-side `combat.js` hook (dot/stun/blindFor/hamstrung/riposte/taunt/brace/smoke), narrated in all three event tables with the canon refusal register.
- Party Joiners of a melee class now fight by class AND by kit — `alliesTurn`'s class policy gains a third branch (`pickMemberAbility`) that uses a Joiner's own rolled ability by an opener/damage/defensive rule before falling back to a plain strike or cast, resolving all 20 abilities through the exact `memberStrike`/shared foe-flag-applier primitives the hero's `useAbility` already uses, with per-member cooldowns on the member's own persistent sheet clearing at `endCombat` like the hero's.
- Put abilities on the screen and closed the phase: the ABILITIES submenu's third branch (READY / N ROUNDS / ONCE A FIGHT · USED, always tappable), the shell dispatch bridge, a Hero-tab abilities list beside Special skills, the level-1 pool roll narrated once as a rail card on first paint, the fight-report's "New trick" line, the `docs/ABILITIES.md` UI/requirements sections, and the phase's full aggregated Pixel 7 checklist.
- Weapons get a to-hit `need` axis (-2 to +1) and a `crit` axis (1|2), armor gets a `bulk` axis (0|1|2) that taxes agility, and the "is this weapon better" heuristic across takeItem/lootCompare/the tuning bot becomes expected damage-per-swing instead of raw max damage — with one measured, declared parity-fixture divergence (the re-priced store) and two re-pinned determinism suites (Awl Pike's dice count, Dagger's crit range) whose draw/outcome shifts are legitimate consequences of the rebalance.
- The tuning bot now buys and equips under the new weapon/armor axes (`chooseStorePurchase`, expectedStrike-ranked with a Thief bulk preference), a 143-cell x 3-seed smoke against the v1.5 BEFORE pin stays within noise, and `docs/GEAR-BALANCE.md` records the full GEAR-01 before/after ledger with every number measured live — GEAR-01 is now complete.
- One `c.timers`-backed activation model for every magic item — duration+cooldown jewelry/cloaks, charges+recharge staves, consumable-with-duration potions — replacing five scattered legacy fields (`c.haste`/`c.invis`/`c.ether`/`c.acute`, `c.flightLeft`/`c.flightCooldown`, and `it.usedAt`/`it.every`-based staff cooldowns) across the engine, with tolerant old-save folding and a declared, measured parity carve-out for both the retirement and the once-a-day content re-authoring.
- Rope/ladder/torch as `kind:"tool"` bag items with a derived-rng loot row (zero new main-rng draws on the no-tool path), a `state.pendingHazard` pre-roll decision that lets a carried rope/ladder skip the climb/gorge roll entirely via a new `useTool` action, and a torch that lights `c.darkFor` darkness and holds a later Darkness result off for 40 squares — with the full parity suite (2664 tests, master hash unchanged) reconciled by a single new `pendingHazard` structural carve-out and zero fixture divergences.
- Put Phase 39 on the screen and closed the phase: the hazard decision card (pre-roll and retry) with USE LADDER/USE ROPE, the Darkness card's USE TORCH, one Gear-tab/ITEMS row-state rule (READY/N SQ/cd N SQ/k-max SQ), condition chips for item effects/cooldowns/staff charges with a naming-the-item tap explanation, the Hero tab's to-hit routed through the engine, the ledger's UI + requirements-map close, and the phase's full aggregated Pixel 7 checklist.
- 33-row spell table with a machine-checked niche/txt contract, Detect Magic renamed Map the Floor, Lesser Summon added via a derived-rng chargen splice, and every Magic User sub proven to start day one with a real damage-dealing spell — zero main-rng drift.
- engine/magic.js's data-flag-driven thrown branch (no spell is name-keyed anywhere in the engine or bot), Ice's real per-round DOT with a frozen-solid payoff through killFoe, Lesser Summon's safe never-backfires cast branch, and the control axis made real — Weaken's rounds-cadence timer, Stupidity's fight-long skip, and Shrink's genuine half damage.
- Four new `conditionsOf` chips (mirror/senses/regen/foresight) make every previously-invisible utility spell observable; Sense Presence's "never surprised" gets a real initiative-side effect that waives every forced foe-first rule; `readScroll`'s scribe gate now reuses `canCast`'s own two checks, closing five reachable stuck-grimoire cases with a `scrollTooAdvanced` refusal.
- A per-cell `spellSeen` provenance flag turns the renamed Map the Floor into a real 40-square timed reveal: walking graduates what it sees into permanent memory, one sweep at expiry re-fogs only what the spell alone showed, and both `validateSave`/`rehydrate` tolerantly migrate old saves (stale flags cleared, "Detect Magic" renamed) with zero parity fixture moves.
- Every Phase 02-04 engine surface put on screen — the niche line on both spell surfaces, five new condition chips with copy/tone/explanation, the Hero-tab Shield row now showing pool AND rounds plus four new utility rows, foe badges naming their durations, and a distinct map tint for a spell-revealed cell — then the ledger closed, all seven SPELL requirements marked complete, and the phase's full aggregated Pixel 7 checklist assembled for milestone-close UAT.
- `placeWater(g, depth, rng)` places 1-3 contiguous water pools (size 3-8) on every floor via `derivedRng(rng.getState(), "terrain", dc.depth)`, drawing zero main-rng values — proven by a pre-engine-edit pin, structurally carved out of parity, tolerant-loaded on old saves, and measured (WATER HITS: 0) against the live fixture roster.
- `moveCost(state, cell)` (1 normal, 2 on water, flight/ether-exempt) is consumed once at the movement step site, and a `crossings(n)` cadence helper threads the same per-step cost through every squares-based system in one dispatch — the affliction cadence, `c.darkFor`, both Cloak ticks, the Magic User spell-charge cadence, and `newDay` — so a 2-cost water step never skips a cadence boundary; `waded` narrates the entry once on all three surfaces; the bot crosses water and never stalls; the movement fixture is measured (not assumed) to be unmoved.
- `engine/phobias.js` (new leaf) implements a per-character region model (`c.phobiaState`) that fires each of the five terrain phobias (water/darkness/heights-attempt/dead-end/death-crossing) exactly once on fresh entry, narrates immediately naming the trigger, and arms a zero-rng `c.fearArmed` flag that `fight()` now reads as a fourth OR-condition — opening the NEXT fight Afraid through the real Phase 31 mechanism, consumed the instant that fight reads it, surviving `endCombat`/`descend` in between — while the existing climb/leap-roll penalties and the trapped hp loss stay exactly as they were, landing on a different roll from the arm's eventual payoff.
- The 3x3 darkness render filter (mapViewRadius/inViewWindow — a pure, zero-parity-impact read consumed fresh by draw() every paint), the two-shade water map paint plus its hold-inspect card, the Rattled condition chip's shell copy, then the ledger closed, all five TERR requirements marked complete, and the phase's full aggregated Pixel 7 checklist assembled for milestone-close UAT.
- Flee drops from a flat 50%/75% (d20+5 vs 11, no race/armor input) to a transparently-fair d20 + Thief 5 + bounded class/race modifiers − armor bulk vs 14 (35%/60%/25% anchors), with every modifier named in a richer `fleeRolled` event narrated on the Oracle, fight log, toast and rail BEFORE the outcome, the combat submenu's FLEE row showing the honest per-character cost, and the whole change declared in a new `docs/FLEE.md` ledger whose numbers are pinned to `content/flee.js` by a standing test.
- The tuning bot (`tools/lib/tuning-bot.mjs`) now fights with its own kit exactly like a Joiner does — a class-driven ability policy on the hero's own `state.c`, heal-before-flee and round-1 buffs, a Magic User's worn staff, a lit torch in the dark, the victory loot pile it has ignored since v1.3, and the shipped game's `storeRoll`/`wornSlots` run rules — every pick guarded against refusal loops, with the frozen `Bot:` parameter line untouched.
- `chooseSpell` now scores DOT-vs-burst by target toughness and finish potential (niche-keyed, never a spell name), Map the Floor casts once per floor, every ability/spell/item use is tallied per run and rendered as a byte-stable Markdown pick-rate report by the new `tools/class-pass-usage.mjs`, and a 143×3 smoke with the full tactics set on proves zero stuck runs and zero cannot-act cells — better than the v1.5 BEFORE pin's own 40-seed reading.
- The milestone's one consolidated AFTER class-matrix (143x40 natural + 143x10 depth-20) measures every power-adding phase together — abilities, gear, spells, terrain, and this phase's own flee retune, with the newly-taught bot playing the shipped game's rules — and clears the depth-20 target on all three thresholds (reach20 0%, depth-20 meanFloorsGained 0.66, reach10 0.5%) with zero one-knob tunes needed: both out-of-band patterns (Magic-User-heavy weak cells, Wilmsry-heavy strong cells) trace to structural/pre-existing causes rather than a single content number, and are accepted with written reasons for the user's device round.
- Nine additive event-payload keys and a cause-first rewrite of 24 Oracle/toast lines (the SC-1 literal — "Being trapped: four walls and one door you already used. −4 hp." — renders exactly), backed by a machine-checked `docs/CLARITY.md` cost-event ledger and a standing HP-not-WP grep-pin test across every narration surface, content bank, and the shell.
- A full CLAR-05 audit of every ration/upkeep rule against the frozen prototype and the rulebook (`docs/RATIONS.md`, 12 rows, zero missing rules found), one appetite read (`eatsFor`) that five consumers now share, a new `rationsEaten` event that names every eater and every rule that applied ("Trolls eat for two."), an honest cause-first `wentHungry`, and a pure `rationsViewModel` whose `total` IS `nightlyEats(state)` — so the Hero sheet can never disagree with what Make Camp charges.
- One pure `usableBy(it, c)` rule (legality via the engine's own `weaponRefusalReason`/`armorRefusalReason` and the staff Magic-User gate, never restated) feeding an additive `lootCompare.usable` field, plus `dropShelfItems(c)` (bag-only, true `c.items` indices, lock-stepped with `slotItems`) and `emptySlotRows(c)`/`GEAR_COPY` (the ON YOU panel's in-voice empty-slot rows) — everything Plan 04's shell wiring needs, built and tested before any `mazeworld.html` edit.
- The clarity view models (Plans 01-03) wired into the shell — "(usable by …)" on the FIND card, every victory LOOT row, and every store row; "eats N a rest" on the Joiner offer card and the Company panel; the Hero tab's RATIONS panel; the Gear tab split into ON YOU (WIELDED / WORN with in-voice empty-slot rows / ALSO ON YOU) and BAG with a bag-only drop shelf — then the CLARITY ledger closed, all five CLAR requirements complete, the whole-phase gate green, and the full Phase 43 Pixel 7 checklist aggregated for milestone-close UAT. This is the last plan of the last phase of v1.5.

---

## v1.4 Combat & Map Screens (Shipped: 2026-09-16)

**Phases completed:** 2 phases, 10 plans, 28 tasks

**Key accomplishments:**

- Three new pure src/browser/ view-model modules (fightLog.js, combatMenu.js, combatPanel.js) plus a non-destructive toasts.js extension (opts.withIdx, oracleDetailText) that give Phase 34's later shell plans everything they need to build the fight log, the four-action grid, and the foe/YOUR LOT/overlay content — zero mazeworld.html edits.
- Re-routed the Phase 32 seam from the single-round Round Card to the whole-fight › log: `dispatchWithToasts` now writes every folded line (narrative and dull refusals alike, uncapped) to `window.__mzFightLog` via one `wasCombat||inCombat` if/else, parks the ending action's own lines on `window.__mzFightEnd` for Plan 05's over-panel, and `renderFightLog`/`syncFightLogLive` render it newest-first with in-place tap-to-reveal — the Round Card is fully retired.
- Rebuilt `renderEncounter`'s live-combat branch into the mock's three-band layout (header -> cb-mid[foes, YOUR LOT, log] -> cb-act) from the Plan 01 view-models, moved the Fight! gate out of the combat markup into a new generic `renderMajorOverlay(host, spec)` (the map's MAJOR OVERLAY, reused by Phase 35), and closed a real CSCR-08 gap by wrapping foe-card retargeting in `guardTap` for the first time.
- Replaced the old 7-button combat action bar with the mock's 2x2 STRIKE/SPELLS-or-ABILITIES/ITEMS/SOCIAL grid and its guarded submenus (driven by `combatMenuViewModel`), reworked the keyboard map so every key click-throughs the same guarded buttons a tap would, and moved the last two shell-side in-combat toasts (potion at full health / no potions) into dull fight-log entries — no toast can fire during a fight any more.
- All four fight endings (won/soothed/fled/dead) now render through one `renderCombatOver(host, kind, opts)` in the mock's dark over-panel vocabulary — loot rows, the victory/soothed report, the parked killing-blow line, and the death card's epitaph/last-words/Review-the-Oracle/Bury-Them all fold in; the joiner and find cards opt into the same dark styling; the dismissal transition now clears the phase's transient globals; and the whole phase closes with a green executor gate (2047/2047 tests, clean build, untouched engine/content/parity) plus the aggregated 27-item deferred Pixel 7 checklist.
- Three pure presentation modules — `rail.js`'s event-family fold, `tapStep.js`'s dominant-axis step resolver, and `mapMarks.js`'s coloured-glyph palette — ready for the Wave 2-4 shell wiring, with 39 new tests and zero engine/content/parity/toasts.js/controls.js/icons.js edits.
- The map screen's persistent bottom RAIL now carries every out-of-combat event and every decision (joiner/find/climb) with a global movement lock, and the Phase 25.1 toast host and Move-on card are fully retired — zero toast anywhere in the app.
- The map column's chrome now matches the mock — a two-row HUD (FLOOR/DAY/SQUARES/RATIONS + x/y WP bar) with its own condition-chip strip beneath it, a canvas renderer painting coloured text-glyph marks + a pulsing party ring from `src/browser/mapMarks.js`, and MARKS/MAKE CAMP as guarded bottom sheets — with 19 new source-assertion tests and zero engine/content/parity/icons.js edits.
- Tap-to-step (dominant-axis-then-fallback) and hold-to-inspect replace the D-pad on the map viewport; a shell pre-dispatch interception shows THE STAIR DOWN before the engine's unconditional descend can fire, with GO DOWN dispatching the identical stepNow(dir) every step uses — 25 new source-assertion tests, zero engine/content/parity edits.
- One `shell-map-invariants.test.js` suite (37 tests, zero fixes required) pins every Phase 35 retirement/guard/copy invariant file-wide; the full executor gate is green (2170/2170 tests, clean build, untouched engine/content/parity); the v1.4 milestone's one debug APK is built (1.2.0 (3), 9.0 MB) with no device install attempted; and the aggregated 27-item deferred Pixel 7 checklist closes out MAP-10's plan-side deliverable, ready for the same milestone-close DR round that also works through Phase 34's own 27-item list.

### Device round (2026-09-16 → 2026-09-17) — closed

The deferred CSCR-10 / MAP-10 Pixel 7 round was run by the user against the versionCode-3 debug build and the fixes re-tested through versionCode 5. Findings and their fixes:

- **Tap-to-move never stepped** — the viewport pipeline captured the module bridge before it existed (`260916-w0c` be6d2e3).
- **Black screen after the splash** — a hoisted `renderRail` read `S` in its TDZ from tab-init (fast fix 7ab68d3).
- **Stuck on NONE STANDING after the last kill** — the over-panel filled its loot host before attaching it (fast fix 49e01fc).
- **User reversals of the mock**: PNG map icons restored (glyph experiment retired) and the real icons on rail/overlay cards; the settings gear moved to a chip right of MAKE CAMP; the joiner strip removed from the map and from over combat (Company panel on the Hero tab; YOUR LOT unchanged); player-facing WP → HP; no inline bag-full line on the loot screen; the rail is the ONE feedback surface on every tab and shows only when it has something to report (no idle card) — `260916-w0c`, `260917-bbs`, fast fixes 67192d5 / a0d7747.
- **Perf**: the party pulse ring animated `box-shadow` (whole-layer repaints, FIGHT IT OUT's background not drawn until a focus change) — composited and paused under overlays (`260917-bbs` 5138b4d).
- Palette (fog black / wall blocks / dark corridors) reviewed by the user: kept as is.

**Shipped:** Google Play internal testing, `1.4.0` versionCode 5 (2026-09-17). Tests 2179/2179; parity master untouched throughout.

### Still open (carried forward)

- **Climb dice payload** — `fellClimbing`/`fellInGorge`/`climbedOver`/`leaptOver` carry no `roll`/`need`; the rail shows climb outcomes without a dice line. Additive, parity-safe engine change (events are asserted loosely by parity); `rail.js#rollLineFor` already renders it.
- Verification overrides at closeout: 2 (CSCR-10, MAP-10) — both since satisfied by the device round above.

---

## v1.3 Feel, Loot & Combat Flow (Shipped: 2026-09-16)

**Closeout type:** autonomous run, on-device UAT deferred to the end (50 Pixel 7 checks batched; CMBUI-06 DR round pending on the installed build)
**Phases:** 6 (28 Armor · 29 Loot & bag cap · 30 Combat-narrative research · 31 Combat start gating & effect hygiene · 32 Round Card build · 33 UI feel & store) · **Plans:** 16 · **Tasks:** 44
**Timeline:** 2026-09-15 → 2026-09-16 (2 days, 104 commits, 140 files, +21.9k lines)
**Tests:** 1448 → 1955 green; parity master untouched since v1.2; zero fixture regenerations (three declared action-path divergences for the deliberate Afraid rules change; the new `lose-plain` scenario restores death-path coverage)
**Requirements:** 28 complete · UIF-04 dropped (tutorial UI unwired → UX-06) · CMBUI-06 deferred to the device round

**Key accomplishments:**

1. **Armor that tells the truth** — durability rides the bag item (the unequip→re-equip full-repair exploit is dead), destroyed armor is gone, the four soak outcomes are distinct on screen, one `armorDisplay` formatter behind every armor string (the HUD line was the real bug), Cloak of Armor = never-wearing plate for any carrier.
2. **End-of-combat loot as a decision** — serialized `pendingLoot` pile, one loot card with per-drop Equip/Stow/Leave + compare-to-equipped, a single `stowItem` bag-cap gate on every path (store pays only after a successful stow), bigger bags as depth-tiered treasure, honest forfeit on flight/death.
3. **Combat starts on Fight!** — the `fight` action owns initiative/phobia/pre-emptive strike; every refusal explains itself (`docs/USABLE-FEATURES-AUDIT.md` + a 150-row doc-synced test); buff potions from Gear; Shield/Acuteness/Afraid chips with honest expiry; Amulet of Stone closes the encounter with full payout.
4. **Rules rulings from the roll-direction audit** — phobia is now an *Afraid* penalty (need −3 on the LOW-range to-hit, half damage, 2 rounds), never a lost action; Elven `foeToHit` inversion flipped to "easier to hit"; the sheet's TO HIT reads `1–N`.
5. **The Round Card** — surveyed six patterns, ratified one, built it: an uncapped always-visible round block below the foe roster (post-dispatch routing in `dispatchWithToasts`, refusals stay toasts, Oracle untouched), `inputGuards.js` 250 ms arm/settle `Date.now()` guards on 24 decision-button sites and `window.move`; worst-case round measured at 6 lines.
6. **Feel & store polish** — Use/Drop gear rows with an inline two-tap confirm, Make Camp in the Marks/Centre strip (handedness removed), map recenters at every panel-close choke point + pinch release, default zoom 1.5, depth-rolled store stock behind the `storeRoll` run flag (fixtures, bots and old saves untouched).

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| CMBUI-06 | On-device DR round of the Round Card not yet run — build installed on the Pixel 7, checklist in the end-of-run UAT batch | Immediately after this closeout (UAT batch) |
| UIF-04 | Tutorial on/off setting — nothing to toggle until the coach-mark sequencer is wired | UX-06 (v1.0 launch tail) |
| — | 32-03 unguarded button set (store rows, drop shelf, `a-evt`, `btn-again`, spell menu) + haptics on hit/kill | future feel pass |
| — | `storeRoll` off for tools/ bots — ledgers unchanged by the rolled store | next tuning pass |

**Archived:** `milestones/v1.3-ROADMAP.md`, `milestones/v1.3-REQUIREMENTS.md`, `milestones/v1.3-MILESTONE-AUDIT.md`, `milestones/v1.3-phases/`

## v1.2 Class Pass & Mass Playtest (Shipped: 2026-09-15)

**Phases completed:** 7 phases (22–27 + inserted 25.1), 31 plans, 85 tasks · 161 commits, 2026-09-14 → 2026-09-15 · tests 951 → 1448 · parity 33/33 byte-identical with declared, machine-checked divergences (chargen seeds 15/24 grimoire top-up; combat/lose seed 14 Fridgian; economy seed 3 Pickpocket markup; combat/parley seed 303 Dante → Ned) · closed on a user-recorded TUNE-07 deferral (DR round carried forward)

**Key accomplishments:**

1. **Class-aware playtest harness** — dev-only `force` chargen seam, sub-class-aware bot (`chooseSpell` scoring table, talk-first openers, stuck bucket), `tools/tune-classes.mjs` 143-cell class × race matrix on worker threads, `tools/class-pass-diff.mjs` fun-band diff with a cannot-act hard gate; BEFORE and AFTER matrices captured at identical parameters (5,720 + 1,430 runs each) and ledgered in `docs/CLASS-PASS.md`.
2. **Casters can act** — a Wizard refuses melee only while an attack spell is castable and names it; every non-Summoner Magic User rolls a day-one attack spell (zero new draws); Summon level 2, Phantom Host level 1; Freeze kills now pay out through `killFoe`. Magic User mean kills doubled (2.41 → 4.99); all eight caster sub-classes landed in the fun band.
3. **Every sub-class and race has one good and one bad** — 11 sub-class mechanics + a 3-race pass (Knight/Court Mage never-first, Court Mage boredom 1-in-6, Ninja/MoA never parley, Guard −1, Cloaker unseen-only, Fridgian hide/frenzy, Dwarven half armour wear, Pickpocket markup, Woodsman armour gate, Pilfer heal-only, Bard camp wake, Cutthroat/Wilmsry Joiner refusals), all zero-draw, all narrated, all blurbs truthful, proven by a 70-test identity contract. Human stays neutral.
4. **Nothing happens silently** — a pure `toasts.js` table exactly partitioning all 209 engine event types (189 toasts ⊎ 21 Oracle-only), red-for-them/green-for-you tone families plus amber refusals, "K of M" multi-attack aggregation, level-1 miss quips, additive event payload for every passive modifier, one `dispatchWithToasts` seam; then the device batch: the "Move on" card only for decisions/big updates, narrative toasts that linger and tap away, the Oracle filling the screen and opening at the newest line, Joiner swap with snark, party members fighting by class, Make Camp refusing with the numbers.
5. **Mass playtest verdicts** — μ 3.08, bands 2.31–4.15: 29 of 30 sub-class/race rows in band, Ninja too strong and accepted (the opener is the identity), Wilmsry in band after the Joiner refusal, revisit list empty; the hard gate caught a pre-existing stranded-combat bug (foe killed by ward reflect on its opening turn) and it was fixed as a gap closure.
6. **Delve-to-death retune toward the depth-20 unicorn** — band agreed over three user rounds and recorded first; the game is now canon through depth 20 (`COMBAT_SCALE_FROM_DEPTH` 21) with a gentle ramp past it, foe grace ×0.5 at floors 2–4, encounter density cap 13, darkness held through floor 3, trap/fall ×0.5 from floor 2, and Dante demoted to tier 2 (Ned holds floor 1). AFTER: bot median 4 (from 3), reach-5 30.6 % (from 17 %), forced-20 3.17 fights survived (from 1.3) — in band; forced-20 floors gained (0.84, p50 0) and reach-20 (0.1 %) recorded as misses that only canon tier-3/5 rosters could close.

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| TUNE-07 | Human DR round (forced 20/35/50 + natural) not played — user away from the Pixel 7; verdict **deferred** with reason recorded in `docs/DIFFICULTY-RETUNE.md` | Next tuning pass, after the user's next milestone of fixes |
| TUNE-06 (two band rows) | Forced-20 floors gained p50 0 / mean 0.84 (target ≥ 1 / 1–2); reach ≥ 20 0.1 % (target 1–2 %) — residual lethality is canon tier-3/5 combat (Herman, Drarl, Vampire, Djinni); untaken rungs (rations +2, hazard from floor 1, darkness from 4, floor-1 grace, grace ×0.35) recorded with calibration numbers | Needs a roster decision; next tuning pass |
| Play internal upload | Last uploaded build is versionCode 3 (pre-25.1); 25.1 + the retune are not yet on the internal track | Offer a versionCode-4 signed AAB when the user is back with the phone |
| v1.3 candidates | Feedback, Feel & Polish remainder (inventory integrity incl. buy-then-reject gold loss, UI layout, combat-start gating, store stock), narrative-toast case/wrap on device, `mazeworld.html` `/*`-in-`//` comment cleanup, GSD state tools not resolving decimal phase numbers | `.planning/proposed-milestone-feedback-feel-polish.md` / next milestone |

**Archived:** `milestones/v1.2-ROADMAP.md`, `milestones/v1.2-REQUIREMENTS.md`, `milestones/v1.2-phases/`

---

## v1.1 Monster Balancing & Abilities (Shipped: 2026-09-14)

**Phases completed:** 5 phases (17–21), 21 plans, 50 tasks · 82 commits, 2026-09-13 → 2026-09-14 · tests 683 → 951 · parity 30/30 byte-identical with ONE documented deliberate divergence (seed-303 parley scenario, scenario-scoped carve-out)

**Closeout:** override closeout — Known verification overrides: 1 (TUNE-04 human DR sign-off: verdict tune-again at depth 20; retune deferred by the user to a later milestone after cleanup + class fixes). Two v1.0-era quick-task stubs re-acknowledged. See STATE.md Deferred Items.

**Key accomplishments:**

- **Foes fight back with magic** — a pure-data ability registry (19 descriptors) + `engine/foeAbilities.js` resolver: bolts, drains, debuffs, heals, summons, Spectre pursuit, Djinni low-HP flee, all narrated; the player's Intelligence resists via one shared `resistRoll` (symmetric with the canon foe rule).
- **Bestiary rebalanced on a yardstick** — `engine/foeDamage.js#damageFoe` is the single damage-to-foe seam (natural armor, Sterling halving, damage-type multipliers, Philly slow); nine outlier rows retuned with a committed before/after ledger (`content/BESTIARY-REBALANCE.md`).
- **Parley is a decision, not a spam button** — one attempt per encounter with insulted aggro on failure, Con Artist retuned (+6→+4, need ≤17), payout structurally ≤ half a kill, Humans wilmst bonus on a 6 only; Language is a fluency system (skill + Helm of Knowledge) feeding the same bonus term (`docs/PARLEY-REBALANCE.md`).
- **Depth finally scales** — `engine/difficulty.js` owns foe count / foe power / ability cadence past floor 5 (identity ≤ 5), a smarter tuning bot with reach/ability readouts, and a hidden dev start-at-depth toggle for deep testing (`docs/DIFFICULTY-RETUNE.md`).
- **Parity discipline held under real rule changes** — fixture inventory, RNG draw-count pins, determinism suites for caster encounters, and the frozen prototype master never touched.

### Known gaps / tech debt carried forward

| Item | Where it lands |
|------|----------------|
| Pixel 7 UAT batch (140 checks) not yet run — code-complete only | Immediately: debug APK + the consolidated checklist |
| Shell debt: classic engine mirrors + drifted `SUB_NOTE` in `mazeworld.html`, `toasts.js` naming/dead exports, Phase 37 two-path `eff()` + `wornSlots` hedges, unreachable parley fluency-2 branch, `railCardFor` tie-break | Shell Debt & Dead Code cleanup milestone (`.planning/proposed-milestone-shell-cleanup.md`) |
| Structural balance: Magic Users gain nothing from the Fighter/Thief-gated ability system (Summoner/Apprentice weakest); Wilmsry's racial edge; Magic User store tier-3 cost floor | Next tuning milestone (with TUNE-06/07) |
| UX-06 tutorial, STR-01..04/06 production launch | v1.0 launch tail (after the cleanup milestone) |

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`, `.planning/milestones/v1.1-phases/`

## v1.0 Delve, Die, Repeat — Android build & internal testing (Shipped: 2026-09-13)

**Closeout type:** override_closeout (known verification overrides: 5 — see STATE.md Deferred Items)
**Phases:** 17 (1–6 core, 04.1/04.2 inserted, 7–11 Joiners, 12–16 Economy) · **Plans:** 37 + ~20 device-review rounds (DR1–DR18) · **Tasks:** 81
**Timeline:** 2026-09-07 → 2026-09-13 (7 days, 248 commits, 409 files, +60.7k lines)
**Tests:** 683/683 green; parity suite byte-identical to the frozen 1994-rulebook prototype master throughout
**Delivered:** the 1994 tabletop prototype (`mazeworld.html`) extracted into a pure, deterministic, serializable `applyAction` engine, wrapped as a native Android app, converted to endless descent, rebuilt with a mobile "torch-lit ledger" UX, given a party system and a real economy, voiced, and shipped to a Google Play **internal-testing track** with real testers.

**Key accomplishments:**

1. **Engine extraction with zero regressions** — every rule domain (chargen, maze gen, movement, combat, magic, economy, encounters, death) behind one pure `applyAction(state, action) → {state, events}` seam over a seeded mulberry32 RNG; a frozen node:vm golden master proves byte-identical parity on every commit.
2. **Native Android shell** — Capacitor 8 wrap with durable `@capacitor/preferences` autosave, back-button/lifecycle handling, self-hosted fonts (fully offline), splash/status-bar/icon chrome, haptics; signed CLI release pipeline (`npm run play:release`).
3. **Endless descent** — the fixed 5-floor Gate replaced by a bounded soft-cap difficulty curve with a headless tuning harness; one-tap new-run loop, best-depth tracking, permadeath graveyard.
4. **Mobile UX rebuilt on the Claude Design mock** — D-pad movement on a pannable/zoomable fog-lit canvas with the 9 provided PNG icons, HUD + unified condition tracker, toast combat feedback, victory report, Fight! gate, character sheet/Grimoire, Oracle log, settings sheet; 18 on-device review rounds on the Pixel 7.
5. **Rules fidelity sweep (04.1/04.2)** — every character-sheet stat now affects play (all 10 phobias, Intelligence, Sewing/Master of Arms), rations as rations, XP/HP terminology, a dozen live bugs fixed, and a family-friendly safety-scan guardrail over all procedural copy.
6. **Joiners + Economy systems** — a serialized, damageable NPC party (accept/decline recruitment, auto-acting member, XP split, party rail) and a real loot economy (class bags, take/leave/drop/equip, store sells all gear, 9 inert items wired, conservative reward tuning) — all parity-safe for solo play.

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| UX-06 | First-run coach-mark tutorial (04-10) not built — deliberately deferred by the user until the UI settles | v1.0 launch tail (after Monster Balancing) |
| STR-01..04, STR-06 | Production launch: Data Safety / IARC / privacy policy / paid config / listing completeness not yet audited from the repo side; store entry exists and testers are live | v1.0 launch tail — user-driven, with a repo-side SDK/dependency audit |
| PARTY-10 (+ ECON deep tuning, Phase 3 feel-tuning) | The ONE consolidated difficulty retune across party power, economy, and monster power | Monster Balancing milestone |
| Phases 1–3 | `VERIFICATION.md` status `human_needed` — accepted on the strength of DR1–DR18 on-device play + internal testers | — |

**Archived:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-phases/` (all phase dirs incl. `dr17-encounter-ux/`)
