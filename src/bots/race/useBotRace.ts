import { useCallback, useEffect, useRef, useState } from 'react';

import { engine } from '@/games/engine';
import type { PlayItem, Standing } from '@/games/engine/types';
import { timeStore, type Clock } from '@/games/engine/timeStore';
import { usePauseHide } from '@/games/engine/usePauseHide';
import { playerColour } from '@/games/shell/characters';
import { recordItem } from '@/games/shell/flow';
import type { PlayProps } from '@/games/shell/types';
import { nth, useAlerts } from '@/match/live';
import type { RacePlayer, RaceState } from '@/match/race';
import { useRaceRevealSound } from '@/match/raceSound';
import { useSession } from '@/games/shell/session';
import { useBack } from '@/lib/useBack';

import { moodOf, type Mood } from '../brain';
import { resetRoomTalk, rivalGuess, rivalMoment, rivalStudy, useRivalEars } from '../director';
import type { Place } from '../lines';
import { meet } from '../memory';
import type { Bot } from '../types';
import { BotRace, YOU, type Race, type RaceCtx, type Rules } from './engine';

type Item = Omit<PlayItem, 'id' | 'at' | 'playId'>;

export type BotRaceOpts<R extends Race = BotRace> = Pick<PlayProps, 'play' | 'onFinish' | 'onQuit'> & {
  /** The question race's rules (not needed when `build` makes the engine). */
  rules?: Rules;
  /** Another engine for the match (Crossword's claim race); the default is the question race with `rules`. */
  build?: (ctx: RaceCtx) => R;
  /** The match's items (bank numbers), picked once when the match opens. */
  pick: () => Promise<number[]>;
  /** Your items for the play, saved when the match ends (your misses feed Learn where the game does). */
  toItems: (st: RaceState, race: R) => Item[];
  /** Diagnostic Pursuit: a rival's wrong guess in words; it pops as a chat bubble when the rival makes it. */
  guessName?: (id: string) => string;
  /** The alert when a rival solves (default "Sara solved it, 2nd"); `ms` is its time on the question. */
  solvedText?: (name: string, rank: number, ms: number) => string;
  /** Answers stay secret until the reveal (Streak Master): no solve alerts or right/wrong talk while a question runs. */
  blind?: boolean;
  /** Redraw every 100 ms instead of 250 (smooth clocks). */
  fine?: boolean;
};

const placeOf = (p: RacePlayer | undefined, n: number): Place => (!p?.rank || p.rank === 1 ? 'lead' : p.rank >= n ? 'last' : 'mid');
const any = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * A Vs rivals match on the phone (G4): the rivals play on match time, which stops while the pause menu is open or the
 * app is away (Yazan 2026-11-09: pause freezes them). Gives the screen the same RaceState the online races had, sends
 * the live alerts and the rivals' talk, and turns the finished match into an ordinary play.
 */
