---
phase: 26-mass-playtest-class-pass-ledger
plan: 03
subsystem: testing
tags: [class-pass, fun-band, verdicts, editorial, ledger, outliers, handoff, play-02, play-03]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 01
    provides: "tools/class-pass-diff.mjs (bands, mu, --gate, renderMarkdown, mergeEditorial)"
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 02
    provides: "docs/class-pass/after.json + after-depth20.json, cannot-act gate PASSED at pin d1e3235, ledger AFTER heading/provenance/transcripts"
provides:
  - "docs/class-pass/verdicts.json — schema class-pass-verdicts/1, bands for 24 subs + 6 races, editorial verdict/reason on the two rows that needed one (Ninja, Wilmsry), no verdict on any other row, no verdict/band on the depth-20 slice"
  - "docs/CLASS-PASS.md — AFTER comparison block, '## Outliers (Phase 26 — revisit list)', '## Handoff to Phase 27' — eight H2 sections total, all machine-rendered from verdicts.json"
affects: ["26-04"]

tech-stack:
  added: []
  patterns:
    - "Editorial column is a scoped diff on verdicts.json (two Edit calls, not a rewrite) — every other field stays exactly as class-pass-diff.mjs emitted it, proven by the fixed-point cmp check (re-render == committed bytes)"
    - "Ledger pastes are byte-exact substrings of the script's own --section output, verified with includes() rather than retyped, so 'numbers never retyped' holds structurally, not by inspection"

key-files:
  created:
    - docs/class-pass/verdicts.json
  modified:
    - docs/CLASS-PASS.md

key-decisions:
  - "Only two rows out of 30 sub/race rows carry an editorial verdict: Ninja (too strong, out of band) and Wilmsry (fine, but the plan's locked rule requires an explicit accept sentence on it regardless of band). Every other sub/race row landed in band (113 of 143 cells in band; the appendix's 30 out-of-band CELLS are a different, unjudged granularity from the 30 sub/race ROWS)."
  - "Ninja verdict = accept, not revisit: its AFTER top death causes are ordinary deaths (Werebeast, trap, starvation — not 'died to its own opener'), its kills (13.7) sit in the same order of magnitude as its Thief peers (Acrobat 9.17, Cat Burglar 8.15), and its bad (canParley false) still bites every fight. This is the exact 'too strong, accepted — the opener is the whole fantasy' row 26-CONTEXT.md names as a valid outcome."
  - "Wilmsry verdict = accept using the plan's own template sentence, with the actual AFTER/BEFORE numbers substituted (AFTER 3.92, BEFORE 3.93): the Joiner refusal (Phase 24) closed the gap that was 3.93 mean depth (far ahead of the race median) down into the fine band, so the deferred numeric trims (parley +4, heal 2x) are no longer needed and stay untouched."

requirements-completed: [PLAY-02, PLAY-03]

coverage:
  - id: D1
    description: "verdicts.json carries bands for every sub-class (24) and race (6) row with BEFORE mean, AFTER mean, delta, reach-5 BEFORE/AFTER; every out-of-band row (only Ninja) carries a verdict + one-sentence reason; the file is a fixed point of the script's own merge"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "node -e verify printed 'class-pass-verdicts/1 24 6 0 true true true true'; cmp docs/class-pass/verdicts.json against a fresh re-render exited rc=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wilmsry always carries a verdict (accept iff not too strong), no in-band row other than Wilmsry carries a verdict, no revisit row exists without a lever (vacuously true — zero revisit rows), no reason exceeds 200 chars"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "node -e checks printed 'true true' (Wilmsry rule) and 'true true' (length + null-fine rule)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cannot-act gate re-run clean (0 of 143) before any verdict was written; no depth-20 row carries a band or verdict key"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json -> 'cannot-act cells: 0 of 143', rc=0; node -e v.deep.bySub.every(no band/verdict) -> true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ledger has eight H2 sections in the fixed order (Bot proxy -> How to reproduce -> BEFORE -> Outliers/Findings -> Rulings -> AFTER -> Outliers (Phase 26) -> Handoff to Phase 27); AFTER section's first line is the zero-cannot-act headline; all three script sections (after/outliers/handoff) are byte-exact substrings of the ledger"
    requirement: "PLAY-03"
    verification:
      - kind: other
        ref: "grep -n '^## ' pipeline printed the exact expected pipe-joined heading list; node -e includes() check printed 'true,true,true 8 ## Handoff to Phase 27'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The good/bad 30-row table is not duplicated; the ledger commit only adds lines relative to HEAD~1 (nothing above the AFTER heading, and none of 26-02's provenance/transcripts, was touched)"
    requirement: "PLAY-03"
    verification:
      - kind: other
        ref: "grep -c '| Sub / Race | GOOD | BAD |' -> 1; git diff HEAD~1 -- docs/CLASS-PASS.md | grep '^-' | grep -v '^---' | wc -l -> 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Engine/content/src/shell/harness untouched from the pin; full suite green at the 1410 floor"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "git diff --quiet d1e3235 -- engine content src mazeworld.html tools (rc=0); npm test -> '# tests 1410 / # pass 1410 / # fail 0'"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-09-15
