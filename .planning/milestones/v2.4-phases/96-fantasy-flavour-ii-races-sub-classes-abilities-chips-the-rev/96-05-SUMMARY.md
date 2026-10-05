---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 05
subsystem: ui
tags: [flavour, identity, roller, hero-tab, rules-layer, snapshots]

requires:
  - phase: 96-01
    provides: flavorOfIdentity, RACE_FLAVOR and CLASS_FLAVOR
  - phase: 96-02
    provides: SUB_FLAVOR and the sub identity domain
  - phase: 95-02
    provides: mountRules and the Always show the rules switch
provides:
  - the roller reveal showing identity flavour first with the footer behind RULES
  - the Hero dossier (Race, Class, Subclass) and trait line showing flavour first with RULES
  - the dossier and trait cases in rules-surfaces.test.js
affects: [96-06, 96-07, 96-08]

tech-stack:
  added: []
  patterns:
    - "An identity surface with a flavour line mounts one RULES toggle per group; with none it keeps today's markup exactly"

key-files:
  created: []
  modified:
    - src/browser/roller.js
    - src/browser/heroTab.js
    - mazeworld.html
    - test/unit/roller.test.js
    - test/unit/heroTab.test.js
    - test/unit/rules-surfaces.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - test/unit/fixtures/shell-snapshots/mu.hero.txt

key-decisions:
  - "Trait line: with a race flavour line, the race's RACES note moves behind a hero:trait RULES toggle (flagged discretion, ROADMAP criterion 4)"
  - "Dossier RULES body reuses lineClass doss-rules for the note as well as the footer lines, so the note now renders in the mono footer style when opened"

patterns-established:
  - "Roller group order: who, flavour line, RULES button, rules body"

requirements-completed: [FLAVOR-03]

coverage:
  - id: D1
    description: "Roller reveal: flavour first, footerLines behind a RULES toggle; a tap never rolls, commits or touches the CTA; Always on drops the toggle"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/roller.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hero dossier and trait line: flavour first, old note and footer byte-identical behind RULES, tolerant fallback"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js; test/unit/heroTab.test.js; test/unit/shell-tab-snapshots.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The layout reads well on a Pixel 7: roller toggles, DESCEND reachable, dossier bodies"
    requirement: FLAVOR-03
    verification: []
    human_judgment: true
    rationale: "Touch targets and scroll reach are device judgments; deferred to the end-of-run walk"

duration: 25min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 05: Identity flavour on the roller and the Hero tab Summary

**The roller reveal and the Hero tab dossier and trait line now lead with the identity flavour line, with the exact old note and mechanical footer one RULES tap away; thief.hero and mu.hero are the only fixtures that moved, declared.**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `b1bd2cd1` | roller `fillRules` (flavour then RULES), roller flavour CSS, roller.test.js re-pinned |
| 2 | `d6b3e2c3` | dossier and trait line, heroTab.test.js re-pinned, thief.hero and mu.hero regenerated, snapshot header |
| 3 | `a69c564d` | dossier, trait and tolerant cases in rules-surfaces.test.js |

## What changed

- **Roller:** each reveal group (sub-class, and a non-Human race) reads name, flavour line (`p.mw-roller-flavor-line`), then a RULES button and a hidden body whose paragraphs are exactly `footerLines(kind, key)`. Ids `roller:sub:<name>` and `roller:race:<name>`. An identity with no flavour keeps today's visible footer lines with no toggle. Human still adds no group.
- **Dossier:** Race, Class and Subclass sections are built with createElement and textContent: `h3`, `p.who`, the flavour paragraph, then `mountRules` (`doss:race`, `doss:class`, `doss:sub`) with a body of `[note, ...footerLines]` (class: `[CLASS_NOTE]`). No flavour: today's innerHTML markup and `appendFooter`.
- **Trait line (flagged discretion):** `#s-trait` keeps the temperament, motive and phobia sentence; the race's `RACES[...].note` now sits behind a `hero:trait` RULES toggle. Not a surface the user named; ROADMAP criterion 4 walks the Hero screen for number-bearing rulebook sentences, so it was moved. Revert is a one-line change if the user disagrees.
- **CSS:** `.mw-roller-flavor-line` (ink colour, same size and wrap as the footer line) and `.mw-roller-rules .mw-rules-btn{align-self:flex-start;margin-top:4px}`.

## Declared re-pins

| File | Test | What moved |
| ---- | ---- | ---------- |
| test/unit/roller.test.js | import pin ("exactly four imports") | two to four imports: content, identity footer, flavour lookup, RULES component |
| test/unit/roller.test.js | VOX-04 reveal tests (three) | `rulesText` reads each group as [who, flavour line, RULES button, rules body]; body lines equal `footerLines` |
| test/unit/heroTab.test.js | VOX-04 (12) dossier tests (two) | `renderDossier` reads lines from inside the RULES body; body lines are `[note, ...footerLines]`; Human neutral line is the last body line |
| test/unit/shell-tab-snapshots.test.js | header | Phase 96 (FLAVOR-03), Plan 05 paragraph declares thief.hero and mu.hero |

