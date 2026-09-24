# Requirements: Delve, Die, Repeat — v2.1 Bug Fixes

**Defined:** 2026-09-24
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Close out every open device-round bug so the game is honest, legible and store-clean ahead of the Play production launch.

**Engine gate (greenfield, user ruling 2026-09-17):** every RULES/DARK/SAV change is the only rule afterwards (no dual path). Measure the fixtures it moves, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerate only those. `test/parity/prototype-master.js.txt` is never edited, new serialized fields are carved out of the three comparables, and a bot readout is taken before and after any change that affects difficulty.

## v2.1 Requirements

### Engine rules (RULES)

- [ ] **RULES-01**: A Table-4 "+HP" dot raises max HP by a non-compounding amount. Repeated pulls grow the pool linearly rather than ×1.6 each time, and the toll row takes its share from that non-inflated pool. (todo 2026-09-21 table-4-hp-dots)
- [ ] **RULES-02**: A red-dot wilmst cache pays a cut amount (about 100 × depth, the final value set in plan). One cache no longer buys out the store. (todo 2026-09-21 red-dot-wilmst-cache)
- [ ] **RULES-03**: A new character's grimoire never holds a spell from a school its sub-class gates at its level. A level-1 Summoner rolls no offense spell. (todo 2026-09-21 summoner-rolls-freeze)
- [ ] **RULES-04**: The combat SPELLS menu lists only spells the hero can cast now. Level- or school-locked spells are hidden, not shown greyed. (same todo, user ruling)
- [ ] **RULES-05**: With Sense Presence active, the hero wins initiative outright, the "You cannot see what you are fighting" line does not fire, and crits are allowed in the dark. (todo 2026-09-23 sense-presence)
- [ ] **RULES-06**: The HP a trap shows the player equals the HP it actually takes. A hero cannot die to a trap the Oracle reports as −1 HP. Root-cause it with `/gsd-debug` before fixing. (todo 2026-09-22 trap-death-at-21-hp)
- [ ] **RULES-07**: An ailment roll of 5–6 gives the Disease it narrates, not a phobia. (todo 2026-09-23 ailment-roll-5-6)
- [ ] **RULES-08**: When new armor replaces a destroyed piece, the player is told the old piece was destroyed and is gone. It never silently vanishes on a swap. (todo 2026-09-23 destroyed-armor)
- [ ] **RULES-09**: A Pilfer can use magic items under the normal rules. The heal-only refusal is gone. Instead, every time a Pilfer uses a magic item it rolls a die, and on a 1 the use fails, and the item explodes for d10 damage and turns to dust. The player is told so. Tools never fumble. The die, which items count as magic, and who the explosion hits and whether armor soaks it are decided in the Phase 75 discuss. The fumble draw comes from a derived rng stream. The Pilfer blurb states both sides. (user, 2026-09-24; todo 2026-09-24 pilfer-bad-becomes-fumbling)
- [ ] **RULES-10**: Every Thief (all 8 sub-classes, Pilfer included) may attempt to read any scroll, and succeeds 50% of the time. A success casts the scroll's spell; a failure casts nothing. The scroll is consumed either way, and both outcomes are narrated. Whether Runes/Signs still guarantees the read, and whether a Pilfer's RULES-09 fumble also applies to scrolls, are decided in the Phase 75 discuss. The roll comes from a derived rng stream. (user, 2026-09-24; todo 2026-09-24 thieves-read-scrolls-at-50-percent)

### Roll direction & modifier honesty (ROLL) — user, 2026-09-24

Context: the engine rolls UNDER a need on a d20 (a caster hits on 1–3), so a bonus must WIDEN the range and a penalty must NARROW it. On device, a dropped weapon read "-2 to hit". The user read that as worse, but it may have been better. User ruling: players should read + as good and − as bad, and see rolls as bigger-is-better. **Engine ruling (user, 2026-09-24): switch the ENGINE to roll-high, not a display adapter.** A display-only flip would drift, because every new roll and line would have to remember to translate. The switch mirrors the die: each check draws the same `r` and reads the roll as `(N+1) − r` against a high target, so every seed resolves exactly as before and the parity suite must stay byte-identical. A moved fixture means a site was flipped wrong. Order: the ROLL-01 sign fixes land first, then the mirror.

