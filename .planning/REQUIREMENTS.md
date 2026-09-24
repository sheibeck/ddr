# Requirements: Delve, Die, Repeat — v2.0 Leaderboards

**Defined:** 2026-09-23
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.

**Milestone goal:** The DEAD tab becomes the user's "Mazeworld Leaderboards" panel. It covers your own dead fully offline, and players signed in to Google Play Games Services v2 also get global and friends boards, a "you placed X" line on death, and an account chip where the settings cog was.

**Mock stance (same as the v1.4 combat/map and v1.9 gear imports):** the Claude Design mock (project `fed8909e-860d-496e-9d31-04dd31f14a3c`, files `Mazeworld Leaderboards.dc.html` and `Mazeworld Boards Panel.dc.html`; read with the `DesignSync` tool) is the UX and visual spec only. Its iOS frame is preview chrome. Its toy data and field names map to shipped canon: squares → `steps`, WILMST → `gold`, EXP → `sp`, lvl → Roman `level`. The standing rulings win: the rail is the one feedback surface, the shipped tab set stays (DEAD keeps its slot), and player text says HP, never WP.

**Standing constraints:** the Engine Gate holds (pure, deterministic engine; zero new rng draws touch floor generation; `test/parity/prototype-master.js.txt` is never edited; any moved fixture is declared). Signed out or with Compete off, the game makes zero network calls. No ads or analytics SDK, and no backend of our own. Full decision record: `.planning/proposed-milestone-leaderboards.md`.

## v2.0 Requirements

### Run Record & Personal Bests (offline)

- [x] **RUN-01**: Every death records a run summary (`buildRunSummary`) that also carries a `rules`/season version, the run seed, an action count and a cheap integrity hash. It adds zero new rng draws, and the new fields are left out of the parity comparables.
- [x] **RUN-02**: A durable `ddr.bests.v1` record (Capacitor Preferences plus the localStorage mirror, through `mzStorage`) holds the player's best run per board. It is tagged by season, kept all-time, and survives the 60-tombstone graveyard trim.
- [x] **RUN-03**: Existing graveyards, the `ddr.best.v1` / `ddr.graveyard.total.v1` keys and old saves load without errors, and the bests record is seeded from the tombstones already present.
- [x] **RUN-04**: A new personal best on any board is announced in the death flow, in voice (a card when it is a big update, per the card-vs-toast ruling).

### Leaderboards Panel (presentation, built to the mock)

- [x] **BOARD-01**: The panel replaces the DEAD screen. It opens from the in-game DEAD tab and from the title screen's VIEW THE DEAD, and its back button returns to wherever it was opened from (title or dungeon).
- [x] **BOARD-02**: The panel header shows LEADERBOARDS, a scope line and the INTERRED count. Below it sit a Play Games identity strip and an ALL / FRIENDS toggle.
- [x] **BOARD-03**: A horizontally scrolling board rail keeps the active chip centred and carries seven boards: DEEPEST (floor; ties go to fewer squares), LEANEST (deepest, fewest steps; shows `floor · sq`), LINEAGE (by race & class), LONGEST (days), BUTCHERY (kills), PURSE (wilmst at death) and GRAVEYARD (your own dead, deepest first, not ranked). Each board has its own mark, title and rule line in voice.
- [x] **BOARD-04**: Each board lists the top ten. A row shows rank, avatar (initials, colour from a handle hash), handle, a YOU/FRIEND tag, the adventurer's name, a `RACE SUB · LVL n` line, a value bar, and value + unit, all from canon fields.
- [x] **BOARD-05**: When the player's best run misses the top ten, it is pinned below a "NOT IN THE TOP TEN · YOUR BEST RUN" divider.
- [x] **BOARD-06**: Tapping a row expands it to show the cause, the epitaph and FLOOR / DAYS / SQUARES / KILLS / EXP / WILMST chips.
- [x] **BOARD-07**: Each board ends with a standing card ("your place · of N", interred worldwide or among friends, with a quip) and a per-board footnote in voice (the GRAVEYARD footnote: "Epitaphs are written by the dungeon, not by you. There is no appeal.").
- [x] **BOARD-08**: Signed out, offline or with Compete off, the whole panel runs on local data (personal bests and the graveyard), and the ALL / FRIENDS views show a deliberate signed-out state, not a broken one. No network call is made.

