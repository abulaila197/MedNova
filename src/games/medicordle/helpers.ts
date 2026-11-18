// Word Lab paid helpers (Yazan 2026-11-17): Endless and Vs rivals only, above the keyboard, never over the board.
import { COIN } from '@/components/CoinLabel';
import { useCallback } from 'react';

import { engine } from '../engine';
import type { HelperTone } from '../shell/ui';
import { CLEAR_COST, DEFINE_COST, HINT_COSTS, pickClear, pickHint, type Grant, type Help } from './core';
import { tr } from '@/i18n';

/** One payment at a time across the app: only one word board is ever on screen. */
let paying = false;

export type HelperProp = { label: string; tone: HelperTone; disabled?: boolean; onPress: () => void };

/**
 * The three helper buttons and their payments. One payment at a time, so a double tap can't pay twice (A2), and a
 * helper that arrives after its word ended is refunded (rule 18). `same()` says the word is still the one paid for.
 */
export function useHelpers(o: {
  playId: string;
  answer: string;
  guesses: string[];
  help: Help;
  /** The definition shows already (last try, or the hurry moment against rivals). */
  defShown: boolean;
  /** False once the word is over or the game is paused. */
  open: boolean;
  same: () => boolean;
  /** Word Surgeon: every letter is in the word, so there is nothing to clear. */
  surgeon?: boolean;
  grant: (g: Grant) => void;
  notice: (line: string) => void;
}): HelperProp[] {
  const { playId, notice, same, grant } = o;
  const buy = useCallback(
    async (cost: number, g: Grant, line: string) => {
      if (paying) return;
      paying = true;
      try {
        const receipt = await engine.wallet.spend(cost, 'medicordle_hint', playId);
        if (!receipt) return notice(tr('You need {cost} token{n}. Each level up gives 1 token.', { cost, n: cost > 1 ? 's' : '' }));
        if (!same()) {
          await engine.wallet.refund(receipt);
          return notice(tr('Hint refunded.'));
        }
        grant(g);
        notice(line);
      } finally {
        paying = false;
      }
    },
    [playId, notice, same, grant],
  );

  const { answer, guesses, help, defShown, open } = o;
  const letter = () => {
    const pick = pickHint(answer, guesses, help.revealed);
    if (!pick) return notice(tr('Every letter is already showing.'));
    void buy(HINT_COSTS[help.letters], { kind: 'letter', columns: pick.columns }, tr('Letter {letter} revealed.', { letter: pick.letter }));
  };
  const clear = () => {
    const pick = pickClear(answer, guesses, help.cleared);
    if (!pick) return notice(tr('No wrong letters left to clear.'));
    void buy(CLEAR_COST, { kind: 'clear', letters: pick }, tr('{letters} are not in the word.', { letters: pick.join(', ') }));
  };
  const define = () => void buy(DEFINE_COST, { kind: 'define' }, tr('Definition shown.'));

  const out: HelperProp[] = [];
  if (help.letters < HINT_COSTS.length) out.push({ label: tr('Letter · {n}{COIN}', { n: HINT_COSTS[help.letters], COIN }), tone: 'purple', onPress: letter, disabled: !open });
  if (!o.surgeon && !help.cleared.length) out.push({ label: tr('Clear 3 · {n}{COIN}', { n: CLEAR_COST, COIN }), tone: 'cyan', onPress: clear, disabled: !open });
  if (!help.defined && !defShown) out.push({ label: tr('Definition · {n}{COIN}', { n: DEFINE_COST, COIN }), tone: 'rose', onPress: define, disabled: !open });
  return out;
}
