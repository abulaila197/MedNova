// Account-scoped stores register a reset here; it runs whenever the signed-in account changes (sign-out by the
// button, a sign-out from another phone, an expired session, or a different account signing in), so nothing the
// previous account loaded stays on screen (AP3). Kept free of imports so any store can use it without a cycle.

const resets = new Set<() => void>();

/** Registers a reset for one store. Returns the unregister function. */
export function onAccountSwitch(reset: () => void) {
  resets.add(reset);
  return () => void resets.delete(reset);
}

/** Runs every registered reset (called by state/account.ts). */
export function runAccountSwitch() {
  for (const r of resets) {
    try {
      r();
    } catch {}
  }
}
