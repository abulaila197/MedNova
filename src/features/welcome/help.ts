import type { Stop } from './tour';

// Page help (Yazan 2026-10-21): the first visit to these pages explains what they're for, in the welcome tour's panel.
export const HELP: Record<string, Stop[]> = {
  '/profile': [
    { who: 'atlas', title: 'This is you', text: 'Your level, EXP and stats for every game live here, and each new level pays tokens.' },
    { who: 'atlas', title: 'Make it yours', text: 'Change character picks the face everyone sees. Change frame and Change title dress your name with what you own.' },
    { who: 'atlas', title: 'Want more looks?', text: 'New frames, titles, win effects and stickers are in the Style shop. My Profile, first in the menu, brings you back here any time.' },
  ],
  '/style': [
    { who: 'yara', title: 'The Style shop', text: 'Dress your name with tokens: frames around your picture, titles under your name, win effects and sticker packs.' },
    { who: 'yara', title: 'Try, buy, wear', text: 'Tap anything to see it on you at the top. Buy it once, then Wear it whenever you like. Win effects have Try it too.' },
    { who: 'yara', title: 'Deals and gifts', text: 'One frame and one title are cheaper every week. You can also Gift an item to a friend, and some items are only earned, never sold.' },
  ],
  '/challenges': [
    { who: 'bolt', title: 'Daily missions', text: 'Three missions every day, done in order: the second starts counting only when the first is finished.' },
    { who: 'bolt', title: 'A chest for each', text: 'Finish them for a wooden, a golden and a diamond chest. Finish all three five days in a row for an epic chest.' },
  ],
  '/chests': [
    { who: 'pip', title: 'Your chests', text: 'Chests you earn from daily missions wait here. Tap one to open it.' },
    { who: 'pip', title: 'What’s inside', text: 'Tokens, chat stickers, rare win effects and Nova Mechs cards. Better chests hold rarer things, and a card you already have turns into tokens.' },
  ],
};
