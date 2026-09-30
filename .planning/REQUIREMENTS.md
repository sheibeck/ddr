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

- [ ] **ITEM-01**: Every item (treasure, armour, weapon, cloak, jewellery, staff, wand, potion, scroll) is in an audit table comparing its text, engine behaviour and canon. Each mismatch is fixed or recorded as a deliberate ruling, and each fix is pinned by a test.
- [ ] **ITEM-02**: When the player takes off, drops, sells or swaps a used worn item, or the item is destroyed, its activated benefit ends at once with a narrated line. Timed effects carry their source item and slot, which survives save, load and relaunch. Joiners' gear is covered too, so a player can't stack benefits from items they're no longer wearing.
- [ ] **ITEM-03**: A heal-over-time system exists. Once used, the Cloak of Regeneration heals every 10 steps for 30 steps (three ticks), with a narrated line for each tick.
- [ ] **ITEM-04**: The Cloak of Strength stops foe critical hits on its wearer (hero or Joiner) and no longer stops the wearer's own crits. Its activation gets its own chip and name, distinct from the Fighter's Braced.
- [ ] **ITEM-05**: The Enlarge potion is worth drinking: its damage bonus outweighs the easier-to-hit cost, in line with a Troll's size damage (report #6).
- [ ] **ITEM-06**: Every system the item audit finds missing is built or re-ruled and listed in the audit. This includes party-wide item effects such as the Crystal Staff.

### Races & sub-classes (IDENT)

- [ ] **IDENT-11**: All 6 races are audited. Each race trait and note is checked against engine behaviour and canon, and each mismatch is fixed or ruled deliberate, with a test.
- [ ] **IDENT-12**: All 24 sub-classes are audited. Each trait in `content/identity.js`, each blurb and each sub-class note states every advantage and drawback the engine applies, and matches it. Mismatches are fixed with tests.
- [ ] **IDENT-13**: A Wizard always starts with at least one direct-damage level-1 spell it can cast on day one, drawn from the full level-1 pool rather than only the spells it rolled. This is pinned across a wide seed sweep.
- [ ] **IDENT-14**: An Illusionist who steps on a teleport chooses where it lands, as the sub-class text promises (report #3).

### Spells (SPELL) — backlog 999.15

- [ ] **SPELL-08**: Every spell is in an audit table covering its to-hit roll (if any), damage dice, multipliers, duration, resist checks, school gates, and backfire and fumble odds. Its text, the Grimoire, its chips and the foe card all agree with the engine and canon, stated in roll-high form.
- [ ] **SPELL-09**: The Strength spell does what its text says (report #8). The damage bonus, its duration ("till tomorrow" vs "until you make camp") and the hp it grants all match between the text and the engine.

### Skills & abilities (ABIL) — backlog 999.15

- [ ] **ABIL-06**: Every skill and ability is in an audit table covering its cooldown or once-per-fight rule, auto-hit or forced crit, bonus terms, and who can use it (hero, Joiners). Its text and the engine agree.
- [ ] **ABIL-07**: Pommel Strike gains the player more than it costs (report #4). Using it doesn't trade the hero's attack for the foe's lost turn.

### Party bug (PARTY)

- [ ] **PARTY-11**: When a foe hits a Joiner, the Joiner loses that hp, and YOUR LOT, the Hero Company and every other party display show the loss (report #5: "Cave Bear turns on Zell Bonecrack for 11 hp", still 30/30).

### Leaderboard (BOARD)

- [ ] **BOARD-28**: On the DEPTH board, runs that reached the same depth rank by the most steps walked (report #9). Existing server runs rank correctly under the new rule, and submissions from shipped 2.2.0 clients still rank correctly.

### Store & economy (STORE, ECON)

- [ ] **STORE-04**: Each store stocks d10 rations, rolled when it opens from a derived stream. The player can buy them one at a time until the stock runs out, and the store shows how many are left. The bot buys them the new way.
- [ ] **ECON-11**: A milestone-end readout (`tools/tune-economy.mjs`) measures, for each depth on floors 1–12, the gold a hero holds on reaching a store against that store's total stock price, and breaks gold income down by source.
- [ ] **ECON-12**: Store prices and gold income are retuned so that at depth 7 a typical hero can afford about a third to a half of a store. The exact target is confirmed with the user from the ECON-11 readout.

### Balance close (TUNE)

- [ ] **TUNE-10**: After every rule change in the milestone lands, one milestone-end bot pass confirms the fair-bot p50 death stays at floor 3–4 and re-measures starvation deaths after STORE-04. Any drift is recorded and retuned with the user.

## Future Requirements

- The day-one direct-damage guarantee for Magic User subs other than the Wizard. They keep the Phase 40 best-effort guarantee for now (user, 2026-09-29).
- Walking the older Pixel 7 UAT batches (v1.5–v2.2) happens over the user's play sessions, not as milestone work.

## Out of Scope

- **Networked multiplayer / new party features.** This milestone only fixes the party display bug.
- **New content** (new items, spells, races or sub-classes) unless the audit shows an existing entry needs a missing system to work. That system is ITEM-06.
- **The first-run tutorial (UX-06) and the Play production launch (STR-*).** These are still the v1.0 launch tail.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ITEM-01 | — | Pending |
| ITEM-02 | — | Pending |
| ITEM-03 | — | Pending |
| ITEM-04 | — | Pending |
| ITEM-05 | — | Pending |
| ITEM-06 | — | Pending |
| IDENT-11 | — | Pending |
| IDENT-12 | — | Pending |
| IDENT-13 | — | Pending |
| IDENT-14 | — | Pending |
| SPELL-08 | — | Pending |
| SPELL-09 | — | Pending |
| ABIL-06 | — | Pending |
| ABIL-07 | — | Pending |
| PARTY-11 | — | Pending |
| BOARD-28 | — | Pending |
| STORE-04 | — | Pending |
| ECON-11 | — | Pending |
| ECON-12 | — | Pending |
| TUNE-10 | — | Pending |

**Coverage:** 20 requirements, 0 mapped (the roadmap fills this in)
