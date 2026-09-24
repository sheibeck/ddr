# Phase 67: Play Games Integration & Account Chip - Context

**Gathered:** 2026-09-23
**Status:** Ready for research, then planning (the ROADMAP flags this phase `Research: yes`)
**Mode:** Smart discuss (autonomous v2.0 run). The user accepted every recommendation in all four areas.

<domain>
## Phase Boundary

This phase adds opt-in Google Play Games Services v2 with non-blocking auto sign-in, and an **account chip** with a bottom-sheet menu: sign in / stop competing, the Compete toggle, and Settings. It is the plugin and identity foundation that Phase 68's submissions and global boards build on. The Leaderboards panel's identity strip (Phase 66) goes live with the signed-in identity.

The research pass for this phase also settles two Phase 68 questions, because both hinge on the same plugin's leaderboard API: the **64-char score-tag encoding** and **LINEAGE's global form** (per-combo boards, client-side grouping of fetched top scores, or local-only).

**Not in this phase:** submitting scores, the offline submission queue, the global/friends rows, season-keyed leaderboard IDs, the "you placed X" line (all Phase 68), and the privacy-policy, Data Safety and final-AAB work (Phase 69).

</domain>

<decisions>
## Implementation Decisions

### Opt-in model and network posture (PGS-02, ACCT-02)
- **D-01 — Default on a fresh install:** auto sign-in runs at launch and **Compete is ON by default**. This carries the user's 2026-09-17 ruling ("PGS auto sign-in: YES, opt-out-able, non-blocking"). Sign-in never blocks boot or play. A failure, a declined prompt or no Play Games profile leaves the player signed out and fully playable.
- **D-02 — Compete OFF:** the PGS SDK is **never initialized** at launch. There are zero network calls and zero submissions, and the chip shows the "nobody" glyph. Compete is a persisted player setting through the existing settings/storage path (`src/browser/settings.js` / `mzStorage`).
- **D-03 — "Sign out":** PGS v2 has no programmatic sign-out (the research must confirm this against the chosen plugin), so the menu offers **Stop competing** (Compete OFF) plus one line in voice pointing at the Play Games app for disconnecting the account for good. There is no fake local "signed out" flag while the SDK stays signed in.
- **D-04 — First successful sign-in:** one rail card in voice (the rail is the one feedback surface) saying the player's deaths now go on the public record, and that Compete can be turned off from the account chip. It shows once; a flag persists that it was seen.

### The account chip (ACCT-01)
- **D-05 — In-game placement:** a square avatar chip on HUD band 2, **immediately left of the ☰ menu button**. The ☰ menu keeps its SETTINGS row unchanged (Phase 57 user ruling: the ☰ menu is where the old chips live).
- **D-06 — Title screen:** the same chip sits in the title screen's top-right corner, so a player can sign in or change Compete before starting a run.
- **D-07 — Look:** signed in, the chip is the mock's initials avatar (`AVATAR`/`INITIALS` from `design/Mazeworld Boards Panel.dc.html`, with the colour hashed from the Play Games display name). There is **no remote profile-image fetch**. Signed out or Compete OFF, it shows a deliberate "nobody" glyph (a hollow square with a dim ?) that reads as intentional, not broken. A 44×44 minimum tap target.
- **D-08 — The Leaderboards identity strip goes live:** signed in, it shows the display name, the initials avatar and **PLAY GAMES · SIGNED IN**. The Phase 66 signed-out strip remains for signed out or Compete OFF. The ALL/FRIENDS rows still arrive in Phase 68; until then, the chips' tap note says the global boards are coming online (in voice).

