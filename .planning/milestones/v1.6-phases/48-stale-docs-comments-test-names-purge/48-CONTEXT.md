# Phase 48: Stale Docs, Comments & Test Names Purge - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Autonomous — no discuss round (ROADMAP: "Not worth a round — the sweep is mechanical"). The orchestrator measured the baseline and recorded the two judgment calls below for the user to reverse.

<domain>
## Phase Boundary

Every comment, doc page, CLAUDE.md row and test name describes the game as it is — nothing in the repo describes a pattern the game no longer employs — proven by a recorded grep list over the FINAL code layout (Phases 44–47 are closed; the shell is 5,621 lines with Gear/Hero/Store in `src/browser/`). Requirements DOCS-01, DOCS-02, DOCS-03.

**Engine-gate fence:** `engine/`, `content/`, `test/parity/fixtures/` may change ONLY on comment lines — proven by a comment-stripped diff (`tools/ident-sweep.mjs` exports `stripJs`; strip both sides of every touched engine/content file and diff → empty). `test/parity/prototype-master.js.txt` (hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) is never edited. No behaviour change of any kind; `npm test` pass count stays exactly **3,288** (renames only — a test deleted needs its reason in the SUMMARY).

**Phase-start baseline (2026-09-19, HEAD `1a4193f`, case-insensitive grep over `mazeworld.html`, `src/`, `engine/`, `content/`, `test/` — `.js/.mjs/.html`, prototype master excluded):**

| Term | Lines | Where |
|---|---|---|
| `d-pad\|dpad` | 20 | `shell-map-invariants.test.js` 9, `mazeworld.html` 5, `shell-map-viewport.test.js` 4, `shell-gear-toolbar.test.js` 1, `settings.js` 1 |
| `toast` | 291 | `test/unit` 193, `src/browser` 66, `mazeworld.html` 17, `test/voice` 7, `engine/` 6 (`derived.js` 2, `combat.js` 2, `movement.js` 1, `items.js` 1) — Phase 46 renamed the identifiers; these are comments, describe/test strings and doc lines |
| `dead classic\|classic engine` | 0 | already gone |
| `classic script` | 79 | see judgment call 1 — this names the LIVE non-module `<script>` block |
| `wornSlots` | 8 | all comment mentions of the retired `__mzWornSlots` bridge (deleted in 47-03) — `mazeworld.html` 1, `bridge-registry.test.js` 1, `shellSandbox.js` 1, `shell-clarity-43.test.js` 1, `shell-worn-slots.test.js` 4 (incl. one `assert … length, 0` that asserts the retirement — allowed) |
| `flightLeft\|flightCooldown\|c\.ether` | 73 | 18 in `saveState.js` / the parity harness / `save-*.test.js` (tolerant-load reads and their pins — allowed survivors); 55 elsewhere in comments and test strings (`item-activation.test.js` 4, `engine/character.js` 3, `engine/movement.js` 2, the three `*-parity.test.js` 2 each, …) |
| `recent(er\|re).*(every\|each) step` | 0 | already gone |
| `iOS\|Xcode\|Apple\|macOS\|App Store` in `.claude/CLAUDE.md` | 30 | the research-era stack table + the SCOPE OVERRIDE banner |
| `docs/*.md` | 16 | ABILITIES, CLARITY, CLASS-PASS, COMBAT-NARRATIVE-DESIGN, DIFFICULTY-RETUNE, FLEE, GEAR-BALANCE, GEAR-SLOTS, PARLEY-REBALANCE, RATIONS, RELEASING, SHELL-MODULES, SPELLS, TERRAIN, UAT-v1.5, USABLE-FEATURES-AUDIT |
| `ls test/unit \| grep -iE "toast\|dpad"` | 0 files | Phase 46 already `git mv`'d the five toast test files |
| `^\s*(test\|describe\|it)\(.*(toast\|d-pad\|dpad)` in `test/` | 56 | describe/test strings still naming the retired surface |

</domain>

<decisions>
## Implementation Decisions

### Judgment calls (orchestrator, recorded for the user to reverse)
1. **`classic script` is a live term, not a retired one.** The ROADMAP's criterion-1 grep list names `dead classic|classic script|classic engine`; the first two forms are the retired classic *engine* mirror (0 hits — Phase 44 took them). `classic script` (79 hits) is the current name of `mazeworld.html`'s non-module `<script>` block — `paint()`, the map, combat and rail renderers still live there by Phase 47's own ruling, `src/browser/bridge.js` records owners as `mazeworld.html (classic)`, and `docs/SHELL-MODULES.md` uses the term. Keep it; the SUMMARY records the grep as `dead classic|classic engine → 0` and `classic script → N (live term, kept)`. A comment that says the classic script *is an engine* or *mirrors the engine* is stale and goes.
2. **Allowed survivors are lines that assert a retirement or read a legacy save key** — the Phase 35 invariant suite, `"toasts were retired in Phase 35"`-style notes, `assert.equal(… __mzWornSlots …, 0)`-style pins, and `engine/saveState.js#foldLegacyCounters` + its `save-*.test.js` / parity-harness pins. Each survivor is listed in the SUMMARY with file:line and reason — nothing else survives.

