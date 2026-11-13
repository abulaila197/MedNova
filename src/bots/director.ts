import { useEffect, useRef } from 'react';

import { stickerById, STICKERS } from '@/match/stickers';
import { isMuted, onTalk, popAsBot, sayAsBot } from '@/match/talk';

import { CHATTY, personaOf } from './identity';
import { heardKind, linesFor, replyTo, toneLines, type Heard, type Line, type Moment, type Place } from './lines';
import type { Bot, Persona } from './types';
import { tr } from '@/i18n';

/**
 * Who says what, and when (G3, Yazan 2026-11-09). Games and the room tell the director what happened; it decides
 * whether a rival speaks, picks the line by hidden personality and place, and queues it so two rivals never talk
 * at once. Each personality sits between Normal and Chatty. Nobody repeats a line twice in a row, a rival waits
 * 8 to 15 seconds between lines, and a line whose moment has passed is dropped.
 */

/** How likely a moment is to make a rival speak, at the Normal end; the Chatty end is about twice this. */
const RATE: Record<Moment, number> = {
  ready: 0.55,
  kicked: 1,
  start: 0.3,
  right: 0.14,
  wrong: 0.12,
  overtake: 0.4,
  fire: 0.55,
  tilt: 0.45,
  round: 0.3,
  end: 0.75,
  youRight: 0.1,
  youWrong: 0.1,
  heard: 1,
};
/** Moments that always get through: a kicked rival always reacts, the end of a match matters. */
const NO_WAIT: Moment[] = ['kicked', 'end', 'heard'];
/** How long a line may wait in the queue before its moment has passed. */
const FRESH: Partial<Record<Moment, number>> = { ready: 9000, kicked: 7000, end: 12000, round: 6000, heard: 6000 };

const last = new Map<string, string>();
/**
 * Yazan 2026-11-12: no line said twice by the same rival in one match (voice lines and stickers alike), and rivals
 * remember how you talked to them this match (nice or taunting) and answer in that tone later. Keyed room|rival.
 */
const used = new Map<string, Set<string>>();
const tone = new Map<string, 'nice' | 'taunt'>();
const key = (room: string, bot: Bot) => `${room}|${bot.id}`;
const usedBy = (room: string, bot: Bot) => {
  let s = used.get(key(room, bot));
  if (!s) used.set(key(room, bot), (s = new Set()));
  return s;
};
const nextAt = new Map<string, number>();
const factRound = new Map<string, number>();

const persona = (b: Bot) => b.persona ?? personaOf(b.name);
const lineKey = (l: Line) => ('voice' in l ? `v:${l.voice}` : `s:${l.sticker.source}`);

/** A sticker from the rival's own pack that fits and that it hasn't sent this match, or null so it says a voice line instead. */
function stickerFor(bot: Bot, fit: RegExp, done: Set<string>) {
  const own = (STICKERS[bot.character] ?? []).filter((x) => fit.test(x.label) && !done.has(`k:${x.id}`));
  return own.length ? own[Math.floor(Math.random() * own.length)].id : null;
}

/** `said`: the voice line you sent, so the reply matches it (you say GG, it says GG back). */
export type Ctx = { place?: Place; heard?: Heard; said?: string; tableSize?: number; force?: boolean };

/** Something happened to (or around) a rival: maybe it says something. Returns whether a line was queued. */
export function rivalMoment(room: string, bot: Bot, m: Moment, ctx: Ctx = {}): boolean {
  if (isMuted(room, bot.id)) return false;
  const now = Date.now();
  if (!ctx.force && !NO_WAIT.includes(m) && now < (nextAt.get(bot.id) ?? 0)) return false;
  // Between Normal and Chatty by personality; at a big table each rival speaks a little less.
  const crowd = Math.min(1, 3 / Math.max(1, ctx.tableSize ?? 3));
  const chance = Math.min(1, RATE[m] * (1 + CHATTY[persona(bot)]) * (m === 'heard' || m === 'kicked' ? 1 : crowd));
  if (!ctx.force && Math.random() >= chance) return false;

  const done = usedBy(room, bot);
  // A reply to your voice line matches it first; the tone you used this match colours what it says about you.
  const matching = m === 'heard' && ctx.said ? replyTo(persona(bot), ctx.said) : [];
  const toned = toneLines(persona(bot), m, tone.get(key(room, bot)));
  const all = [...matching, ...toned, ...linesFor(persona(bot), bot.type, m, ctx)];
  // Nothing twice in a match: voice lines already said are out, and a sticker line needs a sticker not yet sent.
  const fresh = all.filter((l) => ('voice' in l ? !done.has(lineKey(l)) : !!stickerFor(bot, l.sticker, done)));
  if (!fresh.length) return false;
  // Matching replies and tone lines go first when there are fresh ones.
  const best = fresh.filter((l) => matching.includes(l) || toned.includes(l));
  const pool = best.length ? best : fresh;
  const l = pool[Math.floor(Math.random() * pool.length)];
  const sticker = 'sticker' in l ? stickerFor(bot, l.sticker, done) : null;
  const voice = 'voice' in l ? l.voice : null;
  if (!sticker && !voice) return false;
  const ok = sayAsBot(room, { user_id: bot.id, name: bot.name, face: bot.character, kind: sticker ? 'sticker' : 'voice', item: (sticker ?? voice)! }, FRESH[m] ?? 4000);
  if (ok) {
    last.set(bot.id, lineKey(l));
    done.add(sticker ? `k:${sticker}` : lineKey(l));
    nextAt.set(bot.id, now + 8000 + Math.random() * 7000);
  }
  return ok;
}

