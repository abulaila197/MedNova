import type { BotType, Persona } from './types';

/**
 * What rivals say (G3, Yazan 2026-11-09): only the 18 voice lines and their character's stickers, chosen by
 * hidden personality first, then by place (leading, middle, last), with a little of their type mixed in.
 * A sticker line names the kind of sticker by its label; a rival whose pack has none says a voice line instead.
 */
export type Line = { voice: string } | { sticker: RegExp };
const V = (...ids: string[]): Line[] => ids.map((voice) => ({ voice }));
const S = (fit: RegExp): Line => ({ sticker: fit });

export type Moment =
  | 'ready' // joined the room and is ready
  | 'kicked' // you kicked it
  | 'start' // the match begins
  | 'right' // it got one right
  | 'wrong' // it got one wrong
  | 'overtake' // it just passed someone
  | 'fire' // 3 right in a row
  | 'tilt' // 3 misses in a row
  | 'round' // end of a round (uses place)
  | 'end' // end of the match (uses place: lead = won)
  | 'youRight' // you got a hard one / a streak
  | 'youWrong' // you missed
  | 'heard'; // you sent a sticker or voice line (uses heard)

export type Place = 'lead' | 'mid' | 'last';
export type Heard = 'nice' | 'taunt' | 'sorry' | 'other';

/** Lines for a moment; `lead`/`mid`/`last` or `nice`/`taunt`/`sorry`/`other` pick by context, `all` always fits. */
type Pool = Partial<Record<'all' | Place | Heard, Line[]>>;
type Book = Partial<Record<Moment, Pool>>;

const HAPPY = /yay|yes|love it|whoa|nice one|mwah/i;
const SMUG = /mic drop|told you|actually|graduated|you!/i;
const SAD = /so sad|waaah|ugh|no way|seriously|what/i;
const SLEEPY = /zzz|sleepy|wake me|coffee/i;
const ANGRY = /grr|whatever|seriously|ugh/i;
const HELLO = /hi there|yay|love it/i;

