---
phase: 69-compliance-device-close
plan: 03
subsystem: docs / UAT
tags: [uat, device-round, compliance, play-games, COMPLY-04]
status: complete
requires:
  - 65-VERIFICATION.md, 66-VERIFICATION.md, 67-VERIFICATION.md, 68-VERIFICATION.md (human_verification lists)
  - Phase 65 to 68 per-plan SUMMARY "Human verification (deferred to end of run)" sections
provides:
  - docs/UAT-v2.0.md, the v2.0 batched Pixel 7 checklist, with a Source map
affects:
  - 69-04 (fills the Play build line in the Build paragraph)
  - milestone close (orchestrator adds the debug APK line and makes the D-08 install offer)
tech-stack:
  added: []
  patterns: [deferred-UAT batch in the UAT-v1.9 house format, Source-map completeness check]
key-files:
  created:
    - docs/UAT-v2.0.md
  modified: []
decisions:
  - "F1 (Compete-OFF cold-boot capture) is walked on the Play build, on a fresh install whose first launch is in airplane mode so Compete can be turned OFF before anything can sign in"
  - "The 65-V2 install-over-graves check (row A1) is the one carve-out before F1's uninstall, walked only if the v1.9 sideload is still on the phone; otherwise not reached"
  - "Cross-area voice items (65-V1, 67-V10, 68-V15) go in a section K; 66-V1 (panel copy only) stays in B"
  - "A9 (clear app storage) closes the walk because it wipes the data every other row depends on"
metrics:
  duration: ~25 min
  completed: 2026-09-24
  tasks: 2
  files: 1
---

# Phase 69 Plan 03: v2.0 Pixel 7 UAT Batch Summary

docs/UAT-v2.0.md is the milestone's one batched device checklist, in the UAT-v1.9 house format. It merges all 59 VERIFICATION human_verification items and the 91 SUMMARY extras from Phases 65 to 68 into 75 rows. Section 0 holds the user's deferred console, website, Data safety, listing and upload steps. The Compete-OFF cold-boot capture is row F1, marked RELEASE-BLOCKING and walked first after section 0. A Source map proves every source item is mapped.

## What shipped

- **Header:** H1, Build (69-04 and the orchestrator fill it in), Protocol (deferred-UAT; written and not run; `pass` / `fail: …` / `not reached`), the D-08 **install warning** (different signers, so an uninstall deletes the run, graveyard, bests, settings and queued submissions), the sign-in note (console setup needed; a debug APK also needs the debug-keystore credential, PLAY-GAMES-SETUP.md section 3), Sources, and the Suggested order.
- **Sections and row counts:** 0 (10), A new-best block and run record (9), B the Leaderboards panel on every board (17, including three `(edge)` rows), C title vs tab entry and back (9), D sign-in (5), E the account chip and menu (5), F Compete OFF and the capture (3), G the offline queue (3), H "you placed X" (5), I seasons (2), J airplane mode (3), K the cross-area voice read (3), Z the desk check (1). That makes 75 rows: 64 device rows in A to K, 10 user steps in 0 and 1 desk row in Z.
- **Source map:** 150 lines, one per inventory entry: 59 `[NN-Vk]` and 91 `[NN-PP-Sk]`. Each gives the row and the disposition.
- **Tally:** "0 walked … RELEASE-BLOCKING row F1 must pass before any production rollout."

## Per-phase item counts (live, recounted from the files)

| Phase | VERIFICATION items | SUMMARY extras |
|-------|--------------------|----------------|
| 65 | 10 | 10 (65-03: 1, 65-04: 3, 65-05: 6) |
| 66 | 18 | 19 (66-02: 1, 66-03: 2, 66-04: 2, 66-05: 3, 66-06: 5, 66-07: 6) |
| 67 | 15 | 32 (67-01: 2, 67-02: 3, 67-03: 4, 67-04: 4, 67-05: 5, 67-06: 3, 67-07: 3, 67-08: 8) |
| 68 | 16 | 30 (68-01: 3, 68-02: 3, 68-03: 4, 68-04: 3, 68-05: 3, 68-06: 8, 68-07: 6) |
| **Total** | **59** | **91** |

