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

  oneWayBlocked: (e) =>
    e.side === "approach"
      ? `The arrow points the other way. <span class="miss">It will not open from this side.</span>`
      : `<span class="miss">You came through it. There is no coming back.</span>`,
  climbedOver: () => `<span class="hit">Over.</span>`,
  leaptOver: () => `<span class="hit">Over.</span>`,
  fellClimbing: (e) => `<span class="hurt">You come off — ${e.hurt ?? 0} wp.</span>`,
  fellInGorge: (e) => `<span class="hurt">Short. ${e.hurt ?? 0} wp on the way down.</span>`,
  afflictionTick: (e) =>
    (e.loss ?? 0) > 0
      ? `<span class="hurt">${e.kind ?? "It"}: −${e.loss} wp.</span>`
      : `<span class="hurt">${e.kind ?? "It"} has taken everything it can. You are on one wp.</span>`,
  afflictionPassed: () => `<span class="hit">It passes.</span>`,
  afflictionCured: () => `You sweat the sickness out overnight. <span class="hit">Cured.</span>`,
  spellChargeRecovered: (e) =>
    `<span class="beat">Twenty quiet squares. A charge comes back (${e.charges ?? "?"} of ${e.max ?? "?"}).</span>`,
  dayBegan: (e) => `<span class="banner">Day ${e.day ?? "?"}.</span>`,
  rested: (e) => `Rest restores <span class="hit">+${e.amount ?? 0} wp</span>.`,
  armorPatched: (e) => `<span class="hit">+${e.amount ?? 0}</span> back into your kit.`,
  potionDuplicated: () => `The Warlock spends the small hours duplicating a potion. <span class="hit">+1 potion.</span>`,
  wentHungry: (e) =>
    `<span class="hurt">No rations.</span> Cost of living takes <span class="hurt">${e.cost ?? 0} wp</span> straight out of you.`,
  wanderingMonster: (e) => `Wandering monster check: <span class="roll">${e.hours ?? 0}</span> of 8 hours disturbed.`,
  campFailed: () => `<span class="miss">Not enough food to make camp.</span> Find rations first.`,
  teleported: () => `<span class="beat">Teleport square.</span>`,
  spGained: (e) => {
    const reason = e.reason === "parley" ? "Talking your way out" : e.reason === "descend" ? "Surviving the floor" : "That";
    return `${reason} is worth <span class="roll">${e.amount ?? 0}</span> ${plural(e.amount ?? 0, "skill point")}.`;
  },
  floorChanged: (e) => `<span class="banner">Floor ${e.depth ?? "?"}.</span> The air gets worse.`,
  leveled: (e) => `<span class="hit">Skill level ${e.level ?? "?"}</span> (+${e.wpGain ?? 0} wp).`,
  won: (e) => `<span class="banner">The Gate.</span> Walked out on day ${e.day ?? "?"}, after ${e.steps ?? 0} squares.`,
  died: () => `<span class="hurt">You have died.</span>`,

  /* ---------------- combat.js ---------------- */

  trackingRolled: (e) =>
    e.tracked
      ? `Tracking pays off: <span class="roll">${e.roll ?? "?"}</span>. You clock them first.`
      : `Tracking: <span class="roll">${e.roll ?? "?"}</span>. No dice this time.`,
  encounterStarted: (e) => {
    const names = (e.foes ?? []).map((f) => f.name).join(", ") || "something";
    return `<span class="banner">${e.wandering ? "A wandering encounter." : "An encounter."}</span> ${names}.`;
  },
  trackable: () => `<span class="beat">They have not noticed you yet.</span>`,
  allyJoined: (e) => `<span class="hit">${e.name ?? "An ally"} falls in beside you.</span>`,
  warlockBoost: (e) => `The Warlock's presence stiffens the dead. <span class="hurt">+${e.amount ?? 0} wp to every corpse in the room.</span>`,
  foeFled: (e) => `<span class="hit">${e.name ?? "It"} thinks better of it and leaves.</span>`,
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
      : `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. <span class="miss">Miss.</span>`,
  deathTouch: (e) => `<span class="hit">One touch. ${e.target ?? "It"} drops.</span>`,
  backstabDenied: () => `<span class="miss">Heavy armor gives you away.</span>`,
  silenceStrike: () => `<span class="hit">Not a sound. Critical.</span>`,
  stealthStrike: () => `<span class="hit">They never saw you. Critical.</span>`,
  backstab: () => `<span class="hit">A blade in the back. Critical.</span>`,
  conArtistOpener: () => `<span class="beat">A warning shot, not a wound.</span>`,
  ninjaFirstStrike: () => `<span class="hit">One perfect opening strike.</span>`,
  struck: (e) =>
    `${e.critical ? '<span class="hit">Critical!</span> ' : ""}You hit ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> wp.`,
  foeRevived: (e) => `<span class="miss">${e.name ?? "It"} gets back up.</span>`,
  foeKilled: (e) => `<span class="hit">${e.name ?? "It"} falls.</span> +<span class="roll">${e.spGained ?? 0}</span> sp.`,
  cooked: (e) =>
    (e.wp ?? 0) > 0
      ? `You cook what is left. <span class="hit">+${e.wp} wp, +${e.rations ?? 1} ration.</span>`
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
  parleyRefused: () => `<span class="miss">Not this time, not with them.</span>`,
  parleyRolled: (e) => `Talk it down: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
  goldGained: (e) => `<span class="hit">+${e.amount ?? 0} wm</span>${e.why ? ` (${e.why})` : ""}.`,
  parleyFailed: () => `<span class="miss">They are not buying it.</span>`,
  sang: (e) => `You strike up "${e.song ?? "a tune"}".`,
  beastsSoothed: (e) => `<span class="hit">${e.count ?? 0} calm right down.</span>`,
  songIgnored: () => `<span class="miss">They do not care for music.</span>`,
  lullabyRolled: (e) => `<span class="roll">${e.n ?? 0}</span> nod off.`,
  thunderRolled: (e) => `Thunder rolls; <span class="roll">${e.n ?? 0}</span> freeze for <span class="roll">${e.r ?? 0}</span> rounds.`,
  combatEnded: () => `<span class="beat">The fight is over.</span>`,
  allyStruck: (e) => `${e.name ?? "Your ally"} lands a hit on ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> wp.`,
  allyMissed: (e) => `${e.name ?? "Your ally"} swings and misses.`,
  allyDeparted: (e) => `${e.name ?? "Your ally"} slips away, obligation met.`,
  regenerated: (e) => `<span class="hit">+${e.amount ?? 0} wp</span> knits itself shut.`,
  acidTick: (e) => `Acid eats at ${e.target ?? "it"}: <span class="roll">${e.dmg ?? 0}</span> wp.`,
  foeSlept: (e) => `${e.name ?? "It"} sleeps through it.`,
  foeMissed: (e) => `${e.name ?? "It"} swings, <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}, and misses.`,
  wardReflected: (e) => `<span class="hit">The ward throws ${e.amount ?? 0} back at ${e.target ?? "it"}.</span>`,
  wardAbsorbed: (e) => `The ward eats <span class="roll">${e.amount ?? 0}</span> (${e.remaining ?? 0} left).`,
  wardShattered: () => `<span class="hurt">The ward shatters.</span>`,
  armorDestroyed: () => `<span class="hurt">Your armor gives out.</span>`,
  armorSoaked: (e) => `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.`,
  struckByFoe: (e) =>
    `${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} hits you for <span class="hurt">${e.dmg ?? 0} wp</span>.`,
  wardFaded: () => `<span class="beat">The ward fades.</span>`,
  mirrorFaded: () => `<span class="beat">The mirror fades.</span>`,

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => `<span class="miss">Nothing left to cast with.</span>`,
  spellNotKnown: (e) => `<span class="miss">You do not know ${e.spell ?? "that"}.</span>`,
  spellAboveLevel: (e) => `<span class="miss">${e.spell ?? "That"} needs level ${e.need ?? "?"}; you are ${e.have ?? "?"}.</span>`,
  spellSchoolLocked: (e) => `<span class="miss">${e.spell ?? "That"} is not open to you yet.</span>`,
  spellBackfired: (e) => `<span class="hurt">${e.spell ?? "The spell"} goes wrong.</span>`,
  backfireSelfDamage: (e) => `<span class="hurt">It costs you ${e.amount ?? 0} wp.</span>`,
  spellResisted: (e) => `${e.target ?? "It"} shrugs it off. <span class="roll">${e.roll ?? "?"}</span> vs intel ${e.intel ?? "?"}.`,
  resistFailed: (e) => `${e.target ?? "It"} tries to resist and fails. <span class="roll">${e.roll ?? "?"}</span>.`,
  summonBackfired: (e) => `<span class="hurt">The summoning turns on you for ${e.amount ?? 0} wp.</span>`,
  allySummoned: (e) => `<span class="hit">${e.name ?? "Something"} answers the call.</span>`,
  allyPending: (e) => `<span class="beat">${e.name ?? "Something"} is coming, once there is a fight to join.</span>`,
  stunned: (e) => `<span class="hit">${e.count ?? 0} freeze in place.</span>`,
  weakened: () => `<span class="hit">They hit softer now.</span>`,
  stupefied: (e) => `<span class="hit">${e.target ?? "It"} forgets what it is doing.</span>`,
  blinded: (e) => `<span class="hit">${e.target ?? "It"} cannot see a thing.</span>`,
  shrunk: (e) => `<span class="hit">${e.count ?? 0} shrink to half size.</span>`,
  acidApplied: (e) => `${e.target ?? "It"} starts to dissolve. <span class="roll">${e.rounds ?? 0}</span> rounds of it.`,
  earthquake: (e) => `<span class="banner">The floor heaves.</span> <span class="roll">${e.amount ?? 0}</span> to everyone in the room.`,
  earthquakeSelfDamage: (e) => `<span class="hurt">The shaking costs you ${e.amount ?? 0} wp too.</span>`,
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
  insaneStruckAlly: (e) => `The maddened thing turns on ${e.target ?? "an ally"} for <span class="roll">${e.dmg ?? 0}</span> wp.`,
  insaneFled: (e) => `<span class="beat">${e.target ?? "It"} bolts, mad with fear.</span>`,
  healed: (e) => `<span class="hit">+${e.amount ?? 0} wp</span>${e.spell ? ` from ${e.spell}` : ""}.`,
  deathSpellTooWeak: () => `<span class="miss">You are too weak yourself to cast it.</span>`,
  deathCast: () => `<span class="hurt">You spend 25 wp calling on Death itself.</span>`,
  dozed: (e) => `${e.target ?? "It"} dozes off for ${e.rounds ?? 0} rounds.`,
  nothingToThrowAt: () => `<span class="miss">Nothing here to throw it at.</span>`,
  spellThrown: (e) => `${e.spell ?? "It"} at ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
  spellHit: (e) => `<span class="hit">Hit.</span> <span class="roll">${e.dmg ?? 0}</span> wp${(e.mult ?? 1) > 1 ? ` (×${e.mult})` : ""}.`,
  frozenSolid: (e) => `<span class="hit">${e.target ?? "It"} freezes solid.</span>`,
  spellMissed: (e) => `<span class="miss">Missed ${e.target ?? "it"}.</span>`,
  potionDrunk: (e) => `<span class="hit">+${e.amount ?? 0} wp</span> (${plural(e.remaining ?? 0, "potion")} left).`,
  scrollRead: (e) => `You unroll a scroll: ${e.spell ?? "something unreadable"}.`,
  scrollCopiedToGrimoire: (e) => `<span class="hit">${e.spell ?? "It"} copied into your grimoire.</span>`,
  scrollCast: (e) => `The scroll casts itself: ${e.spell ?? "something"}.`,

  /* ---------------- economy.js ---------------- */

  storeOpened: (e) => `<span class="banner">The shop is open.</span>${e.troll ? " (Trolls pay triple.)" : e.elfOrDwarf ? " (A discount, as always.)" : ""}`,
  buyFailed: (e) => `<span class="miss">You are short ${e.short ?? 0} wm.</span>`,
  bought: (e) => `<span class="hit">Bought:</span> ${e.item ?? "something"} for ${e.cost ?? 0} wm.`,
  storeLeft: () => `<span class="beat">You leave the shop.</span>`,

  /* ---------------- encounters.js ---------------- */

  trapAvoided: (e) => `<span class="hit">You see it coming.</span> <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
  trapDisarmed: () => `<span class="hit">A Pilfer's hands know exactly where to be.</span>`,
  trapDoubled: () => `<span class="hurt">Cat Burglar's luck: the trap hits twice as hard.</span>`,
  trapSprung: (e) => `<span class="hurt">${e.name ?? "A trap."}</span> <span class="roll">${e.dmg ?? 0}</span> wp.`,
  trapPoisoned: () => `<span class="hurt">The trap leaves poison in you.</span>`,
  chestOpened: () => `<span class="hit">The chest opens.</span>`,
  chestLockRolled: (e) => `Lock: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
  chestLocked: () => `<span class="miss">The lock holds.</span>`,
  scrollFound: () => `<span class="hit">A scroll.</span>`,
  encounterRolled: (e) => `<span class="roll">Table ${e.table ?? "?"}, roll ${e.roll ?? "?"}:</span> ${e.result ?? "something"}.`,
  tableFour: (e) => `<span class="beat">${e.result ?? "Something happens."}</span>`,
  tableFourNoop: (e) => `<span class="beat">${e.result ?? "Nothing much happens."}</span>`,
  foodFound: (e) => `<span class="hit">${e.name ?? "Food"}</span> (+${e.wp ?? 0} wp).`,
  grimoireSold: () => `You cannot use it, so you sell it.`,
  grimoireLearned: (e) => `<span class="hit">New spells:</span> ${(e.spells ?? []).join(", ") || "nothing new"}.`,
  faerieMet: (e) => `<span class="beat">A faerie appears.</span> ${e.gift ?? "It watches."}.`,
  faerieBoon: (e) => `<span class="hit">+${e.amount ?? 0} base wp.</span>`,
  faerieBane: (e) => `<span class="hurt">−${e.amount ?? 0} base wp.</span>`,
  joinerMet: (e) => `<span class="hit">${e.name ?? "Someone"}</span>, a ${e.sub ?? e.race ?? "stranger"}, joins you for a while.`,
  afflictionRolled: (e) => `Something is wrong with you: <span class="roll">${e.roll ?? "?"}</span>, ${e.kind ?? "unknown"}.`,
  phobiaAcquired: (e) => `<span class="hurt">A new fear settles in: ${e.name ?? "something"}.</span>`,
  afflictionCaught: (e) => `<span class="hurt">${e.kind ?? "It"} takes hold.</span> −${e.first ?? 0} wp.`,
  insanityRolled: (e) => `Insanity: <span class="roll">${e.roll ?? "?"}</span>, ${e.result ?? "something"}.`,
  insanitySelfHarm: () => `<span class="hurt">You turn on yourself.</span>`,
  insanityRage: (e) => `<span class="hurt">Rage: +${e.amount ?? 0} might.</span>`,
  darknessFell: () => `<span class="beat">The dark closes in around you.</span>`,
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
};
