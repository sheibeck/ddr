// src/browser/toasts.js
//
// Phase 25 (Toast architecture) — the pure, testable toast table that sits
// beside src/browser/eventNarration.js's EVENT_NARRATION (the Oracle log).
// TOAST_FOR maps every toasting engine event type to a SHORT
// `(e, ctx) => ({ text, tone, priority })` builder — the summary a player
// glances at; the Oracle line (eventNarration.js) stays the full sentence
// with the roll. 25-03 adds `toastsForAction` (aggregation/priority/cap) on
// top of this table; 25-04 wires the shell; 25-05 adds the coverage/manifest
// guards this file is built to satisfy.
//
// PRESENTATION ONLY, pure module: no DOM access, no `import` from engine/,
// and no Math.random/Date.now anywhere in this file (mirrors missLines.js's
// purity contract; 25-05 adds a standing guard). Every builder defends every
// field with `??`/`?.` so a bare `{ type }` call (the coverage guard's own
// invocation shape, same convention as eventNarration.js) never throws
// (T-25-08).
//
// ORACLE_ONLY is a one-directional allowlist: every engine event type NOT in
// that set gets a TOAST_FOR builder here. Nothing in ORACLE_ONLY ever
// duplicates information a toast already shows more completely — the toast
// is a summary, the Oracle is the record (T-25-10). FEATURE_EVENTS is the
// separate manifest of every class/sub-class/race feature + refusal event
// (25-CONTEXT.md's "Feature manifest" decision) — a strict subset of
// TOAST_FOR's keys, disjoint from ORACLE_ONLY.

/**
 * TONES — the tone-family vocabulary every toast (and the future host CSS,
 * 25-04) speaks. Two color families + two utilities:
 *   - YOU:  `hit` (your good outcome) / `miss` (your action produced nothing)
 *   - THEM: `hurt` (they damaged/afflicted you or yours) / `dodge` (their
 *     turn produced no damage to you: misses, sleeps, heals, summons,
 *     telegraphs)
 *   - `magic` — spells/scrolls/song/items you use and their non-damage
 *     effects
 *   - `block` — refusals, rejections, limits ("couldn't" never looks like
 *     "missed")
 *   - `beat` — neutral information (encounter start, fades, teleports)
 */
export const TONES = Object.freeze(["hit", "miss", "hurt", "dodge", "magic", "block", "beat"]);

/**
 * PRIORITY — toast ordering (25-03's aggregator sorts ascending, then caps
 * at MAX_TOASTS): refusals/blocks first, then your outcome, then the enemy's
 * outcome, then feature call-outs, then everything else.
 */
export const PRIORITY = Object.freeze({ block: 0, you: 1, them: 2, feature: 3, other: 4 });

/** MAX_TOASTS — the host's visible cap (up from the prior hard-coded 3). */
export const MAX_TOASTS = 4;

/**
 * ORACLE_ONLY — bookkeeping event types that already have a dedicated
 * screen, HUD field, prompt, or are pure step/roll detail whose outcome
 * sibling always follows. These get NO toast entry; the Oracle never loses
 * information a toast shows (a toast is a summary, the Oracle is the
 * record — T-25-10). Any addition must carry a reason and obey the same
 * principle: never a feature, refusal, outcome, spell, or ability event.
 */
export const ORACLE_ONLY = new Set([
  "moved", // a plain step is already silent by design (engineAdapter.js) — not in the 209-type toast universe either
  "dayBegan", // the HUD's day counter already shows this
  "floorChanged", // the HUD's depth banner already shows this
  "spellChargeRecovered", // the grimoire/HUD charge display already shows this
  "spGained", // pure XP bookkeeping; foeKilled/parleyRolled toast the outcome that earned it
  "combatEnded", // the combat screen closing IS the signal
  "died", // dedicated death/epitaph screen
  "won", // dedicated victory banner
  "storeLeft", // the store screen closing IS the signal
  "encounterRolled", // internal table-roll bookkeeping; tableFour/tableFourNoop narrate the outcome
  "tableFour", // dedicated over-map encounter overlay already narrates this
  "tableFourNoop", // dedicated over-map encounter overlay already narrates this
  "findOffered", // the dedicated Take it/Leave it prompt IS the UI
  "findTaken", // the dedicated Take it/Leave it prompt IS the UI
  "findLeft", // the dedicated Take it/Leave it prompt IS the UI
  "itemDropped", // the inventory screen's own drop action is the UI signal
  "itemUnequipped", // the inventory screen's own unequip action is the UI signal
  "joinerMet", // the dedicated Joiner recruitment prompt IS the UI
  "faerieMet", // the dedicated faerie encounter prompt IS the UI; faerieBoon/faerieBane toast the real outcome
  "grimoireSold", // the sell-flow's own confirmation is the UI signal
  "itemConsumed", // pure bookkeeping (a charge spent); the effect event itself already toasted
]);

