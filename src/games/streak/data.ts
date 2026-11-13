import { type FieldMenu, groupsOf, inFields } from '../shell/fields';
import type { Kind, Question, Style } from './core';

import questionsJson from './data/questions.json';
import { tr } from '@/i18n';

export const QUESTIONS = questionsJson as Question[];
export const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const answerOf = (id: string) => questionById.get(id)?.answer ?? -1;
const LIVE = QUESTIONS;
export const idsOf = (kind: Kind) => QUESTIONS.filter((q) => q.kind === kind).map((q) => q.id);
/** The pool for a style; with field ticks, only the ticked fields (the half-and-half Mixed queue is then skipped). */
export const poolFor = (style: Style, ticked: string[] | null = null) => inFields(ofStyle(style), (q) => q.field, ticked).map((q) => q.id);
/** Field ticks (Yazan 2026-11-11): the fields under Clinical, Basic science or Mixed, with their counts. */
const KIND_TITLE: Record<Kind, string> = { clinical: tr('Clinical'), basic: tr('Basic science') };
const ofStyle = (style: Style) => (style === 'mixed' ? LIVE : LIVE.filter((q) => q.kind === style));
export function fieldMenu(style: Style, min: number, label?: (f: string) => string): FieldMenu {
  const items = ofStyle(style);
  return {
    groups: groupsOf(items, (q) => q.field, (q) => (style === 'mixed' ? KIND_TITLE[q.kind] : undefined), label, [tr('Clinical'), tr('Basic science')]),
    total: (t) => inFields(items, (q) => q.field, t).length,
    min,
    unit: 'questions',
  };
}