Audit findings (2026-09-24, checked against Phase 31's `31-ROLL-DIRECTION-AUDIT.md`, 34 sites):
- Nearly every check is roll-under. Flee (`d20+X ≥ 14`) and initiative are already roll-high.
- All weapon, spell, ability, armor and condition modifiers found change the need with the correct sign. A heavy weapon's "−2 to hit" really is worse.
- The hero's strike die shrinks with level (d20→d6), so the flip is `(N+1)−roll` on an N-sided die, not always `21−roll`.
- About 55–65 player-facing strings encode direction. `needModsClause` prints deltas that read in opposite senses on hero-need and foe-need lines.
- Events carry roll and need for about 80% of checks. `struck` and the foe swings lack `dieN`, and soak, climb/leap, cure and wake events carry no roll.

- [ ] **ROLL-01**: An audited ledger covers every modifier from weapons, armor, spells, abilities, items, races, sub-classes, conditions and terrain, on every roll (to-hit both ways, soak, saves/resistance, initiative, climbs, flee, parley, traps). Every bonus widens the success range and every penalty narrows it. Each sign bug found is fixed under the engine gate, with any moved fixtures declared and regenerated. Known at scoping:
  - (a) `parleyInsulted +1` lands after the Smoke/Mirror/invisible/blind "natural 1" overrides on the hero branch (combat.js ~:2554-2564), so an insulted foe hits a Smoked hero on 1–2. The member branch orders it the other way.
  - (b) Fridgian frenzy's second swing hard-sets need 3 and skips the dark cap (~:611).
  - (c) Bestiary `critOn: 1` ("a 1 shatters it", Skeleton) is never read by the engine. Wire it in, or drop the claim.
- [ ] **ROLL-05**: Every die check in the engine resolves roll-high. The engine reads the same rng draw `r` as `(N+1) − r` on an N-sided die and succeeds at or above a target, with modifiers as signed bonuses to the roll or target (+ always helps the roller). Every seeded run resolves identically, parity fixtures stay byte-identical, and a guard test fails on any roll-under comparison left in `engine/`. This covers all ~34 sites: to-hit both ways, soak, thrown spells, resistance, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons, crits and the "natural" overrides. Flee and initiative keep roll-high with their modifier conventions aligned. Content numbers (weapon and bestiary to-hit, AR, etc.) are re-expressed in the new convention, and any value stored in save state gets a one-time tolerant-load conversion. Events carry the high-is-good `roll`, `target` and `dieN` natively, including soak, climb/leap, cure and wake.
- [ ] **ROLL-02**: Every roll the player sees prints the engine's own high-is-good roll and target, with no translation layer: the Oracle, fight log, dice reveals, rail cards, hero sheet, combat menu and foe details. On a d20 a caster needs 18–20, a thief 17–20 and a fighter 16–20.
- [ ] **ROLL-03**: Every displayed modifier is signed from the player's point of view: "+2 to hit" always means better odds, and "−2" always means worse. This covers item, loot, store and find comparisons, the hero sheet, spell and ability text, condition chips and the fight log's need breakdown. The same modifier never shows opposite signs on two surfaces.
- [ ] **ROLL-04**: The rules text, `content/` descriptions and narration that encode roll direction ("1–N", "need N", "natural 1", "−3 on to-hit") are rewritten to the bigger-is-better reading, and a doc-synced test pins that no roll-under phrasing remains in player-facing strings.

### Leaderboards (BOARD) — device report 2026-09-24, v2.0 build

- [ ] **BOARD-09**: On the global boards, the signed-in player's own score is tagged **YOU**, never FRIEND, in both the All and Friends scopes. Today the row is tagged "FRIEND" because `you` is set only when the score's `playerId` equals the signed-in id (`globalBoards.js:80`) and that match fails on device. Root-cause the id mismatch; don't paper over it.
- [ ] **BOARD-10**: When the player's own score is already inside the shown top ten, the "not in the top ten / your best run" standing card does not appear. It appears only when the player is ranked but off the visible list. (Device: sole entry, rank #1, shown twice.)
- [ ] **BOARD-11**: When signed in with Compete ON, the Leaderboards panel opens on **ALL**. Today it defaults to `"local"` (`boardsView.js:911`), so neither ALL nor FRIENDS is selected. Signed out or Compete OFF keeps the local view.

- [ ] **BOARD-12**: The Leaderboards panel has three scope chips, **ME | ALL | FRIENDS**, and every board can be filtered by them. ME is the local list of the player's own runs (today's hidden `"local"` scope, with no chip to return to it). Signed out or with Compete OFF, ALL and FRIENDS keep today's sign-in note and ME stays the default. BOARD-11's ALL default applies when signed in with Compete ON. (user ruling 2026-09-24)
- [ ] **BOARD-13**: LINEAGE is a ME-only board. Its tab is shown only while ME is selected, it moves to the end of the board rail, and it no longer reads the global DEEPEST sample. The reason is that Play Games keeps one best score per player per board, so a global lineage view could only ever show each player's all-time deepest character. (user ruling 2026-09-24)
- [ ] **BOARD-14**: The GRAVEYARD board is removed, because ME covers it. Its tab, copy and view branch go away. The run history that feeds ME and LINEAGE stays stored, and old saves load tolerantly. Nothing a player could see on GRAVEYARD is lost: ME rows keep the run's tap-to-expand details. (user ruling 2026-09-24)

