import { create } from 'zustand';
import { tr } from '@/i18n';

import type { GameKey, Play } from '@/games/engine/types';
import { useSession } from '@/games/shell/session';
import { copyOf, keepCopy } from '@/lib/copies';
import { call } from '@/lib/rpc';
import { onAccountSwitch } from '@/state/accountSwitch';

/**
 * Friend challenges (G7, Yazan 2026-11-09/10). Two kinds: "Beat my score" (you play first, your score is the bar,
 * one day) and "Game challenge" (both play within 1, 3 or 7 days, best score wins). The winner gets 10 tokens when
 * the challenge completes, paid through the Inbox, and only for the first win against that friend each day.
 * The server keeps the challenges (friend_challenges, SQL to paste after the stores); the phone reads, sends and
 * reports scores. Offline, the last saved copy shows.
 */
export type ChallengeKind = 'score' | 'game';
export type ChallengeMode = 'solo' | 'bots';
export type Who = { id: string; name: string; avatar: string | null };
export type Challenge = {
  id: string;
  kind: ChallengeKind;
  from: Who;
  to: Who;
  game: GameKey;
  mode: ChallengeMode;
  settings: Record<string, unknown>;
  days: number;
  created_at: string;
  ends_at: string;
  from_score: number | null;
  to_score: number | null;
  status: 'open' | 'done';
  /** Who won (null: a tie, or nobody played / only the bar was set). */
  winner: string | null;
  /** Tokens the winner got (0 when a win against this friend was already paid today). */
  prize: number;
  /** You have seen the result (the friend's button goes back to "Challenge"). */
  seen: boolean;
};
export const PRIZE = 10;
export const DAYS: number[] = [1, 3, 7];

type State = { list: Challenge[]; loaded: boolean; failed: boolean; savedAt: number | null };
const EMPTY: State = { list: [], loaded: false, failed: false, savedAt: null };
export const useChallenges = create<State>(() => EMPTY);
onAccountSwitch(() => useChallenges.setState(EMPTY));

/** A challenge the player is about to set up: who it's for and what kind. Consumed by Start (game) or the finish (score). */
export type Intent = { friend: Who; kind: ChallengeKind; days: number; game: GameKey; mode: ChallengeMode; at: number };
export const useIntent = create<{ intent: Intent | null; note: { playId: string; text: string } | null }>(() => ({ intent: null, note: null }));
const FRESH_MS = 30 * 60_000;
export const intentFor = (game: GameKey, mode: string): Intent | null => {
  const i = useIntent.getState().intent;
  return i && i.game === game && i.mode === mode && Date.now() - i.at < FRESH_MS ? i : null;
};
export const setIntent = (intent: Intent | null) => useIntent.setState({ intent });

/** Reads every open challenge and every finished one not seen yet. Offline: the saved copy. */
export async function loadFriendChallenges() {
  const uid = useSession.getState().userId;
  if (!uid) return useChallenges.setState({ ...EMPTY, loaded: true });
  try {
    const list = (await call<Challenge[]>('challenge_list')) ?? [];
    useChallenges.setState({ list, loaded: true, failed: false, savedAt: null });
    void keepCopy('friend_challenges', uid, list);
  } catch {
    const copy = await copyOf<Challenge[]>('friend_challenges', uid);
    if (copy && useSession.getState().userId === uid) useChallenges.setState({ list: copy.v, loaded: true, failed: true, savedAt: copy.at });
    else useChallenges.setState({ loaded: true, failed: true });
  }
}

export async function sendChallenge(x: { other: string; kind: ChallengeKind; game: GameKey; mode: ChallengeMode; settings: Record<string, unknown>; days: number; score?: number }) {
  const r = await call<{ ok: boolean; why?: string; id?: string }>('challenge_send', { other: x.other, kind: x.kind, game: x.game, mode: x.mode, settings: x.settings, days: x.days, score: x.score ?? null });
  if (r?.ok) void loadFriendChallenges();
  return r;
}

/** The server keeps your best score; a late score (after ends_at) is refused. */
export async function reportScore(id: string, score: number) {
  const r = await call<{ ok: boolean; why?: string }>('challenge_report', { id, score });
  if (r?.ok) void loadFriendChallenges();
  return r;
}

