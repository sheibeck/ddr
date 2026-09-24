---
phase: 67-play-games-integration-account-chip
status: passed
verified: 2026-09-24
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 4/4 requirements
human_verification:
  - "RELEASE-BLOCKING (D-20 as-is): Compete OFF cold boot with adb logcat + network capture — the game makes no PGS sign-in, submit or fetch; record what Google's SDK init does on its own (for the privacy text)"
  - "Compete OFF + airplane mode: cold boot and a full run play normally with no boot stall"
  - "Placeholder APP_ID, Compete ON: nobody chip, exactly one PLAY GAMES DID NOT ANSWER rail card after ENTER (not over title/roller), normal play, no crash"
  - "No Play Games profile on the device: the game is fully playable"
  - "Band 2 at text sizes S/M/L: counters don't clip, account chip sits directly left of ☰ (L computes 477.8px — may clip); band-2 height unchanged; ☰ dropdown and scrim behave as before"
  - "Title chip top-right, clear of status bar, cutout and the splash art's text; nobody face reads as deliberate on HUD and title"
  - "Account sheet opens from both chips; its Settings row opens the settings sheet above the title screen"
  - "Android back closes the account sheet first over the title, the title-mode Leaderboards panel and the map"
  - "Band-2 chip is ignored during combat/encounters; the title chip is unaffected"
  - "Voice read of the welcome card (ON THE PUBLIC RECORD), the failure card, the Stop competing helper and the Compete OFF line — never implies sign-out"
  - "After console setup: tester auto-signs in — initials on both chips, welcome card once (never again after restart), Leaderboards strip shows PLAY GAMES · SIGNED IN"
  - "After console setup: the Sign in row (silent:false) signs a tester in; declining shows the failure card, nothing modal, no automatic retry"
  - "Stop competing flips both chips and the strip to nobody at once; Compete ON again signs back in silently (pending, then avatar)"
  - "Signed in: ALL/FRIENDS chips not dimmed and show the coming-online notes; Compete OFF restores the signed-out strip and dimmed chips; GRAVEYARD has no strip"
  - "Console: walk docs/PLAY-GAMES-SETUP.md in Play Console and confirm each menu path; debug-keystore keytool prints a SHA-1 (only if testing sign-in on a local debug APK)"
---

# Phase 67: Play Games Integration & Account Chip — Verification

**Verdict:** passed on automated evidence. The device checks above are deferred to the milestone's batched Pixel 7 checklist (Phase 69, `docs/UAT-v2.0.md`) per the deferred-UAT protocol. Checks that need a real APP_ID wait on the user's Play Console setup (runbook `docs/PLAY-GAMES-SETUP.md`, finished in Phase 69).

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| PGS-01 | Plugin chosen and reviewed read-only before install (67-01, `67-01-PLUGIN-REVIEW.md`: registry integrity match, no install scripts, no network/ads/analytics code of its own); AGP 9.3.1 spike (`67-AGP9-SPIKE.md`: stay on 8.13.0, no Gradle fix); exact pin 0.5.0 with lock integrity and `PlayGamesPlugin.kt` sha256 pinned, APP_ID placeholder resource, vendored into `www/` (67-06); `:app:dependencies` audit shows only play-services-games-v2 / base / basement / tasks, zero Firebase, ads, analytics or crash SDKs; debug APK builds (67-06, 67-08); `play-games-intake.test.js` (14) | ✓ |
| PGS-02 | Provider seam with native and fake implementations, lazy plugin load, silent boot sign-in, interactive Sign in (`silent: false`), no method throws, identity carries no image URL (67-02); controller boots only with Compete ON, never awaited, one failure card, no auto-retry, stale results discarded by token (67-07); shell boots it after the title IIFE, fake provider in the browser dev loop (67-08); `playGames.test.js` (30), `accountChip.test.js` (37), `shell-account.test.js` (23) | ✓ (device sign-in deferred) |
| ACCT-01 | The account chip takes the band-2 slot left of ☰ and the title's top-right corner, 44×44, avatar/nobody/pending faces (67-05); renderers (67-07); wired to both chips (67-08); `account-layout.test.js` (13), `accountChip-dom.test.js` (19) | ✓ (device look deferred) |
| ACCT-02 | Account sheet rows: identity, Sign in / Stop competing / pending, helper line, Compete ON/OFF, Settings (67-03 copy + view model, 67-07 renderer); Compete persisted in `ddr.settings.v1` (67-02); Stop competing is `setCompete(false)` with no fake sign-out (D-03); Leaderboards strip shows the signed-in identity through the `identity()` seam (67-04, 67-08); `account-copy.test.js` (15), `account.test.js` (32), voice safety and HP-not-WP scans register `ACCOUNT_COPY` | ✓ |

## Automated gates

- Full `npm test` on master after the final merge (d830a6a): **4690/4691 pass**. The one failure is `sfx-assets.test.js` AUD-06, caused by the user's untracked `sfx/theme.mp3` (tracked in the theme-music todo), not by Phase 67 code.
- Worktree-only: the 7 known CRLF doc-ledger failures, passing on master.
- `node tools/bridge-doc.mjs --check` passes; `docs/SHELL-MODULES.md` has the "Play Games account (Phase 67)" section.
- Debug APK built twice (67-06, 67-08) on AGP 8.13.0 / Gradle 8.14.3, JDK 21; no AAB built in this phase.
- Engine gate: `engine/` and `test/parity/prototype-master.js.txt` untouched; no fixtures moved.
- Decision coverage 21/21 at plan time; requirements 4/4.

## Rulings and deviations worth carrying forward

- D-20 (as-is) means Google's SDK initializes at every launch even with Compete OFF. The game itself makes no PGS calls while OFF (the controller is proven with a recording Proxy). The Phase 69 privacy text must say this plainly.
- D-21: AGP 9.3.1 is blocked upstream by the plugin's own Kotlin (`Pgs.kt:144`); recorded in `docs/RELEASING.md` and the R8/AGP 9 todo.
- 67-08 delays the waiting-card check with `queueMicrotask` so an account card never lands behind the roller or the title-opened panel.
- 67-02 widened `shell-gear-toolbar.test.js` to 8 settings keys; 67-08 updated three existing shell pins (closeModal order, `routeFromBoards`, `mzKeepPartyInView` count 7 → 8).
- Phase 68 hand-offs: `RESERVED_LEADERBOARD_METHODS` on the provider, `game_services_project_id` placeholder `000000000000`, and the `identity()` seam on the panel.
