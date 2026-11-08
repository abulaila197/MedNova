import { router } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { call } from '@/online/api';

/**
 * #25 (Yazan 2026-10-26): one shared like count per post and wallpaper, the same for everyone. A guest's tap asks them
 * to sign in. Items: 'post:<id>' or 'wall:<id>'.
 */
type Like = { n: number; mine: boolean };
const useLikes = create<Record<string, Like>>(() => ({}));
const asked = new Set<string>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

// The posts on one page ask together, in one call.
function want(item: string) {
  if (asked.has(item)) return;
  asked.add(item);
  queue.push(item);
  timer ??= setTimeout(() => {
    const items = queue;
    queue = [];
    timer = null;
    call<{ item: string; n: number; mine: boolean }[]>('like_counts', { items })
      .then((rows) => useLikes.setState(Object.fromEntries((rows ?? []).map((r) => [r.item, { n: r.n, mine: r.mine }]))))
      .catch(() => items.forEach((i) => asked.delete(i)));
  }, 50);
}

// Signing in or out changes which hearts are yours: ask again.
useSession.subscribe((a, b) => {
  if (a.userId === b.userId) return;
  const items = Object.keys(useLikes.getState());
  asked.clear();
  items.forEach(want);
});

export function useLike(item: string) {
  useEffect(() => want(item), [item]);
  const like = useLikes((s) => s[item]) ?? { n: 0, mine: false };
  const toggle = async () => {
    if (!useSession.getState().userId) {
      router.push('/auth');
      return;
    }
    const on = !like.mine;
    useLikes.setState({ [item]: { n: Math.max(0, like.n + (on ? 1 : -1)), mine: on } });
    try {
      const n = await call<number>('like_set', { item, on_: on });
      useLikes.setState({ [item]: { n, mine: on } });
    } catch {
      useLikes.setState({ [item]: like });
    }
  };
  return { ...like, toggle };
}
