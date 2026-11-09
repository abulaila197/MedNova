import type { GameDef } from '@/games/shell/types';

/** "Medium · 5 cases · 2 teams" from a Vs bots play's settings, using the game's own option labels. */
export function settingsLine(def: GameDef | null | undefined, settings: Record<string, unknown>) {
  const parts = (def?.setup.bots ?? []).map((o) => {
    const v = settings[o.key];
    const c = o.choices.find((x) => x.value === v);
    const label = c?.label ?? String(v ?? o.initial);
    // "10 min time limit", but "2 cases" stays as it is.
    const named = label.toLowerCase().includes(o.label.toLowerCase().replace(/s$/, ''));
    return typeof (c?.value ?? o.initial) === 'number' && !named ? `${label} ${o.label.toLowerCase()}` : label;
  });
  const teams = Array.isArray(settings.teams) ? settings.teams.length : Number(settings.botTeams) || 0;
  if (def?.teams?.bots) parts.push(teams >= 2 ? `${teams} teams` : 'Teams off');
  return parts.join(' · ');
}
