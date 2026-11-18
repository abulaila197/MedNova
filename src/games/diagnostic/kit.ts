// A clue game's kit: what the shared clue screens (CaseBoard, Solo, Pass the phone, Vs rivals) need from one game.
// Race to Diagnosis (dpKit.ts) and Who am I? (games/whoami/kit.ts) are both clue games: one answer, clues one by one,
// a typed answer with suggestions. Their rules, bank, hint and words differ; the play code is one.
import { createContext, createElement, useContext, type ComponentType } from 'react';

import type { ClueRules, DPCase, GuessEntry, Indexed } from './core';

export type ClueKit = {
  rules: ClueRules;
  /** Bank by id (the case or puzzle number as text). */
  byId: Map<string, DPCase>;
  index: Indexed;
  guessById: Map<string, GuessEntry>;
  /** A guess as shown everywhere: "Main name (other 1, other 2)". */
  guessName: (id: string) => string;
  /** The ids the setup allows (difficulty, ticked fields or categories). */
  pool: (settings: Record<string, unknown>) => string[];
  /** The pill on the top bar: difficulty or category. */
  pill: (c: DPCase) => { label: string; color: string };
  /** Under the answer on the result card. */
  resultSub: (c: DPCase) => string;
  /** The paid hint: the medical fields, or the answer's first letter and length. */
  hint: { reason: string; title: string; kind: 'fields' | 'letters' };
  /** Saved with each case in the play record. */
  gameData: (c: DPCase) => Record<string, unknown>;
  /** Tempting wrong answers a rival tries first. */
  nearMisses: (c: DPCase, pick: (n: number) => number, n: number) => string[];
  /** Vs rivals timing. `clueBonus` has one value per clue. */
  race: { itemMs: number; clueMs: number; lockMs: number; revealMs: number; clueBonus: readonly number[] };
  /** Every text that names the thing being solved (case or puzzle), in English; shown through tr(). */
  words: {
    item: string; // 'Case {n}'
    itemOf: string; // 'Case {n} of {n2}'
    next: string; // 'Next case'
    missSolo: string;
    missLearn: string; // vs rivals: not solved
    hidden: string; // 'Case hidden'
    pausedSolo: string;
    pausedBots: string;
    placeholder: string;
    inputLabel: string;
    wrongList: string; // 'Differential'
    solved: string; // recap: 'solved the case · +{v}'
    missed: string; // recap: 'missed the case'
  };
};

const Kit = createContext<ClueKit | null>(null);

export function useKit(): ClueKit {
  const k = useContext(Kit);
  if (!k) throw new Error('A clue screen needs its game kit');
  return k;
}

/** One of the shared play screens, bound to a game's kit. */
export function withKit<P extends object>(kit: ClueKit, C: ComponentType<P>): ComponentType<P> {
  const Bound = (p: P) => createElement(Kit.Provider, { value: kit }, createElement(C, p));
  Bound.displayName = `WithKit(${C.displayName ?? C.name})`;
  return Bound;
}
