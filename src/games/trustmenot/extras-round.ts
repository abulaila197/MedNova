// Extra envelope fields for the round pages, computed on the server from the full game (owned by the round pages builder).
// Only this player's own facts, or what everyone in the camp may see. Never another player's secret.
import type { Game, PlayerId } from './engine';

export function roundExtras(_g: Game, _me: PlayerId) {
  return {};
}
