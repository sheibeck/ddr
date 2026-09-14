---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
verified: 2026-09-14T00:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "During a caster fight on-device (Krupke/Drudge/Djinni/Vampire/Stalka Beast landing a debuff), confirm a 'Weakened' or 'Dazed' chip appears in the existing condition row and its rounds count down each turn"
    expected: "The chip renders with the in-voice label (never the raw 'foeEffect' key or an ability id), the remaining-rounds number decreases each foe turn, and the chip disappears once the debuff fades or the fight ends"
    why_human: "Visual/on-screen rendering and real-time countdown feel cannot be verified by grep/unit tests; this is the phase's single deferred backstop item per STATE.md's human_verify_mode=end-of-phase, already flagged pending in 19-04-SUMMARY.md's coverage table (human_judgment: true)"
---

# Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance Verification Report

**Phase Goal:** Foes can cast, drain, debuff, heal, and summon via a data-driven ability system resolved deterministically; the player's Intelligence resists incoming foe magic using the same canon rule foes already use against players.
**Verified:** 2026-09-14
**Status:** passed (human item approved by the user on-device, 2026-09-14)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria 1-5 + CANON-02/FID-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The five canon casters (Drudge, Krupke, Djinni, Vampire, Stalka Beast) — plus the Drake (CANON-02) — carry a wired `abilities` kit resolved by a pure `engine/foeAbilities.js` resolver; parity-uncovered Magical/Demons/Walking-Dead/Humans-t2/Beasts-t5 encounters are proven deterministic | ✓ VERIFIED | `content/bestiary.js` carries `abilities: [...]` on exactly 8 rows (`grep -c 'abilities: \['` → 8); `engine/foeAbilities.js` exports `tickAbilityCooldowns`, `firstReadyAbility`, `resolveFoeAbility`, pure (no DOM/Math.random/Date/localStorage, confirmed by header + `engine-purity.test.js` 9/9 pass); `test/determinism/foe-abilities.test.js` (13/13 pass) forces and replay-proves all 5 encounter types at self-derived pinned seeds |
| 2 | The player takes dice-notation bolt damage through the shared pipeline (ward/armor/conditions apply), can be drained, debuffed via a new `c.foeEffect` slot surfaced through `conditionsOf`, or face a foe that heals/summons reinforcements joining next round | ✓ VERIFIED | `applyFoeDamageToPlayer` gained additive `ignoresArmor`/`ability`/`applied` (engine/combat.js:998); `resolveFoeAbility`'s bolt/drain/debuff/heal/summon branches present and behaviorally tested in `test/unit/foe-abilities.test.js` (tests 7-16, all passing as part of 882/882 run); `conditionsOf` foeEffect chip confirmed in `engine/derived.js`; pending-summon join at top of `foeTurn` behaviorally tested (combat.test.js test 10, passing) |
| 3 | The player's Intelligence resists incoming foe spells via ONE shared `resistRoll(rng, intel)` helper (`intel>=12`, `d20<intel`) reused in both directions; the roll fires only when a foe actually casts | ✓ VERIFIED | `export function resistRoll(rng, intel)` in `engine/derived.js:440`; imported and called by both `engine/magic.js` (`resistRoll(rng, t.intel)`) and `engine/foeAbilities.js` (`resistRoll(rng, c.intel)`); boundary pins in `test/unit/resist-roll.test.js` (11/12/19/20/natural-1 cases) all passing |
| 4 | Every ability is bounded (`every`/`uses` caps) and telegraphed via `foeCast` before its effect; every new event type has a family-friendly `EVENT_NARRATION` entry; coverage guard + voice safety scan stay green | ✓ VERIFIED | `content/foe-abilities.js` descriptors carry `every`/`uses` bounds per the dice-budget table; `foeCast` pushed first in `resolveFoeAbility` before any effect event; all 11 new event types (`foeCast`, `foeBolted`, `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `foeEffectFaded`, `heroResisted`, `heroResistFailed`, `foePursued`, `foeOutOfSpells`) have builders in `src/browser/eventNarration.js`; `test/unit/formatEventsCoverage.test.js` (2/2) and `test/voice/safety-scan.test.js` (6/6) pass |
| 5 | Spectre pursues a fleeing player on every flee-success exit; Drudge never melees; Drake's breath is gated by an every-4 cooldown; every new serialized field is carved out in all three `*Comparable()` functions and round-trips through save/load including a v1.0 save | ✓ VERIFIED | `pursuitStrike` wired into all 3 flee-success exits (`grep -c` = 3) plus a post-flee-failure cleared check; Drudge rows carry `sp.never_melee: true`; `drakeBreath` descriptor carries `every: 4` with Drake's `sp.dmg`/`sp.every` unchanged; `stripFoeEffectField`/`stripFoeAbilityState` wired into all 3 comparables (`test/unit/foe-ability-carveouts.test.js` 4/4 pass); `test/unit/save-validation.test.js` FID-04 section (v1.0 load, mid-combat load, tampered values, idempotency) all pass; mid-fight JSON-round-trip proven in `test/determinism/foe-abilities.test.js` |
| 6 | CANON-02 data pins (Drudge `never_melee`, Spectre `sp.pursues` with no `abilities` key, Drake breath `every:4`) hold and are pinned in content tests | ✓ VERIFIED | `test/unit/content-tables.test.js` "CANON-02 Phase 19 / D-08" test passing as part of full suite |
| 7 | FID-04: new serialized fields never survive a load; old (v1.0-shaped) saves round-trip with zero data loss and zero spurious keys | ✓ VERIFIED | `clearFoeEffect(c)` in `engine/saveState.js`, applied on both `validateSave` and `rehydrate`; `Object.hasOwn(c, "foeEffect") === false` asserted for a v1.0 save in a passing test |
| 8 | Engine determinism gate: parity suite byte-identical (30/30), frozen fixtures/master/package manifests untouched since the pre-phase anchor, FID-02 draw-count pins for ability-less foes unchanged | ✓ VERIFIED | `node --test "test/parity/**/*.test.js"` → 30/30 pass; `git diff --stat d5fc90a -- test/parity/prototype-master.js.txt test/parity/fixtures` → empty; `git diff --quiet d5fc90a -- package.json package-lock.json` → unchanged; `test/unit/foe-turn-draw-count.test.js` Section 4 restates FULL_FIGHTS totals 12/101/111/66/32 unchanged, part of the 882/882 passing suite |
| 9 | Code-review warnings (WR-01 vampireSummon lvl scaling, WR-02 duplicated DEATH_PANIC_THRESHOLD, WR-03 inaccurate kit-order comment) were fixed, not just claimed | ✓ VERIFIED | `engine/foeAbilities.js:171` reads `lvl: a.effect.tier` (not `f.lvl-1`); `engine/derived.js:23` exports `DEATH_PANIC_THRESHOLD`, `engine/combat.js` imports it (single source, both hardcoded copies removed); `content/foe-abilities.js` header comment scopes the unbounded-fallback invariant to `never_melee` casters with an explicit Djinni-kit exception note |
| 10 | Phase gate: full `npm test` green, above the pre-phase baseline | ✓ VERIFIED | `npm test` run directly by this verifier: 882 pass / 0 fail (pre-phase baseline was 683; Phase 19 added 199 tests across its 4 plans) |

**Score:** 10/10 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `content/foe-abilities.js` | 19 pure-data descriptors, barrel-exported | ✓ VERIFIED | `export const FOE_ABILITIES = [` present; 19 `{ id: "` entries; re-exported via `content/index.js` |
| `content/bestiary.js` | `abilities: [ids]` on 8 rows + `fleesBelow: 0.25` on Djinni x2 | ✓ VERIFIED | Counts match exactly (8, 2) |
| `engine/foeAbilities.js` | Pure resolver: `tickAbilityCooldowns`, `firstReadyAbility`, `resolveFoeAbility` | ✓ VERIFIED | All three exported; no DOM/Math.random/Date/localStorage; imports only content, dice.js, derived.js, combat.js |
| `engine/derived.js` | `resistRoll(rng, intel)`, `conditionsOf` foeEffect chip, `toHit` dazed penalty, `DEATH_PANIC_THRESHOLD` export | ✓ VERIFIED | All present and wired |
| `engine/magic.js` | `castSpell`'s resist block calls `resistRoll` (draw-neutral) | ✓ VERIFIED | `resistRoll(rng, t.intel)` call site present; `rng.d(20)` count in magic.js = 0 (draw moved to derived.js) |
| `engine/saveState.js` | `clearFoeEffect(c)` in both `validateSave` and `rehydrate` | ✓ VERIFIED | Confirmed via passing save-validation tests |
| `engine/combat.js` | All seams: `applyFoeDamageToPlayer` options, `startCombat` kit copy, `playerStrike` weakened halving, `endCombat` clear, `flee`'s pursuit + cleared check, `foeTurn`'s pendingFoes join / fleesBelow / ability gate / foeEffect tick, exported `downMember` | ✓ VERIFIED | Every named seam grepped and confirmed present |
| `test/parity/harness/comparables.js` | `stripFoeEffectField`, `stripFoeAbilityState` wired into all 3 comparables | ✓ VERIFIED | Confirmed via passing `foe-ability-carveouts.test.js` |
| `src/browser/eventNarration.js` | 11 new builders + `foeFled` lowHp branch | ✓ VERIFIED | Coverage guard (`formatEventsCoverage.test.js`) green |
| `mazeworld.html` | `FOE_EFFECT_LABEL`, `CONDITION_COPY.foeEffect`, `paintConditions` branch | ✓ VERIFIED | All 3 present at lines 2781/2787/2810; `test/unit/foe-effect-chip.test.js` (4/4) passes |
| `test/determinism/foe-abilities.test.js` | D-15 suite: 5 pinned encounters, replay-identity, per-visit draw pins, JSON round-trip | ✓ VERIFIED | 13/13 tests pass |
| `test/unit/foe-turn-draw-count.test.js` Section 4 | `abilities:[]` identity, gated-draw table, FULL_FIGHTS restated | ✓ VERIFIED | Confirmed via passing full suite; Sections 1-3 byte-unchanged per SUMMARY's own diff gate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `content/bestiary.js abilities:[...]` | `content/foe-abilities.js FOE_ABILITIES[].id` | string ids | ✓ WIRED | content-tables.test.js pins every id resolves |
| `engine/magic.js castSpell` | `engine/derived.js resistRoll` | `resistRoll(rng, t.intel)` | ✓ WIRED | grep confirms call site + import |
| `engine/foeAbilities.js resolveFoeAbility` | `engine/derived.js resistRoll` | `resistRoll(rng, c.intel)` | ✓ WIRED | grep confirms call site + import |
| `engine/foeAbilities.js` | `engine/combat.js` (pickFoeTarget/applyFoeDamageToPlayer/downMember/liveFoes) | named imports | ✓ WIRED | `from "./combat.js"` present; ESM cycle mirrors the existing items.js<->combat.js pattern |
| `engine/combat.js foeTurn` | `engine/foeAbilities.js` | `if (f.abilities && f.abilities.length) { tickAbilityCooldowns...}` gate | ✓ WIRED | Line 1171 confirmed |
| `engine/combat.js foeTurn top` | `C.pendingFoes -> C.foes` | join-then-null | ✓ WIRED | Lines 1117-1122 confirmed |
| `engine/combat.js flee` | `pursuitStrike` | called on all 3 success exits | ✓ WIRED | 3 call sites confirmed |
| `mazeworld.html paintConditions` | `engine/derived.js conditionsOf` (bridged) | `cn.key === "foeEffect" ? (FOE_EFFECT_LABEL[cn.kind] || ...)` | ✓ WIRED | Confirmed at line 2810; ordering (after phobia, before generic fallback) confirmed by passing chip test |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` | 882 pass / 0 fail | ✓ PASS |
| Parity suite | `node --test "test/parity/**/*.test.js"` | 30 pass / 0 fail | ✓ PASS |
| Frozen fixture/master diff | `git diff --stat d5fc90a -- test/parity/prototype-master.js.txt test/parity/fixtures` | empty | ✓ PASS |
| Package manifest diff | `git diff --quiet d5fc90a -- package.json package-lock.json` | unchanged | ✓ PASS |
| Determinism suite | `node --test test/determinism/foe-abilities.test.js` | 13 pass | ✓ PASS |
| Chip label suite | `node --test test/unit/foe-effect-chip.test.js` | 4 pass | ✓ PASS |
| Engine purity | `node --test test/unit/engine-purity.test.js` | 9 pass | ✓ PASS |
| Coverage guard | `node --test test/unit/formatEventsCoverage.test.js` | 2 pass | ✓ PASS |
| Voice safety scan | `node --test test/voice/safety-scan.test.js` | 6 pass | ✓ PASS |
| WR-01/02/03 fix presence | `grep` on engine/foeAbilities.js, engine/derived.js, engine/combat.js, content/foe-abilities.js | all 3 fixes present in source | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| FOE-01 | 19-01, 19-03, 19-04 | Data-driven ability kit resolved by pure resolver | ✓ SATISFIED | Registry + kits + resolver + zero-draw gate all confirmed |
| FOE-02 | 19-03 | Bolt damage through shared pipeline | ✓ SATISFIED | `applyFoeDamageToPlayer` extension confirmed and tested |
| FOE-03 | 19-03 | Drain/debuff/heal, deterministic, event-narrated | ✓ SATISFIED | All three kinds implemented, tested, narrated |
| FOE-04 | 19-03 | Summon reinforcements joining next round | ✓ SATISFIED | `C.pendingFoes` queue/join confirmed and behaviorally tested |
| FOE-05 | 19-01 | Five canon casters wired rulebook-first | ✓ SATISFIED | Dice-budget table, D-03 cap tests pass |
| FOE-06 | 19-01, 19-03, 19-04 | Bounded usage, telegraphed | ✓ SATISFIED | `every`/`uses` bounds + `foeCast` telegraph + Section 4 gated-draw pins |
| FOE-07 | 19-02, 19-03 | Symmetric INT resistance via shared helper | ✓ SATISFIED | `resistRoll` shared by both directions, pinned boundaries |
| FOE-08 | 19-02, 19-03, 19-04 | `conditionsOf` surfacing + narration + chip label | ✓ SATISFIED | Chip, narration, and UI label all confirmed |
| FOE-09 | 19-03, 19-04 | Member targeting + new determinism tests | ✓ SATISFIED | `pickFoeTarget` member path tested; D-15 determinism suite covers Magical/Demons/Walking Dead |
| CANON-02 | 19-01, 19-03 | Spectre pursue, Drudge never-melee, Drake cooldown | ✓ SATISFIED | All three pinned and behaviorally tested |
| FID-04 | 19-02, 19-03, 19-04 | Save/parity carve-outs, v1.0 load without data loss | ✓ SATISFIED | Comparables strippers + save-validation tests + JSON round-trip |

No orphaned requirements found — `.planning/REQUIREMENTS.md`'s Phase 19 traceability table lists exactly FOE-01..09, CANON-02, FID-04, all marked Complete, matching the plans' declared `requirements` frontmatter.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in the phase's modified source files (`content/foe-abilities.js`, `content/bestiary.js`, `engine/foeAbilities.js`, `engine/combat.js`, `engine/derived.js`, `engine/magic.js`, `engine/saveState.js`, `src/browser/eventNarration.js`, `mazeworld.html` foeEffect hunk). The independent code review (`19-REVIEW.md`) found 0 critical issues, 3 warnings (all three fixed and verified present in `19-REVIEW-FIX.md` and confirmed above), and 2 info-level items explicitly and appropriately deferred (pre-existing shared-`sp`-reference pattern not introduced by this phase; a documented, tested, intentional member-targeting asymmetry).

### Human Verification Required

### 1. On-device foeEffect chip renders and counts down

**Test:** During a caster fight (any of Krupke/Drudge/Djinni/Vampire/Stalka Beast), let a debuff (Weaken or Daze) land on the player and observe the condition chip row.
**Expected:** A "Weakened" or "Dazed" chip appears in the existing condition tracker, its remaining-rounds number visibly counts down each foe turn, and the chip disappears once the debuff fades or combat ends. The raw engine key `foeEffect` or an ability id must never appear as player-facing text.
**Why human:** Real on-screen rendering, timing, and visual polish cannot be verified by source-level grep or unit tests. This is the phase's single backstop item (STATE.md `human_verify_mode: end-of-phase`); it was already flagged as `human_judgment: true` / status `pending` in 19-04-SUMMARY.md's own coverage table, and is deferred to the milestone's end-of-phase on-device DR pass rather than gating this phase's automated completion.

### Gaps Summary

No gaps. Every must-have truth across all 4 plans (19-01 through 19-04) is verified in the actual codebase, not merely claimed in the SUMMARYs: the registry/kits/resolver/wiring/save-load/parity-carve-out/narration/determinism chain was independently traced and grep/test-confirmed at each seam, `npm test` was run directly by this verifier (882/882, matching the SUMMARY's claim), the parity suite was independently re-run (30/30 byte-identical, frozen files unchanged since the pre-phase anchor), and all three WR-01/WR-02/WR-03 code-review fixes were confirmed present in source (not just claimed in 19-REVIEW-FIX.md). The two info-level review findings (IN-01, IN-02) were correctly scoped out of the fix pass and are not phase-blocking. The only open item is the single expected on-device visual/UAT check for the debuff chip, which is explicitly deferred by this project's `human_verify_mode: end-of-phase` policy and does not indicate any automated-verifiable truth was missed.

---

*Verified: 2026-09-14*
*Verifier: Claude (gsd-verifier)*


## Resolution note (2026-09-14)

The single human_verification item (Weakened/Dazed chip renders and counts down) was **approved by the user** after on-device play of the Phase 19–21 builds ("close Phase 19 as approved"). Phase marked passed.
