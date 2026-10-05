# Requirements: Delve, Die, Repeat — v2.5 Achievements

**Defined:** 2026-10-05
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** players earn 77 sarcastic achievements in the game, mirrored to Play Games for XP with Compete ON, and the milestone ships the Play Console import zip that creates them.

Sources: backlog 999.12 (Achievements track, with the user's rulings through 2026-10-05) and 999.18 (screenshots, the deferred v2.4 Phase 98) in ROADMAP.md; the user's milestone answers on 2026-10-05 (ship the 81, cut to 77 at the Phase 98 discuss when the user dropped Disposable Help because summons cannot die; screenshots as the last phase; every count starts at zero on 2.5.0; Compete ON syncs to Play Games, no separate switch); Google's import format at developer.android.com/games/pgs/integrate-achievements (checked 2026-10-05). SHOTS-01..03 keep their v2.4 ids (deferred there, carried here); PGS continues from v2.0's PGS-06 and COMP from COMP-04.

## v2.5 Requirements

### Catalog (999.12)

- [x] **ACH-01**: One content catalog defines all 77 achievements from the user's list (backlog 999.12: depth, Unicorn!, Fully Dressed, Naked Ambition, Teetotaler, Frequent Flier, Read the Label, six body counts, six races, three classes, Tourist, Special Snowflake, Survivor, Hoarder, Party Animal, Human Shields, Solid Miscalculation, Gravity Wins, Terminal Condition, Empty Calories, Silver Tongue, Chicken, Fatal Misstep, Still Standing). Each entry has a stable id, name, description, trigger, threshold, tier, points, initial state (Hidden or Revealed), type (standard or incremental) and its built icon in `achievements/` (`manifest.json`)
- [x] **ACH-02**: Every name and description is in the house voice (sarcastic, family-friendly), passes the voice safety scan and the narrative review, and fits Play's import rules: no commas, name at most 100 characters and unique (each tier I–IV has its own name), description at most 500 characters
- [x] **ACH-03**: Points follow a scheme ruled in discuss-phase: each 5–200 in steps of 5, the total within Play's 2,000-point game cap with the headroom the user rules for later achievements; incremental steps are 1–10,000
- [x] **ACH-04**: Hints chain the achievements: an obvious one's line points at a hidden one (Fully Dressed hints at Naked Ambition, per the user's design principle). Which achievements start Hidden, and which unlock reveals each one, are ruled before the import and fixed in the catalog
- [x] **ACH-05**: Each achievement's initial state and type are final before the zip is built, since Play cannot change either once published, and a published achievement cannot be deleted

### Tracking (999.12)

