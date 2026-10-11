// Learn's real data (RL1-RL7): the bundled dossiers on 16 specialty books, the player's misses from the play
// record, and Today's review pile.
import { GAMES } from '@/data/games';
import { engine } from '@/games/engine';
import type { GameKey, PlayItem } from '@/games/engine/types';
import { IMAGES } from '@/games/crossword/data/images';
import { wordById } from '@/games/crossword/data';
import { questionById } from '@/games/streak/data';
import { question as tmnQuestion } from '@/games/trustmenot/text';

import dossiersJson from './data/dossiers.json';
import shelvesJson from './data/shelves.json';

export type Dossier = { id: string; name: string; epi: string; eti: string; cli: string; inv: string; tre: string };
export type FieldKey = 'epi' | 'eti' | 'cli' | 'inv' | 'tre';
export const FIELDS: { key: FieldKey; tab: string; label: string }[] = [
  { key: 'epi', tab: 'Epidemiology', label: 'Epidemiology' },
  { key: 'eti', tab: 'Etiology', label: 'Etiology' },
  { key: 'cli', tab: 'Clinical', label: 'Clinical features' },
  { key: 'inv', tab: 'Investigations', label: 'Investigations' },
  { key: 'tre', tab: 'Treatment', label: 'Treatment' },
];

export const DOSSIERS = new Map((dossiersJson as Dossier[]).map((d) => [d.id, d]));

/** Spine names short enough for the thinnest books; the full name shows inside the book. */
const SPINE: Record<string, string> = {
  'Cardiology & Vascular': 'Cardiology',
  'Gastroenterology & Hepatology': 'Gastro & Liver',
  'Nephrology & Urology': 'Kidney & Uro',
  'Endocrinology & Metabolism': 'Endocrine',
  'Hematology & Oncology': 'Blood & Cancer',
  'Infectious Diseases': 'Infections',
  'Psychiatry & Toxicology': 'Psych & Tox',
  'Rheumatology & Musculoskeletal': 'Joints & Bones',
  'Obstetrics & Gynecology': 'Obs & Gynae',
  'Genetic & Metabolic Disorders': 'Genetics',
  'ENT & Ophthalmology': 'ENT & Eyes',
  'Emergency & Surgery': 'ER & Surgery',
};

export type Book = { key: string; name: string; spine: string; ids: string[] };
export const BOOKS: Book[] = (shelvesJson as { shelves: { name: string; ids: string[] }[] }).shelves.map((b) => ({
  key: b.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'),
  name: b.name,
  spine: SPINE[b.name] ?? b.name,
  ids: b.ids,
}));
const BOOK_OF = new Map(BOOKS.flatMap((b) => b.ids.map((id) => [id, b] as const)));
export const bookOf = (id: string) => BOOK_OF.get(id);
export const DOSSIER_TOTAL = DOSSIERS.size;

/** Only these games' misses open disease dossiers (RL5). */
export const DOSSIER_GAMES: GameKey[] = ['the-diagnostic-pursuit', 'case-files-unsolved', 'the-riddler'];

const gameName = (key: string) => {
  const g = GAMES.find((x) => x.key === key);
  return g ? `${g.lead} ${g.em}` : key;
};

/** Title split for the display type: the last word gets the accent; bracketed other names stay out of the title. */
export function titleOf(name: string) {
  const words = name.replace(/\s*\(.*\)\s*$/, '').trim().split(' ');
  return words.length > 1 ? { first: words.slice(0, -1).join(' '), em: words[words.length - 1] } : { first: '', em: words[0] };
}

type Base = { key: string; game: string; gameName: string; at: number };
export type Card =
  | (Base & { kind: 'dossier'; dossier: Dossier; field: FieldKey })
  | (Base & { kind: 'qa'; q: string; choices: string[]; answer: string | null; image?: number });

