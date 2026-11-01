import { useEffect, useEffectEvent, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Push updates (Yazan 2026-11-01). A private push line per match ('match:<id>') or room ('room:<id>'): the server sends
 * a tiny 'changed' signal when something changes, and the screen then fetches its own view once. Only members can
 * listen (server rule); nothing is sent from phones.
 *
 * Returns whether the line is open. While it isn't (no SQL yet, the free plan's push limit reached, a bad network),
 * the screen keeps checking on its own as before, so a closed line only costs data, never the game.
 */
export function usePushLine(topic: string | null, onSignal: () => void) {
  const [open, setOpen] = useState(false);
  const signal = useEffectEvent(() => onSignal());
  useEffect(() => {
    if (!topic) return;
    let gone = false;
    const ch = supabase.channel(topic, { config: { private: true } });
    ch.on('broadcast', { event: 'changed' }, () => signal());
    ch.subscribe((status) => {
      if (gone) return;
      // SUBSCRIBED = open; CHANNEL_ERROR / TIMED_OUT / CLOSED = back to checking (the client retries by itself).
      setOpen(status === 'SUBSCRIBED');
      // Coming back after a gap: fetch once, in case a change was missed while the line was down.
      if (status === 'SUBSCRIBED') signal();
    });
    return () => {
      gone = true;
      setOpen(false);
      supabase.removeChannel(ch);
    };
  }, [topic]);
  return open;
}

/** How often a screen checks on its own: a slow backup while push is open, otherwise the old pace. */
export const BACKUP_MS = 10000;
