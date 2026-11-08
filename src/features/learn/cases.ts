import { create } from 'zustand';

import { caseById } from '@/games/diagnostic/data';
import { wordById as mcWordById } from '@/games/medicordle/data';
import { wordById as saWordById } from '@/games/silent/data';
import { OWN_PAIRS } from '@/games/imposter/offline';
import { OWN_TERMS } from '@/games/password/offline';
import { questionById } from '@/games/streak/data';
import type { DPCase } from '@/games/diagnostic/core';
import { useSession } from '@/games/shell/session';
import { copyOf, keepCopy } from '@/lib/copies';
import { supabase } from '@/lib/supabase';
import { call } from '@/online/api';
import { onAccountSwitch } from '@/state/accountSwitch';

/**
 * A case the player wrote (custom_cases). Its maker reads it as a dossier and practises it alone at once; once Admin
 * approves it, it also plays in rooms the maker hosts (Yazan 2026-10-26). `note` is Admin's note to the maker.
 */
export type CustomCase = {
  id: string;
  diagnosis: string;
  answer_id: string | null;
  field: string | null;
  gender: 'Female' | 'Male' | 'Other';
  age: number;
  presentation: string;
  history: string;
  exam: string;
  investigation: string;
  findings: string[];
  status: 'waiting' | 'approved' | 'declined';
  note: string | null;
  created_at: string;
};

/** Games a player can add a word to, with each one's form (Yazan 2026-10-26, #37). */
export type WordGame = 'the-silent-artist' | 'nova-medicordle' | 'the-streak-master' | 'imposter' | 'nova-password';
export type WordData = {
  'the-silent-artist': { name: string; field: string; aliases: string[] };
  'nova-medicordle': { word: string; definition: string };
  'the-streak-master': { stem: string; choices: string[]; answer: number };
  imposter: { a: string; b: string; category: string };
  'nova-password': { name: string; forbidden: string[] };
};
/** A word the player added (player_words), reviewed like a case. */
export type PlayerWord = { [G in WordGame]: { id: string; game: G; data: WordData[G]; status: CustomCase['status']; note: string | null; created_at: string } }[WordGame];

/** The word's name as a list shows it. */
export function wordTitle(w: { game: WordGame; data: WordData[WordGame] }) {
  const d = w.data as Record<string, unknown>;
  if (w.game === 'nova-medicordle') return String(d.word);
  if (w.game === 'the-streak-master') return String(d.stem);
  if (w.game === 'imposter') return `${d.a} / ${d.b}`;
  return String(d.name);
}

/** A case or word of mine as dossier tabs (#21): the fields its maker wrote, nothing added. */
export function mineFields(m: { kind: 'case'; c: CustomCase } | { kind: 'word'; w: PlayerWord }): { key: string; tab: string; label: string; text: string }[] {
  const f = (key: string, tab: string, text: string, label = tab) => ({ key, tab, label, text });
  if (m.kind === 'case') {
    const c = m.c;
    return [
      f('pt', 'Patient', `${c.gender}, ${c.age}${c.field ? `\n${c.field}` : ''}`),
      f('pr', 'Presentation', c.presentation),
      f('hx', 'History', c.history || 'Not written.'),
      f('ex', 'Exam', c.exam || 'Not written.', 'Clinical exam'),
      f('iv', 'Tests', c.investigation || 'Not written.', 'Investigations'),
      ...(c.findings.length ? [f('kf', 'Key findings', c.findings.join('\n\n'))] : []),
    ];
  }
  const w = m.w;
  switch (w.game) {
    case 'the-silent-artist':
      return [f('nm', 'Disease', w.data.name), ...(w.data.field ? [f('fd', 'Field', w.data.field)] : []), ...(w.data.aliases.length ? [f('al', 'Other names', w.data.aliases.join('\n'))] : [])];
    case 'nova-medicordle':
      return [f('wd', 'Word', w.data.word), f('df', 'Definition', w.data.definition)];
    case 'the-streak-master':
      return [f('q', 'Question', w.data.stem), f('ch', 'Choices', w.data.choices.map((x, i) => `${i === w.data.answer ? '✓ ' : '· '}${x}`).join('\n'))];
    case 'imposter':
      return [f('a', 'Disease 1', w.data.a), f('b', 'Disease 2', w.data.b), ...(w.data.category ? [f('ct', 'Field', w.data.category)] : [])];
    default:
      return [f('tm', 'Term', w.data.name), f('fb', 'Forbidden', w.data.forbidden.join('\n'), 'Forbidden words')];
  }
}

export type NewCase = Omit<CustomCase, 'id' | 'status' | 'note' | 'created_at'>;

