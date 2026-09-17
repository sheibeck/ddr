---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 04
subsystem: engine
tags: [cutthroat, joiner, canon-reversal, new-rng-draw, new-event, voice, identity-contract, deferred-uat]

# Dependency graph
requires:
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 02)
    provides: "engine/effects.js landed first so this plan's engine/movement.js edits (descend, last statement) never collide with Plan 02's per-step tickSquares call"
provides:
  - "engine/movement.js export function cutthroatMurderCheck(state, rng, events) — one guarded d20 in descend(), called LAST (after checkLevel, genFloor, floorChanged)"
  - "new event joinerMurdered { name, sub, depth }"
  - "engine/encounters.js#meetJoiner refusal ternary reduced to the Wilmsry clause (CUT-01 canon reversal)"
  - "content/flavor.js SUB_NOTE.Cutthroat rewrite + JOINER_MURDER_LINES (6 lines)"
  - "src/browser/eventNarration.js EVENT_NARRATION.joinerMurdered, src/browser/toasts.js TOAST_FOR.joinerMurdered + FEATURE_EVENTS, src/browser/rail.js RAIL_FAMILY.joinerMurdered"
  - "docs/CLASS-PASS.md Cutthroat good/bad row on the murder risk"
  - "test/unit/cutthroat-joiner.test.js — draw-order, gating, murder, offer, narration/toast/rail proofs"
