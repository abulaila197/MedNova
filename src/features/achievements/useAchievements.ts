import { useCallback, useEffect, useState } from 'react';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { learnCounts } from '@/features/learn/library';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { useFriends } from '@/state/friends';

import { ACHIEVEMENTS, achievementProgress, tiersReached, tierTokens, tourStepOf, type AchKey, type SocialCounts } from './progress';

const TOUR = 'tour:visited';

/** Records a page for "Get to Know MedNova" (called on every page change). */
export async function markVisited(path: string) {
  const k = tourStepOf(path);
  if (!k) return;
  const had = (await engine.kv.get<string[]>(TOUR)) ?? [];
  if (!had.includes(k)) await engine.kv.set(TOUR, [...had, k]);
}

export type AchRow = (typeof ACHIEVEMENTS)[number] & {
  count: number;
  /** Tiers reached (0-4). */
  reached: number;
  /** Tiers already paid (0-4). */
  paid: number;
  /** The goal for the next tier, or null after the last one. */
  next: number | null;
  /** Pages visited, for the step-set achievement. */
  steps?: string[];
};

/** Tiers paid on the account: one 'achievement' wallet row per tier, reason "ach:key:tier" (AC6). */
const paidTiers = (ledger: { kind: string; reason: string }[]) => {
  const out = new Map<string, number>();
  for (const e of ledger) {
    if (e.kind !== 'achievement') continue;
    const [, key, tier] = e.reason.split(':');
    out.set(key, Math.max(out.get(key) ?? 0, Number(tier) || 0));
  }
  return out;
};

/** Everything the counters need, read from the phone. */
export async function loadAchievements(friendIds: string[], me?: string): Promise<AchRow[]> {
  const [{ plays, items }, ledger, bal, best, learn, social, tour] = await Promise.all([
    engine.recorder.all(),
    engine.wallet.ledger(),
    engine.wallet.balance(),
    engine.kv.get<Record<number, number>>('crossword:best'),
    learnCounts(),
    // Invites, challenges and written cases live on the server; offline or signed out they read 0.
    me ? supabase.rpc('social_counts').then(({ data }) => (data as SocialCounts | null) ?? {}, () => ({})) : Promise.resolve({} as SocialCounts),
    engine.kv.get<string[]>(TOUR),
  ]);
  const counts = achievementProgress({
    plays,
    items,
    me,
    friendIds,
    prizeDays: ledger.filter((e) => e.kind === 'daily').length,
    level: bal.level,
    reviewCards: learn.reviewCards,
    dossiersOpened: learn.dossiersOpened,
    crosswordThreeStars: Object.values(best ?? {}).filter((s) => s === 3).length,
    social,
    tour: tour ?? [],
  });
  const paid = paidTiers(ledger);
  return ACHIEVEMENTS.map((a) => {
    const count = counts[a.key];
    const reached = tiersReached(a.key, count);
    return { ...a, count, reached, paid: paid.get(a.key) ?? 0, next: reached < a.goals.length ? a.goals[reached] : null, steps: a.key === 'app_tour' ? (tour ?? []) : undefined };
  });
}

/** The Achievements page's data and its Collect action (signed in only, AC7). */
export function useAchievements() {
  const userId = useSession((s) => s.userId);
  const friends = useFriends((s) => s.list);
  const [rows, setRows] = useState<AchRow[] | null>(null);
  const [busy, setBusy] = useState<AchKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRows(await loadAchievements(friends.map((f) => f.id), userId ?? undefined));
  }, [friends, userId]);

  useEffect(() => {
    loadAchievements(friends.map((f) => f.id), userId ?? undefined).then(setRows);
  }, [friends, userId]);

  const collect = async (key: AchKey) => {
    const row = rows?.find((r) => r.key === key);
    if (!userId || !row || row.paid >= row.reached) return;
    setBusy(key);
    setError(null);
    // The server pays tiers in order, re-counting what it can see.
    const { data, error: e } = await supabase.rpc('achievement_collect', { key, tier: row.paid + 1, steps: row.steps ?? null });
    setBusy(null);
    const r = data as { ok: boolean; why?: string } | null;
    if (e || !r) return setError('Could not reach MedNova. Check your connection and try again.');
    if (!r.ok && r.why !== 'done') return setError('Not saved yet: your account is still catching up with this phone. Try again later.');
    await syncAccount(userId).catch(() => {});
    await reload();
  };

  const waiting = rows?.reduce((n, r) => n + Math.max(0, r.reached - r.paid), 0) ?? 0;
  const tokensWaiting = rows?.reduce((n, r) => n + tierTokens(r.key).slice(r.paid, r.reached).reduce((a, b) => a + b, 0), 0) ?? 0;
  return { rows, signedIn: !!userId, busy, error, collect, waiting, tokensWaiting };
}
