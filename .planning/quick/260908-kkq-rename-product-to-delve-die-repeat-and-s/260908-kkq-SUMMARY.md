---
quick_id: 260908-kkq
slug: rename-product-to-delve-die-repeat-and-s
status: partial
date: 2026-09-08
commit: f81942f
---

# Summary — Rename Mazeworld → "Delve, Die, Repeat"

**Status: partial.** App identity + visible UI chrome renamed and committed
(`f81942f`). Deeper renames (content flavor strings, persistence keys, icon/
splash) captured in PLAN.md and intentionally deferred — see below.

## Completed (commit f81942f)
- **App identity:** appId `com.darktierstudios.delvedierepeat`, appName /
  display name / launcher label "Delve, Die, Repeat" (capacitor config,
  build.gradle namespace+applicationId, strings.xml ×4, MainActivity.java
  package move, package.json name+description).
- **Visible chrome** (mazeworld.html → www/index.html): <title>, <h1>,
  meta/og; "Maze Master's notes"→"Dungeon Master's notes"; tutorial "No Maze
  Master"→"No Dungeon Master"; canvas aria-label "Maze map"→"Dungeon map".
- Verified via `npm run build:www`: no visible "Mazeworld" in built chrome.

## Deferred (see PLAN.md) — reasons
- **Test suite is RED** (`npm run test:quick` → pre-existing MODULE_NOT_FOUND;
  dirs exist, runner can't resolve them). Several remaining renames are
  asserted by tests, so they need a green suite to verify. Fix runner first.
- **Prototype-is-not-the-app** (user directive): the deep content/persistence
  renames should land in the modular sources (engine/content/src) as part of
  moving the real UI off the mazeworld.html prototype — not duplicated across
  the current hybrid.
- Greenfield ⇒ no save/migration risk on any of it; safe whenever done.

## Open decisions (need user input)
1. Visible credit line "Built from the Mazeworld rulebook — …/mazeworld.pdf":
   keep (attribution to the real 1994 work) or reword?
2. Asset art typo: file is `assets/ddr_splah.png` (missing "s") — rename?
3. Icon/splash generation approach: install @capacitor/assets vs Android
   Studio Image Asset Studio (repo has no asset generator).
4. git remote https://github.com/sheibeck/ddr — add + first push? (needs
   explicit go-ahead).