- [ ] **TRACK-01**: The engine reports every fact an achievement needs (for example a kill's monster group, a Joiner's death, a healing potion drunk, a trap survived, an ailment that leaves the hero on 1 HP, the equipment worn at the first step) as additive event fields or events with zero rng draws; no parity fixture moves, or any moved one is declared
- [ ] **TRACK-02**: A lifetime stats record lives in `@capacitor/preferences` (the `storage.js` pattern), separate from the run save, loads tolerantly, and survives relaunch, app update and a crash mid-run; every count starts at zero on 2.5.0 (no credit from the graveyard or bests history)
- [ ] **TRACK-03**: Each achievement unlocks the moment its condition is met: lifetime counters across all runs (deaths, kills by group, Joiners, fallen Joiners, parleys, traps survived, the Terminal Condition flags); single-run conditions within one run (depth reached, each race and class to floor 5, Survivor days, Hoarder coin held at once, Chicken's 10 flees, Naked Ambition, Teetotaler, Fully Dressed); death achievements on the death that earns them; Tourist across all delves started
- [ ] **TRACK-04**: Unlocks are permanent and idempotent: an unlock fires once, never re-locks, and is saved when earned, not only when the run ends
- [ ] **TRACK-05**: The tracker is a shell layer that folds engine events and state into the lifetime stats, pure and headless-testable; the tuning bot does not earn achievements

### In-game surfacing (999.12)

- [ ] **AUI-01**: An unlock shows as a toast, not a card, carrying the achievement's name and its sarcastic line, and several unlocks at once stay readable under the toast rules (linger, stack, tap to dismiss)
- [ ] **AUI-02**: An achievements list opened from ☰ shows every achievement with its icon: unlocked (with when), locked (greyed), progress on counters (for example 37 / 50), and hidden ones as a teaser until they unlock or their hint reveals them
- [ ] **AUI-03**: The list works in every layout class (phone portrait, landscape, tablet) with back, TalkBack and reduced motion, in the shell's sheet conventions
- [ ] **AUI-04**: With Compete ON and signed in, ☰ also opens Play Games' own achievements screen

### Play Games mirror (999.12)

- [ ] **PGS-07**: With Compete ON and signed in, each unlock, each incremental progress and each reveal reaches Play Games through the in-repo `PlayIdentity` plugin, so the player sees Play's unlock popup and earns XP
- [ ] **PGS-08**: Unlocks, progress and reveals earned with Compete OFF, signed out or offline wait in a durable queue and sync the next time Compete is ON and the player is signed in; re-sending never double-counts
- [ ] **PGS-09**: Compete OFF never starts the Play Games SDK and makes zero network calls (the Phase 92.1 privacy gate holds), and a Play Games failure never blocks or breaks the in-game achievements
- [ ] **PGS-10**: The game reads Play's achievement IDs from the resource file Play Console generates after the import ("Get resources"), keyed by catalog id, never hard-coded in the JS; until that file is in the build, Play sync is a no-op and the in-game achievements still work
- [ ] **PGS-11**: After the user imports the zip and hands back the IDs file, every catalog id resolves to a Play ID (a test proves full coverage), and a signed-in Pixel 7 check (the toast plus Play's unlock popup) joins the milestone-close device checklist

### Play Console import zip (999.12)

- [ ] **ZIP-01**: A repo tool builds the Play Console import zip from the catalog and the `achievements/play/` icons: `AchievementsMetadata.csv` (no header row; Name, Description, Incremental value, Steps Needed, Initial State, Points, List Order), `AchievementsIconsMappings.csv` (no header row; Name, icon file) and the 77 PNG icons, flat with unique file names; the list order matches the in-game list
- [ ] **ZIP-02**: A test checks the zip against Google's rules: no subdirectories; only CSV and PNG files; each file under 1 MB; at most 403 files; 7 values per metadata row and 2 per mapping row; `True`/`False` and `Hidden`/`Revealed` spelt exactly; steps only on incremental rows; the ACH-02 and ACH-03 limits; every row has an icon that exists, and every icon is exactly 512 × 512
- [ ] **ZIP-03**: `docs/ACHIEVEMENTS.md` covers rebuilding the zip, importing it in Play Console (Grow users > Play Games Services > Setup and management > Achievements > Import achievements, then Save as draft), testing with tester accounts, publishing, and fetching the IDs file with Get resources

### Screenshots (999.18)

- [ ] **SHOTS-01**: An agreed shot list is captured on the current build for the phone, the 7" tablet, the 10" tablet and, where it fits, landscape, with no dev chip or debug UI in frame; the final flavour text, the ability states and the achievements list are visible
- [ ] **SHOTS-02**: `store-listing/screenshots/` (`phone/`, `tablet-7in/`, `tablet-10in/`) holds the new shots exported to Play's size rules, and `store-listing/LISTING.md` describes them
- [ ] **SHOTS-03**: The darktierstudios.com shots and `featured.webp` are replaced as webp with updated alt text in the `ddr-shots` section, and the site is deployed with the new images live (the deploy is the user's call)

### Compliance

- [ ] **COMP-05**: The Data safety answers in `store-listing/LISTING.md` and the privacy pages are checked for achievement progress sent to Play Games with Compete ON, and updated where needed

## Future Requirements

- **The brainstorm achievements** (999.12: Well-Rounded, Friendly Fire, Read the Fine Print, Poor Aim, You Can't Take It With You, Saving It For Later, Speedrun, Bomb Squad, Get Off My Lawn, Cartographer, the social disasters, the collectors, the faerie pair, Just a Flesh Wound): each needs new art and a later import; the points headroom left under the 2,000 cap is for them
- **Play Console upload automation** (the Developer API service account in `docs/RELEASING.md`) stays future

## Out of Scope

| Feature | Reason |
|---------|--------|
| Credit for runs before 2.5.0 | User, 2026-10-05: everyone starts at zero; kills by group were never recorded anyway |
| A separate Play Games switch for achievements | User, 2026-10-05: Compete ON is the one switch; two privacy switches would need explaining |
| Achievement icons beyond the 77 shipped | The user's 81 were drawn and composited; Disposable Help's 4 left with it at the Phase 98 discuss (its source picture is kept); new art belongs to the future brainstorm set |
| Disposable Help (fallen summons) | User, 2026-10-05 (Phase 98 discuss): summons cannot die in the engine, so the achievement is dropped; revisit only if summons ever become killable |
| The headless bot earning achievements | The bot measures difficulty; achievements are a player-facing shell layer |
| Creating achievements through the Games Configuration API | The user's ruling (2026-10-05) is a Play Console import file; the zip is the deliverable |
| Leaderboard or board-server changes | Achievements never touch the Firebase board or its rules |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACH-01 | Phase 98 | Complete |
| ACH-02 | Phase 98 | Complete |
| ACH-03 | Phase 98 | Complete |
| ACH-04 | Phase 98 | Complete |
| ACH-05 | Phase 98 | Complete |
| TRACK-01 | Phase 99 | Pending |
| TRACK-02 | Phase 99 | Pending |
| TRACK-03 | Phase 99 | Pending |
| TRACK-04 | Phase 99 | Pending |
| TRACK-05 | Phase 99 | Pending |
| AUI-01 | Phase 100 | Pending |
| AUI-02 | Phase 100 | Pending |
| AUI-03 | Phase 100 | Pending |
| AUI-04 | Phase 101 | Pending |
| PGS-07 | Phase 101 | Pending |
| PGS-08 | Phase 101 | Pending |
| PGS-09 | Phase 101 | Pending |
| PGS-10 | Phase 101 | Pending |
| PGS-11 | Phase 101 | Pending |
| ZIP-01 | Phase 98 | Pending |
| ZIP-02 | Phase 98 | Pending |
| ZIP-03 | Phase 98 | Pending |
| SHOTS-01 | Phase 102 | Pending |
| SHOTS-02 | Phase 102 | Pending |
| SHOTS-03 | Phase 102 | Pending |
| COMP-05 | Phase 101 | Pending |

**Coverage:**

- v2.5 requirements: 26 total
- Mapped to phases: 26 ✓
- Unmapped: 0

By phase: Phase 98 has 8 (ACH-01..05, ZIP-01..03), Phase 99 has 5 (TRACK-01..05), Phase 100 has 3 (AUI-01..03), Phase 101 has 7 (PGS-07..11, AUI-04, COMP-05), Phase 102 has 3 (SHOTS-01..03).

---
*Requirements defined: 2026-10-05*
*Last updated: 2026-10-05 after roadmap creation (traceability mapped to Phases 98–102)*
