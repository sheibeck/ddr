# Phase 67: Play Games Integration & Account Chip - Research

**Researched:** 2026-09-23
**Domain:** Google Play Games Services v2 (Android, Capacitor 8 plugin integration), opt-in identity chip, score-tag encoding design, global-board architecture
**Confidence:** MEDIUM (plugin choice and PGS platform mechanics are well-documented and cross-checked; exact wire-level pagination limits and quota numbers are the weakest area — flagged LOW/MEDIUM inline)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Default on a fresh install:** auto sign-in runs at launch and Compete is ON by default. Sign-in never blocks boot or play. A failure, a declined prompt or no Play Games profile leaves the player signed out and fully playable.
- **D-02 — Compete OFF:** the PGS SDK is never initialized at launch. Zero network calls, zero submissions, chip shows the "nobody" glyph. Compete is a persisted player setting through `src/browser/settings.js` / `mzStorage`.
- **D-03 — "Sign out":** PGS v2 has no programmatic sign-out (research must confirm against the chosen plugin — **confirmed below**), so the menu offers **Stop competing** (Compete OFF) plus a voice line pointing at the Play Games app for disconnecting the account. No fake local "signed out" flag while the SDK stays signed in.
- **D-04 — First successful sign-in:** one rail card in voice saying deaths now go on the public record, and Compete can be turned off from the account chip. Shows once; a flag persists it was seen.
- **D-05 — In-game placement:** a square avatar chip on HUD band 2, immediately left of the ☰ menu button. ☰ keeps its SETTINGS row unchanged.
- **D-06 — Title screen:** the same chip sits in the title screen's top-right corner.
- **D-07 — Look:** signed in, the chip is the mock's initials avatar, colour hashed from the Play Games display name, no remote profile-image fetch. Signed out or Compete OFF: a "nobody" glyph (hollow square, dim ?). 44×44 minimum tap target.
- **D-08 — The Leaderboards identity strip goes live:** signed in, shows display name, initials avatar, PLAY GAMES · SIGNED IN. Phase 66 signed-out strip remains for signed out/Compete OFF.
- **D-09 — Form:** a bottom sheet matching `mw-legend-sheet` (scrim, close button, dark palette).
- **D-10 — Rows:** identity line; Sign in (signed out + Compete ON) or Stop competing (signed in); Compete toggle; Settings (opens `openSettingsSheet`).
- **D-11 — Failure or decline:** a rail card in voice, never a modal. Auto sign-in retries only at next launch; manual retry only from the Sign in row.
- **D-12 — Provider seam:** new `src/browser/playGames.js` with `init()`, `isAuthenticated()`, `signIn()`, `getPlayer()` → `{ id, displayName }`, room for Phase 68's leaderboard calls. Native implementation + in-memory fake for tests/dev loop + a dev-only "simulate signed-in" setting. The shell never imports the plugin directly.
- **D-13 — Plugin choice:** research picks from `@modbender/capacitor-play-games`, `@openforge/capacitor-game-connect`, `capacitor-google-game-services`, or vendor/fork. Criteria: maintenance, Capacitor 8/AGP 8.13/Gradle 8.14.3 compatibility (never upgrade AGP), sign-in + leaderboard API surface, license. Gradle dependency tree audited for zero ads/analytics SDKs.
- **D-14 — Settled here for Phase 68:** the 64-char score-tag encoding, and LINEAGE's global form.
- **D-15 — PGS APP_ID:** an Android string resource referenced from the manifest, holding a placeholder until console setup. Sign-in fails gracefully without it: rail card, fully playable, no crash.
- **D-16 — Console runbook now:** write `docs/PLAY-GAMES-SETUP.md` in this phase covering PGS enablement, linking the Play App Signing SHA-1, obtaining APP_ID, tester allow-list. Phase 69 completes it with per-board/per-season IDs and publishing.

### Claude's Discretion

- Exact provider method names, storage key for Compete/first-sign-in flag, rail-card copy (deadpan, family-friendly, HP not WP), the glyph's exact drawing.
- How the chip wires into `src/browser/hudMenu.js` / `hudBands.js` (band 2), provided the ☰ menu's four legacy row ids keep routing unchanged.

### Deferred Ideas (OUT OF SCOPE)

