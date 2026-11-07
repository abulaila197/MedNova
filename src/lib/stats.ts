// Firebase crash reports + simple stats (Group 2, Yazan 2026-11-07: "Crash reports + simple stats"). The web preview
// has neither: this file is the stand-in there; phones load stats.native.ts. Keep the exports the same.

/** Ad-free analytics consent: stats on, every ad signal off. Safe to call more than once. */
export async function startStats(): Promise<void> {}
/** Which page is open (no names, no text a player typed). */
export function screen(_path: string): void {}
/** A simple game event: which game and mode started or finished. */
export function stat(_name: 'game_start' | 'game_end' | 'ad_watched', _p: Record<string, string | number> = {}): void {}
/** Ties crash reports to the account id (not the name or email) so a reported crash can be found. */
export function crashUser(_id: string | null): void {}
