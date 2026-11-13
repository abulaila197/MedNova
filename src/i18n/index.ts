import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform } from 'react-native';

import { AR } from './ar';
import { AR_FRAME } from './ar-frame';
import { localizeGames } from './ar-games';
import { AR_PLAY } from './ar-play';
import { setSay } from './say';

/**
 * Arabic (Yazan 2026-11-13). The app speaks English or Arabic; Arabic screens run right to left.
 * The choice is "phone" (follow the phone's language, the default), "en" or "ar", saved on the phone. The language is
 * fixed for a run of the app: changing it saves the choice and restarts the app, so every screen, style and list
 * is built once in the right language and direction.
 * Texts are looked up by their English wording: t('Settings') gives the Arabic when there is one, else the English.
 * Medical questions, answers and words stay English (Yazan 2026-11-12), so they never go through t().
 */
export type Lang = 'en' | 'ar';
export type LangChoice = 'phone' | Lang;

const KEY = 'mednova:lang';
const RELOADED = 'mednova:lang_reloaded';

const store = () => (globalThis as { localStorage?: Storage }).localStorage;
function read<T>(k: string): T | null {
  try {
    const v = store()?.getItem(k);
    return v == null ? null : (JSON.parse(v) as T);
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    store()?.setItem(k, JSON.stringify(v));
  } catch {}
}

function phoneLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

const saved = read<LangChoice>(KEY);
const CHOICE: LangChoice = saved === 'en' || saved === 'ar' ? saved : 'phone';
const LANG: Lang = CHOICE === 'phone' ? phoneLang() : CHOICE;

/** The language this run of the app speaks. */
export const lang = (): Lang => LANG;
export const isAr = LANG === 'ar';
if (isAr) localizeGames();
/** What the player picked in Settings. */
export const langChoice = (): LangChoice => CHOICE;

/** The text in the app's language; `{name}` marks are filled from `vars`. */
export function t(en: string, vars?: Record<string, unknown>): string {
  // A key may carry a context after '|' ('pack|shop') when one English word needs two Arabic ones; English drops it.
  let s = isAr ? (AR[en] ?? AR_FRAME[en] ?? AR_PLAY[en] ?? en) : en;
  const bar = s.indexOf('|');
  if (bar > 0 && s === en) s = s.slice(0, bar);
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

/**
 * Sets the screen direction for this run. Native apps learn a new direction only on a restart, so when the saved
 * direction is wrong the app restarts once (never twice in a row, so a phone that refuses can't loop).
 */
export function bootDirection() {
  const rtl = isAr;
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = LANG;
    }
    return;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  if (I18nManager.isRTL === rtl) {
    write(RELOADED, false);
    return;
  }
  if (read<boolean>(RELOADED)) return;
  write(RELOADED, true);
  void reloadAppAsync('Language direction changed');
}

/** Saves the Settings pick and restarts the app in that language. */
export function setLangChoice(c: LangChoice) {
  if (c === CHOICE) return;
  write(KEY, c);
  const next: Lang = c === 'phone' ? phoneLang() : c;
  if (Platform.OS === 'web') {
    if (typeof location !== 'undefined') location.reload();
    return;
  }
  I18nManager.allowRTL(next === 'ar');
  I18nManager.forceRTL(next === 'ar');
  write(RELOADED, false);
  void reloadAppAsync('Language changed');
}

/** Arabic letters in a text: such a text takes the Arabic fonts. */
export const AR_LETTERS = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** Same as t(), under a name that never clashes with the `t` theme variable most screens use. */
export const tr = t;
setSay(t);

/** Text alignment to the reading start / end. Native RTL already swaps left and right; the web preview does not. */
const WEB_FLIP = Platform.OS === 'web' && isAr;
export const TA_START = (WEB_FLIP ? 'right' : 'left') as 'left' | 'right';
export const TA_END = (WEB_FLIP ? 'left' : 'right') as 'left' | 'right';

/** English word boards (crossword grid, letter slots, keyboards) stay left to right in Arabic. */
export const LTR = { direction: 'ltr' } as const;
export const LTR_WEB = (Platform.OS === 'web' ? { dir: 'ltr' } : {}) as object;