status: complete
---

# Phase 26 Plan 03: Class-Pass Verdicts — AFTER Fun Bands, Outliers, Phase 27 Handoff Summary

**Judged the AFTER matrix against its own mu (3.08, band edges 2.31-4.15): only Ninja (too strong) and Wilmsry (fine, by design exception) needed a written verdict, both accepted — every other sub-class and race landed in band, the caster problem is gone, and the ledger now closes with a machine-rendered Handoff block for Phase 27.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-15
- **Tasks:** 2 of 2 complete
- **Files modified:** 1 modified (`docs/CLASS-PASS.md`), 1 created (`docs/class-pass/verdicts.json`)

## Accomplishments

- **Preflight clean:** `git status --porcelain` empty; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` rc=0; `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` printed `cannot-act cells: 0 of 143` (rc=0) before any verdict was written.
- **verdicts.json rendered and hand-edited:** `schema class-pass-verdicts/1`, 24 subs, 6 races, `cannotAct: []`, `meta.parity.natural.ok && meta.parity.deep.ok` both true. Of the 30 sub/race rows, only **1 was out-of-band** (Ninja, too strong) and one in-band row (Wilmsry) required an explicit verdict per the plan's locked exception rule — every other row kept `verdict/reason/lever: null`. The file is a fixed point of the script's own merge (`cmp` against a fresh re-render exits rc=0).
- **Ledger completed:** the AFTER comparison block (zero-cannot-act headline, by-class roll-up, bottom/top-five subs, race table, all 24 subs, reach table, depth-20 yardstick, out-of-band appendix) pasted verbatim between the AFTER heading and 26-02's provenance sub-heading; `## Outliers (Phase 26 — revisit list)` (empty — "No revisit rows — every out-of-band row was accepted."); `## Handoff to Phase 27` closing the file with the natural/depth-20 roll-ups, the accepted-but-strong list, and caveats. Eight H2 sections in the fixed order, verified byte-exact against the script's `--section` output.
- **Engine/harness untouched, suite green:** `git diff --quiet d1e3235 -- engine content src mazeworld.html tools` rc=0; `npm test` 1410/1410 (`# fail 0`); the ledger commit is 4,964 insertions, 0 deletions relative to HEAD~1.

## Headline Answers (quoting the rendered numbers)

- **mu (AFTER, run-weighted) = 3.08** (BEFORE mu = 2.97, delta +0.10). Band edges: too weak < **2.31** (0.75mu), fine **2.31–4.15** (closed interval), too strong > **4.15** (1.35mu).
- **By-class BEFORE -> AFTER mean depth:** Thief 3.42 -> 3.51 (+0.09), Fighter 3.05 -> 3.16 (+0.11), Magic User 2.44 -> 2.55 (+0.11). Every class improved slightly; the rank order (Thief > Fighter > Magic User) is unchanged from BEFORE.
- **Which classes over/under-perform now:** Thief remains the top class and Magic User remains the bottom class by mean depth, but the gap narrowed — Magic User's mean kills nearly doubled (2.41 -> 4.99) and every one of its four bottom sub-classes (Warlock, Wizard, Court Mage, Illusionist, Apprentice) sit comfortably inside the fine band, none flagged too weak. No sub-class or race is too weak in the AFTER matrix — the only out-of-band row in either direction is Ninja, too strong.
- **Did the caster problem go away:** Yes. All 8 Magic User sub-classes (Sorcerer, Summoner, Cleric, Warlock, Wizard, Court Mage, Illusionist, Apprentice) landed in the fine band with AFTER mean depths from 2.35 to 2.88 — none below the 2.31 too-weak floor. Summoner posted the single largest depth gain of any sub-class in the matrix (2.18 -> 2.71, +0.53) and Illusionist gained +0.21; every caster's mean kills rose substantially (e.g. Cleric 1.58->5.31 pooled by race is illustrative; class-level Magic User kills 2.41->4.99). Phase 23's "casters can act" fix reads as durable at 5,720-run scale.
- **Wilmsry's disposition:** in band (AFTER 3.92, BEFORE 3.93, delta -0.01) — verdict **accept**, reason: "in band at AFTER 3.92 (BEFORE 3.93) — the Joiner refusal closed the gap; deferred numeric trim closed." The Phase 24 Magic-User-Joiner-refusal mechanic pulled Wilmsry out of "far ahead of every other race" (BEFORE rank 1, well clear of Troll's 3.25) down to the fine band without needing the deferred parley/heal numeric trims — those stay untouched.

