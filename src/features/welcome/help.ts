import type { Stop } from './tour';

// Page help (Yazan 2026-10-21): the first visit to these pages explains what they're for, in the welcome tour's panel.
// Simpler page tours (Yazan 2026-11-15): one short stop per page, like the 5-stop welcome tour.
export const HELP: Record<string, Stop[]> = {
  '/profile': [{ who: 'atlas', title: 'Your profile', text: 'Your level, EXP and game stats. Change your character, frame and title here.' }],
  '/style': [{ who: 'yara', title: 'The Style shop', text: 'Buy frames, titles, win effects and stickers with tokens, then tap Wear. Some items are cheaper each week.' }],
  '/challenges': [{ who: 'bolt', title: 'Daily missions', text: 'Three missions a day, done in order. They pay 10, 30 and 50 tokens.' }],
  '/chests': [{ who: 'pip', title: 'Your chests', text: 'Chests you earn wait here. Open them for tokens, stickers, win effects and Nova Mechs cards.' }],
};