/** You saw a finished challenge's result: the friend's button goes back to "Challenge". */
export async function markSeen(id: string) {
  useChallenges.setState((s) => ({ list: s.list.map((c) => (c.id === id ? { ...c, seen: true } : c)) }));
  await call('challenge_seen', { id }).catch(() => {});
}

/** The challenges with one friend: the open ones, and the finished one whose result you haven't seen. */
export function withFriend(list: Challenge[], friendId: string) {
  const mine = list.filter((c) => c.from.id === friendId || c.to.id === friendId);
  return { open: mine.filter((c) => c.status === 'open'), result: mine.find((c) => c.status === 'done' && !c.seen) ?? null };
}

/** Every finished result not seen yet, newest first (the Inbox and the friends list use the count). */
export const unseenResults = (list: Challenge[]) => list.filter((c) => c.status === 'done' && !c.seen);

/** The score of one side. */
export const scoreOf = (c: Challenge, who: string) => (c.from.id === who ? c.from_score : c.to_score);
export const otherOf = (c: Challenge, me: string) => (c.from.id === me ? c.to : c.from);
export const isOver = (c: Challenge, now = Date.now()) => c.status === 'done' || Date.parse(c.ends_at) <= now;

/** "2 d 4 h left", "3 h left", "12 min left", "Time's up". */
export function timeLeft(c: Challenge, now = Date.now()) {
  const ms = Date.parse(c.ends_at) - now;
  if (ms <= 0) return tr("Time's up");
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return tr('{d} d {h} h left', { d: Math.floor(h / 24), h: h % 24 });
  if (h >= 1) return tr('{h} h left', { h });
  return tr('{n} min left', { n: Math.max(1, Math.floor(ms / 60_000)) });
}

/** A finished play counts for a challenge when it's the same game, mode and every setting the challenge fixed. */
export function matches(c: Challenge, play: Pick<Play, 'game' | 'mode' | 'settings'>) {
  if (c.game !== play.game || c.mode !== play.mode) return false;
  return Object.entries(c.settings).every(([k, v]) => k === 'teams' || k === 'botTeams' || JSON.stringify(play.settings[k] ?? null) === JSON.stringify(v ?? null));
}

/** The settings a challenge fixes: the play's, minus the rivals dealt and teams (each side deals its own). */
export const fixedSettings = (settings: Record<string, unknown>) => Object.fromEntries(Object.entries(settings).filter(([k]) => k !== 'teams' && k !== 'custom'));

/**
 * After a play finishes (any mode): a "Beat my score" being set up is sent with this score, and the score is reported
 * to every open challenge the play matches. Leaves a one-line note for the results page.
 */
export async function afterPlay(play: Play, score: number) {
  const uid = useSession.getState().userId;
  if (!uid || play.settings.custom) return;
  const notes: string[] = [];
  const intent = intentFor(play.game, play.mode);
  if (intent?.kind === 'score') {
    setIntent(null);
    const r = await sendChallenge({ other: intent.friend.id, kind: 'score', game: play.game, mode: play.mode as ChallengeMode, settings: fixedSettings(play.settings), days: 1, score }).catch(() => null);
    notes.push(r?.ok ? tr('Challenge sent to {name}: beat {score} within a day.', { name: intent.friend.name, score }) : tr('Couldn’t send the challenge to {name}. Check your connection.', { name: intent.friend.name }));
  }
  if (!useChallenges.getState().loaded) await loadFriendChallenges();
  const now = Date.now();
  for (const c of useChallenges.getState().list) {
    if (c.status !== 'open' || isOver(c, now) || !matches(c, play)) continue;
    if (c.kind === 'score' && c.from.id === uid) continue; // the bar is set once
    const r = await reportScore(c.id, score).catch(() => null);
    const other = otherOf(c, uid);
    if (r?.ok) notes.push(tr('{score} counted for your challenge with {name}.', { score, name: other.name }));
  }
  if (notes.length) useIntent.setState({ note: { playId: play.id, text: notes.join(' ') } });
}
