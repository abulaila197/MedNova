// The Silent Artist online guess check (SA7, SA8). The phone sends the typed guess; this runs the same coded
// matcher as Solo and Pass the phone against the turn's word, so a phone can't claim a right answer. The words
// and aliases come from sa_words (kept equal to src/games/silent/data/words.json).
// Bundled with scripts/build-silent-artist-function.sh.
import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Word } from '../../../src/games/silent/core';
import { buildAnswerIndex, evaluateGuess } from '../../../src/games/silent/guess';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
let bank: Promise<{ byId: Map<string, Word>; index: ReturnType<typeof buildAnswerIndex> }> | null = null;
const loadBank = () =>
  (bank ??= (async () => {
    const { data, error } = await admin.from('sa_words').select('id, name, field, aliases');
    if (error || !data?.length) throw new Error(error?.message ?? 'no words');
    const words = data as Word[];
    return { byId: new Map(words.map((w) => [w.id, w])), index: buildAnswerIndex(words) };
  })().catch((e) => {
    bank = null;
    throw e;
  }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ result: 'unauthorized' }, 401);
  let body: { m?: string; guess?: string };
  try {
    body = await req.json();
  } catch {
    return json({ result: 'bad_request' }, 400);
  }
  const guess = String(body.guess ?? '').slice(0, 120);
  if (!body.m || !guess.trim()) return json({ result: 'bad_request' }, 400);
  const { data: wid, error } = await admin.rpc('sa_target', { m: body.m, u: who.user.id });
  if (error) return json({ result: 'error', message: error.message }, 500);
  if (!wid) return json({ result: 'over' });
  let B;
  try {
    B = await loadBank();
  } catch (e) {
    return json({ result: 'error', message: String(e) }, 500);
  }
  const word = B.byId.get(wid as string);
  if (!word) return json({ result: 'over' });
  const verdict = evaluateGuess(guess, word, B.index);
  const { data: res, error: e2 } = await admin.rpc('sa_judge', { m: body.m, u: who.user.id, wid, verdict });
  if (e2) return json({ result: 'error', message: e2.message }, 500);
  return json({ result: res });
});
