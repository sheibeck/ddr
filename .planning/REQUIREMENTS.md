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

### Roll direction & modifier honesty (ROLL) — user, 2026-09-24

Context: the engine rolls UNDER a need on a d20 (a caster hits on 1–3), so a bonus must WIDEN the range and a penalty must NARROW it. On device, a dropped weapon read "-2 to hit". The user read that as worse, but it may have been better. User ruling: players should read + as good and − as bad, and see rolls as bigger-is-better. The engine keeps rolling under; the flip is presentation-only (`21 − roll` vs `21 − need`, identical odds, no fixture moves).

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
- [ ] **ROLL-05**: Every roll event the display flips carries the die size and the roll. `dieN` is added to `struck` and the foe-swing events, and roll/target to soak, climb/leap, affliction-cure and wake events. These are additive event fields with no new rng draws.
- [ ] **ROLL-02**: Every roll the player sees reads bigger-is-better. The fight log, dice reveals, rail cards and Oracle show the roll and target so a higher roll is better (on a d20 a caster needs 18–20, a thief 17–20, a fighter 16–20; smaller dice flip as `(N+1)−roll`). This applies to every roll type consistently, including initiative. The engine's roll-under math is unchanged.
- [ ] **ROLL-03**: Every displayed modifier is signed from the player's point of view: "+2 to hit" always means better odds, and "−2" always means worse. This covers item, loot, store and find comparisons, the hero sheet, spell and ability text, condition chips and the fight log's need breakdown. The same modifier never shows opposite signs on two surfaces.
- [ ] **ROLL-04**: The rules text, `content/` descriptions and narration that encode roll direction ("1–N", "need N", "natural 1", "−3 on to-hit") are rewritten to the bigger-is-better reading, and a doc-synced test pins that no roll-under phrasing remains in player-facing strings.

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

**Coverage:** 38 requirements. Mapped: 0 (the roadmapper fills this).

---
*Requirements defined: 2026-09-24*
