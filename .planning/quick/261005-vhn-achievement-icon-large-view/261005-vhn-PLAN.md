---
quick_id: 261005-vhn
slug: achievement-icon-large-view
date: 2026-10-05
autonomous: true
---

# Quick 261005-vhn: Tap an earned achievement icon to see it large

The spec is the todo `.planning/todos/pending/2026-10-05-tap-an-earned-achievement-icon-to-see-it-large.md` (user rulings 2026-10-05). It must land before Phase 102 captures the store screenshots.

## Task 1: sharp 320 px icons
- Add a 320 × 320 transparent export per achievement to a new `achievements/large/` folder (`ach_<id>.png`, the same stems as `ingame/`), made from `achievements/master/`. Run Python as `python` (Pillow, NumPy and SciPy are installed).
- Do NOT run `build_achievements.py`'s `main()`, because it re-exports every committed icon. Add a separate function, or a small script, that writes only the large size, and call only that. Leave `play/`, `ingame/` and `master/` byte-unchanged (verify with `git status`).
- Add `large` to `manifest.json` entries (`file_large`) only if the existing tests allow it; otherwise derive the path from the id the same way `achievementIconSrc` does.
- `tools/build-www.mjs` ships `www/achievements/large/` (77 PNGs). Extend `test/unit/achievement-assets.test.js` to pin the count, the 320 × 320 size and stem parity with `ingame/`.

## Task 2: the large view in the ☰ ACHIEVEMENTS sheet
- In `src/browser/achievementsSheet.js` and the sheet in `mazeworld.html`, an EARNED entry's icon becomes a button. That covers a single achievement's row icon, and an earned tier's icon inside an expanded track.
  - Its aria-label is "<name>, view larger".
  - Locked and secret icons stay inert, decorative images, and must leak nothing about a secret.
- The track head keeps expanding and folding. Only the icon button opens the view, and its tap must not toggle the track.
- Tapping the button opens a small overlay inside the sheet showing:
  - the 320 px icon, displayed at about 240 CSS px and capped to fit the viewport in every layout class;
  - the name;
  - the in-game `line`;
  - "Earned {date}".
- Close it with a tap anywhere on the overlay, or with Android back (one press closes only the overlay, not the sheet). Return focus to the icon button. Respect reduced motion.
- No new player copy beyond reusing the existing name, line and earned-date strings. If any new string is needed, register it with the safety scan and voice corpus.
- Tests: extend the sheet render/shell tests for:
  - the button only on earned entries;
  - no secret leak;
  - the overlay contents;
  - back closing only the overlay;
  - focus return.
- Run `npm run layout:check` (one re-run is allowed for the cold-boot flake) so the overlay fits in all profiles.

## Rules
- Targeted tests only, plus the voice inventory (must print 0) and stale-terms. The word "toast" is banned in raw .js/.mjs lines.
- Plain `git commit` with the two trailers, and no amends.
- Finish with `261005-vhn-SUMMARY.md` (frontmatter `status: complete`) and a row in STATE.md's "Quick Tasks Completed" table, then move the todo to `.planning/todos/completed/`.
- Device rows ("Human verification (deferred to end of run)"):
  - tap a few earned icons on the Pixel 7 and check they are sharp;
  - back closes only the overlay;
  - TalkBack reads "<name>, view larger".