### Darkness (DARK) — backlog 999.8

- [ ] **DARK-01**: One shared darkness-waiver predicate drives both `revealRadius` and `mapViewRadius`. A lit torch, the Amulet or Night Vision widens what you reveal as you walk as well as what is rendered.
- [ ] **DARK-02**: The DARK chip, the map vignette and per-tile dark painting all read from the unified rule, so a light source means the same thing on every surface.

### Relaunch persistence (SAV) — backlog 999.10

- [ ] **SAV-06**: A player who Saves & quits, or whose app is killed, mid-fight relaunches into the same fight: the same foes, HP, round and active effects. Force-closing no longer escapes a fight.
- [ ] **SAV-07**: A player who relaunches with the store open returns to the same store with the same stock.

### Combat screen & Oracle (CMBUI)

- [ ] **CMBUI-07**: Every combat submenu row (spells, abilities, items, social) grows to fit its text on the Pixel 7. No label or description runs past the row's bottom edge. (todo 2026-09-21 combat-submenu-rows)
- [ ] **CMBUI-08**: Spell rows are ordered by spell level ascending, then alphabetically. (same todo)
- [ ] **CMBUI-09**: Each foe card shows the foe's bestiary family after its name. (todo 2026-09-21 foe-type)
- [ ] **CMBUI-10**: The Oracle prints combat lines in the order they happened, and only adjacent identical lines fold together. (todo 2026-09-21 oracle-event-order)
- [ ] **CMBUI-11**: Reading a scroll in combat that casts its spell never narrates a level refusal. At most, it says the spell is too advanced to copy into the book. (todo 2026-09-21 scroll-read-in-combat)
- [ ] **CMBUI-12**: The last (oldest) row of THE FIGHT SO FAR sheet can be tapped to reveal its roll, like every other row. (todo 2026-09-24 last-fight-log-row)
- [ ] **CMBUI-13**: During a fight, every active ability or spell effect is shown on the hero (YOUR LOT) or on the foe it affects. This covers Smoke, Sidestep, Battle Roar, Riposte, Taunt, Shield, Sense Presence and every other timed or conditional effect. Each indicator shows its rounds remaining, gives a description on tap, and clears when the effect ends. (user, 2026-09-24: "Abilities and spells all need to have some sort of active indicator while in combat.")

### HUD & shell (HUD)

- [ ] **HUD-01**: The band-1 identity line reads "Race Sub-class · Lvl N" (e.g. "Dwarf Pickpocket · Lvl 3"), with no parent class and no parentheses. (todo 2026-09-22 hud-band-1)
- [ ] **HUD-02**: Once the hero is dead, only the Oracle, the DEAD/Leaderboards screen and the ☰ menu (Settings, the way back to the title) accept input. Map taps, the other tabs, camp, marks and centre map are inert. (todo 2026-09-22 hud-menu-cannot-open-while-dead)
- [ ] **HUD-03**: From the DEAD screen, the player can open a read-only final character sheet (stats, gear, level) for the run that just ended. (user ruling 2026-09-24)
- [ ] **HUD-04**: The Settings text-size choice (S/M/L) scales every `--mw-font-*` token. (todo 2026-09-23 text-size-setting)
- [ ] **HUD-05**: Dragging or scrolling the settings sheet never changes a volume slider. A deliberate horizontal drag on a slider still sets its volume. (todo 2026-09-24 settings-sheet-drag-scrub)
- [ ] **HUD-06**: A stairs descent fades to black under the stairs sound, then fades in on the new floor, and honours reduced motion. (todo 2026-09-24 stairs-descent-fades)

### Climbs & leaps (CLIMB) — user ruling 2026-09-24, option B

- [ ] **CLIMB-01**: Stepping toward a wall or crevice square first shows a decision card: CLIMB IT / LEAP IT, USE LADDER / USE ROPE (when carried) and TURN BACK. No dice are rolled until the player commits.
- [ ] **CLIMB-02**: TURN BACK leaves the hero where they stood at no cost (no step, time or roll), and no stale retry card ever appears after a crossing. The crevice/wall copy in `mapMarks.js` describes one-and-done.

### Content & voice (VOX)

- [ ] **VOX-04**: Every sub-class and race description names both its advantage(s) and its disadvantage(s), including school gates such as the Summoner's no offense spells before level 3. (todo 2026-09-21 sub-class-descriptions)
- [ ] **VOX-05**: Every in-game line (Oracle, rail cards, fight log, refusal reasons, item and spell text, epitaphs) states clearly what happened, to whom and why. The sarcastic, family-friendly voice stays, but no joke hides the fact. (todo 2026-09-23 narrative-pass)

