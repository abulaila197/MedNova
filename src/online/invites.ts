import { router } from 'expo-router';
import { AppState, type NativeEventSubscription } from 'react-native';
import { create } from 'zustand';

import { useAccount } from '@/state/account';

import { challengeFriend, JOIN_SAY, myInvites, respondInvite, type Invite } from './api';
import { keepIfSame } from './same';

/** ON24: open challenges to you. `bannered` = already shown as the top banner once (Later keeps them on Friends). */
type State = { list: Invite[]; bannered: string[]; say: string | null };
export const useInvites = create<State>(() => ({ list: [], bannered: [], say: null }));

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
  useInvites.setState({ list: [], bannered: [], say: null });
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
