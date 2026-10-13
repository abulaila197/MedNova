// Play recorder: plays + play_items on the phone, with bookmark/resume.
// Rule 7: quitting solo bookmarks the play. Rule 10: an app kill resumes at the exact case and clock.
// Plays still going (and their items) live under their own small keys, so a bookmark or an answer rewrites only
// the games in progress; the history of ended plays is rewritten once when a play ends, not on every step.
import { serial, type KV } from './storage';
import type { GameKey, Mode, Play, PlayItem, Seat, Standing } from './types';
import { newId } from './ids';

const PLAYS = 'plays';
const ITEMS = 'play_items';
const OPEN = 'plays_open';
const OPEN_ITEMS = 'play_items_open';
/** Every key the recorder writes (sign-out clears them). */
export const RECORDER_KEYS = [PLAYS, ITEMS, OPEN, OPEN_ITEMS];

export type StartArgs = {
  game: GameKey;
  mode: Mode;
  submode?: string;
  settings: Record<string, unknown>;
  seats?: Seat[];
  userId?: string | null;
  now?: number;
};

export function createRecorder(kv: KV) {
  const list = async <T>(k: string) => (await kv.get<T[]>(k)) ?? [];
  const plays = async () => [...(await list<Play>(PLAYS)), ...(await list<Play>(OPEN))];
  const items = async () => [...(await list<PlayItem>(ITEMS)), ...(await list<PlayItem>(OPEN_ITEMS))];
  const put = <T extends { id: string }>(all: T[], row: T) => {
    const i = all.findIndex((x) => x.id === row.id);
    if (i >= 0) all[i] = row;
    else all.push(row);
    return all;
  };
  /** A play in progress goes under OPEN; once it ends it moves, with its items, into the history. */
  const savePlay = async (p: Play) => {
    const done = await list<Play>(PLAYS);
    const open = await list<Play>(OPEN);
    if (p.status === 'in_progress') {
      await kv.set(OPEN, put(open, p));
      if (done.some((x) => x.id === p.id)) await kv.set(PLAYS, done.filter((x) => x.id !== p.id));
      return p;
    }
    if (open.some((x) => x.id === p.id)) await kv.set(OPEN, open.filter((x) => x.id !== p.id));
    await kv.set(PLAYS, put(done, p));
    const openItems = await list<PlayItem>(OPEN_ITEMS);
    const mine = openItems.filter((i) => i.playId === p.id);
    if (mine.length) {
      await kv.set(ITEMS, [...(await list<PlayItem>(ITEMS)), ...mine]);
      await kv.set(OPEN_ITEMS, openItems.filter((i) => i.playId !== p.id));
    }
    return p;
  };
  /** Changes every saved play that `edit` returns a new value for, writing only the keys that changed. */
  const editPlays = async (edit: (p: Play) => Play | null) => {
    let n = 0;
    for (const k of [PLAYS, OPEN]) {
      let changed = false;
      const next = (await list<Play>(k)).map((p) => {
        const e = edit(p);
        if (!e) return p;
        changed = true;
        n++;
        return e;
      });
      if (changed) await kv.set(k, next);
    }
    return n;
  };

  const run = serial();
  return {
    start(a: StartArgs) {
      return run(async () => {
        const p: Play = {
          id: newId('play'),
          userId: a.userId ?? null,
          game: a.game,
          mode: a.mode,
          submode: a.submode,
          settings: Object.freeze({ ...a.settings }) as Record<string, unknown>,
          startedAt: a.now ?? Date.now(),
          endedAt: null,
          status: 'in_progress',
          score: 0,
          seats: a.seats ?? [{ seat: 0, name: 'You' }],
          standings: [],
          pauses: 0,
          expEarned: 0,
          resume: null,
          synced: false,
        };
        return savePlay(p);
      });
    },

    get(id: string) {
      return run(async () => {
        return (await plays()).find((p) => p.id === id) ?? null;
      });
    },

    /** Saves the game's resume snapshot. Call on every step and on pause, so a kill loses nothing. */
    bookmark(id: string, resume: unknown, score?: number) {
      return run(async () => {
        const p = (await plays()).find((x) => x.id === id);
        if (!p || p.status !== 'in_progress') return null;
        return savePlay({ ...p, resume, score: score ?? p.score });
      });
    },

    notePause(id: string) {
      return run(async () => {
        const p = (await plays()).find((x) => x.id === id);
        if (!p) return null;
        return savePlay({ ...p, pauses: p.pauses + 1 });
      });
    },

    /** Seats removed from the pause menu keep their row but stop taking turns (rule 17). */
    removeSeat(id: string, seat: number) {
      return run(async () => {
        const p = (await plays()).find((x) => x.id === id);
        if (!p) return null;
        return savePlay({ ...p, seats: p.seats.map((s) => (s.seat === seat ? { ...s, removed: true } : s)) });
      });
    },

    recordItem(item: Omit<PlayItem, 'id' | 'at'> & { at?: number }) {
      return run(async () => {
        const row: PlayItem = { ...item, id: newId('item'), at: item.at ?? Date.now() };
        const live = (await list<Play>(OPEN)).some((x) => x.id === item.playId);
        const key = live ? OPEN_ITEMS : ITEMS;
        await kv.set(key, [...(await list<PlayItem>(key)), row]);
        const p = (await plays()).find((x) => x.id === item.playId);
        if (p?.synced) await savePlay({ ...p, synced: false }); // the new item still needs uploading
        return row;
      });
    },

    itemsOf(playId: string) {
      return run(async () => {
        return (await items()).filter((i) => i.playId === playId);
      });
    },

    finish(id: string, a: { score: number; standings?: Standing[]; expEarned: number; now?: number }) {
      return run(async () => {
        const p = (await plays()).find((x) => x.id === id);
        if (!p) return null;
        return savePlay({
          ...p,
          status: 'finished',
          endedAt: a.now ?? Date.now(),
          score: a.score,
          standings: a.standings ?? [],
          expEarned: a.expEarned,
          resume: null,
          synced: false,
        });
      });
    },

    /** Notes the level this play's EXP reached, for the results line (LV1). */
    noteLevelUp(id: string, level: number, tokens: number) {
      return run(async () => {
        const p = (await plays()).find((x) => x.id === id);
        if (!p) return null;
        return savePlay({ ...p, levelUp: { level, tokens } });
      });
    },

    /** The bookmarked play the mode card offers as "Resume case N". */
    resumable(game: GameKey, mode: Mode) {
      return run(async () => {
        const list = (await plays()).filter((p) => p.game === game && p.mode === mode && p.status === 'in_progress');
        return list.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
      });
    },

    /** Starting a new game drops the old bookmark for that mode. */
    discard(id: string) {
      return run(async () => {
        for (const k of [PLAYS, OPEN]) {
          const all = await list<Play>(k);
          if (all.some((p) => p.id === id)) await kv.set(k, all.filter((p) => p.id !== id));
        }
        for (const k of [ITEMS, OPEN_ITEMS]) {
          const all = await list<PlayItem>(k);
          if (all.some((i) => i.playId === id)) await kv.set(k, all.filter((i) => i.playId !== id));
        }
      });
    },

    /** Rule 19: guest plays move to the account on first sign-in. */
    claimGuestPlays(userId: string) {
      return run(async () => {
        return editPlays((p) => (p.userId == null ? { ...p, userId, synced: false } : null));
      });
    },

    /** Plays of this account that still need uploading, with their items. */
    unsynced(userId: string) {
      return run(async () => {
        const ps = (await plays()).filter((p) => p.userId === userId && !p.synced);
        const ids = new Set(ps.map((p) => p.id));
        return { plays: ps, items: (await items()).filter((i) => ids.has(i.playId)) };
      });
    },

    markSynced(ids: string[]) {
      return run(async () => {
        const set = new Set(ids);
        await editPlays((p) => (set.has(p.id) && !p.synced ? { ...p, synced: true } : null));
      });
    },

    /** Adds plays and items from the account that this phone does not have yet (a new phone, or a reinstall). */
    mergeRemote(remote: { plays: Play[]; items: PlayItem[] }) {
      return run(async () => {
        const have = new Set((await plays()).map((p) => p.id));
        const add = remote.plays.filter((p) => !have.has(p.id)).map((p) => ({ ...p, synced: true }));
        const addDone = add.filter((p) => p.status !== 'in_progress');
        const addOpen = add.filter((p) => p.status === 'in_progress');
        if (addDone.length) await kv.set(PLAYS, [...(await list<Play>(PLAYS)), ...addDone]);
        if (addOpen.length) await kv.set(OPEN, [...(await list<Play>(OPEN)), ...addOpen]);
        const haveI = new Set((await items()).map((i) => i.id));
        const addI = remote.items.filter((i) => !haveI.has(i.id));
        if (addI.length) await kv.set(ITEMS, [...(await list<PlayItem>(ITEMS)), ...addI]);
        return add.length;
      });
    },

    /** Learn reads misses from here (rule 8: only items the game marked feedsLearn). */
    misses() {
      return run(async () => {
        return (await items()).filter((i) => i.feedsLearn && i.outcome !== 'right' && i.answerKey);
      });
    },

    all() {
      return run(async () => {
        return { plays: await plays(), items: await items() };
      });
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;
