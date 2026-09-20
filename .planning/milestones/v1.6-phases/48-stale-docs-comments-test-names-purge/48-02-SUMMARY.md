---
phase: 48-stale-docs-comments-test-names-purge
plan: 02
subsystem: testing
tags: [docs-sweep, comment-hygiene, shell, browser-modules]

requires:
  - phase: 48-stale-docs-comments-test-names-purge
    plan: 01
    provides: tools/stale-terms.mjs (criterion-1 tripwire) and tools/comment-only-diff.mjs (stripped-diff proof)
provides:
  - "mazeworld.html comment sweep — ~35 sites, comment-only, zero unlisted enforced-term hits"
  - "src/browser/*.js (12 files) comment sweep — narration-line vocabulary, zero unlisted enforced-term hits"
  - "tools/stale-terms.mjs — 6 new class-B ALLOWED entries (4 mazeworld.html, 2 src/browser)"
affects: [48-03-PLAN.md, 48-04-PLAN.md, 48-05-PLAN.md]

tech-stack:
  added: []
  patterns:
    - "class-B ALLOWED entries matched per-line against the raw text the scanner actually splits on (a multi-line comment's keyword may land on a different line than the sentence that introduces it — verify with the JSON hits list before writing the match regex)"

key-files:
  created: []
  modified:
    - mazeworld.html
    - src/browser/narrationLines.js
    - src/browser/eventNarration.js
    - src/browser/engineAdapter.js
    - src/browser/storeScreen.js
    - src/browser/rail.js
    - src/browser/heroTab.js
    - src/browser/gearTab.js
    - src/browser/fightLog.js
    - src/browser/missLines.js
    - src/browser/combatMenu.js
    - src/browser/settings.js
    - src/browser/inputGuards.js
    - tools/stale-terms.mjs

key-decisions:
  - "heroTab.js's five retired-window.__mz* bridge archaeology comments (lines 372/394/595/620-621, the retired-bridges term) were rewritten even though the plan's action list for heroTab.js only named the two toast-vocabulary sites (520, 631) — the plan's own acceptance criteria (`--paths src` unlisted 0 on every enforced row) requires it, and the fix follows the same pattern already used for mazeworld.html's equivalent archaeology paragraphs: state what the code does now (direct content/engine imports), drop the 'retired window.__mz*' clause"
  - "ALLOWED match regexes are tested against the RAW per-line text the scanner splits on (\\r?\\n), not the logical sentence — a multi-line comment's keyword phrase (e.g. \"Replaces the / Round Card (Phase 32) entirely\") can straddle two lines; the match string must target the line the hit actually lands on, confirmed via `--json` output before finalizing each ALLOWED entry"

requirements-completed: []

coverage:
  - id: D1
    description: "mazeworld.html's ~35 stale D-pad/toast/Round-Card/retired-bridge comment sites rewritten or deleted; code lines byte-identical"
    verification:
      - kind: unit
        ref: "node tools/stale-terms.mjs --paths mazeworld.html (exit 0, unlisted 0)"
        status: pass
      - kind: unit
        ref: "node tools/comment-only-diff.mjs 649de2b mazeworld.html (comment-only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/browser/*.js (12 files) speak the narration-line vocabulary; no toast/D-pad/Round-Card/retired-bridge prose remains outside the 2 class-B survivors"
    verification:
      - kind: unit
        ref: "node tools/stale-terms.mjs --paths src (exit 0, unlisted 0)"
        status: pass
      - kind: unit
        ref: "node tools/comment-only-diff.mjs 649de2b src/browser (comment-only, 12 changed, 0 code-changed)"
        status: pass
  - id: D3
    description: "Pixel- and behaviour-identical: DOM snapshot, boot:check, bridge-doc/registry, and the full test suite all green at both commits"
    verification:
      - kind: integration
        ref: "npm run build:www; npm run boot:check (4/4); node --test test/unit/shell-tab-snapshots.test.js (10/10, no fixture diff); node tools/bridge-doc.mjs --check (exit 0); node --test test/unit/bridge-registry.test.js (fail 0); npm test (3288/0)"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-09-20
status: complete
---

