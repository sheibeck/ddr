---
id: SEED-001
status: scoped (planned v2.0 Leaderboards, 2026-09-23; not started)
planted: 2026-09-17
planted_during: v1.5 / Phase 37→38 (Meaningful Choices)
trigger_when: next milestone after v1.5, or any milestone touching the death screen, graveyard, Play listing, top-bar cog/settings, or social/multiplayer
scope: large
---

# SEED-001: Leaderboards & Share — competition out of the Death screen

## Why This Matters

The death screen is the retention moment; personal bests + "you placed X" + a share-the-tombstone invite turn permadeath into the growth loop for a paid, ad-free app. Full write-up with option research: `.planning/proposed-milestone-leaderboards.md`.

## When to Surface

**Trigger:** next milestone after v1.5, or any milestone touching the death screen, graveyard, Play listing, top-bar cog/settings, or social/multiplayer.

This seed will surface during `/gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Large** — a full milestone: local bests + share (offline-safe), then opt-in Google Play Games Services v2 leaderboards with friends (auto sign-in, no login form), account chip replacing the config cog, Data Safety / privacy-policy changes.

## Breadcrumbs

- `engine/death.js` — `buildRunSummary()` is the per-run record every board reads (floor, steps, race/sub/cls, kills, when)
- `src/browser/engineAdapter.js` — `ddr.graveyard.v1`, `ddr.graveyard.total.v1`, `ddr.best.v1` cross-run keys via `mzStorage` (Capacitor Preferences)
- `src/browser/storage.js` — durable storage abstraction to extend with a per-board bests record
- `src/browser/settings.js` / `nativeChrome.js` — home of the config cog that becomes the account chip
- `.planning/proposed-milestone-leaderboards.md` — research + option table (PGS vs own backend vs share-only)
- `.planning/proposed-milestone-joiners-party-system.md` — party runs may need their own board flag

## Notes

Recommended path: local bests + tombstone share first (no compliance change), then PGS v2 opt-in. Add `seed`/`actions`/`rules` version to the run summary early so later boards aren't poisoned by balance changes.
