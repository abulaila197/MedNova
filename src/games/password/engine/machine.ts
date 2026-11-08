import type { Effect, Step } from './types';

/** State machines are plain functions: (env, state, event) -> { state, effects }. No I/O inside. */
export const step = <S, E = unknown>(state: S, effects: Effect<E>[] = []): Step<S, E> => ({ state, effects });
export const stay = <S, E = unknown>(state: S): Step<S, E> => ({ state, effects: [] });
