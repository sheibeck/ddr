---
phase: 48-stale-docs-comments-test-names-purge
plan: 01
subsystem: testing
tags: [tooling, docs-sweep, comment-hygiene, engine-gate]

requires:
  - phase: 47-shell-modularisation
    provides: the final shell/module layout this sweep runs over
provides:
  - "tools/stale-terms.mjs — the reproducible criterion-1 grep table with an allow-list that fails loudly on rot"
  - "tools/comment-only-diff.mjs — the stripped-comments proof for the engine-gate fence"
  - "engine/ + content/ + tools/ident-sweep.mjs comment sweep — 16 sites, comment-only, proven"
affects: [48-02-PLAN.md, 48-03-PLAN.md, 48-04-PLAN.md, 48-05-PLAN.md]

tech-stack:
  added: []
  patterns:
    - "TERMS/ALLOWED table-driven scanner (node:fs/path/url only) mirroring tools/ident-sweep.mjs's CLI/self-test/direct-invocation-guard shape"
    - "comment-stripped diff proof (git show <ref>:<file> vs working tree, both stripped via ident-sweep.mjs's stripJs/stripHtml, whitespace-normalized compare)"

key-files:
  created:
    - tools/stale-terms.mjs
    - tools/comment-only-diff.mjs
  modified:
    - tools/ident-sweep.mjs
    - engine/character.js
    - engine/movement.js
    - engine/effects.js
    - engine/items.js
    - engine/derived.js
    - engine/combat.js
    - content/treasure-tables.js
    - content/foe-abilities.js

key-decisions:
  - "engine/effects.js's bespoke-field survivor list (darkFor/ward/afraid/foeEffect) was re-derived by grepping engine/*.js for each candidate live c.*/combat.* read rather than trusting the stale comment's list — haste/invis/ether/acute/flightLeft/flightCooldown/it.usedAt all turned out to be retired (moved to c.timers in Phase 39) and are no longer named"
  - "engine/derived.js:336's toastsCoverage.test.js reference confirmed renamed (not just deleted) via ls before rewriting to narrationLinesCoverage.test.js"

requirements-completed: []

coverage:
  - id: D1
    description: "tools/stale-terms.mjs prints the criterion-1 grep as one reproducible markdown table with an allow-list that fails loudly on rot"
    verification:
      - kind: unit
        ref: "node tools/stale-terms.mjs --self-test"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/comment-only-diff.mjs proves every engine/content/tools edit this plan made is comment-only"
    verification:
      - kind: integration
        ref: "node tools/comment-only-diff.mjs 649de2b engine content test/parity/fixtures"
        status: pass
    human_judgment: false
  - id: D3
    description: "engine/ + content/ comment sweep: 16 stale sites rewritten, zero unlisted enforced-term hits, only foldLegacyCounters survivors remain"
    verification:
      - kind: unit
        ref: "node tools/stale-terms.mjs --paths engine content"
        status: pass
      - kind: unit
        ref: "npm test (3288 pass / 0 fail)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-20
status: complete
---

# Phase 48 Plan 01: Stale-Terms Tripwire + Comment-Only-Diff Proof + Engine/Content Sweep Summary

**Built `tools/stale-terms.mjs` (the 11-term criterion-1 table with a rot-checked allow-list) and `tools/comment-only-diff.mjs` (the stripped-diff proof), then swept the 16 stale comment sites in `engine/`+`content/` describing retired counters, the toast surface, and a deleted shell mirror as if still live — every edit proven comment-only.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 11 (2 new tools, 1 tool edit, 8 engine/content files)

## Accomplishments

