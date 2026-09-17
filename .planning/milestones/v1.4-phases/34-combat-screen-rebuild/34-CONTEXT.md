# Phase 34: Combat Screen Rebuild - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** User-driven redesign — the user imported a Claude Design mock and answered the three open questions directly

<domain>
## Phase Boundary

Rebuild the combat UX to the imported Claude Design spec **`design/Mazeworld Combat Panel.dc.html`** (the "Mazeworld Combat" page in project fed8909e-… mounts this panel inside an iOS bezel; `ios-frame.jsx` is the bezel and `support.js` is the Claude Design runtime — neither is part of our build). The mock's STYLE OBJECTS (recorded verbatim in the file's trailing comment block), LAYOUT and COPY TONE are the spec; its toy engine (its own dice, "gets up again", hex/slow, player-controlled party turns) is NOT — our engine, Fight! gate, refusals, loot pile, joiners and guards are the behaviour. Requirements CSCR-01..10. **Shell + presentation + tests only — no engine/content/parity changes.**

Out of scope: rules changes; player-controlled joiner turns; a dice-mode setting (tap-to-reveal only); haptics; UX-06 tutorial; the store screen.

</domain>

<decisions>
## Implementation Decisions

### Layout (CSCR-01) — from the mock
- Full-screen panel (replaces the current `#enc-panel` body; the overlay still covers map + D-pad): `background #120f0a`, text `#e6ddc6`, Courier Prime body, Press Start 2P for labels. Three bands: **header** (flex:none; `ENCOUNTER` Press Start 2P 8px `#e07260` left; `ROUND N` Courier 700 14px `#e8c97a` + `N STANDING` `#c9bda0` right; `border-bottom 3px #6b2c22`; bg `#1e120f`), **middle** (flex:1, overflow auto: foes → YOUR LOT → › log), **action area** (flex:none; `border-top 3px #3a3226`; bg `#1b170f`).
- Fonts: the bundled `press-start-2p-400.woff2` and `courier-prime-400/700.woff2` (already `@font-face`d for the app — reuse; never load from Google Fonts).
- Animations in the mock (`mwrise`, `mwfade`, bar `transition`) are cosmetic only; every guard stays a `Date.now()` check (Phase 32 rule; `prefers-reduced-motion` zeroes transitions).

### Foes (CSCR-02)
- Card per foe in encounter order: glyph (the foe's icon from the existing icon set or a text glyph; 19px, `#e07260`, `#e8c97a` when targeted, `#6d6455` dead), name (Press Start 2P 8px, upper-case), meta line `sz · INT i · sp.note` upper-cased (Courier 700 12px `#a89c82`), `wp / max` (Courier 700 15px; `—` when dead), tag line (Press Start 2P 6px: `TARGET` when targeted and >1 alive; `DOWN`; else the foe's status chips joined with ` · `, `#a78ce8`), 6px hp bar `#c4483a` (`#3a3226` dead). Borders/backgrounds per the spec block; dead cards `opacity .45`, still listed.
- Tap a live card → the existing `retarget` dispatch (guarded). Hint above the list: `TAP A FOE TO AIM AT IT` / `ONE LEFT. AIM IS SIMPLE.`; right-hand threat label from `combatJoined {first}`: `THEY STRIKE FIRST` / `YOU STRIKE FIRST` (pre-Fight!: `INITIATIVE NOT YET ROLLED` or similar).

### YOUR LOT (CSCR-03) — user decision
- Hero first, then every `state.party` member, as side-by-side cards (`flex:1`, min-width so ≥3 fit; the strip becomes `overflow-x:auto` when it overflows — "leaves that section open and scrollable if we ever add more party members"). Hero card is the active one (gold border) — joiners auto-act, so no turn cycling. Card: name (Press Start 2P 7px), `wp/max` or `DOWN`, 5px bar (`#7f9d4e` >35% else `#e05a48`; `#3a3226` down), third line = the hero's spell charges / a member's class (Courier 700 12px `#a89c82`).
- Hint: `YOUR LOT · EACH ROLLS THEIR OWN` when a joiner is present, else `JUST YOU · NOBODY TO BLAME`.