### Android & Play (DROID)

- [ ] **DROID-01**: The release AAB is built with R8 minify, shrink and obfuscation on AGP 8.13, and ships a deobfuscation mapping. A release-signed build on the Pixel 7 boots, saves and resumes, handles back, and plays sound and haptics as before. (todo 2026-09-23 enable-r8)
- [ ] **DROID-02**: The game draws correctly edge-to-edge on Android 15+, in both gesture and 3-button navigation and with a display cutout, and uses no deprecated window or status-bar APIs Play flags. (backlog 999.9)
- [ ] **DROID-03**: On large screens (tablets, foldables, Chromebooks), the game presents a deliberate, documented layout, such as a letterboxed portrait column, rather than a broken one, and Play's display-configuration warning is addressed or consciously accepted. (backlog 999.9)

### Tooling (TOOL)

- [ ] **TOOL-01**: A fit-tool run resumed from its JSONL log retraces the same walk as the live run, including after an infeasible (`+Infinity`) point. Per-block stdout is appended, not truncated. (todo 2026-09-21 fit-tool-replay)

## Future Requirements

- Global per-sub-class (and/or per-race) Play Games leaderboards, so LINEAGE can rank globally: 24 sub-class boards (6 × 24 = 144 race × sub-class boards is likely past Play Games' per-game cap). Deferred by the user, 2026-09-24.
- AGP 9 upgrade. It is blocked by the Play Games plugin per the Phase 67 spike (`67-AGP9-SPIKE.md`); re-check when the plugin or Capacitor supports it.

## Out of Scope

| Feature | Reason |
|---------|--------|
| UAT row F1 (Compete-OFF cold-boot capture) | This is a user device check in `docs/UAT-v2.0.md`, not code work. Its findings become todos. |
| AGP 9 upgrade | The Phase 67 spike verdict keeps the build on AGP 8.13. |
| First-run tutorial (UX-06) | Deliberately last. It is not a bug fix. |
| Play production launch (STR track) | This milestone is its prerequisite, not the launch itself. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROLL-01 | Phase 72 | Pending |
| ROLL-05 | Phase 73 | Pending |
| ROLL-02 | Phase 74 | Pending |
| ROLL-03 | Phase 74 | Pending |
| RULES-01 | Phase 75 | Pending |
| RULES-02 | Phase 75 | Pending |
| RULES-03 | Phase 75 | Pending |
| RULES-04 | Phase 75 | Pending |
| RULES-05 | Phase 75 | Pending |
| RULES-06 | Phase 75 | Pending |
| RULES-07 | Phase 75 | Pending |
| RULES-08 | Phase 75 | Pending |
| RULES-09 | Phase 75 | Pending |
| RULES-10 | Phase 75 | Pending |
| DARK-01 | Phase 76 | Pending |
| DARK-02 | Phase 76 | Pending |
| SAV-06 | Phase 76 | Pending |
| SAV-07 | Phase 76 | Pending |
| CMBUI-07 | Phase 77 | Pending |
| CMBUI-08 | Phase 77 | Pending |
| CMBUI-09 | Phase 77 | Pending |
| CMBUI-10 | Phase 77 | Pending |
| CMBUI-11 | Phase 77 | Pending |
| CMBUI-12 | Phase 77 | Pending |
| CMBUI-13 | Phase 77 | Pending |
| HUD-01 | Phase 78 | Pending |
| HUD-02 | Phase 78 | Pending |
| HUD-03 | Phase 78 | Pending |
| HUD-04 | Phase 78 | Pending |
| HUD-05 | Phase 78 | Pending |
| HUD-06 | Phase 78 | Pending |
| CLIMB-01 | Phase 78 | Pending |
| CLIMB-02 | Phase 78 | Pending |
| BOARD-09 | Phase 81 | Pending |
| BOARD-10 | Phase 81 | Pending |
| BOARD-11 | Phase 81 | Pending |
| VOX-04 | Phase 79 | Pending |
| ROLL-04 | Phase 79 | Pending |
| VOX-05 | Phase 79 | Pending |
| DROID-01 | Phase 80 | Pending |
| DROID-02 | Phase 80 | Pending |
| DROID-03 | Phase 80 | Pending |
| TOOL-01 | Phase 80 | Pending |
| BOARD-12 | Phase 81 | Pending |
| BOARD-13 | Phase 81 | Pending |
| BOARD-14 | Phase 81 | Pending |

**Coverage:** 46 requirements. Mapped: 46/46 ✓

---
*Requirements defined: 2026-09-24*
*Roadmap created: 2026-09-24 (Phases 72–80)*
