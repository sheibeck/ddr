---
created: 2026-09-28T00:00:00.000Z
title: Patch notes with every Play release (one source, in-game, GitHub release, Play "What's new")
area: release
files:
  - docs/RELEASING.md (the release checklist this adds a step to)
  - android/version.properties (versionName/versionCode that name the notes file)
---

## Problem

User, 2026-09-28: "Whenever we build a new version for deploying to google play store, that should come with a detailed set of patch notes. Make it human readable, but break it down clearly. If we make adjustments to items or races or classes we should organize our notes in a readable fashion, categorizing and organizing notes together in a way that makes sense. I'm thinking we should put these patch notes into github and tag the version. Then we can link to the patch notes from the player menu as a link? Do you have a better idea?"

## Solution (proposed to the user; they pick the scope)

**One source of truth per release:** `docs/patch-notes/<versionName>.md`, written before the release build and agreed with the user. That's the standing rule; see the memory patch-notes-before-release-build. Its categories, in a fixed order, with empty ones dropped:
1. Headline: two or three sentences on what this update is about.
2. Classes: grouped per class, then per sub-class.
3. Races.
4. Abilities and spells.
5. Items and gear.
6. Monsters and difficulty.
7. Interface.
8. Bug fixes.

Each entry states the old value → the new value in plain words, e.g. "Thief: flee bonus +5 → +3". The voice is the house voice, but the facts come first.

**Three outputs from that one file:**
1. **GitHub:** a tag plus a GitHub Release (`gh release create v<versionName>`) whose body is the file. The repo is public, so this is the shareable web copy.
2. **In-game:** the notes ship inside the app as a PATCH NOTES row in the ☰ menu, opening a sheet that shows the current version's notes. Optionally they show once automatically after an update.
   - **Why this rather than only a link:** the game is offline-first. A GitHub link fails without signal and throws the player out to a browser. Bundled notes always work. The sheet can still carry a "past versions on GitHub" link for anyone curious.
3. **Play Console:** the "What's new in this release" field, which is limited to 500 characters. Use a short summary cut from the Headline plus the top bullets.

## Open

Scope: build the in-game viewer in v2.1 (before the release build) or later, and the auto-show on update (yes or no).

## Resolution (v2.1 close, 2026-09-28)
Closed by v2.1 Phase 79.3 (see its VERIFICATION.md). Device feel checks are in docs/UAT-v2.1.md.
