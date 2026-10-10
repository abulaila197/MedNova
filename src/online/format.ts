import type { GameDef } from '@/games/shell/types';

/** "Medium · 5 cases · 2 teams" from a room's settings, using the game's own option labels. */
export function settingsLine(def: GameDef | null | undefined, settings: Record<string, unknown>) {
  const parts = (def?.setup.online ?? []).map((o) => {
    const v = settings[o.key];
    const c = o.choices.find((x) => x.value === v);
    const label = c?.label ?? String(v ?? o.initial);
    return typeof (c?.value ?? o.initial) === 'number' ? `${label} ${o.label.toLowerCase()}` : label;
  });
  const teams = Number(settings.teams) || 0;
  if (def?.teams?.online) parts.push(teams >= 2 ? `${teams} teams` : 'Teams off');
  return parts.join(' · ');
}
