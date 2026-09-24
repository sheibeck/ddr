---
phase: 69-compliance-device-close
status: passed
verified: 2026-09-24
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 4/4 requirements
human_verification:
  - "Upload android/app/build/outputs/bundle/release/app-release.aab (2.0.0, versionCode 9, sha256 bcaaa1b3…3f97) to Play closed testing by hand"
  - "Review darktier-studio commit aaa0f4a (privacy/apps + privacy/delete-data) and deploy the website"
  - "Walk docs/PLAY-GAMES-SETUP.md section 6 in Play Console; send Claude the APP_ID and the five Season-1 leaderboard IDs; rebuild at versionCode 10; run the section 11 tester check; publish the PGS config at least 2 hours before a production rollout"
  - "Enter the Data safety answers from store-listing/LISTING.md with both privacy URLs; decide the Diagnostics declaration after the F1 capture"
  - "Paste the re-voiced store description; regenerate 08-dead.png (Leaderboards panel) at 1080×1920, 1350×2400, 1620×2880"
  - "Walk docs/UAT-v2.0.md on the Pixel 7 (75 rows; F1 Compete-OFF capture is RELEASE-BLOCKING and walked first)"
---

# Phase 69: Compliance & Device Close — Verification

**Verdict:** passed on automated evidence. Everything left is a user action (website deploy, Play Console, AAB upload, the Pixel 7 batch), recorded as deferred items per D-06/D-07/D-09; none blocks the milestone close.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| COMPLY-01 | `apps.astro` reconciled with what 2.0 sends: Compete on by default with possible auto sign-in at launch, zero game PGS calls with Compete off while Google's SDK still starts (67 D-20), the what-is-sent list mirroring the v1 tag field by field, not-sent list (epitaph, saves, settings, bests, graveyard), Stop competing instead of sign-out, share and death-count sections removed, new effective date; `delete-data.astro` steps replaced with Google's current routes (answer/9130646, fetched 2026-09-24). darktier-studio commit aaa0f4a (local, not pushed); site build passes. Record in `store-listing/LISTING.md` (69-01) | ✓ (deploy deferred) |
| COMPLY-02 | LISTING Data safety: User IDs + App activity (Other actions) collected, optional, App functionality, encrypted in transit, not shared (service-provider and user-initiated exemptions, answer/10787469 cited), not sold, deletable; Diagnostics recorded as the user's console-time decision after F1. Source-level audit (69-01) and build-level audit of the 2.0.0 AAB (69-04): no ads/analytics/crash SDKs, permissions INTERNET + VIBRATE + androidx receiver only, no AD_ID, google-services never applied. Re-voiced offline bullet; `test/unit/store-listing.test.js` (6) | ✓ (console entry deferred) |
| COMPLY-03 | `docs/PLAY-GAMES-SETUP.md`: 11-step order-of-operations checklist (section 6), board table with typed names and orderings, ID paste targets, APP_ID, both SHA-1 credentials, testers / release tracks, tester check (section 11), new publishing section 12 (source fetched 2026-09-24), season bump; `play-games-runbook.test.js` 47/47 (69-02) | ✓ (console walk deferred) |
| COMPLY-04 | Signed AAB 2.0.0 / versionCode 9 built and verified (upload-key cert, merged manifest 9 / 2.0.0, exactly 30 sfx clips, no theme.mp3), tagged `v2.0.0-play9` → 8a94af5, not uploaded (69-04); `docs/UAT-v2.0.md` 75-row batch with every 65–68 VERIFICATION item mapped (59) plus 91 SUMMARY items, F1 RELEASE-BLOCKING first, D-08 uninstall warning (69-03) | ✓ (upload + device walk deferred) |

## Automated gates

- `npm test` on master with `sfx/theme.mp3` set aside: **5045/5045 pass** (69-04 pre-flight). With the user's untracked clip restored, only AUD-06 fails, as expected.
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`, 10,352,033 bytes, sha256 `bcaaa1b30fcf0b4683c2c78236880bb03becafbd9239edcf1ff6366664813f97`.
- Toolchain unchanged (AGP 8.13.0 / Gradle 8.14.3); `sfx/theme.mp3` restored with a matching sha256 and never staged.
- Engine gate: `engine/` and `test/parity/` untouched.
- Decision coverage 9/9 at plan time; requirements 4/4.

## Notes

- The 2.0.0 (9) build carries the placeholder APP_ID (`000000000000`) and `PLACEHOLDER_` leaderboard IDs, so Play Games sign-in fails gracefully and every board is skipped; deaths queue on the device (capped at 50). Leaderboards go live with the versionCode 10 rebuild after the console setup (UAT row 0.2).
- The listing screenshot `08-dead.png` is owed: `playwright-core` is not installed and installing it was out of scope.
