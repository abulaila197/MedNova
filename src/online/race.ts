import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { second } from '@/games/engine/timeStore';
import type { PlayItem } from '@/games/engine/types';
import { playerColour } from '@/games/shell/characters';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';

import { leaveRoom } from './api';
import { finishOnline, useShowResults } from './finish';
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
    /** The guesses box (P20): the latest 4 wrong guesses of this turn, oldest first (near misses never show). */
    guesses?: { u: string; g: string; i: number }[] | null;
  } | null;
};


/**
 * What a race screen shows of the clock: whole seconds to the phase's end and to my lock's end. Smooth clocks (the
 * Streak fuse, the Silent Artist's chalk ring) follow `clock` in their own small widgets.
 */
const shownOf = (server: number, st: RaceState | null) => (st ? `${second(st.phase_ends_at - server)}:${st.me?.locked_until ? second(st.me.locked_until - server) : ''}` : null);

/**
 * Polls race_state every second (the server referees, ON17) and keeps a clock in server time.
 * Also turns the finished match into a local play and opens the results (ON21).
 */
export function useRace(def: GameDef, roomId: string, matchId: string, me: string, toItems: (st: RaceState) => Omit<PlayItem, 'id' | 'at' | 'playId'>[]) {
  const { st, load, server, clock, notice, setNotice } = useMatchState<RaceState>('race_state', matchId, { shown: shownOf });
  const showResults = useShowResults(def.key, matchId, st?.phase === 'done');
  const finishing = useRef(false);
  const items = useRef(toItems);
  useEffect(() => {
    items.current = toItems;
  });

  // Seated = has a seat in this match (their play is saved at the end). Playing = seated and not dropped by the server
  // for being away over a minute (rule 11): a dropped player's answers are ignored, so their board turns to watching.
  const seated = useMemo(() => st?.players.some((p) => p.user_id === me) ?? false, [st, me]);
  const dropped = useMemo(() => st?.players.some((p) => p.user_id === me && p.dropped) ?? false, [st, me]);
  const playing = seated && !dropped;
  const watchSub = dropped ? 'You were away for over a minute, so you’re out of this match.' : 'You get a seat at the rematch.';
  const watchLine = dropped ? 'You were away for over a minute, so you’re watching now.' : `You’re watching. ${watchSub}`;
  const doneLine = seated ? 'Adding up the scores…' : 'Match over. Back to the room…';

  // A spectator has no play to save at the end: back to the room for the rematch they were promised (DEF-007).
  useEffect(() => {
    if (st?.phase !== 'done' || seated) return;
    const id = setTimeout(() => router.replace(`/play/${def.key}/lobby?room=${roomId}`), 3000);
    return () => clearTimeout(id);
  }, [st?.phase, seated, def.key, roomId]);

  useEffect(() => {
    if (!st || st.phase !== 'done' || !seated || finishing.current) return;
    finishing.current = true;
    (async () => {
      try {
        const order = [...st.players.filter((p) => p.user_id === me), ...st.players.filter((p) => p.user_id !== me)];
        const seatOf = new Map(order.map((p, i) => [p.user_id, i]));
        const teams = Number(st.settings.teams) || 0;
        const seats = order.map((p, i) => {
          const tm = teams >= 2 && p.team != null ? presetTeam(p.team) : null;
          return { seat: i, name: p.user_id === me ? 'You' : p.name, userId: p.user_id, character: p.character, color: tm?.color ?? playerColour(st.players, p.user_id), ...(tm ? { team: tm.id } : null) };
        });
        const standings = st.players
          .map((p) => ({ seat: seatOf.get(p.user_id)!, name: p.user_id === me ? 'You' : p.name, score: p.score, timeMs: p.solve_ms, rank: p.rank ?? st.players.length }))
          .sort((a, b) => a.rank - b.rank);
        const mine = st.players.find((p) => p.user_id === me)!;
        const settings = { ...st.settings, room: roomId, match: matchId, teams: teams >= 2 ? Array.from({ length: teams }, (_, i) => presetTeam(i)) : undefined };
        const id = await finishOnline(def, matchId, { settings, seats, standings, score: mine.score, items: items.current(st) });
        showResults(id);
      } catch {
        finishing.current = false; // the next poll tries again instead of leaving "Adding up the scores…" for good
      }
    })();
  }, [st, seated, me, def, roomId, matchId, showResults]);


  const leave = useCallback(async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  }, [roomId, def.key]);

  return { st, load, server, clock, playing, seated, dropped, watchLine, watchSub, doneLine, notice, setNotice, leave };
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
