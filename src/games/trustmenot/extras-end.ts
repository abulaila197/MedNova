// Extra envelope fields for the end pages, computed on the server from the full game (owned by the end pages builder).
// Only this player's own facts, or what everyone in the camp may see. Never another player's secret.
import type { Game, PlayerId } from './engine';

export function endExtras(_g: Game, _me: PlayerId) {
  return {};
}
