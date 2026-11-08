// Sign in with Apple, step 2 (Apple rule 5.1.1(v), Yazan 2026-11-08): the phone sends the one-time authorization code
// Apple gave it; we swap it for a refresh token and keep it (public.apple_tokens), so delete-account can revoke the
// Apple link when the player deletes their account. Needs secrets APPLE_SIWA_KEY (.p8 text) and APPLE_SIWA_KEY_ID.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const TEAM = '64476LDWP8';
const CLIENT = 'com.Novagames.MedNova';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** Apple's client secret: a short-lived ES256 JWT signed with the Sign in with Apple key. */
export async function appleSecret() {
  const pem = Deno.env.get('APPLE_SIWA_KEY');
  const kid = Deno.env.get('APPLE_SIWA_KEY_ID');
  if (!pem || !kid) throw new Error('Apple key not set');
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const body = `${text({ alg: 'ES256', kid })}.${text({ iss: TEAM, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: CLIENT })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body));
  return `${body}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ result: 'unauthorized' }, 401);
  const { code } = ((await req.json().catch(() => ({}))) ?? {}) as { code?: string };
  if (!code || typeof code !== 'string' || code.length > 2000) return json({ result: 'bad request' }, 400);
  try {
    const r = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT, client_secret: await appleSecret(), code, grant_type: 'authorization_code' }),
    });
    const t = (await r.json().catch(() => ({}))) as { refresh_token?: string; error?: string };
    if (!r.ok || !t.refresh_token) return json({ result: 'apple refused', error: t.error ?? r.status }, 502);
    const { error } = await admin.from('apple_tokens').upsert({ user_id: who.user.id, refresh_token: t.refresh_token, updated_at: new Date().toISOString() });
    if (error) return json({ result: 'error', message: error.message }, 500);
    return json({ result: 'ok' });
  } catch (e) {
    return json({ result: 'error', message: String((e as Error).message) }, 500);
  }
});
