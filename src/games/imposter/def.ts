import type { GameDef } from '../shell/types';
import { OfflinePlay } from './OfflinePlay';
import { BANK } from './offline';

const count = (kind: string) => BANK.pairs.filter((p) => p.subtype === kind).length.toLocaleString('en-US');
const pairById = new Map(BANK.pairs.map((p) => [p.id, p]));

const STYLE = {
  key: 'style',
  label: 'Words',
  choices: [
    { value: 'mixed', label: 'Mixed', note: 'either, each round' },
    { value: 'clinical', label: 'Clinical', note: `${count('clinical')} pairs` },
    { value: 'basic', label: 'Basic science', note: `${count('basic')} pairs` },
  ],
  initial: 'mixed',
};

const ROUNDS = {
  key: 'rounds',
  label: 'Rounds',
  choices: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
  initial: 3,
};

/** Imposter (IM1-IM7): 3 to 6 players, one has a different word and doesn't know it. Pass the phone, then Online. */
export const imposter: GameDef = {
  key: 'imposter',
  modes: [
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Everyone gets the same word but one. Find who walked in.',
      howTo: [
        'Add 3 to 6 players. Pick clinical, basic science or mixed words, and 1 to 5 rounds.',
        'Pass the phone: each player holds to see their word. One player has a different, related word, and nobody knows who, not even them.',
        'Say one-word clues out loud, in order, for two turns. Then vote now or hear one more turn.',
        'Pass the phone round to vote. Catch the imposter for 2 points each. A caught imposter can still guess your word for 1.',
        'An imposter who gets away scores 2, plus 1 for every wrong vote. No EXP in this mode.',
      ],
    },
  ],
  setup: { offline: [STYLE, ROUNDS] },
  players: { offline: { min: 3, max: 6 } },
  playersNote: () => 'Player 1 is you, the phone owner, who checks a caught imposter\'s guess. Pass the phone earns no EXP.',
  Play: { offline: OfflinePlay },
  // IM4: online EXP is the points twice over, at most 60; Pass the phone earns none, like every Pass the phone mode.
  exp: (score) => Math.min(60, Math.max(0, 2 * score)),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : 60),
  itemLabel: (item) => {
    const p = pairById.get(item.itemId);
    return p ? `${p.a.word} / ${p.b.word}${item.gameData.imposter ? ' · imposter' : ''}` : item.itemId;
  },
  itemNoun: 'round',
  itemsTitle: 'Rounds',
};
