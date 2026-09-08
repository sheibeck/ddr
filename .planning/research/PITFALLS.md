# Pitfalls Research

**Domain:** Paid, offline, single-player mobile roguelike (vanilla-JS web game → native App Store + Google Play), solo first-time mobile dev
**Researched:** 2026-09-07
**Confidence:** HIGH (store policy, wrapper mechanics, packaging/signing) / MEDIUM (roguelike design traps — synthesized from established genre wisdom + game-dev postmortems, not project-specific playtesting)

## Critical Pitfalls

### Pitfall 1: Data Safety / Privacy declarations don't match reality (Google) or missing Privacy Nutrition Label (Apple) — even for a "we collect nothing" offline game

**What goes wrong:**
Developers assume "offline game, no accounts, no analytics" means they can skip or rubber-stamp the privacy forms. In reality, both stores require an affirmative declaration, and any embedded SDK — including ones a bundler/toolchain adds silently (crash reporter, ad-mediation stub left over from a template, a WebView engine's own telemetry) — counts as data collection even if you never call it. Google's Data Safety form is checked against your actual APK's declared permissions and linked SDKs; Apple's Nutrity Label mismatch (e.g., declaring "Data Not Collected" while the binary contains a crash-reporting SDK that phones home) is a common, very avoidable rejection/removal reason. This is *more* dangerous for a "we're offline, this doesn't apply to us" project because the temptation is to skip the form or fill it in from memory rather than from the actual dependency tree.

**Why it happens:**
Wrapper toolchains (Capacitor/Cordova/Tauri) pull in plugins by default (e.g., an analytics or push-notification plugin included in a starter template) that the developer never intentionally added. Store review increasingly does automated binary scanning for SDK signatures and flags forms that don't match.

**How to avoid:**
- Audit the final native project's actual dependencies (`Podfile`/`build.gradle`, not just `package.json`) before filling out either store's data form.
- Default to zero third-party SDKs. If you add a crash reporter later (recommended — see Pitfall 9), that changes both forms and must be re-declared.
- Re-check both forms after *every* dependency/plugin version bump, not just at initial submission — a transitive update can silently add telemetry.
- Write the privacy policy and the data-safety form from the same checklist so they can't drift apart (a mismatch between the two is itself a rejection trigger).

**Warning signs:** You're filling out the form "from memory" instead of from a dependency audit; you can't name every native plugin in your Capacitor/Cordova config; your privacy policy is a generic template that doesn't match your actual (non-)data collection.

**Phase to address:** Store-launch prep phase (metadata/compliance), with a re-check gate any time the wrapper/native-plugin set changes.

---

### Pitfall 2: Age rating undersold or oversold because "dark humor" and "sarcasm" don't map cleanly onto the IARC/Apple questionnaires

**What goes wrong:**
Both stores' age rating is generated from a checkbox questionnaire (IARC for Google, Apple's own age-rating form) built around concrete content categories: violence, blood/gore, fear/horror themes, crude humor, language, gambling-like mechanics. "Sarcastic tone" and "dark humor" as described in this project (death epitaphs, mocking the player's dead character, deadpan flavor text) don't have a dedicated checkbox — the developer has to correctly map them onto categories like "Crude Humor" and possibly "Fantasy Violence" / "Mild Blood." Two failure modes: (a) under-declaring — checking "no violence/no crude humor" because "it's just funny text," which can get an app re-rated or pulled after a complaint or a later audit; (b) over-declaring/self-sabotage — checking boxes conservatively out of caution and landing at a higher age bracket than the content warrants, which narrows the audience and can trigger extra scrutiny (Apple's 17+ tier has additional restrictions; some regions restrict discovery of higher-rated apps to minors' devices by default).
Permadeath + monster combat + "dungeon crawler" also almost always triggers a **Fantasy Violence** checkbox even in a family-friendly game — failing to check it because "there's no blood" is a common mistake distinct from the humor question.

**Why it happens:** First-time developers treat the questionnaire as a formality and answer optimistically rather than literally against Apple's/IARC's category definitions.

**How to avoid:**
- Before filling out the questionnaire, write down concrete examples from your own copy (death epitaphs, Oracle log lines, monster-death flavor text) and match each to the closest official category (Crude Humor, Fantasy Violence, Mild Blood if any combat text implies injury) rather than answering from a gut "is this violent?" feeling.
- Target: land in the "everyone 10+/Teen" bracket deliberately (Fantasy Violence + Crude/Mild Humor, no blood/gore, no profanity) rather than either extreme — this matches the stated "sarcastic but family-friendly" identity and keeps discoverability broad.
- Do a tone pass explicitly checking for anything that could read as real-world profanity substitutes, drug/alcohol jokes, or anything punching at real groups — genre parody of fantasy tropes is safe; edgy meta-humor about real-world topics is not, and is also inconsistent with the game's own stated identity.

**Warning signs:** You're unsure which questionnaire box your flavor text falls under; nobody has read every piece of procedurally-assembled flavor text end-to-end (see Pitfall 11 on procedural text combinatorics) to confirm none of it could combine into something out of tone.

**Phase to address:** Presentation/content phase (writing all flavor text) should include a tone/rating audit pass; store-launch phase does the actual questionnaire.

---

### Pitfall 3: App Store "minimum functionality" / "template app" rejection because a wrapped web game looks like a WebView wrapper

**What goes wrong:**
Apple explicitly rejects apps that are thin WebView wrappers around a website with no native functionality (Guideline 4.2, "Minimum Functionality") and apps that feel like a repackaged web page rather than a real app. A vanilla-JS canvas game wrapped in Capacitor is exactly the shape reviewers are trained to flag — full-screen `<canvas>`, DOM UI, no visible native chrome. Reviewers can and do reject on "this appears to be a web site bundled as an app" even when the underlying tech (Capacitor) is perfectly legitimate and used by many shipped games.

**Why it happens:** The reviewer is judging by feel in a few minutes of tapping, not auditing your build pipeline. If the app doesn't clearly use native capabilities (haptics, native share sheet, proper app icon/launch screen, native-feeling navigation/back behavior, offline-first responsiveness) it reads as "just a website."

**How to avoid:**
- Use native-feeling chrome: a real splash/launch screen (not a flash of white/unstyled HTML), a native status-bar treatment, native haptic feedback on key actions (hit, death, level-up) via a Capacitor plugin, and native share (share your graveyard entry / high score) — cheap wins that both improve feel and defang this rejection.
- Ensure the app works fully offline from first launch with no network calls at all (no CDN-fetched assets, no external fonts) — a reviewer testing in airplane mode finding a spinner or blank screen is an instant rejection and also violates your own "fully offline" requirement.
- In App Review notes, proactively state "this is a native, offline, single-player game; no network functionality is used or required" to preempt the assumption.

**Warning signs:** Cold-launching the built app shows a flash of unstyled content or a loading spinner; the app has no native UI chrome at all outside the canvas; you haven't tested a true airplane-mode cold start on a real device.

**Phase to address:** Packaging/platform phase (wrapper setup) and a dedicated pre-submission QA pass in store-launch phase.

---

### Pitfall 4: Canvas scaling / DPI handled with CSS pixels only, producing blurry or misaligned rendering on real devices

**What goes wrong:**
The prototype was built for desktop browser testing at a fixed ~1080px reflow. Naively stretching that canvas to fill a phone screen via CSS (`width:100%; height:100%`) without accounting for `devicePixelRatio` produces blurry, soft-edged rendering on high-DPI phone screens (most modern phones are 2x–3.5x DPR). Combined with WebView viewport quirks, this is one of the most common "why does this look like a phone-2012 game" complaints on ported web games.

**Why it happens:** Desktop dev/test never surfaces the problem because desktop DPR is usually 1x or the difference is less visually obvious at typical viewing distance; it only becomes visible on a real handset held close to the face.

**How to avoid:**
- Set canvas backing-store resolution to `cssWidth * devicePixelRatio` × `cssHeight * devicePixelRatio`, scale the drawing context by DPR, and keep CSS size at the logical (CSS pixel) size — standard "retina canvas" pattern.
- Test on at least one real low/mid-range Android device and one real iPhone early — simulators/emulators frequently misreport or fake DPR and won't catch this.
- Re-verify after any change to the responsive layout math inherited from the prototype's 1080px reflow assumption, since that assumption doesn't hold across the full range of phone screen sizes/aspect ratios (tall 19.5:9/20:9 vs. older 16:9).

**Warning signs:** Text and pixel-art/canvas-drawn UI looks noticeably softer on-device than on a desktop browser at the same zoom; screenshots taken directly from the device look "smudged" compared to the design mockups.

**Phase to address:** Packaging/presentation phase (mobile rendering pass), before any store screenshots are taken (blurry screenshots also hurt conversion).

---

### Pitfall 5: Safe-area insets and system UI overlap ignored, especially on Android edge-to-edge enforcement

**What goes wrong:**
iOS notch/Dynamic Island and the home indicator, plus Android's status/navigation bars, will overlap game content (D-pad, HP bar, tap targets) if the layout doesn't respect safe-area insets. This is a bigger deal in 2026 than it used to be: Android 15+ (API 35+) **enforces edge-to-edge** for apps targeting that SDK — meaning a WebView-based app that previously had the OS draw opaque system bars for it now renders *behind* the status and navigation bars by default, and CSS/layout that never accounted for this will suddenly have controls hidden under the nav bar or the D-pad half-covered by gesture navigation.

**Why it happens:** This is invisible on desktop and even on some emulator configurations; it only bites on real devices with notches/gesture nav, and the Android 15 behavior change specifically bites apps that worked fine when built/tested against older target SDKs.

**How to avoid:**
- Use `env(safe-area-inset-*)` CSS variables (iOS) and the Capacitor/Android equivalent insets (Android) to pad the touch D-pad, action buttons, and any bottom/top HUD elements — never place interactive controls in the outer ~24-48dp margin without insetting.
- Explicitly test in landscape *and* portrait if both are supported, and on a device with a physical notch/pill cutout plus one with 3-button vs. gesture Android navigation.
- Re-test this specifically after any Android target-SDK bump, since the edge-to-edge behavior is tied to `targetSdkVersion`, not just OS version on the device.

**Warning signs:** The D-pad or an action button sits flush against the screen edge in your mockups with no padding logic; you've only tested in an emulator or a single device form factor.

**Phase to address:** Packaging/presentation phase (mobile layout), with a regression check any time Android target SDK is bumped.

---

### Pitfall 6: Touch targets sized for a mouse cursor / desktop click precision, not fingers

**What goes wrong:**
The prototype's D-pad and buttons were designed for a "responsive reflow" that still assumes reasonably precise pointer input (or a big-enough touch target on a device held at arm's length during dev testing). Real one-thumb mobile play — especially during a stressful permadeath dungeon moment — needs generously sized, well-spaced tap targets (Apple HIG and Material guidance both converge around a **44×44pt / 48×48dp minimum**, with more spacing between adjacent action buttons than a mouse UI would use). Undersized or tightly-packed buttons cause mis-taps that, in a permadeath game, directly cause player-perceived "unfair" deaths (tapped "attack" but hit "flee," or the reverse) — this compounds Pitfall 8 (permadeath frustration) by adding *input-error* deaths on top of legitimate RNG deaths.

