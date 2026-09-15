# Requirements: Delve, Die, Repeat — v1.2 Class Pass & Mass Playtest

**Defined:** 2026-09-14
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown. Every adventurer the tables deal must be fun to play, even when doomed.
**Milestone goal:** Every class, sub-class, and race has one solid good and one solid bad and can always act; a class-aware playtest harness ranks all 144 combinations; the deferred difficulty retune (v1.1 TUNE-04, verdict tune-again) lands on the corrected player power. Balance is NOT the goal — fun is. Combinations may be unequal; none may be helpless.

**Grounding (2026-09-14, code read + 400-seed bot baseline):** Magic Users die at mean depth 2.1 vs 3.2 (Thief) / 3.1 (Fighter) and average 1.5 kills a run; the bottom five sub-classes are all Magic Users (Summoner 1.3, Wizard 1.7, Apprentice 1.7, Warlock 1.8, Illusionist 2.1). Root causes in the engine: the Wizard melee refusal counts charges not attack spells (`engine/combat.js` ~L337); Summon is a level-2 spell so a level-1 Summoner cannot summon; an Illusionist strikes on a d20 until level 3 with no damage spell; Freeze is an instant kill on hit, so a Magic User's whole run hinges on whether the grimoire rolled one attack spell. Seven sub-classes have no implemented bad (Knight, Master of Arms, Court Mage, Pickpocket, Cutthroat, Ninja, Bard) and Guard has no good; their flavor text promises mechanics the engine never got.

## v1.2 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Fidelity & Determinism (FID)

The non-negotiable engine gate (see `ROADMAP.md` preamble), made explicit for the parts this milestone touches: chargen and combat RNG.

- [x] **FID-06**: Any change to character generation (guaranteed attack spell, sub-class kit tweaks) is a DELIBERATE divergence: the affected chargen-parity fixtures regenerate narrowly, each with a before/after note and rationale; every fixture NOT touched by the change stays byte-identical; the rng-consumption order for Fighters and Thieves is unchanged
- [x] **FID-07**: Every new serialized field (e.g., a Bard "marked" flag, a Guard stance counter) is carved out in all three `*Comparable()` functions and round-trips through save/load; every new event type gets an `EVENT_NARRATION` entry; the voice safety scan stays green

### Identity Pass (IDENT)

One solid good, one solid bad, for every sub-class and race — verified in code, not in prose.

