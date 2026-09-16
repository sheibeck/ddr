---
phase: 31-combat-start-gating-effect-hygiene
verified: 2026-09-16T12:30:00Z
status: passed
score: 6/6 requirements verified (CMB-01..06) — automated evidence; on-device confirmation deferred to the end-of-run UAT batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7: walk into an encounter — roster + Fight! only; Oracle shows NO initiative/strike line until Fight! is tapped; after the tap the 'You/They move first.' line and any pre-emptive strike appear together", "Pixel 7: an afraid fight (hero phobia matches foe type, e.g. 'Bats and rats' vs Beasts) — after Fight! the Afraid toast and 'Afraid · 2 rds' chip appear; the FIRST Strike tap swings (roll vs the shrunk need, e.g. '4 vs 2 (needs 2: afraid −3)'; a hit shows halved damage + 'Fear pulls the blow.'); Spells/Items/Flee/Parley all respond, never a fear refusal or 'frozen' line; chip counts 2 → 1 → gone with 'The fear passes.'", "Pixel 7: level-1 Summoner and level-1 Illusionist — the combat SPELLS menu lists Summon / Phantom Host and casting works (Phase 23 regression closed)", "Pixel 7: Hero tab Grimoire — a spell above level reads 'Needs level N'; a school-locked one reads '<school> opens at level N' (no 'Not ready yet')", "Pixel 7: Gear tab — every potion/use item shows Use; drinking Acuteness in a corridor shows the Acute chip in sq, then rds in a fight, clearing with 'The Acuteness wears off.' at fight end", "Pixel 7: cast Shield (or use a Rowan Staff) — the chip reads 'Shield <pool> hp · <rounds> rds' and both numbers fall", "Pixel 7: Bard — '6 · Sing (N sq)' stays visible while cooling and its tap toasts the wait", "Pixel 7: roll a new character — the roll screen's TO HIT reads '1–5' (Fighter) / '1–3' (Magic User), a range never 'N+', matching the Hero tab's 'To hit 1–N'", "Pixel 7: Amulet of Stone on the last foe — '… turn to stone. Statues don't hit back.', the kill payout lines, Phase 29's loot card if a drop rolled — no stranded combat screen", "Pixel 7: tap a staff's Use in a corridor — toast names why (wants a target); on cooldown the toast says squares left and the row shows the countdown", "Pixel 7: roll/force an Elven hero — foes land on them noticeably more often than a Human control at the same level"]
gaps: []
---

# Phase 31 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-16)

Goal-backward check of the phase goal: *combat never starts on the player's behalf — every fight begins with the encounter preview and an explicit Fight! tap; every gated feature (spells, scrolls, items, songs) explains its refusal instead of failing silently; usable items work outside combat where the rules allow; every buff/debuff shows and expires honestly; item kills close the encounter cleanly.*

## Automated evidence (re-run by the orchestrator after 31-03)

