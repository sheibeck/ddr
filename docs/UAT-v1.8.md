# v1.8 Pixel 7 device round — Phase 60 (Performance & Footprint Close)

**Build:** the v1.8 debug APK — `ddr-v1.8-d6db678-debug.apk`, full commit `d6db678c10e444aae76f6fd4cbb897eb8010e0b9`, sha256 `038c042d922ac0d70b3fd71d9ab117361f7a9b4c16cb4f1611443aa33ed65555`. It is the milestone's one debug APK.

Also installed, only for the section-A comparison: the v1.7 baseline APK —
tag `v1.7` (`6c299ab`, full commit
`6c299ab07e91cd8d00b30e8e690210172c3b4be7`), `ddr-v1.7-6c299ab-debug.apk`,
sha256 `a6e6fa8043a49597898cbd309e8d1f19fa5c69e600a419233094264f80d101b6`.
Both show "Version 1.5.0 (6)" in Settings — the visible tell is v1.8's own
☰ HUD menu and its Sound / Set dressing rows, not the version label.

**Protocol:** deferred-UAT — this is the one batched session. The executor
installs both builds and runs the cold-start launches. Record results as
the user states them. Findings become todos or quick tasks, never mid-run
edits. PERF-03 regressions get a recorded disposition in
`docs/PERF-BASELINE.md`.

**Sources:** `.planning/phases/56-sound-effects-audio-settings/56-VERIFICATION.md`
(6 items), `.planning/phases/57-map-hud-layout-band/57-VERIFICATION.md` (10
items), `.planning/phases/58-motion-pacing/58-VERIFICATION.md` (7 items),
and `.planning/phases/59-party-animation-dungeon-set-dressing/59-VERIFICATION.md`
(8 items — that file exists, so it is the Phase 59 source: the
orchestrator's authoritative merge).

**Suggested order:**
1. A1, hands off while the executor launches both builds.
2. A2 on v1.7.
3. The executor switches to v1.8. If the user agreed to the data wipe, this
   is a fresh install, and 56-3's airplane-mode first launch comes first.
4. A3 on v1.8.
5. Sections B–E.
6. Every item that needs Android's Remove animations, together in one pass
   at the end.
7. Every TalkBack item, together.
8. Section F only if the user has appetite for it.

## A. Performance — PERF-03 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| A1 | Cold start: 1 warm-up + 10 COLD launches per build, run by the executor. The user keeps the phone unlocked, on the charger and untouched for about 3 minutes. | Executor | |
| A2 | The step walk on v1.7. Exact path: Title → ENTER → any roll → ⚙ chip right of MAKE CAMP → hold the Version label about 1.2 s → depth 5 → Start. Then walk at least 50 mixed steps through a water pool, into a dark region and out again, with at least one encounter card and at least one Gear or Hero tab switch and back. Then read the `#mw-dev-perf` line under Start. Report the line verbatim, which of the four coverage items were hit, and any jank or "none". | User | |
| A3 | The same walk on v1.8, with Settings reached by ☰ → SETTINGS. | User | |
| A4 | AAB size, already measured by plan 60-02 with no device. See `docs/PERF-BASELINE.md`'s `### AAB size` section. | Executor (done) | |
| A5 | The user's ruling on each regression the executor flags. Options: accept with a reason, fix, or keep walking the same run and re-read (the later read at n ≥ 50 supersedes, as in Phase 49's n=47 → n=61). | User | |

## B. Phase 59 — Party Animation & Dungeon Set Dressing (8)

| # | Check | When | Result |
|---|-------|------|--------|
| 59-1 | ANIM-01/03 (Pixel 7): the standing party gently cycles its idle frames (about one breath a second) and reads as the highlight on its own; the old black ring is gone, leaving only a soft warm glow | any time | |
| 59-2 | ANIM-02 (Pixel 7): each step slides the party into the next square with a quick step animation and settles back to idle; fast tapping never stutters or lags; at a map edge the party and the map move as one; the marker disappears under the encounter panel with no flicker | any time | |
| 59-3 | ANIM-02 (Pixel 7): stairs and teleports put the party on its new square at once, with no slide | any time | |
| 59-4 | DRESS-01..03 (Pixel 7): each floor shows a handful of dim props on paths and brighter ones on walls; none is mistaken for an encounter, chest or crevice; no prop covers the stairs, a feature or the party; props appear only where the map is revealed and inside the dark window | any time | |
| 59-5 | DRESS-05 (Pixel 7): Settings → Set dressing Off clears every prop at once and On brings them back; the Sound setting is unaffected | any time | |
| 59-6 | DRESS-04 / PERF (Pixel 7): cold start with Set dressing On shows the map as fast as before, with props a moment after; closing and reopening mid-floor shows the props in the same places | any time | |
| 59-7 | Reduced motion (Pixel 7, 'Remove animations' on): the idle art is frozen on frame 1 with a steady glow; each step lands instantly; the Set dressing flip still redraws immediately | reduced-motion pass | |
| 59-8 | TalkBack (Pixel 7): the party marker and the props add nothing to what TalkBack announces on the map | TalkBack pass | |

## C. Phase 58 — Motion & Pacing (7)

