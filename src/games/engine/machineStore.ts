// Bridge between a game's pure reducer and Zustand (the copy used by Medicordle and Streak Master).
import { create } from 'zustand';

export interface MachineStoreState<S, E, F> {
  machine: S;
  signal: { seq: number; effect: F } | null;
  dispatch: (event: E) => void;
  reset: (state: S) => void;
}

export interface MachineContext<S, E> {
  dispatch: (event: E) => void;
  getMachine: () => S;
}

export interface MachineStoreOptions<S, E, F> {
  initial: S;
  reduce: (state: S, event: E) => { state: S; effects: F[] };
  runEffect: (effect: F, ctx: MachineContext<S, E>) => void;
  isSignal?: (effect: F) => boolean;
}

export function createMachineStore<S, E, F>(opts: MachineStoreOptions<S, E, F>) {
  return create<MachineStoreState<S, E, F>>()((set, get) => ({
    machine: opts.initial,
    signal: null,
    reset: (machine) => set({ machine, signal: null }),
    dispatch: (event) => {
      const { state, effects } = opts.reduce(get().machine, event);
      let signal = get().signal;
      for (const effect of effects) {
        if (opts.isSignal?.(effect)) signal = { seq: (signal?.seq ?? 0) + 1, effect };
      }
      if (state !== get().machine || signal !== get().signal) set({ machine: state, signal });
      const ctx: MachineContext<S, E> = { dispatch: get().dispatch, getMachine: () => get().machine };
      for (const effect of effects) opts.runEffect(effect, ctx);
    },
  }));
}

export function startTicker(tick: () => void, intervalMs: number): () => void {
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