- `npm test`: **1855/1855, 0 failures** (1593 at phase start → 1641 after 31-01 → 1834 after 31-02 → 1855 after 31-03). `npm run build:www` exit 0 (31-03). `git status --porcelain test/parity/prototype-master.js.txt` empty; master hash `a1f4d0dc…` unchanged across all three plans.
- Three plans, three SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `bfd542b` apart from the orchestrator's PROJECT.md Key Decision rows.
- Parity: three declared action-path divergences (combat/lose 14, lose-apprentice 127, magic/cast-damage 8) replace the prototype's phobia freeze with the Afraid penalty — the user's deliberate rules change; death-path parity coverage restored via the new `lose-plain` scenario (seed 1119, byte-identical). Two re-measured pins from the rng reorder implied by the plan's cut line (combat/parley seed 303: `sp 7→5`, everything else unchanged; foe-abilities seed 1 full-fight pin) — re-measured live against the finished engine and documented with rationale, never hand-adjusted. 31-02 and 31-03 added zero divergences and zero fixture diffs (the Elven flip touches no fixture: only Elven heroes are chargen seed 13 / faerie seed 38, neither reaches `foeToHitVs`).
- Roll-direction audit (`31-ROLL-DIRECTION-AUDIT.md`): 34 sites correct, 2 inversions — both closed this phase (Elven `foeToHit` −1 → +1 in `content/races.js`; sheet TO HIT `N+` → `1–N`).

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Encounter shows roster + Fight!; nothing (initiative, phobia, pre-emptive strike) resolves before the tap | `engine/combat.js#fight` owns initiative → Hardiness d2 → combatInDark → pre-emptive foeTurn; `startCombat` ends at the roster with `combat.pending: true`; `refuseIfPending` → `notFought` on all 8 combat-gated actions (`test/unit/fight-gate.test.js`, 18 pins); shell `mzFight → engineCombatAction("fight")`, preview gated on `C.pending`, AMBUSH special case deleted (`test/unit/shell-fight-gate.test.js`); parity harness chains `fight` in `applyStartCombat` + `reconcilePendingFight` (`test/parity/pending-fight-audit.test.js`). |
| 2 | Every refusal explains itself before any side effect; usable-features audit ledger | `castRefused/useRefused/scrollRefused/actionRefused` with reasons `cooldown{left}/wrongClass/pilfer/combatOnly/exploreOnly/noTarget/noCharges/notFought` — no `frozen` (`test/unit/cast-refusals.test.js`, `item-combat-gate.test.js`; `fakeRng([])` proves zero draws); `docs/USABLE-FEATURES-AUDIT.md` + table-driven doc-synced `test/unit/usable-features-audit.test.js` (150 tests); shell keeps Use/Sing/Scroll visible, `window.__mzCanCast` bridge + `grimoireViewModel` level/school reasons close the Phase 23 Summoner/Illusionist regression (`test/unit/spell-menu-mirror.test.js`, every MU sub × spell × level). |
| 3 | Buff potions usable outside combat; targeted items combat-only | `useItem` ladder: every `content/potions.js` kind resolves identically in/out of combat; `TARGETED_KINDS` (freeze/weaken/stone/fire/gas) refuse `combatOnly` with `usedAt` untouched (`test/unit/item-combat-gate.test.js`). |
| 4 | Every effect has a chip with honest expiry | `conditionsOf` ward `{pool, remaining}` and afraid `{remaining, phobia}` entries; `CONDITION_COPY.ward` ("Shield N hp · M rds") + `.afraid` ("Afraid · N rds") replace the phobia freeze chip; Acuteness ticks per round in combat and per step outside, clears at `endCombat` with one `acuteFaded` (`test/unit/effect-expiry.test.js`, `conditions.test.js`, `foe-effect-chip.test.js`). |
| 5 | Item kills end combat cleanly with full payout | `useItem` stone/fire → `killFoe` → narrow cleared-check → `encounterCleared` + `endCombat` inside the same call; `foeStoned {names}`; partial stoning leaves combat open (`test/unit/item-combat-gate.test.js`). |
| 6 | Phobia is a penalty, never a lost action (user ruling 2026-09-16) | `combat.afraid = 2`, `afraidNeed = Math.max(1, need − 3)` (LOW-range direction pin in `engine/derived.js`), `afraidDamage` ceil/2 min 1, applied to strikes, thrown spells, Earthquake/Volley, Pine Staff fire; `spellThrown` carries `needMods [{name:'afraid', delta}]`; `test/unit/afraid.test.js` proves no `*Refused` event ever names fear. |

## Requirements

CMB-01 ✓ · CMB-02 ✓ · CMB-03 ✓ · CMB-04 ✓ · CMB-05 ✓ · CMB-06 ✓

## Phase 32 hand-off

`renderEncounter` now reads `combat.pending` (preview vs fight), `combatJoined {first}` (initiative line), and `spellThrown.needMods` / `spellHit.afraid` / `attack` need-mod payloads; refusals stay toasts at `PRIORITY.block` (user decision) — the Round Card replaces only in-combat narrative toasts.

## Deferred human verification

The eleven Pixel 7 checks in the frontmatter `human_verification` list (merged from the three SUMMARY.md "Human verification (deferred to end of run)" sections) are batched into the end-of-run UAT list per the user's instruction for this autonomous run; they do not gate phase completion (precedent: Phases 26–30).
