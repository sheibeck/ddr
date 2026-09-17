# Requirements: Delve, Die, Repeat — v1.5 Meaningful Choices (Spells, Gear & Abilities)

**Defined:** 2026-09-17
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Every spell, item, skill, phobia and piece of gear does something you can feel and choose between — no budget picks, no dead phobias, no silent causes — with the gear/target/ration UI made honest to match.

**Engine gate (applies to every requirement):** engine pure/deterministic; parity byte-identical for every existing fixture, bot and old save (new rng draws only after all existing draws and only behind a feature condition false for every current fixture — the `storeRoll` run-flag precedent for anything in `genFloor`); every new serialized field carved out of all three `*Comparable()` fns; every new event type gets an `EVENT_NARRATION` + toast-table entry; deliberate canon divergences declared per phase with rationale; `test/parity/prototype-master.js.txt` never edited; family-friendly sarcasm on every new line (safety scan + a human tone read).

## v1.5 Requirements

### Spells (SPELL)

- [ ] **SPELL-01**: Player choosing a combat spell faces a real situational choice — offense spells are differentiated by niche (single-target burst, damage-over-time, multi-target, control with a scope/duration axis, defensive), not a strict best-damage-per-level ladder; each spell's grimoire text states its niche in one line
- [ ] **SPELL-02**: Every utility spell (heal/ward/might/mirror/senses/foresee/regen/summon/turn/gate) has a measurable in-game effect the player can observe when cast, and none is a dead pick
- [ ] **SPELL-03**: Spells can be added, removed or renamed for balance and fun, with every change recorded as a deliberate canon divergence (before/after table) and the day-one grimoire rolls for every caster sub-class still valid
- [ ] **SPELL-04**: Every Magic User sub-class starts with at least one spell that deals damage (Summoner/Illusionist keep their Phase 23 level-1 overrides and additionally qualify)
- [ ] **SPELL-05**: Detect Magic is renamed to say what it does (a map reveal) and reveals the floor for a stated number of steps, after which cells it revealed re-fog to their pre-spell state; cells the player walked and saw normally stay seen (re-fog provenance ratified as a Key Decision)
- [ ] **SPELL-06**: An active Shield/ward (pool + rounds remaining) is visible on the Hero sheet and as a condition chip on the map HUD, not only in combat
- [ ] **SPELL-07**: A scroll scribed into the grimoire is castable immediately when the caster's spell level qualifies, with a refusal that names the level needed when it does not

### Melee abilities (ABIL)