## Out-of-Band Sub-Class and Race Rows (all 30 rows checked; only 1 out of band)

| Row | Type | Band | BEFORE | AFTER | Delta | Verdict | Reason (one line) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ninja | sub-class (Thief) | too strong | 4.22 | 4.33 | +0.11 | **accept** | "Too strong at AFTER 4.33 (BEFORE 4.22): the opener is the whole fantasy — ordinary deaths (Werebeasts, traps, starvation) still end most runs, and canParley-false still forces every fight." |

All other 29 sub-class/race rows (23 remaining sub-classes, 5 remaining races) landed in the fine band [2.31, 4.15] and carry no verdict (per the plan's rule: only out-of-band rows, plus the named Wilmsry exception, get an editorial column). Wilmsry (race, fine, exception row) — see Headline Answers above for its accept verdict and reason.

## Revisit Rows (with v1.3 levers)

**None.** Every out-of-band row (just Ninja) was judged accept, not revisit — its bad still bites (canParley refusal forces every encounter), its top death causes are ordinary ("cut down by a Werebeast", "undone by a trap", "starved in the dark" — never "died to the opener"), and its kills/reach10 sit in the same order of magnitude as its Thief peers. No engine, content, or tool change follows from this plan; the `## Outliers (Phase 26 — revisit list)` section reads: "No revisit rows — every out-of-band row was accepted."

## In-Band Cell Count

**113 of 143 cells in band** (79%); 30 cells appear in the out-of-band appendix (19 too weak — all but one Magic User, one Thief/Cloaker/Dwarven; 11 too strong — dominated by Wilmsry-race cells and the three Ninja-race cells). This is the finer 143-cell granularity; at the coarser 30-row sub-class/race granularity that this plan's verdict column judges, only 1 row (Ninja) is out of band.

## Task Commits

Both tasks landed in a single commit per the plan's own Task 2 instruction ("Paste ... commit ledger + verdicts"):

1. **Task 1 (verdicts.json rendered + editorial column written, not committed separately per plan design — Task 1's acceptance criteria explicitly requires `git status --porcelain` to show only the untracked file, uncommitted until Task 2)**
2. **Task 2: Paste AFTER/Outliers/Handoff blocks into the ledger; commit ledger + verdicts** — `87a00da` (`docs(26-03): class-pass verdicts -- AFTER fun bands, outliers, Phase 27 handoff`)

## Files Created/Modified

- `docs/class-pass/verdicts.json` - new; schema `class-pass-verdicts/1`; 24 sub rows, 6 race rows, cell appendix, depth-20 roll-ups (no bands/verdicts), the editorial verdict/reason column on Ninja and Wilmsry only
- `docs/CLASS-PASS.md` - modified; AFTER comparison block inserted above 26-02's provenance sub-heading, `## Outliers (Phase 26 — revisit list)` and `## Handoff to Phase 27` appended — 4,964 lines added, 0 removed relative to HEAD~1

## Decisions Made

See `key-decisions` in the frontmatter: (1) only 2 of 30 rows carry an editorial verdict (Ninja out-of-band, Wilmsry as the plan's named in-band exception); (2) Ninja judged accept per the exact "opener is the whole fantasy" pattern 26-CONTEXT.md names as valid; (3) Wilmsry judged accept using the plan's own template sentence with the real numbers substituted.

## Deviations from Plan

None (Rule 1-3 auto-fixes) — plan executed exactly as written. No bugs, missing functionality, or blocking issues were found; every acceptance-criteria command in both tasks printed its exact expected output on the first attempt.

## Known Stubs

None.

## Threat Flags

None — this plan added no new network endpoints, auth paths, file access patterns, or schema changes; it only wrote editorial prose into an existing JSON schema and pasted machine-rendered Markdown into an existing ledger file.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 26-04 (the ledger structural test, `test/unit/class-pass-ledger.test.js`) is unblocked: the ledger now has all eight required H2 sections, `docs/class-pass/verdicts.json` exists with the documented schema, and both are committed together at `87a00da`. Phase 27 can read `## Handoff to Phase 27` directly for mu (3.08), the band edges (2.31/4.15), the reach table (>=5 pooled 17.2, >=10 pooled 0.3, >=20 not carried per cell — the depth-20 slice is the yardstick), the depth-20 roll-ups by class/sub/race, and the single accepted-but-strong row (Ninja) to know what player power it is tuning against.

**Unverified / left to a human:** none identified. Every acceptance-criteria check in both tasks was run and passed; no command produced an unexpected result requiring investigation beyond what is documented above.

---
*Phase: 26-mass-playtest-class-pass-ledger*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: docs/class-pass/verdicts.json
- FOUND: docs/CLASS-PASS.md
- FOUND commit: 87a00da
