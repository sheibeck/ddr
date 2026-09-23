# Proposed Milestone: "Leaderboards & Share" (death-screen competition)

**Captured:** 2026-09-17 (from user via `/gsd-next` → `/gsd-capture`, mid-v1.5)
**Priority:** Future milestone — after v1.5 (Meaningful Choices). Not blocking any in-flight phase.
**Status:** STARTED 2026-09-23 as **milestone v2.0 Leaderboards** (scoped, briefly parked, then un-parked the same day). The decisions below are settled; requirements come straight from them. Research: skip the milestone-level pass and flag the PGS integration phase for `gsd-phase-researcher`.

## Vision (user's words, lightly organized)

Leaderboards grow **out of the Death screen**. Two rungs:

1. **Beat your own record** — local, offline, personal bests per board.
2. **Everyone** — global boards with a **"you placed X"** line on death, and eventually **compete with friends**, plus a way to **share the game with friends** (invite them in).

Boards are many, not one: **Deepest run**, **Deepest run with fewest moves**, **Deepest run by race/sub-class combination**, **Most deaths**, etc. The end goal is social: friends comparing tombstones.

## Why it matters

- Retention hook for a permadeath roguelike: the death screen is the moment of highest emotion — "one more run" is won or lost there. A "you placed 412th of 9,000 corpses" line in the game's voice converts a loss into a taunt.
- Organic distribution for a paid, no-ads app: the only growth lever we have is a friend saying "beat this."
- Fits the voice: leaderboards of *failure* (Most deaths, Fewest steps before dying) are the sarcastic, self-aware framing the game already lives in.

## Existing footing in the codebase

- **`engine/death.js#buildRunSummary()`** already produces the serializable per-run record every board needs: `name, race, sub, cls, level, sp, floor, day, steps, gold, kills, cause, note, epitaph, when`. "Deepest" = `floor`; "fewest moves" = `steps`; "by race/sub-class" = `race`+`sub`(+`cls`); "Most deaths" = the count.
- **`src/browser/engineAdapter.js`** owns three cross-run keys through the `mzStorage` abstraction (Capacitor Preferences on native): `ddr.graveyard.v1` (last 60 tombstones), `ddr.graveyard.total.v1` (all-time death count, never trimmed), `ddr.best.v1` (best depth). Local boards are mostly a *view* over data we already keep — plus a small "personal bests" record so results aren't lost when the 60-cap trims the graveyard.
- Rules engine is pure/serializable (`S`-state / `act()`), so a run can be **replayed or checksummed** from seed + action log if we ever want plausibility checks. Cheap to add a seed/action-count to the summary now; expensive to retrofit later.
- Death screen + graveyard UI already exist in the shell; the "you placed X" line is a new card in the existing death flow (memory rule: decisions/big updates → card; minor → toast).

## Research: how to do "everyone" and "friends" without breaking the constraints

Constraints in play: **fully offline v1, no accounts, no backend, no third-party SDKs beyond Capacitor plugins, paid upfront, Data Safety = "no data collected".** Global boards necessarily relax "no network" and "no data collected"; the question is *how little*.

### The Google-sanctioned pattern (answers the "online capabilities" thing the user saw in Play)

What Google Play advertises is **Google Play Games Services (PGS) v2** — the platform's built-in leaderboards / achievements / friends / cloud-saves layer. It is the accepted pattern for exactly this on Android:

