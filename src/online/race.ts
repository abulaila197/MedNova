import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { second } from '@/games/engine/timeStore';
import type { PlayItem } from '@/games/engine/types';
import { characterOf } from '@/games/shell/characters';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';

import { leaveRoom } from './api';
import { finishOnline, playForMatch } from './finish';
import { useMatchState } from './useMatchState';

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
  /** Streak Master: their pick, sent only once the question has ended. */
  pick?: number | null;
  /** Crossword: hearts left and whether the one revive is spent. */
  hearts?: number;
  revived?: boolean;
  /** Case Files: the stage they have reached (CF9). */
  stage?: string | null;
  /** The Silent Artist: drawing this turn. */
  drawer?: boolean;
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

export type RaceItemResult = { index: number; item: number; solved_ms: number | null; rank: number | null; points: number; wrong: string[]; guesses: string[]; pick: number | null; drawer?: boolean };

export type RaceState = {
  now: number;
  room_id: string;
  game: string;
  /** 'pick' is The Silent Artist's 10 s choice before each drawing. */
  phase: 'countdown' | 'pick' | 'case' | 'reveal' | 'done';
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
  /** Crossword: every claimed word in claim order, and my wrong answers per word. */
  claims?: { word_id: string; user_id: string; at_ms: number; auto: boolean }[] | null;
  tried?: Record<string, string[]> | null;
  /** The Silent Artist: this turn's drawer, the drawer's options, the hints the room may see, the board version. */
  sa?: {
    drawer: string;
    options: number[] | null;
    words: number | null;
    field: string | null;
    mask: string | null;
    stage: number;
    field_at: number | null;
    version: number;
    reports: number;
    reported: boolean;
  } | null;
};

// These draw their clock smoothly (the Streak fuse, the chalk ring), so they redraw on every tick.
const SMOOTH = new Set(['the-streak-master', 'the-silent-artist']);

/** What a race screen shows of the clock: whole seconds to the phase's end and to my lock's end. */
const shownOf = (server: number, st: RaceState | null) => (st ? `${second(st.phase_ends_at - server)}:${st.me?.locked_until ? second(st.me.locked_until - server) : ''}` : null);

/**
 * Polls race_state every second (the server referees, ON17) and keeps a clock in server time.
 * Also turns the finished match into a local play and opens the results (ON21).
 */
export function useRace(def: GameDef, roomId: string, matchId: string, me: string, toItems: (st: RaceState) => Omit<PlayItem, 'id' | 'at' | 'playId'>[]) {
  const { st, load, server, notice, setNotice } = useMatchState<RaceState>('race_state', matchId, { shown: SMOOTH.has(def.key) ? undefined : shownOf });
  const finishing = useRef(false);
  const items = useRef(toItems);
  items.current = toItems;

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
