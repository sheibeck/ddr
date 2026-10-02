# Requirements: Delve, Die, Repeat — v2.3 Truth in Advertising

**Defined:** 2026-09-29
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Every item, race, sub-class, spell and skill has the systems it needs and does exactly what its text says, and the open player reports (GitHub `player-report` #3, #4, #5, #6, #8, #9) and pending todos are fixed.

**Decided by the user (2026-09-29):**

- Backlog 999.15 (review every skill and spell) and 999.16 (itemization pass) are promoted into this milestone.
- Both pending store todos are in: d10 rations per store, and the depth-7 buy-out retune.
- The Wizard always starts with a direct-damage level-1 spell, because it refuses to swing while a spell is left to cast ("not having a direct damage spell makes the class very not-fun"). This applies to the **Wizard sub only**. The other Magic User subs keep today's best-effort guarantee.
- Report #9 wins: DEPTH ties go to the **most** steps, which reverses v2.1 BOARD-17 ("deepest, then fewest steps").
- No domain research this milestone. The audits are the work.

**Gates:**

- **Greenfield, no dual paths.** Engine rule changes apply to every run. Declare and regenerate only the fixtures a change moves, the bot plays the new rules, and old saves get a tolerant load only. `test/parity/prototype-master.js.txt` is never edited.
- **Rng discipline.** A new roll comes from a derived stream (`makeRng(hash(seed, …))`) so floor generation and existing draws don't reorder. Any exception is declared along with the fixtures it moves.
- **Every new event gets an EVENT_NARRATION entry** in the house voice.
- **Bots run once, at the milestone end** (ECON-11, TUNE-10), never per phase.
- **Audit outputs are durable.** Each audit table lives in `docs/` with one row per entry (text / engine / canon / verdict), and each fixed row is pinned by a test that extends the `authored-ranges` / `roll-sign-consistency` style.
- **Shipped-client compatibility.** Any server-side change (BOARD-28) is checked against 2.2.0 / vc12 clients before it goes live.
- **Patch notes are agreed with the user before the release build.**

## v2.3 Requirements

### Itemization (ITEM) — backlog 999.16

- [x] **ITEM-01**: Every item (treasure, armour, weapon, cloak, jewellery, staff, wand, potion, scroll) is in an audit table comparing its text, engine behaviour and canon. Each mismatch is fixed or recorded as a deliberate ruling, and each fix is pinned by a test.
- [x] **ITEM-02**: When the player takes off, drops, sells or swaps a used worn item, or the item is destroyed, its activated benefit ends at once with a narrated line. Timed effects carry their source item and slot, which survives save, load and relaunch. Joiners' gear is covered too, so a player can't stack benefits from items they're no longer wearing.
- [x] **ITEM-03**: A heal-over-time system exists. Once used, the Cloak of Regeneration heals every 10 steps for 30 steps (three ticks), with a narrated line for each tick.
- [x] **ITEM-04**: The Cloak of Strength stops foe critical hits on its wearer (hero or Joiner) and no longer stops the wearer's own crits. Its activation gets its own chip and name, distinct from the Fighter's Braced.
- [x] **ITEM-05**: The Enlarge potion is worth drinking: its damage bonus outweighs the easier-to-hit cost, in line with a Troll's size damage (report #6).
- [x] **ITEM-06**: Every system the item audit finds missing is built or re-ruled and listed in the audit. This includes party-wide item effects such as the Crystal Staff.
- [x] **ITEM-07**: Joiners can use the items they carry, and a foe's hit on a Joiner goes through the Joiner's armour soak, just like the hero (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).

### Races & sub-classes (IDENT)

- [x] **IDENT-11**: All 6 races are audited. Each race trait and note is checked against engine behaviour and canon, and each mismatch is fixed or ruled deliberate, with a test.
- [x] **IDENT-12**: All 24 sub-classes are audited. Each trait in `content/identity.js`, each blurb and each sub-class note states every advantage and drawback the engine applies, and matches it. Mismatches are fixed with tests.
- [x] **IDENT-13**: A Wizard always starts with at least one direct-damage level-1 spell it can cast on day one, drawn from the full level-1 pool rather than only the spells it rolled. This is pinned across a wide seed sweep.
- [x] **IDENT-14**: An Illusionist who steps on a teleport chooses where it lands, as the sub-class text promises (report #3).
- [x] **IDENT-15**: A Cleric cannot cast offensive spells (they gain more hit points), and always starts with the level-1 Heal spell (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-16**: The Master of Arms gets a real drawback in place of "no clean withdrawal in round one", agreed with the user (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-17**: The Bard sings a random song from a song table once every 50 squares; each song has the effect of a random offense or defense spell of the Bard's level or lower. The dim-witted-foes drawback is stated plainly (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-18**: A Pickpocket who gains an item from a chest or a monster gains one extra item as well; the shop drawback stays (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-19**: A Cutthroat who descends with a Joiner rolls a d10; on a 1, that Joiner dies (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-20**: Fridgian frenzy: each swing, a 4–6 on a d6 gives a second swing; no armour, thick hide soaks 2; the "never wastes itself on a corpse" line is removed (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **IDENT-21**: Troll store prices are doubled; the text states 75 starting hit points and +11 damage (the Large +2 included). The Wilmsry drawback is reworded: you refuse to take Magic User Joiners on (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).

### Spells (SPELL) — backlog 999.15

- [x] **SPELL-08**: Every spell is in an audit table covering its to-hit roll (if any), damage dice, multipliers, duration, resist checks, school gates, and backfire and fumble odds. Its text, the Grimoire, its chips and the foe card all agree with the engine and canon, stated in roll-high form.
- [x] **SPELL-09**: The Strength spell does what its text says (report #8). The damage bonus, its duration ("till tomorrow" vs "until you make camp") and the hp it grants all match between the text and the engine.
- [x] **SPELL-10**: The Special and Illusion schools get spells, drawn first from the rulebook's page-50 spell list, combat-effective or useful in the maze (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **SPELL-11**: Doze and Stun are swapped: Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing foe; Stun holds one foe for d4 rounds and a hit does not end it (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **SPELL-12**: Spell reworks: Petrify kills one foe outright (no loot, resist still allowed, no floor-12 cap); Stupidity drops a foe's intelligence to 1 for the fight; Blind limits a foe to its maximum roll and no crits (no floor-12 cap); Ice is an area d10 with a chance to freeze each target 1d4 rounds; Strength gives +d10 damage rolled on every damage roll, no hp; Lesser Summon and Phantom Host are removed, and the Summoner casts the level-2 Summon from level 1 (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).

### Skills & abilities (ABIL) — backlog 999.15

- [x] **ABIL-06**: Every skill and ability is in an audit table covering its cooldown or once-per-fight rule, auto-hit or forced crit, bonus terms, and who can use it (hero, Joiners). Its text and the engine agree.
- [x] **ABIL-07**: Pommel Strike gains the player more than it costs (report #4). Using it doesn't trade the hero's attack for the foe's lost turn.

### Plain-language text & parley (TEXT, PARLEY) — user, 2026-09-30

- [x] **TEXT-01**: Rules text reads plainly: "faces" wording becomes "+/− to hit" (hard caps name the d20 range), "squares of enemies" becomes how many foes an area effect hits, and "can talk to" becomes "can always parley with". Each audit phase (89, 90, 91) applies it to its own rows (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).
- [x] **PARLEY-01**: A successful parley gives experience and loot (recommended: full experience and the fight's normal spoils), and the game explains to the player what a parley is and what it pays (user, 2026-09-30; `.planning/notes/v2.3-user-rulings-2026-09-30.md`).

### Party bug (PARTY)

- [x] **PARTY-11**: When a foe hits a Joiner, the Joiner loses that hp, and YOUR LOT, the Hero Company and every other party display show the loss (report #5: "Cave Bear turns on Zell Bonecrack for 11 hp", still 30/30).

### Leaderboard (BOARD)

- [x] **BOARD-29**: Each leaderboard row's expanded detail states the hero's race and sub-class. A long press on a row opens a menu with "filter by this race", "filter by this sub-class", "filter by both" and cancel. Picking one sets the RACE and/or SUB-CLASS filter and reloads the board (user todo 2026-09-29).
- [x] **BOARD-30**: The RANK BY bottom sheet, and every other leaderboard sheet, fits on screen above the system navigation bar. The last option's description (WILMST) is fully visible at the smallest supported screen and the largest text scale (user todo 2026-09-29).
- [x] **BOARD-28**: On the DEPTH board, runs that reached the same depth rank by the most steps walked (report #9). Existing server runs rank correctly under the new rule, and submissions from shipped 2.2.0 clients still rank correctly.
- [x] **BOARD-31**: The board names every player by their Google Play Games name instead of a rolled @handle, so friends recognize each other and every name is unique. The server accepts a run only under the Play Games identity of the account posting it (verified, not trusted from the client) (user, 2026-09-30).
- [x] **BOARD-32**: A handle is never re-rolled: RE-ROLL HANDLE and the handle rewrite path are gone. A player's existing board runs (posted under a 2.2.0 rolled handle) show under their Play Games name once they sign in on the updated app (user, 2026-09-30).
- [x] **BOARD-33**: Compete needs Play Games sign-in (every player already has a Play Games profile, user 2026-09-30); shipped 2.2.0 clients' runs are refused until they update (user, 2026-09-30). The live rules deploy ships with the release build; the store listing, Data safety form and privacy policy state what is shown publicly.

### Store & economy (STORE, ECON)

- [x] **STORE-04**: Each store stocks d10 rations, rolled when it opens from a derived stream. The player can buy them one at a time until the stock runs out, and the store shows how many are left. The fair bot gets a ration target: it tops up to about three days of its party's ration upkeep when it can afford to (user, 2026-09-29). The DAYS-farm hoarder buys one ration at a time up to its cap. A ration buy at the pack's ration cap is refused before any gold moves.
- [ ] **ECON-11**: A milestone-end readout (`tools/tune-economy.mjs`) measures, for each depth on floors 1–12, the gold a hero holds on reaching a store against that store's total stock price, and breaks gold income down by source.
- [ ] **ECON-12**: Store prices and gold income are retuned so that at depth 7 a typical hero can afford about a third to a half of a store. The exact target is confirmed with the user from the ECON-11 readout.

### Value review (VALUE) — user request 2026-09-29, Phase 91.1

- [x] **VALUE-01**: A value ledger covers every race, sub-class and ability. For each one, every system its text names exists and works in the engine, or the text is updated to match.
- [x] **VALUE-02**: The ledger surfaces every system that adds little or no value to play, every very low bonus and every effect that lasts only a single round, each with a recommendation (buff, lengthen, rework, cut, or a new system).
- [x] **VALUE-03**: Every once-per-combat skill and ability is re-reviewed, with a recommendation on whether it deserves more than one use per combat.
- [x] **VALUE-04**: The user rules on each flagged entry before anything is built. Every approved change is built with its text updated and a pinning test, and any fixture it moves is declared.

### Balance close (TUNE)

- [ ] **TUNE-10**: After every rule change in the milestone lands, one milestone-end bot pass confirms the fair-bot p50 death stays at floor 3–4 and re-measures starvation deaths after STORE-04. Any drift is recorded and retuned with the user.

## Future Requirements

- The day-one direct-damage guarantee for Magic User subs other than the Wizard. They keep the Phase 40 best-effort guarantee for now (user, 2026-09-29).
- Walking the older Pixel 7 UAT batches (v1.5–v2.2) happens over the user's play sessions, not as milestone work.

## Out of Scope

- **Networked multiplayer / new party features.** This milestone only fixes the party display bug.
- **New content** (new items, spells, races or sub-classes) unless the audit shows an existing entry needs a missing system to work. That system is ITEM-06. Exceptions by user ruling 2026-09-30: new Special and Illusion spells (SPELL-10) and the Bard song table (IDENT-17).
- **The first-run tutorial (UX-06) and the Play production launch (STR-*).** These are still the v1.0 launch tail.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ITEM-01 | Phase 89 | Complete |
| ITEM-02 | Phase 88 | Complete |
| ITEM-03 | Phase 88 | Complete |
| ITEM-04 | Phase 88 | Complete |
| ITEM-05 | Phase 89 | Complete |
| ITEM-06 | Phase 89 | Complete |
| IDENT-11 | Phase 91 | Complete |
| IDENT-12 | Phase 91 | Complete |
| IDENT-13 | Phase 91 | Complete |
| IDENT-14 | Phase 91 | Complete |
| SPELL-08 | Phase 90 | Complete |
| SPELL-09 | Phase 90 | Complete |
| ABIL-06 | Phase 90 | Complete |
| ABIL-07 | Phase 90 | Complete |
| PARTY-11 | Phase 87 | Complete |
| BOARD-28 | Phase 87 | Complete |
| BOARD-29 | Phase 87 | Complete |
| BOARD-30 | Phase 87 | Complete |
| STORE-04 | Phase 87 | Complete |
| ECON-11 | Phase 92 | Pending |
| ECON-12 | Phase 92 | Pending |
| VALUE-01 | Phase 91.1 | Complete |
| VALUE-02 | Phase 91.1 | Complete |
| VALUE-03 | Phase 91.1 | Complete |
| VALUE-04 | Phase 91.1 | Complete |
| ITEM-07 | Phase 89 | Complete |
| TEXT-01 | Phases 89, 90, 91 | Complete |
| SPELL-10 | Phase 90 | Complete |
| SPELL-11 | Phase 90 | Complete |
| SPELL-12 | Phase 90 | Complete |
| IDENT-15 | Phase 91 | Complete |
| IDENT-16 | Phase 91 | Complete |
| IDENT-17 | Phase 91 | Complete |
| IDENT-18 | Phase 91 | Complete |
| IDENT-19 | Phase 91 | Complete |
| IDENT-20 | Phase 91 | Complete |
| IDENT-21 | Phase 91 | Complete |
| PARLEY-01 | Phase 91 | Complete |
| TUNE-10 | Phase 92 | Pending |
| BOARD-31 | Phase 91.2 | Complete |
| BOARD-32 | Phase 91.2 | Complete |
| BOARD-33 | Phase 91.2 | Complete |

**Coverage:** 29 requirements, 29 mapped to Phases 87–92 (87: 5, 88: 3, 89: 3, 90: 4, 91: 4, 91.1: 4, 91.2: 3, 92: 3). No orphans, no duplicates.