const BOOKS: Record<Persona, Book> = {
  // Brags when right, answers fast, takes risks.
  showoff: {
    ready: { all: [...V('ready', 'catch-me', 'too-easy'), S(SMUG)] },
    kicked: { all: [...V('all-youve-got', 'better-luck'), S(SMUG)] },
    start: { all: V('catch-me', 'keep-up', 'too-easy') },
    right: { lead: [...V('too-easy', 'catch-me', 'too-slow'), S(SMUG)], mid: V('keep-up', 'too-easy'), last: V('catch-me', 'keep-up') },
    wrong: { all: V('oops', 'so-close') },
    overtake: { all: [...V('too-slow', 'catch-me', 'keep-up'), S(SMUG)] },
    fire: { all: [...V('too-easy', 'catch-me'), S(SMUG)] },
    tilt: { all: [...V('so-close'), S(SAD)] },
    round: { lead: [...V('too-easy', 'keep-up'), S(SMUG)], last: V('so-close', 'help-me') },
    end: { lead: [...V('too-easy', 'better-luck'), S(SMUG)], mid: V('rematch', 'so-close'), last: V('rematch') },
    youRight: { all: V('so-close', 'keep-up') },
    youWrong: { all: V('too-slow', 'better-luck') },
    heard: { nice: V('thank-you', 'too-easy'), taunt: [...V('catch-me', 'all-youve-got', 'too-easy'), S(SMUG)], sorry: V('better-luck', 'too-slow'), other: [S(SMUG)] },
  },
  // Quiet and careful; says sorry when it beats you.
  shy: {
    ready: { all: [...V('ready', 'good-luck'), S(HELLO)] },
    kicked: { all: [...V('sorry'), S(SAD)] },
    start: { all: V('good-luck') },
    right: { lead: V('sorry'), mid: [S(HAPPY)], last: [S(HAPPY)] },
    wrong: { all: V('oops', 'sorry') },
    overtake: { all: V('sorry') },
    fire: { all: [S(HAPPY)] },
    tilt: { all: [...V('help-me'), S(SAD)] },
    round: { lead: V('sorry'), last: V('help-me') },
    end: { lead: V('sorry', 'thank-you'), mid: V('well-played'), last: V('well-played', 'good-luck') },
    youRight: { all: V('nice-one') },
    youWrong: { all: V('so-close') },
    heard: { nice: [...V('thank-you'), S(HAPPY)], taunt: V('sorry', 'oops'), sorry: V('good-luck'), other: [S(HELLO)] },
  },
  // Silly stickers, laughs at its own mistakes.
  joker: {
    ready: { all: [...V('ready', 'catch-me'), S(HAPPY)] },
    kicked: { all: [...V('oops', 'help-me'), S(SAD)] },
    start: { all: [...V('good-luck', 'catch-me'), S(HAPPY)] },
    right: { lead: [...V('catch-me'), S(HAPPY)], mid: [S(HAPPY)], last: V('oops') },
    wrong: { all: [...V('oops', 'oops', 'help-me'), S(SAD)] },
    overtake: { all: [...V('catch-me'), S(HAPPY)] },
    fire: { all: [S(HAPPY), S(SMUG)] },
    tilt: { all: [...V('oops', 'help-me'), S(SAD)] },
    round: { lead: [S(HAPPY)], last: [...V('help-me', 'oops'), S(SAD)] },
    end: { lead: [...V('catch-me'), S(HAPPY)], mid: V('rematch', 'oops'), last: [...V('oops', 'rematch'), S(SAD)] },
    youRight: { all: V('nice-one') },
    youWrong: { all: V('oops') },
    heard: { nice: V('thank-you'), taunt: [...V('catch-me', 'oops'), S(HAPPY)], sorry: V('oops'), other: [S(HAPPY), S(SAD)] },
  },
  // Salty when behind, sulks at the end, always wants a rematch.
  sore: {
    ready: { all: V('ready', 'keep-up') },
    kicked: { all: [...V('all-youve-got'), S(ANGRY)] },
    start: { all: V('keep-up', 'hurry-up') },
    right: { lead: V('too-easy', 'too-slow'), mid: V('keep-up'), last: V('all-youve-got') },
    wrong: { all: [S(ANGRY), ...V('so-close')] },
    overtake: { all: V('too-slow', 'catch-me') },
    fire: { all: V('too-easy') },
    tilt: { all: [S(ANGRY), S(SAD)] },
    round: { lead: V('too-slow'), last: [...V('all-youve-got'), S(ANGRY)] },
    end: { lead: V('better-luck', 'too-easy'), mid: [...V('rematch'), S(ANGRY)], last: [...V('rematch', 'rematch'), S(ANGRY)] },
    youRight: { all: [S(ANGRY), ...V('hurry-up')] },
    youWrong: { all: V('too-slow', 'better-luck') },
    heard: { nice: [S(ANGRY), ...V('hurry-up')], taunt: V('all-youve-got', 'keep-up'), sorry: V('better-luck'), other: [S(ANGRY)] },
  },
  // Kind to everyone, happy for you when you win.
  cheer: {
    ready: { all: [...V('ready', 'good-luck'), S(HELLO)] },
    kicked: { all: V('good-luck', 'thank-you') },
    start: { all: [...V('good-luck'), S(HAPPY)] },
    right: { lead: [S(HAPPY)], mid: [S(HAPPY)], last: [S(HAPPY)] },
    wrong: { all: V('so-close', 'oops') },
    overtake: { all: [S(HAPPY)] },
    fire: { all: [S(HAPPY)] },
    tilt: { all: V('help-me', 'so-close') },
    round: { lead: V('well-played'), last: V('good-luck') },
    end: { lead: V('well-played', 'gg'), mid: V('gg', 'well-played'), last: V('well-played', 'nice-one') },
    youRight: { all: [...V('nice-one', 'nice-one'), S(HAPPY)] },
    youWrong: { all: V('so-close', 'good-luck') },
    heard: { nice: [...V('thank-you', 'nice-one'), S(HAPPY)], taunt: V('well-played', 'good-luck'), sorry: V('so-close', 'good-luck'), other: [S(HAPPY)] },
  },
  // Calm and steady; GG either way.
  cool: {
    ready: { all: V('ready') },
    kicked: { all: V('gg') },
    start: { all: V('good-luck') },
    right: { lead: V('gg'), mid: V('well-played') },
    wrong: { all: V('so-close') },
    overtake: { all: V('well-played') },
    fire: { all: V('too-easy') },
    round: { lead: V('well-played'), last: V('so-close') },
    end: { lead: V('gg', 'well-played'), mid: V('gg'), last: V('gg', 'well-played') },
    youRight: { all: V('nice-one', 'well-played') },
    youWrong: { all: V('so-close') },
    heard: { nice: V('gg', 'thank-you'), taunt: V('well-played', 'keep-up'), sorry: V('so-close'), other: V('gg') },
  },
  // Catches fire fast, tilts fast, impatient.
  hot: {
    ready: { all: V('ready', 'hurry-up') },
    kicked: { all: [...V('all-youve-got'), S(ANGRY)] },
    start: { all: V('hurry-up', 'keep-up') },
    right: { lead: V('too-slow', 'too-easy'), mid: V('hurry-up', 'keep-up'), last: V('hurry-up') },
    wrong: { all: [S(ANGRY), ...V('so-close')] },
    overtake: { all: V('too-slow', 'catch-me') },
    fire: { all: V('too-easy', 'catch-me', 'too-slow') },
    tilt: { all: [S(ANGRY), S(ANGRY), ...V('help-me')] },
    round: { lead: V('too-slow'), last: [S(ANGRY)] },
    end: { lead: V('too-easy', 'too-slow'), mid: V('rematch'), last: [...V('rematch'), S(ANGRY)] },
    youRight: { all: V('hurry-up') },
    youWrong: { all: V('too-slow') },
    heard: { nice: V('hurry-up'), taunt: V('too-slow', 'all-youve-got'), sorry: V('hurry-up'), other: V('hurry-up') },
  },
  // Slow to start, Zzz and coffee, wakes up later.
  sleepy: {
    ready: { all: [S(SLEEPY), ...V('ready')] },
    kicked: { all: [S(SLEEPY), ...V('sorry')] },
    start: { all: [S(SLEEPY), S(SLEEPY)] },
    right: { lead: V('catch-me'), mid: [S(HAPPY)], last: [S(SLEEPY)] },
    wrong: { all: [S(SLEEPY), ...V('oops')] },
    overtake: { all: V('catch-me') },
    fire: { all: [S(HAPPY), ...V('catch-me')] },
    tilt: { all: [S(SLEEPY), S(SLEEPY)] },
    round: { lead: [S(HAPPY)], last: [S(SLEEPY)] },
    end: { lead: V('gg', 'too-easy'), mid: [S(SLEEPY)], last: [S(SLEEPY), ...V('rematch')] },
    youRight: { all: V('nice-one') },
    youWrong: { all: [S(SLEEPY)] },
    heard: { nice: V('thank-you'), taunt: [S(SLEEPY)], sorry: [S(SLEEPY)], other: [S(SLEEPY)] },
  },
};

