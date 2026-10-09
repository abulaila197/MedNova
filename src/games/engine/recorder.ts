// Play recorder: plays + play_items on the phone, with bookmark/resume.
// Rule 7: quitting solo bookmarks the play. Rule 10: an app kill resumes at the exact case and clock.
import { serial, type KV } from './storage';
import type { GameKey, Mode, Play, PlayItem, Seat, Standing } from './types';
import { newId } from './ids';

const PLAYS = 'plays';
const ITEMS = 'play_items';

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
  const plays = async () => (await kv.get<Play[]>(PLAYS)) ?? [];
  const items = async () => (await kv.get<PlayItem[]>(ITEMS)) ?? [];
  const savePlay = async (p: Play) => {
    const all = await plays();
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = p;
    else all.push(p);
    await kv.set(PLAYS, all);
    return p;
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
        const all = await items();
        const row: PlayItem = { ...item, id: newId('item'), at: item.at ?? Date.now() };
        all.push(row);
        await kv.set(ITEMS, all);
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
        await kv.set(PLAYS, (await plays()).filter((p) => p.id !== id));
        await kv.set(ITEMS, (await items()).filter((i) => i.playId !== id));
      });
    },

    /** Rule 19: guest plays move to the account on first sign-in. */
    claimGuestPlays(userId: string) {
      return run(async () => {
        const all = await plays();
        let n = 0;
        for (const p of all) if (p.userId == null) ((p.userId = userId), (p.synced = false), n++);
        await kv.set(PLAYS, all);
        return n;
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
        await kv.set(PLAYS, (await plays()).map((p) => (set.has(p.id) ? { ...p, synced: true } : p)));
      });
    },

    /** Adds plays and items from the account that this phone does not have yet (a new phone, or a reinstall). */
    mergeRemote(remote: { plays: Play[]; items: PlayItem[] }) {
      return run(async () => {
        const ps = await plays();
        const have = new Set(ps.map((p) => p.id));
        const add = remote.plays.filter((p) => !have.has(p.id));
        if (add.length) await kv.set(PLAYS, [...ps, ...add.map((p) => ({ ...p, synced: true }))]);
        const its = await items();
        const haveI = new Set(its.map((i) => i.id));
        const addI = remote.items.filter((i) => !haveI.has(i.id));
        if (addI.length) await kv.set(ITEMS, [...its, ...addI]);
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
