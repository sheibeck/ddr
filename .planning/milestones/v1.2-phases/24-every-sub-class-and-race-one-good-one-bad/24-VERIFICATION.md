---
phase: 24-every-sub-class-and-race-one-good-one-bad
verified: 2026-09-14T23:30:00Z
status: passed
score: 7/7 requirements verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
gaps: []
---

# Phase 24 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-14)

Goal-backward check of the phase goal: *every one of the 24 sub-classes and 6 races has a code-verified one solid good and one solid bad, flavor text matches the implemented mechanics, and an identity-contract test proves both fire under a forced scenario.*

## Automated evidence (checked by the orchestrator after 24-07)

- `npm test`: **1188/1188** pass (1036 at phase start → +20 identity-combat, +18 action-path harness, +12 identity-race, +10 economy, +22 identity-world, +70 identity-contract). Parity **33/33** (32 + the new `lose-apprentice` scenario); `test/parity/prototype-master.js.txt` byte-identical to v1.1 close.
- Engine/content/src diff since the Phase 23 close (`a8f3734`): `content/flavor.js`, `content/races.js`, `engine/combat.js`, `engine/derived.js`, `engine/economy.js`, `engine/encounters.js`, `engine/items.js`, `engine/movement.js`, `mazeworld.html` (canParley mirror + sell-price bridge only), `src/browser/eventNarration.js`. No new serialized field (`comparables.js` diff is only Plan 24-02's declared-divergence helpers).
- All seven plans have SUMMARY.md with no `Self-Check: FAILED`; every task committed atomically; working tree clean.
- Zero-draw discipline held: the only rng-order change is the deliberate REMOVAL of the Fridgian corpse-whiff draw. Its two measured consequences are declared, machine-checked action-path divergences (combat `lose`, seed 14: the Fridgian Soldier now wins where the prototype's died; three collateral D-15 full-fight pins re-measured with provenance) plus one for the Pickpocket markup (economy, seed 3: Katana 525→656, lockpicks+Katana purchases now fail). Death-path parity coverage was restored by the additive `lose-apprentice` scenario (seed 127, byte-identical on both engines). Every other fixture byte-identical.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Every sub-class missing a bad has one, felt in play (Knight, Master of Arms, Court Mage, Pickpocket, Cutthroat, Ninja, Bard) | Verified | Knight never-first vs live `maxWP >= 20` (`knightFacesBigFoe`); Master of Arms cannot parley + tracked withdrawal denied; Court Mage foes-first round 1; Pickpocket buy ×1.25 / sell ×0.75; Cutthroat `joinerRefused`; Ninja cannot parley (engine + shell mirror, 1,008-case mirror test); Bard wakes wanderers on d20 ≤ 2 + party low-wit targeting. Tests: `identity-combat` (17), `identity-world` (22), `economy` (+10), `identity-contract` (70). |
| 2 | Guard gains a good; Court Mage's good is felt | Verified | Guard −1 on foe to-hit in `foeToHitVs` (stacks with Agility, floor 1); Court Mage boredom on d12 ≤ 2 (1 in 6) and always-parley Humans. |
| 3 | Flavor-only restrictions enforced or reworded (Woodsman, Pilfer, Cloaker) | Verified | `armorRefusalReason` (noArmor → woodsman ar > 10 → tooHeavy) drives canEquipArmor/takeItem/equipItem AND the store's armor filter; Pilfer `useRefused` before any `itemReady` side effect, heal-kind (`heal`/`full`) only; Cloaker free vanish only while `!C.opened2`, then the ordinary Thief roll (`vanishDenied`). |
| 4 | Identity-contract test for 24 subs + 5 races, Human neutral | Verified | `test/unit/identity-contract.test.js`: one `CONTRACT` table, heroes via `newRun(seed, [], { force })`, 24 sub rows + 5 race rows + Human-neutral, boundary cases (19/20 hp, d20 2/3, d12 2/3, ar 10/12), 7 negative cases, 3 idempotency proofs, completeness meta-test against live `CLASSES`/`RACES` keys. |
| 5 | Blurbs truthful; dagger ruling recorded; FID-07 carve-outs + narration + voice scan | Verified | 30 blurbs re-read, 14 rewritten, 16 confirmed (keys/order unchanged; voice scan green); `### Ruling: level-1 Thief dagger (IDENT-10) — KEEP` in `docs/CLASS-PASS.md`; no new serialized field; every new event/flag narrated (coverage guard green, dead `frenzyWasted` entry removed). |

## Requirements

| ID | Status | Evidence |
|---|---|---|
| IDENT-05 | Verified | Criterion 1 (24-01, 24-04, 24-05); race additions in 24-03/24-05 (Dwarven half armor wear, Fridgian hide + clean frenzy, Wilmsry MU-joiner refusal) per the user's race-pass decision. |
| IDENT-06 | Verified | Criterion 2 (24-01). |
| IDENT-07 | Verified | Criterion 3 (24-01 Cloaker, 24-05 Woodsman/Pilfer). |
| IDENT-08 | Verified | Criterion 4 (24-06). |
| IDENT-09 | Verified | Criterion 5 (24-05 sweep). |
| IDENT-10 | Verified | Criterion 5 (24-07 ruling: keep; rationale cites the BEFORE matrix — Thieves lead). |
| FID-07 | Verified | No new serialized field; action-path divergence record (24-02) is a proven no-op until declared; two declared records (24-03, 24-04) machine-checked before/after; `FIXTURE-INVENTORY.md` Phase 24 section; every event narrated; voice scan green. |

## Smoke readout (signal only — the AFTER matrix is Phase 26)

Mean death depth, 20 seeds × races (BEFORE → now): Knight 3.19 → 3.48; Court Mage 2.52 → 2.49; Guard 2.80 → 3.22; Pickpocket 2.88 → 3.01; Fridgian 2.46 → 2.97; Dwarven 2.45 → 2.73. 0 stuck runs. Recorded under Rulings in `docs/CLASS-PASS.md`.

## Findings carried forward (not gaps in this phase)

- Pre-existing buy-then-reject gold-loss trap on premium store pieces (any class) — a Phase 25 / v1.3 candidate, noted in 24-04.
- Petrify / Turn / Gate still bypass `killFoe` (only Freeze was changed, per the user) — v1.3 spell audit.
- Wilmsry numbers untouched by decision; re-check after the Phase 26 AFTER matrix.

_Verified: 2026-09-14 — orchestrator (Claude), no verifier agent._
