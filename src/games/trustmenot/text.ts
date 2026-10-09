// Trust Me Not words shared by every page: item, effect and meal names, and the question text the phone holds.
import type { EffectId, ItemId, MealId } from './engine';
import QUESTIONS from './data/questions.json';

export const ITEM: Record<ItemId, { name: string; does: string }> = {
  ors: { name: 'ORS', does: 'cures Dehydrated' },
  'protein-ration': { name: 'Protein ration', does: 'cures Weak' },
  'honey-lozenges': { name: 'Honey lozenges', does: 'cures Hoarse' },
  blanket: { name: 'Blanket', does: 'cures Frostbitten' },
  paracetamol: { name: 'Paracetamol', does: 'cures Feverish' },
  iron: { name: 'Iron', does: 'cures Anemic' },
  'map-and-compass': { name: 'Map and compass', does: 'cures Lost' },
  'snake-antivenom': { name: 'Snake antivenom', does: 'cures Snakebite' },
  'rabies-vaccine': { name: 'Rabies vaccine', does: 'cures Dog bite, before rabies' },
  'activated-charcoal': { name: 'Activated charcoal', does: 'cures Poisoned' },
  doxycycline: { name: 'Doxycycline', does: 'cures Rat bite' },
  'first-aid': { name: 'First aid', does: '-10 personal damage' },
  'lock-box': { name: 'Lock box', does: 'guards 2 jewels' },
  lantern: { name: 'Lantern', does: 'finds a Snare' },
  'hooded-cloak': { name: 'Hooded cloak', does: "can't be targeted" },
  'pocket-guide': { name: 'Pocket guide', does: 'one 50/50 in a round' },
  stethoscope: { name: 'Stethoscope', does: '+10 s once' },
  snare: { name: 'Snare', does: 'trap a player' },
};

export const EFFECT: Record<EffectId, { name: string; does: string }> = {
  dehydrated: { name: 'Dehydrated', does: 'question timer 30% shorter' },
  weak: { name: 'Weak', does: 'win at most 1 jewel a round' },
  hoarse: { name: 'Hoarse', does: "can't chat or send voice lines" },
  frostbitten: { name: 'Frostbitten', does: 'answers freeze: tap 7 times' },
  feverish: { name: 'Feverish', does: 'answer letters flicker' },
  anemic: { name: 'Anemic', does: 'health capped at 70%' },
  lost: { name: 'Lost', does: "can't buy in the next Gap" },
  snakebite: { name: 'Snakebite', does: '-10, then -5 a month' },
  'dog-bite': { name: 'Dog bite', does: 'rabies after 2 months' },
  poisoned: { name: 'Poisoned', does: 'food heals nothing, -5 a month' },
  'rat-bite': { name: 'Rat bite', does: 'spreads with your gifts' },
};

export const MEAL: Record<MealId, string> = { scraps: 'Scraps', basic: 'Basic', feast: 'Feast', skip: 'Skip' };

type QText = { q: string; c: string[]; t: string; d?: string };
const BANK = QUESTIONS as Record<string, QText>;
/** A question's text and choices by bank id (the server sends ids only). */
export const question = (id: string): { q: string; choices: string[]; topic: string; dossier?: string } => {
  const x = BANK[id];
  return x ? { q: x.q, choices: x.c, topic: x.t, dossier: x.d } : { q: '', choices: ['', '', ''], topic: '' };
};
