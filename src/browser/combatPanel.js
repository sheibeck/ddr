// src/browser/combatPanel.js
//
// Phase 34 (CSCR-01/02/03/06) — the foe-card, YOUR LOT, header and MAJOR
// OVERLAY (encounter gate) view-models. Chip text arrives through
// `opts.chipsFor` so the shell's own `foeStatusBadges` stays the ONE chip
// source (this module never re-derives condition chips).
//
// PRESENTATION ONLY, pure module: no DOM/global access, no timers, no
// storage, no mutation of `state` anywhere in this file.

import { ENC_TYPES } from "../../content/bestiary.js";
import { maxCharges } from "../../engine/movement.js";

/** COMBAT_PANEL_COPY — every literal string this module emits (voice-scanned by test/unit/combatPanel.test.js). */
export const COMBAT_PANEL_COPY = Object.freeze({
  header: "ENCOUNTER",
  aimMany: "TAP A FOE TO AIM AT IT",
  aimOne: "ONE LEFT. AIM IS SIMPLE.",
  theyFirst: "THEY STRIKE FIRST",
  youFirst: "YOU STRIKE FIRST",
  notRolled: "INITIATIVE NOT YET ROLLED",
  lotParty: "YOUR LOT · EACH ROLLS THEIR OWN",
  lotSolo: "JUST YOU · NOBODY TO BLAME",
  target: "TARGET",
  down: "DOWN",
  allyThird: "SUMMONED · FIGHTS FOR YOU",
  oneHere: "SOMETHING IS HERE",
  manyHere: "THEY ARE ALREADY HERE",
  fight: "FIGHT IT OUT",
  encounterRoll: "encounter table d8, then d10",
  noticed: "They have noticed you.",
  unnoticed: "They have not noticed you yet.",
});

/** FOE_GLYPHS — the foe-card icon per encounter-table type, plus a fallback. */
export const FOE_GLYPHS = Object.freeze({
  Beasts: "◆",
  "Lair Beasts": "◈",
  Demons: "▲",
  Humans: "●",
  Magical: "✦",
  "Walking Dead": "☗",
  default: "●",
});

const pctFor = (wp, max) => (max > 0 ? Math.round(Math.max(0, Math.min(100, (wp / max) * 100))) : 0);

/** combatHeaderViewModel(state) — { label, round, standing }. */
export function combatHeaderViewModel(state) {
  const C = state.combat || { round: 1, foes: [] };
  const alive = (C.foes || []).filter((f) => f.alive).length;
  return { label: COMBAT_PANEL_COPY.header, round: `ROUND ${C.round}`, standing: `${alive} STANDING` };
}

/**
 * foeListViewModel(state, opts = {}) — { hint, threat, alive, cards }.
 * `opts.chipsFor(foe)` supplies condition-chip labels for a LIVE foe
 * (defaults to `() => []`) — this module never derives chips itself.
 */
export function foeListViewModel(state, opts = {}) {
  const chipsFor = typeof opts.chipsFor === "function" ? opts.chipsFor : () => [];
  const C = state.combat || { foes: [], target: -1, pending: false, first: null };
  const foes = C.foes || [];
  const alive = foes.filter((f) => f.alive).length;
  const hint = alive > 1 ? COMBAT_PANEL_COPY.aimMany : COMBAT_PANEL_COPY.aimOne;
  const threat = C.pending ? COMBAT_PANEL_COPY.notRolled : C.first === "you" ? COMBAT_PANEL_COPY.youFirst : COMBAT_PANEL_COPY.theyFirst;

  const cards = foes.map((f, i) => {
    const glyph = FOE_GLYPHS[f.type] || FOE_GLYPHS.default;
    const name = String(f.name).toUpperCase();
    const meta = [f.size ?? "?", `INT ${f.intel ?? "?"}`, f.sp && f.sp.note ? f.sp.note : null].filter(Boolean).join(" · ").toUpperCase();
    const wp = Math.max(0, f.wp ?? 0);
    const wpLabel = f.alive ? `${wp} / ${f.maxWP}` : "—";
    const pct = f.alive ? pctFor(wp, f.maxWP || 1) : 0;
    const chips = f.alive ? chipsFor(f) : [];
    const targeted = i === C.target && !!f.alive;

    let tag = "";
    let tagTone = "none";
    if (!f.alive) {
      tag = COMBAT_PANEL_COPY.down;
      tagTone = "dead";
    } else if (chips.length) {
      tag = chips.join(" · ").toUpperCase();
      tagTone = "status";
    } else if (targeted && alive > 1) {
      tag = COMBAT_PANEL_COPY.target;
      tagTone = "target";
    }

    return {
      i,
      glyph,
      name,
      meta,
      wpLabel,
      tag,
      tagTone,
      pct,
      alive: !!f.alive,
      targeted,
      state: !f.alive ? "dead" : targeted ? "target" : "live",
    };
  });

  return { hint, threat, alive, cards };
}

