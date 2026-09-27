# v2.1 autonomous run: resume point (2026-09-27, before compact)

## Where we are
- **Complete:** 72, 73, 74, 75, 75.1, 75.2, 75.3, 76, 77, 78. Phase 80's 4 code plans (80-01/02/03/06) are merged; its build part (80-04, 80-05) waits for 79.1.
- **Phase 79 (content & narrative pass, 13 plans):** waves 1-2 are merged and gated: 79-01..06, the 79-02 ledger reconciliation, and the Joiner-defences quick fix (79-02b, user ruling). Master gate after wave 2: **npm test 7406/7406, parity 66/66, boot:check PASS**.
- **NEXT:** dispatch wave 3 (**79-07, 79-08, 79-09**; deps met) in parallel with the **no-descent-heal quick fix** (see below). Then waves 4-6: 79-10 and 79-11, then 79-12, then 79-13 (the review page), then the 79 VERIFICATION and `phase.complete 79`. Then **79.1** (4 plans, planned), then **Phase 80 build** (80-04 release build, 80-05 emulator), then the milestone close.

## Pending user ruling to implement BEFORE 79.1 (captured 6916e512)
- **No healing when going down a floor.** Set HERO_REGEN_PER_FLOOR 0.25 → 0 (or remove the regen block and floorRegen); remove the copy that promises stairs healing; re-pin with traced causes. Todo: `.planning/todos/pending/2026-09-27-no-healing-when-going-down-a-floor.md`. 79.1-CONTEXT already says the dial is locked at 0 and the v2.0 baseline had 0.25.
- Files: engine/difficulty.js (the dial, heroRegenFor), engine/movement.js descend (~L1263), floorRegen narration. No overlap with the wave-3 files.

## Handoff notes (orchestrator scratchpad; copied here for safety)
- `notes-79.txt`: extra scope for **79-09** (the hero-sheet damage range must read engine/derived.js#weaponDamage; todo 2026-09-25-hero-sheet-damage-range-omits-some-bonuses), for **79-08** (nameless "It's" in foeWardSoaked/foeWardBroken/foeBubbleCaught; reuse 79-04's possessive helpers; the Strength spell's HP boost is silent), and for **79-12** (ROLL-LEDGER "(now 19–20)" wording; capped store-meal variant `{ only:["bought"], gained:3, meal:8 }`; 29 --after errors on 79-03 IDENTITY_FOOTER rows; ident-sweep stripJs nested-template bug; the Bat/Rat and Viper "wp" notes pinned by D-14; armor/armour house spelling; CAUSE_TEXT.maze plus the unreachable poison/teleport/won epitaphs; heroOut "Can't act"; Acuteness/Anklet labels; docs/ABILITIES.md and SPELLS.md stale quotes; the Crystal Staff "party invisible" wording vs the Joiner fix's PARTY_WIDE_ITEM_EFFECTS).
- **Ledger rules for every 79 plan:** "raw:" is a key prefix, not a surface; a before must be the corpus-base rendering (interpolations as "…"); run `node tools/voice-inventory.mjs --check-ledgers --plan 79-NN --after` plus test/unit/voice-corpus.test.js before committing.
- **FIXTURE-INVENTORY:** append subsections under `## Phase 79` (currently: Plan 79-02, 79-06, 79-04, Joiner defences, 79-05). Parallel plans conflict at EOF, so resolve by keeping both.
- **State pins:** when two parallel plans re-pin the same label, re-measure on the merged tree with `node tools/roll-high-baseline.mjs pins` (done once for party-fighter-knight → 8b18a1e8…, depth 4).

## Questions for the user at milestone close (`milestone-close-questions.txt`)
- The insanity death-cause tone ("lost to a fit of dungeon madness", three softened epitaphs; 79-06), to be reviewed in the 79-13 review page.
- Inert MU school bonuses: Protection, Healing, Divination and Special bonuses change no roll (only thrown spells use school bonuses). Should they do something?
- The camp-ambush oldest fight-log row (rations) is not tappable; should every row be tappable?

## Mechanics
- Executor prompt template: `<scratchpad>/p79-template.txt` (plus p77/p76 templates). The merge recipe: checkout snapshots, then `git merge --no-ff`, then resolve the inventory EOF conflicts, then a targeted test or the full gate. Clean worktrees with unlock / remove -f -f / branch -d / prune.
- The watch script self-exits after 31 min (`<scratchpad>/watch.sh <base> <stall-min> <ids>`). Orphaned hook node processes pile up; kill ones older than 3 min whose parent is gone (the user asked for this).
- The weekly limit hit around 02:30; it reset at 12pm ET on 2026-09-27. Stopped agents resume via SendMessage (retry if "unverifiable").
- 78-03's commit was refused by the permission classifier; the user approved the orchestrator committing it. Executors are told to STOP and report if a commit is refused.
- Leftover dir .claude/worktrees/agent-add4ee435865f0c87 (unregistered, locked by a dead process): delete when possible.
- Rules: no bot runs until 79.1; ask before the Play deploy; never force-push; the prototype master is never edited.