**Why it happens:** Developer testing on their own phone with careful, deliberate taps doesn't reproduce the fast, adrenaline-driven taps of real play, and desktop-first UI design habits carry over the wrapper conversion.

**How to avoid:**
- Enforce a minimum 44pt/48dp hit target (not just visual size — the *tappable* hit area, which can be larger than the visible icon) for every combat/movement control, with real spacing between destructive actions (flee/attack) and less-destructive ones.
- Put an "are you sure" or at least a brief input debounce/confirmation on any single mis-tap that could end a run avoidably (e.g., don't let one accidental tap during descent trigger a fight with no way to back out if the design intent was deliberate engagement).
- Playtest one-handed/one-thumb on a real device, not just two-handed at a desk.

**Warning signs:** Buttons in the current CSS are sized to fit content tightly rather than to a minimum tap-target spec; there's no debounce/confirm on high-stakes taps.

**Phase to address:** Presentation/UX phase (mobile controls), verified via on-device playtesting before store submission.

---

### Pitfall 7: Android hardware/gesture back button not wired into game state (breaks navigation or accidentally exits mid-run)

**What goes wrong:**
Android's back gesture/button is a first-class navigation expectation that a web-game-turned-app frequently forgets to handle. Two failure modes: (a) back does nothing (app feels broken/unresponsive — a classic "this is just a website" tell, see Pitfall 3), or (b) back exits the entire app immediately, including mid-dungeon-run, with no confirmation — which for a permadeath game is a *disaster* (players lose in-progress runs to a reflexive back-tap, and rage-review the app for it). There's also the app-lifecycle counterpart: backgrounding the app (home button, notification, phone call) must not silently lose run state or corrupt the save.

**Why it happens:** Web apps built for a mouse+browser context never had to think about a system-level "back" affordance or true OS-level backgrounding/suspension; the concept doesn't exist in a normal web page and is easy to omit entirely when wrapping.

**How to avoid:**
- Intercept the Android hardware/gesture back event: first press backs out of a menu/modal one level at a time; from the root gameplay screen, either do nothing dangerous (require a second "press back again to exit" or open a pause menu) — never let a bare back-tap silently kill an in-progress run.
- Persist full run state (not just high scores) on every app-lifecycle pause/background event, not just on explicit save actions, so a phone call or notification mid-dungeon never loses progress (this overlaps with Pitfall 8/save-durability below).
- Test explicitly: background the app mid-combat, kill it from the OS task switcher, relaunch — the run must resume exactly where it left off.

**Warning signs:** There's no back-button handler at all in the wrapper config; the only save point is "on death" or "on manual save," not continuous.

**Phase to address:** Packaging phase (lifecycle wiring) and save/resume phase; verify with an explicit lifecycle test checklist before submission.

---

### Pitfall 8: `localStorage` treated as durable storage in a native wrapper — save data (or the graveyard/high-score history) silently wiped

**What goes wrong:**
The prototype's `localStorage` save was fine in a desktop browser, where it's effectively persistent. Inside a native WebView (WKWebView on iOS, Android System WebView), `localStorage`/IndexedDB is **not guaranteed durable**: iOS can and does evict WebView storage under disk pressure, and there are known WebKit bugs/behaviors where localStorage is lost across app updates, OS updates, or even ordinary relaunches in some WKWebView configurations. This is exactly the kind of bug that won't show up in a week of dev testing but *will* show up for real users months later — and for a game whose primary retention hook is "persistent graveyard of past runs" and local high scores, silently losing that data is close to a worst-case failure for this specific project.

**Why it happens:** `localStorage` "just works" in every desktop browser test, so the durability gap is invisible until a device runs low on storage, gets an OS update, or the app itself is updated — none of which happen during normal development iteration.

**How to avoid:**
- Do **not** treat raw `localStorage` as the durable store for save/graveyard data in the shipped app. Use a native persistence layer instead — e.g. Capacitor's `Preferences`/Filesystem APIs (backed by native storage, not WebView storage) or a small SQLite plugin — and treat `localStorage` only as an in-session cache, if used at all.
- Migrate/mirror existing prototype save-format logic onto the native store early (this is a core packaging-phase task, not a launch-week afterthought) since it affects every other feature that reads/writes `S` state.
- Add defensive save redundancy: periodic writes (not just on death), a versioned save schema so a corrupt/partial write doesn't nuke the whole save, and ideally a lightweight backup/checksum so a torn write (app killed mid-save) doesn't corrupt the graveyard file.
- Test explicitly: force-quit during a save, fill device storage near capacity, update the app in place, update the OS — confirm the graveyard and high scores survive all four.

**Warning signs:** The save code is a direct lift of the prototype's `localStorage.setItem`/`getItem` calls with no native storage plugin in between; there's a single save file with no versioning and no backup/redundancy.

**Phase to address:** Packaging phase (native persistence layer) — this is arguably the single highest-priority technical pitfall for this project given the "local high-score / graveyard as primary hook" requirement, and should be solved before endless-mode or presentation work, since every other system depends on save integrity.

---

### Pitfall 9: No crash reporting or device-diversity testing before launch — the "silent field failure" trap

**What goes wrong:**
A solo first-time mobile dev ships, gets a wave of 1-star reviews saying "crashes on open" on a phone model/OS version they never tested, and has zero visibility into *why* because there's no crash reporting and no device lab. Nearly all first-release pain for solo/indie devs is infrastructure — signing, provisioning, native-plugin version mismatches — not the game logic itself, and these infrastructure issues manifest as crashes that only reproduce on specific real hardware/OS combinations never covered by a single developer's own device(s) or by simulators/emulators.

**Why it happens:** Simulators/emulators don't perfectly replicate real GPU/WebView behavior, memory constraints, or OEM Android skinning quirks; a solo dev typically owns exactly one iPhone and one (or zero) Android phones, nowhere near the device matrix that Play Store's install base spans.

**How to avoid:**
- Add a crash reporting SDK before public launch (even a minimal, privacy-respecting one) — but see Pitfall 1: this *must* then be correctly reflected in both stores' privacy/data-safety declarations, since it's now genuine third-party data collection.
- Use TestFlight (iOS) and Google Play's internal/closed testing tracks (Android) with a handful of real external testers on different device models before public release — this is free and is the closest a solo dev gets to a device lab.
- Budget explicit time for provisioning-profile/signing-certificate setup pain: expired distribution certificates, App ID capability mismatches, and "no registered device" errors are the most common first-timer blockers and have nothing to do with game code — treat this as its own task, not a footnote of "submit to store."
- Keep Apple Developer Program (paid, annual) and Google Play Console (one-time fee) enrollment and signing identity setup as an explicit early milestone, not something discovered during a crunch right before intended launch.

**Warning signs:** You've only ever run the app on the simulator/emulator or your own single physical device; you have no way to find out about a production crash except user reviews.

**Phase to address:** Packaging/platform phase (signing + testing infra setup, early) and a dedicated pre-launch beta-testing phase using TestFlight/Play internal testing.

---

### Pitfall 10: Endless-mode difficulty scaling breaks because enemy/player growth curves were never designed against each other

**What goes wrong:**
Converting a fixed 5-floor "Gate" ending into infinite descent is not "just remove the floor cap and keep incrementing a difficulty number." The most common failure pattern across games that add endless/infinite modes to originally-bounded content: **player power grows linearly/additively (fixed stat gains per level) while enemy difficulty is scaled multiplicatively/exponentially (percentage increases per floor)** — the two curves diverge, and the game becomes either (a) trivially easy for the first N floors because the original balance assumed a 5-floor ceiling and undertuned early difficulty, or (b) a hard wall at some floor where enemy scaling outpaces anything the player's build can compensate for, making death feel like an arbitrary stat check rather than a meaningful choice. A second common failure: removing "breathing room" — in a bounded 5-floor design, easier floors/encounters are intentionally rare punctuation; naive endless scaling makes *every* floor harder than the last with no periodic easier floors, which removes the pacing variety that makes runs feel like a story rather than a monotonic grind.

**Why it happens:** The original 5-floor balance was tuned for a *known, bounded* endpoint (the Gate). Endless mode requires an entirely separate balance pass with its own curve design — treating it as a trivial parameter change (just multiply monster stats by `1.1^floor`) is the default naive approach and is exactly the trap most postmortems describe.

**How to avoid:**
- Design the endless difficulty curve as its own deliverable, not a byproduct of removing the floor cap: decide explicitly what floor number represents "roughly as hard as the old floor 5" and tune around known reference points, then extrapolate deliberately beyond it with playtesting at high floor counts (30, 50, 100+), not just floors 1–10.
- Build in periodic "easier" floors or a soft plateau/breather mechanism (a common roguelike pattern) rather than strict monotonic escalation, so long sessions still feel like a story with ebbs and flows rather than a wall that suddenly appears.
- Separate "time survived" pacing (this game's 5–10 min session target) from "floors survived" difficulty pacing — make sure a *typical* run naturally lands in the 5–10 minute window at typical player skill, and use telemetry-free local instrumentation (e.g., dev-mode logging during playtesting) to check actual average run length against that target before launch, since there's no live analytics to tell you post-launch (per the offline/no-server constraint).
- Explicitly decide what "infinite" means for stat scaling to avoid numeric overflow / absurd number inflation at very high floors for long-session players (a known failure mode in endless-mode games — eventually numbers become meaningless "bigger number" theater rather than a meaningful difficulty signal).

**Warning signs:** Difficulty scaling is implemented as a single multiplier applied uniformly to floor number with no distinct tuning pass; nobody has played to floor 50+ in testing; average playtest session length hasn't been measured against the 5–10 min target.

**Phase to address:** Endless-mode conversion phase — treat as a dedicated design/balance phase with its own playtesting pass, not a side effect of "remove the floor cap" engineering work.

---

### Pitfall 11: Permadeath frustration from *unfair-feeling* deaths (RNG or input error) vs. *earned* deaths — and procedural flavor text combinatorics nobody proofread

**What goes wrong:**
Permadeath is core to this game's identity and isn't itself a mistake — but permadeath dramatically raises the cost of any *other* unfairness in the system, because a death is never "just try again from here," it's "lose the whole run." Two distinct failure modes compound under permadeath: (1) **RNG unfairness** — a single unlucky roll (e.g., an early, disproportionately powerful monster spawn, or a run-ending trap with no counterplay) feels like the game cheated rather than like a consequence of player choices, especially if the randomness has no "fixed layer" the player can rely on (e.g., always being able to see incoming danger before it resolves, or always having a flee option that has real chance of success). (2) **Combinatorial flavor-text failures** — with 100%-dice-rolled characters, 45 creatures, dozens of items, and sarcastic procedurally-assembled text (death epitaphs, Oracle log), the combinatorial space is large enough that nobody manually reviews every combination, and it's common for procedurally-composed sarcastic lines to occasionally combine into something that reads as genuinely mean-spirited, nonsensical, or (worst case for a family-friendly rating) accidentally suggestive/inappropriate when two independently-fine text fragments concatenate.

**Why it happens:** Roguelike design wisdom (established across the genre) is that RNG should be layered — a fixed/skill layer where player choices always matter, a semi-random layer where strategy shapes outcomes, and a small pure-RNG layer for flavor/surprise — but it's easy to accidentally let pure RNG govern life-or-death outcomes (e.g., "did the trap kill you or not" as a flat percentage with zero player agency) rather than keeping it in the flavor layer. Procedural text combinatorics are a design-time blind spot because during development you only ever see a handful of combinations, never the full cross-product.

**How to avoid:**
- Audit every death-causing mechanic and classify it: does the player have a meaningful choice/counterplay before this could kill them (fixed/semi-random layer — good), or is it a flat unavoidable percentage roll with no signal or counterplay (pure-RNG-kills-you layer — minimize this)? Aim to make "you saw it coming and made a choice" the dominant death pattern; keep pure bad-luck deaths rare and, ideally, still narratively satisfying (a sarcastic epitaph helps sell an unlucky death as "funny," not "unfair").
- Add a lightweight procedural-text QA pass: either generate and skim a large batch of randomly-assembled epitaphs/Oracle lines programmatically before launch to catch bad combinations, or constrain the combination grammar so fragments can't concatenate into unintended meanings (this is cheap insurance against both an awkward player experience and an accidental rating problem).
- Distinguish "hard death, taught me something" from "cheap death, learned nothing" during playtesting — collect informal player reactions specifically to *how* they died, not just whether they died, since permadeath makes the *feeling* of the death as important as balance numbers.

**Warning signs:** There exist mechanics where death probability is a flat roll with no preceding player-visible signal or choice; nobody has read a large batch of auto-generated epitaphs/flavor lines end-to-end looking for bad combinations.

**Phase to address:** Endless-mode/balance phase (RNG layering audit) and presentation/content phase (procedural text QA pass), both before store-launch.

---

### Pitfall 12: High-score / graveyard integrity — trivially editable local save invites "cheating" that undermines the game's own value proposition

**What goes wrong:**
Because this is fully offline with no server, the local save file (wherever it lives) is directly inspectable/editable by any player willing to root/jailbreak or use a file-sharing/backup tool. For a game whose stated retention hook is "chase a higher depth/score," an easily-editable local high score undermines the personal-achievement value even in single-player (there's no leaderboard to protect from cheaters, but a player who edits their own file loses the thing the feature was for, and a "share your depth" social feature — if ever added — becomes worthless if screenshots/scores can't be trusted). This isn't a security emergency (no multiplayer leaderboard to poison yet — see Key Decisions), but it's a cheap-to-fix design smell that becomes expensive to retrofit once the multiplayer/leaderboard future (explicitly planned in this project) arrives.

**Why it happens:** "It's single-player and offline, why would we bother obfuscating a save file" is a reasonable-sounding argument that ignores the later multiplayer plan and the reputational cost of a game whose achievements are known to be trivially fakeable.

**How to avoid:**
- Lightly obfuscate or checksum the save/graveyard file (a simple HMAC or hash-of-contents check is enough to deter casual editing — this is about intent-signaling and social-share trustworthiness, not defeating a determined attacker) so that if/when a "share your best run" feature ships, screenshots and shared scores carry some minimal credibility.
- Keep the save-format versioning (see Pitfall 8) and integrity-checking as the *same* piece of work — a checksummed, versioned save format solves both durability and light tamper-resistance at once.
- Explicitly do **not** over-invest here for v1 (no server-side verification is needed for a solo offline game) — this is a "cheap now, expensive later" pitfall, not a launch blocker.

**Warning signs:** The save file is human-readable plaintext JSON with an obvious `highScore`/`bestDepth` field and no integrity check at all.

**Phase to address:** Packaging phase (bundle into the native save-format work from Pitfall 8) — low effort if done alongside save/versioning work, high effort if retrofitted after a multiplayer leaderboard exists.

---

### Pitfall 13: Rules-engine/UI coupling creeps back in during the mobile port, quietly closing the door on the planned multiplayer future

**What goes wrong:**
The project's stated architecture goal is a decoupled, fully-serializable rules engine (the prototype's `S`-state / `act()` pattern) so a future multiplayer layer can wrap the same engine without a rewrite. The single most common way solo devs paint themselves into a corner here: while doing mobile-specific work (endless-mode conversion, new UI screens, save/resume, onboarding/tutorial), it's easy to reach for "just read/write global state directly from the UI layer real quick" as a shortcut under time pressure — each individual shortcut feels harmless, but they accumulate into implicit UI-to-engine coupling that isn't visible until someone tries to drive the engine from a second client (a remote peer) and discovers dozens of places where UI code and engine state are entangled in ways that assumed a single local synchronous caller.

**Why it happens:** Solo devs under deadline pressure optimize for "make this screen work" not "keep this abstraction pure," and there's no automated test or lint rule enforcing the boundary unless one is deliberately set up.

**How to avoid:**
- Treat "does this change require touching the engine's serialization boundary or public action interface" as an explicit design-review question for every mobile-specific feature (onboarding, endless-mode counters, save/resume, new UI screens) — if a new mobile feature needs new state, it should go through the same `act()`/beats action system as existing rules, not a side-channel global mutation.
- Write (even a minimal) test that fully serializes game state to JSON and rehydrates it mid-run, and run it as part of normal development — this is the cheapest possible guardrail for "is the engine still actually decoupled and serializable," and it doubles as a regression test for the save/resume feature itself (Pitfall 8).
- Resist adding any mobile/presentation-only fields into the core `S` state object; keep UI-only state (animation flags, screen-transition state, tutorial-step tracking) in a clearly separate namespace from rules-relevant state, so a future network sync layer only has to serialize the rules-relevant part.

**Warning signs:** New mobile features are being implemented by directly mutating `S` from UI event handlers rather than through the existing action system; there's no serialize/deserialize round-trip test; UI-only concerns (like "is the tutorial tooltip showing") live in the same state object as combat/character data.

**Phase to address:** Cuts across every phase that touches game state (endless-mode, save/resume, onboarding) — enforce as an ongoing architectural discipline/checklist item rather than a single phase, with the serialization round-trip test established as early as possible (ideally during the packaging/endless-mode phase) so it catches violations for the rest of the project.

---

### Pitfall 14: Scope creep from "since we're rebuilding the UI anyway" — presentation/UX polish swallowing the schedule before store submission is even attempted

**What goes wrong:**
Adopting a new visual/UX target (the "Claude Design Mazeworld Mobile" direction referenced in this project) alongside endless-mode conversion and platform packaging is three significant workstreams happening at once. First-time mobile solo devs commonly under-budget the packaging/store-submission workstream (signing, provisioning, store listing assets, review-guideline compliance, actual submission-and-rejection-cycle time) because it's unfamiliar and "invisible" compared to visible feature/UI work, and then discover late that store submission itself eats weeks (first submission almost always gets rejected at least once for something fixable but blocking) — by which time polish work has consumed the schedule slack that should have covered that.

**Why it happens:** Feature and visual work produces visible, satisfying progress; packaging/compliance work is invisible until it blocks you, so it's naturally deprioritized by a solo dev without a second opinion forcing the tradeoff into view.

**How to avoid:**
- Treat "get a minimally-styled but fully compliant build through TestFlight + Play internal testing" as an early milestone, deliberately *before* the full visual redesign is finished — this surfaces signing/provisioning/compliance problems (Pitfalls 1, 3, 5, 9) while there's still schedule slack to fix them, rather than discovering them the week of intended launch.
- Explicitly budget calendar time (not just engineering time) for the store review cycle itself — first submissions to both stores routinely require at least one rejection-and-resubmit round, and Apple's review turnaround alone can be multiple days per cycle.
- Keep a hard-line "store submission checklist" (signing certs valid, privacy forms accurate, age rating set, screenshots/metadata complete, offline cold-start tested) as a gating checklist separate from "does the game feel good," so visual polish work never silently absorbs the time reserved for compliance.

**Warning signs:** No build has been through TestFlight/Play internal testing until very late in the schedule; there's no separate checklist/milestone for "store-submission-ready" distinct from "feature-complete."

**Phase to address:** Should be an explicit early phase (a thin, ugly, fully-store-compliant vertical slice submitted to both stores' test tracks) that runs in parallel with, not after, the visual redesign and endless-mode work.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Keep using `localStorage` directly instead of a native persistence plugin | Fast, zero new dependencies, code already works | Silent save/graveyard data loss on real devices (Pitfall 8) | Never for shipped builds — acceptable only in throwaway dev-only test builds never installed on a real device |
| Multiply enemy stats by a flat per-floor factor instead of a real endless-curve design pass | Fast to implement, "endless" technically works | Difficulty either trivializes early game or hard-walls late game; run-length target missed (Pitfall 10) | Acceptable as a first-pass prototype for internal playtesting only, never as shipped balance |
| Mutate global `S` state directly from new mobile UI code instead of routing through `act()` | Faster to ship a given screen under deadline | Closes the door on multiplayer without a rewrite (Pitfall 13) | Never — this is the one architectural line the project explicitly cares about protecting |
| Skip a crash-reporting SDK to avoid privacy-form complexity | Simpler compliance forms, faster to submit | No visibility into post-launch crashes on device models never personally tested (Pitfall 9) | Acceptable only if replaced by a rigorous, larger external beta-test group across many device models before public launch |
| Ship without a save-file checksum/version | Simpler save code | Corrupted/edited saves crash the app or undermine the depth-chase hook (Pitfall 8, 12); expensive to retrofit once graveyard data exists in the wild | Acceptable only for the very first internal alpha, must be added before any external beta |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Capacitor/Cordova wrapper | Trusting starter-template defaults (bundled analytics/ads plugins) without auditing | Start from a minimal template, add plugins one at a time, re-check privacy forms after each addition |
| Apple TestFlight | Treating provisioning/signing as a one-time setup step done right before submission | Set up signing identity, App ID, and at least one registered test device in the first packaging session, well before any real deadline pressure |
| Google Play Console data safety form | Filling it out once at submission and never revisiting | Re-derive the form from an actual dependency audit after every plugin/SDK version change |
| Native storage plugin (Preferences/SQLite) | Assuming API parity with `localStorage` (same size limits, same sync behavior) | Read the plugin's actual size/async semantics; migrate save-schema logic deliberately, don't copy-paste `localStorage` calls onto the new API |
| Android edge-to-edge (SDK 35+) | Assuming old target-SDK behavior (opaque system bars) still applies | Explicitly test safe-area insets any time `targetSdkVersion` changes, even without other code changes |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Canvas rendered at CSS-pixel resolution, not DPR-scaled | Blurry text/sprites on-device vs. desktop dev | Scale canvas backing store by `devicePixelRatio`, keep CSS size logical | Immediately visible on any real device with DPR > 1 (i.e., almost every modern phone) |
| Full-frame redraws on every tick regardless of what changed | Battery drain, jank on mid-range Android, thermal throttling during longer sessions | Redraw only changed regions or throttle to actual game-tick rate, not display refresh rate | Noticeable on mid-range/older Android hardware well before flagship devices show it |
| Procedural generation (maze/monster/loot rolls) running synchronously on the main thread at floor transitions | Visible hitch/freeze exactly at the moment a new floor loads — a bad first impression during a 5-10 min session | Profile floor-generation cost early; move to a background step or pre-generate the next floor during idle time if cost is non-trivial | Becomes noticeable as endless-mode floor numbers grow if procedural complexity scales with floor depth |
| Long-task-blocking JS on the WebView main thread during combat animations/flavor-text rendering | Input lag on taps right when players are making time-pressured decisions | Keep animation/text work off long synchronous loops; batch DOM updates | Compounds on lower-end Android WebView vs. desktop dev machine |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plaintext, unchecksummed save/graveyard file | Trivial editing undermines the depth-chase hook; corrupted saves crash the app with no recovery | Versioned save schema + lightweight integrity check (Pitfall 8, 12) |
| Leaving debug/dev-mode cheat hooks (god mode, floor-skip) reachable in a shipped release build | Player-discoverable cheats undermine the core "play the hand you're dealt" identity; also a possible App Review flag if discovered as a hidden/undisclosed feature | Strip or hard-gate dev tools behind a build flag that's verifiably off in release builds |
| Bundling a crash-reporter or any SDK without matching privacy declarations | Store rejection/removal, potential policy strikes | Any SDK addition triggers a mandatory privacy/data-safety form re-check (Pitfall 1) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Undersized/adjacent touch targets for high-stakes actions (attack vs. flee) | Input-error deaths feel unfair, compounding permadeath frustration | 44pt/48dp minimum hit areas, spacing between destructive/non-destructive actions (Pitfall 6) |
| No confirmation before an irreversible, high-stakes tap during a run | Rage-inducing accidental run loss | Debounce or lightweight confirm on run-ending actions, and on the Android back gesture from the root gameplay screen (Pitfall 6, 7) |
| Tutorial/onboarding assumes rules knowledge (inherited from the prototype, which assumed a rules-literate player) | New mobile players bounce off a rules-heavy game with zero ramp | Build a first-run onboarding pass calibrated for someone who has never seen the 1994 ruleset, distinct from the prototype's implicit assumption of rules literacy |
| Pure-RNG mechanics can end a run with no preceding player signal | Death feels like the game cheated, not like a consequence | Layer RNG so life-or-death outcomes have a visible signal/choice beforehand; keep pure-luck swings in the flavor layer (Pitfall 11) |

## "Looks Done But Isn't" Checklist

- [ ] **Offline mode:** Often "works" only because dev machine has network access in the background — verify by testing true airplane mode from a cold app launch, not just "the code has no fetch calls."
- [ ] **Save/resume:** Often only tested via explicit "Save" button taps — verify by force-quitting mid-run, killing from the OS task switcher, and simulating low-storage conditions, then confirming the graveyard/high-score history survives an app update and an OS update.
- [ ] **Age rating / content compliance:** Often filled out from a quick skim of "the obviously violent stuff" — verify by walking through actual procedurally-generated flavor text/epitaph samples against the literal questionnaire category definitions, not general impressions.
- [ ] **Endless-mode balance:** Often only playtested through the first 10-15 floors (where old fixed-length balance still roughly holds) — verify with dedicated playtests reaching floor 30-50+, checking both that difficulty doesn't wall out and that a typical run still lands near the 5-10 minute target.
- [ ] **Mobile input feel:** Often only tested via mouse-emulated touch in a desktop browser or a slow, deliberate on-device tap-through — verify with real one-thumb, fast-paced play on a real device during a simulated "tense combat" moment.
- [ ] **Rules-engine decoupling:** Often assumed true because "the prototype was already structured that way" — verify with an actual serialize-to-JSON/rehydrate-mid-run round-trip test run against the *ported* mobile codebase, not just the original prototype.
- [ ] **Privacy/data-safety forms:** Often filled out once at the start of store setup — verify they still match the actual shipped binary's dependency tree immediately before final submission, not just at first draft.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Data-safety/privacy form mismatch caught by store review | LOW | Update the form/policy to match the audited dependency tree and resubmit; usually a fast fix once identified, but costs a review cycle (days) |
| Save data loss discovered post-launch (localStorage eviction) | HIGH | Requires an app update introducing the native persistence layer; any already-lost user saves are unrecoverable — this is why it must be prevented pre-launch, not patched after |
| Endless-mode difficulty curve found broken via post-launch reviews ("unfair/unbeatable past floor X") | MEDIUM | Ship a balance-patch update; because there's no live analytics (offline, no server), rely on store reviews/support email as the primary signal, so build in some way to gather this feedback (e.g., an in-app "report an issue" mailto or feedback link) |
| Engine/UI coupling discovered only when starting the multiplayer add-on | HIGH | Requires a refactor pass to re-establish the action-system boundary before multiplayer work can proceed — exactly the rewrite the architecture was meant to avoid; costliest pitfall to recover from late |
| Age rating found to be miscalibrated after launch (complaint or re-review) | MEDIUM | Re-submit the content questionnaire with corrected answers; may require a content tweak if a specific piece of flavor text is the trigger; can temporarily affect store visibility during re-review |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Data safety/privacy form mismatch (P1) | Store-launch/compliance phase | Dependency audit checklist run immediately before each submission |
| Age rating miscalibration (P2) | Presentation/content phase + store-launch phase | Content-to-questionnaire mapping exercise using real flavor-text samples |
| "Looks like a website" rejection (P3) | Packaging/wrapper phase | Cold-launch, airplane-mode, native-chrome QA pass before first TestFlight/Play internal build |
| Canvas DPI blur (P4) | Packaging/presentation phase | Side-by-side screenshot comparison, desktop vs. real device |
| Safe-area/edge-to-edge overlap (P5) | Packaging/presentation phase | On-device test on notched iPhone + gesture-nav Android; re-test on any target-SDK bump |
| Undersized touch targets (P6) | Presentation/UX phase | One-thumb, fast-paced on-device playtest |
| Android back button / lifecycle (P7) | Packaging phase (lifecycle wiring) | Explicit background/kill/relaunch mid-run test |
| `localStorage` durability (P8) | Packaging phase (native persistence) | Force-quit, low-storage, app-update, OS-update save-survival tests |
| No crash reporting / device diversity (P9) | Packaging/platform phase + pre-launch beta phase | TestFlight/Play internal testing with external testers on varied devices |
| Endless-mode curve mismatch (P10) | Endless-mode conversion phase (dedicated balance pass) | Playtests to floor 30-50+; average session-length measurement vs. 5-10 min target |
| Permadeath fairness / procedural text combinatorics (P11) | Endless-mode/balance phase + presentation/content phase | RNG-layer audit of death mechanics; batch-generated flavor-text review |
| Save/high-score tamperability (P12) | Packaging phase (bundle with P8 save-format work) | Checksum/version validation test on a manually-edited save file |
| Engine/UI coupling creep (P13) | Ongoing, all phases touching game state; establish guardrail early in endless-mode/save phase | Serialize/rehydrate round-trip test kept green throughout development |
| Scope creep vs. compliance workstream (P14) | Early dedicated "thin vertical slice through both stores' test tracks" phase, run parallel to visual redesign | A build reaches TestFlight + Play internal testing well before feature/visual work is "finished" |

## Sources

- [App Store Rejection Reasons in 2026: The 15 Most Common and How to Avoid Each](https://www.applander.io/blog/app-store-rejection-reasons-2026) — MEDIUM confidence (SEO/blog aggregator, cross-checked against Apple's own guideline categories)
- [Why Apps Get Rejected in 2026: 15 Key Reasons and Fixes](https://www.openspaceservices.com/blog/mobile-app-development/apple-app-store-rejection-guide-2026-the-15-most-common-reasons-and-how-to-fix-each) — MEDIUM confidence
- [Google Play App Rejected in 2026: Rejection Reasons Decoded](https://qawerk.com/blog/google-play-rejection-reasons/) — MEDIUM confidence
- [Invalid Data Safety Form – Why Google Play Rejects Your App](https://www.webtonative.com/blog/fixing-invalid-data-safety-form-android-rejection) — MEDIUM confidence
- [Google Play Data Safety Form: The Complete Walkthrough for 2026](https://www.applander.io/blog/google-play-data-safety-form-complete-guide) — MEDIUM confidence
- [Google Play's Data safety section — official Play Console Help](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) — HIGH confidence (official)
- [Apps & Games content ratings on Google Play — official Google Play Help](https://support.google.com/googleplay/answer/6209544?hl=en) — HIGH confidence (official)
- [Ratings Definitions — IARC](https://globalratings.com/ratings-definitions/) — HIGH confidence (official rating body)
- [App Store Age Ratings Guide for iOS and Android](https://capgo.app/blog/app-store-age-ratings-guide/) — MEDIUM confidence
- [Capacitor Edge-to-Edge & Safe Areas: The Complete Guide — Capawesome](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/) — HIGH confidence (maintainer-authored, technically detailed, matches known Android 15 edge-to-edge enforcement)
- [Storage — Capacitor official documentation](https://capacitorjs.com/docs/guides/storage) — HIGH confidence (official)
- [WKWebView: localStorage lost — Apple Developer Forums](https://developer.apple.com/forums/thread/742037) — MEDIUM confidence (developer-reported, corroborated by multiple independent Capacitor/Cordova issue threads)
- [On app reboot `localStorage` is lost — ionic-team/capacitor issue #636](https://github.com/ionic-team/capacitor/issues/636) — MEDIUM confidence (community-reported, corroborating pattern)
- [Designing Fair RNG in Roguelikes: Balancing Luck and Skill](https://medium.com/@JeongHyeonUk/designing-fair-rng-in-roguelikes-balancing-luck-and-skill-7b967230e961) — MEDIUM confidence (design-blog synthesis of established genre wisdom)
- [Solving RNG abuse in roguelikes — Game Developer](https://www.gamedeveloper.com/game-platforms/solving-rng-abuse-in-roguelikes) — MEDIUM-HIGH confidence (established industry publication)
- [Permadeath — RogueBasin](https://www.roguebasin.com/index.php/Permadeath) — HIGH confidence (long-standing genre reference wiki)
- [How To Set Up Pacing, Difficulty, And Progression Within An Infinite Metagame — GameDev.net](https://gamedev.net/blogs/entry/2294544-how-to-set-up-pacing-difficulty-and-progression-within-an-infinite-metagame/) — MEDIUM confidence
- [Endless Mode Balancing discussion — Steam Community (9 Kings)](https://steamcommunity.com/app/2784470/discussions/0/640179446900371381/) — LOW-MEDIUM confidence (player forum anecdote, used only to corroborate the well-established linear-vs-exponential scaling failure pattern)
- [iOS Distribution Guide 2026: TestFlight, App Store & Enterprise](https://foresightmobile.com/blog/ios-app-distribution-guide-2026) — MEDIUM confidence
- Domain knowledge synthesis (rules-engine/UI decoupling risk, scope-creep-vs-compliance-workstream pattern, save-integrity-vs-tamper pattern) — general software/mobile-shipping experience, flagged LOW-source/HIGH-reasoning-confidence, not tied to a single external citation

---
*Pitfalls research for: Mazeworld (paid, offline, single-player mobile roguelike dungeon crawler)*
*Researched: 2026-09-07*