65-01, 65-02 and 66-01 say None and contribute nothing.

## Merges, splits and supersessions applied

- **65-04's three items** merge into 65-V2 to V4 (rows A1, A3, A9). **65-05's six** merge into 65-V5 to V10.
- **One RELEASE-BLOCKING row (F1):** 67-V1 + 67-01-S1 + 67-06-S2 + 67-08-S5's capture clause. **68-V8** (Compete OFF, *die*) stays its own row, F2, because it is a different moment.
- **Superseded by Phase 68 live boards:** 67-04-S2 and 67-V14's "coming-online notes" clause map to B13/B16. 67-V14's Compete-OFF clause is kept as F3 (shared with 68-V14, same moment), and its GRAVEYARD-no-strip clause is B12.
- **68-01's console items** (plus 68-V1 and 67-V15) go into section 0: 0.1 (walk the runbook, create the boards), 0.2 (send the IDs, rebuild) and 0.10 (debug keytool). 68-01-S3 (the tag in the console) merges into H1.
- **Extras with no VERIFICATION twin:** 68-02-S3 becomes H5 (optional lag check) and 68-06-S6's second-season chips become I2.
- **66-V10 merges into 65-V3 (A3):** both check the Dead tab count rising after a death.
- **Splits (one source item, two moments):** 67-V12 becomes D4 (decline) and D5 (accept). 68-V3 becomes H2 (fade) and H3 (reduced motion). 68-V11 becomes B15 and J3 (airplane clause). 68-V13 becomes B17 and I1 (SEASON label).
- **68-V16 / 68-07-S6** (browser dev loop) is the desk section Z1.

## Verification

- Task 1 greps: `RELEASE-BLOCKING` 3, `^## [0A-Z]\. ` 13 section headings, `| # | Step | Who | Result |` 13 tables.
- Source-map completeness command: **"all 59 VERIFICATION items mapped"**, exit 0. An extra cross-check confirmed every Row reference in the map resolves to a real UAT row. The only rows with no source are the section-0 user steps from D-02, D-04, D-05, D-06 and D-07 and the three plan-mandated `(edge)` rows (B1, B2, B9).
- `npm test` (after `npm ci`, since node_modules was missing in the worktree): 5017 pass, 7 fail. The 7 are the known CRLF doc-ledger tests (1057 to 1059, 1067, 1822 to 1824), which fail in every worktree. Nothing else moved. No engine/ or test/parity/ edits.

## Deviations from Plan

- **Walk-order carve-out (within the plan's "adjust if the inventory suggests a better walk"):** 65-V2 (install over an install with graves, the bests backfill) can only be walked on the pre-v2.0 install, and F1's fresh install destroys it. Row A1 is therefore the one step allowed before F1's uninstall, only if the v1.9 sideload is still present. It runs offline and does not touch Compete. F1 is still the first item after section 0 in the Suggested order, and the first row of section F.
- **F1 setup detail added:** Compete defaults to ON on a fresh install (67 D-01), so to be "Compete OFF before any sign-in" the first launch has to be offline. The step says so, and names PCAPdroid as one example of a per-app capture tool.
- **Section K used:** three voice items span several areas (65-V1, 67-V10, 68-V15), which is the case the plan allows for.

Otherwise the plan was executed as written.

## Known Stubs

None. The Build paragraph is intentionally a placeholder sentence: 69-04 fills in the Play build and the orchestrator adds the debug APK at the close, as the plan specifies.

## Self-Check: PASSED

- FOUND: docs/UAT-v2.0.md
- FOUND: 961bb7d (Task 1), 584302a (Task 2)
