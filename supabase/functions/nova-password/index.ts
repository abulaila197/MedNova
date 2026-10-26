// The Nova Password online referee: Yazan's rules on the server. The match is saved in pw_games with each player's own
// view next to it; phones read only their own view with pw_state, so a secret term only ever reaches its clue giver.
// The 1,000-term bank (with the forbidden words the clue check needs) lives in pw_terms; the first request fills it
// from terms.json at a pinned commit. Change BANK to a newer commit and empty pw_terms when the bank changes.
// Built with scripts/build-nova-password-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Term } from '../../../src/games/password/engine/types';
import { dueOf, MOVES, onlineRanks, scoresOf, startOnlineRoom, stepOnline, viewsOf, type Move, type Room } from '../../../src/games/password/online';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const BANK = 'https://raw.githubusercontent.com/abulaila197/MedNova/94aac00a03ded40d06ee5f73d5e46573c9682985/src/games/password/data/terms.json';
let TERMS: Term[] | null = null;

async function bank(): Promise<Term[]> {
  if (TERMS) return TERMS;
  const { data } = await admin.from('pw_terms').select('id, name, bank, category, forbidden').range(0, 1999);
  if (data && data.length >= 1000) return (TERMS = data as Term[]);
  const list = (await (await fetch(BANK)).json()) as Term[];
  const { error } = await admin.from('pw_terms').upsert(list);
  if (error) throw new Error(error.message);
  return (TERMS = list);
}
/** My diseases: the host's approved Password terms, in random order (Yazan 2026-10-26). */
async function ownTerms(host: string): Promise<Term[]> {
  if (!host) return [];
  const { data } = await admin.from('player_words').select('id, data').eq('user_id', host).eq('game', 'nova-password').eq('status', 'approved').limit(50);
  const rows = (data ?? []) as { id: string; data: { name: string; forbidden: string[] } }[];
  return rows
    .map((r) => ({ r, k: Math.random() }))
    .sort((x, y) => x.k - y.k)
    .map(({ r }) => ({ id: `c:${r.id}`, name: r.data.name, bank: 'clinical' as const, category: 'disease', forbidden: r.data.forbidden }));
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Loaded = {
  member: boolean;
  seats: string[];
  version: number;
  state: Room | null;
  host: string;
  room_id: string;
  match: { phase: string; ends_ms: number; settings: Record<string, unknown> };
  names: Record<string, string>;
  dropped: string[];
};

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
  let terms: Term[];
  try {
    terms = await bank();
  } catch {
    return json({ result: 'error', message: 'word bank unavailable' }, 500);
  }
  const move: Move = body.move && MOVES.has(body.move.type) ? body.move : { type: 'TICK' };
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('pw_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let saved = L.state;
    if (!saved) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      saved = startOnlineRoom({ host: L.host, seats: L.seats, names: L.names ?? {}, settings: L.match.settings ?? {} });
      if (L.match.settings?.own !== 'off') {
        const own = await ownTerms(L.host);
        if (own.length) saved = { ...saved, own };
      }
    }
    const { next, refused } = stepOnline(terms, saved, who.user.id, move, L.dropped ?? [], now);
    if (next === L.state) return json({ result: refused ? 'refused' : 'same', ...refused });
    const done = next.ended;
    const { data: ok, error: e2 } = await admin.rpc('pw_save', {
      m: body.m,
      ver: L.version,
      st: next,
      vw: viewsOf(next, terms),
      due: dueOf(next),
      scores: scoresOf(next, L.seats),
      ranks: done ? onlineRanks(next, L.seats) : null,
      ph: done ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: refused ? 'refused' : 'ok', version: L.version + 1, ...refused });
  }
  return json({ result: 'busy' }, 409);
});
