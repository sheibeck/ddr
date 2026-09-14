// src/browser/eventNarration.js
//
// EVENT_NARRATION — the data-driven event-type -> narration-line lookup
// table that closes 04-RESEARCH.md's Pitfall 4 (formatEvent's monolithic
// switch silently dropping unrecognized engine event types). This table is
// the single source of truth engineAdapter.js#formatEvent delegates to; the
// coverage guardrail (test/unit/formatEventsCoverage.test.js) derives the
// full ~162-type vocabulary directly from engine/*.js source and asserts
// EVERY one of them has a non-null entry here.
//
// Presentation only: this module never touches state.rngState, never reads
// GameState directly, and never imports from engine/ — it only formats the
// plain {type, ...} event objects applyAction already returned. Each entry
// is a small (e) => string builder so a Phase 5 voice generator has a clean,
// enumerable seam to replace wholesale (per 04-04-PLAN.md's objective).
//
// Tone: deadpan sarcasm, dark-but-family-friendly (no profanity/gore) — the
// terse functional copy this phase writes; Phase 5's data-driven voice
// generator enriches it. Span classes (hit/miss/hurt/roll/beat/banner) match
// mazeworld.html's existing logLine CSS so migrated lines render unchanged.
//
// Every builder defends against a missing/undefined field (via `??`/`?.`)
// rather than crashing — real engine payloads always carry their documented
// fields, but the coverage test itself calls each builder with only
// `{type}` (no other fields), and a future engine payload-shape tweak should
// degrade gracefully rather than throw and break the whole render loop.
//
// NOTE: "moved" is intentionally NOT an entry in this table — a plain step
// stays silent by design (engineAdapter.js special-cases it before ever
// consulting this table; see its own comment). "pendingEncounter",
// "pendingTrap", "pendingChest" (the 01-07/01-09 placeholder events) are
// also intentionally absent: encounters.js has fully replaced them since
// 01-10, so the engine never emits them anymore — keeping stale entries here
// would violate the coverage test's "no dead/typo entries" guard.

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const EVENT_NARRATION = {
  /* ---------------- movement.js (migrated verbatim from the prior formatEvent switch) ---------------- */

  // Pass B2 group 3: voice cleanup for the 8 feature-landing buckets the
  // over-map encounter overlay shows (dark-but-family-friendly, matching
  // design/Mazeworld Mobile.dc.html's deadpan tone). Any dice-mechanics
  // clause that should vanish from the overlay (Pass B2 group 1's
  // stripRollDetail, mazeworld.html) is kept entirely inside its own
  // `<span class="roll">` (trailing punctuation included) so what remains
  // after stripping is always a clean, complete sentence — not a dangling
  // fragment. The Oracle log still shows the full line, dice and all.
  oneWayBlocked: (e) =>
    e.side === "approach"
      ? `Someone built this door to work exactly once, and used their turn already. <span class="miss">It will not open from this side.</span>`
      : `<span class="miss">You are through. That door is furniture now — there is no coming back.</span>`,
  climbedOver: () => `<span class="hit">Over, and no worse for it.</span>`,
  leaptOver: () => `<span class="hit">Cleared it. No drama.</span>`,
  // audit-batch1 (2026-09-09, A2): Bracelet of Flight / Cloak of Flying skip
  // the climb/leap roll entirely — see engine/movement.js's climb/gorge
  // block. Wording deliberately terse for now; Batch 2 owns the full A1/A2
  // narration polish pass.
  flownOver: () => `<span class="hit">You simply fly over it.</span>`,
  // Phase 15 item-wiring (ECON-08): the Cloak of Ether phases you straight
  // through the wall/crevice — no roll, no fall. Deadpan, matching flownOver.
  phasedThrough: () => `<span class="hit">You step through it like it was a rumour of a wall.</span>`,
  fellClimbing: (e) => `<span class="hurt">Gravity remembers you exist — ${e.hurt ?? 0} hp.</span>`,
  fellInGorge: (e) => `<span class="hurt">Short. The floor of the crevice makes its introduction — ${e.hurt ?? 0} hp.</span>`,
  // PHOBIA-01 (04.1-06): the three formerly-inert movement-triggered phobias
  // — deadpan, no exclamation, matching the module's established tone.
  heightsFear: () => `<span class="beat">Your stomach reaches the ground well before your feet do.</span>`,
  waterFear: () => `<span class="beat">Something down there may be wet. That is enough.</span>`,
  trappedPanic: (e) => `<span class="hurt">Four walls and one door you already used. −${e.loss ?? 0} hp.</span>`,
  afflictionTick: (e) =>
    (e.loss ?? 0) > 0
      ? `<span class="hurt">${e.kind ?? "It"}: −${e.loss} hp.</span>`
      : `<span class="hurt">${e.kind ?? "It"} has taken everything it can. You are on one hp.</span>`,
  // A1 fix #2 / P2 (04.2 Text batch): these now NAME what passed/cured — the
  // engine pushes `kind` (Poison/Disease) on both (engine/movement.js). The
  // over-map/Oracle line used to be a nameless "It passes." / "Cured.".
  afflictionPassed: (e) => `<span class="hit">The ${e.kind ?? "worst of it"} passes.</span>`,
  afflictionCured: (e) => `You sweat the ${e.kind ?? "sickness"} out overnight. <span class="hit">Cured.</span>`,
  // audit-batch1 (2026-09-09, A3): resting now rolls to cure — a failed roll
  // lands here instead of the unconditional cure above. Wording deliberately
  // terse for now; Batch 2 owns the full A1/A3 narration polish pass (both
  // events now carry `kind`, unused here on purpose until that pass).
  afflictionLingers: (e) => `<span class="hurt">You rest, but the ${e.kind ?? "sickness"} rides out the night with you.</span>`,
  // Device-review Pass DR7: named what actually recharges — this event only
  // ever fires for a Magic User's spell-charge pool (engine/movement.js,
  // every 20 squares), so "A charge comes back" with no noun was the
  // ambiguity the device-review flagged ("needs context — what recharged?").
  spellChargeRecovered: (e) =>
    `<span class="beat">Twenty quiet squares, and a spell charge is ready again</span> — ${e.charges ?? "?"} of ${e.max ?? "?"} in reserve. The dungeon keeps no such courtesy for you.`,
  dayBegan: (e) => `<span class="banner">Day ${e.day ?? "?"}.</span>`,
  rested: (e) => `Rest restores <span class="hit">+${e.amount ?? 0} hp</span>.`,
  // Phase 15 item-wiring (ECON-08): the two healing cloaks tick as you walk —
  // Healing a flat mend every 20 squares, Regeneration a rolled d6. Deadpan.
  cloakHealed: (e) => `<span class="hit">The cloak mends what it can as you walk — +${e.amount ?? 0} hp.</span>`,
  cloakRegenerated: (e) => `<span class="hit">Flesh knits itself back over twenty quiet squares — +${e.amount ?? 0} hp.</span>`,
  armorPatched: (e) => `<span class="hit">+${e.amount ?? 0}</span> back into your kit.`,
  potionDuplicated: () => `The Warlock spends the small hours duplicating a potion. <span class="hit">+1 potion.</span>`,
  wentHungry: (e) =>
    `<span class="hurt">No rations.</span> Cost of living takes <span class="hurt">${e.cost ?? 0} hp</span> straight out of you.`,
  // A1 sibling + P3 (04.2 Text batch): same stripRollDetail defect as
  // afflictionRolled — the old "check: <roll>N</roll> of 8 hours disturbed."
  // left the dangling "of 8 hours disturbed." fragment on the overlay. Dice
  // clause moved inside the span; a clean, in-voice sentence stays outside.
  // (This event only fires when at least one night-hour was disturbed —
  // engine/movement.js only pushes it for woke > 0, then starts combat.)
  wanderingMonster: (e) =>
    `Something in the dark takes an interest in you. <span class="roll">${e.hours ?? 0} of 8 night-hours disturbed.</span>`,
  campFailed: () => `<span class="miss">Not enough food to make camp.</span> Find rations first.`,
  teleported: () =>
    `<span class="beat">You teleport to an unknown location on this floor…</span> the dungeon does not offer refunds.`,
  spGained: (e) => {
    const reason = e.reason === "parley" ? "Talking your way out" : e.reason === "descend" ? "Surviving the floor" : "That";
    return `${reason} is worth <span class="roll">${e.amount ?? 0}</span> ${plural(e.amount ?? 0, "experience point")}.`;
  },
  floorChanged: (e) => `<span class="banner">Floor ${e.depth ?? "?"}.</span> The air gets worse, and takes it personally.`,
  leveled: (e) => `<span class="hit">Skill level ${e.level ?? "?"}</span> (+${e.wpGain ?? 0} hp).`,
  won: (e) => `<span class="banner">The Gate.</span> Walked out on day ${e.day ?? "?"}, after ${e.steps ?? 0} squares.`,
  died: () => `<span class="hurt">You have died.</span>`,

  /* ---------------- combat.js ---------------- */

  // A1 sibling (04.2 Text batch): the roll span sat mid-sentence and left a
  // dangling ": . You clock them first." after stripRollDetail. Prose now sits
  // outside the span (a clean overlay sentence), the dice detail inside it.
  trackingRolled: (e) =>
    e.tracked
      ? `You clock them first. <span class="roll">Tracking roll ${e.roll ?? "?"} — it pays off.</span>`
      : `They keep their lead, for now. <span class="roll">Tracking roll ${e.roll ?? "?"} — no luck.</span>`,
  encounterStarted: (e) => {
    const names = (e.foes ?? []).map((f) => f.name).join(", ") || "something";
    return `<span class="banner">${e.wandering ? "A wandering encounter." : "An encounter."}</span> ${names}.`;
  },
  trackable: () => `<span class="beat">They have not noticed you yet.</span>`,
  allyJoined: (e) => `<span class="hit">${e.name ?? "An ally"} falls in beside you.</span>`,
  warlockBoost: (e) => `The Warlock's presence stiffens the dead. <span class="hurt">+${e.amount ?? 0} hp to every corpse in the room.</span>`,
  // Phase 19 (CANON-02/D-03): a caster fleeing below its own HP threshold
  // gets its own line — the "recalls an urgent appointment on another
  // Plane" flourish from CONTEXT's "Specific Ideas" (the Djinni flee).
  foeFled: (e) =>
    e.reason === "lowHp"
      ? `<span class="hit">${e.name ?? "It"} recalls an urgent appointment on another Plane.</span>`
      : `<span class="hit">${e.name ?? "It"} thinks better of it and leaves.</span>`,
  foeBored: (e) => `<span class="hit">${e.name ?? "It"} loses interest entirely.</span>`,
  encounterCleared: () => `<span class="hit">Nothing left standing.</span>`,
  phobiaFrozen: () => `<span class="hurt">Your phobia has you rooted to the spot.</span>`,
  combatInDark: () => `<span class="beat">You cannot see what you are fighting.</span>`,
  strikeRefused: (e) =>
    e.reason === "wizard"
      ? `<span class="miss">A Wizard does not stoop to fisticuffs while a spell remains.</span>`
      : `<span class="miss">You hold back.</span>`,
  shookOffFrozen: () => `<span class="hit">You shake it off.</span>`,
  frenzy: () => `<span class="hurt">Something in your blood takes over. Frenzy.</span>`,
  frenzyWasted: (e) => `The frenzy swings wide and finds only ${e.target ?? "a corpse"}. <span class="miss">Wasted.</span>`,
  strikeMissed: (e) =>
    e.untouchable
      ? `<span class="miss">${e.target ?? "It"} cannot be touched like that.</span>`
      : `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. <span class="miss">You miss ${e.target ?? "it"}.</span>`,
  deathTouch: (e) => `<span class="hit">One touch. ${e.target ?? "It"} drops.</span>`,
  backstabDenied: () => `<span class="miss">Heavy armor gives you away.</span>`,
  silenceStrike: () => `<span class="hit">Not a sound. Critical.</span>`,
  stealthStrike: () => `<span class="hit">They never saw you. Critical.</span>`,
  backstab: () => `<span class="hit">A blade in the back. Critical.</span>`,
  conArtistOpener: () => `<span class="beat">You had the perfect backstab lined up — and announced it instead. All flourish, no follow-through.</span>`,
  ninjaFirstStrike: () => `<span class="hit">One perfect opening strike.</span>`,
  struck: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. ${e.critical ? '<span class="hit">Critical!</span> ' : ""}You hit ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> hp.`,
  foeRevived: (e) => `<span class="miss">${e.name ?? "It"} gets back up.</span>`,
  foeKilled: (e) => `<span class="hit">${e.name ?? "It"} falls.</span> +<span class="roll">${e.spGained ?? 0}</span> XP.`,
  cooked: (e) =>
    (e.wp ?? 0) > 0
      ? `You cook what is left. <span class="hit">+${e.wp} hp, +${e.rations ?? 1} ration.</span>`
      : `You salvage a ration off the carcass. <span class="hit">+${e.rations ?? 1} ration.</span>`,
  fleeRefused: () => `<span class="miss">A Samurai does not run.</span>`,
  fled: (e) =>
    e.reason === "cloaker"
      ? `<span class="hit">You vanish. Clean escape.</span>`
      : e.reason === "tracked"
        ? `<span class="hit">You slip away before it even sees you.</span>`
        : `<span class="hit">You get clear.</span>`,
  fleeRolled: (e) => `Flee: <span class="roll">${e.roll ?? "?"}</span>+${e.bonus ?? 0} vs ${e.need ?? "?"}.`,
  fleeFailed: () => `<span class="miss">You do not make it.</span>`,
  // Phase 20 (D-12/D-14): the wilmsryVsMagical refusal is now reachable (a
  // fluency-2 Wilmsry facing Magical) and gets the canon grudge line; every
  // other refusal keeps the prior text.
  parleyRefused: (e) =>
    e.reason === "wilmsryVsMagical"
      ? `<span class="miss">Magic Users hate the Wilmsry. There is nothing to discuss.</span>`
      : `<span class="miss">Not this time, not with them.</span>`,
  // Phase 20 (D-14): appends the fluency bonus (2 per point) whenever it is
  // non-zero, e.g. "need 15 (+2 <the literal below>)".
  parleyRolled: (e) =>
    `Talk it down: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}${e.fluency ? ` (+${e.fluency * 2} for the tongue)` : ""}.`,
  // Phase 20 (D-06): a failed parley marks the group insulted for the rest
  // of the fight — unmistakable, never silent.
  parleyInsulted: () => `<span class="miss">You have made it personal.</span> They will be aiming with real intent from here on.`,
  // Phase 20 (D-05): a re-sent parley after the encounter's one attempt.
  parleyExhausted: () => `<span class="miss">You already said your piece.</span> They are done listening; try the pointy end.`,
  // E10/P2 (04.2 Text batch): the trailing `(${why})` used to leak the engine's
  // internal source tag ("tableFour", "chest", "faerie"…) straight to the
  // player; NONE of those tags are player-friendly, so the suffix is dropped
  // entirely (the surrounding beats already say where the gold came from). The
  // currency also reads "wilmst" now, the game's canonical spelling, not "wm".
  // Phase 20 (D-14): the parley wilmst payout is rare now (d6===6, D-03) —
  // the success line reflects that it is a windfall, not the routine cut.
  goldGained: (e) =>
    e.why === "parley"
      ? `One of them, against the odds, pays you to forget the whole thing. <span class="hit">+${e.amount ?? 0} wilmst.</span>`
      : `<span class="hit">+${e.amount ?? 0} wilmst.</span>`,
  parleyFailed: () => `<span class="miss">They are not buying it.</span>`,
  sang: (e) => `You strike up "${e.song ?? "a tune"}".`,
  beastsSoothed: (e) => `<span class="hit">${e.count ?? 0} calm right down.</span>`,
  songIgnored: () => `<span class="miss">They do not care for music.</span>`,
  lullabyRolled: (e) => `<span class="roll">${e.n ?? 0}</span> nod off.`,
  thunderRolled: (e) => `Thunder rolls; <span class="roll">${e.n ?? 0}</span> freeze for <span class="roll">${e.r ?? 0}</span> rounds.`,
  combatEnded: () => `<span class="beat">The fight is over.</span>`,
  allyStruck: (e) => `${e.name ?? "Your ally"} lands a hit on ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> hp.`,
  allyMissed: (e) => `${e.name ?? "Your ally"} swings and misses.`,
  allyDeparted: (e) => `${e.name ?? "Your ally"} slips away, obligation met.`,
  // PARTY-04/PARTY-05 (Phase 8): a foe lands on a party member instead of you —
  // better them than you, frankly. `name` is the foe, `member` the companion.
  memberStruck: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. ${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} turns on ${e.member ?? "your companion"} for <span class="hurt">${e.dmg ?? 0} hp</span>.`,
  // PARTY-05: a member hits 0 hp — they do not die a hero's death, they simply
  // decide this dungeon is no longer their problem and leave the run.
  memberDowned: (e) => `<span class="hurt">${e.name ?? "Your companion"} goes down, and what is left of them wants no further part of this.</span>`,
  regenerated: (e) => `<span class="hit">+${e.amount ?? 0} hp</span> knits itself shut.`,
  acidTick: (e) => `Acid eats at ${e.target ?? "it"}: <span class="roll">${e.dmg ?? 0}</span> hp.`,
  foeSlept: (e) => `${e.name ?? "It"} sleeps through it.`,
  foeMissed: (e) => `${e.name ?? "It"} swings${e.member ? ` at ${e.member}` : ""}, <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}, and misses.`,
  wardReflected: (e) => `<span class="hit">The ward throws ${e.amount ?? 0} back at ${e.target ?? "it"}.</span>`,
  wardAbsorbed: (e) => `The ward eats <span class="roll">${e.amount ?? 0}</span> (${e.remaining ?? 0} left).`,
  wardShattered: () => `<span class="hurt">The ward shatters.</span>`,
  armorDestroyed: () => `<span class="hurt">Your armor gives out.</span>`,
  armorSoaked: (e) => `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.`,
  // Phase 18 (CANON-01, D-08) — the FOE's natural armor ate the hero's/
  // ally's blow. `name` is the foe; `amount` is what it shrugged off (kept
  // short for the toast).
  foeArmorSoaked: (e) => `<span class="miss">Your blow rings off ${e.name ?? "the thing"}'s armor. It looks bored.</span>`,
  // Phase 15 item-wiring (ECON-08): the Pendant of Fortitude eats half of one
  // incoming blow, then spends itself. `name` is the foe whose hit was blunted.
  damageHalved: (e) => `<span class="hit">The pendant drinks half of ${e.name ?? "that"}'s blow before it reaches you.</span>`,
  struckByFoe: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. ${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} hits you for <span class="hurt">${e.dmg ?? 0} hp</span>.`,
  wardFaded: () => `<span class="beat">The ward fades.</span>`,
  mirrorFaded: () => `<span class="beat">The mirror fades.</span>`,

  // Phase 19 (FOE-01..09, D-16): foe abilities — telegraph first, effect
  // second. Every builder here defends a bare `{ type }` call (the coverage
  // guard's own invocation shape) and never leaks an engine identifier
  // (ability ids are not player-facing — the telegraph uses `e.txt`, a
  // content string already scanned by the safety corpus).
  foeCast: (e) => `<span class="beat">${e.txt ?? `${e.name ?? "It"} does something unpleasant and magical.`}</span>`,
  foeBolted: (e) =>
    e.member
      ? `${e.name ?? "It"} lands it on ${e.member} for <span class="hurt">${e.dmg ?? 0} hp</span>. Better them than you.`
      : `It lands. <span class="hurt">${e.dmg ?? 0} hp</span>${e.ignoresArmor ? ", and your armor was not consulted" : ""}.`,
  foeDrained: (e) => `${e.name ?? "It"} looks better for it. <span class="hurt">+${e.stolen ?? 0} hp</span> — yours, formerly.`,
  foeDebuffed: (e) =>
    e.kind === "dazed"
      ? `<span class="hurt">The room keeps moving after you stop. Dazed for ${e.rounds ?? "?"} rounds.</span>`
      : `<span class="hurt">Your arms feel like someone else's. Weakened for ${e.rounds ?? "?"} rounds.</span>`,
  foeHealed: (e) => `${e.name ?? "It"} knits itself back together. <span class="miss">+${e.amount ?? 0} hp.</span> Rude.`,
  foeSummoned: (e) =>
    e.pending
      ? `<span class="miss">${e.by ?? "It"} calls, and something answers from a little way off.</span>`
      : `<span class="miss">${e.name ?? "Something"} shuffles in, late and unbothered.</span>`,
  foeEffectFaded: (e) =>
    e.kind === "dazed"
      ? `<span class="hit">The room settles. You are no longer dazed.</span>`
      : `<span class="hit">Your strength comes back. It was only borrowed.</span>`,
  heroResisted: (e) =>
    `<span class="hit">You think very hard about not being affected, and it works.</span> <span class="roll">${e.roll ?? "?"} vs intel ${e.intel ?? "?"}.</span>`,
  heroResistFailed: (e) =>
    `You try to shrug it off. <span class="roll">${e.roll ?? "?"} vs intel ${e.intel ?? "?"}.</span> <span class="miss">You do not.</span>`,
  foePursued: (e) => `<span class="hurt">${e.name ?? "It"} follows you out. Of course it does.</span>`,
  foeOutOfSpells: (e) => `${e.name ?? "It"} gestures grandly. Nothing happens. <span class="miss">It appears to be out of spells.</span>`,

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => `<span class="miss">Nothing left to cast with.</span>`,
  spellNotKnown: (e) => `<span class="miss">You do not know ${e.spell ?? "that"}.</span>`,
  spellAboveLevel: (e) => `<span class="miss">${e.spell ?? "That"} needs level ${e.need ?? "?"}; you are ${e.have ?? "?"}.</span>`,
  spellSchoolLocked: (e) => `<span class="miss">${e.spell ?? "That"} is not open to you yet.</span>`,
  spellBackfired: (e) => `<span class="hurt">${e.spell ?? "The spell"} goes wrong.</span>`,
  backfireSelfDamage: (e) => `<span class="hurt">It costs you ${e.amount ?? 0} hp.</span>`,
  spellResisted: (e) => `${e.target ?? "It"} shrugs it off. <span class="roll">${e.roll ?? "?"}</span> vs intel ${e.intel ?? "?"}.`,
  resistFailed: (e) => `${e.target ?? "It"} tries to resist and fails. <span class="roll">${e.roll ?? "?"}</span>.`,
  summonBackfired: (e) => `<span class="hurt">The summoning turns on you for ${e.amount ?? 0} hp.</span>`,
  allySummoned: (e) => `<span class="hit">${e.name ?? "Something"} answers the call.</span>`,
  allyPending: (e) => `<span class="beat">${e.name ?? "Something"} is coming, once there is a fight to join.</span>`,
  stunned: (e) => `<span class="hit">${e.count ?? 0} freeze in place.</span>`,
  weakened: () => `<span class="hit">They hit softer now.</span>`,
  stupefied: (e) => `<span class="hit">${e.target ?? "It"} forgets what it is doing.</span>`,
  blinded: (e) => `<span class="hit">${e.target ?? "It"} cannot see a thing.</span>`,
  shrunk: (e) => `<span class="hit">${e.count ?? 0} shrink to half size.</span>`,
  acidApplied: (e) => `${e.target ?? "It"} starts to dissolve. <span class="roll">${e.rounds ?? 0}</span> rounds of it.`,
  earthquake: (e) => `<span class="banner">The floor heaves.</span> <span class="roll">${e.amount ?? 0}</span> to everyone in the room.`,
  earthquakeSelfDamage: (e) => `<span class="hurt">The shaking costs you ${e.amount ?? 0} hp too.</span>`,
  vaporRolled: (e) => `Noxious vapor: <span class="roll">${e.roll ?? "?"}</span>.`,
  volley: (e) => `<span class="roll">${e.rolls ?? 0}</span> shots, <span class="roll">${e.totalDamage ?? 0}</span> total damage.`,
  petrified: (e) => `<span class="hit">${e.target ?? "It"} turns to stone.</span>`,
  walkingDeadTurned: (e) => `<span class="hit">${e.count ?? 0} of the dead turn and flee.</span>`,
  nothingToTurn: () => `<span class="miss">Nothing here to turn.</span>`,
  planeGated: (e) => `<span class="hit">${e.count ?? 0} are gated straight back out.</span>`,
  gateRefused: () => `<span class="miss">There is no plane here worth opening.</span>`,
  sensesGained: () => `<span class="hit">Your senses sharpen.</span>`,
  detectMagic: () => `<span class="hit">The floor lights up. You see all of it now.</span>`,
  senseDanger: (e) => `<span class="beat">You get a bad feeling about the next ${e.nextEncounter ?? "encounter"}.</span>`,
  mirrorSelf: (e) => `<span class="hit">A mirror image holds for ${e.rounds ?? 0} rounds.</span>`,
  wardRaised: (e) => `<span class="hit">${e.spell ?? "The ward"} raises a ward: ${e.pool ?? 0} points${e.reflect ? ", reflecting" : ""}.</span>`,
  strengthCast: (e) => `<span class="hit">Might surges: +${e.might ?? 0}.</span>`,
  regenerationCast: () => `<span class="hit">Wounds start closing on their own.</span>`,
  insaneNoTarget: () => `<span class="miss">There is no one here to turn insane at.</span>`,
  insaneRolled: (e) => `Insanity takes ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span>.`,
  insaneStruckAlly: (e) => `The maddened thing turns on ${e.target ?? "an ally"} for <span class="roll">${e.dmg ?? 0}</span> hp.`,
  insaneFled: (e) => `<span class="beat">${e.target ?? "It"} bolts, mad with fear.</span>`,
  healed: (e) => `<span class="hit">+${e.amount ?? 0} hp</span>${e.spell ? ` from ${e.spell}` : ""}.`,
  deathSpellTooWeak: () => `<span class="miss">You are too weak yourself to cast it.</span>`,
  deathCast: () => `<span class="hurt">You spend 25 hp calling on Death itself.</span>`,
  dozed: (e) => `${e.target ?? "It"} dozes off for ${e.rounds ?? 0} rounds.`,
  nothingToThrowAt: () => `<span class="miss">Nothing here to throw it at.</span>`,
  spellThrown: (e) => `${e.spell ?? "It"} at ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
  spellHit: (e) => `<span class="hit">Hit.</span> <span class="roll">${e.dmg ?? 0}</span> hp${(e.mult ?? 1) > 1 ? ` (×${e.mult})` : ""}.`,
  frozenSolid: (e) => `<span class="hit">${e.target ?? "It"} freezes solid.</span>`,
  spellMissed: (e) => `<span class="miss">Missed ${e.target ?? "it"}.</span>`,
  potionDrunk: (e) => `<span class="hit">+${e.amount ?? 0} hp</span> (${plural(e.remaining ?? 0, "potion")} left).`,
  scrollRead: (e) => `You unroll a scroll: ${e.spell ?? "something unreadable"}.`,
  scrollCopiedToGrimoire: (e) => `<span class="hit">${e.spell ?? "It"} copied into your grimoire.</span>`,
  scrollCast: (e) => `The scroll casts itself: ${e.spell ?? "something"}.`,

  /* ---------------- economy.js ---------------- */

  storeOpened: (e) => `<span class="banner">The shop is open.</span>${e.troll ? " (Trolls pay triple.)" : e.elfOrDwarf ? " (A discount, as always.)" : ""}`,
  buyFailed: (e) => `<span class="miss">You are short ${e.short ?? 0} wilmst.</span>`,
  bought: (e) => `<span class="hit">Bought:</span> ${e.item ?? "something"} for ${e.cost ?? 0} wilmst.`,
  // RATION-01: the dedicated, visible ration purchase — surfaces the ration
  // gain explicitly, unlike the old silent food-side-effect +1.
  rationsBought: (e) => `<span class="hit">Stocked up:</span> +${plural(e.amount ?? 1, "ration")}. At least someone is planning ahead.`,
  // ECON-06 (Phase 14): the store buys your gear back at a discount. Deadpan,
  // dark-but-family-friendly (a VOX-02 safety scan checks this line) — the
  // shopkeeper is doing you no favours, and knows it.
  itemSold: (e) =>
    `<span class="hit">Sold:</span> ${e.item?.n ?? "something"} for ${e.price ?? 0} wilmst. The shopkeeper's smile suggests you got the worse end of it.`,
  storeLeft: () => `<span class="beat">You leave the shop.</span>`,

  /* ---------------- encounters.js ---------------- */

  trapAvoided: (e) => `<span class="hit">You clock it a half-step early.</span> <span class="roll">${e.roll ?? "?"} vs ${e.need ?? "?"}.</span>`,
  trapDisarmed: () => `<span class="hit">A Pilfer's hands already knew where not to put themselves.</span>`,
  trapDoubled: () => `<span class="hurt">Cat Burglar's luck holds — for the trap. It hits twice as hard.</span>`,
  trapSprung: (e) => `<span class="hurt">${e.name ?? "A trap"} finds you first.</span> <span class="roll">${e.dmg ?? 0} hp.</span>`,
  trapPoisoned: () => `<span class="hurt">The trap leaves something behind that outlasts the bruise.</span>`,
  chestOpened: () => `<span class="hit">The box gives up its secrets.</span>`,
  chestLockRolled: (e) => `<span class="roll">Lock: ${e.roll ?? "?"} vs ${e.need ?? "?"}.</span>`,
  chestLocked: () => `<span class="miss">Not today. The lock wins this round.</span>`,
  scrollFound: () => `<span class="hit">A scroll, tucked in with the loot.</span>`,
  encounterRolled: (e) => `<span class="roll">Table ${e.table ?? "?"}, roll ${e.roll ?? "?"}:</span> The dice decide — ${e.result ?? "something"}.`,
  tableFour: (e) => `<span class="beat">${e.result ?? "Something happens."}</span>`,
  tableFourNoop: (e) => `<span class="beat">${e.result ?? "Nothing much happens."}</span>`,
  foodFound: (e) => `<span class="hit">${e.name ?? "Food"}</span> (+${e.wp ?? 0} hp).`,
  grimoireSold: () => `You cannot use it, so you sell it.`,
  grimoireLearned: (e) => `<span class="hit">New spells:</span> ${(e.spells ?? []).join(", ") || "nothing new"}.`,
  // P1 (04.2 Text batch): `gift` is the raw FAERIE table key ("+d20 Base HP",
  // "d10 x 100 wilmst", "Miscellaneous Magic"…) — printing it raw here echoed
  // dev jargon, and the SAME turn a specific follow-up event (faerieBoon/
  // faerieBane/goldGained/leveled/itemTaken/miscMagicRolled) already narrates
  // the real outcome. So this is now just the teaser; the follow-up tells the
  // story. (Builder no longer reads e.gift — the field stays on the event.)
  faerieMet: () => `<span class="beat">A faerie blinks into being, takes your measure, and decides.</span>`,
  faerieBoon: (e) => `<span class="hit">+${e.amount ?? 0} base hp.</span>`,
  faerieBane: (e) => `<span class="hurt">−${e.amount ?? 0} base hp.</span>`,
  joinerMet: (e) => `<span class="hit">${e.name ?? "Someone"}</span>, a ${e.sub ?? e.race ?? "stranger"}, joins you for a while.`,
  // PARTY-01/PARTY-09 (Phase 9): the accept/decline outcome of a recruitment.
  // Deadpan, dark-but-family-friendly — the humor is at everyone's expense,
  // especially the poor soul who just signed on.
  joinerJoined: (e) =>
    `<span class="hit">${e.name ?? "Someone"} falls in beside you</span>, already quietly revising their life expectancy downward.`,
  joinerDeclined: (e) =>
    `<span class="beat">You wave ${e.name ?? "them"} off.</span> The dungeon will find another use for them soon enough.`,
  // A1 (04.2 Text batch): the old template left the roll span mid-sentence
  // ("...you: <roll>N</roll>, Poison."), so stripRollDetail (mazeworld.html,
  // the over-map overlay) removed the span and left the dangling ": , Poison."
  // artifact the device-review flagged. Per this file's convention (:41-48) the
  // ENTIRE dice clause + its punctuation now lives inside the span, and the
  // kind is stated plainly outside — so what survives stripping is always a
  // clean sentence ("Something is wrong with you. Poison.") while the Oracle
  // log still shows the roll. `kind` is the REAL diagnosis (Poison/Disease),
  // never the renamed "Ailment" dispatch bucket, so the two never contradict.
  afflictionRolled: (e) =>
    `Something is wrong with you. <span class="roll">The die turns up ${e.roll ?? "?"}.</span> ${e.kind ?? "Something has its hooks in you"}.`,
  phobiaAcquired: (e) => `<span class="hurt">A new fear settles in: ${e.name ?? "something"}.</span>`,
  afflictionCaught: (e) => `<span class="hurt">${e.kind ?? "It"} takes hold.</span> −${e.first ?? 0} hp.`,
  insanityRolled: (e) => `<span class="hurt">Insanity.</span> It ${e.result ?? "comes apart at the seams"}.${e.roll != null ? ` <span class="roll">d6 → ${e.roll}.</span>` : ""}`,
  insanitySelfHarm: () => `<span class="hurt">You turn on yourself.</span>`,
  insanityRage: (e) => `<span class="hurt">Rage: +${e.amount ?? 0} might.</span>`,
  darknessFell: () => `<span class="beat">The dark closes in around you.</span>`,
  // PHOBIA-01 (04.1-05): the persistent darkness counter fallDark sets
  // (engine/encounters.js) clears at zero via engine/movement.js's per-step
  // tick — this is that "it lifts" line.
  darknessLifted: () => `<span class="hit">The dark loosens its grip. You can see again.</span>`,
  // Phase 15 item-wiring (ECON-08): the Amulet of Light's standing light spell
  // burns the persistent darkness off outright, rather than waiting it out.
  darknessDispelled: () => `<span class="hit">Your amulet's light swallows the dark whole. It does not argue.</span>`,
  miscMagicRolled: (e) => `<span class="beat">Miscellaneous magic:</span> ${e.what ?? "something"}.`,

  /* ---------------- items.js ---------------- */

  itemGiven: (e) => `<span class="hit">Received:</span> ${e.item?.n ?? "something"}.`,
  itemRejected: (e) => `<span class="miss">Not an upgrade.</span> ${e.item?.n ?? "something"}.`,
  itemTaken: (e) => `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}.`,
  itemUsed: (e) => `You use ${e.item?.n ?? "something"}.`,
  cured: (e) => `<span class="hit">Cured of ${e.kind ?? "it"}.</span>`,
  itemBurned: (e) => `<span class="roll">${e.total ?? 0}</span> fire damage spread across the room.`,
  itemFizzled: () => `<span class="miss">Nothing happens.</span>`,
  itemConsumed: (e) => `${e.item?.n ?? "It"} is spent.`,

  /* ---------------- inventory actions (ECON-03/04/05, Phase 13) ----------------
     The find offer/accept/decline + bag keep/drop + equip/unequip lines. Deadpan,
     dark-but-family-friendly (a VOX-02 safety scan checks these) — the dungeon is
     never impressed by your acquisitiveness. */

  // A find is dangled in front of you; you have not touched it yet (the UI's
  // Take it / Leave it prompt narrates the decision).
  findOffered: (e) => `<span class="beat">Something's here for the taking: ${e.name ?? "something"}.</span> Your call.`,
  findTaken: (e) => `<span class="hit">Into the bag it goes:</span> ${e.item?.n ?? "something"}. You'll regret the weight eventually.`,
  findLeft: (e) => `<span class="miss">You leave ${e.item?.n ?? "it"} where it lay.</span> The dungeon respects restraint from no one.`,
  // The bag is full — nothing more fits until something is dropped.
  bagFull: (e) =>
    `<span class="miss">No room.</span> The bag is stuffed; drop something before ${e.item?.n ? `taking ${e.item.n}` : "you can take that"}.`,
  itemDropped: (e) => `<span class="beat">You drop ${e.item?.n ?? "it"}.</span> Lighter, poorer, wiser — pick two.`,
  itemEquipped: (e) =>
    `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}${e.slot ? ` (${e.slot})` : ""}. Whether that was wise is between you and the maze.`,
  itemUnequipped: (e) =>
    `<span class="beat">You stow your ${e.slot ?? "gear"}</span> — ${e.item?.n ?? "it"} back in the bag, and you back to improvising.`,
  // Tried to wear/wield something your class, subclass, or race cannot.
  equipRejected: (e) =>
    `<span class="miss">Not for the likes of you.</span> ${e.item?.n ?? "That"} refuses your hands${e.reason === "noArmor" ? " — your kind wears no armour" : ""}.`,
};