affects: ["36-06 (mazeworld.html SUB_NOTE.Cutthroat shell sync, Company sheet dismissal UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cutthroatMurderCheck follows the tick-site precedent (guarded on a condition false for every fixture/bot/old save) rather than effects.js's timer shape — it is a one-shot per-descent check, not a duration"
    - "joinerMurdered's narration line pick is deterministic (name length + depth, no rng) mirroring joinerLeft's own JOINER_EXIT_LINES pattern exactly"
    - "a canon reversal (CUT-01) is declared via a DELIBERATE RULES CHANGE comment at the exact ternary it replaces, naming the phase/date/requirement id, mirroring every prior phase's divergence-declaration convention"

key-files:
  created:
    - test/unit/cutthroat-joiner.test.js
  modified:
    - engine/movement.js
    - engine/encounters.js
    - content/flavor.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - docs/CLASS-PASS.md
    - test/unit/identity-contract.test.js
    - test/unit/identity-world.test.js
    - test/unit/toastTable.test.js
    - test/voice/safety-scan.test.js

key-decisions:
  - "Task order (murder mechanics first, refusal reversal second) kept the suite green at every commit: Task 1 landed cutthroatMurderCheck + narration while the OLD Cutthroat refusal still stood (reachable only through a planted party, since meetJoiner still refused a Cutthroat at that point); Task 2 flipped the ternary and rewrote every refusal-dependent test in the same commit."
  - "test/unit/cutthroat-joiner.test.js was extended in place (not split into a second file) across both tasks — its Task 2 section was written and verified RED (4 failing assertions against the still-refusing engine) before engine/encounters.js was touched, then re-verified GREEN after."
  - "The identity-contract Cutthroat BAD entry now drives the full accept-then-murder path (meetJoiner -> resolveJoiner -> cutthroatMurderCheck) rather than a bare refusal assertion, matching the new mechanic; the Soldier control proves a non-Cutthroat never loses the Joiner to this check."

requirements-completed: [CUT-01, CUT-02]

coverage:
  - id: D1
    description: "cutthroatMurderCheck(state, rng, events) draws rng.d(20) only for a Cutthroat with a non-empty party; on a 1 splices party[0] and pushes joinerMurdered; on 2..20 nothing changes; for any other sub or an empty party it draws nothing (fail-open on undefined/null/non-array party); descend() calls it LAST"
    requirement: CUT-02
    verification:
      - kind: unit
        ref: "test/unit/cutthroat-joiner.test.js (18 tests: pure-helper murder-check semantics, descend draw-order/gating/measured-firing-seed proofs)"
        status: pass
      - kind: other
        ref: "grep -c '^export function cutthroatMurderCheck(state, rng, events = \\[\\])' engine/movement.js == 1; grep -c 'cutthroatMurderCheck(state, rng, events);' engine/movement.js == 1 (immediately before descend's return); grep -c 'rng.d(20) === 1' == 1; grep -c 'state.party.splice(0, 1)' >= 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "EVENT_NARRATION.joinerMurdered, TOAST_FOR.joinerMurdered (priority feature, tone hurt) and RAIL_FAMILY.joinerMurdered (COMPANY / bad) exist; the narration picks one of six JOINER_MURDER_LINES deterministically from name length + depth, html-escapes the name; both coverage guards and the voice-safety scan stay green"
    requirement: CUT-02
    verification:
      - kind: unit
        ref: "test/unit/cutthroat-joiner.test.js (narration/toast/rail section: determinism, all-six-reachable, escapeHtml, bare-{type}-call safety); test/unit/toastsCoverage.test.js; test/unit/formatEventsCoverage.test.js; test/voice/safety-scan.test.js"
        status: pass
      - kind: other
        ref: "grep -c 'joinerMurdered' src/browser/eventNarration.js == 1; grep -c 'joinerMurdered' src/browser/toasts.js == 2; grep -c 'joinerMurdered: { icon: \"◇\", title: \"COMPANY\", tone: \"bad\" }' src/browser/rail.js == 1; grep -c 'JOINER_MURDER_LINES' test/voice/safety-scan.test.js == 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "meetJoiner for a Cutthroat sets state.pendingJoiner (a full sheet) and emits joinerMet with NO joinerRefused; rng cursor after the call equals a Soldier control's (4 draws); the Wilmsry-vs-Magic-User refusal still fires with reason wilmsry"
    requirement: CUT-01
    verification:
      - kind: unit
        ref: "test/unit/cutthroat-joiner.test.js (offer/Wilmsry-unchanged/full-flow tests); test/unit/identity-world.test.js (rewritten offer tests); test/unit/identity-contract.test.js (rewritten BAD entry, retitled idempotency test); test/unit/toastTable.test.js; test/voice/safety-scan.test.js"
        status: pass
      - kind: other
        ref: "grep -c 'c.sub === \"Cutthroat\"' engine/encounters.js == 0; grep -c 'DELIBERATE RULES CHANGE (Phase 36' engine/encounters.js == 1; grep -c 'wants no part of a Cutthroat' src/browser/toasts.js == 0; grep -c 'reason: \"cutthroat\"' across all four test files == 0 each"
        status: pass
    human_judgment: false
  - id: D4
    description: "content/flavor.js SUB_NOTE.Cutthroat states the odds in plain words, mentions the first landed blow, and no longer says no Joiner will travel with you; docs/CLASS-PASS.md's row matches (30 data rows unchanged); identity-contract's Cutthroat entry still shows one GOOD and one BAD"
    requirement: CUT-01
    verification:
      - kind: other
        ref: "node -e blurb regex check: one descent in twenty=true, first landed blow=true, no Joiner will ever=false; grep -c the exact CLASS-PASS.md row == 1; test/unit/class-pass-ledger.test.js (30-row assertion) passes"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test prints '# fail 0'; fixtures untouched; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0; no shell/package change from this plan"
    requirement: CUT-01, CUT-02
    verification:
      - kind: other
        ref: "npm test 2244/2244 (# fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt unchanged; git diff --stat -- test/parity package.json package-lock.json mazeworld.html empty"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 04: Cutthroat Joiner Reversal & Murder Risk Summary

**A Cutthroat can now accept a Joiner like anyone else (the Phase 24 refusal is a declared canon reversal), and each descent with a Joiner carries a stated 1-in-20 chance the Joiner is murdered — a single guarded d20 drawn LAST in `descend()`, narrated with its own event type and six deterministic sarcastic lines so it reads as a joke, not a bug.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-17T17:05:00Z
- **Completed:** 2026-09-17T17:29:00Z
- **Tasks:** 3
- **Files modified:** 11 (1 created, 10 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `engine/movement.js` gains `export function cutthroatMurderCheck(state, rng, events = [])`, called as `descend()`'s LAST statement (after `checkLevel`, `genFloor`/`reveal`, and the `floorChanged` push). Gated on `state.c.sub === "Cutthroat" && Array.isArray(state.party) && state.party.length > 0` — the d20 is drawn only inside that gate, so every parity fixture (lose-plain, seed 1119, is a Cutthroat with `party: []`), every bot run (the bot declines every Joiner), and every pre-Phase-36 save (a Cutthroat could never have accepted one) draws nothing and stays byte-identical. On a natural 1, `state.party.splice(0, 1)[0]` is removed and a `joinerMurdered { name, sub, depth }` event is pushed.
- `content/flavor.js` gains `JOINER_MURDER_LINES` (6 sarcastic, family-friendly lines with `{name}`/`{depth}` tokens) and a rewritten `SUB_NOTE.Cutthroat` blurb that states the odds in plain words ("one descent in twenty") and keeps the first-landed-blow crit.
- `src/browser/eventNarration.js` gains `EVENT_NARRATION.joinerMurdered`, picking one of the six lines deterministically (name length + depth, zero rng) and html-escaping the name, mirroring `joinerLeft`'s exact pattern.
- `src/browser/toasts.js` gains `TOAST_FOR.joinerMurdered` (priority feature, tone hurt) and adds `joinerMurdered` to `FEATURE_EVENTS`; the fallback/coverage table text is replaced on the `move` action by the narrative Oracle line, matching the `joinerLeft` precedent.
- `src/browser/rail.js` gains `RAIL_FAMILY.joinerMurdered: { icon: "◇", title: "COMPANY", tone: "bad" }`.
- `engine/encounters.js#meetJoiner`'s refusal ternary drops the `c.sub === "Cutthroat"` clause entirely (DELIBERATE RULES CHANGE, Phase 36, 2026-09-17, CUT-01) — only the Wilmsry-vs-Magic-User refusal remains. Zero rng change: the same four draws fire either way, and the refusal stays a pure read.
- The dead Cutthroat refusal copy is removed from `src/browser/toasts.js`'s `joinerRefused` reason map (the `wilmsry` row and the generic fallback stay); `eventNarration.js`'s comment is updated to match (its code was already wilmsry-or-fallback, so no code change there).
- `test/unit/identity-contract.test.js`'s Cutthroat `bad` entry is rewritten onto the murder risk (accept via `resolveJoiner`, then `cutthroatMurderCheck` on a natural 1, with a Soldier control proving a non-Cutthroat never loses the Joiner); the idempotency test is retitled from "refusal" to "OFFER". `test/unit/identity-world.test.js`'s two Cutthroat `meetJoiner` tests are rewritten as offer tests. `test/unit/toastTable.test.js` and `test/voice/safety-scan.test.js` swap their Cutthroat-refusal probes for the Wilmsry one.
- `docs/CLASS-PASS.md`'s Cutthroat row states the murder risk (the good/bad table keeps exactly 30 data rows, confirmed by `test/unit/class-pass-ledger.test.js`).
- `test/unit/cutthroat-joiner.test.js` (new, 18 tests): pure `cutthroatMurderCheck` semantics (fire/spare/gate/fail-open), `descend` draw-order and zero-draw-gate proofs, a measured (scanned, not hand-computed) seed that fires the murder via `descend`, `EVENT_NARRATION`/`TOAST_FOR`/`RAIL_FAMILY` proofs, and the Task 2 offer/Wilmsry-unchanged/full-flow/identity-contract-mirror tests.
- Full gate: `npm test` 2244/2244 (`# fail 0`); `test/parity/fixtures` untouched; `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); no `test/parity`/`package.json`/`package-lock.json`/`mazeworld.html` byte touched by this plan; `git diff --stat v1.4.0 -- engine content src` lists this plan's files alongside Plans 02/03's.

## Task Commits

Each task was committed atomically:

1. **Task 1: cutthroatMurderCheck in descend() (one guarded d20, last), the joinerMurdered event, six murder lines, and the narration/toast/rail entries (refusal still in place)** — `e0c0e57` (feat) — `feat(36-04): cutthroatMurderCheck in descend() — the joinerMurdered event, six murder lines, narration/toast/rail entries`
   - `engine/movement.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/voice/safety-scan.test.js`, `test/unit/cutthroat-joiner.test.js` (new)
2. **Task 2: reverse the Cutthroat refusal (declared canon change), rewrite the blurb, remove the dead refusal copy, and move the identity contract + ledger row onto the murder risk** — `9b3d92f` (feat) — `feat(36-04): reverse the Cutthroat Joiner refusal (CUT-01) — blurb, identity contract, and ledger row move onto the murder risk`
   - `engine/encounters.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `test/unit/identity-contract.test.js`, `test/unit/identity-world.test.js`, `test/unit/toastTable.test.js`, `test/voice/safety-scan.test.js`, `docs/CLASS-PASS.md`, `test/unit/cutthroat-joiner.test.js`
3. **Task 3: Gate + SUMMARY (rng/serialized-field statements, canon-divergence declaration, deferred on-device checks)** — this commit (docs) — no source files changed, gate re-verified green.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: Task 1's `test/unit/cutthroat-joiner.test.js` was written first (murder-check + descend + narration/toast/rail tests) and ran GREEN against the freshly-implemented engine on the first full run — no separate RED gate was possible for Task 1 because the file did not exist yet to fail against. Task 2 genuinely ran RED-then-GREEN: the file was extended with the offer/Wilmsry/full-flow/identity-contract-mirror tests BEFORE `engine/encounters.js` was touched, verified 4 tests failing against the still-refusing engine, then re-verified all 18 tests passing after the ternary was flipped and the dependent tests in `identity-contract.test.js`/`identity-world.test.js`/`toastTable.test.js`/`safety-scan.test.js` were rewritten in the same commit._

## Files Created/Modified

- `engine/movement.js` - `cutthroatMurderCheck(state, rng, events)` (new export, directly above `descend`); `descend`'s last statement now calls it
- `engine/encounters.js` - `meetJoiner`'s refusal ternary reduced to the Wilmsry clause; DELIBERATE RULES CHANGE comment (Phase 36, CUT-01) replaces the Phase 24 one
- `content/flavor.js` - `JOINER_MURDER_LINES` (new, 6 lines); `SUB_NOTE.Cutthroat` rewritten
- `src/browser/eventNarration.js` - `EVENT_NARRATION.joinerMurdered` (new); `joinerRefused`'s comment updated
- `src/browser/toasts.js` - `TOAST_FOR.joinerMurdered` (new); `FEATURE_EVENTS` += `"joinerMurdered"`; the dead Cutthroat row removed from `joinerRefused`'s reason map
- `src/browser/rail.js` - `RAIL_FAMILY.joinerMurdered` (new)
- `docs/CLASS-PASS.md` - Cutthroat good/bad row updated (30 rows unchanged)
- `test/unit/identity-contract.test.js` - imports extended (`resolveJoiner`, `cutthroatMurderCheck`); Cutthroat `bad` entry rewritten; idempotency test retitled
- `test/unit/identity-world.test.js` - the two Cutthroat `meetJoiner` tests rewritten as offer tests
- `test/unit/toastTable.test.js` - Cutthroat refusal probe swapped for Wilmsry
- `test/voice/safety-scan.test.js` - `JOINER_MURDER_LINES` import + push loop (new); Cutthroat `BRANCH_TOGGLES` probe removed
- `test/unit/cutthroat-joiner.test.js` - new file, 18 tests across both tasks

## Decisions Made

- **Task ordering kept the suite green at every commit:** Task 1 landed the murder mechanics while the OLD Cutthroat refusal still stood — `cutthroatMurderCheck` is reachable in isolation via a planted `state.party` (bypassing `meetJoiner`, which still refused a Cutthroat at that point), so its own tests never depended on the refusal being reversed yet. Task 2 flipped the ternary and rewrote every test that asserted the old refusal in the same commit, so no intermediate commit ever left the suite red or the refusal half-reversed.
- **`cutthroat-joiner.test.js` extended in place across both tasks:** rather than a second file, Task 2's offer/Wilmsry/full-flow/identity-contract-mirror tests were appended to the Task 1 file and verified failing (RED, 4 of 18) before `engine/encounters.js` was touched, then re-verified passing (GREEN, 18/18) after the reversal — giving Task 2 a genuine TDD gate despite Task 1 not having one of its own.
- **Identity-contract BAD entry now drives the full lifecycle** (offer → accept → murder-check) instead of a bare refusal assertion, since the refusal no longer exists for a Cutthroat; the Soldier control in the same test proves the murder check is a Cutthroat-only mechanic, not a general party-loss risk.

## Deviations from Plan

None. Every locked API surface (the `cutthroatMurderCheck` signature and gate, the exact six `JOINER_MURDER_LINES`, the narration/toast/rail entries, the exact blurb and ledger-row text, the reversed ternary) matches the plan verbatim.

## Issues Encountered

None. Both task-level test runs passed cleanly on the first attempt after their respective implementation landed; no auto-fix, no fixture drift, no regeneration needed.

## Declared canon divergence (Phase 36, CUT-01/CUT-02)

Phase 24's unconditional Cutthroat Joiner refusal is REVERSED (CUT-01): a Joiner now travels with a Cutthroat like any other hero. In its place, CUT-02 adds a per-descent murder risk (a natural 1 on a d20, one descent in twenty) that removes the sole party member.

**NO fixture is affected.** The murder draw's gate (`c.sub === "Cutthroat" && state.party?.length > 0`) is false for every fixture, bot run, and pre-Phase-36 save by construction:
- **lose-plain** (`action-script.combat.json`, seed 1119) is the one Cutthroat fixture in the parity suite — a plain Human Cutthroat with `party: []` who fights and dies without ever descending, so the gate never opens for it.
- No fixture is a Cutthroat that both has a party member AND calls `descend()`.
- The tuning bot (`tools/tune-classes.mjs`) declines every Joiner offer, so its Cutthroat runs never carry a party either.

Because the gate is unreachable for every existing fixture, **no fixture was regenerated and no before/after fixture table is needed** — the change is additive-only from the parity suite's perspective, proven by `git status --porcelain test/parity/fixtures` staying empty and the master hash staying `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` across both task commits.

## rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** adds exactly ONE d20 draw, in `descend()`, AFTER every existing draw (`checkLevel`, `genFloor`, `reveal` — the last statement before `return events`), reachable ONLY when `c.sub === "Cutthroat"` AND `state.party` has at least one member — false for every parity fixture (lose-plain, seed 1119, IS a Cutthroat but its party is `[]` and it never descends), for every bot run (the tuning bot always declines Joiners), and for every pre-Phase-36 save (a Cutthroat could never have accepted a Joiner before this plan). `meetJoiner`'s four draws are untouched — the refusal ternary is a pure read, unchanged by CUT-01.
- **serialized_field_impact:** none — a murder splices `state.party` (an existing field, already carved out of every parity comparable since Phase 7/25.1); no new field is added; `joinerMurdered`/the reversed refusal are events and a code-path change, not state.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol, no device pause was taken. The following checks are queued for the aggregated end-of-run Pixel 7 batch:

1. Roll a Cutthroat and walk until a Joiner is met — the rail shows the COMPANY offer card (TAKE THEM ALONG / LEAVE THEM) instead of a refusal.
2. Accept the Joiner, open the Hero tab — the Company panel lists them (per the existing `renderPartyRoster()` surface; the dedicated Company sheet lands in Plan 06).
3. Descend floor after floor until the murder line fires (1-in-20 per descent — may take a while; the dev start-depth harness can speed floors) — the rail shows a COMPANY card in the bad tone with one of the six lines, the Oracle log carries the same line, and the party/Company panel is empty afterwards.
4. As a Wilmsry meeting a Magic User Joiner, confirm the refusal still reads exactly as before (unaffected by this plan).
5. Read the Cutthroat dossier blurb on the Hero tab — it should state "one descent in twenty" (note: the shell's own `SUB_NOTE.Cutthroat` copy is synced from `content/flavor.js` in Plan 06; until then the Hero tab may still show the old shell-side copy).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 05-06 of Phase 36 (`dismissJoiner`, the Company sheet + shell `SUB_NOTE` sync) build directly on this plan's reversed refusal and murder event — a Cutthroat's Joiner is now a real, dismissible, murderable party member instead of an unreachable state.
- `engine/movement.js#cutthroatMurderCheck` and the `joinerMurdered` event/narration/toast/rail vocabulary are complete and reusable as-is; no further engine work is needed for CUT-01/CUT-02.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (`engine/movement.js`, `engine/encounters.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `docs/CLASS-PASS.md`, `test/unit/identity-contract.test.js`, `test/unit/identity-world.test.js`, `test/unit/toastTable.test.js`, `test/voice/safety-scan.test.js`, `test/unit/cutthroat-joiner.test.js`, this SUMMARY.md); both task commit hashes (`e0c0e57`, `9b3d92f`) found in `git log --oneline --all`.
