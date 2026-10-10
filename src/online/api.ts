// Online rooms (ON1-ON27): thin wrappers over the Supabase functions that run the rooms and referee the match (ON17).
import { supabase } from '@/lib/supabase';
import type { GameKey } from '@/games/engine/types';

export const call = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export type JoinResult = { result: 'joined' | 'spectating' | 'full' | 'closed' | 'not_found' | 'removed'; room_id?: string };

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
  room: { id: string; code: string; game: GameKey; host: string; is_public: boolean; settings: Record<string, unknown>; status: RoomStatus; match_id: string | null; closes_at: number };
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
export const myInvites = () => call<Invite[]>('my_challenges');
export const respondInvite = (invite: string, accept: boolean, wanted?: string) =>
  call<JoinResult | { result: 'declined' | 'expired' | 'not_found' }>('respond_invite', { invite, accept, wanted: wanted ?? null });

/** Words for a failed join (ON14, ON19, ON26). */
export const JOIN_SAY: Record<string, string> = {
  full: 'That room is full.',
  closed: 'That room has closed.',
  not_found: 'No open room has that code.',
  removed: 'The host removed you from that room.',
  expired: 'That challenge has ended.',
  error: 'Couldn’t reach the server. Check your connection.',
};
