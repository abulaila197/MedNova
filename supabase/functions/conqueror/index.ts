// The Conqueror online referee (CQ1-CQ21). Runs the same engine as the tests on the full question bank (cq_bank,
// one row per bank version), saves the whole match in cq_games and each player's own view in cq_views; phones read
// only their view with cq_state. Bundled with scripts/build-conqueror-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { makeBank, type Bank, type BankQ, type Mix } from '../../../src/games/conqueror/bank';
import { standings } from '../../../src/games/conqueror/core';
import { dueOf, startOnline, stepOnline, type OnlineConqueror, type PhoneAction } from '../../../src/games/conqueror/online';
import { envelopeFor } from '../../../src/games/conqueror/view';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };
/** The cq_bank row to read: the commit that last changed bank.json (set by the build script). */
declare const CQ_BANK: string;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
/** Spectators read the view saved under this id: every secret hidden. */
const WATCHER = '00000000-0000-0000-0000-000000000000';

// The bank lives in the database (cq_bank, one row per bank version, keyed by the commit that last changed
// bank.json). Load a new row before deploying a function built for a new bank version.
let bank: Bank | null = null;
async function loadBank(): Promise<Bank | null> {
  if (bank) return bank;
  const { data } = await admin.from('cq_bank').select('items').eq('v', CQ_BANK).maybeSingle();
  const items = (data?.items ?? null) as BankQ[] | null;
  if (!items) return null;
  bank = makeBank(items);
  return bank;
}

type Loaded = {
  member: boolean;
  seats: string[];
  version: number;
  state: OnlineConqueror | null;
  names: Record<string, string>;
  match: { phase: string; ends_ms: number; settings: Record<string, unknown> };
  away: string[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ result: 'unauthorized' }, 401);
  let body: { m?: string; action?: PhoneAction };
  try {
    body = await req.json();
  } catch {
    return json({ result: 'bad_request' }, 400);
  }
  if (!body.m) return json({ result: 'bad_request' }, 400);
  const action = body.action && typeof body.action.type === 'string' ? body.action : null;
  const b = await loadBank();
  if (!b) return json({ result: 'error', message: 'bank' }, 500);
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('cq_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let o = L.state;
    if (!o) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      const mix = (['mixed', 'clinical', 'basic'].includes(String(L.match.settings.mix)) ? L.match.settings.mix : 'mixed') as Mix;
      o = startOnline(L.seats.map((id) => ({ id, name: L.names[id] ?? 'Player' })), mix, Math.random, now);
    }
    const next = stepOnline(o, action, who.user.id, L.away ?? [], b, Math.random, now);
    if (next === L.state) return json({ result: 'same' });
    const m = next.m;
    const over = m.phase === 'over';
    const views: Record<string, unknown> = { [WATCHER]: envelopeFor(next, '') };
    for (const id of L.seats) views[id] = envelopeFor(next, id);
    const order = standings(m).map((p) => p.id);
    const { data: ok, error: e2 } = await admin.rpc('cq_save', {
      m: body.m,
      ver: L.version,
      st: next,
      due: dueOf(next),
      views,
      scores: L.seats.map((id) => m.landOrder.filter((l) => m.lands[l].owner === id).length),
      ranks: over ? L.seats.map((id) => order.indexOf(id) + 1) : null,
      gone: L.seats.filter((id) => m.players[id]?.outReason === 'away'),
      ph: over ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: 'ok', version: L.version + 1 });
  }
  return json({ result: 'busy' }, 409);
});
