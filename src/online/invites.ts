import { router } from 'expo-router';
import { AppState, type NativeEventSubscription } from 'react-native';
import { create } from 'zustand';

import { useAccount } from '@/state/account';

import { cancelWatch, challengeFriend, JOIN_SAY, myInvites, respondInvite, watchAskState, watchFriend, type Invite } from './api';
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

let beat: ReturnType<typeof setInterval> | null = null;
let sub: NativeEventSubscription | null = null;

/** Checks for challenges every 15 s while the app is open and you're signed in. Phone push comes later (ON24). */
export function startInvites() {
  stopInvites();
  const tick = () => AppState.currentState === 'active' && loadInvites().catch(() => {});
  tick();
  beat = setInterval(tick, 15000);
  sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
}
export function stopInvites() {
  if (beat) clearInterval(beat);
  sub?.remove();
  beat = null;
  sub = null;
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
  } catch {
    useInvites.setState({ say: JOIN_SAY.error });
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
  } catch {
    useInvites.setState({ say: JOIN_SAY.error });
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