- [ ] **ABIL-01**: Fighters and Thieves have activated combat abilities with cooldowns in rounds, shown and used from the ABILITIES submenu of the combat grid, so combat is more than pressing STRIKE
- [ ] **ABIL-02**: A chosen subset of existing passive Special Skills becomes activated abilities (the conversion list decided in the phase's discussion against the good/bad identity contract); unconverted skills stay passive and every sub-class keeps one good and one bad
- [ ] **ABIL-03**: A class-flavored active-ability pool is rolled (never chosen) — one ability at level 1 and one more at each skill level — and the roll is narrated with the ability's effect
- [ ] **ABIL-04**: Each ability's effect, cooldown and readiness are legible in the submenu ("ready" / "N rounds"), and using one on cooldown is a named refusal in the fight log
- [ ] **ABIL-05**: Party Joiners of melee classes use their own abilities by the same class-driven policy Joiners already use to fight

### Gear & magic items (GEAR)

- [ ] **GEAR-01**: Weapons and armor are reworked (add/remove/rebalance dice, cost, class gating, depth availability) so store and loot present meaningful trade-offs rather than a single best pick per class, recorded as a before/after ledger
- [ ] **GEAR-02**: Every activatable magic item (cloaks, staves, rings/jewelry, potions with a duration) follows one model: use → effect for X rounds or squares → cooldown for Y squares; the effect and cooldown remaining are shown on the item and as a condition chip
- [x] **GEAR-03**: Player can wear only one item per slot type (ring, bracelet/anklet, amulet/pendant, helm/gauntlet, cloak, staff) and cannot benefit from two of the same type; equipping into an occupied slot swaps with an explicit choice
- [x] **GEAR-04**: Old saves with two items of one type are reconciled on load without a crash or a silent loss — the extra goes to the bag with a narrated line
- [ ] **GEAR-05**: One-shot tools exist as loot and store stock — at least rope (cross a pit/crevice without a climb roll), ladder (pass a climbable wall), torch (lights a dark region for N squares) — each consumed on use and offered at the matching decision point (e.g. the CLIMB IT rail card)

### Terrain, darkness & phobias (TERR)

- [ ] **TERR-01**: Floors can contain water regions — multi-square pools drawn blue on the map, generated behind a run flag so every existing fixture, bot and old save is unaffected
- [ ] **TERR-02**: Stepping onto a water square costs 2 moves; the HUD square counter and every squares-based timer reflect the cost consistently (ratified as a Key Decision)
- [ ] **TERR-03**: While standing on a dark square without Night Vision or a light effect, the map shows only the 3×3 squares around the party; explored squares outside it are fogged and return when the player leaves the dark (a render filter — the engine's `seen` memory is unchanged)
- [ ] **TERR-04**: Every phobia has a real trigger: Bodies of water on entering water, Darkness on entering an unlit square (as well as in dark combat), Heights at a crevice/gorge climb, Being trapped at a dead end, Death near death, and the six type-matched combat phobias as today
- [ ] **TERR-05**: Terrain phobias fire once on fresh entry into a region (not every step inside it) and apply the Phase 31 Afraid penalty — never a lost action — with the trigger named in the rail line

### Flee (FLEE)

- [ ] **FLEE-01**: Base flee success is lowered from 50 % to a tuned value, the Thief edge is kept, and small class/race modifiers apply (recorded as a canon divergence with a before/after table)
- [ ] **FLEE-02**: The fight log shows the flee roll, modifiers and the need on every attempt, and a failed flee still hands the foes their swing as today

### Combat targeting (TGT)

- [x] **TGT-01**: A dead foe can never be the target — the target auto-switches to the next living foe the moment a foe dies, before the player's next action
- [x] **TGT-02**: Tapping a dead foe card does nothing (guarded), and the auto-switch cannot race a guarded tap into a mis-target

### Cutthroat & Joiners (CUT / JOIN)

- [x] **CUT-01**: A Cutthroat can accept a Joiner (the Phase 24 refusal is reversed as a declared canon change); the sub-class blurb is rewritten to match
- [x] **CUT-02**: Each time a Cutthroat with a Joiner descends there is a small, stated chance the Joiner is murdered, narrated with its own event type and several sarcastic lines so it reads as a joke, not a bug; the blurb states the odds
- [x] **JOIN-01**: Player can dismiss a Joiner from the Hero tab's Company panel, which shows the Joiner's sheet (class/sub/race, HP, weapon, "eats N a rest"); dismissal needs a confirmation tap, and the departing Joiner gets a sarcastic parting line of their own (a new event type, no rng)

### Clarity (CLAR)

- [ ] **CLAR-01**: Every Oracle and rail line that costs the player something names its cause from the event payload (e.g. "Being trapped: four walls and one door you already used. −4 hp"), routed through EVENT_NARRATION with the coverage guards green
- [ ] **CLAR-02**: Every loot offer — encounter-dot finds, victory loot, store rows — shows the "(usable by …)" class gating when the item is class-restricted
- [ ] **CLAR-03**: The Hero sheet states how many rations the party eats per rest (hero by race/class + each Joiner, and the total) and how many are carried, matching the Make Camp refusal arithmetic
- [ ] **CLAR-05**: The race/class ration rules are audited against the prototype and rulebook (today: 1 a night, Troll 2, Heft halves wp upkeep only) and recorded in a ledger; every rule is implemented and named in the rest narration, and each Joiner shows "eats N a rest" on the offer card and the Company panel
- [ ] **CLAR-04**: The Gear tab is two panels — ON YOU (Worn: armor, cloak, jewelry · Carried: weapon, staff, shield) and BAG — and the bag-full drop prompt lists bag items only

### Balance (BAL)

- [x] **BAL-01**: A BEFORE class-matrix pin (`tools/tune-classes.mjs`) is captured before any new player power lands, and the tuning bot is taught to use the new abilities, spells, items and tools before the AFTER run
- [ ] **BAL-02**: One consolidated AFTER matrix diff covers abilities + gear + spells together, with pick-rates for the new spells/abilities and verdicts recorded in `docs/CLASS-PASS.md`; out-of-band rows are tuned or accepted with a written reason against the depth-20 target

## Future Requirements (deferred)

- **UX-06** first-run tutorial (built last, after the UI settles — now after v1.5's Gear/Hero changes)
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout)
- **TUNE-06/07** human DR round of the difficulty retune and the tier-3/5 roster decision (`docs/DIFFICULTY-RETUNE.md`)
- Store screen restyle to the dark vocabulary; dice-mode setting; haptics polish
- Climb dice payload (`roll`/`need` on the four climb events) — post-UAT quick task from v1.4

## Out of Scope

| Feature | Reason |
|---------|--------|
| Player-chosen abilities/spells/perks (pick-one screens) | Conflicts with the "100 %-dice-rolled, the tables decide" identity Key Decision — everything is rolled |
| Procedural/affix magic items, enchanting | Wrong session length; hand-authored 8-per-category tables stay legible because they are small |
| Whole-map always-on fog of war | Darkness view is limited to dark squares; the explored map stays the player's memory elsewhere |
| A universal hazard-bypass tool | Tools are 1:1 with a hazard (rope/pit, ladder/wall, torch/dark) to keep the choice meaningful |
| On-grid AoE telegraph/preview UI | Narration is the telegraph; no new combat screens |
| Adaptive foe AI reacting to builds | Not this milestone; foe abilities stay data-driven |
| Networked multiplayer, accounts, iOS, ads/IAP | Standing project exclusions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BAL-01 | Phase 36 | Complete |
| TGT-01 | Phase 36 | Complete |
| TGT-02 | Phase 36 | Complete |
| CUT-01 | Phase 36 | Complete |
| CUT-02 | Phase 36 | Complete |
| JOIN-01 | Phase 36 | Complete |
| GEAR-03 | Phase 37 | Complete |
| GEAR-04 | Phase 37 | Complete |
| ABIL-01 | Phase 38 | Pending |
| ABIL-02 | Phase 38 | Pending |
| ABIL-03 | Phase 38 | Pending |
| ABIL-04 | Phase 38 | Pending |
| ABIL-05 | Phase 38 | Pending |
| GEAR-01 | Phase 39 | Pending |
| GEAR-02 | Phase 39 | Pending |
| GEAR-05 | Phase 39 | Pending |
| SPELL-01 | Phase 40 | Pending |
| SPELL-02 | Phase 40 | Pending |
| SPELL-03 | Phase 40 | Pending |
| SPELL-04 | Phase 40 | Pending |
| SPELL-05 | Phase 40 | Pending |
| SPELL-06 | Phase 40 | Pending |
| SPELL-07 | Phase 40 | Pending |
| TERR-01 | Phase 41 | Pending |
| TERR-02 | Phase 41 | Pending |
| TERR-03 | Phase 41 | Pending |
| TERR-04 | Phase 41 | Pending |
| TERR-05 | Phase 41 | Pending |
| FLEE-01 | Phase 42 | Pending |
| FLEE-02 | Phase 42 | Pending |
| BAL-02 | Phase 42 | Pending |
| CLAR-01 | Phase 43 | Pending |
| CLAR-02 | Phase 43 | Pending |
| CLAR-03 | Phase 43 | Pending |
| CLAR-04 | Phase 43 | Pending |
| CLAR-05 | Phase 43 | Pending |

**Coverage:**

- v1.5 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-17*
*Last updated: 2026-09-17 — roadmap created, 35/35 requirements mapped to Phases 36–43*
