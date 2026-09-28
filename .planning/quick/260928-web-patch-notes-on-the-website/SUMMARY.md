---
quick_id: 260928-web
status: complete
date: 2026-09-28
---

# Quick 260928-web: patch notes on the website; the in-game link points there (summary)

(The orchestrator wrote this from the executor's returned text. Commits: fa2c9eaa, 3a42b825 and bc523b24, merged into master.)

The user's request: "We should also post patch notes to our /c/project/darktier-studio/ website page for delve-die-repeat as part of our process". The user then ruled "The website page (Recommended)" for the in-game link, and "Deploy at release time (Recommended)".

- **The in-game link (fa2c9eaa).**
  - `PATCH_NOTES_RELEASES_URL` changed from https://github.com/sheibeck/ddr/releases to https://darktierstudios.com/delve-die-repeat/patch-notes.
  - `PATCH_NOTES_COPY.pastLink` changed from "Past versions on GitHub" to "Past versions".
  - The why-ledger row, SHELL-MODULES, the notes README and the tests are updated, and the review page is regenerated. The ledger check reports 0 errors.
- **The site tool (3a42b825).** `node tools/patch-notes.mjs --site <dir>` validates the current version's notes and writes them byte-for-byte to `<dir>/src/data/ddr-patch-notes/<versionName>.md`.
  - It fails clearly on a missing directory, or one without package.json or src/.
  - New exports: `SITE_NOTES_DIR`, `siteNotesPathFor`, `validateSiteDir` and `writeSiteNotes`. They are tested against temp directories.
- **The release recipe (bc523b24).** Step 5 in RELEASING.md and the notes README: run `--site ../darktier-studio`, commit there, then run `npm run deploy` in darktier-studio at release time.

**Gate (worktree):**
- npm test: 7,902 pass, 0 fail, 2 skipped.
- Parity: 66/66.
- build:www and boot:check: PASS.

The website pages themselves are built by a separate agent in C:/projects/darktier-studio and committed, not deployed.
