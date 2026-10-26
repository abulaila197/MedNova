// My diseases in online rooms (Yazan 2026-10-26, step 3): the host's approved items get numbers from 100001 up in
// their game's bank on the server. Phones only carry the normal banks, so a match's own items are fetched once
// (match_own) and kept here by number.
import { useEffect } from 'react';
import { create } from 'zustand';

import { caseById } from '@/games/diagnostic/data';
import type { Word as McWord } from '@/games/medicordle/core';
import type { Word as SaWord } from '@/games/silent/core';
import type { Question } from '@/games/streak/core';

import { call } from './api';

export const OWN_FROM = 100_001;

type Own = {
  dp: { n: number; disease: string; answer_id: string; fields: string[]; clues: string[] }[];
  nm: { n: number; style: McWord['style']; word: string; definition: string }[];
  sm: { n: number; stem: string; choices: string[]; answer: number }[];
  sa: { n: number; id: string; name: string; field: string; aliases: string[] }[];
};

export const ownWords = new Map<number, McWord>();
export const ownQuestions = new Map<number, Question>();
export const ownSketches = new Map<number, SaWord>();
const known = (n: number) => caseById.has(String(n)) || ownWords.has(n) || ownQuestions.has(n) || ownSketches.has(n);

/** Bumped after each load, so the screens waiting on an item draw again. */
const useLoaded = create<{ v: number }>(() => ({ v: 0 }));
const askedAt = new Map<string, number>();

async function fetchOwn(matchId: string) {
  const at = askedAt.get(matchId) ?? 0;
  if (Date.now() - at < 1500) return;
  askedAt.set(matchId, Date.now());
  const r = await call<Own>('match_own', { m: matchId });
  for (const c of r?.dp ?? [])
    caseById.set(String(c.n), { number: c.n, difficulty: 'Medium', fields: c.fields, disease: c.disease, canonical_id: c.answer_id, answer_id: c.answer_id, clues: c.clues });
  for (const w of r?.nm ?? []) ownWords.set(w.n, { id: `own:${w.n}`, style: w.style, word: w.word, definition: w.definition, dossier: null });
  for (const q of r?.sm ?? []) ownQuestions.set(q.n, { id: `own:${q.n}`, kind: 'clinical', field: 'My diseases', stem: q.stem, choices: q.choices, answer: q.answer, explanation: null, dossier: null });
  for (const w of r?.sa ?? []) ownSketches.set(w.n, { id: w.id, name: w.name, field: w.field, aliases: w.aliases });
  useLoaded.setState((x) => ({ v: x.v + 1 }));
}

/** False while an item this screen needs is one of the host's own and hasn't arrived yet (it is fetched). */
export function useOwnItems(matchId: string, numbers: (number | null | undefined)[]) {
  useLoaded((x) => x.v);
  const missing = numbers.filter((n): n is number => n != null && n >= OWN_FROM && !known(n));
  const key = missing.join(',');
  useEffect(() => {
    if (!key) return;
    fetchOwn(matchId).catch(() => {});
    // A Silent Artist word only arrives once its turn shows it: ask again a little later.
    const id = setInterval(() => fetchOwn(matchId).catch(() => {}), 2000);
    return () => clearInterval(id);
  }, [matchId, key]);
  return missing.length === 0;
}
