---
phase: 79-content-narrative-pass
plan: 13
subsystem: narrative-review
status: complete
tags: [vox-05, vox-04, roll-04, narrative-pass, review-page, doc-sync, closure]
requires:
  - "79-01..79-12, 79-02b, 79-02c (merged at dispatch base 81a830a6)"
provides:
  - "tools/narrative-review.mjs: the review page generator (--md, --html, --check)"
  - "docs/NARRATIVE-PASS.md and docs/narrative-pass/review.html: every changed Phase 79 line, before and after, grouped by surface"
  - "test/unit/narrative-review.test.js: the doc-synced page guard and the VOX-05 before/after prohibition"
  - "ledger coverage at the phase head: --check-ledgers --after --coverage exits 0"
  - "the regenerated voice sample with the honest-gain branches"
affects: [79.1, milestone-close review]
tech-stack:
  added: []
  patterns:
    - "per-key ledger chains: a row whose before is an earlier plan's after extends that line (number-blind for builders)"
    - "generated doc keeps the line ends already on disk, so a regeneration after a CRLF checkout is byte-identical"
key-files:
  created:
    - tools/narrative-review.mjs
    - test/unit/narrative-review.test.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
  modified:
    - docs/narrative-pass/why/79-02.json
    - docs/narrative-pass/why/79-03.json
    - docs/narrative-pass/why/79-09.json
    - docs/narrative-pass/why/79-12.json
    - tools/lib/voice-corpus.mjs
    - test/unit/voice-corpus.test.js
    - test/unit/identity-footer.test.js
    - engine/combat.js
    - engine/derived.js
    - tools/stale-terms.mjs
    - tools/voice-sample.mjs
    - tools/voice-sample-output.txt
decisions:
  - "Page counts come from the phase-base snapshot and the ledgers only (keys judged, changed, kept, new; rows and removed lines), so a later phase adding copy never makes the Phase 79 page stale"
  - "A page row's surface is the phase base's for a base key (the corpus's fixed order), else the ledger row's"
  - "Coverage gaps close in the ledger of the plan that MADE the change (79-03 wrote the traits and footer fragments, 79-09 the upgrade-why rewording), not the corpus owner"
  - "engine/derived.js#PARTY_WIDE_ITEM_EFFECTS is a declared non-copy export (a lookup of item ids), not a ledger row"
metrics:
  duration: "about 1 hour 15 minutes"
  completed: 2026-09-27
  tasks: 2
  files: 16
---

# Phase 79 Plan 13: The review page, ledger coverage and phase close Summary

The narrative pass now has one review page, in Markdown and as a self-contained HTML page, listing all 482 lines Phase 79 changed, grouped by surface. Each row gives its trigger, the phase-base line, the line the game prints now, and every plan's reasons and why. A doc-synced test proves the page is complete and true, and every changed line in the phase has a ledger row.

- **Phase base:** `cd560cc8dafe63495bd80f45816c3bf30dae7ec1` (docs/narrative-pass/corpus-base.json).
- **Dispatch base:** `81a830a6`. **Plan head:** see Commits below.
- **Review page for the orchestrator to publish at milestone close:** `docs/narrative-pass/review.html`. The Markdown twin is `docs/NARRATIVE-PASS.md`.

## The review page (Task 1)

`tools/narrative-review.mjs` uses Node built-ins only and reads only committed inputs: the base snapshot and every `docs/narrative-pass/why/*.json`, 79-02c included.

- **Rows.** Rows chain per key. A later plan's row whose `before` equals an earlier plan's `after` extends that line (number-blind for Oracle and rail builders). So a line two plans touched shows once, with the base line, the final line and both whys in plan order. Seven lines chain this way: five footers and backstabDenied (79-03 or 79-04, then 79-12), and darknessFell (79-11, then 79-12).
- **Order.** Rows sort by SURFACES order, then key, then plan number, and two runs are byte-identical.
- **Deleted and new lines.** A deleted line (`after: ""`, e.g. 79-02c's two floorRegen rows and 79-12's 55 rulebook-notes rows) renders as **removed** with its why. A new line renders as **new line**.
- **79-12's `bank:MOD_LABEL.gear`** ("unseen") is on the page, and a test pins it.
- **Header.** The page opens with:
  - how to read it;
  - how to ask for changes (quote the line or key and the tone wanted; it all goes into one quick follow-up task);
  - the four-point rubric quoted from CONTEXT;
  - the standing rulings (HP not WP, roll-high, U+2212/U+2013, Dungeon/Game Master, family-friendly with no Pilfer diagnosis, British "armour", card versus rail);
  - the per-surface numbers.
