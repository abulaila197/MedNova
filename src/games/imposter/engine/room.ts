import { nextDeadline, reduce, type Env } from './engine';
import type { ProfanityChecker } from './profanity';
import type { ActionResult, GameAction, GameState, WordBank } from './types';
import { getView, type PlayerView } from './view';

export interface RoomDeps {
  bank: WordBank;
  profanity: ProfanityChecker;
  rng?: () => number;
  clock?: () => number;
}

const envOf = (deps: RoomDeps): Env => ({
  now: (deps.clock ?? Date.now)(),
  rng: deps.rng ?? Math.random,
  bank: deps.bank,
  profanity: deps.profanity,
});

/** Online: the action's playerId must be the authenticated user, never a value sent by the client. */
function withAuth(state: GameState, action: GameAction, authId?: string): GameAction | { error: string } {
  if (state.mode === 'offline' || action.type === 'TICK' || authId === undefined) return action;
  if ('playerId' in action && action.playerId !== authId) return { error: 'auth/mismatch' };
  return action;
}

/** In-memory room: use it on a long-running server, or on the offline device. */
export class GameRoom {
  state: GameState;
  constructor(state: GameState, private deps: RoomDeps) {
    this.state = state;
  }

  dispatch(action: GameAction, authId?: string): ActionResult {
    const checked = withAuth(this.state, action, authId);
    if ('error' in checked) return { state: this.state, events: [], error: { code: checked.error, message: 'Player mismatch.' } };
    const res = reduce(this.state, checked, envOf(this.deps));
    this.state = res.state;
    return res;
  }
  tick(): ActionResult {
    return this.dispatch({ type: 'TICK' });
  }
  nextDeadline(): number | null {
    return nextDeadline(this.state);
  }
  viewFor(id: string | null): PlayerView {
    return getView(this.state, id);
  }
}

/** For serverless backends (for example a Supabase Edge Function): load, apply, save with a version check. */
export interface RoomStore {
  load(roomId: string): Promise<{ state: GameState; version: number } | null>;
  /** Must return false when `expectedVersion` is no longer the stored version. */
  save(roomId: string, state: GameState, expectedVersion: number): Promise<boolean>;
}

export async function applyAction(
  store: RoomStore,
  deps: RoomDeps,
  roomId: string,
  authId: string | undefined,
  action: GameAction,
  retries = 3,
): Promise<ActionResult & { version: number }> {
  for (let i = 0; i <= retries; i++) {
    const row = await store.load(roomId);
    if (!row) throw new Error(`room ${roomId} not found`);
    const checked = withAuth(row.state, action, authId);
    if ('error' in checked)
      return { state: row.state, events: [], error: { code: checked.error, message: 'Player mismatch.' }, version: row.version };
    const res = reduce(row.state, checked, envOf(deps));
    if (await store.save(roomId, res.state, row.version)) return { ...res, version: row.version + 1 };
  }
  throw new Error('too many concurrent updates');
}