New cases: roller tap-never-acts, Always on, unknown identity (3); rules-surfaces (s) x2, (t), (u) (4).

## thief.hero before and after (Subclass section, Cat Burglar)

Before:

```
<section>
  html="<h3>Subclass</h3><p class=\"who\">Cat Burglar</p><p>Your first strike of any fight always lands. ... which is the only perk anyone has ever mentioned.</p>"
  <p class="doss-rules"> text="Good: your first strike of every fight always lands; starts with the Dirty Trick skill for free."
  <p class="doss-rules"> text="Bad: every trap that catches you deals double damage."
```

After:

```
<section>
  <h3> text="Subclass"
  <p class="who"> text="Cat Burglar"
  <p> text="Your first strike always lands and you start knowing Dirty Trick. You also go through every door first, and every trap that catches you hurts far worse than it should."
  <button class="mw-rules-btn" aria-controls="mw-rules-doss-sub" aria-expanded="false" aria-label="Rules for Cat Burglar" ...> text="RULES ▸"
  <div id="mw-rules-doss-sub" class="mw-rules-body" hidden>
    <p class="mw-rules-line doss-rules"> text="Your first strike of any fight always lands. ... the only perk anyone has ever mentioned."
    <p class="mw-rules-line doss-rules"> text="Good: ..."   (unchanged)
    <p class="mw-rules-line doss-rules"> text="Bad: ..."    (unchanged)
```

`#s-trait` ends after "afraid of being trapped." and carries a collapsed RULES button and hidden body holding the old Wilmsry note.

## Tests run (targeted only, no full suite, no bot runs)

- Task 1 verify set (roller, identity-footer, rules-layer, flavor-text, shell-no-content-copies, bridge-registry): 106 tests, 106 pass.
- Task 2 verify set (heroTab, shell-tab-snapshots, shell-abilities, shell-ability-states, shell-party-camp, shell-company-panel, identity-text, identity-footer, identity-contract, identity-audit, hero-conditions): 246 tests, 246 pass.
- Task 3 / plan set (rules-surfaces, heroTab, roller, flavor-text, shell-tab-snapshots, identity-flavor, flavor-layer): 160 tests, 160 pass; the Dossier/Trait/Tolerant name filter: 7 pass.
- `git diff --ignore-cr-at-eol --stat bc1fc900 -- test/unit/fixtures/shell-snapshots engine test/parity test/determinism` lists only mu.hero.txt and thief.hero.txt. The six unrelated fixtures `MZ_SNAPSHOT_UPDATE=1` rewrote (line endings only) were restored with `git checkout -- <file>`.
- No CRLF-only doc-ledger failures occurred in the files run.

## Deviations from Plan

- **Line endings (no behaviour change):** the plan lists test/unit/rules-surfaces.test.js as LF, but in this worktree it was checked out CRLF (index LF, as for the other files). New lines were written CRLF to keep the working file uniform; the index holds LF.
- **Unknown-identity roller test:** a real identity that has footer lines but no flavour does not exist in the content, so the roller's no-flavour fallback branch is exercised only for "does not throw, no toggle" with an unknown sub-class and race (which yield no footer lines and so no group). The dossier tolerant case (u) pins the fallback markup byte for byte.
- TDD note: as in 96-01 and 96-02, implementation and tests landed together; no separate failing-test commit.

## Known Stubs

None.

## Threat Flags

None. New nodes use createElement and textContent; the fallback keeps today's content-only innerHTML (T-96-13). The RULES toggle is a plain onclick that stops propagation and flips DOM only; the roller test asserts no startNewRun, commit or CTA change (T-96-14). Unknown keys return "" and render as before (T-96-15).

## Human verification (deferred to end of run)

Pixel 7 walk:
- Roller reveal at text size L: flavour first, a RULES chip per group, DESCEND still reachable without scrolling past the toggles.
- Tapping RULES on the roller never rolls or commits.
- Hero dossier: three sections, RULES bodies open and close, a body stays open after switching tabs.
- The trait line's RULES opens the race note; the sentence above it reads cleanly.
- Always show the rules On then Off on both screens.
- Opened dossier bodies use the mono footer style for the note too (the note shares `doss-rules`); check it reads acceptably.

## Self-Check: PASSED

- Files found: src/browser/roller.js, src/browser/heroTab.js, mazeworld.html, the five test files, thief.hero.txt, mu.hero.txt.
- Commits found: b1bd2cd1, d6b3e2c3, a69c564d.
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
