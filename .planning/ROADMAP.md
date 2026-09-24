# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- ✅ **v1.6 Shell Debt & Dead Code** — Phases 44–49 (code-complete 2026-09-20, archived 2026-09-20; 26-check Pixel 7 UAT batch + the v1.5 140-check batch pending on APK `c0cdbae`; see `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve** — Phases 50–55 (code-complete 2026-09-22, archived 2026-09-22, override closeout; the four-run DR checklist + 25-item Pixel 7 batch `docs/UAT-v1.7.md` deferred by the user, as are the v1.6 26-check and v1.5 140-check batches; see `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`)
- ✅ **v1.8 Sound, Motion & Set Dressing** — Phases 56–60 (code-complete 2026-09-22, archived 2026-09-22, verified closeout; 30 of 31 Pixel 7 checks in `docs/UAT-v1.8.md` spread over the user's play sessions; see `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-MILESTONE-AUDIT.md`)
- ✅ **v1.9 The Gear Screen** — Phases 61–64 (code-complete 2026-09-23; override closeout: GSCR-12 device batch partial) → `.planning/milestones/v1.9-ROADMAP.md`
- ✅ **v2.0 Leaderboards** — Phases 65–71 (shipped 2026-09-24 as Play 2.0.0 / vc10; override closeout: 38/38 requirements, 7/7 phases passed, 142-row Pixel 7 batch `docs/UAT-v2.0.md` spread over the user's play sessions) → `.planning/milestones/v2.0-ROADMAP.md`
- 🚧 **v2.1 Bug Fixes** — Phases 72–81 (roadmapped 2026-09-24; clears every open device-round bug plus backlog 999.5–999.10, and reworks the Leaderboards panel scopes)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Phases

<details>
<summary>✅ v2.0 Leaderboards (Phases 65–71) — SHIPPED 2026-09-24</summary>

- [x] Phase 65: Run Record & Personal Bests (5/5 plans) — completed 2026-09-23
- [x] Phase 66: Leaderboards Panel — Local (7/7 plans) — completed 2026-09-23
- [x] Phase 67: Play Games Integration & Account Chip (8/8 plans) — completed 2026-09-24
- [x] Phase 68: Global Boards, Submissions & "You Placed X" (7/7 plans) — completed 2026-09-24
- [x] Phase 69: Compliance & Device Close (4/4 plans) — completed 2026-09-24
- [x] Phase 70: Device-Round Polish (4/4 plans) — completed 2026-09-24
- [x] Phase 71: Device-Round Polish II (8/8 plans) — completed 2026-09-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`.

</details>

### v2.1 Bug Fixes (Phases 72–80) — IN PROGRESS

**Engine gate (greenfield, user ruling 2026-09-17):** every RULES/DARK/SAV change is the only rule afterwards (no dual path). Measure the fixtures it moves, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerate only those. `test/parity/prototype-master.js.txt` is never edited, new serialized fields are carved out of the three comparables, and a bot readout is taken before and after any change that affects difficulty.

**Roll-high ruling (user, 2026-09-24):** the engine itself switches to roll-high rather than gaining a display adapter (Phase 73, ROLL-05) — every seed must resolve identically to before the switch, so the parity suite staying byte-identical is the proof. The sign/ordering audit (Phase 72, ROLL-01) lands first so the mirror is built on already-correct modifiers, and every phase after the mirror (RULES, DARK, SAV, CMBUI's roll-showing indicators) is written directly in the roll-high convention instead of being rewritten later.

- [ ] **Phase 72: Roll-Direction Sign Audit & Fixes** - the audited ledger of every roll modifier's sign, with the three known bugs fixed under the engine gate, landing before the roll-high mirror
- [ ] **Phase 73: Engine Roll-High Mirror** - the engine itself switches every die check to roll-high; the full parity suite proves it byte-identical
- [ ] **Phase 74: Roll Display & Modifier Honesty** - the Oracle, fight log, rail and every surface print the engine's own high-is-good rolls and consistently signed modifiers
- [ ] **Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs** - HP dots, the wilmst cache, the Summoner's grimoire, Sense Presence, the trap-death bug, ailments and destroyed armor, all under the greenfield engine gate
- [ ] **Phase 76: Darkness Unification & Relaunch Persistence** - one shared darkness rule, and a relaunch or force-close can no longer escape a live fight or an open store
- [ ] **Phase 77: Combat Screen & Oracle Readability** - submenu rows, spell sort, foe family, Oracle order, scroll narration, the last fight-log row, and active effect indicators
- [ ] **Phase 78: HUD, Dead State & Climb Decisions** - band-1 identity, dead-state lockdown, the DEAD-screen character sheet, text-size/settings/stairs-fade fixes, and the climb/leap decision card
- [ ] **Phase 79: Content & Narrative Pass** - sub-class/race blurbs, roll-direction phrasing, and the full narrative clarity sweep
- [ ] **Phase 80: Android Release Build & Tooling** - R8 minify/shrink, edge-to-edge and large-screen handling, and the fit tool's replay-resume fix
- [ ] **Phase 81: Leaderboards Panel Fixes** - YOU tag, standing card, ME | ALL | FRIENDS scopes with ALL default when signed in, LINEAGE ME-only, GRAVEYARD removed

## Phase Details

### Phase 72: Roll-Direction Sign Audit & Fixes
**Goal**: Every modifier that affects a roll has the correct sign, audited and fixed under the engine gate, before the engine's roll-high conversion begins.
**Depends on**: Nothing (first phase of v2.1; must land before the roll-high mirror)
**Requirements**: ROLL-01
**Success Criteria** (what must be TRUE):
  1. An audited ledger covers every modifier (weapon, armor, spell, ability, item, race, sub-class, condition, terrain) on every roll type (to-hit both ways, soak, saves/resistance, initiative, climbs, flee, parley, traps), confirming each bonus widens the success range and each penalty narrows it.
  2. The parley-insult "+1" lands in the correct order relative to the Smoke/Mirror/invisible/blind "natural 1" overrides on both the hero and member branches.
  3. Fridgian frenzy's second swing honours the dark-cap penalty instead of hard-setting a fixed need.
  4. The bestiary `critOn: 1` claim (Skeleton, "a 1 shatters it") is either wired into the engine or removed from the text.
  5. Every fixture the fixes move is measured, declared with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerated — nothing else moves.
**Plans**: TBD

### Phase 73: Engine Roll-High Mirror
**Goal**: The engine itself resolves every die check as roll-high, so no later display code or rule fix ever needs a translation layer again.
**Depends on**: Phase 72 (the sign/ordering fixes land first so the mirror is built on already-correct modifiers, not redone afterward)
**Requirements**: ROLL-05
**Success Criteria** (what must be TRUE):
  1. Every die check in the engine reads the same rng draw `r` as `(N+1) − r` on an N-sided die and succeeds at or above a high target, with modifiers applied as signed bonuses that always help the roller when positive.
  2. Every seeded run resolves identically to before the switch — the full parity suite (chargen, combat, economy) is byte-identical before and after, proving the mirror changed representation, not outcome.
  3. A guard test fails the build on any roll-under comparison left anywhere in `engine/`.
  4. Content numbers that encode to-hit/AR/etc. are re-expressed in the new convention, and any roll-related value already in a saved game converts once, tolerantly, on load.
  5. Every event that carries a roll (`struck`, foe swings, soak, thrown spells, resistance, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons, crits) natively carries the high-is-good `roll`, `target` and `dieN`.
**Plans**: TBD

### Phase 74: Roll Display & Modifier Honesty
**Goal**: Every roll and modifier the player sees is a direct, honest read of the engine's own high-is-good numbers.
**Depends on**: Phase 73 (the mirror must land first — the display reads the engine's numbers directly, with no adapter)
**Requirements**: ROLL-02, ROLL-03
**Success Criteria** (what must be TRUE):
  1. The Oracle, fight log, dice reveals, rail cards, hero sheet, combat menu and foe details all print the engine's own roll and target with no translation layer, and a higher roll always reads as better (on a d20 a caster needs 18–20, a thief 17–20, a fighter 16–20).
  2. Every displayed modifier is signed from the player's point of view — "+2" always reads better, "−2" always reads worse — across item/loot/store/find comparisons, the hero sheet, spell/ability text, condition chips and the fight log's need breakdown.
  3. The same modifier never shows opposite signs on two different surfaces.
**Plans**: TBD
**UI hint**: yes

### Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs
**Goal**: Character creation, HP growth, spell legality, initiative, traps, ailments and armor destruction follow the rules the game claims, written in the roll-high convention from the start.
**Depends on**: Phase 73 (written directly on top of the roll-high mirror so nothing here needs rewriting later)
**Requirements**: RULES-01, RULES-02, RULES-03, RULES-04, RULES-05, RULES-06, RULES-07, RULES-08, RULES-09, RULES-10
**Success Criteria** (what must be TRUE):
  1. Pulling multiple Table-4 "+HP" dots grows a character's max HP linearly, not compounding (×1.6 each time), and the toll row takes its share from that same non-inflated pool.
  2. A red-dot wilmst cache pays a bounded cut (~100 × depth) instead of buying out the store, a newly rolled Summoner's grimoire holds no spell from a school gated above its level, and the combat SPELLS menu hides (never just greys) anything level- or school-locked.
  3. A hero with Sense Presence active always wins initiative outright, never sees "You cannot see what you are fighting," and can land crits in the dark.
  4. A trap the Oracle reports as "−1 HP" can never kill the hero — the fix follows an explicit `/gsd-debug` root-cause session before it lands, not a guess.
  5. An ailment roll of 5–6 always gives the Disease it narrates, and replacing a destroyed armor piece with a new one always tells the player the old piece was destroyed and is gone.
  6. A Pilfer can use magic items like anyone else, but each use can fumble: on a rolled 1 the use fails, and the item explodes for d10 damage and turns to dust (the Oracle says so); tools never fumble, and the Pilfer blurb states both its good and its bad.
  7. Anyone can try to read a scroll: a Magic User or anyone with Runes/Signs always succeeds, everyone else succeeds on an intelligence roll, a badly failed read (missing by more than half the required number) turns the spell on the reader, and the scroll is gone either way.
**Plans**: TBD
**UI hint**: yes

### Phase 76: Darkness Unification & Relaunch Persistence
**Goal**: One shared darkness rule governs everything the player experiences as dark, and saving or force-closing never lets a player escape a live fight or an open store.
**Depends on**: Phase 75 (shares the engine fixture gate; sequenced after the RULES phase to avoid overlapping fixture claims)
**Requirements**: DARK-01, DARK-02, SAV-06, SAV-07
**Success Criteria** (what must be TRUE):
  1. A lit torch, the Amulet, or Night Vision widens what a player reveals while walking by the same rule that widens what is rendered — `revealRadius` and `mapViewRadius` never disagree again.
  2. The DARK chip, the map vignette and per-tile dark painting all read from the same unified waiver rule, so a light source means the same thing on every surface.
  3. A player who Saves & quits, or whose app is killed, mid-fight relaunches into the exact same fight — same foes, HP, round and active effects — and force-closing can no longer be used to escape a fight.
  4. A player who relaunches with the store open returns to the same store with the same stock.
**Plans**: TBD
**Device check**: yes — relaunch-mid-fight and relaunch-mid-store batched into the milestone-close Pixel 7 checklist per the deferred-UAT protocol.

### Phase 77: Combat Screen & Oracle Readability
**Goal**: Everything the player reads during a fight is legible, correctly ordered, honest, and shows what effects are currently live on them or their foe.
**Depends on**: Phase 74 (the roll-high display convention must be in place before combat-screen indicators show roll data)
**Requirements**: CMBUI-07, CMBUI-08, CMBUI-09, CMBUI-10, CMBUI-11, CMBUI-12, CMBUI-13
**Success Criteria** (what must be TRUE):
  1. Every combat submenu row (spells, abilities, items, social) grows to fit its text on the Pixel 7 with no clipped label or description, and spell rows sort by level ascending then alphabetically.
  2. Each foe card shows the foe's bestiary family after its name, and the Oracle prints combat lines in the order they happened (adjacent identical lines still fold).
  3. Reading a scroll in combat that successfully casts its spell never narrates a level refusal, and the last (oldest) row of THE FIGHT SO FAR can be tapped to reveal its roll like every other row.
  4. Every active ability or spell effect (Smoke, Sidestep, Battle Roar, Riposte, Taunt, Shield, Sense Presence and every other timed or conditional effect) shows an indicator on the hero (YOUR LOT) or the foe it affects, with rounds remaining, a tap-for-description, and it clears when the effect ends.
**Plans**: TBD
**UI hint**: yes
**Device check**: yes — combat-screen legibility (submenu clipping, indicator readability) batched into the milestone-close Pixel 7 checklist per the deferred-UAT protocol.

### Phase 78: HUD, Dead State & Climb Decisions
**Goal**: The HUD tells the truth at a glance, the dead state locks down cleanly, settings behave as expected, and crossing a wall or crevice is a decision the player makes before any dice are rolled.
**Depends on**: Nothing (shell/presentation-only, zero fixture moves)
**Requirements**: HUD-01, HUD-02, HUD-03, HUD-04, HUD-05, HUD-06, CLIMB-01, CLIMB-02
**Success Criteria** (what must be TRUE):
  1. Band 1 reads "Race Sub-class · Lvl N" (e.g. "Dwarf Pickpocket · Lvl 3") with no parent class and no parentheses.
  2. Once the hero is dead, only the Oracle, the DEAD/Leaderboards screen and the ☰ menu accept input — map taps, other tabs, camp, marks and centre map are inert — and the DEAD screen offers a read-only final character sheet (stats, gear, level) for the run that just ended.
  3. The Settings text-size choice (S/M/L) scales every `--mw-font-*` token, and dragging or scrolling the settings sheet never changes a volume slider — a deliberate horizontal drag on a slider still sets its volume.
  4. A stairs descent fades to black under the stairs sound, then fades in on the new floor, honouring reduced motion.
  5. Stepping toward a wall or crevice square first shows a decision card — CLIMB IT / LEAP IT, USE LADDER / USE ROPE (when carried), TURN BACK — with no dice rolled until the player commits; TURN BACK costs nothing (no step, time or roll) and no stale retry card ever appears after a crossing.
**Plans**: TBD
**UI hint**: yes
**Device check**: yes — dead-state input lockdown, settings-sheet drag behaviour, the stairs fade and the climb card need a Pixel 7 pass, batched into the milestone-close checklist per the deferred-UAT protocol.

### Phase 79: Content & Narrative Pass
**Goal**: Every piece of in-game text — class/race blurbs, roll-direction phrasing and the full narrative sweep — reads honestly and consistently in the game's voice.
**Depends on**: Phase 74 (roll-direction display must be settled before the text is rewritten to match it), Phase 77 (VOX-05 sweeps the new CMBUI-13 effect-indicator text)
**Requirements**: VOX-04, ROLL-04, VOX-05
**Success Criteria** (what must be TRUE):
  1. Every sub-class and race description states both its advantage(s) and disadvantage(s), including school gates such as the Summoner's no-offense-spells-before-level-3.
  2. No player-facing string still encodes roll-under phrasing ("1–N", "need N", "natural 1", "−3 on to-hit") — a doc-synced test pins that none remains.
  3. Every in-game line (Oracle, rail cards, fight log, refusal reasons, item and spell text, epitaphs) states clearly what happened, to whom and why, while staying sarcastic and family-friendly.
**Plans**: TBD

### Phase 80: Android Release Build & Tooling
**Goal**: The release build is optimized and store-clean on modern Android and large screens, and the tuning tool's replay-resume is trustworthy.
**Depends on**: Nothing (native/infra track, independent of the gameplay phases)
**Requirements**: DROID-01, DROID-02, DROID-03, TOOL-01
**Success Criteria** (what must be TRUE):
  1. The release AAB builds with R8 minify, shrink and obfuscation on AGP 8.13, ships a deobfuscation mapping, and a release-signed Pixel 7 build boots, saves and resumes, handles back, and plays sound/haptics as before.
  2. The game draws correctly edge-to-edge on Android 15+, in both gesture and 3-button navigation and with a display cutout, using no deprecated window or status-bar APIs Play flags.
  3. On a tablet, foldable or Chromebook, the game presents a deliberate, documented layout (such as a letterboxed portrait column) rather than a broken one, and Play's display-configuration warning is addressed or consciously accepted.
  4. A fit-tool run resumed from its JSONL log retraces the exact same walk as the live run, including after an infeasible (`+Infinity`) point, with per-block stdout appended rather than truncated.
**Plans**: TBD
**UI hint**: yes
**Device check**: yes — DROID-02/03 recommended for `--research-phase` (Android 15/16 edge-to-edge + large-screen handling); needs device checks in both navigation modes plus an emulator tablet/foldable, batched into the milestone-close Pixel 7 checklist.

### Phase 81: Leaderboards Panel Fixes
**Goal**: The Leaderboards panel shows the signed-in player accurately, filters every board by ME | ALL | FRIENDS, and drops the boards Play Games cannot back honestly.
**Depends on**: Nothing (shell-only: `src/browser/boardsView.js`, `boardsPanel.js`, `globalBoards.js`, `content/boards.js`, plus `engine/records.js` `BOARD_IDS`; zero parity fixtures)
**Requirements**: BOARD-09, BOARD-10, BOARD-11, BOARD-12, BOARD-13, BOARD-14
**Success Criteria** (what must be TRUE):
  1. The panel shows three scope chips — ME | ALL | FRIENDS — and every board can be viewed under each; signed in with Compete ON it opens on ALL, signed out or Compete OFF it opens on ME with ALL/FRIENDS showing the sign-in note.
  2. On ALL and FRIENDS the signed-in player's own score is tagged YOU — never FRIEND — with the `playerId` mismatch root-caused and fixed, and the "not in the top ten / your best run" card appears only when the player is ranked but off the visible list.
  3. LINEAGE appears only under ME, sits at the end of the board rail, and never reads the global DEEPEST sample.
  4. The GRAVEYARD board is gone; ME rows keep each run's tap-to-expand details (epitaph included), the stored run history still feeds ME and LINEAGE, and old saves load cleanly.
**Plans**: TBD
**UI hint**: yes
**Device check**: yes — needs a signed-in Google Play Games build (YOU tag, standing card, ALL default, ME/ALL/FRIENDS switching, LINEAGE under ME only), batched into the milestone-close Pixel 7 checklist.

## Deferred / Not This Milestone

- **Pixel 7 UAT batches** — `docs/UAT-v2.0.md` (142), `UAT-v1.9.md` (21), `UAT-v1.8.md` (30), `UAT-v1.7.md` (25 + DR bar), `UAT-v1.6.md` (26) and `UAT-v1.5.md` (140), walked over the user's play sessions; findings become todos or quick tasks, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task. **Superseded 2026-09-24**: CLIMB-01/02 (v2.1 Phase 78) replaces the retry card with a pre-roll decision card, and ROLL-05 (Phase 73) makes every climb roll high-is-good natively.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 72. Roll-Direction Sign Audit & Fixes | v2.1 | 0/– | Not started | - |
| 73. Engine Roll-High Mirror | v2.1 | 0/– | Not started | - |
| 74. Roll Display & Modifier Honesty | v2.1 | 0/– | Not started | - |
| 75. Engine Rules — Character, Economy, Grimoire & Combat Bugs | v2.1 | 0/– | Not started | - |
| 76. Darkness Unification & Relaunch Persistence | v2.1 | 0/– | Not started | - |
| 77. Combat Screen & Oracle Readability | v2.1 | 0/– | Not started | - |
| 78. HUD, Dead State & Climb Decisions | v2.1 | 0/– | Not started | - |
| 79. Content & Narrative Pass | v2.1 | 0/– | Not started | - |
| 80. Android Release Build & Tooling | v2.1 | 0/– | Not started | - |
| 81. Leaderboards Panel Fixes | v2.1 | 0/– | Not started | - |
| 65. Run Record & Personal Bests | v2.0 | 5/5 | Complete    | 2026-09-23 |
| 66. Leaderboards Panel — Local | v2.0 | 7/7 | Complete    | 2026-09-23 |
| 67. Play Games Integration & Account Chip | v2.0 | 8/8 | Complete    | 2026-09-24 |
| 68. Global Boards, Submissions & "You Placed X" | v2.0 | 7/7 | Complete    | 2026-09-24 |
| 69. Compliance & Device Close | v2.0 | 4/4 | Complete    | 2026-09-24 |
| 70. Device-Round Polish | v2.0 | 4/4 | Complete    | 2026-09-24 |
| 71. Device-Round Polish II | v2.0 | 8/8 | Complete    | 2026-09-24 |
| 61. Gear Rules & Store Purchase Fix | v1.9 | 4/4 | Complete    | 2026-09-23 |
| 62. Gear Tab Layout Rebuild | v1.9 | 3/3 | Complete    | 2026-09-23 |
| 63. Action Sheet, Combat Lock & Accessibility | v1.9 | 5/5 | Complete    | 2026-09-23 |
| 64. Device Close & UAT Batch | v1.9 | 2/2 | Complete    | 2026-09-23 |
| 56. Sound Effects & Audio Settings | v1.8 | 4/4 | Complete    | 2026-09-22 |
| 57. Map & HUD Layout Band | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 58. Motion & Pacing | v1.8 | 7/7 | Complete    | 2026-09-22 |
| 59. Party Animation & Dungeon Set Dressing | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 60. Performance & Footprint Close | v1.8 | 3/3 | Complete    | 2026-09-22 |
| 50. Character Roller Fix | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 51. Initiative Once Per Combat | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 52. Foe Cadence & Damage Curve | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 53. Joiner Level Cap | v1.7 | 2/2 | Complete    | 2026-09-20 |
| 54. Four-Band Retune & Roster Decision | v1.7 | 7/7 | Complete    | 2026-09-22 |
| 55. Human DR Round | v1.7 | 0/0 | Complete    | 2026-09-22 |
| 44. Retire the Classic Engine from the Shell | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 45. Collapse the Phase 37 Hedges | v1.6 | 3/3 | Complete    | 2026-09-19 |
| 46. Honest Names, Dead Exports & the Tutorial Decision | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 47. Shell Modularisation | v1.6 | 5/5 | Complete    | 2026-09-19 |
| 48. Stale Docs, Comments & Test Names Purge | v1.6 | 5/5 | Complete    | 2026-09-20 |
| 49. Measure-First Perf Pass | v1.6 | 2/2 | Complete    | 2026-09-20 |
| 36. Balance Foundation, Effect Timers & Small Independent Wins | v1.5 | 6/6 | Complete    | 2026-09-17 |
| 37. Equipment Slot Model & eff() Refactor | v1.5 | 4/4 | Complete    | 2026-09-17 |
| 38. Melee Active Abilities | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 40. Spell Rework | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 41. Terrain, Darkness & Phobias | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 43. Clarity Pass | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.6 (tutorial rebuilds on the modular shell) | - |

## Backlog

### Phase 999.1: Transitions & Sounds (PROMOTED → Phases 56 / 58 / 59)

> **Promoted 2026-09-22 into milestone v1.8.** Sound → AUD-01..06 (Phase 56); transitions, combat pacing and typed text → MOTION-01..05 (Phase 58); the party-marker ring → ANIM-03 (Phase 59). The rail-overlay prerequisite it names is LAYOUT-01 (Phase 57). Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (30 MP3s the user added — 31 originally, less `enemy-batrat` which the user deleted 2026-09-22: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (PROMOTED → Phase 59)

> **Promoted 2026-09-22 into milestone v1.8 as DRESS-01..05, Phase 59 (Party Animation & Dungeon Set Dressing).** Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Map & HUD layout band (PROMOTED → Phase 57)

> **Promoted 2026-09-22 into milestone v1.8 as LAYOUT-01..06, Phase 57 (Map & HUD Layout Band).** Kept here with its todo index until Phase 57 closes; the four todos below carry `resolves_phase: 57`. Not a runnable backlog item — do not queue it.

**Goal:** [Captured from the 2026-09-19/21 Pixel 7 device rounds] The map screen's chrome stops fighting the map: the rail slides up OVER the map instead of reflowing it, the MARKS / CENTRE / MAKE CAMP / gear strip becomes a reserved band outside the viewport (so a chip tap can never also move the party), the HUD stacks into four bands instead of one clipping row, and the Table-7 Darkness counter becomes visible on the map.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (4):**

- `todos/pending/2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — rail is a flex sibling that resizes `.mw-maze-viewport`; must overlay + slide, body tap dismisses a no-decision card (never a decision card), `RAIL_HOLD` roughly doubles. **Lands with 999.1** (both touch rail transitions).
- `todos/pending/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md` — `.mw-map-chips` is an absolute overlay inside the viewport; chip taps also move the party and `keepInViewAxis` counts hidden cells.
- `todos/pending/2026-09-21-hud-reflow-name-hp-row-then-counters-then-conditions-then-chips.md` — the single-row HUD (Phase 35 ruling 5) overlaps Rations past 1,000 squares; four stacked bands. **Land together with the chip-strip todo.**
- `todos/pending/2026-09-21-table-7-darkness-counter-is-invisible-on-the-map.md` — `c.darkFor` only shrinks the reveal radius for NEW cells (fog is cumulative) and nothing dims; wants a vignette + the existing DARK chip countdown.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Combat screen & Oracle readability (PROMOTED → Phase 77)

> **Promoted 2026-09-24 into milestone v2.1 as CMBUI-07..13, Phase 77 (Combat Screen & Oracle Readability).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Everything the player reads during a fight is legible, ordered and honest: submenu rows stop clipping and sort by spell level, the foe's BESTIARY family shows after its name, the Oracle prints combat lines in event order rather than priority order, status chits are readable mid-fight, and a scroll that casts stops narrating a refusal.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-combat-submenu-rows-clip-their-text-order-spells-by-level-then-name.md` — `.cb-row` clips on the phone; spell rows render in `SPELLS` array order with no sort. **Land with the hide-uncastable todo in 999.6.**
- `todos/pending/2026-09-21-foe-type-listed-after-the-name-on-the-combat-screen.md` — the foe record already carries `type` (the six BESTIARY families); surface it on `.cb-foe-name`.
- `todos/pending/2026-09-21-oracle-combat-lines-must-read-in-event-order.md` — the Oracle reuses the rail fold, which sorts by PRIORITY and collapses identical lines across time, so riposte kills print before the misses that caused them; wants idx-order + adjacent-only folding.
- `todos/pending/2026-09-21-status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba.md` — `railEl.hidden` is forced for the whole fight, so status-effect descriptions are unreachable in combat; wants a combat-legal transient card.
- `todos/pending/2026-09-21-scroll-read-in-combat-narrates-a-level-refusal-although-it-cast.md` — `scrollTooAdvanced` is the copy-to-book gate but reads as a refusal right before the cast line; narration-only.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Engine rules fixes from the device rounds (PROMOTED → Phase 75)

> **Promoted 2026-09-24 into milestone v2.1 as RULES-01..04, Phase 75 (Engine Rules — Character, Economy, Grimoire & Combat Bugs).** The combat gear-lock and store-charge-then-refuse items in this backlog already shipped as v1.9 Phase 61 (GRULE-02 / STORE-02/03); only the Summoner school-gate, hide-uncastable-spells, HP-dot compounding and wilmst-cache items carried forward into v2.1. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Five rules bugs the fitted build exposed: a free mid-fight re-arm, a store purchase that charges then refuses, a Summoner holding spells it cannot cast, Table-4 HP dots that compound max HP geometrically, and a wilmst cache that still pays far too much.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-no-equipping-or-swapping-gear-during-combat.md` — `equipItem` / `unequipSlot` / `wearItem` carry no `state.combat` gate and the Gear tab stays live mid-fight; wants an engine refusal + disabled rows (`engine/movement.js:523` is the existing gate pattern). **DONE — shipped as v1.9 Phase 61 (GRULE-02).**
- `todos/pending/2026-09-21-store-purchase-charged-then-rejected-as-not-an-upgrade-spike.md` — `buyFrom` deducts gold and marks the row sold BEFORE `takeItem` can reject `notBetter`; a purchase must always deliver or refuse before charging. **DONE — shipped as v1.9 Phase 61 (STORE-02/03).**
- `todos/pending/2026-09-21-summoner-rolls-freeze-it-cannot-cast-hide-uncastable-spells-.md` — chargen's `rollGrimoire` ignores the `mu-chart.js` school gate; plus the user ruling that the combat menu HIDES level-locked spells (reverses the earlier disabled-but-visible CONTEXT decision). **Carried to v2.1 as RULES-03/04.**
- `todos/pending/2026-09-21-table-4-hp-dots-compound-max-hp-geometrically-regression.md` — the "+25 HP" row adds `0.6 × CURRENT maxWP` permanently (×1.6 per pull, compounding) and the toll row then takes 36 % of the inflated pool; a 54-05 regression that also inflates the fit's bot heroes. **Carried to v2.1 as RULES-01.**
- `todos/pending/2026-09-21-red-dot-wilmst-cache-still-pays-far-too-much.md` — `WILMST_CACHE_PER_DEPTH = 300` flat × depth; wants its own cut (~100 × depth) or a derived-rng roll. **Carried to v2.1 as RULES-02.**

**Engine gate applies:** every one of these is a rules change — measure the moved parity fixtures first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, master never edited, bot readout before/after.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Content accuracy, tooling & the open climb ruling (PROMOTED → Phases 78, 79, 80)

> **Promoted 2026-09-24 into milestone v2.1: the climb/leap ruling → CLIMB-01/02, Phase 78; sub-class descriptions → VOX-04, Phase 79; the fit-tool replay-resume bug → TOOL-01, Phase 80.** The climb ruling was decided by the user 2026-09-24 as option B (the pre-roll CLIMB/LEAP/USE LADDER/USE ROPE/TURN BACK decision card). Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-21/22] The odds and ends from the device rounds: sub-class blurbs that hide their own gates, a fit tool whose replay-resume diverges, and the CLIMB IT retry card that went stale when Phase 54 made climbs one-and-done.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (3):**

- `todos/pending/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` — the Summoner blurb never mentions the level-3 offense gate; audit every `SUB_NOTE` / `RACE_NOTE` against `MU_CHART` + the Phase 24 identity table. Content only.
- `todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` — `+Infinity` scores serialise as `null`, so a resumed walk takes a different step after the first rejected candidate; per-block stdout was also truncated. Tooling only.
- `todos/pending/2026-09-22-climb-leap-retry-card-is-stale-under-one-and-done.md` — **resolved by user ruling 2026-09-24, option B:** a pre-roll CLIMB / USE TOOL / TURN BACK prompt, no rng until commit. Keep the ladder/rope option; `mapMarks.js` crevice copy reads pre-one-and-done too.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Unify the two darkness mechanisms (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as DARK-01/02, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [User ruling 2026-09-22, found during Phase 57 planning] The game has **two** darkness mechanisms with **different waiver sets**, and they disagree. Unify them behind one shared waiver predicate so a light source means the same thing everywhere.
**Requirements:** TBD
**Plans:** 0 plans

**The inconsistency, measured:**

| | `revealRadius(state)` | `mapViewRadius(state)` |
|---|---|---|
| Origin | **1994 canon** — `engine/derived.js` comment: "ports `mazeworld.html` `reveal()`'s radius line verbatim (line 838)" | **Phase 41 (TERR-03)** — this project's own render filter |
| Governs | what NEW cells are revealed as the party walks (feeds `seen`) | which already-`seen` cells are rendered (`inViewWindow`, applied in `draw()`) |
| Waived by | Night Vision, `+ eff("sight")` | Night Vision, `eff("light") > 0` (Amulet), `itemEffectActive("lit")` (torch) |

Verified empirically at HEAD with `darkFor: 30` on a non-dark tile:

```
no waiver   | inDark true | revealRadius 1 | mapViewRadius 1
lit torch   | inDark true | revealRadius 1 | mapViewRadius Infinity   <-- the divergence
```

**So a lit torch reopens your entire explored map but does not help you see one square further as you walk.** That is backwards from what a torch obviously does, and it is the cause of the 2026-09-21 device report (*"It looks like I'm in the dark, but it's not limiting my vision"*) — the player had a light source, the render filter waived, the reveal rule did not, and nothing on screen explained either.

**The shape of the fix:** one shared `darkWaived(c)` predicate consumed by both functions, with the **torch and the Amulet widening `revealRadius` as well** (the reading the user favours: a light source should mean the same thing everywhere). Keep `+ eff("sight")` as the separate additive it already is.

**Why this is NOT a v1.8 phase:** widening `revealRadius` changes which cells enter `seen`, and `seen` is serialized — so parity fixtures move. v1.8 is gated presentation-only (`engine/` and `content/` byte-identical, zero fixtures moved). This needs the greenfield treatment instead: measure the moved set first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, never edit the master, and take a bot readout before/after (a wider reveal radius in the dark is a small difficulty change — darkness gets less punishing for anyone carrying a light).

**What Phase 57 did instead (v1.8, presentation-only):** made the *current* behaviour legible rather than changing it — the DARK chip names which waiver is holding the dark back, and the map vignette follows `mapViewRadius` (what is actually rendered) rather than `revealRadius`. When this backlog phase lands and the two agree, the vignette's source argument can collapse back to a single radius and `waiverFor`'s three-way split becomes a two-way one. Leave a comment in `src/browser/darknessView.js` pointing here.

**Third surface to fold in while here:** per-tile `tile.dark` painting in `draw()` is a *third* darkness expression, independent of both radii. Decide whether it shares the predicate or stays purely cosmetic.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Android 15/16 edge-to-edge, deprecated window APIs, large-screen orientation (PROMOTED → Phase 80)

> **Promoted 2026-09-24 into milestone v2.1 as DROID-02/03, Phase 80 (Android Release Build & Tooling).** Flagged `--research-phase` recommended. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-23 from the Play Console pre-launch notes on the 1.9.0 / vc8 build] Clear the three Play Console warnings so the game draws correctly edge-to-edge on Android 15+ and behaves on tablets, foldables and Chromebooks.
**Requirements:** TBD
**Plans:** 0 plans

**The three warnings, verbatim from Play Console:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps targeting SDK 35 should handle insets to make sure that their app displays correctly on Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or EdgeToEdge.enable() for Java for backward compatibility."*
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window display have been deprecated in Android 15. To fix this, migrate away from these APIs or parameters."*
3. *"Your game doesn't support all display configurations, and uses resizability and orientation restrictions that may lead to layout issues for your users."*

**What is already in place (so this is a verify-and-tidy, not a rewrite):**

- `targetSdkVersion = 36` (`android/variables.gradle`), so edge-to-edge is already forced on Android 15+.
- `mazeworld.html` pads its fixed chrome with `var(--safe-area-inset-*, env(safe-area-inset-*))` (HUD band ~L1026, dead screen ~L1105, `.mw-bd-dock` ~L1187, title/panels ~L1261/1344/1417/1527). Device checks so far have looked right on the Pixel 7, but nobody has tested gesture-nav vs 3-button nav, a display cutout, or landscape.

**Likely sources, to confirm:**

- **Warning 2:** `src/browser/nativeChrome.js` ~L219-220 calls `StatusBar.setBackgroundColor({ color: "#1b170f" })`. On Android that maps to `Window.setStatusBarColor`, which is deprecated in API 35 and ignored under edge-to-edge (the comment there already calls it best-effort). Drop the call, or move to `@capacitor/status-bar`'s edge-to-edge-aware API if 8.x has one. Also check Capacitor core, SplashScreen and the Play Games plugin (Phase 67) for `setStatusBarColor`, `setNavigationBarColor` or `setDecorFitsSystemWindows`. Play Console names the calling class under "View details".
- **Warning 1:** confirm Capacitor 8's `BridgeActivity` already enables edge-to-edge, or call `EdgeToEdge.enable(this)` in `MainActivity`. Then check that the WebView really receives the insets: Capacitor's `SystemBars`/`adjustMarginsForEdgeToEdge` config, and whether `env(safe-area-inset-*)` is populated inside the Android WebView or needs the Capacitor-injected `--safe-area-inset-*` variables.
- **Warning 3:** `AndroidManifest.xml` sets `android:screenOrientation="portrait"` and `nativeChrome.js` locks portrait through `@capacitor/screen-orientation`. On Android 16 (targetSdk 36), large screens (smallest width ≥ 600dp) **ignore** orientation and resizability restrictions, so the game will run in landscape or in split-screen on tablets and foldables whatever we set. Decide whether to (a) accept a letterboxed portrait column centred on wide screens (a max-width layout plus a dark gutter), or (b) do nothing and accept the warning. Games can opt out through the `android:appCategory="game"` exemption, so check whether Play still flags a game that declares it.

**Constraints:** presentation and native shell only. The engine, `content/` and fixtures are untouched. Needs a device pass on the Pixel 7 in both navigation modes, plus an emulator tablet or foldable (resizable AVD) for warning 3.

**Sequencing:** interacts with the AGP 9.3.1 spike (Phase 67, `67-AGP9-SPIKE.md`), which also touches the Android build, so land it after that verdict. A good fit for the first post-v2.0 native-polish pass, alongside the R8/minify todo.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Keep live combat and open store through a relaunch (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as SAV-06/07, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-24 from Phase 70 plan 70-04's resume proof; user ruling: finish Phase 70, fix later] A player who Save & quits (or whose app is killed) mid-fight or mid-store should come back to the same fight or store after a relaunch, not to a cleared tile.
**Requirements:** TBD
**Plans:** 0 plans

**The gap, measured (70-04, real engineAdapter + fake storage):**

- In session: SAVE & QUIT → ENTER resumes exactly (no dispatch happens).
- After a relaunch: `dispatch()` did persist `combat` / `store`, but `engine/saveState.js#rehydrate` (~L735-736) always resets `combat`, `store`, `beats`, `pendingFind` and `pendingHazard` to null. Only `pendingLoot` survives on purpose (LOOT-06). The code comments call this deliberate: it copies the 1994 prototype's load, which treated them as transient.
- Consequences: a relaunch mid-fight lands on the same tile with the fight gone, which also means force-closing the app escapes any fight. An open store vanishes the same way.
- Pinned as today's behaviour in `test/persistence/` (70-04), with a pointer here.

**The shape of the fix:** carry a validated `combat` and `store` through `validateSave` and `rehydrate`, including mid-fight state that combat depends on (`c.foeEffect`, the timers, any per-round flags). Decide whether `beats` should rehydrate or the round should resume at a clean round boundary. Check `pendingFind` / `pendingHazard` the same way.

**Constraints:** an engine change (greenfield ruling: no dual path). Measure which parity or roundtrip expectations move, declare them in `test/parity/FIXTURE-INVENTORY.md`, and never edit the prototype master. Needs a relaunch-mid-fight device check.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