/** A little of the type in every rival: a Freshman says "Oops!" and "Help me!", a Genius "Too easy!". */
const TYPE_TOUCH: Record<BotType, Partial<Record<Moment, Line[]>>> = {
  freshman: { wrong: V('oops', 'help-me'), tilt: V('help-me'), right: V('oops') },
  scholar: { right: V('well-played'), end: V('gg') },
  genius: { right: V('too-easy'), fire: V('too-easy') },
};

/** The lines that fit a moment for this rival, with the context that picks among them. */
export function linesFor(persona: Persona, type: BotType, m: Moment, ctx: { place?: Place; heard?: Heard } = {}): Line[] {
  const pool = BOOKS[persona][m];
  const own = pool ? [...(pool.all ?? []), ...(ctx.place ? (pool[ctx.place] ?? []) : []), ...(ctx.heard ? (pool[ctx.heard] ?? []) : [])] : [];
  // A middle place with no lines of its own borrows from the nearer end.
  const fallback = pool && ctx.place === 'mid' && !pool.mid ? (pool.last ?? pool.lead ?? []) : [];
  return [...own, ...fallback, ...(own.length ? (TYPE_TOUCH[type][m] ?? []) : [])];
}

/** What kind of thing you sent, so a rival can answer in kind. */
export function heardKind(kind: 'sticker' | 'voice' | 'line' | 'guess', item: string, label = ''): Heard {
  if (kind === 'voice') {
    if (['good-luck', 'nice-one', 'well-played', 'gg', 'thank-you', 'ready'].includes(item)) return 'nice';
    if (['too-slow', 'all-youve-got', 'catch-me', 'too-easy', 'keep-up', 'better-luck', 'hurry-up'].includes(item)) return 'taunt';
    if (['sorry', 'oops', 'so-close', 'help-me'].includes(item)) return 'sorry';
    return 'other';
  }
  if (/mic drop|told you|you!|grr|whatever|seriously/i.test(label)) return 'taunt';
  if (/love|yay|yes|nice|mwah|hi there/i.test(label)) return 'nice';
  if (/sad|waaah|sorry|ugh/i.test(label)) return 'sorry';
  return 'other';
}
