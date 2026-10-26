// The Imposter online referee (IM2): Yazan's engine on the server. The game is saved in im_games with each player's
// own view next to it; phones read only their own view with im_state, so words never reach the wrong phone.
// The word bank (packed, bank.json) and the bad-word list are bundled in. Bundled with scripts/build-imposter-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { unpackBank, type PackedBank } from '../../../src/games/imposter/bankCodec';
import type { SubtypeChoice, WordPair } from '../../../src/games/imposter/engine/types';
import { dueOf, onlineRanks, scoresOf, startOnlineGame, stepOnline, viewsOf, type Move, type Saved } from '../../../src/games/imposter/online';
import packed from './bank.json' with { type: 'json' };

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const BANK = unpackBank(packed as PackedBank);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Loaded = {
  member: boolean;
  seats: string[];
  version: number;
  state: Saved | null;
  host: string;
  room_id: string;
  match: { phase: string; ends_ms: number; settings: Record<string, unknown> };
  names: Record<string, string>;
  dropped: string[];
};

/** My diseases: up to `n` of the host's approved Imposter pairs, in random order (Yazan 2026-10-26). */
async function ownPairs(host: string, n: number): Promise<WordPair[]> {
  if (n < 1 || !host) return [];
  const { data } = await admin.from('player_words').select('id, data').eq('user_id', host).eq('game', 'imposter').eq('status', 'approved').limit(50);
  const rows = (data ?? []) as { id: string; data: { a: string; b: string; category: string } }[];
  return rows
    .map((r) => ({ r, k: Math.random() }))
    .sort((x, y) => x.k - y.k)
    .slice(0, n)
    .map(({ r }) => ({ id: `c:${r.id}`, subtype: 'clinical' as const, category: r.data.category, a: { word: r.data.a, alts: [] }, b: { word: r.data.b, alts: [] }, kind: 'disease' as const }));
}

const MOVES = new Set(['TICK', 'SUBMIT_CLUE', 'DECIDE', 'CAST_VOTE', 'SUBMIT_GUESS', 'NEXT_ROUND']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ result: 'unauthorized' }, 401);
  let body: { m?: string; move?: Move };
  try {
    body = await req.json();
  } catch {
    return json({ result: 'bad_request' }, 400);
  }
  if (!body.m) return json({ result: 'bad_request' }, 400);
  const move: Move = body.move && MOVES.has(body.move.type) ? body.move : { type: 'TICK' };
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('im_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let saved = L.state;
    if (!saved) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      const rounds = Number(L.match.settings.rounds) || 3;
      const own = L.match.settings.own === 'off' ? [] : await ownPairs(L.host, Math.floor(rounds / 2));
      const g = startOnlineGame({
        bank: BANK, roomId: L.room_id, host: L.host, seats: L.seats, names: L.names ?? {},
        style: String(L.match.settings.style ?? 'mixed') as SubtypeChoice, rounds, now, first: own,
      });
      saved = own.length ? { g, alerts: [], own } : { g, alerts: [] };
    }
    const { next, refused } = stepOnline(BANK, saved, who.user.id, move, L.dropped ?? [], now);
    if (next === L.state) return json({ result: refused ? 'refused' : 'same', ...refused });
    // A match that could not start (too few players) or that ran out ends here.
    const done = next.g.phase.kind === 'matchEnd' || next.g.phase.kind === 'lobby';
    const { data: ok, error: e2 } = await admin.rpc('im_save', {
      m: body.m, ver: L.version, st: next, vw: viewsOf(next, now), due: dueOf(next),
      scores: scoresOf(next.g, L.seats), ranks: done ? onlineRanks(next.g, L.seats) : null, ph: done ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: refused ? 'refused' : 'ok', version: L.version + 1, ...refused });
  }
  return json({ result: 'busy' }, 409);
});