export function useBotRace<R extends Race = BotRace>({ play, onFinish, onQuit, rules, build, pick, toItems, guessName, solvedText, blind, fine }: BotRaceOpts<R>) {
  const room = `bot:${play.id}`;
  const [race, setRace] = useState<R | null>(null);
  const [menu, setMenu] = useState(false);
  const [t, setT] = useState(0);
  const clock = useRef<{ base: number; since: number | null }>({ base: 0, since: null });
  // The same match time as a Clock, for widgets that follow every tick (Streak Master's fuse).
  const [store] = useState(() => timeStore(0));
  const now = useCallback(() => clock.current.base + (clock.current.since != null ? Date.now() - clock.current.since : 0), []);
  const { alert, push } = useAlerts();
  const rivals = useRef<Bot[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);

  // The match: the items, your level (rivals grow a little with it) and the rivals from the room.
  useEffect(() => {
    let live = true;
    (async () => {
      const items = await pick();
      const level = (await engine.wallet.balance().catch(() => ({ level: 1 }))).level;
      const you = play.seats[0];
      const rs = play.seats.filter((x) => x.bot && !x.removed).map((x) => ({ ...x.bot!, team: x.team ?? null }));
      if (!live) return;
      meet(rs);
      rivals.current = rs;
      setBots(rs);
      const ctx: RaceCtx = { playId: play.id, items, you: { name: 'You', character: you?.character ?? 'yara', team: you?.team ?? null }, rivals: rs, settings: play.settings, playerLevel: level };
      setRace(build ? build(ctx) : (new BotRace({ ...ctx, rules: rules! }) as unknown as R));
    })();
    return () => {
      live = false;
    };
    // The match is built once per play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.id]);
  useEffect(() => () => resetRoomTalk(room), [room]);

  // Pause: the menu, the app going away, or a page opened over the match. Match time stops; so do the rivals.
  const { hidden, resume } = usePauseHide(() => setMenu(true));
  const paused = menu || hidden;
  const closeMenu = () => {
    setMenu(false);
    resume();
  };
  // Android back opens the pause menu, and a second press closes it.
  useBack(true, () => (paused ? closeMenu() : setMenu(true)));
  const running = !!race && !paused;
  useEffect(() => {
    if (!running) return;
    const c = clock.current;
    c.since = Date.now();
    const id = setInterval(() => {
      const n = now();
      store.set(n, n);
      setT(n);
    }, fine ? 100 : 250);
    return () => {
      clearInterval(id);
      c.base += Date.now() - (c.since ?? Date.now());
      c.since = null;
    };
  }, [running, fine, now, store]);

  const st = race ? race.state(t) : null;
  useRaceRevealSound(st, YOU);
  useRivalEars(room, bots);

  // What happened since the last draw: alerts and the rivals' talk.
  const seen = useRef({ index: -1, phase: '', solved: new Set<string>(), tries: {} as Record<string, number>, alone: false, ranks: {} as Record<string, number>, moods: {} as Record<string, Mood> });
  // Reactions come a beat later, never on the same instant (Yazan 2026-11-09: 2 to 3 s, so they don't look coded).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, lo = 2000, hi = 3000) =>
    void timers.current.push(
      setTimeout(() => {
        if (!pausedRef.current) fn();
      }, lo + Math.random() * (hi - lo)),
    );
  useEffect(() => {
    if (!st || !race) return;
    const s = seen.current;
    const n = st.players.length;
    const table = { tableSize: n };
    const byId = new Map(rivals.current.map((b) => [b.id, b]));
    const row = (id: string) => st.players.find((p) => p.user_id === id);
    const me = row(YOU);
    if (st.phase === 'case') {
      if (s.index !== st.index || s.phase !== 'case') {
        s.index = st.index;
        s.solved = new Set(st.players.filter((p) => p.solved).map((p) => p.user_id));
        s.tries = Object.fromEntries(st.players.map((p) => [p.user_id, p.tries]));
        s.alone = false;
        s.ranks = Object.fromEntries(st.players.map((p) => [p.user_id, p.rank ?? n]));
        if (st.index === 0) {
          const b = any(rivals.current);
          if (b) later(() => rivalMoment(room, b, 'start', table), 1500, 3000);
        }
      }
      for (const p of st.players) {
        const b = byId.get(p.user_id);
        if (blind) continue;
        if (p.solved && !s.solved.has(p.user_id)) {
          s.solved.add(p.user_id);
          if (b) {
            const ms = race.plansNow()?.[p.user_id]?.doneAt ?? 0;
            push(solvedText ? solvedText(p.name, p.item_rank ?? 1, ms) : `${p.name} solved it, ${nth(p.item_rank ?? 1)}`, playerColour(st.players, p.user_id));
            const place = placeOf(p, n);
            later(() => rivalMoment(room, b, 'right', { ...table, place }));
          }
        } else if (b && !p.solved && p.tries > (s.tries[p.user_id] ?? 0)) {
          // Diagnostic Pursuit: the wrong guess itself pops in the chat; other games: maybe a reaction a beat later.
          const plan = race.plansNow()?.[p.user_id];
          const said = guessName && plan?.wrongs?.[p.tries - 1];
          if (said) rivalGuess(room, b, guessName(said));
          else {
            const place = placeOf(p, n);
            later(() => rivalMoment(room, b, 'wrong', { ...table, place }));
          }
        }
        s.tries[p.user_id] = p.tries;
      }
      const left = st.players.filter((p) => !p.done);
      if (!s.alone && n > 1 && left.length === 1 && left[0].user_id === YOU) {
        s.alone = true;
        push('Only you left', '#f5b041');
      }
    } else if (st.phase === 'reveal' && (s.phase !== 'reveal' || s.index !== st.index)) {
      s.index = st.index;
      // Who passed you, who's on fire or tilted, what they make of your answer, and a Genius fact.
      const myRank = me?.rank ?? n;
      for (const b of rivals.current) {
        const p = row(b.id);
        const place = placeOf(p, n);
        if (blind && p?.done) later(() => rivalMoment(room, b, p.solved ? 'right' : 'wrong', { ...table, place }));
        if (p?.rank && p.rank < myRank && (s.ranks[b.id] ?? n) > (s.ranks[YOU] ?? n)) later(() => rivalMoment(room, b, 'overtake', { ...table, place }));
        const mood = moodOf(race.mindOf(b.id));
        if (mood && mood !== s.moods[b.id]) later(() => rivalMoment(room, b, mood, { ...table, place }));
        s.moods[b.id] = mood;
      }
      const other = any(rivals.current);
      if (other && me) {
        const place = placeOf(row(other.id), n);
        later(() => rivalMoment(room, other, me.solved ? 'youRight' : 'youWrong', { ...table, place }));
      }
      const genius = rivals.current.filter((b) => b.type === 'genius');
      const g = any(genius);
      const round = st.index;
      if (g) later(() => rivalStudy(room, g, round), 2500, 3500);
      if (st.index + 1 < st.total) {
        const b = any(rivals.current);
        const place = placeOf(row(b?.id ?? ''), n);
        if (b) later(() => rivalMoment(room, b, 'round', { ...table, place }));
      }
    }
    s.phase = st.phase;
  });

  // The match ended: your items, then the shell's finish (EXP, results).
  const finishing = useRef(false);
  useEffect(() => {
    if (!st || !race || st.phase !== 'done' || finishing.current) return;
    finishing.current = true;
    (async () => {
      for (const it of toItems(st, race)) await recordItem(play, it, true);
      const seatOf = (id: string) => (id === YOU ? 0 : (play.seats.find((x) => x.bot?.id === id)?.seat ?? 0));
      const standings: Standing[] = st.players
        .map((p) => ({ seat: seatOf(p.user_id), name: p.user_id === YOU ? 'You' : p.name, score: p.score, timeMs: p.solve_ms, rank: p.rank ?? st.players.length }))
        .sort((a, b) => a.rank - b.rank);
      onFinish(st.players.find((p) => p.user_id === YOU)?.score ?? 0, standings);
    })();
  });

  const act = <A extends unknown[], X>(fn: (at: number, ...a: A) => X) => (...a: A): X | undefined => {
    if (!race || paused) return undefined;
    const at = now();
    const r = fn(at, ...a);
    setT(at);
    return r;
  };
  const q = race instanceof BotRace ? (race as BotRace) : null;

  const uid = useSession((x) => x.userId);
  const talker = { id: uid ?? 'me', name: 'You', face: play.seats[0]?.character ?? 'yara' };
  return {
    st,
    race,
    room,
    talker,
    /** Match time now (ms); the clocks draw from it. */
    t,
    paused,
    menu: paused,
    openMenu: () => setMenu(true),
    closeMenu,
    quit: onQuit,
    alert,
    push,
    /** Match time as a Clock (store.get() is the latest match time). */
    clock: store as Clock,
    /** Any move on the engine at match time now (Crossword); nothing while paused. */
    at: <X,>(fn: (at: number) => X) => act(fn)(),
    wrong: act((at, answer: string, o?: { lock?: boolean; outAfter?: number }) => q!.wrong(at, answer, o)),
    solve: act((at, extra?: { pick?: number; guess?: string; greens?: number }) => q!.solve(at, extra)),
    miss: act((at, extra?: { pick?: number; guess?: string; greens?: number }) => q!.miss(at, extra)),
    row: act((at, guess: string, greens: number) => q!.row(at, guess, greens)),
  };
}
