import { sayAsBot } from '@/match/talk';
import { STICKERS } from '@/match/stickers';

import type { Bot, BotType } from './types';

/**
 * What bots say in the room (Yazan 2026-11-09): a line when they're ready, and a reaction by type when kicked.
 * Only the 19 voice lines and the bot's own character stickers; lines wait their turn (never two bots at once).
 * The full talk (reacting to you, to standings, the Genius's facts) comes with the bot talk group.
 */
type Line = { voice: string } | { sticker: RegExp };

const READY: Record<BotType, Line[]> = {
  freshman: [{ voice: 'ready' }, { voice: 'good-luck' }, { voice: 'help-me' }, { sticker: /hi there|yay|yes|zzz|sleepy|coffee|whoa/i }],
  scholar: [{ voice: 'ready' }, { voice: 'good-luck' }, { sticker: /hi there|yes|coffee|long shift|love it/i }],
  genius: [{ voice: 'ready' }, { voice: 'too-easy' }, { voice: 'catch-me' }, { voice: 'keep-up' }, { sticker: /actually|graduated|mic drop|told you|still studying/i }],
};

const KICKED: Record<BotType, Line[]> = {
  freshman: [{ voice: 'sorry' }, { voice: 'oops' }, { voice: 'help-me' }, { sticker: /what|so sad|waaah|ugh|no way/i }],
  scholar: [{ voice: 'well-played' }, { voice: 'good-luck' }, { voice: 'thank-you' }, { sticker: /whatever|so sad|nice one|grr/i }],
  genius: [{ voice: 'better-luck' }, { voice: 'all-youve-got' }, { voice: 'too-slow' }, { sticker: /seriously|whatever|told you|you!|mic drop/i }],
};

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** One of the bot's own stickers whose label fits; none (so it says a voice line) when its pack has no fitting one. */
function stickerFor(bot: Bot, fit: RegExp) {
  const own = STICKERS[bot.character] ?? [];
  const good = own.filter((x) => fit.test(x.label));
  return good.length ? pick(good).id : null;
}

function say(room: string, bot: Bot, lines: Line[]) {
  const l = pick(lines);
  const sticker = 'sticker' in l ? stickerFor(bot, l.sticker) : null;
  const msg = { user_id: bot.id, name: bot.name, face: bot.character };
  if (sticker) sayAsBot(room, { ...msg, kind: 'sticker', item: sticker });
  else sayAsBot(room, { ...msg, kind: 'voice', item: 'voice' in l ? l.voice : pick(lines.filter((x) => 'voice' in x) as { voice: string }[]).voice });
}

/** Not every bot speaks up when ready: a Genius likes to, a Freshman forgets (keeps the room from feeling scripted). */
const READY_CHANCE: Record<BotType, number> = { freshman: 0.5, scholar: 0.55, genius: 0.7 };

export const sayReady = (room: string, bot: Bot) => void (Math.random() < READY_CHANCE[bot.type] && say(room, bot, READY[bot.type]));
export const sayKicked = (room: string, bot: Bot) => say(room, bot, KICKED[bot.type]);

/** How long each type takes to join and to get ready (ms): Geniuses are quick, Freshmen wander in. */
export const JOIN_MS: Record<BotType, [number, number]> = { freshman: [1600, 2600], scholar: [900, 1700], genius: [500, 1100] };
export const READY_MS: Record<BotType, [number, number]> = { freshman: [1200, 2600], scholar: [700, 1400], genius: [300, 800] };
export const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);
