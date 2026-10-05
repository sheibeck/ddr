---
phase: 100-in-game-achievements-unlock-toasts-the-list
plan: 02
subsystem: ui
tags: [achievements, list-view-model, dom-renderer, talkback, voice-corpus]
requires:
  - phase: 98
    provides: content/achievements.js catalog (77 entries, listOrder blocks, Hidden set, in-game icons)
  - phase: 99
    provides: progressFor, sanitizeRecord and the lifetime record shape
  - phase: 100-01
    provides: achievementIconSrc and the two voice-registration files
provides:
  - "src/browser/achievementsSheet.js: ACHIEVEMENTS_SHEET_COPY, ACHIEVEMENT_BLOCKS, TRACK_JOINS, TIER_NUMERALS, tracksOf, formatEarnedDate, progressText, earnedCount, secretCount, menuCountText, buildAchievementsView, renderAchievementsSheet"
  - "ACHIEVEMENTS_SHEET_COPY registered in the safety scan and the voice corpus"
affects: [100-03, 100-05, 102 screenshots]
tech-stack:
  added: []
  patterns: [view model over a sanitised record, host.ownerDocument-only renderer driven by a caller-owned expanded set]
key-files:
  created:
    - src/browser/achievementsSheet.js
    - test/unit/achievements-sheet-model.test.js
    - test/unit/achievements-sheet-view.test.js
    - test/unit/achievements-sheet-render.test.js
  modified:
    - test/voice/safety-scan.test.js
    - tools/lib/voice-corpus.mjs
key-decisions:
  - "35 rows, not CONTEXT's 36: the depth ladder and Unicorn! are one track by CONTEXT's own rule; the count is derived from the catalog"
  - "Rung rows carry a stateText ('Earned 5 Oct 2026' or 'Locked') in addition to dateText, so the date and the state read as one phrase"
  - "The renderer puts a plain space node after each text span, so a button's computed accessible name has word breaks whatever the CSS does"
  - "A block with no rows is skipped by the renderer (no empty heading)"
patterns-established:
  - "Secret rows are built from the bank's teaser only; row keys are opaque t{listOrder}; tests scan row objects (values only) and the rendered DOM (everything but img src) for all 8 Hidden entries"
requirements-completed: []  # AUI-02 and AUI-03 are only partly delivered here (pure core); 100-03 mounts the sheet and the menu row
status: complete
duration: ~35min
completed: 2026-10-05
---

# Phase 100 Plan 02: Achievements list core Summary

**A pure, headless achievements list: seven blocks, 35 track rows (the depth ladder and Unicorn! merged), unit-bearing progress readings, dates, a frozen view model that treats any record as the all-zero record when hostile, secret rows that expose nothing, and a TalkBack-ordered DOM renderer with expandable tracks.**

## What was built

- `src/browser/achievementsSheet.js` (imports the catalog, `progressFor`, `emptyRecord`/`sanitizeRecord`, `achievementIconSrc`): the module surface listed in the frontmatter, per the plan's sheet_spec.
- Voice tooling: `ACHIEVEMENTS_SHEET_COPY` is walked by `collectAuthoredStrings` (labels `ACHIEVEMENTS_SHEET_COPY.*`, so the Phase 98 count of 231 `ACHIEVEMENTS.*` labels stays exact) and registered in `BANK_REGISTRY` as a `panels` bank.

## Module surface as built

- `ACHIEVEMENT_BLOCKS`: descent 10-60, dressing 70-100, who 110-200, alive 210-340, company 350-470, bodies 480-710, dying 720-770 (catalog entries per block 6, 4, 10, 14, 13, 24, 6; rows 3, 4, 10, 5, 4, 6, 3).
- `tracksOf()`: 35 tracks, 14 with more than one entry (13 four-tier tracks plus depth with Unicorn! as rung IV).
- `buildAchievementsView(record, opts)` returns `{ title, earned, total, secrets, earnedText, secretsText, blocks:[{ id, title, rows }] }`, deeply frozen. Row: `{ key, kind, state, name, iconSrc, silhouette, dim, detail, dateText, progressText, stateText, ladder, rungs, expandable, label }`. Rung: `{ key, tier, name, state, text, dateText, progressText, stateText, iconSrc }` (`stateText` is an addition to the spec). `opts.tzOffset` is the minutes `getTimezoneOffset()` returns.
- `renderAchievementsSheet(host, view, opts)` returns the root (or null for a host with no `ownerDocument`).

### Exact class names (plan 100-03 CSS and plan 100-05 layout check key on these)

```
div.mw-ach
  div.mw-ach-summary > p.mw-ach-count, p.mw-ach-secrets
  section.mw-ach-block > h3.mw-ach-block-title, ul.mw-ach-list
    li.mw-ach-row[data-state data-kind data-key]
      button.mw-ach-head[type=button aria-expanded]   (track)  |  div.mw-ach-head  (single)
        img.mw-ach-icon (+ .mw-ach-icon-dim, .mw-ach-icon-silhouette)   alt="" aria-hidden="true"
        div.mw-ach-text > span.mw-ach-name, span.mw-ach-state, span.mw-ach-detail, span.mw-ach-progress, [track: span.mw-ach-hint]
        [track] span.mw-ach-ladder[aria-hidden] > i.mw-ach-pip[data-state] x4
      [expanded track] ul.mw-ach-rungs > li.mw-ach-rung[data-state]
                         > span.mw-ach-rung-name, .mw-ach-rung-state, .mw-ach-rung-text, .mw-ach-rung-progress
```

Row `data-state` is `earned`, `partial`, `locked` or `secret`; `data-kind` is `track` or `single`; empty parts (no progress, no state on a secret) are omitted. The ladder is a child of the head AFTER the text div (not inside it); the hint is the last span inside the text div. Rungs carry no `data-key` (their view keys equal the row key for rung I, so none are emitted).