- **The HTML page.**
  - inline CSS in the parchment palette, with a dark variant under `prefers-color-scheme`;
  - a surface index;
  - one table per surface that turns into stacked cards below 720px;
  - no script and no external request (`grep -c "<script"` is 0, and `grep -c -E "(src|href)=\"https?:"` is 0);
  - every string HTML-escaped.
- **`--check`** exits 0 when both committed pages match a fresh generation (CRLF normalised) and 1 with the first differing line otherwise. Writes keep the line ends already on disk, so a regeneration after a CRLF checkout is byte-identical.

### The pass in numbers (per surface)

"Keys" count lines as the game stores them (a builder is one key). "Rows" count lines on the page.

| Surface | Keys judged | Changed | Kept word for word | New | Rows | Removed |
|---|---:|---:|---:|---:|---:|---:|
| blurbs | 39 | 21 | 18 | 100 | 121 | 0 |
| oracle | 327 | 91 | 236 | 0 | 96 | 1 |
| rail | 287 | 74 | 213 | 0 | 74 | 1 |
| refusals | 38 | 13 | 25 | 0 | 13 | 0 |
| rail-cards | 140 | 1 | 139 | 0 | 1 | 0 |
| combat-screen | 203 | 10 | 193 | 0 | 20 | 1 |
| items | 110 | 10 | 100 | 0 | 13 | 0 |
| spells | 87 | 16 | 71 | 0 | 16 | 0 |
| foes | 78 | 10 | 68 | 0 | 10 | 6 |
| death | 120 | 23 | 97 | 0 | 23 | 14 |
| boards | 182 | 5 | 177 | 0 | 5 | 0 |
| panels | 190 | 13 | 177 | 1 | 15 | 1 |
| map | 21 | 3 | 18 | 0 | 5 | 0 |
| title | 17 | 1 | 16 | 0 | 56 | 55 |
| other | 32 | 5 | 27 | 9 | 14 | 0 |
| **Total** | **1871** | **296** | **1575** | **110** | **482** | **79** |

### The doc-sync guard

`test/unit/narrative-review.test.js` has 11 tests.

**Synthetic cases:**
- chain collapse;
- grouping order;
- counts;
- Markdown sections in SURFACES order, with the removed and new markers;
- HTML escaping, with no script, no remote src or href and no url();
- determinism;
- the audit failing both ways (a ledger row with no page row, and a page row with no ledger row);
- `--check` exit codes on a temp tree, including CRLF tolerance.

**Live cases:**
- the committed pages equal a fresh generation;
- every ledger row of every plan (79-02c included) is on the page;
- the VOX-05 prohibition: every page `before` is a phase-base rendering, and every page `after` is a rendering in the live corpus.

## Coverage closure (Task 2)

`node tools/voice-inventory.mjs --check-ledgers --after --coverage` now **exits 0** (12 ledgers, 0 errors). The 82 errors closed as follows:

