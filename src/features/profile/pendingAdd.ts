// A friend link (mednova://add/CODE) opened by a guest: the code waits here through sign-in or sign-up, then the
// Add friend sheet opens with it (AP10g). Kept in memory only; a restart forgets it.
let pending: string | null = null;

export const keepAddCode = (code: string) => void (pending = code);

/** The waiting code, once. */
export function takeAddCode() {
  const c = pending;
  pending = null;
  return c;
}
