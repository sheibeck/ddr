# DR17 + DR18 — Summary (built + deployed 2026-09-13)

Both batches were written in source on 2026-09-10 (the session hit the token limit right after the DR18 edits at 09:33, before any build). Built, synced, and sideloaded to the Pixel 7 on 2026-09-13. `npm test` = **683/683**, parity byte-identical.

## DR17 — Encounter/condition UX (see DR17-CONTEXT.md)
1. **Active phobia chip** — `conditionsOf(state)` (`engine/derived.js`) emits `{key:"phobia", polarity:"bad", phobia}` while the fear grips the CURRENT combat (type-matched freeze / Darkness-in-the-dark / Death-panic threshold); HUD tracker renders "Phobia: <fear>". Pure read.
2. **Darkness = own square only** — `reveal()` radius 0 in true darkness (no Night Vision), ignoring the `sight` widen.
3. **One-screen Joiner / find prompts** — `joinerMet`/`findOffered` narration renders inline above accept/decline / Take/Leave; no intermediate "Move on" beat.
4. **Fight! gate** — presentation flag `combat.awaitingFight` (also `beats.awaitingFight` for ambush deaths): foe roster + single Fight! button, action bar hidden, initiative/first-turn narration suppressed until pressed. Engine `startCombat` unchanged (initiative still rolls there). Camp/wandering starts gated too.

## DR18 — Backlog closeout (no CONTEXT file was written; reconstructed from code comments)
- **DR15-C** — "View the Dead" secondary button on the title screen, shown only when the graveyard is non-empty; opens the existing DEAD tab (re-fetches storage).
- **DR15-E** — `diceMode` setting REMOVED (`settings.js`, Settings sheet, `#app[data-dice-mode]`, on-tap reveal, `.mw-oracle-hint`). Rolls always visible in the Oracle `#log`, never in `#enc-body` (single static CSS rule).
- **Fix 3** — engine `equipRejected` event now toasts "You cannot use that." (was a silent UI no-op).
- **Fix 4** — `S.combat.weakened` (Weaken spell) now shows a green "Weakened" chip on each foe row.
- **DR16-F** dropped per user directive.

## Deploy notes
- The Play-installed build (uploaded 2026-09-10 from `android/app/release/app-release.aab`, versionCode 1) was built from a `www/` that PRE-DATES DR18 — internal testers on Play do NOT have DR18 until the next AAB upload.
- Play-signed installs cannot be overwritten by local APKs (signer mismatch); the user uninstalled the Play build before this sideload.
