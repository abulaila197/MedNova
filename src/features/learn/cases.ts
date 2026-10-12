import { create } from 'zustand';

import { caseById } from '@/games/diagnostic/data';
import type { DPCase } from '@/games/diagnostic/core';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { call } from '@/online/api';

/** A case the player wrote (custom_cases): private until approved, then only its maker plays it. */
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
  created_at: string;
};

export type NewCase = Omit<CustomCase, 'id' | 'status' | 'created_at'>;

export const useCases = create<{ list: CustomCase[] | null }>(() => ({ list: null }));

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

/** Loads my cases and puts the approved, playable ones into the game's case list. */
export async function loadCases() {
  if (!useSession.getState().userId) return useCases.setState({ list: [] });
  const { data, error } = await supabase.from('custom_cases').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as CustomCase[];
  for (const c of list) if (c.status === 'approved' && c.answer_id) caseById.set(customId(c.id), toDPCase(c));
  useCases.setState({ list });
}

export async function saveCase(c: NewCase) {
  await call('save_case', { c });
  await loadCases();
}