### Scope of the sweep (DOCS-01)
- Comments in `mazeworld.html`, `src/browser/*.js`, `engine/*.js`, `content/*.js`, `tools/*.mjs`, `test/**/*.js`: rewrite a stale sentence to describe what the code does now, or delete it if it only explained the retired pattern. Do not purge comments wholesale — Phase 47's line-budget ruling closed that question; this phase removes stale *meaning*, not comment volume. A comment that explains a retirement by name ("was a toast; the rail owns feedback since Phase 35") is fine when it still helps a reader — but it must not describe the toast as a live surface.
- `.planning/` is history — out of scope. Planning documents describe what was true when written.
- `test/parity/prototype-master.js.txt` is frozen; `test/parity/fixtures/` are data (no comments to sweep).

### CLAUDE.md and docs (DOCS-02)
- `.claude/CLAUDE.md`: delete every iOS/Xcode/Apple/macOS/App Store row and the SCOPE OVERRIDE banner (rows deleted, not annotated); the stack table describes Android-only Capacitor 8; the "Stack Patterns by Variant" and "Store-Submission Prerequisites" sections keep only the Google Play material; stack notes describe tap-to-move + the rail (no D-pad, no toasts). The `## GSD Workflow Enforcement`, `## Developer Profile`, `## Project` and `## Constraints` sections are current — keep. Do not change any rule in it (the engine gate, the sfx/icons rules, the push rules live in memory/CLAUDE.md sections that stay as they are).
- `docs/*.md`: each is either (a) current — keep, sweeping stale lines; (b) a design record of a finished pass that still explains a live rule (e.g. `GEAR-SLOTS.md`, `FLEE.md`, `SPELLS.md`, `RATIONS.md`, `TERRAIN.md`, `SHELL-MODULES.md`, `RELEASING.md`) — keep, add a one-line "status as of v1.6" header if any section is superseded; or (c) documented only dead code — delete, with the reason in the SUMMARY. The planner inspects each file and assigns a bucket in the plan; the executor records the final list. `docs/UAT-v1.5.md` is the pending device batch — keep untouched.

### Test names (DOCS-03)
- Rename `describe(...)`/`test(...)` strings that present toasts or the D-pad as live surfaces; strings that assert their absence ("no toast surface remains", "D-pad affordances absent") stay and are listed. File renames via `git mv`. Test bodies and assertions are not touched (a body that needs changing is a behaviour question — flag it, don't fix it here). Pass count 3,288 before and after.

### Commit discipline
- One commit per layer (shell / `src/browser` / `engine`+`content` / `tools` / `test` / `docs` / `CLAUDE.md`), each with `npm test` fail 0 and pass 3,288; the engine/content commit carries the comment-stripped diff proof in its message or SUMMARY; `npm run build:www` + `npm run boot:check` 4/4 at the shell commit; `tools/ident-sweep.mjs --self-test` and `tools/shell-sweep.mjs refs`/`orphans` still run.

### Claude's Discretion
- Plan slicing (recommended 3 plans: 01 code comments — shell + src + engine/content + tools; 02 tests — names and comments; 03 CLAUDE.md + docs + the recorded final grep list); whether to add a small `tools/stale-terms.mjs` that prints the criterion-1 table so the closing grep is reproducible (recommended — it becomes the standing tripwire, a unit test can pin it to the allowed-survivor list); exact wording of rewritten comments (match the surrounding voice — deadpan, specific).

</decisions>

<code_context>
## Existing Code Insights

- `tools/ident-sweep.mjs` — comment-stripping scanner (`stripJs`, `stripHtml` exported since 47-02; `--self-test`). Its identifier sweep already reports 0 for the retired names; the comment layer is what this phase touches.
- `tools/shell-sweep.mjs` (`refs`, `orphans`; CRLF-safe since 47-04), `npm run boot:check`, the Phase 47 DOM-snapshot smoke (`test/unit/shell-tab-snapshots.test.js`, must stay 10/10 with no fixture change — a comment edit cannot move it, so a diff means a code line was touched).
- `test/unit/shell-map-invariants.test.js` and `shell-map-viewport.test.js` hold most D-pad mentions — check whether they *assert the absence* (keep, list) or *describe* the D-pad (rename).
- The 46-02 SUMMARY's 54-file inventory of comment/doc/test-name references is the starting list for the toast sweep.
- `src/browser/settings.js:` one `dpad` mention — the tolerant-load drop of the retired `controlScheme` key (Phase 46) — an allowed survivor if it reads a legacy key; a stale comment if it merely mentions the option.

## Integration Points
- `.planning/ROADMAP.md` Phase 48 criteria 1–4; `REQUIREMENTS.md` DOCS-01..03; `.claude/CLAUDE.md`; `docs/`.

</code_context>

<specifics>
## Specific Ideas

- Closing gates verbatim from ROADMAP criteria 1–4: the recorded grep table with zeros and the listed survivors; `.claude/CLAUDE.md` iOS grep → 0 and the docs bucket list with reasons; `ls test/unit | grep -iE "toast|dpad"` empty and the describe/test grep → 0 bar listed absence-assertions; `npm test` pass 3,288 / fail 0; engine/content diff comment-only (stripped diff empty); fixtures + master hash unchanged; `build:www` + `boot:check` green.
- Human verification: none — no user-visible change. (Recorded as such in the VERIFICATION.)

</specifics>

<deferred>
## Deferred Ideas
- A wholesale comment-volume reduction of the shell (declined at Phase 47 close).
- `docs/UAT-v1.5.md` execution — the milestone-close Pixel 7 batch.
</deferred>
