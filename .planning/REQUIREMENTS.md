# Requirements: Delve, Die, Repeat — v1.8 Sound, Motion & Set Dressing

**Defined:** 2026-09-22
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** The dungeon stops being silent and static — every action has a sound, the party walks instead of teleporting, screens move instead of snapping, the map chrome stops fighting the map, and the floors have things on them.

**Presentation gate (applies to every requirement):** this milestone is **presentation-only**. `engine/` and `content/` are untouched (`git diff --stat` empty against the milestone base at every phase close), no new engine rng draw is added, and **zero parity fixtures move** — the master hash `a1f4d0dc…` and `test/parity/harness/comparables.js` are unchanged throughout. Any randomness a feature needs (set-dressing placement, clip variation) comes from a SHELL-side derived stream (`makeRng(hash(seed, purpose, depth))` in `src/browser/`), never off the engine's main stream. `npm test` fail 0 and `npm run build:www` green at every commit.

**Offline gate:** no network call, no new third-party SDK, no monetization or analytics dependency. Every clip and image ships inside the app bundle and works in airplane mode on first launch.

**Modularity gate:** every new surface lands as a `src/browser/` module on the v1.6 modular shell (the `render*(host, state, deps)` + one `window.__mz*` bridge-registry pattern), not as new bodies inside `mazeworld.html`'s `paint()`/`draw()`. `tools/shell-sweep.mjs` and the `src/browser/bridge.js` set-equality test stay green.

**Accessibility gate:** the TalkBack announcer (`#mw-rail-live`) receives complete text at once regardless of the typing effect, and every motion effect has a reduced-motion path that resolves instantly to the end state with nothing lost.

---

## v1.8 Requirements

### Sound (AUD)

- [ ] **AUD-01**: A player hears a distinct sound for each mapped action — walking on stone, walking through water, striking, missing, being hit, killing a foe, casting, resisting, healing, drinking, opening a chest, taking gold, springing a trap, leaping, taking the stairs, levelling up, dying, and tapping the UI
- [ ] **AUD-02**: A player hears the matching monster-family cry when a fight begins — bat/rat, beast, demon, human, undead
- [ ] **AUD-03**: A repeated action varies rather than replaying one sample — the three walk clips, three water clips, two hit clips, two miss clips and three hurt clips rotate
- [ ] **AUD-04**: Sound stays in time with play on a Pixel 7 — a clip fires on the action that caused it with no audible lag, and simultaneous events overlap instead of cutting each other off
- [ ] **AUD-05**: A player can turn all audio off from the Settings sheet; with Sound set to Off nothing plays, no audio device is opened, and the choice survives closing and reopening the app
- [ ] **AUD-06**: Audio works on first launch after install with the phone in airplane mode — every clip ships inside the app, nothing is fetched

### Party animation (ANIM)

- [ ] **ANIM-01**: The party marker plays an idle cycle while the player is standing still
- [ ] **ANIM-02**: The party marker plays its step cycle while moving between squares and settles back to idle on arrival
- [ ] **ANIM-03**: The dark ring around the party marker is dialled back so the marker itself reads as the highlight

### Motion & pacing (MOTION)

- [ ] **MOTION-01**: The map pans smoothly to follow the party instead of jumping between positions
- [ ] **MOTION-02**: Menus, panels and tabs open and close with motion rather than appearing instantly
- [ ] **MOTION-03**: A combat round plays out with a readable beat between exchanges, so the player can take in each one before the next lands
- [ ] **MOTION-04**: Rail and encounter text types itself on quickly rather than appearing as a finished block
- [ ] **MOTION-05**: With reduced motion requested (OS preference), every animation resolves immediately to its end state and no information is lost

### Map & HUD layout (LAYOUT — promoted from backlog 999.4)