| Count | Keys | Closed by | Ledger |
|---:|---|---|---|
| 67 | `bank:IDENTITY_TRAITS.*` (the authored advantage and disadvantage lines the footers read) | new-line rows (`before: ""`, after = the live text), reason identity | 79-03 |
| 6 | `raw:src/browser/identityFooter.js#` footerLines, chartLines, damageLines, sizeLines, faces, orList (the generator's fragments) | one new-line row per key with a representative literal; the why points at the composed footers on the page | 79-03 |
| 6 | `oracle:`/`rail:` rested, leveled, faerieBoon | 79-02's builders read `gained`. In play `gained` always equals `amount`/`wpGain` for these, so the player sees the same number. The rows use the synthetic `{ amount 8, gained 3 }` rendering (both real renderings of the key), and the trigger and why say plainly that the number in play is unchanged | 79-02 |
| 2 | `oracle:`/`rail:` purchaseBagged | 79-09's UPGRADE_WHY_COPY rewording ("average damage a swing", "damage from practice") reaching the builder | 79-09 |
| 1 | `raw:engine/derived.js#PARTY_WIDE_ITEM_EFFECTS` ("Crystal Staff") | **excluded, not ledgered.** The row was added to `NON_COPY_EXPORTS` with its reason, and a new voice-corpus test pins it: it is out of the corpus, still a real engine export, the staff's text is still walked as `content:STAVES`, and the audit counts it present. `auditRegistry` now recognises an engine export named in a non-copy row | — |

**History made honest along the way:**
- Four 79-12 armour rows (IDENTITY_TRAITS Cutthroat.good.0, Master of Arms.good.1, Woodsman.bad.0 and identityFooter.js#RACE_FIELD_LINES) used to start at `before: ""`. They now chain from new 79-03 rows holding 79-03's "armor" text, so each shows once on the page: new line, then armour, with both whys.
- `identity-footer.test.js`'s 79-03 ledger check now resolves IDENTITY_TRAITS keys. It leaves the raw fragment rows to `--check-ledgers --after` and the review-page test.

## Extra scope: the engine comments (comment-only)

- `engine/combat.js` (Overhead Blow) and `engine/derived.js` (the PARTY_WIDE_ITEM_EFFECTS doc and foeToHitVs doc) now quote the live roll-high text:
  - "your die has two fewer faces that land it";
  - "party invisible d10+5 squares: foes hit only on their die's top face";
  - "every foe has two fewer faces that hit anyone on your side".
- `git diff -U0` on engine/ in commit 43e66778 shows only `//` and ` * ` comment lines.
- The two class-B engine rows were dropped from `tools/stale-terms.mjs`, and the tripwire holds them: 0 unlisted, 0 rot.
- **Fixtures measured zero.** The parity suite passes 66/66, and `git diff --quiet cd560cc8 -- test/parity/prototype-master.js.txt test/parity/fixtures` exits 0. No FIXTURE-INVENTORY subsection was needed.

## The voice sample

`tools/voice-sample-output.txt` was regenerated (deterministic: two runs are byte-identical).

- The floorRegen block is gone, and every rewritten Phase 79 Oracle line is sampled.
- `SAMPLE_OVERRIDES` gained one capped-gain patch per clamped gain type: healed, potionDrunk, regenerated, cloakRegenerated (used at full), secondWindHealed, memberSecondWind, cooked, foodFound and the bought meal.
- tableFour gets an array (one patch per sample): the −19 hp loss and the capped +3 heal "(worth 8, back to full)", with the engine's own prose.
- faerieBoon, leveled and the +25 HP row are raises that always gain what they roll, so the random draw already shows them.
- **Fixed on the way (Rule 1):** 17 sample lines printed "[object Object]" for event types that carry an item NAME (bought, pilferFumbled, itemEffectStarted, itemEffectFaded, itemCooled, staffRecharged). The tool now passes the drawn name as a string, with no rng draw moved, and 0 remain.

## Gates

- `npm test`: **7,480 of 7,480, 0 failures** (dispatch base 7,468; +11 narrative-review and +1 voice-corpus non-copy test). trap-death-repro did not flake.
- `node --test "test/parity/**/*.test.js"`: **66/66**.
- `git diff --quiet cd560cc8 -- test/parity/prototype-master.js.txt test/parity/fixtures`: **exits 0**.
- `node tools/voice-inventory.mjs --roll-under --hygiene --twins --safety --count`: **0**.
- `node tools/voice-inventory.mjs --check-ledgers --after --coverage`: **0 errors, exit 0**.
- `node tools/narrative-review.mjs --check`: **exit 0**.
- `node tools/stale-terms.mjs`: 0 unlisted, 0 rot.
- `git diff cd560cc8 -- test/parity/harness/comparables.js`: only 79-05's named carve-out (REWORDED_TXT_ITEMS: Lockpicks, Crystal Staff, Cloak of Invisibility, Invisible potion and its "(clear)" name; the economy `after` side is stripped the stripCloakArmorTxt way).
- `npm run boot:check`: **skipped**. The worktree has no node_modules, and the sandbox refused the `mklink /J` junction to the main checkout's node_modules. No junction or www/ was created. The orchestrator should run `npm run build:www && npm run boot:check` at merge. This plan changed nothing under src/ or mazeworld.html, and its only runtime-file edits are engine comments.
- No bot balance run, and no readout files (user ruling 2026-09-26).

### Engine diff since the phase base, by hunk kind

`git diff --name-only cd560cc8 -- engine` lists abilities, combat, derived, difficulty, economy, encounters, events, items, magic, movement and scrollFumble. The plan's expected set (79-02's gains and Table 4, plus 79-05's and 79-11's string literals) is stale, because user-ruled quick fixes landed after planning. By commit:

| Commit | Plan | Files | Hunk kind |
|---|---|---|---|
| 914e5fab | 79-02 | abilities, combat, economy, encounters, events, items, magic, movement | additive `gained`/`rolled`/`meal` and Table 4 `row`/`stat`/`amount` fields, zero draws |
| 09aee3a5 | 79-02 | economy | the bought event's gain fields |
| 57cb14e5 | 79-02 (extra scope) | combat, derived | the Elven Joiner's own race to-be-hit trait (a rules fix, declared in 79-02) |
| 2a70e144 | 79-04 | combat | one string literal |
| 75eeb44e | 79-05 | economy, items | string literals (the Lockpicks text) |
| 3bd44340 | 79-02b (quick fix, user ruling 2026-09-27) | combat, derived, difficulty | a Joiner uses only its own defences (rules fix, fixtures declared there) |
| fc77ddac | 79-08 | magic, scrollFumble | additive event fields (strengthCast gained/maxWP, scrollFumble might gained) |
| f636af13 | 79-09 (extra scope) | derived | weaponDamageTerms/weaponDamageRange, so the hero sheet reads the engine's own damage terms |
| de7c158f | 79-02c (quick fix, user ruling 2026-09-27) | difficulty, events, movement | the per-floor heal on descent removed |
| 43e66778 | 79-13 | combat, derived | comments only |

The prototype and every parity fixture are byte-identical to the phase base.

## The Phase 79 Pixel 7 checklist (deferred UAT, milestone close; no device pause now)

**VOX-04 (blurbs and footers):**
1. Roll until a Summoner comes up. The reveal should show Good and Bad, including "healing spells you cast heal at half strength". The Hero tab's Subclass section should show the same lines under the blurb.
2. Roll a Warlock, an Illusionist and a non-Human race. Each footer should name its gates, the level-1 Phantom Host, and the race's trade-off.
3. At text sizes S, M and L, the dossier footer and the roller footer should wrap without clipping, and the roller screen should scroll.

**ROLL-04 (roll-high phrasing):**
4. In the Grimoire, read Mirror Self and Weaken. On the Hero tab, read Smoke and Battle Roar. On the Gear tab, read a Crystal Staff or Anklet. In the store, read Lockpicks. Each should state the roll-high range, and in a fight the foe details card should show the same range.
5. In a fight with Smoke, an Anklet of Invisibility and a Weakened foe up, tap each chip and long-press the foe. Every description should say what it does, to whom and for how long. Its numbers should match the foe card's odds line, and the Anklet's term in a roll line should read "unseen".

**VOX-05 (every line says what happened, to whom and why):**
6. Read a full fight in THE FIGHT SO FAR and the Oracle, with a flee attempt, a party member's blow and an initiative line. Every line should say who did what to whom and the result before any joke.
7. Cast a damage spell, a heal, Weaken and a summon. Read a scroll as a non-caster until one fumbles, and let a foe cast. Each Oracle and rail line should name who, whom and the result first.
8. Die to a trap and to a foe, and read the DEAD screen's cause and epitaph. Open the Leaderboards and read each board's rule line and footnote. Each should say plainly what happened, or what the board ranks, before any joke.
9. Open the Hero tab, the Gear tab (with a full bag and a class-locked item), the store (with an item that is not an upgrade), the Leaderboards panel, and a final sheet after a death. Every reason and empty state should read as a plain sentence in voice, and "armour" should be spelled the British way.
10. Open MARKS and hold a locked box. Open Settings and the ☰ menu at text size L. Start a new run from the title through the roller. Every label should say what it does, and nothing should clip.
11. Walk a floor with a trap, a crevice decision, a store, a Joiner offer, a hungry night and a relaunch mid-fight. Each rail and Oracle line should say what happened, to whom and why before any joke, and each refusal should say why.
12. Take the stairs down. No "the dungeon lets you keep +N hp" line should appear (79-02c), and HP should not change on descent.

**Number honesty (todos 2026-09-25 heal lines, 2026-09-26 Table 4 roll line):**
13. Drink a potion a few HP below full. The Oracle and the rail should both lead with the HP actually restored and say you are back to full.
14. Pull a Table 4 red dot that hurts. The roll line should name the effect with no number, the next line should read the loss with a minus sign, and the HP bar should drop by exactly that number.

**The review:**
15. Read `docs/narrative-pass/review.html` (the orchestrator publishes it as an HTML artifact) surface by surface, and list any tone changes for one quick follow-up task.

## Routed todos resolved by this phase

- `2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` (VOX-04): already in `.planning/todos/completed/` (79-03).
- `2026-09-23-narrative-pass-clarity-cleanup-of-every-in-game-line.md` (VOX-05): **still in `pending/`; the orchestrator should move it to completed.** The pass and its review page are this phase.
- `2026-09-25-heal-lines-narrate-the-raw-roll-not-the-hp-gained.md`: already in `completed/` (79-02).
- `2026-09-26-table-4-roll-line-prints-the-canon-cell-not-the-scaled-hp.md`: already in `completed/` (79-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The voice sample printed "[object Object]"**
- **Found during:** Task 2 (voice sample).
- **Issue:** 17 sample lines rendered an item object where the engine event carries the item's name.
- **Fix:** Six event types now get the drawn name as a string (the same correction event-variants' TYPE_FIELDS makes). No rng draw moved.
- **Files modified:** tools/voice-sample.mjs, tools/voice-sample-output.txt.
- **Commit:** 9c813c4e.

**2. [Rule 3 - Blocking] identity-footer.test.js's 79-03 ledger check could not resolve the new rows**
- **Issue:** The check compares each 79-03 row's `after` with a current string it looks up by key, and it knew only notes and footers.
- **Fix:** It now resolves IDENTITY_TRAITS keys and leaves the raw fragment rows (literals with "…") to the corpus-level checks.
- **Commit:** d24a00b0.

**3. [Rule 3 - Blocking] The stale-terms tripwire caught the new test's synthetic roll-under string**
- **Fix:** The synthetic spell text is now neutral ("Old spell text."). No allowlist row was added.
- **Commit:** 43e66778.

**4. [Plan staleness, recorded] The expected engine-diff set**
- The plan lists only 79-02's fields and 79-05/79-11 literals. The real set includes the user-ruled 79-02b and 79-02c quick fixes and 79-09's damage terms. It is shown by commit above; the fixtures and prototype are byte-identical to the base.

**5. [Plan scope, recorded] Counts from the base snapshot**
- The plan's action says per-surface counts come "from the live corpus". The must-have says the page regenerates from the ledgers and the base snapshot. The counts use the base and the ledgers, so a later phase adding copy never makes the Phase 79 record stale. The live corpus is checked in the test instead (every `after` is a line the game prints).

## Known Stubs

None.

## Threat Flags

None. The HTML page is static, with no script, no external request and every string escaped. No network, auth, file or schema surface was added.

## TDD Gate Compliance

- RED `16d47829`: the test failed because tools/narrative-review.mjs did not exist.
- GREEN `3c2eff74`: 11/11 passed.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 16d47829 | test(79-13): add failing doc-synced guard for the narrative review page |
| 1 GREEN | 3c2eff74 | feat(79-13): the narrative review page generator and both pages |
| 2 | d24a00b0 | fix(79-13): close the phase-head ledger coverage (82 errors to 0) |
| 2 (extra scope) | 43e66778 | docs(79-13): engine comments quote the roll-high text; tripwire holds them |
| 2 | 9c813c4e | chore(79-13): regenerate the voice sample with the honest-gain branches |

## Self-Check: PASSED

- Created files exist: tools/narrative-review.mjs, test/unit/narrative-review.test.js, docs/NARRATIVE-PASS.md, docs/narrative-pass/review.html; tools/voice-sample-output.txt regenerated.
- All five task commits are in `git log` (16d47829, 3c2eff74, d24a00b0, 43e66778, 9c813c4e).
- `npm test` 7,480 / 7,480; parity 66/66; `--check-ledgers --after --coverage` 0; `narrative-review --check` 0; voice checks 0.