/**
 * FEATURE_EVENTS — every class/sub-class/race feature event and every
 * refusal/rejection event (25-CONTEXT.md's "Feature manifest" decision).
 * 25-05 proves this is a subset of TOAST_FOR's keys, disjoint from
 * ORACLE_ONLY, and covers every name test/unit/identity-contract.test.js
 * asserts.
 */
export const FEATURE_EVENTS = [
  "frenzy",
  "warlockBoost",
  "foeFled",
  "foeBored",
  "backstab",
  "silenceStrike",
  "stealthStrike",
  "ninjaFirstStrike",
  "conArtistOpener",
  "deathTouch",
  "goldGained",
  "trapDisarmed",
  "trapDoubled",
  "chestOpened",
  "chestLockRolled",
  "potionDuplicated",
  "rested",
  "potionDrunk",
  "armorPatched",
  "armorSoaked",
  "summonBackfired",
  "spellBackfired",
  "allySummoned",
  "allyPending",
  "phobiaFrozen",
  "shookOffFrozen",
  "encounterStarted",
  "encounterCleared",
  "wanderingMonster",
  "joinerRefused",
  "storeOpened",
  "sang",
  "beastsSoothed",
  "songIgnored",
  "lullabyRolled",
  "thunderRolled",
  "cooked",
  "healed",
  "struck",
  "strikeMissed",
  "struckByFoe",
  "foeMissed",
  "fled",
  "fleeRolled",
  "trapSprung",
  // Refusals
  "strikeRefused",
  "fleeRefused",
  "parleyRefused",
  "withdrawalDenied",
  "vanishDenied",
  "itemRejected",
  "equipRejected",
  "useRefused",
  "scrollRefused",
  "noChargesLeft",
  "spellNotKnown",
  "spellAboveLevel",
  "spellSchoolLocked",
  "campFailed",
  "buyFailed",
  "backstabDenied",
];

// ─── Shared helpers (mirrors eventNarration.js's soakedText/needMods pattern) ─

/** block(text) — every refusal/rejection is amber, priority 0, voiced. */
function block(text) {
  return { text, tone: "block", priority: PRIORITY.block };
}

/** soakParts(soaked) — ["Hardiness 3", "hide 2", "ward 1"], only present keys. */
function soakParts(soaked) {
  if (!soaked) return [];
  const parts = [];
  if (soaked.hardiness) parts.push(`Hardiness ${soaked.hardiness}`);
  if (soaked.hide) parts.push(`hide ${soaked.hide}`);
  if (soaked.ward) parts.push(`ward ${soaked.ward}`);
  return parts;
}

/** soakSuffix(soaked) — " · hide 2, ward 1 soaked" or "". */
function soakSuffix(soaked) {
  const parts = soakParts(soaked);
  return parts.length ? ` · ${parts.join(", ")} soaked` : "";
}

const CRIT_BY_TEXT = { silence: "silence", stealth: "stealth", backstab: "backstab", ninja: "ninja", cutthroat: "Cutthroat" };

const EQUIP_REJECT_TEXT = {
  wrongClass: "Not for the likes of you.",
  notBetter: "Not an upgrade.",
  noArmor: "Fridgians wear no armour.",
  woodsman: "No mail for a Woodsman.",
  tooHeavy: "Too heavy to carry.",
  acrobat: "An Acrobat carries a dagger. Only a dagger.",
  notEquippable: "That does not equip.",
};
function equipRejectText(e) {
  return EQUIP_REJECT_TEXT[e?.reason] ?? "Not for the likes of you.";
}

