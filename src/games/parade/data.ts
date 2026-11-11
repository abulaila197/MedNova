import { type FieldMenu, groupsOf, inFields } from '../shell/fields';
import type { Kind, Question, Style } from './core';

import bankJson from './data/bank.json';

export const QUESTIONS = bankJson as unknown as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const bank = (id: string) => questionById.get(id);
/** Every question in the bank is live (publish task 1, 2026-11-02: the retired TB question was deleted and the
 *  places after it moved down by one, here and in pq_keys). */
const LIVE = QUESTIONS;
export const idsOf = (kind: Kind) => LIVE.filter((q) => q.kind === kind).map((q) => q.id);
/** The pool for a style; with field ticks, only the ticked fields (the half-and-half Mixed queue is then skipped). */
export const poolFor = (style: Style, ticked: string[] | null = null) => inFields(ofStyle(style), (q) => q.field, ticked).map((q) => q.id);
/** The bank's field keys as players read them. */
export const PARADE_FIELD: Record<string, string> = { medicine: 'Internal Medicine', surgery: 'Surgery', pediatrics: 'Pediatrics', obgyn: 'Obs & Gynae', anatomy: 'Anatomy', physiology: 'Physiology', biochemistry: 'Biochemistry', pharmacology: 'Pharmacology', pathology: 'Pathology', microbiology: 'Microbiology' };
/** Field ticks (Yazan 2026-11-11): the fields under Clinical, Basic science or Mixed, with their counts. */
const KIND_TITLE: Record<Kind, string> = { clinical: 'Clinical', basic: 'Basic science' };
const ofStyle = (style: Style) => (style === 'mixed' ? LIVE : LIVE.filter((q) => q.kind === style));
export function fieldMenu(style: Style, min: number, label?: (f: string) => string): FieldMenu {
  const items = ofStyle(style);
  return {
    groups: groupsOf(items, (q) => q.field, (q) => (style === 'mixed' ? KIND_TITLE[q.kind] : undefined), label, ['Clinical', 'Basic science']),
    total: (t) => inFields(items, (q) => q.field, t).length,
    min,
    unit: 'questions',
  };
}

/** A question's type (mcq, tf, r2o, match, reverse, order, closest), for the type rounds (#15). */
export const typeOf = (id: string) => questionById.get(id)?.style;