### The chip menu (ACCT-02)
- **D-09 — Form:** a bottom sheet matching the existing Settings and Camp sheets (the `mw-legend-sheet` family: scrim, close button, dark palette).
- **D-10 — Rows:** an identity line (the display name and PLAY GAMES · SIGNED IN, or SIGNED OUT); **Sign in** when signed out with Compete ON (a manual sign-in call), or **Stop competing** when signed in; the **Compete** toggle; and **Settings**, which opens the existing settings sheet (`openSettingsSheet`).
- **D-11 — Failure or decline:** a rail card in voice, never a modal. No repeated nagging: auto sign-in retries only at the next launch, and a manual retry comes only from the Sign in row.
- **D-12 — Provider seam:** a new `src/browser/playGames.js` provider interface (for example `init()`, `isAuthenticated()`, `signIn()`, `getPlayer()` → `{ id, displayName }`, and room for Phase 68's leaderboard calls). It has a **native implementation** over the chosen Capacitor plugin and an **in-memory fake** used by the tests and the browser dev loop, plus a dev-only setting that simulates signed-in. The shell never imports the plugin directly.

### Build and console
- **D-13 — Plugin choice:** the research picks the plugin from `@modbender/capacitor-play-games`, `@openforge/capacitor-game-connect`, `capacitor-google-game-services`, or a vendored/forked copy. The criteria are maintenance, Capacitor 8 / AGP 8.13 / Gradle 8.14.3 compatibility (do not let anything upgrade AGP), the PGS v2 sign-in and leaderboard API surface (submit with tag, top scores, player-centred, friends), and license. The Gradle dependency tree is audited so **no ads or analytics SDK** comes in transitively (for example Firebase Analytics or AdMob).
- **D-14 — The research also settles, for Phase 68:** the 64-char score-tag encoding (what fits: name, race/sub/level, cause, the season/hash reference, and which fields are dropped), and LINEAGE's global form.
- **D-15 — PGS APP_ID:** an Android string resource (`games_app_id` or whatever the plugin expects) referenced from the manifest. It holds a placeholder until the user's console setup. Sign-in fails gracefully without it: a rail card, fully playable, no crash.
- **D-16 — Console runbook now:** write `docs/PLAY-GAMES-SETUP.md` in this phase, covering enabling PGS in Play Console, linking the **Play App Signing key's SHA-1** (not the upload key's), obtaining the APP_ID, and the tester allow-list. The user can then do it in parallel. Phase 69 completes it with the per-board, per-season leaderboard IDs and publishing.

### Post-research rulings (user, 2026-09-23, after 67-RESEARCH.md)
- **D-17 — Plugin intake:** `@modbender/capacitor-play-games` **0.5.0**, installed from npm with an **exact version pin** (no caret) and the lockfile integrity hash committed. The published tarball is reviewed once before install; the review notes (native entry points, Gradle deps, any network or analytics code, whether the plugin initializes the SDK at app start) are recorded in the plan SUMMARY. It is not vendored. An upgrade is a deliberate, reviewed change.
- **D-18 — No epitaph on global rows:** the 64-char URL-safe score tag carries the name (truncated per the research rule: full → "First L." → hard-truncated first name), race/sub/level, the six stat chips and a cause code, **not** the epitaph. Global rows expand to a short cause line plus the stat chips. Your own runs keep their full epitaphs from local data. This qualifies the milestone's earlier "name and epitaph ride in the score tag" framing. (Used by Phase 68.)
- **D-19 — LINEAGE global form:** client-side grouping of a top-N DEEPEST fetch by race + class, with an honest "sampled" footnote. There are no per-combo PGS boards, so each season uses **5 PGS leaderboards** (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) under the 70-per-game cap. (Used by Phase 68.)

