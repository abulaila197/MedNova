/**
 * The translator for game logic that Node tests also load (they can't load '@/i18n' and its Expo modules).
 * English until '@/i18n' plugs the real one in at start; call it when a text is made, never at module load.
 */
type Say = (en: string, vars?: Record<string, unknown>) => string;

const fill: Say = (en, vars) => {
  let s = en;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};
let current: Say = fill;

export const say: Say = (en, vars) => current(en, vars);
export const setSay = (f: Say) => {
  current = f;
};
