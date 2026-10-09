// Extra fields some pages need beyond the engine's view, computed on the server from the full game. Each page
// builder adds its own fields here under its own key; only this player's own facts (or what everyone may see).
import type { Game, PlayerId } from './engine';

export function extrasFor(g: Game, me: PlayerId) {
  return {
    /** Who I accused in an open Inquisition (null = not yet). */
    accused: g.inquisitionVotes[me] ?? null,
    /** My Last Supper choice this month (undefined = not chosen yet, null = nobody). */
    lastSupper: g.lastSupper[me],
    /** Who already pressed Skip in this Gap step. */
    skipped: g.skipped,
  };
}
