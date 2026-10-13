import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { needPlay } from '@/features/freeplays/paywall';
import { leaveRoom, rematchRoom } from '@/online/api';

import { engine, FREE_DAILY } from '../engine';
import type { Mode, Play, PlayItem } from '../engine/types';
import { alwaysFree, startPlay, trialsLeft } from './flow';
import { isSubscribed } from '@/features/store/billing';
import { useSession } from './session';
import { teamsOf, teamStandings } from './teams';
import { teamScoreOf, type GameDef } from './types';

/** Mode landing logic: resumable plays, free plays left, the open How to play card, and Play (with the trial gate). */
export function useLanding(def: GameDef) {
  const signedIn = !!useSession((s) => s.userId);
  const [open, setOpen] = useState<Mode | null>(null);
  const [resume, setResume] = useState<Partial<Record<Mode, Play | null>>>({});
  const [left, setLeft] = useState<Partial<Record<Mode, number | null>>>({});

  const load = useCallback(() => {
    let live = true;
    (async () => {
      const r: typeof resume = {};
      const l: typeof left = {};
      for (const m of def.modes) {
        r[m.mode] = await engine.recorder.resumable(def.key, m.mode);
        l[m.mode] = await trialsLeft(def.key, m.mode);
      }
      if (live) {
        setResume(r);
        setLeft(l);
      }
    })();
    return () => {
      live = false;
    };
  }, [def, signedIn]);
  useFocusEffect(load);
  // Signing in or out while the page is open changes the free plays at once (focus alone would miss it).
  useEffect(load, [load]);

  const go = async (mode: Mode) => {
    if (await engine.gate.mustSignIn(def.key, mode, signedIn)) return router.push(`/play/${def.key}/gate?mode=${mode}`);
    // Out of today's free plays: the sheet asks first (TR1). Medicordle Solo asks at setup, where Daily stays free (TR3).
    if (!(def.key === 'nova-medicordle' && mode === 'solo') && !(await needPlay(def.key))) return;
    router.push(`/play/${def.key}/setup?mode=${mode}`);
  };
  const resumePlay = (p: Play) => router.push(`/play/${def.key}/run?play=${p.id}`);
  /** "Resume case 3": the bookmark's item number when it has one. */
  const resumeLabel = (p: Play) => {
    const i = (p.resume as { index?: number } | null)?.index;
    return `Resume ${def.itemNoun ?? 'case'} ${i != null ? i + 1 : ''}`.trim();
  };
  /** The small note on a mode card: today's free plays left, a guest's one try, or that online needs an account. */
  const note = (mode: Mode) => {
    const l = left[mode];
    if (l == null) return '';
    if (signedIn && isSubscribed()) return 'Unlimited plays';
    if (signedIn) return l > FREE_DAILY ? `${l} plays left today` : `${l}/${FREE_DAILY} free today`;
    return mode === 'online' ? 'Sign in to play' : l > 0 ? '1 free try' : 'Free try used';
  };
  return { open, setOpen, resume, go, resumePlay, resumeLabel, note };
}

/** Results logic: the phone owner's numbers, team and player tables, and the Rematch / Change settings / Back actions (rule 14). */
export function useResults(def: GameDef, play: Play, items: PlayItem[]) {
  // One phone: the top numbers are the phone owner's (seat 0); every player's items are listed by name.
  const multi = play.seats.length > 1;
  const mine = multi ? items.filter((i) => i.seat === 0) : items;
  const right = mine.filter((i) => i.outcome === 'right').length;
  const nameOf = new Map(play.seats.map((x) => [x.seat, x.name]));
  const colorOf = new Map(play.seats.map((x) => [x.seat, x.color]));
  const teams = teamsOf(play);
  const plain = def.plainItems?.(play) ?? false;
  const teamRows = teams && play.standings.length > 1 ? teamStandings(play.standings, play.seats, teams, teamScoreOf(def, play.mode)) : null;
  const stats = def.summary?.(play, items) ?? [
    { value: String(play.score), label: multi ? 'Your points' : 'Points' },
    { value: `${right}/${mine.length}`, label: 'Solved' },
  ];
  const missed = items.some((i) => i.feedsLearn && i.outcome !== 'right');
  // ON25: online Rematch and Change settings both go back to the same room's lobby (the host changes settings there).
  const room = play.mode === 'online' ? (play.settings.room as string | undefined) : undefined;
  const signedIn = !!useSession((s) => s.userId);
  /** The same trial gate as Play: a guest out of free plays goes to sign-in instead of a new game. */
  const gated = async () => {
    if (!(await engine.gate.mustSignIn(def.key, play.mode, signedIn))) return false;
    router.replace(`/play/${def.key}/gate?mode=${play.mode}`);
    return true;
  };
  /** Signed in and out of today's free plays: the sheet asks first (TR1). */
  const paid = async () => alwaysFree(play) || needPlay(def.key);
  const rematch = async () => {
    if (!(await paid())) return;
    if (room) {
      await rematchRoom(room).catch(() => {});
      router.replace(`/play/${def.key}/lobby?room=${room}`);
      return;
    }
    if (await gated()) return;
    const next = await startPlay(def.key, play.mode, play.settings, play.seats.filter((x) => !x.removed));
    router.replace(`/play/${def.key}/run?play=${next.id}`);
  };
  const changeSettings = async () => {
    if (room) return rematch();
    if (await gated()) return;
    if (!(def.key === 'nova-medicordle' && play.mode === 'solo') && !(await paid())) return;
    router.replace(`/play/${def.key}/setup?mode=${play.mode}&from=${play.id}`);
  };
  const backToGames = () => {
    if (room) leaveRoom(room).catch(() => {});
    router.replace('/games');
  };
  const openDossier = (key: string) => router.push(`/learn/dossier?id=${key}`);
  return { multi, mine, right, nameOf, colorOf, teams, teamRows, plain, stats, missed, rematch, changeSettings, backToGames, openDossier };
}
