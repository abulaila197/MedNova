import { AppState } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

/** A friend or a request (FR1-FR4). `kind`: friend, incoming (they asked you) or outgoing (you asked them). */
export type Friend = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  level: number;
  last_seen: string | null;
  kind: 'friend' | 'incoming' | 'outgoing';
};
export type Blocked = { id: string; username: string; display_name: string; avatar: string };

/** What the server says when you send a request by code (FR2). */
export type RequestResult = 'sent' | 'accepted' | 'already' | 'pending' | 'self' | 'not_found' | 'unavailable';

type State = { list: Friend[]; blocked: Blocked[]; loaded: boolean };
export const useFriends = create<State>(() => ({ list: [], blocked: [], loaded: false }));

const call = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/** Reloads friends, requests and blocked players from the server. */
export async function loadFriends() {
  const [list, blocked] = await Promise.all([call<Friend[]>('my_friends'), call<Blocked[]>('my_blocks')]);
  useFriends.setState({ list: list ?? [], blocked: blocked ?? [], loaded: true });
}

export async function requestFriend(code: string) {
  const r = await call<RequestResult>('request_friend', { code });
  if (r === 'sent' || r === 'accepted') await loadFriends();
  return r;
}

export async function respondFriend(id: string, accept: boolean) {
  await call('respond_friend', { other: id, accept });
  await loadFriends();
}

export async function removeFriend(id: string) {
  await call('remove_friend', { other: id });
  await loadFriends();
}

export async function blockUser(id: string) {
  await call('block_user', { other: id });
  await loadFriends();
}

export async function unblockUser(id: string) {
  await call('unblock_user', { other: id });
  await loadFriends();
}

export function clearFriends() {
  useFriends.setState({ list: [], blocked: [], loaded: false });
}

/** FR4: "ONLINE" while seen in the last 2 minutes, else how long ago. */
export function seenLabel(lastSeen: string | null, now = Date.now()) {
  if (!lastSeen) return 'NOT SEEN YET';
  const m = Math.floor((now - Date.parse(lastSeen)) / 60000);
  if (m < 2) return 'ONLINE';
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'YESTERDAY';
  if (d < 30) return `${d} DAYS AGO`;
  return 'A WHILE AGO';
}

let beat: ReturnType<typeof setInterval> | null = null;
let sub: { remove: () => void } | null = null;
/** While signed in and the app is open: mark yourself seen every minute and refresh the list (FR4). */
export function startPresence() {
  stopPresence();
  const tick = () => {
    if (AppState.currentState !== 'active') return;
    void call('touch_seen').catch(() => {});
    void loadFriends().catch(() => {});
  };
  tick();
  beat = setInterval(tick, 60000);
  sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
}
export function stopPresence() {
  if (beat) clearInterval(beat);
  sub?.remove();
  beat = null;
  sub = null;
  clearFriends();
}
