import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { leaveRoom, rematchRoom } from '@/online/api';

import { engine } from '../engine';
import type { Mode, Play, PlayItem } from '../engine/types';
import { startPlay, trialsLeft } from './flow';
import { useSession } from './session';
import { teamsOf, teamStandings } from './teams';
import type { GameDef } from './types';

/** Mode landing logic: resumable plays, free plays left, the open How to play card, and Play (with the trial gate). */
export function useLanding(def: GameDef) {
  const signedIn = !!useSession((s) => s.userId);
  const [open, setOpen] = useState<Mode | null>(null);
  const [resume, setResume] = useState<Partial<Record<Mode, Play | null>>>({});
  const [left, setLeft] = useState<Partial<Record<Mode, number | null>>>({});

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const r: typeof resume = {};
        const l: typeof left = {};
        for (const m of def.modes) {
          r[m.mode] = await engine.recorder.resumable(def.key, m.mode);
          l[m.mode] = await trialsLeft(def.key, m.mode);
        }
        if (live) (setResume(r), setLeft(l));
      })();
      return () => {
        live = false;
      };
    }, [def, signedIn]),
  );

  const go = async (mode: Mode) => {
    if (await engine.gate.mustSignIn(def.key, mode, signedIn)) router.push(`/play/${def.key}/gate?mode=${mode}`);
    else router.push(`/play/${def.key}/setup?mode=${mode}`);
  };
  const resumePlay = (p: Play) => router.push(`/play/${def.key}/run?play=${p.id}`);
  /** "Resume case 3": the bookmark's item number when it has one. */
  const resumeLabel = (p: Play) => {
    const i = (p.resume as { index?: number } | null)?.index;
    return `Resume ${def.itemNoun ?? 'case'} ${i != null ? i + 1 : ''}`.trim();
  };
  return { open, setOpen, resume, left, go, resumePlay, resumeLabel };
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
  const teamRows = teams && play.standings.length > 1 ? teamStandings(play.standings, play.seats, teams, def.teamScore) : null;
  const stats = def.summary?.(play, items) ?? [
    { value: String(play.score), label: multi ? 'Your points' : 'Points' },
    { value: `${right}/${mine.length}`, label: 'Solved' },
  ];
  const missed = items.some((i) => i.feedsLearn && i.outcome !== 'right');
  // ON25: online Rematch and Change settings both go back to the same room's lobby (the host changes settings there).
  const room = play.mode === 'online' ? (play.settings.room as string | undefined) : undefined;
  const rematch = async () => {
    if (room) {
      await rematchRoom(room).catch(() => {});
      router.replace(`/play/${def.key}/lobby?room=${room}`);
      return;
    }
    const next = await startPlay(def.key, play.mode, play.settings, play.seats.filter((x) => !x.removed));
    router.replace(`/play/${def.key}/run?play=${next.id}`);
  };
  const changeSettings = () => (room ? rematch() : router.replace(`/play/${def.key}/setup?mode=${play.mode}&from=${play.id}`));
  const backToGames = () => {
    if (room) leaveRoom(room).catch(() => {});
    router.replace('/games');
  };
  const openDossier = (key: string) => router.push(`/learn/dossier?id=${key}`);
  return { multi, mine, right, nameOf, colorOf, teams, teamRows, plain, stats, missed, rematch, changeSettings, backToGames, openDossier };
}
