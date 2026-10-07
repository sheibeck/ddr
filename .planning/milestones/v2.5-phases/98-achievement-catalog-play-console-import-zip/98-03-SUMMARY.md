---
phase: 98-achievement-catalog-play-console-import-zip
plan: 03
subsystem: tooling
tags: [achievements, play-games, zip, validator, docs]
requires:
  - "98-01: content/achievements.js catalog structure, icon set trimmed to 77"
  - "98-02: the 231 copy fields"
provides:
  - "tools/lib/achievements-zip.mjs: stored-zip writer, bounded reader, CSV builders, 25-rule validateZip, copyTable"
  - "tools/achievements-zip.mjs: --build, --check, --copy-table CLI (exit 0/1/2)"
  - "docs/ACHIEVEMENTS.md and the generated docs/ACHIEVEMENTS-COPY.md"
  - "the built, git-ignored build/achievements/ddr-achievements.zip"
affects: [99, 100, 101]
tech-stack:
  added: []
  patterns: ["thin CLI over a Node-built-ins library", "validator with one broken-input fixture per rule id", "temp file, re-read, validate, rename"]
key-files:
  created:
    - tools/lib/achievements-zip.mjs
    - tools/achievements-zip.mjs
    - test/unit/achievements-zip.test.js
    - test/unit/achievements-zip-cli.test.js
    - test/unit/achievements-docs.test.js
    - docs/ACHIEVEMENTS.md
    - docs/ACHIEVEMENTS-COPY.md
  modified:
    - .gitignore
key-decisions:
  - "Stored (method 0) entries, fixed 1980-01-01 timestamp, fixed entry order: a rebuild is byte-identical"
  - "CSV bytes are two single constants (CSV_ROW_SEPARATOR, CSV_TRAILING_NEWLINE) named in the docs"
  - "file-size is read strictly: under 1000000 bytes"
requirements-completed: [ZIP-01, ZIP-02, ZIP-03, ACH-02, ACH-03, ACH-05]
duration: 40min
completed: 2026-10-05
status: complete
---

# Phase 98 Plan 03: Zip Tool, Validator, Docs and Hand-off Summary

**A dependency-free tool builds the Play Console import zip (2 headerless CSVs + 77 icons, 79 entries, byte-identical on rebuild), a 25-rule validator holds it to Google's and Play's limits with a failing fixture per rule, and the docs plus a generated copy table are ready for the user's import.**

## Accomplishments

- **Library.** `tools/lib/achievements-zip.mjs` writes stored zips by hand with `zlib.crc32`, reads them back with bounds (entry count checked against the central directory size before parsing, inflation capped at the per-file limit plus one, nothing ever written to disk), builds the CSVs and runs the 25 rules in RULES order. House rules are labelled in `catches`.
- **CLI.** `--build` writes `<out>.tmp-<pid>`, re-reads it from disk, validates it against the catalog and renames; any failure deletes the temp file and leaves the output path untouched. `--check` and `--copy-table` as specified; zero, two or an unknown flag or a flag missing its value exits 2. A rename collision between two simultaneous builds (Windows) is tolerated when the file already in place has identical bytes.
- **Docs.** `docs/ACHIEVEMENTS.md` covers rebuild, copy review, draft import (import exactly once), the draft check (77 / 1110 / 57 / 8), testers, publishing, the one-way doors, Get resources, a refused-import checklist and the rule table. `docs/ACHIEVEMENTS-COPY.md` is generated (77 rows in seven blocks, 8 reveal pairs) and pinned fresh by a test.
- **Scope.** Nothing under `engine/`, `src/browser/`, `achievements/`, no `mazeworld.html`, no `package.json` change, no new dependency.

## Task Commits

| Task | Commit | Summary |
|------|--------|---------|
| 1 | ed899657 | feat: the zip library and its validator tests |
| 2 | 1a92dca2 | feat: the CLI and the git-ignored output path |
| 3 | 6218aa01 | docs: ACHIEVEMENTS.md and the generated copy table |

## Verification (targeted only; no full suite, no bot)

- `achievements-zip.test.js` 53 tests, `achievements-zip-cli.test.js` 14, `achievements-docs.test.js` 6; with `achievements-catalog`, `achievements-copy` and `stale-terms` the six files run **126 / 126 pass**.
- Mutation checks (run and reverted): letting `file-count` allow 404 fails the teeth test and the 403/404 boundary test; dropping the PNG size comparison fails the `icon-png-512` teeth test.
- `node tools/achievements-zip.mjs --build` then `--check` exit 0 (PASS); a second `--build` prints the same sha256. Python cross-check: `zipfile.testzip()` returned `None`, 79 names.
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`.
- `git diff --stat` shows no change under `engine/`, `src/browser/`, `achievements/`, `mazeworld.html` or `package.json`.

## HAND-OFF (non-blocking human step)

This plan ran on the main working tree (not a worktree), so the zip below is already in the main checkout.

- **Zip:** `C:/projects/mazeworld/build/achievements/ddr-achievements.zip` (git-ignored, not committed)
- **Size:** 9557274 bytes
- **sha256:** `75ee34ffcadec72d43df34444dd6a0655df39612faea4a1bd2957c332b3f5d34`
- **Contents:** 79 entries (2 CSVs + 77 icons), 77 achievements, 1110 points, 57 incremental, 8 hidden
- **Copy table to read:** `C:/projects/mazeworld/docs/ACHIEVEMENTS-COPY.md`
- **Rebuild anywhere with:** `node tools/achievements-zip.mjs --build` (same sha256 for the same catalog and icons)

What to do, in three sentences: read the copy table, and tell Claude any change (the catalog is edited, the table regenerated and the zip rebuilt). Then follow `docs/ACHIEVEMENTS.md` to import the zip into Play Console as a draft, exactly once, and check the draft shows 77 achievements, 1110 points, 57 incremental and 8 hidden. Later, send back the Get resources file.

Phases 99 to 102 do not wait on the import; only Phase 101's full-coverage proof needs the IDs file. Start the copy read with the "Least-sure entries" list in `98-02-SUMMARY.md`.

## Deviations from Plan

None - plan executed as written. Small additions inside the plan's intent: the pre-rename collision tolerance in the CLI (found while designing the concurrent-build case on Windows), a `--check` test against a catalog that differs from the zip, and a test that a failed build keeps an earlier good file untouched.

## Issues Encountered

`state.advance-plan` and `state.update-progress` could not parse this STATE.md (no Current Plan field) and were skipped; the metric, session, ROADMAP and requirements verbs ran.

## Known Stubs

None.

## Threat Flags

None. The tool opens no network path and writes only the ignored output path (or the file named by `--out`).

## Self-Check: PASSED

- Files present: tools/lib/achievements-zip.mjs, tools/achievements-zip.mjs, the three test files, docs/ACHIEVEMENTS.md, docs/ACHIEVEMENTS-COPY.md, build/achievements/ddr-achievements.zip.
- Commits ed899657, 1a92dca2, 6218aa01 present in `git log`.
