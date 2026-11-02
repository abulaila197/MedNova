import { router } from 'expo-router';
import { AppState, type NativeEventSubscription } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

import { useAccount } from '@/state/account';

import { cancelWatch, challengeFriend, JOIN_SAY, sayError, myInvites, respondInvite, watchAskState, watchFriend, type Invite } from './api';
import { keepIfSame } from './same';
import { onAccountSwitch } from '@/state/accountSwitch';

/** ON24: open challenges to you. `bannered` = already shown as the top banner once (Later keeps them on Friends). */
type State = { list: Invite[]; bannered: string[]; say: string | null; asking: Asking | null };
/** #16: a watch request waiting for the friend's Allow (shown as "Waiting for … to allow" with Cancel). */
export type Asking = { ask: string; name: string; friendId: string; game: string };
export const useInvites = create<State>(() => ({ list: [], bannered: [], say: null, asking: null }));
onAccountSwitch(() => useInvites.setState({ list: [], bannered: [], say: null, asking: null }));

export async function loadInvites() {
  const list = await myInvites();
  // An unchanged list keeps the same array, so the banner and Friends don't redraw every 15 s.
  useInvites.setState((s) => ({ list: keepIfSame(s.list, list ?? []) }));
}

let beat: ReturnType<typeof setTimeout> | null = null;
let sub: NativeEventSubscription | null = null;
let line: RealtimeChannel | null = null;
let pushed = false;

/**
 * Challenges to you (G7 #2, Yazan 2026-11-02: less server load). The server pushes a tiny signal on your own private
 * line ('user:<id>') when a challenge to you arrives or changes, and the phone fetches its invites once. While that
 * line is open, a slow backup check runs every 60 s; if it isn't (bad network, no SQL yet), every 15 s as before.
 * Nothing is checked while the app is in the background; coming back checks once.
 */
export function startInvites(userId: string) {
  stopInvites();
  const tick = () => AppState.currentState === 'active' && loadInvites().catch(() => {});
  const loop = () => {
    beat = setTimeout(() => {
      tick();
      loop();
    }, pushed ? 60000 : 15000);
  };
  tick();
  loop();
  sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
  line = supabase.channel(`user:${userId}`, { config: { private: true } });
  line.on('broadcast', { event: 'changed' }, () => tick());
  line.subscribe((status) => {
    const was = pushed;
    pushed = status === 'SUBSCRIBED';
    if (pushed && !was) tick(); // back after a gap: catch up once
  });
}
export function stopInvites() {
  if (beat) clearTimeout(beat);
  sub?.remove();
  if (line) supabase.removeChannel(line);
  beat = null;
  sub = null;
  line = null;
  pushed = false;
  useInvites.setState({ list: [], bannered: [], say: null, asking: null });
}

export const markBannered = (id: string) => useInvites.setState((s) => ({ bannered: [...s.bannered, id] }));

const lobby = (game: string, room: string) => router.push(`/play/${game}/lobby?room=${room}`);

/** Join a friend's challenge: takes you straight to their lobby. */
export async function acceptInvite(inv: Invite) {
  markBannered(inv.id);
  try {
    const r = await respondInvite(inv.id, true, useAccount.getState().profile?.avatar);
    if ((r.result === 'joined' || r.result === 'spectating') && 'room_id' in r && r.room_id) lobby(inv.game, r.room_id);
    else useInvites.setState({ say: JOIN_SAY[r.result] ?? JOIN_SAY.error });
  } catch (e) {
    useInvites.setState({ say: sayError(e) });
  }
  await loadInvites().catch(() => {});
}

/** Challenge a friend (ON24): opens a private room (or reuses your open lobby) and sends the invite. */
export async function challenge(friendId: string, game: string, settings: Record<string, unknown>) {
  const r = await challengeFriend(friendId, game as Invite['game'], settings, useAccount.getState().profile?.avatar);
  if (r.result === 'sent' && r.room_id) lobby(game, r.room_id);
  return r.result;
}

/**
 * Watch a friend's running match (#80). Since #16 the friend is asked first (unless they chose Always allow for you):
 * the request waits up to 20 s for their answer, then you join their room as a watcher and land on the watch screen.
 * Every outcome that isn't watching says why in `say` (shown wherever you tapped Watch).
 */
export async function watch(friendId: string, game: string, name = 'your friend') {
  try {
    const r = await watchFriend(friendId, useAccount.getState().profile?.avatar);
    if (r.result === 'asked') {
      useInvites.setState({ asking: { ask: r.ask, name, friendId, game }, say: null });
      return waitForAnswer(r.ask);
    }
    return enter(r, game);
  } catch (e) {
    useInvites.setState({ say: sayError(e) });
    return 'error';
  }
}

function enter(r: Awaited<ReturnType<typeof watchFriend>>, game: string) {
  if ((r.result === 'joined' || r.result === 'spectating') && 'room_id' in r && r.room_id) lobby(game, r.room_id);
  else useInvites.setState({ say: JOIN_SAY[r.result] ?? JOIN_SAY.error });
  return r.result;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function waitForAnswer(ask: string): Promise<string> {
  const until = Date.now() + 24_000;
  while (Date.now() < until) {
    await sleep(2000);
    const a = useInvites.getState().asking;
    if (a?.ask !== ask) return 'cancelled'; // Cancel was tapped
    let st: string;
    try {
      st = (await watchAskState(ask)).status;
    } catch {
      continue; // a missed check; the next one tries again
    }
    if (st === 'open') continue;
    useInvites.setState({ asking: null });
    if (st === 'allowed') {
      const r = await watchFriend(a.friendId, useAccount.getState().profile?.avatar);
      if (r.result === 'asked') {
        useInvites.setState({ say: JOIN_SAY.error });
        return 'error';
      }
      return enter(r, a.game);
    }
    useInvites.setState({ say: st === 'declined' ? JOIN_SAY.declined : st === 'cancelled' ? null : JOIN_SAY.no_answer });
    return st;
  }
  useInvites.setState({ asking: null, say: JOIN_SAY.no_answer });
  return 'expired';
}

/** Cancel on the "Waiting for … to allow" card. */
export function cancelAsking() {
  const a = useInvites.getState().asking;
  useInvites.setState({ asking: null });
  if (a) cancelWatch(a.ask).catch(() => {});
}