## Final strings of `ACHIEVEMENTS_SHEET_COPY`

- `title`: "ACHIEVEMENTS"; `earned`: "{n} of {total} earned"; `menuCount`: "{n} / {total}"
- `secrets`: none "No secrets left. Thorough, in a slightly worrying way."; one "1 secret still hiding"; many "{n} secrets still hiding"
- `blocks`: "The descent", "Dressing for it", "Who you are", "Staying alive", "Company", "Body counts", "Dying"
- `state`: earned "Earned {date}"; earnedNoDate "Earned. Nobody wrote down when."; locked "Locked"; partial "{n} of {total} tiers earned"; complete "All {total} tiers earned"
- `secret`: name "Secret"; line "Some achievements are shy. This one will introduce itself when it is good and ready."
- `tier`: label "Tier {tier}"; next "Next: tier {tier}" (in the bank per spec, not rendered: the ladder pips carry the numerals)
- `progress`: count "{value} / {steps} {unit}"; bestFloor "best: floor {value} / {steps}"; best "best: {value} / {steps} {unit}"
- `units`: kills, deaths, Joiners, Joiners fallen, parleys won, traps survived, days, wilmst held, sub-classes
- `expand`: "Tap for every tier"; `collapse`: "Tap to fold it away"

All draft strings from the plan were kept; they already pass the voice hygiene and safety checks.

## Notes for plan 100-03 (and 100-05)

- The sheet owns scrolling and the layout: set `.mw-ach-text > span { display: block }` (the space nodes cover the accessible name either way, but the visual stack wants blocks). Locked rows are greyed through `li.mw-ach-row[data-state="locked"]` and `.mw-ach-icon-dim`; the silhouette is `.mw-ach-icon-silhouette` (e.g. a CSS `filter`); state is always also in the text, so colour is decoration only.
- Expand is a re-render: keep a `Set` of row keys in the shell, pass `{ expanded, onToggle }`, and re-call `renderAchievementsSheet` (it replaces the host's children, so preserve the list's scroll offset in the shell and re-focus the toggled button by `data-key` after the re-render).
- `buildAchievementsView(getAchievementRecord(), { tzOffset: new Date().getTimezoneOffset() })` is the call; `menuCountText(record)` gives the menu row's "12 / 77" and needs only the record.
- Icons are page-relative `achievements/ingame/ach_{id}.png` (plan 100-05 ships the folder).
- The ☰ row count and the sheet header must use the `ACHIEVEMENTS` word from the bank (`ACHIEVEMENTS_SHEET_COPY.title`).

## The 35-versus-36 note

CONTEXT says "36 rows" but also that "the depth ladder and Unicorn! read as one track of four rungs". Those two statements cannot both hold: the catalog derives 35 tracks (13 four-tier tracks, the depth-and-Unicorn! track, 21 single achievements). The structural rule wins; the row count is computed (`tracksOf().length`) and never hard-coded. The header comment of `achievementsSheet.js` records this.

## Tasks and commits

| Task | Commit | Files |
|------|--------|-------|
| 1. Copy bank, blocks, tracks, dates, progress, counts, voice registration | db08257a | achievementsSheet.js, achievements-sheet-model.test.js, safety-scan.test.js, voice-corpus.mjs |
| 2. View model (rows, ladders, rungs, secrets) | 43894168 | achievementsSheet.js, achievements-sheet-view.test.js |
| 3. DOM renderer | 14fb6dfb | achievementsSheet.js, achievements-sheet-render.test.js |

## Test counts (targeted only)

- test/unit/achievements-sheet-model.test.js: 23 pass
- test/unit/achievements-sheet-view.test.js: 24 pass
- test/unit/achievements-sheet-render.test.js: 21 pass
- test/unit/achievement-card.test.js: 8 pass, unchanged
- test/unit/achievement-tracker.test.js: 34 pass, unchanged
- test/unit/patch-notes.test.js: 31 pass, unchanged
- test/voice/safety-scan.test.js: 12 pass (one new test)
- test/unit/voice-corpus.test.js: 29 pass
- test/unit/stale-terms.test.js: 6 pass
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0

No full `npm test`, no bots (project rules).

## Deviations from Plan

None. The plan executed as written. Small design choices within its latitude: rungs gained a `stateText` field; the renderer skips a block with no rows and inserts space text nodes between spans; the renderer returns null for a host with no `ownerDocument`.

No edits to `mazeworld.html`, `src/browser/hudMenu.js`, `engine/`, `content/`, the Phase 99 modules or `achievementCard.js`.

## Known Stubs

None.

## Threat Flags

None. Pure data in, DOM nodes out; no network, storage, clock or Play call. T-100-05 (secret leak) is covered by row-object and DOM-level negative tests over all 8 Hidden entries, T-100-06 by the source-purity test, T-100-07 by the throwing-getter test, T-100-08 by the deep-frozen record test.

## Human verification (deferred to end of run)

On the Pixel 7 with TalkBack on, once plan 100-03 has mounted the sheet:

1. Swipe through the list: each row reads its name, then its state (Earned on a date, Locked, or nothing for a secret), then its detail, then its progress, in that order.
2. A secret row reads only "Secret" and its teaser line.
3. A track row announces as a button and says expanded or collapsed; double tap expands it and the rung list is read directly after that row, before the next row.
4. The ladder pips and the icons are skipped (no stray "image" or "I II III IV" announcements).

## Self-Check: PASSED

- FOUND: src/browser/achievementsSheet.js, the three new test files
- FOUND commits: db08257a, 43894168, 14fb6dfb