/** `savedAt`: the lists are the saved copy from then, because the server can't be reached (#59). */
export const useCases = create<{ list: CustomCase[] | null; words: PlayerWord[] | null; savedAt?: number | null }>(() => ({ list: null, words: null, savedAt: null }));
onAccountSwitch(() => useCases.setState({ list: null, words: null, savedAt: null }));

/** Diagnostic Pursuit id of a custom case ("c:" + uuid), so the solo game can play it. */
export const customId = (id: string) => `c:${id}`;

/** A custom case as a Diagnostic Pursuit case: the presentation first, then each finding as the next clue. */
export function toDPCase(c: CustomCase): DPCase {
  const g = c.gender === 'Female' ? 'woman' : c.gender === 'Male' ? 'man' : 'patient';
  const first = /\d/.test(c.presentation.slice(0, 40)) ? c.presentation : `A ${c.age}-year-old ${g}: ${c.presentation}`;
  return {
    number: -1,
    difficulty: 'Medium',
    fields: c.field ? [c.field] : [],
    disease: c.diagnosis,
    canonical_id: c.answer_id ?? '',
    answer_id: c.answer_id ?? '',
    clues: [first, c.history, c.exam, c.investigation, ...c.findings].map((x) => x.trim()).filter(Boolean),
  };
}

/** Games whose Solo mode can practise one of my words; the Imposter and Password ones practise in Pass the phone. */
export const SOLO_WORD_GAMES: WordGame[] = ['the-silent-artist', 'nova-medicordle', 'the-streak-master'];

/** Puts a word of mine into its game's own list under "c:" + uuid, so that game can practise it. */
function addToGame(w: PlayerWord) {
  const id = customId(w.id);
  if (w.game === 'the-silent-artist') saWordById.set(id, { id, name: w.data.name, field: w.data.field, aliases: w.data.aliases });
  else if (w.game === 'nova-medicordle') mcWordById.set(id, { id, style: w.data.word.length === 6 ? 'classic' : 'custom', word: w.data.word, definition: w.data.definition, dossier: null });
  else if (w.game === 'imposter') OWN_PAIRS.set(id, { id, subtype: 'clinical', category: w.data.category, a: { word: w.data.a, alts: [] }, b: { word: w.data.b, alts: [] }, kind: 'disease' });
  else if (w.game === 'nova-password') OWN_TERMS.set(id, { id, name: w.data.name, bank: 'clinical', category: 'disease', forbidden: w.data.forbidden });
  else if (w.game === 'the-streak-master') questionById.set(id, { id, kind: 'clinical', field: 'My diseases', stem: w.data.stem, choices: w.data.choices, answer: w.data.answer, explanation: null, dossier: null });
}

/** Loads my cases and words, and puts the cases into the game's case list (practice works before approval too). */
export async function loadCases() {
  const uid = useSession.getState().userId;
  if (!uid) return useCases.setState({ list: [], words: [] });
  const [cs, ws] = await Promise.all([
    supabase.from('custom_cases').select('*').order('created_at', { ascending: false }),
    supabase.from('player_words').select('id, game, data, status, note, created_at').order('created_at', { ascending: false }),
  ]);
  if (cs.error) {
    // Offline: My diseases opens from the saved copy, and its practice plays still work (#59).
    const copy = await copyOf<{ list: CustomCase[]; words: PlayerWord[] }>('cases', uid);
    if (copy && useSession.getState().userId === uid) {
      for (const c of copy.v.list) if (c.answer_id) caseById.set(customId(c.id), toDPCase(c));
      for (const w of copy.v.words) if (w.status !== 'declined') addToGame(w);
      useCases.setState({ ...copy.v, savedAt: copy.at });
    }
    throw cs.error;
  }
  const list = (cs.data ?? []) as CustomCase[];
  for (const c of list) if (c.answer_id) caseById.set(customId(c.id), toDPCase(c));
  const words = ws.error ? (useCases.getState().words ?? []) : ((ws.data ?? []) as PlayerWord[]);
  for (const w of words) if (w.status !== 'declined') addToGame(w);
  useCases.setState({ list, words, savedAt: null });
  if (!ws.error) void keepCopy('cases', uid, { list, words });
}

/** Saves a new word for one game; the server checks its form and allows 20 a day. */
export async function saveWord<G extends WordGame>(game: G, w: WordData[G]) {
  await call('save_word', { game, w });
  await loadCases().catch(() => {});
}

/** Saves a new case. Once the server took it, a failed list reload doesn't count as "not saved" (AP12d). */
export async function saveCase(c: NewCase) {
  await call('save_case', { c });
  await loadCases().catch(() => {});
}