- The remote Play Games profile image. Declined; initials avatar only.
- PGS achievements, Most Deaths as a global board, plausibility checks — Future Requirements.
- PGS cloud saves — out of scope (milestone Out of Scope).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PGS-01 | A Capacitor 8-compatible PGS v2 plugin is chosen and wired into the Android build, adding no ads/analytics SDK | Plugin comparison table below recommends `@modbender/capacitor-play-games`; Gradle dependency audit confirms zero ads/analytics transitively (empty `dependencies` in its own `package.json`; native side only pulls `play-services-games-v2` + AndroidX, which the project's Capacitor/AndroidX baseline already carries) |
| PGS-02 | PGS auto sign-in runs at launch without blocking play; decline/no-profile/failure leave the game fully playable | "Sign-in mechanics" section: PGS v2's auto-silent-sign-in-at-SDK-init behavior, what happens on decline, and how to gate SDK init entirely behind Compete |
| ACCT-01 | The settings cog becomes an account chip (avatar / nobody glyph) | Existing code insights (D-05..D-08) + `getPlayer()` shape from the chosen plugin |
| ACCT-02 | Tapping the chip opens a menu (sign in / stop competing, Compete toggle, Settings) | Provider seam design (D-12) + confirmed absence of programmatic sign-out |
| *(Phase 68 hinge, settled here per D-14)* PGS-03 | 64-char score-tag encoding | "Score-tag encoding" section — full field-by-field design |
| *(Phase 68 hinge, settled here per D-14)* PGS-05 | LINEAGE's global form | "Board → leaderboard mapping" + "LINEAGE global form" sections |
</phase_requirements>

## Summary

The clear plugin choice is **`@modbender/capacitor-play-games`** (npm, MIT, v0.5.0 published 2026-09-12) — a maintained fork of an abandoned upstream, explicitly built and tested against **Capacitor 8, AGP 8.13.0, Gradle 8.14.3, JDK 21** (the project's exact pinned toolchain), with zero runtime npm dependencies, a full PGS v2 API surface (sign-in, player, leaderboards with `scoreTag`, top/player-centered scores, friends, achievements, saved games — the last two unused here), and a safe web no-op so the browser dev loop and `node --test` never need the real plugin. The two alternatives are both weaker: `@openforge/capacitor-game-connect` documents only Capacitor v3–v5 (no confirmed v8 support) and its README exposes no `loadTopScores`/`loadPlayerCenteredScores`/friends methods; `capacitor-google-game-services` is Android-only Capacitor v6 and is scoped to sign-in + saved games only — it has no leaderboard or friends API at all, disqualifying it outright for this phase's needs. All three plugins are legitimately low-download/niche (verified via the package-legitimacy gate — see Audit table below); none is a slopsquat, but none clears the "well-known" bar either, so Phase 68's actual `npm install` should be gated behind a `checkpoint:human-verify`.

PGS v2's platform behavior (confirmed via Google's own migration docs) removes programmatic sign-out entirely: the SDK auto-signs-in silently at launch, and "signing out" is now an OS/Play-Games-app-level action outside any game's control — this directly confirms D-03. Deferring SDK initialization when Compete is OFF is straightforward: the plugin's own `init()`/sign-in calls are the only place PGS code runs, so simply never calling them (guarding on the persisted Compete setting before touching `src/browser/playGames.js`'s native path) keeps the OFF state at zero network calls, matching D-02.

The 64-character `scoreTag` constraint (RFC 3986 §2.3 unreserved charset: `A-Z a-z 0-9 - . _ ~`) does **not** comfortably fit a full epitaph sentence (epitaphs in `content/epitaphs.js` run 60–150+ characters) alongside name/race/sub/level/cause/floor/day/steps/kills/gold/sp. This research settles that trade-off: a versioned, delimited plain-text tag carries every numeric field the panel's expand-row needs (FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST) plus race/sub/level/cause-code and a **truncated** adventurer name (~15–16 char budget; the longest generated name is 21 chars) — full epitaph text is dropped for global rows and the panel substitutes a short cause line instead (an honest degrade, not a broken one).

For LINEAGE's global form, per-combo PGS leaderboards (18 combos = 6 races × 3 classes, per `race+cls` — **not** race×sub-class) are ruled out: PGS caps a game at **70 leaderboards total**, and the milestone's season design keeps every past season's boards readable forever, so 5 base boards/season already consumes the budget in ~14 seasons — adding 18 lineage boards/season would exhaust it in ~3. The recommended form is **client-side grouping of a top-N fetch from the DEEPEST board**, grouped by `race+cls` locally, with an honest "sampled" footnote — this respects the leaderboard cap indefinitely and needs no new PGS configuration per season.

**Primary recommendation:** adopt `@modbender/capacitor-play-games` behind the `src/browser/playGames.js` seam exactly as D-12 specifies; never call `init()`/`signIn()` when Compete is OFF; use the delimited-text score-tag format below (with graceful name truncation and epitaph dropped) for Phase 68; and build LINEAGE from a client-side grouped fetch of the DEEPEST leaderboard's top-N rather than per-combo boards.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PGS sign-in / auth state | Browser/Client (native WebView shell) | — | Capacitor plugin bridges to Android's on-device Play Games account; no server round-trip, no backend of ours |
| Account chip UI + bottom-sheet menu | Browser/Client | — | Pure DOM/CSS in `src/browser/hudMenu.js`/new chip module, mirrors existing `mw-legend-sheet` pattern |
| Compete toggle / first-sign-in flag persistence | Browser/Client (native storage) | — | `src/browser/settings.js` → `@capacitor/preferences` via `mzStorage`, same pattern as every other setting |
| PGS plugin bridge (native Android) | Browser/Client (native layer, Capacitor plugin's own Kotlin/Java code) | — | Runs inside the Android WebView shell's native side; no separate service tier exists in this app |
| Score-tag encode/decode | Browser/Client (pure JS, `engine/` or `src/browser/` depending on determinism needs) | — | Pure string transform, no I/O; should live where `buildRunSummary`/`records.js` already live so Phase 68 can unit-test it without a device |
| Global leaderboard top-scores / friends / rank fetch | Browser/Client (native plugin call to Google's PGS backend) | — | Google's own Play Games backend is the "server" here; this app has zero backend of its own |
| LINEAGE client-side grouping | Browser/Client | — | Derived view computed from a fetched top-N array; no new PGS leaderboard config, no server |
| Google Play Console PGS configuration (APP_ID, leaderboard IDs, tester allow-list) | External (Play Console, human-operated) | — | Not reachable from app code; documented as a runbook (D-16) for the user to execute in parallel |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modbender/capacitor-play-games` | ^0.5.0 (verified via `npm view`: latest 0.5.0, published 2026-09-12) [VERIFIED: npm registry — version/publish-date/peerDep/license confirmed via `npm view`; **package identity itself is `[ASSUMED]`**, see Package Legitimacy Audit] | Capacitor 8 bridge to Google Play Games Services v2 (Android) — sign-in, player, leaderboards w/ scoreTag, top/player-centered scores, friends | Only candidate with confirmed Capacitor 8 + AGP 8.13.0/Gradle 8.14.3/JDK 21 support (matches this project's exact pinned toolchain), MIT license, zero runtime npm deps, full leaderboard+friends API surface this phase and Phase 68 need [CITED: github.com/modbender/capacitor-play-games] |

### Supporting
None needed beyond the one plugin above — no additional Capacitor plugins required for this phase (no ads/analytics, no new storage plugin; `@capacitor/preferences` is already in `package.json`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@modbender/capacitor-play-games` | `@openforge/capacitor-game-connect` | README only confirms Capacitor v3–v5; no `loadTopScores`/`loadPlayerCenteredScores`/friends methods documented; 6 open issues vs. modbender's 0; would need its own compatibility spike before it could be trusted on Capacitor 8 [CITED: npmjs.com/package/@openforge/capacitor-game-connect, github.com/openforge/capacitor-game-connect] |
| `@modbender/capacitor-play-games` | `capacitor-google-game-services` (scottcl88) | Android-only, Capacitor v6, and its documented surface is sign-in + saved games ONLY — no leaderboards, no scoreTag, no friends API at all. Disqualifying for PGS-01/PGS-03/PGS-05/ACCT needs regardless of maintenance quality [CITED: github.com/scottcl88/capacitor-google-game-services] |
| `@modbender/capacitor-play-games` | Vendor/fork a copy into the repo | Removes the "who maintains it" risk entirely, but trades it for "we now own Kotlin/Gradle PGS-v2 wiring code" — a real cost for a solo dev with no prior native-Android plugin-authoring experience on this project. Recommended only as a fallback if modbender's package is pulled from npm or breaks on a future Capacitor bump; the plugin's MIT license and GitHub availability make forking straightforward if needed |

**Installation:**
```bash
npm install @modbender/capacitor-play-games
npx cap sync android
```

**Version verification:** confirmed live via `npm view @modbender/capacitor-play-games version` → `0.5.0`; `npm view ... time.modified` → `2026-09-12T18:10:09.180Z`; `npm view ... peerDependencies` → `{ "@capacitor/core": "^8.0.0" }` (matches this project's `@capacitor/core@^8.5.1`); `npm view ... license` → `MIT`; `npm view ... scripts.postinstall` → empty (no postinstall script — one fewer supply-chain risk vector); `npm view ... dependencies` → `{}` (zero runtime deps, so the "no ads/analytics" audit reduces to the plugin's own Android/Gradle module, see next section).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@modbender/capacitor-play-games` | npm | 11 days old (published 2026-09-12) | 41/week | github.com/modbender/capacitor-play-games | **SUS** (reasons: too-new, low-downloads) | **Kept — flagged.** Planner must add `checkpoint:human-verify` before `npm install`. Confirmed real: exists on npm, has a real GitHub repo (fork of a named abandoned upstream `@idleflowgames/capacitor-play-games`), MIT license, no postinstall script. The "too-new"/"low-downloads" signals reflect the entire PGS-Capacitor plugin niche being small, not a hallucination pattern |
| `@openforge/capacitor-game-connect` | npm | published 2023-12-04 | 235/week | github.com/openforge/capacitor-game-connect | **SUS** (reason: low-downloads) | Not selected — Capacitor 8 support unconfirmed, missing leaderboard/friends methods in README. Not recommended for use, no install action needed |
| `capacitor-google-game-services` | npm | published 2023-06-25 | 0/week | github.com/scottcl88/capacitor-google-game-services | **SUS** (reason: low-downloads) | Not selected — no leaderboard/friends API at all. Not recommended for use, no install action needed |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@modbender/capacitor-play-games` — the planner must insert a `checkpoint:human-verify` task before its `npm install` step, asking the user to glance at the GitHub repo (commit history, README, that it's genuinely a PGS v2 wrapper and not a supply-chain risk) before it lands in `package.json`. Every package name in this document was discovered via `WebSearch`/training data, not an authoritative source, and is therefore `[ASSUMED]` regardless of its registry-existence check passing.

## Architecture Patterns

### System Architecture Diagram

```
[App boot: mazeworld.html trailing module]
        │
        ▼
[readSettings() — src/browser/settings.js] ──reads──> Compete flag (ddr.settings.v1)
        │
        ├─ Compete OFF ──────────────────────────────────────────────┐
        │                                                             ▼
        │                                                  [chip renders "nobody" glyph]
        │                                                  [ZERO network calls made]
        │
        └─ Compete ON, isNativePlatform() true
                │
                ▼
        [src/browser/playGames.js#init() — guarded dynamic import,
         mirrors nativeChrome.js's loadApp() pattern]
                │
                ▼
        [@modbender/capacitor-play-games native bridge]
                │
                ▼
        [PGS v2 SDK: silent auto sign-in attempt]
                │
        ┌───────┴────────┐
        ▼                ▼
   [signed in]      [declined / no profile / failure]
        │                │
        ▼                ▼
 [getPlayer() → {id, displayName}]   [rail card in voice — D-11]
        │                            [chip stays "nobody"; game fully playable]
        ▼
 [chip renders initials avatar,
  colour hashed from displayName]
        │
        ▼
 [Leaderboards identity strip (Phase 66 seam) goes live —
  boardsView(...) receives signedIn:true + player identity]
        │
        ▼
 [Account chip tap → bottom sheet (D-09/D-10):
  identity line / Sign in or Stop competing / Compete toggle / Settings]
        │
        ├─ "Sign in" (signed out, Compete ON) → playGames.signIn() (manual, interactive)
        ├─ "Stop competing" (signed in) → Compete OFF; SDK stays signed in at OS level (D-03);
        │      helper line points at the Play Games app for a real disconnect
        └─ "Settings" → openSettingsSheet() (existing sheet, unchanged)
```

### Recommended Project Structure
```
src/browser/
├── playGames.js       # NEW — D-12 provider seam: init(), isAuthenticated(), signIn(),
│                       #   getPlayer(), stubs for Phase 68's leaderboard calls; native
│                       #   impl over @modbender/capacitor-play-games behind a guarded
│                       #   dynamic import(), in-memory fake for tests/dev loop
├── accountChip.js      # NEW (or fold into hudMenu.js per Claude's Discretion) —
│                       #   chip render (avatar/glyph) + bottom-sheet menu (D-09/D-10)
├── settings.js          # EXTEND — Compete flag + first-sign-in-seen flag, same
│                       #   SETTINGS_STORAGE_KEY blob, same fail-open posture
├── hudMenu.js           # EXTEND — chip sits beside the existing ☰ menu row set
├── boardsView.js        # Phase 66, EXTEND in Phase 68 — receives signedIn + player
android/app/src/main/
├── res/values/games-ids.xml   # NEW — games_app_id placeholder string (D-15)
└── AndroidManifest.xml        # EXTEND — <meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/games_app_id" />
docs/
└── PLAY-GAMES-SETUP.md  # NEW (D-16) — console runbook
```

### Pattern 1: Guarded dynamic import, native-only (matches `nativeChrome.js`/`storage.js`)
**What:** Every reach into `@modbender/capacitor-play-games` happens through a dynamic `import()` guarded by `window.Capacitor?.isNativePlatform?.()`, with a test-only override hook mirroring `loadApp()`'s `globalThis.__mzAppImportOverride` pattern.
**When to use:** Any code path that might run in `node --test` or the plain-browser dev loop, where the real native plugin cannot resolve.
**Example:**
```javascript
// src/browser/playGames.js — modeled on src/browser/nativeChrome.js#loadApp
async function loadPlayGames(injected) {
  if (injected) return injected;
  if (globalThis.__mzPlayGamesImportOverride) {
    return globalThis.__mzPlayGamesImportOverride();
  }
  return import("@modbender/capacitor-play-games");
}

export async function init({ competeEnabled, isNative = window.Capacitor?.isNativePlatform?.() } = {}) {
  if (!competeEnabled || !isNative) return { signedIn: false }; // D-02: zero network when OFF
  try {
    const { PlayGames } = await loadPlayGames();
    await PlayGames.signIn({ silent: true }); // non-blocking auto sign-in, D-01
    const signedIn = await PlayGames.isSignedIn();
    if (!signedIn) return { signedIn: false }; // decline/no-profile — D-02/D-11
    const player = await PlayGames.getPlayer();
    return { signedIn: true, player: { id: player.playerId, displayName: player.displayName } };
  } catch {
    return { signedIn: false }; // fail-open, never blocks boot — D-01/D-11
  }
}
```

### Pattern 2: In-memory fake provider for tests/dev loop (D-12)
**What:** A second module (or a factory branch inside `playGames.js`) exposing the identical shape (`init`, `isAuthenticated`, `signIn`, `getPlayer`) but backed by an in-memory flag, with a dev-only settings toggle to simulate signed-in.
**When to use:** `node --test`, `shellSandbox.js`-based shell tests, and the plain-browser dev loop (`npx serve`/`live-server`).
**Example:**
```javascript
// test-only / dev-only fake — same shape as the native module's exports
export function createFakePlayGames({ simulateSignedIn = false, displayName = "Test Player" } = {}) {
  let signedIn = simulateSignedIn;
  return {
    async init() { return { signedIn, player: signedIn ? { id: "fake-1", displayName } : null }; },
    async isAuthenticated() { return signedIn; },
    async signIn() { signedIn = true; return { signedIn: true, player: { id: "fake-1", displayName } }; },
    async getPlayer() { return signedIn ? { id: "fake-1", displayName } : null; },
  };
}
```

### Anti-Patterns to Avoid
- **Calling `PlayGames.signIn()` (or any plugin method) unconditionally at module load:** would run PGS init even with Compete OFF, violating D-02's zero-network guarantee. Always gate on the persisted Compete flag FIRST, before touching the dynamic import.
- **Treating "declined sign-in" as an error state requiring retry logic:** PGS v2's own quality guidance and D-11 both require this to be silent — one rail card, no repeated nagging, no modal.
- **Building a local "signed out" flag that fakes a disconnected state while the underlying PGS SDK is still signed in:** D-03 explicitly forbids this. "Stop competing" only flips the Compete flag; it does not and cannot sign the player out of PGS itself.
- **Reaching for `@modbender/capacitor-play-games`'s exports directly from `mazeworld.html` or any other shell module:** every call must go through `src/browser/playGames.js` (D-12's seam requirement) so Phase 68's leaderboard calls and the tests' fake provider have one integration point.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global leaderboard storage/ranking | A custom backend (Cloudflare Worker/Firebase) | PGS v2's leaderboard API | Already decided (proposed-milestone doc, Option C explicitly deferred); PGS gives tamper protection, ranking, and pagination for free with zero server to run |
| Friends graph | Our own friend-codes/links system | PGS's Friends API (`loadFriends`, friends-scoped leaderboard `collection`) | Google already solved "who are this player's friends" using the device's Google account; building our own would require its own identity system just to get started |
| Player identity for global boards | A login form / our own account system | The device's existing Google Play Games profile via PGS auto sign-in | Zero-friction, no password, no email collection, matches "no accounts" positioning while still getting a stable player identity |
| Score-tampering defense | Custom replay-hash verification service | PGS's built-in tamper protection (enabled by default on new leaderboards, ~24h to activate) | Free platform feature; the phase's own `runHash`/`acts` fields (Phase 65) remain available as a LOCAL plausibility check later (Future Requirement), not a substitute for PGS's server-side protection |

**Key insight:** every "global" capability this milestone needs (identity, leaderboards, friends, rank) is already a first-class PGS v2 feature — the only genuinely custom work is the *panel UI* over that data (Phase 66/68) and the *encoding* squeezed into the 64-char scoreTag (this phase settles the design).

## Sign-in Mechanics (PGS-02, D-01..D-03, D-11)

- **Automatic sign-in at SDK init [CITED: developer.android.com/games/pgs/android/migrate-to-v2]:** PGS v2 attempts a *silent* sign-in the moment the SDK is initialized/first touched — no visible prompt on subsequent launches once a player has an established Play Games profile and has previously consented. On a genuinely first-ever launch (or a device with no Play Games profile at all), Android may show a one-time profile-creation sheet; the player can dismiss it, leaving the app signed out.
- **Decline / no profile / failure — all converge on the same "signed out, fully playable" outcome.** Nothing in the plugin's API distinguishes "user tapped decline" from "no network" from "no Google account on device" at the JS layer — treat every non-success outcome from `init()`/`signIn()` identically (D-11: one rail card, no nagging).
- **No programmatic sign-out exists in PGS v2 [CITED: developer.android.com/games/pgs/android/migrate-to-v2]:** Google's own migration guide states plainly that "the sign-out method is removed... your game will experience additional logins due to automatic sign-in... account management is handled in the OS settings" and instructs developers to "remove all sign-out related code." This **confirms D-03 exactly as written** — Stop Competing (Compete OFF) is the only in-app lever; a real disconnect requires the player to act in the Play Games app or Android account settings, which is why D-03's helper line points there.
- **Manual `signIn()` (non-silent):** the chosen plugin exposes `signIn(opts?: { silent?: boolean })`. Passing no options / `silent: false` triggers the interactive Google sign-in flow (an account picker or consent screen) — this is what the chip menu's "Sign in" row should call (D-10).
- **Deferring SDK init entirely when Compete is OFF:** confirmed straightforward. The plugin only touches PGS when a client method (`signIn`, `isSignedIn`, etc.) is actually invoked from JS — there is no ambient auto-init inside its Android `load()`/plugin-registration lifecycle that this research found evidence of; simply never calling into `playGames.js`'s native path when Compete is OFF (per the Pattern 1 code sketch above) keeps this at true zero network calls. **[ASSUMED — MEDIUM confidence]:** this is inferred from the plugin being a thin bridge over Google's own `GamesSignInClient`, which per Google's docs only activates on an explicit `signIn()`/`isAuthenticated()` call; Phase 67's implementation should verify this empirically on-device (a Compete-OFF cold boot should show zero PGS-related Logcat/network activity) before shipping, since the plugin's own Android source was not directly inspected in this research pass.

## Score-Tag Encoding (Phase 68, PGS-03, D-14)

### The hard constraint
`scoreTag` accepts **at most 64 characters, drawn only from RFC 3986 §2.3's unreserved set: `A-Z a-z 0-9 - . _ ~`** [CITED: developers.google.com API reference for `ScoreSubmission`/`submitScoreImmediate`, cross-confirmed across two independent search results]. A malformed tag throws `IllegalArgumentException` — the encoder must be defensive (never emit a delimiter char inside a variable-length field, never exceed 64 chars).

### What must be dropped
The full epitaph (`content/epitaphs.js`, e.g. *"A {sub} of skill level {lvl}, undone by something called a {foe}. Put it on the stone. All of it."*) runs 60–150+ characters after token substitution — **it cannot fit** alongside name/race/sub/level/cause/floor/day/steps/kills/gold/sp in 64 chars, full stop. This is a genuine finding that qualifies the milestone's looser framing ("the adventurer's name and epitaph ride in the score tag") — only the **name** rides in the tag; the **epitaph does not**, and global rows must degrade gracefully rather than pretend otherwise.

### Recommended encoding: versioned, delimited plain text
Given the numeric-field budget below fits comfortably (worked example totals well under 64 chars even before allocating name space), a human-readable delimited format is preferred over base64 binary packing — it stays debuggable in the Play Console's raw score-tag view during development, at negligible cost given the headroom available:

```
v1.{race}.{sub}.{lvl}.{cause}.{floor}.{day}.{steps}.{kills}.{gold}.{sp}.{name}
```

| Field | Encoding | Max width | Notes |
|-------|----------|-----------|-------|
| version | literal `v1` | 2 | Bump to `v2` etc. if the format ever changes; decoders should treat an unrecognized version as "no structured data available" rather than crash |
| race | numeric index into `RACES` keys (6 values: Human/Elven/Dwarven/Wilmsry/Fridgian/Troll) | 1 digit (0-5) | Index order is a build-time constant Phase 68 must freeze and never reorder |
| sub | numeric index into the 24 `SUB_NOTE` keys | 2 digits (00-23) | Same freeze requirement |
| level | decimal | 2 digits | Levels are small in this game; 2 digits (0-99) is generous headroom |
| cause | numeric index into `CAUSE_TEXT` keys (14 keys today, e.g. combat/starve/trap/…) | 2 digits (00-13, room to grow) | This is a **code**, not the epitaph — the panel's expand row for a global/friend row shows a short generic line from `CAUSE_TEXT[code]` (e.g. "cut down by a foe"), never the personalized epitaph sentence |
| floor | decimal | 3 digits | Covers depth well past the depth-20 target ceiling |
| day | decimal | 4 digits | LONGEST board can run long |
| steps | decimal | 5 digits | LEANEST board's secondary field |
| kills | decimal | 4 digits | BUTCHERY |
| gold | decimal | 6 digits | PURSE (wilmst at death) |
| sp | decimal | 6 digits | EXP chip in the expand row |
| name | ASCII, truncated | remaining budget (~15-16 chars) | See truncation rule below |

**Worked budget:** `"v1"`(2) + 10 dot-delimiters(10) + race(1)+sub(2)+lvl(2)+cause(2)+floor(3)+day(4)+steps(5)+kills(4)+gold(6)+sp(6) = 2+10+35 = 47 chars fixed, leaving **17 characters** for `name` at the 64-char ceiling.

**Name truncation rule:** the longest generated adventurer name in `content/names.js` is 21 characters (`"Lithariel Silverbough"`) [VERIFIED: computed directly from `content/names.js` — every first×surname combination enumerated]. A 17-char budget requires truncation for outliers. Recommended rule, in priority order: (1) if the full "First Last" fits, use it; (2) else try "First L." (first name + surname initial + period); (3) else hard-truncate the first name to the budget with no ellipsis (keeps the tag parseable and avoids a jarring "…" in a family-friendly, deadpan-voice UI — a clipped name reads as "the ledger ran out of room," which fits the game's voice). Phase 68 should implement this as a pure, unit-testable function alongside `runHash`/`buildRunSummary` in `engine/records.js` or a sibling module.

**Decoder must be defensive:** an unparseable tag (wrong version, wrong field count, non-numeric where a number is expected) should degrade to "no adventurer detail available for this row" rather than throw — global rows always have SOME data (the PGS display name + the board's own score value), so a tag-decode failure should never blank a whole row.

**Alternative considered and rejected for now:** base64url-encoding a compact bit-packed binary record. This would free significant extra room (base64 over the 64-char ceiling yields ~48 raw bytes vs. the ~17 char/byte budget above) and could carry the full 21-char name with no truncation at all. Rejected as the *primary* recommendation only because the delimited-text format already has enough headroom for every field the panel needs and is far easier to eyeball/debug in the Play Console UI during Phase 68/69's testing. **Record this alternative in the phase's Assumptions Log** — if Phase 68 discovers additional fields are needed later (e.g., a party flag), revisit binary packing before shrinking existing fields.

## Board → Leaderboard Mapping (Phase 68, PGS-05/06)

Per-board PGS score encodings (single 64-bit-safe integer, sort order fixed at leaderboard creation and never changeable after publishing — confirmed [CITED: developer.android.com/games/pgs/leaderboards]):

| Board (`BOARD_IDS`) | Local sort (`engine/records.js#compareRuns`) | PGS score encoding | Sort direction |
|---|---|---|---|
| `deep` (DEEPEST) | floor desc, then steps asc | `score = floor * 1_000_000 - steps` (clamp steps to < 1,000,000; ties-broken-by-fewer-steps falls out of the subtraction) | larger-is-better |
| `lean` (LEANEST) | floor desc, then steps asc (re-ranked per Phase 66 to squares-per-floor — verify against Phase 66's final `compareRuns` before Phase 68 implements) | Same composite pattern as `deep`, OR (if Phase 66 lands a true squares-per-floor ratio) a scaled-integer ratio, e.g. `score = round((steps / max(floor,1)) * -1000) + LARGE_OFFSET` inverted for "smaller is better" semantics — **flag for Phase 68 to confirm against Phase 66's actual final ranking function**, since 66 was still in-flight during this research pass | smaller-is-better (steps-per-floor) OR mirror `deep`'s composite if Phase 66 kept floor-primary ranking |
| `days` (LONGEST) | day desc, then floor desc | `score = day * 1_000 + floor` (floor as tiebreak, capped to 3 digits) | larger-is-better |
| `kills` (BUTCHERY) | kills desc, then floor desc | `score = kills * 1_000 + floor` | larger-is-better |
| `purse` (PURSE) | gold desc | `score = gold` (raw) | larger-is-better |
| `combo` (LINEAGE) | best floor per race+cls | **No dedicated PGS leaderboard** — see LINEAGE section below; derived from `deep`'s data | n/a |
| `yard` (GRAVEYARD) | floor desc, then steps asc | **Local-only, never submitted** (per REQUIREMENTS.md: "yard=local only") | n/a |

**Per-season leaderboard IDs (PGS-06):** each of the 5 submitted boards (`deep`, `lean`, `days`, `kills`, `purse`) needs one PGS leaderboard ID per season, e.g. `deep_s1`, `deep_s2`, etc., created in Play Console and referenced from a build-time config (Phase 69's per-board-per-season ID table). Bumping `SEASON` in code points new submissions at the new ID while old IDs stay live and readable — this is a **console configuration + code constant** concern, not a plugin API concern.

**Leaderboard count budget:** 5 boards/season × N seasons must stay under **70 total leaderboards** [CITED: developer.android.com/games/pgs/leaderboards] — at 5/season this supports 14 seasons before hitting the cap, which is a comfortable multi-year runway for a solo-dev project's balance-change cadence. This budget is the load-bearing reason LINEAGE must NOT get its own per-season boards (see below).

## LINEAGE Global Form (Phase 68, PGS-05, D-14)

Three options were evaluated per the milestone's own framing:

| Option | Leaderboard cost | Completeness | Verdict |
|---|---|---|---|
| **A. Per-combo boards** (18 combos: 6 races × 3 classes, per `lineageKey()` = `"{race} {cls}"` — confirmed NOT race×sub-class) | 18 *additional* leaderboards **per season** | Perfect — every combo has its own true global ranking | **Rejected.** 5 base + 18 lineage = 23 boards/season → exhausts the 70-leaderboard cap in ~3 seasons. Directly conflicts with the milestone's "seasons never delete old boards" design (ROADMAP.md milestone gates) |
| **B. Client-side grouping of a fetched top-N** from the `deep` (DEEPEST) leaderboard, grouped locally by `race+cls`, keeping the first (best) entry per combo | Zero additional leaderboards | Partial — only sees combos represented in the fetched top-N; a rare combo's best run could be buried past N and appear as "no runs yet" even though one exists further down the global list | **Recommended.** Fits the 70-leaderboard budget indefinitely; the incompleteness is an honest, voice-able degrade ("Sampled from the top N deepest corpses; rare lineages may be hiding further down") rather than a silent lie |
| **C. Local-only** (LINEAGE stays a personal-bests-only board, same as GRAVEYARD/`yard`) | Zero | Complete for the player's own dead only; loses the global social angle entirely | Not recommended as the default — it's the safe fallback if Option B's fetch volume/latency proves impractical during Phase 68's implementation, but it discards more of the milestone's stated value ("everyone" boards) than necessary |

**Recommendation: Option B.** Fetch the `deep` leaderboard's top-N (N to be tuned in Phase 68 against real device latency — start around 100, i.e. several `loadMore()` pages at whatever per-page size the plugin's `loadTopScores` call uses [MEDIUM confidence — exact per-call `maxResults` ceiling was not found as a hard documented number; Android's `LeaderboardsClient` accepts a caller-specified `maxResults` and supports incremental `loadMore()` pagination [CITED: developer.android.com/games/pgs/android/leaderboards], but community reports and this project's realistic early player count (dozens to low hundreds) make even a handful of paginated calls inexpensive]), decode each row's scoreTag for `race`+`sub`(or `cls`, decode both — the tag as designed above carries `sub` not `cls`; Phase 68 should derive `cls` from `sub` via the existing `content/classes.js` sub→class mapping, or add `cls` as an explicit tag field if that mapping is ever ambiguous), group by `race+cls`, and keep the first (best, since `deep` is already ranked) entry per combo. Render "NOT YET CLAIMED" or similar deadpan copy for any of the 18 combos absent from the fetched sample. This is a pure, testable client-side reduction — no new PGS console configuration, ever, regardless of season count.

**Open item for Phase 68 (not fully resolved here — LOW confidence):** the exact practical value of N (top-how-many) that balances "captures all 18 combos most of the time" against "acceptable panel load latency on a mid-range Android device over the PGS network call" needs empirical tuning during Phase 68's implementation; this research could not find a hard per-call result-count ceiling in Google's public docs to compute N analytically.

## Rate/Quotas and Offline (Phase 68 context)

- **Offline submission behavior:** the PGS SDK does **not** document any built-in offline queueing for score submissions — `submitScoreImmediate` explicitly attempts network delivery and reports success/failure; `submitScore` (non-immediate) is "fire-and-forget" but this almost certainly still requires connectivity at call time rather than persisting across app restarts [MEDIUM confidence — inferred from absence of documented offline-queue behavior in official sources, not a confirmed negative]. **Phase 68's own durable queue (PGS-04) is therefore required, not optional** — this research did not find evidence the plugin or PGS SDK itself durably persists a submission attempted while offline.
- **Idempotency / best-score semantics:** PGS leaderboards keep only the player's best score per leaderboard [CITED: developer.android.com/games/pgs/leaderboards — "checks if this score is better than the player's current leaderboard entry... before updating"]. This means **submitting the same run's score twice is harmless** at the PGS layer (a worse or equal resubmission is a no-op server-side) — but Phase 68's queue should still track submitted-hash state locally to avoid burning API quota/retry cycles on already-flushed runs, and because the scoreTag itself would be silently discarded if a resubmission loses the "is this better" check (an older/lesser score's tag never overwrites a better one already on file, even if the queue naively retries it).
- **Quota:** Google's docs mention reviewing "quota management to ensure your game does not exceed the login request quota" for sign-in — no equivalent hard number was found for leaderboard submission rate. Given this app's realistic early scale (paid, no ads, likely low hundreds of daily active players at most), this is very unlikely to be a practical constraint; flag as LOW-risk/LOW-confidence and revisit only if Phase 68 sees real-world quota errors.

## Common Pitfalls

### Pitfall 1: Assuming the plugin's `signIn()` is safe to call at module top-level
**What goes wrong:** Calling any PGS method unconditionally at import time (rather than behind the Compete-ON + native-platform guard) silently breaks D-02's zero-network guarantee for Compete-OFF players, and may also break the browser/`node --test` path since the real plugin isn't installed there.
**Why it happens:** Following `nativeChrome.js`'s pattern loosely without also porting its "read game state before touching the native layer" discipline.
**How to avoid:** Gate every entry point in `playGames.js` on the Compete flag AND `isNativePlatform()` before any dynamic import resolves, exactly as Pattern 1 above shows.
**Warning signs:** Network activity or Logcat PGS entries visible with Compete set OFF on a fresh device.

### Pitfall 2: Building "sign out" UI/state
**What goes wrong:** Any code path that tries to force PGS into a locally-tracked "signed out" state while the OS-level Play Games session remains active creates a UI that lies about the actual account state — the SDK will silently re-authenticate on the next `isSignedIn()`/`signIn()` call regardless.
**Why it happens:** Muscle memory from v1-style sign-in/sign-out systems; PGS v2's account-management-lives-in-the-OS model is a genuine platform shift from v1.
**How to avoid:** Never implement a "signed out" concept independent of Compete. "Stop competing" IS the only lever; the chip's copy and the helper line (D-03) must describe this accurately.
**Warning signs:** A QA/user report that "I tapped Stop Competing, then Sign In again immediately re-signed me in without a prompt" — this is CORRECT PGS v2 behavior, not a bug, and the copy should have already set that expectation.

### Pitfall 3: Trying to fit the full epitaph into the scoreTag
**What goes wrong:** An implementation attempt to preserve the milestone's loosely-worded "name and epitaph ride in the score tag" framing literally will either silently truncate the epitaph into gibberish or throw on a >64-char tag.
**Why it happens:** The milestone-scoping document (`.planning/proposed-milestone-leaderboards.md`) and ROADMAP.md's ealier framing predate this phase's concrete field-budget analysis.
**How to avoid:** Follow this research's settled design: name (truncated) + structured fields ride in the tag; the epitaph is dropped for global/friend rows, replaced by a generic cause-code line. Document this divergence from the looser milestone language explicitly in Phase 68's plan.
**Warning signs:** A `scoreTag` string that needs escaping/truncation logic beyond the simple name-truncation rule above — a sign the encoder is trying to cram too much in.

### Pitfall 4: Adding per-combo PGS leaderboards for LINEAGE
**What goes wrong:** Looks correct in Phase 68 (only 18 extra leaderboards, comfortably under 70), but combined with the "seasons never delete boards" design, this becomes a slow-motion budget exhaustion that only bites 2-3 seasons/years later — a silent time bomb that's easy to miss in a single-phase review.
**Why it happens:** The 70-leaderboard cap is a total-lifetime cap, not a per-season cap; it's easy to reason about "18 more boards" in isolation without projecting the multi-season math forward.
**How to avoid:** Use Option B (client-side grouping) as settled above — zero incremental leaderboard cost regardless of season count.
**Warning signs:** Any Phase 68/69 plan that proposes creating leaderboard IDs like `combo_human_fighter_s1` in Play Console.

## Code Examples

### Manifest + string resource wiring for APP_ID (D-15)
```xml
<!-- android/app/src/main/res/values/games-ids.xml (NEW) -->
<resources>
  <!-- Placeholder until the user completes docs/PLAY-GAMES-SETUP.md's console steps.
       A placeholder value here must NOT crash sign-in — PGS should simply fail to
       initialize gracefully, matching D-15's "fully playable, no crash" requirement. -->
  <string name="games_app_id" translatable="false">000000000000</string>
</resources>
```
```xml
<!-- android/app/src/main/AndroidManifest.xml — inside <application> -->
<meta-data
    android:name="com.google.android.gms.games.APP_ID"
    android:value="@string/games_app_id" />
```
Source: [CITED: modbender/capacitor-play-games README (fetched via WebFetch)] — this is the exact meta-data key/string-resource pattern the chosen plugin's Android setup requires.

### Dependency audit command (D-13's "no ads/analytics" requirement)
```bash
# After `npx cap sync android` has wired the plugin's Gradle module in:
cd android && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath | grep -i -E "firebase|admob|analytics|ads"
# (via tools/gradle.mjs's JDK-pinned wrapper invocation, per STATE.md's build pipeline)
```
Expect zero matches. The plugin's own `package.json` has `dependencies: {}` [VERIFIED: npm registry], so any ads/analytics artifact would have to arrive via the native `play-services-games-v2` Gradle module itself — which per Google's own PGS documentation is a leaderboards/achievements/identity library with no advertising or analytics collection scope. Run this command once after Phase 67's `npx cap sync` lands, before considering PGS-01 satisfied.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| PGS v1: explicit `signIn()`/`signOut()` button pair, `GoogleSignInAccount`-based auth | PGS v2: silent automatic sign-in at SDK init, no programmatic sign-out, account management moved to OS/Play Games app settings | Google's PGS v2 migration (ongoing since ~2023, current as of 2026) [CITED: developer.android.com/games/pgs/android/migrate-to-v2] | Directly shapes D-03; any tutorial/StackOverflow content referencing `signOut()` or `GoogleSignInClient` is v1-era and inapplicable |
| iOS support in the modbender fork's earlier versions | iOS support fully removed as of v0.4.0 (Android + web-no-op only) | 2026 (per fetched README changelog notes) | Irrelevant to this Android-only project, but confirms the fork actively iterates and sheds dead weight rather than being abandoned |

**Deprecated/outdated:**
- Any PGS integration guide describing a manual sign-out button — superseded by v2's OS-managed account model.
- The `@idleflowgames/capacitor-play-games` original upstream — abandoned; `@modbender/capacitor-play-games` is the maintained fork with the Gradle build fixed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@modbender/capacitor-play-games`'s Android `load()`/plugin-registration never auto-initializes PGS ambiently (only explicit `signIn()`/`isSignedIn()` calls touch the network) | Sign-in Mechanics | If wrong, Compete-OFF could leak a network call at app boot, violating D-02/the milestone's offline-constraint amendment. **Mitigation already specified:** verify empirically on-device (Logcat/network capture) during Phase 67 execution before considering PGS-02 done |
| A2 | The exact per-call `maxResults` ceiling for `loadTopScores`/`loadPlayerCenteredScores` was not found as a hard documented number | Board → Leaderboard Mapping, LINEAGE Global Form | Phase 68 may need more `loadMore()` pagination calls than expected to build a representative LINEAGE sample, affecting panel load latency — needs on-device tuning, not blocking for Phase 67 |
| A3 | PGS score submission does not durably queue offline attempts client-side (no built-in offline queue in the SDK/plugin) | Rate/Quotas and Offline | If PGS actually does queue internally, Phase 68's own durable queue (PGS-04) would be redundant-but-harmless rather than load-bearing; if PGS does NOT queue (as assumed) and Phase 68 skips its own queue, offline deaths would silently lose their global submission — HIGH impact if this assumption is wrong in the optimistic direction and Phase 68 skips the queue on that mistaken belief. Phase 68 should build the queue regardless of which way this resolves |
| A4 | `lineageKey()`'s `cls` (Fighter/Thief/Magic User) can be reliably derived from the tag's `sub` field via `content/classes.js`'s sub→class mapping, without needing `cls` as its own explicit tag field | Score-Tag Encoding, LINEAGE Global Form | If the sub→class mapping is ever ambiguous or a sub-class is reassigned to a different class in a future balance pass, LINEAGE grouping could misclassify a run. Low risk given the 24 sub-classes are already partitioned cleanly across exactly 3 classes today (8 subs per class judging by the SUB_NOTE list) |
| A5 | Package identity/existence of all three candidate npm packages, discovered via WebSearch/training data | Standard Stack, Package Legitimacy Audit | Registry existence was independently confirmed via `npm view`/the package-legitimacy gate, but the packages' actual code quality/security posture beyond README claims was not independently code-reviewed in this research pass — hence the `checkpoint:human-verify` gate recommendation before `npm install` |

## Open Questions

1. **What is the real per-call pagination size for `loadTopScores`/`loadPlayerCenteredScores` via the modbender plugin specifically (as opposed to the raw Android SDK)?**
   - What we know: the underlying Android `LeaderboardsClient` supports a caller-specified `maxResults` and `loadMore()` pagination; the plugin's TypeScript surface exposes `loadTopScores(opts: LoadScoresOptions)` per its README extract.
   - What's unclear: the plugin's own `LoadScoresOptions` shape/defaults were not fully enumerated in this research pass (the WebFetch summary named the method but not its full options object).
   - Recommendation: Phase 68 should read the plugin's actual `.d.ts`/README section for `LoadScoresOptions` directly once it's installed, and empirically test pagination volume needed for a representative LINEAGE sample on a real device.

2. **Does the modbender plugin's web (browser) fallback shape exactly match what `src/browser/playGames.js`'s in-memory fake needs to mirror, or does the fake need to diverge from the plugin's own web no-op?**
   - What we know: the plugin ships "a safe web no-op fallback" where "every method resolves to a safe default (signed out, empty)."
   - What's unclear: whether that web fallback is even reachable/relevant given this project never runs the plugin's web build (the dynamic-import-native-only pattern means the browser dev loop never imports the plugin at all, real or fallback).
   - Recommendation: build the D-12 fake independently per this research's Pattern 2 sketch; treat the plugin's own web fallback as irrelevant since it's never loaded in this project's architecture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Capacitor CLI / build tooling | ✓ | v22.23.2 (verified via `node --version`) | — |
| npm | package install / `npm view` verification | ✓ | 10.9.8 | — |
| AGP / Gradle / JDK pin | Native Android build | ✓ (per STATE.md Ground Truth — AGP 8.13.0, Gradle 8.14.3, JDK 21, already verified and pinned prior to this phase) | AGP 8.13.0 / Gradle 8.14.3 / JDK 21 | — |
| `@modbender/capacitor-play-games` (not yet installed) | PGS-01 | ✗ (not in `package.json` yet — this phase's own deliverable) | latest verified: 0.5.0 | Fallback candidates ranked below it in Standard Stack/Alternatives if it proves unworkable during implementation |
| Google Play Console PGS project + APP_ID | Real sign-in (D-15 requires graceful failure without it) | ✗ (user must complete `docs/PLAY-GAMES-SETUP.md` runbook this phase produces — out of this phase's own execution) | — | Placeholder `games_app_id` string resource; sign-in fails gracefully, chip stays "nobody," fully playable per D-15 |
| Pixel 7 physical device | On-device verification of A1 (zero-network Compete-OFF claim) and general PGS sign-in flow (PGS cannot be tested on an emulator without Play Services configured) | Not probed in this research session (device availability is a runtime/user concern, not a research-time check) | — | — |

**Missing dependencies with no fallback:**
- Google Play Console PGS project/APP_ID — genuinely requires the user's own console access; this phase's `docs/PLAY-GAMES-SETUP.md` runbook (D-16) is the intended bridge, not a code fallback.

**Missing dependencies with fallback:**
- `@modbender/capacitor-play-games` not yet installed — this phase installs it; if it proves broken during implementation, the Alternatives Considered table names the fallback path (fork/vendor, since the two alternative npm packages are both disqualified above).

## Sources

### Primary (HIGH confidence)
- Direct inspection of this codebase: `engine/records.js`, `engine/death.js`, `content/boards.js`, `content/epitaphs.js`, `content/names.js`, `content/classes.js`, `src/browser/nativeChrome.js`, `src/browser/settings.js`, `package.json`, `android/app/build.gradle`, `android/build.gradle`, `android/variables.gradle`, `capacitor.config.json`, `design/Mazeworld Boards Panel.dc.html` — all read directly this session
- `npm view @modbender/capacitor-play-games` (version, time.modified, peerDependencies, license, scripts.postinstall, dependencies) — live registry query, this session
- `gsd-tools query package-legitimacy check` — live tool output, this session

### Secondary (MEDIUM confidence)
- https://developer.android.com/games/pgs/android/migrate-to-v2 — PGS v2 auto sign-in / no programmatic sign-out
- https://developer.android.com/games/pgs/leaderboards — scoreTag not found here directly but sort order/formatting/70-leaderboard cap/tamper protection confirmed
- https://developer.android.com/games/pgs/friends — Friends API consent flow, data exposed
- https://developer.android.com/games/pgs/android/leaderboards — `LeaderboardsClient`, `submitScoreImmediate`, pagination existence (not exact limits)
- https://developers.google.com (ScoreSubmission/scoreTag 64-char RFC 3986 §2.3 constraint) — cross-confirmed via two independent WebSearch queries
- https://github.com/modbender/capacitor-play-games — full API surface, Android setup, AGP/Gradle/JDK compatibility claims (via WebFetch)
- https://github.com/openforge/capacitor-game-connect and https://www.npmjs.com/package/@openforge/capacitor-game-connect — Capacitor version support, maintainers, method list (via WebFetch/WebSearch)
- https://github.com/scottcl88/capacitor-google-game-services — API surface, Capacitor v6, PGS SDK v2:17.0.0 (via WebFetch/WebSearch)
- mvnrepository.com/artifact/com.google.android.gms/play-services-games-v2 — current version 21.0.0, minSdkVersion 24 (matches this project's minSdk)

### Tertiary (LOW confidence)
- Exact per-call `maxResults` pagination ceiling for `loadTopScores` — not found as a hard documented number in any source consulted; flagged as Open Question 1 and Assumption A2
- PGS offline-submission-queue behavior (or lack thereof) — inferred from absence of documentation, not a confirmed negative (Assumption A3)

## Metadata

**Confidence breakdown:**
- Standard stack (plugin choice): MEDIUM — cross-checked via npm registry directly + GitHub README fetch + package-legitimacy gate; package is legitimately niche/low-download, not verified as production-battle-tested by this research
- Sign-in mechanics: MEDIUM-HIGH — Google's own official migration docs are unambiguous on the no-sign-out/auto-sign-in behavior; the "never auto-inits ambiently" claim for this specific plugin is an inference (Assumption A1), not directly verified against its Kotlin source
- Score-tag encoding design: HIGH for the 64-char/charset constraint (directly cited, cross-confirmed); MEDIUM for the specific field-width proposal (a reasonable, budget-verified design, not the only valid one — Phase 68 should treat exact widths as adjustable)
- LINEAGE global form: MEDIUM-HIGH for the "per-combo boards violate the 70-leaderboard cap" finding (directly computed from a cited hard limit); MEDIUM for "Option B is the right call" (a reasoned recommendation, not the only defensible choice — Option C remains a safe fallback)
- Pitfalls: MEDIUM — grounded in the platform's documented v1→v2 shift and this project's own architecture, not incident reports from other teams shipping this specific plugin

**Research date:** 2026-09-23
**Valid until:** 30 days (PGS platform mechanics/leaderboard caps are stable; the specific plugin's version/maintenance status should be re-checked if Phase 68 execution happens more than ~30 days after this research, given its recency and small download base)