- [ ] **LAYOUT-01**: The rail slides up over the map; the map neither resizes nor reflows when the rail appears or leaves
- [ ] **LAYOUT-02**: A tap on the body dismisses a rail card that asks for no decision; a card that asks for a decision can only be cleared by making it
- [ ] **LAYOUT-03**: A rail card stays readable long enough to finish reading it — roughly double today's hold
- [ ] **LAYOUT-04**: Tapping MARKS, CENTRE, MAKE CAMP or the gear chip never also moves the party, and the party is never left sitting under the chip strip
- [ ] **LAYOUT-05**: The HUD reads as stacked bands — name/class with HP, then counters, then conditions, then chips — with nothing overlapping at any text size or square count
- [ ] **LAYOUT-06**: A player caught in Table-7 darkness can see it on the map and see how much longer it lasts

### Dungeon set dressing (DRESS)

- [ ] **DRESS-01**: Floors carry scattered ambient dungeon props drawn from the `set_dungeon_*` set
- [ ] **DRESS-02**: A prop on a walkable square is dimmed enough that it is never mistaken for an encounter icon; a prop on a wall reads at full strength
- [ ] **DRESS-03**: A prop never sits on a square holding a feature, the stairs, or the party
- [ ] **DRESS-04**: The same seed and depth always dress the floor identically, and dressing never changes how a run plays
- [ ] **DRESS-05**: A player can turn set dressing off in Settings

### Performance & footprint (PERF)

- [ ] **PERF-03**: After the clips and images are added, cold start and step time on the Pixel 7 stay within the v1.7 baseline in `docs/PERF-BASELINE.md`, and the release AAB size change is measured and recorded

---

## Future Requirements (deferred)

- **Backlog 999.5** — combat screen & Oracle readability (submenu clipping + spell sort, foe type on the card, Oracle event order, status chit in combat, scroll cast narrated as a refusal)
- **Backlog 999.6** — engine rules fixes from the device rounds (no re-arm mid-combat, store charges then refuses, Summoner school gate at chargen, Table-4 HP-dot compounding, wilmst cache payout)
- **Backlog 999.7** — content accuracy, the fit-tool replay bug, and the open CLIMB IT ruling
- **Haptics polish** and the unguarded button set from 32-03 — adjacent to this milestone's feedback surfaces but not scoped here
- **Dice-mode setting**; **store screen restyle** to the dark vocabulary
- **`storeRoll` for the bots**; the two structural v1.5 AFTER patterns (Magic Users and the class-gated ability system; Wilmsry's racial edge)
- **Reach-20 fit miss** — 1.5 % vs the 3–5 % band; one `FOE_LEVEL.perDepth` notch, a future tuning round
- **UX-06** first-run tutorial (rebuilt on the modular shell, with the UIF-04 on/off toggle) and **STR-01..04/06** Google Play production launch

## Out of Scope

- **SEED-001 Leaderboards & Share** — the seed's trigger fired (this milestone touches the settings cog) and the user deferred it again on 2026-09-22. A leaderboard is an online, account-bearing feature against a v1 constraint of fully offline, no accounts, no backend. The seed stays dormant.
- **Music / ambient loops** — the asset set the user supplied is 31 one-shot effect clips; a soundtrack is a different production problem and a different bundle budget.
- **New art beyond the supplied sets** — this milestone uses `sfx/*.mp3`, `party_idle_*` / `party_step_*` and `set_dungeon_*` as delivered; commissioning or generating more is not in scope.
- **Interactive or rule-bearing set dressing** — props are ambiance only. A searchable barrel is a rules feature, which would break the presentation gate.
- **Any engine or balance change** — the fitted v1.7 curve is left exactly as it is; feel complaints from this milestone's device round become todos, not edits.
- **The three un-run Pixel 7 UAT batches** (`docs/UAT-v1.7.md`, `docs/UAT-v1.6.md`, `docs/UAT-v1.5.md`) — they run on their own track and may share this milestone's device session, but they are not this milestone's requirements.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (filled by the roadmapper) | | |
