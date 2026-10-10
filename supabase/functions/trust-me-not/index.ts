// Trust Me Not online referee (rule book §10). Runs the same engine as the tests: saves the whole year in tmn_games
// and each player's own view in tmn_views; phones read only their view with tmn_state. The question bank needed here
// is ids and right choices only (bank.json, built by scripts/build-tmn-questions.mjs); phones hold the text. It is read
// from table tmn_keys (one row per bank version, like wc_keys), which keeps the deployed bundle small.
// Bundled with scripts/build-tmn-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { dueOf, envelopeFor, finalOrder, startOnline, stepOnline, watcherEnvelope, type BankRow, type OnlineTmn, type PhoneAction } from '../../../src/games/trustmenot/online';
import { TMN_SEATS as SEATS } from '../../../src/games/trustmenot/seats';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
/** Spectators read the view saved under this id. */
const WATCHER = '00000000-0000-0000-0000-000000000000';
/** The tmn_keys row to read: first 12 hex of bank.json's sha256. When the bank changes, insert a new row and bump this. */
const TMN_BANK = '809c3c285e16';
let bank: BankRow[] | null = null;
async function loadBank() {
  if (bank) return bank;
  const { data, error } = await admin.from('tmn_keys').select('rows').eq('v', TMN_BANK).maybeSingle();
  if (error || !data) throw new Error(`bank ${error?.message ?? 'missing'}`);
  return (bank = data.rows as BankRow[]);
}

type Loaded = {
  member: boolean;
  seats: string[];
  version: number;
  state: OnlineTmn | null;
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
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('tmn_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let o = L.state;
    if (!o) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      const mix = String(L.match.settings.mix);
      const field = mix === 'basic' || mix === 'clinical' ? mix : 'mixed';
      const players = L.seats.map((id, i) => ({ id, name: L.names[id] ?? 'Player', color: SEATS[i % SEATS.length] }));
      o = startOnline(players, field, await loadBank(), (Math.random() * 2 ** 31) | 0, now);
    }
    const next = stepOnline(o, action, who.user.id, L.away ?? [], now);
    if (next === L.state) return json({ result: 'same' });
    const g = next.g;
    const over = g.phase === 'over';
    const views: Record<string, unknown> = { [WATCHER]: watcherEnvelope(next) };
    for (const id of L.seats) views[id] = envelopeFor(next, id);
    const ranks = finalOrder(g);
    const { data: ok, error: e2 } = await admin.rpc('tmn_save', {
      m: body.m,
      ver: L.version,
      st: next,
      due: dueOf(next),
      views,
      scores: L.seats.map((id) => ranks.find((r) => r.id === id)?.score ?? 0),
      ranks: over ? L.seats.map((id) => ranks.findIndex((r) => r.id === id) + 1) : null,
      gone: L.seats.filter((id) => g.players.find((p) => p.id === id)?.fled),
      ph: over ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: 'ok', version: L.version + 1 });
  }
  return json({ result: 'busy' }, 409);
});