/** A missed question from a question game, rebuilt from the game's own bank (RL5: question and answer only). */
function qaOf(game: string, item: PlayItem): Omit<Extract<Card, { kind: 'qa' }>, keyof Base | 'kind'> | null {
  if (game === 'the-streak-master') {
    const q = questionById.get(item.itemId);
    return q ? { q: q.stem, choices: q.choices, answer: q.choices[q.answer] ?? null } : null;
  }
  if (game === 'nova-crossword') {
    const w = wordById.get(item.itemId);
    if (!w) return null;
    const answer = w.answer.charAt(0) + w.answer.slice(1).toLowerCase();
    return w.question.kind === 'text' ? { q: w.question.text, choices: [], answer } : { q: 'Identify the picture.', choices: [], answer, image: IMAGES[w.question.imageKey] };
  }
  if (game === 'trust-me-not') {
    const q = tmnQuestion(item.itemId);
    if (!q.q) return null;
    const right = item.gameData.right as number | undefined;
    return { q: q.q, choices: q.choices, answer: right == null ? null : (q.choices[right] ?? null) };
  }
  return null;
}

/** Everything Learn shows, read from the play record on this phone (the phone owner's misses only). */
export async function loadLearn() {
  const { plays, items } = await engine.recorder.all();
  const gameOf = new Map(plays.map((p) => [p.id, p.game as string]));
  const missed = new Map<string, { count: number; last: number }>();
  const cards = new Map<string, Card>();
  for (const it of items) {
    if (!it.feedsLearn || it.outcome === 'right') continue;
    const game = gameOf.get(it.playId);
    if (!game) continue;
    const base = { key: `${game}:${it.itemId}`, game, gameName: gameName(game), at: it.at };
    if (DOSSIER_GAMES.includes(game as GameKey)) {
      const d = it.answerKey ? DOSSIERS.get(it.answerKey) : undefined;
      if (!d) continue;
      const m = missed.get(d.id);
      missed.set(d.id, { count: (m?.count ?? 0) + 1, last: Math.max(m?.last ?? 0, it.at) });
      // One card per disease, whichever game missed it last.
      const key = `dossier:${d.id}`;
      const prev = cards.get(key);
      if (!prev || prev.at < it.at) cards.set(key, { ...base, key, kind: 'dossier', dossier: d, field: FIELDS[hash(d.id) % FIELDS.length].key });
    } else {
      const qa = qaOf(game, it);
      const prev = cards.get(base.key);
      if (qa && (!prev || prev.at < it.at)) cards.set(base.key, { ...base, kind: 'qa', ...qa });
    }
  }
  return { missed, cards: [...cards.values()] };
}

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// Today's review (RL4): each miss shows once. Got it puts it away until it is missed again; Again sends it to the
// end of the pile.
const REVIEW_KEY = 'learn:review';
const OPENED_KEY = 'learn:opened';
type ReviewState = { done: Record<string, number>; later: string[] };

export async function reviewState() {
  return (await engine.kv.get<ReviewState>(REVIEW_KEY)) ?? { done: {}, later: [] };
}

/** The pile in order: newest misses first, cards sent back with Again at the end. */
export function pileOf(cards: Card[], st: ReviewState) {
  const open = cards.filter((c) => st.done[c.key] == null || c.at > st.done[c.key]).sort((a, b) => b.at - a.at);
  const later = new Set(st.later);
  return [...open.filter((c) => !later.has(c.key)), ...st.later.map((k) => open.find((c) => c.key === k)).filter((c): c is Card => !!c)];
}

export async function gotIt(card: Card) {
  const st = await reviewState();
  st.done[card.key] = Date.now();
  st.later = st.later.filter((k) => k !== card.key);
  await engine.kv.set(REVIEW_KEY, st);
}

export async function again(card: Card) {
  const st = await reviewState();
  st.later = [...st.later.filter((k) => k !== card.key), card.key];
  await engine.kv.set(REVIEW_KEY, st);
}

/** Dossiers this player has opened (the Dossier Reader achievement). */
export async function noteOpened(id: string) {
  const list = (await engine.kv.get<string[]>(OPENED_KEY)) ?? [];
  if (!list.includes(id)) await engine.kv.set(OPENED_KEY, [...list, id]);
}

/** The two Learn counters the achievements read (AC: Back to Basics, Dossier Reader). */
export async function learnCounts() {
  const [st, opened] = await Promise.all([reviewState(), engine.kv.get<string[]>(OPENED_KEY)]);
  return { reviewCards: Object.keys(st.done).length, dossiersOpened: (opened ?? []).length };
}
