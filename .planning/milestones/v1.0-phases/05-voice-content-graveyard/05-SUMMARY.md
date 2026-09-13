---
phase: "5"
name: Voice, Content & Graveyard
status: complete
completed: 2026-09-09
tests: 605/605
requirements: [VOX-01, VOX-02, VOX-03]
---

# Phase 5: Voice, Content & Graveyard — SUMMARY

**Complete 2026-09-09.** `npm test` = **605/605**. Executed as a REASSESSED phase: two of the three original plans (05-01, 05-03) were already satisfied incrementally during the Phase-4/04.1/04.2 device-review work, so only the genuine gap (VOX-02) was built. This avoided constructing a redundant parallel voice system.

## Requirement outcomes
- **VOX-01 (data-driven voice system) — ✅ satisfied by prior work.** The shipped voice is `src/browser/eventNarration.js` (`EVENT_NARRATION`, 177 entries — the "one place events become copy"), wired into the Oracle log via `src/browser/engineAdapter.js` `formatEvents`, guarded by `test/unit/formatEventsCoverage.test.js` (fails the build on any unmapped event type). The original 05-01 plan proposed a NEW `presentation/voice.js` generator — deliberately NOT built (it would duplicate eventNarration.js). Plans 05-01/05-02's generator-and-wiring tasks are obsolete.
- **VOX-02 (family-friendly safety guardrail) — ✅ BUILT this phase.** New `content/safety-wordlist.js` (vendored LDNOOBW en, CC BY 4.0, attributed + hand-curated SLURS/SEXUAL/GORE; deliberately does NOT ban core fantasy vocab kill/dead/blood; Scunthorpe allowlist of 2 load-bearing whole-word collisions — "bastard"→Bastard Sword, "balls"→Fireballs description). New `test/voice/safety-scan.test.js` (6 tests) — an exhaustive standing guardrail driven off the exported `EVENT_NARRATION` + `EPITAPHS`/`CAUSE_TEXT` + all authored `txt`/note banks (auto-covers future copy), word-boundary aware, with meta-tests proving the allowlist is complete and load-bearing and the matcher isn't vacuously green. **Scanned all existing copy → zero banned matches (no copy edits needed).** Plus `tools/voice-sample.mjs` → `tools/voice-sample-output.txt` (622-line deterministic human-review artifact for the manual tone skim).
- **VOX-03 (graveyard/run-history screen) — ✅ satisfied by prior work.** The re-fetch-on-open fix is the 04.2 E9 change (`mazeworld.html` `showTab()` → `loadGraves().then(renderGraves)`, ~line 1513) + the E12 graveyard rework (cap 5, running total, non-clearable). Every death persists to `GRAVE_KEY` (all causes) and the Dead tab reloads from storage on open.

## No device deploy needed
VOX-02 is a test-only guardrail (+ a dev tool); no runtime/copy change shipped, so it's unaffected by the Pixel 7 being offline.

## Phase 5 = COMPLETE (VOX-01/02/03). Remaining v1.0: tutorial (04-10, LAST) → Phase 6 Play launch (user's account/signing/store steps).
