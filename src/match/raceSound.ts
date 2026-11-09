import { useRevealSound } from '@/lib/sound';

import type { RaceState } from './race';

/**
 * A race match plays my right or wrong when the item's answer is shown to everyone (the reveal), never when I
 * solve it while others are still playing. Running out of time gives the time-up sound. A drawer is right when the drawing scored. Watchers hear nothing.
 */
export function useRaceRevealSound(st: RaceState | null, me: string) {
  const p = st?.players.find((x) => x.user_id === me);
  const on = !!st && !!p && !p.dropped && st.item != null && (st.phase === 'reveal' || st.phase === 'done');
  const right = !p ? null : p.drawer ? (p.item_points ?? 0) > 0 : p.solved ? true : p.done ? false : ('timeup' as const);
  useRevealSound(on ? `${st!.index}` : null, on ? right : null);
}