# Phase 48 Plan 02: Shell + src/browser Comment Sweep Summary

**Rewrote every mazeworld.html and src/browser/*.js comment that still described the D-pad, the toast surface, the Round Card, or a deleted `window.__mz*` bridge as live — two commits, comment-only, full shell gate green at each, 3288/0.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 2
- **Files modified:** 13 (mazeworld.html, 12 src/browser files, tools/stale-terms.mjs shared across both tasks)

## Accomplishments

- **Task 1 (shell):** rewrote ~35 stale comment sites in `mazeworld.html` — CSS tone-family doc, DR5 button comment, campFailed refusal comment, fight-log CSS Round Card note, the encounter-panel Round Card comment, a deleted Round-Card archival note (removed outright), the camp-button paragraph, the railLocked D-pad mention, the guardTap doc's design-doc citation and toast mention, the fightLogRefuse comment, the pending-loot D-pad mention, the Cloak-of-Ether tap-safety comment (kept, class B), the dev-long-press gesture-classifier comment, the flee-ending comment, the boot-sequence comment, the DR8 combat-routing paragraph (dropped the classic-duplicate history), the DR2 strike-badge comment, and the whole module-script import-block/bridge-registry archaeology stack (NARRATIVE_ACTIONS, PRIORITY, the gearTab import, sellPriceFor, two `__mzBags`-pattern comments, the `__mzAbilities`/`__mzEff`/`__mzSlotFor` paragraph — deleted outright, the `__mzHasTool`/`__mzToolIndex` comment, the Phase 43 read-only-bridges comment, dispatchWithNarration's doc, the equipRejected comment, the combat-end-handling toast mention, the `__mzRenderGrimoire` comment, and the boot worn-report comment, kept as class B).
- **Task 2 (src/browser):** rewrote `narrationLines.js`'s 45 comment sites to the narration-line vocabulary (mechanical "toast" → "line" substitution plus several rewritten multi-line blocks: the pipeline overview, `enemyRound`/`killFold`/`RESIST_FOLD_EFFECTS`/`spellChain`/`fleeChain`/`parleyChain`/`chestChain`/`encounterStart`/`dedupeByType`/`linesForAction` doc comments, the `ORACLE_ONLY` set's inline comments); rewrote every toast mention in `eventNarration.js`, `engineAdapter.js`, `storeScreen.js`, `rail.js`, `heroTab.js`, `gearTab.js`, `missLines.js`, `combatMenu.js`; dropped `fightLog.js`'s `round-card-worst-case` test-file citation and "old Round Card used" clause; replaced `settings.js`'s "D-pad" with "the MAKE CAMP and gear chips" (verified against mazeworld.html's live `.mw-map-chip.gear` markup); dropped `inputGuards.js`'s `docs/COMBAT-NARRATIVE-DESIGN.md` citation, stating the tap-safety rule inline instead; additionally rewrote `heroTab.js`'s five retired-`window.__mz*` bridge archaeology comments (not explicitly named in the plan's action list, but required by the plan's own `--paths src` unlisted-0 acceptance criterion — see Deviations).
- `tools/stale-terms.mjs`: 6 new class-B `ALLOWED` entries (4 in `mazeworld.html`, 2 in `src/browser/`) for the retirement statements this sweep intentionally kept.

## Task Commits

1. **Task 1: mazeworld.html comment sweep** — `a8edcaa` (docs)
2. **Task 2: src/browser comment sweep** — `2a453d5` (docs)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update is the final commit for this plan._

## `stale-terms.mjs` tables

### `--paths mazeworld.html` — before (measured at 649de2b, this plan's base) / after

| Term | Regex | Before: Hits / Allowed / Unlisted | After: Hits / Allowed / Unlisted | Enforced |
| --- | --- | --- | --- | --- |
| dpad | `d-pad\|dpad` | 5 / 0 / 5 | 1 / 1 / 0 | yes |
| toast | `toast` | 17 / 0 / 17 | 2 / 2 / 0 | yes |
| classic-engine | `dead classic\|classic engine` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| classic-script | `classic script` | 25 / 0 / 25 | 25 / 0 / 25 | no |
| wornSlots | `wornSlots` | 1 / 0 / 1 | 0 / 0 / 0 | yes |
| legacy-counters | `flightLeft\|flightCooldown\|c\.ether` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| recentre | `recent(er\|re).*(every\|each) step` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| round-card | `round card\|roundcard` | 5 / 0 / 5 | 1 / 1 / 0 | yes |
| retired-bridges | `__mz(...)\b` | 10 / 0 / 10 | 0 / 0 / 0 | yes |
| retired-files | `toasts\.js\|...` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| legacy-won | `won: false\|state\.won\|winGame` | 0 / 0 / 0 | 0 / 0 / 0 | no |

**Exit code after: 0.** `classic-script`'s 25 unlisted hits are the live, unenforced term (CONTEXT judgment call 1 — `classic script` names the current non-module `<script>` block; not part of this plan's scope beyond the literal-mirror clauses already removed).

### `--paths src` — before (measured at 649de2b) / after

| Term | Regex | Before: Hits / Allowed / Unlisted | After: Hits / Allowed / Unlisted | Enforced |
| --- | --- | --- | --- | --- |
| dpad | `d-pad\|dpad` | 1 / 0 / 1 | 0 / 0 / 0 | yes |
| toast | `toast` | 66 / 0 / 66 | 1 / 1 / 0 | yes |
| classic-engine | `dead classic\|classic engine` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| classic-script | `classic script` | 18 / 0 / 18 | 18 / 0 / 18 | no |
| wornSlots | `wornSlots` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| legacy-counters | `flightLeft\|flightCooldown\|c\.ether` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| recentre | `recent(er\|re).*(every\|each) step` | 0 / 0 / 0 | 0 / 0 / 0 | yes |
| round-card | `round card\|roundcard` | 2 / 0 / 2 | 1 / 1 / 0 | yes |
| retired-bridges | `__mz(...)\b` | 5 / 0 / 5 | 0 / 0 / 0 | yes |
| retired-files | `toasts\.js\|...` | 1 / 0 / 1 | 0 / 0 / 0 | yes |
| legacy-won | `won: false\|state\.won\|winGame` | 0 / 0 / 0 | 0 / 0 / 0 | no |

**Exit code after: 0.**

### `--paths mazeworld.html src` combined — final

```
| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad|dpad` | 1 | 1 | 0 | yes |
| toast | `toast` | 3 | 3 | 0 | yes |
| classic-engine | `dead classic|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 43 | 0 | 43 | no |
| wornSlots | `wornSlots` | 0 | 0 | 0 | yes |
| legacy-counters | `flightLeft|flightCooldown|c\.ether` | 0 | 0 | 0 | yes |
| recentre | `recent(er|re).*(every|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card|roundcard` | 2 | 2 | 0 | yes |
| retired-bridges | `__mz(...)\b` | 0 | 0 | 0 | yes |
| retired-files | `toasts\.js|...` | 0 | 0 | 0 | yes |
| legacy-won | `won: false|state\.won|winGame` | 0 | 0 | 0 | no |

exit=0
```

## Class-B survivors kept (every one, file:line, sentence, reason)

| File:Line | Sentence | Reason |
| --- | --- | --- |
| `mazeworld.html:567` | "Round Card (Phase 32) entirely; no entrance animation on purpose — the" | B — fight-log CSS: names what it replaced |
| `mazeworld.html:3962` | "to-move is the ONLY movement surface — there is no D-pad. While ethereal" | B — the Cloak-of-Ether tap rule states the retirement of the D-pad; the one place a reader asks |
| `mazeworld.html:4799` | "instead — there is no toast surface any more; the rail and the fight" | B — dispatchWithNarration's routing rule states the retirement where the routing is decided |
| `mazeworld.html:5486` | "card + Oracle line, never a toast — the v1.4 rail-is-the-one-feedback-" | B — the boot worn-report states the v1.4 ruling |
| `src/browser/fightLog.js:4` | "log (it replaced the Phase 32 Round Card)." | B — the module states what it replaced |
| `src/browser/narrationLines.js:385` | "(uncapped — the toast host that once capped this list was retired" | B — explains why the fold is uncapped |

6 total survivors (4 mazeworld.html + 2 src/browser), each within the plan's stated bounds (at most 4 mazeworld.html, at most 3 src/browser).

## Comment-only-diff proof

```
$ node tools/comment-only-diff.mjs 649de2b mazeworld.html
comment-only: mazeworld.html
comment-only-diff 649de2b: 1 changed, 0 code-changed
exit=0

$ node tools/comment-only-diff.mjs 649de2b src/browser
comment-only: src/browser/combatMenu.js
comment-only: src/browser/engineAdapter.js
comment-only: src/browser/eventNarration.js
comment-only: src/browser/fightLog.js
comment-only: src/browser/gearTab.js
comment-only: src/browser/heroTab.js
comment-only: src/browser/inputGuards.js
comment-only: src/browser/missLines.js
comment-only: src/browser/narrationLines.js
comment-only: src/browser/rail.js
comment-only: src/browser/settings.js
comment-only: src/browser/storeScreen.js
comment-only-diff 649de2b: 12 changed, 0 code-changed
exit=0
```

## Shell-gate results (exact counts, measured after both commits)

- `npm run build:www` → exit 0
- `npm run boot:check` → `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0`; `git diff --stat -- test/unit/fixtures/` → empty
- `node tools/bridge-doc.mjs --check` → exit 0
- `node --test test/unit/bridge-registry.test.js` → `# pass 10`, `# fail 0`
- `node --test test/unit/shell-*.test.js` (full marker/CSS/voice suite, run after Task 1 to confirm no `sliceBetween`/`indexOf` marker moved) → `# pass 401`, `# fail 0`
- `node --test test/unit/narrationLinesCoverage.test.js test/unit/narrativeLines.test.js test/unit/linesForAction.test.js test/voice/safety-scan.test.js test/unit/inputGuards.test.js test/unit/fightLog.test.js` → `# pass 105`, `# fail 0`
- `npm test` → `# tests 3288`, `# pass 3288`, `# fail 0` (measured after each commit)
- `git status --porcelain engine/ content/ test/parity/` → empty (fence untouched)
- `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)

## `git diff --numstat` for mazeworld.html

```
64	105	mazeworld.html
```

Bound check: `64 < 150` and `105 < 200` → `ok` (a comment sweep, not a rewrite). `file mazeworld.html` → `HTML document, Unicode text, UTF-8 text, with CRLF line terminators` (CRLF preserved).

## `git diff --numstat` for src/browser (12 files)

```
1   1   src/browser/combatMenu.js
4   4   src/browser/engineAdapter.js
7   7   src/browser/eventNarration.js
9   8   src/browser/fightLog.js
2   2   src/browser/gearTab.js
11  14  src/browser/heroTab.js
4   4   src/browser/inputGuards.js
1   1   src/browser/missLines.js
51  51  src/browser/narrationLines.js
2   2   src/browser/rail.js
2   2   src/browser/settings.js
2   2   src/browser/storeScreen.js
```

## Re-point ledger

None — no source-pin test needed re-pointing. Checked explicitly:
- `test/unit/heroTab.test.js` pins `window.__mzTables` via a live regex against the module/classic source (not comment text) — unaffected by heroTab.js's comment rewrites.
- `test/unit/inputGuards.test.js` — confirmed `grep -c "COMBAT-NARRATIVE" test/unit/inputGuards.test.js` → 0 (no pin existed).
- `test/unit/fightLog.test.js`, `test/unit/round-card-worst-case.test.js` — confirmed neither pins the `round-card-worst-case` comment text removed from `fightLog.js`.
- `test/unit/shell-*.test.js`'s `sliceBetween`/`indexOf` markers — the full 401-test shell-* suite passed after Task 1's mazeworld.html edits, confirming no marker string was altered.

## Deviations from Plan

**1. [Rule 2 — completeness gap] Rewrote heroTab.js's five retired-`window.__mz*` bridge archaeology comments, not explicitly named in the plan's per-file action list.**
- **Found during:** Task 2, after the plan's named edits (lines 520, 631) left `node tools/stale-terms.mjs --paths src` still failing with 5 unlisted `retired-bridges` hits, all in `heroTab.js` (lines 372, 394, 595, 620-621).
- **Issue:** The plan's action text for `heroTab.js` covered only the two "toast" mechanical substitutions; it did not mention these five comments naming `window.__mzTables`/`__mzStrikeDie`/`__mzToHit`/`__mzEff`/`__mzAbilities` as "retired." The plan's own acceptance criterion (`--paths src` unlisted 0 on every enforced row, including `retired-bridges`) required them fixed regardless.
- **Fix:** Rewrote each to describe the current live shape (direct `content/`/`engine/` imports: `ROMAN`, `strikeDie`, `toHit`, `eff`) and dropped the "retired window.__mz*" clause — same pattern already applied to mazeworld.html's equivalent module-script archaeology paragraphs in Task 1.
- **Files modified:** `src/browser/heroTab.js`
- **Commit:** `2a453d5`

**2. [Rule 1 — tooling bug] Fixed a class-B ALLOWED match regex that initially failed to match its target line.**
- **Found during:** Task 1, first attempt at the `round-card` ALLOWED entry for mazeworld.html's fight-log CSS comment.
- **Issue:** The plan's suggested match text ("Replaces the Round Card") spans a comment line-wrap boundary in the actual file — "Replaces the" sits on line 566, "Round Card (Phase 32) entirely" on line 567 — but `tools/stale-terms.mjs` matches per raw line (split on `\r?\n`), so the regex never matched the line the `round-card` term actually hit (567).
- **Fix:** Verified the exact hit line via `--json` output and changed the match regex to `"Round Card \\(Phase 32\\) entirely"` (the text that actually appears on line 567).
- **Files modified:** `tools/stale-terms.mjs`
- **Commit:** `a8edcaa`

No other deviations — every other edit matched the plan's anchored quotes (allowing for line-number drift from prior Task-1 edits shifting later line numbers within the same file, located by content as instructed).

## Issues Encountered

None blocking. Line numbers in the plan (measured at 649de2b) drifted within `mazeworld.html` as earlier edits in the same task shortened/lengthened preceding comments — every site was re-located by its quoted text before editing, per the plan's own instruction.

## Human verification (deferred to end of run)

None — no user-visible change. This plan touches only comment lines inside `mazeworld.html` and `src/browser/*.js`; the DOM snapshot (`shell-tab-snapshots.test.js`, 10/10, no fixture diff), `boot:check` (4/4), and the full `comment-only-diff` proof (0 code-changed across 13 files) are the complete proof that nothing rendered, styled, or behavioral changed. `npm test` (3288/0) confirms no regression anywhere else in the codebase.

## Next Phase Readiness

- `tools/stale-terms.mjs` now carries 8 seeded (Plan 01) + 6 new (Plan 02) `ALLOWED` entries; Plans 03-05 continue appending their own class A/B entries as they sweep `test/`, `docs/`, and `.claude/CLAUDE.md`.
- `--paths mazeworld.html src` is fully clean (exit 0, unlisted 0 on every enforced row) — Plan 02's slice of DOCS-01 is done. DOCS-01 itself does not close here (per the plan's instruction) — it closes in Plan 05 once `test/`, `engine/`+`content/` (already done in Plan 01), and `docs/`/CLAUDE.md are all swept and the final combined tripwire run is recorded.
- Plan 03 (test names/comments) can proceed — no blockers. It should re-verify `test/unit/round-card-worst-case.test.js`'s rename target against `fightLog.js`'s remaining comment reference (already comment-only, already accounted for by this plan's `retired-files` term reaching 0 unlisted).
- Plan 05 should confirm `docs/COMBAT-NARRATIVE-DESIGN.md` deletion doesn't orphan any other citation — `inputGuards.js`'s citation is now the only one this plan found and removed; a repo-wide grep before deleting the doc is still Plan 05's job.

---
*Phase: 48-stale-docs-comments-test-names-purge*
*Plan: 02*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: .planning/phases/48-stale-docs-comments-test-names-purge/48-02-SUMMARY.md
- FOUND: commit a8edcaa
- FOUND: commit 2a453d5
