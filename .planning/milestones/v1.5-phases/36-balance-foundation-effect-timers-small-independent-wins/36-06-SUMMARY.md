---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 06
subsystem: shell
tags: [shell, hero-tab, company-panel, two-tap-confirm, bridge, sub-note-sync, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 03)
    provides: "mazeworld.html already carried the post-dispatch normalizeTarget call and dead-card aria-disabled before this plan's edits — this plan's renderPartyRoster/CSS/bridge edits land in the same file without regressing them"
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 05)
    provides: "the dismissJoiner engine action + joinerDismissed/dismissRefused events + NARRATIVE_ACTIONS/rail entries this plan's bridge dispatches into"
provides:
  - "mazeworld.html: classic-script SUB_NOTE.Cutthroat synced byte-for-byte to content/flavor.js (CUT-01)"
  - "renderPartyRoster() Company sheet: name · sub/race, class · level, HP track, Weapon: X, Eats N a rest, and (outside combat) a DISMISS button with a two-tap 'Send them off?' [Yes] [No] inline confirm mirroring the Gear tab's Drop pattern"
  - "DISMISS_CONFIRM_MS / dismissConfirmRevert / revertDismissConfirm() / escText() module-level helpers, directly above renderPartyRoster()"
  - "window.mzDismissJoiner(i) bridge — dispatches dismissJoiner through the same dispatchWithToasts seam as window.mzResolveJoiner"
  - ".mw-party-line / .mw-party-dismiss CSS rules"
  - "test/unit/shell-company-panel.test.js — 12 source pins for the sheet, confirm, bridge, SUB_NOTE sync and rail-only rule"
  - "Phase 36 closing gate: full test/build/parity/footprint verification, SC-1..6 map, aggregated end-of-run Pixel 7 checklist (Plans 01-06)"