### Rulings after the plugin review (user, 2026-09-23; supersede parts of D-02 and D-17)
- **D-20 — Plugin as-is; D-02 amended:** install `@modbender/capacitor-play-games` 0.5.0 **unmodified** from npm with an exact pin (D-17). Its `PlayGamesPlugin.load()` calls `PlayGamesSdk.initialize(context)` on every app start (verified at `PlayGamesPlugin.kt:40-43`), so D-02 is amended as follows. **Compete OFF means the game never calls sign-in, submit or fetch, and makes no leaderboard traffic.** Google's SDK still initializes at launch and may attempt its own automatic sign-in (the Play Games "Welcome back" banner). Offline play is unaffected: the init is local and wrapped in `runCatching`, sign-in failure means signed out, and boot never waits on it. The privacy text (Phase 69) states this plainly. `signIn()` is silent by default in this plugin, so the Sign in row passes `silent: false` (planner finding).
- **D-21 — AGP 9 spike before install:** the user asked to upgrade the Android build to the latest AGP, as Google Play recommends. Capacitor 8.5.2 (latest stable) and all its first-party plugins declare AGP 8.13.0, and Capacitor 9 is still dev-only, so a **time-boxed spike** runs first in isolation: AGP 9.3.1 with a matching Gradle 9.x wrapper, all Capacitor modules plus the plugin, and `npm run android:debug`. **If it builds cleanly, the whole build adopts AGP 9.3.1** (update `STATE.md`'s "don't let Studio upgrade" ground truth and the R8/AGP 9 todo). **If it does not, stay on AGP 8.13.0**, and apply a sha256-guarded, Gradle-only fix for the plugin's AGP 9.3.1 buildscript line, and only if the pinned build actually breaks on it. The result is recorded in `docs/RELEASING.md` and in the 67-06 SUMMARY.
- These rulings resolve 67-01's `checkpoint:human-verify`: **as-is** (the SDK init) plus D-21 (the AGP path). The 67-01 executor records them as the checkpoint outcome and does not stop to ask again.

### Claude's Discretion
- The exact provider method names, the storage key for Compete and the first-sign-in flag (for example under the existing settings object), the rail-card copy (deadpan, family-friendly, HP not WP), and the glyph's exact drawing.
- How the chip is wired into `src/browser/hudMenu.js` / `hudBands.js` (band 2), provided the ☰ menu's four legacy row ids keep routing unchanged.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/hudMenu.js` (Phase 57): the ☰ menu on HUD band 2. Its four rows reuse the legacy ids `mw-chip-marks`, `mw-chip-centre`, `btn-camp` and `mw-gear-btn`, and `mw-gear-btn` → `openSettingsSheet` (`mazeworld.html` about 5748/5766). The account chip sits beside ☰, and SETTINGS stays in the menu.
- `mazeworld.html` about 1569: `#mw-settings-sheet` (the `mw-legend-sheet` family: scrim, panel with `role="dialog"`, close button). This is the model for the account sheet.
- `src/browser/settings.js`: persisted player settings with a fail-open posture. Compete and the first-sign-in flag belong here.
- `src/browser/nativeChrome.js`: native-only plugin wiring through dynamic `@capacitor/*` imports, guarded by `window.Capacitor?.isNativePlatform?.()`. It is the precedent for loading the PGS plugin only on native.
- `src/browser/boardsPanel.js` / `boardsView.js` (Phase 66, in flight): the identity strip and the signed-out state, behind the `boardsView(...)` seam's `signedIn` input.
- The mock's `AVATAR` / `INITIALS` helpers (`design/Mazeworld Boards Panel.dc.html`), which Phase 66 ports.

### Established Patterns
- Capacitor 8.5 core/android plus seven first-party plugins (`package.json`). The build runs `npm run cap:sync` → `tools/pin-jdk.mjs` → `tools/gradle.mjs`. AGP 8.13.0 / Gradle 8.14.3 is pinned: "don't let Studio upgrade". The JDK is pinned through `gradle.properties` (`org.gradle.java.home`), which `npx cap sync` wipes and `pin-jdk` re-applies.
- `android/app/build.gradle` applies `capacitor.build.gradle`, and plugin Gradle modules are wired by `cap sync`.
- The modular shell bridge registry is `src/browser/bridge.js` plus the `docs/SHELL-MODULES.md` table (regenerated by `tools/bridge-doc.mjs`).
- Tests: `node --test`; shell tests use `test/unit/harness/shellSandbox.js` plus `recordingDom.js`; copy is gated by `test/voice/safety-scan.test.js`.

### Integration Points
- Boot: after the adapter boot, if Compete is ON and the app is native, `playGames.init()` runs non-blocking, and its sign-in result updates the chip and the identity strip.
- HUD band 2: the account chip beside ☰. On the title screen, a chip in the top-right.
- The Leaderboards panel: `boardsView(...)` receives `signedIn` and the player identity.
- The Android manifest and resources: the PGS APP_ID string.

</code_context>

<specifics>
## Specific Ideas

- The first-sign-in rail card, for example: "Play Games is watching now. Every death goes on the public record. Turn Compete off from the little face in the corner."
- The Stop competing helper line, for example: "To forget you entirely, disconnect this game in the Play Games app. It will pretend not to miss you."
- The phase research should record, for the chosen plugin, the exact method names for sign-in, the player (id, display name), submit score with tag, load top scores (public/friends, time span), load player-centred scores, and the friends list, plus any consent flow needed for friends.

</specifics>

<deferred>
## Deferred Ideas

- The remote Play Games profile image. Declined; initials avatar only.
- PGS achievements, Most Deaths as a global board, and plausibility checks are Future Requirements.
- PGS cloud saves are out of scope (milestone Out of Scope).

</deferred>
