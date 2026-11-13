import type { GameDef } from '@/games/shell/types';
import { tr } from '@/i18n';

/** "Medium · 5 cases · 2 teams" from a Vs bots play's settings, using the game's own option labels. */
export function settingsLine(def: GameDef | null | undefined, settings: Record<string, unknown>) {
  const parts = (def?.setup.bots ?? []).map((o) => {
    const v = settings[o.key];
    const c = o.choices.find((x) => x.value === v);
    const label = tr(c?.label ?? String(v ?? o.initial));
    // "10 min time limit", but "2 cases" stays as it is.
    const named = (c?.label ?? String(v ?? o.initial)).toLowerCase().includes(o.label.toLowerCase().replace(/s$/, ''));
    return typeof (c?.value ?? o.initial) === 'number' && !named ? `${label} ${tr(o.label).toLowerCase()}` : label;
  });
  const teams = Array.isArray(settings.teams) ? settings.teams.length : Number(settings.botTeams) || 0;
  if (def?.teams?.bots) parts.push(teams >= 2 ? tr('{n} teams', { n: teams }) : tr('Teams off'));
  return parts.join(' · ');
}