- [x] **IDENT-01**: A Wizard refuses to strike only while an attack spell is castable RIGHT NOW (charges remain AND a known, level-legal, school-legal attack spell is in the grimoire); a Wizard with no castable attack spell fights with the staff, and the refusal names its reason when it fires
- [x] **IDENT-02**: Every freshly rolled Magic User has at least one level-1, day-one-castable ATTACK spell in the grimoire (attack = a spell that damages, disables, or kills a foe: thrown/status/stun/weaken kinds), drawn from the sub-class's own legal schools — so no Magic User is ever dealt a grimoire that cannot hurt anything
- [x] **IDENT-03**: A Summoner can cast Summon from level 1 (Summon treated as a level-1 spell for the Summoner sub-class, or an equivalent Summoner-only grant), keeping the doubled strength, the out-of-combat pending ally, and the one-in-eight backfire as the bad
- [x] **IDENT-04**: An Illusionist has a level-1 illusion-school way to WIN a fight, not only stall it (an illusion attack/pressure spell or Phantom Host usable at level 1), while keeping the d20 strike die until level 3 as the bad
- [x] **IDENT-05**: Each sub-class currently missing a bad has one implemented, taken from its own flavor text where the text promises one — Knight (big things come straight for you), Ninja (never speaks: cannot parley), Bard (stupid creatures come for you first), Master of Arms (attacks without question) — and designed fresh where it does not (Court Mage, Pickpocket, Cutthroat); each bad is felt in play, not cosmetic
- [x] **IDENT-06**: Guard gains a real good (from "the profession is standing there" — e.g., a defensive stance: never surprised, or damage soaked) and Court Mage's good is made felt (the boredom kill rate or an always-available talk-down), so no sub-class is penalties-only
- [x] **IDENT-07**: Flavor-only restrictions are either enforced in the engine or reworded out of the flavor — Woodsman (no mail/plate/shield), Pilfer (no magic items that don't heal), Cloaker (a bad that is actually a bad) — so every promise on the sheet is true
- [x] **IDENT-08**: An identity-contract test table asserts, for all 24 sub-classes and the 5 non-Human races, that the named good AND the named bad each fire under a forced scenario; Human is asserted neutral (deliberate: the control race, user decision 2026-09-14)
- [x] **IDENT-09**: `SUB_NOTE` / `RACE_NOTE` flavor text matches the implemented mechanics for every sub-class and race — sarcastic, family-friendly, and now truthful
- [x] **IDENT-10**: Level-1 Thief dagger damage (d6/2 → 2–4 a hit against 25-wp beasts) gets a deliberate ruling — change or keep — recorded with rationale in the class-pass ledger, so the class-wide tax is a decision and not an accident

### Feature Feedback (FEED)

Folded in from the "Feedback, Feel & Polish" proposal §A/§B (user decision 2026-09-14: overlap only). Nothing a class, race, or sub-class does happens silently.

- [x] **FEED-01**: Every class/sub-class/racial feature that fires (frenzy, Warlock boost, Knight/Con Artist talk-down, boredom kill, backstab, Ninja opener, Cutthroat crit, Pickpocket take, Pilfer disarm, potion duplication, Soldier double heal, Samurai never-first, and every new v1.2 good/bad) produces an Oracle line AND an on-screen toast that says what happened and why
- [x] **FEED-02**: Every action a class/sub-class/race BLOCKS (Wizard won't strike, Samurai won't flee, Ninja won't parley, Acrobat can't equip, Pilfer can't read, Fridgian can't wear armor, Woodsman can't wear mail) tells the player what was refused and why, in voice
- [x] **FEED-03**: Enemy hits toast RED and read "X hits you (N)"; player hits and misses stay green and read "You hit / You miss X"; the two are never confusable
- [x] **FEED-04**: A multi-attack foe's round aggregates into one toast — "X hits you 2 of 4 times (N)" — instead of one toast per swing
- [x] **FEED-05**: Early-combat misses draw from a varied, voice-safe corpus of fledgling-adventurer call-outs instead of repeating "Miss", so brutal first floors read as narrative
- [x] **FEED-06**: Every spell, scroll, and item effect in EITHER direction (yours on them, theirs on you) is legible as an event + toast, including the resisted/failed/nothing-to-target outcomes

### Device Feedback Batch (DFB) — Phase 25.1, inserted 2026-09-15 from on-device play

User feedback after the Phase 25 build: the narrative is right, the delivery needs tuning; plus three party/camp rules.

- [x] **DFB-01**: The dismissible "Move on" card appears ONLY for decisions and big updates — encounter start (Fight! gate), a Joiner offer, a find to keep/leave, death, a new floor, a level-up, and the end-of-fight report; every other move-path event (traps, climbs/leaps/falls, chests, gold/rations, darkness, afflictions, camp results, teleports) is toast-only and the toast carries the Oracle's narrative sentence (dice detail stripped), not a terse label
- [x] **DFB-02**: Toasts linger long enough to read a stack of four — lifetime roughly doubled (cap near 9 s), extended a little per toast already visible, tap to dismiss, reduced-motion respected, no layout shift
- [x] **DFB-03**: The Oracle panel fills the available screen height, opens scrolled to the most recent line, and shows a "newer" indicator whenever the reader has scrolled away from it (tap returns to the newest line)
- [ ] **DFB-04**: Accepting a Joiner while the party is full replaces the existing member, who leaves with a snarky exit line (Oracle + toast); the offer card names who would leave; declining keeps the roster; zero rng, no new serialized field
- [ ] **DFB-05**: Party members fight according to their class — Magic Users cast their best castable attack spell with their own daily charges (staff-swing when they can't), Thieves open with a backstab crit and use their weapon, Fighters strike with their real weapon damage — with narrated, toasted ally events; new rng draws only behind the existing party gate so solo parity stays byte-identical
- [ ] **DFB-06**: Make Camp keeps refusing without enough food, but the refusal states the numbers ("you eat N a night, you have M") and the camp gate counts every live party member's appetite exactly as the automatic new day does; the automatic new day is unchanged

### Class-Aware Playtest Harness (HARN)

Dev-only, zero-dependency, never shipped — extends `tools/lib/tuning-bot.mjs`.

- [x] **HARN-01**: The bot can force class, sub-class, and race for a run (`--cls`, `--sub`, `--race`) through a documented, harness-only chargen seam that leaves every other rng draw in order, so a forced Troll Summoner and a naturally rolled one are the same character
- [x] **HARN-02**: The bot's policy is sub-class-aware: casts Summon before or at combat start, sings as a Bard when the song is ready, opens with Mirror Self as an Illusionist, uses non-thrown combat spells (Doze/Stun/Weaken/Acid/Shield/Heal) at sane thresholds, parleys when the sub-class or race makes it available, and still drinks/camps/flees as before — so casters are no longer under-measured
- [x] **HARN-03**: `tools/tune-classes.mjs` runs every sub-class × race combination (144) for N seeds each and prints a ranked matrix (mean/p50 death depth, reach ≥5/≥10, kills, level reached, top death causes) as text and `--json`, reproducible from the same seed list
- [x] **HARN-04**: The harness can start a run at a chosen depth (`--start-depth`) using the same seam the Settings dev toggle uses, so deep-floor lethality (the TUNE-04 "depth 20 is instant death" finding) is measurable by the bot, not only by hand

### Mass Playtest (PLAY)

- [x] **PLAY-01**: A BEFORE matrix is captured with the new harness against the pre-identity-pass engine (commit-pinned) and committed to the ledger, so every identity change has a paired baseline
- [ ] **PLAY-02**: An AFTER matrix is captured on the post-pass engine; over- and under-performers are ranked by sub-class and by race with a written "fun band" verdict per row (fine / too strong / too weak / cannot act), and every "cannot act" row is zero
- [ ] **PLAY-03**: `docs/CLASS-PASS.md` ledger: per sub-class/race good+bad table, before/after numbers, every ruling (IDENT-05/06/07/10) with rationale, and the remaining outliers listed as candidates for the next milestone

### Delve-to-Death Retune (TUNE)

Continues v1.1's TUNE-01..04 (TUNE-04 verdict: tune-again).

- [ ] **TUNE-05**: A delve-to-death target band is agreed with the user before tuning and recorded in `docs/DIFFICULTY-RETUNE.md` — framed around **depth 20 as THE target** (user decision 2026-09-14): reaching 20 is a **unicorn run** — rare, celebrated, not the expectation ("competent player" cannot be quantified in a game this RNG-heavy) — so the band fixes a median death depth well below 20, a small reach-20 rate, how survivable a level-5 character is AT 20, and "floors gained past 20" as the wrap-up measure. Past 20 the curve is NOT dialed back and NO mechanic forces death — the run ends naturally on the existing curve; the game is not tuned for infinite depth
- [ ] **TUNE-06**: `engine/difficulty.js` is retuned on the post-pass engine so the class matrix and the start-at-depth readout land inside the agreed band, with the BEFORE/AFTER transcripts appended to the ledger under identical bot parameters
- [ ] **TUNE-07**: A human DR round on the Pixel 7 (start-at-depth 20/35/50 plus a natural run) re-issues the TUNE-04 verdict; the milestone closes only on "tuned" or a user-recorded deferral

## v2 Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Feedback, Feel & Polish remainder (v1.3 candidate — `.planning/proposed-milestone-feedback-feel-polish.md` §C–§G)

- **INV-01**: Armor durability carried on the item (fixes the re-equip full-repair exploit)
- **INV-02**: One bag-cap gate every pickup/buy/kit path routes through, with feedback when full
- **INV-03**: Bigger bags obtainable as depth-appropriate treasure
- **INV-04**: Cloak of Armor legible and real; G16 "squares of opponents" + Amulet of Stone ends combat
- **UIF-01**: Gear panel Use/Drop side by side, drop confirm; map recenter on panel return; default zoom midpoint; tutorial on/off setting; Make Camp into the Marks/Centre row; handedness option removed
- **CMB-01**: No initiative or enemy strike before Fight! is pressed
- **CMB-02**: "Not ready yet" audit — every usable spell/item/gear piece provably usable in its proper circumstances, each refusal explained
- **CMB-03**: Combat potions drinkable from the Gear page; Shield chip (pool + rounds); round-based effects expire outside combat
- **STORE-01**: Store stock random and floor-appropriate

### Identity extras

- **IDENT-V2-01**: Human race gains its own good and bad (user decision 2026-09-14: keep Human neutral for now)
- **IDENT-V2-02**: Sub-class-specific joiner synergies (e.g., a Bard's song inspires the party)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Making every class/race combination equally strong | Explicit user direction: unequal is fine, unfun is not. Fun band, not balance band |
| New classes, sub-classes, or races | The 1994 tables are canon; this pass makes the existing 24 × 6 work |
| Player-chosen class/race | "THE TABLES DECIDE" is the game's identity |
| First-run tutorial (UX-06) | Deliberately last, after the UI settles (v1.0 carry-forward) |
| Google Play production launch (STR-01..04, STR-06) | User-driven, separate tail; repo-side audit still owed |
| Bot as a pass/fail CI gate | The harness is a tuning proxy; human DR play is the UAT |
| iOS, multiplayer networking, accounts, ads/IAP | Unchanged project-level exclusions |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FID-06 | Phase 23 | Complete |
| FID-07 | Phase 24 | Complete |
| IDENT-01 | Phase 23 | Complete |
| IDENT-02 | Phase 23 | Complete |
| IDENT-03 | Phase 23 | Complete |
| IDENT-04 | Phase 23 | Complete |
| IDENT-05 | Phase 24 | Complete |
| IDENT-06 | Phase 24 | Complete |
| IDENT-07 | Phase 24 | Complete |
| IDENT-08 | Phase 24 | Complete |
| IDENT-09 | Phase 24 | Complete |
| IDENT-10 | Phase 24 | Complete |
| FEED-01 | Phase 25 | Complete |
| FEED-02 | Phase 25 | Complete |
| FEED-03 | Phase 25 | Complete |
| FEED-04 | Phase 25 | Complete |
| FEED-05 | Phase 25 | Complete |
| FEED-06 | Phase 25 | Complete |
| DFB-01 | Phase 25.1 | Complete |
| DFB-02 | Phase 25.1 | Complete |
| DFB-03 | Phase 25.1 | Complete |
| DFB-04 | Phase 25.1 | Pending |
| DFB-05 | Phase 25.1 | Pending |
| DFB-06 | Phase 25.1 | Pending |
| HARN-01 | Phase 22 | Complete |
| HARN-02 | Phase 22 | Complete |
| HARN-03 | Phase 22 | Complete |
| HARN-04 | Phase 22 | Complete |
| PLAY-01 | Phase 22 | Complete |
| PLAY-02 | Phase 26 | Pending |
| PLAY-03 | Phase 26 | Pending |
| TUNE-05 | Phase 27 | Pending |
| TUNE-06 | Phase 27 | Pending |
| TUNE-07 | Phase 27 | Pending |

**Coverage:**

- v1.2 requirements: 34 total (28 + 6 DFB inserted 2026-09-15)
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-14*
*Last updated: 2026-09-14 after roadmap creation (Phases 22–27, 100% coverage)*
