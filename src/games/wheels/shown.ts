// What the Wheels screens show of the clock: only the bulb timers (and, online, a few whole seconds). The screens
// redraw when these change instead of on every tick; nothing on them moves in between.
import { STAR_WINDOW_MS, STYLES, timeLeft, type Question, type Turn } from './core';
import { BOSS_MS, REDEMPTION_MS, type OfflineGame } from './offline';
import { bulbsLit } from './velvet';

const lit = (left: number, total: number) => bulbsLit(left / total);

/** The turn's bulbs: the Star window, or the question's own time. `style` looks the question's style up (online). */
export function turnShown(t: Turn | null | undefined, now: number, style: (q: Question) => Question['style'] = (q) => q.style) {
  if (!t) return 0;
  if (t.phase === 'star') return lit(timeLeft(t, now), STAR_WINDOW_MS);
  if (t.phase === 'question') return lit(timeLeft(t, now), STYLES[style(t.question)].seconds * 1000);
  return 0;
}

/** Everything a Solo or Offline game shows of the clock at `now`. */
export function gameShown(g: Pick<OfflineGame, 'turn' | 'redemption' | 'boss'> | null | undefined, now: number, style?: (q: Question) => Question['style']) {
  if (!g) return '';
  const r = g.redemption;
  const b = g.boss;
  const red = r && r.until != null ? lit(Math.max(0, r.until - (r.pausedAt ?? now)), REDEMPTION_MS) : 0;
  const boss = b && b.until != null ? lit(Math.max(0, b.until - (b.pausedAt ?? now)), BOSS_MS) : 0;
  return `${turnShown(g.turn, now, style)}:${red}:${boss}`;
}
