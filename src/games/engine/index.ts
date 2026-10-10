import { defaultKV } from './storage';
import { createRecorder } from './recorder';
import { createWallet } from './wallet';
import { createGate } from './gate';
import { createPicker } from './picker';

export * from './types';
export * from './storage';
export * from './recorder';
export * from './wallet';
export * from './levels';
export * from './gate';
export * from './picker';
export * from './standings';

/** One shared engine instance for the app. */
const kv = defaultKV();
export const engine = {
  kv,
  recorder: createRecorder(kv),
  wallet: createWallet(kv),
  gate: createGate(kv),
  picker: createPicker(kv),
};
