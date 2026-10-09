// The Wheels of Chaos online referee (ON17, WC20-WC23). Runs the same engine as Pass the phone on the answer keys
// (wc_keys, one row per bank version), and saves the game in wc_games; phones read it with wc_state.
// Bundled with scripts/build-wheels-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Mix } from '../../../src/games/wheels/core';
import { decodeKeys, type Keys } from '../../../src/games/wheels/keys';
import type { FullBank } from '../../../src/games/wheels/offline';
import { dueOf, onlineRanks, startOnline, stepOnline, type Move, type OnlineWheels } from '../../../src/games/wheels/online';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const banks = new Map<string, FullBank>();
async function bankFor(v: string): Promise<FullBank | null> {
  if (!banks.has(v)) {
    const { data } = await admin.from('wc_keys').select('v, q, r, b').eq('v', v).maybeSingle();
    if (!data) return null;
    banks.set(v, decodeKeys(data as Keys));
  }
  return banks.get(v)!;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Loaded = {
  member: boolean;
  seat: number | null;
  seats: string[];
  version: number;
  state: OnlineWheels | null;
  match: { phase: string; ends_ms: number; settings: Record<string, unknown> };
  dropped: number[];
  swipes: Record<string, boolean[]>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ result: 'unauthorized' }, 401);
  let body: { m?: string; move?: Move; v?: string };
  try {
    body = await req.json();
  } catch {
    return json({ result: 'bad_request' }, 400);
  }
  if (!body.m || !body.v) return json({ result: 'bad_request' }, 400);
  const move: Move = body.move ?? { type: 'TICK' };
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('wc_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let o = L.state;
    // Every phone in a game must carry the bank the game started with.
    if (o && o.v !== body.v) return json({ result: 'bank' });
    const bank = await bankFor(body.v);
    if (!bank) return json({ result: 'bank' });
    if (!o) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      const target = Number(L.match.settings.target) === 100 ? 100 : 50;
      const mix = (['mixed', 'clinical', 'basic'].includes(String(L.match.settings.mix)) ? L.match.settings.mix : 'mixed') as Mix;
      o = startOnline(L.seats.length, target, mix, body.v, bank, Math.random, now);
    }
    const swipes: Record<number, boolean[]> = {};
    for (const [s, v] of Object.entries(L.swipes ?? {})) swipes[Number(s)] = v;
    const next = stepOnline(o, move, L.seat, { dropped: L.dropped ?? [], swipes }, bank, Math.random, now);
    if (next === L.state) return json({ result: 'same' });
    const done = next.g.phase === 'done';
    const { data: ok, error: e2 } = await admin.rpc('wc_save', {
      m: body.m, ver: L.version, st: next, due: dueOf(next), scores: next.g.scores, ranks: done ? onlineRanks(next.g) : null, ph: done ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: 'ok', version: L.version + 1 });
  }
  return json({ result: 'busy' }, 409);
});
