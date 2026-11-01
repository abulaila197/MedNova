// Online rooms (ON1-ON27): thin wrappers over the Supabase functions that run the rooms and referee the match (ON17).
import { supabase } from '@/lib/supabase';
import type { GameKey } from '@/games/engine/types';

export const call = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/** One request to an edge function (the referees of Conqueror, Wheels and Trust Me Not, account removal). */
export const invoke = async <T = unknown>(fn: string, body?: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke(fn, { method: 'POST', body });
  if (error) throw error;
  return data as T;
};

export type JoinResult = { result: 'joined' | 'spectating' | 'full' | 'closed' | 'not_found' | 'removed' | 'in_progress' | 'not_playing'; room_id?: string };

export type PublicRoom = { id: string; code: string; host_name: string; host_avatar: string | null; host_level: number; players: number; settings: Record<string, unknown> };

export type Seat = {
  user_id: string;
  name: string;
  username: string;
  character: string;
  ready: boolean;
  team: number | null;
  state: 'in' | 'spectator';
  level: number;
};

export type RoomStatus = 'lobby' | 'playing' | 'finished' | 'closed';

export type RoomState = {
  result: 'ok' | 'not_member';
  now: number;
  me: string;
  // room.host is null only on a room that closed after its host deleted their account (rooms_rehost trigger).
  room: { id: string; code: string; game: GameKey; host: string | null; is_public: boolean; settings: Record<string, unknown>; status: RoomStatus; match_id: string | null; closes_at: number };
  players: Seat[];
};

export type Invite = {
  id: string;
  room_id: string;
  code: string;
  game: GameKey;
  settings: Record<string, unknown>;
  from_user: string;
  username: string;
  display_name: string;
  avatar: string;
  level: number;
  created_at: string;
  expires_at: string;
};

export const createRoom = (game: GameKey, settings: Record<string, unknown>, isPublic: boolean, wanted?: string) =>
  call<string>('create_room', { game, settings, is_public: isPublic, wanted: wanted ?? null });
export const joinRoom = (code: string, wanted?: string) => call<JoinResult>('join_room', { code, wanted: wanted ?? null });
export const joinRoomId = (r: string, wanted?: string) => call<JoinResult>('join_room_id', { r, wanted: wanted ?? null });
export const leaveRoom = (r: string) => call<void>('leave_room', { r });
export const roomState = (r: string) => call<RoomState>('room_state', { r });
export const setCharacter = (r: string, slug: string) => call<void>('set_character', { r, slug });
export const setReady = (r: string, on: boolean) => call<void>('set_ready', { r, on_: on });
export const updateRoom = (r: string, settings: Record<string, unknown>, isPublic: boolean) => call<void>('update_room', { r, settings, is_public: isPublic });
export const setTeam = (r: string, who: string, team: number | null) => call<void>('set_team', { r, who, team });
export const removePlayer = (r: string, who: string) => call<void>('remove_player', { r, who });
export const listPublicRooms = (game: GameKey) => call<PublicRoom[]>('list_public_rooms', { game });
export const startMatch = (r: string) => call<string>('start_match', { r });
export const rematchRoom = (r: string) => call<void>('rematch_room', { r });

export const challengeFriend = (friend: string, game: GameKey, settings: Record<string, unknown>, wanted?: string) =>
  call<{ result: 'sent' | 'self' | 'not_friends'; room_id?: string; code?: string }>('challenge_friend', { friend, game, settings, wanted: wanted ?? null });
export const watchFriend = (friend: string, wanted?: string) =>
  call<JoinResult | { result: 'asked'; ask: string }>('watch_friend', { friend, wanted: wanted ?? null });
/** #16: a watch request waits for the player's answer (20 s). */
export const watchAskState = (ask: string) => call<{ status: 'open' | 'allowed' | 'declined' | 'cancelled' | 'expired' }>('watch_ask_state', { ask });
export const cancelWatch = (ask: string) => call<void>('cancel_watch', { ask });
export const answerWatch = (ask: string, answer: 'allow' | 'always' | 'decline') => call<{ result: 'ok' | 'expired' }>('answer_watch', { ask, answer });
export const watchAlwaysGet = (other: string) => call<boolean>('watch_always_get', { other });
export const watchAlwaysSet = (other: string, allow: boolean) => call<void>('watch_always_set', { other, allow });
/** The live page's check-in (every 5 s): my seat, who we're waiting for (#24) and who asks to watch me (#16). */
export type LiveInfo = {
  result: 'ok' | 'not_member';
  status?: string;
  me?: 'in' | 'spectator' | 'left' | 'removed' | null;
  waiting?: { user_id: string; name: string; gone_ms: number }[];
  asks?: { id: string; name: string; avatar: string; left_ms: number }[];
};
export const roomLive = (r: string) => call<LiveInfo>('room_live', { r });
export const myInvites = () => call<Invite[]>('my_challenges');
export const respondInvite = (invite: string, accept: boolean, wanted?: string) =>
  call<JoinResult | { result: 'declined' | 'expired' | 'not_found' }>('respond_invite', { invite, accept, wanted: wanted ?? null });

/** Words for a failed join (ON14, ON19, ON26). */
// Busy line + weekly online share (Yazan 2026-11-01). The server refuses new rooms, joins and starts with
// 'online_resting <until>' when the week's online data share is used up, and new starts with 'online_busy' when too many
// players are online at once (the room then waits in line: onlineTurn).
export type OnlineStatus = { open: boolean; until: string | null; day?: string | null };
export const onlineStatus = () => call<OnlineStatus>('online_status');
export type Turn = { go?: boolean; place: number; busy?: boolean };
export const onlineTurn = (r: string) => call<Turn>('online_turn', { r });
const errText = (e: unknown) => String((e as { message?: string } | null)?.message ?? e ?? '');
export const isBusy = (e: unknown) => errText(e).includes('online_busy');
/** The day online opens again ("Saturday 7 Nov", Cairo time, from the server), or null if the call failed for another reason. */
export const restingUntil = (e: unknown): string | null => {
  const m = errText(e).match(/online_resting\s*([^\n]*)/);
  return m ? m[1].trim() : null;
};
export const restingSay = (day: string | null) =>
  `Online play is resting until ${day || 'Saturday'}. Our free server shares its online time across the weeks, and this week’s share is used up. Solo and Pass the phone still work.`;
/** What to say for a failed room call. */
export const sayError = (e: unknown) => {
  const until = restingUntil(e);
  if (until !== null) return restingSay(until);
  if (isBusy(e)) return 'Servers are busy right now. Tap Start to wait in line.';
  if (errText(e).includes('watchers_full')) return 'This match already has 3 watchers. Try again at the rematch.';
  return JOIN_SAY.error;
};

export const JOIN_SAY: Record<string, string> = {
  full: 'That room is full.',
  closed: 'That room has closed.',
  not_found: 'No open room has that code.',
  removed: 'The host removed you from that room.',
  expired: 'That challenge has ended.',
  in_progress: 'That public match has started. Only friends of its players can watch; join at the rematch.',
  not_playing: 'They aren’t in a match right now.',
  declined: 'They said no to being watched this time.',
  no_answer: 'They didn’t answer, so you can’t watch this time.',
  error: 'Couldn’t reach the server. Check your connection.',
};