/**
 * yourLotViewModel(state) — { hint, cards, overflow }. `cards[0]` is
 * always the hero (the active card — joiners auto-act, no turn cycling);
 * then every `state.party` member; then, when `state.combat.ally` is
 * present, a summoned-ally card. `overflow` is `cards.length > 3` (the
 * strip's `overflow-x:auto` data attribute — no `PARTY_CAP > 1` fixture
 * exists today, so a 3+-member scenario must feed a synthetic
 * `state.party`, per RESEARCH Pitfall 10).
 */
export function yourLotViewModel(state) {
  const c = state.c;
  const heroWp = Math.max(0, c.wp);
  const heroDown = heroWp <= 0;
  const heroPct = pctFor(heroWp, c.maxWP);
  const heroThird = c.cls === "Magic User" ? `${Math.max(0, maxCharges(c) - (c.spellsUsed || 0))} CHARGES` : String(c.sub || c.cls || "").toUpperCase();
  const heroCard = {
    kind: "hero",
    name: String(c.name || "YOU").toUpperCase(),
    wpLabel: heroDown ? COMBAT_PANEL_COPY.down : `${heroWp}/${c.maxWP}`,
    pct: heroPct,
    barTone: heroDown ? "down" : heroPct > 35 ? "ok" : "low",
    down: heroDown,
    active: true,
    third: heroThird,
  };

  const party = state.party || [];
  const memberCards = party.map((m) => {
    const wp = Math.max(0, m.wp ?? 0);
    const max = m.maxWP || 1;
    const down = m.status === "downed" || wp <= 0;
    const pct = pctFor(wp, max);
    return {
      kind: "member",
      name: String(m.name || "Companion").toUpperCase(),
      wpLabel: down ? COMBAT_PANEL_COPY.down : `${wp}/${max}`,
      pct,
      barTone: down ? "down" : pct > 35 ? "ok" : "low",
      down,
      active: false,
      third: String(m.sub || m.cls || "COMPANION").toUpperCase(),
    };
  });

  const cards = [heroCard, ...memberCards];

  if (state.combat && state.combat.ally) {
    const ally = state.combat.ally;
    cards.push({
      kind: "ally",
      name: String(ally.name || "ALLY").toUpperCase(),
      wpLabel: `${ally.rounds} ROUNDS`,
      pct: 100,
      barTone: "ok",
      down: false,
      active: false,
      third: COMBAT_PANEL_COPY.allyThird,
    });
  }

  const hint = party.length ? COMBAT_PANEL_COPY.lotParty : COMBAT_PANEL_COPY.lotSolo;
  return { hint, cards, overflow: cards.length > 3 };
}

/**
 * encounterOverlaySpec(state) — the MAJOR OVERLAY (CSCR-06) content for
 * `combat.pending`: icon/title/line/roll/primary-button. `secondary` is
 * always null in this phase (Phase 35 reuses this shape for descend/death
 * variants that DO carry a secondary button). `iconKey` (2026-09-17 UAT):
 * the icons/optimized PNG the overlay shows instead of the glyph.
 */
export function encounterOverlaySpec(state) {
  const C = state.combat || { foes: [], tracked: false };
  const foes = C.foes || [];

  const counts = [];
  const seen = new Map();
  for (const f of foes) {
    if (!seen.has(f.name)) {
      const entry = { name: f.name, count: 0 };
      seen.set(f.name, entry);
      counts.push(entry);
    }
    seen.get(f.name).count++;
  }
  const summary = counts.map((entry) => (entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name)).join(", ") || "something";

  return {
    icon: "●",
    iconKey: "encounter",
    iconTone: "encounter",
    title: foes.length === 1 ? COMBAT_PANEL_COPY.oneHere : COMBAT_PANEL_COPY.manyHere,
    line: `${summary}. ${C.tracked ? COMBAT_PANEL_COPY.unnoticed : COMBAT_PANEL_COPY.noticed}`,
    roll: COMBAT_PANEL_COPY.encounterRoll,
    primary: { label: COMBAT_PANEL_COPY.fight, dispatch: { type: "fight" } },
    secondary: null,
  };
}

// Re-exported for test/unit/combatPanel.test.js's glyph-coverage check
// (every ENC_TYPES entry must have its own FOE_GLYPHS entry).
export { ENC_TYPES };