| # | Check | When | Result |
|---|-------|------|--------|
| 58-1 | MOTION-01 (Pixel 7): walking toward a map edge scrolls smoothly, not in jumps; rapid taps never stutter; a drag mid-glide takes over instantly; the ring stays glued to the party; the resting map stays crisp | any time | |
| 58-2 | MOTION-02 (Pixel 7): MARKS / camp / Settings sheets slide up and down; the ☰ menu drops in and fades; the encounter overlay fades; tabs cross-fade without the map appearing to scroll; the rail slides up and back down with its own card; nothing feels sluggish (~180 ms open / ~120 ms close) | any time | |
| 58-3 | MOTION-04 (Pixel 7): rail text types on fast (a long card finishes in under a second); tapping a typing card finishes it without dismissing; stair and encounter cards type their line the same way | any time | |
| 58-4 | MOTION-04 accessibility (Pixel 7, TalkBack): a new rail card is announced in full the moment it appears, and the encounter card is read in full when focused, even mid-typing | TalkBack pass | |
| 58-5 | MOTION-03 (Pixel 7): a multi-exchange round plays one exchange at a time at a readable pace; each line types; the foe's HP drops with the line that hit it; buttons return only after the last line; a tap on the panel skips to the end; a killing blow and a death read line by line before the end card | any time | |
| 58-6 | MOTION-03 audio (Pixel 7): each strike / miss / hurt / kill clip plays as its line appears, not at the start of the round; hurrying plays the rest at once; Sound Off stays silent; a new fight still opens with the family cry | any time | |
| 58-7 | MOTION-05 (Pixel 7, Android 'Remove animations' on): the map moves in single jumps; every surface appears and disappears instantly with nothing half-visible; a round lands all at once; a whole session (edge walk, every sheet + the ☰ menu, tab switches, rail cards, a full fight) shows no motion and loses no text, sound or card | reduced-motion pass | |

## D. Phase 57 — Map & HUD Layout Band (10)

| # | Check | When | Result |
|---|-------|------|--------|
| 57-1 | LAYOUT-01 (Pixel 7): the map does not jump or shift on any rail show or hide — the party stays on the same screen pixel through a full show/hold/hide cycle | any time | |
| 57-2 | LAYOUT-01 (Pixel 7): the rail overlays the bottom of the play area without covering the tab bar at any safe-area inset | any time | |
| 57-3 | LAYOUT-02 (Pixel 7): a body tap dismisses a plain (no-button) rail card; a body tap on a decision card does NOT dismiss it — only its buttons do | any time | |
| 57-4 | LAYOUT-03 (Pixel 7): a four-line rail card reads comfortably before it clears at the doubled, line-scaled hold | any time | |
| 57-5 | LAYOUT-04 (Pixel 7, supersedes 57-01/57-04's chip-tap item): with the party 1-2 cells below band 2, open the ☰ and tap each row (MARKS / CENTRE MAP / MAKE CAMP / SETTINGS) — zero party movement; a map tap while the menu is open only closes it; a tab tap while open closes it, a second tap switches; the map never shifts | any time | |
| 57-6 | LAYOUT-04 (Pixel 7): walking the party to the top edge fires the keep-in-view nudge with nothing of the map hidden under the HUD | any time | |
| 57-7 | LAYOUT-05 (Pixel 7): past 1,000 Squares no HUD band overlaps at text sizes S and M; at L band 1 does not overlap, the ☰ stays visible and Rations clips ~34px (accepted) | any time | |
| 57-8 | LAYOUT-05 (Pixel 7): ☰ ◈ ⊕ ☾ ⚙ render as text glyphs in the mock colours (no tofu/emoji substitution); the ☰ is reachable one-handed | any time | |
| 57-9 | LAYOUT-05 (Pixel 7): on the Dead tab the HUD is gone and the first line clears the status bar | any time | |
| 57-10 | LAYOUT-06 (Pixel 7): rolling Table-7 Darkness without light gear closes the vignette to radius 1 while the DARK chip counts down; with a lit torch / Amulet of Light / Night Vision the chip names the waiver and the tap card leads with it; an Amulet cancel clears vignette and chip together with an Oracle line; the vignette reads as darkness against the Phase 35 palette | any time | |

## E. Phase 56 — Sound Effects & Audio Settings (6)

| # | Check | When | Result |
|---|-------|------|--------|
| 56-1 | AUD-04 latency (Pixel 7): take a step, strike, and open a chest — each clip fires on the action that caused it with no perceptible lag | any time | |
| 56-2 | AUD-04 overlap (Pixel 7): land a killing blow that also levels you up — the hit, the foe-die and the level-up clips overlap rather than cutting each other off | any time | |
| 56-3 | AUD-06 airplane mode (Pixel 7): install fresh, enable airplane mode, launch for the first time — every clip still plays, nothing is fetched | fresh install (destructive) | |
| 56-4 | AUD-05 persistence (Pixel 7): set Sound to Off, force-quit, relaunch — the app is still silent and the Settings row still reads Off | any time | |
| 56-5 | AUD-02 family cries (Pixel 7): start fights against a Beast, a Demon, a Human, a Lair Beast, a Magical and a Walking Dead foe — each opens with the ruled cry, and the two shares (Lair Beasts on human, Magical on demon) sound deliberate rather than wrong | any time | |
| 56-6 | MOTION-03 evidence for Phase 58 (Pixel 7): note whether any fight resolves too fast for its own audio to read — evidence for Phase 58's pacing decision, NOT licence to add timing in this phase | any time | |

## F. Still open from earlier milestones

- `docs/UAT-v1.7.md` (the four-run DR checklist + 25 items)
- `docs/UAT-v1.6.md` (26 checks)
- `docs/UAT-v1.5.md` (140 checks)

These are optional in the same sitting and are not this phase's requirement.

## Session record

_(filled by plan 60-03)_

**Install log:** _(each APK installed, and at what time)_

**Final build left on the phone:** _(which build — v1.7 or v1.8)_

**Regressions and rulings:** _(pointer to `docs/PERF-BASELINE.md#dispositions`)_

**Findings → todos:** _(list)_