- `tools/stale-terms.mjs`: `TERMS` (11 rows, in ROADMAP criterion-1 order), `ALLOWED` (8 seeded class-C/D survivor entries, each verified against the live file), `scan()`/`renderTable()`/`defaultSources()`, CLI with `--paths`/`--json`/`--self-test` — exits 1 whenever an enforced row has an unlisted hit or an ALLOWED entry matches nothing (loud rot detection).
- `tools/comment-only-diff.mjs`: strips both sides of every changed file under given prefixes via `tools/ident-sweep.mjs`'s `stripJs`/`stripHtml`, whitespace-normalizes, and reports `comment-only:` vs `CODE CHANGED:` per file — the engine-gate fence's proof tool.
- `tools/ident-sweep.mjs`: two comment-only edits (future-tense Phase 48 reference now points at `tools/stale-terms.mjs`; the `"dpad"` string example replaced with a neutral legacy-save-key example).
- Rewrote 16 stale comment sites across 6 `engine/` files and 2 `content/` files (see list below) — every one proven comment-only by the stripped diff.

## Task Commits

1. **Task 1: tools/stale-terms.mjs + tools/comment-only-diff.mjs + ident-sweep.mjs's two stale lines** — `e3c0fac` (feat)
2. **Task 2: engine/ + content/ comment sweep** — `649d06b` (docs)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update is the final commit for this plan._

## Files Created/Modified

- `tools/stale-terms.mjs` — new: the criterion-1 tripwire tool
- `tools/comment-only-diff.mjs` — new: the stripped-diff proof tool
- `tools/ident-sweep.mjs` — head-comment tense fix + neutral string example
- `engine/character.js` — rollCharacter's flight-field comment rewritten (2 sites)
- `engine/movement.js` — ether-block rule rewritten, "eight toasts" → "eight rail lines", flight-timer comment shortened (3 sites)
- `engine/effects.js` — head comment's bespoke-field list corrected to darkFor/ward/afraid/foeEffect (1 site)
- `engine/items.js` — "Oracle/toasts/rail" → "Oracle/rail/fight log", retired-counters comment shortened (2 sites)
- `engine/derived.js` — toastsCoverage.test.js → narrationLinesCoverage.test.js, "fight log, toasts, the rail" → "fight log, the rail" (2 sites)
- `engine/combat.js` — "combat-start toast/report" → "combat-start rail card or report", dropped "toasts," from a surface list, replaced the dead parley-button-mirror duplicate-sync warning with a one-line "this is the ONLY canParley" statement (3 sites)
- `content/treasure-tables.js` — "chip/toast state" → "chip and the rail line state" (1 site)
- `content/foe-abilities.js` — "toast-length" → "one-line" (1 site)

## Baseline (measured, `node tools/stale-terms.mjs` at 649d06b's parent 649de2b, phase-start, before any sweep)

| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad\|dpad` | 21 | 0 | 21 | yes |
| toast | `toast` | 291 | 0 | 291 | yes |
| classic-engine | `dead classic\|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 79 | 0 | 79 | no |
| wornSlots | `wornSlots` | 8 | 0 | 8 | yes |
| legacy-counters | `flightLeft\|flightCooldown\|c\.ether` | 73 | 62 | 11 | yes |
| recentre | `recent(er\|re).*(every\|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card\|roundcard` | 19 | 0 | 19 | yes |
| retired-bridges | `__mz(ToHit\|StrikeDie\|ItemRowState\|Abilities\|Eff\|SlotFor\|WornSlots\|Gear\|WornKeysOf\|SellPrice\|RenderGrimoire\|Bags)\b` | 56 | 0 | 56 | yes |
| retired-files | `toasts\.js\|toastsCoverage\|toastTable\.test\|narrativeToasts\.test\|shell-toast-wiring\|toastsForAction\|tutorial\.js\|parley-button-mirror\|round-card-worst-case` | 22 | 0 | 22 | yes |
| legacy-won | `won: false\|state\.won\|winGame` | 74 | 0 | 74 | no |