### › Fight log (CSCR-04) — user decision: full fight, newest first
- Replaces the Round Card. Source = the same `dispatchWithToasts` routing (post-dispatch `state.combat` non-null → log line; `PRIORITY.block` refusals become DULL-toned › entries in the same log — user decision 2026-09-16, "toasts go away entirely"; uncapped via `toastsForAction(..., {limit: Infinity})`). Store as `window.__mzFightLog = {seq, entries:[{text, roll, round, show}]}` (never on `S`); entries accumulate for the WHOLE fight, rendered newest first with the light `›` mark (`#6b5c3c` 15px 700), text Courier 700 15px `#c9bda0`.
- Tap an entry → toggles its dice/roll detail line (Courier 700 13.5px `#e8c97a`) — the detail comes from the event's existing roll payload/Oracle sentence (e.g. the `attack` need/roll/needMods, `spellThrown` need, flee/parley rolls); entries with no roll show no detail. No dice-mode setting.
- Pre-Fight!: the log holds the `encounterStarted` line. Cleared at `endCombat`/flee/death (and the `aria-live` announcer announces only new entries — reuse `#enc-round-live`, seq-gated).
- Round separators are NOT required; each entry carries its round for the header's `ROUND N`.

### Actions (CSCR-05) — user decision: four buttons
- 2×2 grid: `1 · STRIKE` (sub: `d20, 1–N to hit · <weapon damage>`), `2 · SPELLS` — or **`2 · ABILITIES`** when the hero has no spells (Bard → Sing lives here; a Fighter with neither: disabled with sub `NOTHING UP YOUR SLEEVE`), sub `N charges left · M known` / `SING (N sq)`; `3 · ITEMS` (potions, scrolls, staffs, every usable — the combat use-list + Potion + Scroll fold in; sub `N usable`), `4 · SOCIAL` (accent red like the mock's RUN; sub `FLEE · PARLEY`).
- STRIKE dispatches at once. SPELLS/ABILITIES, ITEMS, SOCIAL open the mock's submenu (title `<HERO> · SPELLS · N CHARGES` etc., `BACK` chip, rows: label / cost right (`N VP`/`N LEFT`/`d20, 1–N`) / desc (existing item txt or spell blurb); `max-height 206px` scroll). Rows for unavailable options render disabled-styled but stay tappable so the engine's refusal explains — as a dull › log entry (no toasts). Submenu is presentation state only (`window.__mzCombatMenu`), reset on every dispatch.
- Prompt above the grid: `PICK YOUR MISTAKE` (hero always acts; joiner lines narrate in the log).
- Keys: 1–4 select the grid; inside a submenu digits pick rows, Esc/Backspace = BACK; Enter/Space on the Fight! gate = FIGHT!.

### Fight! gate (CSCR-06) — AMENDED 2026-09-16: the map's MAJOR OVERLAY (see `design/Mazeworld Map Panel.dc.html`)
- `combat.pending` renders the major overlay over the map (full-screen bg `#0d0b08`, icon ● 54px `#e05a48`, title Press Start 2P 15px gold "SOMETHING IS HERE" (1 foe) / "THEY ARE ALREADY HERE", line = the encounter narration naming the foes, roll note "encounter table d8, then d10" or the real draw note, one primary button FIGHT IT OUT → dispatch `fight`, guarded). The combat screen NEVER renders a pending combat — it opens at round 1 after the tap. Build the overlay in this phase (it is the combat screen's entry); Phase 35 reuses it for descents/death.

### Fight end (CSCR-07) — user decision: fold in
- Win → over-panel `THEY ARE DOWN` + a sarcastic line + the Phase 29 loot rows (per-drop Equip now/Stow/Leave with `lootCompare`), `TAKE ALL` / `LEAVE ALL`, the victory report (gold/XP/rounds) in the line; the panel closes exactly as the loot card does today (pile empty → map). Flee → `YOU GOT OUT` + line + `BACK TO THE MAZE`. Death → `THAT IS THAT` (`#e07260`) + epitaph/cause lines + `REVIEW THE ORACLE` and `BURY THEM` (Confirm; stays armed, no read-first lock). Joiner offer and find cards: same behaviour, restyled to the mock's card/button vocabulary.

### Guards & tests (CSCR-08, CSCR-09)
- Every decision button goes through `guardTap` (arm window); `DISMISS_SETTLE_MS` on `window.move` unchanged; no tap-anywhere-to-dismiss; `aria-disabled` during arming, no flicker.
- Toasts: in-combat there are none after this phase (narrative + refusals both → the › log). Out-of-combat toasts remain until Phase 35 retires `#mw-toast-host` for the rail — do not delete the toast host here.
- Re-pin/replace: `shell-round-card`, `shell-input-guards` (button ids will change — pin the new ids), `shell-fight-gate`, `shell-loot-screen`, `shell-toast-wiring`, `foe-effect-chip`, `shell-party-camp` (unchanged unless the panel touches it), `round-card-worst-case` (→ log line count = folded count), any test naming `#a-strike`/`#a-potion` etc. Add: layout source assertion (three bands, order foes → lot → log), four-action grid + ABILITIES fallback, submenu contents per class (Fighter/Bard/MU/Thief), log newest-first + tap-reveal, YOUR LOT with 0/1/3 joiners incl. overflow-x, over-panel three variants, voice scan of every new string.
- Gate: `npm test` green, `npm run build:www` exit 0, `git diff -- engine content test/parity` empty, master hash `a1f4d0dc…`.

### On-device (CSCR-10)
- Build + `adb install -r` at the end of the phase; the user runs the DR round immediately (phone connected). Human checks listed in the SUMMARY/VERIFICATION.

### Claude's Discretion
- Exact sarcastic copy for the over-panel lines, submenu descs where an item has none, the pre-Fight threat label; DOM ids/classes; whether the panel keeps `#enc-body` innerHTML rebuilds or moves to a persistent skeleton with per-band rebuilds (the aria-live announcer must persist either way).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mazeworld.html#renderEncounter` (~L4869+): every current branch (death → won → beats → loot → joiner → find → store → live combat), `guardTap`/`encArmed`/`encounterSettled`/`armEncounterButtons`, `renderCarriedList` (combat use-list, `opts.guard`), the Round Card block + `#enc-round-live`, `CONDITION_COPY`, `window.mzAttack/mzFight/mzUseItem/mzCastSpell/mzFlee/mzParley/mzSing/mzReadScroll/mzDrinkPotion/mzRetarget…` bridges, `window.__mzCanCast`, `__mzConditionsOf`, `__mzLootReport`, `__mzBagUsage`, `__mzLootCompare`, `__mzInputGuards`, `__mzRoundCard`.
- `dispatchWithToasts` (the single routing seam, Phase 32) and `toastsForAction(..., {limit})`.
- `src/browser/viewModels.js` (`grimoireViewModel`, `characterSheetViewModel`, `armorDisplay`), `src/browser/icons.js` (feature/foe icons), `content/` foe data (`sz`, `i`, `sp.note`), `engine/derived.js` (`toHit`, `weaponDamage`-style helpers, `canCast`, `spellLevelFor`).
- `www/fonts/press-start-2p-400.woff2`, `courier-prime-*.woff2` and their existing `@font-face` rules.
- `design/Mazeworld Combat Panel.dc.html` — the spec (template + style block in the trailing comment).

### Established Patterns
- Source-assertion tests over `mazeworld.html` (readFileSync + stripComments + `sliceBetween`), BANNED voice scan (`test/unit/shell-round-card.test.js` pattern), bridge pattern `window.__mz*`, executor gate.

### Integration Points
- `renderEncounter` → new panel bands; `dispatchWithToasts` → `window.__mzFightLog`; `noteCombat`/`endCombat` → over-panel + log clear; `hasActiveEncounter` transition → `lastDismissAt` + `mzCenterMap`; keydown handler → grid/submenu keys.

</code_context>

<specifics>
## Specific Ideas

- User: "When a joiner joins, it would show up in the Your Lot section. That leaves that section open and scrollable if we ever add more party members."
- User: "Make sure our combat round card follows the formatting of this as well, I like the light arrow on the left that shows the events like we see them in the UX mock."
- User's action naming: "Strike, Spells (if you don't have spells call it Abilities — singing etc.), Items (Scrolls, Potions, etc), Social (Flee, Parley)".

</specifics>

<deferred>
## Deferred Ideas

- Dice-mode setting (always/never) — later.
- Player-controlled joiner turns — later, if ever.
- Restyling the store screen to the same vocabulary — later.

</deferred>