/**
 * After a round the Genius may point you to the dossier and Learn instead of lecturing (Yazan 2026-11-09: no fact
 * text, a short line in its own manner). At most every 2 rounds per room; a Shy Genius less often.
 */
const STUDY: Record<Persona, string[]> = {
  showoff: [tr('Easy one. It\'s all in the dossier.'), tr('I read that dossier twice. Your turn.'), tr('Check the dossier, then come back.')],
  shy: [tr('The dossier helped me with that one.'), tr('Maybe look at the dossier later?'), tr('I learned it in Learn, honestly.')],
  joker: [tr('Dossier. Read it. Thank me later.'), tr('Spoiler: the dossier knew all along.'), tr('Homework: one dossier, no excuses.')],
  sore: [tr('Go read the dossier before the next one.'), tr('That\'s in the dossier. Study it.'), tr('Learn it properly next time.')],
  cheer: [tr('Open that dossier, you\'ve got this!'), tr('Add it to your Learn review!'), tr('One dossier read and it\'s yours!')],
  cool: [tr('It\'s in the dossier.'), tr('Dossier covers that one.'), tr('Worth a look in Learn.')],
  hot: [tr('READ the dossier!'), tr('Dossier. Now. Go!'), tr('Study it in Learn. Seriously.')],
  sleepy: [tr('The dossier… explains it better than me.'), tr('Read the dossier… then nap.'), tr('Learn has it… go study.')],
};
export function rivalStudy(room: string, bot: Bot, round: number): boolean {
  if (bot.type !== 'genius' || isMuted(room, bot.id)) return false;
  const lastRound = factRound.get(room);
  if (lastRound != null && round - lastRound < 2) return false;
  if (Math.random() >= (persona(bot) === 'shy' ? 0.3 : 0.6)) return false;
  const pool = STUDY[persona(bot)].filter((x) => `t:${x}` !== last.get(bot.id));
  const text = pool[Math.floor(Math.random() * pool.length)];
  const ok = sayAsBot(room, { user_id: bot.id, name: bot.name, face: bot.character, kind: 'line', item: text }, 6000);
  if (ok) {
    factRound.set(room, round);
    last.set(bot.id, `t:${text}`);
  }
  return ok;
}

/** A rival's wrong guess (Diagnostic Pursuit), as a chat bubble that comes and goes; it can show beside other chat. */
export function rivalGuess(room: string, bot: Bot, text: string) {
  return popAsBot(room, { user_id: bot.id, name: bot.name, face: bot.character, kind: 'guess', item: text });
}

/** Forget a room's talk memory when it closes. */
export function resetRoomTalk(room: string) {
  factRound.delete(room);
  for (const k of [...used.keys()]) if (k.startsWith(`${room}|`)) used.delete(k);
  for (const k of [...tone.keys()]) if (k.startsWith(`${room}|`)) tone.delete(k);
}

/**
 * Rivals hear what you send (Yazan 2026-11-09: room-wide). One rival answers for the whole room, after a beat;
 * chattier personalities are likelier to be the one, and its personality picks the reply.
 */
export function useRivalEars(room: string | undefined, bots: Bot[]) {
  const ref = useRef(bots);
  useEffect(() => {
    ref.current = bots;
  }, [bots]);
  useEffect(() => {
    if (!room) return;
    let quietUntil = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const off = onTalk(room, (msg) => {
      const now = Date.now();
      if (now < quietUntil) return;
      const live = ref.current.filter((b) => !isMuted(room, b.id));
      if (!live.length) return;
      const weights = live.map((b) => 0.3 + CHATTY[persona(b)]);
      let x = Math.random() * weights.reduce((a, c) => a + c, 0);
      const who = live.find((_, i) => (x -= weights[i]) <= 0) ?? live[0];
      const label = msg.kind === 'sticker' ? (stickerById.get(msg.item)?.label ?? '') : '';
      const heard = heardKind(msg.kind, msg.item, label);
      // Every rival at the table remembers your tone for the rest of the match (the latest one counts).
      if (heard === 'nice' || heard === 'taunt') for (const b of live) tone.set(key(room, b), heard);
      quietUntil = now + 3500;
      const said = msg.kind === 'voice' ? msg.item : undefined;
      timers.push(setTimeout(() => rivalMoment(room, who, 'heard', { heard, said }), 2000 + Math.random() * 1000));
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [room]);
}