(exit 1 at baseline — expected; the `## Allow-list rot` block was empty even at this un-swept commit, confirming every seeded ALLOWED entry already matched a live line. This full-repo table's large unlisted counts on `toast`/`round-card`/`retired-bridges`/`retired-files`/`legacy-won` are almost entirely `mazeworld.html`, `src/browser/`, and `test/` — Plans 02-05's scope, not this plan's.)

## Post-sweep table (`node tools/stale-terms.mjs --paths engine content`)

| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |
| --- | --- | --- | --- | --- | --- |
| dpad | `d-pad\|dpad` | 0 | 0 | 0 | yes |
| toast | `toast` | 0 | 0 | 0 | yes |
| classic-engine | `dead classic\|classic engine` | 0 | 0 | 0 | yes |
| classic-script | `classic script` | 0 | 0 | 0 | no |
| wornSlots | `wornSlots` | 0 | 0 | 0 | yes |
| legacy-counters | `flightLeft\|flightCooldown\|c\.ether` | 11 | 11 | 0 | yes |
| recentre | `recent(er\|re).*(every\|each) step` | 0 | 0 | 0 | yes |
| round-card | `round card\|roundcard` | 0 | 0 | 0 | yes |
| retired-bridges | `__mz(...)\b` | 0 | 0 | 0 | yes |
| retired-files | `toasts\.js\|...` | 0 | 0 | 0 | yes |
| legacy-won | `won: false\|state\.won\|winGame` | 0 | 0 | 0 | no |

**Exit code: 0.** `## Unlisted`: (none). `## Allow-list rot`: (none). `## Allowed survivors` lists only `engine/saveState.js` lines 479, 491–494, 517, 519–521, 524, 620 — all `foldLegacyCounters`'s tolerant-load reads and its doc comment (class C, seeded in Task 1, untouched).

## Engine/content lines rewritten vs. deleted

All 16 sites were **rewritten** (none deleted outright — every stale sentence still had a live replacement fact worth keeping):

| File:Line (pre-sweep) | Was | Now |
|---|---|---|
| `engine/character.js:562-565` | 4-line "the retired Cloak-of-Flying flightLeft/flightCooldown pair" note | 1-line: the Cloak of Flying's effect/cooldown is a `c.timers` record started by `engine/movement.js`'s climb/gorge block |
| `engine/character.js:570` | "placed alongside the darkFor/flightLeft/flightCooldown plain scalars" | "placed alongside the `darkFor` plain scalar" |
| `engine/movement.js:210-220` | "the field was only ever set + ticked down... READ NOWHERE" (ether) | the current itemEffectActive(state.c, "ether")-gated rule |
| `engine/movement.js:344` | "(an 8-cell pool never stacks eight toasts)" | "(an 8-cell pool never stacks eight rail lines)" |
| `engine/movement.js:445-447` | "the retired Cloak-of-Flying flightLeft/flightCooldown pair" | 1-line: the Cloak of Flying's effect/cooldown rides the same `c.timers` tick |
| `engine/effects.js:4-9` | "Do NOT retrofit ... (darkFor/haste/invis/ether/acute/flightLeft/flightCooldown/ward/afraid/foeEffect/it.usedAt)" | names only the fields still bespoke: `darkFor`/`ward`/`afraid`/`foeEffect` (verified live via grep) |
| `engine/items.js:1104` | "the Oracle/toasts/rail narrate" | "the Oracle/rail/fight log narrate" |
| `engine/items.js:1299-1302` | "the retired scattered counters (c.might.../c.haste/c.acute/c.invis/c.ether)" | 1-line: applyActivation starts the item's own `c.timers` record |
| `engine/derived.js:336` | "test/unit/toastsCoverage.test.js's event-vocabulary scanner" | "test/unit/narrationLinesCoverage.test.js's event-vocabulary scanner" |
| `engine/derived.js:933` | "(the fight log, toasts, the rail, the combat submenu)" | "(the fight log, the rail, the combat submenu)" |
| `engine/combat.js:280` | "(e.g. a combat-start toast/report)" | "(e.g. a combat-start rail card or report)" |
| `engine/combat.js:975-977` | "(this event, the fight log, toasts, the rail, the combat submenu)" | dropped "toasts," |
| `engine/combat.js:1029-1031` | "mazeworld.html's classic canParley() duplicate ... MUST mirror this exact decision order" | "This function is the ONLY canParley — the shell reaches it through the engine bridge; there is no duplicate to keep in step." |
| `content/treasure-tables.js:215` | "the chip/toast state the exact numbers" | "the chip and the rail line state the exact numbers" |
| `content/foe-abilities.js:23` | "a complete, toast-length, family-friendly deadpan sentence" | "a complete one-line, family-friendly deadpan sentence" |

Plus `tools/ident-sweep.mjs`'s own two stale lines (Task 1): the future-tense "Phase 48's docs/comments sweep" reference and the `"dpad"` string-literal example.

## Comment-only-diff proof

```
node tools/comment-only-diff.mjs 649de2b engine content test/parity/fixtures
comment-only: content/foe-abilities.js
comment-only: content/treasure-tables.js
comment-only: engine/character.js
comment-only: engine/combat.js
comment-only: engine/derived.js
comment-only: engine/effects.js
comment-only: engine/items.js
comment-only: engine/movement.js
comment-only-diff 649de2b: 8 changed, 0 code-changed
exit=0
```

`git diff --stat 649de2b -- test/parity/fixtures test/parity/prototype-master.js.txt` → empty (nothing moved).

## Gate results (exact counts)

- `npm test`: **# pass 3288, # fail 0** (measured after both commits)
- `node --test test/parity/*.test.js`: **# pass 39, # fail 0**
- `node --test test/unit/shell-tab-snapshots.test.js`: **10/10**, `git diff --stat -- test/unit/fixtures/` empty
- `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `grep -c "parley-button-mirror" engine/combat.js` → 0
- `grep -c "toastsCoverage" engine/derived.js` → 0
- `grep -ciE "toast" engine/*.js content/*.js | grep -v ":0$" | wc -l` → 0
- `node tools/ident-sweep.mjs --self-test` → PASS (unchanged CLI behavior)
- `node tools/stale-terms.mjs --self-test` → PASS

## Decisions Made

- **engine/effects.js survivor list re-derived, not copied.** The stale comment named 11 fields as "existing bespoke fields." Rather than trust it, I grepped `c.<field>`/`combat.<field>` usage across `engine/*.js` for each candidate before naming any in the rewrite. Only `darkFor`, `ward`, `afraid` (on `combat`, not `c`), and `foeEffect` are still read as live bespoke fields; `haste`/`invis`/`ether`/`acute`/`flightLeft`/`flightCooldown`/`it.usedAt` all resolved to retired (Phase 39 moved them onto `c.timers`) — every live mention of those names elsewhere in `engine/*.js` is itself a comment describing the retirement, confirming they're gone from the runtime shape.
- **narrationLinesCoverage.test.js confirmed via `ls` before rewriting**, per the task's read-first instruction, rather than assuming the rename target name.

## Deviations from Plan

None — plan executed exactly as written. All 16 sites matched the plan's anchored quotes (allowing for a few lines of drift from the CONTEXT's 649de2b line numbers, located by content as instructed); no unplanned auto-fixes were needed.

## Issues Encountered

None.

## Human verification (deferred to end of run)

None — no user-visible change. This plan touches only `tools/` scripts and comment lines inside `engine/`/`content/` files; no rendered UI, save data, or gameplay behavior differs. `npm test` (3288/0), the parity suite (39/0), and the master hash (unchanged) are the complete proof.

## Next Phase Readiness

- `tools/stale-terms.mjs` and `tools/comment-only-diff.mjs` are ready for Plans 02-05 to reuse: each appends its own `ALLOWED` entries and re-runs the scoped scan.
- Plan 02 (`mazeworld.html` + `src/browser/*`) can proceed — no blockers.
- The full-repo baseline table above still shows large unlisted counts on `toast`/`d-pad`/`round-card`/`retired-bridges`/`retired-files`/`legacy-won` — all in `mazeworld.html`, `src/browser/`, and `test/`, which are explicitly out of this plan's scope (Plans 02-04).

---
*Phase: 48-stale-docs-comments-test-names-purge*
*Plan: 01*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: tools/stale-terms.mjs
- FOUND: tools/comment-only-diff.mjs
- FOUND: commit e3c0fac
- FOUND: commit 649d06b
