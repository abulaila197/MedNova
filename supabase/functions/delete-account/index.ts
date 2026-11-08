// The account deletion Edge Function (SO1, SO2).
// Invoked by src/state/account.ts to securely delete the authenticated user
// from auth.users, causing all linked profile and player data to cascade.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (req: Request) => Promise<Response>): void;
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Apple rule 5.1.1(v) (Yazan 2026-11-08): an account made with Sign in with Apple has its Apple link revoked before it
// is deleted, using the refresh token apple-token kept. A failed revoke never blocks the deletion.
const TEAM = '64476LDWP8';
const CLIENT = 'com.Novagames.MedNova';
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function appleSecret() {
  const pem = Deno.env.get('APPLE_SIWA_KEY');
  const kid = Deno.env.get('APPLE_SIWA_KEY_ID');
  if (!pem || !kid) throw new Error('Apple key not set');
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const body = `${text({ alg: 'ES256', kid })}.${text({ iss: TEAM, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: CLIENT })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}
async function revokeApple(userId: string) {
  try {
    const { data } = await admin.from('apple_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
    if (!data?.refresh_token) return;
    await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT, client_secret: await appleSecret(), token: data.refresh_token, token_type_hint: 'refresh_token' }),
    });
  } catch (e) {
    console.log('apple revoke failed', String((e as Error).message));
  }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who, error: authError } = await admin.auth.getUser(jwt);

  if (authError || !who?.user) {
    return json({ result: 'unauthorized' }, 401);
  }

  const userId = who.user.id;
  await revokeApple(userId);

  // Delete the user from auth.users using admin privileges.
  // Foreign keys with ON DELETE CASCADE remove associated records.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ result: 'error', message: deleteError.message }, 500);
  }

  return json({ result: 'ok', user_id: userId });
});
