import type { GameDef } from '@/games/shell/types';

/** "Medium · 5 cases · 2 teams" from a room's settings, using the game's own option labels. */
export function settingsLine(def: GameDef | null | undefined, settings: Record<string, unknown>) {
  const parts = (def?.setup.online ?? []).map((o) => {
    const v = settings[o.key];
    const c = o.choices.find((x) => x.value === v);
    const label = c?.label ?? String(v ?? o.initial);
    // "10 min time limit", but "2 cases" stays as it is.
    const named = label.toLowerCase().includes(o.label.toLowerCase().replace(/s$/, ''));
    return typeof (c?.value ?? o.initial) === 'number' && !named ? `${label} ${o.label.toLowerCase()}` : label;
  });
  const teams = Number(settings.teams) || 0;
  if (def?.teams?.online) parts.push(teams >= 2 ? `${teams} teams` : 'Teams off');
  return parts.join(' · ');
}

/** The app link that joins a room (#50). Becomes an https link once the website exists. */
export const roomLink = (code: string, game: string) => `mednova://join/${code}?g=${encodeURIComponent(game)}`;

/** What Share sends from a lobby (#50): the link that opens the room, and the code to type as a fallback. */
export const roomShareText = (gameName: string, code: string, game: string) =>
  `Join my ${gameName} room on MedNova: ${roomLink(code, game)}\nOr type the room code ${code.slice(0, 3)} ${code.slice(3)}`;
