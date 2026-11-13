import type { GameDef } from '@/games/shell/types';
import { isAr, tr } from '@/i18n';
import { countOf } from '@/i18n/plural';

/** "Medium · 5 cases · 2 teams" from a Vs bots play's settings, using the game's own option labels. */
export function settingsLine(def: GameDef | null | undefined, settings: Record<string, unknown>) {
  const parts = (def?.setup.bots ?? []).map((o) => {
    const v = settings[o.key];
    const c = o.choices.find((x) => x.value === v);
    const label = tr(c?.label ?? String(v ?? o.initial));
    const num = c?.value ?? o.initial;
    // Arabic (Yazan 2026-11-13): "subject: choice", the count agreeing with its noun ("الحالات: حالة واحدة",
    // "كام منافس" -> "3 منافسين").
    if (isAr) {
      const head = tr(o.label);
      if (typeof num === 'number' && head.startsWith('كام ')) return countOf(num, head.slice(4));
      if (typeof num === 'number' && /^\d+$/.test(label)) return `${head}: ${countOf(num, head)}`;
      return `${head}: ${label}`;
    }
    // "10 min time limit", but "2 cases" stays as it is.
    const named = (c?.label ?? String(v ?? o.initial)).toLowerCase().includes(o.label.toLowerCase().replace(/s$/, ''));
    return typeof (c?.value ?? o.initial) === 'number' && !named ? `${label} ${tr(o.label).toLowerCase()}` : label;
  });
  const teams = Array.isArray(settings.teams) ? settings.teams.length : Number(settings.botTeams) || 0;
  if (def?.teams?.bots) parts.push(teams >= 2 ? tr('{n} teams', { n: teams }) : tr('Teams off'));
  return parts.join(' · ');
}
