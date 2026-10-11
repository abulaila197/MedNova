// Profile numbers from the play record (synced across the player's phones). Only the phone owner's seat counts,
// like Learn: seat 0 in solo, pass the phone and online.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { GAMES } from '@/data/games';
import { engine } from '@/games/engine';

/** Accuracy of each of the last games of one kind, oldest first (the tide line). */
const LINE = 9;

export type GameStats = { key: string; name: string; plays: number; acc: number | null; line: number[] };
export type ProfileStats = { finished: number; acc: number | null; bestDays: number; games: GameStats[] };

const dayOf = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
};

/** The longest run of calendar days (phone's time zone) with at least one finished game. */
function longestRun(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && d === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export async function loadProfileStats(): Promise<ProfileStats> {
  const { plays, items } = await engine.recorder.all();
  const done = plays.filter((p) => p.status === 'finished').sort((a, b) => a.startedAt - b.startedAt);
  const tally = new Map<string, { right: number; all: number }>();
  for (const it of items) {
    if (it.seat !== 0 || it.outcome === 'skipped') continue;
    const t = tally.get(it.playId) ?? { right: 0, all: 0 };
    t.all++;
    if (it.outcome === 'right') t.right++;
    tally.set(it.playId, t);
  }
  const sum = (ids: string[]) =>
    ids.reduce((s, id) => {
      const t = tally.get(id);
      return t ? { right: s.right + t.right, all: s.all + t.all } : s;
    }, { right: 0, all: 0 });
  const rate = (t: { right: number; all: number }) => (t.all ? t.right / t.all : null);

  const games = GAMES.map((g): GameStats => {
    const mine = done.filter((p) => p.game === g.key);
    const line = mine
      .map((p) => tally.get(p.id))
      .filter((t): t is { right: number; all: number } => !!t && t.all > 0)
      .slice(-LINE)
      .map((t) => t.right / t.all);
    return { key: g.key, name: `${g.lead} ${g.em}`, plays: mine.length, acc: rate(sum(mine.map((p) => p.id))), line };
  })
    .filter((g) => g.plays > 0)
    .sort((a, b) => b.plays - a.plays);

  return {
    finished: done.length,
    acc: rate(sum(done.map((p) => p.id))),
    bestDays: longestRun(done.map((p) => dayOf(p.endedAt ?? p.startedAt))),
    games,
  };
}

/** Reloaded each time Profile comes into view (a game may have just finished). */
export function useProfileStats() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadProfileStats().then((s) => live && setStats(s), () => {});
      return () => {
        live = false;
      };
    }, []),
  );
  return stats;
}