export const TOAST_FOR = {
  /* ---------------- movement.js ---------------- */

  oneWayBlocked: (e) => ({
    text: e?.side === "approach" ? "That door works once — already used." : "That door is furniture now.",
    tone: "beat",
    priority: PRIORITY.other,
  }),
  climbedOver: () => ({ text: "Over, and no worse for it.", tone: "hit", priority: PRIORITY.other }),
  leaptOver: () => ({ text: "Cleared it. No drama.", tone: "hit", priority: PRIORITY.other }),
  flownOver: () => ({ text: "You simply fly over it.", tone: "hit", priority: PRIORITY.other }),
  phasedThrough: () => ({ text: "You step through it like a rumour of a wall.", tone: "hit", priority: PRIORITY.other }),
  fellClimbing: (e) => ({ text: `You fall (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  fellInGorge: (e) => ({ text: `Short — the crevice introduces itself (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  heightsFear: () => ({ text: "Your stomach reaches the ground first.", tone: "hurt", priority: PRIORITY.other }),
  waterFear: () => ({ text: "Something down there may be wet.", tone: "hurt", priority: PRIORITY.other }),
  trappedPanic: (e) => ({ text: `Four walls, one used door (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  afflictionTick: (e) => ({ text: `${e?.kind ?? "It"} (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  afflictionPassed: (e) => ({ text: `The ${e?.kind ?? "worst of it"} passes.`, tone: "hit", priority: PRIORITY.other }),
  afflictionCured: (e) => ({ text: `Cured of the ${e?.kind ?? "sickness"}.`, tone: "hit", priority: PRIORITY.other }),
  afflictionLingers: (e) => ({ text: `The ${e?.kind ?? "sickness"} lingers.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 25 (FEED-01): `doubled` names the Soldier/heal2x race when the camp
  // heal was doubled; absent renders the plain amount only.
  rested: (e) => ({
    text: `Camp +${e?.amount ?? 0} hp${e?.doubled ? ` · ${e.doubled}, doubled` : ""}`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  cloakHealed: (e) => ({ text: `Cloak mends +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.other }),
  cloakRegenerated: (e) => ({ text: `Flesh knits +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.other }),
  armorPatched: (e) => ({ text: `${e?.by ?? "Mending"}: +${e?.amount ?? 0} armour.`, tone: "hit", priority: PRIORITY.feature }),
  potionDuplicated: () => ({ text: "Warlock: +1 potion.", tone: "magic", priority: PRIORITY.feature }),
  wentHungry: (e) => ({ text: `No rations (−${e?.cost ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  wanderingMonster: (e) => ({
    text: `Camp disturbed.${e?.bard ? " · Bard: the singing carried" : ""}`,
    tone: "hurt",
    priority: PRIORITY.feature,
  }),
  campFailed: () => block("Not enough food to make camp."),
  teleported: () => ({ text: "You teleport to an unknown location.", tone: "beat", priority: PRIORITY.other }),
  leveled: (e) => ({ text: `Skill level ${e?.level ?? "?"} (+${e?.wpGain ?? 0} hp).`, tone: "hit", priority: PRIORITY.feature }),

  /* ---------------- combat.js ---------------- */

  trackingRolled: (e) => ({
    text: e?.tracked ? "You clock them first." : "They keep their lead.",
    tone: "beat",
    priority: PRIORITY.other,
  }),
  // Phase 24 (IDENT-05): the never-first flag clauses append, unflagged text unchanged.
  encounterStarted: (e) => {
    const names = (e?.foes ?? []).map((f) => f?.name).filter(Boolean).join(", ") || "something";
    let text = `${e?.wandering ? "Wandering: " : ""}${names}`;
    if (e?.knightBigFoe) text += " · big foe, the Knight waits";
    if (e?.samuraiNeverFirst) text += " · a Samurai never strikes first";
    if (e?.fridgianSlow) text += " · you strike last";
    if (e?.courtMageTalksFirst) text += " · you talk first, they act first";
    if (e?.acuteHearing) text += " · you heard them coming";
    return { text, tone: "beat", priority: PRIORITY.feature };
  },
  trackable: () => ({ text: "Unnoticed — you could slip away.", tone: "beat", priority: PRIORITY.feature }),
  allyJoined: (e) => ({ text: `${e?.name ?? "An ally"} falls in beside you.`, tone: "hit", priority: PRIORITY.feature }),
  warlockBoost: (e) => ({ text: `The dead stiffen (+${e?.amount ?? 0} hp each).`, tone: "hurt", priority: PRIORITY.feature }),
  foeFled: (e) => {
    const map = {
      knight: `${e?.name ?? "It"} flees a Knight.`,
      conArtist: `${e?.name ?? "It"} talked out of it.`,
      lowHp: `${e?.name ?? "It"} runs.`,
    };
    return { text: map[e?.reason] ?? `${e?.name ?? "It"} flees.`, tone: "hit", priority: PRIORITY.feature };
  },
  foeBored: (e) => ({ text: `${e?.name ?? "It"} loses interest.`, tone: "hit", priority: PRIORITY.feature }),
  encounterCleared: () => ({ text: "Nothing left standing.", tone: "hit", priority: PRIORITY.feature }),
  phobiaFrozen: () => ({ text: "Frozen by fear.", tone: "hurt", priority: PRIORITY.feature }),
  combatInDark: () => ({ text: "You cannot see what you are fighting.", tone: "beat", priority: PRIORITY.feature }),
  // Phase 23 (IDENT-01): names the attack spell the Wizard should cast instead, when supplied.
  strikeRefused: (e) =>
    e?.reason === "wizard"
      ? block(e?.spell ? `Wizards don't punch. Cast ${e.spell}.` : "Wizards don't punch while a spell remains.")
      : block("You hold back."),
  shookOffFrozen: () => ({ text: "You shake it off.", tone: "hit", priority: PRIORITY.feature }),
  frenzy: () => ({ text: "Frenzy — two wild swings.", tone: "hit", priority: PRIORITY.feature }),
  // Phase 25 (FEED-05): untouchable never gets a quip (decorateMisses skips
  // it); `quip` renders after an em-dash only when present.
  strikeMissed: (e) =>
    e?.untouchable
      ? { text: `You cannot touch ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }
      : { text: `You miss ${e?.target ?? "it"}${e?.quip ? ` — ${e.quip}` : ""}`, tone: "miss", priority: PRIORITY.you },
  deathTouch: (e) => ({ text: `One touch — ${e?.target ?? "it"} drops.`, tone: "hit", priority: PRIORITY.feature }),
  backstabDenied: () => block("Heavy armour gave you away."),
  silenceStrike: () => ({ text: "Silent strike — critical.", tone: "hit", priority: PRIORITY.feature }),
  stealthStrike: () => ({ text: "Unseen strike — critical.", tone: "hit", priority: PRIORITY.feature }),
  backstab: () => ({ text: "Backstab — critical.", tone: "hit", priority: PRIORITY.feature }),
  conArtistOpener: () => ({ text: "Con Artist opener: all flourish, no damage.", tone: "miss", priority: PRIORITY.feature }),
  ninjaFirstStrike: () => ({ text: "One perfect opening strike.", tone: "hit", priority: PRIORITY.feature }),
  // Phase 25 (FEED-01): `critBy` names the reason for the CRIT suffix.
  struck: (e) => {
    const crit = e?.critical ? " · CRIT" : "";
    const reason = e?.critical && CRIT_BY_TEXT[e?.critBy] ? ` (${CRIT_BY_TEXT[e.critBy]})` : "";
    return { text: `You hit ${e?.target ?? "it"} (${e?.dmg ?? 0})${crit}${reason}`, tone: "hit", priority: PRIORITY.you };
  },
  foeRevived: (e) => ({ text: `${e?.name ?? "It"} gets back up.`, tone: "dodge", priority: PRIORITY.them }),
  foeKilled: (e) => ({ text: `${e?.name ?? "It"} falls (+${e?.spGained ?? 0} XP).`, tone: "hit", priority: PRIORITY.you }),
  cooked: (e) => ({
    text: (e?.wp ?? 0) > 0 ? `Cooked: +${e.wp} hp, +${e?.rations ?? 1} ration.` : `Salvaged +${e?.rations ?? 1} ration.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  fleeRefused: () => block("A Samurai does not run."),
  withdrawalDenied: () => block("Slipping away untouched would mean not attacking."),
  vanishDenied: () => block("They have already seen your face."),
  fled: (e) => {
    const map = { cloaker: "You vanish — clean escape.", tracked: "You slip away before it sees you." };
    return { text: map[e?.reason] ?? "You get clear.", tone: "hit", priority: PRIORITY.you };
  },
  fleeRolled: (e) => ({ text: `Flee: ${e?.roll ?? "?"}+${e?.bonus ?? 0} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
  fleeFailed: () => ({ text: "You do not make it.", tone: "miss", priority: PRIORITY.you }),
  parleyRefused: (e) => {
    const map = {
      ninja: "A Ninja does not negotiate.",
      masterOfArms: "A Master of Arms has one answer, and it is not a sentence.",
      walkingDead: "The Walking Dead do not parley.",
      magical: "Magic Users do not parley with you.",
      wilmsryVsMagical: "Magic Users hate the Wilmsry. There is nothing to discuss.",
      tried: "You already tried that.",
    };
    return block(map[e?.reason] ?? "Not this time, not with them.");
  },
  parleyRolled: (e) => ({ text: `Talk it down: ${e?.roll ?? "?"} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
  parleyInsulted: () => ({ text: "You have made it personal.", tone: "hurt", priority: PRIORITY.them }),
  parleyExhausted: () => block("You already said your piece."),
  goldGained: (e) => {
    const suffix = e?.why === "pickpocket" ? " (Pickpocket)" : e?.why === "parley" ? " (parley)" : "";
    return { text: `+${e?.amount ?? 0} wilmst${suffix}`, tone: "hit", priority: PRIORITY.feature };
  },
  parleyFailed: () => ({ text: "They are not buying it.", tone: "miss", priority: PRIORITY.you }),
  sang: (e) => ({ text: `You sing ${e?.song ?? "a tune"}.`, tone: "magic", priority: PRIORITY.feature }),
  beastsSoothed: (e) => ({ text: `${e?.count ?? 0} stand down.`, tone: "hit", priority: PRIORITY.feature }),
  songIgnored: () => ({ text: "They do not care for music.", tone: "miss", priority: PRIORITY.feature }),
  lullabyRolled: (e) => ({ text: `${e?.n ?? 0} nod off.`, tone: "magic", priority: PRIORITY.feature }),
  thunderRolled: (e) => ({ text: `Thunder rolls — ${e?.n ?? 0} freeze (${e?.r ?? 0}).`, tone: "magic", priority: PRIORITY.feature }),
  allyStruck: (e) => ({ text: `${e?.name ?? "Your ally"} lands a hit on ${e?.target ?? "it"} (${e?.dmg ?? 0}).`, tone: "hit", priority: PRIORITY.feature }),
  allyMissed: (e) => ({ text: `${e?.name ?? "Your ally"} swings and misses.`, tone: "miss", priority: PRIORITY.feature }),
  allyDeparted: (e) => ({ text: `${e?.name ?? "Your ally"} slips away, obligation met.`, tone: "beat", priority: PRIORITY.feature }),
  // Phase 25 (FEED-01): `needMods` names the reason a swing that should have
  // landed did not — only when the roll would have hit without the modifier.
  memberStruck: (e) => {
    const crit = e?.critical ? " · CRIT" : "";
    return { text: `${e?.name ?? "It"} hits ${e?.member ?? "your companion"} (${e?.dmg ?? 0})${crit}`, tone: "hurt", priority: PRIORITY.feature };
  },
  memberDowned: (e) => ({ text: `${e?.name ?? "Your companion"} goes down.`, tone: "hurt", priority: PRIORITY.feature }),
  regenerated: (e) => ({ text: `+${e?.amount ?? 0} hp knits shut.`, tone: "hit", priority: PRIORITY.you }),
  acidTick: (e) => ({ text: `Acid eats at ${e?.target ?? "it"} (${e?.dmg ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  foeSlept: (e) => ({ text: `${e?.name ?? "It"} sleeps through it.`, tone: "dodge", priority: PRIORITY.them }),
  foeMissed: (e) => {
    const mods = e?.needMods ?? [];
    const negative = mods.filter((m) => m.delta < 0);
    const negSum = negative.reduce((sum, m) => sum + m.delta, 0);
    const wouldHaveHit = negative.length > 0 && e?.roll != null && e?.need != null && e.roll <= e.need - negSum;
    let text = `${e?.name ?? "It"} misses ${e?.member ?? "you"}`;
    if (wouldHaveHit) text += ` · ${negative.map((m) => m.name).join(", ")}`;
    return { text, tone: "dodge", priority: e?.member ? PRIORITY.feature : PRIORITY.them };
  },
  wardReflected: (e) => ({ text: `The ward throws ${e?.amount ?? 0} back.`, tone: "hit", priority: PRIORITY.them }),
  wardAbsorbed: (e) => ({ text: `The ward eats ${e?.amount ?? 0} (${e?.remaining ?? 0} left).`, tone: "hit", priority: PRIORITY.them }),
  wardShattered: () => ({ text: "The ward shatters.", tone: "hurt", priority: PRIORITY.them }),
  armorDestroyed: () => ({ text: "Your armour gives out.", tone: "hurt", priority: PRIORITY.them }),
  // Phase 25 (FEED-01): `wear` is the real durability cost; `halved` names the Dwarven mitigation.
  armorSoaked: (e) => ({
    text: `Armour takes ${e?.amount ?? 0}${e?.wear ? ` · wear ${e.wear}` : ""}${e?.halved ? " (Dwarven, halved)" : ""}`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  foeArmorSoaked: (e) => ({ text: `${e?.name ?? "It"}'s armour shrugs it off.`, tone: "miss", priority: PRIORITY.them }),
  damageHalved: (e) => ({ text: `The pendant halves ${e?.name ?? "that"}'s blow.`, tone: "hit", priority: PRIORITY.them }),
  // Phase 25 (FEED-01): `soldierCrit` renders exactly like `critical`;
  // `soaked` names what absorbed the blow.
  struckByFoe: (e) => {
    const crit = e?.critical || e?.soldierCrit ? " · CRIT" : "";
    return { text: `${e?.name ?? "It"} hits you (${e?.dmg ?? 0})${crit}${soakSuffix(e?.soaked)}`, tone: "hurt", priority: PRIORITY.them };
  },
  wardFaded: () => ({ text: "The ward fades.", tone: "beat", priority: PRIORITY.other }),
  mirrorFaded: () => ({ text: "The mirror fades.", tone: "beat", priority: PRIORITY.other }),

  /* ---------------- foe abilities (engine/foeAbilities.js) ---------------- */

  foeCast: (e) => ({ text: `${e?.name ?? "It"}: ${e?.txt ?? "something unpleasant"}`, tone: "dodge", priority: PRIORITY.them }),
  foeBolted: (e) => {
    const suffix = soakSuffix(e?.soaked);
    return e?.member
      ? { text: `${e?.name ?? "It"} bolts ${e.member} (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.feature }
      : { text: `${e?.name ?? "It"} bolts you (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.them };
  },
  foeDrained: (e) => ({ text: `${e?.name ?? "It"} drains you (+${e?.stolen ?? 0} to it).`, tone: "hurt", priority: PRIORITY.them }),
  foeDebuffed: (e) => ({ text: `${e?.name ?? "It"}: you are ${e?.kind ?? "afflicted"} (${e?.rounds ?? "?"}).`, tone: "hurt", priority: PRIORITY.them }),
  foeHealed: (e) => ({ text: `${e?.name ?? "It"} heals (+${e?.amount ?? 0}).`, tone: "dodge", priority: PRIORITY.them }),
  foeSummoned: (e) => ({
    text: e?.pending ? `${e?.by ?? e?.name ?? "It"} calls for help.` : `${e?.name ?? "Something"} joins the fight.`,
    tone: "dodge",
    priority: PRIORITY.them,
  }),
  foeEffectFaded: (e) => ({ text: e?.kind === "dazed" ? "You are no longer dazed." : "Your strength comes back.", tone: "hit", priority: PRIORITY.you }),
  heroResisted: (e) => ({ text: `You resist ${e?.name ?? "its"}'s spell.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 25 (FEED-03): starts with the foe's name (matches the THEM-family
  // tone-prefix contract every other foe-action builder follows).
  heroResistFailed: (e) => ({ text: `${e?.name ?? "It"} gets through — you fail to resist.`, tone: "hurt", priority: PRIORITY.them }),
  foePursued: (e) => ({ text: `${e?.name ?? "It"} follows you out.`, tone: "hurt", priority: PRIORITY.them }),
  foeOutOfSpells: (e) => ({ text: `${e?.name ?? "It"} is out of spells.`, tone: "dodge", priority: PRIORITY.them }),

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => block("Nothing left to cast with."),
  spellNotKnown: (e) => block(`You do not know ${e?.spell ?? "that"}.`),
  spellAboveLevel: (e) => block(`${e?.spell ?? "That"} needs level ${e?.need ?? "?"}; you are ${e?.have ?? "?"}.`),
  spellSchoolLocked: (e) => block(`${e?.spell ?? "That"} is not open to you yet.`),
  spellBackfired: (e) => ({ text: `${e?.spell ?? "The spell"} goes wrong.`, tone: "hurt", priority: PRIORITY.you }),
  backfireSelfDamage: (e) => ({ text: `It costs you ${e?.amount ?? 0} hp.`, tone: "hurt", priority: PRIORITY.you }),
  spellResisted: (e) => ({ text: `${e?.target ?? "It"} resists ${e?.spell ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  resistFailed: (e) => ({ text: `${e?.target ?? "It"} fails to resist.`, tone: "hit", priority: PRIORITY.you }),
  summonBackfired: (e) => ({ text: `The summoning costs you ${e?.amount ?? 0} hp.`, tone: "hurt", priority: PRIORITY.you }),
  allySummoned: (e) => ({ text: `${e?.name ?? "Something"} answers the call.`, tone: "magic", priority: PRIORITY.you }),
  allyPending: (e) => ({ text: `${e?.name ?? "Something"} is coming.`, tone: "magic", priority: PRIORITY.you }),
  stunned: (e) => ({ text: `${e?.count ?? 0} freeze in place.`, tone: "magic", priority: PRIORITY.you }),
  weakened: () => ({ text: "They hit softer now.", tone: "magic", priority: PRIORITY.you }),
  stupefied: (e) => ({ text: `${e?.target ?? "It"} forgets what it is doing.`, tone: "magic", priority: PRIORITY.you }),
  blinded: (e) => ({ text: `${e?.target ?? "It"} cannot see a thing.`, tone: "magic", priority: PRIORITY.you }),
  shrunk: (e) => ({ text: `${e?.count ?? 0} shrink to half size.`, tone: "magic", priority: PRIORITY.you }),
  acidApplied: (e) => ({ text: `${e?.target ?? "It"} starts to dissolve (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  earthquake: (e) => ({ text: `The floor heaves (${e?.amount ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  earthquakeSelfDamage: (e) => ({ text: `The shaking costs you ${e?.amount ?? 0} hp too.`, tone: "hurt", priority: PRIORITY.you }),
  vaporRolled: (e) => ({ text: `Noxious vapor (${e?.roll ?? "?"}).`, tone: "magic", priority: PRIORITY.other }),
  volley: (e) => ({ text: `${e?.rolls ?? 0} shots, ${e?.totalDamage ?? 0} total.`, tone: "magic", priority: PRIORITY.you }),
  petrified: (e) => ({ text: `${e?.target ?? "It"} turns to stone.`, tone: "magic", priority: PRIORITY.you }),
  walkingDeadTurned: (e) => ({ text: `${e?.count ?? 0} of the dead flee.`, tone: "magic", priority: PRIORITY.you }),
  nothingToTurn: () => block("Nothing here to turn."),
  planeGated: (e) => ({ text: `${e?.count ?? 0} gated straight back out.`, tone: "magic", priority: PRIORITY.you }),
  gateRefused: () => block("There is no plane here worth opening."),
  sensesGained: () => ({ text: "Your senses sharpen.", tone: "magic", priority: PRIORITY.you }),
  detectMagic: () => ({ text: "The floor lights up.", tone: "magic", priority: PRIORITY.you }),
  senseDanger: (e) => ({ text: `Bad feeling about the ${e?.nextEncounter ?? "next encounter"}.`, tone: "magic", priority: PRIORITY.you }),
  mirrorSelf: (e) => ({ text: `A mirror image holds (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  wardRaised: (e) => ({ text: `${e?.spell ?? "The ward"} raises a ward (${e?.pool ?? 0})${e?.reflect ? ", reflecting" : ""}.`, tone: "magic", priority: PRIORITY.you }),
  strengthCast: (e) => ({ text: `Might surges +${e?.might ?? 0}.`, tone: "magic", priority: PRIORITY.you }),
  regenerationCast: () => ({ text: "Wounds start closing on their own.", tone: "magic", priority: PRIORITY.you }),
  insaneNoTarget: () => block("No one here to turn insane at."),
  insaneRolled: (e) => ({ text: `Insanity takes ${e?.target ?? "it"}.`, tone: "magic", priority: PRIORITY.other }),
  insaneStruckAlly: (e) => ({ text: `The maddened thing turns on ${e?.target ?? "an ally"} (${e?.dmg ?? 0}).`, tone: "hurt", priority: PRIORITY.you }),
  insaneFled: (e) => ({ text: `${e?.target ?? "It"} bolts, mad with fear.`, tone: "magic", priority: PRIORITY.you }),
  healed: (e) => ({ text: `+${e?.amount ?? 0} hp${e?.spell ? ` (${e.spell})` : ""}.`, tone: "hit", priority: PRIORITY.you }),
  deathSpellTooWeak: () => block("You are too weak yourself to cast it."),
  deathCast: () => ({ text: "You spend 25 hp calling on Death.", tone: "hurt", priority: PRIORITY.you }),
  dozed: (e) => ({ text: `${e?.target ?? "It"} dozes off (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  nothingToThrowAt: () => block("Nothing here to throw it at."),
  spellThrown: (e) => ({ text: `${e?.spell ?? "It"} at ${e?.target ?? "it"}.`, tone: "magic", priority: PRIORITY.you }),
  spellHit: (e) => ({
    text: `${e?.spell ?? "It"} hits ${e?.target ?? "it"} (${e?.dmg ?? 0})${(e?.mult ?? 1) > 1 ? ` ×${e.mult}` : ""}`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  frozenSolid: (e) => ({ text: `${e?.target ?? "It"} frozen solid.`, tone: "magic", priority: PRIORITY.you }),
  spellMissed: (e) => ({ text: `${e?.spell ?? "It"} misses ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  // Phase 25 (FEED-01): `doubled` names the heal2x race when the dose was doubled.
  potionDrunk: (e) => ({
    text: `Potion +${e?.amount ?? 0} hp (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  scrollRead: (e) => ({ text: `You unroll: ${e?.spell ?? "something unreadable"}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 25 (FEED-02): a scroll refusal always names its reason; unknown/
  // absent reason still gets a voiced fallback.
  scrollRefused: (e) => {
    const map = { pilfer: "A Pilfer's hands know locks, not letters.", noRunes: "The runes mean nothing to you.", noScrolls: "You have no scroll to read." };
    return block(map[e?.reason] ?? "It stays rolled.");
  },
  scrollCopiedToGrimoire: (e) => ({ text: `${e?.spell ?? "It"} copied into your grimoire.`, tone: "magic", priority: PRIORITY.you }),
  scrollCast: (e) => ({ text: `The scroll casts: ${e?.spell ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),

  /* ---------------- economy.js ---------------- */

  storeOpened: (e) => {
    let text = "Shop open.";
    let tone = "beat";
    if (e?.pickpocket) {
      text += " · Pickpocket: buys ×1.25, sells ×0.75";
      tone = "block";
    } else if (e?.troll) {
      text += " (Trolls pay triple)";
    } else if (e?.elfOrDwarf) {
      text += " (a discount, as always)";
    }
    return { text, tone, priority: PRIORITY.feature };
  },
  buyFailed: (e) => block(`Short ${e?.short ?? 0} wilmst.`),
  bought: (e) => ({ text: `Bought: ${e?.item ?? "something"} (${e?.cost ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),
  rationsBought: (e) => ({ text: `Stocked up: +${e?.amount ?? 1} rations.`, tone: "hit", priority: PRIORITY.other }),
  itemSold: (e) => ({ text: `Sold: ${e?.item?.n ?? "something"} (${e?.price ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),

  /* ---------------- encounters.js ---------------- */

  trapAvoided: (e) => ({ text: `You clock it early (${e?.roll ?? "?"} vs ${e?.need ?? "?"}).`, tone: "hit", priority: PRIORITY.other }),
  trapDisarmed: () => ({ text: "Pilfer: trap disarmed.", tone: "hit", priority: PRIORITY.feature }),
  trapDoubled: () => ({ text: "Cat Burglar: the trap hits twice as hard.", tone: "hurt", priority: PRIORITY.feature }),
  trapSprung: (e) => ({ text: `${e?.name ?? "A trap"} (${e?.dmg ?? 0}).`, tone: "hurt", priority: PRIORITY.them }),
  trapPoisoned: () => ({ text: "The trap leaves something behind.", tone: "hurt", priority: PRIORITY.other }),
  chestOpened: (e) => ({
    text: e?.reason === "pilfer" ? "Pilfer: box open, no lock roll." : "The box gives up its secrets.",
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  chestLockRolled: (e) => ({ text: `Lock: ${e?.roll ?? "?"} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
  chestLocked: () => ({ text: "The lock wins this round.", tone: "miss", priority: PRIORITY.other }),
  scrollFound: () => ({ text: "A scroll, tucked in with the loot.", tone: "hit", priority: PRIORITY.other }),
  foodFound: (e) => ({ text: `${e?.name ?? "Food"} (+${e?.wp ?? 0} hp).`, tone: "hit", priority: PRIORITY.other }),
  grimoireLearned: (e) => ({ text: `New spells: ${(e?.spells ?? []).join(", ") || "nothing new"}.`, tone: "hit", priority: PRIORITY.other }),
  faerieBoon: (e) => ({ text: `+${e?.amount ?? 0} base hp.`, tone: "hit", priority: PRIORITY.other }),
  faerieBane: (e) => ({ text: `−${e?.amount ?? 0} base hp.`, tone: "hurt", priority: PRIORITY.other }),
  joinerJoined: (e) => ({ text: `${e?.name ?? "Someone"} falls in beside you.`, tone: "hit", priority: PRIORITY.feature }),
  joinerDeclined: (e) => ({ text: `You wave ${e?.name ?? "them"} off.`, tone: "beat", priority: PRIORITY.feature }),
  joinerRefused: (e) => {
    const map = {
      cutthroat: `${e?.name ?? "The Joiner"} wants no part of a Cutthroat.`,
      wilmsry: `${e?.name ?? "The Joiner"} takes one look at a Wilmsry and leaves.`,
    };
    return block(map[e?.reason] ?? "Word has reached the Joiners.");
  },
  afflictionRolled: (e) => ({ text: `Something is wrong with you: ${e?.kind ?? "it has its hooks in you"}.`, tone: "hurt", priority: PRIORITY.other }),
  phobiaAcquired: (e) => ({ text: `New fear: ${e?.name ?? "something"}.`, tone: "hurt", priority: PRIORITY.other }),
  afflictionCaught: (e) => ({ text: `${e?.kind ?? "It"} takes hold (−${e?.first ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  insanityRolled: (e) => ({ text: `Insanity — ${e?.result ?? "it comes apart"}.`, tone: "hurt", priority: PRIORITY.other }),
  insanitySelfHarm: () => ({ text: "You turn on yourself.", tone: "hurt", priority: PRIORITY.other }),
  insanityRage: (e) => ({ text: `Rage: +${e?.amount ?? 0} might.`, tone: "hurt", priority: PRIORITY.other }),
  darknessFell: () => ({ text: "The dark closes in.", tone: "hurt", priority: PRIORITY.other }),
  darknessLifted: () => ({ text: "The dark loosens its grip.", tone: "hit", priority: PRIORITY.other }),
  darknessDispelled: () => ({ text: "Your amulet burns the dark away.", tone: "hit", priority: PRIORITY.other }),
  miscMagicRolled: (e) => ({ text: `Miscellaneous magic: ${e?.what ?? "something"}.`, tone: "beat", priority: PRIORITY.other }),

  /* ---------------- items.js / inventory actions ---------------- */

  itemGiven: (e) => ({ text: `Received: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.other }),
  // Phase 24/25: woodsman and acrobat each get their own reason; the generic
  // fallback covers wrongClass/notBetter/noArmor/tooHeavy/notEquippable.
  itemRejected: (e) => block(equipRejectText(e)),
  itemTaken: (e) => ({ text: `Equipped: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.other }),
  itemUsed: (e) => ({ text: `You use ${e?.item?.n ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),
  useRefused: (e) => block(e?.reason === "pilfer" ? `${e?.item?.n ?? "That"} does not heal. Pilfers use only healing.` : "That does not work for you."),
  cured: (e) => ({ text: `Cured of ${e?.kind ?? "it"}.`, tone: "hit", priority: PRIORITY.you }),
  itemBurned: (e) => ({ text: `${e?.total ?? 0} fire damage spread.`, tone: "magic", priority: PRIORITY.you }),
  itemFizzled: () => ({ text: "Nothing happens.", tone: "miss", priority: PRIORITY.you }),
  bagFull: () => block("No room in the bag."),
  itemEquipped: (e) => ({ text: `Equipped: ${e?.item?.n ?? "something"}${e?.slot ? ` (${e.slot})` : ""}.`, tone: "hit", priority: PRIORITY.other }),
  equipRejected: (e) => block(equipRejectText(e)),
};
