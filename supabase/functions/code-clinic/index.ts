// The Code Clinic online referee (CC1): Yazan's room rules on the server. The match is saved in cc_games with each
// player's own view next to it; phones read only their own view with cc_state, so the key never reaches a guesser.
// The 1,000-word bank is bundled in. Bundled with scripts/build-code-clinic-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import terms from '../../../src/games/codeclinic/data/terms.json';
import type { Term } from '../../../src/games/codeclinic/engine/types';
import { dueOf, MOVES, onlineRanks, scoresOf, startOnlineRoom, stepOnline, viewsOf, type Move, type Room } from '../../../src/games/codeclinic/online';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TERMS = terms as Term[];
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
  const move: Move = body.move && MOVES.has(body.move.type) ? body.move : { type: 'TICK' };
  // Two phones can step in at once; the save only lands on the version it read, so a clash just runs again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await admin.rpc('cc_load', { m: body.m, u: who.user.id });
    if (error) return json({ result: 'error', message: error.message }, 500);
    const L = data as Loaded;
    if (!L.member) return json({ result: 'not_member' }, 403);
    if (L.match.phase === 'done') return json({ result: 'done' });
    const now = Date.now();
    let saved = L.state;
    if (!saved) {
      if (now < L.match.ends_ms) return json({ result: 'wait' });
      saved = startOnlineRoom({ host: L.host, seats: L.seats, names: L.names ?? {}, style: String(L.match.settings.style ?? 'mixed') });
    }
    const { next, refused } = stepOnline(TERMS, saved, who.user.id, move, L.dropped ?? [], now);
    if (next === L.state) return json({ result: refused ? 'refused' : 'same', ...refused });
    const done = next.ended;
    const { data: ok, error: e2 } = await admin.rpc('cc_save', {
      m: body.m, ver: L.version, st: next, vw: viewsOf(next), due: dueOf(next),
      scores: scoresOf(next, L.seats), ranks: done ? onlineRanks(next, L.seats) : null, ph: done ? 'done' : 'case',
    });
    if (e2) return json({ result: 'error', message: e2.message }, 500);
    if (ok) return json({ result: refused ? 'refused' : 'ok', version: L.version + 1, ...refused });
  }
  return json({ result: 'busy' }, 409);
});