affects: ["37-equipment-slot-model", "43-clarity-pass (Gear ON YOU/BAG split touches the same Hero-tab area)", "milestone-close UAT batch"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the DISMISS two-tap confirm is a byte-for-byte structural mirror of the Gear tab's Drop confirm (Phase 33 mw-drop-confirm precedent): a module-level MS constant, a single revert closure, one row armed at a time, a setTimeout revert, and a document-level capture pointerdown listener for outside-tap revert — never a CSS transition"
    - "the Company panel's DISMISS control routes through the SAME dispatch()->applyAction() seam as mzResolveJoiner (window.mzDismissJoiner mirrors window.mzResolveJoiner's dispatchWithToasts -> __mzState.set -> logLine loop -> paint() -> renderEncounter() shape exactly), keeping the shell's one dispatch-and-render tail pattern intact"
    - "member sheet strings (name/sub/race/cls/weapon) are interpolated into innerHTML through one escText() helper (mirrors eventNarration.js's own escaping), while the DISMISS/confirm controls themselves are built via document.createElement + textContent — no engine change was needed to make this safe"

key-files:
  created:
    - test/unit/shell-company-panel.test.js
  modified:
    - mazeworld.html

key-decisions:
  - "The DISMISS button and its confirm wrap are built with document.createElement/textContent (not template-string innerHTML) inside renderPartyRoster's forEach, matching the Drop confirm's own construction style — the plan's mkBtn helper is local to renderCarriedList, so a small local mkConfirmBtn closure was written instead of importing/duplicating it across functions."
  - "Follow-up candidates were catalogued rather than fixed: 13 other classic-script SUB_NOTE rows have drifted from content/flavor.js since Phase 23/24 (measured by a live node diff, not guessed) — only the Cutthroat row was in this plan's scope (CUT-01)."

requirements-completed: [JOIN-01, CUT-01]

coverage:
  - id: D1
    description: "renderPartyRoster() Company card renders, per member, in the locked order: name · sub/race, class · level, HP track, Weapon: X, Eats N a rest, then (outside combat) a DISMISS button; HP is the only player-facing unit word (no standalone WP)"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/shell-company-panel.test.js (sheet-order, HP-wording, escText-fields tests, 3 of 12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tapping DISMISS arms an inline 'Send them off?' [Yes] [No] confirm (Phase 33 mw-drop-confirm pattern: DISMISS_CONFIRM_MS=3000 timeout, outside pointerdown, No -> revert, one row armed at a time); Yes reverts then calls window.mzDismissJoiner(idx)"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/shell-company-panel.test.js (trio + confirm-mechanics tests, 2 of 12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "window.mzDismissJoiner(i) dispatches { type: 'dismissJoiner', i } through the same dispatchWithToasts seam as mzResolveJoiner, sets state, logs, paints and re-renders; dismissJoiner is a NARRATIVE_ACTIONS member so the parting line reaches the rail as a COMPANY/dull card and the Oracle log, never a toast, never inline text"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/shell-company-panel.test.js (bridge-shape + rail-only tests, 2 of 12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The classic script's SUB_NOTE.Cutthroat (the string the Hero-tab dossier actually renders) is byte-identical to content/flavor.js SUB_NOTE.Cutthroat; the prototype-era 'dies by your hand' sentence is gone from mazeworld.html"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "test/unit/shell-company-panel.test.js (SUB_NOTE-sync test, 1 of 12)"
        status: pass
      - kind: other
        ref: "node -e byte-identity check against content/flavor.js printed true; grep -c 'one member of every party dies by your hand' mazeworld.html == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every existing renderPartyRoster pin still holds (exactly 2 getElementById calls, panel.hidden, mw-map-hptrack/hpfill, Downed); the <style> block never references aria-disabled; npm run build:www exits 0; npm test '# fail 0'"
    requirement: JOIN-01
    verification:
      - kind: unit
        ref: "test/unit/shell-party-camp.test.js, test/unit/shell-gear-toolbar.test.js, test/unit/shell-map-invariants.test.js, test/unit/shell-input-guards.test.js, test/unit/shell-dead-foe-target.test.js (88/88 combined); test/unit/shell-company-panel.test.js (12/12)"
        status: pass
      - kind: other
        ref: "npm test 2276/2276 (# fail 0); npm run build:www exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 36 closing gate: parity fixtures/master untouched, cumulative Phase 36 engine/content/src/mazeworld.html footprint matches the declared 13-file list exactly, no timer record created anywhere, no package/font change"
    verification:
      - kind: other
        ref: "git diff --stat -- test/parity package.json package-lock.json (empty); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git status --porcelain test/parity/fixtures (empty); grep -c fonts.googleapis mazeworld.html == 0; git diff --stat v1.4.0 -- engine content src mazeworld.html (13 files, matches declared list); grep -rc 'startEffect|startCooldown' engine content src mazeworld.html | grep -v ':0$' == engine/effects.js only"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 06: Company Sheet, DISMISS Confirm & Phase Close Summary

**The Hero tab's Company panel is now a real sheet (class/sub/race, HP, weapon, "eats N a rest") with a confirmed two-tap DISMISS control wired through `window.mzDismissJoiner` into the same `dispatchWithToasts` seam as `mzResolveJoiner`; the classic dossier's Cutthroat blurb is synced byte-for-byte to `content/flavor.js`; and Phase 36 closes with a full gate (2276/2276 tests, parity master untouched, the 13-file cumulative footprint verified) plus one aggregated 22-item Pixel 7 checklist for the milestone-close UAT batch.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-17T17:20:55Z
- **Completed:** 2026-09-17T17:33:00Z
- **Tasks:** 3
- **Files modified:** 2 (0 created beyond the test file, 1 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `mazeworld.html`'s classic `SUB_NOTE.Cutthroat` row now reads the exact `content/flavor.js` blurb ("Double damage on your first landed blow, and Joiners will walk beside you all the same — ... One descent in twenty ..."); the prototype-era "one member of every party dies by your hand" sentence is gone.
- `renderPartyRoster()`'s Company card gained the full sheet in the locked order: name · sub/race, class · level, the existing HP track, `Weapon: <name>`, `Eats <N> a rest` (`RACES[m.race]?.eats || 1`), and — only when `!S.combat` — a `DISMISS` button.
- Tapping `DISMISS` arms an inline `Send them off? [Yes] [No]` confirm, structurally identical to the Gear tab's Drop confirm: `DISMISS_CONFIRM_MS = 3000`, a single `dismissConfirmRevert` closure (one row armed at a time), a `setTimeout` revert, and a document-level capture `pointerdown` listener that reverts on any outside tap. `Yes` reverts the confirm then calls `window.mzDismissJoiner?.(idx)`.
- `window.mzDismissJoiner(i)` mirrors `window.mzResolveJoiner` exactly: `dispatchWithToasts({ type: "dismissJoiner", i })` → `window.__mzState.set(state)` → the `logLine` loop → `window.paint()` → `window.renderEncounter()`. Because `dismissJoiner` is already a `NARRATIVE_ACTIONS` member (Plan 05), the rail's COMPANY card (dull tone) carries the actual parting-line sentence, and the Oracle log carries the same line — never a toast, never inline panel text.
- `.mw-party-line` and `.mw-party-dismiss` CSS rules added directly after `.mw-party-hp-lab b`; no `aria-disabled` selector, no transition/animation token.
- Member strings (`name`, `sub`, `race`, `cls`, `weapon`) are interpolated through a new `escText()` helper; the DISMISS/confirm controls are built via `document.createElement`/`textContent`.
- `test/unit/shell-company-panel.test.js` (new, 12 tests): SUB_NOTE byte-identity, the module-level trio's position/counts, the sheet's strict field order, HP wording, `escText()` usage on every field, the full confirm mechanics, every pre-existing `renderPartyRoster` pin, the rail-only rule (no parting line inside the panel, no toast host anywhere), the bridge's exact step order plus its `NARRATIVE_ACTIONS` membership, the two new CSS rules, a voice-safety check against `content/safety-wordlist.js`'s `BANNED` corpus, and a build-artefact sanity check on `www/index.html`.
- Full gate: `npm test` 2276/2276 (`# fail 0`); `npm run build:www` exit 0, `grep -c "mzDismissJoiner" www/index.html` = 3 (≥ 1); `git diff --stat -- test/parity package.json package-lock.json` empty; `git hash-object test/parity/prototype-master.js.txt` unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `git status --porcelain test/parity/fixtures` empty; `grep -c fonts.googleapis mazeworld.html` = 0; the cumulative `git diff --stat v1.4.0 -- engine content src mazeworld.html` footprint is exactly the 13 declared files (`content/flavor.js`, `engine/actions.js`, `engine/combat.js`, `engine/effects.js`, `engine/encounters.js`, `engine/engine.js`, `engine/magic.js`, `engine/movement.js`, `engine/saveState.js`, `mazeworld.html`, `src/browser/eventNarration.js`, `src/browser/rail.js`, `src/browser/toasts.js`) and nothing else; `grep -rc "startEffect|startCooldown" engine content src mazeworld.html | grep -v ":0$"` lists only `engine/effects.js` (SC-6: no timer record created anywhere in the phase).

## Task Commits

Each task was committed atomically:

1. **Task 1: mazeworld.html — SUB_NOTE sync, the Company sheet, the two-tap DISMISS confirm, the CSS, and the mzDismissJoiner bridge** — `6ce685a` (feat) — `feat(36-06): mazeworld.html — SUB_NOTE sync, Company sheet, DISMISS confirm, mzDismissJoiner bridge`
   - `mazeworld.html`
2. **Task 2: test/unit/shell-company-panel.test.js — source pins for the sheet, the confirm, the bridge, the SUB_NOTE sync and the rail-only rule** — `d4364e2` (test) — `test(36-06): shell-company-panel source pins for the sheet, confirm, bridge and SUB_NOTE sync`
   - `test/unit/shell-company-panel.test.js` (new, 12 tests)
3. **Task 3: Phase 36 closing gate + SUMMARY with the aggregated deferred Pixel 7 checklist** — this commit (docs) — no source files changed, gate re-verified green.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: this plan's tasks are `type="auto"` (no `tdd` flag) — Task 1's shell edit and Task 2's source-pin test file were each written and verified green before commit._

## Files Created/Modified

- `mazeworld.html` — `SUB_NOTE.Cutthroat` row synced to `content/flavor.js`; `DISMISS_CONFIRM_MS` / `dismissConfirmRevert` / `revertDismissConfirm()` / `escText()` trio+helper added directly above `renderPartyRoster()`; `renderPartyRoster()` rewritten with the full Company sheet + DISMISS confirm; `.mw-party-line` / `.mw-party-dismiss` CSS rules; `window.mzDismissJoiner` bridge added directly after `window.mzResolveJoiner`
- `test/unit/shell-company-panel.test.js` — new file, 12 tests: SUB_NOTE sync, module-level trio, sheet field order, HP wording, escText()-escaped fields, confirm mechanics, existing pins preserved, rail-only rule, bridge shape + NARRATIVE_ACTIONS membership, CSS rules, voice safety, build-artefact sanity

## Decisions Made

- **DISMISS/confirm controls built via `document.createElement`/`textContent`, not template-string `innerHTML`:** matches the Drop confirm's own construction style exactly; the plan's `mkBtn` helper is local to `renderCarriedList` (a different function), so a small local `mkConfirmBtn` closure was written inside the `forEach` callback rather than hoisting/duplicating `mkBtn` across functions.
- **Follow-up candidates catalogued, not fixed:** a live `node` diff against `content/flavor.js` found 13 other classic-script `SUB_NOTE` rows (Knight, Guard, Woodsman, Master of Arms, Bard, Pickpocket, Pilfer, Cloaker, Ninja, Wizard, Court Mage, Illusionist, Summoner) still drifted from the ported flavor-data table since Phase 23/24 — only the Cutthroat row was in this plan's scope (CUT-01); the rest are logged below as a Clarity-phase (43) or quick-task candidate.

## Deviations from Plan

None. Every locked API surface (the `DISMISS_CONFIRM_MS`/`dismissConfirmRevert`/`revertDismissConfirm`/`escText` names and positions, the sheet's exact field order, the confirm mechanics, the bridge's exact dispatch/set/log/paint/render sequence, the CSS rule bodies, the SUB_NOTE sync) matches the plan verbatim.

## Issues Encountered

None. Both tasks' test runs passed cleanly on the first full attempt after their implementation landed; no auto-fix, no fixture drift, no regeneration needed.

## Success Criteria Map (ROADMAP.md Phase 36, SC-1..6)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | BEFORE class-matrix pin committed before any v1.5 change | 36-01 | `docs/class-pass/v15-before*.json` + `docs/CLASS-PASS.md` "v1.5 BEFORE" section; `test/unit/class-pass-ledger.test.js` |
| 2 | Dead-foe targeting: kill switches the target immediately, downed cards inert, no arm-window race | 36-03 | `test/unit/normalizeTarget.test.js` (10), `test/unit/shell-dead-foe-target.test.js` (10, incl. the DOM-free race simulation) |
| 3 | Cutthroat sees an acceptance offer; blurb matches | 36-04 + 36-06 | `test/unit/cutthroat-joiner.test.js` (offer tests); this plan's SUB_NOTE sync + `shell-company-panel.test.js`'s SUB_NOTE test |
| 4 | Each descent with a Joiner carries a stated murder chance, narrated with its own event + several lines | 36-04 | `cutthroatMurderCheck` (18 tests), `JOINER_MURDER_LINES` (6 lines), `joinerMurdered` narration/toast/rail |
| 5 | Company panel shows the sheet + a confirmed DISMISS with a parting line | 36-05 + 36-06 | `dismissJoiner` engine action (20 tests) + this plan's sheet/confirm/bridge (`shell-company-panel.test.js`, 12 tests) |
| 6 | `npm test` green, engine/content/parity diff limited to the declared footprint, `engine/effects.js` has no player-visible behavior | 36-02 + this plan's gate | `test/unit/effects.test.js`; `npm test` 2276/2276; the 13-file footprint diff; `startEffect\|startCooldown` grep hits only `engine/effects.js` |

## Follow-up candidates (not this phase)

- **13 other classic-script `SUB_NOTE` rows are still drifted from `content/flavor.js`** (measured 2026-09-17 via a live `node` diff, not the plan's own guess): Knight, Guard, Woodsman, Master of Arms, Bard, Pickpocket, Pilfer, Cloaker, Ninja, Wizard, Court Mage, Illusionist, Summoner. A full sync pass is a natural fit for the Clarity pass (Phase 43) or an interim quick task — none of these blocked CUT-01 (only the Cutthroat row was in scope).

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol, no device pause was taken anywhere in Phase 36. The following checks are the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. `adb install -r` + `am force-stop` + relaunch and the APK build itself happen at milestone close, not in this phase.

### Plan 01

Nothing to add — a pure measurement/documentation plan with zero engine, content, src, or shell changes.

### Plan 02

Nothing to add — `engine/effects.js` has zero player-visible behaviour; no `start*` caller exists anywhere outside its own test file. A normal run and a pre-Phase-36 save are expected to look, sound, and play identically to 1.4.0.

### Plan 03

1. Start a fight with two or more foes and kill the currently-targeted one (your own blow, a Joiner's blow, or an item/spell kill) — the TARGET tag must jump to the next living foe's card before you can tap anything else.
2. Tap the downed (greyed-out) card repeatedly — nothing happens: no target change, no log line, no visual "armed" feedback.
3. Immediately after a kill, tap a live non-target card within roughly a quarter second (spam-tap) — either nothing happens (the tap was swallowed) or the tapped card becomes the target; a strike must never land on a foe you did not choose.
4. Verify a Joiner's blow or a Freeze that kills the current target also moves the TARGET tag to a survivor, not just a hero-caused kill.
5. (Optional) With TalkBack on, confirm the downed card reads as disabled.

### Plan 04

6. Roll a Cutthroat and walk until a Joiner is met — the rail shows the COMPANY offer card (TAKE THEM ALONG / LEAVE THEM) instead of a refusal.
7. Accept the Joiner, open the Hero tab — the Company panel lists them.
8. Descend floor after floor until the murder line fires (1-in-20 per descent — may take a while; the dev start-depth harness can speed floors) — the rail shows a COMPANY card in the bad tone with one of the six lines, the Oracle log carries the same line, and the party/Company panel is empty afterwards.
9. As a Wilmsry meeting a Magic User Joiner, confirm the refusal still reads exactly as before (unaffected by this plan).
10. Read the Cutthroat dossier blurb on the Hero tab — it should state "one descent in twenty" (this plan's shell sync makes this the live copy, superseding the "not yet synced" caveat in 36-04's own checklist).

### Plan 05

11. After a DISMISS confirm on the Hero tab's Company panel, the rail shows a COMPANY card in the dull tone carrying one of the five `JOINER_PARTING_LINES` sentences, and the Oracle log carries the same line (never a toast, never inline text — the v1.4 rail-is-the-one-feedback-surface ruling).
12. The Company panel is empty afterwards, and the next Joiner met can be accepted without a swap line (since `PARTY_CAP` is 1 and the roster is now genuinely empty, not just displaying zero members).
13. No toast or inline text appears anywhere for the parting line — only the rail card and the Oracle log.

### Plan 06

14. Accept any Joiner, open the Hero tab — the Company card shows name, sub / race, class · level, an HP bar (the label reads HP), `Weapon: <name>`, `Eats N a rest` (2 for a Troll Joiner, else 1), and a DISMISS button.
15. Tap DISMISS — it becomes `Send them off? [Yes] [No]`.
16. Tap No — reverts to the DISMISS button.
17. Tap DISMISS, wait 3 seconds without tapping anything — reverts.
18. Tap DISMISS, then tap anywhere else on screen — reverts.
19. Tap DISMISS → Yes — the card disappears, the panel hides (if it was the last member), the rail shows a COMPANY card (dull) with one of the five parting lines, the Oracle log has the same line, and no toast or text appears inside the panel itself.
20. During a fight, open the Hero tab — no DISMISS button appears on the card.
21. The Cutthroat dossier blurb on the Hero tab reads the new text ending in "one descent in twenty."
22. A Troll Joiner's card says `Eats 2 a rest`.

## Next Phase Readiness

- Phase 36 is fully closed: all six requirements (BAL-01, TGT-01, TGT-02, CUT-01, CUT-02, JOIN-01) landed, `npm test` is green at 2276/2276, and the parity master/fixtures are byte-identical to before the phase.
- `engine/effects.js` (Plan 02) is ready for Phases 38-40 to build their first real `start*` callers on top of the same timer shape.
- `engine/combat.js#normalizeTarget` (Plan 03), the `cutthroatMurderCheck`/`joinerMurdered` vocabulary (Plan 04), and `dismissJoiner`/`joinerDismissed`/`dismissRefused` (Plan 05) plus this plan's Company sheet/bridge (JOIN-01's full shell half) are complete and reusable as-is.
- The 22-item aggregated Pixel 7 checklist above (plus Plans 01/02's "nothing to add" notes) is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (`mazeworld.html`, `test/unit/shell-company-panel.test.js`, this SUMMARY.md); both task commit hashes (`6ce685a`, `d4364e2`) found in `git log --oneline --all`.