### Google Play Games Services v2 (opt-in, non-blocking)

- [x] **PGS-01**: A Capacitor 8-compatible PGS v2 plugin is chosen (researched: `@modbender/capacitor-play-games` vs `@openforge/capacitor-game-connect` vs `capacitor-google-game-services` vs vendoring or forking one) and wired into the Android build. It adds no ads or analytics SDK.
- [x] **PGS-02**: PGS auto sign-in runs at launch without blocking play. Declining, having no Play Games profile, or a sign-in failure leaves the game fully playable.
- [x] **PGS-03**: Each death of a signed-in, Compete-on player submits one score per global board to the current season's leaderboard IDs, with the row's details (adventurer name, race/sub/level, and the rest of what the panel shows) packed into the 64-char score tag.
- [x] **PGS-04**: A death while offline or signed-out-but-competing queues its submissions durably. They flush once connectivity and sign-in return, and no score is ever submitted twice.
- [x] **PGS-05**: The panel's ALL and FRIENDS views are fed by PGS top scores, the friends collection and the player's own rank. The global form of LINEAGE (per-combo boards, client-side grouping of fetched top scores, or local-only) is settled by the phase research.
- [x] **PGS-06**: Leaderboard IDs are keyed per board per season. Bumping the season points new submissions at the new IDs, while old-season boards stay readable and are never written again.

### "You Placed X"

- [x] **PLACE-01**: After a run's scores are submitted, the death flow shows the player's rank as a quip in voice from a `content/` bank ("You placed 3,117th. The 3,116 ahead of you are also dead.").
- [x] **PLACE-02**: A run submitted from the offline queue reports its placement on the next successful flush. A signed-out or Compete-off run shows no rank line and no error.

### Account Chip

- [x] **ACCT-01**: The top-bar settings cog becomes an account chip: the Play Games avatar when signed in, a deliberate "nobody" glyph when signed out.
- [x] **ACCT-02**: Tapping the chip opens a menu with sign in / sign out, a Compete toggle (off means no submissions and no network calls) and the existing Settings entry.

### Compliance & Close

- [x] **COMPLY-01**: The privacy-policy page is updated to describe the opt-in PGS Player ID and scores, and states that nothing else leaves the device.
- [x] **COMPLY-02**: The Data Safety answers are drafted in the repo (Player ID and app activity collected, required for app functionality, not shared, and only when signed in to Play Games) and match the shipped build's SDK and dependency audit.
- [x] **COMPLY-03**: A Play Console PGS setup runbook covers enabling PGS, linking the SHA-1 of the Play App Signing key, creating the leaderboard IDs per board per season, publishing the config and the tester allow-list. The user performs the console steps, and the IDs land in the build's config.
- [x] **COMPLY-04**: A signed AAB with PGS goes to the testing track, and the milestone's Pixel 7 batch is written as `docs/UAT-v2.0.md` (sign-in, decline, offline queue and flush, the panel on every board, the "you placed X" card, the account chip, airplane mode).

### Device-Round Polish (Pixel 7 feedback on the 2.0.0 build, 2026-09-24)