- **Yes, it requires a Google sign-in — but not a login form.** PGS v2 does *automatic sign-in* using the Google account already on the device: on first launch a small "Welcome back, <Play Games name>" pop-up appears; there is no password, no email, no account creation in our app. If the user has never set up a Play Games profile, Android shows a one-time profile-creation sheet. The user can decline; the game must still work fully offline with no sign-in (PGS's own quality checklist requires this, and it matches our constraints).
- Google's [quality checklist](https://developer.android.com/games/pgs/quality) is explicit that sign-in must be non-blocking and that the game must not gate core play on it.
- Data Safety consequence: once PGS is in, we collect a Player ID + scores → the form flips from "no data collected" to "User IDs / App activity — collected, required for app functionality (leaderboards)", per Google's [PGS data-disclosure guide](https://developers.google.com/games/services/data-collection). Privacy policy page updates accordingly.
- Any alternative that isn't PGS (our own backend, Firebase) needs its **own** identity story — a Google/anonymous sign-in *anyway* — so PGS is the lowest-friction way to get an identity for "you placed X" and the only way to get "friends" for free.

| Option | What it gives | Cost / risk | Verdict |
|---|---|---|---|
| **A. Local-only personal bests** | Rung 1 entirely; zero network; no Data Safety change | No social layer | **Phase 1, always.** Ship regardless of B/C. |
| **B. Google Play Games Services v2** via a Capacitor plugin | Global boards, per-board rank ("you placed X" via the current-player-score call), **Play Games friends** filter (friends-only view via the Friends API), Google's built-in tamper-protection hides suspect scores, native leaderboard UI for free, no server to run or pay for | Auto sign-in as above (opt-out-able). Data Safety change. Adds `play-services-games-v2` (a Play-platform SDK, not ads/analytics). Plugin ecosystem is community-maintained: [`@modbender/capacitor-play-games`](https://github.com/modbender/capacitor-play-games) (Capacitor 8, PGS v2: sign-in/friends/leaderboards/saved games; fork of an abandoned upstream with the Gradle build fixed), [`@openforge/capacitor-game-connect`](https://github.com/openforge/capacitor-game-connect), [`capacitor-google-game-services`](https://github.com/scottcl88/capacitor-google-game-services). Vet maintenance before committing; be ready to vendor/fork. Play Console needs each leaderboard configured (one ID per board; race/sub-class boards multiply this). | **Recommended for Rung 2.** Android-only is exactly our scope; "friends" is solved by Play Games' friend graph. |
| **C. Own minimal backend** (e.g. Cloudflare Worker + D1/KV, anonymous device ID) | Full control: arbitrary boards (race×sub×class grid, weekly boards), custom ranking, voice-driven copy, replay-based anti-cheat using the pure engine | We now run a service (cost, uptime, abuse, GDPR/COPPA posture, privacy rewrite), need our own "friends" concept (codes/links) and still some identity. Biggest scope. | Defer. Only if PGS's fixed leaderboard model can't express the boards we want. |
| **D. Share-out only** (no boards): `@capacitor/share` / Web Share API to post a tombstone image/text + Play Store link | The "share the game with friends" ask; zero network *from the app*; no Data Safety change (the OS share sheet is the user's action) | Not a leaderboard; friends compare screenshots | **Cheap, ship early** — likely alongside Rung 1. A rendered tombstone card (canvas → PNG) with the epitaph + "Think you can do better? [Play link]" is the invite mechanism. |

**Recommendation:** A + D first (offline-safe, no compliance change), then B as its own phase behind an opt-in "Compete" toggle. Keep C as a documented fallback.

### Board design notes
- **Sort direction matters in PGS**: each leaderboard is either higher-is-better or lower-is-better. "Deepest with fewest moves" is two-dimensional → encode as a single score (e.g. `depth * 1_000_000 - steps`, with PGS score formatting hiding the encoding) or make it "Fewest steps to reach depth N" per-depth boards. Decide in planning.
- **Race/sub-class boards**: combinatorial. Prefer a handful of PGS boards keyed by class *or* race and do the full combo grid locally, or generate the board IDs from `content/` tables at build time.
- **Most deaths**: submit `ddr.graveyard.total.v1` (already never trimmed). Good comedic headline board.
- **Voice**: every rank line is a quip ("You placed 3,117th. The 3,116 ahead of you are also dead."). Bank in `content/` like epitaphs.
- **Plausibility**: even with PGS tamper protection, add `seed`, `actions` count, and a cheap hash to `buildRunSummary` now so a later phase can validate client-side before submitting (reject impossible depth/steps ratios).
- **Offline submissions**: deaths happen offline; queue the summary and flush to PGS on next launch with connectivity.

### Compliance checklist (Rung 2 only)
- Data Safety form: "no data collected" → declare PGS Player ID + leaderboard scores.
- Privacy policy page update (currently states on-device only).
- Play Console: enable Play Games Services, link the app (SHA-1 of the Play App Signing key, not the upload key), create leaderboards, publish PGS config; test with the tester allow-list before release.
- Store listing: PGS badge/screenshots optional.

## Candidate scope (for /gsd-new-milestone to break down)
1. **Run record + personal bests** — extend `buildRunSummary` (seed/actions/hash/rules version), add a `ddr.bests.v1` record (per-board personal bests, survives graveyard trim), migration for existing graveyards.
2. **Death-screen boards UI** — "Your records" panel out of the death screen: board picker, new-personal-best card with a quip, Most Deaths counter.
3. **Share** — tombstone card render (canvas → PNG) + `@capacitor/share` with Play Store link; "share the game" affordance on death and in the graveyard.
4. **PGS integration (opt-in)** — plugin choice + auto sign-in flow + submit-on-death (queued offline) + "you placed X" card; friends-only toggle; graceful decline path.
4b. **Account indicator replaces the config cog** (user, 2026-09-17) — the top-bar cog becomes an account/profile chip (Play Games avatar when signed in; a generic "nobody" glyph when not). Tapping it opens a small menu: sign in / sign out, Compete toggle, and the existing settings entry. Signed-out state must look deliberate, not broken — the game is fully playable without it.
5. **Board catalogue** — which global boards exist, score encodings, Play Console setup, generated IDs.
6. **Compliance** — Data Safety, privacy policy, PGS Play Console config, tester round.

## Sequencing / interactions
- After v1.5; independent of Joiners/party except that party runs may need a separate board or a flag in the summary (`party: true`).
- Any balance milestone that changes the depth curve invalidates cross-version comparisons → boards should carry a **rules/season version** (`rules: "1.5"`) from day one so tuning changes don't poison the all-time boards.
- Multiplayer ("play with friends") remains a later milestone; friends-leaderboards is the cheap social layer before that.

## Decisions (user, 2026-09-17)
- **PGS auto sign-in: YES.** Opt-out-able, non-blocking; the game stays fully playable signed-out. Full milestone scope (A + D + B + account chip) is in.
- **Display name on global boards: Play Games profile name.** No adventurer-name composite; the adventurer's name/epitaph lives in the local graveyard and the shared tombstone card.
- **Seasons: YES.** Boards carry a `rules`/season version so we can reset on new versions and balance changes. Implication: PGS leaderboards are created per season (Play Console IDs generated per ruleset; old-season boards left read-only), and the run summary records `rules` from day one. Personal bests stay all-time locally, tagged by season.

## Decisions (user, 2026-09-23 — `/gsd-new-milestone` scoping, then parked)

- **Version: v2.0**, the first networked feature (opt-in only).
- **UX spec: the Claude Design mock** — project `https://claude.ai/design/p/fed8909e-860d-496e-9d31-04dd31f14a3c`, files `Mazeworld Leaderboards.dc.html` (the title → VIEW THE DEAD and in-game DEAD-tab entry points, back to title or dungeon) and `Mazeworld Boards Panel.dc.html` (the panel itself). `ios-frame.jsx` and `support.js` are only preview chrome and the design runtime. Read the mock with the `DesignSync` tool (`get_file`). The panel contains:
  - A LEADERBOARDS header with a scope line and the INTERRED count.
  - A Play Games identity strip ("PLAY GAMES · SIGNED IN") with an ALL / FRIENDS toggle.
  - A horizontally scrolling board rail that keeps the active chip centred, with seven boards:

    | Board | Title | Ranked by |
    |---|---|---|
    | DEEPEST | DEEPEST DESCENT | floor; ties go to fewer squares |
    | LEANEST | DEEPEST, FEWEST STEPS | shows `floor · sq` |
    | LINEAGE | BY RACE & CLASS | race+class, grouped by best floor |
    | LONGEST | LONGEST HELD OUT | days |
    | BUTCHERY | MOST KILLS | kills |
    | PURSE | RICHEST CORPSE | wilmst at death |
    | GRAVEYARD | YOUR GRAVEYARD | your dead only, deepest first, not ranked |

  - For each board: a mark, a title and a rule line in voice.
  - The top ten. Each row has rank, avatar (initials, colour from a handle hash), handle, a YOU/FRIEND tag, name, a `RACE SUB · LVL n` line, a value bar, and value + unit.
  - Your best run pinned under a "NOT IN THE TOP TEN · YOUR BEST RUN" divider when it misses the cut.
  - Tap-to-expand rows showing cause + epitaph and FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips.
  - A standing card ("@you · UNIT", "3RD", "of N interred worldwide / among friends", with a quip).
  - A footnote: "Top ten only. Boards count the dead — living characters are provisional…". The GRAVEYARD footnote reads "Epitaphs are written by the dungeon, not by you. There is no appeal."
- **Mock fields map to canon:** squares → `steps`, WILMST → `gold`, EXP → `sp`, lvl → Roman `level`. The standing UI rulings win: the rail is the feedback surface, the shipped tab set stays, and it says HP, never WP.
- **Global data: Play Games Services v2 + our own custom panel** (not PGS's stock UI, not our own backend):
  - Scores go to PGS.
  - Rows come from top-scores / friends / player-rank calls.
  - Per-row details are packed into the 64-char score tag.
  - Whether LINEAGE is global is a phase-research question: per-combo boards vs. client-side grouping of fetched top-N vs. local-only.
- **In scope:**
  1. Run record + personal bests.
  2. The panel.
  3. PGS integration.
  4. The "you placed X" death card.
  5. The account chip replacing the cog.
  6. The compliance close.
- **Deferred to a later milestone:** tombstone share (`@capacitor/share` + canvas PNG).
- **Carried from 2026-09-17:** PGS auto sign-in (opt-out-able, non-blocking), the Play Games profile name on global boards, seasons from day one.
- **PROJECT.md** holds the full "Planned Milestone: v2.0 Leaderboards" section, including the planned Offline-constraint amendment.

## Sources
- Leaderboards concept + tamper protection: https://developers.google.com/games/services/common/concepts/leaderboards
- Friends API (friends-only rankings): https://developers.google.com/games/services/common/concepts/friends
- PGS Data-safety disclosure guidance: https://developers.google.com/games/services/data-collection
- PGS quality checklist (non-blocking sign-in): https://developer.android.com/games/pgs/quality
- Play Console PGS features overview: https://support.google.com/googleplay/android-developer/answer/2990418
- Capacitor plugins: https://github.com/modbender/capacitor-play-games , https://github.com/openforge/capacitor-game-connect , https://github.com/scottcl88/capacitor-google-game-services
