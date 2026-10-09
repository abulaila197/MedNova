import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PlayItem } from '@/games/engine/types';
import { characterOf } from '@/games/shell/characters';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';

import { call, leaveRoom } from './api';
import { finishOnline, playForMatch } from './finish';

/** One player in a race match (Riddler, Medicordle, Streak Master online). */
export type RacePlayer = {
  user_id: string;
  name: string;
  character: string;
  team: number | null;
  score: number;
  solve_ms: number;
  dropped: boolean;
  rank: number | null;
  streak: number;
  best_streak: number;
  correct: number;
  /** This item: finished it (solved, out of tries, or answered). */
  done: boolean;
  solved: boolean;
  item_rank: number | null;
  item_points: number | null;
  tries: number;
  /** Medicordle: most green tiles in one of their rows (NM11). */
  greens: number | null;
};

export type RaceMine = {
  locked_until: number | null;
  wrong: string[];
  guesses: string[];
  pick: number | null;
  done: boolean;
  solved_ms: number | null;
  rank: number | null;
  points: number;
};

export type RaceItemResult = { index: number; item: number; solved_ms: number | null; rank: number | null; points: number; wrong: string[]; guesses: string[]; pick: number | null };

export type RaceState = {
  now: number;
  room_id: string;
  game: string;
  phase: 'countdown' | 'case' | 'reveal' | 'done';
  phase_started_at: number;
  phase_ends_at: number;
  index: number;
  total: number;
  /** The bank number of the current item (1-based), null in the countdown. */
  item: number | null;
  /** Shown only at reveal and done: the riddle id, the word, or the right choice index. */
  answer: string | null;
  settings: Record<string, unknown>;
  players: RacePlayer[];
  me: RaceMine | null;
  my_items: RaceItemResult[] | null;
};

/**
 * Polls race_state every second (the server referees, ON17) and keeps a clock in server time.
 * Also turns the finished match into a local play and opens the results (ON21).
 */
export function useRace(def: GameDef, roomId: string, matchId: string, me: string, toItems: (st: RaceState) => Omit<PlayItem, 'id' | 'at' | 'playId'>[]) {
  const [st, setSt] = useState<RaceState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const offset = useRef(0);
  const finishing = useRef(false);
  const items = useRef(toItems);
  items.current = toItems;

  const load = useCallback(async () => {
    try {
      const s = await call<RaceState>('race_state', { m: matchId });
      offset.current = s.now - Date.now();
      setSt(s);
    } catch {
      setNotice('Reconnecting…');
    }
  }, [matchId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => (clearInterval(poll), clearInterval(tick));
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  const playing = useMemo(() => st?.players.some((p) => p.user_id === me) ?? false, [st, me]);

  useEffect(() => {
    if (!st || st.phase !== 'done' || !playing || finishing.current) return;
    finishing.current = true;
    (async () => {
      const order = [...st.players.filter((p) => p.user_id === me), ...st.players.filter((p) => p.user_id !== me)];
      const seatOf = new Map(order.map((p, i) => [p.user_id, i]));
      const teams = Number(st.settings.teams) || 0;
      const seats = order.map((p, i) => {
        const tm = teams >= 2 && p.team != null ? presetTeam(p.team) : null;
        return { seat: i, name: p.user_id === me ? 'You' : p.name, character: p.character, color: tm?.color ?? characterOf(p.character)?.ring, ...(tm ? { team: tm.id } : null) };
      });
      const standings = st.players
        .map((p) => ({ seat: seatOf.get(p.user_id)!, name: p.user_id === me ? 'You' : p.name, score: p.score, timeMs: p.solve_ms, rank: p.rank ?? st.players.length }))
        .sort((a, b) => a.rank - b.rank);
      const mine = st.players.find((p) => p.user_id === me)!;
      const settings = { ...st.settings, room: roomId, match: matchId, teams: teams >= 2 ? Array.from({ length: teams }, (_, i) => presetTeam(i)) : undefined };
      const id = await finishOnline(def, matchId, { settings, seats, standings, score: mine.score, items: items.current(st) });
      router.replace(`/play/${def.key}/results?play=${id}`);
    })();
  }, [st, playing, me, def, roomId, matchId]);

  // Already finished on this phone (reopened): straight to the results.
  useEffect(() => {
    playForMatch(matchId).then((id) => id && st?.phase === 'done' && router.replace(`/play/${def.key}/results?play=${id}`));
  }, [matchId, st?.phase, def.key]);

  const leave = useCallback(async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  }, [roomId, def.key]);

  const server = now + offset.current;
  return { st, load, server, playing, notice, setNotice, leave };
}

/** The same shuffle on every phone for one question of one match (Streak Master options). */
export function seededOrder(seed: string, n: number) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