- [x] **POLISH-01**: The title theme (`sfx/theme.mp3`) loops from launch on the title screen (no tap needed on device) and continues unbroken through the character roller and title-opened panels/sheets; it fades out on reaching the map, respects the Sound setting and stops in the background.
- [x] **POLISH-02**: The ☰ button is the Play Games profile icon (initials avatar when signed in, plain ☰ otherwise) and its dropdown carries the account rows (identity, Sign in / Stop competing, Compete); no separate account chip in the HUD band.
- [x] **POLISH-03**: The ☰ opens on every in-game screen (map, combat and other encounters, the Oracle, the tabs, while dead); Save & quit and a two-tap-armed Abandon this character (New Character when dead) live in it, and the HERO tab's Delve panel is gone.
- [x] **POLISH-04**: LINEAGE has a race + sub-class selector defaulting to the active hero's lineage and shows the top 10 runs for the selected lineage, locally and (as a filtered sample) globally.
- [ ] **POLISH-05**: Every sound effect has a per-clip level in one tunable table (death quieter, steps louder), the title theme is louder, and Settings shows MASTER / MUSIC / EFFECTS volume sliders under Sound, visible only while Sound is on, persisted and applied live.
- [ ] **POLISH-06**: Opening an item from the Gear tab shows the same full stat set the store shows for that item, built from one shared formatter.
- [ ] **POLISH-07**: While a combat round plays out, the actions are visibly unavailable, taps never queue, and a tap skips to the round's result; with several foes the latest round summary stays visible above the actions without being intrusive.
- [ ] **POLISH-08**: Long-pressing an enemy raises one dismissible rail card with its details, never also firing the normal tap; TalkBack users get an equivalent Details action.
- [ ] **POLISH-09**: Every condition an ability, spell or item puts on an enemy (Hamstring, Mark and the rest) shows as a condition chip on that enemy while it lasts, from one table, with a test that fails if a new foe effect has no chip.
- [ ] **POLISH-10**: The UI tap sound plays only when a button is really pressed: never when a scroll or pan starts on a button, never for a disabled or locked button, and never for a long press.
- [ ] **POLISH-11**: Tapping a status chit during combat shows that effect's description on a combat-legal card, and each foe condition's description is readable from the long-press details card.
- [ ] **POLISH-12**: Every step onto a water square plays the water walking sound, not just the step that first enters the water; stepping back onto dry ground plays the ordinary step.

## Future Requirements

- **Tombstone share**: `@capacitor/share` plus a canvas-rendered PNG tombstone with the Play Store link, on death and in the graveyard.
- **PGS achievements** and **Most Deaths** as a global board.
- **Plausibility checks**: replay- or ratio-based validation of a run summary before it is submitted, using the RUN-01 seed, action count and hash.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Our own backend (Cloudflare Worker / Firebase) | PGS covers global and friends boards with no server to run; documented fallback only |
| PGS cloud saves | Out per the Accounts/cloud-save constraint; PGS is for leaderboards only |
| Own account / login forms | PGS uses the device's Google account; no login form of ours |
| PGS stock leaderboard UI | The custom panel built to the mock is the UI |
| Networked multiplayer | A later milestone; friends boards are the cheap social layer first |
| First-run tutorial (UX-06) and Play production launch | Stay on the v1.0 launch tail |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUN-01 | Phase 65 | Complete |
| RUN-02 | Phase 65 | Complete |
| RUN-03 | Phase 65 | Complete |
| RUN-04 | Phase 65 | Complete |
| BOARD-01 | Phase 66 | Complete |
| BOARD-02 | Phase 66 | Complete |
| BOARD-03 | Phase 66 | Complete |
| BOARD-04 | Phase 66 | Complete |
| BOARD-05 | Phase 66 | Complete |
| BOARD-06 | Phase 66 | Complete |
| BOARD-07 | Phase 66 | Complete |
| BOARD-08 | Phase 66 | Complete |
| PGS-01 | Phase 67 | Complete |
| PGS-02 | Phase 67 | Complete |
| ACCT-01 | Phase 67 | Complete |
| ACCT-02 | Phase 67 | Complete |
| PGS-03 | Phase 68 | Complete |
| PGS-04 | Phase 68 | Complete |
| PGS-05 | Phase 68 | Complete |
| PGS-06 | Phase 68 | Complete |
| PLACE-01 | Phase 68 | Complete |
| PLACE-02 | Phase 68 | Complete |
| COMPLY-01 | Phase 69 | Complete |
| COMPLY-02 | Phase 69 | Complete |
| COMPLY-03 | Phase 69 | Complete |
| COMPLY-04 | Phase 69 | Complete |
| POLISH-01 | Phase 70 | Complete |
| POLISH-02 | Phase 70 | Complete |
| POLISH-03 | Phase 70 | Complete |
| POLISH-04 | Phase 70 | Complete |
| POLISH-05 | Phase 71 | Pending |
| POLISH-06 | Phase 71 | Pending |
| POLISH-07 | Phase 71 | Pending |
| POLISH-08 | Phase 71 | Pending |
| POLISH-09 | Phase 71 | Pending |
| POLISH-10 | Phase 71 | Pending |
| POLISH-11 | Phase 71 | Pending |
| POLISH-12 | Phase 71 | Pending |

**Coverage:**

- v2.0 requirements: 38 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-23*
*Last updated: 2026-09-23 after v2.0 roadmap creation (Phases 65–69)*
