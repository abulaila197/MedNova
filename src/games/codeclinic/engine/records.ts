import type { RecordPlayer, StyleChoice, Team, WinReason } from './types';

export type GameMode = 'offline' | 'online';

/** One finished game. Written to history, fed into stats and rewards. */
export interface GameRecord {
  id: string;
  mode: GameMode;
  style: StyleChoice;
  finishedAt: number;
  startingTeam: Team;
  winner: Team;
  winReason: WinReason;
  turns: number;
  players: RecordPlayer[];
}

export interface StatsRow {
  games: number;
  wins: number;
  asSpymaster: number;
  asGuesser: number;
}

export const emptyStats = (): StatsRow => ({ games: 0, wins: 0, asSpymaster: 0, asGuesser: 0 });

/**
 * Updates one stats row. `selfId` is the local player (online). Offline has no
 * accounts, so pass null: only the game count moves.
 */
export function applyGameToStats(row: StatsRow, record: GameRecord, selfId: string | null): StatsRow {
  const next = { ...row, games: row.games + 1 };
  if (selfId === null) return next;
  const me = record.players.find((p) => p.id === selfId);
  if (!me) return row; // we were not in this game
  if (me.team === record.winner) next.wins += 1;
  if (me.role === 'spymaster') next.asSpymaster += 1;
  else next.asGuesser += 1;
  return next;
}
