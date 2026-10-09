// Extra envelope fields for the gap pages, computed on the server from the full game (owned by the gap pages builder).
// Only this player's own facts, or what everyone in the camp may see. Never another player's secret.
import { itemPrice, rules, type EffectId, type Game, type ItemId, type PlayerId, type Snare } from './engine';

export function gapExtras(g: Game, me: PlayerId) {
  const self = g.players.find((p) => p.id === me);
  // The Traveling Doctor's pot per patient (who chipped in stays secret), and my own chip.
  const pot: Record<PlayerId, number> = {};
  for (const c of Object.values(g.doctorChips)) pot[c.patient] = (pot[c.patient] ?? 0) + c.jewels;
  // What curing each of my effects costs right now.
  const cures: Partial<Record<EffectId, { item: ItemId; price: number }>> = {};
  for (const e of self?.effects ?? []) {
    const item = rules.ITEM_IDS.find((i) => rules.ITEMS[i].cures === e.id);
    if (item) cures[e.id] = { item, price: itemPrice(g, item) };
  }
  return {
    /** My meal this month (null = not bought yet). */
    meal: self?.meal ?? null,
    /** I already paid the Wolves this month. */
    wolvesPaid: g.wolvesPaid.includes(me),
    doctor: { pot, mine: g.doctorChips[me] ?? null },
    /** Snares that sprang this month: who was caught, on what, and how much they lost (never who set it). */
    sprung: g.snares
      .filter((s) => s.month === g.month && s.status === 'sprung')
      .map((s) => ({ id: s.id, to: s.target, trigger: s.trigger as Snare['trigger'], n: g.log.find((l) => l.kind === 'snare-sprung' && l.month === g.month && l.to === s.target)?.n ?? rules.SNARE_TAKES })),
    /** Players a careful bot is standing in for (the strip shows them as "bot"). */
    away: g.players.filter((p) => p.disconnectedSince != null && !p.fled).map((p) => p.id),
    /** I may claim the Mercy Ration now (§2: once, at 15% or less). */
    mercy: !!self && self.alive && !self.mercyUsed && self.health <= rules.MERCY_AT,
    cures,
  };
}
