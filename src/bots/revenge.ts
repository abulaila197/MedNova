import type { HeadToHead as Record_ } from './types';
import { rng } from './rng';

/**
 * Revenge lines (G6): a rival you've met before greets you in the room by your record. Short text, said once as it
 * gets ready, in place of its usual hello.
 */
const AFTER_IT_LOST = ['Last time was luck.', 'I want that one back.', 'Rematch. Now.', "You won't get me twice.", 'I did my reading this time.'];
const AFTER_IT_WON = ['Back for more?', 'Same result as last time, I think.', 'You again. This should be quick.', 'Ready to lose again?', 'Still hoping?'];
const STREAK_IT_LOST = ['How are you still beating me?', 'This is getting embarrassing.', 'Today it ends.'];
const STREAK_IT_WON = ["I'm starting to feel bad for you.", 'Is this a habit now?', 'Try harder this time.'];

/** A line for a rival with a record against you, or null for a stranger. `seed` keeps the line fixed per room. */
export function revengeLine(rec: Record_ | undefined, seed: string): string | null {
  if (!rec || rec.w + rec.l === 0) return null;
  const r = rng(`revenge:${seed}`);
  // "won"/"lost" are yours: it lost when you won.
  const itLost = rec.last === 'won';
  const streak = itLost ? rec.w >= 3 && rec.w > rec.l * 2 : rec.l >= 3 && rec.l > rec.w * 2;
  const pool = itLost ? (streak ? STREAK_IT_LOST : AFTER_IT_LOST) : streak ? STREAK_IT_WON : AFTER_IT_WON;
  return pool[Math.floor(r() * pool.length)];
}

/** "3–1 to you", "1–3 to them", "2–2". */
export const recordText = (rec: Record_) => (rec.w === rec.l ? `${rec.w}–${rec.l}` : rec.w > rec.l ? `${rec.w}–${rec.l} to you` : `${rec.l}–${rec.w} to them`);
